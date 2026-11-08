import {
  getMaskedBackendUrl,
  getProductionApiBaseUrl,
  isAndroidNativeApp,
  isInvalidOrLocalEndpoint,
  nativeAwareFetch,
  resolveApiUrl,
  syncLogger,
} from '../config/env.ts';

export const HEALTH_CHECK_TIMEOUT_MS = 5000;

export interface ConnectivityHealthResult {
  ok: boolean;
  reachable: boolean;
  status: number | null;
  latencyMs: number;
  endpoint: string;
  error: string | null;
  timestamp: string;
}

/**
 * Resolves the target health endpoint URL using `resolveApiUrl('/api/health')`
 * (relative `/api/health` on Web to preserve same-origin session cookies, or
 * the production base URL on native Android APK) alongside a safe display URL.
 */
export function resolveHealthCheckEndpoint(): { requestUrl: string; safeDisplayUrl: string } {
  let rawEnvBaseUrl = '';
  try {
    const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
    if (metaEnv && typeof metaEnv.VITE_API_BASE_URL === 'string') {
      rawEnvBaseUrl = metaEnv.VITE_API_BASE_URL.trim();
    }
  } catch {
    // ignore in non-Vite environments
  }

  if (rawEnvBaseUrl && !isInvalidOrLocalEndpoint(rawEnvBaseUrl)) {
    const baseUrl = rawEnvBaseUrl.replace(/\/+$/, '');
    return {
      requestUrl: `${baseUrl}/api/health`,
      safeDisplayUrl: `${getMaskedBackendUrl(baseUrl)}/api/health`,
    };
  }

  if (typeof window !== 'undefined' && !isAndroidNativeApp()) {
    const origin = window.location.origin;
    return {
      requestUrl: resolveApiUrl('/api/health'),
      safeDisplayUrl: `${getMaskedBackendUrl(origin)}/api/health`,
    };
  }

  const baseUrl = getProductionApiBaseUrl();
  const requestUrl = `${baseUrl}/api/health`;
  const safeDisplayUrl = `${getMaskedBackendUrl(baseUrl)}/api/health`;

  return { requestUrl, safeDisplayUrl };
}

/**
 * Sanitizes error messages so no tokens, keys, passwords, or sensitive query parameters
 * are ever written to the console or exposed in UI error state.
 */
function sanitizeErrorMessage(rawMessage: string): string {
  if (!rawMessage) return 'Unknown connectivity error';
  return rawMessage
    .replace(/([?&](?:key|token|secret|password|auth|apikey)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]');
}

/**
 * Performs a health check against the `/api/health` endpoint
 * using `fetch` with a strict 5-second (`5000ms`) timeout.
 * Logs connectivity status without revealing secrets or triggering fatal console error overlays.
 */
export async function checkBackendConnectivity(
  timeoutMs: number = HEALTH_CHECK_TIMEOUT_MS
): Promise<ConnectivityHealthResult> {
  const { requestUrl, safeDisplayUrl } = resolveHealthCheckEndpoint();
  const controller = new AbortController();
  const effectiveTimeoutMs =
    typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : HEALTH_CHECK_TIMEOUT_MS;

  const startTime = Date.now();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, effectiveTimeoutMs);

  try {
    const response = await nativeAwareFetch(
      requestUrl,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      },
      effectiveTimeoutMs
    );

    const latencyMs = Date.now() - startTime;
    const timestamp = new Date().toISOString();

    if (response.ok) {
      syncLogger.log('api', 'info', 'HEALTH_CHECK_OK', {
        endpoint: safeDisplayUrl,
        status: response.status,
        latencyMs,
      });

      return {
        ok: true,
        reachable: true,
        status: response.status,
        latencyMs,
        endpoint: safeDisplayUrl,
        error: null,
        timestamp,
      };
    }

    const errorMessage =
      response.status === 401 || response.status === 403
        ? `Backend health endpoint rejected request with HTTP ${response.status}`
        : `Backend health endpoint returned HTTP ${response.status}`;

    syncLogger.log('api', 'warn', 'HEALTH_CHECK_FAILED', {
      endpoint: safeDisplayUrl,
      status: response.status,
      latencyMs,
      error: errorMessage,
    });

    return {
      ok: false,
      reachable: true,
      status: response.status,
      latencyMs,
      endpoint: safeDisplayUrl,
      error: errorMessage,
      timestamp,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const timestamp = new Date().toISOString();
    const isAbort =
      err?.name === 'AbortError' ||
      String(err?.message || '')
        .toLowerCase()
        .includes('abort');

    const errorMessage = isAbort
      ? `Backend health check timed out after ${effectiveTimeoutMs}ms (${safeDisplayUrl})`
      : `Unable to reach backend health endpoint (${safeDisplayUrl}): ${sanitizeErrorMessage(
          err?.message || 'Network request failed'
        )}`;

    syncLogger.log('api', 'warn', 'HEALTH_CHECK_UNREACHABLE', {
      endpoint: safeDisplayUrl,
      latencyMs,
      timedOut: isAbort,
      error: errorMessage,
    });

    return {
      ok: false,
      reachable: false,
      status: null,
      latencyMs,
      endpoint: safeDisplayUrl,
      error: errorMessage,
      timestamp,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export const checkBackendHealth = checkBackendConnectivity;
