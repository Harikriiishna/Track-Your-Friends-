import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { notifications } from '../../utils/notifications.ts';
import { sound, triggerHaptic } from '../../utils/audio.ts';
import { useToast } from '../../context/ToastContext.tsx';
import {
  Compass,
  Siren,
  Volume2,
  VolumeX,
  Bell,
  Layers,
  Bookmark,
  Radio,
  Sun,
  Moon,
  Sparkles,
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
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab: activeTabProp,
  currentTab,
  setActiveTab: setActiveTabProp,
  onSelectTab,
  onTriggerEmergency: onTriggerEmergencyProp,
  onOpenSos,
  unreadNotificationsCount = 0,
}) => {
  const activeTab = currentTab ?? activeTabProp ?? 'home';
  const setActiveTab = onSelectTab ?? setActiveTabProp ?? (() => {});
  const onTriggerEmergency = onOpenSos ?? onTriggerEmergencyProp ?? (() => {});
  const { user } = useAuth();
  const { isConnected, onlineUserIds } = useRealtime();
  const { themeConfig, toggleDarkLight } = useTheme();
  const toast = useToast();
  const isDark = themeConfig.isDark;

  const [isMuted, setIsMuted] = useState<boolean>(() => sound.isMuted());

  useEffect(() => {
    notifications.getPermission();
  }, []);

  const handleToggleSound = () => {
    const nextMuted = sound.toggleMute();
    setIsMuted(nextMuted);
    if (!nextMuted) {
      sound.playChime();
      toast.info('Beacon Network audio & chimes enabled');
    } else {
      toast.info('Audio effects muted');
    }
  };

  return (
    <header
      className={`h-16 border-b px-3 sm:px-5 flex items-center justify-between z-40 shrink-0 select-none backdrop-blur-2xl transition-colors duration-300 ${
        isDark
          ? 'bg-[#0B081B]/90 border-[#8957FF]/25 text-[#F8F7FF]'
          : 'bg-white/92 border-[#8957FF]/15 text-slate-900 shadow-xs'
      }`}
    >
      {/* Left: Brand Identity */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => {
            sound.playTabSwitch();
            setActiveTab('home');
          }}
          className="flex items-center gap-2.5 text-left cursor-pointer group focus:outline-none"
        >
          <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#8957FF] via-[#FF4FA3] to-[#FF8066] p-[2px] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-[0_6px_20px_rgba(255,79,163,0.35)]">
            <div
              className={`w-full h-full rounded-[14px] flex items-center justify-center ${
                isDark ? 'bg-[#130F2B]' : 'bg-white'
              }`}
            >
              <Compass className="w-5 h-5 text-[#FF4FA3] group-hover:rotate-45 transition-transform duration-300" />
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${
                isDark ? 'border-[#0B081B]' : 'border-white'
              } ${
                isConnected
                  ? 'bg-[#00D6A0] shadow-[0_0_8px_#00D6A0]'
                  : 'bg-[#FFD166] animate-pulse'
              }`}
            />
          </div>

          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#397BFF] bg-clip-text text-transparent">
                BEACON
              </span>
              <span
                className={`font-extrabold text-sm sm:text-base tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                NETWORK
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#00D6A0]/20 to-[#00D9FF]/20 border border-[#00D6A0]/40 text-[10px] font-extrabold text-[#00D6A0]">
                <Radio className="w-2.5 h-2.5 animate-pulse" />
                {onlineUserIds.length} LIVE
              </span>
            </div>
            <span
              className={`text-[10px] block truncate font-medium ${
                isDark ? 'text-[#A9A2D0]' : 'text-slate-500'
              }`}
            >
              Stay Connected · Stay Together
            </span>
          </div>
        </button>
      </div>

      {/* Right: Quick Action Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Rooms Quick Pill */}
        <button
          type="button"
          onClick={() => {
            sound.playTabSwitch();
            setActiveTab('rooms');
          }}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer border active:scale-95 ${
            activeTab === 'rooms'
              ? 'bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] border-transparent text-white shadow-[0_4px_14px_rgba(137,87,255,0.4)]'
              : isDark
                ? 'bg-[#1B153A]/90 hover:bg-[#251D4D] border-[#8957FF]/30 text-[#E9DFFF]'
                : 'bg-[#F3EEFF] hover:bg-[#E9DFFF] border-[#8957FF]/20 text-[#8957FF]'
          }`}
          title="Rooms & Group Spaces"
        >
          <Layers className="w-3.5 h-3.5 text-[#FF4FA3]" />
          <span className="hidden sm:inline">Rooms</span>
        </button>

        {/* Saved Places Pill */}
        <button
          type="button"
          onClick={() => {
            sound.playTabSwitch();
            setActiveTab('saved');
          }}
          className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer border active:scale-95 ${
            activeTab === 'saved'
              ? 'bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] border-transparent text-slate-950 shadow-[0_4px_14px_rgba(0,214,160,0.35)]'
              : isDark
                ? 'bg-[#1B153A]/90 hover:bg-[#251D4D] border-[#00D9FF]/30 text-[#00D9FF]'
                : 'bg-[#E6FAFF] hover:bg-[#CCF5FF] border-[#00D9FF]/30 text-[#0099B8]'
          }`}
          title="Saved Places & Hotspots"
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Places</span>
        </button>

        {/* Light / Dark Theme Quick Switcher */}
        <button
          type="button"
          onClick={() => {
            sound.playTap();
            triggerHaptic('light');
            toggleDarkLight();
          }}
          className={`p-2 rounded-xl border transition-all cursor-pointer active:scale-95 ${
            isDark
              ? 'bg-[#1B153A]/90 hover:bg-[#251D4D] border-[#FFD166]/35 text-[#FFD166]'
              : 'bg-[#FFF6E0] hover:bg-[#FFECB8] border-[#FFD166]/60 text-amber-600'
          }`}
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          aria-label="Toggle Light or Dark Theme"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications Center Button */}
        <button
          type="button"
          onClick={() => {
            sound.playTabSwitch();
            setActiveTab('notifications');
          }}
          className={`relative p-2 rounded-xl border transition-all cursor-pointer active:scale-95 ${
            activeTab === 'notifications'
              ? 'bg-gradient-to-r from-[#FF4FA3] to-[#FF8066] border-transparent text-white shadow-md'
              : isDark
                ? 'bg-[#1B153A]/90 hover:bg-[#251D4D] border-white/10 text-[#F8F7FF]'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
          }`}
          title="Notification Center"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-gradient-to-r from-[#FF4FA3] to-[#FF8066] text-white text-[9px] font-extrabold flex items-center justify-center border border-[#0B081B]">
              {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
            </span>
          )}
        </button>

        {/* Sound Effects Toggle */}
        <button
          type="button"
          onClick={handleToggleSound}
          className={`hidden sm:flex p-2 rounded-xl border transition-all cursor-pointer ${
            !isMuted
              ? 'bg-[#00D6A0]/15 border-[#00D6A0]/35 text-[#00D6A0]'
              : isDark
                ? 'bg-[#1B153A]/90 border-white/10 text-[#A9A2D0]'
                : 'bg-slate-100 border-slate-200 text-slate-500'
          }`}
          title={isMuted ? 'Unmute UI Sounds' : 'Mute UI Sounds'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Emergency SOS Broadcast Button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('heavy');
            onTriggerEmergency();
          }}
          className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-[#FF4FA3] to-[#FF8066] hover:opacity-95 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-[0_6px_18px_rgba(255,79,163,0.4)]"
          title="Broadcast Emergency SOS"
        >
          <Siren className="w-3.5 h-3.5 animate-bounce" />
          <span>SOS</span>
        </button>

        {/* User Avatar Pill with Story Gradient Ring */}
        {user && (
          <button
            type="button"
            onClick={() => {
              sound.playTabSwitch();
              setActiveTab('profile');
            }}
            className="flex items-center gap-2 pl-1 pr-1 sm:pr-2.5 py-0.5 rounded-full hover:bg-[#8957FF]/10 transition-all cursor-pointer"
            title={`${user.fullName} (@${user.username})`}
          >
            <div className="social-story-ring rounded-full">
              <img
                src={user.avatarUrl}
                alt={user.fullName}
                className="w-7 h-7 rounded-full object-cover border border-[#0B081B]"
              />
            </div>
            <span
              className={`hidden xl:inline text-xs font-extrabold max-w-[95px] truncate ${
                isDark ? 'text-[#F8F7FF]' : 'text-slate-800'
              }`}
            >
              {user.fullName.split(' ')[0]}
            </span>
          </button>
        )}
      </div>
    </header>
  );
};
