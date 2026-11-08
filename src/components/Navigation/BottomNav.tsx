import React from 'react';
import {
  Home,
  Map,
  Users,
  MessageSquare,
  User,
  Sparkles,
  Layers,
  Bookmark,
  Bell,
} from 'lucide-react';
import { sound, triggerHaptic } from '../../utils/audio.ts';
import { useTheme } from '../../context/ThemeContext.tsx';

export type PrimaryTab = 'home' | 'map' | 'friends' | 'chat' | 'profile';
export type ExtendedTab = PrimaryTab | 'rooms' | 'saved' | 'notifications';

export interface BottomNavProps {
  activeTab?: string;
  currentTab?: string;
  onChangeTab?: (tab: any) => void;
  onSelectTab?: (tab: any) => void;
  onPrefetchTab?: (tabId: string) => void;
  unreadChatCount?: number;
  pendingRequestsCount?: number;
  pendingFriendsCount?: number;
}

export const PRIMARY_NAV_ITEMS: Array<{
  id: PrimaryTab;
  label: string;
  icon: React.ElementType;
  gradient: string;
  iconColor: string;
  glow: string;
}> = [
  {
    id: 'home',
    label: 'Home',
    icon: Home,
    gradient: 'from-[#8957FF] via-[#FF4FA3] to-[#FF8066]',
    iconColor: 'text-[#FF4FA3]',
    glow: 'rgba(255, 79, 163, 0.45)',
  },
  {
    id: 'map',
    label: 'Map',
    icon: Map,
    gradient: 'from-[#00D6A0] to-[#00D9FF]',
    iconColor: 'text-[#00D6A0]',
    glow: 'rgba(0, 214, 160, 0.45)',
  },
  {
    id: 'friends',
    label: 'Friends',
    icon: Users,
    gradient: 'from-[#397BFF] to-[#00D9FF]',
    iconColor: 'text-[#397BFF]',
    glow: 'rgba(57, 123, 255, 0.45)',
  },
  {
    id: 'chat',
    label: 'Chats',
    icon: MessageSquare,
    gradient: 'from-[#FF4FA3] to-[#FF8066]',
    iconColor: 'text-[#FF8066]',
    glow: 'rgba(255, 128, 102, 0.45)',
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    gradient: 'from-[#8957FF] to-[#397BFF]',
    iconColor: 'text-[#8957FF]',
    glow: 'rgba(137, 87, 255, 0.45)',
  },
];

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  currentTab,
  onChangeTab,
  onSelectTab,
  onPrefetchTab,
  unreadChatCount = 0,
  pendingRequestsCount,
  pendingFriendsCount,
}) => {
  const { themeConfig } = useTheme();
  const isDark = themeConfig.isDark;
  const tab = currentTab ?? activeTab ?? 'home';
  const handleSelect = onSelectTab ?? onChangeTab ?? (() => {});
  const friendsBadge = pendingFriendsCount ?? pendingRequestsCount ?? 0;

  return (
    <nav
      aria-label="Primary Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-2.5 pt-1 pointer-events-none safe-area-pb"
    >
      <div
        className={`pointer-events-auto mx-auto max-w-md rounded-[28px] backdrop-blur-2xl border px-2 py-1.5 flex items-center justify-around transition-all duration-300 ${
          isDark
            ? 'bg-[#130F2B]/92 border-[#8957FF]/35 shadow-[0_14px_40px_rgba(7,5,20,0.85),0_0_24px_rgba(137,87,255,0.22)]'
            : 'bg-white/95 border-[#8957FF]/20 shadow-[0_12px_32px_rgba(137,87,255,0.18)]'
        }`}
      >
        {PRIMARY_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = tab === item.id;
          const badgeCount =
            item.id === 'chat'
              ? unreadChatCount
              : item.id === 'friends'
                ? friendsBadge
                : 0;

          return (
            <button
              key={item.id}
              type="button"
              onMouseEnter={() => onPrefetchTab?.(item.id)}
              onClick={() => {
                if (tab !== item.id) {
                  sound.playTabSwitch();
                  triggerHaptic('selection');
                }
                handleSelect(item.id);
              }}
              className="relative flex-1 flex flex-col items-center justify-center py-1 rounded-2xl transition-all duration-200 cursor-pointer group select-none active:scale-90"
            >
              {/* Active Gradient Pill Container */}
              <div
                className={`relative flex items-center justify-center w-11 h-8 rounded-2xl transition-all duration-300 ${
                  isActive
                    ? `bg-gradient-to-tr ${item.gradient} text-white scale-105`
                    : isDark
                      ? 'text-[#A9A2D0] group-hover:text-white group-hover:bg-white/5'
                      : 'text-slate-500 group-hover:text-slate-900 group-hover:bg-[#8957FF]/10'
                }`}
                style={
                  isActive
                    ? {
                        boxShadow: `0 6px 18px ${item.glow}`,
                      }
                    : undefined
                }
              >
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'stroke-[2.5] text-white' : `stroke-[2] group-hover:scale-110`
                  }`}
                />

                {/* Unread / Notification Badge */}
                {badgeCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-[#FF4FA3] to-[#FF8066] text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-[#0B081B] shadow-md animate-bounce"
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </div>

              <span
                className={`mt-1 text-[10px] tracking-wide font-extrabold transition-colors duration-200 ${
                  isActive
                    ? isDark
                      ? 'text-white'
                      : 'text-[#8957FF]'
                    : isDark
                      ? 'text-[#A9A2D0] group-hover:text-white'
                      : 'text-slate-500 group-hover:text-slate-900'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export const DesktopNavRail: React.FC<
  BottomNavProps & {
    unreadNotificationsCount?: number;
    activeAlertsCount?: number;
  }
> = ({
  activeTab,
  currentTab,
  onChangeTab,
  onSelectTab,
  onPrefetchTab,
  unreadChatCount = 0,
  pendingRequestsCount,
  pendingFriendsCount,
  unreadNotificationsCount = 0,
}) => {
  const { themeConfig } = useTheme();
  const isDark = themeConfig.isDark;
  const tab = currentTab ?? activeTab ?? 'home';
  const handleSelect = onSelectTab ?? onChangeTab ?? (() => {});
  const friendsBadge = pendingFriendsCount ?? pendingRequestsCount ?? 0;

  const secondaryItems = [
    {
      id: 'rooms',
      label: 'Rooms',
      icon: Layers,
      badge: 0,
      gradient: 'from-[#8957FF] to-[#FF4FA3]',
    },
    {
      id: 'saved',
      label: 'Places',
      icon: Bookmark,
      badge: 0,
      gradient: 'from-[#00D6A0] to-[#00D9FF]',
    },
    {
      id: 'notifications',
      label: 'Alerts',
      icon: Bell,
      badge: unreadNotificationsCount,
      gradient: 'from-[#FF4FA3] to-[#FF8066]',
    },
  ];

  return (
    <aside
      aria-label="Desktop Navigation Rail"
      className={`hidden md:flex flex-col justify-between w-20 lg:w-60 shrink-0 border-r backdrop-blur-2xl py-4 px-2.5 z-30 select-none transition-colors duration-300 ${
        isDark
          ? 'bg-[#130F2B]/90 border-[#8957FF]/25'
          : 'bg-white/92 border-[#8957FF]/15 shadow-sm'
      }`}
    >
      <div className="space-y-6">
        {/* Primary 5 Destinations */}
        <div className="space-y-1.5">
          <div className="px-3 pb-1 hidden lg:flex items-center justify-between">
            <span
              className={`text-[10px] font-extrabold uppercase tracking-[0.18em] ${
                isDark ? 'text-[#A9A2D0]' : 'text-slate-400'
              }`}
            >
              Beacon Network
            </span>
            <span className="w-2 h-2 rounded-full bg-[#00D6A0] shadow-[0_0_8px_#00D6A0]" />
          </div>

          {PRIMARY_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = tab === item.id;
            const badgeCount =
              item.id === 'chat'
                ? unreadChatCount
                : item.id === 'friends'
                  ? friendsBadge
                  : 0;

            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => onPrefetchTab?.(item.id)}
                onClick={() => {
                  if (tab !== item.id) {
                    sound.playTabSwitch();
                    triggerHaptic('selection');
                  }
                  handleSelect(item.id);
                }}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl font-bold text-xs transition-all duration-200 cursor-pointer group ${
                  isActive
                    ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg`
                    : isDark
                      ? 'text-[#A9A2D0] hover:text-white hover:bg-white/5 border border-transparent'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-[#8957FF]/10 border border-transparent'
                }`}
                style={
                  isActive
                    ? {
                        boxShadow: `0 8px 22px ${item.glow}`,
                      }
                    : undefined
                }
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 ${
                    isActive
                      ? 'bg-white/20 text-white scale-105'
                      : isDark
                        ? 'bg-white/5 group-hover:bg-white/10'
                        : 'bg-[#8957FF]/10 group-hover:bg-[#8957FF]/15'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-white stroke-[2.5]' : item.iconColor
                    }`}
                  />
                </div>
                <span className="hidden lg:inline tracking-wide font-extrabold text-[13px]">
                  {item.label}
                </span>

                {badgeCount > 0 && (
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-gradient-to-r from-[#FF4FA3] to-[#FF8066] text-white text-[10px] font-extrabold shadow-sm">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Tactical Extensions */}
        <div
          className={`pt-4 border-t space-y-1.5 ${
            isDark ? 'border-white/10' : 'border-[#8957FF]/15'
          }`}
        >
          <div className="px-3 pb-1 hidden lg:block">
            <span
              className={`text-[10px] font-extrabold uppercase tracking-[0.18em] ${
                isDark ? 'text-[#A9A2D0]' : 'text-slate-400'
              }`}
            >
              Spaces & Places
            </span>
          </div>

          {secondaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => onPrefetchTab?.(item.id)}
                onClick={() => {
                  sound.playTabSwitch();
                  handleSelect(item.id);
                }}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl font-bold text-xs transition-all duration-200 cursor-pointer group ${
                  isActive
                    ? `bg-gradient-to-r ${item.gradient} text-white shadow-md`
                    : isDark
                      ? 'text-[#A9A2D0] hover:text-white hover:bg-white/5 border border-transparent'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-[#8957FF]/10 border border-transparent'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : isDark
                        ? 'bg-white/5 text-[#00D9FF]'
                        : 'bg-[#8957FF]/10 text-[#8957FF]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                </div>
                <span className="hidden lg:inline tracking-wide font-extrabold text-[13px]">
                  {item.label}
                </span>
                {item.badge > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 rounded-full bg-[#FF4FA3] text-white text-[10px] font-extrabold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Beacon Network Status Card */}
      <div
        className={`hidden lg:block p-3.5 rounded-2xl border space-y-2 ${
          isDark
            ? 'bg-gradient-to-br from-[#8957FF]/20 via-[#1B153A] to-[#FF4FA3]/15 border-[#8957FF]/35'
            : 'bg-gradient-to-br from-[#E9DFFF] via-white to-[#FFE5F1] border-[#8957FF]/25'
        }`}
      >
        <div className="flex items-center justify-between">
          <span
            className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
              isDark ? 'text-[#00D9FF]' : 'text-[#8957FF]'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            Beacon Network
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#00D6A0]">
            <span className="w-2 h-2 rounded-full bg-[#00D6A0] animate-ping" />
            SYNCED
          </span>
        </div>
        <p
          className={`text-[11px] leading-snug font-medium ${
            isDark ? 'text-[#F8F7FF]/90' : 'text-slate-700'
          }`}
        >
          Share live spots, updates & private rooms with your circle.
        </p>
      </div>
    </aside>
  );
};
