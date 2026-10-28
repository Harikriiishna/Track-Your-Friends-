import firebaseConfig from '../../firebase-applet-config.json';

const FIRESTORE_SYNC_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/beacon_sync/global_state?key=${firebaseConfig.apiKey}`;

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

// Pre-seeded initial user & rooms from the server database so even before the first network packet completes on a fresh APK install, the user's account and rooms exist.
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
    passwordHash:
      '83a49e4c0efe805cc488e1ae5235f9d3f1df27b555e676d2fdc9af69bd38f33639135cc6f0c61244d78469d85cb33e3aed0ec8279dfb9dd76ccf015cd53367de',
    salt: '43a57f595d789793b7e5c0e22b17a618',
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

function mergeArrayById<T extends Record<string, any>>(
  localArr: T[] = [],
  remoteArr: T[] = [],
  idKey = 'id',
  deletedSet?: Set<string>
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
    const existing = map.get(key);
    if (existing) {
      map.set(key, { ...existing, ...item });
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

export function mergeDatabaseStates(
  target: SyncableDatabaseState,
  incoming: Partial<SyncableDatabaseState>,
  preferIncoming = false
): void {
  if (!incoming || typeof incoming !== 'object') return;

  const deletedSet = new Set<string>([
    ...(Array.isArray(target.deletedIds) ? target.deletedIds : []),
    ...(Array.isArray(incoming.deletedIds) ? incoming.deletedIds : []),
  ]);
  target.deletedIds = Array.from(deletedSet).slice(-500);

  // 1. Merge Users (match by id or email)
  if (Array.isArray(incoming.users)) {
    for (const rUser of incoming.users) {
      if (!rUser || (!rUser.id && !rUser.email)) continue;
      const idx = target.users.findIndex(
        (u) =>
          u.id === rUser.id ||
          (u.email && rUser.email && u.email.toLowerCase() === rUser.email.toLowerCase()) ||
          (u.username && rUser.username && u.username.toLowerCase() === rUser.username.toLowerCase())
      );
      if (idx >= 0) {
        const localUser = target.users[idx];
        const merged = preferIncoming
          ? { ...localUser, ...rUser }
          : { ...rUser, ...localUser };
        // Always preserve password credentials from whichever side has them
        if (rUser.password && !merged.password) merged.password = rUser.password;
        if (localUser.password && !merged.password) merged.password = localUser.password;
        if (rUser.passwordHash && !merged.passwordHash) {
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

  // 2. Merge Sessions (by token)
  if (Array.isArray(incoming.sessions)) {
    target.sessions = mergeArrayById(
      preferIncoming ? incoming.sessions : target.sessions,
      preferIncoming ? target.sessions : incoming.sessions,
      'token',
      deletedSet
    ).slice(-100);
  }

  // 3. Merge Rooms (by id)
  if (Array.isArray(incoming.rooms)) {
    target.rooms = mergeArrayById(
      preferIncoming ? incoming.rooms : target.rooms,
      preferIncoming ? target.rooms : incoming.rooms,
      'id',
      deletedSet
    );
  }

  // 4. Merge Room Members (by roomId + userId)
  if (Array.isArray(incoming.roomMembers)) {
    const memberMap = new Map<string, any>();
    for (const m of [...(incoming.roomMembers || []), ...(target.roomMembers || [])]) {
      if (!m || !m.roomId || !m.userId) continue;
      if (deletedSet.has(m.roomId)) continue;
      memberMap.set(`${m.roomId}_${m.userId}`, m);
    }
    target.roomMembers = Array.from(memberMap.values());
  }

  // 5. Merge Live Locations (always keep newer timestamp per userId)
  if (incoming.locations && typeof incoming.locations === 'object') {
    if (!target.locations) target.locations = {};
    for (const [uid, rLoc] of Object.entries(incoming.locations)) {
      if (!rLoc || typeof rLoc.latitude !== 'number' || typeof rLoc.longitude !== 'number') continue;
      const lLoc = target.locations[uid];
      if (!lLoc) {
        target.locations[uid] = rLoc;
      } else {
        const rTime = new Date(rLoc.updated_at || rLoc.timestamp || 0).getTime();
        const lTime = new Date(lLoc.updated_at || lLoc.timestamp || 0).getTime();
        if (rTime >= lTime) {
          target.locations[uid] = rLoc;
        }
      }
    }
  }

  // 6. Merge Saved Places (Wishlist)
  if (Array.isArray(incoming.savedPlaces)) {
    target.savedPlaces = mergeArrayById(
      preferIncoming ? incoming.savedPlaces : target.savedPlaces,
      preferIncoming ? target.savedPlaces : incoming.savedPlaces,
      'id',
      deletedSet
    );
  }

  // 7. Merge Chat Messages (chronological)
  if (Array.isArray(incoming.messages)) {
    const mergedMsgs = mergeArrayById(
      preferIncoming ? incoming.messages : target.messages,
      preferIncoming ? target.messages : incoming.messages,
      'id',
      deletedSet
    );
    mergedMsgs.sort(
      (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
    );
    target.messages = mergedMsgs.slice(-300);
  }

  // 8. Merge Reminders & Meetings
  if (Array.isArray(incoming.reminders)) {
    target.reminders = mergeArrayById(
      preferIncoming ? incoming.reminders : target.reminders,
      preferIncoming ? target.reminders : incoming.reminders,
      'id',
      deletedSet
    );
  }
  if (Array.isArray(incoming.meetings)) {
    target.meetings = mergeArrayById(
      preferIncoming ? incoming.meetings : target.meetings,
      preferIncoming ? target.meetings : incoming.meetings,
      'id',
      deletedSet
    );
  }

  // 9. Merge Emergency Alerts (respect resolved status & acknowledgements)
  if (Array.isArray(incoming.emergencyAlerts)) {
    const alertMap = new Map<string, any>();
    for (const a of [...(incoming.emergencyAlerts || []), ...(target.emergencyAlerts || [])]) {
      if (!a || !a.id || deletedSet.has(a.id)) continue;
      const existing = alertMap.get(a.id);
      if (!existing) {
        alertMap.set(a.id, { ...a });
      } else {
        const ackSet = new Set<string>([
          ...(Array.isArray(existing.acknowledgedBy) ? existing.acknowledgedBy : []),
          ...(Array.isArray(a.acknowledgedBy) ? a.acknowledgedBy : []),
        ]);
        const isResolved = existing.status === 'resolved' || a.status === 'resolved';
        alertMap.set(a.id, {
          ...existing,
          ...a,
          status: isResolved ? 'resolved' : 'active',
          acknowledgedBy: Array.from(ackSet),
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
      preferIncoming ? incoming.locationShareRequests : target.locationShareRequests,
      preferIncoming ? target.locationShareRequests : incoming.locationShareRequests,
      'id',
      deletedSet
    ).slice(0, 100);
  }

  // 11. Merge Location History
  if (Array.isArray(incoming.locationHistory)) {
    const hist = mergeArrayById(
      target.locationHistory || [],
      incoming.locationHistory || [],
      'id',
      deletedSet
    );
    hist.sort(
      (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
    );
    target.locationHistory = hist.slice(-200);
  }
}

let lastPullTime = 0;
let inFlightPull: Promise<boolean> | null = null;
let pushTimeoutId: any = null;

/**
 * Pulls the latest synchronized state from Cloud Firestore and merges it into `targetState`
 */
export async function pullAndMergeCloudState(
  targetState: SyncableDatabaseState,
  force = false
): Promise<boolean> {
  const now = Date.now();
  if (!force && now - lastPullTime < 2000) {
    return false;
  }
  if (inFlightPull) {
    return inFlightPull;
  }

  inFlightPull = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(FIRESTORE_SYNC_URL, {
        method: 'GET',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) return false;
      const doc = await res.json();
      const rawPayload = doc?.fields?.payload?.stringValue;
      if (!rawPayload || typeof rawPayload !== 'string') return false;

      const remoteState = JSON.parse(rawPayload) as Partial<SyncableDatabaseState>;
      mergeDatabaseStates(targetState, remoteState, true);
      lastPullTime = Date.now();
      return true;
    } catch {
      return false;
    } finally {
      inFlightPull = null;
    }
  })();

  return inFlightPull;
}

/**
 * Pushes the merged state to Cloud Firestore (debounced so rapid mutations coalesce cleanly)
 */
export function schedulePushCloudState(
  localState: SyncableDatabaseState,
  immediate = false
): void {
  if (pushTimeoutId) {
    clearTimeout(pushTimeoutId);
    pushTimeoutId = null;
  }

  const executePush = async () => {
    try {
      // First pull and merge so we never overwrite another device's concurrent updates
      await pullAndMergeCloudState(localState, true);

      // Trim history arrays so Firestore document stays well under 900KB
      const compactState: SyncableDatabaseState = {
        ...localState,
        messages: (localState.messages || []).slice(-250),
        locationHistory: (localState.locationHistory || []).slice(-180),
        auditLogs: (localState.auditLogs || []).slice(-80),
        sessions: (localState.sessions || []).slice(-80),
        deletedIds: (localState.deletedIds || []).slice(-400),
      };

      const serialized = JSON.stringify(compactState);
      if (serialized.length >= 940000) return;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      await fetch(FIRESTORE_SYNC_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            payload: { stringValue: serialized },
            updatedAt: { stringValue: new Date().toISOString() },
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch {
      // ignore offline or transient errors
    }
  };

  if (immediate) {
    void executePush();
  } else {
    pushTimeoutId = setTimeout(executePush, 350);
  }
}

/**
 * Verifies a password against both plaintext (`password`) and PBKDF2-SHA512 (`passwordHash` + `salt`)
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
      const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(cleanPass),
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
    } catch {
      // ignore subtle crypto error
    }
  }

  return false;
}
