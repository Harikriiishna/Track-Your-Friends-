import React from 'react';
import {
  Home,
  Map,
  Users,
  MessageSquare,
  User,
  Globe,
  Bookmark,
  Bell,
  Calendar,
  Clock,
  Siren,
  Shield,
  Radar,
  X,
} from 'lucide-react';
import { sound, triggerHaptic } from '../../utils/audio.ts';
import { useTheme } from '../../context/ThemeContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

export type PrimaryTab = 'home' | 'map' | 'crowdzone' | 'friends' | 'chat' | 'profile';

export interface BottomNavProps {
  activeTab?: string;
  currentTab?: string;
  onChangeTab?: (tab: any) => void;
  onSelectTab?: (tab: any) => void;
  onPrefetchTab?: (tabId: string) => void;
  unreadChatCount?: number;
  pendingRequestsCount?: number;
  pendingFriendsCount?: number;
  onClearChatBadge?: () => void;
  onClearNotifications?: () => void;
}

export const PRIMARY_NAV_ITEMS: Array<{
  id: PrimaryTab;
  label: string;
  icon: React.ElementType;
  activeGradient: string;
  glowColor: string;
}> = [
  {
    id: 'home',
    label: 'Home',
    icon: Home,
    activeGradient: 'from-[#8957FF] to-[#FF4FA3]',
    glowColor: 'shadow-[0_0_20px_rgba(137,87,255,0.55)]',
  },
  {
    id: 'map',
    label: 'Map',
    icon: Map,
    activeGradient: 'from-[#00D6A0] to-[#00D9FF]',
    glowColor: 'shadow-[0_0_20px_rgba(0,214,160,0.55)]',
  },
  {
    id: 'crowdzone',
    label: 'CROWDZONE',
    icon: Radar,
    activeGradient: 'from-[#00D9FF] to-[#397BFF]',
    glowColor: 'shadow-[0_0_22px_rgba(0,217,255,0.65)]',
  },
  {
    id: 'friends',
    label: 'Friends',
    icon: Users,
    activeGradient: 'from-[#397BFF] to-[#00D9FF]',
    glowColor: 'shadow-[0_0_20px_rgba(57,123,255,0.55)]',
  },
  {
    id: 'chat',
    label: 'Chats',
    icon: MessageSquare,
    activeGradient: 'from-[#FF4FA3] to-[#FF8066]',
    glowColor: 'shadow-[0_0_20px_rgba(255,79,163,0.55)]',
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    activeGradient: 'from-[#8957FF] to-[#397BFF]',
    glowColor: 'shadow-[0_0_20px_rgba(137,87,255,0.55)]',
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
  onClearChatBadge,
  onClearNotifications,
}) => {
  const { themeConfig } = useTheme();
  const isLight = !themeConfig.isDark;
  const rawTab = currentTab ?? activeTab ?? 'home';
  const handleSelect = onSelectTab ?? onChangeTab ?? (() => {});
  const friendsBadge = pendingFriendsCount ?? pendingRequestsCount ?? 0;

  return (
    <nav
      aria-label="Primary Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-2.5 pt-1 pointer-events-none safe-area-pb"
    >
      <div
        className={`pointer-events-auto mx-auto max-w-md rounded-[28px] px-2 py-2 flex items-center justify-around border backdrop-blur-2xl transition-colors ${
          isLight
            ? 'bg-white/95 border-[#8957FF]/25 shadow-[0_12px_36px_rgba(137,87,255,0.18)]'
            : 'bg-[#130F2B]/95 border-[#8957FF]/35 shadow-[0_14px_40px_rgba(11,8,27,0.85),0_0_25px_rgba(137,87,255,0.18)]'
        }`}
      >
        {PRIMARY_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            rawTab === item.id ||
            (item.id === 'home' && (rawTab === 'rooms' || rawTab === 'universal'));
          const badgeCount =
            item.id === 'chat' ? unreadChatCount : item.id === 'friends' ? friendsBadge : 0;

          return (
            <div
              key={item.id}
              className="relative flex-1 flex flex-col items-center justify-center"
            >
              <button
                type="button"
                onMouseEnter={() => onPrefetchTab?.(item.id)}
                onClick={() => {
                  if (rawTab !== item.id) {
                    sound.playTabSwitch();
                    triggerHaptic('selection');
                  }
                  handleSelect(item.id);
                }}
                className="relative w-full flex flex-col items-center justify-center py-0.5 px-1 rounded-2xl transition-all cursor-pointer select-none"
              >
                <div
                  className={`relative flex items-center justify-center w-11 h-8 rounded-2xl transition-all ${
                    isActive
                      ? `bg-gradient-to-r ${item.activeGradient} text-white ${item.glowColor}`
                      : item.id === 'crowdzone'
                        ? 'text-[#00D9FF] bg-[#00D9FF]/10 border border-[#00D9FF]/30 hover:bg-[#00D9FF]/20'
                        : isLight
                          ? 'text-[#655E8A] hover:text-[#161032] hover:bg-[#8957FF]/10'
                          : 'text-[#A6A1C8] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4 stroke-[2.3]" />
                </div>

                <span
                  className={`mt-1 text-[10px] sm:text-[11px] leading-tight font-bold transition-colors truncate max-w-[64px] ${
                    isActive
                      ? item.id === 'crowdzone'
                        ? 'text-[#00D9FF]'
                        : isLight
                          ? 'text-[#161032]'
                          : 'text-white'
                      : item.id === 'crowdzone'
                        ? 'text-[#00D9FF]'
                        : isLight
                          ? 'text-[#655E8A]'
                          : 'text-[#A6A1C8]'
                  }`}
                >
                  {item.label}
                </span>
              </button>

              {badgeCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('selection');
                    if (item.id === 'chat' && onClearChatBadge) {
                      onClearChatBadge();
                    } else if (onClearNotifications) {
                      onClearNotifications();
                    } else {
                      handleSelect(item.id);
                    }
                  }}
                  title={`Tap to clear ${item.label} badge`}
                  aria-label={`Clear ${item.label} badge`}
                  className="absolute -top-1 right-2 min-w-[22px] h-[18px] px-1 rounded-full bg-gradient-to-r from-[#FF4FA3] to-[#FF8066] hover:opacity-95 text-white text-[10px] font-black inline-flex items-center justify-center gap-0.5 border-2 border-[#130F2B] shadow-md cursor-pointer active:scale-90 transition-transform z-20"
                >
                  <span>{badgeCount > 99 ? '99+' : badgeCount}</span>
                  <X className="w-2.5 h-2.5 stroke-[3]" />
                </button>
              )}
            </div>
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
  activeAlertsCount = 0,
  onClearChatBadge,
  onClearNotifications,
}) => {
  const { themeConfig } = useTheme();
  const { user } = useAuth();
  const isLight = !themeConfig.isDark;
  const rawTab = currentTab ?? activeTab ?? 'home';
  const handleSelect = onSelectTab ?? onChangeTab ?? (() => {});
  const friendsBadge = pendingFriendsCount ?? pendingRequestsCount ?? 0;

  const desktopItems = [
    { id: 'home', label: 'Home Hub', icon: Home, badge: 0, gradient: 'from-[#8957FF] to-[#FF4FA3]' },
    { id: 'map', label: 'Live HD Map', icon: Map, badge: 0, gradient: 'from-[#00D6A0] to-[#00D9FF]' },
    { id: 'crowdzone', label: 'CROWDZONE', icon: Radar, badge: 0, gradient: 'from-[#00D9FF] to-[#397BFF]' },
    { id: 'universal', label: 'Universal Lounge', icon: Globe, badge: 0, gradient: 'from-[#397BFF] to-[#00D9FF]' },
    { id: 'rooms', label: 'Private Rooms', icon: Users, badge: 0, gradient: 'from-[#8957FF] to-[#397BFF]' },
    { id: 'friends', label: 'Friends & Circle', icon: Users, badge: friendsBadge, gradient: 'from-[#00D6A0] to-[#397BFF]' },
    { id: 'chat', label: 'Live Chats', icon: MessageSquare, badge: unreadChatCount, gradient: 'from-[#FF4FA3] to-[#FF8066]' },
    { id: 'saved', label: 'Saved Places', icon: Bookmark, badge: 0, gradient: 'from-[#FFD166] to-[#FF8066]' },
    { id: 'meetings', label: 'Meetups', icon: Calendar, badge: 0, gradient: 'from-[#8957FF] to-[#FF4FA3]' },
    { id: 'reminders', label: 'Geo Reminders', icon: Clock, badge: 0, gradient: 'from-[#397BFF] to-[#00D9FF]' },
    { id: 'notifications', label: 'Activity Feed', icon: Bell, badge: unreadNotificationsCount, gradient: 'from-[#FF4FA3] to-[#8957FF]' },
    { id: 'alerts', label: 'SOS Center', icon: Siren, badge: activeAlertsCount, gradient: 'from-[#FF3B6B] to-[#FF8066]' },
    { id: 'profile', label: 'Profile & Privacy', icon: User, badge: 0, gradient: 'from-[#8957FF] to-[#397BFF]' },
  ];

  if (user?.isAdmin) {
    desktopItems.push({
      id: 'admin',
      label: 'Admin Console',
      icon: Shield,
      badge: 0,
      gradient: 'from-[#FFD166] to-[#FF4FA3]',
    });
  }

  return (
    <aside
      aria-label="Desktop Navigation Rail"
      className={`hidden md:flex flex-col justify-between w-60 shrink-0 border-r py-4 px-3 z-30 select-none overflow-y-auto ${
        isLight
          ? 'bg-white/95 border-[#8957FF]/20 text-[#161032]'
          : 'bg-[#130F2B]/95 border-[#8957FF]/25 text-[#F8F7FF]'
      }`}
    >
      <div className="space-y-1">
        <div className="px-3 pb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#A6A1C8]">
            Beacon Navigation
          </span>
        </div>

        {desktopItems.map((item) => {
          const Icon = item.icon;
          const isActive = rawTab === item.id;

          return (
            <div key={item.id} className="relative flex items-center">
              <button
                type="button"
                onMouseEnter={() => onPrefetchTab?.(item.id)}
                onClick={() => {
                  if (rawTab !== item.id) {
                    sound.playTabSwitch();
                    triggerHaptic('selection');
                  }
                  handleSelect(item.id);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all cursor-pointer ${
                  isActive
                    ? isLight
                      ? 'bg-[#8957FF]/15 text-[#161032] border border-[#8957FF]/35 font-extrabold shadow-sm'
                      : 'bg-[#1B153A] text-white border border-[#8957FF]/45 font-extrabold shadow-lg'
                    : isLight
                      ? 'text-[#655E8A] hover:text-[#161032] hover:bg-[#8957FF]/5 border border-transparent font-semibold'
                      : 'text-[#A6A1C8] hover:text-white hover:bg-white/5 border border-transparent font-semibold'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isActive
                      ? `bg-gradient-to-r ${item.gradient} text-white shadow-md`
                      : isLight
                        ? 'bg-[#F5F3FF] text-[#655E8A]'
                        : 'bg-[#0B081B] text-[#A6A1C8] border border-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs truncate flex-1">{item.label}</span>
              </button>
              {item.badge > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.id === 'chat' && onClearChatBadge) {
                      onClearChatBadge();
                    } else if (onClearNotifications) {
                      onClearNotifications();
                    } else {
                      handleSelect(item.id);
                    }
                  }}
                  title={`Clear ${item.label} badge`}
                  className="absolute right-2.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#FF4FA3] to-[#FF8066] text-white text-[10px] font-black inline-flex items-center gap-0.5 cursor-pointer hover:opacity-90"
                >
                  <span>{item.badge > 99 ? '99+' : item.badge}</span>
                  <X className="w-2.5 h-2.5 stroke-[3]" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
