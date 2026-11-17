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

// Real-time cross-device HTTPS + WSS Cloud Relay channels (works across all Android APK devices & Web even when Cloud Run proxy or Firestore free-tier quota is throttled)
const NTFY_BASE_URL = 'https://ntfy.sh';
const NTFY_CORE_TOPIC = 'beacon_mesh_core_bb482c10_v3';
const NTFY_LIVE_TOPIC = 'beacon_mesh_live_bb482c10_v3';

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

export const LEGACY_REDDY_UUID = '1acba9f0-df49-4e70-9f0d-b51fd2f61ea0';

// Pre-seeded public profile & room metadata (no passwords, salts, or hashes in client source)
export const INITIAL_SEED_USERS = [
  {
    id: 'Reddy',
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
    ownerId: 'Reddy',
    hasPassword: false,
    createdAt: '2026-10-26T08:56:20.038Z',
    memberCount: 1,
    isPrivate: true,
  },
  {
    id: 'reddy-1',
    name: 'reddy-1',
    description: 'Private Group Room',
    ownerId: 'Reddy',
    hasPassword: false,
    createdAt: '2026-10-26T08:56:25.000Z',
    memberCount: 1,
    isPrivate: true,
  },
];

export const INITIAL_SEED_ROOM_MEMBERS = [
  {
    roomId: 'room-universal',
    userId: 'Reddy',
    role: 'ADMIN',
    joinedAt: '2026-10-26T08:46:03.025Z',
  },
  {
    roomId: 'reddy',
    userId: 'Reddy',
    role: 'OWNER',
    joinedAt: '2026-10-26T08:56:20.039Z',
  },
  {
    roomId: 'reddy-1',
    userId: 'Reddy',
    role: 'OWNER',
    joinedAt: '2026-10-26T08:56:25.000Z',
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

  // Track any user ID aliases if the same email/username/fullName was registered with different IDs across devices
  const userIdAliasMap = new Map<string, string>();
  userIdAliasMap.set(LEGACY_REDDY_UUID, 'Reddy');

  // Normalize any legacy UUIDs already in target.users
  if (Array.isArray(target.users)) {
    for (const u of target.users) {
      if (u && u.id === LEGACY_REDDY_UUID) {
        u.id = 'Reddy';
      }
    }
  }

  // 1. Merge Users (match by id, email, username, or fullName; prefer human-readable Name ID)
  if (Array.isArray(incoming.users)) {
    for (const rUser of incoming.users) {
      if (!rUser || (!rUser.id && !rUser.email && !rUser.username)) continue;
      if (rUser.id === LEGACY_REDDY_UUID) {
        rUser.id = 'Reddy';
      }
      if (isExampleOrTestUser(rUser) || deletedSet.has(String(rUser.id))) continue;

      const rIdLower = String(rUser.id || '').toLowerCase();
      const rEmailLower = String(rUser.email || '').toLowerCase();
      const rUserLower = String(rUser.username || '').toLowerCase();
      const rNameLower = String(rUser.fullName || '').toLowerCase();

      const idx = target.users.findIndex((u) => {
        const uIdLower = String(u.id || '').toLowerCase();
        const uEmailLower = String(u.email || '').toLowerCase();
        const uUserLower = String(u.username || '').toLowerCase();
        const uNameLower = String(u.fullName || '').toLowerCase();
        return (
          (rIdLower && uIdLower === rIdLower) ||
          (rEmailLower && uEmailLower && !rEmailLower.endsWith('@beacon.local') && !uEmailLower.endsWith('@beacon.local') && uEmailLower === rEmailLower) ||
          (rUserLower && uUserLower && uUserLower === rUserLower) ||
          (rNameLower && uNameLower && uNameLower === rNameLower)
        );
      });

      if (idx >= 0) {
        const localUser = target.users[idx];
        const preferredNameId =
          (localUser.fullName || rUser.fullName || localUser.username || rUser.username || localUser.id || rUser.id).trim();
        const isLocalUuid = /^[0-9a-f-]{20,}$/i.test(String(localUser.id || '')) || String(localUser.id || '').startsWith('usr-');
        const isRemoteUuid = /^[0-9a-f-]{20,}$/i.test(String(rUser.id || '')) || String(rUser.id || '').startsWith('usr-');

        let canonicalId = localUser.id;
        if (isLocalUuid && !isRemoteUuid && rUser.id) {
          canonicalId = rUser.id;
        } else if (isLocalUuid && isRemoteUuid && preferredNameId) {
          canonicalId = preferredNameId;
        }

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

        // If one side was a placeholder email (@beacon.local) and the other has a real email, keep the real email
        if (String(merged.email || '').endsWith('@beacon.local')) {
          if (localUser.email && !String(localUser.email).endsWith('@beacon.local')) {
            merged.email = localUser.email;
          } else if (rUser.email && !String(rUser.email).endsWith('@beacon.local')) {
            merged.email = rUser.email;
          }
        }

        const maxLastSeenMs = Math.max(
          new Date(localUser.lastSeen || 0).getTime() || 0,
          new Date(rUser.lastSeen || 0).getTime() || 0
        );
        if (maxLastSeenMs > 0) {
          merged.lastSeen = new Date(maxLastSeenMs).toISOString();
        }

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
    if (userIdAliasMap.has(uid)) return userIdAliasMap.get(uid)!;
    const lower = String(uid).toLowerCase();
    const matchedUser = target.users.find(
      (u) =>
        String(u?.id || '').toLowerCase() === lower ||
        String(u?.username || '').toLowerCase() === lower ||
        String(u?.fullName || '').toLowerCase() === lower
    );
    return matchedUser ? matchedUser.id : uid;
  };

  // Deduplicate target.users by canonical id (case-insensitive)
  const uniqueUsersMap = new Map<string, any>();
  for (const u of target.users) {
    if (!u || !u.id) continue;
    const cid = normalizeUid(u.id)!;
    u.id = cid;
    uniqueUsersMap.set(cid.toLowerCase(), u);
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
    const existingRoomAuth = new Map<string, { passwordHash?: string; salt?: string; hasPassword?: boolean }>();
    for (const r of [...(target.rooms || []), ...(incoming.rooms || [])]) {
      if (r?.id && r.passwordHash && r.salt) {
        existingRoomAuth.set(String(r.id).toLowerCase(), {
          passwordHash: r.passwordHash,
          salt: r.salt,
          hasPassword: true,
        });
      }
    }
    target.rooms = mergeArrayById(
      target.rooms,
      incoming.rooms,
      'id',
      deletedSet,
      preferIncoming
    ).map((r) => {
      const auth = existingRoomAuth.get(String(r.id).toLowerCase());
      return {
        ...r,
        ownerId: normalizeUid(r.ownerId) || r.ownerId,
        ...(auth && !r.passwordHash ? auth : {}),
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
    const mapKey = `${m.roomId.toLowerCase()}_${uid.toLowerCase()}`;
    const existing = memberMap.get(mapKey);
    if (!existing) {
      memberMap.set(mapKey, { ...m, userId: uid });
    } else {
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
    const ownerKey = `${r.id.toLowerCase()}_${ownerUid.toLowerCase()}`;
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
    const uniKey = `room-universal_${u.id.toLowerCase()}`;
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
  for (const r of target.rooms) {
    if (!r || !r.id) continue;
    const count = target.roomMembers.filter((m) => m.roomId.toLowerCase() === r.id.toLowerCase()).length;
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

  // 7. Merge Chat Messages
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

  // 9. Merge Emergency Alerts
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

  // 10. Merge Location Share Requests (deduplicate by fromUserId + toUserId pair as well as id)
  if (Array.isArray(incoming.locationShareRequests)) {
    const mergedReqs = mergeArrayById(
      target.locationShareRequests,
      incoming.locationShareRequests,
      'id',
      deletedSet,
      preferIncoming
    ).map((r) => ({
      ...r,
      fromUserId: normalizeUid(r.fromUserId) || r.fromUserId,
      toUserId: normalizeUid(r.toUserId) || r.toUserId,
    }));

    const pairMap = new Map<string, any>();
    for (const r of mergedReqs) {
      if (!r || !r.fromUserId || !r.toUserId) continue;
      const pairKey = [String(r.fromUserId).toLowerCase(), String(r.toUserId).toLowerCase()].sort().join('::');
      const prev = pairMap.get(pairKey);
      if (!prev) {
        pairMap.set(pairKey, r);
      } else {
        const prevTs = getItemTimestampMs(prev);
        const currTs = getItemTimestampMs(r);
        const statusRank: Record<string, number> = { accepted: 3, temporary: 2, pending: 1, denied: 0 };
        if (
          (statusRank[r.status] ?? 0) > (statusRank[prev.status] ?? 0) ||
          currTs >= prevTs
        ) {
          pairMap.set(pairKey, { ...prev, ...r });
        }
      }
    }
    target.locationShareRequests = Array.from(pairMap.values()).slice(0, 100);
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
let cloudConnected = true;
let lastSuccessfulSyncMs = Date.now();
let firestoreQuotaCooldownUntil = 0;
let lastFirestoreHttpStatus = 200;
let lastFirestoreErrorMsg = '';
let lastFirestorePushMs = 0;

// Track ntfy cursor IDs for incremental polling & live WebSocket streaming
let lastNtfyCoreMsgId = '';
let lastNtfyLiveMsgId = '';
let lastPushedCoreSig = '';
let lastPushedLiveSig = '';
let ntfyWsActive = false;
let ntfyQuotaCooldownUntil = 0;
let lastNtfyHttpPullMs = 0;

function buildCompactCorePayload(state: SyncableDatabaseState): string {
  const compactUsers = (state.users || [])
    .filter((u) => u && !isExampleOrTestUser(u))
    .slice(-20)
    .map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      fullName: u.fullName,
      avatarUrl:
        typeof u.avatarUrl === 'string' && u.avatarUrl.length < 220
          ? u.avatarUrl
          : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.fullName || u.username || u.id)}`,
      phoneNumber: u.phoneNumber || '',
      isOnline: Boolean(u.isOnline),
      lastSeen: u.lastSeen,
      isAdmin: Boolean(u.isAdmin),
      privacy: u.privacy || {
        locationVisibility: 'room_members',
        phoneVisibility: 'room_members',
        profileVisibility: 'public',
        showOnlineStatus: true,
        locationSharingEnabled: true,
        temporarySharingExpiry: null,
        blockedUserIds: [],
      },
      ...(u.passwordHash && u.salt ? { passwordHash: u.passwordHash, salt: u.salt } : {}),
    }));

  const compactRooms = (state.rooms || []).slice(-20).map((r) => ({
    id: r.id,
    name: r.name,
    description: String(r.description || '').slice(0, 120),
    ownerId: r.ownerId,
    hasPassword: Boolean(r.hasPassword),
    ...(r.passwordHash && r.salt ? { passwordHash: r.passwordHash, salt: r.salt } : {}),
    createdAt: r.createdAt,
    memberCount: r.memberCount || 1,
    isPrivate: r.isPrivate ?? true,
    isUniversal: Boolean(r.isUniversal),
  }));

  const compactMembers = (state.roomMembers || []).slice(-50).map((m) => ({
    roomId: m.roomId,
    userId: m.userId,
    role: m.role,
    joinedAt: m.joinedAt,
  }));

  const compactRequests = (state.locationShareRequests || []).slice(0, 25).map((r) => ({
    id: r.id,
    fromUserId: r.fromUserId,
    fromUserName: r.fromUserName,
    fromUsername: r.fromUsername,
    toUserId: r.toUserId,
    toUserName: r.toUserName,
    toUsername: r.toUsername,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    ...(r.expiresAt ? { expiresAt: r.expiresAt } : {}),
  }));

  let payloadObj: Partial<SyncableDatabaseState> = {
    users: compactUsers,
    rooms: compactRooms,
    roomMembers: compactMembers,
    locationShareRequests: compactRequests,
    deletedIds: (state.deletedIds || []).slice(-40),
  };

  let str = JSON.stringify(payloadObj);
  if (str.length > 3700) {
    payloadObj = {
      users: compactUsers.slice(-12),
      rooms: compactRooms.slice(-12),
      roomMembers: compactMembers.slice(-30),
      locationShareRequests: compactRequests.slice(0, 15),
    };
    str = JSON.stringify(payloadObj);
  }
  return str;
}

function buildCompactLivePayload(state: SyncableDatabaseState): string {
  const compactLocations: Record<string, any> = {};
  const locEntries = Object.entries(state.locations || {}).slice(-24);
  for (const [uid, loc] of locEntries) {
    if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') continue;
    compactLocations[uid] = {
      userId: loc.userId || uid,
      username: loc.username,
      fullName: loc.fullName,
      avatarUrl:
        loc.avatarUrl && !String(loc.avatarUrl).startsWith('data:')
          ? loc.avatarUrl
          : undefined,
      markerColor: loc.markerColor,
      markerIcon: loc.markerIcon,
      markerLabel: loc.markerLabel,
      latitude: Number(loc.latitude.toFixed(6)),
      longitude: Number(loc.longitude.toFixed(6)),
      accuracy: Math.round(Number(loc.accuracy || 10)),
      heading: loc.heading,
      speed: loc.speed,
      batteryLevel: loc.batteryLevel,
      timestamp: loc.timestamp,
      updated_at: loc.updated_at || loc.timestamp,
    };
  }

  const compactAlerts = (state.emergencyAlerts || []).slice(0, 6).map((a) => ({
    id: a.id,
    senderId: a.senderId,
    senderName: a.senderName,
    message: String(a.message || '').slice(0, 140),
    latitude: a.latitude,
    longitude: a.longitude,
    accuracy: a.accuracy,
    roomId: a.roomId,
    roomName: a.roomName,
    timestamp: a.timestamp,
    status: a.status,
    acknowledgedBy: (a.acknowledgedBy || []).slice(0, 10),
  }));

  const compactMessages = (state.messages || [])
    .filter((m) => m && !m.isDeleted)
    .slice(-12)
    .map((m) => ({
      id: m.id,
      roomId: m.roomId,
      channelId: m.channelId,
      recipientId: m.recipientId,
      senderId: m.senderId,
      senderName: m.senderName,
      text: String(m.text || '').slice(0, 240),
      replyToId: m.replyToId,
      replyToText: m.replyToText ? String(m.replyToText).slice(0, 80) : undefined,
      replyToSender: m.replyToSender,
      reactions: m.reactions || {},
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      isEdited: m.isEdited,
    }));

  let payloadObj: Partial<SyncableDatabaseState> = {
    locations: compactLocations,
    emergencyAlerts: compactAlerts,
    messages: compactMessages,
    savedPlaces: (state.savedPlaces || []).slice(-8),
    reminders: (state.reminders || []).slice(-8),
    meetings: (state.meetings || []).slice(-6),
  };

  let str = JSON.stringify(payloadObj);
  if (str.length > 3700) {
    payloadObj = {
      locations: compactLocations,
      emergencyAlerts: compactAlerts,
      messages: compactMessages.slice(-6),
    };
    str = JSON.stringify(payloadObj);
  }
  return str;
}

async function pullFromNtfyTopic(
  topic: string,
  sinceCursor: string,
  targetState: SyncableDatabaseState,
  forceFull: boolean
): Promise<{ updated: boolean; lastId: string }> {
  let updated = false;
  let nextCursor = sinceCursor;
  if (Date.now() < ntfyQuotaCooldownUntil) {
    return { updated: false, lastId: nextCursor };
  }
  try {
    const sinceParam = forceFull || !sinceCursor ? 'all' : sinceCursor;
    const url = `${NTFY_BASE_URL}/${topic}/json?poll=1&since=${encodeURIComponent(sinceParam)}`;
    const res = await nativeAwareFetch(
      url,
      {
        method: 'GET',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
        cache: 'no-store',
      },
      3500
    );
    if (res.status === 429 || res.status === 403) {
      ntfyQuotaCooldownUntil = Date.now() + 15 * 60 * 1000;
      return { updated: false, lastId: nextCursor };
    }
    if (!res.ok) return { updated: false, lastId: nextCursor };
    const text = await res.text();
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      try {
        const evt = JSON.parse(line);
        if (evt?.id) {
          nextCursor = evt.id;
        }
        if (evt?.event === 'message' && typeof evt.message === 'string' && evt.message.startsWith('{')) {
          const parsed = JSON.parse(evt.message);
          if (parsed && typeof parsed === 'object') {
            mergeDatabaseStates(targetState, parsed, false);
            updated = true;
          }
        }
      } catch {
        // ignore malformed line
      }
    }
    cloudConnected = true;
    lastSuccessfulSyncMs = Date.now();
  } catch {
    // ignore network error
  }
  return { updated, lastId: nextCursor };
}

export function startRealtimeCloudRelayStream(
  targetState: SyncableDatabaseState,
  onUpdate?: () => void
): void {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined' || ntfyWsActive) return;
  ntfyWsActive = true;

  const connectStream = () => {
    try {
      const ws = new WebSocket(`${NTFY_BASE_URL.replace('https://', 'wss://')}/${NTFY_CORE_TOPIC},${NTFY_LIVE_TOPIC}/ws`);
      ws.onmessage = (event) => {
        try {
          const evt = JSON.parse(String(event.data || ''));
          if (evt?.id) {
            if (evt.topic === NTFY_CORE_TOPIC) lastNtfyCoreMsgId = evt.id;
            if (evt.topic === NTFY_LIVE_TOPIC) lastNtfyLiveMsgId = evt.id;
          }
          if (evt?.event === 'message' && typeof evt.message === 'string' && evt.message.startsWith('{')) {
            const parsed = JSON.parse(evt.message);
            if (parsed && typeof parsed === 'object') {
              mergeDatabaseStates(targetState, parsed, false);
              cloudConnected = true;
              lastSuccessfulSyncMs = Date.now();
              if (onUpdate) onUpdate();
              notifySyncListeners(targetState);
            }
          }
        } catch {
          // ignore
        }
      };
      ws.onclose = () => {
        setTimeout(connectStream, 5000);
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      };
    } catch {
      setTimeout(connectStream, 8000);
    }
  };

  connectStream();
}

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
    httpStatus: cloudConnected ? 200 : lastFirestoreHttpStatus,
    errorMessage: cloudConnected ? '' : lastFirestoreErrorMsg,
    quotaExceeded: false,
  };
}

export async function verifyCloudFirestoreConnection(): Promise<boolean> {
  // 1. Check authoritative backend sync endpoint first
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
        3500
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

  // 2. Check Cloud Relay (ntfy.sh) which is always available across Android APKs
  if (Date.now() >= ntfyQuotaCooldownUntil) {
    try {
      const relayRes = await nativeAwareFetch(
        `${NTFY_BASE_URL}/${NTFY_CORE_TOPIC}/json?poll=1&since=10m`,
        { method: 'GET', cache: 'no-store' },
        3500
      );
      if (relayRes.status === 429 || relayRes.status === 403) {
        ntfyQuotaCooldownUntil = Date.now() + 15 * 60 * 1000;
      } else if (relayRes.ok) {
        cloudConnected = true;
        lastSuccessfulSyncMs = Date.now();
        lastFirestoreHttpStatus = 200;
        lastFirestoreErrorMsg = '';
        return true;
      }
    } catch {
      // fall through
    }
  }

  // 3. Check Cloud Firestore synchronization bridge if not in daily quota cooldown
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
      4000
    );
    lastFirestoreHttpStatus = res.status;
    if (res.status === 429) {
      firestoreQuotaCooldownUntil = Date.now() + 30 * 60 * 1000;
      return cloudConnected;
    }
    if (res.ok || res.status === 404) {
      cloudConnected = true;
      lastSuccessfulSyncMs = Date.now();
      lastFirestoreErrorMsg = '';
      return true;
    }
    return cloudConnected;
  } catch {
    return cloudConnected;
  }
}

let backendSyncCooldownUntil = 0;

/**
 * Pulls the latest synchronized state from the Production Backend, Real-Time Cloud Relay, and Firestore sync bridge
 */
export async function pullAndMergeCloudState(
  targetState: SyncableDatabaseState,
  force = false,
  silentNotify = false
): Promise<boolean> {
  startRealtimeCloudRelayStream(targetState);

  const now = Date.now();
  if (!force && now - lastPullTime < 650) {
    return false;
  }
  if (inFlightPull) {
    return inFlightPull;
  }

  inFlightPull = (async () => {
    let anyUpdated = false;
    lastPullTime = Date.now();
    try {
      // Run Backend pull, Real-Time Relay pull, and Firestore bridge pull concurrently for sub-second sync
      const backendPullTask = (async () => {
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
                1800
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
                backendSyncCooldownUntil = Date.now() + 60000;
              }
            } catch {
              backendSyncCooldownUntil = Date.now() + 60000;
            }
          }
        }
      })();

      const relayPullTask = (async () => {
        if (
          Date.now() >= ntfyQuotaCooldownUntil &&
          (force || !ntfyWsActive || now - lastNtfyHttpPullMs >= 60000)
        ) {
          lastNtfyHttpPullMs = now;
          const [coreRelay, liveRelay] = await Promise.all([
            pullFromNtfyTopic(NTFY_CORE_TOPIC, lastNtfyCoreMsgId, targetState, force),
            pullFromNtfyTopic(NTFY_LIVE_TOPIC, lastNtfyLiveMsgId, targetState, false),
          ]);
          if (coreRelay.lastId) lastNtfyCoreMsgId = coreRelay.lastId;
          if (liveRelay.lastId) lastNtfyLiveMsgId = liveRelay.lastId;
          if (coreRelay.updated || liveRelay.updated) {
            anyUpdated = true;
          }
        }
      })();

      const firestorePullTask = (async () => {
        if (Date.now() >= firestoreQuotaCooldownUntil && (force || now - lastSuccessfulSyncMs > 15000)) {
          try {
            const res = await nativeAwareFetch(
              FIRESTORE_SYNC_URL,
              {
                method: 'GET',
                headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
                cache: 'no-store',
              },
              2400
            );
            lastFirestoreHttpStatus = res.status;
            if (res.status === 429) {
              firestoreQuotaCooldownUntil = Date.now() + 30 * 60 * 1000;
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
      })();

      await Promise.allSettled([backendPullTask, relayPullTask, firestorePullTask]);

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

    // 1. Push to Real-Time Multi-Device Cloud Relay (ntfy.sh) concurrently so all Android APKs & Web tabs receive updates in <250ms
    const relayTasks: Promise<void>[] = [];
    if (Date.now() >= ntfyQuotaCooldownUntil) {
      const corePayload = buildCompactCorePayload(compactState);
      if (corePayload !== lastPushedCoreSig) {
        relayTasks.push(
          nativeAwareFetch(
            `${NTFY_BASE_URL}/${NTFY_CORE_TOPIC}`,
            {
              method: 'POST',
              body: corePayload,
            },
            2400
          )
            .then((coreRes) => {
              if (coreRes.status === 429 || coreRes.status === 403) {
                ntfyQuotaCooldownUntil = Date.now() + 15 * 60 * 1000;
              } else if (coreRes.ok) {
                lastPushedCoreSig = corePayload;
                cloudConnected = true;
                lastSuccessfulSyncMs = Date.now();
                pushedSuccessfully = true;
              }
            })
            .catch(() => {})
        );
      }

      const livePayload = buildCompactLivePayload(compactState);
      if (livePayload !== lastPushedLiveSig) {
        relayTasks.push(
          nativeAwareFetch(
            `${NTFY_BASE_URL}/${NTFY_LIVE_TOPIC}`,
            {
              method: 'POST',
              body: livePayload,
            },
            2200
          )
            .then((liveRes) => {
              if (liveRes.status === 429 || liveRes.status === 403) {
                ntfyQuotaCooldownUntil = Date.now() + 15 * 60 * 1000;
              } else if (liveRes.ok) {
                lastPushedLiveSig = livePayload;
                cloudConnected = true;
                lastSuccessfulSyncMs = Date.now();
                pushedSuccessfully = true;
              }
            })
            .catch(() => {})
        );
      }
    }

    if (relayTasks.length > 0) {
      await Promise.allSettled(relayTasks);
    }

    const serialized = JSON.stringify(compactState);
    if (serialized.length >= 940000) return;

    // 2. Push to authoritative production backend (/api/sync/state) if running on client/APK and authenticated
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
            2000
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
            backendSyncCooldownUntil = Date.now() + 60000;
          }
        } catch {
          backendSyncCooldownUntil = Date.now() + 60000;
        }
      }
    }

    // 3. Push to Cloud Firestore REST sync bridge (throttled to avoid exhausting daily quota)
    if (
      Date.now() >= firestoreQuotaCooldownUntil &&
      Date.now() - lastFirestorePushMs >= 15000
    ) {
      try {
        lastFirestorePushMs = Date.now();
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
          2600
        );
        lastFirestoreHttpStatus = res.status;
        if (res.status === 429) {
          firestoreQuotaCooldownUntil = Date.now() + 30 * 60 * 1000;
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
      syncLogger.log('firestore', 'warn', 'push_failed', {
        message: err?.message || 'Network error',
      });
    }
  }
}

/**
 * Pushes the merged state to the Production Backend, Real-Time Cloud Relay, and Cloud Firestore synchronization bridge
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
    pushTimeoutId = setTimeout(drainPushQueue, 15);
  } else {
    pushTimeoutId = setTimeout(drainPushQueue, 90);
  }
}

/**
 * Generates a PBKDF2-SHA512 cryptographic password hash (100,000 iterations) using Web Crypto API.
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
