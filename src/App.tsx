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
import { ToastProvider } from './context/ToastContext.tsx';

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
const SavedPlacesManager = React.lazy(() => loadSavedPlacesManager().then((m) => ({ default: m.SavedPlacesManager })));
const RemindersManager = React.lazy(() => loadRemindersManager().then((m) => ({ default: m.RemindersManager })));
const MeetingsManager = React.lazy(() => loadMeetingsManager().then((m) => ({ default: m.MeetingsManager })));
const ProfilePrivacyView = React.lazy(() => loadProfilePrivacyView().then((m) => ({ default: m.ProfilePrivacyView })));
const AdminDashboard = React.lazy(() => loadAdminDashboard().then((m) => ({ default: m.AdminDashboard })));

function TabFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center p-8 bg-[#070B16]">
      <div className="w-7 h-7 border-3 border-[#00E5FF] border-t-transparent rounded-full animate-spin" />
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
  } = useRealtime();
  const { themeConfig, isLiteMode } = useTheme();
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

  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const tabParam = sp.get('tab');
      if (tabParam) return new Set(['home', 'map', tabParam]);
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
  const [selectedChatUser, setSelectedChatUser] = useState<{ id: string; name: string; avatar: string } | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [userRooms, setUserRooms] = useState<Room[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [pendingFriendsCount, setPendingFriendsCount] = useState<number>(0);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingReminder, setPendingReminder] = useState<{ lat: number; lng: number; title?: string } | null>(null);
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
      sender: sp.get('sender') || 'Beacon Member',
      msg: sp.get('msg') || 'EMERGENCY: Immediate assistance requested!',
      exp: sp.get('exp') ? Number(sp.get('exp')) : undefined,
    };
  });

  // Listen for device pop-up notifications (especially 5km proximity emergency SOS alerts)
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

  // In-memory registry to deduplicate background data pre-fetching
  const prefetchedDataRef = useRef<Set<string>>(new Set(['home', 'map']));

  const prefetchTab = React.useCallback((tabId: string) => {
    if (!prefetchedDataRef.current.has(tabId)) {
      prefetchedDataRef.current.add(tabId);
      switch (tabId) {
        case 'friends':
          void loadFriendsView();
          break;
        case 'notifications':
          void loadNotificationsCenter();
          break;
        case 'rooms':
        case 'universal':
          void loadRoomsManager();
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
  }, []);

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
          const prevSig = prev.map((p) => `${p.id}:${p.name}:${p.latitude}:${p.longitude}`).join('|');
          const nextSig = res.places.map((p) => `${p.id}:${p.name}:${p.latitude}:${p.longitude}`).join('|');
          return prevSig === nextSig ? prev : res.places;
        });
        prefetchedDataRef.current.add('saved');
      })
      .catch(() => {});
  }, [user]);

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

      api
        .get<{ messages: ChatMessage[] }>('/api/messages')
        .then((res) => {
          if (Array.isArray(res?.messages)) {
            let readSet = new Set<string>();
            try {
              const raw = localStorage.getItem(`beacon_notif_read_${user.id}`);
              if (raw) readSet = new Set(JSON.parse(raw));
            } catch {}
            const unread = res.messages.filter(
              (m) => m.senderId !== user.id && !readSet.has(`msg-${m.id}`)
            ).length;
            setUnreadChatCount(unread);
          }
        })
        .catch(() => {});

      api
        .get<{ requests: LocationShareRequest[] }>('/api/locations/requests')
        .then((res) => {
          if (Array.isArray(res?.requests)) {
            const pending = res.requests.filter(
              (r) => r.toUserId === user.id && r.status === 'pending'
            ).length;
            setPendingFriendsCount(pending);
          }
        })
        .catch(() => {});
    };

    refreshRoomsPlacesAndBadges();
    window.addEventListener('beacon:cloud-sync-updated', refreshRoomsPlacesAndBadges);
    return () => {
      window.removeEventListener('beacon:cloud-sync-updated', refreshRoomsPlacesAndBadges);
    };
  }, [user?.id, refreshSavedPlaces, applyRoomsIfChanged]);

  useEffect(() => {
    if (!user || isLiteMode) return;
    const timer = setTimeout(() => {
      const w = window as any;
      const schedule = w.requestIdleCallback || ((cb: () => void) => setTimeout(cb, 200));
      schedule(() => {
        ['friends', 'rooms', 'chat', 'notifications', 'saved', 'alerts', 'reminders'].forEach((tab) =>
          prefetchTab(tab)
        );
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [user, isLiteMode, prefetchTab]);

  // If responder opened a temporary secure tracking URL (?sos_track=...), render the public tracking view immediately
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
      <div className="min-h-screen bg-[#070B16] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const shouldRenderTab = (tabName: string) =>
    tabName === 'map'
      ? isLiteMode
        ? currentTab === 'map'
        : visitedTabs.has('map')
      : currentTab === tabName;

  const isRoomsOrUniversalActive = currentTab === 'rooms' || currentTab === 'universal';

  // Compute members who are currently within 5 km (5000m) of the active emergency alert
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
    <div className={`flex flex-col h-screen w-screen overflow-hidden font-sans relative ${themeConfig.appBg}`}>
      {/* Ambient background glass luminescence (GPU-friendly radial gradients, zero blur filter pass) */}
      {!isLiteMode && (
        <>
          <div
            className="fixed -top-40 -left-40 w-[440px] h-[440px] rounded-full pointer-events-none z-0"
            style={{
              background: 'radial-gradient(circle, rgba(137, 87, 255, 0.16) 0%, rgba(255, 79, 163, 0.06) 45%, transparent 70%)',
            }}
          />
          <div
            className="fixed -bottom-40 -right-40 w-[440px] h-[440px] rounded-full pointer-events-none z-0"
            style={{
              background: 'radial-gradient(circle, rgba(57, 123, 255, 0.14) 0%, rgba(0, 217, 255, 0.05) 45%, transparent 70%)',
            }}
          />
        </>
      )}

      {/* Native-Style Device Pop-Up Notification Banner (Drops from top of screen on any SOS within 5km) */}
      {devicePopup && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] w-[94vw] max-w-md animate-pop-in pointer-events-auto">
          <div className="bg-[#070B16]/95 backdrop-blur-xl text-[#F5F8FF] rounded-2xl border-2 border-[#FF496C] shadow-2xl p-3.5 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#FF496C] text-white flex items-center justify-center shrink-0 shadow-md">
                {devicePopup.tag.startsWith('emergency') ? (
                  <Siren className="w-5 h-5 animate-spin" />
                ) : (
                  <Bell className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-[#FF496C]/25 text-[#FF496C] text-[9px] font-black uppercase tracking-wider">
                    5 KM PROXIMITY ALERT
                  </span>
                  <span className="text-[10px] text-[#94A3B8] font-mono">Now</span>
                </div>
                <p className="text-xs font-black text-white mt-0.5 truncate">{devicePopup.title}</p>
                <p className="text-[11px] text-[#94A3B8] line-clamp-2 mt-0.5">{devicePopup.body}</p>
                {devicePopup.data?.latitude != null && devicePopup.data?.longitude != null && (
                  <button
                    onClick={() => {
                      setPendingCoords({
                        lat: Number(devicePopup.data!.latitude),
                        lng: Number(devicePopup.data!.longitude),
                      });
                      setDevicePopup(null);
                      handleSelectTab('map');
                    }}
                    className="mt-2 px-2.5 py-1 rounded-lg bg-[#FF496C] hover:opacity-95 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <MapPin className="w-3 h-3" />
                    Locate on Map
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => setDevicePopup(null)}
              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#111D32] cursor-pointer shrink-0"
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
          setTimeout(() => window.dispatchEvent(new CustomEvent('beacon:open-sos-modal')), 60);
        }}
        onPrefetchTab={prefetchTab}
        activeRoomId={selectedRoomId}
        unreadNotificationsCount={totalUnreadNotifications}
        unreadChatCount={unreadChatCount}
        pendingFriendsCount={pendingFriendsCount}
      />

      {/* Floating Network Resilience / Offline Status Banner */}
      <OfflineBanner />

      {/* Global Incoming Emergency Alert Overlay with Interactive Location Map & Coordinates */}
      {latestAlert && latestAlert.status === 'active' && currentTab !== 'alerts' && (
        <div className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border-2 border-rose-500 shadow-2xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-600/30">
                  <Siren className="w-6 h-6 animate-spin" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider">
                      EMERGENCY SOS ALERT
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Within 5 km Radius
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 mt-0.5">
                    {latestAlert.senderName}
                  </h3>
                  <p className="text-xs font-semibold text-rose-700">"{latestAlert.message}"</p>
                </div>
              </div>
              <button
                onClick={dismissLatestAlert}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                title="Silence & close"
              >
                <VolumeX className="w-4 h-4" />
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

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block">Exact Coordinates</span>
                <span className="font-mono font-bold text-slate-900">
                  {latestAlert.latitude.toFixed(6)}, {latestAlert.longitude.toFixed(6)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">GPS Accuracy</span>
                <span className="font-bold text-slate-800">
                  {formatAccuracy(latestAlert.accuracy)}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-rose-600" />
                  Members Nearby Within 5 km ({nearbyMembersWithin5km.length})
                </span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Notified on Device
                </span>
              </div>
              {nearbyMembersWithin5km.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  Scanning for active members within 5 km of these coordinates...
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {nearbyMembersWithin5km.map((m) => (
                    <div
                      key={m.userId}
                      className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-[11px] flex items-center gap-1.5 shadow-2xs"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="font-bold text-slate-800">
                        {m.userId === user.id ? 'You' : m.fullName}
                      </span>
                      <span className="font-mono text-rose-600 font-semibold">
                        {m.distanceFromAlert < 15
                          ? 'At SOS'
                          : formatDistance(m.distanceFromAlert)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showOverlaySharePanel && (
              <EmergencySharePanel
                alert={latestAlert}
                onClose={() => setShowOverlaySharePanel(false)}
              />
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  acknowledgeEmergency(latestAlert.id);
                  dismissLatestAlert();
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
              >
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Acknowledge
              </button>
              <button
                type="button"
                onClick={() => setShowOverlaySharePanel((prev) => !prev)}
                className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-transform"
              >
                <Share2 className="w-4 h-4" />
                Share Live Location
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
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-transform"
              >
                <Navigation className="w-4 h-4 fill-current" />
                Get Directions
              </a>
              <button
                onClick={() => {
                  setPendingCoords({ lat: latestAlert.latitude, lng: latestAlert.longitude });
                  dismissLatestAlert();
                  handleSelectTab('map');
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-transform"
              >
                <MapPin className="w-4 h-4" />
                View on Live Map
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adaptive Body: Persistent Desktop Navigation Rail + Main Screen Content */}
      <div className="flex-1 flex overflow-hidden relative">
        <DesktopNavRail
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          onPrefetchTab={prefetchTab}
          unreadChatCount={unreadChatCount}
          pendingFriendsCount={pendingFriendsCount}
          unreadNotificationsCount={totalUnreadNotifications}
          activeAlertsCount={activeAlerts.length}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden relative tab-pane-container w-full h-full">
          {/* SCREEN 03: Home Dashboard */}
          {shouldRenderTab('home') && (
            <div
              className={`tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe ${
                currentTab === 'home'
                  ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                  : 'hidden opacity-0 -z-10 pointer-events-none invisible tab-pane-inactive'
              }`}
            >
              <HomeDashboard
                rooms={userRooms}
                savedPlaces={savedPlaces}
                unreadNotificationsCount={totalUnreadNotifications}
                onNavigateTab={handleSelectTab}
                onOpenRoom={(roomId) => {
                  handleSelectRoomId(roomId);
                  handleSelectTab('rooms');
                }}
                onOpenUniversalRoom={() => {
                  handleSelectRoomId('room-universal');
                  handleSelectTab('universal');
                }}
                onSelectUserForChat={(u) => {
                  setSelectedChatUser(u);
                  handleSelectTab('chat');
                }}
                onFocusMapLocation={(lat, lng) => {
                  setPendingCoords({ lat, lng });
                  handleSelectTab('map');
                }}
                onTriggerSos={() => {
                  handleSelectTab('alerts');
                  setTimeout(() => window.dispatchEvent(new CustomEvent('beacon:open-sos-modal')), 60);
                }}
              />
            </div>
          )}

          {/* SCREEN 04: Persistent Live Location Map */}
          <div
            className={`tab-pane-container absolute inset-0 w-full h-full ${
              currentTab === 'map'
                ? 'opacity-100 z-10 pointer-events-auto visible'
                : 'opacity-0 -z-10 pointer-events-none invisible tab-pane-inactive'
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

          {/* SCREEN 05: Friend Management */}
          {shouldRenderTab('friends') && (
            <div
              className={`tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe ${
                currentTab === 'friends'
                  ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                  : 'hidden opacity-0 -z-10 pointer-events-none invisible tab-pane-inactive'
              }`}
            >
              <Suspense fallback={<TabFallback />}>
                <FriendsView
                  onSelectUserForChat={(u) => {
                    setSelectedChatUser(u);
                    handleSelectTab('chat');
                  }}
                  onFocusMapLocation={(lat, lng) => {
                    setPendingCoords({ lat, lng });
                    handleSelectTab('map');
                  }}
                />
              </Suspense>
            </div>
          )}

          {/* SCREEN 07 & SCREEN 08: Room Management & Universal Room */}
          {(shouldRenderTab('rooms') || shouldRenderTab('universal')) && (
            <div
              className={`tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe ${
                isRoomsOrUniversalActive
                  ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                  : 'hidden opacity-0 -z-10 pointer-events-none invisible tab-pane-inactive'
              }`}
            >
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
                    setSelectedChatUser({ id: targetUserId, name: 'Peer', avatar: '' });
                    handleSelectTab('chat');
                  }}
                  onOpenChat={(roomId) => {
                    if (roomId) handleSelectRoomId(roomId);
                    setSelectedChatUser(null);
                    handleSelectTab('chat');
                  }}
                  onFocusMapLocation={(lat, lng) => {
                    setPendingCoords({ lat, lng });
                    handleSelectTab('map');
                  }}
                  onSetReminderAtCoords={(lat, lng, title) => {
                    setPendingReminder({ lat, lng, title });
                    handleSelectTab('reminders');
                  }}
                />
              </Suspense>
            </div>
          )}

          {/* SCREEN 06: Chat System */}
          {shouldRenderTab('chat') && (
            <div
              className={`tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe ${
                currentTab === 'chat'
                  ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                  : 'hidden opacity-0 -z-10 pointer-events-none invisible tab-pane-inactive'
              }`}
            >
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

          {/* SCREEN 09: Notifications */}
          {shouldRenderTab('notifications') && (
            <div
              className={`tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe ${
                currentTab === 'notifications'
                  ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                  : 'hidden opacity-0 -z-10 pointer-events-none invisible tab-pane-inactive'
              }`}
            >
              <Suspense fallback={<TabFallback />}>
                <NotificationsCenter
                  rooms={userRooms}
                  onNavigateTab={handleSelectTab}
                  onFocusMapLocation={(lat, lng) => {
                    setPendingCoords({ lat, lng });
                    handleSelectTab('map');
                  }}
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

          {/* Emergency SOS Alerts Tab Pane */}
          {shouldRenderTab('alerts') && (
            <div
              className={`tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe ${
                currentTab === 'alerts'
                  ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                  : 'hidden opacity-0 -z-10 pointer-events-none invisible tab-pane-inactive'
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
              className={`tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe ${
                currentTab === 'saved'
                  ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                  : 'hidden opacity-0 -z-10 pointer-events-none invisible tab-pane-inactive'
              }`}
            >
              <Suspense fallback={<TabFallback />}>
                <SavedPlacesManager
                  savedPlaces={savedPlaces}
                  onRefreshSavedPlaces={refreshSavedPlaces}
                  onFocusMapLocation={(lat, lng) => {
                    setPendingCoords({ lat, lng });
                    handleSelectTab('map');
                  }}
                  pendingCoords={pendingCoords}
                  onClearPendingCoords={() => setPendingCoords(null)}
                />
              </Suspense>
            </div>
          )}

          {/* Reminders Tab Pane */}
          {shouldRenderTab('reminders') && (
            <div
              className={`tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe ${
                currentTab === 'reminders'
                  ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                  : 'hidden opacity-0 -z-10 pointer-events-none invisible tab-pane-inactive'
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
              className={`tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe ${
                currentTab === 'meetings'
                  ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                  : 'hidden opacity-0 -z-10 pointer-events-none invisible tab-pane-inactive'
              }`}
            >
              <Suspense fallback={<TabFallback />}>
                <MeetingsManager rooms={userRooms} />
              </Suspense>
            </div>
          )}

          {/* SCREEN 10: Profile and Settings */}
          {shouldRenderTab('profile') && (
            <div
              className={`tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe ${
                currentTab === 'profile'
                  ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                  : 'hidden opacity-0 -z-10 pointer-events-none invisible tab-pane-inactive'
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
              className={`tab-pane-container absolute inset-0 w-full h-full tab-pane-mobile-safe ${
                currentTab === 'admin'
                  ? 'opacity-100 z-10 pointer-events-auto visible animate-tab-enter'
                  : 'hidden opacity-0 -z-10 pointer-events-none invisible tab-pane-inactive'
              }`}
            >
              <Suspense fallback={<TabFallback />}>
                <AdminDashboard />
              </Suspense>
            </div>
          )}
        </main>
      </div>

      {/* Fixed Adaptive Bottom Navigation Bar for Mobile Viewports (5 Primary Items) */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onPrefetchTab={prefetchTab}
        unreadChatCount={unreadChatCount}
        pendingFriendsCount={pendingFriendsCount}
      />
    </div>
  );
}

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
