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
} from 'lucide-react';

interface RoomsManagerProps {
  onSelectRoom: (roomId: string) => void;
  selectedRoomId: string | null;
  onSelectUserForChat?: (userId: string) => void;
  onFocusMapLocation?: (lat: number, lng: number) => void;
}

export const RoomsManager: React.FC<RoomsManagerProps> = ({
  onSelectRoom,
  selectedRoomId,
  onSelectUserForChat,
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
  } = useRealtime();

  const toast = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomDetails, setActiveRoomDetails] = useState<Room | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [newRoomPassword, setNewRoomPassword] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      }
    }
    loadDetails();
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

  const myMembership = activeRoomDetails?.members?.find((m) => m.userId === user?.id);
  const canManageRoles = myMembership?.role === 'OWNER' || myMembership?.role === 'ADMIN';

  return (
    <div className={`flex flex-col h-full border-r ${themeConfig.glassBorder} transition-colors duration-200`}>
      {/* Top Header */}
      <div className={`p-4 border-b ${themeConfig.glassBorder} ${themeConfig.glassHeader} flex items-center justify-between`}>
        <div>
          <h2 className={`font-bold ${themeConfig.textPrimary} text-base`}>Rooms & Mesh</h2>
          <p className={`text-xs ${themeConfig.textSecondary}`}>Private encrypted groups</p>
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
          <button
            onClick={() => onSelectRoom('room-universal')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedRoomId === 'room-universal'
                ? 'bg-white text-indigo-900 shadow-md'
                : 'bg-indigo-500/40 hover:bg-indigo-500/60 text-white border border-indigo-400/30'
            }`}
          >
            {selectedRoomId === 'room-universal' ? 'Active' : 'Enter Lounge'}
          </button>
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
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
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
                <div className="px-2.5 py-1 rounded-lg bg-indigo-100/80 text-indigo-700 text-[10px] font-bold">
                  Permanent Hub
                </div>
              )}
            </div>

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
                            onClick={() => onSelectUserForChat?.(mem.userId)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Direct Message"
                          >
                            <MessageSquare className="w-4 h-4" />
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
