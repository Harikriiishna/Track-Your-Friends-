import {
  getMaskedBackendUrl,
  getProductionApiBaseUrl,
  isInvalidOrLocalEndpoint,
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
 * Resolves the target base URL from `VITE_API_BASE_URL` (or falls back to the
 * centralized production API base URL if `VITE_API_BASE_URL` is unset or a placeholder)
 * and returns a sanitized health endpoint URL alongside a safe display URL.
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

  const baseUrl =
    rawEnvBaseUrl && !isInvalidOrLocalEndpoint(rawEnvBaseUrl)
      ? rawEnvBaseUrl.replace(/\/+$/, '')
      : getProductionApiBaseUrl();

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
 * Performs a health check against the `VITE_API_BASE_URL` health endpoint (`/api/health`)
 * using `fetch` with a strict 5-second (`5000ms`) timeout.
 * Explicitly logs connectivity status to the console without revealing secrets.
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
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startTime;
    const timestamp = new Date().toISOString();

    if (response.ok) {
      console.info(
        `[Connectivity] Backend health check OK (${response.status}) at ${safeDisplayUrl} in ${latencyMs}ms`
      );
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

    console.warn(
      `[Connectivity] Backend health check FAILED (${response.status}) at ${safeDisplayUrl} in ${latencyMs}ms: ${errorMessage}`
    );
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

    console.error(`[Connectivity] Backend UNREACHABLE at ${safeDisplayUrl} after ${latencyMs}ms: ${errorMessage}`);
    syncLogger.log('api', 'error', 'HEALTH_CHECK_UNREACHABLE', {
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
