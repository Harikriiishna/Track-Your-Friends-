import React, { useState, useEffect, useRef, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { RealtimeProvider, useRealtime } from './context/RealtimeContext.tsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.tsx';
import { AuthScreen } from './components/Auth/AuthScreen.tsx';
import { Navbar, DesktopNavRail } from './components/Navigation/Navbar.tsx';
import { BottomNav } from './components/Navigation/BottomNav.tsx';
import { OfflineBanner } from './components/Navigation/OfflineBanner.tsx';
import { LiveMap } from './components/Map/LiveMap.tsx';
import { HomeDashboard } from './components/Home/HomeDashboard.tsx';
import {
  EmergencyManager,
  EmergencyLocationMap,
  EmergencySharePanel,
  EmergencyResponderTrackingView,
} from './components/Alerts/EmergencyManager.tsx';
import { formatAccuracy, calculateDistanceMeters, formatDistance } from './utils/geo.ts';
import { getNativeNavigationUrl } from './utils/nearbyPlaces.ts';
import { Siren, MapPin, CheckCircle, VolumeX, Navigation, Share2, Users, Bell, X } from 'lucide-react';
import type { SavedPlace, Room, ChatMessage, LocationShareRequest } from './types.ts';
import { api } from './utils/api.ts';
import { ToastProvider, useToast } from './context/ToastContext.tsx';
import {
  loadRoomGeofences,
  evaluateRoomSavedPlaceGeofences,
} from './utils/roomGeofences.ts';

// Eagerly kick off chunk downloads & expose preloaders so tab switching is 0ms instant
const loadRoomsManager = () => import('./components/Rooms/RoomsManager.tsx');
const loadChatView = () => import('./components/Chat/ChatView.tsx');
const loadFriendsView = () => import('./components/Friends/FriendsView.tsx');
const loadNotificationsCenter = () => import('./components/Notifications/NotificationsCenter.tsx');
const loadSavedPlacesManager = () => import('./components/SavedPlaces/SavedPlacesManager.tsx');
const loadRemindersManager = () => import('./components/Reminders/RemindersManager.tsx');
const loadMeetingsManager = () => import('./components/Meetings/MeetingsManager.tsx');
const loadProfilePrivacyView = () => import('./components/Profile/ProfilePrivacyView.tsx');
const loadAdminDashboard = () => import('./components/Admin/AdminDashboard.tsx');

const RoomsManager = React.lazy(() => loadRoomsManager().then((m) => ({ default: m.RoomsManager })));
const ChatView = React.lazy(() => loadChatView().then((m) => ({ default: m.ChatView })));
const FriendsView = React.lazy(() => loadFriendsView().then((m) => ({ default: m.FriendsView })));
const NotificationsCenter = React.lazy(() =>
  loadNotificationsCenter().then((m) => ({ default: m.NotificationsCenter }))
);
const SavedPlacesManager = React.lazy(() =>
  loadSavedPlacesManager().then((m) => ({ default: m.SavedPlacesManager }))
);
const RemindersManager = React.lazy(() =>
  loadRemindersManager().then((m) => ({ default: m.RemindersManager }))
);
const MeetingsManager = React.lazy(() =>
  loadMeetingsManager().then((m) => ({ default: m.MeetingsManager }))
);
const ProfilePrivacyView = React.lazy(() =>
  loadProfilePrivacyView().then((m) => ({ default: m.ProfilePrivacyView }))
);
const AdminDashboard = React.lazy(() =>
  loadAdminDashboard().then((m) => ({ default: m.AdminDashboard }))
);

function TabFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center p-8">
      <div className="w-7 h-7 border-3 border-[#8957FF] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

interface DevicePopupNotification {
  id: string;
  title: string;
  body: string;
  tag: string;
  data?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    distanceMeters?: number | null;
  } | null;
  timestamp: number;
}

const VALID_TABS = [
  'home',
  'map',
  'friends',
  'chat',
  'rooms',
  'universal',
  'notifications',
  'saved',
  'alerts',
  'reminders',
  'meetings',
  'profile',
  'admin',
];

function MainApp() {
  const { user, isLoading } = useAuth();
  const {
    latestAlert,
    dismissLatestAlert,
    acknowledgeEmergency,
    myLocation,
    userLocations,
    activeAlerts,
    sendMessage,
  } = useRealtime();
  const { themeConfig, isLiteMode } = useTheme();
  const toast = useToast();

  const [currentTab, setCurrentTab] = useState<string>(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const tabParam = sp.get('tab');
      if (tabParam && VALID_TABS.includes(tabParam)) {
        return tabParam;
      }
    } catch {}
    return 'home';
  });

  // Track which tabs have been visited so we keep only Home & LiveMap mounted in the background
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const tabParam = sp.get('tab');
      if (tabParam && VALID_TABS.includes(tabParam)) {
        return new Set(['home', 'map', tabParam]);
      }
    } catch {}
    return new Set(['home', 'map']);
  });

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const roomParam = sp.get('room');
      if (roomParam) return roomParam;
      const savedUserRaw = localStorage.getItem('beacon_user_profile');
      const uid = savedUserRaw ? JSON.parse(savedUserRaw)?.id : null;
      if (uid) {
        return localStorage.getItem(`beacon_selected_room_${uid}`);
      }
    } catch {}
    return null;
  });

  const [selectedChatUser, setSelectedChatUser] = useState<{
    id: string;
    name: string;
    avatar: string;
  } | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [userRooms, setUserRooms] = useState<Room[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [pendingFriendsCount, setPendingFriendsCount] = useState<number>(0);
  const [pendingCoords, setPendingCoords] = useState<{
    lat: number;
    lng: number;
    ts?: number;
  } | null>(null);
  const [pendingReminder, setPendingReminder] = useState<{
    lat: number;
    lng: number;
    title?: string;
  } | null>(null);
  const [showOverlaySharePanel, setShowOverlaySharePanel] = useState<boolean>(false);
  const [devicePopup, setDevicePopup] = useState<DevicePopupNotification | null>(null);

  const handleSelectRoomId = React.useCallback(
    (roomId: string | null) => {
      setSelectedRoomId(roomId);
      if (user?.id) {
        try {
          if (roomId) {
            localStorage.setItem(`beacon_selected_room_${user.id}`, roomId);
          } else {
            localStorage.removeItem(`beacon_selected_room_${user.id}`);
          }
        } catch {}
      }
    },
    [user?.id]
  );

  // Check if user opened a temporary secure SOS live tracking link (?sos_track=...)
  const [sosTrackParams, setSosTrackParams] = useState<{
    token: string;
    alertId: string;
    lat: number;
    lng: number;
    acc: number;
    sender: string;
    msg: string;
    exp?: number;
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    const sp = new URLSearchParams(window.location.search);
    const token = sp.get('sos_track');
    if (!token) return null;
    return {
      token,
      alertId: sp.get('alertId') || '',
      lat: Number(sp.get('lat')) || 0,
      lng: Number(sp.get('lng')) || 0,
      acc: Number(sp.get('acc')) || 15,
      sender: sp.get('sender') || 'Member',
      msg: sp.get('msg') || 'Immediate assistance requested!',
      exp: sp.get('exp') ? Number(sp.get('exp')) : undefined,
    };
  });

  // Listen for device pop-up notifications
  useEffect(() => {
    const onDevicePopup = (e: Event) => {
      const custom = e as CustomEvent<DevicePopupNotification>;
      if (custom.detail) {
        setDevicePopup(custom.detail);
      }
    };
    window.addEventListener('beacon:device-popup-notification', onDevicePopup);
    return () => window.removeEventListener('beacon:device-popup-notification', onDevicePopup);
  }, []);

  useEffect(() => {
    if (!devicePopup) return;
    const timer = setTimeout(() => {
      setDevicePopup(null);
    }, 9000);
    return () => clearTimeout(timer);
  }, [devicePopup]);

  useEffect(() => {
    setShowOverlaySharePanel(false);
  }, [latestAlert?.id]);

  // Global background evaluation of Room Saved-Place Geofences so push notifications fire even when Rooms tab is closed
  const [roomGeofencesSyncTick, setRoomGeofencesSyncTick] = useState<number>(0);
  useEffect(() => {
    const onRoomGeofencesChanged = () => setRoomGeofencesSyncTick((t) => t + 1);
    window.addEventListener('beacon:room-geofences-updated', onRoomGeofencesChanged);
    return () =>
      window.removeEventListener('beacon:room-geofences-updated', onRoomGeofencesChanged);
  }, []);

  useEffect(() => {
    if (!user || userLocations.length === 0) return;
    const allGeofences = loadRoomGeofences().filter((g) => g.enabled);
    if (allGeofences.length === 0) return;

    evaluateRoomSavedPlaceGeofences({
      currentUserId: user.id,
      geofences: allGeofences,
      savedPlaces,
      userLocations,
      rooms: userRooms,
      onAlertTriggered: (ev, rule) => {
        const verb = ev.action === 'entered' ? 'entered' : 'left';
        toast.info(
          `📍 [${ev.roomName}] ${ev.memberName} ${verb} "${ev.placeName}" (${Math.round(
            ev.distanceMeters
          )}m from center · ${ev.radiusMeters}m zone)`
        );
        if (rule.postToRoomChat) {
          sendMessage({
            text: `📍 Geofence Alert: ${ev.memberName} ${verb} saved place "${ev.placeName}" (${Math.round(
              ev.distanceMeters
            )}m from center · ${ev.radiusMeters}m zone).`,
            roomId: ev.roomId,
          });
        }
      },
    });
  }, [user, userLocations, userRooms, savedPlaces, roomGeofencesSyncTick, toast, sendMessage]);

  // In-memory registry to deduplicate background data pre-fetching
  const prefetchedDataRef = useRef<Set<string>>(new Set(['home', 'map']));

  const prefetchTab = React.useCallback(
    (tabId: string) => {
      if (!prefetchedDataRef.current.has(tabId)) {
        prefetchedDataRef.current.add(tabId);
        switch (tabId) {
          case 'rooms':
          case 'universal':
            void loadRoomsManager();
            if (user && api.getToken()) {
              api
                .get<{ rooms: Room[] }>('/api/rooms')
                .then((res) => {
                  if (res?.rooms) setUserRooms(res.rooms);
                })
                .catch(() => {});
            }
            break;
          case 'friends':
            void loadFriendsView();
            break;
          case 'notifications':
            void loadNotificationsCenter();
            break;
          case 'chat':
            void loadChatView();
            break;
          case 'saved':
            void loadSavedPlacesManager();
            break;
          case 'meetings':
            void loadMeetingsManager();
            break;
          case 'reminders':
            void loadRemindersManager();
            break;
          case 'profile':
            void loadProfilePrivacyView();
            break;
          case 'admin':
            void loadAdminDashboard();
            break;
          default:
            break;
        }
      }
    },
    [user]
  );

  const handleSelectTab = React.useCallback(
    (tab: string) => {
      if (tab === 'universal') {
        handleSelectRoomId('room-universal');
      }
      setVisitedTabs((prev) => {
        if (prev.has(tab)) return prev;
        const next = new Set(prev);
        next.add(tab);
        return next;
      });
      setCurrentTab(tab);
    },
    [handleSelectRoomId]
  );

  // Memoized callbacks passed into LiveMap so React.memo prevents re-renders on tab switch
  const handleFocusMapLocation = React.useCallback(
    (lat: number, lng: number) => {
      setPendingCoords({ lat, lng, ts: Date.now() });
      handleSelectTab('map');
    },
    [handleSelectTab]
  );

  const handleMapSelectUserForChat = React.useCallback(
    (targetUserId: string) => {
      setSelectedChatUser({ id: targetUserId, name: 'Member', avatar: '' });
      handleSelectTab('chat');
    },
    [handleSelectTab]
  );

  const handleMapAddPlaceAtCoords = React.useCallback(
    (lat: number, lng: number) => {
      setPendingCoords({ lat, lng, ts: Date.now() });
      handleSelectTab('saved');
    },
    [handleSelectTab]
  );

  const handleMapSetReminderAtCoords = React.useCallback(
    (lat: number, lng: number, title?: string) => {
      setPendingReminder({ lat, lng, title });
      handleSelectTab('reminders');
    },
    [handleSelectTab]
  );

  const applyRoomsIfChanged = React.useCallback(
    (rooms: Room[]) => {
      if (!Array.isArray(rooms)) return;
      setUserRooms((prev) => {
        const prevSig = prev.map((r) => `${r.id}:${r.name}:${r.memberCount}`).join('|');
        const nextSig = rooms.map((r) => `${r.id}:${r.name}:${r.memberCount}`).join('|');
        return prevSig === nextSig ? prev : rooms;
      });
      if (rooms.length > 0) {
        setSelectedRoomId((prevSelected) => {
          const savedId = user?.id
            ? localStorage.getItem(`beacon_selected_room_${user.id}`)
            : null;
          const candidate = prevSelected || savedId;
          if (candidate && rooms.some((r) => r.id === candidate)) {
            return candidate;
          }
          const nonUniversal = rooms.find((r) => r.id !== 'room-universal');
          const chosen = nonUniversal ? nonUniversal.id : rooms[0].id;
          if (user?.id && chosen) {
            try {
              localStorage.setItem(`beacon_selected_room_${user.id}`, chosen);
            } catch {}
          }
          return chosen;
        });
      }
    },
    [user?.id]
  );

  const refreshSavedPlaces = React.useCallback(() => {
    if (!user || !api.getToken()) return;
    api
      .get<{ places: SavedPlace[] }>('/api/saved-places')
      .then((res) => {
        if (!Array.isArray(res?.places)) return;
        setSavedPlaces((prev) => {
          const prevSig = prev
            .map((p) => `${p.id}:${p.name}:${p.latitude}:${p.longitude}`)
            .join('|');
          const nextSig = res.places
            .map((p) => `${p.id}:${p.name}:${p.latitude}:${p.longitude}`)
            .join('|');
          return prevSig === nextSig ? prev : res.places;
        });
        prefetchedDataRef.current.add('saved');
      })
      .catch(() => {});
  }, [user]);

  const handleClearUnreadChatBadge = React.useCallback(() => {
    if (!user) return;
    setUnreadChatCount(0);
    const nowMs = Date.now();
    try {
      localStorage.setItem(`beacon_badges_cleared_at_${user.id}`, String(nowMs));
    } catch {}
    api
      .get<{ messages: ChatMessage[] }>('/api/messages')
      .then((res) => {
        if (!Array.isArray(res?.messages)) return;
        try {
          const readRaw = localStorage.getItem(`beacon_notif_read_${user.id}`);
          const readSet = new Set<string>(readRaw ? JSON.parse(readRaw) : []);
          const clearedRaw = localStorage.getItem(`beacon_notif_cleared_${user.id}`);
          const clearedSet = new Set<string>(clearedRaw ? JSON.parse(clearedRaw) : []);
          res.messages.forEach((m) => {
            readSet.add(`msg-${m.id}`);
            clearedSet.add(`msg-${m.id}`);
          });
          localStorage.setItem(
            `beacon_notif_read_${user.id}`,
            JSON.stringify(Array.from(readSet))
          );
          localStorage.setItem(
            `beacon_notif_cleared_${user.id}`,
            JSON.stringify(Array.from(clearedSet))
          );
        } catch {}
      })
      .catch(() => {});
  }, [user]);

  const handleClearUnreadNotifications = React.useCallback(() => {
    if (!user) return;
    setUnreadChatCount(0);
    setPendingFriendsCount(0);
    const nowMs = Date.now();
    try {
      localStorage.setItem(`beacon_badges_cleared_at_${user.id}`, String(nowMs));
    } catch {}
    handleClearUnreadChatBadge();
    toast.info('Cleared unread notifications & chat badges');
  }, [user, handleClearUnreadChatBadge, toast]);

  useEffect(() => {
    if (!user || !api.getToken()) return;

    const refreshRoomsPlacesAndBadges = () => {
      refreshSavedPlaces();
      api
        .get<{ rooms: Room[] }>('/api/rooms')
        .then((res) => {
          if (res?.rooms) {
            applyRoomsIfChanged(res.rooms);
            prefetchedDataRef.current.add('rooms');
          }
        })
        .catch(() => {});

      // Compute unread messages & friend requests for bottom nav badges
      api
        .get<{ messages: ChatMessage[] }>('/api/messages')
        .then((res) => {
          if (Array.isArray(res?.messages)) {
            let readSet = new Set<string>();
            let clearedSet = new Set<string>();
            let clearedAtMs = 0;
            try {
              const raw = localStorage.getItem(`beacon_notif_read_${user.id}`);
              if (raw) readSet = new Set(JSON.parse(raw));
              const rawCleared = localStorage.getItem(`beacon_notif_cleared_${user.id}`);
              if (rawCleared) clearedSet = new Set(JSON.parse(rawCleared));
              const rawTs = localStorage.getItem(`beacon_badges_cleared_at_${user.id}`);
              if (rawTs) clearedAtMs = Number(rawTs) || 0;
            } catch {}
            const unread = res.messages.filter((m) => {
              if (m.senderId === user.id) return false;
              const notifKey = `msg-${m.id}`;
              if (readSet.has(notifKey) || clearedSet.has(notifKey)) return false;
              if (clearedAtMs > 0 && m.createdAt) {
                const msgMs = new Date(m.createdAt).getTime();
                if (Number.isFinite(msgMs) && msgMs <= clearedAtMs) return false;
              }
              return true;
            }).length;
            setUnreadChatCount(unread);
          }
        })
        .catch(() => {});

      api
        .get<{ requests: LocationShareRequest[] }>('/api/locations/requests')
        .then((res) => {
          if (Array.isArray(res?.requests)) {
            let readSet = new Set<string>();
            let clearedSet = new Set<string>();
            let clearedAtMs = 0;
            try {
              const raw = localStorage.getItem(`beacon_notif_read_${user.id}`);
              if (raw) readSet = new Set(JSON.parse(raw));
              const rawCleared = localStorage.getItem(`beacon_notif_cleared_${user.id}`);
              if (rawCleared) clearedSet = new Set(JSON.parse(rawCleared));
              const rawTs = localStorage.getItem(`beacon_badges_cleared_at_${user.id}`);
              if (rawTs) clearedAtMs = Number(rawTs) || 0;
            } catch {}
            const pending = res.requests.filter((r) => {
              if (r.toUserId !== user.id || r.status !== 'pending') return false;
              const reqKey = `req-${r.id}-${r.status}`;
              if (readSet.has(reqKey) || clearedSet.has(reqKey)) return false;
              if (clearedAtMs > 0 && r.createdAt) {
                const reqMs = new Date(r.createdAt).getTime();
                if (Number.isFinite(reqMs) && reqMs <= clearedAtMs) return false;
              }
              return true;
            }).length;
            setPendingFriendsCount(pending);
          }
        })
        .catch(() => {});
    };

    refreshRoomsPlacesAndBadges();
    window.addEventListener('beacon:cloud-sync-updated', refreshRoomsPlacesAndBadges);
    window.addEventListener('beacon:badges-updated', refreshRoomsPlacesAndBadges);
    return () => {
      window.removeEventListener('beacon:cloud-sync-updated', refreshRoomsPlacesAndBadges);
      window.removeEventListener('beacon:badges-updated', refreshRoomsPlacesAndBadges);
    };
  }, [user?.id, refreshSavedPlaces, applyRoomsIfChanged]);

  // Warm up lazy-loaded screen chunks in idle time (skipped on low-end / Lite Mode devices to save RAM)
  useEffect(() => {
    if (!user || isLiteMode) return;
    const timer = setTimeout(() => {
      const w = window as any;
      const schedule = w.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 200));
      schedule(() => {
        ['friends', 'chat', 'rooms', 'profile'].forEach((tab) => prefetchTab(tab));
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [user, isLiteMode, prefetchTab]);

  // If user opened a secure SOS responder tracking link, render the dedicated live tracking view
  if (sosTrackParams) {
    return (
      <EmergencyResponderTrackingView
        token={sosTrackParams.token}
        initialAlertId={sosTrackParams.alertId}
        initialLat={sosTrackParams.lat}
        initialLng={sosTrackParams.lng}
        initialAcc={sosTrackParams.acc}
        initialSender={sosTrackParams.sender}
        initialMsg={sosTrackParams.msg}
        expiresAtMs={sosTrackParams.exp}
        onExitTracking={() => {
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete('sos_track');
            window.history.replaceState({}, '', url.pathname);
          } catch {}
          setSosTrackParams(null);
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B081B] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#8957FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  // Keep Home and LiveMap warm in DOM for instant 0ms switching; unmount secondary tabs when inactive so mobile RAM & CPU stay ultra-low
  const shouldRenderTab = (tabName: string) => currentTab === tabName;
  const isRoomsOrUniversalActive = currentTab === 'rooms' || currentTab === 'universal';

  const nearbyMembersWithin5km =
    latestAlert &&
    Number.isFinite(latestAlert.latitude) &&
    Number.isFinite(latestAlert.longitude) &&
    !(latestAlert.latitude === 0 && latestAlert.longitude === 0)
      ? userLocations
          .map((loc) => {
            const dist = calculateDistanceMeters(
              latestAlert.latitude,
              latestAlert.longitude,
              loc.latitude,
              loc.longitude
            );
            return { ...loc, distanceFromAlert: dist };
          })
          .filter((loc) => loc.distanceFromAlert <= 5000)
          .sort((a, b) => a.distanceFromAlert - b.distanceFromAlert)
      : [];

  const totalUnreadNotifications = unreadChatCount + pendingFriendsCount;

  return (
    <div
      className={`flex flex-col h-screen w-screen overflow-hidden font-sans relative transition-colors duration-300 ${themeConfig.appBg}`}
    >
      {/* Ambient Background Glow */}
      <div
        className={`pointer-events-none fixed inset-0 bg-gradient-to-br ${themeConfig.ambientGlow} z-0`}
      />

      {/* Native-Style Device Pop-Up Notification Banner */}
      {devicePopup && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] w-[94vw] max-w-md animate-pop-in pointer-events-auto">
          <div className="bg-[#130F2B]/98 backdrop-blur-xl text-white rounded-3xl border-2 border-[#FF4FA3] shadow-[0_20px_50px_rgba(255,79,163,0.45)] p-3.5 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FF4FA3] to-[#8957FF] flex items-center justify-center shrink-0 shadow-lg">
                {devicePopup.tag.startsWith('emergency') ? (
                  <Siren className="w-5 h-5 text-white animate-bounce" />
                ) : (
                  <Bell className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-[#FF4FA3]/30 text-[#FF4FA3] text-[9px] font-black uppercase tracking-wider">
                    BEACON ALERT
                  </span>
                  <span className="text-[10px] text-slate-400">Now</span>
                </div>
                <p className="text-xs font-extrabold text-white mt-0.5 truncate">
                  {devicePopup.title}
                </p>
                <p className="text-[11px] text-slate-200 line-clamp-2 mt-0.5">{devicePopup.body}</p>
                {devicePopup.data?.latitude != null && devicePopup.data?.longitude != null && (
                  <button
                    onClick={() => {
                      const lat = Number(devicePopup.data!.latitude);
                      const lng = Number(devicePopup.data!.longitude);
                      setDevicePopup(null);
                      handleFocusMapLocation(lat, lng);
                    }}
                    className="mt-2 px-2.5 py-1 rounded-xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 text-[10px] font-black inline-flex items-center gap-1 cursor-pointer"
                  >
                    <MapPin className="w-3 h-3" />
                    Locate on Map
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => setDevicePopup(null)}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenSos={() => {
          handleSelectTab('alerts');
        }}
        onPrefetchTab={prefetchTab}
        activeRoomId={selectedRoomId}
        unreadNotificationsCount={totalUnreadNotifications}
        unreadChatCount={unreadChatCount}
        pendingFriendsCount={pendingFriendsCount}
        onClearNotifications={handleClearUnreadNotifications}
        onClearChatBadge={handleClearUnreadChatBadge}
      />

      {/* Floating Network Resilience / Offline Status Banner */}
      <OfflineBanner />

      {/* Incoming Emergency SOS Full-Screen Overlay */}
      {latestAlert && latestAlert.status === 'active' && currentTab !== 'alerts' && (
        <div className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-gradient-to-br from-rose-700 via-rose-600 to-red-700 text-white rounded-3xl border-2 border-rose-300 shadow-[0_0_80px_rgba(225,29,72,0.85)] max-w-xl w-full p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white text-rose-600 flex items-center justify-center shrink-0 shadow-lg">
                  <Siren className="w-7 h-7 animate-bounce" />
                </div>
                <div>
                  <span className="px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-200 text-[10px] font-black uppercase tracking-widest">
                    LIVE EMERGENCY SOS
                  </span>
                  <h3 className="text-lg font-black leading-tight mt-0.5">
                    {latestAlert.senderName} needs help!
                  </h3>
                  <p className="text-xs text-rose-100 font-medium">"{latestAlert.message}"</p>
                </div>
              </div>
              <button
                onClick={dismissLatestAlert}
                className="p-2 rounded-xl bg-rose-800/80 hover:bg-rose-900 text-rose-100 cursor-pointer"
                title="Silence Siren & Close Popup"
              >
                <VolumeX className="w-5 h-5" />
              </button>
            </div>

            <EmergencyLocationMap
              latitude={latestAlert.latitude}
              longitude={latestAlert.longitude}
              accuracy={latestAlert.accuracy}
              senderName={latestAlert.senderName}
              message={latestAlert.message}
              timestamp={latestAlert.timestamp}
              viewerLocation={myLocation}
              onOpenFullMap={(lat, lng) => {
                setPendingCoords({ lat, lng });
                dismissLatestAlert();
                handleSelectTab('map');
              }}
              heightClass="h-56"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-rose-950/60 p-3 rounded-2xl border border-rose-400/30">
              <div>
                <span className="text-rose-200 block font-medium">Latitude, Longitude</span>
                <span className="font-mono font-bold text-white">
                  {latestAlert.latitude.toFixed(6)}, {latestAlert.longitude.toFixed(6)}
                </span>
              </div>
              <div>
                <span className="text-rose-200 block font-medium">GPS Accuracy</span>
                <span className="font-bold text-white">
                  {formatAccuracy(latestAlert.accuracy)}
                </span>
              </div>
              {myLocation && (
                <div>
                  <span className="text-rose-200 block font-medium">Distance from You</span>
                  <span className="font-extrabold text-amber-300">
                    {formatDistance(
                      calculateDistanceMeters(
                        myLocation.latitude,
                        myLocation.longitude,
                        latestAlert.latitude,
                        latestAlert.longitude
                      )
                    )}
                  </span>
                </div>
              )}
            </div>

            {nearbyMembersWithin5km.length > 0 && (
              <div className="bg-rose-950/75 border border-rose-400/40 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Nearby Responders Within 5 km ({nearbyMembersWithin5km.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {nearbyMembersWithin5km.map((m) => (
                    <div
                      key={m.userId}
                      className="px-2.5 py-1 rounded-xl bg-rose-900/80 border border-rose-400/30 flex items-center gap-1.5 text-xs"
                    >
                      <img
                        src={m.avatarUrl}
                        alt={m.fullName}
                        className="w-4 h-4 rounded-full object-cover"
                      />
                      <span className="font-bold text-white">{m.fullName}</span>
                      <span className="font-mono text-[10px] text-amber-300 font-bold">
                        {formatDistance(m.distanceFromAlert)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showOverlaySharePanel && (
              <EmergencySharePanel
                alert={latestAlert}
                onClose={() => setShowOverlaySharePanel(false)}
              />
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setShowOverlaySharePanel((v) => !v)}
                className="px-3 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                Share Live Link
              </button>
              <button
                onClick={() => {
                  acknowledgeEmergency(latestAlert.id);
                  dismissLatestAlert();
                }}
                className="px-3.5 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-950 text-white text-xs font-bold flex items-center gap-1.5 border border-rose-300/30 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                I'm Responding
              </button>
              <a
                href={getNativeNavigationUrl(
                  latestAlert.latitude,
                  latestAlert.longitude,
                  myLocation?.latitude,
                  myLocation?.longitude
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <Navigation className="w-4 h-4" />
                Navigate Now
              </a>
              <button
                onClick={() => {
                  const lat = latestAlert.latitude;
                  const lng = latestAlert.longitude;
                  dismissLatestAlert();
                  handleFocusMapLocation(lat, lng);
                }}
                className="px-4 py-2.5 rounded-xl bg-white text-rose-700 hover:bg-rose-50 text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <MapPin className="w-4 h-4" />
                View on Live Map
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adaptive Body: Persistent Desktop Navigation Rail + Main Screen Content */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        <DesktopNavRail
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          onPrefetchTab={prefetchTab}
          unreadChatCount={unreadChatCount}
          pendingFriendsCount={pendingFriendsCount}
          unreadNotificationsCount={totalUnreadNotifications}
          activeAlertsCount={activeAlerts.length}
          onClearChatBadge={handleClearUnreadChatBadge}
          onClearNotifications={handleClearUnreadNotifications}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden relative tab-pane-container w-full h-full">
          {/* TAB 1: HOME DASHBOARD */}
          {visitedTabs.has('home') && (
            <div
              className={`tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe ${
                currentTab === 'home'
                  ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                  : 'opacity-0 z-0 pointer-events-none invisible tab-pane-inactive'
              }`}
            >
              <HomeDashboard
                rooms={userRooms}
                savedPlaces={savedPlaces}
                selectedRoomId={selectedRoomId}
                unreadNotificationsCount={totalUnreadNotifications}
                onNavigateTab={handleSelectTab}
                onSelectRoom={(roomId) => {
                  handleSelectRoomId(roomId);
                }}
                onOpenRoom={(roomId) => {
                  handleSelectRoomId(roomId);
                  handleSelectTab('rooms');
                }}
                onOpenUniversalRoom={() => {
                  handleSelectRoomId('room-universal');
                  handleSelectTab('rooms');
                }}
                onFocusMapLocation={handleFocusMapLocation}
                onSelectUserForChat={(u) => {
                  setSelectedChatUser(u);
                  handleSelectTab('chat');
                }}
                onTriggerSos={() => handleSelectTab('alerts')}
              />
            </div>
          )}

          {/* TAB 2: FULL-SCREEN LIVE MAP */}
          <div
            className={`tab-pane-container absolute inset-0 w-full h-full ${
              currentTab === 'map'
                ? 'opacity-100 z-10 pointer-events-auto'
                : 'opacity-0 z-0 pointer-events-none tab-pane-inactive'
            }`}
          >
            <LiveMap
              isActive={currentTab === 'map'}
              focusCoords={pendingCoords}
              savedPlaces={savedPlaces}
              onRefreshSavedPlaces={refreshSavedPlaces}
              rooms={userRooms}
              selectedRoomId={selectedRoomId}
              onSelectUserForChat={handleMapSelectUserForChat}
              onAddPlaceAtCoords={handleMapAddPlaceAtCoords}
              onSetReminderAtCoords={handleMapSetReminderAtCoords}
            />
          </div>

          {/* TAB 3: FRIENDS & CONNECTIONS */}
          {shouldRenderTab('friends') && (
            <div className="tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe opacity-100 z-10 pointer-events-auto visible animate-tab-enter">
              <Suspense fallback={<TabFallback />}>
                <FriendsView
                  onSelectUserForChat={(u) => {
                    setSelectedChatUser(u);
                    handleSelectTab('chat');
                  }}
                  onFocusMapLocation={handleFocusMapLocation}
                />
              </Suspense>
            </div>
          )}

          {/* TAB 4: ROOMS & UNIVERSAL LOUNGE */}
          {(shouldRenderTab('rooms') || shouldRenderTab('universal')) && (
            <div className="tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe opacity-100 z-10 pointer-events-auto visible animate-tab-enter">
              <Suspense fallback={<TabFallback />}>
                <RoomsManager
                  isActive={isRoomsOrUniversalActive}
                  selectedRoomId={
                    currentTab === 'universal' ? 'room-universal' : selectedRoomId
                  }
                  savedPlaces={savedPlaces}
                  onRefreshSavedPlaces={refreshSavedPlaces}
                  onSelectRoom={(roomId) => {
                    handleSelectRoomId(roomId);
                    api.get<{ rooms: Room[] }>('/api/rooms').then((res) => {
                      if (res?.rooms) applyRoomsIfChanged(res.rooms);
                    });
                  }}
                  onSelectUserForChat={(targetUserId) => {
                    setSelectedChatUser({ id: targetUserId, name: 'Member', avatar: '' });
                    handleSelectTab('chat');
                  }}
                  onOpenChat={(roomId) => {
                    if (roomId) handleSelectRoomId(roomId);
                    setSelectedChatUser(null);
                    handleSelectTab('chat');
                  }}
                  onFocusMapLocation={handleFocusMapLocation}
                  onAddPlaceAtCoords={handleMapAddPlaceAtCoords}
                  onSetReminderAtCoords={(lat, lng, title) => {
                    setPendingReminder({ lat, lng, title });
                    handleSelectTab('reminders');
                  }}
                />
              </Suspense>
            </div>
          )}

          {/* TAB 5: REAL-TIME CHATS */}
          {shouldRenderTab('chat') && (
            <div className="tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe opacity-100 z-10 pointer-events-auto visible animate-tab-enter">
              <Suspense fallback={<TabFallback />}>
                <ChatView
                  userRooms={userRooms}
                  selectedRoomId={selectedRoomId}
                  selectedChatUser={selectedChatUser}
                  onSelectRoom={(id) => {
                    handleSelectRoomId(id);
                    setSelectedChatUser(null);
                  }}
                  onSelectChatUser={(u) => setSelectedChatUser(u)}
                  onFocusMapLocation={handleFocusMapLocation}
                  onAddPlaceAtCoords={handleMapAddPlaceAtCoords}
                  onSetReminderAtCoords={(lat, lng, title) => {
                    setPendingReminder({ lat, lng, title });
                    handleSelectTab('reminders');
                  }}
                  onNavigateTab={(tab) => handleSelectTab(tab)}
                  unreadChatCount={unreadChatCount}
                  onClearChatBadge={handleClearUnreadChatBadge}
                />
              </Suspense>
            </div>
          )}

          {/* TAB 6: NOTIFICATIONS CENTER */}
          {shouldRenderTab('notifications') && (
            <div className="tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe opacity-100 z-10 pointer-events-auto visible animate-tab-enter">
              <Suspense fallback={<TabFallback />}>
                <NotificationsCenter
                  rooms={userRooms}
                  onNavigateTab={handleSelectTab}
                  onFocusMapLocation={handleFocusMapLocation}
                  onSelectUserForChat={(u) => {
                    setSelectedChatUser(u);
                    handleSelectTab('chat');
                  }}
                  onOpenRoom={(roomId) => {
                    handleSelectRoomId(roomId);
                    handleSelectTab('rooms');
                  }}
                />
              </Suspense>
            </div>
          )}

          {/* TAB 7: EMERGENCY SOS CENTER */}
          {shouldRenderTab('alerts') && (
            <div className="tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe opacity-100 z-10 pointer-events-auto visible animate-tab-enter">
              <Suspense fallback={<TabFallback />}>
                <EmergencyManager
                  rooms={userRooms}
                  activeRoomId={selectedRoomId}
                  onViewLocationOnMap={handleFocusMapLocation}
                  onSelectUserForChat={(userId) => {
                    setSelectedChatUser({ id: userId, name: 'Member', avatar: '' });
                    handleSelectTab('chat');
                  }}
                  onNavigateToRooms={() => handleSelectTab('rooms')}
                />
              </Suspense>
            </div>
          )}

          {/* TAB 8: SAVED PLACES */}
          {shouldRenderTab('saved') && (
            <div className="tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe opacity-100 z-10 pointer-events-auto visible animate-tab-enter">
              <Suspense fallback={<TabFallback />}>
                <SavedPlacesManager
                  savedPlaces={savedPlaces}
                  onRefreshSavedPlaces={refreshSavedPlaces}
                  onFocusMapLocation={handleFocusMapLocation}
                  pendingCoords={pendingCoords}
                  onClearPendingCoords={() => setPendingCoords(null)}
                />
              </Suspense>
            </div>
          )}

          {/* TAB 9: REMINDERS */}
          {shouldRenderTab('reminders') && (
            <div className="tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe opacity-100 z-10 pointer-events-auto visible animate-tab-enter">
              <Suspense fallback={<TabFallback />}>
                <RemindersManager
                  savedPlaces={savedPlaces}
                  pendingReminder={pendingReminder}
                  onClearPendingReminder={() => setPendingReminder(null)}
                />
              </Suspense>
            </div>
          )}

          {/* TAB 10: MEETINGS */}
          {shouldRenderTab('meetings') && (
            <div className="tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe opacity-100 z-10 pointer-events-auto visible animate-tab-enter">
              <Suspense fallback={<TabFallback />}>
                <MeetingsManager rooms={userRooms} />
              </Suspense>
            </div>
          )}

          {/* TAB 11: PROFILE & PRIVACY */}
          {shouldRenderTab('profile') && (
            <div className="tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe opacity-100 z-10 pointer-events-auto visible animate-tab-enter">
              <Suspense fallback={<TabFallback />}>
                <ProfilePrivacyView />
              </Suspense>
            </div>
          )}

          {/* TAB 12: ADMIN DASHBOARD */}
          {shouldRenderTab('admin') && user.isAdmin && (
            <div className="tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe opacity-100 z-10 pointer-events-auto visible animate-tab-enter">
              <Suspense fallback={<TabFallback />}>
                <AdminDashboard />
              </Suspense>
            </div>
          )}
        </main>
      </div>

      {/* Floating Mobile Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onPrefetchTab={prefetchTab}
        unreadChatCount={unreadChatCount}
        pendingFriendsCount={pendingFriendsCount}
        onClearChatBadge={handleClearUnreadChatBadge}
        onClearNotifications={handleClearUnreadNotifications}
      />
    </div>
  );
}

export function App() {
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

export default App;
