import React from 'react';
import { MapPin, Users, MessageSquare, Siren, Bell, User } from 'lucide-react';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { triggerHaptic, sound } from '../../utils/audio.ts';

interface BottomNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onPrefetchTab?: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab, onPrefetchTab }) => {
  const { activeAlerts } = useRealtime();
  const { themeConfig } = useTheme();

  const handleTabClick = (tabId: string) => {
    if (tabId !== currentTab) {
      triggerHaptic('selection');
      sound.playTap();
      onSelectTab(tabId);
    }
  };

  const tabs = [
    { id: 'map', label: 'Map', icon: MapPin },
    { id: 'rooms', label: 'Rooms', icon: Users },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'alerts', label: 'Alerts', icon: Siren, badge: activeAlerts.length },
    { id: 'reminders', label: 'Tasks', icon: Bell },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav
      className={`md:hidden fixed bottom-0 left-0 right-0 z-40 ${themeConfig.glassHeader} border-t px-2 py-1 flex items-center justify-around h-16 pb-safe backdrop-blur-2xl transition-colors duration-200 select-none`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            onTouchStart={() => onPrefetchTab?.(tab.id)}
            onMouseEnter={() => onPrefetchTab?.(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 min-h-[44px] relative cursor-pointer active:scale-90 transition-all duration-150 ${
              isActive
                ? `${themeConfig.textPrimary} font-bold`
                : `${themeConfig.textSecondary} opacity-65 hover:opacity-100`
            }`}
          >
            {isActive && (
              <span
                className="absolute top-1 w-8 h-8 rounded-full blur-md opacity-25 animate-pop-in pointer-events-none"
                style={{ backgroundColor: themeConfig.accentHex }}
              />
            )}
            <div className="relative">
              <Icon
                className={`w-5 h-5 transition-transform duration-200 ${
                  isActive ? 'stroke-[2.5px] scale-110' : 'stroke-2'
                }`}
                style={isActive ? { color: themeConfig.accentHex } : undefined}
              />
              {tab.badge && tab.badge > 0 ? (
                <span className="absolute -top-1 -right-2.5 px-1.5 py-0.2 bg-rose-600 text-white text-[9px] font-bold rounded-full shadow-sm animate-pulse">
                  {tab.badge}
                </span>
              ) : null}
            </div>
            <span className={`text-[10px] mt-1 tracking-tight transition-all duration-150 ${isActive ? 'font-bold' : ''}`}>
              {tab.label}
            </span>
            {isActive && (
              <span
                className="w-1 h-1 rounded-full mt-0.5 animate-fade-smooth"
                style={{ backgroundColor: themeConfig.accentHex }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
};
