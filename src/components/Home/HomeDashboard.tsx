import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { api } from '../../utils/api.ts';
import { calculateDistanceMeters, formatDistance, formatTimeAgo } from '../../utils/geo.ts';
import { useToast } from '../../context/ToastContext.tsx';
import type { Room, SavedPlace, LocationShareRequest, ChatMessage } from '../../types.ts';
import {
  Map as MapIcon,
  Users,
  MessageSquare,
  Shield,
  Siren,
  MapPin,
  Radio,
  Sparkles,
  UserPlus,
  Plus,
  Compass,
  Bell,
  Copy,
  Check,
  Navigation,
  Eye,
  EyeOff,
  Clock,
  ChevronRight,
  Lock,
  Globe,
  Activity,
  Heart,
  Zap,
} from 'lucide-react';

interface HomeDashboardProps {
  rooms: Room[];
  savedPlaces: SavedPlace[];
  selectedRoomId?: string | null;
  unreadNotificationsCount?: number;
  onSelectRoom?: (roomId: string) => void;
  onOpenRoom?: (roomId: string) => void;
  onOpenUniversalRoom?: () => void;
  onNavigateTab: (tab: any) => void;
  onFocusMapLocation: (lat: number, lng: number) => void;
  onSelectUserForChat: (user: { id: string; name: string; avatar: string }) => void;
  onTriggerEmergency?: () => void;
  onTriggerSos?: () => void;
}

const ROOM_GRADIENTS = [
  'from-[#8957FF] via-[#6B66FF] to-[#397BFF]',
  'from-[#FF4FA3] via-[#FF6884] to-[#FF8066]',
  'from-[#00D6A0] via-[#00D8D0] to-[#00D9FF]',
  'from-[#397BFF] via-[#1CA9FF] to-[#00D9FF]',
  'from-[#8957FF] via-[#C453D1] to-[#FF4FA3]',
];

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  rooms,
  savedPlaces,
  selectedRoomId = null,
  onSelectRoom: onSelectRoomProp,
  onOpenRoom,
  onNavigateTab,
  onFocusMapLocation,
  onSelectUserForChat,
  onTriggerEmergency: onTriggerEmergencyProp,
  onTriggerSos,
}) => {
  const onSelectRoom = onOpenRoom ?? onSelectRoomProp ?? (() => {});
  const onTriggerEmergency = onTriggerSos ?? onTriggerEmergencyProp ?? (() => {});
  const { user, updatePrivacy } = useAuth();
  const {
    myLocation,
    userLocations,
    onlineUserIds,
    chatMessages,
    activeAlerts,
    isConnected,
    locationStatus,
    requestLocationUpdate,
  } = useRealtime();
  const { themeConfig } = useTheme();
  const isDark = themeConfig.isDark;
  const toast = useToast();

  const [shareRequests, setShareRequests] = useState<LocationShareRequest[]>([]);
  const [recentBackendMessages, setRecentBackendMessages] = useState<ChatMessage[]>([]);
  const [copiedId, setCopiedId] = useState(false);
  const [isUpdatingSharing, setIsUpdatingSharing] = useState(false);

  const isSharingLocation = user?.privacy?.locationSharingEnabled !== false;

  useEffect(() => {
    if (!user || !api.getToken()) return;
    let active = true;

    const fetchDashboardData = async () => {
      try {
        const [reqRes, msgRes] = await Promise.all([
          api
            .get<{ requests: LocationShareRequest[] }>('/api/locations/requests')
            .catch(() => ({ requests: [] })),
          api.get<{ messages: ChatMessage[] }>('/api/messages').catch(() => ({ messages: [] })),
        ]);
        if (!active) return;
        if (Array.isArray(reqRes.requests)) setShareRequests(reqRes.requests);
        if (Array.isArray(msgRes.messages)) setRecentBackendMessages(msgRes.messages);
      } catch {
        // non-fatal
      }
    };

    void fetchDashboardData();
    const onCloudSync = () => void fetchDashboardData();
    window.addEventListener('beacon:cloud-sync-updated', onCloudSync);
    return () => {
      active = false;
      window.removeEventListener('beacon:cloud-sync-updated', onCloudSync);
    };
  }, [user?.id]);

  // Peer locations excluding self
  const peerLocations = useMemo(() => {
    return userLocations.filter((loc) => loc.userId !== user?.id);
  }, [userLocations, user?.id]);

  // Combine online friends + accepted share requests for the Horizontal Friends Story Bar
  const socialFriendsStoryList = useMemo(() => {
    const map = new Map<
      string,
      {
        userId: string;
        fullName: string;
        username: string;
        avatarUrl: string;
        isOnline: boolean;
        isSharingGps: boolean;
        latitude?: number;
        longitude?: number;
        distanceText?: string;
        updatedAt?: string;
      }
    >();

    peerLocations.forEach((loc) => {
      const dist =
        myLocation != null
          ? formatDistance(
              calculateDistanceMeters(
                myLocation.latitude,
                myLocation.longitude,
                loc.latitude,
                loc.longitude
              )
            )
          : undefined;
      map.set(loc.userId, {
        userId: loc.userId,
        fullName: loc.fullName,
        username: loc.username,
        avatarUrl: loc.avatarUrl,
        isOnline: onlineUserIds.includes(loc.userId),
        isSharingGps: true,
        latitude: loc.latitude,
        longitude: loc.longitude,
        distanceText: dist,
        updatedAt: loc.updated_at || loc.timestamp,
      });
    });

    // Also include accepted friends from shareRequests even if their GPS isn't currently broadcasting
    shareRequests
      .filter((r) => r.status === 'accepted' || r.status === 'temporary')
      .forEach((req) => {
        const isInitiator = req.fromUserId === user?.id;
        const friendId = isInitiator ? req.toUserId : req.fromUserId;
        if (!friendId || friendId === user?.id || map.has(friendId)) return;
        const friendName = isInitiator
          ? req.toUserName || 'Friend'
          : req.fromUserName || 'Friend';
        const friendUsername = isInitiator
          ? req.toUsername || friendId.slice(0, 8)
          : req.fromUsername || friendId.slice(0, 8);
        const friendAvatar = isInitiator
          ? req.toUserAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friendId}`
          : req.fromUserAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friendId}`;

        map.set(friendId, {
          userId: friendId,
          fullName: friendName,
          username: friendUsername,
          avatarUrl: friendAvatar,
          isOnline: onlineUserIds.includes(friendId),
          isSharingGps: false,
        });
      });

    return Array.from(map.values());
  }, [peerLocations, shareRequests, myLocation, onlineUserIds, user?.id]);

  // Incoming pending friend/location requests
  const pendingIncomingRequests = useMemo(() => {
    return shareRequests.filter((r) => r.toUserId === user?.id && r.status === 'pending');
  }, [shareRequests, user?.id]);

  // Aggregate recent conversations from live socket + backend history
  const recentMessages = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    recentBackendMessages.forEach((m) => map.set(m.id, m));
    Object.values(chatMessages).forEach((list) => {
      list.forEach((m) => map.set(m.id, m));
    });
    return Array.from(map.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [recentBackendMessages, chatMessages]);

  const displayUserId = user?.fullName || user?.username || user?.id || '';

  const handleCopyUserId = async () => {
    if (!displayUserId) return;
    try {
      await navigator.clipboard.writeText(displayUserId);
      setCopiedId(true);
      toast.success(`Copied your User ID: ${displayUserId}`);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      toast.info(`Your User ID: ${displayUserId}`);
    }
  };

  const handleToggleLocationSharing = async () => {
    if (!user || isUpdatingSharing) return;
    setIsUpdatingSharing(true);
    const nextState = !isSharingLocation;
    try {
      await updatePrivacy({
        locationVisibility:
          nextState && user.privacy.locationVisibility === 'nobody'
            ? 'room_members'
            : user.privacy.locationVisibility,
        phoneVisibility: user.privacy.phoneVisibility,
        profileVisibility: user.privacy.profileVisibility,
        showOnlineStatus: user.privacy.showOnlineStatus,
        locationSharingEnabled: nextState,
        temporarySharingExpiry: user.privacy.temporarySharingExpiry || null,
      });
      if (nextState) {
        requestLocationUpdate();
        toast.success('Live Location Sharing is now ACTIVE');
      } else {
        toast.info('Live Location Sharing PAUSED');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update location sharing status');
    } finally {
      setIsUpdatingSharing(false);
    }
  };

  const handleRespondRequest = async (requestId: string, response: 'accepted' | 'denied') => {
    try {
      const res = await api.post<{ request: LocationShareRequest }>('/api/locations/respond', {
        requestId,
        response,
      });
      setShareRequests((prev) => prev.map((r) => (r.id === requestId ? res.request : r)));
      toast.success(
        response === 'accepted'
          ? 'Friend request accepted — live location connected!'
          : 'Request declined'
      );
    } catch (err: any) {
      toast.error(err?.message || 'Could not respond to request');
    }
  };

  const greetingTime = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good morning';
    if (hr < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <div
      className={`w-full h-full overflow-y-auto p-4 sm:p-6 pb-28 space-y-6 select-none transition-colors duration-300 ${
        isDark ? 'bg-[#0B081B] text-[#F8F7FF]' : 'bg-[#F8F6FF] text-slate-900'
      }`}
    >
      {/* Ambient Social Glow Blobs (Zero-cost GPU radial gradients) */}
      <div
        className="pointer-events-none fixed top-10 right-4 w-96 h-96 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(137, 87, 255, 0.16) 0%, transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none fixed bottom-16 left-4 w-96 h-96 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255, 79, 163, 0.13) 0%, transparent 70%)',
        }}
      />

      {/* 1. PERSONALISED SOCIAL WELCOME HEADER */}
      <section className="relative overflow-hidden rounded-[32px] p-5 sm:p-7 shadow-2xl border border-white/15 bg-gradient-to-br from-[#8957FF] via-[#6C47FF] to-[#FF4FA3] text-white">
        {/* Decorative Background Circles */}
        <div
          className="pointer-events-none absolute -top-20 -right-16 w-72 h-72 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255, 128, 102, 0.42) 0%, transparent 70%)',
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-12 w-72 h-72 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0, 217, 255, 0.32) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Avatar + Welcome Greeting */}
          <div className="flex items-center gap-4 min-w-0">
            <div
              onClick={() => onNavigateTab('profile')}
              className="relative shrink-0 cursor-pointer group"
            >
              <div className="p-1 rounded-full bg-gradient-to-tr from-[#FFD166] via-[#FF4FA3] to-[#00D9FF] shadow-[0_8px_28px_rgba(0,0,0,0.35)] group-hover:scale-105 transition-transform">
                <img
                  src={user?.avatarUrl}
                  alt={user?.fullName}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-[#0B081B]"
                />
              </div>
              <span
                className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[#0B081B] ${
                  isConnected ? 'bg-[#00D6A0] shadow-[0_0_10px_#00D6A0]' : 'bg-[#FFD166]'
                }`}
              />
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-extrabold uppercase tracking-wider text-white flex items-center gap-1 border border-white/25">
                  <Sparkles className="w-3 h-3 text-[#FFD166]" />
                  {greetingTime}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#00D6A0]/25 border border-[#00D6A0]/50 text-[#A7FFF0] text-[10px] font-extrabold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00D6A0] animate-ping" />
                  {isSharingLocation ? 'SHARING LIVE GPS' : 'GPS PAUSED'}
                </span>
              </div>

              <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white truncate">
                Hey, {user?.fullName?.split(' ')[0] || 'Explorer'}! 👋
              </h1>

              <div className="flex items-center gap-2 flex-wrap text-xs text-white/90">
                <span className="font-semibold">@{user?.username}</span>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleCopyUserId}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/25 hover:bg-black/35 border border-white/20 font-mono text-[11px] text-[#FFD166] transition-colors cursor-pointer"
                  title="Tap to copy your User ID"
                >
                  <span>ID: {displayUserId}</span>
                  {copiedId ? (
                    <Check className="w-3 h-3 text-[#00D6A0]" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Live Location Pill & Map Launch */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleToggleLocationSharing}
              disabled={isUpdatingSharing}
              className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer active:scale-95 border ${
                isSharingLocation
                  ? 'bg-[#00D6A0] text-slate-950 border-white/40 shadow-[0_8px_22px_rgba(0,214,160,0.4)]'
                  : 'bg-black/30 text-white border-white/25 hover:bg-black/45'
              }`}
            >
              {isSharingLocation ? (
                <>
                  <Eye className="w-4 h-4" />
                  <span>Sharing On</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-[#FFD166]" />
                  <span>Sharing Paused</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('map')}
              className="px-4 py-2.5 rounded-2xl bg-white text-[#8957FF] hover:bg-slate-50 font-extrabold text-xs flex items-center gap-2 shadow-xl transition-all cursor-pointer active:scale-95"
            >
              <MapIcon className="w-4 h-4 text-[#FF4FA3]" />
              <span>Open Live Map</span>
            </button>
          </div>
        </div>

        {/* Social Stats Strip inside Hero */}
        <div className="relative z-10 mt-5 pt-4 border-t border-white/20 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div
            onClick={() => onNavigateTab('friends')}
            className="p-3 rounded-2xl bg-black/20 hover:bg-black/30 backdrop-blur-md border border-white/15 cursor-pointer transition-all"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/75 block">
              Friends Online
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-extrabold text-[#00D6A0]">
                {onlineUserIds.length}
              </span>
              <span className="text-[11px] text-white/80">
                · {peerLocations.length} on map
              </span>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('rooms')}
            className="p-3 rounded-2xl bg-black/20 hover:bg-black/30 backdrop-blur-md border border-white/15 cursor-pointer transition-all"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/75 block">
              Active Rooms
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-extrabold text-[#FFD166]">{rooms.length}</span>
              <span className="text-[11px] text-white/80">spaces joined</span>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('map')}
            className="p-3 rounded-2xl bg-black/20 hover:bg-black/30 backdrop-blur-md border border-white/15 cursor-pointer transition-all"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/75 block">
              My GPS Signal
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-sm font-extrabold text-[#00D9FF] truncate">
                {myLocation
                  ? `±${Math.round(Number(myLocation.accuracy_m ?? myLocation.accuracy))}m Live`
                  : locationStatus}
              </span>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('saved')}
            className="p-3 rounded-2xl bg-black/20 hover:bg-black/30 backdrop-blur-md border border-white/15 cursor-pointer transition-all"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/75 block">
              Saved Places
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-extrabold text-white">
                {savedPlaces.length}
              </span>
              <span className="text-[11px] text-white/80">geofences</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. COLOURFUL ONLINE FRIENDS & STORIES BAR (Instagram / Snapchat Style) */}
      <section
        className={`rounded-[28px] p-4 sm:p-5 border transition-all ${
          isDark
            ? 'bg-[#130F2B]/90 border-[#8957FF]/25 shadow-xl'
            : 'bg-white border-[#8957FF]/15 shadow-[0_10px_30px_rgba(137,87,255,0.08)]'
        }`}
      >
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#8957FF] to-[#FF4FA3] flex items-center justify-center text-white shadow-sm">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold tracking-tight">
                Live Friends & Location Stories
              </h2>
              <p className={`text-[11px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                Tap a friend to view their live spot or send a quick message
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('friends')}
            className="text-xs font-extrabold text-[#FF4FA3] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>See All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-4 overflow-x-auto pb-1 no-scrollbar">
          {/* Your Own Live Story / Spot Avatar */}
          <button
            type="button"
            onClick={() => {
              if (myLocation) {
                onFocusMapLocation(myLocation.latitude, myLocation.longitude);
              } else {
                onNavigateTab('map');
              }
            }}
            className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer"
          >
            <div className="relative">
              <div className="social-story-ring rounded-full p-[3px] group-hover:scale-105 transition-transform">
                <img
                  src={user?.avatarUrl}
                  alt="You"
                  className={`w-15 h-15 rounded-full object-cover border-2 ${
                    isDark ? 'border-[#0B081B]' : 'border-white'
                  }`}
                />
              </div>
              <span className="absolute -bottom-1 right-0 w-6 h-6 rounded-full bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white flex items-center justify-center border-2 border-[#0B081B] shadow-md">
                <MapPin className="w-3 h-3" />
              </span>
            </div>
            <span className="text-[11px] font-extrabold truncate max-w-[72px]">My Spot</span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#00D6A0]/15 text-[#00D6A0]">
              {isSharingLocation ? 'LIVE' : 'Paused'}
            </span>
          </button>

          {/* Add New Friend Story Button */}
          <button
            type="button"
            onClick={() => onNavigateTab('friends')}
            className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer"
          >
            <div
              className={`w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-all group-hover:scale-105 ${
                isDark
                  ? 'border-[#8957FF]/60 bg-[#1B153A] text-[#FF4FA3] group-hover:border-[#FF4FA3]'
                  : 'border-[#8957FF]/50 bg-[#F3EEFF] text-[#8957FF] group-hover:border-[#FF4FA3]'
              }`}
            >
              <UserPlus className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-extrabold truncate max-w-[72px]">Add Friend</span>
            <span
              className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                isDark ? 'bg-white/10 text-[#A9A2D0]' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Connect
            </span>
          </button>

          {/* Online & Connected Friends Avatars */}
          {socialFriendsStoryList.map((friend) => (
            <button
              key={friend.userId}
              type="button"
              onClick={() => {
                if (friend.latitude != null && friend.longitude != null) {
                  onFocusMapLocation(friend.latitude, friend.longitude);
                } else {
                  onSelectUserForChat({
                    id: friend.userId,
                    name: friend.fullName,
                    avatar: friend.avatarUrl,
                  });
                }
              }}
              className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer"
            >
              <div className="relative">
                <div
                  className={`${
                    friend.isSharingGps ? 'social-story-ring-live' : 'social-story-ring'
                  } rounded-full p-[3px] group-hover:scale-105 transition-transform shadow-md`}
                >
                  <img
                    src={friend.avatarUrl}
                    alt={friend.fullName}
                    className={`w-15 h-15 rounded-full object-cover border-2 ${
                      isDark ? 'border-[#0B081B]' : 'border-white'
                    }`}
                  />
                </div>
                <span
                  className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 ${
                    isDark ? 'border-[#0B081B]' : 'border-white'
                  } ${friend.isOnline ? 'bg-[#00D6A0]' : 'bg-slate-400'}`}
                />
              </div>
              <span className="text-[11px] font-extrabold truncate max-w-[76px]">
                {friend.fullName.split(' ')[0]}
              </span>
              <span
                className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                  friend.distanceText
                    ? 'bg-[#00D9FF]/15 text-[#00D9FF]'
                    : 'bg-[#8957FF]/15 text-[#8957FF]'
                }`}
              >
                {friend.distanceText || (friend.isOnline ? 'Online' : 'Friend')}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 3. ATTRACTIVE NOTIFICATION CARDS (SOS Alerts + Friend Requests) */}
      {(activeAlerts.length > 0 || pendingIncomingRequests.length > 0) && (
        <section className="space-y-3">
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className="rounded-3xl bg-gradient-to-r from-[#FF4FA3] to-[#FF8066] p-4 sm:p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_10px_30px_rgba(255,79,163,0.4)] animate-pulse"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Siren className="w-6 h-6 text-white animate-bounce" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest bg-black/25 px-2 py-0.5 rounded-full">
                    EMERGENCY SOS ALERT
                  </span>
                  <h3 className="text-sm font-extrabold text-white mt-1">
                    {alert.senderName}: "{alert.message}"
                  </h3>
                  <p className="text-xs text-white/90 font-mono mt-0.5">
                    Coords: {alert.latitude.toFixed(5)}, {alert.longitude.toFixed(5)} ·{' '}
                    {formatTimeAgo(alert.timestamp)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onFocusMapLocation(alert.latitude, alert.longitude)}
                className="px-4 py-2.5 rounded-xl bg-white text-[#FF4FA3] font-extrabold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-lg"
              >
                <Navigation className="w-4 h-4" />
                <span>Locate Now</span>
              </button>
            </div>
          ))}

          {pendingIncomingRequests.map((req) => (
            <div
              key={req.id}
              className={`rounded-3xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg ${
                isDark
                  ? 'bg-gradient-to-r from-[#1B153A] to-[#26174A] border-[#FF4FA3]/40'
                  : 'bg-gradient-to-r from-[#FFF0F7] to-[#F3EEFF] border-[#FF4FA3]/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="social-story-ring rounded-full">
                  <img
                    src={
                      req.fromUserAvatar ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.fromUserId}`
                    }
                    alt={req.fromUserName}
                    className="w-11 h-11 rounded-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-[#FF4FA3]/20 text-[#FF4FA3] text-[10px] font-extrabold">
                      New Friend Request
                    </span>
                    <span className="text-xs font-extrabold">{req.fromUserName}</span>
                  </div>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A9A2D0]' : 'text-slate-600'}`}>
                    Wants to connect & share real-time locations with you
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleRespondRequest(req.id, 'accepted')}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 font-extrabold text-xs cursor-pointer shadow-md active:scale-95 transition-transform"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => handleRespondRequest(req.id, 'denied')}
                  className="px-3.5 py-2 rounded-xl bg-[#FF4FA3]/15 border border-[#FF4FA3]/40 text-[#FF4FA3] font-bold text-xs cursor-pointer"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 4. COLOURFUL QUICK ACTION BUTTONS */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#8957FF] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#FF4FA3]" />
            <span>Beacon Network Quick Actions</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => onNavigateTab('map')}
            className="p-4 rounded-3xl bg-gradient-to-br from-[#397BFF] to-[#00D9FF] text-white text-left transition-all cursor-pointer active:scale-95 shadow-[0_10px_24px_rgba(57,123,255,0.3)] group"
          >
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-extrabold block">Live Map</span>
            <span className="text-[10px] text-white/85 mt-0.5 block">
              Real-time friend radar
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('friends')}
            className="p-4 rounded-3xl bg-gradient-to-br from-[#8957FF] to-[#FF4FA3] text-white text-left transition-all cursor-pointer active:scale-95 shadow-[0_10px_24px_rgba(137,87,255,0.3)] group"
          >
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-extrabold block">Add Friend</span>
            <span className="text-[10px] text-white/85 mt-0.5 block">
              Connect via @username
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('rooms')}
            className="p-4 rounded-3xl bg-gradient-to-br from-[#8957FF] to-[#397BFF] text-white text-left transition-all cursor-pointer active:scale-95 shadow-[0_10px_24px_rgba(137,87,255,0.28)] group"
          >
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-extrabold block">Create Room</span>
            <span className="text-[10px] text-white/85 mt-0.5 block">
              Private group circles
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('chat')}
            className="p-4 rounded-3xl bg-gradient-to-br from-[#00D6A0] to-[#00D9FF] text-slate-950 text-left transition-all cursor-pointer active:scale-95 shadow-[0_10px_24px_rgba(0,214,160,0.3)] group"
          >
            <div className="w-10 h-10 rounded-2xl bg-black/15 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-5 h-5 text-slate-950" />
            </div>
            <span className="text-xs font-extrabold block">Messages</span>
            <span className="text-[10px] text-slate-900/80 font-semibold mt-0.5 block">
              Voice, photos & pins
            </span>
          </button>

          <button
            type="button"
            onClick={onTriggerEmergency}
            className="col-span-2 sm:col-span-1 p-4 rounded-3xl bg-gradient-to-br from-[#FF4FA3] to-[#FF8066] text-white text-left transition-all cursor-pointer active:scale-95 shadow-[0_10px_24px_rgba(255,79,163,0.35)] group"
          >
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Siren className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-extrabold block">Emergency SOS</span>
            <span className="text-[10px] text-white/90 mt-0.5 block">
              Instant 5km alert
            </span>
          </button>
        </div>
      </section>

      {/* 5. MAIN SOCIAL FEED GRID: LOCATION ACTIVITY + ACTIVE ROOMS + CONVERSATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Live Location-Sharing Activity & Active Rooms */}
        <div className="lg:col-span-7 space-y-6">
          {/* Location-Sharing Activity Card */}
          <div
            className={`rounded-[28px] border p-5 space-y-4 ${
              isDark
                ? 'bg-[#130F2B]/90 border-[#8957FF]/25 shadow-xl'
                : 'bg-white border-[#8957FF]/15 shadow-[0_10px_30px_rgba(137,87,255,0.07)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#00D6A0] to-[#00D9FF] flex items-center justify-center text-slate-950 shadow-sm">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold">Location-Sharing Activity</h3>
                  <p className={`text-[11px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                    Friends broadcasting real-time GPS coordinates right now
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('map')}
                className="px-3 py-1.5 rounded-xl bg-[#00D6A0]/15 text-[#00D6A0] text-xs font-extrabold hover:bg-[#00D6A0]/25 transition-colors cursor-pointer"
              >
                Full Map →
              </button>
            </div>

            {peerLocations.length === 0 ? (
              <div
                className={`p-6 rounded-2xl border text-center space-y-2.5 ${
                  isDark
                    ? 'bg-[#1B153A]/60 border-white/10'
                    : 'bg-[#F8F6FF] border-[#8957FF]/15'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#8957FF]/20 to-[#FF4FA3]/20 text-[#FF4FA3] flex items-center justify-center mx-auto">
                  <Compass className="w-6 h-6" />
                </div>
                <p className="text-xs font-extrabold">No friends sharing live GPS right now</p>
                <p
                  className={`text-[11px] max-w-xs mx-auto ${
                    isDark ? 'text-[#A9A2D0]' : 'text-slate-500'
                  }`}
                >
                  Invite friends or join a room to see their live avatars, distances, and movement on the map.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigateTab('friends')}
                  className="mt-1 px-4 py-2 rounded-xl bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white text-xs font-extrabold cursor-pointer shadow-md"
                >
                  Find & Add Friends
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {peerLocations.slice(0, 5).map((peer) => {
                  const isPeerOnline = onlineUserIds.includes(peer.userId);
                  const dist =
                    myLocation != null
                      ? formatDistance(
                          calculateDistanceMeters(
                            myLocation.latitude,
                            myLocation.longitude,
                            peer.latitude,
                            peer.longitude
                          )
                        )
                      : 'Live GPS';

                  return (
                    <div
                      key={peer.userId}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                        isDark
                          ? 'bg-[#1B153A]/85 border-white/10 hover:border-[#00D9FF]/50'
                          : 'bg-[#F8F6FF] border-[#8957FF]/15 hover:border-[#397BFF]/45'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className="social-story-ring-live rounded-full">
                            <img
                              src={peer.avatarUrl}
                              alt={peer.fullName}
                              className="w-11 h-11 rounded-full object-cover"
                            />
                          </div>
                          <span
                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0B081B] ${
                              isPeerOnline ? 'bg-[#00D6A0]' : 'bg-slate-400'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold truncate">
                              {peer.fullName}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-[#00D6A0]/15 text-[#00D6A0] text-[10px] font-extrabold font-mono">
                              {dist}
                            </span>
                          </div>
                          <div
                            className={`flex items-center gap-2 text-[11px] mt-0.5 ${
                              isDark ? 'text-[#A9A2D0]' : 'text-slate-500'
                            }`}
                          >
                            <span>@{peer.username}</span>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#00D9FF]" />
                              {formatTimeAgo(peer.updated_at || peer.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onSelectUserForChat({
                              id: peer.userId,
                              name: peer.fullName,
                              avatar: peer.avatarUrl,
                            })
                          }
                          className="p-2 rounded-xl bg-[#8957FF]/15 hover:bg-[#8957FF] text-[#8957FF] hover:text-white transition-colors cursor-pointer"
                          title={`Chat with ${peer.fullName}`}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onFocusMapLocation(peer.latitude, peer.longitude)}
                          className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 font-extrabold text-xs flex items-center gap-1 cursor-pointer shadow-sm"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Locate</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Rooms Grid with Unique Colour Accents */}
          <div
            className={`rounded-[28px] border p-5 space-y-4 ${
              isDark
                ? 'bg-[#130F2B]/90 border-[#8957FF]/25 shadow-xl'
                : 'bg-white border-[#8957FF]/15 shadow-[0_10px_30px_rgba(137,87,255,0.07)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#8957FF] to-[#FF4FA3] flex items-center justify-center text-white shadow-sm">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold">Active Beacon Rooms</h3>
                  <p className={`text-[11px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                    Colourful group spaces for live maps, voice & chat
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('rooms')}
                className="px-3 py-1.5 rounded-xl bg-[#8957FF]/15 text-[#8957FF] dark:text-[#E9DFFF] text-xs font-extrabold hover:bg-[#8957FF]/25 transition-colors cursor-pointer"
              >
                All Rooms →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rooms.slice(0, 4).map((room, idx) => {
                const isSelected = room.id === selectedRoomId;
                const isUniversal = room.isUniversal || room.id === 'room-universal';
                const gradient = ROOM_GRADIENTS[idx % ROOM_GRADIENTS.length];

                return (
                  <div
                    key={room.id}
                    onClick={() => {
                      onSelectRoom(room.id);
                      onNavigateTab('rooms');
                    }}
                    className={`group relative overflow-hidden p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? isDark
                          ? 'bg-[#1B153A] border-[#FF4FA3] ring-1 ring-[#FF4FA3]/40'
                          : 'bg-[#F8F6FF] border-[#8957FF] ring-1 ring-[#8957FF]/30'
                        : isDark
                          ? 'bg-[#1B153A]/75 border-white/10 hover:border-[#8957FF]/60'
                          : 'bg-[#F8F6FF] border-[#8957FF]/15 hover:border-[#8957FF]/45'
                    }`}
                  >
                    {/* Top Colour Accent Bar */}
                    <div className={`h-1.5 w-14 rounded-full bg-gradient-to-r ${gradient} mb-3`} />

                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${gradient} text-white flex items-center justify-center shrink-0 shadow-md`}
                        >
                          {isUniversal ? (
                            <Globe className="w-5 h-5" />
                          ) : (
                            <Users className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-extrabold truncate">{room.name}</h4>
                            {room.hasPassword && (
                              <Lock className="w-3 h-3 text-[#FFD166] shrink-0" />
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-bold block ${
                              isDark ? 'text-[#00D9FF]' : 'text-[#8957FF]'
                            }`}
                          >
                            {room.memberCount} members connected
                          </span>
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 group-hover:translate-x-0.5 transition-transform ${
                          isDark ? 'text-[#A9A2D0]' : 'text-slate-400'
                        }`}
                      />
                    </div>

                    <p
                      className={`text-[11px] mt-2.5 line-clamp-2 ${
                        isDark ? 'text-[#A9A2D0]' : 'text-slate-600'
                      }`}
                    >
                      {room.description || 'Live group chat & map coordinate sharing.'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Recent Conversations + Notification Cards */}
        <div className="lg:col-span-5 space-y-6">
          <div
            className={`rounded-[28px] border p-5 space-y-4 ${
              isDark
                ? 'bg-[#130F2B]/90 border-[#8957FF]/25 shadow-xl'
                : 'bg-white border-[#8957FF]/15 shadow-[0_10px_30px_rgba(137,87,255,0.07)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#FF4FA3] to-[#FF8066] flex items-center justify-center text-white shadow-sm">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold">Recent Conversations</h3>
                  <p className={`text-[11px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                    Direct DMs & room messages
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('chat')}
                className="px-3 py-1.5 rounded-xl bg-[#FF4FA3]/15 text-[#FF4FA3] text-xs font-extrabold hover:bg-[#FF4FA3]/25 transition-colors cursor-pointer"
              >
                Open Chats →
              </button>
            </div>

            {recentMessages.length === 0 ? (
              <div
                className={`p-6 rounded-2xl border text-center space-y-2 ${
                  isDark
                    ? 'bg-[#1B153A]/60 border-white/10'
                    : 'bg-[#F8F6FF] border-[#8957FF]/15'
                }`}
              >
                <MessageSquare className="w-7 h-7 text-[#FF4FA3] mx-auto opacity-80" />
                <p className="text-xs font-extrabold">No conversations yet</p>
                <p className={`text-[11px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                  Start a colourful chat, send a voice note, or drop a map pin!
                </p>
                <button
                  type="button"
                  onClick={() => onNavigateTab('chat')}
                  className="mt-1 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF4FA3] to-[#FF8066] text-white text-xs font-extrabold cursor-pointer shadow-sm"
                >
                  Start Messaging
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentMessages.map((msg) => {
                  const isSelf = msg.senderId === user?.id;
                  const hasVoice = msg.attachments?.some((a) => a.type === 'voice');
                  return (
                    <div
                      key={msg.id}
                      onClick={() => {
                        if (msg.roomId) {
                          onSelectRoom(msg.roomId);
                          onNavigateTab('chat');
                        } else if (!isSelf && msg.senderId) {
                          onSelectUserForChat({
                            id: msg.senderId,
                            name: msg.senderName,
                            avatar: msg.senderAvatar,
                          });
                        } else {
                          onNavigateTab('chat');
                        }
                      }}
                      className={`p-3 rounded-2xl border flex items-start gap-3 transition-all cursor-pointer ${
                        isDark
                          ? 'bg-[#1B153A]/85 border-white/10 hover:border-[#FF4FA3]/50'
                          : 'bg-[#F8F6FF] border-[#8957FF]/15 hover:border-[#FF4FA3]/45'
                      }`}
                    >
                      <div className="social-story-ring rounded-full shrink-0">
                        <img
                          src={msg.senderAvatar || user?.avatarUrl}
                          alt={msg.senderName}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold truncate">
                            {isSelf ? 'You' : msg.senderName}
                          </span>
                          <span
                            className={`text-[10px] font-mono shrink-0 ${
                              isDark ? 'text-[#A9A2D0]' : 'text-slate-400'
                            }`}
                          >
                            {formatTimeAgo(msg.createdAt)}
                          </span>
                        </div>
                        <p
                          className={`text-xs truncate mt-0.5 ${
                            isDark ? 'text-[#F8F7FF]/85' : 'text-slate-600'
                          }`}
                        >
                          {hasVoice ? '🎤 Voice message' : msg.text}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Saved Hotspots & Geofence Preview Card */}
          <div
            className={`rounded-[28px] border p-5 space-y-3.5 ${
              isDark
                ? 'bg-[#130F2B]/90 border-[#8957FF]/25 shadow-xl'
                : 'bg-white border-[#8957FF]/15 shadow-[0_10px_30px_rgba(137,87,255,0.07)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#FFD166] to-[#FF8066] flex items-center justify-center text-slate-950 shadow-sm">
                  <Heart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold">Saved Places & Hotspots</h3>
                  <p className={`text-[11px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                    Home, work & favourite hangout zones
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('saved')}
                className="text-xs font-extrabold text-[#FF8066] hover:underline cursor-pointer"
              >
                Manage →
              </button>
            </div>

            {savedPlaces.length === 0 ? (
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  isDark
                    ? 'bg-[#1B153A]/60 border-white/10'
                    : 'bg-[#F8F6FF] border-[#8957FF]/15'
                }`}
              >
                <span className={`text-xs ${isDark ? 'text-[#A9A2D0]' : 'text-slate-600'}`}>
                  Bookmark your favourite spots on the map
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateTab('saved')}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#8957FF] to-[#397BFF] text-white text-xs font-extrabold cursor-pointer"
                >
                  + Add Place
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {savedPlaces.slice(0, 3).map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => onFocusMapLocation(pl.latitude, pl.longitude)}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                      isDark
                        ? 'bg-[#1B153A]/85 border-white/10 hover:border-[#FFD166]/50'
                        : 'bg-[#F8F6FF] border-[#8957FF]/15 hover:border-[#FF8066]/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: pl.markerColor || '#FF4FA3' }}
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-extrabold block truncate">{pl.name}</span>
                        <span
                          className={`text-[10px] font-mono ${
                            isDark ? 'text-[#A9A2D0]' : 'text-slate-500'
                          }`}
                        >
                          {pl.category} · {pl.radiusMeters}m zone
                        </span>
                      </div>
                    </div>
                    <MapPin className="w-4 h-4 text-[#FF4FA3] shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
