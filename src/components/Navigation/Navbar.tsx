import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { sound, triggerHaptic } from '../../utils/audio.ts';
import { useToast } from '../../context/ToastContext.tsx';
import {
  Compass,
  Layers,
  Bookmark,
  Sun,
  Moon,
  Bell,
  Siren,
  LogOut,
  X,
} from 'lucide-react';
import { DesktopNavRail } from './BottomNav.tsx';

export { DesktopNavRail };

export interface NavbarProps {
  activeTab?: string;
  currentTab?: string;
  setActiveTab?: (tab: any) => void;
  onSelectTab?: (tab: any) => void;
  onTriggerEmergency?: () => void;
  onOpenSos?: () => void;
  onPrefetchTab?: (tabId: string) => void;
  activeRoomId?: string | null;
  unreadNotificationsCount?: number;
  unreadChatCount?: number;
  pendingFriendsCount?: number;
  onClearNotifications?: () => void;
  onClearChatBadge?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab: activeTabProp,
  currentTab,
  setActiveTab: setActiveTabProp,
  onSelectTab,
  onTriggerEmergency,
  onOpenSos,
  unreadNotificationsCount = 0,
  onClearNotifications,
}) => {
  const activeTab = currentTab ?? activeTabProp ?? 'home';
  const setActiveTab = onSelectTab ?? setActiveTabProp ?? (() => {});
  const { user, logout } = useAuth();
  const { isConnected } = useRealtime();
  const { themeConfig, toggleDarkLight } = useTheme();
  const toast = useToast();
  const isLight = !themeConfig.isDark;

  const handleLogout = async () => {
    triggerHaptic('medium');
    await logout();
    toast.info('Logged out of Beacon Network');
  };

  const initials = (user?.fullName || user?.username || 'BN')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header
      className={`h-15 px-3 sm:px-5 flex items-center justify-between gap-2 border-b z-40 shrink-0 select-none backdrop-blur-xl transition-colors ${
        isLight
          ? 'bg-white/95 border-[#8957FF]/20 text-[#161032]'
          : 'bg-[#0B081B]/95 border-[#8957FF]/25 text-[#F8F7FF]'
      }`}
    >
      {/* Left: Beacon Network Brand Logo & Tagline */}
      <button
        type="button"
        onClick={() => {
          sound.playTabSwitch();
          setActiveTab('home');
        }}
        className="flex items-center gap-2.5 text-left cursor-pointer group min-w-0"
      >
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-2xl social-story-ring flex items-center justify-center shadow-lg">
            <div className="w-full h-full rounded-[13px] bg-[#0B081B] flex items-center justify-center text-[#FF4FA3]">
              <Compass className="w-5 h-5 stroke-[2.3] group-hover:rotate-45 transition-transform duration-300" />
            </div>
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0B081B] ${
              isConnected ? 'bg-[#00D6A0]' : 'bg-amber-400'
            }`}
            title={isConnected ? 'Live Cloud Sync Connected' : 'Offline Resilience Active'}
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-sm sm:text-base tracking-wider bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#00D9FF] bg-clip-text text-transparent">
              BEACON
            </span>
            <span className={`font-black text-sm sm:text-base tracking-wider ${isLight ? 'text-[#161032]' : 'text-white'}`}>
              NETWORK
            </span>
          </div>
          <span className="text-[10px] text-[#A6A1C8] block truncate leading-tight">
            Stay Connected · Stay Together
          </span>
        </div>
      </button>

      {/* Right: Quick Action Controls (Rooms/Layers, Saved, Theme, Notifications, SOS, Profile, Logout) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Rooms / Layers Shortcut */}
        <button
          type="button"
          onClick={() => {
            sound.playTabSwitch();
            setActiveTab('rooms');
          }}
          title="Beacon Rooms & Channels"
          className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
            activeTab === 'rooms' || activeTab === 'universal'
              ? 'bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white border-transparent shadow-[0_0_16px_rgba(137,87,255,0.5)]'
              : isLight
                ? 'bg-[#F5F3FF] border-[#8957FF]/25 text-[#8957FF] hover:bg-[#8957FF]/15'
                : 'bg-[#130F2B] border-[#8957FF]/35 text-[#FF4FA3] hover:bg-[#8957FF]/20'
          }`}
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Saved Places Shortcut */}
        <button
          type="button"
          onClick={() => {
            sound.playTabSwitch();
            setActiveTab('saved');
          }}
          title="Saved Places & Geofences"
          className={`hidden xs:flex w-9 h-9 rounded-full items-center justify-center border transition-all cursor-pointer ${
            activeTab === 'saved'
              ? 'bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 border-transparent shadow-md'
              : isLight
                ? 'bg-[#F5F3FF] border-[#00D9FF]/30 text-[#0099CC] hover:bg-[#00D9FF]/15'
                : 'bg-[#130F2B] border-[#00D9FF]/30 text-[#00D9FF] hover:bg-[#00D9FF]/20'
          }`}
        >
          <Bookmark className="w-4 h-4" />
        </button>

        {/* Light / Dark Theme Toggle */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            toggleDarkLight();
          }}
          title={themeConfig.isDark ? 'Switch to Daylight Mode' : 'Switch to Neon Dark Mode'}
          className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
            isLight
              ? 'bg-[#F5F3FF] border-amber-400/40 text-amber-600 hover:bg-amber-500/15'
              : 'bg-[#130F2B] border-[#FFD166]/35 text-[#FFD166] hover:bg-[#FFD166]/15'
          }`}
        >
          {themeConfig.isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications Center + Instant Clear Badge Button */}
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={() => {
              sound.playTabSwitch();
              setActiveTab('notifications');
            }}
            title="Notifications & Activity"
            className={`relative w-9 h-9 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
              activeTab === 'notifications'
                ? 'bg-gradient-to-r from-[#8957FF] to-[#397BFF] text-white border-transparent shadow-md'
                : isLight
                  ? 'bg-[#F5F3FF] border-[#8957FF]/25 text-[#161032] hover:bg-[#8957FF]/10'
                  : 'bg-[#130F2B] border-[#8957FF]/30 text-white hover:bg-white/10'
            }`}
          >
            <Bell className="w-4 h-4" />
          </button>
          {unreadNotificationsCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic('selection');
                if (onClearNotifications) {
                  onClearNotifications();
                } else {
                  setActiveTab('notifications');
                }
              }}
              title="Tap to clear notification badge"
              aria-label="Clear notifications badge"
              className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[18px] px-1 rounded-full bg-[#FF3B6B] hover:bg-rose-600 text-white text-[9px] font-black inline-flex items-center justify-center gap-0.5 border border-[#0B081B] shadow-md cursor-pointer active:scale-90 transition-transform z-10"
            >
              <span>{unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}</span>
              <X className="w-2.5 h-2.5 stroke-[3]" />
            </button>
          )}
        </div>

        {/* SOS Emergency Button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('heavy');
            if (onOpenSos) onOpenSos();
            else if (onTriggerEmergency) onTriggerEmergency();
            else setActiveTab('alerts');
          }}
          title="Emergency SOS Broadcast"
          className="px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF4FA3] to-[#FF8066] hover:opacity-95 text-white font-black text-xs inline-flex items-center gap-1.5 shadow-[0_0_18px_rgba(255,79,163,0.45)] cursor-pointer active:scale-95 transition-all"
        >
          <Siren className="w-3.5 h-3.5" />
          <span>SOS</span>
        </button>

        {/* User Profile Avatar Pill */}
        {user && (
          <button
            type="button"
            onClick={() => {
              sound.playTabSwitch();
              setActiveTab('profile');
            }}
            title={`${user.fullName} (@${user.username})`}
            className="w-9 h-9 rounded-full social-story-ring flex items-center justify-center shrink-0 cursor-pointer"
          >
            <div className="w-full h-full rounded-full bg-[#130F2B] flex items-center justify-center text-white text-xs font-black overflow-hidden">
              {user.avatarUrl && !user.avatarUrl.includes('dicebear.com/7.x/initials') ? (
                <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
          </button>
        )}

        {/* Account Logout Button */}
        {user && (
          <button
            type="button"
            onClick={handleLogout}
            title="Log Out of Account"
            aria-label="Log Out"
            className="w-9 h-9 sm:w-auto sm:px-2.5 rounded-full bg-[#FF3B6B]/15 hover:bg-[#FF3B6B]/25 border border-[#FF3B6B]/40 text-[#FF3B6B] text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="hidden lg:inline">Log Out</span>
          </button>
        )}
      </div>
    </header>
  );
};
