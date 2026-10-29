import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Server,
  Settings2,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { api, type BackendDiagnosticReport } from '../../utils/api.ts';
import {
  DEFAULT_PRODUCTION_BACKEND_ORIGIN,
  getMaskedBackendUrl,
  getProductionApiBaseUrl,
  getProductionApiBaseUrlOverride,
  setProductionApiBaseUrlOverride,
} from '../../config/env.ts';

interface BackendDiagnosticPanelProps {
  compactByDefault?: boolean;
}

export const BackendDiagnosticPanel: React.FC<BackendDiagnosticPanelProps> = ({
  compactByDefault = false,
}) => {
  const [report, setReport] = useState<BackendDiagnosticReport | null>(() =>
    api.getLastDiagnosticReport()
  );
  const [isTesting, setIsTesting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!compactByDefault);
  const [showUrlConfig, setShowUrlConfig] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(() =>
    getProductionApiBaseUrlOverride() || getProductionApiBaseUrl()
  );
  const [configError, setConfigError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setIsTesting(true);
    try {
      const res = await api.runNetworkDiagnostics();
      setReport(res);
      if (res.backendHealth === 'FAILED' || res.database === 'FAILED') {
        setIsExpanded(true);
      }
    } finally {
      setIsTesting(false);
    }
  }, []);

  useEffect(() => {
    const unsub = api.onDiagnosticsUpdated((nextReport) => {
      setReport(nextReport);
      if (nextReport.backendHealth === 'FAILED') {
        setIsExpanded(true);
      }
    });
    void runCheck();
    return unsub;
  }, [runCheck]);

  const handleSaveBackendUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigError(null);
    try {
      setProductionApiBaseUrlOverride(customUrlInput.trim());
      setShowUrlConfig(false);
      await runCheck();
    } catch (err: any) {
      setConfigError(err?.message || 'Invalid HTTPS URL');
    }
  };

  const handleResetBackendUrl = async () => {
    setConfigError(null);
    setProductionApiBaseUrlOverride(null);
    setCustomUrlInput(DEFAULT_PRODUCTION_BACKEND_ORIGIN);
    setShowUrlConfig(false);
    await runCheck();
  };

  const effectiveUrl = report?.backendUrl || getMaskedBackendUrl(getProductionApiBaseUrl());
  const isHealthy = report?.backendHealth === 'OK';

  return (
    <div className="w-full rounded-2xl bg-slate-950/95 border border-slate-800 p-3.5 text-xs text-slate-200 shadow-xl space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center gap-2 text-left cursor-pointer"
        >
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              !report || isTesting
                ? 'bg-sky-400 animate-pulse'
                : isHealthy
                  ? 'bg-emerald-400'
                  : 'bg-rose-500 animate-pulse'
            }`}
          />
          <span className="font-bold text-white flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            Production Backend Diagnostics
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowUrlConfig((prev) => !prev)}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
            title="Configure Production Backend URL"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={isTesting}
            onClick={runCheck}
            className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'Testing...' : 'Test Health'}</span>
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Exact 7-line Diagnostic Block required by specification (no secrets/tokens exposed) */}
          <div className="font-mono text-[11px] bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1 select-all overflow-x-auto">
            <div className="flex items-start justify-between gap-2">
              <span className="text-slate-400 shrink-0">Backend URL:</span>
              <span className="text-sky-300 font-semibold break-all text-right">
                {effectiveUrl}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">DNS:</span>
              <span
                className={`font-bold ${
                  report?.dns === 'OK' ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {report ? report.dns : 'TESTING...'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">HTTPS:</span>
              <span
                className={`font-bold ${
                  report?.https === 'OK' ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {report ? report.https : 'TESTING...'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Backend Health:</span>
              <span
                className={`font-bold inline-flex items-center gap-1 ${
                  report?.backendHealth === 'OK' ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {report?.backendHealth === 'OK' ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                {report ? report.backendHealth : 'TESTING...'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">HTTP status:</span>
              <span className="text-amber-300 font-bold text-right">
                {report ? report.httpStatus : 'TESTING...'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Authentication:</span>
              <span
                className={`font-bold ${
                  report?.authentication === 'OK' ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {report ? report.authentication : 'TESTING...'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Database:</span>
              <span
                className={`font-bold ${
                  report?.database === 'OK' ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {report ? report.database : 'TESTING...'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">WebSocket:</span>
              <span
                className={`font-bold ${
                  report?.websocket === 'OK' ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {report ? report.websocket : 'TESTING...'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Realtime:</span>
              <span
                className={`font-bold ${
                  report?.realtime === 'OK' ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {report ? report.realtime : 'TESTING...'}
              </span>
            </div>
          </div>

          {report?.diagnosticReason && (
            <div
              className={`p-2.5 rounded-xl border text-[11px] leading-relaxed ${
                isHealthy
                  ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-200'
                  : 'bg-amber-950/60 border-amber-800/70 text-amber-200'
              }`}
            >
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{report.diagnosticReason}</span>
              </div>
            </div>
          )}

          {report?.isHtmlProxyIntercepted && (
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-[11px] text-slate-300 space-y-2">
              <p className="font-semibold text-white">
                Why Android APK received HTML instead of JSON:
              </p>
              <p>
                The AI Studio preview URL is fronted by Google AI Studio&apos;s{' '}
                <code className="text-amber-300">applet-auth-bridge</code> reverse proxy, which
                redirects unauthenticated cross-origin APK requests (HTTP 302) to{' '}
                <code className="text-amber-300">/__cookie_check.html</code>. Deploy the backend to
                a public Cloud Run service (<code className="text-sky-300">--allow-unauthenticated</code>)
                and set its HTTPS URL via the gear icon above, or authenticate the proxy below.
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`${getProductionApiBaseUrl()}/api/health`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open /api/health in Browser</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowUrlConfig(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sky-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Server className="w-3 h-3" />
                  <span>Set Public Cloud Run URL</span>
                </button>
              </div>
            </div>
          )}

          {report?.firestoreQuotaExceeded && (
            <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/70 text-[11px] text-rose-200 space-y-1.5">
              <p className="font-bold text-rose-300">
                Firestore Database Quota Exceeded (HTTP 429)
              </p>
              <p>
                Free daily read/write units on the Spark free-tier database have been exhausted and
                will reset the next day.
              </p>
              <a
                href={report.firestoreUpgradeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sky-300 hover:underline font-semibold"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open Firestore Database in Firebase Console</span>
              </a>
            </div>
          )}

          {showUrlConfig && (
            <form
              onSubmit={handleSaveBackendUrl}
              className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-2"
            >
              <label className="block text-[11px] font-bold text-slate-200">
                Production Backend HTTPS URL (Cloud Run)
              </label>
              <input
                type="url"
                required
                placeholder="https://beacon-backend-xxxx.asia-northeast1.run.app"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              {configError && <p className="text-[11px] text-rose-400">{configError}</p>}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleResetBackendUrl}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                >
                  Reset Default
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold cursor-pointer"
                >
                  Save &amp; Test Connection
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
};
