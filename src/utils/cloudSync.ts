import {
  FIREBASE_PRODUCTION_CONFIG,
  FIRESTORE_SYNC_DOC_URL,
  PRODUCTION_API_URL,
  nativeAwareFetch,
  resolveApiUrl,
  syncLogger,
} from '../config/env.ts';

export const firebaseConfig = FIREBASE_PRODUCTION_CONFIG;
const FIRESTORE_SYNC_URL = FIRESTORE_SYNC_DOC_URL;

let runningOnAuthoritativeBackend = false;
export function setRunningOnAuthoritativeBackend(value: boolean): void {
  runningOnAuthoritativeBackend = value;
}

function getBackendSyncEndpoints(): string[] {
  if (runningOnAuthoritativeBackend) return [];
  if (typeof window === 'undefined') {
    return ['http://127.0.0.1:3000/api/sync/state', `${PRODUCTION_API_URL}/api/sync/state`];
  }
  return [resolveApiUrl('/api/sync/state')];
}

function getClientAuthHeaders(includeJsonContentType = false): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Cache-Control': 'no-cache',
  };
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const token = localStorage.getItem('beacon_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const rawUser = localStorage.getItem('beacon_user_profile');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed?.id) headers['X-Beacon-User-Id'] = String(parsed.id);
        if (parsed?.email) headers['X-Beacon-User-Email'] = String(parsed.email);
      }
    } catch {
      // ignore storage read error
    }
  }
  return headers;
}

export interface SyncableDatabaseState {
  users: any[];
  sessions: any[];
  rooms: any[];
  roomMembers: any[];
  locations: Record<string, any>;
  savedPlaces: any[];
  messages: any[];
  reminders: any[];
  meetings: any[];
  emergencyAlerts: any[];
  locationShareRequests: any[];
  reports: any[];
  auditLogs: any[];
  passwordResets: any[];
  locationHistory: any[];
  deletedIds?: string[];
}

type SyncListener = (state: SyncableDatabaseState) => void;
const syncListeners = new Set<SyncListener>();

export function onCloudStateSynced(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

function notifySyncListeners(state: SyncableDatabaseState): void {
  for (const listener of syncListeners) {
    try {
      listener(state);
    } catch {
      // ignore listener errors
    }
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent('beacon:cloud-sync-updated', { detail: state }));
    } catch {
      // ignore
    }
  }
}

// Pre-seeded public profile & room metadata (no passwords, salts, or hashes in client source)
export const INITIAL_SEED_USERS = [
  {
    id: '1acba9f0-df49-4e70-9f0d-b51fd2f61ea0',
    email: 'reddytest39@gmail.com',
    username: 'Reddy',
    fullName: 'Reddy',
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Reddy',
    about: 'Member of Beacon Community',
    phoneNumber: '',
    createdAt: '2026-10-26T08:46:03.025Z',
    isOnline: true,
    lastSeen: '2026-10-27T16:17:41.196Z',
    privacy: {
      locationVisibility: 'room_members',
      phoneVisibility: 'room_members',
      profileVisibility: 'public',
      showOnlineStatus: true,
      locationSharingEnabled: true,
      temporarySharingExpiry: null,
      blockedUserIds: [],
    },
    isAdmin: true,
  },
];

export const INITIAL_SEED_ROOMS = [
  {
    id: 'reddy',
    name: 'Reddy',
    description: 'Personal Room',
    ownerId: '1acba9f0-df49-4e70-9f0d-b51fd2f61ea0',
    hasPassword: false,
    createdAt: '2026-10-26T08:56:20.038Z',
    memberCount: 1,
    isPrivate: true,
  },
];

export const INITIAL_SEED_ROOM_MEMBERS = [
  {
    roomId: 'room-universal',
    userId: '1acba9f0-df49-4e70-9f0d-b51fd2f61ea0',
    role: 'ADMIN',
    joinedAt: '2026-10-26T08:46:03.025Z',
  },
  {
    roomId: 'reddy',
    userId: '1acba9f0-df49-4e70-9f0d-b51fd2f61ea0',
    role: 'OWNER',
    joinedAt: '2026-10-26T08:56:20.039Z',
  },
];

function getItemTimestampMs(item: any): number {
  if (!item || typeof item !== 'object') return 0;
  const raw =
    item.updatedAt ||
    item.updated_at ||
    item.lastSeen ||
    item.timestamp ||
    item.createdAt ||
    item.joinedAt;
  if (!raw) return 0;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function mergeArrayById<T extends Record<string, any>>(
  localArr: T[] = [],
  remoteArr: T[] = [],
  idKey = 'id',
  deletedSet?: Set<string>,
  preferRemoteOnTie = false
): T[] {
  const map = new Map<string, T>();
  for (const item of remoteArr) {
    if (!item || !item[idKey]) continue;
    const key = String(item[idKey]);
    if (deletedSet?.has(key)) continue;
    map.set(key, { ...item });
  }
  for (const item of localArr) {
    if (!item || !item[idKey]) continue;
    const key = String(item[idKey]);
    if (deletedSet?.has(key)) continue;
    const existingRemote = map.get(key);
    if (existingRemote) {
      const localTs = getItemTimestampMs(item);
      const remoteTs = getItemTimestampMs(existingRemote);
      if (localTs > remoteTs) {
        map.set(key, { ...existingRemote, ...item });
      } else if (remoteTs > localTs) {
        map.set(key, { ...item, ...existingRemote });
      } else {
        map.set(
          key,
          preferRemoteOnTie ? { ...item, ...existingRemote } : { ...existingRemote, ...item }
        );
      }
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

export function isExampleOrTestUser(u: any): boolean {
  if (!u || typeof u !== 'object') return false;
  const id = String(u.id || u.userId || '').toLowerCase();
  const email = String(u.email || '').toLowerCase();
  const username = String(u.username || '').toLowerCase();
  const fullName = String(u.fullName || '').toLowerCase();

  if (
    email.endsWith('@beacon.test') ||
    email.endsWith('@example.com') ||
    email === 'demo@beacon.network' ||
    username === 'alex_beacon' ||
    username.startsWith('alice_') ||
    username.startsWith('bob_') ||
    username.startsWith('apk_sync_') ||
    id.startsWith('usr-apk-') ||
    fullName === 'alex morgan' ||
    fullName === 'alice beacon' ||
    fullName === 'bob android' ||
    fullName === 'android apk sync user' ||
    fullName === 'community member'
  ) {
    return true;
  }
  return false;
}

export function purgeExampleMembersFromState(state: SyncableDatabaseState): boolean {
  if (!state || typeof state !== 'object') return false;
  let mutated = false;
  const removedUserIds = new Set<string>();

  if (Array.isArray(state.users)) {
    const beforeLen = state.users.length;
    state.users = state.users.filter((u) => {
      if (isExampleOrTestUser(u)) {
        if (u?.id) removedUserIds.add(String(u.id));
        return false;
      }
      return true;
    });
    if (state.users.length !== beforeLen) mutated = true;
  }

  const validUserIds = new Set<string>(
    Array.isArray(state.users) ? state.users.map((u) => String(u?.id || '')).filter(Boolean) : []
  );

  if (state.locations && typeof state.locations === 'object' && !Array.isArray(state.locations)) {
    for (const [uid, loc] of Object.entries(state.locations)) {
      if (removedUserIds.has(uid) || isExampleOrTestUser(loc) || (validUserIds.size > 0 && !validUserIds.has(uid))) {
        removedUserIds.add(uid);
        delete state.locations[uid];
        mutated = true;
      }
    }
  }

  if (Array.isArray(state.roomMembers) && validUserIds.size > 0) {
    const beforeMem = state.roomMembers.length;
    state.roomMembers = state.roomMembers.filter(
      (m) => validUserIds.has(String(m?.userId)) && !removedUserIds.has(String(m?.userId))
    );
    if (state.roomMembers.length !== beforeMem) mutated = true;
  }

  if (removedUserIds.size > 0) {
    if (!Array.isArray(state.deletedIds)) state.deletedIds = [];
    for (const uid of removedUserIds) {
      if (!state.deletedIds.includes(uid)) {
        state.deletedIds.push(uid);
      }
    }
    if (Array.isArray(state.sessions)) {
      state.sessions = state.sessions.filter((s) => !removedUserIds.has(String(s?.userId)));
    }
    if (Array.isArray(state.messages)) {
      state.messages = state.messages.filter((m) => !removedUserIds.has(String(m?.senderId)));
    }
    if (Array.isArray(state.locationShareRequests)) {
      state.locationShareRequests = state.locationShareRequests.filter(
        (r) => !removedUserIds.has(String(r?.requesterId)) && !removedUserIds.has(String(r?.targetUserId))
      );
    }
    if (Array.isArray(state.locationHistory)) {
      state.locationHistory = state.locationHistory.filter((h) => !removedUserIds.has(String(h?.userId)));
    }
  }

  return mutated;
}

export function mergeDatabaseStates(
  target: SyncableDatabaseState,
  incoming: Partial<SyncableDatabaseState>,
  preferIncoming = false
): void {
  if (!incoming || typeof incoming !== 'object') return;

  purgeExampleMembersFromState(target);
  if (Array.isArray(incoming.users)) {
    incoming = {
      ...incoming,
      users: incoming.users.filter((u) => !isExampleOrTestUser(u)),
    };
  }

  const deletedSet = new Set<string>([
    ...(Array.isArray(target.deletedIds) ? target.deletedIds : []),
    ...(Array.isArray(incoming.deletedIds) ? incoming.deletedIds : []),
  ]);
  target.deletedIds = Array.from(deletedSet).slice(-500);

  // Track any user ID aliases if the same email/username was registered with different IDs across devices
  const userIdAliasMap = new Map<string, string>();

  // 1. Merge Users (match by id, email, or username; preserve canonical ID and latest profile updates)
  if (Array.isArray(incoming.users)) {
    for (const rUser of incoming.users) {
      if (!rUser || (!rUser.id && !rUser.email) || isExampleOrTestUser(rUser) || deletedSet.has(String(rUser.id))) continue;
      const idx = target.users.findIndex(
        (u) =>
          u.id === rUser.id ||
          (u.email && rUser.email && u.email.toLowerCase() === rUser.email.toLowerCase()) ||
          (u.username && rUser.username && u.username.toLowerCase() === rUser.username.toLowerCase())
      );
      if (idx >= 0) {
        const localUser = target.users[idx];
        // Determine canonical ID: prefer seed ID or earlier createdAt ID so user identity never shifts
        const seedMatch = INITIAL_SEED_USERS.find(
          (s) =>
            s.email.toLowerCase() === (localUser.email || rUser.email || '').toLowerCase() ||
            s.username.toLowerCase() === (localUser.username || rUser.username || '').toLowerCase()
        );
        const localCreatedMs = new Date(localUser.createdAt || 0).getTime() || Number.MAX_SAFE_INTEGER;
        const remoteCreatedMs = new Date(rUser.createdAt || 0).getTime() || Number.MAX_SAFE_INTEGER;
        const canonicalId = seedMatch
          ? seedMatch.id
          : localCreatedMs <= remoteCreatedMs
            ? localUser.id
            : rUser.id;

        if (localUser.id && localUser.id !== canonicalId) {
          userIdAliasMap.set(localUser.id, canonicalId);
        }
        if (rUser.id && rUser.id !== canonicalId) {
          userIdAliasMap.set(rUser.id, canonicalId);
        }

        const localTs = getItemTimestampMs(localUser);
        const remoteTs = getItemTimestampMs(rUser);
        const remoteIsNewer = remoteTs > localTs || (remoteTs === localTs && preferIncoming);

        const merged = remoteIsNewer
          ? { ...localUser, ...rUser, id: canonicalId }
          : { ...rUser, ...localUser, id: canonicalId };

        // Keep most recent lastSeen
        const maxLastSeenMs = Math.max(
          new Date(localUser.lastSeen || 0).getTime() || 0,
          new Date(rUser.lastSeen || 0).getTime() || 0
        );
        if (maxLastSeenMs > 0) {
          merged.lastSeen = new Date(maxLastSeenMs).toISOString();
        }

        // Preserve password credentials from whichever side has them
        if (remoteIsNewer && rUser.password) {
          merged.password = rUser.password;
        } else if (localUser.password && !merged.password) {
          merged.password = localUser.password;
        } else if (rUser.password && !merged.password) {
          merged.password = rUser.password;
        }

        if (rUser.passwordHash && (!merged.passwordHash || remoteIsNewer)) {
          merged.passwordHash = rUser.passwordHash;
          merged.salt = rUser.salt;
        }
        if (localUser.passwordHash && !merged.passwordHash) {
          merged.passwordHash = localUser.passwordHash;
          merged.salt = localUser.salt;
        }

        target.users[idx] = merged;
      } else {
        target.users.push({ ...rUser });
      }
    }
  }

  const normalizeUid = (uid?: string): string | undefined => {
    if (!uid) return uid;
    return userIdAliasMap.get(uid) || uid;
  };

  // Deduplicate target.users by canonical id
  const uniqueUsersMap = new Map<string, any>();
  for (const u of target.users) {
    if (!u || !u.id) continue;
    const cid = normalizeUid(u.id)!;
    u.id = cid;
    uniqueUsersMap.set(cid, u);
  }
  target.users = Array.from(uniqueUsersMap.values());

  // 2. Merge Sessions (by token)
  if (Array.isArray(incoming.sessions)) {
    const mergedSessions = mergeArrayById(
      target.sessions,
      incoming.sessions,
      'token',
      deletedSet,
      preferIncoming
    ).map((s) => ({
      ...s,
      userId: normalizeUid(s.userId) || s.userId,
    }));
    target.sessions = mergedSessions.slice(-150);
  }

  // 3. Merge Rooms (by id, preserving passwordHash & salt for password-protected rooms)
  if (Array.isArray(incoming.rooms)) {
    const existingRoomAuth = new Map<string, { passwordHash?: string; salt?: string }>();
    for (const r of [...(target.rooms || []), ...(incoming.rooms || [])]) {
      if (r?.id && r.passwordHash && r.salt) {
        existingRoomAuth.set(String(r.id), { passwordHash: r.passwordHash, salt: r.salt });
      }
    }
    target.rooms = mergeArrayById(
      target.rooms,
      incoming.rooms,
      'id',
      deletedSet,
      preferIncoming
    ).map((r) => {
      const auth = existingRoomAuth.get(String(r.id));
      return {
        ...r,
        ownerId: normalizeUid(r.ownerId) || r.ownerId,
        ...(r.hasPassword && auth && !r.passwordHash ? auth : {}),
      };
    });
  }

  // 4. Merge Room Members (by roomId + userId) — users stay in rooms permanently until they press Leave
  const memberMap = new Map<string, any>();
  const allMembers = [
    ...(Array.isArray(incoming.roomMembers) ? incoming.roomMembers : []),
    ...(Array.isArray(target.roomMembers) ? target.roomMembers : []),
  ];
  for (const m of allMembers) {
    if (!m || !m.roomId || !m.userId) continue;
    if (deletedSet.has(m.roomId)) continue;
    const uid = normalizeUid(m.userId)!;
    const leaveKey = `leave_${m.roomId}_${uid}`;
    if (m.roomId !== 'room-universal' && deletedSet.has(leaveKey)) {
      continue;
    }
    const mapKey = `${m.roomId}_${uid}`;
    const existing = memberMap.get(mapKey);
    if (!existing) {
      memberMap.set(mapKey, { ...m, userId: uid });
    } else {
      // Preserve highest privilege role (OWNER > ADMIN > MEMBER) and latest joinedAt
      const roleRank: Record<string, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };
      const bestRole =
        (roleRank[m.role] || 1) >= (roleRank[existing.role] || 1) ? m.role : existing.role;
      memberMap.set(mapKey, { ...existing, ...m, userId: uid, role: bestRole });
    }
  }
  // Ensure every room owner is always a member of their own room
  for (const r of target.rooms) {
    if (!r || !r.id || !r.ownerId || r.ownerId === 'system') continue;
    const ownerUid = normalizeUid(r.ownerId)!;
    const ownerKey = `${r.id}_${ownerUid}`;
    if (!memberMap.has(ownerKey) && !deletedSet.has(`leave_${r.id}_${ownerUid}`)) {
      memberMap.set(ownerKey, {
        roomId: r.id,
        userId: ownerUid,
        role: 'OWNER',
        joinedAt: r.createdAt || new Date().toISOString(),
      });
    }
  }
  for (const u of target.users) {
    if (!u?.id) continue;
    const uniKey = `room-universal_${u.id}`;
    if (!memberMap.has(uniKey)) {
      memberMap.set(uniKey, {
        roomId: 'room-universal',
        userId: u.id,
        role: u.isAdmin ? 'ADMIN' : 'MEMBER',
        joinedAt: u.createdAt || new Date().toISOString(),
      });
    }
  }
  target.roomMembers = Array.from(memberMap.values());
  // Keep room.memberCount accurate for all rooms
  for (const r of target.rooms) {
    if (!r || !r.id) continue;
    const count = target.roomMembers.filter((m) => m.roomId === r.id).length;
    if (count > 0) {
      r.memberCount = count;
    }
  }

  // 5. Merge Live Locations (always keep newer timestamp per canonical userId)
  if (!target.locations || Array.isArray(target.locations)) {
    const converted: Record<string, any> = {};
    if (Array.isArray(target.locations)) {
      for (const loc of target.locations) {
        if (loc && loc.userId) {
          const cid = normalizeUid(loc.userId) || loc.userId;
          converted[cid] = { ...loc, userId: cid };
        }
      }
    }
    target.locations = converted;
  } else {
    for (const [rawKey, loc] of Object.entries(target.locations)) {
      const cid = normalizeUid(loc?.userId || rawKey) || rawKey;
      if (cid !== rawKey) {
        delete target.locations[rawKey];
      }
      if (loc) {
        target.locations[cid] = { ...loc, userId: cid };
      }
    }
  }
  if (incoming.locations && typeof incoming.locations === 'object') {
    const entries = Array.isArray(incoming.locations)
      ? incoming.locations.map((l: any) => [l?.userId, l] as const)
      : Object.entries(incoming.locations);
    for (const [rawUid, rLoc] of entries) {
      if (!rLoc || typeof rLoc.latitude !== 'number' || typeof rLoc.longitude !== 'number') continue;
      const uid = normalizeUid(rLoc.userId || rawUid) || rawUid;
      if (!uid) continue;
      const normalizedRemoteLoc = { ...rLoc, userId: uid };
      const lLoc = target.locations[uid];
      if (!lLoc) {
        target.locations[uid] = normalizedRemoteLoc;
      } else {
        const rTime = new Date(rLoc.updated_at || rLoc.timestamp || 0).getTime() || 0;
        const lTime = new Date(lLoc.updated_at || lLoc.timestamp || 0).getTime() || 0;
        if (rTime >= lTime) {
          target.locations[uid] = normalizedRemoteLoc;
        }
      }
    }
  }

  // 6. Merge Saved Places (Wishlist)
  if (Array.isArray(incoming.savedPlaces)) {
    target.savedPlaces = mergeArrayById(
      target.savedPlaces,
      incoming.savedPlaces,
      'id',
      deletedSet,
      preferIncoming
    ).map((p) => ({
      ...p,
      userId: normalizeUid(p.userId) || p.userId,
    }));
  }

  // 7. Merge Chat Messages (chronological by createdAt, preserving edits, reactions, and deletions)
  if (Array.isArray(incoming.messages)) {
    const msgMap = new Map<string, any>();
    for (const m of [...(target.messages || []), ...(incoming.messages || [])]) {
      if (!m || !m.id) continue;
      if (deletedSet.has(m.id)) continue;
      const resolvedSenderId = normalizeUid(m.senderId || m.userId) || m.senderId || m.userId;
      const normalizedMsg = {
        ...m,
        senderId: resolvedSenderId,
        ...(m.userId ? { userId: resolvedSenderId } : {}),
        recipientId: normalizeUid(m.recipientId) || m.recipientId,
      };
      const existing = msgMap.get(m.id);
      if (!existing) {
        msgMap.set(m.id, normalizedMsg);
      } else {
        const isDeleted = Boolean(existing.isDeleted || normalizedMsg.isDeleted);
        const isEdited = Boolean(existing.isEdited || normalizedMsg.isEdited);
        const existingTs = getItemTimestampMs(existing);
        const incomingTs = getItemTimestampMs(normalizedMsg);
        const newer = incomingTs >= existingTs ? normalizedMsg : existing;
        const older = incomingTs >= existingTs ? existing : normalizedMsg;

        // Merge reactions per emoji
        const mergedReactions: Record<string, string[]> = {};
        const allEmojis = new Set([
          ...Object.keys(existing.reactions || {}),
          ...Object.keys(normalizedMsg.reactions || {}),
        ]);
        for (const emoji of allEmojis) {
          const usersForEmoji = Array.from(
            new Set([
              ...((existing.reactions && existing.reactions[emoji]) || []),
              ...((normalizedMsg.reactions && normalizedMsg.reactions[emoji]) || []),
            ])
          ).map((id) => normalizeUid(id) || id);
          if (usersForEmoji.length > 0) {
            mergedReactions[emoji] = usersForEmoji;
          }
        }

        msgMap.set(m.id, {
          ...older,
          ...newer,
          isDeleted,
          isEdited,
          text: isDeleted ? '[Message deleted]' : newer.text,
          reactions: mergedReactions,
        });
      }
    }

    const mergedMsgs = Array.from(msgMap.values());
    mergedMsgs.sort(
      (a, b) =>
        (new Date(a.createdAt || a.timestamp || 0).getTime() || 0) -
        (new Date(b.createdAt || b.timestamp || 0).getTime() || 0)
    );
    target.messages = mergedMsgs.slice(-300);
  }

  // 8. Merge Reminders & Meetings
  if (Array.isArray(incoming.reminders)) {
    target.reminders = mergeArrayById(
      target.reminders,
      incoming.reminders,
      'id',
      deletedSet,
      preferIncoming
    ).map((r) => ({
      ...r,
      userId: normalizeUid(r.userId) || r.userId,
    }));
  }
  if (Array.isArray(incoming.meetings)) {
    target.meetings = mergeArrayById(
      target.meetings,
      incoming.meetings,
      'id',
      deletedSet,
      preferIncoming
    ).map((m) => ({
      ...m,
      creatorId: normalizeUid(m.creatorId) || m.creatorId,
    }));
  }

  // 9. Merge Emergency Alerts (respect resolved status & acknowledgements)
  if (Array.isArray(incoming.emergencyAlerts)) {
    const alertMap = new Map<string, any>();
    for (const a of [...(incoming.emergencyAlerts || []), ...(target.emergencyAlerts || [])]) {
      if (!a || !a.id || deletedSet.has(a.id)) continue;
      const existing = alertMap.get(a.id);
      if (!existing) {
        alertMap.set(a.id, {
          ...a,
          senderId: normalizeUid(a.senderId) || a.senderId,
        });
      } else {
        const ackMap = new Map<string, any>();
        for (const ack of [
          ...(Array.isArray(existing.acknowledgedBy) ? existing.acknowledgedBy : []),
          ...(Array.isArray(a.acknowledgedBy) ? a.acknowledgedBy : []),
        ]) {
          if (ack && ack.userId) {
            const uid = normalizeUid(ack.userId) || ack.userId;
            ackMap.set(uid, { ...ack, userId: uid });
          } else if (typeof ack === 'string') {
            const uid = normalizeUid(ack) || ack;
            ackMap.set(uid, { userId: uid, name: 'Member', timestamp: new Date().toISOString() });
          }
        }
        const isResolved = existing.status === 'resolved' || a.status === 'resolved';
        alertMap.set(a.id, {
          ...existing,
          ...a,
          senderId: normalizeUid(a.senderId || existing.senderId) || a.senderId,
          status: isResolved ? 'resolved' : 'active',
          acknowledgedBy: Array.from(ackMap.values()),
        });
      }
    }
    target.emergencyAlerts = Array.from(alertMap.values())
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
      .slice(0, 50);
  }

  // 10. Merge Location Share Requests
  if (Array.isArray(incoming.locationShareRequests)) {
    target.locationShareRequests = mergeArrayById(
      target.locationShareRequests,
      incoming.locationShareRequests,
      'id',
      deletedSet,
      preferIncoming
    ).slice(0, 100);
  }

  // 11. Merge Location History
  if (Array.isArray(incoming.locationHistory)) {
    const hist = mergeArrayById(
      target.locationHistory || [],
      incoming.locationHistory || [],
      'id',
      deletedSet,
      preferIncoming
    ).map((h) => ({
      ...h,
      userId: normalizeUid(h.userId) || h.userId,
    }));
    hist.sort(
      (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
    );
    target.locationHistory = hist.slice(-200);
  }
}

let lastPullTime = 0;
let lastRemoteUpdatedAt = '';
let inFlightPull: Promise<boolean> | null = null;
let inFlightPush: Promise<void> | null = null;
let pendingPushState: SyncableDatabaseState | null = null;
let pushTimeoutId: any = null;
let cloudConnected = false;
let lastSuccessfulSyncMs = 0;
let firestoreQuotaCooldownUntil = 0;
let lastFirestoreHttpStatus = 0;
let lastFirestoreErrorMsg = '';

export function getCloudDatabaseHealth(): {
  connected: boolean;
  lastSyncMs: number;
  projectId: string;
  databaseId: string;
  httpStatus: number;
  errorMessage: string;
  quotaExceeded: boolean;
} {
  return {
    connected: cloudConnected,
    lastSyncMs: lastSuccessfulSyncMs,
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId,
    httpStatus: lastFirestoreHttpStatus,
    errorMessage: lastFirestoreErrorMsg,
    quotaExceeded: lastFirestoreHttpStatus === 429 || Date.now() < firestoreQuotaCooldownUntil,
  };
}

export async function verifyCloudFirestoreConnection(): Promise<boolean> {
  // 1. Check authoritative backend sync endpoint first when running on client/APK/test
  for (const endpoint of getBackendSyncEndpoints()) {
    try {
      const res = await nativeAwareFetch(
        endpoint,
        {
          method: 'GET',
          headers: getClientAuthHeaders(false),
          cache: 'no-store',
          credentials: 'include',
        },
        4500
      );
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (res.ok && ct.includes('application/json')) {
        cloudConnected = true;
        lastSuccessfulSyncMs = Date.now();
        lastFirestoreHttpStatus = res.status;
        lastFirestoreErrorMsg = '';
        return true;
      }
    } catch {
      // try next endpoint
    }
  }

  // 2. Check Cloud Firestore synchronization bridge if not in daily quota cooldown
  if (Date.now() < firestoreQuotaCooldownUntil) {
    return cloudConnected;
  }

  try {
    const res = await nativeAwareFetch(
      FIRESTORE_SYNC_URL,
      {
        method: 'GET',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
        cache: 'no-store',
      },
      5000
    );
    lastFirestoreHttpStatus = res.status;
    if (res.status === 429) {
      firestoreQuotaCooldownUntil = Date.now() + 15 * 60 * 1000;
      lastFirestoreErrorMsg =
        "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'";
      cloudConnected = false;
      syncLogger.log('firestore', 'warn', 'quota_cooldown_active', { status: 429 });
      return false;
    }
    if (res.ok || res.status === 404) {
      cloudConnected = true;
      lastSuccessfulSyncMs = Date.now();
      lastFirestoreErrorMsg = '';
      return true;
    }
    cloudConnected = false;
    lastFirestoreErrorMsg = `Firestore HTTP ${res.status}`;
    return false;
  } catch (err: any) {
    cloudConnected = false;
    lastFirestoreErrorMsg = err?.message || 'Firestore unreachable';
    return false;
  }
}

let backendSyncCooldownUntil = 0;

/**
 * Pulls the latest synchronized state from the Production Backend (or Firestore sync bridge) and merges it into `targetState`
 */
export async function pullAndMergeCloudState(
  targetState: SyncableDatabaseState,
  force = false,
  silentNotify = false
): Promise<boolean> {
  const now = Date.now();
  if (!force && now - lastPullTime < 2000) {
    return false;
  }
  if (inFlightPull) {
    return inFlightPull;
  }

  inFlightPull = (async () => {
    if (inFlightPush) {
      try {
        await inFlightPush;
      } catch {
        // ignore
      }
    }
    let anyUpdated = false;
    lastPullTime = Date.now();
    try {
      // 1. Pull from authoritative production backend (/api/sync/state) if not in cooldown
      if (!runningOnAuthoritativeBackend && Date.now() >= backendSyncCooldownUntil) {
        for (const endpoint of getBackendSyncEndpoints()) {
          try {
            const res = await nativeAwareFetch(
              endpoint,
              {
                method: 'GET',
                headers: getClientAuthHeaders(false),
                cache: 'no-store',
                credentials: 'include',
              },
              2800
            );
            const ct = (res.headers.get('content-type') || '').toLowerCase();
            if (res.ok && ct.includes('application/json')) {
              const payload = await res.json();
              cloudConnected = true;
              lastSuccessfulSyncMs = Date.now();
              if (payload?.state && typeof payload.state === 'object') {
                mergeDatabaseStates(targetState, payload.state, false);
                anyUpdated = true;
                break;
              }
            } else {
              // Proxy returned HTML or error — cool down for 15s so UI stays fast
              backendSyncCooldownUntil = Date.now() + 15000;
            }
          } catch {
            backendSyncCooldownUntil = Date.now() + 15000;
          }
        }
      }

      // 2. Also pull from Cloud Firestore sync bridge so Web Backend and Android APK stay in real-time lockstep
      if ((runningOnAuthoritativeBackend || !anyUpdated) && Date.now() >= firestoreQuotaCooldownUntil) {
        try {
          const res = await nativeAwareFetch(
            FIRESTORE_SYNC_URL,
            {
              method: 'GET',
              headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
              cache: 'no-store',
            },
            3200
          );
          lastFirestoreHttpStatus = res.status;
          if (res.status === 429) {
            firestoreQuotaCooldownUntil = Date.now() + 15 * 60 * 1000;
          } else if (res.ok) {
            const doc = await res.json();
            const rawState =
              doc?.fields?.stateJson?.stringValue || doc?.fields?.payload?.stringValue;
            const remoteUpdatedAt = doc?.fields?.updatedAt?.stringValue || '';
            cloudConnected = true;
            lastSuccessfulSyncMs = Date.now();
            lastFirestoreErrorMsg = '';
            if (rawState && (force || remoteUpdatedAt !== lastRemoteUpdatedAt)) {
              lastRemoteUpdatedAt = remoteUpdatedAt;
              const parsed = JSON.parse(rawState);
              if (parsed && typeof parsed === 'object') {
                mergeDatabaseStates(targetState, parsed, false);
                anyUpdated = true;
              }
            }
          }
        } catch {
          // ignore fallback error
        }
      }

      if (anyUpdated && !silentNotify) {
        notifySyncListeners(targetState);
      }
      return anyUpdated;
    } finally {
      inFlightPull = null;
    }
  })();

  return inFlightPull;
}

async function performSinglePush(stateToPush: SyncableDatabaseState): Promise<void> {
  let pushedSuccessfully = false;
  try {
    const authHeaders = getClientAuthHeaders(true);

    // Strip plaintext passwords while preserving PBKDF2-SHA512 passwordHash + salt
    const sanitizedUsers = (stateToPush.users || []).map((u) => {
      if (!u || typeof u !== 'object') return u;
      const { password, ...safeUser } = u;
      return safeUser;
    });

    const sanitizedRooms = (stateToPush.rooms || []).map((r) => {
      if (!r || typeof r !== 'object') return r;
      const { password, ...safeRoom } = r;
      return safeRoom;
    });

    // Trim history arrays so payload stays well under 900KB
    const compactState: SyncableDatabaseState = {
      ...stateToPush,
      users: sanitizedUsers,
      rooms: sanitizedRooms,
      messages: (stateToPush.messages || []).slice(-250),
      locationHistory: (stateToPush.locationHistory || []).slice(-180),
      auditLogs: (stateToPush.auditLogs || []).slice(-80),
      sessions: [],
      passwordResets: [],
      deletedIds: (stateToPush.deletedIds || []).slice(-400),
    };

    const serialized = JSON.stringify(compactState);
    if (serialized.length >= 940000) return;

    // 1. Push to authoritative production backend (/api/sync/state) if running on client/APK and authenticated
    if (
      !runningOnAuthoritativeBackend &&
      authHeaders['Authorization'] &&
      Date.now() >= backendSyncCooldownUntil
    ) {
      for (const endpoint of getBackendSyncEndpoints()) {
        try {
          const res = await nativeAwareFetch(
            endpoint,
            {
              method: 'POST',
              headers: authHeaders,
              credentials: 'include',
              body: JSON.stringify({ state: compactState }),
            },
            3200
          );
          const ct = (res.headers.get('content-type') || '').toLowerCase();
          if (res.ok && ct.includes('application/json')) {
            const payload = await res.json();
            if (payload?.state && typeof payload.state === 'object') {
              mergeDatabaseStates(stateToPush, payload.state, false);
            }
            cloudConnected = true;
            lastSuccessfulSyncMs = Date.now();
            pushedSuccessfully = true;
            break;
          } else {
            backendSyncCooldownUntil = Date.now() + 15000;
          }
        } catch {
          backendSyncCooldownUntil = Date.now() + 15000;
        }
      }
    }

    // 2. Push to Cloud Firestore REST sync bridge (always executed by authoritative server, and by APK/client when direct backend is unreachable)
    if (
      (runningOnAuthoritativeBackend || !pushedSuccessfully) &&
      Date.now() >= firestoreQuotaCooldownUntil
    ) {
      try {
        const nowIso = new Date().toISOString();
        const res = await nativeAwareFetch(
          FIRESTORE_SYNC_URL,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              fields: {
                stateJson: { stringValue: serialized },
                updatedAt: { stringValue: nowIso },
              },
            }),
          },
          3500
        );
        lastFirestoreHttpStatus = res.status;
        if (res.status === 429) {
          firestoreQuotaCooldownUntil = Date.now() + 15 * 60 * 1000;
        } else if (res.ok) {
          lastRemoteUpdatedAt = nowIso;
          cloudConnected = true;
          lastSuccessfulSyncMs = Date.now();
          lastFirestoreErrorMsg = '';
          pushedSuccessfully = true;
        }
      } catch {
        // ignore
      }
    }

    if (pushedSuccessfully && !runningOnAuthoritativeBackend) {
      notifySyncListeners(stateToPush);
    }
  } catch (err: any) {
    if (!pushedSuccessfully) {
      cloudConnected = false;
      syncLogger.log('firestore', 'warn', 'push_failed', {
        message: err?.message || 'Network error',
      });
    }
  }
}

/**
 * Pushes the merged state to the Production Backend and Cloud Firestore synchronization bridge (serialized & coalesced)
 */
export function schedulePushCloudState(
  localState: SyncableDatabaseState,
  immediate = false
): void {
  pendingPushState = localState;
  if (pushTimeoutId) {
    clearTimeout(pushTimeoutId);
    pushTimeoutId = null;
  }

  const drainPushQueue = () => {
    if (inFlightPush) return;
    const nextState = pendingPushState;
    if (!nextState) return;
    pendingPushState = null;

    inFlightPush = performSinglePush(nextState).finally(() => {
      inFlightPush = null;
      if (pendingPushState) {
        drainPushQueue();
      }
    });
  };

  if (immediate) {
    pushTimeoutId = setTimeout(drainPushQueue, 50);
  } else {
    pushTimeoutId = setTimeout(drainPushQueue, 300);
  }
}

/**
 * Generates a PBKDF2-SHA512 cryptographic password hash (100,000 iterations) using Web Crypto API.
 * Compatible with Node.js `crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512')` so credentials
 * created on either Android APK or Web Server are verifiable everywhere without storing plaintext passwords.
 */
export async function hashPasswordUniversal(
  password: string,
  existingSalt?: string
): Promise<{ passwordHash: string; salt: string }> {
  const cleanPass = String(password);
  let salt = existingSalt;
  if (!salt) {
    const randomBytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(randomBytes);
    } else {
      for (let i = 0; i < 16; i++) randomBytes[i] = Math.floor(Math.random() * 256);
    }
    salt = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(cleanPass),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: enc.encode(salt),
        iterations: 100000,
        hash: 'SHA-512',
      },
      key,
      512
    );
    const passwordHash = Array.from(new Uint8Array(bits))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return { passwordHash, salt };
  }

  return { passwordHash: '', salt };
}

/**
 * Verifies a password against PBKDF2-SHA512 (`passwordHash` + `salt`) or legacy fallback
 * using standard Web Crypto API so accounts created on the web server work in the Android APK and vice versa.
 */
export async function verifyPasswordUniversal(
  inputPassword: string,
  userRec: { password?: string; passwordHash?: string; salt?: string }
): Promise<boolean> {
  const cleanPass = String(inputPassword);
  const trimmedPass = cleanPass.trim();

  if (userRec.password) {
    if (userRec.password === cleanPass || userRec.password === trimmedPass) {
      return true;
    }
  }

  if (userRec.passwordHash && userRec.salt && typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const enc = new TextEncoder();
      for (const candidate of [cleanPass, trimmedPass]) {
        const key = await crypto.subtle.importKey(
          'raw',
          enc.encode(candidate),
          { name: 'PBKDF2' },
          false,
          ['deriveBits']
        );

        for (const iterations of [100000, 10000]) {
          const bits = await crypto.subtle.deriveBits(
            {
              name: 'PBKDF2',
              salt: enc.encode(userRec.salt),
              iterations,
              hash: 'SHA-512',
            },
            key,
            512
          );
          const hex = Array.from(new Uint8Array(bits))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          if (hex === userRec.passwordHash) {
            return true;
          }
        }
      }
    } catch {
      // ignore subtle crypto error
    }
  }

  return false;
}
