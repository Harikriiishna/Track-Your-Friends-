/**
 * AppErrorsTracking Engine for Beacon Network (inspired by KitsunePie/AppErrorsTracking)
 *
 * Captures uncaught runtime exceptions, unhandled Promise rejections, React render crashes,
 * and native WebView errors directly on the device (even when ADB / DevTools is not connected).
 *
 * Features:
 * - Captures full stack traces, source file/line/column, platform, and timestamp
 * - Persists error history in localStorage across reloads
 * - Provides error statistics by category & module
 * - Supports 1-tap Copy, Share (Web Share API), and Export (.log / .json) of stack traces
 */

import { isAndroidNativeApp } from '../config/env.ts';

export type TrackedErrorCategory =
  | 'Uncaught Exception'
  | 'Unhandled Rejection'
  | 'React Render Crash'
  | 'Network / API Exception';

export interface TrackedAppErrorRecord {
  id: string;
  category: TrackedErrorCategory;
  name: string;
  message: string;
  stack: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  processName: string;
  platform: 'Android APK (Capacitor)' | 'Web Browser';
  userAgent: string;
  url: string;
  timestamp: string;
  occurrences: number;
}

export interface AppErrorsStatistics {
  totalExceptions: number;
  uniqueExceptions: number;
  byCategory: Record<TrackedErrorCategory, number>;
  lastExceptionAt: string | null;
}

const STORAGE_KEY = 'beacon_app_errors_tracking_v1';
const MAX_STORED_ERRORS = 80;
const APP_ERRORS_UPDATED_EVENT = 'beacon:app-errors-tracking-updated';

let trackerInstalled = false;

export function loadTrackedAppErrors(): TrackedAppErrorRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTrackedAppErrors(records: TrackedAppErrorRecord[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_STORED_ERRORS)));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(APP_ERRORS_UPDATED_EVENT));
    }
  } catch {
    // ignore storage quota errors
  }
}

export function recordTrackedAppError(input: {
  category: TrackedErrorCategory;
  name?: string;
  message: string;
  stack?: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  processName?: string;
}): TrackedAppErrorRecord {
  const existing = loadTrackedAppErrors();
  const cleanMsg = String(input.message || 'Unknown Application Error').trim();
  const cleanName = String(input.name || 'Error').trim();
  const cleanStack = String(input.stack || `${cleanName}: ${cleanMsg}`).trim();
  const nowIso = new Date().toISOString();

  // Deduplicate identical consecutive error messages by incrementing occurrences
  const duplicateIdx = existing.findIndex(
    (e) => e.category === input.category && e.message === cleanMsg && e.name === cleanName
  );

  if (duplicateIdx >= 0) {
    const updated: TrackedAppErrorRecord = {
      ...existing[duplicateIdx],
      stack: cleanStack || existing[duplicateIdx].stack,
      timestamp: nowIso,
      occurrences: (existing[duplicateIdx].occurrences || 1) + 1,
    };
    const next = [updated, ...existing.filter((_, i) => i !== duplicateIdx)];
    saveTrackedAppErrors(next);
    return updated;
  }

  const record: TrackedAppErrorRecord = {
    id: `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    category: input.category,
    name: cleanName,
    message: cleanMsg,
    stack: cleanStack,
    sourceFile: input.sourceFile,
    lineNumber: input.lineNumber,
    columnNumber: input.columnNumber,
    processName: input.processName || 'com.beacon.mesh:main',
    platform: isAndroidNativeApp() ? 'Android APK (Capacitor)' : 'Web Browser',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    url: typeof window !== 'undefined' ? window.location.href : '',
    timestamp: nowIso,
    occurrences: 1,
  };

  saveTrackedAppErrors([record, ...existing]);
  return record;
}

export function clearTrackedAppErrors(): void {
  saveTrackedAppErrors([]);
}

export function deleteTrackedAppError(id: string): void {
  const existing = loadTrackedAppErrors();
  saveTrackedAppErrors(existing.filter((e) => e.id !== id));
}

export function getAppErrorsStatistics(records = loadTrackedAppErrors()): AppErrorsStatistics {
  const byCategory: Record<TrackedErrorCategory, number> = {
    'Uncaught Exception': 0,
    'Unhandled Rejection': 0,
    'React Render Crash': 0,
    'Network / API Exception': 0,
  };

  let totalExceptions = 0;
  for (const rec of records) {
    const count = rec.occurrences || 1;
    totalExceptions += count;
    byCategory[rec.category] = (byCategory[rec.category] || 0) + count;
  }

  return {
    totalExceptions,
    uniqueExceptions: records.length,
    byCategory,
    lastExceptionAt: records[0]?.timestamp || null,
  };
}

export function formatErrorStackTraceReport(rec: TrackedAppErrorRecord): string {
  return [
    '============================================================',
    'BEACON NETWORK — APP ERRORS TRACKING REPORT',
    '============================================================',
    `Error ID     : ${rec.id}`,
    `Process      : ${rec.processName}`,
    `Category     : ${rec.category}`,
    `Exception    : ${rec.name}: ${rec.message}`,
    `Occurrences  : ${rec.occurrences}`,
    `Timestamp    : ${rec.timestamp}`,
    `Platform     : ${rec.platform}`,
    `URL          : ${rec.url}`,
    rec.sourceFile
      ? `Source       : ${rec.sourceFile}:${rec.lineNumber ?? 0}:${rec.columnNumber ?? 0}`
      : null,
    '------------------------------------------------------------',
    'STACK TRACE:',
    rec.stack,
    '============================================================',
  ]
    .filter(Boolean)
    .join('\n');
}

export function onTrackedAppErrorsUpdated(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(APP_ERRORS_UPDATED_EVENT, listener);
  return () => {
    window.removeEventListener(APP_ERRORS_UPDATED_EVENT, listener);
  };
}

/**
 * Installs global window.onerror and unhandledrejection listeners so on-device crashes
 * and exceptions are automatically captured and persisted (even without ADB).
 */
export function installAppErrorsTracking(): void {
  if (typeof window === 'undefined' || trackerInstalled) return;
  trackerInstalled = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    // Ignore benign ResizeObserver loop warnings
    const msg = String(event.message || '');
    if (msg.includes('ResizeObserver loop')) return;

    recordTrackedAppError({
      category: 'Uncaught Exception',
      name: event.error?.name || 'RuntimeError',
      message: msg || 'Uncaught window error',
      stack: event.error?.stack || `${msg}\n    at ${event.filename || 'unknown'}:${event.lineno || 0}:${event.colno || 0}`,
      sourceFile: event.filename,
      lineNumber: event.lineno,
      columnNumber: event.colno,
      processName: 'com.beacon.mesh:ui',
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
        ? reason
        : JSON.stringify(reason || 'Unhandled Promise Rejection');

    // Ignore aborted fetch signals during rapid tab/tile switching
    if (message.includes('AbortError') || message.includes('The user aborted a request')) {
      return;
    }

    recordTrackedAppError({
      category: 'Unhandled Rejection',
      name: reason?.name || 'UnhandledPromiseRejection',
      message,
      stack: reason?.stack || `UnhandledPromiseRejection: ${message}`,
      processName: 'com.beacon.mesh:async',
    });
  });
}
