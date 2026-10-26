import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { RealtimeProvider, useRealtime } from './context/RealtimeContext.tsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.tsx';
import { AuthScreen } from './components/Auth/AuthScreen.tsx';
import { Navbar } from './components/Navigation/Navbar.tsx';
import { BottomNav } from './components/Navigation/BottomNav.tsx';
import { OfflineBanner } from './components/Navigation/OfflineBanner.tsx';
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
  const [, startTransition] = React.useTransition();
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set(['map']));

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedChatUser, setSelectedChatUser] = useState<{ id: string; name: string; avatar: string } | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [userRooms, setUserRooms] = useState<Room[]>([]);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingReminder, setPendingReminder] = useState<{ lat: number; lng: number; title?: string } | null>(null);

  // In-memory registry to deduplicate background data pre-fetching
  const prefetchedDataRef = useRef<Set<string>>(new Set(['map']));

  // Pre-fetching mechanism: triggers component DOM pre-warming and target data caching
  const prefetchTab = React.useCallback((tabId: string) => {
    // 1. Immediately warm up the component in the DOM (hidden layer) so GPU allocates its composition texture
    setVisitedTabs((prev) => {
      if (prev.has(tabId)) return prev;
      const next = new Set(prev);
      next.add(tabId);
      return next;
    });

    // 2. Pre-fetch target tab data asynchronously in the background if not already cached
    if (!prefetchedDataRef.current.has(tabId)) {
      prefetchedDataRef.current.add(tabId);
      switch (tabId) {
        case 'rooms':
          api.get<{ rooms: Room[] }>('/api/rooms').then((res) => {
            setUserRooms(res.rooms);
          }).catch(() => {});
          break;
        case 'saved':
          api.get<{ places: SavedPlace[] }>('/api/saved-places').then((res) => {
            setSavedPlaces(res.places);
          }).catch(() => {});
          break;
        case 'alerts':
          api.get('/api/alerts/emergency').catch(() => {});
          break;
        case 'meetings':
          api.get('/api/meetings').catch(() => {});
          break;
        case 'reminders':
          api.get('/api/reminders').catch(() => {});
          break;
        default:
          break;
      }
    }
  }, []);

  // Tab switcher: pre-warms target component and safely switches tab via startTransition
  const handleSelectTab = React.useCallback((tabId: string) => {
    // 1. Ensure target component and data are pre-fetched
    prefetchTab(tabId);

    // 2. Mark tab as visited (pure state updater without side effects)
    setVisitedTabs((prev) => {
      if (prev.has(tabId)) return prev;
      const next = new Set(prev);
      next.add(tabId);
      return next;
    });

    // 3. Switch active tab safely in transition outside render phase
    startTransition(() => {
      setCurrentTab(tabId);
    });
  }, [prefetchTab]);

  // Idle pre-warming: pre-warm critical communication hubs during browser idle periods
  useEffect(() => {
    if (!user) return;
    const idleCallback =
      (window as any).requestIdleCallback ||
      ((cb: () => void) => setTimeout(cb, 1200));

    const idleHandle = idleCallback(() => {
      prefetchTab('rooms');
      prefetchTab('chat');
    });

    return () => {
      if ((window as any).cancelIdleCallback && typeof idleHandle === 'number') {
        (window as any).cancelIdleCallback(idleHandle);
      }
    };
  }, [user, prefetchTab]);

  const refreshSavedPlaces = React.useCallback(async () => {
    if (!user || !api.getToken()) return;
    try {
      const res = await api.get<{ places: SavedPlace[] }>('/api/saved-places');
      setSavedPlaces(res.places || []);
    } catch (e) {
      console.warn('Could not refresh saved places:', e);
    }
  }, [user]);

  // Load user saved places and rooms
  useEffect(() => {
    if (!user || !api.getToken()) return;
    async function loadData() {
      try {
        const [placesRes, roomsRes] = await Promise.all([
          api.get<{ places: SavedPlace[] }>('/api/saved-places'),
          api.get<{ rooms: Room[] }>('/api/rooms'),
        ]);
        setSavedPlaces(placesRes.places || []);
        setUserRooms(roomsRes.rooms || []);
        if (roomsRes.rooms && roomsRes.rooms.length > 0 && !selectedRoomId) {
          setSelectedRoomId(roomsRes.rooms[0].id);
        }
      } catch (e) {
        console.warn('Could not preload user places and rooms:', e);
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
        onSelectTab={handleSelectTab}
        onOpenSos={() => handleSelectTab('alerts')}
        onPrefetchTab={prefetchTab}
      />

      {/* Floating Network Resilience / Offline Status Banner */}
      <OfflineBanner />

      {/* Main Content Area: Hardware-accelerated compositor layer */}
      <main className="flex-1 overflow-hidden relative tab-pane-container">
        {/* Persistent Leaflet Map: Kept mounted with isolated GPU layer for zero-latency 60fps instant switching */}
        <div
          className={`tab-pane-container absolute inset-0 transition-opacity duration-200 transform-gpu-smooth ${
            currentTab === 'map' ? 'opacity-100 z-10 pointer-events-auto visible' : 'opacity-0 z-0 pointer-events-none invisible'
          }`}
        >
          <LiveMap
            isActive={currentTab === 'map'}
            focusCoords={pendingCoords}
            savedPlaces={savedPlaces}
            onRefreshSavedPlaces={refreshSavedPlaces}
            rooms={userRooms}
            selectedRoomId={selectedRoomId}
            onSelectUserForChat={(targetUserId) => {
              setSelectedChatUser({ id: targetUserId, name: 'Peer', avatar: '' });
              handleSelectTab('chat');
            }}
            onAddPlaceAtCoords={(lat, lng) => {
              setPendingCoords({ lat, lng });
              handleSelectTab('saved');
            }}
            onSetReminderAtCoords={(lat, lng, title) => {
              setPendingReminder({ lat, lng, title });
              handleSelectTab('reminders');
            }}
          />
        </div>

        {/* Rooms Tab Pane: Lazily mounted, cached in GPU compositor layer */}
        {visitedTabs.has('rooms') && (
          <div
            className={`tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe transition-opacity duration-180 transform-gpu-smooth ${
              currentTab === 'rooms'
                ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                : 'opacity-0 z-0 pointer-events-none invisible'
            }`}
          >
            <RoomsManager
              isActive={currentTab === 'rooms'}
              selectedRoomId={selectedRoomId}
              savedPlaces={savedPlaces}
              onRefreshSavedPlaces={refreshSavedPlaces}
              onSelectRoom={(roomId) => {
                setSelectedRoomId(roomId);
                api.get<{ rooms: Room[] }>('/api/rooms').then((res) => setUserRooms(res.rooms));
              }}
              onSelectUserForChat={(targetUserId) => {
                setSelectedChatUser({ id: targetUserId, name: 'Peer', avatar: '' });
                handleSelectTab('chat');
              }}
              onOpenChat={(roomId) => {
                if (roomId) setSelectedRoomId(roomId);
                setSelectedChatUser(null);
                handleSelectTab('chat');
              }}
              onFocusMapLocation={(lat, lng) => {
                setPendingCoords({ lat, lng });
                handleSelectTab('map');
              }}
              onAddPlaceAtCoords={(lat, lng) => {
                setPendingCoords({ lat, lng });
                handleSelectTab('saved');
              }}
              onSetReminderAtCoords={(lat, lng, title) => {
                setPendingReminder({ lat, lng, title });
                handleSelectTab('reminders');
              }}
            />
          </div>
        )}

        {/* Chat Tab Pane: Lazily mounted, state/scroll preserved, zero re-render lag */}
        {visitedTabs.has('chat') && (
          <div
            className={`tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe transition-opacity duration-180 transform-gpu-smooth ${
              currentTab === 'chat'
                ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                : 'opacity-0 z-0 pointer-events-none invisible'
            }`}
          >
            <ChatView
              userRooms={userRooms}
              selectedRoomId={selectedRoomId}
              savedPlaces={savedPlaces}
              onRefreshSavedPlaces={refreshSavedPlaces}
              onSelectRoom={(roomId) => {
                setSelectedRoomId(roomId);
                setSelectedChatUser(null);
              }}
              selectedChatUser={selectedChatUser}
              onSelectChatUser={(u) => setSelectedChatUser(u)}
              onFocusMapLocation={(lat, lng) => {
                setPendingCoords({ lat, lng });
                handleSelectTab('map');
              }}
              onAddPlaceAtCoords={(lat, lng) => {
                setPendingCoords({ lat, lng });
                handleSelectTab('saved');
              }}
              onSetReminderAtCoords={(lat, lng, title) => {
                setPendingReminder({ lat, lng, title });
                handleSelectTab('reminders');
              }}
              onNavigateTab={(tab) => handleSelectTab(tab)}
            />
          </div>
        )}

        {/* Alerts Tab Pane */}
        {visitedTabs.has('alerts') && (
          <div
            className={`tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe transition-opacity duration-180 transform-gpu-smooth ${
              currentTab === 'alerts'
                ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                : 'opacity-0 z-0 pointer-events-none invisible'
            }`}
          >
            <EmergencyManager
              onViewLocationOnMap={(lat, lng) => {
                setPendingCoords({ lat, lng });
                handleSelectTab('map');
              }}
              onSelectUserForChat={(userId) => {
                setSelectedChatUser({ id: userId, name: 'User', avatar: '' });
                handleSelectTab('chat');
              }}
            />
          </div>
        )}

        {/* Saved Places Tab Pane */}
        {visitedTabs.has('saved') && (
          <div
            className={`tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe transition-opacity duration-180 transform-gpu-smooth ${
              currentTab === 'saved'
                ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                : 'opacity-0 z-0 pointer-events-none invisible'
            }`}
          >
            <SavedPlacesManager
              savedPlaces={savedPlaces}
              onRefreshSavedPlaces={refreshSavedPlaces}
              pendingCoords={pendingCoords}
              onClearPendingCoords={() => setPendingCoords(null)}
              onFocusMapLocation={(lat, lng) => {
                setPendingCoords({ lat, lng });
                handleSelectTab('map');
              }}
            />
          </div>
        )}

        {/* Reminders Tab Pane */}
        {visitedTabs.has('reminders') && (
          <div
            className={`tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe transition-opacity duration-180 transform-gpu-smooth ${
              currentTab === 'reminders'
                ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                : 'opacity-0 z-0 pointer-events-none invisible'
            }`}
          >
            <RemindersManager
              savedPlaces={savedPlaces}
              pendingReminder={pendingReminder}
              onClearPendingReminder={() => setPendingReminder(null)}
            />
          </div>
        )}

        {/* Meetings Tab Pane */}
        {visitedTabs.has('meetings') && (
          <div
            className={`tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe transition-opacity duration-180 transform-gpu-smooth ${
              currentTab === 'meetings'
                ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                : 'opacity-0 z-0 pointer-events-none invisible'
            }`}
          >
            <MeetingsManager rooms={userRooms} />
          </div>
        )}

        {/* Profile Tab Pane */}
        {visitedTabs.has('profile') && (
          <div
            className={`tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe transition-opacity duration-180 transform-gpu-smooth ${
              currentTab === 'profile'
                ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                : 'opacity-0 z-0 pointer-events-none invisible'
            }`}
          >
            <ProfilePrivacyView />
          </div>
        )}

        {/* Admin Dashboard Pane */}
        {visitedTabs.has('admin') && (
          <div
            className={`tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe transition-opacity duration-180 transform-gpu-smooth ${
              currentTab === 'admin'
                ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                : 'opacity-0 z-0 pointer-events-none invisible'
            }`}
          >
            <AdminDashboard />
          </div>
        )}
      </main>

      {/* Bottom Nav for Mobile viewports */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onPrefetchTab={prefetchTab}
      />
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
