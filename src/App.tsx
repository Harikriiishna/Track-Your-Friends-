import React, { useState, useEffect, useRef, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { RealtimeProvider } from './context/RealtimeContext.tsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.tsx';
import { AuthScreen } from './components/Auth/AuthScreen.tsx';
import { Navbar } from './components/Navigation/Navbar.tsx';
import { BottomNav } from './components/Navigation/BottomNav.tsx';
import { OfflineBanner } from './components/Navigation/OfflineBanner.tsx';
import { LiveMap } from './components/Map/LiveMap.tsx';
import type { SavedPlace, Room } from './types.ts';
import { api } from './utils/api.ts';

const RoomsManager = React.lazy(() =>
  import('./components/Rooms/RoomsManager.tsx').then((m) => ({ default: m.RoomsManager }))
);
const ChatView = React.lazy(() =>
  import('./components/Chat/ChatView.tsx').then((m) => ({ default: m.ChatView }))
);
const EmergencyManager = React.lazy(() =>
  import('./components/Alerts/EmergencyManager.tsx').then((m) => ({ default: m.EmergencyManager }))
);
const SavedPlacesManager = React.lazy(() =>
  import('./components/SavedPlaces/SavedPlacesManager.tsx').then((m) => ({ default: m.SavedPlacesManager }))
);
const RemindersManager = React.lazy(() =>
  import('./components/Reminders/RemindersManager.tsx').then((m) => ({ default: m.RemindersManager }))
);
const MeetingsManager = React.lazy(() =>
  import('./components/Meetings/MeetingsManager.tsx').then((m) => ({ default: m.MeetingsManager }))
);
const ProfilePrivacyView = React.lazy(() =>
  import('./components/Profile/ProfilePrivacyView.tsx').then((m) => ({ default: m.ProfilePrivacyView }))
);
const AdminDashboard = React.lazy(() =>
  import('./components/Admin/AdminDashboard.tsx').then((m) => ({ default: m.AdminDashboard }))
);

function TabFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center p-8">
      <div className="w-7 h-7 border-3 border-sky-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function MainApp() {
  const { user, isLoading } = useAuth();
  const { themeConfig, isLiteMode } = useTheme();
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

  // Pre-fetching mechanism: triggers component DOM pre-warming (on high-end devices) and target data caching
  const prefetchTab = React.useCallback((tabId: string) => {
    if (!isLiteMode) {
      setVisitedTabs((prev) => {
        if (prev.has(tabId)) return prev;
        const next = new Set(prev);
        next.add(tabId);
        return next;
      });
    }

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
  }, [isLiteMode]);

  // Tab switcher: safely switches tab via startTransition and manages memory footprint
  const handleSelectTab = React.useCallback((tabId: string) => {
    prefetchTab(tabId);

    setVisitedTabs((prev) => {
      if (isLiteMode) {
        // In Lite Mode, only keep 'map' and the active tab mounted to minimize RAM and DOM nodes
        return new Set(['map', tabId]);
      }
      if (prev.has(tabId)) return prev;
      const next = new Set(prev);
      next.add(tabId);
      return next;
    });

    startTransition(() => {
      setCurrentTab(tabId);
    });
  }, [prefetchTab, isLiteMode]);

  // Idle pre-warming: skipped in Lite Mode to save CPU & RAM on low-end devices
  useEffect(() => {
    if (!user || isLiteMode) return;
    const idleCallback =
      (window as any).requestIdleCallback ||
      ((cb: () => void) => setTimeout(cb, 1500));

    const idleHandle = idleCallback(() => {
      prefetchTab('rooms');
      prefetchTab('chat');
    });

    return () => {
      if ((window as any).cancelIdleCallback && typeof idleHandle === 'number') {
        (window as any).cancelIdleCallback(idleHandle);
      }
    };
  }, [user, isLiteMode, prefetchTab]);

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

  const shouldRenderTab = (tabId: string) =>
    isLiteMode ? currentTab === tabId : visitedTabs.has(tabId);

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden font-sans relative ${themeConfig.appBg}`}>
      {/* Ambient background glass luminescence (omitted in Lite Mode to save GPU fill-rate) */}
      {!isLiteMode && (
        <>
          <div
            className={`fixed -top-40 -left-40 w-96 h-96 rounded-full bg-gradient-to-br ${themeConfig.ambientGlow} blur-3xl pointer-events-none z-0`}
          />
          <div
            className={`fixed -bottom-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-tl ${themeConfig.ambientGlow} blur-3xl pointer-events-none z-0`}
          />
        </>
      )}

      {/* Top Bar for Desktop */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenSos={() => handleSelectTab('alerts')}
        onPrefetchTab={prefetchTab}
      />

      {/* Floating Network Resilience / Offline Status Banner */}
      <OfflineBanner />

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative tab-pane-container">
        {/* Persistent Leaflet Map */}
        <div
          className={`tab-pane-container absolute inset-0 ${
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

        {/* Rooms Tab Pane */}
        {shouldRenderTab('rooms') && (
          <div
            className={`tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe ${
              currentTab === 'rooms'
                ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                : 'opacity-0 z-0 pointer-events-none invisible'
            }`}
          >
            <Suspense fallback={<TabFallback />}>
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
            </Suspense>
          </div>
        )}

        {/* Chat Tab Pane */}
        {shouldRenderTab('chat') && (
          <div
            className={`tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe ${
              currentTab === 'chat'
                ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                : 'opacity-0 z-0 pointer-events-none invisible'
            }`}
          >
            <Suspense fallback={<TabFallback />}>
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
            </Suspense>
          </div>
        )}

        {/* Alerts Tab Pane */}
        {shouldRenderTab('alerts') && (
          <div
            className={`tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe ${
              currentTab === 'alerts'
                ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                : 'opacity-0 z-0 pointer-events-none invisible'
            }`}
          >
            <Suspense fallback={<TabFallback />}>
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
            </Suspense>
          </div>
        )}

        {/* Saved Places Tab Pane */}
        {shouldRenderTab('saved') && (
          <div
            className={`tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe ${
              currentTab === 'saved'
                ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                : 'opacity-0 z-0 pointer-events-none invisible'
            }`}
          >
            <Suspense fallback={<TabFallback />}>
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
            </Suspense>
          </div>
        )}

        {/* Reminders Tab Pane */}
        {shouldRenderTab('reminders') && (
          <div
            className={`tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe ${
              currentTab === 'reminders'
                ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                : 'opacity-0 z-0 pointer-events-none invisible'
            }`}
          >
            <Suspense fallback={<TabFallback />}>
              <RemindersManager
                savedPlaces={savedPlaces}
                pendingReminder={pendingReminder}
                onClearPendingReminder={() => setPendingReminder(null)}
              />
            </Suspense>
          </div>
        )}

        {/* Meetings Tab Pane */}
        {shouldRenderTab('meetings') && (
          <div
            className={`tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe ${
              currentTab === 'meetings'
                ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                : 'opacity-0 z-0 pointer-events-none invisible'
            }`}
          >
            <Suspense fallback={<TabFallback />}>
              <MeetingsManager rooms={userRooms} />
            </Suspense>
          </div>
        )}

        {/* Profile Tab Pane */}
        {shouldRenderTab('profile') && (
          <div
            className={`tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe ${
              currentTab === 'profile'
                ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                : 'opacity-0 z-0 pointer-events-none invisible'
            }`}
          >
            <Suspense fallback={<TabFallback />}>
              <ProfilePrivacyView />
            </Suspense>
          </div>
        )}

        {/* Admin Dashboard Pane */}
        {shouldRenderTab('admin') && (
          <div
            className={`tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe ${
              currentTab === 'admin'
                ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                : 'opacity-0 z-0 pointer-events-none invisible'
            }`}
          >
            <Suspense fallback={<TabFallback />}>
              <AdminDashboard />
            </Suspense>
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
