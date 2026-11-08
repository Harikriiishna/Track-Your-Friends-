import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { api } from '../../utils/api.ts';
import { calculateDistanceMeters, formatDistance, formatTimeAgo } from '../../utils/geo.ts';
import { useToast } from '../../context/ToastContext.tsx';
import type { LocationShareRequest, UserProfile } from '../../types.ts';
import {
  Users,
  UserPlus,
  Search,
  MapPin,
  MessageSquare,
  Check,
  X,
  Clock,
  Shield,
  UserX,
  Copy,
  Send,
  Compass,
  Radio,
  Sparkles,
  Eye,
  Heart,
} from 'lucide-react';

interface FriendsViewProps {
  onFocusMapLocation: (lat: number, lng: number) => void;
  onSelectUserForChat: (user: { id: string; name: string; avatar: string }) => void;
}

type FriendsSubTab = 'friends' | 'requests' | 'add' | 'blocked';
type FriendStatusFilter = 'all' | 'online' | 'sharing';

interface FriendDirectoryItem {
  userId: string;
  fullName: string;
  username: string;
  avatarUrl: string;
  isOnline: boolean;
  isSharingLocation: boolean;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  updatedAt?: string;
  relationshipStatus: 'friend' | 'temporary' | 'mesh_peer';
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  onFocusMapLocation,
  onSelectUserForChat,
}) => {
  const { user } = useAuth();
  const { myLocation, userLocations, onlineUserIds } = useRealtime();
  const { themeConfig } = useTheme();
  const isDark = themeConfig.isDark;
  const toast = useToast();

  const [subTab, setSubTab] = useState<FriendsSubTab>('friends');
  const [statusFilter, setStatusFilter] = useState<FriendStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [requests, setRequests] = useState<LocationShareRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<UserProfile[]>([]);
  const [targetIdentifier, setTargetIdentifier] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copiedMyId, setCopiedMyId] = useState(false);
  const [previewFriend, setPreviewFriend] = useState<FriendDirectoryItem | null>(null);

  const loadFriendsData = async () => {
    if (!user || !api.getToken()) return;
    try {
      const [reqRes, blkRes] = await Promise.all([
        api
          .get<{ requests: LocationShareRequest[] }>('/api/locations/requests')
          .catch(() => ({ requests: [] })),
        api.getBlockedUsers().catch(() => ({ blockedUsers: [] })),
      ]);
      if (Array.isArray(reqRes.requests)) setRequests(reqRes.requests);
      if (Array.isArray(blkRes.blockedUsers)) setBlockedUsers(blkRes.blockedUsers);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadFriendsData();
    const onSync = () => void loadFriendsData();
    window.addEventListener('beacon:cloud-sync-updated', onSync);
    return () => window.removeEventListener('beacon:cloud-sync-updated', onSync);
  }, [user?.id]);

  // Build unified Friends directory combining accepted requests & live peer mesh nodes
  const friendsList = useMemo(() => {
    const map = new Map<string, FriendDirectoryItem>();

    // 1. Accepted / Temporary location-share relationships
    requests
      .filter((r) => r.status === 'accepted' || r.status === 'temporary')
      .forEach((r) => {
        const isInitiator = r.fromUserId === user?.id;
        const friendId = isInitiator ? r.toUserId : r.fromUserId;
        if (!friendId || friendId === user?.id) return;

        const liveLoc = userLocations.find((l) => l.userId === friendId);
        const fullName =
          liveLoc?.fullName ||
          (isInitiator ? r.toUserName : r.fromUserName) ||
          `User ${friendId.slice(0, 6)}`;
        const username =
          liveLoc?.username ||
          (isInitiator ? r.toUsername : r.fromUsername) ||
          friendId.slice(0, 8);
        const avatarUrl =
          liveLoc?.avatarUrl ||
          (isInitiator ? r.toUserAvatar : r.fromUserAvatar) ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(friendId)}`;

        map.set(friendId, {
          userId: friendId,
          fullName,
          username,
          avatarUrl,
          isOnline: onlineUserIds.includes(friendId),
          isSharingLocation: Boolean(liveLoc),
          latitude: liveLoc?.latitude,
          longitude: liveLoc?.longitude,
          accuracy: liveLoc ? Number(liveLoc.accuracy_m ?? liveLoc.accuracy) : undefined,
          updatedAt: liveLoc?.updated_at || liveLoc?.timestamp,
          relationshipStatus: r.status === 'temporary' ? 'temporary' : 'friend',
        });
      });

    // 2. Active peers broadcasting on the mesh
    userLocations.forEach((loc) => {
      if (loc.userId === user?.id) return;
      if (!map.has(loc.userId)) {
        map.set(loc.userId, {
          userId: loc.userId,
          fullName: loc.fullName,
          username: loc.username,
          avatarUrl: loc.avatarUrl,
          isOnline: onlineUserIds.includes(loc.userId),
          isSharingLocation: true,
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: Number(loc.accuracy_m ?? loc.accuracy),
          updatedAt: loc.updated_at || loc.timestamp,
          relationshipStatus: 'mesh_peer',
        });
      }
    });

    const q = searchQuery.trim().toLowerCase();
    return Array.from(map.values()).filter((f) => {
      if (statusFilter === 'online' && !f.isOnline) return false;
      if (statusFilter === 'sharing' && !f.isSharingLocation) return false;
      if (!q) return true;
      return (
        f.fullName.toLowerCase().includes(q) ||
        f.username.toLowerCase().includes(q) ||
        f.userId.toLowerCase().includes(q)
      );
    });
  }, [requests, userLocations, onlineUserIds, user?.id, searchQuery, statusFilter]);

  const incomingPending = useMemo(
    () => requests.filter((r) => r.toUserId === user?.id && r.status === 'pending'),
    [requests, user?.id]
  );

  const outgoingPending = useMemo(
    () => requests.filter((r) => r.fromUserId === user?.id && r.status === 'pending'),
    [requests, user?.id]
  );

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = targetIdentifier.trim();
    if (!cleaned) return;
    setIsSending(true);
    try {
      const res = await api.post<{ request: LocationShareRequest }>('/api/locations/request', {
        toUsernameOrEmail: cleaned,
      });
      setRequests((prev) => [res.request, ...prev.filter((r) => r.id !== res.request.id)]);
      setTargetIdentifier('');
      toast.success(`Friend & location request sent to "${cleaned}"!`);
      setSubTab('requests');
    } catch (err: any) {
      toast.error(err?.message || 'Could not find user with that ID, username, or email');
    } finally {
      setIsSending(false);
    }
  };

  const handleRespondRequest = async (
    requestId: string,
    response: 'accepted' | 'temporary' | 'denied'
  ) => {
    try {
      const res = await api.post<{ request: LocationShareRequest }>('/api/locations/respond', {
        requestId,
        response,
      });
      setRequests((prev) => prev.map((r) => (r.id === requestId ? res.request : r)));
      if (response === 'accepted') {
        toast.success('Friend request accepted — live location sharing active!');
      } else if (response === 'temporary') {
        toast.success('Approved temporary 1-hour location sharing');
      } else {
        toast.info('Friend request declined');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to respond to request');
    }
  };

  const handleBlockFriend = async (targetUserId: string, fullName: string) => {
    try {
      await api.blockUser(targetUserId);
      toast.success(`Blocked ${fullName}`);
      setPreviewFriend(null);
      void loadFriendsData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to block user');
    }
  };

  const handleUnblockUser = async (targetUserId: string, fullName: string) => {
    try {
      await api.unblockUser(targetUserId);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== targetUserId));
      toast.success(`Unblocked ${fullName}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to unblock user');
    }
  };

  const handleCopyMyId = async () => {
    if (!user?.id) return;
    try {
      await navigator.clipboard.writeText(user.id);
      setCopiedMyId(true);
      toast.success(`Copied your Unique ID: ${user.id}`);
      setTimeout(() => setCopiedMyId(false), 2000);
    } catch {
      toast.info(`Your ID: ${user.id}`);
    }
  };

  return (
    <div
      className={`w-full h-full overflow-y-auto p-4 sm:p-6 pb-28 space-y-6 select-none transition-colors duration-300 ${
        isDark ? 'bg-[#0B081B] text-[#F8F7FF]' : 'bg-[#F8F6FF] text-slate-900'
      }`}
    >
      {/* Top Colourful Social Friends Header */}
      <div className="max-w-5xl mx-auto space-y-5">
        <div
          className={`rounded-[32px] p-5 sm:p-6 border flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden ${
            isDark
              ? 'bg-gradient-to-br from-[#1B153A] via-[#130F2B] to-[#241445] border-[#8957FF]/35 shadow-2xl'
              : 'bg-gradient-to-br from-white via-[#F8F6FF] to-[#FFF0F7] border-[#8957FF]/20 shadow-[0_12px_32px_rgba(137,87,255,0.1)]'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#8957FF] via-[#FF4FA3] to-[#FF8066] flex items-center justify-center text-white shadow-[0_8px_22px_rgba(255,79,163,0.35)] shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  Friends & Circle
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-[#00D6A0]/15 border border-[#00D6A0]/40 text-[#00D6A0] text-[10px] font-extrabold">
                  {friendsList.length} CONNECTED
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-[#A9A2D0]' : 'text-slate-600'}`}>
                See who is online, sharing live GPS locations, or waiting to connect
              </p>
            </div>
          </div>

          {/* Primary Add Friend CTA + Sub-Navigation Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setSubTab('add')}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-[0_6px_20px_rgba(255,79,163,0.35)] cursor-pointer active:scale-95 transition-transform"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Friend</span>
            </button>

            <div
              className={`flex p-1 rounded-2xl border overflow-x-auto ${
                isDark
                  ? 'bg-[#0B081B]/80 border-white/10'
                  : 'bg-[#F3EEFF] border-[#8957FF]/15'
              }`}
            >
              <button
                type="button"
                onClick={() => setSubTab('friends')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  subTab === 'friends'
                    ? 'bg-gradient-to-r from-[#397BFF] to-[#00D9FF] text-white shadow-sm'
                    : isDark
                      ? 'text-[#A9A2D0] hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({friendsList.length})
              </button>

              <button
                type="button"
                onClick={() => setSubTab('requests')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  subTab === 'requests'
                    ? 'bg-gradient-to-r from-[#FF4FA3] to-[#FF8066] text-white shadow-sm'
                    : isDark
                      ? 'text-[#A9A2D0] hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Requests</span>
                {incomingPending.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-white text-[#FF4FA3] text-[10px] font-black">
                    {incomingPending.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSubTab('blocked')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  subTab === 'blocked'
                    ? 'bg-gradient-to-r from-[#8957FF] to-[#397BFF] text-white shadow-sm'
                    : isDark
                      ? 'text-[#A9A2D0] hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Blocked ({blockedUsers.length})
              </button>
            </div>
          </div>
        </div>

        {/* SUB-TAB 1: FRIENDS DIRECTORY WITH COLOURFUL RINGS & FILTERS */}
        {subTab === 'friends' && (
          <div className="space-y-4">
            {/* Search & Online/Sharing Filter Strip */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div
                className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                  isDark
                    ? 'bg-[#130F2B]/90 border-[#8957FF]/30 focus-within:border-[#FF4FA3]'
                    : 'bg-white border-[#8957FF]/20 focus-within:border-[#8957FF] shadow-xs'
                }`}
              >
                <Search className="w-4 h-4 text-[#FF4FA3] shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search friends by name, @username, or Unique ID..."
                  className="w-full bg-transparent text-xs sm:text-sm focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-[#A9A2D0] hover:text-[#FF4FA3] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter Pills: All / Online / Sharing Location */}
              <div
                className={`flex items-center gap-1.5 p-1.5 rounded-2xl border shrink-0 ${
                  isDark
                    ? 'bg-[#130F2B]/90 border-white/10'
                    : 'bg-white border-[#8957FF]/15 shadow-xs'
                }`}
              >
                {(
                  [
                    { id: 'all', label: 'All Friends' },
                    { id: 'online', label: 'Online Now' },
                    { id: 'sharing', label: 'Sharing GPS' },
                  ] as const
                ).map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setStatusFilter(pill.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                      statusFilter === pill.id
                        ? 'bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white shadow-sm'
                        : isDark
                          ? 'text-[#A9A2D0] hover:text-white'
                          : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {friendsList.length === 0 ? (
              <div
                className={`rounded-[32px] border p-10 text-center space-y-3 ${
                  isDark
                    ? 'bg-[#130F2B]/85 border-white/10'
                    : 'bg-white border-[#8957FF]/15 shadow-sm'
                }`}
              >
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#8957FF]/20 to-[#FF4FA3]/20 border border-[#FF4FA3]/35 flex items-center justify-center mx-auto text-[#FF4FA3]">
                  <Users className="w-8 h-8" />
                </div>
                <h3 className="text-base font-extrabold">No Friends Match Your Filter</h3>
                <p
                  className={`text-xs max-w-md mx-auto ${
                    isDark ? 'text-[#A9A2D0]' : 'text-slate-500'
                  }`}
                >
                  Connect with friends using their Unique User ID, @username, or email to see their colourful status rings and live map spots.
                </p>
                <button
                  type="button"
                  onClick={() => setSubTab('add')}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] text-white font-extrabold text-xs inline-flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add Your First Friend</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {friendsList.map((friend) => {
                  const distanceStr =
                    myLocation && friend.latitude != null && friend.longitude != null
                      ? formatDistance(
                          calculateDistanceMeters(
                            myLocation.latitude,
                            myLocation.longitude,
                            friend.latitude,
                            friend.longitude
                          )
                        )
                      : null;

                  return (
                    <div
                      key={friend.userId}
                      onClick={() => setPreviewFriend(friend)}
                      className={`p-4 sm:p-5 rounded-[28px] border transition-all flex flex-col justify-between gap-4 cursor-pointer group ${
                        isDark
                          ? 'bg-[#130F2B]/90 border-[#8957FF]/25 hover:border-[#FF4FA3]/60 shadow-lg'
                          : 'bg-white border-[#8957FF]/15 hover:border-[#FF4FA3]/50 shadow-[0_8px_24px_rgba(137,87,255,0.07)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Large Circular Profile Picture with Colourful Online Status Ring */}
                          <div className="relative shrink-0">
                            <div
                              className={`${
                                friend.isSharingLocation
                                  ? 'social-story-ring-live'
                                  : friend.isOnline
                                    ? 'social-story-ring'
                                    : 'p-[2.5px] bg-slate-400/30'
                              } rounded-full group-hover:scale-105 transition-transform shadow-md`}
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
                              className={`absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 ${
                                isDark ? 'border-[#0B081B]' : 'border-white'
                              } ${
                                friend.isOnline
                                  ? 'bg-[#00D6A0] shadow-[0_0_8px_#00D6A0]'
                                  : 'bg-slate-400'
                              }`}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-extrabold truncate">
                                {friend.fullName}
                              </h3>
                              {friend.isSharingLocation ? (
                                <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#00D6A0]/20 to-[#00D9FF]/20 border border-[#00D6A0]/40 text-[#00D6A0] text-[10px] font-extrabold flex items-center gap-1">
                                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                                  Sharing GPS
                                </span>
                              ) : friend.isOnline ? (
                                <span className="px-2 py-0.5 rounded-full bg-[#8957FF]/20 text-[#8957FF] dark:text-[#E9DFFF] text-[10px] font-extrabold">
                                  Online
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-400 text-[10px] font-bold">
                                  Offline
                                </span>
                              )}
                            </div>

                            <p
                              className={`text-xs truncate mt-0.5 font-medium ${
                                isDark ? 'text-[#A9A2D0]' : 'text-slate-500'
                              }`}
                            >
                              @{friend.username}
                            </p>

                            <div className="flex items-center gap-2 mt-1.5 text-[11px] flex-wrap">
                              {distanceStr ? (
                                <span className="text-[#00D9FF] font-extrabold flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {distanceStr} away
                                </span>
                              ) : (
                                <span className={isDark ? 'text-[#A9A2D0]' : 'text-slate-400'}>
                                  Location paused
                                </span>
                              )}
                              {friend.updatedAt && (
                                <>
                                  <span className="opacity-40">•</span>
                                  <span className={isDark ? 'text-[#A9A2D0]' : 'text-slate-400'}>
                                    {formatTimeAgo(friend.updatedAt)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Friend Action Bar */}
                      <div
                        className={`pt-3 border-t flex items-center justify-between gap-2 ${
                          isDark ? 'border-white/10' : 'border-slate-100'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <button
                            type="button"
                            onClick={() =>
                              onSelectUserForChat({
                                id: friend.userId,
                                name: friend.fullName,
                                avatar: friend.avatarUrl,
                              })
                            }
                            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-[#8957FF] to-[#397BFF] hover:opacity-95 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Message</span>
                          </button>

                          {friend.latitude != null && friend.longitude != null && (
                            <button
                              type="button"
                              onClick={() =>
                                onFocusMapLocation(friend.latitude!, friend.longitude!)
                              }
                              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                            >
                              <Compass className="w-3.5 h-3.5" />
                              <span>View on Map</span>
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setPreviewFriend(friend)}
                          className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                            isDark
                              ? 'border-white/10 text-[#A9A2D0] hover:text-white hover:bg-white/10'
                              : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                          title="Preview Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 2: INCOMING & OUTGOING FRIEND REQUESTS */}
        {subTab === 'requests' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div
              className={`rounded-[28px] border p-5 space-y-3.5 ${
                isDark
                  ? 'bg-[#130F2B]/90 border-[#8957FF]/25'
                  : 'bg-white border-[#8957FF]/15 shadow-sm'
              }`}
            >
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#FF4FA3]">
                Incoming Requests ({incomingPending.length})
              </h3>

              {incomingPending.length === 0 ? (
                <p className={`text-xs py-6 text-center ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                  No pending incoming friend requests.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {incomingPending.map((req) => (
                    <div
                      key={req.id}
                      className={`p-4 rounded-2xl border space-y-3 ${
                        isDark ? 'bg-[#1B153A] border-white/10' : 'bg-[#F8F6FF] border-[#8957FF]/15'
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
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-extrabold truncate">{req.fromUserName}</h4>
                          <p className={`text-[11px] truncate ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                            @{req.fromUsername || req.fromUserId} · {formatTimeAgo(req.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleRespondRequest(req.id, 'accepted')}
                          className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondRequest(req.id, 'temporary')}
                          className="py-2 px-3 rounded-xl bg-[#397BFF]/20 border border-[#397BFF]/40 text-[#00D9FF] font-bold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>1h Temp</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondRequest(req.id, 'denied')}
                          className="py-2 px-3 rounded-xl bg-[#FF4FA3]/15 border border-[#FF4FA3]/40 text-[#FF4FA3] font-bold text-xs cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className={`rounded-[28px] border p-5 space-y-3.5 ${
                isDark
                  ? 'bg-[#130F2B]/90 border-[#8957FF]/25'
                  : 'bg-white border-[#8957FF]/15 shadow-sm'
              }`}
            >
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#8957FF]">
                Sent Requests ({outgoingPending.length})
              </h3>

              {outgoingPending.length === 0 ? (
                <p className={`text-xs py-6 text-center ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                  No outgoing pending requests.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {outgoingPending.map((req) => (
                    <div
                      key={req.id}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                        isDark ? 'bg-[#1B153A] border-white/10' : 'bg-[#F8F6FF] border-[#8957FF]/15'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={
                            req.toUserAvatar ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.toUserId}`
                          }
                          alt={req.toUserName || 'User'}
                          className="w-10 h-10 rounded-full object-cover border border-[#8957FF]/40"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-extrabold block truncate">
                            {req.toUserName || req.toUsername || req.toUserId}
                          </span>
                          <span className={`text-[10px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                            Sent {formatTimeAgo(req.createdAt)}
                          </span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-[#FFD166]/20 border border-[#FFD166]/40 text-[#FFD166] text-[10px] font-extrabold">
                        Pending
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUB-TAB 3: ADD FRIEND BY UNIQUE ID, @USERNAME OR EMAIL */}
        {subTab === 'add' && (
          <div className="max-w-xl mx-auto space-y-4">
            <div
              className={`rounded-[32px] border p-6 space-y-5 shadow-2xl ${
                isDark
                  ? 'bg-[#130F2B]/90 border-[#8957FF]/35'
                  : 'bg-white border-[#8957FF]/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#8957FF] to-[#FF4FA3] flex items-center justify-center text-white shadow-lg">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold">Add Friend & Connect</h3>
                  <p className={`text-xs ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                    Enter a friend's Unique User ID, @username, or registered email
                  </p>
                </div>
              </div>

              <form onSubmit={handleSendFriendRequest} className="space-y-4">
                <div>
                  <label
                    className={`block text-[11px] font-extrabold uppercase tracking-wider mb-1.5 ${
                      isDark ? 'text-[#A9A2D0]' : 'text-slate-600'
                    }`}
                  >
                    Friend Identifier
                  </label>
                  <input
                    type="text"
                    required
                    value={targetIdentifier}
                    onChange={(e) => setTargetIdentifier(e.target.value)}
                    placeholder="e.g. @alex_walker, user-12345, or alex@domain.com"
                    className={`w-full px-4 py-3 rounded-2xl border text-sm focus:outline-none transition-colors ${
                      isDark
                        ? 'bg-[#0B081B] border-[#8957FF]/40 text-white placeholder-[#A9A2D0]/50 focus:border-[#FF4FA3]'
                        : 'bg-[#F8F6FF] border-[#8957FF]/30 text-slate-900 placeholder-slate-400 focus:border-[#8957FF]'
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSending || !targetIdentifier.trim()}
                  className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] hover:opacity-95 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_8px_25px_rgba(255,79,163,0.4)] cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSending ? 'Sending Request...' : 'Send Friend Request'}</span>
                </button>
              </form>

              {/* Share Your Own Unique ID Card */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                  isDark
                    ? 'bg-[#1B153A] border-white/10'
                    : 'bg-[#F3EEFF] border-[#8957FF]/20'
                }`}
              >
                <div className="min-w-0">
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider block ${
                      isDark ? 'text-[#A9A2D0]' : 'text-slate-500'
                    }`}
                  >
                    Your Shareable Beacon ID
                  </span>
                  <span className="text-xs font-mono font-extrabold text-[#FF4FA3] truncate block mt-0.5">
                    {user?.id}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyMyId}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#397BFF] to-[#00D9FF] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                >
                  {copiedMyId ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy ID</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUB-TAB 4: BLOCKED USERS */}
        {subTab === 'blocked' && (
          <div
            className={`rounded-[28px] border p-5 space-y-3.5 ${
              isDark
                ? 'bg-[#130F2B]/90 border-white/10'
                : 'bg-white border-[#8957FF]/15 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#FF4FA3]" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider">
                Blocked Accounts ({blockedUsers.length})
              </h3>
            </div>

            {blockedUsers.length === 0 ? (
              <p className={`text-xs py-6 text-center ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                You haven't blocked any users.
              </p>
            ) : (
              <div className="space-y-2">
                {blockedUsers.map((bu) => (
                  <div
                    key={bu.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                      isDark ? 'bg-[#1B153A] border-white/10' : 'bg-[#F8F6FF] border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={bu.avatarUrl}
                        alt={bu.fullName}
                        className="w-10 h-10 rounded-full object-cover grayscale"
                      />
                      <div>
                        <span className="text-xs font-extrabold block">{bu.fullName}</span>
                        <span className={`text-[11px] ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                          @{bu.username}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnblockUser(bu.id, bu.fullName)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#00D6A0]/15 border border-[#00D6A0]/40 text-[#00D6A0] text-xs font-extrabold cursor-pointer"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FRIEND PROFILE PREVIEW MODAL */}
      {previewFriend && (
        <div
          onClick={() => setPreviewFriend(null)}
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`max-w-sm w-full rounded-[32px] overflow-hidden border shadow-2xl ${
              isDark
                ? 'bg-[#130F2B] border-[#8957FF]/40 text-[#F8F7FF]'
                : 'bg-white border-[#8957FF]/20 text-slate-900'
            }`}
          >
            {/* Vibrant Gradient Profile Cover */}
            <div className="h-28 bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] relative">
              <button
                type="button"
                onClick={() => setPreviewFriend(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 pb-6 -mt-12 relative space-y-4">
              <div className="flex items-end justify-between">
                <div className="social-story-ring rounded-full p-1 bg-[#130F2B]">
                  <img
                    src={previewFriend.avatarUrl}
                    alt={previewFriend.fullName}
                    className="w-22 h-22 rounded-full object-cover border-2 border-[#0B081B]"
                  />
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-extrabold ${
                    previewFriend.isSharingLocation
                      ? 'bg-[#00D6A0]/20 text-[#00D6A0] border border-[#00D6A0]/40'
                      : previewFriend.isOnline
                        ? 'bg-[#8957FF]/20 text-[#8957FF]'
                        : 'bg-slate-500/20 text-slate-400'
                  }`}
                >
                  {previewFriend.isSharingLocation
                    ? '📍 Sharing Live GPS'
                    : previewFriend.isOnline
                      ? '● Online Now'
                      : 'Offline'}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-extrabold">{previewFriend.fullName}</h3>
                <p className={`text-xs font-medium ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                  @{previewFriend.username} · ID: {previewFriend.userId.slice(0, 10)}
                </p>
              </div>

              {/* Location & Telemetry Preview Box */}
              <div
                className={`p-3.5 rounded-2xl border space-y-1.5 ${
                  isDark ? 'bg-[#1B153A] border-white/10' : 'bg-[#F8F6FF] border-[#8957FF]/15'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className={isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}>Live Distance</span>
                  <span className="font-extrabold text-[#00D9FF]">
                    {myLocation &&
                    previewFriend.latitude != null &&
                    previewFriend.longitude != null
                      ? `${formatDistance(
                          calculateDistanceMeters(
                            myLocation.latitude,
                            myLocation.longitude,
                            previewFriend.latitude,
                            previewFriend.longitude
                          )
                        )} away`
                      : 'Coordinates private'}
                  </span>
                </div>
                {previewFriend.updatedAt && (
                  <div className="flex items-center justify-between text-xs">
                    <span className={isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}>Last Active</span>
                    <span className="font-bold">{formatTimeAgo(previewFriend.updatedAt)}</span>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const target = previewFriend;
                    setPreviewFriend(null);
                    onSelectUserForChat({
                      id: target.userId,
                      name: target.fullName,
                      avatar: target.avatarUrl,
                    });
                  }}
                  className="flex-1 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Send Message</span>
                </button>

                {previewFriend.latitude != null && previewFriend.longitude != null && (
                  <button
                    type="button"
                    onClick={() => {
                      const lat = previewFriend.latitude!;
                      const lng = previewFriend.longitude!;
                      setPreviewFriend(null);
                      onFocusMapLocation(lat, lng);
                    }}
                    className="py-2.5 px-4 rounded-2xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
                  >
                    <Compass className="w-4 h-4" />
                    <span>Locate</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    handleBlockFriend(previewFriend.userId, previewFriend.fullName)
                  }
                  className="p-2.5 rounded-2xl bg-[#FF4FA3]/15 border border-[#FF4FA3]/35 text-[#FF4FA3] hover:bg-[#FF4FA3] hover:text-white transition-colors cursor-pointer"
                  title={`Block ${previewFriend.fullName}`}
                >
                  <UserX className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
