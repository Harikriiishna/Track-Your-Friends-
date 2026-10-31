/**
 * Centralized Production & Runtime Configuration (Web + Android APK)
 * Ensures Web and Android APK builds communicate with the exact same production backend,
 * production WebSocket endpoint, and production Cloud Firestore database.
 */

export const DEFAULT_PRODUCTION_BACKEND_ORIGIN =
  'https://ais-pre-dkfhfrzboel3a3xnlpek5a-752786783113.asia-northeast1.run.app';

export const DEV_PREVIEW_BACKEND_ORIGIN =
  'https://ais-dev-dkfhfrzboel3a3xnlpek5a-752786783113.asia-northeast1.run.app';

const RUNTIME_API_OVERRIDE_KEY = 'beacon_production_api_url_override';

function getEnvVar(name: string): string {
  try {
    const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
    if (metaEnv && typeof metaEnv[name] === 'string' && metaEnv[name].trim().length > 0) {
      return metaEnv[name].trim();
    }
  } catch {
    // ignore in Node / non-Vite context
  }
  try {
    if (typeof process !== 'undefined' && process.env && typeof process.env[name] === 'string') {
      const val = process.env[name]!.trim();
      if (val.length > 0) return val;
    }
  } catch {
    // ignore in browser context
  }
  return '';
}

export const FIREBASE_PRODUCTION_CONFIG = {
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID') || 'gen-lang-client-0914373991',
  appId: getEnvVar('VITE_FIREBASE_APP_ID') || '1:352216424599:web:d41a23195b40cdc78149d2',
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || 'AIzaSyDytVqEQzabXfZPoBRd35E9VNdXOq3KZLo',
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') || 'gen-lang-client-0914373991.firebaseapp.com',
  firestoreDatabaseId:
    getEnvVar('VITE_FIREBASE_DATABASE_ID') ||
    'ai-studio-nexuspoint-bb482c10-9426-424c-8259-807bce4cb7da',
  storageBucket:
    getEnvVar('VITE_FIREBASE_STORAGE_BUCKET') || 'gen-lang-client-0914373991.firebasestorage.app',
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID') || '352216424599',
  vapidKey: getEnvVar('VITE_FIREBASE_VAPID_KEY') || '',
};

export const GOOGLE_MAPS_CONFIG = {
  apiKey: getEnvVar('VITE_GOOGLE_MAPS_API_KEY') || '',
};

export const FIRESTORE_BASE_DOCS_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PRODUCTION_CONFIG.projectId}/databases/${FIREBASE_PRODUCTION_CONFIG.firestoreDatabaseId}/documents`;

export const FIRESTORE_SYNC_DOC_URL = `${FIRESTORE_BASE_DOCS_URL}/beacon_sync/global_state?key=${FIREBASE_PRODUCTION_CONFIG.apiKey}`;

export const FIRESTORE_TEST_DOC_URL = `${FIRESTORE_BASE_DOCS_URL}/test/connection?key=${FIREBASE_PRODUCTION_CONFIG.apiKey}`;

export function getFirestoreEntityDocUrl(collectionKey: string): string {
  return `${FIRESTORE_BASE_DOCS_URL}/beacon_sync/${encodeURIComponent(collectionKey)}?key=${FIREBASE_PRODUCTION_CONFIG.apiKey}`;
}

/**
 * Detects whether the app is currently running inside the packaged Android APK / Capacitor WebView.
 */
export function isAndroidNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  if (w.AndroidLocationBridge) return true;
  const cap = w.Capacitor;
  if (cap && ((typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) || cap.isNative)) {
    return true;
  }
  const proto = window.location.protocol;
  const host = window.location.hostname;
  if (proto === 'capacitor:' || proto === 'file:') return true;
  // Capacitor Android WebView serves assets from https://localhost (with no port)
  if (host === 'localhost' && !window.location.port) return true;
  return false;
}

export function isInvalidOrLocalEndpoint(url: string): boolean {
  const lower = url.trim().toLowerCase();
  if (!lower.startsWith('https://') && !lower.startsWith('http://')) return true;
  return (
    lower.includes('your_production') ||
    lower.includes('myapp-backend.onrender.com') ||
    lower.includes('example.com') ||
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('0.0.0.0') ||
    lower.includes('10.0.2.2')
  );
}

/**
 * Allows setting or clearing a runtime HTTPS production backend URL from the Diagnostic Panel
 * (e.g., when switching to a public `--allow-unauthenticated` Cloud Run service URL).
 */
export function setProductionApiBaseUrlOverride(url: string | null): void {
  if (typeof localStorage === 'undefined') return;
  if (!url || !url.trim()) {
    localStorage.removeItem(RUNTIME_API_OVERRIDE_KEY);
    return;
  }
  const cleaned = url.trim().replace(/\/+$/, '');
  if (!cleaned.startsWith('https://') || isInvalidOrLocalEndpoint(cleaned)) {
    throw new Error(
      'Production Backend URL must start with https:// and cannot be localhost, 127.0.0.1, or 0.0.0.0.'
    );
  }
  localStorage.setItem(RUNTIME_API_OVERRIDE_KEY, cleaned);
}

export function getProductionApiBaseUrlOverride(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    const val = localStorage.getItem(RUNTIME_API_OVERRIDE_KEY) || '';
    if (val && val.startsWith('https://') && !isInvalidOrLocalEndpoint(val)) {
      return val.replace(/\/+$/, '');
    }
  } catch {
    // ignore storage read error
  }
  return '';
}

/**
 * Resolves the centralized production API base URL (`PRODUCTION_API_URL`).
 * Guarantees Android APK never calls localhost, 127.0.0.1, 0.0.0.0, or placeholder URLs.
 */
export function getProductionApiBaseUrl(): string {
  const runtimeOverride = getProductionApiBaseUrlOverride();
  if (runtimeOverride) {
    return runtimeOverride;
  }

  const configuredUrl = getEnvVar('VITE_API_BASE_URL') || getEnvVar('VITE_API_URL');
  if (configuredUrl && !isInvalidOrLocalEndpoint(configuredUrl)) {
    return configuredUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    if (isAndroidNativeApp()) {
      return DEFAULT_PRODUCTION_BACKEND_ORIGIN;
    }
    const { protocol, hostname, port, origin } = window.location;
    if (
      (protocol === 'https:' || protocol === 'http:') &&
      hostname !== 'localhost' &&
      hostname !== '127.0.0.1' &&
      hostname !== '0.0.0.0'
    ) {
      return origin.replace(/\/+$/, '');
    }
    // Local dev server on port 3000 in desktop browser only
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && port === '3000') {
      return origin.replace(/\/+$/, '');
    }
  }

  return DEFAULT_PRODUCTION_BACKEND_ORIGIN;
}

export const PRODUCTION_API_URL = getProductionApiBaseUrl();
export const PRODUCTION_BACKEND_ORIGIN = DEFAULT_PRODUCTION_BACKEND_ORIGIN;

/**
 * Returns a visible, sanitized representation of a backend URL without exposing any secrets, tokens, or API keys.
 */
export function getMaskedBackendUrl(rawUrl?: string): string {
  const target = rawUrl || getProductionApiBaseUrl();
  try {
    const parsed = new URL(target);
    parsed.username = '';
    parsed.password = '';
    for (const key of Array.from(parsed.searchParams.keys())) {
      const lower = key.toLowerCase();
      if (
        lower.includes('key') ||
        lower.includes('token') ||
        lower.includes('secret') ||
        lower.includes('auth') ||
        lower.includes('pass')
      ) {
        parsed.searchParams.set(key, '[MASKED]');
      }
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return target.replace(/([?&](?:key|token|secret|password)=)[^&]+/gi, '$1[MASKED]');
  }
}

/**
 * Resolves a relative API endpoint (e.g. `/api/rooms`) to a full production URL.
 */
export function resolveApiUrl(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const override = getProductionApiBaseUrlOverride();
  if (override) {
    return `${override}${path}`;
  }
  if (typeof window !== 'undefined' && !isAndroidNativeApp()) {
    return path;
  }
  return `${getProductionApiBaseUrl()}${path}`;
}

/**
 * Resolves the centralized production WebSocket (`wss://`) URL (`PRODUCTION_WSS_URL`).
 */
export function getProductionWsUrl(): string {
  const configuredWs = getEnvVar('VITE_WS_URL');
  if (configuredWs && !isInvalidOrLocalEndpoint(configuredWs)) {
    return configuredWs.endsWith('/ws') ? configuredWs : `${configuredWs.replace(/\/+$/, '')}/ws`;
  }

  const baseHttp = getProductionApiBaseUrl();
  const wsBase = baseHttp.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
  return `${wsBase}/ws`;
}

export const PRODUCTION_WSS_URL = getProductionWsUrl();

export type RealtimeDiagnosticState =
  | 'REALTIME_CONNECTING'
  | 'REALTIME_CONNECTED'
  | 'REALTIME_DISCONNECTED'
  | 'REALTIME_ERROR'
  | 'REALTIME_RECONNECTING';

export interface SyncDiagnosticEntry {
  timestamp: string;
  category: 'api' | 'ws' | 'firestore' | 'auth' | 'location' | 'lifecycle';
  level: 'info' | 'warn' | 'error';
  event: string;
  details?: Record<string, any>;
}

const MAX_DIAGNOSTIC_LOGS = 100;
const diagnosticLogs: SyncDiagnosticEntry[] = [];

function sanitizeDetails(details?: Record<string, any>): Record<string, any> | undefined {
  if (!details || typeof details !== 'object') return undefined;
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(details)) {
    const lower = k.toLowerCase();
    if (
      lower.includes('password') ||
      lower.includes('token') ||
      lower.includes('secret') ||
      lower.includes('authorization') ||
      lower.includes('salt') ||
      lower.includes('hash') ||
      lower.includes('apikey') ||
      lower.includes('key')
    ) {
      clean[k] = '[REDACTED]';
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

/**
 * Production-safe diagnostic logger (never logs passwords, tokens, API keys, or secrets).
 */
export const syncLogger = {
  log(
    category: SyncDiagnosticEntry['category'],
    level: SyncDiagnosticEntry['level'],
    event: string,
    details?: Record<string, any>
  ) {
    const entry: SyncDiagnosticEntry = {
      timestamp: new Date().toISOString(),
      category,
      level,
      event,
      details: sanitizeDetails(details),
    };
    diagnosticLogs.push(entry);
    if (diagnosticLogs.length > MAX_DIAGNOSTIC_LOGS) {
      diagnosticLogs.shift();
    }
    if (typeof window !== 'undefined') {
      (window as any).__beaconSyncDiagnostics = diagnosticLogs;
    }
  },
  getLogs(): SyncDiagnosticEntry[] {
    return [...diagnosticLogs];
  },
};

/**
 * Executes an HTTP/HTTPS request asynchronously without blocking the main UI thread.
 * Avoids calling synchronous @JavascriptInterface network methods on the UI thread,
 * which freeze Android WebView rendering and touch input.
 */
export async function nativeAwareFetch(
  inputUrl: string,
  options: RequestInit = {},
  timeoutMs = 3200
): Promise<Response> {
  const fullUrl = /^https?:\/\//i.test(inputUrl) ? inputUrl : resolveApiUrl(inputUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(fullUrl, {
      ...options,
      signal: options.signal || controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}


