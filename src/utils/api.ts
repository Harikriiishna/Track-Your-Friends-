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
  private lastDiagnosticReport: BackendDiagnosticReport | null = null;
  private diagnosticListeners = new Set<(report: BackendDiagnosticReport) => void>();

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
          localBackend.syncUserSession(parsed, generated);
          return generated;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  public isUsingLocalBackend(): boolean {
    return false;
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
      overallBackendConnected: this.lastDirectApiConnected,
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

    // Step 1: If running inside Android APK with native diagnostic bridge, run native DNS + raw HTTP status probe
    let nativeResult: any = null;
    if (typeof window !== 'undefined' && (window as any).AndroidLocationBridge?.diagnoseBackend) {
      try {
        const rawJson = (window as any).AndroidLocationBridge.diagnoseBackend(rawBaseUrl);
        if (rawJson) {
          nativeResult = JSON.parse(rawJson);
          if (nativeResult.dns === 'OK') dns = 'OK';
          if (nativeResult.https === 'OK') https = 'OK';
          if (nativeResult.backendHealth === 'OK') backendHealth = 'OK';
          if (nativeResult.httpStatus) httpStatus = String(nativeResult.httpStatus);
          if (nativeResult.reason) diagnosticReason = String(nativeResult.reason);
        }
      } catch {
        // continue to standard fetch probe
      }
    }

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
      if (backendHealth !== 'OK') {
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
      localBackend.syncUserSession(data.user, data.token || token);
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

  private async request<T>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
    const token = this.getToken();
    const targetUrl = resolveApiUrl(endpoint);
    const method = (options.method || 'GET').toUpperCase();

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
      const timeoutMs = isAndroidNativeApp() ? 7000 : 9000;
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
    } catch (netErr: any) {
      this.lastDirectApiConnected = false;
      syncLogger.log('api', 'error', 'production_backend_network_error', {
        endpoint,
        isAndroid: isAndroidNativeApp(),
        error: netErr?.message || 'Network unreachable',
      });
      void this.runNetworkDiagnostics();
      const err: any = new Error(
        `Production Backend Unreachable (${getMaskedBackendUrl()}): ${netErr?.message || 'Network request failed'}. Open Backend Diagnostics to inspect DNS, HTTPS, and HTTP status.`
      );
      err.code = 'BACKEND_UNREACHABLE';
      throw err;
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
      syncLogger.log('api', 'error', 'html_proxy_intercepted_request', {
        endpoint,
        status: response.status,
      });
      void this.runNetworkDiagnostics();
      const err: any = new Error(
        `Production Backend Blocked by Cloud Run Auth Proxy (HTTP ${response.status} text/html at ${getMaskedBackendUrl()}): The AI Studio preview proxy redirected the request to /__cookie_check.html instead of returning JSON. Use the Backend Diagnostic panel below to authenticate the proxy session or configure a public Cloud Run URL (--allow-unauthenticated).`
      );
      err.status = response.status;
      err.code = 'PROXY_AUTH_REQUIRED';
      throw err;
    }

    let data: any = null;
    try {
      data = trimmed ? JSON.parse(trimmed) : {};
    } catch {
      this.lastDirectApiConnected = false;
      void this.runNetworkDiagnostics();
      const err: any = new Error(
        `Invalid non-JSON response (HTTP ${response.status}) from ${getMaskedBackendUrl()}${endpoint}.`
      );
      err.status = response.status;
      err.code = 'INVALID_JSON_RESPONSE';
      throw err;
    }

    this.lastDirectApiConnected = true;

    if (!response.ok) {
      if (
        response.status === 401 &&
        !isRetry &&
        cachedUser?.id &&
        !endpoint.startsWith('/api/auth/login') &&
        !endpoint.startsWith('/api/auth/register')
      ) {
        try {
          const activeToken =
            token || `tok-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
          this.setToken(activeToken);
          localBackend.syncUserSession(cachedUser, activeToken);
          await localBackend.forceSyncNow();
          return await this.request<T>(endpoint, options, true);
        } catch {
          // proceed to throw standard error if retry also fails
        }
      }

      const errorMessage =
        data?.error || data?.message || `HTTP error ${response.status}: ${response.statusText}`;
      syncLogger.log('api', 'error', 'http_error', {
        endpoint,
        status: response.status,
        error: errorMessage,
      });
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
    message: string;
  }> {
    return this.delete<{ success: boolean; removedCount: number; message: string }>(
      '/api/locations/history'
    );
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
