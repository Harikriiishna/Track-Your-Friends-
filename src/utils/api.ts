import type { UserProfile, UserSession } from '../types.ts';
import { localBackend } from './localBackend.ts';

/**
 * Beacon Centralized API Client
 */

class ApiClient {
  private token: string | null = null;
  private isNativeOrOfflineMode = false;

  constructor() {
    this.token = localStorage.getItem('beacon_token');
    if (typeof window !== 'undefined') {
      const cap = (window as any).Capacitor;
      if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
        this.isNativeOrOfflineMode = true;
      } else if (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:') {
        this.isNativeOrOfflineMode = true;
      }
    }
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
    return this.isNativeOrOfflineMode;
  }

  private syncResponseToLocal(data: any, token: string | null) {
    if (!data || typeof data !== 'object') return;
    if (data.user && data.user.id) {
      localBackend.syncUserSession(data.user, data.token || token);
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();

    // If running inside standalone native APK where local server is not present, route directly to localBackend
    if (this.isNativeOrOfflineMode) {
      const result = await localBackend.handleRequest<T>(endpoint, options, token);
      this.syncResponseToLocal(result, token);
      return result;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        ...options,
        headers,
        cache: 'no-store',
      });
    } catch {
      try {
        await new Promise((resolve) => setTimeout(resolve, 350));
        response = await fetch(endpoint, {
          ...options,
          headers,
          cache: 'no-store',
        });
      } catch {
        // Network unreachable or standalone environment: seamlessly use localBackend
        const fallbackRes = await localBackend.handleRequest<T>(endpoint, options, token);
        this.syncResponseToLocal(fallbackRes, token);
        return fallbackRes;
      }
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text();
    const trimmed = text.trim();

    // Detect if a static host, Capacitor WebViewLocalServer, or Service Worker returned HTML (e.g. index.html with HTTP 200)
    const isHtmlResponse =
      contentType.includes('text/html') ||
      trimmed.startsWith('<!doctype') ||
      trimmed.startsWith('<!DOCTYPE') ||
      trimmed.startsWith('<html');

    if (isHtmlResponse) {
      this.isNativeOrOfflineMode = true;
      const fallbackRes = await localBackend.handleRequest<T>(endpoint, options, token);
      this.syncResponseToLocal(fallbackRes, token);
      return fallbackRes;
    }

    let data: any = null;
    try {
      data = trimmed ? JSON.parse(trimmed) : {};
    } catch {
      // Non-JSON response received (e.g. proxy error or SPA fallback): route to localBackend instead of failing with "Server returned invalid response (200)"
      const fallbackRes = await localBackend.handleRequest<T>(endpoint, options, token);
      this.syncResponseToLocal(fallbackRes, token);
      return fallbackRes;
    }

    if (!response.ok) {
      // If server restarted and lost session token while client has cached user profile, fallback cleanly for data queries
      if (
        (response.status === 401 || response.status >= 500) &&
        !endpoint.startsWith('/api/auth/login') &&
        !endpoint.startsWith('/api/auth/register')
      ) {
        try {
          const fallbackRes = await localBackend.handleRequest<T>(endpoint, options, token);
          this.syncResponseToLocal(fallbackRes, token);
          return fallbackRes;
        } catch {
          // continue to standard error handling below if localBackend also rejects
        }
      }

      const errorMessage = data?.error || data?.message || `HTTP error ${response.status}: ${response.statusText}`;
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

    this.syncResponseToLocal(data, token);
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
  public async uploadFile(dataUrl: string, filename: string, mimeType?: string): Promise<{ url: string; name: string; size: number }> {
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
  public async clearLocationHistory(): Promise<{ success: boolean; removedCount: number; message: string }> {
    return this.delete<{ success: boolean; removedCount: number; message: string }>('/api/locations/history');
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
