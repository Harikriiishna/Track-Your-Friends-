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
import { notifications } from '../utils/notifications.ts';

interface VoiceParticipant {
  peerId: string;
  user: UserProfile;
  isSpeaking: boolean;
}

interface RealtimeContextType {
  isConnected: boolean;
  myLocation: UserLocation | null;
  gpsAccuracy: number | null;
  isGpsActive: boolean;
  gpsError: string | null;
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
  sendMessage: (data: { roomId?: string; channelId?: string; recipientId?: string; text: string; attachments?: ChatMessage['attachments']; replyToId?: string }) => void;
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
  // Manual GPS refresh
  requestLocationUpdate: () => void;
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
  const [myLocation, setMyLocation] = useState<UserLocation | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<EmergencyAlert[]>([]);
  const [latestAlert, setLatestAlert] = useState<EmergencyAlert | null>(null);

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

  // Send WebSocket message helper
  const sendWs = useCallback((msg: WsClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Initialize and maintain WebSocket connection
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

    function connect() {
      if (!isMounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!isMounted) return;
        setIsConnected(true);
        // Authenticate immediately
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data: WsServerMessage = JSON.parse(event.data);
          handleServerMessage(data);
        } catch (e) {
          console.error('Error handling WS message:', e);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setIsConnected(false);
        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.warn('WebSocket connection error:', err);
        ws.close();
      };

      socketRef.current = ws;
    }

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [token, user?.id]);

  // Handle incoming Server WebSocket messages
  const handleServerMessage = (data: WsServerMessage) => {
    switch (data.type) {
      case 'presence:update': {
        setUserLocations(data.userLocations);
        setOnlineUserIds(data.onlineUsers);
        if (!myLocationRef.current && user) {
          const mySaved = data.userLocations.find((l) => l.userId === user.id);
          if (mySaved) {
            setMyLocation(mySaved);
            if (mySaved.accuracy) setGpsAccuracy(mySaved.accuracy);
          }
        }
        break;
      }

      case 'location:broadcast': {
        setUserLocations((prev) => {
          const idx = prev.findIndex((l) => l.userId === data.location.userId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = data.location;
            return next;
          }
          return [...prev, data.location];
        });
        break;
      }

      case 'chat:message': {
        const key = data.message.roomId || data.message.senderId;
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
        } else {
          setTypingUsers((prev) => {
            const copy = { ...prev };
            delete copy[key];
            return copy;
          });
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
        setActiveAlerts((prev) => [data.alert, ...prev.filter((a) => a.id !== data.alert.id)]);
        setLatestAlert(data.alert);
        sound.startEmergencySiren();
        if (data.alert.senderId !== user?.id) {
          notifications.notifyEmergency(data.alert.senderName, data.alert.message);
        }
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

  // Real GPS Geolocation Watcher
  useEffect(() => {
    if (!user || !navigator.geolocation) {
      setGpsError('Geolocation is not supported by your device');
      return;
    }

    let watchId: number | null = null;

    const handleSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy, altitude, heading, speed } = position.coords;
      setGpsAccuracy(accuracy);
      setIsGpsActive(true);
      setGpsError(null);

      const locPayload: UserLocation = {
        userId: user.id,
        username: user.username,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        latitude,
        longitude,
        accuracy,
        altitude: altitude ?? null,
        heading: heading ?? null,
        speed: speed ?? null,
        timestamp: new Date().toISOString(),
      };

      setMyLocation(locPayload);

      // Intelligent update throttling: send if moved > 5m or > 15s elapsed
      const now = Date.now();
      const last = lastLocationSentRef.current;
      const shouldSend =
        !last ||
        now - last.time > 15000 ||
        calculateDistanceMeters(last.lat, last.lng, latitude, longitude) >= 5;

      if (shouldSend) {
        lastLocationSentRef.current = { lat: latitude, lng: longitude, time: now };
        sendWs({
          type: 'location:update',
          location: {
            latitude,
            longitude,
            accuracy,
            altitude,
            heading,
            speed,
          },
        });
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      setIsGpsActive(false);
      let msg = 'Unable to retrieve location';
      if (err.code === err.PERMISSION_DENIED) {
        msg = 'Location permission was denied. Please allow location access in your browser.';
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        msg = 'Location information is unavailable.';
      } else if (err.code === err.TIMEOUT) {
        msg = 'Location request timed out.';
      }
      setGpsError(msg);
    };

    // Immediately request high-precision position on mount
    navigator.geolocation.getCurrentPosition(handleSuccess, (err) => {
      console.warn('Initial high-accuracy GPS check:', err.message);
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    // Start continuous high accuracy watch
    watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    });

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [user?.id, sendWs]);

  // Manual GPS refresh trigger
  const requestLocationUpdate = useCallback(() => {
    if (!navigator.geolocation || !user) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy, altitude, heading, speed } = pos.coords;
        setGpsAccuracy(accuracy);
        setIsGpsActive(true);
        setGpsError(null);

        const locPayload: UserLocation = {
          userId: user.id,
          username: user.username,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl,
          latitude,
          longitude,
          accuracy,
          altitude: altitude ?? null,
          heading: heading ?? null,
          speed: speed ?? null,
          timestamp: new Date().toISOString(),
        };

        setMyLocation(locPayload);
        sendWs({
          type: 'location:update',
          location: {
            latitude,
            longitude,
            accuracy,
            altitude,
            heading,
            speed,
          },
        });
      },
      (err) => {
        setGpsError(err.message);
      },
      { enableHighAccuracy: true }
    );
  }, [user, sendWs]);

  // Chat Actions
  const sendMessage = useCallback(
    (data: { roomId?: string; channelId?: string; recipientId?: string; text: string; attachments?: ChatMessage['attachments']; replyToId?: string }) => {
      sendWs({
        type: 'chat:message',
        roomId: data.roomId,
        channelId: data.channelId,
        recipientId: data.recipientId,
        text: data.text,
        attachments: data.attachments,
        replyToId: data.replyToId,
      });
    },
    [sendWs]
  );

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
      sendWs({ type: 'chat:reaction', messageId, emoji });
    },
    [sendWs]
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      sendWs({ type: 'chat:delete', messageId });
    },
    [sendWs]
  );

  const editMessage = useCallback(
    (messageId: string, text: string) => {
      sendWs({ type: 'chat:edit', messageId, text });
    },
    [sendWs]
  );

  // Emergency SOS Actions
  const triggerEmergencySos = useCallback(
    (message: string, roomId?: string) => {
      const currentLoc = myLocationRef.current;
      const lat = currentLoc ? currentLoc.latitude : 0;
      const lng = currentLoc ? currentLoc.longitude : 0;
      const acc = currentLoc ? currentLoc.accuracy : 10;

      sendWs({
        type: 'emergency:sos',
        message,
        latitude: lat,
        longitude: lng,
        accuracy: acc,
        roomId,
      });
    },
    [sendWs]
  );

  const acknowledgeEmergency = useCallback(
    (alertId: string) => {
      sendWs({ type: 'emergency:ack', alertId });
    },
    [sendWs]
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

  return (
    <RealtimeContext.Provider
      value={{
        isConnected,
        myLocation,
        gpsAccuracy,
        isGpsActive,
        gpsError,
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
      }}
    >
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
