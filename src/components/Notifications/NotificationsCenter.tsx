import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { api } from '../../utils/api.ts';
import { notifications } from '../../utils/notifications.ts';
import { sound } from '../../utils/audio.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { formatTimeAgo } from '../../utils/geo.ts';
import type {
  LocationShareRequest,
  ChatMessage,
  Room,
  EmergencyAlert,
} from '../../types.ts';
import {
  Bell,
  Users,
  MessageSquare,
  Shield,
  Siren,
  MapPin,
  Check,
  CheckCheck,
  Trash2,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
  RefreshCw,
} from 'lucide-react';

interface NotificationsCenterProps {
  rooms: Room[];
  onNavigateTab: (tab: string) => void;
  onFocusMapLocation: (lat: number, lng: number) => void;
  onSelectUserForChat: (user: { id: string; name: string; avatar: string }) => void;
  onOpenRoom: (roomId: string) => void;
}

interface UnifiedNotificationItem {
  id: string;
  category: 'friend_request' | 'message' | 'room' | 'emergency' | 'location';
  title: string;
  body: string;
  timestamp: string;
  accentColor: string;
  unread: boolean;
  requestId?: string;
  latitude?: number;
  longitude?: number;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  roomId?: string;
}

export const NotificationsCenter: React.FC<NotificationsCenterProps> = ({
  rooms,
  onNavigateTab,
  onFocusMapLocation,
  onSelectUserForChat,
  onOpenRoom,
}) => {
  const { user } = useAuth();
  const { activeAlerts, userLocations } = useRealtime();
  const { themeConfig } = useTheme();
  const isDark = themeConfig.isDark;
  const toast = useToast();

  const [filter, setFilter] = useState<
    'all' | 'friend_request' | 'message' | 'room' | 'emergency' | 'location'
  >('all');
  const [showSettings, setShowSettings] = useState(false);
  const [requests, setRequests] = useState<LocationShareRequest[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`beacon_notif_read_${user?.id || 'guest'}`);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [clearedIds, setClearedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`beacon_notif_cleared_${user?.id || 'guest'}`);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(
    notifications.getPermission()
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => !sound.isMuted());

  const persistReadIds = (next: Set<string>) => {
    setReadIds(next);
    try {
      localStorage.setItem(
        `beacon_notif_read_${user?.id || 'guest'}`,
        JSON.stringify(Array.from(next))
      );
    } catch {}
  };

  const persistClearedIds = (next: Set<string>) => {
    setClearedIds(next);
    try {
      localStorage.setItem(
        `beacon_notif_cleared_${user?.id || 'guest'}`,
        JSON.stringify(Array.from(next))
      );
    } catch {}
  };

  const loadNotificationsData = async () => {
    if (!user || !api.getToken()) return;
    setIsLoading(true);
    try {
      const [reqRes, msgRes, alRes] = await Promise.all([
        api
          .get<{ requests: LocationShareRequest[] }>('/api/locations/requests')
          .catch(() => ({ requests: [] })),
        api.get<{ messages: ChatMessage[] }>('/api/messages').catch(() => ({ messages: [] })),
        api.get<{ alerts: EmergencyAlert[] }>('/api/alerts').catch(() => ({ alerts: [] })),
      ]);
      setRequests(Array.isArray(reqRes.requests) ? reqRes.requests : []);
      setMessages(Array.isArray(msgRes.messages) ? msgRes.messages : []);
      setAlerts(Array.isArray(alRes.alerts) ? alRes.alerts : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadNotificationsData();
    const onSync = () => void loadNotificationsData();
    window.addEventListener('beacon:cloud-sync-updated', onSync);
    return () => window.removeEventListener('beacon:cloud-sync-updated', onSync);
  }, [user?.id]);

  const allNotifications = useMemo(() => {
    const items: UnifiedNotificationItem[] = [];

    // 1. Emergency Alerts
    const combinedAlerts = [...activeAlerts];
    alerts.forEach((a) => {
      if (!combinedAlerts.some((existing) => existing.id === a.id)) {
        combinedAlerts.push(a);
      }
    });
    combinedAlerts.slice(0, 10).forEach((al) => {
      const id = `emergency-${al.id}`;
      if (clearedIds.has(id)) return;
      items.push({
        id,
        category: 'emergency',
        title: `Emergency SOS: ${al.senderName}`,
        body: al.message,
        timestamp: al.timestamp,
        accentColor: '#FF4FA3',
        unread: !readIds.has(id) && al.status === 'active',
        latitude: al.latitude,
        longitude: al.longitude,
      });
    });

    // 2. Friend Requests & Location Sharing Approvals
    requests.forEach((req) => {
      const id = `req-${req.id}-${req.status}`;
      if (clearedIds.has(id)) return;
      const isIncoming = req.toUserId === user?.id;
      if (isIncoming && req.status === 'pending') {
        items.push({
          id,
          category: 'friend_request',
          title: `Friend Request from ${req.fromUserName}`,
          body: `@${req.fromUsername || req.fromUserId} wants to connect and share live GPS locations.`,
          timestamp: req.createdAt,
          accentColor: '#8957FF',
          unread: !readIds.has(id),
          requestId: req.id,
        });
      } else if (req.status === 'accepted' || req.status === 'temporary') {
        const partnerName = isIncoming ? req.fromUserName : req.toUserName || 'Friend';
        items.push({
          id,
          category: 'location',
          title: `Location Sharing Active with ${partnerName}`,
          body:
            req.status === 'temporary'
              ? '1-hour temporary GPS location access is active.'
              : 'Mutual friend & real-time telemetry connection established.',
          timestamp: req.createdAt,
          accentColor: '#00D6A0',
          unread: !readIds.has(id),
        });
      }
    });

    // 3. Direct & Room Messages
    messages
      .filter((m) => m.senderId !== user?.id)
      .slice(-15)
      .reverse()
      .forEach((m) => {
        const id = `msg-${m.id}`;
        if (clearedIds.has(id)) return;
        const isReadByMe = readIds.has(id);
        const voiceAtt = m.attachments?.find((a) => a.type === 'voice');
        const firstAtt = m.attachments?.[0];
        items.push({
          id,
          category: 'message',
          title: `${m.senderName} ${m.roomId ? 'in Room' : '(Direct Message)'}`,
          body: voiceAtt
            ? '🎤 Sent a voice message'
            : firstAtt
              ? `📎 Shared ${firstAtt.name || 'an attachment'}`
              : m.text,
          timestamp: m.createdAt,
          accentColor: '#00D9FF',
          unread: !isReadByMe,
          senderId: m.senderId,
          senderName: m.senderName,
          senderAvatar: m.senderAvatar,
          roomId: m.roomId,
        });
      });

    // 4. Room Invitations / Joined Rooms
    rooms.forEach((rm) => {
      const id = `room-${rm.id}`;
      if (clearedIds.has(id)) return;
      items.push({
        id,
        category: 'room',
        title: `Room Active: ${rm.name}`,
        body: `${rm.memberCount} members connected · Room ID: ${rm.id}`,
        timestamp: rm.createdAt,
        accentColor: '#8957FF',
        unread: false,
        roomId: rm.id,
      });
    });

    // 5. Live Peer Location-Sharing Events
    userLocations
      .filter((loc) => loc.userId !== user?.id)
      .forEach((loc) => {
        const id = `loc-peer-${loc.userId}`;
        if (clearedIds.has(id)) return;
        const ts = loc.updated_at || loc.timestamp;
        items.push({
          id,
          category: 'location',
          title: `${loc.fullName} is sharing live GPS`,
          body: `Coordinates updated ${formatTimeAgo(ts)}`,
          timestamp: ts,
          accentColor: '#00D6A0',
          unread: !readIds.has(id),
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
      });

    return items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [activeAlerts, alerts, requests, messages, rooms, userLocations, user?.id, readIds, clearedIds]);

  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return allNotifications;
    return allNotifications.filter((n) => n.category === filter);
  }, [allNotifications, filter]);

  const unreadCount = useMemo(
    () => allNotifications.filter((n) => n.unread).length,
    [allNotifications]
  );

  const handleMarkAsRead = (id: string) => {
    const next = new Set(readIds);
    next.add(id);
    persistReadIds(next);
  };

  const handleMarkAllAsRead = async () => {
    const next = new Set(readIds);
    allNotifications.forEach((n) => next.add(n.id));
    persistReadIds(next);
    toast.success('All notifications marked as read');
  };

  const handleClearNotifications = () => {
    const next = new Set(clearedIds);
    filteredNotifications.forEach((n) => next.add(n.id));
    persistClearedIds(next);
    toast.info('Cleared notifications from view');
  };

  const handleRespondFriendRequest = async (
    requestId: string,
    response: 'accepted' | 'denied',
    notifId: string
  ) => {
    try {
      const res = await api.post<{ request: LocationShareRequest }>('/api/locations/respond', {
        requestId,
        response,
      });
      setRequests((prev) => prev.map((r) => (r.id === requestId ? res.request : r)));
      handleMarkAsRead(notifId);
      toast.success(
        response === 'accepted' ? 'Friend request accepted!' : 'Friend request declined'
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to respond to request');
    }
  };

  return (
    <div
      className={`w-full h-full overflow-y-auto p-4 sm:p-6 pb-28 space-y-6 select-none transition-colors duration-300 ${
        isDark ? 'bg-[#0B081B] text-[#F8F7FF]' : 'bg-[#F8F6FF] text-slate-900'
      }`}
    >
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div
          className={`rounded-[32px] border p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isDark
              ? 'bg-gradient-to-br from-[#1B153A] via-[#130F2B] to-[#241445] border-[#8957FF]/35 shadow-2xl'
              : 'bg-gradient-to-br from-white via-[#F8F6FF] to-[#FFF0F7] border-[#8957FF]/20 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF4FA3] to-[#FF8066] flex items-center justify-center text-white relative shadow-lg">
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-[#8957FF] text-white text-[10px] font-extrabold border-2 border-[#0B081B]">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Beacon Network Activity & Alerts</h1>
              <p className={`text-xs ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                Friend requests, messages, room invites, SOS alerts & live location events
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="px-3.5 py-2 rounded-xl bg-[#00D6A0]/15 border border-[#00D6A0]/35 text-xs font-extrabold text-[#00D6A0] flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>

            <button
              type="button"
              onClick={handleClearNotifications}
              className="px-3.5 py-2 rounded-xl bg-[#FF4FA3]/15 border border-[#FF4FA3]/35 text-xs font-extrabold text-[#FF4FA3] flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`px-3.5 py-2 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 cursor-pointer ${
                showSettings
                  ? 'bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] border-transparent text-white'
                  : isDark
                    ? 'bg-[#1B153A] border-white/15 text-[#E9DFFF]'
                    : 'bg-[#F3EEFF] border-[#8957FF]/20 text-[#8957FF]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </div>
        </div>

        {/* Collapsible Notification Settings Panel */}
        {showSettings && (
          <div
            className={`rounded-3xl border p-5 space-y-4 ${
              isDark ? 'bg-[#130F2B] border-[#8957FF]/35' : 'bg-white border-[#8957FF]/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold">Notification & Audio Preferences</h3>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                  isDark ? 'bg-[#1B153A] border-white/10' : 'bg-[#F8F6FF] border-[#8957FF]/15'
                }`}
              >
                <div>
                  <span className="text-xs font-extrabold block">System Push Notifications</span>
                  <span className={`text-[11px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                    Status: <strong className="text-[#00D9FF] uppercase">{browserPermission}</strong>
                  </span>
                </div>
                {browserPermission !== 'granted' ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await notifications.requestPermission();
                      setBrowserPermission(ok ? 'granted' : 'denied');
                      if (ok) toast.success('Push notifications enabled');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white text-xs font-extrabold cursor-pointer"
                  >
                    Enable
                  </button>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-[#00D6A0]/15 text-[#00D6A0] text-[11px] font-extrabold">
                    Active
                  </span>
                )}
              </div>

              <div
                className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                  isDark ? 'bg-[#1B153A] border-white/10' : 'bg-[#F8F6FF] border-[#8957FF]/15'
                }`}
              >
                <div>
                  <span className="text-xs font-extrabold block">Beacon Network Audio & Chimes</span>
                  <span className={`text-[11px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                    Message & SOS alert audio effects
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextMuted = sound.toggleMute();
                    setSoundEnabled(!nextMuted);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer ${
                    soundEnabled
                      ? 'bg-[#00D6A0]/20 text-[#00D6A0] border border-[#00D6A0]/40'
                      : 'bg-slate-500/20 text-slate-400'
                  }`}
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  <span>{soundEnabled ? 'Sound On' : 'Muted'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Category Filter Tabs */}
        <div className="flex items-center justify-between gap-2">
          <div
            className={`flex p-1.5 border rounded-2xl overflow-x-auto gap-1 ${
              isDark
                ? 'bg-[#130F2B] border-white/10'
                : 'bg-white border-[#8957FF]/15 shadow-xs'
            }`}
          >
            {[
              { id: 'all', label: 'All' },
              { id: 'friend_request', label: 'Friend Requests' },
              { id: 'message', label: 'Messages' },
              { id: 'room', label: 'Rooms' },
              { id: 'emergency', label: 'SOS Alerts' },
              { id: 'location', label: 'Location Events' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                  filter === tab.id
                    ? 'bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] text-white shadow-sm'
                    : isDark
                      ? 'text-[#A9A2D0] hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadNotificationsData}
            className={`p-2.5 rounded-xl border cursor-pointer shrink-0 ${
              isDark
                ? 'bg-[#130F2B] border-white/10 text-[#A9A2D0] hover:text-[#00D9FF]'
                : 'bg-white border-[#8957FF]/15 text-slate-600 hover:text-[#8957FF]'
            }`}
            title="Refresh Notifications"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#FF4FA3]' : ''}`} />
          </button>
        </div>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <div
            className={`rounded-[32px] border p-10 text-center space-y-2 ${
              isDark
                ? 'bg-[#130F2B]/85 border-white/10'
                : 'bg-white border-[#8957FF]/15 shadow-sm'
            }`}
          >
            <Bell className="w-10 h-10 text-[#FF4FA3] mx-auto opacity-80" />
            <h3 className="text-sm font-extrabold">No Notifications Here</h3>
            <p className={`text-xs ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
              You're all caught up! New friend requests, messages, room updates, and location events will appear here in real time.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredNotifications.map((item) => {
              const Icon =
                item.category === 'emergency'
                  ? Siren
                  : item.category === 'friend_request'
                    ? Users
                    : item.category === 'message'
                      ? MessageSquare
                      : item.category === 'room'
                        ? Shield
                        : MapPin;

              return (
                <div
                  key={item.id}
                  onClick={() => handleMarkAsRead(item.id)}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer ${
                    item.unread
                      ? isDark
                        ? 'bg-[#1B153A] border-[#FF4FA3]/50 shadow-lg'
                        : 'bg-white border-[#FF4FA3]/45 shadow-md'
                      : isDark
                        ? 'bg-[#130F2B]/85 border-white/10 opacity-85 hover:opacity-100'
                        : 'bg-white/85 border-[#8957FF]/15 opacity-85 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: `${item.accentColor}20`,
                        borderColor: `${item.accentColor}45`,
                        color: item.accentColor,
                      }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.unread && (
                          <span className="w-2 h-2 rounded-full bg-[#FF4FA3] shadow-[0_0_8px_#FF4FA3]" />
                        )}
                        <span className="text-xs font-extrabold">{item.title}</span>
                        <span
                          className={`text-[10px] font-mono ${
                            isDark ? 'text-[#A9A2D0]' : 'text-slate-400'
                          }`}
                        >
                          {formatTimeAgo(item.timestamp)}
                        </span>
                      </div>
                      <p
                        className={`text-xs mt-0.5 leading-relaxed ${
                          isDark ? 'text-[#A9A2D0]' : 'text-slate-600'
                        }`}
                      >
                        {item.body}
                      </p>
                    </div>
                  </div>

                  {/* Contextual Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {item.category === 'friend_request' && item.requestId && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleRespondFriendRequest(item.requestId!, 'accepted', item.id);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleRespondFriendRequest(item.requestId!, 'denied', item.id);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#FF4FA3]/15 border border-[#FF4FA3]/40 text-[#FF4FA3] text-xs font-extrabold cursor-pointer"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {item.category === 'message' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(item.id);
                          if (item.roomId) {
                            onOpenRoom(item.roomId);
                          } else if (item.senderId) {
                            onSelectUserForChat({
                              id: item.senderId,
                              name: item.senderName || 'Friend',
                              avatar: item.senderAvatar || '',
                            });
                          } else {
                            onNavigateTab('chat');
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#8957FF] to-[#397BFF] text-white text-xs font-extrabold cursor-pointer"
                      >
                        Reply
                      </button>
                    )}

                    {item.category === 'room' && item.roomId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenRoom(item.roomId!);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-[#8957FF]/20 border border-[#8957FF]/40 text-[#8957FF] dark:text-[#E9DFFF] text-xs font-extrabold cursor-pointer"
                      >
                        Open Room
                      </button>
                    )}

                    {(item.category === 'emergency' || item.category === 'location') &&
                      item.latitude != null &&
                      item.longitude != null && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(item.id);
                            onFocusMapLocation(item.latitude!, item.longitude!);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Locate</span>
                        </button>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
