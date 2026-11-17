import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import type { Room, RoomMember, UserRole, SavedPlace, MessageAttachment } from '../../types.ts';
import { api } from '../../utils/api.ts';
import { localBackend } from '../../utils/localBackend.ts';
import { calculateDistanceMeters, formatDistance } from '../../utils/geo.ts';
import { VoiceRecorder, sound, triggerHaptic } from '../../utils/audio.ts';
import { AudioWaveformVisualizer, VoiceMessagePlayer } from '../Chat/AudioWaveformVisualizer.tsx';
import { notifications } from '../../utils/notifications.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { LiveMap } from '../Map/LiveMap.tsx';
import {
  LOCATION_TYPES,
  MARKER_COLORS,
  getLocationTypeEmoji,
} from '../../utils/markerStyles.ts';
import {
  type RoomSavedPlaceGeofence,
  type RoomGeofenceAlertEvent,
  loadRoomGeofences,
  upsertRoomGeofence,
  deleteRoomGeofence,
  loadRoomGeofenceEvents,
  clearRoomGeofenceEvents,
  evaluateRoomSavedPlaceGeofences,
  triggerSimulatedRoomGeofenceAlert,
} from '../../utils/roomGeofences.ts';
import {
  Users,
  Plus,
  KeyRound,
  Shield,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  LogOut,
  Settings,
  UserCheck,
  Lock,
  Compass,
  Volume2,
  MessageSquare,
  Phone,
  Globe,
  Search,
  X,
  MapPin,
  Map as MapIcon,
  Check,
  UserX,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Bell,
  BellRing,
  BellOff,
  SlidersHorizontal,
  Send,
  Trash2,
  Square,
  FileAudio,
  Hash,
  Radar,
  Navigation,
  Sparkles,
} from 'lucide-react';

export interface MemberGeofenceAlertConfig {
  enabled: boolean;
  notifyOnEnter: boolean;
  notifyOnLeave: boolean;
  placeIds: string[]; // empty array = monitor all saved places
}

export interface GeofenceTransitionEvent {
  id: string;
  userId: string;
  memberName: string;
  placeId: string;
  placeName: string;
  action: 'entered' | 'left';
  distanceMeters: number;
  timestamp: string;
}

interface RoomsManagerProps {
  isActive?: boolean;
  onSelectRoom: (roomId: string) => void;
  selectedRoomId: string | null;
  savedPlaces?: SavedPlace[];
  onRefreshSavedPlaces?: () => void;
  onSelectUserForChat?: (userId: string) => void;
  onOpenChat?: (roomId?: string) => void;
  onFocusMapLocation?: (lat: number, lng: number) => void;
  onAddPlaceAtCoords?: (lat: number, lng: number) => void;
  onSetReminderAtCoords?: (lat: number, lng: number, title?: string) => void;
}

const ROOM_VOICE_NOTE_CHANNELS = [
  { id: 'general', label: '#general' },
  { id: 'live-locations', label: '#live-locations' },
  { id: 'announcements', label: '#announcements' },
  { id: 'lounge', label: '#lounge' },
] as const;

function formatVoiceNoteDuration(seconds: number): string {
  const safeSecs = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSecs / 60);
  const secs = safeSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const RoomsManager: React.FC<RoomsManagerProps> = ({
  isActive = true,
  onSelectRoom,
  selectedRoomId,
  savedPlaces = [],
  onRefreshSavedPlaces,
  onSelectUserForChat,
  onOpenChat,
  onFocusMapLocation,
  onAddPlaceAtCoords,
  onSetReminderAtCoords,
}) => {
  const { user, logout } = useAuth();
  const { themeConfig } = useTheme();
  const {
    myLocation,
    userLocations,
    onlineUserIds,
    activeVoiceRoomId,
    isVoiceConnected,
    isMicMuted,
    isSpeaking,
    voiceParticipants,
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMicMute,
    chatMessages,
    sendMessage,
  } = useRealtime();

  const toast = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomDetails, setActiveRoomDetails] = useState<Room | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showRoomMap, setShowRoomMap] = useState(false);
  const [hasMountedRoomMap, setHasMountedRoomMap] = useState(false);
  const [isRoomMapFullscreen, setIsRoomMapFullscreen] = useState(false);
  const [isRoomFullscreen, setIsRoomFullscreen] = useState(false);
  const [roomMapFocusCoords, setRoomMapFocusCoords] = useState<{ lat: number; lng: number } | null>(null);
  const roomMapPanelRef = React.useRef<HTMLDivElement>(null);
  const activeRoomSectionRef = React.useRef<HTMLDivElement>(null);
  const voiceNoteSectionRef = React.useRef<HTMLDivElement>(null);
  const roomGeofenceSectionRef = React.useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quickHubMessage, setQuickHubMessage] = useState('');

  // Room Voice Note Recorder State
  const [isRecordingVoiceNote, setIsRecordingVoiceNote] = useState(false);
  const [voiceNoteRecordingSeconds, setVoiceNoteRecordingSeconds] = useState(0);
  const [voiceNotePreview, setVoiceNotePreview] = useState<{
    dataUrl: string;
    durationSeconds: number;
    sizeBytes: number;
    mimeType: string;
  } | null>(null);
  const [voiceNoteCaption, setVoiceNoteCaption] = useState('');
  const [voiceNoteChannel, setVoiceNoteChannel] = useState<string>('general');
  const [isSendingVoiceNote, setIsSendingVoiceNote] = useState(false);
  const [localSentVoiceNotes, setLocalSentVoiceNotes] = useState<
    Array<{
      id: string;
      roomId: string;
      channelId: string;
      senderName: string;
      senderAvatar?: string;
      text: string;
      url: string;
      duration: number;
      createdAt: string;
    }>
  >([]);
  const voiceRecorderRef = React.useRef<VoiceRecorder | null>(null);
  const voiceNoteTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up any active voice note recording on unmount or when switching rooms
  useEffect(() => {
    return () => {
      if (voiceRecorderRef.current) {
        voiceRecorderRef.current.cancel();
        voiceRecorderRef.current = null;
      }
      if (voiceNoteTimerRef.current) {
        clearInterval(voiceNoteTimerRef.current);
        voiceNoteTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Cancel active recording or unsent preview when user switches to a different room
    if (voiceRecorderRef.current) {
      voiceRecorderRef.current.cancel();
      voiceRecorderRef.current = null;
    }
    if (voiceNoteTimerRef.current) {
      clearInterval(voiceNoteTimerRef.current);
      voiceNoteTimerRef.current = null;
    }
    setIsRecordingVoiceNote(false);
    setVoiceNoteRecordingSeconds(0);
    setVoiceNotePreview(null);
  }, [selectedRoomId]);

  const startRoomVoiceNoteRecording = React.useCallback(async () => {
    if (isRecordingVoiceNote) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Microphone recording is not supported in this browser.');
      return;
    }
    try {
      const recorder = new VoiceRecorder();
      await recorder.start();
      voiceRecorderRef.current = recorder;
      setVoiceNotePreview(null);
      setIsRecordingVoiceNote(true);
      setVoiceNoteRecordingSeconds(0);
      sound.playTap();
      triggerHaptic('medium');

      if (voiceNoteTimerRef.current) clearInterval(voiceNoteTimerRef.current);
      voiceNoteTimerRef.current = setInterval(() => {
        setVoiceNoteRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Voice note microphone error:', err);
      toast.error(
        `Microphone access failed: ${err?.message || 'Please allow microphone permission to record voice notes.'}`
      );
    }
  }, [isRecordingVoiceNote, toast]);

  const cancelRoomVoiceNoteRecording = React.useCallback(() => {
    if (voiceRecorderRef.current) {
      voiceRecorderRef.current.cancel();
      voiceRecorderRef.current = null;
    }
    if (voiceNoteTimerRef.current) {
      clearInterval(voiceNoteTimerRef.current);
      voiceNoteTimerRef.current = null;
    }
    setIsRecordingVoiceNote(false);
    setVoiceNoteRecordingSeconds(0);
    setVoiceNotePreview(null);
    triggerHaptic('light');
  }, []);

  const stopRoomVoiceNoteForPreview = React.useCallback(async () => {
    if (!voiceRecorderRef.current) return;
    if (voiceNoteTimerRef.current) {
      clearInterval(voiceNoteTimerRef.current);
      voiceNoteTimerRef.current = null;
    }
    try {
      const result = await voiceRecorderRef.current.stop();
      voiceRecorderRef.current = null;
      setIsRecordingVoiceNote(false);
      setVoiceNotePreview({
        dataUrl: result.dataUrl,
        durationSeconds: result.durationSeconds,
        sizeBytes: result.blob.size,
        mimeType: result.blob.type || 'audio/webm',
      });
      sound.playTap();
      triggerHaptic('selection');
    } catch (err: any) {
      console.error('Error stopping voice recorder:', err);
      setIsRecordingVoiceNote(false);
      toast.error('Could not finalize voice note recording.');
    }
  }, [toast]);

  const dispatchEncodedVoiceNoteToRoom = React.useCallback(
    async (payload: {
      dataUrl: string;
      durationSeconds: number;
      sizeBytes: number;
      mimeType: string;
    }) => {
      const targetRoomId = activeRoomDetails?.id || selectedRoomId;
      if (!targetRoomId) {
        toast.error('Select an active room first to send a voice note.');
        return;
      }

      setIsSendingVoiceNote(true);
      try {
        const ext = payload.mimeType.includes('mp4') ? 'm4a' : 'webm';
        const filename = `voice-note-${Date.now()}.${ext}`;
        let finalUrl = payload.dataUrl;
        let finalSize = payload.sizeBytes || Math.round((payload.dataUrl.length * 3) / 4);

        try {
          const uploaded = await api.uploadFile(payload.dataUrl, filename, payload.mimeType);
          if (uploaded?.url) {
            finalUrl = uploaded.url;
          }
          if (uploaded?.size) {
            finalSize = uploaded.size;
          }
        } catch {
          // Fallback to encoded base64 Data URL directly so voice note always delivers
        }

        const durationFormatted = formatVoiceNoteDuration(payload.durationSeconds);
        const trimmedCaption = voiceNoteCaption.trim();
        const messageText = trimmedCaption
          ? `🎤 ${trimmedCaption}`
          : `🎤 Voice message (${durationFormatted})`;
        const clientMsgId = `voice-${Date.now()}`;
        const targetChannel = voiceNoteChannel || 'general';

        const attachment: MessageAttachment = {
          id: `att-voice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'voice',
          url: finalUrl,
          name: `Voice message (${durationFormatted})`,
          size: finalSize,
          duration: payload.durationSeconds,
        };

        sendMessage({
          roomId: targetRoomId,
          channelId: targetChannel,
          text: messageText,
          attachments: [attachment],
          clientMsgId,
        });

        setLocalSentVoiceNotes((prev) => [
          {
            id: clientMsgId,
            roomId: targetRoomId,
            channelId: targetChannel,
            senderName: user?.fullName || 'You',
            senderAvatar: user?.avatarUrl,
            text: messageText,
            url: finalUrl,
            duration: payload.durationSeconds,
            createdAt: new Date().toISOString(),
          },
          ...prev.slice(0, 14),
        ]);

        sound.playSuccess();
        triggerHaptic('light');
        setVoiceNotePreview(null);
        setVoiceNoteCaption('');
        setVoiceNoteRecordingSeconds(0);
        toast.success(
          `Voice note (${durationFormatted}) sent to ${activeRoomDetails?.name || 'room'} (#${targetChannel})`
        );
      } catch (err: any) {
        console.error('Failed to send voice note:', err);
        toast.error(err?.message || 'Failed to send voice note to chat room');
      } finally {
        setIsSendingVoiceNote(false);
      }
    },
    [activeRoomDetails, selectedRoomId, voiceNoteCaption, voiceNoteChannel, sendMessage, user, toast]
  );

  const stopAndSendRoomVoiceNote = React.useCallback(async () => {
    if (!voiceRecorderRef.current) return;
    if (voiceNoteTimerRef.current) {
      clearInterval(voiceNoteTimerRef.current);
      voiceNoteTimerRef.current = null;
    }
    try {
      const result = await voiceRecorderRef.current.stop();
      voiceRecorderRef.current = null;
      setIsRecordingVoiceNote(false);
      await dispatchEncodedVoiceNoteToRoom({
        dataUrl: result.dataUrl,
        durationSeconds: result.durationSeconds,
        sizeBytes: result.blob.size,
        mimeType: result.blob.type || 'audio/webm',
      });
    } catch (err: any) {
      console.error('Error stopping & sending voice note:', err);
      setIsRecordingVoiceNote(false);
      toast.error('Failed to capture audio for voice note.');
    }
  }, [dispatchEncodedVoiceNoteToRoom, toast]);

  // Combine recent voice notes from RealtimeContext chatMessages + localSentVoiceNotes for the active room
  const activeRoomVoiceNotes = React.useMemo(() => {
    const roomId = activeRoomDetails?.id || selectedRoomId;
    if (!roomId) return [];

    const remoteMsgs = chatMessages[roomId] || [];
    const extractedRemote = remoteMsgs
      .filter((m) => m.attachments && m.attachments.some((a) => a.type === 'voice'))
      .map((m) => {
        const voiceAtt = m.attachments!.find((a) => a.type === 'voice')!;
        return {
          id: m.id,
          roomId,
          channelId: m.channelId || 'general',
          senderName: m.senderName || 'Member',
          senderAvatar: m.senderAvatar,
          text: m.text || '🎤 Voice message',
          url: voiceAtt.url,
          duration: voiceAtt.duration || 1,
          createdAt: m.createdAt || new Date().toISOString(),
        };
      });

    const localForRoom = localSentVoiceNotes.filter((n) => n.roomId === roomId);
    const mergedMap = new Map<string, (typeof localForRoom)[number]>();

    for (const item of [...localForRoom, ...extractedRemote]) {
      // Deduplicate if remote message has same URL or ID
      const existingDup = Array.from(mergedMap.values()).some(
        (existing) =>
          existing.id === item.id ||
          (existing.url === item.url &&
            Math.abs(new Date(existing.createdAt).getTime() - new Date(item.createdAt).getTime()) < 25000)
      );
      if (!existingDup) {
        mergedMap.set(item.id, item);
      }
    }

    return Array.from(mergedMap.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [activeRoomDetails?.id, selectedRoomId, chatMessages, localSentVoiceNotes]);

  // Per-member geofence notification toggle & configuration state
  const storageKey = `beacon_member_geofence_alerts_${user?.id || 'default'}`;
  const [memberGeofenceAlerts, setMemberGeofenceAlerts] = useState<Record<string, MemberGeofenceAlertConfig>>(() => {
    try {
      const raw = localStorage.getItem(`beacon_member_geofence_alerts_${user?.id || 'default'}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [expandedGeofenceMemberId, setExpandedGeofenceMemberId] = useState<string | null>(null);
  const [geofenceEvents, setGeofenceEvents] = useState<GeofenceTransitionEvent[]>([]);
  // Tracks whether a member is currently inside a saved place geofence: key = `${userId}::${placeId}`
  const memberInsideGeofenceRef = React.useRef<Record<string, boolean>>({});

  // Sync memberGeofenceAlerts when user changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setMemberGeofenceAlerts(JSON.parse(raw));
      }
    } catch {}
  }, [storageKey]);

  const saveMemberGeofenceAlerts = React.useCallback(
    (updater: (prev: Record<string, MemberGeofenceAlertConfig>) => Record<string, MemberGeofenceAlertConfig>) => {
      setMemberGeofenceAlerts((prev) => {
        const next = updater(prev);
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [storageKey]
  );

  const getMemberAlertConfig = React.useCallback(
    (targetUserId: string): MemberGeofenceAlertConfig => {
      return (
        memberGeofenceAlerts[targetUserId] || {
          enabled: false,
          notifyOnEnter: true,
          notifyOnLeave: true,
          placeIds: [],
        }
      );
    },
    [memberGeofenceAlerts]
  );

  const handleToggleMemberGeofenceAlert = React.useCallback(
    async (targetUserId: string, memberName: string) => {
      const current = getMemberAlertConfig(targetUserId);
      const nextEnabled = !current.enabled;

      if (nextEnabled && notifications.isSupported() && notifications.getPermission() === 'default') {
        await notifications.requestPermission();
      }

      // Snapshot current inside/outside state for this member so toggling doesn't misfire until an actual transition
      const peerLoc = userLocations.find((l) => l.userId === targetUserId);
      const currentlyInsidePlaces: string[] = [];
      if (peerLoc && savedPlaces.length > 0) {
        savedPlaces.forEach((place) => {
          const dist = calculateDistanceMeters(
            peerLoc.latitude,
            peerLoc.longitude,
            place.latitude,
            place.longitude
          );
          const radius = place.radiusMeters || 150;
          const isInside = dist <= radius;
          memberInsideGeofenceRef.current[`${targetUserId}::${place.id}`] = isInside;
          if (isInside) {
            currentlyInsidePlaces.push(place.name);
          }
        });
      }

      saveMemberGeofenceAlerts((prev) => ({
        ...prev,
        [targetUserId]: {
          ...current,
          enabled: nextEnabled,
        },
      }));

      sound.playChime();
      if (nextEnabled) {
        if (savedPlaces.length === 0) {
          toast.info(
            `Geofence alerts enabled for ${memberName}. Add a Saved Place in the Wishlist/Saved tab to monitor boundaries.`
          );
        } else if (currentlyInsidePlaces.length > 0) {
          toast.success(
            `Geofence alerts ON for ${memberName} (currently inside ${currentlyInsidePlaces.join(', ')})`
          );
        } else {
          toast.success(
            `Geofence alerts ON for ${memberName} across ${
              current.placeIds.length > 0 ? current.placeIds.length : savedPlaces.length
            } saved location${savedPlaces.length === 1 ? '' : 's'}`
          );
        }
      } else {
        toast.info(`Geofence alerts muted for ${memberName}`);
      }
    },
    [getMemberAlertConfig, saveMemberGeofenceAlerts, userLocations, savedPlaces, toast]
  );

  const handleUpdateMemberGeofenceConfig = React.useCallback(
    (targetUserId: string, patch: Partial<MemberGeofenceAlertConfig>) => {
      saveMemberGeofenceAlerts((prev) => {
        const base = prev[targetUserId] || {
          enabled: true,
          notifyOnEnter: true,
          notifyOnLeave: true,
          placeIds: [],
        };
        return {
          ...prev,
          [targetUserId]: {
            ...base,
            ...patch,
          },
        };
      });
    },
    [saveMemberGeofenceAlerts]
  );

  const handleToggleMemberWatchedPlace = React.useCallback(
    (targetUserId: string, placeId: string) => {
      const cfg = getMemberAlertConfig(targetUserId);
      const exists = cfg.placeIds.includes(placeId);
      const nextPlaceIds = exists
        ? cfg.placeIds.filter((id) => id !== placeId)
        : [...cfg.placeIds, placeId];
      handleUpdateMemberGeofenceConfig(targetUserId, { placeIds: nextPlaceIds });
    },
    [getMemberAlertConfig, handleUpdateMemberGeofenceConfig]
  );

  // Real-time Geofence Enter / Leave Detection Engine for watched group members
  useEffect(() => {
    if (!savedPlaces || savedPlaces.length === 0 || userLocations.length === 0) return;

    userLocations.forEach((peerLoc) => {
      if (peerLoc.userId === user?.id) return;
      const cfg = memberGeofenceAlerts[peerLoc.userId];
      if (!cfg || !cfg.enabled) return;

      const memberFromRoom = activeRoomDetails?.members?.find((m) => m.userId === peerLoc.userId);
      const memberName = memberFromRoom?.user?.fullName || peerLoc.fullName || peerLoc.username || 'Group Member';

      const placesToMonitor =
        cfg.placeIds && cfg.placeIds.length > 0
          ? savedPlaces.filter((p) => cfg.placeIds.includes(p.id))
          : savedPlaces;

      placesToMonitor.forEach((place) => {
        const dist = calculateDistanceMeters(
          peerLoc.latitude,
          peerLoc.longitude,
          place.latitude,
          place.longitude
        );
        const radius = place.radiusMeters || 150;
        const isInside = dist <= radius;
        const stateKey = `${peerLoc.userId}::${place.id}`;
        const wasInside = memberInsideGeofenceRef.current[stateKey];

        if (wasInside === undefined) {
          // Initialize baseline state on first fix
          memberInsideGeofenceRef.current[stateKey] = isInside;
          return;
        }

        if (!wasInside && isInside) {
          memberInsideGeofenceRef.current[stateKey] = true;
          if (cfg.notifyOnEnter) {
            sound.playChime();
            toast.success(
              `📍 Geofence Alert: ${memberName} entered "${place.name}" (${Math.round(dist)}m)`
            );
            notifications.notifyMemberGeofence(memberName, 'entered', place.name, dist);
            setGeofenceEvents((prev) => [
              {
                id: `${Date.now()}-${peerLoc.userId}-${place.id}-enter`,
                userId: peerLoc.userId,
                memberName,
                placeId: place.id,
                placeName: place.name,
                action: 'entered',
                distanceMeters: Math.round(dist),
                timestamp: new Date().toISOString(),
              },
              ...prev.slice(0, 19),
            ]);
          }
        } else if (wasInside && !isInside) {
          memberInsideGeofenceRef.current[stateKey] = false;
          if (cfg.notifyOnLeave) {
            sound.playChime();
            toast.info(
              `🚶 Geofence Alert: ${memberName} left "${place.name}" (${Math.round(dist)}m)`
            );
            notifications.notifyMemberGeofence(memberName, 'left', place.name, dist, {
              roomId: activeRoomDetails?.id,
              roomName: activeRoomDetails?.name,
              latitude: place.latitude,
              longitude: place.longitude,
              radiusMeters: radius,
            });
            setGeofenceEvents((prev) => [
              {
                id: `${Date.now()}-${peerLoc.userId}-${place.id}-leave`,
                userId: peerLoc.userId,
                memberName,
                placeId: place.id,
                placeName: place.name,
                action: 'left',
                distanceMeters: Math.round(dist),
                timestamp: new Date().toISOString(),
              },
              ...prev.slice(0, 19),
            ]);
          }
        }
      });
    });
  }, [userLocations, savedPlaces, memberGeofenceAlerts, activeRoomDetails, user?.id, toast]);

  // ============================================================================
  // ROOM SAVED-PLACE GEOFENCES & AUTOMATIC PUSH NOTIFICATIONS
  // ============================================================================
  const [roomGeofences, setRoomGeofences] = useState<RoomSavedPlaceGeofence[]>(() =>
    loadRoomGeofences()
  );
  const [roomGeofenceEvents, setRoomGeofenceEvents] = useState<RoomGeofenceAlertEvent[]>(() =>
    loadRoomGeofenceEvents()
  );
  const [showDefineGeofenceModal, setShowDefineGeofenceModal] = useState(false);
  const [editingGeofenceId, setEditingGeofenceId] = useState<string | null>(null);
  const [geofencePlaceMode, setGeofencePlaceMode] = useState<'existing' | 'new'>('existing');
  const [selectedGeofencePlaceId, setSelectedGeofencePlaceId] = useState<string>('');
  const [geofenceRadiusMeters, setGeofenceRadiusMeters] = useState<number>(150);
  const [geofenceNotifyOnEnter, setGeofenceNotifyOnEnter] = useState<boolean>(true);
  const [geofenceNotifyOnLeave, setGeofenceNotifyOnLeave] = useState<boolean>(true);
  const [geofencePostToRoomChat, setGeofencePostToRoomChat] = useState<boolean>(true);
  const [geofenceWatchedMemberIds, setGeofenceWatchedMemberIds] = useState<string[]>([]);
  const [syncRadiusToSavedPlace, setSyncRadiusToSavedPlace] = useState<boolean>(true);
  const [isSavingRoomGeofence, setIsSavingRoomGeofence] = useState<boolean>(false);

  // Inline "Create New Saved Place" form inside the Room Geofence Modal
  const [newPlaceName, setNewPlaceName] = useState<string>('');
  const [newPlaceDesc, setNewPlaceDesc] = useState<string>('');
  const [newPlaceCategory, setNewPlaceCategory] = useState<SavedPlace['category']>('home');
  const [newPlaceColor, setNewPlaceColor] = useState<string>('#8957FF');
  const [newPlaceLat, setNewPlaceLat] = useState<string>('');
  const [newPlaceLng, setNewPlaceLng] = useState<string>('');

  // Keep roomGeofences & roomGeofenceEvents synchronized across components
  useEffect(() => {
    const onGeofencesUpdated = () => setRoomGeofences(loadRoomGeofences());
    const onEventsUpdated = () => setRoomGeofenceEvents(loadRoomGeofenceEvents());
    window.addEventListener('beacon:room-geofences-updated', onGeofencesUpdated);
    window.addEventListener('beacon:room-geofence-events-updated', onEventsUpdated);
    return () => {
      window.removeEventListener('beacon:room-geofences-updated', onGeofencesUpdated);
      window.removeEventListener('beacon:room-geofence-events-updated', onEventsUpdated);
    };
  }, []);

  // Active Room's Saved-Place Geofences
  const activeRoomGeofences = React.useMemo(() => {
    const rid = activeRoomDetails?.id || selectedRoomId;
    if (!rid) return [];
    return roomGeofences.filter((g) => g.roomId === rid);
  }, [roomGeofences, activeRoomDetails?.id, selectedRoomId]);

  const activeRoomGeofenceEvents = React.useMemo(() => {
    const rid = activeRoomDetails?.id || selectedRoomId;
    if (!rid) return roomGeofenceEvents.slice(0, 10);
    return roomGeofenceEvents.filter((e) => e.roomId === rid).slice(0, 12);
  }, [roomGeofenceEvents, activeRoomDetails?.id, selectedRoomId]);

  // Evaluate Room Saved-Place Geofences in real time whenever locations or geofences update
  useEffect(() => {
    if (roomGeofences.length === 0 || userLocations.length === 0) return;

    evaluateRoomSavedPlaceGeofences({
      currentUserId: user?.id,
      geofences: roomGeofences,
      savedPlaces,
      userLocations,
      rooms,
      activeRoomDetails,
      onAlertTriggered: (ev, gf) => {
        if (ev.action === 'entered') {
          toast.success(
            `📍 [${ev.roomName}] ${ev.memberName} entered "${ev.placeName}" (${ev.distanceMeters}m)`
          );
        } else {
          toast.info(
            `🚶 [${ev.roomName}] ${ev.memberName} left "${ev.placeName}" (${ev.distanceMeters}m)`
          );
        }
        if (gf.postToRoomChat) {
          sendMessage({
            roomId: gf.roomId,
            channelId: 'live-locations',
            text: `📍 Geofence Alert: ${ev.memberName} ${ev.action} saved place "${ev.placeName}" (${ev.distanceMeters}m from center · ${gf.radiusMeters}m zone).`,
          });
        }
      },
    });
  }, [userLocations, roomGeofences, savedPlaces, rooms, activeRoomDetails, user?.id, toast, sendMessage]);

  const handleOpenDefinePlaceGeofenceModal = React.useCallback(
    (preselectedPlace?: SavedPlace) => {
      setEditingGeofenceId(null);
      if (preselectedPlace) {
        setGeofencePlaceMode('existing');
        setSelectedGeofencePlaceId(preselectedPlace.id);
        setGeofenceRadiusMeters(preselectedPlace.radiusMeters || 150);
      } else if (savedPlaces.length > 0) {
        setGeofencePlaceMode('existing');
        const firstPlace = savedPlaces[0];
        setSelectedGeofencePlaceId(firstPlace.id);
        setGeofenceRadiusMeters(firstPlace.radiusMeters || 150);
      } else {
        setGeofencePlaceMode('new');
        setSelectedGeofencePlaceId('');
        setGeofenceRadiusMeters(150);
      }

      if (myLocation) {
        setNewPlaceLat(myLocation.latitude.toFixed(6));
        setNewPlaceLng(myLocation.longitude.toFixed(6));
      } else {
        setNewPlaceLat('13.050100');
        setNewPlaceLng('77.714750');
      }
      setNewPlaceName('');
      setNewPlaceDesc('');
      setNewPlaceCategory('home');
      setNewPlaceColor('#8957FF');
      setGeofenceNotifyOnEnter(true);
      setGeofenceNotifyOnLeave(true);
      setGeofencePostToRoomChat(true);
      setGeofenceWatchedMemberIds([]);
      setSyncRadiusToSavedPlace(true);
      setShowDefineGeofenceModal(true);
    },
    [savedPlaces, myLocation]
  );

  const handleOpenEditRoomGeofence = React.useCallback((gf: RoomSavedPlaceGeofence) => {
    setEditingGeofenceId(gf.id);
    setGeofencePlaceMode('existing');
    setSelectedGeofencePlaceId(gf.placeId);
    setGeofenceRadiusMeters(gf.radiusMeters || 150);
    setGeofenceNotifyOnEnter(gf.notifyOnEnter);
    setGeofenceNotifyOnLeave(gf.notifyOnLeave);
    setGeofencePostToRoomChat(gf.postToRoomChat);
    setGeofenceWatchedMemberIds(gf.watchedMemberIds || []);
    setSyncRadiusToSavedPlace(true);
    setShowDefineGeofenceModal(true);
  }, []);

  const handleSaveRoomPlaceGeofence = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetRoomId = activeRoomDetails?.id || selectedRoomId;
    const targetRoomName = activeRoomDetails?.name || 'Room';
    if (!targetRoomId) {
      toast.error('Please select a room first.');
      return;
    }
    if (!geofenceNotifyOnEnter && !geofenceNotifyOnLeave) {
      toast.error('Enable at least one trigger (On Enter or On Leave).');
      return;
    }

    setIsSavingRoomGeofence(true);
    try {
      // Request push notification permission proactively so alerts can fire
      if (notifications.isSupported() && notifications.getPermission() === 'default') {
        await notifications.requestPermission();
      }

      let targetPlace: SavedPlace | undefined;

      if (geofencePlaceMode === 'new') {
        const latNum = Number(newPlaceLat);
        const lngNum = Number(newPlaceLng);
        if (!newPlaceName.trim()) {
          toast.error('Please enter a name for the new saved place.');
          setIsSavingRoomGeofence(false);
          return;
        }
        if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
          toast.error('Please provide valid GPS coordinates for the saved place.');
          setIsSavingRoomGeofence(false);
          return;
        }

        const createdRes = await api.post<{ place: SavedPlace }>('/api/saved-places', {
          name: newPlaceName.trim(),
          description:
            newPlaceDesc.trim() || `Room geofence location for ${targetRoomName}`,
          latitude: latNum,
          longitude: lngNum,
          radiusMeters: geofenceRadiusMeters,
          category: newPlaceCategory,
          visibility: 'room',
          roomId: targetRoomId,
          markerColor: newPlaceColor,
          markerIcon: newPlaceCategory,
        });
        targetPlace = createdRes.place;
        onRefreshSavedPlaces?.();
      } else {
        targetPlace = savedPlaces.find((p) => p.id === selectedGeofencePlaceId);
        if (!targetPlace) {
          toast.error('Please select a saved place or create a new one.');
          setIsSavingRoomGeofence(false);
          return;
        }

        if (syncRadiusToSavedPlace && targetPlace.radiusMeters !== geofenceRadiusMeters) {
          try {
            const updatedRes = await api.put<{ place: SavedPlace }>(
              `/api/saved-places/${targetPlace.id}`,
              {
                radiusMeters: geofenceRadiusMeters,
                roomId: targetPlace.roomId || targetRoomId,
              }
            );
            if (updatedRes?.place) {
              targetPlace = updatedRes.place;
            }
            onRefreshSavedPlaces?.();
          } catch {
            // Non-fatal if place belongs to another user
          }
        }
      }

      const nowIso = new Date().toISOString();
      const geofenceObj: RoomSavedPlaceGeofence = {
        id:
          editingGeofenceId ||
          `rgf-${targetRoomId}-${targetPlace.id}-${Date.now().toString(36)}`,
        roomId: targetRoomId,
        roomName: targetRoomName,
        placeId: targetPlace.id,
        placeName: targetPlace.name,
        placeCategory: targetPlace.category,
        placeIcon: targetPlace.markerIcon || targetPlace.category,
        latitude: targetPlace.latitude,
        longitude: targetPlace.longitude,
        radiusMeters: geofenceRadiusMeters,
        color: targetPlace.markerColor || '#8957FF',
        enabled: true,
        notifyOnEnter: geofenceNotifyOnEnter,
        notifyOnLeave: geofenceNotifyOnLeave,
        postToRoomChat: geofencePostToRoomChat,
        watchedMemberIds: geofenceWatchedMemberIds,
        createdByUserId: user?.id || 'member',
        createdByName: user?.fullName || 'Member',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const nextList = upsertRoomGeofence(geofenceObj, userLocations);
      setRoomGeofences(nextList);
      setShowDefineGeofenceModal(false);
      sound.playSuccess();
      triggerHaptic('light');
      toast.success(
        `Geofence (${geofenceRadiusMeters}m) active around "${targetPlace.name}" in ${targetRoomName}`
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save room geofence');
    } finally {
      setIsSavingRoomGeofence(false);
    }
  };

  const handleToggleRoomGeofenceEnabled = React.useCallback(
    (gf: RoomSavedPlaceGeofence) => {
      const updated: RoomSavedPlaceGeofence = {
        ...gf,
        enabled: !gf.enabled,
        updatedAt: new Date().toISOString(),
      };
      const next = upsertRoomGeofence(updated, userLocations);
      setRoomGeofences(next);
      sound.playTap();
      toast.info(
        updated.enabled
          ? `Resumed push alerts for "${gf.placeName}" (${gf.radiusMeters}m)`
          : `Paused push alerts for "${gf.placeName}"`
      );
    },
    [userLocations, toast]
  );

  const handleDeleteRoomGeofence = React.useCallback(
    (gf: RoomSavedPlaceGeofence) => {
      const next = deleteRoomGeofence(gf.id);
      setRoomGeofences(next);
      toast.info(`Removed room geofence for "${gf.placeName}"`);
    },
    [toast]
  );

  const handleSimulateRoomGeofenceTransition = React.useCallback(
    (gf: RoomSavedPlaceGeofence, action: 'entered' | 'left') => {
      // Pick a room peer if available, or fall back to a representative room member
      const peers = (activeRoomDetails?.members || []).filter((m) => m.userId !== user?.id);
      const chosenPeer = peers[0];
      const targetMember = chosenPeer
        ? {
            userId: chosenPeer.userId,
            fullName: chosenPeer.user.fullName || chosenPeer.user.username || 'Room Member',
            avatarUrl: chosenPeer.user.avatarUrl,
          }
        : {
            userId: user?.id || 'member-demo',
            fullName: user?.fullName ? `${user.fullName} (Test)` : 'Group Member',
            avatarUrl: user?.avatarUrl,
          };

      triggerSimulatedRoomGeofenceAlert(gf, action, targetMember, (ev, rule) => {
        setRoomGeofenceEvents(loadRoomGeofenceEvents());
        if (ev.action === 'entered') {
          toast.success(
            `📍 Push Notification Sent: ${ev.memberName} entered "${ev.placeName}" (${ev.distanceMeters}m)`
          );
        } else {
          toast.info(
            `🚶 Push Notification Sent: ${ev.memberName} left "${ev.placeName}" (${ev.distanceMeters}m)`
          );
        }
        if (rule.postToRoomChat) {
          sendMessage({
            roomId: rule.roomId,
            channelId: 'live-locations',
            text: `📍 Geofence Alert: ${ev.memberName} ${ev.action} saved place "${ev.placeName}" (${ev.distanceMeters}m from center · ${rule.radiusMeters}m zone).`,
          });
        }
      });
    },
    [activeRoomDetails?.members, user, toast, sendMessage]
  );

  // Form states
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [newRoomPassword, setNewRoomPassword] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search Bar state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState<'all' | 'rooms' | 'members'>('all');


  // Filtered rooms based on search query
  const filteredRooms = React.useMemo(() => {
    if (!searchQuery.trim()) return rooms;
    const q = searchQuery.toLowerCase().trim();
    return rooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        r.id.toLowerCase().includes(q)
    );
  }, [rooms, searchQuery]);

  // Filtered members based on search query
  const filteredMembers = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const memberMap = new Map<
      string,
      {
        userId: string;
        fullName: string;
        username: string;
        avatarUrl?: string;
        role?: string;
        roomId?: string;
        roomName?: string;
        isOnline: boolean;
        latitude?: number;
        longitude?: number;
      }
    >();

    // 1. Check active room members
    if (activeRoomDetails?.members) {
      activeRoomDetails.members.forEach((m) => {
        const u = m.user;
        const name = u?.fullName || '';
        const uname = u?.username || '';
        if (
          name.toLowerCase().includes(q) ||
          uname.toLowerCase().includes(q) ||
          (m.role && m.role.toLowerCase().includes(q))
        ) {
          const loc = userLocations.find((l) => l.userId === m.userId);
          memberMap.set(m.userId, {
            userId: m.userId,
            fullName: name || 'Member',
            username: uname || m.userId.slice(0, 6),
            avatarUrl: u?.avatarUrl,
            role: m.role,
            roomId: activeRoomDetails.id,
            roomName: activeRoomDetails.name,
            isOnline: onlineUserIds.includes(m.userId),
            latitude: loc?.latitude,
            longitude: loc?.longitude,
          });
        }
      });
    }

    // 2. Check all active peers from realtime location mesh
    userLocations.forEach((loc) => {
      if (
        loc.fullName.toLowerCase().includes(q) ||
        loc.username.toLowerCase().includes(q)
      ) {
        if (!memberMap.has(loc.userId)) {
          memberMap.set(loc.userId, {
            userId: loc.userId,
            fullName: loc.fullName,
            username: loc.username,
            avatarUrl: loc.avatarUrl,
            isOnline: onlineUserIds.includes(loc.userId),
            latitude: loc.latitude,
            longitude: loc.longitude,
          });
        }
      }
    });

    // 3. Check current user if matches
    if (
      user &&
      (user.fullName.toLowerCase().includes(q) || user.username.toLowerCase().includes(q))
    ) {
      if (!memberMap.has(user.id)) {
        memberMap.set(user.id, {
          userId: user.id,
          fullName: `${user.fullName} (You)`,
          username: user.username,
          avatarUrl: user.avatarUrl,
          role: 'SELF',
          isOnline: true,
          latitude: myLocation?.latitude,
          longitude: myLocation?.longitude,
        });
      }
    }

    return Array.from(memberMap.values());
  }, [searchQuery, activeRoomDetails, userLocations, onlineUserIds, user, myLocation]);

  // Fetch rooms with signature diffing
  const loadRooms = React.useCallback(async (showSpinner = false) => {
    if (!user?.id) return;
    try {
      if (showSpinner) setIsLoading(true);
      const res = await api.get<{ rooms: Room[] }>('/api/rooms');
      if (Array.isArray(res?.rooms)) {
        setRooms((prev) => {
          const prevSig = prev.map((r) => `${r.id}:${r.name}:${r.memberCount}`).join('|');
          const nextSig = res.rooms.map((r) => `${r.id}:${r.name}:${r.memberCount}`).join('|');
          return prevSig === nextSig ? prev : res.rooms;
        });
        if (!selectedRoomId && res.rooms.length > 0) {
          const customRoom = res.rooms.find((r) => r.id !== 'room-universal');
          onSelectRoom(customRoom ? customRoom.id : res.rooms[0].id);
        }
      }
    } catch (err) {
      console.warn('Could not load rooms from backend, using cached rooms:', err);
      const fallbackRooms = localBackend.getUserRooms(user.id);
      if (fallbackRooms.length > 0) {
        setRooms((prev) => (prev.length > 0 ? prev : fallbackRooms));
        if (!selectedRoomId) {
          const customRoom = fallbackRooms.find((r) => r.id !== 'room-universal');
          onSelectRoom(customRoom ? customRoom.id : fallbackRooms[0].id);
        }
      }
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, [user?.id, selectedRoomId, onSelectRoom]);

  useEffect(() => {
    loadRooms(true);
    const onSync = () => {
      loadRooms(false);
    };
    window.addEventListener('beacon:cloud-sync-updated', onSync);
    return () => {
      window.removeEventListener('beacon:cloud-sync-updated', onSync);
    };
  }, [loadRooms]);

  // Fetch room details when selectedRoomId changes or when Cloud Firestore syncs new members
  useEffect(() => {
    if (!selectedRoomId) {
      setActiveRoomDetails(null);
      return;
    }
    let mounted = true;
    async function loadDetails() {
      try {
        const res = await api.get<{ room: Room }>(`/api/rooms/${selectedRoomId}`);
        if (!mounted || !res?.room) return;
        setActiveRoomDetails((prev) => {
          if (!prev || prev.id !== res.room.id) return res.room;
          const prevMemSig = (prev.members || []).map((m) => `${m.userId}:${m.role}`).join('|');
          const nextMemSig = (res.room.members || []).map((m) => `${m.userId}:${m.role}`).join('|');
          if (
            prev.name === res.room.name &&
            prev.description === res.room.description &&
            prev.memberCount === res.room.memberCount &&
            prevMemSig === nextMemSig
          ) {
            return prev;
          }
          return res.room;
        });
      } catch (err) {
        if (!mounted) return;
        if (selectedRoomId === 'room-universal') {
          setActiveRoomDetails((prev) =>
            prev?.id === 'room-universal'
              ? prev
              : ({
                  id: 'room-universal',
                  name: '🌐 Universal Lounge',
                  description:
                    'The open global town square for everyone on Beacon. Coordinate live locations, chat across channels, and meet members worldwide.',
                  ownerId: 'system',
                  hasPassword: false,
                  createdAt: '2026-01-01T00:00:00.000Z',
                  memberCount: 1,
                  isPrivate: false,
                  isUniversal: true,
                  members: [],
                } as Room)
          );
        }
      }
    }
    loadDetails();
    window.addEventListener('beacon:cloud-sync-updated', loadDetails);
    return () => {
      mounted = false;
      window.removeEventListener('beacon:cloud-sync-updated', loadDetails);
    };
  }, [selectedRoomId]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const res = await api.post<{ room: Room }>('/api/rooms', {
        name: newRoomName.trim(),
        description: newRoomDesc.trim(),
        password: newRoomPassword.trim(),
      });
      setRooms((prev) =>
        prev.some((r) => r.id === res.room.id)
          ? prev.map((r) => (r.id === res.room.id ? res.room : r))
          : [...prev, res.room]
      );
      setActiveRoomDetails(res.room);
      onSelectRoom(res.room.id);
      setShowCreateModal(false);
      setNewRoomName('');
      setNewRoomDesc('');
      setNewRoomPassword('');
      toast.success(`Room "${res.room.name}" created — you are now inside`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create room');
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const res = await api.post<{ room: Room }>('/api/rooms/join', {
        roomId: joinRoomId.trim(),
        password: joinPassword.trim(),
      });
      setRooms((prev) =>
        prev.some((r) => r.id === res.room.id)
          ? prev.map((r) => (r.id === res.room.id ? res.room : r))
          : [...prev, res.room]
      );
      setActiveRoomDetails(res.room);
      onSelectRoom(res.room.id);
      setShowJoinModal(false);
      setJoinRoomId('');
      setJoinPassword('');
      toast.success(`Joined "${res.room.name}" — you will stay in this room until you press Leave`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to join room');
    }
  };

  const handleLeaveRoom = async (roomId: string) => {
    try {
      await api.post(`/api/rooms/${roomId}/leave`);
      const remaining = rooms.filter((r) => r.id !== roomId);
      setRooms(remaining);
      if (selectedRoomId === roomId) {
        const nextRoom = remaining.find((r) => r.id !== 'room-universal') || remaining[0];
        onSelectRoom(nextRoom ? nextRoom.id : 'room-universal');
      }
      toast.success('You left the room');
    } catch (err: any) {
      toast.error(err.message || 'Failed to leave room');
    }
  };

  const handleChangeRole = async (targetUserId: string, newRole: UserRole) => {
    if (!selectedRoomId) return;
    try {
      await api.post(`/api/rooms/${selectedRoomId}/roles`, { targetUserId, newRole });
      const res = await api.get<{ room: Room }>(`/api/rooms/${selectedRoomId}`);
      setActiveRoomDetails(res.room);
      toast.success(`Role updated to ${newRole}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to change role');
    }
  };

  const handleKickMember = async (targetUserId: string, memberName: string) => {
    if (!selectedRoomId) return;
    try {
      await api.kickRoomMember(selectedRoomId, targetUserId);
      const res = await api.get<{ room: Room }>(`/api/rooms/${selectedRoomId}`);
      setActiveRoomDetails(res.room);
      toast.success(`${memberName} was removed from the room`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    }
  };

  const handleBlockUser = async (targetUserId: string, memberName: string) => {
    try {
      await api.blockUser(targetUserId);
      toast.success(`Blocked ${memberName}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to block user');
    }
  };

  const myMembership = activeRoomDetails?.members?.find((m) => m.userId === user?.id);
  const canManageRoles = myMembership?.role === 'OWNER' || myMembership?.role === 'ADMIN';
  const isDark = themeConfig.isDark;

  const ROOM_PALETTES = [
    {
      gradient: 'from-[#8957FF] to-[#FF4FA3]',
      border: 'border-[#8957FF]/45',
      badgeBg: 'bg-[#8957FF]/15 text-[#8957FF] dark:text-[#E9DFFF]',
      topStrip: 'bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066]',
    },
    {
      gradient: 'from-[#397BFF] to-[#00D9FF]',
      border: 'border-[#397BFF]/45',
      badgeBg: 'bg-[#397BFF]/15 text-[#397BFF] dark:text-[#00D9FF]',
      topStrip: 'bg-gradient-to-r from-[#397BFF] to-[#00D9FF]',
    },
    {
      gradient: 'from-[#00D6A0] to-[#00D9FF]',
      border: 'border-[#00D6A0]/45',
      badgeBg: 'bg-[#00D6A0]/15 text-[#00D6A0]',
      topStrip: 'bg-gradient-to-r from-[#00D6A0] to-[#00D9FF]',
    },
    {
      gradient: 'from-[#FF4FA3] to-[#FF8066]',
      border: 'border-[#FF4FA3]/45',
      badgeBg: 'bg-[#FF4FA3]/15 text-[#FF4FA3]',
      topStrip: 'bg-gradient-to-r from-[#FF4FA3] to-[#FF8066]',
    },
    {
      gradient: 'from-[#FFD166] to-[#FF8066]',
      border: 'border-[#FFD166]/45',
      badgeBg: 'bg-[#FFD166]/20 text-amber-600 dark:text-[#FFD166]',
      topStrip: 'bg-gradient-to-r from-[#FFD166] to-[#FF8066]',
    },
  ];

  return (
    <div className={`flex flex-col h-full overflow-y-auto border-r ${themeConfig.glassBorder} ${themeConfig.appBg} transition-colors duration-200`}>
      {/* Top Social Header */}
      {!isRoomFullscreen && (
        <div className={`p-4 border-b ${themeConfig.glassBorder} ${themeConfig.glassHeader} space-y-3.5 shrink-0`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#8957FF] via-[#FF4FA3] to-[#FF8066] flex items-center justify-center text-white shadow-md shadow-[#8957FF]/25">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className={`font-extrabold ${themeConfig.textPrimary} text-base sm:text-lg tracking-tight flex items-center gap-2`}>
                  <span>Beacon Network Rooms</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-[#8957FF]/20 to-[#FF4FA3]/20 text-[#FF4FA3] border border-[#FF4FA3]/30">
                    {rooms.length} Active
                  </span>
                </h2>
                <p className={`text-xs ${themeConfig.textSecondary}`}>
                  Colourful private groups, live audio channels & real-time friend coordinates
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowJoinModal(true)}
                className="px-3.5 py-2 text-xs font-extrabold rounded-2xl transition-all flex items-center gap-1.5 bg-gradient-to-r from-[#397BFF] to-[#00D9FF] text-white shadow-md shadow-[#397BFF]/25 hover:opacity-95 active:scale-95 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Join Room</span>
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3.5 py-2 text-xs font-extrabold rounded-2xl transition-all flex items-center gap-1.5 bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] text-white shadow-md shadow-[#FF4FA3]/25 hover:opacity-95 active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Create Room</span>
              </button>
            </div>
          </div>

          {/* Search Bar at Top of Rooms Tab */}
          <div className="relative">
            <div
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border transition-all shadow-inner ${
                isDark
                  ? 'bg-[#171130]/90 border-[#8957FF]/30 focus-within:border-[#FF4FA3]'
                  : 'bg-white border-purple-200 focus-within:border-[#8957FF]'
              }`}
            >
              <Search className="w-4 h-4 text-[#8957FF] shrink-0" />
              <input
                type="text"
                placeholder="Search rooms or members by name, @handle, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full bg-transparent text-xs ${themeConfig.textPrimary} focus:outline-none placeholder-slate-400 font-medium`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-[#FF4FA3] rounded-lg transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Filter Pills (Shown when search query is entered) */}
            {searchQuery.trim() && (
              <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5 text-[11px]">
                <button
                  onClick={() => setSearchCategory('all')}
                  className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                    searchCategory === 'all'
                      ? 'bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white shadow-sm'
                      : isDark
                      ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                      : 'bg-purple-50 text-slate-700 hover:bg-purple-100'
                  }`}
                >
                  All ({filteredRooms.length + filteredMembers.length})
                </button>
                <button
                  onClick={() => setSearchCategory('rooms')}
                  className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                    searchCategory === 'rooms'
                      ? 'bg-gradient-to-r from-[#397BFF] to-[#00D9FF] text-white shadow-sm'
                      : isDark
                      ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                      : 'bg-purple-50 text-slate-700 hover:bg-purple-100'
                  }`}
                >
                  Rooms ({filteredRooms.length})
                </button>
                <button
                  onClick={() => setSearchCategory('members')}
                  className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                    searchCategory === 'members'
                      ? 'bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 shadow-sm'
                      : isDark
                      ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                      : 'bg-purple-50 text-slate-700 hover:bg-purple-100'
                  }`}
                >
                  Members ({filteredMembers.length})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Real-time Search Results View */}
      {searchQuery.trim() ? (
        <div className="flex-1 p-4 pb-28 space-y-4">
          <div className={`flex items-center justify-between text-xs ${themeConfig.textSecondary}`}>
            <span>
              Search results for <strong className={`${themeConfig.textPrimary} font-bold`}>"{searchQuery}"</strong>
            </span>
            <button
              onClick={() => setSearchQuery('')}
              className="text-[#FF4FA3] font-bold hover:underline cursor-pointer"
            >
              Clear filter
            </button>
          </div>

          {/* Matched Rooms Section */}
          {(searchCategory === 'all' || searchCategory === 'rooms') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-extrabold ${themeConfig.textMuted} uppercase tracking-wider font-mono`}>
                  Matching Rooms ({filteredRooms.length})
                </span>
              </div>
              {filteredRooms.length === 0 ? (
                <div className={`p-3 rounded-2xl ${themeConfig.cardBg} border text-center text-xs ${themeConfig.textSecondary}`}>
                  No rooms matched "{searchQuery}"
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {filteredRooms.map((room, idx) => {
                    const isSelected = room.id === selectedRoomId;
                    const isUniversal = room.isUniversal || room.id === 'room-universal';
                    const palette = ROOM_PALETTES[idx % ROOM_PALETTES.length];
                    return (
                      <div
                        key={room.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${themeConfig.cardBg} ${
                          isSelected ? 'ring-2 ring-[#FF4FA3] border-[#FF4FA3]/60' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                          <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${palette.gradient} flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-md`}>
                            {isUniversal ? <Globe className="w-5 h-5" /> : room.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className={`font-extrabold text-xs ${themeConfig.textPrimary} truncate`}>{room.name}</h4>
                              {room.hasPassword && <Lock className="w-3 h-3 text-[#FFD166] shrink-0" />}
                            </div>
                            <p className={`text-[11px] ${themeConfig.textSecondary} truncate mt-0.5`}>
                              {room.description || 'Social communication and live location sharing room.'}
                            </p>
                            <span className="text-[10px] text-[#00D9FF] font-mono font-bold">
                              {room.memberCount} members · ID: {room.id}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            onSelectRoom(room.id);
                            toast.success(`Switched to room: ${room.name}`);
                          }}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold shrink-0 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white shadow-sm'
                              : isDark
                              ? 'bg-white/10 hover:bg-white/20 text-white'
                              : 'bg-purple-100 hover:bg-purple-200 text-purple-900'
                          }`}
                        >
                          {isSelected ? 'Active' : 'Open'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Matched Members Section */}
          {(searchCategory === 'all' || searchCategory === 'members') && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-extrabold ${themeConfig.textMuted} uppercase tracking-wider font-mono`}>
                  Matching Members ({filteredMembers.length})
                </span>
              </div>
              {filteredMembers.length === 0 ? (
                <div className={`p-3 rounded-2xl ${themeConfig.cardBg} border text-center text-xs ${themeConfig.textSecondary}`}>
                  No members matched "{searchQuery}"
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMembers.map((member) => (
                    <div
                      key={member.userId}
                      className={`p-3 rounded-2xl border ${themeConfig.cardBg} transition-all flex items-center justify-between gap-3`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-10 h-10 shrink-0">
                          <div className={member.isOnline ? 'social-story-ring-live w-full h-full' : 'social-story-ring w-full h-full'}>
                            <img
                              src={member.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${member.userId}`}
                              alt={member.fullName}
                              className="w-full h-full rounded-full object-cover bg-slate-800"
                            />
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0B0719] ${
                              member.isOnline ? 'bg-[#00D6A0]' : 'bg-slate-400'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-extrabold text-xs ${themeConfig.textPrimary} truncate`}>{member.fullName}</span>
                            {member.role && (
                              <span className="px-1.5 py-0.5 rounded-full bg-[#8957FF]/15 text-[9px] font-mono font-bold text-[#8957FF] dark:text-[#E9DFFF] uppercase">
                                {member.role}
                              </span>
                            )}
                          </div>
                          <span className={`text-[11px] ${themeConfig.textSecondary} block truncate`}>
                            @{member.username} {member.roomName ? `· in ${member.roomName}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {member.userId !== user?.id && (
                          <button
                            type="button"
                            onClick={() => handleToggleMemberGeofenceAlert(member.userId, member.fullName)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                              getMemberAlertConfig(member.userId).enabled
                                ? 'bg-[#FFD166]/20 border-[#FFD166]/50 text-amber-600 dark:text-[#FFD166]'
                                : isDark
                                ? 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/15'
                                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {getMemberAlertConfig(member.userId).enabled ? (
                              <>
                                <BellRing className="w-3.5 h-3.5 text-[#FFD166]" />
                                <span>Geofence On</span>
                              </>
                            ) : (
                              <>
                                <BellOff className="w-3.5 h-3.5 text-slate-400" />
                                <span>Geofence Off</span>
                              </>
                            )}
                          </button>
                        )}
                        {onSelectUserForChat && member.userId !== user?.id && (
                          <button
                            onClick={() => onSelectUserForChat(member.userId)}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                            title="Direct Message"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Chat</span>
                          </button>
                        )}
                        {member.latitude !== undefined && member.longitude !== undefined && onFocusMapLocation && (
                          <button
                            onClick={() => onFocusMapLocation(member.latitude!, member.longitude!)}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                            title="Locate on Map"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Map</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {filteredRooms.length === 0 && filteredMembers.length === 0 && (
            <div className="py-10 text-center space-y-2">
              <Users className="w-10 h-10 text-[#8957FF]/60 mx-auto" />
              <p className={`text-sm font-extrabold ${themeConfig.textPrimary}`}>No rooms or members found</p>
              <p className={`text-xs ${themeConfig.textSecondary} max-w-xs mx-auto`}>
                Try searching by first name, @username, or room topic name.
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Universal Hub Pinned Notification Banner */}
          {!isRoomFullscreen && rooms.some((r) => r.isUniversal || r.id === 'room-universal') && (
            <div className="mx-3 sm:mx-4 mt-3 p-4 rounded-3xl bg-gradient-to-r from-[#8957FF] via-[#6C47FF] to-[#397BFF] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-[#8957FF]/25 border border-white/20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-inner shrink-0">
                  <Globe className="w-5 h-5 text-[#00D9FF] animate-spin-slow" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-extrabold tracking-tight text-white">Beacon Network Universal Hub</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#00D6A0] text-slate-950 text-[10px] font-extrabold shadow-xs">
                      Open to All
                    </span>
                  </div>
                  <p className="text-[11px] text-white/85">
                    Community room pinned to top — live chat, voice lounge & shared GPS map
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  onClick={() => {
                    onSelectRoom('room-universal');
                    if (onOpenChat) {
                      onOpenChat('room-universal');
                      toast.success('Opening Universal Hub Messages & Chat...');
                    }
                  }}
                  className="px-3.5 py-2 rounded-2xl text-xs font-extrabold bg-white hover:bg-slate-100 text-[#6C47FF] shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shrink-0"
                  title="Message in Universal Hub"
                >
                  <MessageSquare className="w-4 h-4 text-[#8957FF]" />
                  <span>Open Chat</span>
                </button>
                <button
                  onClick={() => {
                    onSelectRoom('room-universal');
                    joinVoiceChannel('room-universal');
                    toast.info('Connecting to Universal WebRTC voice channel...');
                  }}
                  className="px-3 py-2 rounded-2xl text-xs font-extrabold bg-white/15 hover:bg-white/25 text-white border border-white/30 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  title="Join Universal Live Audio"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-[#00D6A0]" />
                  <span>Voice</span>
                </button>
              </div>
            </div>
          )}

          {/* Full-Width Room Cards Grid (Universal Lounge & Custom Rooms span full width like other cards) */}
          {!isRoomFullscreen && (
            <div className={`px-3 sm:px-4 py-3 grid grid-cols-1 ${rooms.length > 1 ? 'sm:grid-cols-2' : ''} gap-2.5 border-b ${themeConfig.glassBorder} shrink-0`}>
              {rooms.map((room, idx) => {
                const isSelected = room.id === selectedRoomId;
                const isUniversal = room.isUniversal || room.id === 'room-universal';
                const palette = ROOM_PALETTES[idx % ROOM_PALETTES.length];
                return (
                  <div
                    key={room.id}
                    onClick={() => {
                      onSelectRoom(room.id);
                      setTimeout(() => {
                        activeRoomSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 60);
                    }}
                    className={`w-full group relative p-3.5 rounded-3xl text-xs font-extrabold transition-all flex items-center justify-between gap-3 cursor-pointer border ${
                      isUniversal && rooms.length % 2 === 1 ? 'sm:col-span-2' : ''
                    } ${
                      isSelected
                        ? `bg-gradient-to-r ${palette.gradient} text-white border-white/30 shadow-lg shadow-[#FF4FA3]/20`
                        : `${themeConfig.cardBg} ${themeConfig.textPrimary} hover:border-[#8957FF]/50`
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black shrink-0 ${
                          isSelected
                            ? 'bg-white/20 text-white border border-white/30'
                            : `bg-gradient-to-tr ${palette.gradient} text-white shadow-sm`
                        }`}
                      >
                        {isUniversal ? <Globe className="w-5 h-5" /> : room.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="text-left min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-extrabold truncate">{room.name}</span>
                          {room.hasPassword && <Lock className="w-3.5 h-3.5 opacity-80 shrink-0" />}
                          {isUniversal && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                isSelected
                                  ? 'bg-white/25 text-white'
                                  : 'bg-[#8957FF]/15 text-[#8957FF] dark:text-[#00D9FF]'
                              }`}
                            >
                              Global Lounge
                            </span>
                          )}
                        </div>
                        <span className={`block text-[11px] font-medium truncate mt-0.5 ${isSelected ? 'text-white/90' : themeConfig.textSecondary}`}>
                          {room.memberCount} member{room.memberCount === 1 ? '' : 's'} · {room.description || 'Tap to view live room map, voice lounge & members'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRoom(room.id);
                          setIsRoomFullscreen(true);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                          isSelected
                            ? 'bg-white text-[#8957FF] shadow-sm hover:bg-slate-100'
                            : isDark
                            ? 'bg-white/10 hover:bg-white/20 text-white'
                            : 'bg-purple-100 hover:bg-purple-200 text-purple-900'
                        }`}
                        title={`Expand ${room.name} to Full Screen`}
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Full Screen</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Active Room Detailed Content */}
          {activeRoomDetails ? (
            <div
              ref={activeRoomSectionRef}
              className={
                isRoomFullscreen
                  ? `fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 pb-28 space-y-5 ${themeConfig.appBg} animate-in fade-in duration-150`
                  : 'flex-1 p-3 sm:p-4 pb-28 space-y-5'
              }
            >
              {isRoomFullscreen && (
                <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#397BFF] text-white shadow-lg">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Globe className="w-5 h-5 shrink-0 animate-spin-slow" />
                    <span className="font-extrabold text-sm truncate">
                      {activeRoomDetails.name} — Full Screen View
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRoomFullscreen(false)}
                    className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Exit Full Screen</span>
                  </button>
                </div>
              )}

              {/* Active Colourful Room Banner Card */}
              <div className={`w-full rounded-3xl border overflow-hidden shadow-lg ${themeConfig.cardBg}`}>
                <div className="h-2 w-full bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#00D9FF]" />
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#8957FF] via-[#FF4FA3] to-[#FF8066] text-white flex items-center justify-center font-black text-base shadow-lg shadow-[#8957FF]/25 shrink-0">
                        {activeRoomDetails.isUniversal || activeRoomDetails.id === 'room-universal' ? (
                          <Globe className="w-6 h-6" />
                        ) : (
                          activeRoomDetails.name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`font-extrabold ${themeConfig.textPrimary} text-lg tracking-tight`}>
                            {activeRoomDetails.name}
                          </h3>
                          {(activeRoomDetails.isUniversal || activeRoomDetails.id === 'room-universal') && (
                            <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#8957FF]/20 to-[#397BFF]/20 text-[#8957FF] dark:text-[#00D9FF] border border-[#8957FF]/30 text-[10px] font-extrabold">
                              🌐 Universal Hub
                            </span>
                          )}
                          {activeRoomDetails.hasPassword && (
                            <span className="px-2.5 py-0.5 rounded-full bg-[#FFD166]/20 text-amber-600 dark:text-[#FFD166] border border-[#FFD166]/40 text-[10px] font-extrabold flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Private Key
                            </span>
                          )}
                        </div>
                        <p className={`text-xs ${themeConfig.textSecondary} mt-1`}>
                          {activeRoomDetails.description || 'Colourful social room with live location sharing and group chat.'}
                        </p>

                        {/* Member Avatar Stack & Room Metadata */}
                        <div className="mt-3 flex items-center gap-3 flex-wrap">
                          {activeRoomDetails.members && activeRoomDetails.members.length > 0 && (
                            <div className="flex items-center -space-x-2">
                              {activeRoomDetails.members.slice(0, 6).map((m) => {
                                const mOnline = onlineUserIds.includes(m.userId);
                                return (
                                  <div key={m.userId} className="relative">
                                    <img
                                      src={m.user.avatarUrl}
                                      alt={m.user.fullName}
                                      title={`${m.user.fullName} (${mOnline ? 'Online' : 'Offline'})`}
                                      className="w-7 h-7 rounded-full object-cover ring-2 ring-[#8957FF]/60 bg-slate-800"
                                    />
                                    {mOnline && (
                                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#00D6A0] ring-1 ring-slate-950" />
                                    )}
                                  </div>
                                );
                              })}
                              {activeRoomDetails.members.length > 6 && (
                                <span className="w-7 h-7 rounded-full bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-white/20">
                                  +{activeRoomDetails.members.length - 6}
                                </span>
                              )}
                            </div>
                          )}
                          <div className={`flex items-center gap-2 text-xs ${themeConfig.textSecondary}`}>
                            <span>
                              ID:{' '}
                              <code className="px-1.5 py-0.5 rounded-lg bg-[#8957FF]/15 text-[#8957FF] dark:text-[#00D9FF] font-mono font-bold select-all">
                                {activeRoomDetails.id}
                              </code>
                            </span>
                            <span>·</span>
                            <span>
                              Role: <strong className="text-[#FF4FA3]">{myMembership?.role || 'MEMBER'}</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsRoomFullscreen((prev) => !prev)}
                        className={`px-3.5 py-2 rounded-2xl font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border ${
                          isRoomFullscreen
                            ? 'bg-white/15 text-white border-white/30'
                            : isDark
                            ? 'bg-white/10 hover:bg-white/20 text-white border-white/15'
                            : 'bg-purple-100 hover:bg-purple-200 text-purple-900 border-purple-200'
                        }`}
                        title={isRoomFullscreen ? 'Exit Full Screen' : `Expand ${activeRoomDetails.name} to Full Screen`}
                      >
                        {isRoomFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                        <span>{isRoomFullscreen ? 'Normal View' : 'Full Screen'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setRoomMapFocusCoords(null);
                          setHasMountedRoomMap(true);
                          if (!showRoomMap) {
                            setShowRoomMap(true);
                            setTimeout(() => {
                              roomMapPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }, 80);
                          } else {
                            setIsRoomMapFullscreen(true);
                          }
                        }}
                        className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-[#00D6A0]/20 transition-all cursor-pointer active:scale-95"
                        title={`Open Live Map showing users in ${activeRoomDetails.name}`}
                      >
                        <MapIcon className="w-3.5 h-3.5" />
                        <span>Live Map ({activeRoomDetails.members?.length || 1})</span>
                      </button>

                      <button
                        type="button"
                        data-testid="room-header-define-geofence-btn"
                        onClick={() => {
                          roomGeofenceSectionRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest',
                          });
                          handleOpenDefinePlaceGeofenceModal();
                        }}
                        className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-[#FFD166] to-[#FF8066] text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-[#FFD166]/20 transition-all cursor-pointer active:scale-95"
                        title="Define a geofence around a saved place for this room"
                      >
                        <Radar className="w-3.5 h-3.5" />
                        <span>
                          Place Geofences ({activeRoomGeofences.filter((g) => g.enabled).length})
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          voiceNoteSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                          if (isRecordingVoiceNote) {
                            stopAndSendRoomVoiceNote();
                          } else {
                            startRoomVoiceNoteRecording();
                          }
                        }}
                        className={`px-3.5 py-2 rounded-2xl font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95 ${
                          isRecordingVoiceNote
                            ? 'bg-gradient-to-r from-rose-500 to-[#FF4FA3] text-white shadow-rose-500/30 animate-pulse'
                            : 'bg-gradient-to-r from-[#397BFF] to-[#8957FF] text-white shadow-[#397BFF]/25'
                        }`}
                        title={
                          isRecordingVoiceNote
                            ? `Stop & Send Voice Note to ${activeRoomDetails.name}`
                            : `Record Voice Note for ${activeRoomDetails.name}`
                        }
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>
                          {isRecordingVoiceNote
                            ? `Stop & Send (${formatVoiceNoteDuration(voiceNoteRecordingSeconds)})`
                            : 'Record Voice Note'}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          onOpenChat?.(activeRoomDetails.id);
                          toast.success(`Opening chat in ${activeRoomDetails.name}...`);
                        }}
                        className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-[#FF4FA3]/25 transition-all cursor-pointer active:scale-95"
                        title={`Open Messages in ${activeRoomDetails.name}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Room Chat</span>
                      </button>

                      {!(activeRoomDetails.isUniversal || activeRoomDetails.id === 'room-universal') && (
                        <button
                          onClick={() => handleLeaveRoom(activeRoomDetails.id)}
                          className="px-3 py-2 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border border-rose-500/30 font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                          title="Leave Room"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Leave</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Action Suite for Universal Hub */}
                  {(activeRoomDetails.isUniversal || activeRoomDetails.id === 'room-universal') && (
                    <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-[#1D143D] via-[#25184E] to-[#1A2954] border border-[#8957FF]/40 text-white space-y-3 shadow-md">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#8957FF] to-[#00D9FF] flex items-center justify-center text-white shadow">
                            <Globe className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-extrabold text-white block">
                              Universal Lounge Conversation Bar
                            </span>
                            <span className="text-[11px] text-[#E9DFFF]/80 block">
                              #general · #live-locations · #announcements · #lounge
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => {
                              onOpenChat?.('room-universal');
                              toast.success('Switching to Universal Hub Messages & Chat...');
                            }}
                            className="flex-1 sm:flex-initial px-3.5 py-2 bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Open Full Chat</span>
                          </button>
                          {myLocation && onFocusMapLocation && (
                            <button
                              onClick={() => onFocusMapLocation(myLocation.latitude, myLocation.longitude)}
                              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 border border-white/20 transition-all cursor-pointer"
                            >
                              <MapPin className="w-3.5 h-3.5 text-[#00D6A0]" />
                              <span>My Pin</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline Quick Message Composer */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!quickHubMessage.trim()) return;
                          sendMessage({
                            roomId: 'room-universal',
                            channelId: 'general',
                            text: quickHubMessage.trim(),
                          });
                          setQuickHubMessage('');
                          toast.success('Message sent to Universal Hub!');
                        }}
                        className="flex items-center gap-2 pt-2 border-t border-white/10"
                      >
                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder="Send a quick message to Universal Hub..."
                            value={quickHubMessage}
                            onChange={(e) => setQuickHubMessage(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-xl bg-white/10 border border-white/20 text-xs text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-[#FF4FA3]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            voiceNoteSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            if (!isRecordingVoiceNote) {
                              startRoomVoiceNoteRecording();
                            }
                          }}
                          className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-[#00D9FF] border border-white/20 transition-all cursor-pointer shrink-0"
                          title="Record a Voice Note for Universal Hub"
                        >
                          <Mic className="w-4 h-4" />
                        </button>
                        <button
                          type="submit"
                          disabled={!quickHubMessage.trim()}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#397BFF] to-[#00D9FF] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 shrink-0 shadow-sm"
                        >
                          <span>Send</span>
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Record Voice Note for Active Room Studio */}
                  <div
                    ref={voiceNoteSectionRef}
                    className={`mt-4 pt-4 border-t ${themeConfig.glassBorder} space-y-3`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm ${
                            isRecordingVoiceNote
                              ? 'bg-gradient-to-tr from-rose-500 to-[#FF4FA3] animate-pulse'
                              : 'bg-gradient-to-tr from-[#8957FF] to-[#397BFF]'
                          }`}
                        >
                          <FileAudio className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-extrabold ${themeConfig.textPrimary}`}>
                              Record Voice Note — {activeRoomDetails.name}
                            </span>
                            {isRecordingVoiceNote && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-500 border border-rose-500/40 text-[10px] font-extrabold animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                REC {formatVoiceNoteDuration(voiceNoteRecordingSeconds)}
                              </span>
                            )}
                          </div>
                          <span className={`text-[11px] ${themeConfig.textSecondary} block`}>
                            Capture microphone audio, encode it, and post directly into this room's chat channel
                          </span>
                        </div>
                      </div>

                      {/* Target Channel Selector */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={`text-[10px] font-bold ${themeConfig.textSecondary} mr-1 flex items-center gap-0.5`}>
                          <Hash className="w-3 h-3 text-[#8957FF]" />
                          Channel:
                        </span>
                        {ROOM_VOICE_NOTE_CHANNELS.map((ch) => {
                          const isSelectedChannel = voiceNoteChannel === ch.id;
                          return (
                            <button
                              key={ch.id}
                              type="button"
                              onClick={() => setVoiceNoteChannel(ch.id)}
                              className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                                isSelectedChannel
                                  ? 'bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white shadow-xs'
                                  : isDark
                                  ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                                  : 'bg-purple-50 hover:bg-purple-100 text-purple-900'
                              }`}
                            >
                              {ch.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* State 1: Currently Recording Audio from Microphone */}
                    {isRecordingVoiceNote ? (
                      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#1A103C] via-[#24134A] to-[#2B123F] border border-rose-500/40 text-white space-y-3 shadow-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-400/40 shrink-0">
                              <span className="absolute inset-0 rounded-2xl bg-rose-500/30 animate-ping" />
                              <Mic className="w-5 h-5 text-rose-400 relative z-10" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-extrabold text-white">
                                  Recording Microphone Audio...
                                </span>
                                <span className="font-mono text-xs font-black text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-lg border border-rose-400/30">
                                  {formatVoiceNoteDuration(voiceNoteRecordingSeconds)}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-300 block mt-0.5">
                                Target: <strong>{activeRoomDetails.name}</strong> ({`#${voiceNoteChannel}`})
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-center bg-slate-950/60 px-3 py-1.5 rounded-xl border border-white/10">
                            <AudioWaveformVisualizer
                              analyser={voiceRecorderRef.current?.getAnalyser() || null}
                              height={32}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-white/10">
                          <input
                            type="text"
                            placeholder="Optional caption for this voice note..."
                            value={voiceNoteCaption}
                            onChange={(e) => setVoiceNoteCaption(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#FF4FA3]"
                          />
                          <div className="flex items-center gap-2 justify-end shrink-0">
                            <button
                              type="button"
                              onClick={cancelRoomVoiceNoteRecording}
                              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/25 text-rose-300 border border-white/15 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
                              title="Cancel recording"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Cancel</span>
                            </button>
                            <button
                              type="button"
                              onClick={stopRoomVoiceNoteForPreview}
                              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
                              title="Stop recording and preview before sending"
                            >
                              <Square className="w-3.5 h-3.5 fill-current text-[#FFD166]" />
                              <span>Stop & Preview</span>
                            </button>
                            <button
                              type="button"
                              onClick={stopAndSendRoomVoiceNote}
                              disabled={isSendingVoiceNote}
                              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                              title="Stop recording, encode audio, and send immediately to room"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Stop & Send</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : voiceNotePreview ? (
                      /* State 2: Recorded Audio Encoded & Ready for Preview or Send */
                      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#15102F] via-[#1E1542] to-[#162447] border border-[#00D9FF]/40 text-white space-y-3 shadow-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded-full bg-[#00D6A0]/20 text-[#00D6A0] border border-[#00D6A0]/40 text-[10px] font-extrabold">
                                Audio Encoded ({Math.max(1, Math.round(voiceNotePreview.sizeBytes / 1024))} KB)
                              </span>
                              <span className="text-xs font-extrabold text-white">
                                Preview Voice Note ({formatVoiceNoteDuration(voiceNotePreview.durationSeconds)})
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300">
                              Ready to send into <strong>{activeRoomDetails.name}</strong> ({`#${voiceNoteChannel}`})
                            </p>
                          </div>

                          <div className="w-full sm:w-auto">
                            <VoiceMessagePlayer
                              src={voiceNotePreview.dataUrl}
                              initialDuration={voiceNotePreview.durationSeconds}
                              compact
                            />
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-white/10">
                          <input
                            type="text"
                            placeholder="Add an optional message caption with your voice note..."
                            value={voiceNoteCaption}
                            onChange={(e) => setVoiceNoteCaption(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#00D9FF]"
                          />
                          <div className="flex items-center gap-2 justify-end shrink-0">
                            <button
                              type="button"
                              onClick={cancelRoomVoiceNoteRecording}
                              disabled={isSendingVoiceNote}
                              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/25 text-rose-300 border border-white/15 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Discard</span>
                            </button>
                            <button
                              type="button"
                              onClick={startRoomVoiceNoteRecording}
                              disabled={isSendingVoiceNote}
                              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Mic className="w-3.5 h-3.5 text-[#00D9FF]" />
                              <span>Re-record</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => dispatchEncodedVoiceNoteToRoom(voiceNotePreview)}
                              disabled={isSendingVoiceNote}
                              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{isSendingVoiceNote ? 'Sending...' : `Send to #${voiceNoteChannel}`}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* State 3: Idle - Ready to Record Voice Note */
                      <div
                        className={`p-3 rounded-2xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 ${
                          isDark
                            ? 'bg-[#150E2E]/90 border-[#8957FF]/30'
                            : 'bg-purple-50/70 border-purple-200/80'
                        }`}
                      >
                        <input
                          type="text"
                          placeholder={`Optional caption for your voice note in ${activeRoomDetails.name} (#${voiceNoteChannel})...`}
                          value={voiceNoteCaption}
                          onChange={(e) => setVoiceNoteCaption(e.target.value)}
                          className={`flex-1 px-3.5 py-2 rounded-xl text-xs font-medium focus:outline-none border ${
                            isDark
                              ? 'bg-white/5 border-white/15 text-white placeholder-slate-400 focus:border-[#FF4FA3]'
                              : 'bg-white border-purple-200 text-slate-900 placeholder-slate-400 focus:border-[#8957FF]'
                          }`}
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={startRoomVoiceNoteRecording}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-[#FF4FA3]/20 hover:opacity-95 transition-all cursor-pointer active:scale-95"
                          >
                            <Mic className="w-4 h-4" />
                            <span>Record Voice Note</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Recent Voice Notes Sent in Active Room */}
                    {activeRoomVoiceNotes.length > 0 && (
                      <div className="pt-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-extrabold ${themeConfig.textSecondary} flex items-center gap-1.5`}>
                            <Volume2 className="w-3.5 h-3.5 text-[#00D9FF]" />
                            <span>Recent Voice Notes in {activeRoomDetails.name} ({activeRoomVoiceNotes.length})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenChat?.(activeRoomDetails.id)}
                            className="text-[11px] font-extrabold text-[#FF4FA3] hover:underline cursor-pointer"
                          >
                            Open in Room Chat →
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {activeRoomVoiceNotes.map((vn) => (
                            <div
                              key={vn.id}
                              className={`p-2.5 rounded-2xl border flex flex-col gap-2 ${
                                isDark
                                  ? 'bg-[#120C28]/90 border-white/10'
                                  : 'bg-white border-purple-200/80'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <img
                                    src={
                                      vn.senderAvatar ||
                                      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(vn.senderName)}`
                                    }
                                    alt={vn.senderName}
                                    className="w-6 h-6 rounded-full object-cover bg-slate-800 shrink-0"
                                  />
                                  <span className={`text-xs font-extrabold ${themeConfig.textPrimary} truncate`}>
                                    {vn.senderName}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded-md bg-[#8957FF]/15 text-[#8957FF] dark:text-[#00D9FF] text-[10px] font-mono font-bold">
                                    #{vn.channelId}
                                  </span>
                                </div>
                                <span className={`text-[10px] font-mono ${themeConfig.textSecondary} shrink-0`}>
                                  {new Date(vn.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              {vn.text && vn.text !== '🎤 Voice message' && (
                                <p className={`text-[11px] ${themeConfig.textSecondary} truncate`}>{vn.text}</p>
                              )}
                              <VoiceMessagePlayer src={vn.url} initialDuration={vn.duration} compact />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Live WebRTC Voice Channel Island */}
                  <div className={`mt-4 pt-4 border-t ${themeConfig.glassBorder}`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            activeVoiceRoomId === activeRoomDetails.id
                              ? 'bg-[#00D6A0] animate-ping'
                              : 'bg-[#8957FF]'
                          }`}
                        />
                        <span className={`text-xs font-extrabold ${themeConfig.textPrimary}`}>
                          Beacon Network Voice Lounge (WebRTC)
                        </span>
                      </div>

                      {activeVoiceRoomId === activeRoomDetails.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={toggleMicMute}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer ${
                              isMicMuted
                                ? 'bg-[#FFD166]/25 text-amber-600 dark:text-[#FFD166] border border-[#FFD166]/40'
                                : isDark
                                ? 'bg-white/10 hover:bg-white/20 text-white'
                                : 'bg-purple-100 hover:bg-purple-200 text-purple-900'
                            }`}
                          >
                            {isMicMuted ? <MicOff className="w-4 h-4 text-[#FF8066]" /> : <Mic className="w-4 h-4 text-[#00D6A0]" />}
                            {isMicMuted ? 'Muted' : 'Mic On'}
                          </button>
                          <button
                            onClick={leaveVoiceChannel}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-[#FF4FA3] to-[#FF8066] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow cursor-pointer"
                          >
                            <PhoneOff className="w-4 h-4" />
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => joinVoiceChannel(activeRoomDetails.id)}
                          className="px-3.5 py-2 bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                        >
                          <PhoneCall className="w-4 h-4" />
                          Join Voice Lounge
                        </button>
                      )}
                    </div>

                    {/* Active Voice Participants Grid */}
                    {activeVoiceRoomId === activeRoomDetails.id && (
                      <div className="mt-3 p-3.5 bg-[#150E2E] rounded-2xl text-white border border-[#8957FF]/30">
                        <span className="text-[11px] text-[#E9DFFF]/70 font-bold block mb-2">
                          Connected Speakers:
                        </span>
                        <div className="flex flex-wrap gap-3">
                          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                            <div className={`relative w-6 h-6 rounded-full overflow-hidden ${isSpeaking ? 'ring-2 ring-[#00D6A0]' : ''}`}>
                              <img src={user?.avatarUrl} alt="" className="w-full h-full object-cover" />
                            </div>
                            <span className="text-xs font-bold">You</span>
                            {isMicMuted ? (
                              <MicOff className="w-3 h-3 text-[#FFD166]" />
                            ) : isSpeaking ? (
                              <Volume2 className="w-3 h-3 text-[#00D6A0] animate-pulse" />
                            ) : (
                              <Mic className="w-3 h-3 text-slate-300" />
                            )}
                          </div>

                          {voiceParticipants.map((p) => (
                            <div
                              key={p.peerId}
                              className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15"
                            >
                              <div className={`relative w-6 h-6 rounded-full overflow-hidden ${p.isSpeaking ? 'ring-2 ring-[#00D6A0]' : ''}`}>
                                <img src={p.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                              </div>
                              <span className="text-xs font-bold">{p.user.fullName.split(' ')[0]}</span>
                              {p.isSpeaking && <Volume2 className="w-3 h-3 text-[#00D6A0] animate-pulse" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Room Live Map View Panel */}
              <div ref={roomMapPanelRef} className="space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#00D6A0] animate-ping" />
                    <h4 className={`font-extrabold ${themeConfig.textPrimary} text-sm flex items-center gap-1.5`}>
                      <MapIcon className="w-4 h-4 text-[#00D6A0]" />
                      <span>Room Live Map — {activeRoomDetails.name}</span>
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {showRoomMap && (
                      <button
                        onClick={() => setIsRoomMapFullscreen((prev) => !prev)}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#397BFF] to-[#00D9FF] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                        title={isRoomMapFullscreen ? 'Dock Map into Panel' : 'Expand Room Map to Full Screen'}
                      >
                        {isRoomMapFullscreen ? (
                          <>
                            <Minimize2 className="w-3.5 h-3.5" />
                            <span>Dock Panel</span>
                          </>
                        ) : (
                          <>
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>Full Screen</span>
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (showRoomMap) {
                          setIsRoomMapFullscreen(false);
                          setShowRoomMap(false);
                        } else {
                          setHasMountedRoomMap(true);
                          setShowRoomMap(true);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 ${
                        showRoomMap
                          ? isDark
                            ? 'bg-white/10 text-white hover:bg-white/20'
                            : 'bg-purple-100 text-purple-900 hover:bg-purple-200'
                          : 'bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950'
                      }`}
                    >
                      {showRoomMap ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showRoomMap ? 'Hide Map' : 'Show Map'}</span>
                    </button>
                  </div>
                </div>

                {(showRoomMap || hasMountedRoomMap) && (
                  <div
                    className={
                      !showRoomMap
                        ? 'sr-only h-0 overflow-hidden pointer-events-none opacity-0'
                        : isRoomMapFullscreen
                          ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col animate-in fade-in duration-150'
                          : 'relative w-full h-[520px] sm:h-[580px] rounded-3xl overflow-hidden border-2 border-[#8957FF]/35 shadow-xl bg-slate-950 flex flex-col transition-all duration-200'
                    }
                  >
                    {isRoomMapFullscreen && (
                      <div className="bg-[#120C29]/95 border-b border-white/10 px-4 py-2.5 flex items-center justify-between text-white shrink-0 z-40">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#00D6A0] animate-pulse shrink-0" />
                          <span className="font-extrabold text-xs truncate">
                            {activeRoomDetails.name} — Full Screen Beacon Room Map
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setIsRoomMapFullscreen(false)}
                            className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Minimize2 className="w-3.5 h-3.5 text-[#00D9FF]" />
                            <span>Dock Panel</span>
                          </button>
                          <button
                            onClick={() => {
                              setIsRoomMapFullscreen(false);
                              setShowRoomMap(false);
                            }}
                            className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 cursor-pointer transition-colors"
                            title="Close Room Map"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="relative flex-1 w-full h-full">
                      <LiveMap
                        isActive={isActive && showRoomMap}
                        roomOnlyMode={true}
                        activeRoomDetails={activeRoomDetails}
                        onCloseRoomMap={
                          isRoomMapFullscreen
                            ? () => setIsRoomMapFullscreen(false)
                            : () => setShowRoomMap(false)
                        }
                        focusCoords={roomMapFocusCoords}
                        savedPlaces={savedPlaces}
                        onRefreshSavedPlaces={onRefreshSavedPlaces}
                        rooms={rooms}
                        selectedRoomId={activeRoomDetails.id}
                        onSelectUserForChat={(targetUserId) => {
                          setIsRoomMapFullscreen(false);
                          onSelectUserForChat?.(targetUserId);
                        }}
                        onAddPlaceAtCoords={(lat, lng) => {
                          setIsRoomMapFullscreen(false);
                          onAddPlaceAtCoords?.(lat, lng);
                        }}
                        onSetReminderAtCoords={(lat, lng, title) => {
                          setIsRoomMapFullscreen(false);
                          onSetReminderAtCoords?.(lat, lng, title);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ======================================================================== */}
              {/* SAVED-PLACE GEOFENCES & AUTOMATIC ENTER/LEAVE PUSH NOTIFICATIONS SECTION */}
              {/* ======================================================================== */}
              <div
                ref={roomGeofenceSectionRef}
                data-testid="room-saved-place-geofences-section"
                className={`rounded-3xl border p-4 sm:p-5 space-y-4 shadow-lg ${themeConfig.cardBg}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FFD166] via-[#FF8066] to-[#FF4FA3] text-slate-950 flex items-center justify-center shrink-0 shadow-md">
                      <Radar className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`font-extrabold ${themeConfig.textPrimary} text-sm sm:text-base`}>
                          Saved-Place Geofences — {activeRoomDetails.name}
                        </h4>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#FFD166]/20 text-amber-600 dark:text-[#FFD166] border border-[#FFD166]/40 text-[10px] font-extrabold">
                          {activeRoomGeofences.filter((g) => g.enabled).length} Active Zone
                          {activeRoomGeofences.filter((g) => g.enabled).length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <p className={`text-xs ${themeConfig.textSecondary} mt-0.5`}>
                        Define a geofence perimeter around any saved place to trigger an automatic push notification when a group member enters or leaves that area.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      type="button"
                      data-testid="open-define-place-geofence-modal-btn"
                      onClick={() => handleOpenDefinePlaceGeofenceModal()}
                      className="px-4 py-2 rounded-2xl bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-[#FF4FA3]/25 hover:opacity-95 transition-all cursor-pointer active:scale-95"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                      <span>Define Place Geofence</span>
                    </button>
                  </div>
                </div>

                {/* Quick Saved Places Strip (1-Click Define Geofence for any Saved Place not yet configured in this room) */}
                {savedPlaces.length > 0 && (
                  <div className={`pt-2 border-t ${themeConfig.glassBorder} space-y-2`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[11px] font-extrabold ${themeConfig.textSecondary} flex items-center gap-1.5`}>
                        <Sparkles className="w-3.5 h-3.5 text-[#FFD166]" />
                        <span>Your Saved Places ({savedPlaces.length}) — Tap any place to configure its Room Geofence:</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {savedPlaces.map((place) => {
                        const existingGf = activeRoomGeofences.find((g) => g.placeId === place.id);
                        const emoji = getLocationTypeEmoji(place.markerIcon || place.category);
                        return (
                          <button
                            key={place.id}
                            type="button"
                            onClick={() =>
                              existingGf
                                ? handleOpenEditRoomGeofence(existingGf)
                                : handleOpenDefinePlaceGeofenceModal(place)
                            }
                            className={`px-3 py-1.5 rounded-2xl border text-xs font-bold flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
                              existingGf?.enabled
                                ? 'bg-gradient-to-r from-[#8957FF]/25 to-[#FF4FA3]/25 border-[#FF4FA3]/50 text-white'
                                : isDark
                                ? 'bg-white/5 hover:bg-white/10 border-white/15 text-slate-200'
                                : 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-slate-800'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="truncate max-w-[130px]">{place.name}</span>
                            <span className="text-[10px] font-mono opacity-80">
                              {existingGf ? `${existingGf.radiusMeters}m Active` : `${place.radiusMeters}m · + Add`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Active Room Geofences Grid */}
                {activeRoomGeofences.length === 0 ? (
                  <div
                    className={`p-5 rounded-2xl border text-center space-y-2.5 ${
                      isDark
                        ? 'bg-[#120C29]/70 border-white/10'
                        : 'bg-purple-50/60 border-purple-200/70'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FFD166]/20 to-[#FF4FA3]/20 text-[#FFD166] flex items-center justify-center mx-auto">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <p className={`text-xs font-extrabold ${themeConfig.textPrimary}`}>
                        No Saved-Place Geofences Defined for {activeRoomDetails.name} Yet
                      </p>
                      <p className={`text-[11px] ${themeConfig.textSecondary} max-w-md mx-auto`}>
                        Select a saved place (like Home, Office, Campus, or Meetup Spot) and set a boundary radius to receive automatic push notifications whenever a group member enters or leaves.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenDefinePlaceGeofenceModal()}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FFD166] to-[#FF8066] text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Define First Saved-Place Geofence</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeRoomGeofences.map((gf) => {
                      const emoji = getLocationTypeEmoji(gf.placeIcon || gf.placeCategory || 'home');
                      const roomPeers = (activeRoomDetails.members || []).filter(
                        (m) => m.userId !== user?.id
                      );
                      const watchedMembersList =
                        gf.watchedMemberIds && gf.watchedMemberIds.length > 0
                          ? roomPeers.filter((m) => gf.watchedMemberIds.includes(m.userId))
                          : roomPeers;

                      // Calculate live inside/outside status for each watched room member
                      const memberStatuses = watchedMembersList.map((m) => {
                        const loc = userLocations.find((l) => l.userId === m.userId);
                        if (!loc) {
                          return {
                            userId: m.userId,
                            name: m.user.fullName,
                            avatar: m.user.avatarUrl,
                            distanceMeters: null as number | null,
                            isInside: false,
                          };
                        }
                        const dist = Math.round(
                          calculateDistanceMeters(
                            loc.latitude,
                            loc.longitude,
                            gf.latitude,
                            gf.longitude
                          )
                        );
                        return {
                          userId: m.userId,
                          name: m.user.fullName,
                          avatar: m.user.avatarUrl,
                          distanceMeters: dist,
                          isInside: dist <= gf.radiusMeters,
                        };
                      });

                      const insideCount = memberStatuses.filter((s) => s.isInside).length;

                      return (
                        <div
                          key={gf.id}
                          data-testid={`room-geofence-card-${gf.placeId}`}
                          className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
                            gf.enabled
                              ? isDark
                                ? 'bg-[#150E2E]/95 border-[#FFD166]/45 shadow-md'
                                : 'bg-white border-[#8957FF]/35 shadow-sm'
                              : 'opacity-65 border-white/10'
                          }`}
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg text-white shadow-md border border-white/40 shrink-0"
                                  style={{ backgroundColor: gf.color || '#8957FF' }}
                                >
                                  {emoji}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h5 className={`font-extrabold text-sm ${themeConfig.textPrimary} truncate`}>
                                      {gf.placeName}
                                    </h5>
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                        gf.enabled
                                          ? 'bg-[#00D6A0]/20 text-[#00D6A0] border border-[#00D6A0]/40'
                                          : 'bg-slate-500/20 text-slate-400'
                                      }`}
                                    >
                                      {gf.enabled ? 'Push Active' : 'Paused'}
                                    </span>
                                  </div>
                                  <div className={`flex items-center gap-1.5 text-[11px] font-mono ${themeConfig.textSecondary} mt-0.5 flex-wrap`}>
                                    <span className="text-[#00D9FF] font-bold">
                                      Radius: {gf.radiusMeters}m
                                    </span>
                                    <span>·</span>
                                    <span>
                                      {gf.latitude.toFixed(4)}, {gf.longitude.toFixed(4)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleRoomGeofenceEnabled(gf)}
                                  className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold cursor-pointer transition-colors ${
                                    gf.enabled
                                      ? 'bg-[#FFD166]/20 text-[#FFD166] border border-[#FFD166]/40 hover:bg-[#FFD166]/30'
                                      : 'bg-white/10 text-slate-300 hover:bg-white/20'
                                  }`}
                                  title={gf.enabled ? 'Pause Geofence Push Alerts' : 'Resume Geofence Push Alerts'}
                                >
                                  {gf.enabled ? 'On' : 'Off'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditRoomGeofence(gf)}
                                  className={`p-1.5 rounded-xl border cursor-pointer transition-colors ${
                                    isDark
                                      ? 'bg-white/5 hover:bg-white/15 border-white/10 text-slate-200'
                                      : 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-slate-700'
                                  }`}
                                  title="Edit Geofence Radius & Triggers"
                                >
                                  <SlidersHorizontal className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRoomGeofence(gf)}
                                  className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 cursor-pointer transition-colors"
                                  title="Delete Room Geofence"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Configured Push Trigger Badges */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {gf.notifyOnEnter && (
                                <span className="px-2 py-0.5 rounded-lg bg-[#00D6A0]/15 text-[#00D6A0] border border-[#00D6A0]/30 text-[10px] font-extrabold">
                                  🔔 Push on Enter
                                </span>
                              )}
                              {gf.notifyOnLeave && (
                                <span className="px-2 py-0.5 rounded-lg bg-[#FF4FA3]/15 text-[#FF4FA3] border border-[#FF4FA3]/30 text-[10px] font-extrabold">
                                  🚶 Push on Leave
                                </span>
                              )}
                              {gf.postToRoomChat && (
                                <span className="px-2 py-0.5 rounded-lg bg-[#8957FF]/15 text-[#8957FF] dark:text-[#E9DFFF] border border-[#8957FF]/30 text-[10px] font-extrabold">
                                  💬 #live-locations Chat
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-lg bg-white/10 text-[10px] font-bold text-slate-300">
                                👥{' '}
                                {gf.watchedMemberIds.length === 0
                                  ? 'All Room Members'
                                  : `${gf.watchedMemberIds.length} Member${gf.watchedMemberIds.length === 1 ? '' : 's'}`}
                              </span>
                            </div>

                            {/* Live Member Presence Inside / Outside This Geofence */}
                            <div
                              className={`p-2.5 rounded-xl border space-y-1.5 ${
                                isDark
                                  ? 'bg-[#0B081B]/80 border-white/10'
                                  : 'bg-slate-50 border-slate-200/80'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <span className={`font-extrabold ${themeConfig.textSecondary}`}>
                                  Live Group Member Status:
                                </span>
                                <span
                                  className={`font-mono font-bold ${
                                    insideCount > 0 ? 'text-[#00D6A0]' : themeConfig.textSecondary
                                  }`}
                                >
                                  {insideCount} Inside Zone
                                </span>
                              </div>
                              {memberStatuses.length === 0 ? (
                                <p className={`text-[11px] ${themeConfig.textSecondary}`}>
                                  Monitoring all group members who join {activeRoomDetails.name}.
                                </p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {memberStatuses.map((st) => (
                                    <span
                                      key={st.userId}
                                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 border ${
                                        st.isInside
                                          ? 'bg-[#00D6A0]/20 text-[#00D6A0] border-[#00D6A0]/40'
                                          : isDark
                                          ? 'bg-white/5 text-slate-300 border-white/10'
                                          : 'bg-white text-slate-700 border-slate-200'
                                      }`}
                                    >
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          st.isInside ? 'bg-[#00D6A0]' : 'bg-slate-400'
                                        }`}
                                      />
                                      <span className="truncate max-w-[90px]">{st.name}</span>
                                      <span className="font-mono opacity-80">
                                        {st.distanceMeters !== null
                                          ? st.isInside
                                            ? `Inside (${st.distanceMeters}m)`
                                            : formatDistance(st.distanceMeters)
                                          : 'Offline'}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card Footer Actions: View on Room Map + Test Enter/Leave Push Notification */}
                          <div className={`pt-2.5 border-t ${themeConfig.glassBorder} flex items-center justify-between gap-2 flex-wrap`}>
                            <button
                              type="button"
                              onClick={() => {
                                setRoomMapFocusCoords({ lat: gf.latitude, lng: gf.longitude });
                                setHasMountedRoomMap(true);
                                setShowRoomMap(true);
                                setTimeout(() => {
                                  roomMapPanelRef.current?.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'nearest',
                                  });
                                }, 60);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer active:scale-95"
                              title="Focus this Saved-Place Geofence on the Room Live Map"
                            >
                              <Navigation className="w-3 h-3" />
                              <span>View on Room Map</span>
                            </button>

                            <div className="flex items-center gap-1.5">
                              {gf.notifyOnEnter && (
                                <button
                                  type="button"
                                  data-testid={`test-enter-geofence-${gf.placeId}`}
                                  onClick={() => handleSimulateRoomGeofenceTransition(gf, 'entered')}
                                  className="px-2.5 py-1 rounded-xl bg-[#00D6A0]/15 hover:bg-[#00D6A0]/25 text-[#00D6A0] border border-[#00D6A0]/35 text-[10px] font-extrabold cursor-pointer transition-colors"
                                  title="Simulate a group member entering this saved place to test the automatic push notification"
                                >
                                  Test Enter Push
                                </button>
                              )}
                              {gf.notifyOnLeave && (
                                <button
                                  type="button"
                                  data-testid={`test-leave-geofence-${gf.placeId}`}
                                  onClick={() => handleSimulateRoomGeofenceTransition(gf, 'left')}
                                  className="px-2.5 py-1 rounded-xl bg-[#FF4FA3]/15 hover:bg-[#FF4FA3]/25 text-[#FF4FA3] border border-[#FF4FA3]/35 text-[10px] font-extrabold cursor-pointer transition-colors"
                                  title="Simulate a group member leaving this saved place to test the automatic push notification"
                                >
                                  Test Leave Push
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Room Geofence Push Notification Activity Log */}
                {activeRoomGeofenceEvents.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#FFD166]/15 via-[#FF4FA3]/10 to-[#8957FF]/15 border border-[#FFD166]/40 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-extrabold ${themeConfig.textPrimary} flex items-center gap-1.5`}>
                        <BellRing className="w-4 h-4 text-[#FFD166]" />
                        <span>
                          Room Geofence Push Notification Log ({activeRoomGeofenceEvents.length})
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          clearRoomGeofenceEvents(activeRoomDetails.id);
                          setRoomGeofenceEvents(loadRoomGeofenceEvents());
                        }}
                        className="text-[11px] font-extrabold text-[#FF4FA3] hover:underline cursor-pointer"
                      >
                        Clear Log
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {activeRoomGeofenceEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className={`text-xs ${themeConfig.textPrimary} flex items-center justify-between gap-2 ${themeConfig.cardBg} px-3 py-2 rounded-xl border`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase shrink-0 ${
                                ev.action === 'entered'
                                  ? 'bg-[#00D6A0]/20 text-[#00D6A0]'
                                  : 'bg-[#FF4FA3]/20 text-[#FF4FA3]'
                              }`}
                            >
                              {ev.action}
                            </span>
                            <span className="truncate">
                              <strong>{ev.memberName}</strong> {ev.action}{' '}
                              <strong>{ev.placeName}</strong>{' '}
                              <span className={`text-[11px] font-mono ${themeConfig.textSecondary}`}>
                                ({ev.distanceMeters}m · {ev.radiusMeters}m zone)
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setRoomMapFocusCoords({ lat: ev.latitude, lng: ev.longitude });
                                setHasMountedRoomMap(true);
                                setShowRoomMap(true);
                                setTimeout(() => {
                                  roomMapPanelRef.current?.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'nearest',
                                  });
                                }, 60);
                              }}
                              className="px-2 py-0.5 rounded-lg bg-[#00D9FF]/15 text-[#00D9FF] text-[10px] font-extrabold cursor-pointer hover:bg-[#00D9FF]/25"
                            >
                              Map
                            </button>
                            <span className={`text-[10px] ${themeConfig.textSecondary} font-mono`}>
                              {new Date(ev.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Room Members Roster with Real Distances & Saved Location Geofence Alerts */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className={`font-extrabold ${themeConfig.textPrimary} text-sm flex items-center gap-1.5`}>
                      <Users className="w-4 h-4 text-[#FF4FA3]" />
                      <span>Room Members & Live Coordinates ({activeRoomDetails.members?.length || 0})</span>
                    </h4>
                    <p className={`text-[11px] ${themeConfig.textSecondary}`}>
                      Toggle <strong className="text-[#FF4FA3]">Geofence Alert</strong> on any friend to get notified when they enter or leave your {savedPlaces.length} saved location{savedPlaces.length === 1 ? '' : 's'}.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {activeRoomDetails.members &&
                      activeRoomDetails.members.some((m) => m.userId !== user?.id) && (
                        <button
                          type="button"
                          onClick={() => {
                            const peers = (activeRoomDetails.members || []).filter(
                              (m) => m.userId !== user?.id
                            );
                            const allEnabled = peers.every(
                              (m) => getMemberAlertConfig(m.userId).enabled
                            );
                            const nextState = !allEnabled;
                            saveMemberGeofenceAlerts((prev) => {
                              const copy = { ...prev };
                              peers.forEach((m) => {
                                const existing = copy[m.userId] || {
                                  enabled: false,
                                  notifyOnEnter: true,
                                  notifyOnLeave: true,
                                  placeIds: [],
                                };
                                copy[m.userId] = { ...existing, enabled: nextState };
                              });
                              return copy;
                            });
                            sound.playChime();
                            toast.info(
                              nextState
                                ? `Enabled geofence enter/leave alerts for all ${peers.length} room member${peers.length === 1 ? '' : 's'}`
                                : 'Muted geofence alerts for all members in this room'
                            );
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#FFD166]/20 hover:bg-[#FFD166]/30 text-amber-600 dark:text-[#FFD166] border border-[#FFD166]/40 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>
                            {(activeRoomDetails.members || [])
                              .filter((m) => m.userId !== user?.id)
                              .every((m) => getMemberAlertConfig(m.userId).enabled)
                              ? 'Mute All Geofences'
                              : 'Alert All Members'}
                          </span>
                        </button>
                      )}

                    <button
                      onClick={() => {
                        setRoomMapFocusCoords(null);
                        setShowRoomMap(true);
                        setIsRoomMapFullscreen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#8957FF] to-[#397BFF] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                    >
                      <MapIcon className="w-3.5 h-3.5" />
                      <span>Full Room Map</span>
                    </button>
                  </div>
                </div>

                {/* Recent Geofence Enter/Exit Activity Feed */}
                {geofenceEvents.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#FFD166]/15 to-[#FF8066]/15 border border-[#FFD166]/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-extrabold ${themeConfig.textPrimary} flex items-center gap-1.5`}>
                        <BellRing className="w-4 h-4 text-[#FF8066]" />
                        <span>Recent Geofence Alerts ({geofenceEvents.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setGeofenceEvents([])}
                        className="text-[11px] font-bold text-[#FF4FA3] hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                      {geofenceEvents.slice(0, 5).map((ev) => (
                        <div
                          key={ev.id}
                          className={`text-xs ${themeConfig.textPrimary} flex items-center justify-between gap-2 ${themeConfig.cardBg} px-3 py-1.5 rounded-xl border`}
                        >
                          <span>
                            <strong>{ev.memberName}</strong>{' '}
                            <span
                              className={
                                ev.action === 'entered'
                                  ? 'text-[#00D6A0] font-extrabold'
                                  : 'text-[#FF4FA3] font-extrabold'
                              }
                            >
                              {ev.action}
                            </span>{' '}
                            <strong>{ev.placeName}</strong> ({ev.distanceMeters}m)
                          </span>
                          <span className={`text-[10px] ${themeConfig.textSecondary} font-mono shrink-0`}>
                            {new Date(ev.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2.5">
                  {activeRoomDetails.members?.map((mem) => {
                    const isOnline = onlineUserIds.includes(mem.userId);
                    const peerLoc = userLocations.find((l) => l.userId === mem.userId);
                    const alertCfg = getMemberAlertConfig(mem.userId);
                    const isExpanded = expandedGeofenceMemberId === mem.userId;

                    let distanceText = 'Location private / offline';
                    if (mem.userId === user?.id) {
                      distanceText = 'You (Current device)';
                    } else if (myLocation && peerLoc) {
                      const m = calculateDistanceMeters(
                        myLocation.latitude,
                        myLocation.longitude,
                        peerLoc.latitude,
                        peerLoc.longitude
                      );
                      distanceText = `${formatDistance(m)} away`;
                    }

                    const insideSavedPlaces =
                      peerLoc && savedPlaces.length > 0
                        ? savedPlaces.filter((place) => {
                            const d = calculateDistanceMeters(
                              peerLoc.latitude,
                              peerLoc.longitude,
                              place.latitude,
                              place.longitude
                            );
                            return d <= (place.radiusMeters || 150);
                          })
                        : [];

                    return (
                      <div
                        key={mem.userId}
                        className={`p-3.5 rounded-2xl border transition-all shadow-sm space-y-2.5 ${themeConfig.cardBg} ${
                          alertCfg.enabled && mem.userId !== user?.id
                            ? 'ring-1 ring-[#FFD166]/60 border-[#FFD166]/50'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <div className={isOnline ? 'social-story-ring-live' : 'social-story-ring'}>
                                <img
                                  src={mem.user.avatarUrl}
                                  alt={mem.user.fullName}
                                  className="w-11 h-11 rounded-full object-cover bg-slate-800"
                                />
                              </div>
                              <div
                                className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#0B0719] ${
                                  isOnline ? 'bg-[#00D6A0]' : 'bg-slate-400'
                                }`}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-extrabold ${themeConfig.textPrimary} text-sm truncate`}>
                                  {mem.user.fullName}
                                </span>
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#8957FF]/15 text-[#8957FF] dark:text-[#E9DFFF]">
                                  {mem.role}
                                </span>
                                {insideSavedPlaces.map((pl) => (
                                  <span
                                    key={pl.id}
                                    className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#00D6A0]/15 text-[#00D6A0] border border-[#00D6A0]/30 flex items-center gap-1"
                                  >
                                    <MapPin className="w-2.5 h-2.5" />
                                    <span>At {pl.name}</span>
                                  </span>
                                ))}
                              </div>
                              <div className={`flex items-center gap-2 text-xs ${themeConfig.textSecondary} mt-0.5 flex-wrap`}>
                                <span>@{mem.user.username}</span>
                                <span>·</span>
                                <span className="text-[#00D9FF] font-bold">{distanceText}</span>
                                {alertCfg.enabled && mem.userId !== user?.id && (
                                  <>
                                    <span>·</span>
                                    <span className="text-[#FFD166] font-bold text-[11px]">
                                      Watching{' '}
                                      {alertCfg.placeIds.length > 0
                                        ? `${alertCfg.placeIds.length} place${alertCfg.placeIds.length === 1 ? '' : 's'}`
                                        : `all ${savedPlaces.length} saved place${savedPlaces.length === 1 ? '' : 's'}`}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {mem.userId !== user?.id && (
                              <>
                                <div className="flex items-center rounded-xl border border-[#8957FF]/30 overflow-hidden">
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={alertCfg.enabled}
                                    onClick={() =>
                                      handleToggleMemberGeofenceAlert(mem.userId, mem.user.fullName)
                                    }
                                    className={`px-2.5 py-1.5 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer ${
                                      alertCfg.enabled
                                        ? 'bg-gradient-to-r from-[#FFD166] to-[#FF8066] text-slate-950'
                                        : isDark
                                        ? 'bg-white/5 hover:bg-white/10 text-slate-200'
                                        : 'bg-purple-50 hover:bg-purple-100 text-purple-950'
                                    }`}
                                  >
                                    {alertCfg.enabled ? (
                                      <>
                                        <BellRing className="w-3.5 h-3.5" />
                                        <span>Alert On</span>
                                      </>
                                    ) : (
                                      <>
                                        <BellOff className="w-3.5 h-3.5 opacity-70" />
                                        <span>Geofence</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedGeofenceMemberId((prev) =>
                                        prev === mem.userId ? null : mem.userId
                                      )
                                    }
                                    className={`px-2 py-1.5 border-l border-[#8957FF]/30 text-xs transition-colors cursor-pointer ${
                                      isExpanded
                                        ? 'bg-[#8957FF] text-white'
                                        : isDark
                                        ? 'bg-white/5 hover:bg-white/15 text-slate-300'
                                        : 'bg-white hover:bg-purple-50 text-slate-700'
                                    }`}
                                    title="Configure geofence rules"
                                  >
                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <button
                                  onClick={() => {
                                    onSelectUserForChat?.(mem.userId);
                                    toast.info(`Opening direct chat with ${mem.user.fullName}`);
                                  }}
                                  className="px-3 py-1.5 bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>Chat</span>
                                </button>

                                {mem.user.phoneNumber && mem.user.privacy?.phoneVisibility !== 'nobody' && (
                                  <a
                                    href={`tel:${mem.user.phoneNumber}`}
                                    className="p-1.5 text-[#00D6A0] hover:bg-[#00D6A0]/15 rounded-xl transition-colors"
                                    title={`Call ${mem.user.phoneNumber}`}
                                  >
                                    <Phone className="w-4 h-4" />
                                  </a>
                                )}

                                {peerLoc && (
                                  <button
                                    onClick={() => {
                                      setRoomMapFocusCoords({ lat: peerLoc.latitude, lng: peerLoc.longitude });
                                      setShowRoomMap(true);
                                      setTimeout(() => {
                                        roomMapPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                      }, 60);
                                    }}
                                    className="p-1.5 text-[#00D9FF] hover:bg-[#00D9FF]/15 rounded-xl transition-colors cursor-pointer"
                                    title={`Focus ${mem.user.fullName} on Room Map`}
                                  >
                                    <Compass className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}

                            {canManageRoles && mem.userId !== user?.id && (
                              <select
                                value={mem.role}
                                onChange={(e) => handleChangeRole(mem.userId, e.target.value as UserRole)}
                                className={`text-xs border rounded-xl px-2 py-1 font-bold focus:outline-none ml-1 ${
                                  isDark
                                    ? 'bg-[#171130] border-[#8957FF]/30 text-white'
                                    : 'bg-purple-50 border-purple-200 text-slate-900'
                                }`}
                              >
                                <option value="ADMIN">ADMIN</option>
                                <option value="MODERATOR">MODERATOR</option>
                                <option value="MEMBER">MEMBER</option>
                                <option value="GUEST">GUEST</option>
                              </select>
                            )}

                            {canManageRoles && mem.userId !== user?.id && mem.role !== 'OWNER' && (
                              <button
                                type="button"
                                onClick={() => handleKickMember(mem.userId, mem.user.fullName)}
                                className="p-1.5 text-rose-500 hover:bg-rose-500/15 rounded-xl transition-colors cursor-pointer"
                                title={`Remove ${mem.user.fullName} from room`}
                              >
                                <LogOut className="w-3.5 h-3.5 rotate-180" />
                              </button>
                            )}

                            {mem.userId !== user?.id && (
                              <button
                                type="button"
                                onClick={() => handleBlockUser(mem.userId, mem.user.fullName)}
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/15 rounded-xl transition-colors cursor-pointer"
                                title={`Block ${mem.user.fullName}`}
                              >
                                <UserX className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expandable Per-Member Geofence Configuration Drawer */}
                        {isExpanded && mem.userId !== user?.id && (
                          <div className={`pt-3 border-t ${themeConfig.glassBorder} space-y-2.5`}>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className={`text-xs font-extrabold ${themeConfig.textPrimary} flex items-center gap-1.5`}>
                                <BellRing className="w-3.5 h-3.5 text-[#FFD166]" />
                                <span>Geofence Alert Rules for {mem.user.fullName}</span>
                              </span>
                              <div className="flex items-center gap-3">
                                <label className={`inline-flex items-center gap-1.5 text-xs font-bold ${themeConfig.textPrimary} cursor-pointer`}>
                                  <input
                                    type="checkbox"
                                    checked={alertCfg.notifyOnEnter}
                                    onChange={(e) =>
                                      handleUpdateMemberGeofenceConfig(mem.userId, {
                                        enabled: true,
                                        notifyOnEnter: e.target.checked,
                                      })
                                    }
                                    className="rounded accent-[#8957FF]"
                                  />
                                  <span>On Enter</span>
                                </label>
                                <label className={`inline-flex items-center gap-1.5 text-xs font-bold ${themeConfig.textPrimary} cursor-pointer`}>
                                  <input
                                    type="checkbox"
                                    checked={alertCfg.notifyOnLeave}
                                    onChange={(e) =>
                                      handleUpdateMemberGeofenceConfig(mem.userId, {
                                        enabled: true,
                                        notifyOnLeave: e.target.checked,
                                      })
                                    }
                                    className="rounded accent-[#8957FF]"
                                  />
                                  <span>On Leave</span>
                                </label>
                              </div>
                            </div>

                            {savedPlaces.length === 0 ? (
                              <div className={`text-xs ${themeConfig.textSecondary} p-2.5 rounded-xl border ${themeConfig.glassBorder}`}>
                                No saved locations yet. Add a saved place to monitor its geofence radius.
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className={`flex items-center justify-between text-[11px] ${themeConfig.textSecondary}`}>
                                  <span>
                                    Select saved locations to watch (leave all unchecked to monitor all {savedPlaces.length} places):
                                  </span>
                                  {alertCfg.placeIds.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateMemberGeofenceConfig(mem.userId, { placeIds: [] })
                                      }
                                      className="text-[#00D9FF] font-bold hover:underline cursor-pointer"
                                    >
                                      Monitor All ({savedPlaces.length})
                                    </button>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {savedPlaces.map((place) => {
                                    const isWatched =
                                      alertCfg.placeIds.length === 0 ||
                                      alertCfg.placeIds.includes(place.id);
                                    const isSpecificallySelected = alertCfg.placeIds.includes(place.id);
                                    const distToPlace = peerLoc
                                      ? Math.round(
                                          calculateDistanceMeters(
                                            peerLoc.latitude,
                                            peerLoc.longitude,
                                            place.latitude,
                                            place.longitude
                                          )
                                        )
                                      : null;
                                    const isInsideNow =
                                      distToPlace !== null && distToPlace <= (place.radiusMeters || 150);

                                    return (
                                      <button
                                        key={place.id}
                                        type="button"
                                        onClick={() => handleToggleMemberWatchedPlace(mem.userId, place.id)}
                                        className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                                          isSpecificallySelected
                                            ? 'bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white border-transparent shadow-xs'
                                            : isWatched
                                            ? `${themeConfig.cardBg} ${themeConfig.textPrimary}`
                                            : 'opacity-50 hover:opacity-100'
                                        }`}
                                      >
                                        <MapPin
                                          className={`w-3 h-3 ${
                                            isInsideNow ? 'text-[#00D6A0]' : 'text-[#FFD166]'
                                          }`}
                                        />
                                        <span>{place.name}</span>
                                        <span className="text-[10px] opacity-75 font-mono">
                                          ({place.radiusMeters}m
                                          {distToPlace !== null ? ` · ${formatDistance(distToPlace)}` : ''})
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#8957FF] to-[#FF4FA3] flex items-center justify-center text-white shadow-lg mb-3">
                <Users className="w-8 h-8" />
              </div>
              <p className={`text-sm font-extrabold ${themeConfig.textPrimary}`}>No rooms selected</p>
              <p className={`text-xs ${themeConfig.textSecondary} mt-1`}>
                Create a colourful room or join one using a unique Room ID
              </p>
            </div>
          )}
        </>
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            style={{ colorScheme: 'light' }}
            className="bg-white text-slate-950 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-popIn"
          >
            <h3 className="font-bold text-xl text-slate-950 mb-1">Create Private Room</h3>
            <p className="text-xs text-slate-700 mb-4 font-medium">
              Set up a secure encrypted room for your family or team.
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center justify-between">
                <span>{errorMsg}</span>
                {errorMsg.toLowerCase().includes('session') && (
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="ml-2 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] shrink-0"
                  >
                    Sign In
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-950 mb-1.5">Room Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Family Safe Haven or Reddy"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  style={{ color: '#090d16', backgroundColor: '#ffffff', colorScheme: 'light', WebkitTextFillColor: '#090d16' }}
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-600 transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-950 mb-1.5">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Real-time family check-ins and emergency alerts"
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  style={{ color: '#090d16', backgroundColor: '#ffffff', colorScheme: 'light', WebkitTextFillColor: '#090d16' }}
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-600 transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-950 mb-1.5">
                  Room Password (Optional)
                </label>
                <input
                  type="password"
                  placeholder="Leave empty for open room"
                  value={newRoomPassword}
                  onChange={(e) => setNewRoomPassword(e.target.value)}
                  style={{ color: '#090d16', backgroundColor: '#ffffff', colorScheme: 'light', WebkitTextFillColor: '#090d16' }}
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-600 transition-all shadow-sm"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 active:scale-95 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Create Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Define / Edit Room Saved-Place Geofence Modal */}
      {showDefineGeofenceModal && (
        <div
          data-testid="define-room-place-geofence-modal"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            className={`rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border max-h-[92vh] overflow-y-auto space-y-4 ${
              isDark
                ? 'bg-[#130F2B] border-[#8957FF]/45 text-[#F8F7FF]'
                : 'bg-white border-[#8957FF]/25 text-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FFD166] via-[#FF8066] to-[#FF4FA3] text-slate-950 flex items-center justify-center shrink-0 shadow-md">
                  <Radar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    {editingGeofenceId
                      ? 'Edit Saved-Place Geofence'
                      : 'Define Geofence Around Saved Place'}
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                    Room: <strong>{activeRoomDetails?.name || 'Active Room'}</strong> · Automatic push notification on member enter/leave
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDefineGeofenceModal(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRoomPlaceGeofence} className="space-y-4">
              {/* Step 1: Choose Existing Saved Place OR Create New Saved Place */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-[#00D9FF]">
                    1. Saved Place Location
                  </label>
                  {!editingGeofenceId && (
                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                      <button
                        type="button"
                        onClick={() => setGeofencePlaceMode('existing')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer transition-all ${
                          geofencePlaceMode === 'existing'
                            ? 'bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Saved Places ({savedPlaces.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setGeofencePlaceMode('new')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer transition-all ${
                          geofencePlaceMode === 'new'
                            ? 'bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        + New Place
                      </button>
                    </div>
                  )}
                </div>

                {geofencePlaceMode === 'existing' ? (
                  savedPlaces.length === 0 ? (
                    <div className="p-3.5 rounded-2xl border border-[#FFD166]/40 bg-[#FFD166]/10 text-xs space-y-2">
                      <p className="font-bold">You don't have any Saved Places yet.</p>
                      <button
                        type="button"
                        onClick={() => setGeofencePlaceMode('new')}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 font-extrabold text-xs cursor-pointer"
                      >
                        + Create a Saved Place Now
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto pr-1">
                      {savedPlaces.map((place) => {
                        const isSelected = selectedGeofencePlaceId === place.id;
                        const emoji = getLocationTypeEmoji(place.markerIcon || place.category);
                        return (
                          <button
                            key={place.id}
                            type="button"
                            onClick={() => {
                              setSelectedGeofencePlaceId(place.id);
                              setGeofenceRadiusMeters(place.radiusMeters || 150);
                            }}
                            className={`p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-gradient-to-r from-[#8957FF]/25 to-[#FF4FA3]/25 border-[#FF4FA3] ring-1 ring-[#FF4FA3]'
                                : isDark
                                ? 'bg-[#0B081B]/80 border-white/10 hover:border-white/25'
                                : 'bg-slate-50 border-slate-200 hover:border-[#8957FF]/40'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-base text-white shrink-0 shadow"
                                style={{ backgroundColor: place.markerColor || '#8957FF' }}
                              >
                                {emoji}
                              </div>
                              <div className="min-w-0">
                                <span className="font-extrabold text-xs block truncate">
                                  {place.name}
                                </span>
                                <span className="text-[10px] font-mono opacity-75 block">
                                  {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)} · Default {place.radiusMeters}m
                                </span>
                              </div>
                            </div>
                            {isSelected && (
                              <span className="px-2 py-0.5 rounded-full bg-[#00D6A0] text-slate-950 text-[10px] font-extrabold shrink-0">
                                Selected
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div
                    className={`p-3.5 rounded-2xl border space-y-3 ${
                      isDark ? 'bg-[#0B081B]/90 border-white/15' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-extrabold mb-1">Place Name *</label>
                        <input
                          type="text"
                          required={geofencePlaceMode === 'new'}
                          placeholder="e.g. Home, School, HQ"
                          value={newPlaceName}
                          onChange={(e) => setNewPlaceName(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold ${
                            isDark
                              ? 'bg-[#130F2B] border-white/15 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-extrabold mb-1">Category</label>
                        <select
                          value={newPlaceCategory}
                          onChange={(e) => {
                            const cat = e.target.value as SavedPlace['category'];
                            setNewPlaceCategory(cat);
                            const found = LOCATION_TYPES.find((t) => t.id === cat);
                            if (found) setNewPlaceColor(found.defaultColor);
                          }}
                          className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold ${
                            isDark
                              ? 'bg-[#130F2B] border-white/15 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        >
                          {LOCATION_TYPES.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.emoji} {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-extrabold mb-1">Latitude</label>
                        <input
                          type="number"
                          step="any"
                          required={geofencePlaceMode === 'new'}
                          value={newPlaceLat}
                          onChange={(e) => setNewPlaceLat(e.target.value)}
                          className={`w-full px-3 py-1.5 rounded-xl border text-xs font-mono ${
                            isDark
                              ? 'bg-[#130F2B] border-white/15 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-extrabold mb-1">Longitude</label>
                        <input
                          type="number"
                          step="any"
                          required={geofencePlaceMode === 'new'}
                          value={newPlaceLng}
                          onChange={(e) => setNewPlaceLng(e.target.value)}
                          className={`w-full px-3 py-1.5 rounded-xl border text-xs font-mono ${
                            isDark
                              ? 'bg-[#130F2B] border-white/15 text-white'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>

                    {myLocation && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewPlaceLat(myLocation.latitude.toFixed(6));
                          setNewPlaceLng(myLocation.longitude.toFixed(6));
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#00D9FF]/15 text-[#00D9FF] border border-[#00D9FF]/30 text-[11px] font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Use My Current GPS Location</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {MARKER_COLORS.slice(0, 6).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setNewPlaceColor(c.hex)}
                          className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                            newPlaceColor.toLowerCase() === c.hex.toLowerCase()
                              ? 'border-white scale-110 shadow'
                              : 'border-transparent opacity-70'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Define Geofence Radius */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-[#00D9FF]">
                    2. Geofence Boundary Radius
                  </label>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#00D6A0]/20 text-[#00D6A0] font-mono text-xs font-extrabold">
                    {geofenceRadiusMeters} meters
                  </span>
                </div>

                <input
                  type="range"
                  min={25}
                  max={2000}
                  step={25}
                  value={geofenceRadiusMeters}
                  onChange={(e) => setGeofenceRadiusMeters(Number(e.target.value))}
                  className="w-full accent-[#FF4FA3]"
                />

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[50, 100, 150, 250, 500, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setGeofenceRadiusMeters(preset)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-extrabold cursor-pointer border transition-all ${
                        geofenceRadiusMeters === preset
                          ? 'bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white border-transparent'
                          : isDark
                          ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                          : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      {preset >= 1000 ? `${preset / 1000}km` : `${preset}m`}
                    </button>
                  ))}
                </div>

                {geofencePlaceMode === 'existing' && (
                  <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={syncRadiusToSavedPlace}
                      onChange={(e) => setSyncRadiusToSavedPlace(e.target.checked)}
                      className="rounded accent-[#8957FF]"
                    />
                    <span>Also update this Saved Place's default radius to {geofenceRadiusMeters}m</span>
                  </label>
                )}
              </div>

              {/* Step 3: Automatic Push Notification Triggers */}
              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#00D9FF]">
                  3. Automatic Push Notification Triggers
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                      geofenceNotifyOnEnter
                        ? 'bg-[#00D6A0]/15 border-[#00D6A0]/50'
                        : isDark
                        ? 'bg-white/5 border-white/10'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-extrabold block">When Member Enters</span>
                      <span className="text-[10px] opacity-75 block">
                        Push alert on arrival inside {geofenceRadiusMeters}m
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={geofenceNotifyOnEnter}
                      onChange={(e) => setGeofenceNotifyOnEnter(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#00D6A0]"
                    />
                  </label>

                  <label
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                      geofenceNotifyOnLeave
                        ? 'bg-[#FF4FA3]/15 border-[#FF4FA3]/50'
                        : isDark
                        ? 'bg-white/5 border-white/10'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-extrabold block">When Member Leaves</span>
                      <span className="text-[10px] opacity-75 block">
                        Push alert on departure outside {geofenceRadiusMeters}m
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={geofenceNotifyOnLeave}
                      onChange={(e) => setGeofenceNotifyOnLeave(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#FF4FA3]"
                    />
                  </label>
                </div>

                <label
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                    geofencePostToRoomChat
                      ? 'bg-[#8957FF]/15 border-[#8957FF]/50'
                      : isDark
                      ? 'bg-white/5 border-white/10'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div>
                    <span className="text-xs font-extrabold block">
                      Post Automatic Check-In / Check-Out to Room Chat (#live-locations)
                    </span>
                    <span className="text-[10px] opacity-75 block">
                      Keeps all room members informed in the #live-locations channel
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={geofencePostToRoomChat}
                    onChange={(e) => setGeofencePostToRoomChat(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#8957FF]"
                  />
                </label>
              </div>

              {/* Step 4: Watched Group Members Filter */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-[#00D9FF]">
                    4. Watched Group Members
                  </label>
                  {geofenceWatchedMemberIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setGeofenceWatchedMemberIds([])}
                      className="text-[11px] font-extrabold text-[#FF4FA3] hover:underline cursor-pointer"
                    >
                      Watch All Members
                    </button>
                  )}
                </div>
                <p className={`text-[11px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                  {geofenceWatchedMemberIds.length === 0
                    ? `Currently monitoring ALL members in ${activeRoomDetails?.name || 'this room'}. Tap specific members below to filter:`
                    : `Monitoring ${geofenceWatchedMemberIds.length} selected member${geofenceWatchedMemberIds.length === 1 ? '' : 's'}:`}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {(activeRoomDetails?.members || [])
                    .filter((m) => m.userId !== user?.id)
                    .map((m) => {
                      const isSelected = geofenceWatchedMemberIds.includes(m.userId);
                      return (
                        <button
                          key={m.userId}
                          type="button"
                          onClick={() =>
                            setGeofenceWatchedMemberIds((prev) =>
                              prev.includes(m.userId)
                                ? prev.filter((id) => id !== m.userId)
                                : [...prev, m.userId]
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white border-transparent shadow-xs'
                              : geofenceWatchedMemberIds.length === 0
                              ? isDark
                                ? 'bg-white/10 border-white/20 text-white'
                                : 'bg-purple-50 border-purple-200 text-purple-950'
                              : 'opacity-50 border-white/10'
                          }`}
                        >
                          <img
                            src={
                              m.user.avatarUrl ||
                              `https://api.dicebear.com/7.x/bottts/svg?seed=${m.userId}`
                            }
                            alt={m.user.fullName}
                            className="w-4 h-4 rounded-full object-cover"
                          />
                          <span>{m.user.fullName}</span>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowDefineGeofenceModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-white/10 hover:bg-white/15 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRoomGeofence}
                  data-testid="save-room-place-geofence-btn"
                  className="px-5 py-2 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] shadow-lg shadow-[#FF4FA3]/25 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isSavingRoomGeofence
                    ? 'Saving...'
                    : editingGeofenceId
                    ? 'Update Geofence & Push Rules'
                    : 'Activate Saved-Place Geofence'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            style={{ colorScheme: 'light' }}
            className="bg-white text-slate-950 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-popIn"
          >
            <h3 className="font-bold text-xl text-slate-950 mb-1">Join Room</h3>
            <p className="text-xs text-slate-700 mb-4 font-medium">
              Enter the unique Room ID or Room Name and password (if required).
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center justify-between">
                <span>{errorMsg}</span>
                {errorMsg.toLowerCase().includes('session') && (
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="ml-2 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] shrink-0"
                  >
                    Sign In
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-950 mb-1.5">Room ID or Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Reddy or room-name"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  style={{ color: '#090d16', backgroundColor: '#ffffff', colorScheme: 'light', WebkitTextFillColor: '#090d16' }}
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-600 transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-950 mb-1.5">Password</label>
                <input
                  type="password"
                  placeholder="Room password if protected"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  style={{ color: '#090d16', backgroundColor: '#ffffff', colorScheme: 'light', WebkitTextFillColor: '#090d16' }}
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-600 transition-all shadow-sm"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 active:scale-95 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Join Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
