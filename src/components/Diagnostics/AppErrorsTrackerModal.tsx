import React, { useState, useEffect } from 'react';
import {
  Bug,
  Copy,
  Share2,
  Download,
  Trash2,
  Check,
  RefreshCw,
  AlertTriangle,
  Terminal,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  loadTrackedAppErrors,
  clearTrackedAppErrors,
  deleteTrackedAppError,
  getAppErrorsStatistics,
  formatErrorStackTraceReport,
  onTrackedAppErrorsUpdated,
  recordTrackedAppError,
  type TrackedAppErrorRecord,
} from '../../utils/appErrorsTracker.ts';
import { useToast } from '../../context/ToastContext.tsx';

/**
 * Interactive Errors History & Statistics Panel (inspired by KitsunePie/AppErrorsTracking)
 */
export const AppErrorsTrackerPanel: React.FC<{ isDark?: boolean }> = ({ isDark = true }) => {
  const toast = useToast();
  const [records, setRecords] = useState<TrackedAppErrorRecord[]>(() => loadTrackedAppErrors());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setRecords(loadTrackedAppErrors());
    const unsub = onTrackedAppErrorsUpdated(sync);
    return () => unsub();
  }, []);

  const stats = getAppErrorsStatistics(records);

  const handleCopyReport = async (rec: TrackedAppErrorRecord) => {
    const text = formatErrorStackTraceReport(rec);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(rec.id);
      toast.success('Copied full exception stack trace to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.info('Stack trace ready in console');
    }
  };

  const handleShareReport = async (rec: TrackedAppErrorRecord) => {
    const text = formatErrorStackTraceReport(rec);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Beacon Exception: ${rec.name}`,
          text,
        });
        return;
      } catch {
        // fall back to clipboard
      }
    }
    await handleCopyReport(rec);
  };

  const handleExportAllLogs = () => {
    const payload = {
      app: 'Beacon Network (com.beacon.mesh)',
      module: 'AppErrorsTracking',
      exportedAt: new Date().toISOString(),
      statistics: stats,
      records,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beacon-app-errors-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Exported AppErrorsTracking log file (.json)');
  };

  return (
    <div
      className={`rounded-3xl border p-5 space-y-4 ${
        isDark
          ? 'bg-[#130F2B] border-[#8957FF]/35 text-[#F8F7FF]'
          : 'bg-white border-[#8957FF]/20 text-slate-900'
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FF4FA3] to-[#8957FF] flex items-center justify-center text-white shadow-md">
            <Bug className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold">AppErrorsTracking Console</h3>
              <span className="px-2 py-0.5 rounded-full bg-[#00D6A0]/15 text-[#00D6A0] text-[10px] font-black uppercase">
                Active
              </span>
            </div>
            <p className={`text-xs ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
              On-device exception history, stack trace inspector &amp; crash statistics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportAllLogs}
            className="px-3 py-1.5 rounded-xl bg-[#00D9FF]/15 border border-[#00D9FF]/35 text-[#00D9FF] text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            title="Export exception history & stack traces as JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Logs</span>
          </button>

          {records.length > 0 && (
            <button
              type="button"
              onClick={() => {
                clearTrackedAppErrors();
                toast.info('Cleared all recorded exception logs');
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-400 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear ({records.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div
          className={`p-3 rounded-2xl border ${
            isDark ? 'bg-[#1B153A] border-white/10' : 'bg-[#F8F6FF] border-[#8957FF]/15'
          }`}
        >
          <span className="text-[10px] font-bold uppercase text-[#00D9FF] flex items-center gap-1">
            <BarChart3 className="w-3 h-3" /> Total Captured
          </span>
          <span className="text-lg font-black block mt-0.5">{stats.totalExceptions}</span>
        </div>

        <div
          className={`p-3 rounded-2xl border ${
            isDark ? 'bg-[#1B153A] border-white/10' : 'bg-[#F8F6FF] border-[#8957FF]/15'
          }`}
        >
          <span className="text-[10px] font-bold uppercase text-[#8957FF]">Unique Stack Traces</span>
          <span className="text-lg font-black block mt-0.5">{stats.uniqueExceptions}</span>
        </div>

        <div
          className={`p-3 rounded-2xl border ${
            isDark ? 'bg-[#1B153A] border-white/10' : 'bg-[#F8F6FF] border-[#8957FF]/15'
          }`}
        >
          <span className="text-[10px] font-bold uppercase text-[#FF4FA3]">Runtime / Render</span>
          <span className="text-lg font-black block mt-0.5">
            {stats.byCategory['Uncaught Exception'] + stats.byCategory['React Render Crash']}
          </span>
        </div>

        <div
          className={`p-3 rounded-2xl border ${
            isDark ? 'bg-[#1B153A] border-white/10' : 'bg-[#F8F6FF] border-[#8957FF]/15'
          }`}
        >
          <span className="text-[10px] font-bold uppercase text-amber-400">Async / Promise</span>
          <span className="text-lg font-black block mt-0.5">
            {stats.byCategory['Unhandled Rejection']}
          </span>
        </div>
      </div>

      {/* Exception History List */}
      {records.length === 0 ? (
        <div
          className={`p-4 rounded-2xl border text-center text-xs ${
            isDark
              ? 'bg-[#1B153A]/60 border-white/10 text-[#A9A2D0]'
              : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}
        >
          No uncaught exceptions or crashes recorded in this session.
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {records.map((rec) => {
            const isExpanded = expandedId === rec.id;
            return (
              <div
                key={rec.id}
                className={`rounded-2xl border p-3.5 transition-all ${
                  isDark ? 'bg-[#1B153A] border-white/10' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                    className="text-left flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-black">
                        {rec.category}
                      </span>
                      <span className="text-[10px] font-mono text-[#00D9FF]">{rec.processName}</span>
                      {rec.occurrences > 1 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black">
                          ×{rec.occurrences}
                        </span>
                      )}
                      <span className="text-[10px] opacity-60">
                        {new Date(rec.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs font-extrabold mt-1 truncate">
                      {rec.name}: {rec.message}
                    </p>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleCopyReport(rec)}
                      className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-[#00D9FF] cursor-pointer"
                      title="Copy Stack Trace"
                    >
                      {copiedId === rec.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleShareReport(rec)}
                      className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-[#8957FF] cursor-pointer"
                      title="Share Stack Trace"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTrackedAppError(rec.id)}
                      className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                      title="Delete Record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                      className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <pre className="mt-3 p-3 rounded-xl bg-black/60 text-rose-200 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed border border-rose-500/25">
                    {rec.stack}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface ErrorBoundaryState {
  hasError: boolean;
  record: TrackedAppErrorRecord | null;
  copied: boolean;
}

/**
 * Custom Crash Dialog ErrorBoundary (replaces blank crash screens with an interactive
 * KitsunePie/AppErrorsTracking stack trace dialog with Copy, Share, Export & Recover).
 */
export class AppErrorsBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      record: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const rec = recordTrackedAppError({
      category: 'React Render Crash',
      name: error?.name || 'RenderCrash',
      message: error?.message || 'Unexpected UI render crash',
      stack: error?.stack || String(error),
      processName: 'com.beacon.mesh:render',
    });
    return {
      hasError: true,
      record: rec,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    recordTrackedAppError({
      category: 'React Render Crash',
      name: error?.name || 'RenderCrash',
      message: error?.message || 'Unexpected UI render crash',
      stack: `${error?.stack || error?.message}\n\nComponent Stack:${errorInfo?.componentStack || ''}`,
      processName: 'com.beacon.mesh:render',
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const rec = this.state.record;
    const reportText = rec ? formatErrorStackTraceReport(rec) : 'Application Error';

    return (
      <div className="min-h-screen w-screen bg-[#0B081B] text-white flex items-center justify-center p-4 font-sans">
        <div className="max-w-lg w-full rounded-3xl bg-[#130F2B] border-2 border-rose-500/50 shadow-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-black uppercase tracking-wider">
                AppErrorsTracking · Crash Intercepted
              </span>
              <h2 className="text-base font-extrabold mt-0.5">
                {rec?.name || 'Application Exception'}
              </h2>
              <p className="text-xs text-slate-300">{rec?.message}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-black/60 border border-white/10 p-3">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5 font-mono">
              <span className="inline-flex items-center gap-1 text-[#00D9FF]">
                <Terminal className="w-3 h-3" /> Stack Trace ({rec?.processName})
              </span>
              <span>{rec?.platform}</span>
            </div>
            <pre className="text-[10px] font-mono text-rose-200 max-h-52 overflow-auto whitespace-pre-wrap leading-relaxed">
              {rec?.stack}
            </pre>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(reportText);
                    this.setState({ copied: true });
                    setTimeout(() => this.setState({ copied: false }), 2000);
                  } catch {}
                }}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {this.state.copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-[#00D9FF]" />
                )}
                <span>{this.state.copied ? 'Copied' : 'Copy Trace'}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (typeof navigator.share === 'function') {
                    try {
                      await navigator.share({ title: 'Beacon Crash Report', text: reportText });
                    } catch {}
                  }
                }}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-[#8957FF]" />
                <span>Share</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, record: null });
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Recover App</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
