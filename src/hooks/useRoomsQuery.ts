import { useState, useEffect, useCallback, useRef } from 'react';
import type { Room, UserRole } from '../types.ts';
import { api } from '../utils/api.ts';
import { localBackend } from '../utils/localBackend.ts';

const UNIVERSAL_ROOM_FALLBACK: Room = {
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
};

interface CachedRoomsEntry {
  data: Room[];
  signature: string;
  updatedAt: number;
  inFlight: Promise<Room[]> | null;
}

interface CachedRoomDetailsEntry {
  data: Room;
  signature: string;
  updatedAt: number;
  inFlight: Promise<Room | null> | null;
}

const STALE_TIME_MS = 2500;

const roomsListCache = new Map<string, CachedRoomsEntry>();
const roomDetailsCache = new Map<string, CachedRoomDetailsEntry>();
const cacheListeners = new Set<() => void>();

function notifyCacheListeners() {
  cacheListeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('[useRoomsQuery] Listener error:', err);
    }
  });
}

export function computeRoomsListSignature(rooms: Room[]): string {
  if (!Array.isArray(rooms) || rooms.length === 0) return '';
  return rooms
    .map(
      (r) =>
        `${r.id}:${r.name}:${r.description || ''}:${r.memberCount}:${Boolean(r.hasPassword)}:${Boolean(r.isUniversal)}`
    )
    .join('|');
}

export function computeRoomDetailsSignature(room: Room | null | undefined): string {
  if (!room) return '';
  const membersSig = (room.members || [])
    .map(
      (m) =>
        `${m.userId}:${m.role}:${m.user?.fullName || ''}:${m.user?.username || ''}:${m.user?.avatarUrl || ''}`
    )
    .join(',');
  return `${room.id}:${room.name}:${room.description || ''}:${room.memberCount}:${room.ownerId}:${membersSig}`;
}

function getOrCreateRoomsEntry(userId: string): CachedRoomsEntry {
  let entry = roomsListCache.get(userId);
  if (!entry) {
    const initialFallback = localBackend.getUserRooms(userId);
    entry = {
      data: initialFallback,
      signature: computeRoomsListSignature(initialFallback),
      updatedAt: 0,
      inFlight: null,
    };
    roomsListCache.set(userId, entry);
  }
  return entry;
}

function setCachedRoomsForUser(userId: string, nextRooms: Room[]): boolean {
  const entry = getOrCreateRoomsEntry(userId);
  const nextSig = computeRoomsListSignature(nextRooms);
  entry.updatedAt = Date.now();
  if (entry.signature === nextSig && entry.data.length === nextRooms.length) {
    return false;
  }
  entry.data = nextRooms;
  entry.signature = nextSig;

  // Also seed basic room metadata into details cache if not already present
  for (const room of nextRooms) {
    if (!roomDetailsCache.has(room.id) && room.members && room.members.length > 0) {
      roomDetailsCache.set(room.id, {
        data: room,
        signature: computeRoomDetailsSignature(room),
        updatedAt: Date.now(),
        inFlight: null,
      });
    }
  }

  notifyCacheListeners();
  return true;
}

function setCachedRoomDetails(roomId: string, nextRoom: Room): boolean {
  const existing = roomDetailsCache.get(roomId);
  const nextSig = computeRoomDetailsSignature(nextRoom);
  if (existing && existing.signature === nextSig) {
    existing.updatedAt = Date.now();
    return false;
  }
  roomDetailsCache.set(roomId, {
    data: nextRoom,
    signature: nextSig,
    updatedAt: Date.now(),
    inFlight: existing?.inFlight || null,
  });
  notifyCacheListeners();
  return true;
}

async function fetchRoomsForUserCached(
  userId: string,
  options: { force?: boolean } = {}
): Promise<Room[]> {
  const entry = getOrCreateRoomsEntry(userId);
  const now = Date.now();

  if (!options.force && entry.updatedAt > 0 && now - entry.updatedAt < STALE_TIME_MS) {
    return entry.data;
  }

  if (entry.inFlight) {
    return entry.inFlight;
  }

  const requestPromise = (async () => {
    try {
      const res = await api.get<{ rooms: Room[] }>('/api/rooms');
      if (Array.isArray(res?.rooms)) {
        setCachedRoomsForUser(userId, res.rooms);
        return getOrCreateRoomsEntry(userId).data;
      }
      return entry.data;
    } catch (err) {
      console.warn('[useRoomsQuery] Falling back to local cached rooms:', err);
      const fallbackRooms = localBackend.getUserRooms(userId);
      if (fallbackRooms.length > 0 && entry.data.length === 0) {
        setCachedRoomsForUser(userId, fallbackRooms);
      }
      return getOrCreateRoomsEntry(userId).data;
    } finally {
      const current = roomsListCache.get(userId);
      if (current) {
        current.inFlight = null;
      }
    }
  })();

  entry.inFlight = requestPromise;
  return requestPromise;
}

async function fetchRoomDetailsCached(
  roomId: string,
  options: { force?: boolean } = {}
): Promise<Room | null> {
  if (!roomId) return null;
  const existing = roomDetailsCache.get(roomId);
  const now = Date.now();

  if (!options.force && existing && existing.updatedAt > 0 && now - existing.updatedAt < STALE_TIME_MS) {
    return existing.data;
  }

  if (existing?.inFlight) {
    return existing.inFlight;
  }

  const requestPromise = (async () => {
    try {
      const res = await api.get<{ room: Room }>(`/api/rooms/${roomId}`);
      if (res?.room) {
        setCachedRoomDetails(roomId, res.room);
        return roomDetailsCache.get(roomId)?.data || res.room;
      }
      return existing?.data || null;
    } catch {
      if (roomId === 'room-universal') {
        const fallback = existing?.data || UNIVERSAL_ROOM_FALLBACK;
        setCachedRoomDetails(roomId, fallback);
        return roomDetailsCache.get(roomId)?.data || fallback;
      }
      return existing?.data || null;
    } finally {
      const current = roomDetailsCache.get(roomId);
      if (current) {
        current.inFlight = null;
      }
    }
  })();

  if (existing) {
    existing.inFlight = requestPromise;
  } else {
    roomDetailsCache.set(roomId, {
      data:
        roomId === 'room-universal'
          ? UNIVERSAL_ROOM_FALLBACK
          : {
              id: roomId,
              name: 'Room',
              description: '',
              ownerId: '',
              hasPassword: false,
              isPrivate: false,
              createdAt: new Date().toISOString(),
              memberCount: 1,
              members: [],
            },
      signature: '',
      updatedAt: 0,
      inFlight: requestPromise,
    });
  }

  return requestPromise;
}

export interface UseRoomsQueryOptions {
  userId?: string;
  selectedRoomId: string | null;
  onSelectRoom?: (roomId: string) => void;
}

export function useRoomsQuery({
  userId,
  selectedRoomId,
  onSelectRoom,
}: UseRoomsQueryOptions) {
  const [rooms, setRoomsState] = useState<Room[]>(() =>
    userId ? getOrCreateRoomsEntry(userId).data : []
  );

  const [activeRoomDetails, setActiveRoomDetailsState] = useState<Room | null>(() => {
    if (!selectedRoomId) return null;
    const cachedDetail = roomDetailsCache.get(selectedRoomId);
    if (cachedDetail && cachedDetail.signature) return cachedDetail.data;
    if (userId) {
      const fromList = getOrCreateRoomsEntry(userId).data.find((r) => r.id === selectedRoomId);
      if (fromList) return fromList;
    }
    return selectedRoomId === 'room-universal' ? UNIVERSAL_ROOM_FALLBACK : null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!userId) return false;
    const entry = getOrCreateRoomsEntry(userId);
    return entry.updatedAt === 0 && entry.data.length === 0;
  });

  const onSelectRoomRef = useRef(onSelectRoom);
  onSelectRoomRef.current = onSelectRoom;
  const selectedRoomIdRef = useRef(selectedRoomId);
  selectedRoomIdRef.current = selectedRoomId;

  // Subscribe to cache updates and only trigger state transition when signatures actually differ
  useEffect(() => {
    if (!userId) {
      setRoomsState((prev) => (prev.length === 0 ? prev : []));
      setIsLoading(false);
      return;
    }

    const syncFromCache = () => {
      const listEntry = getOrCreateRoomsEntry(userId);
      setRoomsState((prev) => {
        if (prev === listEntry.data) return prev;
        return computeRoomsListSignature(prev) === listEntry.signature ? prev : listEntry.data;
      });

      const currentSelectedId = selectedRoomIdRef.current;
      if (!currentSelectedId) {
        setActiveRoomDetailsState((prev) => (prev === null ? prev : null));
        return;
      }

      const detailEntry = roomDetailsCache.get(currentSelectedId);
      if (detailEntry && detailEntry.signature) {
        setActiveRoomDetailsState((prev) => {
          if (prev === detailEntry.data) return prev;
          return computeRoomDetailsSignature(prev) === detailEntry.signature
            ? prev
            : detailEntry.data;
        });
      } else {
        const summaryMatch = listEntry.data.find((r) => r.id === currentSelectedId);
        if (summaryMatch) {
          setActiveRoomDetailsState((prev) => {
            if (prev && prev.id === summaryMatch.id) return prev;
            return summaryMatch;
          });
        }
      }
    };

    syncFromCache();
    cacheListeners.add(syncFromCache);
    return () => {
      cacheListeners.delete(syncFromCache);
    };
  }, [userId, selectedRoomId]);

  const refetchRooms = useCallback(
    async (options: { force?: boolean; showSpinner?: boolean } = {}): Promise<Room[]> => {
      if (!userId) return [];
      const entry = getOrCreateRoomsEntry(userId);
      const shouldShowSpinner = Boolean(
        options.showSpinner && entry.updatedAt === 0 && entry.data.length === 0
      );
      if (shouldShowSpinner) {
        setIsLoading(true);
      }

      try {
        const fetched = await fetchRoomsForUserCached(userId, { force: options.force });
        if (!selectedRoomIdRef.current && fetched.length > 0 && onSelectRoomRef.current) {
          const customRoom = fetched.find((r) => r.id !== 'room-universal');
          onSelectRoomRef.current(customRoom ? customRoom.id : fetched[0].id);
        }
        return fetched;
      } finally {
        if (shouldShowSpinner) {
          setIsLoading(false);
        }
      }
    },
    [userId]
  );

  const refetchRoomDetails = useCallback(
    async (
      targetRoomId?: string | null,
      options: { force?: boolean } = {}
    ): Promise<Room | null> => {
      const rid = targetRoomId ?? selectedRoomIdRef.current;
      if (!rid) {
        setActiveRoomDetailsState((prev) => (prev === null ? prev : null));
        return null;
      }
      return fetchRoomDetailsCached(rid, { force: options.force });
    },
    []
  );

  // Initial rooms fetch + debounced cloud-sync listener
  useEffect(() => {
    if (!userId) return;
    refetchRooms({ showSpinner: true });

    let syncTimeout: ReturnType<typeof setTimeout> | null = null;
    const onCloudSync = () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        refetchRooms({ force: false, showSpinner: false });
        if (selectedRoomIdRef.current) {
          refetchRoomDetails(selectedRoomIdRef.current, { force: false });
        }
      }, 180);
    };

    window.addEventListener('beacon:cloud-sync-updated', onCloudSync);
    return () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      window.removeEventListener('beacon:cloud-sync-updated', onCloudSync);
    };
  }, [userId, refetchRooms, refetchRoomDetails]);

  // Fetch room details when selectedRoomId changes
  useEffect(() => {
    if (!selectedRoomId) {
      setActiveRoomDetailsState((prev) => (prev === null ? prev : null));
      return;
    }

    const cached = roomDetailsCache.get(selectedRoomId);
    if (cached && cached.signature) {
      setActiveRoomDetailsState((prev) =>
        computeRoomDetailsSignature(prev) === cached.signature ? prev : cached.data
      );
    }

    refetchRoomDetails(selectedRoomId, { force: false });
  }, [selectedRoomId, refetchRoomDetails]);

  // Centralized Mutations with Optimistic Cache Updates
  const createRoomMutation = useCallback(
    async (payload: { name: string; description: string; password?: string }): Promise<Room> => {
      const res = await api.post<{ room: Room }>('/api/rooms', payload);
      const created = res.room;
      if (userId) {
        const current = getOrCreateRoomsEntry(userId).data;
        const nextList = current.some((r) => r.id === created.id)
          ? current.map((r) => (r.id === created.id ? created : r))
          : [...current, created];
        setCachedRoomsForUser(userId, nextList);
      }
      setCachedRoomDetails(created.id, created);
      setActiveRoomDetailsState(created);
      return created;
    },
    [userId]
  );

  const joinRoomMutation = useCallback(
    async (payload: { roomId: string; password?: string }): Promise<Room> => {
      const res = await api.post<{ room: Room }>('/api/rooms/join', payload);
      const joined = res.room;
      if (userId) {
        const current = getOrCreateRoomsEntry(userId).data;
        const nextList = current.some((r) => r.id === joined.id)
          ? current.map((r) => (r.id === joined.id ? joined : r))
          : [...current, joined];
        setCachedRoomsForUser(userId, nextList);
      }
      setCachedRoomDetails(joined.id, joined);
      setActiveRoomDetailsState(joined);
      return joined;
    },
    [userId]
  );

  const leaveRoomMutation = useCallback(
    async (roomId: string): Promise<Room[]> => {
      await api.post(`/api/rooms/${roomId}/leave`);
      roomDetailsCache.delete(roomId);
      if (userId) {
        const current = getOrCreateRoomsEntry(userId).data;
        const remaining = current.filter((r) => r.id !== roomId);
        setCachedRoomsForUser(userId, remaining);
        return remaining;
      }
      return [];
    },
    [userId]
  );

  const changeRoleMutation = useCallback(
    async (roomId: string, targetUserId: string, newRole: UserRole): Promise<Room | null> => {
      await api.post(`/api/rooms/${roomId}/roles`, { targetUserId, newRole });
      return fetchRoomDetailsCached(roomId, { force: true });
    },
    []
  );

  const kickMemberMutation = useCallback(
    async (roomId: string, targetUserId: string): Promise<Room | null> => {
      await api.kickRoomMember(roomId, targetUserId);
      return fetchRoomDetailsCached(roomId, { force: true });
    },
    []
  );

  return {
    rooms,
    activeRoomDetails,
    isLoading,
    refetchRooms,
    refetchRoomDetails,
    createRoomMutation,
    joinRoomMutation,
    leaveRoomMutation,
    changeRoleMutation,
    kickMemberMutation,
  };
}
