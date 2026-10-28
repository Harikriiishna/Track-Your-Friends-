import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext.tsx';
import type {
  UserLocation,
  ChatMessage,
  EmergencyAlert,
  WsClientMessage,
  WsServerMessage,
  UserProfile,
} from '../types.ts';
import { calculateDistanceMeters } from '../utils/geo.ts';
import { sound } from '../utils/audio.ts';
import { api } from '../utils/api.ts';
import { localBackend } from '../utils/localBackend.ts';
import { notifications } from '../utils/notifications.ts';
import { getProductionWsUrl, syncLogger, type RealtimeDiagnosticState } from '../config/env.ts';
import { getCloudDatabaseHealth } from '../utils/cloudSync.ts';
import { checkBackendConnectivity } from '../utils/connectivity.ts';

interface VoiceParticipant {
  peerId: string;
  user: UserProfile;
  isSpeaking: boolean;
}

export interface LocationDebugTelemetry {
  rawFix: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    timestamp: number;
  } | null;
  sentToDb: {
    geog: string;
    accuracy_m: number;
    latitude: number;
    longitude: number;
  } | null;
  readFromDb: {
    lat: number;
    lng: number;
    accuracy_m: number;
    updated_at: string;
  } | null;
  markerLatLng: [number, number] | null;
  lastGeoError: {
    code: number;
    message: string;
  } | null;
}

interface RealtimeContextType {
  isConnected: boolean;
  wsConnected: boolean;
  realtimeState: RealtimeDiagnosticState;
  connectionError: string | null;
  clearConnectionError: () => void;
  myLocation: UserLocation | null;
  gpsAccuracy: number | null;
  isGpsActive: boolean;
  gpsError: string | null;
  locationStatus: string;
  debugTelemetry: LocationDebugTelemetry;
  setDebugMarkerLatLng: (coords: [number, number] | null) => void;
  simulatePositionFix: (pos: { latitude: number; longitude: number; accuracy: number | null; timestamp?: number }) => void;
  gpsPermissionState: 'prompt' | 'granted' | 'denied';
  userLocations: UserLocation[];
  onlineUserIds: string[];
  activeAlerts: EmergencyAlert[];
  latestAlert: EmergencyAlert | null;
  triggerEmergencySos: (message: string, roomId?: string) => void;
  acknowledgeEmergency: (alertId: string) => void;
  deleteEmergencyAlert: (alertId: string) => Promise<void>;
  dismissLatestAlert: () => void;
  // Chat real-time
  chatMessages: Record<string, ChatMessage[]>; // roomId or recipientId -> messages
  typingUsers: Record<string, { userId: string; name: string }>; // roomId/recipientId -> user
  sendMessage: (data: { roomId?: string; channelId?: string; recipientId?: string; text: string; attachments?: ChatMessage['attachments']; replyToId?: string; clientMsgId?: string }) => void;
  setConversationMessages: (key: string, messages: ChatMessage[]) => void;
  sendTyping: (data: { roomId?: string; recipientId?: string; isTyping: boolean }) => void;
  sendReaction: (messageId: string, emoji: string) => void;
  deleteMessage: (messageId: string) => void;
  clearChat: (roomId?: string, recipientId?: string) => Promise<void>;
  editMessage: (messageId: string, text: string) => void;
  // Voice Channel
  activeVoiceRoomId: string | null;
  isVoiceConnected: boolean;
  isMicMuted: boolean;
  isSpeaking: boolean;
  voiceParticipants: VoiceParticipant[];
  joinVoiceChannel: (roomId: string) => Promise<void>;
  leaveVoiceChannel: () => void;
  toggleMicMute: () => void;
  // Manual GPS refresh & pinpoint override
  requestLocationUpdate: () => void;
  setManualLocation: (latitude: number, longitude: number, accuracy?: number) => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

// Free STUN servers for WebRTC audio
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();

  const [isConnected, setIsConnected] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [realtimeState, setRealtimeState] = useState<RealtimeDiagnosticState>('REALTIME_DISCONNECTED');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const clearConnectionError = useCallback(() => setConnectionError(null), []);
  const [myLocation, setMyLocation] = useState<UserLocation | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('Waiting for location');
  const [gpsPermissionState, setGpsPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<EmergencyAlert[]>([]);
  const [latestAlert, setLatestAlert] = useState<EmergencyAlert | null>(null);
  const [debugTelemetry, setDebugTelemetry] = useState<LocationDebugTelemetry>({
    rawFix: null,
    sentToDb: null,
    readFromDb: null,
    markerLatLng: null,
    lastGeoError: null,
  });

  const setDebugMarkerLatLng = useCallback((coords: [number, number] | null) => {
    setDebugTelemetry((prev) => {
      if (
        prev.markerLatLng?.[0] === coords?.[0] &&
        prev.markerLatLng?.[1] === coords?.[1]
      ) {
        return prev;
      }
      return { ...prev, markerLatLng: coords };
    });
  }, []);

  // Chat state
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, { userId: string; name: string }>>({});

  // Voice state
  const [activeVoiceRoomId, setActiveVoiceRoomId] = useState<string | null>(null);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([]);

  // Refs for WebSockets, WebRTC, Audio
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastLocationSentRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const myLocationRef = useRef<UserLocation | null>(null);
  myLocationRef.current = myLocation;
  const hasPreciseFixRef = useRef<boolean>(false);
  const notifiedAlertIdsRef = useRef<Set<string>>(new Set());
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const initializedMsgSyncRef = useRef<boolean>(false);

  // Evaluate incoming emergency alert and trigger device pop-up notification for users within 5 km
  const handleIncomingEmergencyAlert = useCallback(
    (alert: EmergencyAlert) => {
      setActiveAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)]);
      if (alert.status !== 'active') return;

      const myLoc = myLocationRef.current;
      const hasValidAlertCoords =
        Number.isFinite(alert.latitude) &&
        Number.isFinite(alert.longitude) &&
        !(alert.latitude === 0 && alert.longitude === 0);
      const hasValidMyCoords =
        Boolean(myLoc) &&
        Number.isFinite(myLoc!.latitude) &&
        Number.isFinite(myLoc!.longitude);

      const distanceMeters =
        hasValidAlertCoords && hasValidMyCoords
          ? calculateDistanceMeters(
              myLoc!.latitude,
              myLoc!.longitude,
              alert.latitude,
              alert.longitude
            )
          : null;

      // Trigger pop-up device notification & siren if user is within 5 km (5000m) of the alert (or is sender / awaiting GPS)
      const isWithin5km =
        alert.senderId === user?.id ||
        distanceMeters === null ||
        distanceMeters <= 5000;

      if (isWithin5km && !notifiedAlertIdsRef.current.has(alert.id)) {
        notifiedAlertIdsRef.current.add(alert.id);
        setLatestAlert(alert);
        sound.startEmergencySiren();
        notifications.notifyEmergency(alert.senderName, alert.message, {
          latitude: alert.latitude,
          longitude: alert.longitude,
          accuracy: alert.accuracy,
          distanceMeters,
        });
      }
    },
    [user?.id]
  );

  // Send WebSocket message helper
  const sendWs = useCallback((msg: WsClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Initialize and maintain WebSocket + Cloud Firestore Real-Time Synchronization
  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    let isMounted = true;
    const currentUserId = user.id;

    const msgSignature = (m: ChatMessage) =>
      `${m.id}|${m.text}|${m.isEdited ? 1 : 0}|${m.isDeleted ? 1 : 0}|${Object.keys(m.reactions || {}).length}`;

    // Sync messages from localBackend / Cloud Firestore into React state and notify on new peer messages
    const syncMessagesFromStore = () => {
      if (!isMounted) return;
      const allMsgs = localBackend.getAllMessages();
      const grouped: Record<string, ChatMessage[]> = {};
      const nowMs = Date.now();

      for (const m of allMsgs) {
        if (!m || !m.id || m.isDeleted) continue;
        let key: string | undefined;
        if (m.roomId) {
          key = m.roomId;
        } else if (m.senderId === currentUserId && m.recipientId) {
          key = m.recipientId;
        } else if (m.recipientId === currentUserId && m.senderId) {
          key = m.senderId;
        }
        if (!key) continue;

        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(m);

        if (!seenMessageIdsRef.current.has(m.id)) {
          seenMessageIdsRef.current.add(m.id);
          if (initializedMsgSyncRef.current && m.senderId !== currentUserId) {
            const msgAgeMs = nowMs - (new Date(m.createdAt || 0).getTime() || 0);
            if (msgAgeMs >= -10000 && msgAgeMs <= 30000) {
              sound.playChime();
              notifications.notifyMessage(m.senderName, m.text);
            }
          }
        }
      }
      initializedMsgSyncRef.current = true;

      setChatMessages((prev) => {
        let changed = false;
        const next: Record<string, ChatMessage[]> = { ...prev };
        for (const [k, incomingList] of Object.entries(grouped)) {
          const existing = next[k] || [];
          const map = new Map<string, ChatMessage>();
          for (const item of existing) {
            if (item && item.id && !item.isDeleted) map.set(item.id, item);
          }
          for (const item of incomingList) {
            if (item && item.id && !item.isDeleted) map.set(item.id, item);
          }
          const merged = Array.from(map.values()).sort(
            (a, b) =>
              (new Date(a.createdAt || 0).getTime() || 0) -
              (new Date(b.createdAt || 0).getTime() || 0)
          );
          if (
            merged.length !== existing.length ||
            merged.some((m, idx) => msgSignature(m) !== msgSignature(existing[idx]))
          ) {
            next[k] = merged;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    };

    const applyAlertsList = (alerts: EmergencyAlert[]) => {
      if (!isMounted || !Array.isArray(alerts)) return;
      setActiveAlerts((prev) => {
        const prevSig = prev.map((a) => `${a.id}:${a.status}:${a.acknowledgedBy?.length || 0}`).join('|');
        const nextSig = alerts.map((a) => `${a.id}:${a.status}:${a.acknowledgedBy?.length || 0}`).join('|');
        return prevSig === nextSig ? prev : alerts;
      });
      alerts.forEach((a) => {
        if (a.status === 'active' && !notifiedAlertIdsRef.current.has(a.id)) {
          handleIncomingEmergencyAlert(a);
        }
      });
    };

    const applyLocationsList = (locations: UserLocation[]) => {
      if (!isMounted || !Array.isArray(locations)) return;
      const ownRow = locations.find((l) => l.userId === currentUserId);
      if (ownRow) {
        setDebugTelemetry((prev) => {
          const nextLat = ownRow.lat ?? ownRow.latitude;
          const nextLng = ownRow.lng ?? ownRow.longitude;
          const nextAcc = ownRow.accuracy_m ?? ownRow.accuracy;
          const nextUpd = ownRow.updated_at ?? ownRow.timestamp;
          if (
            prev.readFromDb?.lat === nextLat &&
            prev.readFromDb?.lng === nextLng &&
            prev.readFromDb?.accuracy_m === nextAcc &&
            prev.readFromDb?.updated_at === nextUpd
          ) {
            return prev;
          }
          return {
            ...prev,
            readFromDb: {
              lat: nextLat,
              lng: nextLng,
              accuracy_m: nextAcc,
              updated_at: nextUpd,
            },
          };
        });
      }
      const peersOnly = locations.filter((l) => l.userId !== currentUserId);
      const nextList = myLocationRef.current
        ? [...peersOnly, myLocationRef.current]
        : locations;

      setUserLocations((prev) => {
        if (prev.length === nextList.length) {
          const isSame = prev.every((p, idx) => {
            const n = nextList[idx];
            return (
              p.userId === n.userId &&
              p.latitude === n.latitude &&
              p.longitude === n.longitude &&
              p.accuracy === n.accuracy &&
              p.heading === n.heading &&
              (p.updated_at || p.timestamp) === (n.updated_at || n.timestamp)
            );
          });
          if (isSame) return prev;
        }
        return nextList;
      });

      const activeFromStore = localBackend.getActiveOnlineUserIds(currentUserId);
      setOnlineUserIds((prev) => {
        const mergedSet = new Set([
          ...prev,
          currentUserId,
          ...activeFromStore,
          ...nextList.map((l) => l.userId),
        ]);
        const nextIds = Array.from(mergedSet);
        if (prev.length === nextIds.length && prev.every((id) => mergedSet.has(id))) {
          return prev;
        }
        return nextIds;
      });
    };

    const syncFromLocalSnapshot = () => {
      if (!isMounted) return;
      syncMessagesFromStore();
      applyLocationsList(localBackend.getLiveLocationsSnapshot(currentUserId));
      applyAlertsList(localBackend.getActiveAlertsSnapshot());
    };

    const syncFromRemoteApi = () => {
      if (!isMounted) return;
      syncMessagesFromStore();
      api
        .get<{ locations: UserLocation[] }>('/api/locations/live')
        .then((res) => {
          if (res?.locations) applyLocationsList(res.locations);
        })
        .catch(() => {
          applyLocationsList(localBackend.getLiveLocationsSnapshot(currentUserId));
        });
      api
        .get<{ alerts: EmergencyAlert[] }>('/api/alerts/active')
        .then((res) => {
          if (res?.alerts) applyAlertsList(res.alerts);
        })
        .catch(() => {
          applyAlertsList(localBackend.getActiveAlertsSnapshot());
        });
    };

    // Initial sync on mount
    setRealtimeState('REALTIME_CONNECTING');
    syncLogger.log('ws', 'info', 'REALTIME_CONNECTING');
    setIsConnected(true);
    syncFromLocalSnapshot();
    void localBackend.forceSyncNow().then((synced) => {
      if (synced && isMounted) {
        setRealtimeState('REALTIME_CONNECTED');
        syncLogger.log('firestore', 'info', 'REALTIME_CONNECTED', { transport: 'firestore_sync' });
      }
      syncFromRemoteApi();
    });

    // Listen to immediate Cloud Firestore sync updates (only fires when remote state actually changed)
    const onCloudSyncUpdated = () => {
      if (!isMounted) return;
      setRealtimeState('REALTIME_CONNECTED');
      syncFromLocalSnapshot();
    };
    window.addEventListener('beacon:cloud-sync-updated', onCloudSyncUpdated);

    let heartbeatTimer: any = null;

    async function connect(isReconnect = false) {
      if (!isMounted) return;
      const nextState: RealtimeDiagnosticState = isReconnect
        ? 'REALTIME_RECONNECTING'
        : 'REALTIME_CONNECTING';
      syncLogger.log('ws', 'info', nextState);
      if (!getCloudDatabaseHealth().connected) {
        setRealtimeState(nextState);
      }

      // Run strict 5-second health check before attempting WebSocket initialization
      const healthResult = await checkBackendConnectivity();
      if (!isMounted) return;

      if (!healthResult.ok) {
        const errMsg =
          healthResult.error ||
          'Unable to reach the production backend health endpoint. Please check your connection.';
        setConnectionError(errMsg);
        setWsConnected(false);
        const dbConnected = getCloudDatabaseHealth().connected;
        setRealtimeState(dbConnected ? 'REALTIME_CONNECTED' : 'REALTIME_ERROR');
        setIsConnected(dbConnected || api.isUsingLocalBackend());
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          void connect(true);
        }, 10000);
        return;
      }

      setConnectionError(null);

      if (api.isUsingLocalBackend()) {
        setIsConnected(true);
        if (getCloudDatabaseHealth().connected) {
          setRealtimeState('REALTIME_CONNECTED');
        }
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          void connect(true);
        }, 10000);
        return;
      }

      const wsUrl = getProductionWsUrl();
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (err: any) {
        syncLogger.log('ws', 'warn', 'REALTIME_ERROR', { error: err?.message });
        setConnectionError(err?.message || 'Failed to initialize WebSocket connection.');
        setWsConnected(false);
        setRealtimeState(getCloudDatabaseHealth().connected ? 'REALTIME_CONNECTED' : 'REALTIME_ERROR');
        setIsConnected(true);
        return;
      }

      ws.onopen = () => {
        if (!isMounted) return;
        setConnectionError(null);
        setIsConnected(true);
        setWsConnected(true);
        setRealtimeState('REALTIME_CONNECTED');
        syncLogger.log('ws', 'info', 'REALTIME_CONNECTED', { url: wsUrl });
        ws.send(JSON.stringify({ type: 'auth', token, userId: user.id, email: user.email }));

        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: 'ping' }));
            } catch {}
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data: WsServerMessage = JSON.parse(event.data);
          if ((data as any).type === 'pong') return;
          if ((data as any).type === 'auth:success') {
            // Restore room subscriptions automatically after connect/reconnect
            try {
              const joinedRooms = localBackend.getUserRooms(currentUserId);
              for (const r of joinedRooms) {
                if (r?.id && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'room:join', roomId: r.id }));
                }
              }
            } catch {}
          }
          handleServerMessage(data);
        } catch (e) {
          console.error('Error handling WS message:', e);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        setWsConnected(false);
        syncLogger.log('ws', 'info', 'REALTIME_DISCONNECTED');
        const dbConnected = getCloudDatabaseHealth().connected;
        setRealtimeState(dbConnected ? 'REALTIME_CONNECTED' : 'REALTIME_RECONNECTING');
        setIsConnected(true);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          void connect(true);
        }, 5000);
      };

      ws.onerror = () => {
        syncLogger.log('ws', 'warn', 'REALTIME_ERROR');
        try {
          ws.close();
        } catch {}
      };

      socketRef.current = ws;
    }

    void connect(false);

    // App Lifecycle & Network Reconnection Handlers (Foreground resume, unlock screen, Wi-Fi <-> Cellular switch)
    const handleLifecycleResume = () => {
      if (!isMounted) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      syncLogger.log('lifecycle', 'info', 'REALTIME_RECONNECTING');
      setIsConnected(true);
      void localBackend.forceSyncNow().then(() => {
        syncFromRemoteApi();
      });
      if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        connect(true);
      }
    };

    const handleNetworkOffline = () => {
      if (!isMounted) return;
      setWsConnected(false);
      setIsConnected(false);
      setConnectionError('Device is offline. Waiting for network connection...');
      setRealtimeState('REALTIME_DISCONNECTED');
      syncLogger.log('lifecycle', 'warn', 'REALTIME_DISCONNECTED', { reason: 'network_offline' });
    };

    window.addEventListener('online', handleLifecycleResume);
    window.addEventListener('offline', handleNetworkOffline);
    window.addEventListener('focus', handleLifecycleResume);
    document.addEventListener('visibilitychange', handleLifecycleResume);

    return () => {
      isMounted = false;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      window.removeEventListener('beacon:cloud-sync-updated', onCloudSyncUpdated);
      window.removeEventListener('online', handleLifecycleResume);
      window.removeEventListener('offline', handleNetworkOffline);
      window.removeEventListener('focus', handleLifecycleResume);
      document.removeEventListener('visibilitychange', handleLifecycleResume);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [token, user?.id, handleIncomingEmergencyAlert]);

  // Handle incoming Server WebSocket messages
  const handleServerMessage = (data: WsServerMessage) => {
    switch (data.type) {
      case 'presence:update': {
        const cleanedLocations = data.userLocations.filter(
          (l) =>
            Number.isFinite(l.latitude) &&
            Number.isFinite(l.longitude) &&
            Number.isFinite(l.accuracy) &&
            l.accuracy <= 100 &&
            (l.userId !== user?.id || Boolean(myLocationRef.current))
        );
        const ownDbRow = data.userLocations.find((l) => l.userId === user?.id);
        if (ownDbRow) {
          setDebugTelemetry((prev) => ({
            ...prev,
            readFromDb: {
              lat: ownDbRow.lat ?? ownDbRow.latitude,
              lng: ownDbRow.lng ?? ownDbRow.longitude,
              accuracy_m: ownDbRow.accuracy_m ?? ownDbRow.accuracy,
              updated_at: ownDbRow.updated_at ?? ownDbRow.timestamp,
            },
          }));
        }
        if (myLocationRef.current && user) {
          const withoutMe = cleanedLocations.filter((l) => l.userId !== user.id);
          setUserLocations([...withoutMe, myLocationRef.current]);
        } else {
          setUserLocations(cleanedLocations);
        }
        setOnlineUserIds(data.onlineUsers);
        break;
      }

      case 'location:broadcast': {
        const loc = data.location;
        if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude) || loc.accuracy > 100) {
          break;
        }
        if (loc.userId === user?.id) {
          setDebugTelemetry((prev) => ({
            ...prev,
            readFromDb: {
              lat: loc.lat ?? loc.latitude,
              lng: loc.lng ?? loc.longitude,
              accuracy_m: loc.accuracy_m ?? loc.accuracy,
              updated_at: loc.updated_at ?? loc.timestamp,
            },
          }));
          myLocationRef.current = loc;
          setMyLocation(loc);
        }
        setUserLocations((prev) => {
          const idx = prev.findIndex((l) => l.userId === loc.userId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = loc;
            return next;
          }
          return [...prev, loc];
        });
        break;
      }

      case 'chat:message': {
        const key = data.message.roomId || (data.message.senderId === user?.id ? data.message.recipientId : data.message.senderId) || 'room-universal';
        setChatMessages((prev) => {
          const list = prev[key] || [];
          if (list.some((m) => m.id === data.message.id)) return prev;
          return { ...prev, [key]: [...list, data.message] };
        });
        sound.playChime();
        if (data.message.senderId !== user?.id) {
          notifications.notifyMessage(data.message.senderName, data.message.text);
        }
        break;
      }

      case 'chat:typing': {
        const key = data.roomId || data.senderId;
        if (data.isTyping) {
          setTypingUsers((prev) => ({ ...prev, [key]: { userId: data.senderId, name: data.senderName } }));
          if ((window as any)[`typing_timeout_${key}`]) {
            clearTimeout((window as any)[`typing_timeout_${key}`]);
          }
          (window as any)[`typing_timeout_${key}`] = setTimeout(() => {
            setTypingUsers((prev) => {
              const copy = { ...prev };
              delete copy[key];
              return copy;
            });
          }, 4000);
        } else {
          setTypingUsers((prev) => {
            const copy = { ...prev };
            delete copy[key];
            return copy;
          });
          if ((window as any)[`typing_timeout_${key}`]) {
            clearTimeout((window as any)[`typing_timeout_${key}`]);
          }
        }
        break;
      }

      case 'chat:message_updated': {
        const msg = data.message;
        const key = msg.roomId || msg.recipientId || msg.senderId;
        setChatMessages((prev) => {
          const list = prev[key] || [];
          return {
            ...prev,
            [key]: list.map((m) => (m.id === msg.id ? msg : m)),
          };
        });
        break;
      }

      case 'chat:message_deleted': {
        setChatMessages((prev) => {
          const next: Record<string, ChatMessage[]> = {};
          for (const [k, list] of Object.entries(prev)) {
            next[k] = list.filter((m) => m.id !== data.messageId);
          }
          return next;
        });
        break;
      }

      case 'chat:cleared': {
        const key = data.roomId || data.partnerId;
        if (key) {
          setChatMessages((prev) => ({ ...prev, [key]: [] }));
        }
        break;
      }

      case 'emergency:broadcast': {
        handleIncomingEmergencyAlert(data.alert);
        break;
      }

      case 'emergency:ack_update': {
        setActiveAlerts((prev) => prev.map((a) => (a.id === data.alert.id ? data.alert : a)));
        if (latestAlert?.id === data.alert.id) {
          setLatestAlert(data.alert);
        }
        break;
      }

      case 'emergency:deleted': {
        setActiveAlerts((prev) => prev.filter((a) => a.id !== data.alertId));
        if (latestAlert?.id === data.alertId) {
          sound.stopEmergencySiren();
          setLatestAlert(null);
        }
        break;
      }

      // WebRTC Live Voice Events
      case 'voice:participants': {
        setVoiceParticipants(data.participants);
        break;
      }

      case 'voice:peer_joined': {
        setVoiceParticipants((prev) => {
          if (prev.some((p) => p.peerId === data.peerId)) return prev;
          return [...prev, { peerId: data.peerId, user: data.user, isSpeaking: false }];
        });
        // As an existing member, create offer to new peer
        initiatePeerConnection(data.peerId, true);
        break;
      }

      case 'voice:peer_left': {
        setVoiceParticipants((prev) => prev.filter((p) => p.peerId !== data.peerId));
        closePeerConnection(data.peerId);
        break;
      }

      case 'voice:signal': {
        handlePeerSignal(data.fromPeerId, data.data);
        break;
      }

      case 'voice:speaking_update': {
        setVoiceParticipants((prev) =>
          prev.map((p) => (p.peerId === data.peerId ? { ...p, isSpeaking: data.isSpeaking } : p))
        );
        break;
      }
    }
  };

  // Step 3b & 3c: Strict position validation & database persistence
  const MAX_ACCURACY_M = 100;

  const processPositionFix = useCallback(
    (
      pos: {
        coords: {
          latitude: number;
          longitude: number;
          accuracy: number | null;
          altitude?: number | null;
          heading?: number | null;
          speed?: number | null;
        };
        timestamp: number;
      },
      forceBroadcast = false
    ) => {
      if (!user) return;
      const { latitude, longitude, accuracy } = pos.coords;

      // Always record raw fix in debug telemetry (Step 1) before filtering
      setDebugTelemetry((prev) => ({
        ...prev,
        rawFix: {
          latitude,
          longitude,
          accuracy: accuracy ?? null,
          timestamp: pos.timestamp,
        },
      }));

      // Step 3b: Reject poor or invalid fixes EVERY time, including the FIRST one
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;
      if (Date.now() - pos.timestamp > 30000) return; // stale fix (> 30s)
      if (accuracy == null || !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > MAX_ACCURACY_M) {
        // Too coarse: do NOT send to database and do NOT place marker
        setLocationStatus('Waiting for a precise location...');
        return;
      }

      hasPreciseFixRef.current = true;
      const altitude = pos.coords.altitude ?? null;
      const heading = pos.coords.heading ?? null;
      const speed = pos.coords.speed ?? null;

      setGpsAccuracy(accuracy);
      setIsGpsActive(true);
      setGpsPermissionState('granted');
      setGpsError(null);
      setLocationStatus('Live');

      // Step 3c: Send coordinates in the correct order (PostGIS WKT: POINT(longitude latitude)),
      // and do NOT send updated_at (the database/server sets it).
      const geog = `SRID=4326;POINT(${longitude} ${latitude})`;
      const accuracy_m = accuracy;

      setDebugTelemetry((prev) => ({
        ...prev,
        sentToDb: {
          geog,
          accuracy_m,
          latitude,
          longitude,
        },
      }));

      const now = Date.now();
      const last = lastLocationSentRef.current;
      const shouldSend =
        forceBroadcast ||
        !last ||
        now - last.time > 5000 ||
        calculateDistanceMeters(last.lat, last.lng, latitude, longitude) >= 1;

      // Optimistically update local state until server responds with server-generated updated_at
      const existingServerTs = myLocationRef.current?.updated_at || myLocationRef.current?.timestamp || new Date().toISOString();
      const localLoc: UserLocation = {
        userId: user.id,
        username: user.username,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        markerColor: user.markerColor,
        markerIcon: user.markerIcon,
        markerLabel: user.markerLabel,
        latitude,
        longitude,
        accuracy,
        lat: latitude,
        lng: longitude,
        accuracy_m,
        geog,
        updated_at: existingServerTs,
        altitude,
        heading,
        speed,
        timestamp: existingServerTs,
      };

      myLocationRef.current = localLoc;
      setMyLocation(localLoc);
      setUserLocations((prev) => {
        const idx = prev.findIndex((l) => l.userId === user.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = localLoc;
          return next;
        }
        return [...prev, localLoc];
      });

      try {
        window.dispatchEvent(
          new CustomEvent('beacon:gps-fix', {
            detail: {
              ...localLoc,
              isRealGps: true,
              isHighAccuracySource: true,
              forceCenter: forceBroadcast,
            },
          })
        );
      } catch {}

      if (shouldSend) {
        lastLocationSentRef.current = { lat: latitude, lng: longitude, time: now };

        // Send via HTTP REST API so we always read back the saved database row (lat, lng, accuracy_m, updated_at)
        api
          .post<{ location: UserLocation }>('/api/locations/update', {
            geog,
            accuracy_m,
            latitude,
            longitude,
            accuracy,
            altitude,
            heading,
            speed,
          })
          .then((res) => {
            if (res?.location) {
              const saved = res.location;
              setDebugTelemetry((prev) => ({
                ...prev,
                readFromDb: {
                  lat: saved.lat ?? saved.latitude,
                  lng: saved.lng ?? saved.longitude,
                  accuracy_m: saved.accuracy_m ?? saved.accuracy,
                  updated_at: saved.updated_at ?? saved.timestamp,
                },
              }));
              myLocationRef.current = saved;
              setMyLocation(saved);
              setUserLocations((prev) => {
                const idx = prev.findIndex((l) => l.userId === saved.userId);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = saved;
                  return next;
                }
                return [...prev, saved];
              });
            }
          })
          .catch(() => {});

        // Also send over WebSocket if connected for low-latency room broadcast
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          sendWs({
            type: 'location:update',
            location: {
              geog,
              accuracy_m,
              latitude,
              longitude,
              accuracy,
              altitude,
              heading,
              speed,
            },
          });
        }
      }
    },
    [user, sendWs]
  );

  // Step 3f: Handle geolocation errors with exact messages and never silently fall back
  const handleGeolocationError = useCallback((err: { code: number; message: string }) => {
    setDebugTelemetry((prev) => ({
      ...prev,
      lastGeoError: {
        code: err.code,
        message: err.message || 'Geolocation error',
      },
    }));

    let userMessage = "Your device can't determine its location right now.";
    if (err.code === 1) {
      userMessage = 'Location permission is blocked. Enable it in browser site settings.';
      setGpsPermissionState('denied');
      setIsGpsActive(false);
    } else if (err.code === 2) {
      userMessage = "Your device can't determine its location right now.";
      setIsGpsActive(false);
    } else if (err.code === 3) {
      userMessage = 'Getting your location took too long. Retrying.';
    }

    setGpsError(userMessage);
    setLocationStatus(userMessage);
  }, []);

  // Expose simulation helper for Step 4 verification & ?debug=1 testing
  const simulatePositionFix = useCallback(
    (pos: { latitude: number; longitude: number; accuracy: number | null; timestamp?: number }) => {
      processPositionFix(
        {
          coords: {
            latitude: pos.latitude,
            longitude: pos.longitude,
            accuracy: pos.accuracy,
          },
          timestamp: pos.timestamp ?? Date.now(),
        },
        true
      );
    },
    [processPositionFix]
  );

  useEffect(() => {
    (window as any).__beaconSimulateFix = simulatePositionFix;
    return () => {
      delete (window as any).__beaconSimulateFix;
    };
  }, [simulatePositionFix]);

  // Pinpoint manual location calibration (when user drags Blue Dot or taps "Set as My Location" on map)
  const setManualLocation = useCallback(
    (latitude: number, longitude: number, accuracy = 5) => {
      if (!user) return;
      processPositionFix(
        {
          coords: {
            latitude,
            longitude,
            accuracy,
          },
          timestamp: Date.now(),
        },
        true
      );
    },
    [user, processPositionFix]
  );

  // Step 3a & 3b: Real High-Accuracy GPS Geolocation Watcher (enableHighAccuracy: true, maximumAge: 0, timeout: 15000)
  useEffect(() => {
    if (!user) return;

    try {
      localStorage.removeItem(`beacon_last_location_${user.id}`);
    } catch {}
    hasPreciseFixRef.current = false;
    setLocationStatus('Waiting for location');

    let watchId: number | null = null;
    let preciseTimeoutId: any = null;
    let isCancelled = false;

    const opts: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    };

    const onFix = (pos: GeolocationPosition) => {
      if (isCancelled) return;
      processPositionFix(pos, false);
    };

    const onError = (err: GeolocationPositionError) => {
      if (isCancelled) return;
      handleGeolocationError({ code: err.code, message: err.message });
    };

    // Step 3b: If no fix under 100 m arrives within 30 seconds, inform the user
    preciseTimeoutId = setTimeout(() => {
      if (!isCancelled && !hasPreciseFixRef.current) {
        const msg =
          "Your device can't get a precise location here. Try outdoors or on a phone with GPS.";
        setLocationStatus(msg);
        setGpsError(msg);
      }
    }, 30000);

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(onFix, onError, opts);
    } else {
      handleGeolocationError({
        code: 2,
        message: 'Geolocation API not supported in this browser.',
      });
    }

    // Listen for Native Android Location events from MainActivity (real GPS hardware only)
    const onNativeLocation = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.latitude === 'number') {
        processPositionFix(
          {
            coords: {
              latitude: Number(customEvent.detail.latitude),
              longitude: Number(customEvent.detail.longitude),
              accuracy:
                customEvent.detail.accuracy != null
                  ? Number(customEvent.detail.accuracy)
                  : null,
              altitude: customEvent.detail.altitude ?? null,
              heading: customEvent.detail.heading ?? null,
              speed: customEvent.detail.speed ?? null,
            },
            timestamp: customEvent.detail.timestamp
              ? Number(customEvent.detail.timestamp)
              : Date.now(),
          },
          false
        );
      }
    };

    window.addEventListener('beacon:native-location', onNativeLocation);

    return () => {
      isCancelled = true;
      window.removeEventListener('beacon:native-location', onNativeLocation);
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (preciseTimeoutId) {
        clearTimeout(preciseTimeoutId);
      }
    };
  }, [user?.id, processPositionFix, handleGeolocationError]);

  // Manual GPS refresh & permission trigger (invoked directly from user click gestures)
  const requestLocationUpdate = useCallback(() => {
    if (!user) return;
    setGpsError(null);
    if (!hasPreciseFixRef.current) {
      setLocationStatus('Waiting for location');
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          processPositionFix(pos, true);
        },
        (err) => {
          handleGeolocationError({ code: err.code, message: err.message });
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      );
    } else {
      handleGeolocationError({
        code: 2,
        message: 'Geolocation API not supported in this browser.',
      });
    }

    const androidBridge = (window as any).AndroidLocationBridge;
    if (androidBridge) {
      try {
        const hasPerm =
          typeof androidBridge.hasLocationPermission === 'function'
            ? androidBridge.hasLocationPermission()
            : false;

        if (!hasPerm) {
          if (typeof androidBridge.requestLocationPermission === 'function') {
            androidBridge.requestLocationPermission();
          }
          return;
        }

        if (typeof androidBridge.requestFreshLocation === 'function') {
          androidBridge.requestFreshLocation();
        }
      } catch {}
    }
  }, [user, processPositionFix, handleGeolocationError]);

  // Chat Actions (Always persist through API + Cloud Firestore AND broadcast over WebSocket)
  const sendMessage = useCallback(
    (data: { roomId?: string; channelId?: string; recipientId?: string; text: string; attachments?: ChatMessage['attachments']; replyToId?: string; clientMsgId?: string }) => {
      api
        .post<{ message: ChatMessage }>('/api/messages/create', data)
        .then((res) => {
          if (res?.message) {
            seenMessageIdsRef.current.add(res.message.id);
            const key = res.message.roomId || res.message.recipientId || 'room-universal';
            setChatMessages((prev) => {
              const list = prev[key] || [];
              if (list.some((m) => m.id === res.message.id)) return prev;
              return { ...prev, [key]: [...list, res.message] };
            });
          }
        })
        .catch((e) => console.warn('Message send error:', e));
    },
    []
  );

  const setConversationMessages = useCallback((key: string, messages: ChatMessage[]) => {
    for (const m of messages) {
      if (m?.id) seenMessageIdsRef.current.add(m.id);
    }
    setChatMessages((prev) => {
      const existing = prev[key] || [];
      const map = new Map<string, ChatMessage>();
      for (const item of existing) {
        if (item && item.id && !item.isDeleted) map.set(item.id, item);
      }
      for (const msg of messages) {
        if (msg && msg.id && !msg.isDeleted) map.set(msg.id, msg);
      }
      const merged = Array.from(map.values()).sort(
        (a, b) =>
          (new Date(a.createdAt || 0).getTime() || 0) -
          (new Date(b.createdAt || 0).getTime() || 0)
      );
      if (
        merged.length === existing.length &&
        merged.every(
          (m, idx) =>
            m.id === existing[idx]?.id &&
            m.text === existing[idx]?.text &&
            m.isEdited === existing[idx]?.isEdited &&
            Object.keys(m.reactions || {}).length === Object.keys(existing[idx]?.reactions || {}).length
        )
      ) {
        return prev;
      }
      return { ...prev, [key]: merged };
    });
  }, []);

  const sendTyping = useCallback(
    (data: { roomId?: string; recipientId?: string; isTyping: boolean }) => {
      sendWs({
        type: 'chat:typing',
        roomId: data.roomId,
        recipientId: data.recipientId,
        isTyping: data.isTyping,
      });
    },
    [sendWs]
  );

  const sendReaction = useCallback(
    (messageId: string, emoji: string) => {
      api
        .post<{ message: ChatMessage }>(`/api/messages/${messageId}/react`, { emoji })
        .then((res) => {
          if (res?.message) {
            const key = res.message.roomId || res.message.recipientId || res.message.senderId;
            setChatMessages((prev) => {
              const list = prev[key] || [];
              return { ...prev, [key]: list.map((m) => (m.id === res.message.id ? res.message : m)) };
            });
          }
        })
        .catch(() => {});
    },
    []
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      api
        .delete(`/api/messages/${messageId}`)
        .then(() => {
          setChatMessages((prev) => {
            const next: Record<string, ChatMessage[]> = {};
            for (const [k, list] of Object.entries(prev)) {
              next[k] = list.filter((m) => m.id !== messageId);
            }
            return next;
          });
        })
        .catch(() => {});
    },
    []
  );

  const editMessage = useCallback(
    (messageId: string, text: string) => {
      api
        .put<{ message: ChatMessage }>(`/api/messages/${messageId}/edit`, { text })
        .then((res) => {
          if (res?.message) {
            const key = res.message.roomId || res.message.recipientId || res.message.senderId;
            setChatMessages((prev) => {
              const list = prev[key] || [];
              return { ...prev, [key]: list.map((m) => (m.id === res.message.id ? res.message : m)) };
            });
          }
        })
        .catch(() => {});
    },
    []
  );

  // Emergency SOS Actions
  const triggerEmergencySos = useCallback(
    (message: string, roomId?: string) => {
      const dispatchSos = (lat: number, lng: number, acc: number) => {
        api
          .post<{ alert: EmergencyAlert }>('/api/alerts/emergency', {
            message,
            latitude: lat,
            longitude: lng,
            accuracy: acc,
            roomId,
          })
          .then((res) => {
            if (res?.alert) {
              setActiveAlerts((prev) => [res.alert, ...prev.filter((a) => a.id !== res.alert.id)]);
              setLatestAlert(res.alert);
              sound.startEmergencySiren();
            }
          })
          .catch(() => {});
      };

      const currentLoc = myLocationRef.current;
      if (
        currentLoc &&
        Number.isFinite(currentLoc.latitude) &&
        Number.isFinite(currentLoc.longitude)
      ) {
        dispatchSos(currentLoc.latitude, currentLoc.longitude, currentLoc.accuracy);
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            processPositionFix(pos, true);
            dispatchSos(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
          },
          (err) => {
            handleGeolocationError({ code: err.code, message: err.message });
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
        );
      }
    },
    [processPositionFix, handleGeolocationError]
  );

  const acknowledgeEmergency = useCallback(
    (alertId: string) => {
      api
        .post<{ alert: EmergencyAlert }>(`/api/alerts/emergency/${alertId}/ack`)
        .then((res) => {
          if (res?.alert) {
            setActiveAlerts((prev) => prev.map((a) => (a.id === res.alert.id ? res.alert : a)));
          }
        })
        .catch(() => {});
    },
    []
  );

  const dismissLatestAlert = useCallback(() => {
    sound.stopEmergencySiren();
    setLatestAlert(null);
  }, []);

  const deleteEmergencyAlert = useCallback(async (alertId: string) => {
    try {
      await api.delete(`/api/alerts/emergency/${alertId}`);
      setActiveAlerts((prev) => prev.filter((a) => a.id !== alertId));
      if (latestAlert?.id === alertId) {
        sound.stopEmergencySiren();
        setLatestAlert(null);
      }
    } catch (err: any) {
      console.error('Failed to delete emergency alert:', err);
      throw err;
    }
  }, [latestAlert]);

  const clearChat = useCallback(async (roomId?: string, recipientId?: string) => {
    try {
      if (roomId) {
        await api.delete(`/api/rooms/${roomId}/messages`);
        setChatMessages((prev) => ({ ...prev, [roomId]: [] }));
      } else if (recipientId) {
        await api.delete(`/api/direct-messages/${recipientId}`);
        setChatMessages((prev) => ({ ...prev, [recipientId]: [] }));
      }
    } catch (err: any) {
      console.error('Failed to clear chat:', err);
      throw err;
    }
  }, []);

  // WebRTC Live Voice Channel Implementation
  const initiatePeerConnection = async (targetPeerId: string, isInitiator: boolean) => {
    try {
      let pc = peerConnectionsRef.current.get(targetPeerId);
      if (pc) {
        pc.close();
      }

      pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionsRef.current.set(targetPeerId, pc);

      // Add local audio tracks if stream active
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          pc?.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle remote audio stream
      pc.ontrack = (event) => {
        const remoteAudio = document.createElement('audio');
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.autoplay = true;
        remoteAudio.id = `remote-audio-${targetPeerId}`;
        document.body.appendChild(remoteAudio);
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && activeVoiceRoomId) {
          sendWs({
            type: 'voice:signal',
            roomId: activeVoiceRoomId,
            targetPeerId,
            data: { candidate: event.candidate },
          });
        }
      };

      if (isInitiator && activeVoiceRoomId) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWs({
          type: 'voice:signal',
          roomId: activeVoiceRoomId,
          targetPeerId,
          data: { offer },
        });
      }
    } catch (err) {
      console.error('Error initiating WebRTC connection:', err);
    }
  };

  const handlePeerSignal = async (fromPeerId: string, signalData: any) => {
    try {
      let pc = peerConnectionsRef.current.get(fromPeerId);
      if (!pc) {
        await initiatePeerConnection(fromPeerId, false);
        pc = peerConnectionsRef.current.get(fromPeerId);
      }
      if (!pc) return;

      if (signalData.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (activeVoiceRoomId) {
          sendWs({
            type: 'voice:signal',
            roomId: activeVoiceRoomId,
            targetPeerId: fromPeerId,
            data: { answer },
          });
        }
      } else if (signalData.answer) {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.answer));
      } else if (signalData.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      }
    } catch (err) {
      console.error('Error handling peer signal:', err);
    }
  };

  const closePeerConnection = (peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
    const audioEl = document.getElementById(`remote-audio-${peerId}`);
    if (audioEl) audioEl.remove();
  };

  const joinVoiceChannel = async (roomId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      // Setup Web Audio Volume Detection for speaking indicator
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeaking = false;

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((acc, val) => acc + val, 0);
        const average = sum / dataArray.length;
        const speakingNow = average > 20 && !isMicMuted;

        if (speakingNow !== wasSpeaking) {
          wasSpeaking = speakingNow;
          setIsSpeaking(speakingNow);
          sendWs({
            type: 'voice:speaking',
            roomId,
            isSpeaking: speakingNow,
          });
        }
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();

      setActiveVoiceRoomId(roomId);
      setIsVoiceConnected(true);
      setIsMicMuted(false);
      sendWs({ type: 'voice:join', roomId });
      sound.playChime();
    } catch (err: any) {
      console.warn(`Could not access microphone: ${err.message}`);
    }
  };

  const leaveVoiceChannel = () => {
    if (activeVoiceRoomId) {
      sendWs({ type: 'voice:leave', roomId: activeVoiceRoomId });
    }

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    document.querySelectorAll('[id^="remote-audio-"]').forEach((el) => el.remove());

    setActiveVoiceRoomId(null);
    setIsVoiceConnected(false);
    setIsSpeaking(false);
    setVoiceParticipants([]);
  };

  const toggleMicMute = () => {
    if (localStreamRef.current) {
      const nextMuted = !isMicMuted;
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
      setIsMicMuted(nextMuted);
      if (nextMuted && activeVoiceRoomId) {
        setIsSpeaking(false);
        sendWs({ type: 'voice:speaking', roomId: activeVoiceRoomId, isSpeaking: false });
      }
    }
  };

  const contextValue = React.useMemo<RealtimeContextType>(
    () => ({
      isConnected,
      wsConnected,
      realtimeState,
      connectionError,
      clearConnectionError,
      myLocation,
      gpsAccuracy,
      isGpsActive,
      gpsError,
      locationStatus,
      debugTelemetry,
      setDebugMarkerLatLng,
      simulatePositionFix,
      gpsPermissionState,
      userLocations,
      onlineUserIds,
      activeAlerts,
      latestAlert,
      triggerEmergencySos,
      acknowledgeEmergency,
      deleteEmergencyAlert,
      dismissLatestAlert,
      chatMessages,
      typingUsers,
      sendMessage,
      setConversationMessages,
      sendTyping,
      sendReaction,
      deleteMessage,
      clearChat,
      editMessage,
      activeVoiceRoomId,
      isVoiceConnected,
      isMicMuted,
      isSpeaking,
      voiceParticipants,
      joinVoiceChannel,
      leaveVoiceChannel,
      toggleMicMute,
      requestLocationUpdate,
      setManualLocation,
    }),
    [
      isConnected,
      wsConnected,
      realtimeState,
      connectionError,
      clearConnectionError,
      myLocation,
      gpsAccuracy,
      isGpsActive,
      gpsError,
      locationStatus,
      debugTelemetry,
      setDebugMarkerLatLng,
      simulatePositionFix,
      gpsPermissionState,
      userLocations,
      onlineUserIds,
      activeAlerts,
      latestAlert,
      triggerEmergencySos,
      acknowledgeEmergency,
      deleteEmergencyAlert,
      dismissLatestAlert,
      chatMessages,
      typingUsers,
      sendMessage,
      setConversationMessages,
      sendTyping,
      sendReaction,
      deleteMessage,
      clearChat,
      editMessage,
      activeVoiceRoomId,
      isVoiceConnected,
      isMicMuted,
      isSpeaking,
      voiceParticipants,
      requestLocationUpdate,
      setManualLocation,
    ]
  );

  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
    </RealtimeContext.Provider>
  );
};

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}
