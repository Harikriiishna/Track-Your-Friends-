import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import type { Room, RoomMember, UserRole } from '../../types.ts';
import { api } from '../../utils/api.ts';
import { calculateDistanceMeters, formatDistance } from '../../utils/geo.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
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
  Check,
  UserX,
} from 'lucide-react';

interface RoomsManagerProps {
  onSelectRoom: (roomId: string) => void;
  selectedRoomId: string | null;
  onSelectUserForChat?: (userId: string) => void;
  onOpenChat?: (roomId?: string) => void;
  onFocusMapLocation?: (lat: number, lng: number) => void;
}

export const RoomsManager: React.FC<RoomsManagerProps> = ({
  onSelectRoom,
  selectedRoomId,
  onSelectUserForChat,
  onOpenChat,
  onFocusMapLocation,
}) => {
  const { user } = useAuth();
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
  const [isLoading, setIsLoading] = useState(true);
  const [quickHubMessage, setQuickHubMessage] = useState('');

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

  // Fetch rooms
  const loadRooms = async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{ rooms: Room[] }>('/api/rooms');
      setRooms(res.rooms);
      if (!selectedRoomId && res.rooms.length > 0) {
        onSelectRoom(res.rooms[0].id);
      }
    } catch (err) {
      console.error('Failed to load rooms:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  // Fetch room details when selected
  useEffect(() => {
    if (!selectedRoomId) {
      setActiveRoomDetails(null);
      return;
    }
    async function loadDetails() {
      try {
        const res = await api.get<{ room: Room }>(`/api/rooms/${selectedRoomId}`);
        setActiveRoomDetails(res.room);
      } catch (err) {
        console.error('Failed to load room details:', err);
        if (selectedRoomId === 'room-universal') {
          const fallback = rooms.find((r) => r.id === 'room-universal') || {
            id: 'room-universal',
            name: '🌐 Universal Lounge',
            description: 'The open global town square for everyone on Beacon. Coordinate live locations, chat across channels, and meet members worldwide.',
            ownerId: 'system',
            hasPassword: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            memberCount: Math.max(1, onlineUserIds.length),
            isPrivate: false,
            isUniversal: true,
            members: [],
          };
          setActiveRoomDetails(fallback as Room);
        }
      }
    }
    loadDetails();
  }, [selectedRoomId, rooms, onlineUserIds]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const res = await api.post<{ room: Room }>('/api/rooms', {
        name: newRoomName,
        description: newRoomDesc,
        password: newRoomPassword,
      });
      setRooms((prev) => [...prev, res.room]);
      onSelectRoom(res.room.id);
      setShowCreateModal(false);
      setNewRoomName('');
      setNewRoomDesc('');
      setNewRoomPassword('');
      toast.success(`Room "${res.room.name}" created`);
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
      setRooms((prev) => (prev.some((r) => r.id === res.room.id) ? prev : [...prev, res.room]));
      onSelectRoom(res.room.id);
      setShowJoinModal(false);
      setJoinRoomId('');
      setJoinPassword('');
      toast.success(`Joined "${res.room.name}"`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to join room');
      toast.error(err.message || 'Failed to join room');
    }
  };

  const handleLeaveRoom = async (roomId: string) => {
    try {
      await api.post(`/api/rooms/${roomId}/leave`);
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      if (selectedRoomId === roomId) {
        onSelectRoom(rooms.find((r) => r.id !== roomId)?.id || '');
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

                      <div className="flex items-center gap-1.5 shrink-0">
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

              {!(activeRoomDetails.isUniversal || activeRoomDetails.id === 'room-universal') ? (
                <button
                  onClick={() => handleLeaveRoom(activeRoomDetails.id)}
                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  title="Leave Room"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="px-2.5 py-1 rounded-lg bg-indigo-100/80 text-indigo-700 text-[10px] font-bold">
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
                </div>
              )}
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

          {/* Room Members Roster with Real Distances */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-500" />
                Members & Live Coordinates ({activeRoomDetails.members?.length || 0})
              </h4>
            </div>

            <div className="space-y-2">
              {activeRoomDetails.members?.map((mem) => {
                const isOnline = onlineUserIds.includes(mem.userId);
                const peerLoc = userLocations.find((l) => l.userId === mem.userId);

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

                return (
                  <div
                    key={mem.userId}
                    className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
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
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {mem.user.fullName}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {mem.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span>@{mem.user.username}</span>
                          <span>·</span>
                          <span className="text-blue-600 font-medium">{distanceText}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {mem.userId !== user?.id && (
                        <>
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
                              onClick={() => onFocusMapLocation?.(peerLoc.latitude, peerLoc.longitude)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View on Live Map"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100">
            <h3 className="font-bold text-lg text-slate-900 mb-1">Create Private Room</h3>
            <p className="text-xs text-slate-500 mb-4">
              Set up a secure encrypted room for your family or team.
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Room Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Family Safe Haven"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Real-time family check-ins and emergency alerts"
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Room Password (Optional)
                </label>
                <input
                  type="password"
                  placeholder="Leave empty for open room"
                  value={newRoomPassword}
                  onChange={(e) => setNewRoomPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100">
            <h3 className="font-bold text-lg text-slate-900 mb-1">Join Room</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter the unique Room ID and password (if required).
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleJoinRoom} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Room ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. room-3b91a24f"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  placeholder="Room password if protected"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm"
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
