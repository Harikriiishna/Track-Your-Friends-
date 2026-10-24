import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, CheckCircle2 } from 'lucide-react';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { triggerHaptic } from '../../utils/audio.ts';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showReconnected, setShowReconnected] = useState<boolean>(false);
  const { isConnected } = useRealtime();
  const { themeConfig } = useTheme();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      triggerHaptic('light');
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
      triggerHaptic('warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected && isConnected) {
    return null;
  }

  return (
    <div className="fixed top-14 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none transition-all duration-300">
      {!isOnline ? (
        <div className="pointer-events-auto mt-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 text-amber-300 border border-amber-500/30 shadow-lg backdrop-blur-xl flex items-center gap-2 text-xs font-medium animate-pop-in">
          <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>Offline Mode — Cached mesh & location data active</span>
        </div>
      ) : showReconnected ? (
        <div className="pointer-events-auto mt-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 text-emerald-300 border border-emerald-500/30 shadow-lg backdrop-blur-xl flex items-center gap-2 text-xs font-medium animate-pop-in">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Back Online — Real-time mesh synchronized</span>
        </div>
      ) : !isConnected ? (
        <div className="pointer-events-auto mt-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 text-sky-300 border border-sky-500/30 shadow-lg backdrop-blur-xl flex items-center gap-2 text-xs font-medium animate-pop-in">
          <Wifi className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
          <span>Reconnecting to mesh relay...</span>
        </div>
      ) : null}
    </div>
  );
};
