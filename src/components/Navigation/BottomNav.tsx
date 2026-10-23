import React from 'react';
import { MapPin, Users, MessageSquare, Siren, Bell, User } from 'lucide-react';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';

interface BottomNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  const { activeAlerts } = useRealtime();
  const { themeConfig } = useTheme();

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
      className={`md:hidden fixed bottom-0 left-0 right-0 z-40 ${themeConfig.glassHeader} border-t px-2 py-1 flex items-center justify-around h-16 pb-safe backdrop-blur-2xl transition-colors duration-200`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 min-h-[44px] relative transition-colors ${
              isActive
                ? `${themeConfig.textPrimary} font-bold`
                : `${themeConfig.textSecondary} opacity-70 hover:opacity-100`
            }`}
          >
            <div className="relative">
              <Icon
                className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`}
                style={isActive ? { color: themeConfig.accentHex } : undefined}
              />
              {tab.badge && tab.badge > 0 ? (
                <span className="absolute -top-1 -right-2 px-1.5 py-0.2 bg-rose-600 text-white text-[9px] font-bold rounded-full shadow-sm">
                  {tab.badge}
                </span>
              ) : null}
            </div>
            <span className="text-[10px] mt-1 tracking-tight">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
