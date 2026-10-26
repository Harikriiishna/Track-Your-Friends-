import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { Compass, Siren, Palette } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import { ThemeSelectorModal } from './ThemeSelectorModal.tsx';
import { sound, triggerHaptic } from '../../utils/audio.ts';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenSos: () => void;
  onPrefetchTab?: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, onOpenSos, onPrefetchTab }) => {
  const { user } = useAuth();
  const { activeAlerts, isConnected } = useRealtime();
  const { themeConfig } = useTheme();
  const [showThemeModal, setShowThemeModal] = useState(false);

  const handleTabSelect = (tabId: string) => {
    if (tabId !== currentTab) {
      sound.playTap();
      triggerHaptic('selection');
      onSelectTab(tabId);
    }
  };

  return (
    <>
      <header
        className={`h-14 ${themeConfig.glassHeader} border-b px-4 md:px-6 flex items-center justify-between gap-8 shrink-0 z-30 transition-colors duration-200 shadow-sm`}
      >
        {/* Zone 1: Single text element wordmark with icon */}
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shadow-inner border border-white/20"
            style={{ backgroundColor: themeConfig.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.85)' }}
          >
            <Compass className="w-4 h-4" style={{ color: themeConfig.accentHex }} />
          </div>
          <span className={`text-base font-bold tracking-tight ${themeConfig.textPrimary}`}>
            Beacon
          </span>
        </div>

        {/* Zone 2: 4–5 clean single-line text navigation links */}
        {/* Zone 2: 4–5 clean single-line text navigation links with smooth active indicator */}
        <nav className={`hidden md:flex items-center gap-6 text-xs font-semibold ${themeConfig.textSecondary}`}>
          {[
            { id: 'map', label: 'Live Map' },
            { id: 'saved', label: 'Wishlist & Places' },
            { id: 'rooms', label: 'Rooms & Mesh' },
            { id: 'chat', label: 'Chat & Voice' },
            { id: 'alerts', label: 'Emergency Alerts', badge: activeAlerts.length },
            { id: 'reminders', label: 'Reminders' },
            { id: 'meetings', label: 'Meetings' },
            ...(user?.isAdmin ? [{ id: 'admin', label: 'Admin' }] : []),
          ].map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabSelect(item.id)}
                onMouseEnter={() => onPrefetchTab?.(item.id)}
                onTouchStart={() => onPrefetchTab?.(item.id)}
                className={`relative py-1 transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                  isActive
                    ? `${themeConfig.textPrimary} font-bold opacity-100`
                    : 'opacity-70 hover:opacity-100 hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                ) : null}
                {isActive && (
                  <span
                    className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full animate-fade-smooth shadow-sm"
                    style={{ backgroundColor: item.id === 'alerts' ? '#f43f5e' : themeConfig.accentHex }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action / User profile trigger / Theme switcher */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Realtime Network status indicator */}
          <div className={`hidden lg:flex items-center gap-1.5 text-[11px] font-medium ${themeConfig.textSecondary}`}>
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
              }`}
            />
            <span>{isConnected ? 'Mesh Online' : 'Connecting'}</span>
          </div>

          {/* Theme Selector Button */}
          <button
            onClick={() => setShowThemeModal(true)}
            className={`px-2.5 py-1.5 rounded-xl border ${themeConfig.glassBorder} hover:bg-white/10 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-sm`}
            title="Switch Glass Theme"
          >
            <Palette className="w-3.5 h-3.5" style={{ color: themeConfig.accentHex }} />
            <span className="hidden sm:inline text-xs">{themeConfig.name.split(' ')[0]}</span>
            <div
              className="w-2.5 h-2.5 rounded-full border border-white/50"
              style={{ backgroundColor: themeConfig.accentHex }}
            />
          </button>

          <PWAInstallButton compact={true} />

          <button
            onClick={onOpenSos}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all rounded-xl shadow-md flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Siren className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">SOS Alert</span>
          </button>

          <button
            onClick={() => onSelectTab('profile')}
            className={`flex items-center gap-2 p-1 pl-2 rounded-xl border ${themeConfig.glassBorder} hover:bg-white/10 transition-colors cursor-pointer`}
          >
            <span className={`text-xs font-semibold ${themeConfig.textPrimary} hidden sm:inline max-w-[100px] truncate`}>
              {user?.fullName.split(' ')[0]}
            </span>
            <img
              src={user?.avatarUrl}
              alt=""
              className="w-7 h-7 rounded-full object-cover border border-white/20"
            />
          </button>
        </div>
      </header>

      {/* Floating Theme Selector Modal */}
      <ThemeSelectorModal isOpen={showThemeModal} onClose={() => setShowThemeModal(false)} />
    </>
  );
};
