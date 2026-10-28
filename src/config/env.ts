/**
 * Centralized Production & Runtime Configuration (Web + Android APK)
 * Ensures Web and Android APK builds communicate with the exact same production backend,
 * production WebSocket endpoint, and production Cloud Firestore database.
 */

export const PRODUCTION_BACKEND_ORIGIN =
  'https://ais-pre-dkfhfrzboel3a3xnlpek5a-752786783113.asia-northeast1.run.app';

export const DEV_PREVIEW_BACKEND_ORIGIN =
  'https://ais-dev-dkfhfrzboel3a3xnlpek5a-752786783113.asia-northeast1.run.app';

export const FIREBASE_PRODUCTION_CONFIG = {
  projectId: 'gen-lang-client-0914373991',
  firestoreDatabaseId: 'ai-studio-nexuspoint-bb482c10-9426-424c-8259-807bce4cb7da',
  apiKey: 'AIzaSyDytVqEQzabXfZPoBRd35E9VNdXOq3KZLo',
};

export const FIRESTORE_SYNC_DOC_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PRODUCTION_CONFIG.projectId}/databases/${FIREBASE_PRODUCTION_CONFIG.firestoreDatabaseId}/documents/beacon_sync/global_state?key=${FIREBASE_PRODUCTION_CONFIG.apiKey}`;

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

/**
 * Resolves the centralized production API base URL so Android never calls localhost.
 * - On Web (`*.run.app` or local dev with port 3000): uses current window.location.origin
 * - On Android APK (`https://localhost`): uses PRODUCTION_BACKEND_ORIGIN
 */
export function getProductionApiBaseUrl(): string {
  try {
    const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
    if (metaEnv?.VITE_API_URL && typeof metaEnv.VITE_API_URL === 'string') {
      return metaEnv.VITE_API_URL.replace(/\/+$/, '');
    }
  } catch {
    // ignore in non-Vite context
  }

  if (typeof window !== 'undefined') {
    if (isAndroidNativeApp()) {
      return PRODUCTION_BACKEND_ORIGIN;
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
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && port === '3000') {
      return origin.replace(/\/+$/, '');
    }
  }

  return PRODUCTION_BACKEND_ORIGIN;
}

/**
 * Resolves a relative API endpoint (e.g. `/api/rooms`) to a full production URL when on Android.
 */
export function resolveApiUrl(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (typeof window !== 'undefined' && !isAndroidNativeApp()) {
    // Same-origin relative path in web browser
    return path;
  }
  return `${getProductionApiBaseUrl()}${path}`;
}

/**
 * Resolves the production WebSocket (`wss://`) URL for both Web and Android APK.
 */
export function getProductionWsUrl(): string {
  try {
    const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
    if (metaEnv?.VITE_WS_URL && typeof metaEnv.VITE_WS_URL === 'string') {
      return metaEnv.VITE_WS_URL;
    }
  } catch {
    // ignore
  }

  const baseHttp = getProductionApiBaseUrl();
  const wsBase = baseHttp.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
  return `${wsBase}/ws`;
}

export interface SyncDiagnosticEntry {
  timestamp: string;
  category: 'api' | 'ws' | 'firestore' | 'auth' | 'location' | 'lifecycle';
  level: 'info' | 'warn' | 'error';
  event: string;
  details?: Record<string, any>;
}

const MAX_DIAGNOSTIC_LOGS = 80;
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
      lower.includes('hash')
    ) {
      clean[k] = '[REDACTED]';
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

/**
 * Production-safe diagnostic logger (never logs passwords, tokens, or secrets).
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
