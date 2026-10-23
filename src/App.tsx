import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { RealtimeProvider, useRealtime } from './context/RealtimeContext.tsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.tsx';
import { AuthScreen } from './components/Auth/AuthScreen.tsx';
import { Navbar } from './components/Navigation/Navbar.tsx';
import { BottomNav } from './components/Navigation/BottomNav.tsx';
import { LiveMap } from './components/Map/LiveMap.tsx';
import { RoomsManager } from './components/Rooms/RoomsManager.tsx';
import { ChatView } from './components/Chat/ChatView.tsx';
import { EmergencyManager } from './components/Alerts/EmergencyManager.tsx';
import { SavedPlacesManager } from './components/SavedPlaces/SavedPlacesManager.tsx';
import { RemindersManager } from './components/Reminders/RemindersManager.tsx';
import { MeetingsManager } from './components/Meetings/MeetingsManager.tsx';
import { ProfilePrivacyView } from './components/Profile/ProfilePrivacyView.tsx';
import { AdminDashboard } from './components/Admin/AdminDashboard.tsx';
import type { SavedPlace, Room } from './types.ts';
import { api } from './utils/api.ts';

function MainApp() {
  const { user, isLoading } = useAuth();
  const { themeConfig } = useTheme();
  const [currentTab, setCurrentTab] = useState<string>('map');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedChatUser, setSelectedChatUser] = useState<{ id: string; name: string; avatar: string } | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [userRooms, setUserRooms] = useState<Room[]>([]);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Load user saved places and rooms
  useEffect(() => {
    if (!user) return;
    async function loadData() {
      try {
        const [placesRes, roomsRes] = await Promise.all([
          api.get<{ places: SavedPlace[] }>('/api/saved-places'),
          api.get<{ rooms: Room[] }>('/api/rooms'),
        ]);
        setSavedPlaces(placesRes.places);
        setUserRooms(roomsRes.rooms);
        if (roomsRes.rooms.length > 0 && !selectedRoomId) {
          setSelectedRoomId(roomsRes.rooms[0].id);
        }
      } catch (e) {
        console.error('Failed to preload user places and rooms:', e);
      }
    }
    loadData();
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
          Connecting to Beacon Mesh...
        </span>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const activeRoom = userRooms.find((r) => r.id === selectedRoomId);

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden font-sans relative ${themeConfig.appBg} transition-colors duration-300`}>
      {/* Ambient background glass luminescence */}
      <div
        className={`fixed -top-40 -left-40 w-96 h-96 rounded-full bg-gradient-to-br ${themeConfig.ambientGlow} blur-3xl pointer-events-none z-0`}
      />
      <div
        className={`fixed -bottom-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-tl ${themeConfig.ambientGlow} blur-3xl pointer-events-none z-0`}
      />

      {/* Top Bar for Desktop */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenSos={() => setCurrentTab('alerts')}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative pb-16 md:pb-0">
        {currentTab === 'map' && (
          <LiveMap
            savedPlaces={savedPlaces}
            rooms={userRooms}
            selectedRoomId={selectedRoomId}
            onSelectUserForChat={(targetUserId) => {
              setSelectedChatUser({ id: targetUserId, name: 'Peer', avatar: '' });
              setCurrentTab('chat');
            }}
            onAddPlaceAtCoords={(lat, lng) => {
              setPendingCoords({ lat, lng });
              setCurrentTab('saved');
            }}
          />
        )}

        {currentTab === 'rooms' && (
          <RoomsManager
            selectedRoomId={selectedRoomId}
            onSelectRoom={(roomId) => {
              setSelectedRoomId(roomId);
              api.get<{ rooms: Room[] }>('/api/rooms').then((res) => setUserRooms(res.rooms));
            }}
            onSelectUserForChat={(targetUserId) => {
              setSelectedChatUser({ id: targetUserId, name: 'Peer', avatar: '' });
              setCurrentTab('chat');
            }}
            onFocusMapLocation={(lat, lng) => {
              setCurrentTab('map');
            }}
          />
        )}

        {currentTab === 'chat' && (
          <div className="h-full w-full overflow-hidden">
            <ChatView
              userRooms={userRooms}
              selectedRoomId={selectedRoomId}
              onSelectRoom={(roomId) => {
                setSelectedRoomId(roomId);
                setSelectedChatUser(null);
              }}
              selectedChatUser={selectedChatUser}
              onSelectChatUser={(u) => setSelectedChatUser(u)}
              onFocusMapLocation={(lat, lng) => {
                setPendingCoords({ lat, lng });
                setCurrentTab('map');
              }}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          </div>
        )}

        {currentTab === 'alerts' && (
          <EmergencyManager
            onViewLocationOnMap={(lat, lng) => {
              setCurrentTab('map');
            }}
            onSelectUserForChat={(userId) => {
              setSelectedChatUser({ id: userId, name: 'User', avatar: '' });
              setCurrentTab('chat');
            }}
          />
        )}

        {currentTab === 'saved' && (
          <SavedPlacesManager
            pendingCoords={pendingCoords}
            onClearPendingCoords={() => setPendingCoords(null)}
            onFocusMapLocation={(lat, lng) => {
              setCurrentTab('map');
            }}
          />
        )}

        {currentTab === 'reminders' && <RemindersManager savedPlaces={savedPlaces} />}

        {currentTab === 'meetings' && <MeetingsManager rooms={userRooms} />}

        {currentTab === 'profile' && <ProfilePrivacyView />}

        {currentTab === 'admin' && <AdminDashboard />}
      </main>

      {/* Bottom Nav for Mobile viewports */}
      <BottomNav currentTab={currentTab} onSelectTab={setCurrentTab} />
    </div>
  );
}

import { ToastProvider } from './context/ToastContext.tsx';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <RealtimeProvider>
            <MainApp />
          </RealtimeProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
