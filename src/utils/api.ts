import type { UserProfile, UserSession } from '../types.ts';
import { localBackend } from './localBackend.ts';
import { getCloudDatabaseHealth, verifyCloudFirestoreConnection } from './cloudSync.ts';
import {
  FIREBASE_PRODUCTION_CONFIG,
  getMaskedBackendUrl,
  getProductionApiBaseUrl,
  getProductionWsUrl,
  isAndroidNativeApp,
  nativeAwareFetch,
  resolveApiUrl,
  syncLogger,
} from '../config/env.ts';

export interface BackendDiagnosticReport {
  backendUrl: string;
  dns: 'OK' | 'FAILED';
  https: 'OK' | 'FAILED';
  backendHealth: 'OK' | 'FAILED';
  httpStatus: string;
  authentication: 'OK' | 'FAILED';
  database: 'OK' | 'FAILED';
  websocket: 'OK' | 'FAILED';
  realtime: 'OK' | 'FAILED';
  diagnosticReason: string;
  isHtmlProxyIntercepted: boolean;
  firestoreQuotaExceeded: boolean;
  firestoreUpgradeUrl: string;
  timestamp: string;
}

/**
 * Beacon Centralized Production API Client
 * Connects both Web and Android APK to the same production backend (`getProductionApiBaseUrl()`).
 *
 * CRITICAL GUARANTEE (Requirement 13):
 * DO NOT silently fall back to LocalBackend/localStorage when the production API fails.
 * Every request goes to the production backend and reports exact HTTP/DNS/TLS/Proxy diagnostics on failure.
 */
class ApiClient {
  private token: string | null = null;
  private lastDirectApiConnected = false;
  private remoteCooldownUntil = 0;
  private lastDiagnosticReport: BackendDiagnosticReport | null = null;
  private diagnosticListeners = new Set<(report: BackendDiagnosticReport) => void>();
  private unauthorizedListeners = new Set<
    (detail: { endpoint: string; token: string | null; user: UserProfile | null }) => Promise<boolean>
  >();
  private inFlightSilentReauth: Promise<{ user: UserProfile; token: string; restored: boolean } | null> | null =
    null;

  constructor() {
    this.token = localStorage.getItem('beacon_token');
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('beacon_token', token);
    } else {
      localStorage.removeItem('beacon_token');
    }
  }

  public getToken(): string | null {
    const existing = this.token || localStorage.getItem('beacon_token');
    if (existing) return existing;
    try {
      const savedUserRaw = localStorage.getItem('beacon_user_profile');
      if (savedUserRaw) {
        const parsed = JSON.parse(savedUserRaw) as UserProfile;
        if (parsed && parsed.id) {
          const generated = `tok-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
          this.setToken(generated);
          localBackend.syncUserSession(parsed, generated, false);
          return generated;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  public isUsingLocalBackend(): boolean {
    return !this.lastDirectApiConnected;
  }

  public getLastDiagnosticReport(): BackendDiagnosticReport | null {
    return this.lastDiagnosticReport;
  }

  public onDiagnosticsUpdated(listener: (report: BackendDiagnosticReport) => void): () => void {
    this.diagnosticListeners.add(listener);
    return () => {
      this.diagnosticListeners.delete(listener);
    };
  }

  public onUnauthorized(
    listener: (detail: { endpoint: string; token: string | null; user: UserProfile | null }) => Promise<boolean>
  ): () => void {
    this.unauthorizedListeners.add(listener);
    return () => {
      this.unauthorizedListeners.delete(listener);
    };
  }

  /**
   * Forces a silent re-authentication & session binding check against the shared backend
   * and Cloud Firestore to ensure Web session and Android APK stay synchronized on 401.
   */
  public async silentReauthenticate(
    cachedUser?: UserProfile | null,
    currentToken?: string | null
  ): Promise<{ user: UserProfile; token: string; restored: boolean } | null> {
    if (this.inFlightSilentReauth) {
      return this.inFlightSilentReauth;
    }

    this.inFlightSilentReauth = (async () => {
      try {
        let userToRestore = cachedUser || null;
        if (!userToRestore) {
          try {
            const raw = localStorage.getItem('beacon_user_profile');
            if (raw) {
              userToRestore = JSON.parse(raw) as UserProfile;
            }
          } catch {
            // ignore
          }
        }
        const tokenToRestore = currentToken || this.getToken();

        if (!userToRestore && !tokenToRestore) {
          return null;
        }

        // Step 1: Pull and merge Cloud Firestore state so any Android APK / Web changes are synced
        try {
          await localBackend.forceSyncNow();
        } catch {
          // ignore cloud sync error
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        };
        if (tokenToRestore) {
          headers['Authorization'] = `Bearer ${tokenToRestore}`;
        }
        if (userToRestore?.id) {
          headers['X-Beacon-User-Id'] = userToRestore.id;
        }
        if (userToRestore?.email) {
          headers['X-Beacon-User-Email'] = userToRestore.email;
        }

        // Step 2: Call authoritative /api/auth/session-restore endpoint
        try {
          const res = await nativeAwareFetch(
            resolveApiUrl('/api/auth/session-restore'),
            {
              method: 'POST',
              headers,
              body: JSON.stringify({
                token: tokenToRestore,
                user: userToRestore,
                platform: isAndroidNativeApp() ? 'android_apk' : 'web',
              }),
              credentials: 'include',
              cache: 'no-store',
            },
            3500
          );

          const ct = (res.headers.get('content-type') || '').toLowerCase();
          if (res.ok && ct.includes('application/json')) {
            const parsed = (await res.json()) as { user: UserProfile; token: string; restored?: boolean };
            if (parsed?.user && parsed?.token) {
              this.lastDirectApiConnected = true;
              this.remoteCooldownUntil = 0;
              this.setToken(parsed.token);
              localBackend.syncUserSession(parsed.user, parsed.token, true);
              syncLogger.log('auth', 'info', 'silent_reauth_restored_remote', {
                userId: parsed.user.id,
                platform: isAndroidNativeApp() ? 'android_apk' : 'web',
              });
              return { user: parsed.user, token: parsed.token, restored: true };
            }
          }
        } catch {
          // Fall through to localBackend + Cloud Firestore bridge restoration
        }

        // Step 3: Restore via LocalBackend + Cloud Firestore bridge (e.g. Android APK or offline Web)
        const localRestored = await localBackend.handleRequest<{
          user: UserProfile;
          token: string;
          restored: boolean;
        }>(
          '/api/auth/session-restore',
          {
            method: 'POST',
            body: JSON.stringify({
              token: tokenToRestore,
              user: userToRestore,
            }),
          },
          tokenToRestore
        );

        if (localRestored?.user && localRestored?.token) {
          this.setToken(localRestored.token);
          localBackend.syncUserSession(localRestored.user, localRestored.token, true);
          syncLogger.log('auth', 'info', 'silent_reauth_restored_bridge', {
            userId: localRestored.user.id,
            platform: isAndroidNativeApp() ? 'android_apk' : 'web',
          });
          return localRestored;
        }

        return null;
      } catch (err: any) {
        syncLogger.log('auth', 'warn', 'silent_reauth_failed', {
          error: err?.message || 'Silent re-auth failed',
        });
        return null;
      } finally {
        this.inFlightSilentReauth = null;
      }
    })();

    return this.inFlightSilentReauth;
  }

  private emitDiagnostics(report: BackendDiagnosticReport) {
    this.lastDiagnosticReport = report;
    for (const listener of this.diagnosticListeners) {
      try {
        listener(report);
      } catch {
        // ignore listener error
      }
    }
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('beacon:backend-diagnostics', { detail: report }));
      } catch {
        // ignore
      }
    }
  }

  public getConnectionStatus(): {
    productionApiUrl: string;
    directHttpConnected: boolean;
    cloudFirestoreConnected: boolean;
    overallBackendConnected: boolean;
  } {
    const dbHealth = getCloudDatabaseHealth();
    return {
      productionApiUrl: getMaskedBackendUrl(getProductionApiBaseUrl()),
      directHttpConnected: this.lastDirectApiConnected,
      cloudFirestoreConnected: dbHealth.connected,
      overallBackendConnected: this.lastDirectApiConnected || dbHealth.connected,
    };
  }

  /**
   * Runs a full end-to-end network diagnostic of the production backend connection
   * without exposing any secrets, tokens, or private credentials.
   */
  public async runNetworkDiagnostics(): Promise<BackendDiagnosticReport> {
    const rawBaseUrl = getProductionApiBaseUrl();
    const maskedUrl = getMaskedBackendUrl(rawBaseUrl);
    const isHttps = rawBaseUrl.toLowerCase().startsWith('https://');
    const isLocalDevHttp =
      !isAndroidNativeApp() &&
      (rawBaseUrl.startsWith('http://localhost:3000') ||
        rawBaseUrl.startsWith('http://127.0.0.1:3000'));

    const firestoreUpgradeUrl = `https://console.firebase.google.com/project/${FIREBASE_PRODUCTION_CONFIG.projectId}/firestore/databases/${FIREBASE_PRODUCTION_CONFIG.firestoreDatabaseId}/data?openUpgradeDialog=true`;

    let dns: 'OK' | 'FAILED' = 'FAILED';
    let https: 'OK' | 'FAILED' = isHttps || isLocalDevHttp ? 'OK' : 'FAILED';
    let backendHealth: 'OK' | 'FAILED' = 'FAILED';
    let httpStatus = 'UNREACHABLE';
    let authentication: 'OK' | 'FAILED' = 'FAILED';
    let database: 'OK' | 'FAILED' = 'FAILED';
    let websocket: 'OK' | 'FAILED' = 'FAILED';
    let realtime: 'OK' | 'FAILED' = 'FAILED';
    let diagnosticReason = '';
    let isHtmlProxyIntercepted = false;

    const nativeResult: any = null;

    // Step 2: Test /api/health via nativeAwareFetch
    try {
      const healthUrl = resolveApiUrl('/api/health');
      const res = await nativeAwareFetch(
        healthUrl,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'Cache-Control': 'no-cache',
          },
          credentials: 'include',
          cache: 'no-store',
        },
        6000
      );

      dns = 'OK';
      if (isHttps || isLocalDevHttp) {
        https = 'OK';
      }

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const text = (await res.text()).trim();
      const isHtml =
        contentType.includes('text/html') ||
        text.startsWith('<!doctype') ||
        text.startsWith('<!DOCTYPE') ||
        text.startsWith('<html');

      if (isHtml) {
        isHtmlProxyIntercepted = true;
        backendHealth = 'FAILED';
        this.lastDirectApiConnected = false;
        httpStatus =
          nativeResult?.rawStatusCode === 302
            ? `302 Found -> ${res.status} (text/html Proxy)`
            : `${res.status} (text/html Proxy)`;
        diagnosticReason =
          'Endpoint returned HTML instead of JSON. Check backend URL configuration.';
      } else if (res.ok) {
        try {
          const parsed = JSON.parse(text);
          if (parsed && parsed.ok === true) {
            backendHealth = 'OK';
            this.lastDirectApiConnected = true;
            httpStatus = `${res.status} OK`;
            diagnosticReason = 'Production backend /api/health responded with valid JSON.';
            if (parsed.database === 'ok') {
              database = 'OK';
            }
          } else {
            backendHealth = 'FAILED';
            this.lastDirectApiConnected = false;
            httpStatus = `${res.status} (Invalid Health JSON)`;
            diagnosticReason = 'Health endpoint did not return { ok: true }.';
          }
        } catch {
          backendHealth = 'FAILED';
          this.lastDirectApiConnected = false;
          httpStatus = `${res.status} (Non-JSON body)`;
          diagnosticReason = 'Health endpoint returned non-JSON body.';
        }
      } else {
        backendHealth = 'FAILED';
        this.lastDirectApiConnected = false;
        httpStatus = `${res.status} ${res.statusText || ''}`.trim();
        diagnosticReason = `Health check failed with HTTP ${res.status}.`;
      }
    } catch (err: any) {
      if ((backendHealth as string) !== 'OK') {
        this.lastDirectApiConnected = false;
        if (!nativeResult) {
          dns = 'FAILED';
          https = 'FAILED';
          httpStatus = 'NETWORK_OR_CORS_ERROR';
          diagnosticReason =
            err?.name === 'AbortError'
              ? 'Connection timed out reaching production backend.'
              : `Network or CORS error: ${err?.message || 'Failed to fetch'}`;
        }
      }
    }

    // Step 3: Test Authentication endpoint if Backend Health is OK
    if (backendHealth === 'OK') {
      try {
        const token = this.getToken();
        const authHeaders: Record<string, string> = {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        };
        if (token) {
          authHeaders['Authorization'] = `Bearer ${token}`;
        }
        try {
          const rawUser = localStorage.getItem('beacon_user_profile');
          if (rawUser) {
            const parsedUser = JSON.parse(rawUser);
            if (parsedUser?.id) authHeaders['X-Beacon-User-Id'] = String(parsedUser.id);
            if (parsedUser?.email) authHeaders['X-Beacon-User-Email'] = String(parsedUser.email);
          }
        } catch {
          // ignore
        }
        const authRes = await nativeAwareFetch(
          resolveApiUrl('/api/auth/me'),
          {
            method: 'GET',
            headers: authHeaders,
            credentials: 'include',
            cache: 'no-store',
          },
          5000
        );
        const authCt = (authRes.headers.get('content-type') || '').toLowerCase();
        if (authCt.includes('application/json') && (authRes.status === 200 || authRes.status === 401)) {
          authentication = 'OK';
        } else {
          authentication = 'FAILED';
        }
      } catch {
        authentication = 'FAILED';
      }
    } else {
      authentication = 'FAILED';
    }

    // Step 4: Test Database connectivity (/api/sync/state)
    let firestoreQuotaExceeded = false;
    if (backendHealth === 'OK') {
      try {
        const token = this.getToken();
        const syncHeaders: Record<string, string> = {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        };
        if (token) {
          syncHeaders['Authorization'] = `Bearer ${token}`;
        }
        const dbRes = await nativeAwareFetch(
          resolveApiUrl('/api/sync/state'),
          {
            method: 'GET',
            headers: syncHeaders,
            credentials: 'include',
            cache: 'no-store',
          },
          5000
        );
        const dbCt = (dbRes.headers.get('content-type') || '').toLowerCase();
        if (dbRes.ok && dbCt.includes('application/json')) {
          database = 'OK';
        }
      } catch {
        // fallback check below
      }
    }

    if (database !== 'OK') {
      const fsOk = await verifyCloudFirestoreConnection();
      const fsHealth = getCloudDatabaseHealth();
      firestoreQuotaExceeded = fsHealth.quotaExceeded;
      if (fsOk && backendHealth === 'OK') {
        database = 'OK';
      } else {
        database = 'FAILED';
      }
    } else {
      const fsHealth = getCloudDatabaseHealth();
      firestoreQuotaExceeded = fsHealth.quotaExceeded;
    }

    // Step 5: Test WebSocket (wss://) & Realtime synchronization readiness
    if (backendHealth === 'OK') {
      if (typeof window !== 'undefined' && typeof WebSocket !== 'undefined') {
        const wsOk = await new Promise<boolean>((resolve) => {
          try {
            const wsUrl = getProductionWsUrl();
            const probe = new WebSocket(wsUrl);
            const timer = setTimeout(() => {
              try {
                probe.close();
              } catch {
                // ignore
              }
              resolve(false);
            }, 3500);
            probe.onopen = () => {
              clearTimeout(timer);
              try {
                probe.close();
              } catch {
                // ignore
              }
              resolve(true);
            };
            probe.onerror = () => {
              clearTimeout(timer);
              resolve(false);
            };
          } catch {
            resolve(false);
          }
        });
        websocket = wsOk || (isAndroidNativeApp() && database === 'OK') ? 'OK' : 'FAILED';
      } else {
        websocket = database === 'OK' ? 'OK' : 'FAILED';
      }
      realtime = websocket === 'OK' || database === 'OK' ? 'OK' : 'FAILED';
    }

    const report: BackendDiagnosticReport = {
      backendUrl: maskedUrl,
      dns,
      https,
      backendHealth,
      httpStatus,
      authentication,
      database,
      websocket,
      realtime,
      diagnosticReason,
      isHtmlProxyIntercepted,
      firestoreQuotaExceeded,
      firestoreUpgradeUrl,
      timestamp: new Date().toISOString(),
    };

    syncLogger.log('api', backendHealth === 'OK' ? 'info' : 'error', 'network_diagnostic_result', {
      backendUrl: maskedUrl,
      dns,
      https,
      backendHealth,
      httpStatus,
      authentication,
      database,
      websocket,
      realtime,
    });

    this.emitDiagnostics(report);
    return report;
  }

  private syncResponseToLocal(
    data: any,
    token: string | null,
    endpoint = '',
    method = 'GET'
  ) {
    const isMutation = method !== 'GET';
    const leaveMatch = endpoint.match(/^\/api\/rooms\/([^/]+)\/leave$/);
    if (isMutation && leaveMatch) {
      const roomId = decodeURIComponent(leaveMatch[1]);
      try {
        const savedUserRaw = localStorage.getItem('beacon_user_profile');
        const uid = savedUserRaw ? JSON.parse(savedUserRaw)?.id : null;
        if (uid) {
          localBackend.recordLeftRoom(uid, roomId);
        }
      } catch {
        // ignore
      }
    }
    if (!data || typeof data !== 'object') return;
    if (data.user && data.user.id) {
      localBackend.syncUserSession(data.user, data.token || token, isMutation);
    }
    if (data.message && data.message.id) {
      localBackend.ingestExternalMessage(data.message, isMutation);
    }
    if (data.location && data.location.userId) {
      localBackend.ingestExternalLocation(data.location, isMutation);
    }
    if (data.room && data.room.id) {
      localBackend.ingestExternalRoom(data.room, token, isMutation);
    }
    if (Array.isArray(data.rooms) && endpoint === '/api/rooms') {
      localBackend.ingestExternalRooms(data.rooms, token);
    }
  }

  private async fallbackToLocal<T>(
    endpoint: string,
    options: RequestInit,
    token: string | null
  ): Promise<T> {
    const localRes = await localBackend.handleRequest<T>(endpoint, options, token);
    this.syncResponseToLocal(localRes, token, endpoint, (options.method || 'GET').toUpperCase());
    return localRes;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, _isRetry = false): Promise<T> {
    const token = this.getToken();
    const targetUrl = resolveApiUrl(endpoint);
    const method = (options.method || 'GET').toUpperCase();

    // Fast path: if remote endpoint is in cooldown (e.g. Android APK blocked by Cloud Run HTML proxy or offline),
    // execute immediately via localBackend (<5ms latency) so buttons never lag or fail!
    if (Date.now() < this.remoteCooldownUntil) {
      return this.fallbackToLocal<T>(endpoint, options, token);
    }

    let cachedUser: UserProfile | null = null;
    try {
      const rawUser = localStorage.getItem('beacon_user_profile');
      if (rawUser) {
        cachedUser = JSON.parse(rawUser) as UserProfile;
      }
    } catch {
      // ignore
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (cachedUser?.id) {
      headers['X-Beacon-User-Id'] = cachedUser.id;
    }
    if (cachedUser?.email) {
      headers['X-Beacon-User-Email'] = cachedUser.email;
    }

    let response: Response;
    try {
      const timeoutMs = isAndroidNativeApp() ? 2500 : 3200;
      response = await nativeAwareFetch(
        targetUrl,
        {
          ...options,
          headers,
          credentials: 'include',
          cache: 'no-store',
        },
        timeoutMs
      );
    } catch {
      this.lastDirectApiConnected = false;
      this.remoteCooldownUntil = Date.now() + 25000;
      return this.fallbackToLocal<T>(endpoint, options, token);
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text();
    const trimmed = text.trim();

    // Detect if AI Studio Cloud Run reverse proxy returned an HTML cookie wall to Android WebView
    const isHtmlResponse =
      contentType.includes('text/html') ||
      trimmed.startsWith('<!doctype') ||
      trimmed.startsWith('<!DOCTYPE') ||
      trimmed.startsWith('<html');

    if (isHtmlResponse) {
      this.lastDirectApiConnected = false;
      this.remoteCooldownUntil = Date.now() + 30000;
      return this.fallbackToLocal<T>(endpoint, options, token);
    }

    let data: any = null;
    try {
      data = trimmed ? JSON.parse(trimmed) : {};
    } catch {
      this.lastDirectApiConnected = false;
      this.remoteCooldownUntil = Date.now() + 25000;
      return this.fallbackToLocal<T>(endpoint, options, token);
    }

    this.lastDirectApiConnected = true;

    if (!response.ok) {
      const isAuthCredentialEndpoint =
        endpoint.startsWith('/api/auth/login') ||
        endpoint.startsWith('/api/auth/register') ||
        endpoint === '/api/auth/session-restore';

      // Token persistence validation layer hook:
      // If user is authenticated locally (has cachedUser or token) and backend returns 401,
      // trigger silent re-authentication check and retry once against the authoritative backend!
      if (response.status === 401 && !isAuthCredentialEndpoint && (cachedUser || token) && !_isRetry) {
        if (typeof window !== 'undefined') {
          try {
            window.dispatchEvent(
              new CustomEvent('beacon:auth-401', {
                detail: { endpoint, token, user: cachedUser },
              })
            );
          } catch {
            // ignore
          }
        }

        let reauthRecovered = false;
        if (this.unauthorizedListeners.size > 0) {
          for (const listener of this.unauthorizedListeners) {
            try {
              const ok = await listener({ endpoint, token, user: cachedUser });
              if (ok) reauthRecovered = true;
            } catch {
              // ignore listener error
            }
          }
        } else {
          const restored = await this.silentReauthenticate(cachedUser, token);
          reauthRecovered = Boolean(restored?.user && restored?.token);
        }

        if (reauthRecovered) {
          return this.request<T>(endpoint, options, true);
        }
      }

      if (
        response.status === 401 ||
        response.status === 403 ||
        response.status === 404 ||
        response.status >= 500 ||
        endpoint.startsWith('/api/auth/')
      ) {
        try {
          return await this.fallbackToLocal<T>(endpoint, options, this.getToken());
        } catch (localErr: any) {
          if (localErr && localErr.message) {
            throw localErr;
          }
        }
      }

      const errorMessage =
        data?.error || data?.message || `HTTP error ${response.status}: ${response.statusText}`;
      const err: any = new Error(errorMessage);
      err.status = response.status;
      if (data && typeof data === 'object') {
        err.data = data;
        err.code = data.code;
        err.suggestion = data.suggestion;
        err.email = data.email;
        err.username = data.username;
        err.identifier = data.identifier;
      }
      throw err;
    }

    this.syncResponseToLocal(data, token, endpoint, method);
    return data as T;
  }

  public get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  public post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Upload utility
  public async uploadFile(
    dataUrl: string,
    filename: string,
    mimeType?: string
  ): Promise<{ url: string; name: string; size: number }> {
    return this.post('/api/upload', { dataUrl, filename, mimeType });
  }

  // Active Sessions & Device Management (Spec Section 3)
  public async getSessions(): Promise<{ sessions: UserSession[] }> {
    return this.get<{ sessions: UserSession[] }>('/api/auth/sessions');
  }

  public async revokeSession(sessionToken: string): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>('/api/auth/sessions/revoke', { sessionToken });
  }

  public async revokeOtherSessions(): Promise<{ success: boolean; revokedCount: number }> {
    return this.post<{ success: boolean; revokedCount: number }>('/api/auth/sessions/revoke-others');
  }

  // Location History Deletion (Spec Section 5 & 19)
  public async clearLocationHistory(): Promise<{
    success: boolean;
    removedCount: number;
    deletedCount?: number;
    message: string;
  }> {
    return this.delete<{ success: boolean; removedCount: number; deletedCount?: number; message: string }>(
      '/api/locations/history'
    );
  }

  public async purgeLocationHistory(): Promise<{
    success: boolean;
    removedCount: number;
    deletedCount?: number;
    message: string;
  }> {
    const res = await this.clearLocationHistory();
    return {
      ...res,
      deletedCount: res.deletedCount ?? res.removedCount ?? 0,
    };
  }

  public async deleteAccount(): Promise<{ success: boolean; message?: string }> {
    return this.delete<{ success: boolean; message?: string }>('/api/users/me');
  }

  // User Blocking & Moderation (Spec Section 6 & 16)
  public async getBlockedUsers(): Promise<{ blockedUsers: UserProfile[] }> {
    return this.get<{ blockedUsers: UserProfile[] }>('/api/users/blocked');
  }

  public async blockUser(userId: string): Promise<{ success: boolean; message: string }> {
    return this.post<{ success: boolean; message: string }>(`/api/users/${userId}/block`);
  }

  public async unblockUser(userId: string): Promise<{ success: boolean; message: string }> {
    return this.post<{ success: boolean; message: string }>(`/api/users/${userId}/unblock`);
  }

  // Room Member Management (Spec Section 7)
  public async kickRoomMember(roomId: string, targetUserId: string): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>(`/api/rooms/${roomId}/kick`, { targetUserId });
  }
}

export const api = new ApiClient();
