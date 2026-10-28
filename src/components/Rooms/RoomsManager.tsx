import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import type { Room, RoomMember, UserRole, SavedPlace } from '../../types.ts';
import { api } from '../../utils/api.ts';
import { localBackend } from '../../utils/localBackend.ts';
import { calculateDistanceMeters, formatDistance } from '../../utils/geo.ts';
import { sound } from '../../utils/audio.ts';
import { notifications } from '../../utils/notifications.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { LiveMap } from '../Map/LiveMap.tsx';
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
    sendMessage,
  } = useRealtime();

  const toast = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomDetails, setActiveRoomDetails] = useState<Room | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showRoomMap, setShowRoomMap] = useState(true);
  const [isRoomMapFullscreen, setIsRoomMapFullscreen] = useState(false);
  const [roomMapFocusCoords, setRoomMapFocusCoords] = useState<{ lat: number; lng: number } | null>(null);
  const roomMapPanelRef = React.useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quickHubMessage, setQuickHubMessage] = useState('');

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
            notifications.notifyMemberGeofence(memberName, 'left', place.name, dist);
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
        name: newRoomName,
        description: newRoomDesc,
        password: newRoomPassword,
      });
      setRooms((prev) => (prev.some((r) => r.id === res.room.id) ? prev : [...prev, res.room]));
      setActiveRoomDetails(res.room);
      onSelectRoom(res.room.id);
      setShowCreateModal(false);
      setNewRoomName('');
      setNewRoomDesc('');
      setNewRoomPassword('');
      toast.success(`Room "${res.room.name}" created — you are now inside`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create room');
      toast.error(err.message || 'Failed to create room');
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const res = await api.post<{ room: Room }>('/api/rooms/join', {
        roomId: joinRoomId,
        password: joinPassword,
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
      toast.error(err.message || 'Failed to join room');
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
    if (!confirm(`Are you sure you want to remove ${memberName} from this room?`)) return;
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
    if (!confirm(`Block ${memberName}? They will not be able to message you or track your location.`)) return;
    try {
      await api.blockUser(targetUserId);
      toast.success(`Blocked ${memberName}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to block user');
    }
  };

  const myMembership = activeRoomDetails?.members?.find((m) => m.userId === user?.id);
  const canManageRoles = myMembership?.role === 'OWNER' || myMembership?.role === 'ADMIN';

  return (
    <div className={`flex flex-col h-full border-r ${themeConfig.glassBorder} transition-colors duration-200`}>
      {/* Top Header */}
      <div className={`p-4 border-b ${themeConfig.glassBorder} ${themeConfig.glassHeader} space-y-3`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`font-bold ${themeConfig.textPrimary} text-base flex items-center gap-2`}>
              <Users className="w-5 h-5 text-sky-400" />
              <span>Rooms & Mesh</span>
            </h2>
            <p className={`text-xs ${themeConfig.textSecondary}`}>Private encrypted groups & mesh coordinates</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowJoinModal(true)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 border ${themeConfig.glassBorder} hover:bg-white/10 ${themeConfig.textPrimary} cursor-pointer`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Join
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 shadow-md cursor-pointer ${themeConfig.accentBg}`}
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          </div>
        </div>

        {/* Search Bar at Top of Rooms Tab */}
        <div className="relative">
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-2xl border ${themeConfig.glassBorder} bg-black/20 focus-within:ring-2 focus-within:ring-sky-500/50 transition-all shadow-inner`}>
            <Search className="w-4 h-4 text-sky-400 shrink-0" />
            <input
              type="text"
              placeholder="Search rooms or members by name, handle, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-transparent text-xs ${themeConfig.textPrimary} focus:outline-none placeholder-slate-400 font-medium`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
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
                className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
                  searchCategory === 'all'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                All ({filteredRooms.length + filteredMembers.length})
              </button>
              <button
                onClick={() => setSearchCategory('rooms')}
                className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
                  searchCategory === 'rooms'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                Rooms ({filteredRooms.length})
              </button>
              <button
                onClick={() => setSearchCategory('members')}
                className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
                  searchCategory === 'members'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                Members ({filteredMembers.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Search Results View */}
      {searchQuery.trim() ? (
        <div className="flex-1 overflow-y-auto p-4 pb-28 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Search results for <strong className="text-white font-semibold">"{searchQuery}"</strong>
            </span>
            <button
              onClick={() => setSearchQuery('')}
              className="text-sky-400 hover:underline cursor-pointer"
            >
              Clear filter
            </button>
          </div>

          {/* Matched Rooms Section */}
          {(searchCategory === 'all' || searchCategory === 'rooms') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Matching Rooms ({filteredRooms.length})
                </span>
              </div>
              {filteredRooms.length === 0 ? (
                <div className="p-3 rounded-2xl bg-white/5 text-center text-xs text-slate-400">
                  No rooms matched "{searchQuery}"
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {filteredRooms.map((room) => {
                    const isSelected = room.id === selectedRoomId;
                    const isUniversal = room.isUniversal || room.id === 'room-universal';
                    return (
                      <div
                        key={room.id}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-sky-500/15 border-sky-400/60 ring-1 ring-sky-400/40'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="flex items-center gap-1.5">
                            {isUniversal && <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                            <h4 className="font-bold text-xs text-white truncate">{room.name}</h4>
                            {room.hasPassword && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {room.description || 'Secure communication and location sharing channel.'}
                          </p>
                          <span className="text-[10px] text-sky-300 font-mono">
                            {room.memberCount} members · ID: {room.id}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            onSelectRoom(room.id);
                            toast.success(`Switched to room: ${room.name}`);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-sky-500 text-white shadow-sm'
                              : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          {isSelected ? 'Active' : 'Select'}
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
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Matching Members ({filteredMembers.length})
                </span>
              </div>
              {filteredMembers.length === 0 ? (
                <div className="p-3 rounded-2xl bg-white/5 text-center text-xs text-slate-400">
                  No members matched "{searchQuery}"
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMembers.map((member) => (
                    <div
                      key={member.userId}
                      className="p-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-9 h-9 shrink-0">
                          <img
                            src={member.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${member.userId}`}
                            alt={member.fullName}
                            className="w-full h-full rounded-full object-cover border border-white/20 bg-slate-800"
                          />
                          <span
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-slate-900 ${
                              member.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-white truncate">{member.fullName}</span>
                            {member.role && (
                              <span className="px-1.5 py-0.2 rounded bg-white/10 text-[9px] font-mono text-sky-300 uppercase">
                                {member.role}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 block truncate">
                            @{member.username} {member.roomName ? `· in ${member.roomName}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {member.userId !== user?.id && (
                          <button
                            type="button"
                            onClick={() => handleToggleMemberGeofenceAlert(member.userId, member.fullName)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer border ${
                              getMemberAlertConfig(member.userId).enabled
                                ? 'bg-amber-500/25 border-amber-400/50 text-amber-200 hover:bg-amber-500/35'
                                : 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/15'
                            }`}
                            title={
                              getMemberAlertConfig(member.userId).enabled
                                ? `Disable saved location geofence enter/leave alerts for ${member.fullName}`
                                : `Alert me when ${member.fullName} enters or leaves a saved location geofence`
                            }
                          >
                            {getMemberAlertConfig(member.userId).enabled ? (
                              <>
                                <BellRing className="w-3.5 h-3.5 text-amber-300" />
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
                            className="px-2.5 py-1.5 rounded-xl bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Direct Message"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Message</span>
                          </button>
                        )}
                        {member.latitude !== undefined && member.longitude !== undefined && onFocusMapLocation && (
                          <button
                            onClick={() => onFocusMapLocation(member.latitude!, member.longitude!)}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Locate on Map"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Map</span>
                          </button>
                        )}
                        {member.roomId && (
                          <button
                            onClick={() => onSelectRoom(member.roomId!)}
                            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer"
                            title="Go to Room"
                          >
                            Room
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
              <Users className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">No rooms or members found</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Try searching by first name, username, or room topic name.
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Universal Hub Pinned Notification Banner */}
          {rooms.some((r) => r.isUniversal || r.id === 'room-universal') && (
        <div className="mx-3 mt-3 p-3 rounded-2xl bg-gradient-to-r from-indigo-900 via-slate-900 to-blue-900 text-white flex items-center justify-between shadow-lg border border-indigo-500/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-indigo-200 shadow-inner">
              <Globe className="w-5 h-5 text-indigo-300 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-tight text-white">Universal Hub</span>
                <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/40 text-indigo-200 text-[10px] font-semibold border border-indigo-400/30">
                  Open to All
                </span>
              </div>
              <p className="text-[11px] text-indigo-200/80">
                Universal room pinned to top — open communication & live mesh coordinates
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                onSelectRoom('room-universal');
                if (onOpenChat) {
                  onOpenChat('room-universal');
                  toast.success('Opening Universal Hub Messages & Chat...');
                }
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-indigo-900 shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shrink-0"
              title="Message in Universal Hub"
            >
              <MessageSquare className="w-4 h-4 text-indigo-700" />
              <span>Message</span>
            </button>
            <button
              onClick={() => {
                onSelectRoom('room-universal');
                joinVoiceChannel('room-universal');
                toast.info('Connecting to Universal WebRTC voice channel...');
              }}
              className="px-2.5 py-2 rounded-xl text-xs font-semibold bg-indigo-500/40 hover:bg-indigo-500/60 text-white border border-indigo-400/30 transition-all cursor-pointer flex items-center gap-1 shrink-0"
              title="Join Universal Live Audio"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Voice</span>
            </button>
          </div>
        </div>
      )}

      {/* Room Tabs List */}
      <div className={`p-3 overflow-x-auto flex gap-2 border-b ${themeConfig.glassBorder} ${themeConfig.glassPanel} shrink-0`}>
        {rooms.map((room) => {
          const isSelected = room.id === selectedRoomId;
          const isUniversal = room.isUniversal || room.id === 'room-universal';
          return (
            <button
              key={room.id}
              onClick={() => onSelectRoom(room.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                isSelected
                  ? isUniversal
                    ? 'bg-gradient-to-r from-indigo-700 to-blue-700 text-white shadow-md'
                    : 'bg-slate-900 text-white shadow'
                  : isUniversal
                  ? 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border border-indigo-200'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {isUniversal ? (
                <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              ) : null}
              <span>{room.name}</span>
              {isUniversal ? (
                <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-full bg-indigo-400/20 text-indigo-600 font-bold">
                  Top
                </span>
              ) : null}
              {room.hasPassword && <Lock className="w-3 h-3 opacity-70" />}
              <span className="text-[10px] opacity-75 font-mono">({room.memberCount})</span>
            </button>
          );
        })}
      </div>

      {/* Active Room Detailed Content */}
      {activeRoomDetails ? (
        <div className="flex-1 overflow-y-auto p-4 pb-28 space-y-6">
          {/* Room Banner Card */}
          <div
            className={`rounded-2xl border p-4 shadow-sm ${
              activeRoomDetails.isUniversal || activeRoomDetails.id === 'room-universal'
                ? 'bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/50 border-indigo-200'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {activeRoomDetails.isUniversal || activeRoomDetails.id === 'room-universal' ? (
                    <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                      <Globe className="w-3.5 h-3.5" />
                    </div>
                  ) : null}
                  <h3 className="font-bold text-slate-900 text-lg">{activeRoomDetails.name}</h3>
                  {(activeRoomDetails.isUniversal || activeRoomDetails.id === 'room-universal') && (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                      🌐 Universal Room (Open to All)
                    </span>
                  )}
                  {activeRoomDetails.hasPassword && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Password Protected
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {activeRoomDetails.description || 'Secure communication and location sharing channel.'}
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                  <span>Room ID: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono select-all">{activeRoomDetails.id}</code></span>
                  <span>·</span>
                  <span>Your Role: <strong className="text-slate-800">{myMembership?.role || 'MEMBER'}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Small Room Map Button */}
                <button
                  onClick={() => {
                    setRoomMapFocusCoords(null);
                    if (!showRoomMap) {
                      setShowRoomMap(true);
                      setTimeout(() => {
                        roomMapPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }, 80);
                    } else {
                      setIsRoomMapFullscreen(true);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                  title={`Open Live Map showing users in ${activeRoomDetails.name}`}
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>Map ({activeRoomDetails.members?.length || 1})</span>
                </button>

                {!(activeRoomDetails.isUniversal || activeRoomDetails.id === 'room-universal') ? (
                  <>
                    <button
                      onClick={() => {
                        onOpenChat?.(activeRoomDetails.id);
                        toast.success(`Opening chat in ${activeRoomDetails.name}...`);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                      title={`Open Messages in ${activeRoomDetails.name}`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chat</span>
                    </button>
                    <button
                      onClick={() => handleLeaveRoom(activeRoomDetails.id)}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      title="Leave Room"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Leave</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="hidden sm:block px-2.5 py-1 rounded-lg bg-indigo-100/80 text-indigo-700 text-[10px] font-bold">
                      Permanent Hub
                    </div>
                    <button
                      onClick={() => {
                        onOpenChat?.('room-universal');
                        toast.success('Opening Universal Hub Messages & Chat...');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                      title="Open Universal Hub Messages"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Message</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Quick Action Suite for Universal Hub */}
            {(activeRoomDetails.isUniversal || activeRoomDetails.id === 'room-universal') && (
              <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-blue-950 border border-indigo-500/30 text-white space-y-3 shadow-md">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/30 flex items-center justify-center text-indigo-300">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Universal Lounge Communication Hub</span>
                      <span className="text-[11px] text-indigo-200/80 block">#general · #live-locations · #announcements · #lounge</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => {
                        onOpenChat?.('room-universal');
                        toast.success('Switching to Universal Hub Messages & Chat...');
                      }}
                      className="flex-1 sm:flex-initial px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                      title="Open full conversation in Universal Hub"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Message (Open Chat)</span>
                    </button>
                    {myLocation && onFocusMapLocation && (
                      <button
                        onClick={() => onFocusMapLocation(myLocation.latitude, myLocation.longitude)}
                        className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-white/20 transition-all cursor-pointer"
                        title="View my location on map"
                      >
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Live Pin</span>
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
                      className="w-full px-3.5 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder-indigo-200/60 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!quickHubMessage.trim()}
                    className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <span>Send</span>
                  </button>
                </form>
              </div>
            )}

            {/* Live WebRTC Voice Channel Island */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      activeVoiceRoomId === activeRoomDetails.id
                        ? 'bg-emerald-500 animate-pulse'
                        : 'bg-slate-300'
                    }`}
                  />
                  <span className="text-xs font-bold text-slate-900">
                    Live WebRTC Audio Channel
                  </span>
                </div>

                {activeVoiceRoomId === activeRoomDetails.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleMicMute}
                      className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        isMicMuted
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      {isMicMuted ? <MicOff className="w-4 h-4 text-amber-600" /> : <Mic className="w-4 h-4" />}
                      {isMicMuted ? 'Muted' : 'Mute'}
                    </button>
                    <button
                      onClick={leaveVoiceChannel}
                      className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow"
                    >
                      <PhoneOff className="w-4 h-4" />
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => joinVoiceChannel(activeRoomDetails.id)}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <PhoneCall className="w-4 h-4" />
                    Join Voice
                  </button>
                )}
              </div>

              {/* Active Voice Participants Grid */}
              {activeVoiceRoomId === activeRoomDetails.id && (
                <div className="mt-3 p-3 bg-slate-900 rounded-xl text-white">
                  <span className="text-[11px] text-slate-400 block mb-2">Connected Speakers:</span>
                  <div className="flex flex-wrap gap-3">
                    {/* Self */}
                    <div className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
                      <div className={`relative w-6 h-6 rounded-full overflow-hidden ${isSpeaking ? 'ring-2 ring-emerald-400' : ''}`}>
                        <img src={user?.avatarUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-xs font-medium">You</span>
                      {isMicMuted ? (
                        <MicOff className="w-3 h-3 text-amber-400" />
                      ) : isSpeaking ? (
                        <Volume2 className="w-3 h-3 text-emerald-400 animate-pulse" />
                      ) : (
                        <Mic className="w-3 h-3 text-slate-400" />
                      )}
                    </div>

                    {/* Remote voice peers */}
                    {voiceParticipants.map((p) => (
                      <div
                        key={p.peerId}
                        className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700"
                      >
                        <div className={`relative w-6 h-6 rounded-full overflow-hidden ${p.isSpeaking ? 'ring-2 ring-emerald-400' : ''}`}>
                          <img src={p.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-xs font-medium">{p.user.fullName.split(' ')[0]}</span>
                        {p.isSpeaking && <Volume2 className="w-3 h-3 text-emerald-400 animate-pulse" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Room Live Map View Panel (Mirroring Main LiveMap Functionality & UI Style) */}
          <div ref={roomMapPanelRef} className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <MapIcon className="w-4 h-4 text-emerald-600" />
                  <span>Room Live Map Panel — {activeRoomDetails.name}</span>
                </h4>
              </div>
              <div className="flex items-center gap-1.5">
                {showRoomMap && (
                  <button
                    onClick={() => setIsRoomMapFullscreen((prev) => !prev)}
                    className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                    title={isRoomMapFullscreen ? 'Dock Map into Panel' : 'Expand Room Map to Full Screen'}
                  >
                    {isRoomMapFullscreen ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5 text-sky-400" />
                        <span>Dock Panel</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
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
                      setShowRoomMap(true);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 ${
                    showRoomMap
                      ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                  title={showRoomMap ? 'Hide Room Map Panel' : 'Show Room Map Panel'}
                >
                  {showRoomMap ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showRoomMap ? 'Hide Map' : 'Show Map'}</span>
                </button>
              </div>
            </div>

            {showRoomMap && (
              <div
                className={
                  isRoomMapFullscreen
                    ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col animate-in fade-in duration-150'
                    : 'relative w-full h-[520px] sm:h-[580px] rounded-2xl overflow-hidden border-2 border-slate-200 shadow-xl bg-slate-950 flex flex-col transition-all duration-200'
                }
              >
                {isRoomMapFullscreen && (
                  <div className="bg-slate-900/95 border-b border-white/10 px-4 py-2 flex items-center justify-between text-white shrink-0 z-40">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <span className="font-bold text-xs truncate">
                        {activeRoomDetails.name} — Full Screen Room Map
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setIsRoomMapFullscreen(false)}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Minimize2 className="w-3.5 h-3.5 text-sky-400" />
                        <span>Dock Panel</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsRoomMapFullscreen(false);
                          setShowRoomMap(false);
                        }}
                        className="p-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 cursor-pointer transition-colors"
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

          {/* Room Members Roster with Real Distances & Saved Location Geofence Alerts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-slate-500" />
                  <span>Members & Live Coordinates ({activeRoomDetails.members?.length || 0})</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Toggle <strong className="text-slate-700">Geofence Alert</strong> on any member to get notified when they enter or leave your {savedPlaces.length} saved location{savedPlaces.length === 1 ? '' : 's'}.
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
                      className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      title="Toggle geofence enter/leave notifications for all members in this room"
                    >
                      <Bell className="w-3.5 h-3.5 text-amber-600" />
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
                  className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                  title={`View all members of ${activeRoomDetails.name} on Full Screen Room Map`}
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>Full Room Map</span>
                </button>
              </div>
            </div>

            {/* Recent Geofence Enter/Exit Activity Feed (shown when transitions occur) */}
            {geofenceEvents.length > 0 && (
              <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                    <BellRing className="w-3.5 h-3.5 text-amber-600" />
                    <span>Recent Saved Location Geofence Alerts ({geofenceEvents.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setGeofenceEvents([])}
                    className="text-[11px] font-semibold text-amber-700 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {geofenceEvents.slice(0, 5).map((ev) => (
                    <div
                      key={ev.id}
                      className="text-xs text-amber-950 flex items-center justify-between gap-2 bg-white/80 px-2.5 py-1 rounded-lg border border-amber-200/60"
                    >
                      <span>
                        <strong>{ev.memberName}</strong>{' '}
                        <span
                          className={
                            ev.action === 'entered'
                              ? 'text-emerald-700 font-bold'
                              : 'text-rose-700 font-bold'
                          }
                        >
                          {ev.action}
                        </span>{' '}
                        <strong>{ev.placeName}</strong> ({ev.distanceMeters}m)
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">
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

            <div className="space-y-2">
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

                // Check if this member is currently inside any saved location geofence
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
                    className={`p-3 bg-white rounded-xl border transition-all shadow-sm space-y-2.5 ${
                      alertCfg.enabled && mem.userId !== user?.id
                        ? 'border-amber-300 ring-1 ring-amber-200/60'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={mem.user.avatarUrl}
                            alt={mem.user.fullName}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200"
                          />
                          <div
                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                              isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm truncate">
                              {mem.user.fullName}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {mem.role}
                            </span>
                            {insideSavedPlaces.map((pl) => (
                              <span
                                key={pl.id}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"
                                title={`${mem.user.fullName} is currently inside "${pl.name}" geofence (${pl.radiusMeters}m radius)`}
                              >
                                <MapPin className="w-2.5 h-2.5 text-emerald-600" />
                                <span>At {pl.name}</span>
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                            <span>@{mem.user.username}</span>
                            <span>·</span>
                            <span className="text-blue-600 font-medium">{distanceText}</span>
                            {alertCfg.enabled && mem.userId !== user?.id && (
                              <>
                                <span>·</span>
                                <span className="text-amber-700 font-semibold text-[11px]">
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
                            {/* Geofence Enter/Exit Notification Toggle Button */}
                            <div className="flex items-center rounded-xl border overflow-hidden shadow-2xs">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={alertCfg.enabled}
                                onClick={() =>
                                  handleToggleMemberGeofenceAlert(mem.userId, mem.user.fullName)
                                }
                                className={`px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                                  alertCfg.enabled
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                                title={
                                  alertCfg.enabled
                                    ? `Geofence notifications ON for ${mem.user.fullName} (click to mute)`
                                    : `Enable notifications when ${mem.user.fullName} enters or leaves a saved location geofence`
                                }
                              >
                                {alertCfg.enabled ? (
                                  <>
                                    <BellRing className="w-3.5 h-3.5" />
                                    <span>Geofence Alert On</span>
                                  </>
                                ) : (
                                  <>
                                    <BellOff className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Geofence Alert</span>
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
                                className={`px-2 py-1.5 border-l text-xs transition-colors cursor-pointer ${
                                  isExpanded
                                    ? 'bg-slate-900 text-white border-slate-800'
                                    : alertCfg.enabled
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-slate-50 hover:bg-slate-200 text-slate-600 border-slate-200'
                                }`}
                                title={`Configure saved location geofence rules for ${mem.user.fullName}`}
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <button
                              onClick={() => {
                                onSelectUserForChat?.(mem.userId);
                                toast.info(`Opening direct chat with ${mem.user.fullName}`);
                              }}
                              className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:hover:bg-sky-900/60 dark:text-sky-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-sky-200 dark:border-sky-800/50 transition-colors cursor-pointer"
                              title={`Direct Message ${mem.user.fullName}`}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Message</span>
                            </button>

                            {mem.user.phoneNumber && mem.user.privacy?.phoneVisibility !== 'nobody' && (
                              <a
                                href={`tel:${mem.user.phoneNumber}`}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
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
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title={`Focus ${mem.user.fullName} on Room Map Panel`}
                              >
                                <Compass className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}

                        {/* Role changer for admins */}
                        {canManageRoles && mem.userId !== user?.id && (
                          <select
                            value={mem.role}
                            onChange={(e) => handleChangeRole(mem.userId, e.target.value as UserRole)}
                            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none ml-1"
                          >
                            <option value="ADMIN">ADMIN</option>
                            <option value="MODERATOR">MODERATOR</option>
                            <option value="MEMBER">MEMBER</option>
                            <option value="GUEST">GUEST</option>
                          </select>
                        )}

                        {/* Kick member for admins/owner (cannot kick owner) */}
                        {canManageRoles && mem.userId !== user?.id && mem.role !== 'OWNER' && (
                          <button
                            type="button"
                            onClick={() => handleKickMember(mem.userId, mem.user.fullName)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title={`Remove ${mem.user.fullName} from room`}
                          >
                            <LogOut className="w-3.5 h-3.5 rotate-180" />
                          </button>
                        )}

                        {/* Block user option */}
                        {mem.userId !== user?.id && (
                          <button
                            type="button"
                            onClick={() => handleBlockUser(mem.userId, mem.user.fullName)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title={`Block ${mem.user.fullName}`}
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandable Per-Member Saved Location Geofence Configuration Drawer */}
                    {isExpanded && mem.userId !== user?.id && (
                      <div className="pt-2.5 border-t border-slate-100 bg-slate-50/80 -mx-3 -mb-3 p-3 rounded-b-xl space-y-2.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <BellRing className="w-3.5 h-3.5 text-amber-600" />
                            <span>Geofence Alert Rules for {mem.user.fullName}</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={alertCfg.notifyOnEnter}
                                onChange={(e) =>
                                  handleUpdateMemberGeofenceConfig(mem.userId, {
                                    enabled: true,
                                    notifyOnEnter: e.target.checked,
                                  })
                                }
                                className="rounded accent-amber-600"
                              />
                              <span>On Enter</span>
                            </label>
                            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={alertCfg.notifyOnLeave}
                                onChange={(e) =>
                                  handleUpdateMemberGeofenceConfig(mem.userId, {
                                    enabled: true,
                                    notifyOnLeave: e.target.checked,
                                  })
                                }
                                className="rounded accent-amber-600"
                              />
                              <span>On Leave</span>
                            </label>
                          </div>
                        </div>

                        {savedPlaces.length === 0 ? (
                          <div className="text-xs text-slate-500 bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                            <span>No saved locations yet. Add a saved place to monitor its geofence radius.</span>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>
                                Select saved locations to watch (leave all unchecked to monitor all {savedPlaces.length} places):
                              </span>
                              {alertCfg.placeIds.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateMemberGeofenceConfig(mem.userId, { placeIds: [] })
                                  }
                                  className="text-sky-600 font-semibold hover:underline cursor-pointer"
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
                                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                                      isSpecificallySelected
                                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                        : isWatched
                                        ? 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                                        : 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 hover:opacity-100'
                                    }`}
                                    title={`Radius: ${place.radiusMeters}m${
                                      distToPlace !== null ? ` · Member is ${formatDistance(distToPlace)} away` : ''
                                    }`}
                                  >
                                    <MapPin
                                      className={`w-3 h-3 ${
                                        isInsideNow ? 'text-emerald-500' : 'text-amber-500'
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
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
          <Users className="w-12 h-12 text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No rooms available</p>
          <p className="text-xs text-slate-500 mt-1">Create or join a room using a unique Room ID</p>
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
