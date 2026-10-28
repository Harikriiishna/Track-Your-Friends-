import React, { useState } from 'react';
import { Globe, Copy, Check, Share2, Smartphone, ExternalLink, Search, X, ShieldCheck } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton.tsx';

interface WebsiteLaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoomId?: string | null;
}

const PUBLIC_WEB_URL = 'https://ais-pre-dkfhfrzboel3a3xnlpek5a-752786783113.asia-northeast1.run.app';
const DIRECT_APK_URL = 'https://github.com/Harikrishna8118/Track-Your-Friends-/releases/latest/download/app-debug.apk';

export const WebsiteLaunchModal: React.FC<WebsiteLaunchModalProps> = ({
  isOpen,
  onClose,
  activeRoomId,
}) => {
  const [copiedMain, setCopiedMain] = useState(false);
  const [copiedRoom, setCopiedRoom] = useState(false);

  if (!isOpen) return null;

  const websiteUrl =
    typeof window !== 'undefined' &&
    window.location.origin.startsWith('http') &&
    !window.location.origin.includes('localhost')
      ? window.location.origin
      : PUBLIC_WEB_URL;

  const roomInviteUrl = activeRoomId
    ? `${websiteUrl}/?tab=rooms&room=${encodeURIComponent(activeRoomId)}`
    : null;

  const handleCopy = async (text: string, type: 'main' | 'room') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'main') {
        setCopiedMain(true);
        setTimeout(() => setCopiedMain(false), 2500);
      } else {
        setCopiedRoom(true);
        setTimeout(() => setCopiedRoom(false), 2500);
      }
    } catch {}
  };

  const handleNativeShare = async (urlToShare: string, title: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: 'Join me on Beacon – Real-Time Location Sharing, Private Rooms & Community Mesh:',
          url: urlToShare,
        });
        return;
      } catch {}
    }
    handleCopy(urlToShare, urlToShare === roomInviteUrl ? 'room' : 'main');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-800/70 border-b border-slate-700/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Live Website & Google Launch Hub</span>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md">
                  Live
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Public web app synced in real time with Cloud Firestore & Android APK
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* 1. Primary Public Website URL */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                Public Website Link (Works on any browser)
              </span>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3 h-3" /> SSL & SEO Ready
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={websiteUrl}
                className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono select-all focus:outline-none"
              />
              <button
                onClick={() => handleCopy(websiteUrl, 'main')}
                className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {copiedMain ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMain ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={() => handleNativeShare(websiteUrl, 'Beacon – Real-Time Location & Mesh')}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer shrink-0"
                title="Share Website Link"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 2. Direct Room Deep-Link (if a room is active) */}
          {roomInviteUrl && (
            <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-300">
                  Direct Room Invite Link ({activeRoomId})
                </span>
                <span className="text-[10px] text-indigo-400">Auto-opens room on web</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={roomInviteUrl}
                  className="flex-1 bg-slate-900/90 border border-indigo-500/30 rounded-lg px-3 py-1.5 text-[11px] text-indigo-100 font-mono select-all focus:outline-none"
                />
                <button
                  onClick={() => handleCopy(roomInviteUrl, 'room')}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  {copiedRoom ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRoom ? 'Copied' : 'Copy Invite'}</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. Install as Web App (PWA) or Download Android APK */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/70 flex flex-col justify-between gap-2.5">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-sky-400" />
                  Install Web App (PWA)
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Install directly from Chrome, Edge, or Safari onto Desktop, iOS, or Android with zero store wait.
                </p>
              </div>
              <div className="pt-1 flex items-center gap-2">
                <PWAInstallButton />
                <span className="text-[11px] text-slate-400">manifest.webmanifest active</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/70 flex flex-col justify-between gap-2.5">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  Android APK Download
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Direct GitHub Release APK connected to the exact same live database & rooms.
                </p>
              </div>
              <a
                href={DIRECT_APK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Download app-debug.apk</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* 4. Google Search & SEO Indexing Status */}
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-amber-400" />
                Google Search & Indexing Configuration
              </h4>
              <div className="flex items-center gap-2 text-[11px]">
                <a
                  href="/sitemap.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline flex items-center gap-0.5"
                >
                  <span>sitemap.xml</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <span className="text-slate-600">•</span>
                <a
                  href="/robots.txt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline flex items-center gap-0.5"
                >
                  <span>robots.txt</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Configured with Schema.org <code className="text-slate-200">WebApplication</code> JSON-LD, OpenGraph social cards, dynamic XML Sitemap, and Googlebot crawl rules. To list on Google Search under your custom domain or URL, submit <code className="text-sky-300">{websiteUrl}/sitemap.xml</code> in{' '}
              <a
                href="https://search.google.com/search-console"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:underline font-medium"
              >
                Google Search Console
              </a>
              .
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Web & Android APK share real-time state automatically
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
