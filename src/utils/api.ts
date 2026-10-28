import type { UserProfile, UserSession } from '../types.ts';
import { localBackend } from './localBackend.ts';
import { isAndroidNativeApp, resolveApiUrl, syncLogger } from '../config/env.ts';

/**
 * Beacon Centralized Production API Client
 * Connects both Web and Android APK to the same production backend and shared Cloud Firestore database.
 */

class ApiClient {
  private token: string | null = null;
  private remoteCooldownUntil = 0;

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
    return this.token || localStorage.getItem('beacon_token');
  }

  public isUsingLocalBackend(): boolean {
    return Date.now() < this.remoteCooldownUntil;
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

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const targetUrl = resolveApiUrl(endpoint);
    const method = (options.method || 'GET').toUpperCase();

    // If direct Cloud Run HTTP recently returned an HTML proxy page on Android, route directly via Cloud Firestore sync engine during cooldown
    if (Date.now() < this.remoteCooldownUntil) {
      const result = await localBackend.handleRequest<T>(endpoint, options, token);
      this.syncResponseToLocal(result, token, endpoint, method);
      return result;
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

    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutMs = isAndroidNativeApp() ? 4500 : 8000;
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      response = await fetch(targetUrl, {
        ...options,
        headers,
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (netErr: any) {
      syncLogger.log('api', 'warn', 'fetch_fallback_to_firestore_sync', {
        endpoint,
        isAndroid: isAndroidNativeApp(),
        error: netErr?.message || 'Network unreachable',
      });
      if (isAndroidNativeApp()) {
        this.remoteCooldownUntil = Date.now() + 20000;
      }
      const fallbackRes = await localBackend.handleRequest<T>(endpoint, options, token);
      this.syncResponseToLocal(fallbackRes, token, endpoint, method);
      return fallbackRes;
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text();
    const trimmed = text.trim();

    // Detect if a proxy, static host, or auth wall returned HTML instead of JSON API response
    const isHtmlResponse =
      contentType.includes('text/html') ||
      trimmed.startsWith('<!doctype') ||
      trimmed.startsWith('<!DOCTYPE') ||
      trimmed.startsWith('<html');

    if (isHtmlResponse) {
      syncLogger.log('api', 'info', 'html_proxy_detected_using_firestore_sync', {
        endpoint,
        status: response.status,
      });
      this.remoteCooldownUntil = Date.now() + 30000;
      const fallbackRes = await localBackend.handleRequest<T>(endpoint, options, token);
      this.syncResponseToLocal(fallbackRes, token, endpoint, method);
      return fallbackRes;
    }

    let data: any = null;
    try {
      data = trimmed ? JSON.parse(trimmed) : {};
    } catch {
      const fallbackRes = await localBackend.handleRequest<T>(endpoint, options, token);
      this.syncResponseToLocal(fallbackRes, token, endpoint, method);
      return fallbackRes;
    }

    if (!response.ok) {
      // If server restarted or token was created on Android/Firestore and not yet pulled by server, check shared Firestore state
      if (
        response.status === 401 ||
        response.status === 404 ||
        response.status >= 500
      ) {
        try {
          const fallbackRes = await localBackend.handleRequest<T>(endpoint, options, token);
          this.syncResponseToLocal(fallbackRes, token, endpoint, method);
          return fallbackRes;
        } catch {
          // continue to standard error handling below if shared Firestore backend also rejects
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
