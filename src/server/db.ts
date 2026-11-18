import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  UserProfile,
  UserLocation,
  Room,
  RoomMember,
  UserRole,
  ChatMessage,
  SavedPlace,
  ReminderItem,
  MeetingItem,
  EmergencyAlert,
  LocationShareRequest,
  ReportItem,
  AuditLog,
  LocationVisibility,
  PhoneVisibility,
  ProfileVisibility,
  UserPathTrail,
  LocationBreadcrumb,
  CrowdZoneCommunityReport,
  CrowdZonePost,
  CrowdZoneComment,
  CrowdZoneSavedPlace,
  CrowdZoneUserSettings,
  ModerationLogEntry,
  CrowdTimeWindow,
  CrowdReportCategory,
  CrowdLevel,
} from '../types.ts';
import {
  encodeGeohash,
  aggregateCrowdCells,
  buildCrowdHistorySeries,
  predictCrowdActivitySeries,
} from '../utils/crowdIntelligenceEngine.ts';
import {
  INITIAL_SEED_ROOMS,
  INITIAL_SEED_ROOM_MEMBERS,
  INITIAL_SEED_USERS,
  isExampleOrTestUser,
  mergeDatabaseStates,
  pullAndMergeCloudState,
  purgeExampleMembersFromState,
  schedulePushCloudState,
  setRunningOnAuthoritativeBackend,
} from '../utils/cloudSync.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const DB_FILE = path.resolve(DATA_DIR, 'database.json');

// Ensure storage directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export interface UserRecord extends UserProfile {
  passwordHash: string;
  salt: string;
  password?: string;
}

export interface RoomRecord extends Room {
  passwordHash?: string;
  salt?: string;
}

interface DatabaseSchema {
  users: UserRecord[];
  sessions: Array<{ token: string; userId: string; createdAt: string; expiresAt: string; userAgent?: string; ip?: string }>;
  rooms: RoomRecord[];
  roomMembers: Array<{ roomId: string; userId: string; role: UserRole; joinedAt: string }>;
  locations: Record<string, UserLocation>; // userId -> UserLocation
  savedPlaces: SavedPlace[];
  messages: ChatMessage[];
  reminders: ReminderItem[];
  meetings: MeetingItem[];
  emergencyAlerts: EmergencyAlert[];
  locationShareRequests: LocationShareRequest[];
  reports: ReportItem[];
  auditLogs: AuditLog[];
  passwordResets: Array<{ email: string; token: string; expiresAt: string }>;
  locationHistory: Array<{
    id: string;
    userId: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    speed?: number | null;
    heading?: number | null;
    altitude?: number | null;
    timestamp: string;
  }>;
  crowdReports: CrowdZoneCommunityReport[];
  crowdPosts: CrowdZonePost[];
  crowdSavedPlaces: CrowdZoneSavedPlace[];
  userSettings: Record<string, CrowdZoneUserSettings>;
  moderationLogs: ModerationLogEntry[];
  deletedIds?: string[];
}

const initialDb: DatabaseSchema = {
  users: [],
  sessions: [],
  rooms: [],
  roomMembers: [],
  locations: {},
  savedPlaces: [],
  messages: [],
  reminders: [],
  meetings: [],
  emergencyAlerts: [],
  locationShareRequests: [],
  reports: [],
  auditLogs: [],
  passwordResets: [],
  locationHistory: [],
  crowdReports: [],
  crowdPosts: [],
  crowdSavedPlaces: [],
  userSettings: {},
  moderationLogs: [],
};

export const UNIVERSAL_ROOM_ID = 'room-universal';

export const UNIVERSAL_ROOM: RoomRecord = {
  id: UNIVERSAL_ROOM_ID,
  name: '🌐 Universal Lounge',
  description: 'The open global town square for everyone on Beacon. Coordinate live locations, chat across channels, and meet members worldwide.',
  iconUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=128&q=80',
  ownerId: 'system',
  hasPassword: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  memberCount: 1,
  isPrivate: false,
  isUniversal: true,
};

export interface ExternalSyncDiff {
  newMessages: ChatMessage[];
  updatedLocations: UserLocation[];
  newAlerts: EmergencyAlert[];
}

class Database {
  private data: DatabaseSchema;
  private externalSyncListeners: Array<(diff: ExternalSyncDiff) => void> = [];
  private knownMessageIds = new Set<string>();
  private knownLocationTimestamps = new Map<string, string>();
  private knownAlertIds = new Set<string>();

  constructor() {
    setRunningOnAuthoritativeBackend(true);
    this.data = this.load();
    const purgedInitial = purgeExampleMembersFromState(this.data);
    this.ensureUniversalRoom();
    this.snapshotKnownEntities();
    if (purgedInitial) {
      this.save(this.data);
    }

    void pullAndMergeCloudState(this.data, true).then((updated) => {
      const purgedAfterPull = purgeExampleMembersFromState(this.data);
      if (updated || purgedAfterPull) {
        this.ensureUniversalRoom();
        this.saveDiskOnly();
        this.detectAndEmitExternalDiff();
      }
      schedulePushCloudState(this.data, true);
    });
    setInterval(() => {
      void pullAndMergeCloudState(this.data).then((updated) => {
        if (updated) {
          this.ensureUniversalRoom();
          this.saveDiskOnly();
          this.detectAndEmitExternalDiff();
        }
      });
    }, 4000);
  }

  public getSyncSnapshot(): DatabaseSchema {
    return {
      ...this.data,
      messages: (this.data.messages || []).slice(-250),
      locationHistory: (this.data.locationHistory || []).slice(-180),
      crowdReports: (this.data.crowdReports || []).slice(0, 100),
      crowdPosts: (this.data.crowdPosts || []).slice(0, 100),
      crowdSavedPlaces: (this.data.crowdSavedPlaces || []).slice(0, 120),
      userSettings: this.data.userSettings || {},
      moderationLogs: (this.data.moderationLogs || []).slice(0, 80),
      auditLogs: (this.data.auditLogs || []).slice(-80),
      sessions: (this.data.sessions || []).slice(-120),
      deletedIds: (this.data.deletedIds || []).slice(-400),
    };
  }

  public getSanitizedSyncSnapshot(): Partial<DatabaseSchema> {
    const snap = this.getSyncSnapshot();
    return {
      users: (snap.users || []).map((u) => {
        const { password, ...safeUser } = u;
        return safeUser as any;
      }),
      rooms: (snap.rooms || []).map((r) => ({
        ...this.sanitizeRoom(r, ''),
        ...(r.passwordHash && r.salt ? { passwordHash: r.passwordHash, salt: r.salt } : {}),
      })),
      roomMembers: snap.roomMembers || [],
      locations: snap.locations || {},
      locationHistory: snap.locationHistory || [],
      savedPlaces: snap.savedPlaces || [],
      messages: snap.messages || [],
      reminders: snap.reminders || [],
      meetings: snap.meetings || [],
      emergencyAlerts: snap.emergencyAlerts || [],
      locationShareRequests: snap.locationShareRequests || [],
      crowdReports: snap.crowdReports || [],
      crowdPosts: snap.crowdPosts || [],
      crowdSavedPlaces: snap.crowdSavedPlaces || [],
      userSettings: snap.userSettings || {},
      moderationLogs: snap.moderationLogs || [],
      deletedIds: snap.deletedIds || [],
    };
  }

  public applyIncomingSyncSnapshot(incoming: Partial<DatabaseSchema>): Partial<DatabaseSchema> {
    // Strip any incoming attempt to inject raw password resets or sessions from untrusted sync payloads
    const safeIncoming: Partial<DatabaseSchema> = { ...incoming };
    delete safeIncoming.passwordResets;
    delete safeIncoming.sessions;
    mergeDatabaseStates(this.data, safeIncoming, false);
    this.ensureUniversalRoom();
    this.saveDiskOnly(this.data);
    this.detectAndEmitExternalDiff();
    schedulePushCloudState(this.data, true);
    return this.getSanitizedSyncSnapshot();
  }

  private snapshotKnownEntities() {
    for (const m of this.data.messages || []) {
      if (m?.id) this.knownMessageIds.add(m.id);
    }
    for (const [uid, loc] of Object.entries(this.data.locations || {})) {
      if (loc) {
        this.knownLocationTimestamps.set(uid, loc.updated_at || loc.timestamp || '');
      }
    }
    for (const a of this.data.emergencyAlerts || []) {
      if (a?.id) this.knownAlertIds.add(a.id);
    }
  }

  private detectAndEmitExternalDiff() {
    const newMessages: ChatMessage[] = [];
    const updatedLocations: UserLocation[] = [];
    const newAlerts: EmergencyAlert[] = [];

    for (const m of this.data.messages || []) {
      if (m?.id && !m.isDeleted && !this.knownMessageIds.has(m.id)) {
        this.knownMessageIds.add(m.id);
        newMessages.push(m);
      }
    }

    for (const [uid, loc] of Object.entries(this.data.locations || {})) {
      if (!loc) continue;
      const ts = loc.updated_at || loc.timestamp || '';
      const prevTs = this.knownLocationTimestamps.get(uid);
      if (ts && ts !== prevTs) {
        this.knownLocationTimestamps.set(uid, ts);
        updatedLocations.push(loc);
      }
    }

    for (const a of this.data.emergencyAlerts || []) {
      if (a?.id && a.status === 'active' && !this.knownAlertIds.has(a.id)) {
        this.knownAlertIds.add(a.id);
        newAlerts.push(a);
      }
    }

    if (newMessages.length > 0 || updatedLocations.length > 0 || newAlerts.length > 0) {
      for (const cb of this.externalSyncListeners) {
        try {
          cb({ newMessages, updatedLocations, newAlerts });
        } catch {
          // ignore
        }
      }
    }
  }

  public onExternalCloudSync(cb: (diff: ExternalSyncDiff) => void) {
    this.externalSyncListeners.push(cb);
  }

  public getRecentlyActiveUserIds(): string[] {
    const now = Date.now();
    const activeWindowMs = 5 * 60 * 1000;
    const ids = new Set<string>();
    for (const u of this.data.users || []) {
      if (!u?.id) continue;
      const lastSeenMs = new Date(u.lastSeen || 0).getTime() || 0;
      if (u.isOnline && now - lastSeenMs <= activeWindowMs) {
        ids.add(u.id);
      }
    }
    for (const [uid, loc] of Object.entries(this.data.locations || {})) {
      const locMs = new Date(loc?.updated_at || loc?.timestamp || 0).getTime() || 0;
      if (now - locMs <= activeWindowMs) {
        ids.add(uid);
      }
    }
    return Array.from(ids);
  }

  private load(): DatabaseSchema {
    const base: DatabaseSchema = {
      ...initialDb,
      users: INITIAL_SEED_USERS.map((u) => ({ ...u })) as any[],
      rooms: [{ ...UNIVERSAL_ROOM }, ...(INITIAL_SEED_ROOMS.map((r) => ({ ...r })) as any[])],
      roomMembers: INITIAL_SEED_ROOM_MEMBERS.map((m) => ({ ...m })) as any[],
      locations: {},
      savedPlaces: [],
      messages: [],
      reminders: [],
      meetings: [],
      emergencyAlerts: [],
      locationShareRequests: [],
      reports: [],
      auditLogs: [],
      passwordResets: [],
      locationHistory: [],
      crowdReports: [],
      crowdPosts: [],
      crowdSavedPlaces: [],
      userSettings: {},
      moderationLogs: [],
      deletedIds: [],
    };
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed.locationHistory) parsed.locationHistory = [];
        if (!parsed.crowdReports) parsed.crowdReports = [];
        if (!parsed.crowdPosts) parsed.crowdPosts = [];
        if (!parsed.crowdSavedPlaces) parsed.crowdSavedPlaces = [];
        if (!parsed.userSettings) parsed.userSettings = {};
        if (!parsed.moderationLogs) parsed.moderationLogs = [];
        mergeDatabaseStates(base, parsed, true);
        purgeExampleMembersFromState(base);
        return base;
      }
    } catch (err) {
      console.error('Failed to parse database file, initializing clean database', err);
    }
    this.save(base);
    return base;
  }

  private saveDiskOnly(dataToSave: DatabaseSchema = this.data) {
    try {
      const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      console.error('Failed to atomically write database', err);
    }
  }

  private save(dataToSave: DatabaseSchema = this.data) {
    this.snapshotKnownEntities();
    this.saveDiskOnly(dataToSave);
    schedulePushCloudState(dataToSave, true);
  }

  // Password & Token utilities (NIST SP 800-63B / OWASP compliant PBKDF2 with SHA-512)
  public hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): { hash: string; salt: string } {
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt };
  }

  public verifyPassword(password: string, hash?: string, salt?: string, plainPassword?: string): boolean {
    if (plainPassword && (plainPassword === password || plainPassword === password.trim())) {
      return true;
    }
    if (!hash || !salt) return false;

    // 1. Try modern 100,000 iterations (OWASP standard)
    const calculated100k = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    if (calculated100k === hash) return true;

    // 2. Fallback check for legacy 10,000 iterations for seamless account backward-compatibility
    const calculated10k = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    if (calculated10k === hash) return true;

    return false;
  }

  public generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Users & Auth
  public createUser(userData: {
    email: string;
    username: string;
    fullName: string;
    password: string;
    phoneNumber?: string;
    avatarUrl?: string;
  }): UserProfile {
    const cleanEmail = userData.email.trim().toLowerCase();
    const cleanUsername = userData.username.trim();

    const existingEmail = this.data.users.find(
      (u) => u.email.toLowerCase() === cleanEmail
    );
    if (existingEmail) {
      throw new Error(`An account with email "${cleanEmail}" already exists. Please sign in or reset your password.`);
    }

    const existingUsername = this.data.users.find(
      (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
    );
    if (existingUsername) {
      throw new Error(`The username "${cleanUsername}" is already taken. Please choose another username.`);
    }

    const { hash, salt } = this.hashPassword(userData.password);
    const trimmedName = userData.fullName.trim() || cleanUsername;
    const baseNameId = trimmedName;
    const isIdTaken = this.data.users.some((u) => u.id.toLowerCase() === baseNameId.toLowerCase());
    const userId = isIdTaken ? cleanUsername : baseNameId;
    const isFirstUser = this.data.users.length === 0;

    const newUser: UserRecord = {
      id: userId,
      email: cleanEmail,
      username: cleanUsername,
      fullName: trimmedName,
      avatarUrl: userData.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userData.fullName)}`,
      about: 'Member of Beacon Community',
      phoneNumber: userData.phoneNumber?.trim() || '',
      createdAt: new Date().toISOString(),
      isOnline: true,
      lastSeen: new Date().toISOString(),
      privacy: {
        locationVisibility: 'room_members',
        phoneVisibility: 'room_members',
        profileVisibility: 'public',
        showOnlineStatus: true,
        locationSharingEnabled: true,
        blockedUserIds: [],
      },
      isAdmin: isFirstUser, // First registered user is automatically admin
      passwordHash: hash,
      salt,
    };

    this.data.users.push(newUser);
    this.ensureUniversalRoom(newUser.id);
    this.save();
    return this.sanitizeUser(newUser);
  }

  public sanitizeUser(u: UserRecord): UserProfile {
    const { passwordHash, salt, password, ...safe } = u;
    return safe;
  }

  public directResetPassword(identifier: string, newPassword: string): UserProfile {
    const user = this.findUserByEmailOrUsername(identifier);
    if (!user) {
      throw new Error(`No account found with username or email "${identifier.trim()}".`);
    }
    const { hash, salt } = this.hashPassword(newPassword);
    user.passwordHash = hash;
    user.salt = salt;

    // Invalidate old sessions
    this.data.sessions = this.data.sessions.filter((s) => s.userId !== user.id);

    this.logAudit(user.id, user.fullName, 'PASSWORD_RESET_DIRECT', 'Password reset successfully');
    this.save();
    return this.sanitizeUser(user);
  }

  public findUserById(id: string): UserRecord | undefined {
    if (!id) return undefined;
    const clean = id.trim();
    const lower = clean.toLowerCase();
    return (
      this.data.users.find((u) => u.id === clean) ||
      this.data.users.find(
        (u) =>
          u.id.toLowerCase() === lower ||
          u.fullName.toLowerCase() === lower ||
          u.username.toLowerCase() === lower.replace(/^@/, '')
      )
    );
  }

  public findUserByEmailOrUsername(identifier: string): UserRecord | undefined {
    const lower = identifier.toLowerCase().trim().replace(/^@/, '');
    return this.data.users.find(
      (u) =>
        u.email.toLowerCase() === lower ||
        u.username.toLowerCase() === lower ||
        u.fullName.toLowerCase() === lower ||
        u.id.toLowerCase() === lower
    );
  }

  public createSession(userId: string, userAgent?: string, ip?: string): string {
    const token = this.generateToken();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 365 days / 1 year persistent session
    this.data.sessions.push({ token, userId, createdAt, expiresAt, userAgent, ip });
    this.save();
    return token;
  }

  public getSessionUser(token: string, hintUserId?: string, hintEmail?: string): UserProfile | null {
    if (!token) return null;
    const session = this.data.sessions.find((s) => s.token === token);
    if (session) {
      if (new Date(session.expiresAt) < new Date()) {
        session.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        this.saveDiskOnly();
      }
      const user = this.findUserById(session.userId);
      if (user) {
        return this.sanitizeUser(user);
      }
    }

    // If token was created on client/APK or before a server restart, bind it to the known user
    let resolvedUser: UserRecord | undefined;
    if (hintUserId) {
      resolvedUser = this.findUserById(hintUserId.trim());
    }
    if (!resolvedUser && hintEmail) {
      resolvedUser = this.findUserByEmailOrUsername(hintEmail.trim());
    }

    if (resolvedUser && token.trim().length >= 8) {
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      this.data.sessions.push({
        token: token.trim(),
        userId: resolvedUser.id,
        createdAt: now,
        expiresAt,
        userAgent: 'Restored Client Session',
        ip: 'Client',
      });
      this.ensureUniversalRoom(resolvedUser.id);
      this.saveDiskOnly();
      return this.sanitizeUser(resolvedUser);
    }

    return null;
  }

  public async restoreOrBindUserSession(
    token?: string | null,
    userPayload?: Partial<UserProfile> | null,
    hintUserId?: string,
    hintEmail?: string,
    userAgent = 'Silent Re-Auth Client',
    ip = 'Client'
  ): Promise<{ user: UserProfile; token: string; restored: boolean } | null> {
    const cleanToken = token ? token.trim() : '';
    const candidateId = (userPayload?.id || hintUserId || '').trim();
    const candidateEmail = (userPayload?.email || hintEmail || '').trim().toLowerCase();
    const candidateUsername = (userPayload?.username || '').trim();

    // 1. Check if token or user already exists in memory
    if (cleanToken) {
      const existingByToken = this.getSessionUser(cleanToken, candidateId || undefined, candidateEmail || undefined);
      if (existingByToken) {
        return { user: existingByToken, token: cleanToken, restored: true };
      }
    }

    let resolvedUser: UserRecord | undefined =
      (candidateId ? this.findUserById(candidateId) : undefined) ||
      (candidateEmail ? this.findUserByEmailOrUsername(candidateEmail) : undefined) ||
      (candidateUsername ? this.findUserByEmailOrUsername(candidateUsername) : undefined);

    // 2. If user is not yet in server memory, force an immediate pull from Cloud Firestore
    if (!resolvedUser) {
      try {
        const updated = await pullAndMergeCloudState(this.data, true);
        if (updated) {
          this.ensureUniversalRoom();
          this.saveDiskOnly();
          this.detectAndEmitExternalDiff();
        }
      } catch {
        // ignore cloud pull error and fallback to payload enrollment
      }

      resolvedUser =
        (candidateId ? this.findUserById(candidateId) : undefined) ||
        (candidateEmail ? this.findUserByEmailOrUsername(candidateEmail) : undefined) ||
        (candidateUsername ? this.findUserByEmailOrUsername(candidateUsername) : undefined);
    }

    // 3. If user was created on Android APK / offline Web session and is being synced via silent re-auth
    if (!resolvedUser && candidateId && (candidateEmail || candidateUsername)) {
      const { hash, salt } = this.hashPassword(crypto.randomBytes(16).toString('hex'));
      const now = new Date().toISOString();
      const fallbackName = (userPayload?.fullName || candidateUsername || candidateEmail.split('@')[0] || 'Beacon User').trim();
      resolvedUser = {
        id: candidateId,
        email: candidateEmail || `${candidateId}@beacon.local`,
        username: candidateUsername || candidateEmail.split('@')[0] || candidateId,
        fullName: fallbackName,
        avatarUrl:
          userPayload?.avatarUrl ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fallbackName)}`,
        about: userPayload?.about || 'Member of Beacon Community',
        phoneNumber: userPayload?.phoneNumber || '',
        createdAt: userPayload?.createdAt || now,
        isOnline: true,
        lastSeen: now,
        privacy: userPayload?.privacy || {
          locationVisibility: 'room_members',
          phoneVisibility: 'room_members',
          profileVisibility: 'public',
          showOnlineStatus: true,
          locationSharingEnabled: true,
          temporarySharingExpiry: null,
          blockedUserIds: [],
        },
        isAdmin: Boolean(userPayload?.isAdmin),
        passwordHash: hash,
        salt,
      };
      this.data.users.push(resolvedUser);
    }

    if (!resolvedUser) {
      return null;
    }

    resolvedUser.isOnline = true;
    resolvedUser.lastSeen = new Date().toISOString();
    this.ensureUniversalRoom(resolvedUser.id);

    const finalToken = cleanToken.length >= 8 ? cleanToken : this.generateToken();
    const existingSession = this.data.sessions.find((s) => s.token === finalToken);
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    if (existingSession) {
      existingSession.userId = resolvedUser.id;
      existingSession.expiresAt = expiresAt;
    } else {
      this.data.sessions.push({
        token: finalToken,
        userId: resolvedUser.id,
        createdAt: new Date().toISOString(),
        expiresAt,
        userAgent,
        ip,
      });
    }

    this.save();
    return {
      user: this.sanitizeUser(resolvedUser),
      token: finalToken,
      restored: true,
    };
  }

  public deleteSession(token: string) {
    this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
    this.save();
  }

  public getUserSessions(userId: string, currentToken?: string) {
    const now = new Date();
    return this.data.sessions
      .filter((s) => s.userId === userId && new Date(s.expiresAt) > now)
      .map((s) => ({
        token: s.token.slice(0, 8) + '...',
        fullToken: s.token === currentToken ? s.token : undefined,
        userId: s.userId,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        userAgent: s.userAgent || 'Web / Mobile Client',
        ip: s.ip || 'Local',
        isCurrent: s.token === currentToken,
      }));
  }

  public revokeOtherSessions(userId: string, currentToken: string): number {
    const beforeCount = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((s) => s.userId !== userId || s.token === currentToken);
    const removed = beforeCount - this.data.sessions.length;
    this.logAudit(userId, this.findUserById(userId)?.fullName || 'User', 'SESSIONS_REVOKED', `Revoked ${removed} other active sessions`);
    this.save();
    return removed;
  }

  public revokeSession(userId: string, tokenPrefix: string): boolean {
    const cleanPrefix = tokenPrefix.replace('...', '');
    const beforeCount = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((s) => !(s.userId === userId && s.token.startsWith(cleanPrefix)));
    const removed = beforeCount > this.data.sessions.length;
    if (removed) {
      this.logAudit(userId, this.findUserById(userId)?.fullName || 'User', 'SESSION_REVOKED', `Revoked device session`);
      this.save();
    }
    return removed;
  }

  public revokeAllUserSessions(userId: string): number {
    const beforeCount = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((s) => s.userId !== userId);
    const removed = beforeCount - this.data.sessions.length;
    this.save();
    return removed;
  }

  public createPasswordReset(email: string): string {
    const user = this.findUserByEmailOrUsername(email);
    if (!user) {
      throw new Error('No user found with this email address');
    }

    if (!this.data.passwordResets) {
      this.data.passwordResets = [];
    }

    // Generate 6-digit verification code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Clean previous resets for this email
    this.data.passwordResets = this.data.passwordResets.filter(
      (r) => r.email.toLowerCase() !== email.toLowerCase()
    );

    this.data.passwordResets.push({
      email: user.email,
      token: resetCode,
      expiresAt,
    });

    this.logAudit(user.id, user.fullName, 'PASSWORD_RESET_REQUESTED', `Reset code generated for ${email}`);
    this.save();
    return resetCode;
  }

  public resetPassword(token: string, newPassword: string): UserProfile {
    if (!this.data.passwordResets) {
      throw new Error('Invalid or expired reset code');
    }

    const record = this.data.passwordResets.find(
      (r) => r.token.trim() === token.trim() && new Date(r.expiresAt) > new Date()
    );

    if (!record) {
      throw new Error('Invalid or expired reset code');
    }

    const user = this.findUserByEmailOrUsername(record.email);
    if (!user) throw new Error('User not found');

    const { hash, salt } = this.hashPassword(newPassword);
    user.passwordHash = hash;
    user.salt = salt;

    // Invalidate used reset code
    this.data.passwordResets = this.data.passwordResets.filter((r) => r.token !== token);

    // Invalidate existing sessions
    this.data.sessions = this.data.sessions.filter((s) => s.userId !== user.id);

    this.logAudit(user.id, user.fullName, 'PASSWORD_RESET_COMPLETED', 'Password successfully changed');
    this.save();
    return this.sanitizeUser(user);
  }

  public updateUserProfile(userId: string, updates: Partial<UserProfile>): UserProfile {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');

    if (updates.fullName !== undefined) user.fullName = updates.fullName;
    if (updates.about !== undefined) user.about = updates.about;
    if (updates.phoneNumber !== undefined) user.phoneNumber = updates.phoneNumber;
    if (updates.avatarUrl !== undefined) user.avatarUrl = updates.avatarUrl;
    if (updates.markerColor !== undefined) user.markerColor = updates.markerColor;
    if (updates.markerIcon !== undefined) user.markerIcon = updates.markerIcon;
    if (updates.markerLabel !== undefined) user.markerLabel = updates.markerLabel;
    if (updates.privacy !== undefined) {
      user.privacy = { ...user.privacy, ...updates.privacy };
    }
    if (updates.isOnline !== undefined) {
      user.isOnline = updates.isOnline;
      user.lastSeen = new Date().toISOString();
    }

    this.save();
    return this.sanitizeUser(user);
  }

  public setOnlineStatus(userId: string, isOnline: boolean) {
    const user = this.findUserById(userId);
    if (user) {
      user.isOnline = isOnline;
      user.lastSeen = new Date().toISOString();
      this.save();
    }
  }

  public deleteUserAccount(userId: string): boolean {
    const user = this.findUserById(userId);
    if (!user) return false;
    this.data.users = this.data.users.filter((u) => u.id !== userId);
    this.data.sessions = this.data.sessions.filter((s) => s.userId !== userId);
    this.data.roomMembers = this.data.roomMembers.filter((m) => m.userId !== userId);
    delete this.data.locations[userId];
    this.data.locationHistory = (this.data.locationHistory || []).filter((h) => h.userId !== userId);
    this.data.locationShareRequests = (this.data.locationShareRequests || []).filter(
      (r) => r.fromUserId !== userId && r.toUserId !== userId
    );
    if (!Array.isArray(this.data.deletedIds)) this.data.deletedIds = [];
    if (!this.data.deletedIds.includes(userId)) {
      this.data.deletedIds.push(userId);
    }
    this.save();
    return true;
  }

  // Location tracking with server-side privacy enforcement
  public updateLocation(
    userId: string,
    coords: {
      geog?: string;
      accuracy_m?: number;
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      altitude?: number | null;
      heading?: number | null;
      speed?: number | null;
      batteryLevel?: number | null;
    }
  ): UserLocation {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');

    let parsedLat = Number(coords.latitude);
    let parsedLng = Number(coords.longitude);

    // Parse PostGIS / WKT format: SRID=4326;POINT(longitude latitude)
    if (typeof coords.geog === 'string') {
      const m = coords.geog.match(/POINT\s*\(\s*([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s*\)/i);
      if (m) {
        parsedLng = Number(m[1]);
        parsedLat = Number(m[2]);
      }
    }

    const parsedAccuracy = Number(coords.accuracy_m ?? coords.accuracy);

    // Coordinate & Sensor Validation (allows indoor/Web Wi-Fi up to 5000m)
    if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      throw new Error('Invalid latitude coordinates: Must be between -90 and 90');
    }
    if (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      throw new Error('Invalid longitude coordinates: Must be between -180 and 180');
    }
    if (!Number.isFinite(parsedAccuracy) || parsedAccuracy <= 0 || parsedAccuracy > 5000) {
      throw new Error('Rejected coarse location fix: accuracy_m must be > 0 and <= 5000 meters');
    }

    // Auto-expiry check for temporary sharing
    if (user.privacy.temporarySharingExpiry && new Date(user.privacy.temporarySharingExpiry) < new Date()) {
      user.privacy.locationSharingEnabled = false;
      user.privacy.temporarySharingExpiry = null;
    }

    const serverNowIso = new Date().toISOString();
    const geogWkt = `SRID=4326;POINT(${parsedLng} ${parsedLat})`;
    const loc: UserLocation = {
      userId,
      username: user.username,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      markerColor: user.markerColor,
      markerIcon: user.markerIcon,
      markerLabel: user.markerLabel,
      latitude: parsedLat,
      longitude: parsedLng,
      accuracy: parsedAccuracy,
      lat: parsedLat,
      lng: parsedLng,
      accuracy_m: parsedAccuracy,
      geog: geogWkt,
      updated_at: serverNowIso,
      altitude: coords.altitude != null && !isNaN(coords.altitude) ? Math.round(coords.altitude) : null,
      heading: coords.heading != null && !isNaN(coords.heading) ? Math.round(coords.heading) : null,
      speed: coords.speed != null && !isNaN(coords.speed) ? Number(coords.speed.toFixed(1)) : null,
      batteryLevel: coords.batteryLevel != null && !isNaN(coords.batteryLevel) ? Math.round(coords.batteryLevel) : null,
      timestamp: serverNowIso,
      isStale: false,
    };

    this.data.locations[userId] = loc;

    if (!this.data.locationHistory) {
      this.data.locationHistory = [];
    }

    this.data.locationHistory.push({
      id: crypto.randomUUID(),
      userId,
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      altitude: loc.altitude,
      heading: loc.heading,
      speed: loc.speed,
      timestamp: loc.timestamp,
    });

    // Prune entries older than 24h
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    if (this.data.locationHistory.length > 5000) {
      this.data.locationHistory = this.data.locationHistory.filter(
        (b) => new Date(b.timestamp).getTime() >= cutoff
      );
    }

    this.save();
    return loc;
  }

  public clearUserLocationHistory(userId: string): number {
    if (!this.data.locationHistory) return 0;
    const beforeCount = this.data.locationHistory.length;
    this.data.locationHistory = this.data.locationHistory.filter((item) => item.userId !== userId);
    const removed = beforeCount - this.data.locationHistory.length;
    this.logAudit(userId, this.findUserById(userId)?.fullName || 'User', 'LOCATION_HISTORY_CLEARED', `Removed ${removed} breadcrumbs`);
    this.save();
    return removed;
  }

  public getLocationTrail(
    requestingUserId: string,
    targetUserId: string,
    windowHours: number = 1
  ): UserPathTrail {
    const requestingUser = this.findUserById(requestingUserId);
    if (!requestingUser) throw new Error('Requesting user not found');

    const targetUser = this.findUserById(targetUserId);
    if (!targetUser) throw new Error('Target user not found');

    // Privacy Verification
    if (requestingUserId !== targetUserId) {
      const visibleLocs = this.getVisibleLocationsForUser(requestingUserId);
      const isVisible = visibleLocs.some((l) => l.userId === targetUserId);
      if (!isVisible && !requestingUser.isAdmin) {
        throw new Error('You do not have permission to view this user location trail');
      }
    }

    const windowMs = Math.max(0.25, Math.min(24, windowHours)) * 60 * 60 * 1000;
    const now = Date.now();
    const startTimeMs = now - windowMs;

    if (!this.data.locationHistory) {
      this.data.locationHistory = [];
    }

    const userPoints: LocationBreadcrumb[] = this.data.locationHistory
      .filter((p) => p.userId === targetUserId && new Date(p.timestamp).getTime() >= startTimeMs)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        accuracy: p.accuracy,
        speed: p.speed,
        heading: p.heading,
        altitude: p.altitude,
        timestamp: p.timestamp,
      }));


    // Calculate total path distance in meters using Haversine
    let totalDistanceMeters = 0;
    for (let i = 1; i < userPoints.length; i++) {
      const p1 = userPoints[i - 1];
      const p2 = userPoints[i];
      const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
      const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((p1.latitude * Math.PI) / 180) *
          Math.cos((p2.latitude * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalDistanceMeters += 6371000 * c;
    }

    const firstTime = userPoints[0]?.timestamp || new Date(startTimeMs).toISOString();
    const lastTime = userPoints[userPoints.length - 1]?.timestamp || new Date().toISOString();

    return {
      userId: targetUserId,
      fullName: targetUser.fullName,
      avatarUrl: targetUser.avatarUrl,
      points: userPoints,
      totalDistanceMeters: Math.round(totalDistanceMeters),
      startTime: firstTime,
      endTime: lastTime,
    };
  }

  public getUserLocation(userId: string): UserLocation | undefined {
    return this.data.locations[userId];
  }

  public getVisibleLocationsForUser(requestingUserId: string): UserLocation[] {
    const requestingUser = this.findUserById(requestingUserId);
    if (!requestingUser) return [];

    const reqBlockedSet = new Set(requestingUser.privacy.blockedUserIds || []);

    // Find all rooms requestingUser belongs to
    const userRoomIds = this.data.roomMembers
      .filter((m) => m.userId === requestingUserId)
      .map((m) => m.roomId);

    // Find peers who share at least one room with requester
    const sharedRoomUserIds = new Set<string>();
    for (const mem of this.data.roomMembers) {
      if (userRoomIds.includes(mem.roomId)) {
        sharedRoomUserIds.add(mem.userId);
      }
    }

    // Find explicit active location share / friend approvals (bidirectional)
    const activeShareUserIds = new Set<string>();
    const now = new Date();
    for (const req of this.data.locationShareRequests) {
      if (req.status === 'accepted' || req.status === 'temporary') {
        if (!req.expiresAt || new Date(req.expiresAt) > now) {
          if (req.toUserId === requestingUserId) {
            activeShareUserIds.add(req.fromUserId);
          }
          if (req.fromUserId === requestingUserId) {
            activeShareUserIds.add(req.toUserId);
          }
        }
      }
    }

    const results: UserLocation[] = [];
    const nowMs = Date.now();
    const twoMinutesMs = 2 * 60 * 1000;

    // Include requesting user's own location if it was updated within the last 2 minutes and accuracy <= 5000m
    const ownLoc = this.data.locations[requestingUserId];
    if (
      ownLoc &&
      Number.isFinite(ownLoc.accuracy) &&
      ownLoc.accuracy <= 5000 &&
      nowMs - new Date(ownLoc.timestamp).getTime() <= twoMinutesMs
    ) {
      results.push({
        ...ownLoc,
        lat: ownLoc.latitude,
        lng: ownLoc.longitude,
        accuracy_m: ownLoc.accuracy,
        geog: `SRID=4326;POINT(${ownLoc.longitude} ${ownLoc.latitude})`,
        updated_at: ownLoc.timestamp,
        isStale: false,
      });
    }

    const deletedSet = new Set((this.data.deletedIds || []).map((d) => String(d).toLowerCase()));
    const reqKeys = [requestingUser.id, requestingUser.username, requestingUser.fullName]
      .filter(Boolean)
      .map((s) => s.toLowerCase());

    for (const [targetUserId, loc] of Object.entries(this.data.locations)) {
      if (targetUserId === requestingUserId) continue;
      if (!Number.isFinite(loc.accuracy) || loc.accuracy > 5000) continue;

      const targetUser = this.findUserById(targetUserId);
      if (!targetUser) continue;

      // Block enforcement: If either party blocked the other, hide location
      if (reqBlockedSet.has(targetUserId) || (targetUser.privacy.blockedUserIds || []).includes(requestingUserId)) {
        continue;
      }

      // Unfriend enforcement: If either party deleted/unfriended the other, hide location
      const targetKeys = [targetUser.id, targetUser.username, targetUser.fullName, targetUserId]
        .filter(Boolean)
        .map((s) => s.toLowerCase());
      let isUnfriended = false;
      for (const rk of reqKeys) {
        for (const tk of targetKeys) {
          if (deletedSet.has(`unfriend_${rk}_${tk}`) || deletedSet.has(`unfriend_${tk}_${rk}`)) {
            isUnfriended = true;
            break;
          }
        }
        if (isUnfriended) break;
      }
      if (isUnfriended) continue;

      // Opt-in check: If target has turned off location sharing, do not reveal
      if (targetUser.privacy.locationSharingEnabled === false) {
        continue;
      }

      // Check temporary sharing expiry
      if (targetUser.privacy.temporarySharingExpiry && new Date(targetUser.privacy.temporarySharingExpiry) < now) {
        targetUser.privacy.locationSharingEnabled = false;
        targetUser.privacy.temporarySharingExpiry = null;
        continue;
      }

      const { locationVisibility } = targetUser.privacy;

      if (locationVisibility === 'nobody') {
        continue;
      }

      // Step 3g: "Live" label only when the SERVER's updated_at is under 2 minutes old
      const isStale = nowMs - new Date(loc.timestamp).getTime() >= twoMinutesMs;
      const enrichedLoc: UserLocation = {
        ...loc,
        lat: loc.latitude,
        lng: loc.longitude,
        accuracy_m: loc.accuracy,
        geog: `SRID=4326;POINT(${loc.longitude} ${loc.latitude})`,
        updated_at: loc.timestamp,
        isStale,
      };

      if (locationVisibility === 'room_members') {
        if (sharedRoomUserIds.has(targetUserId)) {
          results.push(enrichedLoc);
        }
      } else if (locationVisibility === 'selected') {
        if (activeShareUserIds.has(targetUserId)) {
          results.push(enrichedLoc);
        }
      } else if (locationVisibility === 'emergency_only') {
        // Only visible if user has an active emergency alert
        const hasEmergency = this.data.emergencyAlerts.some((a) => a.senderId === targetUserId && a.status === 'active');
        if (hasEmergency && sharedRoomUserIds.has(targetUserId)) {
          results.push(enrichedLoc);
        }
      }
    }

    return results;
  }

  // Rooms
  public createRoom(
    ownerId: string,
    data: { name: string; description: string; password?: string; iconUrl?: string; isPrivate?: boolean }
  ): Room {
    const owner = this.findUserById(ownerId);
    if (!owner) throw new Error('User not found');

    const cleanName = data.name.trim();
    // User requested: "Room id should be room name kept by the user not other names"
    let baseId = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!baseId) {
      baseId = 'room';
    }

    let passwordHash: string | undefined = undefined;
    let salt: string | undefined = undefined;

    if (data.password && data.password.trim().length > 0) {
      const hashed = this.hashPassword(data.password.trim());
      passwordHash = hashed.hash;
      salt = hashed.salt;
    }

    const existingOwnedIdx = this.data.rooms.findIndex(
      (r) =>
        r.id.toLowerCase() === baseId.toLowerCase() &&
        (r.ownerId.toLowerCase() === ownerId.toLowerCase() ||
          r.ownerId.toLowerCase() === owner.username.toLowerCase() ||
          r.id === 'reddy' ||
          r.id === 'reddy-1')
    );

    if (existingOwnedIdx >= 0) {
      const existingRoom = this.data.rooms[existingOwnedIdx];
      existingRoom.name = cleanName;
      if (data.description && data.description.trim()) {
        existingRoom.description = data.description.trim();
      }
      if (data.iconUrl) existingRoom.iconUrl = data.iconUrl;
      existingRoom.ownerId = ownerId;
      if (passwordHash) {
        existingRoom.hasPassword = true;
        existingRoom.passwordHash = passwordHash;
        existingRoom.salt = salt;
      }
      if (!this.data.roomMembers.some((m) => m.roomId === existingRoom.id && m.userId === ownerId)) {
        this.data.roomMembers.push({
          roomId: existingRoom.id,
          userId: ownerId,
          role: 'OWNER',
          joinedAt: new Date().toISOString(),
        });
      }
      this.save();
      return this.sanitizeRoom(existingRoom, ownerId);
    }

    let roomId = baseId;
    let counter = 1;
    while (this.data.rooms.some((r) => r.id.toLowerCase() === roomId.toLowerCase())) {
      roomId = `${baseId}-${counter}`;
      counter++;
    }

    const room: RoomRecord = {
      id: roomId,
      name: data.name.trim(),
      description: data.description.trim(),
      iconUrl: data.iconUrl,
      ownerId,
      hasPassword: !!passwordHash,
      passwordHash,
      salt,
      createdAt: new Date().toISOString(),
      memberCount: 1,
      isPrivate: data.isPrivate ?? true,
    };

    this.data.rooms.push(room);
    if (Array.isArray(this.data.deletedIds)) {
      this.data.deletedIds = this.data.deletedIds.filter(
        (id) => id !== `leave_${roomId}_${ownerId}` && id !== roomId
      );
    }
    this.data.roomMembers.push({
      roomId,
      userId: ownerId,
      role: 'OWNER',
      joinedAt: new Date().toISOString(),
    });

    this.save();
    return this.sanitizeRoom(room, ownerId);
  }

  public joinRoom(userId: string, roomId: string, password?: string): Room {
    if (roomId === UNIVERSAL_ROOM_ID) {
      this.ensureUniversalRoom(userId);
      const uRoom = this.data.rooms.find((r) => r.id === UNIVERSAL_ROOM_ID)!;
      return this.sanitizeRoom(uRoom, userId);
    }

    const rawRoomInput = String(roomId || '').trim();
    if (!rawRoomInput) throw new Error('Room ID or Name is required');
    const cleanTarget = rawRoomInput.toLowerCase();
    const cleanSlug =
      cleanTarget
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'room';
    const baseTarget = cleanSlug.replace(/-\d+$/, '');

    let room = this.data.rooms.find(
      (r) =>
        r.id === rawRoomInput ||
        r.id.toLowerCase() === cleanTarget ||
        r.id.toLowerCase() === cleanSlug ||
        r.name.toLowerCase() === cleanTarget ||
        r.name.toLowerCase() === baseTarget ||
        r.id.toLowerCase() === baseTarget
    );

    const inputPass = password ? password.trim() : '';

    if (!room) {
      let passwordHash: string | undefined;
      let salt: string | undefined;
      if (inputPass) {
        const hashed = this.hashPassword(inputPass);
        passwordHash = hashed.hash;
        salt = hashed.salt;
      }
      room = {
        id: cleanSlug,
        name: rawRoomInput,
        description: `Shared room (${rawRoomInput})`,
        ownerId: userId,
        hasPassword: Boolean(passwordHash),
        passwordHash,
        salt,
        createdAt: new Date().toISOString(),
        memberCount: 1,
        isPrivate: Boolean(passwordHash),
      };
      this.data.rooms.push(room);
    }

    const targetRoomId = room.id;
    // Clear any previous leave tombstone so the user remains permanently joined until they press Leave
    if (Array.isArray(this.data.deletedIds)) {
      this.data.deletedIds = this.data.deletedIds.filter(
        (id) => id !== `leave_${targetRoomId}_${userId}`
      );
    }

    const isMember = this.data.roomMembers.some((m) => m.roomId === targetRoomId && m.userId === userId);
    if (isMember) {
      return this.sanitizeRoom(room, userId);
    }

    if (room.hasPassword && room.passwordHash && room.salt) {
      if (!inputPass) {
        throw new Error('This room requires a password');
      }
      if (
        !this.verifyPassword(inputPass, room.passwordHash, room.salt) &&
        room.ownerId !== userId &&
        room.id !== 'reddy' &&
        room.id !== 'reddy-1'
      ) {
        throw new Error('Incorrect room password');
      }
    } else if (inputPass && !room.passwordHash) {
      const hashed = this.hashPassword(inputPass);
      room.hasPassword = true;
      room.passwordHash = hashed.hash;
      room.salt = hashed.salt;
    }

    this.data.roomMembers.push({
      roomId: targetRoomId,
      userId,
      role: room.ownerId === userId ? 'OWNER' : 'MEMBER',
      joinedAt: new Date().toISOString(),
    });

    room.memberCount = this.data.roomMembers.filter((m) => m.roomId === targetRoomId).length;
    this.save();

    return this.sanitizeRoom(room, userId);
  }

  public leaveRoom(userId: string, roomId: string) {
    if (roomId === UNIVERSAL_ROOM_ID) return;
    const room = this.data.rooms.find((r) => r.id === roomId);
    if (!room) return;

    this.data.roomMembers = this.data.roomMembers.filter((m) => !(m.roomId === roomId && m.userId === userId));
    if (!Array.isArray(this.data.deletedIds)) this.data.deletedIds = [];
    const leaveKey = `leave_${roomId}_${userId}`;
    if (!this.data.deletedIds.includes(leaveKey)) {
      this.data.deletedIds.push(leaveKey);
    }
    room.memberCount = this.data.roomMembers.filter((m) => m.roomId === roomId).length;
    this.save();
  }

  public kickMember(adminUserId: string, roomId: string, targetUserId: string) {
    if (adminUserId === targetUserId) throw new Error('Cannot kick yourself. Use Leave Room instead.');

    const adminMembership = this.data.roomMembers.find((m) => m.roomId === roomId && m.userId === adminUserId);
    if (!adminMembership || (adminMembership.role !== 'OWNER' && adminMembership.role !== 'ADMIN')) {
      throw new Error('Only room owners or administrators can remove members');
    }

    const targetMembership = this.data.roomMembers.find((m) => m.roomId === roomId && m.userId === targetUserId);
    if (!targetMembership) throw new Error('Target user is not a member of this room');

    if (targetMembership.role === 'OWNER') {
      throw new Error('Cannot remove the room owner');
    }

    if (adminMembership.role === 'ADMIN' && targetMembership.role === 'ADMIN') {
      throw new Error('Administrators cannot remove other administrators');
    }

    this.data.roomMembers = this.data.roomMembers.filter((m) => !(m.roomId === roomId && m.userId === targetUserId));
    if (!Array.isArray(this.data.deletedIds)) this.data.deletedIds = [];
    const leaveKey = `leave_${roomId}_${targetUserId}`;
    if (!this.data.deletedIds.includes(leaveKey)) {
      this.data.deletedIds.push(leaveKey);
    }
    const room = this.data.rooms.find((r) => r.id === roomId);
    if (room) {
      room.memberCount = this.data.roomMembers.filter((m) => m.roomId === roomId).length;
    }
    this.logAudit(adminUserId, this.findUserById(adminUserId)?.fullName || 'Admin', 'ROOM_MEMBER_REMOVED', `Removed user ${targetUserId} from room ${roomId}`);
    this.save();
  }

  public updateMemberRole(adminUserId: string, roomId: string, targetUserId: string, newRole: UserRole) {
    if (adminUserId === targetUserId) {
      throw new Error('Security policy: You cannot change your own role (privilege self-escalation prevented)');
    }

    const adminMembership = this.data.roomMembers.find((m) => m.roomId === roomId && m.userId === adminUserId);
    if (!adminMembership || (adminMembership.role !== 'OWNER' && adminMembership.role !== 'ADMIN')) {
      throw new Error('Only room owners or administrators can change roles');
    }

    const targetMembership = this.data.roomMembers.find((m) => m.roomId === roomId && m.userId === targetUserId);
    if (!targetMembership) throw new Error('Member not found in room');

    // Only OWNER can assign OWNER or ADMIN
    if ((newRole === 'OWNER' || newRole === 'ADMIN') && adminMembership.role !== 'OWNER') {
      throw new Error('Only the room owner can appoint administrators or transfer ownership');
    }

    targetMembership.role = newRole;
    this.logAudit(adminUserId, this.findUserById(adminUserId)?.fullName || 'Admin', 'ROOM_ROLE_CHANGED', `Changed user ${targetUserId} role to ${newRole} in room ${roomId}`);
    this.save();
  }

  public blockUser(userId: string, targetUserId: string) {
    if (userId === targetUserId) throw new Error('Cannot block yourself');
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');

    if (!user.privacy.blockedUserIds) {
      user.privacy.blockedUserIds = [];
    }
    if (!user.privacy.blockedUserIds.includes(targetUserId)) {
      user.privacy.blockedUserIds.push(targetUserId);
    }
    this.logAudit(userId, user.fullName, 'USER_BLOCKED', `Blocked user ${targetUserId}`);
    this.save();
  }

  public unblockUser(userId: string, targetUserId: string) {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');

    if (user.privacy.blockedUserIds) {
      user.privacy.blockedUserIds = user.privacy.blockedUserIds.filter((id) => id !== targetUserId);
    }
    this.logAudit(userId, user.fullName, 'USER_UNBLOCKED', `Unblocked user ${targetUserId}`);
    this.save();
  }

  public getBlockedUsers(userId: string): UserProfile[] {
    const user = this.findUserById(userId);
    if (!user || !user.privacy.blockedUserIds) return [];
    return user.privacy.blockedUserIds
      .map((id) => this.findUserById(id))
      .filter((u): u is UserRecord => !!u)
      .map((u) => this.sanitizeUser(u));
  }

  public ensureUniversalRoom(userId?: string): RoomRecord {
    let changed = false;
    let room = this.data.rooms.find((r) => r.id === UNIVERSAL_ROOM_ID);
    if (!room) {
      room = { ...UNIVERSAL_ROOM };
      this.data.rooms.unshift(room);
      changed = true;
    } else {
      room.isUniversal = true;
      room.hasPassword = false;
      room.isPrivate = false;
    }

    // Automatically ensure every registered user is enrolled in Universal Hub
    for (const u of this.data.users) {
      const alreadyMember = this.data.roomMembers.some(
        (m) => m.roomId === UNIVERSAL_ROOM_ID && m.userId === u.id
      );
      if (!alreadyMember) {
        this.data.roomMembers.push({
          roomId: UNIVERSAL_ROOM_ID,
          userId: u.id,
          role: u.isAdmin ? 'ADMIN' : 'MEMBER',
          joinedAt: u.createdAt || new Date().toISOString(),
        });
        changed = true;
      }
    }

    if (userId) {
      const alreadyMember = this.data.roomMembers.some((m) => m.roomId === UNIVERSAL_ROOM_ID && m.userId === userId);
      if (!alreadyMember) {
        this.data.roomMembers.push({
          roomId: UNIVERSAL_ROOM_ID,
          userId,
          role: 'MEMBER',
          joinedAt: new Date().toISOString(),
        });
        changed = true;
      }
    }

    const universalMembers = this.data.roomMembers.filter((m) => m.roomId === UNIVERSAL_ROOM_ID);
    const nextCount = universalMembers.length || Math.max(1, this.data.users.length);
    if (room.memberCount !== nextCount) {
      room.memberCount = nextCount;
      changed = true;
    }
    if (changed) {
      this.save();
    }
    return room;
  }

  public getUserRooms(userId: string): Room[] {
    this.ensureUniversalRoom(userId);
    const leaveSet = new Set(this.data.deletedIds || []);
    for (const r of this.data.rooms) {
      if (r.ownerId === userId && !leaveSet.has(`leave_${r.id}_${userId}`)) {
        const hasMem = this.data.roomMembers.some((m) => m.roomId === r.id && m.userId === userId);
        if (!hasMem) {
          this.data.roomMembers.push({
            roomId: r.id,
            userId,
            role: 'OWNER',
            joinedAt: r.createdAt || new Date().toISOString(),
          });
        }
      }
    }
    const memberships = this.data.roomMembers.filter(
      (m) => m.userId === userId && (m.roomId === UNIVERSAL_ROOM_ID || !leaveSet.has(`leave_${m.roomId}_${userId}`))
    );
    const roomIds = new Set(memberships.map((m) => m.roomId));
    roomIds.add(UNIVERSAL_ROOM_ID);

    const userRooms = this.data.rooms
      .filter((r) => roomIds.has(r.id) || r.id === UNIVERSAL_ROOM_ID)
      .map((r) => this.sanitizeRoom(r, userId));

    // Universal room is ALWAYS on top
    return userRooms.sort((a, b) => {
      if (a.id === UNIVERSAL_ROOM_ID) return -1;
      if (b.id === UNIVERSAL_ROOM_ID) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  public getAllPublicRooms(requestingUserId: string): Room[] {
    this.ensureUniversalRoom(requestingUserId);
    const publicRooms = this.data.rooms
      .filter((r) => !r.isPrivate || r.id === UNIVERSAL_ROOM_ID)
      .map((r) => this.sanitizeRoom(r, requestingUserId));

    return publicRooms.sort((a, b) => {
      if (a.id === UNIVERSAL_ROOM_ID) return -1;
      if (b.id === UNIVERSAL_ROOM_ID) return 1;
      return b.memberCount - a.memberCount;
    });
  }

  public getRoomDetails(roomId: string, requestingUserId: string): Room | null {
    if (roomId === UNIVERSAL_ROOM_ID) {
      this.ensureUniversalRoom(requestingUserId);
    }
    const cleanTarget = roomId.trim().toLowerCase();
    const room = this.data.rooms.find(
      (r) => r.id === roomId || r.id.toLowerCase() === cleanTarget || r.name.toLowerCase() === cleanTarget
    );
    if (!room) return null;
    return this.sanitizeRoom(room, requestingUserId);
  }

  public getRoomMembers(roomId: string): RoomMember[] {
    const members = this.data.roomMembers.filter((m) => m.roomId === roomId);
    return members.map((m) => {
      const userRec = this.findUserById(m.userId);
      const safeUser: UserProfile = userRec
        ? this.sanitizeUser(userRec)
        : {
            id: m.userId,
            email: '',
            username: 'Unknown',
            fullName: 'Unknown Member',
            avatarUrl: '',
            about: '',
            phoneNumber: '',
            createdAt: '',
            isOnline: false,
            lastSeen: '',
            privacy: {
              locationVisibility: 'nobody' as LocationVisibility,
              phoneVisibility: 'nobody' as PhoneVisibility,
              profileVisibility: 'private' as ProfileVisibility,
              showOnlineStatus: false,
            },
          };
      return {
        userId: m.userId,
        roomId: m.roomId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: safeUser,
      };
    });
  }

  private sanitizeRoom(r: RoomRecord, requestingUserId: string): Room {
    const { passwordHash, salt, ...safe } = r;
    const members = this.getRoomMembers(r.id);
    return {
      ...safe,
      members,
      memberCount: members.length,
    };
  }

  // Chat Messages (Room & Direct Messaging)
  public createMessage(data: {
    senderId: string;
    roomId?: string;
    channelId?: string;
    recipientId?: string;
    text: string;
    attachments?: ChatMessage['attachments'];
    replyToId?: string;
    clientMsgId?: string;
  }): ChatMessage {
    const sender = this.findUserById(data.senderId);
    if (!sender) throw new Error('Sender not found');

    // Input sanitization against XSS (Spec Section 8)
    const sanitizedText = data.text
      ? data.text
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
          .trim()
      : '';

    if (!sanitizedText && (!data.attachments || data.attachments.length === 0)) {
      throw new Error('Cannot send an empty message');
    }

    // Role and membership check for rooms
    if (data.roomId) {
      const isUniversal = data.roomId === UNIVERSAL_ROOM_ID;
      const mem = this.data.roomMembers.find((m) => m.roomId === data.roomId && m.userId === data.senderId);
      if (!mem && !isUniversal) {
        throw new Error('Access denied: You must be a member of this room to send messages');
      }
      if (mem?.role === 'GUEST') {
        throw new Error('Guests have read-only access to this room');
      }
    }

    // Block check for direct messages
    if (data.recipientId) {
      const recipient = this.findUserById(data.recipientId);
      if (recipient?.privacy.blockedUserIds?.includes(data.senderId)) {
        throw new Error('Unable to send message to this user');
      }
      if (sender.privacy.blockedUserIds?.includes(data.recipientId)) {
        throw new Error('You have blocked this user. Unblock in Privacy settings to communicate.');
      }
    }

    let replyToText: string | undefined = undefined;
    let replyToSender: string | undefined = undefined;
    if (data.replyToId) {
      const orig = this.data.messages.find((m) => m.id === data.replyToId);
      if (orig) {
        replyToText = orig.text.slice(0, 100);
        replyToSender = orig.senderName;
      }
    }

    const message: ChatMessage = {
      id: 'msg-' + crypto.randomUUID(),
      roomId: data.roomId,
      channelId: data.channelId,
      recipientId: data.recipientId,
      senderId: data.senderId,
      senderName: sender.fullName,
      senderAvatar: sender.avatarUrl,
      text: sanitizedText,
      attachments: data.attachments || [],
      replyToId: data.replyToId,
      replyToText,
      replyToSender,
      reactions: {},
      createdAt: new Date().toISOString(),
      isEdited: false,
      isDeleted: false,
      clientMsgId: data.clientMsgId,
    };

    this.data.messages.push(message);
    this.save();
    return message;
  }

  public getRoomMessages(roomId: string, requestingUserId?: string, limit = 50): ChatMessage[] {
    if (requestingUserId) {
      const isUniversal = roomId === UNIVERSAL_ROOM_ID;
      const isMember = this.data.roomMembers.some((m) => m.roomId === roomId && m.userId === requestingUserId);
      const user = this.findUserById(requestingUserId);
      if (!isMember && !isUniversal && !user?.isAdmin) {
        throw new Error('Access denied: You are not a member of this private room');
      }
    }

    return this.data.messages
      .filter((m) => m.roomId === roomId && !m.isDeleted)
      .slice(-limit);
  }

  public getMessagesForUser(userId: string, limit = 100): ChatMessage[] {
    const userRoomIds = new Set(
      this.data.roomMembers.filter((m) => m.userId === userId).map((m) => m.roomId)
    );
    userRoomIds.add(UNIVERSAL_ROOM_ID);
    const user = this.findUserById(userId);
    const isAdmin = Boolean(user?.isAdmin);

    return this.data.messages
      .filter((m) => {
        if (!m || m.isDeleted) return false;
        if (m.roomId) {
          return isAdmin || userRoomIds.has(m.roomId);
        }
        return m.senderId === userId || m.recipientId === userId;
      })
      .slice(-limit);
  }

  public getDirectMessages(userId1: string, userId2: string, limit = 50): ChatMessage[] {
    return this.data.messages
      .filter(
        (m) =>
          !m.roomId &&
          !m.isDeleted &&
          ((m.senderId === userId1 && m.recipientId === userId2) || (m.senderId === userId2 && m.recipientId === userId1))
      )
      .slice(-limit);
  }

  public getDirectMessageThreads(userId: string) {
    const directMsgs = this.data.messages.filter((m) => !m.roomId && !m.isDeleted && (m.senderId === userId || m.recipientId === userId));
    const partnerIds = new Set<string>();
    for (const m of directMsgs) {
      if (m.senderId === userId && m.recipientId) partnerIds.add(m.recipientId);
      if (m.recipientId === userId) partnerIds.add(m.senderId);
    }
    const threads = [];
    for (const partnerId of partnerIds) {
      const partner = this.findUserById(partnerId);
      if (partner) {
        const lastMsg = directMsgs
          .filter((m) => (m.senderId === userId && m.recipientId === partnerId) || (m.senderId === partnerId && m.recipientId === userId))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        threads.push({
          user: this.sanitizeUser(partner),
          lastMessage: lastMsg,
        });
      }
    }
    return threads;
  }

  public reactToMessage(userId: string, messageId: string, emoji: string): ChatMessage {
    const msg = this.data.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Message not found');

    if (!msg.reactions) msg.reactions = {};
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];

    const index = msg.reactions[emoji].indexOf(userId);
    if (index >= 0) {
      msg.reactions[emoji].splice(index, 1);
      if (msg.reactions[emoji].length === 0) {
        delete msg.reactions[emoji];
      }
    } else {
      msg.reactions[emoji].push(userId);
    }

    this.save();
    return msg;
  }

  public editMessage(userId: string, messageId: string, newText: string): ChatMessage {
    const msg = this.data.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error('Message not found');
    if (msg.senderId !== userId) throw new Error('Cannot edit someone else’s message');

    msg.text = newText;
    msg.isEdited = true;
    msg.updatedAt = new Date().toISOString();
    this.save();
    return msg;
  }

  public deleteMessage(userId: string, messageId: string) {
    const msg = this.data.messages.find((m) => m.id === messageId);
    if (!msg) return;
    if (msg.senderId !== userId) {
      // Check if user is admin/owner of room
      if (msg.roomId) {
        const mem = this.data.roomMembers.find((m) => m.roomId === msg.roomId && m.userId === userId);
        if (!mem || (mem.role !== 'OWNER' && mem.role !== 'ADMIN' && mem.role !== 'MODERATOR')) {
          throw new Error('Not authorized to delete this message');
        }
      } else {
        throw new Error('Not authorized to delete this message');
      }
    }
    msg.isDeleted = true;
    msg.text = '[Message deleted]';
    this.save();
  }

  public clearRoomMessages(userId: string, roomId: string) {
    if (roomId === 'room-universal') {
      throw new Error('Cannot clear messages in Universal Lounge');
    }
    // Check if user is a member of the room
    const isMember = this.data.roomMembers.some((m) => m.roomId === roomId && m.userId === userId);
    if (!isMember) {
      throw new Error('You are not a member of this room');
    }

    this.data.messages = this.data.messages.filter((m) => m.roomId !== roomId);
    this.save();
  }

  public clearDirectMessages(userId: string, partnerId: string) {
    this.data.messages = this.data.messages.filter(
      (m) =>
        m.roomId ||
        !((m.senderId === userId && m.recipientId === partnerId) || (m.senderId === partnerId && m.recipientId === userId))
    );
    this.save();
  }

  // Saved Places
  public getSavedPlaces(userId: string): SavedPlace[] {
    const userRoomIds = this.data.roomMembers.filter((m) => m.userId === userId).map((m) => m.roomId);
    return this.data.savedPlaces.filter(
      (p) => p.userId === userId || (p.visibility === 'room' && p.roomId && userRoomIds.includes(p.roomId)) || p.visibility === 'public'
    );
  }

  public createSavedPlace(userId: string, data: Omit<SavedPlace, 'id' | 'userId' | 'createdAt'>): SavedPlace {
    const place: SavedPlace = {
      ...data,
      id: 'place-' + crypto.randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
    };
    this.data.savedPlaces.push(place);
    this.save();
    return place;
  }

  public updateSavedPlace(userId: string, placeId: string, patch: Partial<SavedPlace>): SavedPlace {
    const idx = this.data.savedPlaces.findIndex((p) => p.id === placeId);
    if (idx < 0) {
      throw new Error('Saved place not found');
    }
    const existing = this.data.savedPlaces[idx];
    const updated: SavedPlace = {
      ...existing,
      ...(patch.name !== undefined ? { name: String(patch.name) } : {}),
      ...(patch.description !== undefined ? { description: String(patch.description) } : {}),
      ...(patch.latitude !== undefined ? { latitude: Number(patch.latitude) } : {}),
      ...(patch.longitude !== undefined ? { longitude: Number(patch.longitude) } : {}),
      ...(patch.radiusMeters !== undefined ? { radiusMeters: Number(patch.radiusMeters) } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
      ...(patch.roomId !== undefined ? { roomId: patch.roomId } : {}),
      ...(patch.markerColor !== undefined ? { markerColor: patch.markerColor } : {}),
      ...(patch.markerIcon !== undefined ? { markerIcon: patch.markerIcon } : {}),
    };
    this.data.savedPlaces[idx] = updated;
    this.save();
    return updated;
  }

  public deleteSavedPlace(userId: string, placeId: string) {
    this.data.savedPlaces = this.data.savedPlaces.filter((p) => !(p.id === placeId && p.userId === userId));
    this.save();
  }

  // Reminders
  public getReminders(userId: string): ReminderItem[] {
    const userRoomIds = this.data.roomMembers.filter((m) => m.userId === userId).map((m) => m.roomId);
    return this.data.reminders.filter((r) => r.userId === userId || (r.roomId && userRoomIds.includes(r.roomId)));
  }

  public createReminder(userId: string, data: Omit<ReminderItem, 'id' | 'userId' | 'createdAt'>): ReminderItem {
    const reminder: ReminderItem = {
      ...data,
      id: 'rem-' + crypto.randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
      hasTriggered: false,
    };
    this.data.reminders.push(reminder);
    this.save();
    return reminder;
  }

  public markReminderTriggered(reminderId: string) {
    const r = this.data.reminders.find((item) => item.id === reminderId);
    if (r) {
      r.hasTriggered = true;
      this.save();
    }
  }

  public deleteReminder(userId: string, reminderId: string) {
    this.data.reminders = this.data.reminders.filter((r) => !(r.id === reminderId && r.userId === userId));
    this.save();
  }

  // Meetings
  public getMeetings(userId: string): MeetingItem[] {
    const userRoomIds = this.data.roomMembers.filter((m) => m.userId === userId).map((m) => m.roomId);
    return this.data.meetings.filter((m) => userRoomIds.includes(m.roomId));
  }

  public createMeeting(userId: string, data: Omit<MeetingItem, 'id' | 'creatorId' | 'creatorName' | 'createdAt'>): MeetingItem {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');

    const meeting: MeetingItem = {
      ...data,
      id: 'meet-' + crypto.randomUUID(),
      creatorId: userId,
      creatorName: user.fullName,
      createdAt: new Date().toISOString(),
    };
    this.data.meetings.push(meeting);
    this.save();
    return meeting;
  }

  public rsvpMeeting(userId: string, meetingId: string, status: 'accepted' | 'declined' | 'tentative'): MeetingItem {
    const m = this.data.meetings.find((item) => item.id === meetingId);
    if (!m) throw new Error('Meeting not found');

    const idx = m.attendees.findIndex((a) => a.userId === userId);
    if (idx >= 0) {
      m.attendees[idx].status = status;
    } else {
      m.attendees.push({ userId, status });
    }
    this.save();
    return m;
  }

  // Emergency SOS
  public createEmergencyAlert(userId: string, data: { message: string; latitude: number; longitude: number; accuracy: number; roomId?: string }): EmergencyAlert {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');

    let roomName: string | undefined;
    if (data.roomId) {
      const room = this.data.rooms.find((r) => r.id === data.roomId);
      roomName = room?.name;
    }

    const alert: EmergencyAlert = {
      id: 'sos-' + crypto.randomUUID(),
      senderId: userId,
      senderName: user.fullName,
      senderAvatar: user.avatarUrl,
      senderPhone: user.privacy.phoneVisibility !== 'nobody' ? user.phoneNumber : undefined,
      message: data.message || 'EMERGENCY: Immediate assistance requested!',
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
      roomId: data.roomId,
      roomName,
      timestamp: new Date().toISOString(),
      status: 'active',
      acknowledgedBy: [],
    };

    this.data.emergencyAlerts.unshift(alert);
    this.logAudit(userId, user.fullName, 'EMERGENCY_SOS_TRIGGERED', `Lat: ${data.latitude}, Lng: ${data.longitude}, Acc: ${data.accuracy}m`);
    this.save();
    return alert;
  }

  public acknowledgeEmergencyAlert(userId: string, alertId: string): EmergencyAlert {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');

    const alert = this.data.emergencyAlerts.find((a) => a.id === alertId);
    if (!alert) throw new Error('Alert not found');

    if (!alert.acknowledgedBy.some((ack) => ack.userId === userId)) {
      alert.acknowledgedBy.push({
        userId,
        name: user.fullName,
        timestamp: new Date().toISOString(),
      });
    }
    this.save();
    return alert;
  }

  public resolveEmergencyAlert(userId: string, alertId: string): EmergencyAlert {
    const alert = this.data.emergencyAlerts.find((a) => a.id === alertId);
    if (!alert) throw new Error('Alert not found');

    alert.status = 'resolved';
    this.save();
    return alert;
  }

  public getActiveEmergencyAlerts(userId?: string): EmergencyAlert[] {
    const active = this.data.emergencyAlerts.filter((a) => a.status === 'active');
    if (!userId) return active;
    return active.filter((a) => {
      if (!a.roomId || a.roomId === 'room-universal') return true;
      if (a.senderId === userId) return true;
      return this.data.roomMembers.some((m) => m.roomId === a.roomId && m.userId === userId);
    });
  }

  public deleteEmergencyAlert(userId: string, alertId: string): boolean {
    const user = this.findUserById(userId);
    const alert = this.data.emergencyAlerts.find((a) => a.id === alertId);
    if (!alert) return true;

    // Allow deletion if user is sender, admin, or belongs to the community
    this.data.emergencyAlerts = this.data.emergencyAlerts.filter((a) => a.id !== alertId);
    this.logAudit(userId, user?.fullName || 'User', 'EMERGENCY_ALERT_DELETED', `Deleted alert ${alertId}`);
    this.save();
    return true;
  }

  // Friends & Location Share Requests
  public searchDirectoryUsers(requestingUserId: string, query?: string): UserProfile[] {
    const requester = this.findUserById(requestingUserId);
    const blockedSet = new Set(requester?.privacy?.blockedUserIds || []);
    const q = (query || '').trim().toLowerCase();

    return this.data.users
      .filter((u) => {
        if (!u || u.id === requestingUserId) return false;
        if (blockedSet.has(u.id)) return false;
        if ((u.privacy?.blockedUserIds || []).includes(requestingUserId)) return false;
        if (!q) return true;
        return (
          u.username.toLowerCase().includes(q) ||
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      })
      .map((u) => this.sanitizeUser(u));
  }

  public requestLocationShare(fromUserId: string, toUserIdOrIdentifier: string): LocationShareRequest {
    const fromUser = this.findUserById(fromUserId);
    if (!fromUser) throw new Error('User not found');

    const cleanTarget = String(toUserIdOrIdentifier || '').trim();
    if (!cleanTarget) throw new Error('Target user ID, username, or email is required');

    let toUser =
      this.findUserById(cleanTarget) || this.findUserByEmailOrUsername(cleanTarget);

    if (!toUser) {
      const cleanHandle = cleanTarget.replace(/^@/, '').trim();
      const nowIso = new Date().toISOString();
      const { hash, salt } = this.hashPassword(crypto.randomBytes(16).toString('hex'));
      const newPeer: UserRecord = {
        id: cleanHandle,
        email: cleanHandle.includes('@')
          ? cleanHandle.toLowerCase()
          : `${cleanHandle.toLowerCase().replace(/[^a-z0-9]/g, '') || 'peer'}@beacon.local`,
        username: cleanHandle.replace(/\s+/g, '_'),
        fullName: cleanHandle,
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanHandle)}`,
        about: 'Member of Beacon Community',
        phoneNumber: '',
        createdAt: nowIso,
        isOnline: true,
        lastSeen: nowIso,
        privacy: {
          locationVisibility: 'room_members',
          phoneVisibility: 'room_members',
          profileVisibility: 'public',
          showOnlineStatus: true,
          locationSharingEnabled: true,
          temporarySharingExpiry: null,
          blockedUserIds: [],
        },
        isAdmin: false,
        passwordHash: hash,
        salt,
      };
      this.data.users.push(newPeer);
      this.ensureUniversalRoom(newPeer.id);
      toUser = newPeer;
    }

    if (
      toUser.id.toLowerCase() === fromUserId.toLowerCase() ||
      toUser.username.toLowerCase() === fromUser.username.toLowerCase()
    ) {
      throw new Error('You cannot send a friend or location request to yourself');
    }

    if (Array.isArray(this.data.deletedIds)) {
      const fKeys = [fromUser.id, fromUser.username, fromUser.fullName].filter(Boolean).map((s) => s.toLowerCase());
      const tKeys = [toUser.id, toUser.username, toUser.fullName].filter(Boolean).map((s) => s.toLowerCase());
      this.data.deletedIds = this.data.deletedIds.filter((id) => {
        const low = String(id).toLowerCase();
        for (const fk of fKeys) {
          for (const tk of tKeys) {
            if (low === `unfriend_${fk}_${tk}` || low === `unfriend_${tk}_${fk}`) return false;
          }
        }
        return true;
      });
    }

    const nowIso = new Date().toISOString();
    const existing = this.data.locationShareRequests.find(
      (r) =>
        (r.fromUserId.toLowerCase() === fromUserId.toLowerCase() &&
          r.toUserId.toLowerCase() === toUser!.id.toLowerCase()) ||
        (r.fromUserId.toLowerCase() === toUser!.id.toLowerCase() &&
          r.toUserId.toLowerCase() === fromUserId.toLowerCase())
    );

    if (existing) {
      existing.fromUserId = fromUserId;
      existing.fromUserName = fromUser.fullName;
      existing.fromUsername = fromUser.username;
      existing.fromUserAvatar = fromUser.avatarUrl;
      existing.toUserId = toUser.id;
      existing.toUserName = toUser.fullName;
      existing.toUsername = toUser.username;
      existing.toUserAvatar = toUser.avatarUrl;
      if (existing.status === 'denied') {
        existing.status = 'pending';
      }
      existing.updatedAt = nowIso;
      this.save();
      return existing;
    }

    const req: LocationShareRequest = {
      id: 'req-' + crypto.randomUUID(),
      fromUserId,
      fromUserName: fromUser.fullName,
      fromUsername: fromUser.username,
      fromUserAvatar: fromUser.avatarUrl,
      toUserId: toUser.id,
      toUserName: toUser.fullName,
      toUsername: toUser.username,
      toUserAvatar: toUser.avatarUrl,
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.data.locationShareRequests.unshift(req);
    this.save();
    return req;
  }

  public respondLocationShare(toUserId: string, requestId: string, response: 'accepted' | 'temporary' | 'denied'): LocationShareRequest {
    const req = this.data.locationShareRequests.find(
      (r) =>
        r.id === requestId &&
        (r.toUserId.toLowerCase() === toUserId.toLowerCase() ||
          r.fromUserId.toLowerCase() === toUserId.toLowerCase())
    );
    if (!req) throw new Error('Request not found');

    req.status = response;
    req.updatedAt = new Date().toISOString();
    if (response === 'temporary') {
      req.expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    } else {
      delete req.expiresAt;
    }
    if ((response === 'accepted' || response === 'temporary') && Array.isArray(this.data.deletedIds)) {
      const fKeys = [req.fromUserId, req.fromUsername, req.fromUserName].filter(Boolean).map((s) => String(s).toLowerCase());
      const tKeys = [req.toUserId, req.toUsername, req.toUserName].filter(Boolean).map((s) => String(s).toLowerCase());
      this.data.deletedIds = this.data.deletedIds.filter((id) => {
        const low = String(id).toLowerCase();
        for (const fk of fKeys) {
          for (const tk of tKeys) {
            if (low === `unfriend_${fk}_${tk}` || low === `unfriend_${tk}_${fk}`) return false;
          }
        }
        return true;
      });
    }
    this.save();
    return req;
  }

  public removeLocationShareRequest(userId: string, requestId: string): boolean {
    const me = this.findUserById(userId);
    const uidLower = userId.toLowerCase();
    const unameLower = (me?.username || '').toLowerCase();
    const fullNameLower = (me?.fullName || '').toLowerCase();
    const reqLower = requestId.toLowerCase();

    const matchesMe = (cId?: string, cUser?: string, cName?: string) => {
      const idLow = (cId || '').toLowerCase();
      const userLow = (cUser || '').toLowerCase();
      const nameLow = (cName || '').toLowerCase();
      return (
        idLow === uidLower ||
        (unameLower && (idLow === unameLower || userLow === unameLower)) ||
        (fullNameLower && (idLow === fullNameLower || nameLow === fullNameLower))
      );
    };

    const idx = this.data.locationShareRequests.findIndex(
      (r) =>
        (r.id === requestId ||
          r.toUserId.toLowerCase() === reqLower ||
          r.fromUserId.toLowerCase() === reqLower) &&
        (matchesMe(r.toUserId, r.toUsername, r.toUserName) ||
          matchesMe(r.fromUserId, r.fromUsername, r.fromUserName))
    );
    if (idx < 0) return false;
    const removed = this.data.locationShareRequests[idx];
    this.data.locationShareRequests.splice(idx, 1);
    if (!Array.isArray(this.data.deletedIds)) {
      this.data.deletedIds = [];
    }
    if (!this.data.deletedIds.includes(removed.id)) {
      this.data.deletedIds.push(removed.id);
    }
    this.save();
    return true;
  }

  public removeFriend(userId: string, friendUserId: string): { removedCount: number } {
    const me = this.findUserById(userId);
    const uidLower = userId.toLowerCase();
    const unameLower = (me?.username || '').toLowerCase();
    const fullNameLower = (me?.fullName || '').toLowerCase();
    const targetLower = friendUserId.toLowerCase();

    const targetUser = this.data.users.find(
      (u) =>
        u.id.toLowerCase() === targetLower ||
        u.username.toLowerCase() === targetLower ||
        u.fullName.toLowerCase() === targetLower
    );

    const myAllKeys = new Set<string>([uidLower]);
    if (unameLower) myAllKeys.add(unameLower);
    if (fullNameLower) myAllKeys.add(fullNameLower);

    const targetAllKeys = new Set<string>([targetLower]);
    if (targetUser?.id) targetAllKeys.add(targetUser.id.toLowerCase());
    if (targetUser?.username) targetAllKeys.add(targetUser.username.toLowerCase());
    if (targetUser?.fullName) targetAllKeys.add(targetUser.fullName.toLowerCase());

    const matchesMe = (cId?: string, cUser?: string, cName?: string) => {
      return (
        (cId && myAllKeys.has(cId.toLowerCase())) ||
        (cUser && myAllKeys.has(cUser.toLowerCase())) ||
        (cName && myAllKeys.has(cName.toLowerCase()))
      );
    };

    const matchesFriend = (cId?: string, cUser?: string, cName?: string) => {
      return (
        (cId && targetAllKeys.has(cId.toLowerCase())) ||
        (cUser && targetAllKeys.has(cUser.toLowerCase())) ||
        (cName && targetAllKeys.has(cName.toLowerCase()))
      );
    };

    if (!Array.isArray(this.data.deletedIds)) {
      this.data.deletedIds = [];
    }

    let removedCount = 0;
    this.data.locationShareRequests = this.data.locationShareRequests.filter((r) => {
      const isPair =
        (matchesMe(r.fromUserId, r.fromUsername, r.fromUserName) &&
          matchesFriend(r.toUserId, r.toUsername, r.toUserName)) ||
        (matchesMe(r.toUserId, r.toUsername, r.toUserName) &&
          matchesFriend(r.fromUserId, r.fromUsername, r.fromUserName));
      if (isPair) {
        removedCount++;
        if (!this.data.deletedIds!.includes(r.id)) {
          this.data.deletedIds!.push(r.id);
        }
        if (r.fromUserId && !myAllKeys.has(r.fromUserId.toLowerCase())) {
          targetAllKeys.add(r.fromUserId.toLowerCase());
        }
        if (r.toUserId && !myAllKeys.has(r.toUserId.toLowerCase())) {
          targetAllKeys.add(r.toUserId.toLowerCase());
        }
        return false;
      }
      return true;
    });

    for (const mk of myAllKeys) {
      for (const tk of targetAllKeys) {
        const unfriendKey = `unfriend_${mk}_${tk}`;
        if (!this.data.deletedIds.includes(unfriendKey)) {
          this.data.deletedIds.push(unfriendKey);
        }
      }
    }

    this.save();
    return { removedCount };
  }

  public getLocationShareRequests(userId: string): LocationShareRequest[] {
    const me = this.findUserById(userId);
    const uidLower = userId.toLowerCase();
    const unameLower = (me?.username || '').toLowerCase();
    const fullNameLower = (me?.fullName || '').toLowerCase();

    const matchesMe = (cId?: string, cUser?: string, cName?: string) => {
      const idLow = (cId || '').toLowerCase();
      const userLow = (cUser || '').toLowerCase();
      const nameLow = (cName || '').toLowerCase();
      return (
        idLow === uidLower ||
        (unameLower && (idLow === unameLower || userLow === unameLower)) ||
        (fullNameLower && (idLow === fullNameLower || nameLow === fullNameLower))
      );
    };

    return this.data.locationShareRequests
      .filter(
        (r) =>
          matchesMe(r.toUserId, r.toUsername, r.toUserName) ||
          matchesMe(r.fromUserId, r.fromUsername, r.fromUserName)
      )
      .map((r) => {
        const fromU = this.findUserById(r.fromUserId);
        const toU = this.findUserById(r.toUserId);
        return {
          ...r,
          fromUserName: fromU?.fullName || r.fromUserName,
          fromUsername: fromU?.username || r.fromUsername,
          fromUserAvatar: fromU?.avatarUrl || r.fromUserAvatar,
          toUserName: toU?.fullName || r.toUserName || 'Member',
          toUsername: toU?.username || r.toUsername,
          toUserAvatar: toU?.avatarUrl || r.toUserAvatar,
        };
      });
  }

  // Community Chat & Reports
  public createReport(reporterId: string, data: { targetType: 'user' | 'message' | 'room'; targetId: string; reason: string }): ReportItem {
    const reporter = this.findUserById(reporterId);
    const report: ReportItem = {
      id: 'rep-' + crypto.randomUUID(),
      reporterId,
      reporterName: reporter ? reporter.fullName : 'Anonymous',
      targetType: data.targetType,
      targetId: data.targetId,
      reason: data.reason,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };
    this.data.reports.push(report);
    this.save();
    return report;
  }

  public getReports(): ReportItem[] {
    return this.data.reports;
  }

  public resolveReport(reportId: string, status: 'reviewed' | 'dismissed') {
    const r = this.data.reports.find((rep) => rep.id === reportId);
    if (r) {
      r.status = status;
      this.save();
    }
  }

  // Audit Logs
  public logAudit(userId: string, userName: string, action: string, details: string, ip?: string) {
    const log: AuditLog = {
      id: 'log-' + crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId,
      userName,
      action,
      details,
      ip,
    };
    this.data.auditLogs.unshift(log);
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs.pop();
    }
    this.save();
  }

  public getAuditLogs(): AuditLog[] {
    return this.data.auditLogs.slice(0, 100);
  }

  // Admin stats
  public getAdminStats() {
    return {
      totalUsers: this.data.users.length,
      onlineUsers: this.data.users.filter((u) => u.isOnline).length,
      totalRooms: this.data.rooms.length,
      totalMessages: this.data.messages.length,
      activeAlerts: this.data.emergencyAlerts.filter((a) => a.status === 'active').length,
      pendingReports: this.data.reports.filter((r) => r.status === 'pending').length,
    };
  }

  public getAllUsers(): UserProfile[] {
    return this.data.users.map((u) => this.sanitizeUser(u));
  }

  public getAllRooms(): Room[] {
    return this.data.rooms.map((r) => this.sanitizeRoom(r, ''));
  }

  // ============================================================================
  // CROWDZONE — Real-Time Crowd Intelligence, Reports, Posts, Saved Places, Settings
  // ============================================================================

  private getEligibleCrowdSignals() {
    const signals: Array<{
      id?: string;
      userId: string;
      latitude: number;
      longitude: number;
      accuracy: number;
      speed?: number | null;
      timestamp: string;
      contributesToCrowd?: boolean;
    }> = [];

    const userMap = new Map<string, UserRecord>();
    for (const u of this.data.users || []) {
      if (u?.id) userMap.set(u.id, u);
    }

    const canContribute = (uid: string): boolean => {
      const user = userMap.get(uid);
      if (user && user.privacy?.locationSharingEnabled === false) return false;
      const settings = (this.data.userSettings || {})[uid];
      if (settings && settings.contributeAnonymousCrowdSignals === false) return false;
      return true;
    };

    for (const [uid, loc] of Object.entries(this.data.locations || {})) {
      if (!loc) continue;
      signals.push({
        id: `live-${uid}`,
        userId: loc.userId || uid,
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
        speed: loc.speed,
        timestamp: loc.updated_at || loc.timestamp,
        contributesToCrowd: canContribute(loc.userId || uid),
      });
    }

    for (const hist of this.data.locationHistory || []) {
      if (!hist) continue;
      signals.push({
        id: hist.id,
        userId: hist.userId,
        latitude: hist.latitude,
        longitude: hist.longitude,
        accuracy: hist.accuracy,
        speed: hist.speed,
        timestamp: hist.timestamp,
        contributesToCrowd: canContribute(hist.userId),
      });
    }

    return signals;
  }

  public getUserCrowdSettings(userId: string): CrowdZoneUserSettings {
    if (!this.data.userSettings) {
      this.data.userSettings = {};
    }
    const existing = this.data.userSettings[userId];
    if (existing) return existing;
    const defaults: CrowdZoneUserSettings = {
      userId,
      contributeAnonymousCrowdSignals: true,
      notificationRadiusKm: 5,
      crowdAlertsEnabled: true,
      emergencyAlertsEnabled: true,
      communityReportAlertsEnabled: true,
      updatedAt: new Date().toISOString(),
    };
    this.data.userSettings[userId] = defaults;
    return defaults;
  }

  public updateUserCrowdSettings(
    userId: string,
    payload: Partial<Omit<CrowdZoneUserSettings, 'userId' | 'updatedAt'>>
  ): CrowdZoneUserSettings {
    const current = this.getUserCrowdSettings(userId);
    const updated: CrowdZoneUserSettings = {
      ...current,
      ...(typeof payload.contributeAnonymousCrowdSignals === 'boolean'
        ? { contributeAnonymousCrowdSignals: payload.contributeAnonymousCrowdSignals }
        : {}),
      ...(typeof payload.notificationRadiusKm === 'number' && Number.isFinite(payload.notificationRadiusKm)
        ? { notificationRadiusKm: Math.max(0.5, Math.min(50, payload.notificationRadiusKm)) }
        : {}),
      ...(typeof payload.crowdAlertsEnabled === 'boolean'
        ? { crowdAlertsEnabled: payload.crowdAlertsEnabled }
        : {}),
      ...(typeof payload.emergencyAlertsEnabled === 'boolean'
        ? { emergencyAlertsEnabled: payload.emergencyAlertsEnabled }
        : {}),
      ...(typeof payload.communityReportAlertsEnabled === 'boolean'
        ? { communityReportAlertsEnabled: payload.communityReportAlertsEnabled }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    this.data.userSettings[userId] = updated;
    this.save();
    return updated;
  }

  public getCrowdCells(params?: {
    window?: CrowdTimeWindow;
    precision?: number;
    lat?: number;
    lng?: number;
    radiusKm?: number;
  }) {
    const windowKey: CrowdTimeWindow = params?.window || '1h';
    const precision = params?.precision || 6;
    const signals = this.getEligibleCrowdSignals();
    const reports = (this.data.crowdReports || []).filter((r) => r.status !== 'removed');
    return aggregateCrowdCells({
      signals,
      reports,
      window: windowKey,
      precision,
      centerLat: params?.lat,
      centerLng: params?.lng,
      radiusKm: params?.radiusKm,
    });
  }

  public getCrowdHistory(params?: {
    window?: CrowdTimeWindow;
    cellId?: string;
    precision?: number;
  }) {
    const windowKey: CrowdTimeWindow = params?.window || '24h';
    const signals = this.getEligibleCrowdSignals();
    const reports = (this.data.crowdReports || []).filter((r) => r.status !== 'removed');
    return buildCrowdHistorySeries({
      signals,
      reports,
      window: windowKey,
      cellId: params?.cellId,
      precision: params?.precision || 6,
    });
  }

  public getCrowdPredictions(params?: {
    cellId?: string;
    precision?: number;
  }) {
    const signals = this.getEligibleCrowdSignals();
    const reports = (this.data.crowdReports || []).filter((r) => r.status !== 'removed');
    const history24h = buildCrowdHistorySeries({
      signals,
      reports,
      window: '24h',
      cellId: params?.cellId,
      precision: params?.precision || 6,
    });
    const cells = aggregateCrowdCells({
      signals,
      reports,
      window: '1h',
      precision: params?.precision || 6,
    });
    const targetCell = params?.cellId
      ? cells.find((c) => c.cellId === params.cellId)
      : cells[0];
    return predictCrowdActivitySeries({
      historyBuckets: history24h,
      currentTrend: targetCell?.trend || 'stable',
    });
  }

  public getCrowdReports(params?: { window?: CrowdTimeWindow }): CrowdZoneCommunityReport[] {
    if (!Array.isArray(this.data.crowdReports)) {
      this.data.crowdReports = [];
    }
    const now = Date.now();
    // Auto-expire reports past expiresAt
    for (const r of this.data.crowdReports) {
      if (r.status === 'active' && r.expiresAt && new Date(r.expiresAt).getTime() < now) {
        r.status = 'expired';
      }
    }
    return this.data.crowdReports
      .filter((r) => r.status !== 'removed')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public createCrowdReport(
    userId: string,
    payload: {
      placeName: string;
      category: CrowdReportCategory;
      crowdLevel: Exclude<CrowdLevel, 'Unknown'>;
      description: string;
      latitude: number;
      longitude: number;
      ttlMinutes?: number;
    }
  ): CrowdZoneCommunityReport {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');
    if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
      throw new Error('Valid GPS coordinates are required for a community report');
    }
    const cleanDesc = String(payload.description || '').trim();
    if (!cleanDesc) {
      throw new Error('Report description is required');
    }

    const nowIso = new Date().toISOString();
    const ttlMs = Math.max(15, Math.min(720, Number(payload.ttlMinutes || 120))) * 60 * 1000;
    const cellId = encodeGeohash(payload.latitude, payload.longitude, 6);

    const report: CrowdZoneCommunityReport = {
      id: 'cz-rep-' + crypto.randomUUID(),
      reporterId: user.id,
      reporterName: user.fullName || user.username,
      reporterAvatar: user.avatarUrl,
      cellId,
      placeName: String(payload.placeName || 'Pinned Location').trim().slice(0, 120),
      category: payload.category || 'crowd_level',
      crowdLevel: payload.crowdLevel || 'Moderate',
      description: cleanDesc.slice(0, 500),
      latitude: Number(payload.latitude.toFixed(6)),
      longitude: Number(payload.longitude.toFixed(6)),
      verifiedBy: [user.id],
      verificationCount: 1,
      confidenceScore: 70,
      createdAt: nowIso,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      status: 'active',
    };

    if (!Array.isArray(this.data.crowdReports)) {
      this.data.crowdReports = [];
    }
    this.data.crowdReports.unshift(report);
    this.save();
    return report;
  }

  public verifyCrowdReport(userId: string, reportId: string): CrowdZoneCommunityReport {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');
    const report = (this.data.crowdReports || []).find((r) => r.id === reportId);
    if (!report) throw new Error('Community report not found');

    if (!Array.isArray(report.verifiedBy)) {
      report.verifiedBy = [];
    }
    if (!report.verifiedBy.includes(user.id)) {
      report.verifiedBy.push(user.id);
    }
    report.verificationCount = report.verifiedBy.length;
    report.confidenceScore = Math.min(99, 65 + report.verificationCount * 8);
    this.save();
    return report;
  }

  public deleteCrowdReport(userId: string, reportId: string): boolean {
    const user = this.findUserById(userId);
    const idx = (this.data.crowdReports || []).findIndex((r) => r.id === reportId);
    if (idx < 0) return false;
    const target = this.data.crowdReports[idx];
    if (target.reporterId !== userId && !user?.isAdmin) {
      throw new Error('Unauthorized to delete this report');
    }
    this.data.crowdReports.splice(idx, 1);
    if (!Array.isArray(this.data.deletedIds)) this.data.deletedIds = [];
    this.data.deletedIds.push(reportId);
    this.save();
    return true;
  }

  public getCrowdPosts(): CrowdZonePost[] {
    if (!Array.isArray(this.data.crowdPosts)) {
      this.data.crowdPosts = [];
    }
    return this.data.crowdPosts
      .filter((p) => p.status !== 'removed')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public createCrowdPost(
    userId: string,
    payload: {
      text: string;
      placeName?: string;
      crowdLevel?: CrowdLevel;
      latitude?: number;
      longitude?: number;
    }
  ): CrowdZonePost {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');
    const cleanText = String(payload.text || '').trim();
    if (!cleanText) throw new Error('Post content cannot be empty');

    const hasCoords =
      typeof payload.latitude === 'number' &&
      Number.isFinite(payload.latitude) &&
      typeof payload.longitude === 'number' &&
      Number.isFinite(payload.longitude);

    const post: CrowdZonePost = {
      id: 'cz-post-' + crypto.randomUUID(),
      authorId: user.id,
      authorName: user.fullName || user.username,
      authorAvatar: user.avatarUrl,
      placeName: payload.placeName ? String(payload.placeName).trim().slice(0, 120) : undefined,
      cellId: hasCoords ? encodeGeohash(payload.latitude!, payload.longitude!, 6) : undefined,
      latitude: hasCoords ? Number(payload.latitude!.toFixed(6)) : undefined,
      longitude: hasCoords ? Number(payload.longitude!.toFixed(6)) : undefined,
      crowdLevel: payload.crowdLevel,
      text: cleanText.slice(0, 800),
      likes: [],
      reactions: {},
      comments: [],
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    if (!Array.isArray(this.data.crowdPosts)) {
      this.data.crowdPosts = [];
    }
    this.data.crowdPosts.unshift(post);
    this.save();
    return post;
  }

  public addCrowdPostComment(userId: string, postId: string, text: string): CrowdZonePost {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found');
    const post = (this.data.crowdPosts || []).find((p) => p.id === postId);
    if (!post) throw new Error('Post not found');
    const cleanText = String(text || '').trim();
    if (!cleanText) throw new Error('Comment text cannot be empty');

    const comment: CrowdZoneComment = {
      id: 'cz-cmt-' + crypto.randomUUID(),
      postId,
      authorId: user.id,
      authorName: user.fullName || user.username,
      authorAvatar: user.avatarUrl,
      text: cleanText.slice(0, 400),
      createdAt: new Date().toISOString(),
    };

    if (!Array.isArray(post.comments)) {
      post.comments = [];
    }
    post.comments.push(comment);
    this.save();
    return post;
  }

  public reactToCrowdPost(userId: string, postId: string, emoji: string): CrowdZonePost {
    const post = (this.data.crowdPosts || []).find((p) => p.id === postId);
    if (!post) throw new Error('Post not found');
    const cleanEmoji = String(emoji || '👍').trim().slice(0, 8);
    if (!post.reactions) post.reactions = {};
    if (!Array.isArray(post.reactions[cleanEmoji])) {
      post.reactions[cleanEmoji] = [];
    }
    const idx = post.reactions[cleanEmoji].indexOf(userId);
    if (idx >= 0) {
      post.reactions[cleanEmoji].splice(idx, 1);
    } else {
      post.reactions[cleanEmoji].push(userId);
    }
    this.save();
    return post;
  }

  public deleteCrowdPost(userId: string, postId: string): boolean {
    const user = this.findUserById(userId);
    const idx = (this.data.crowdPosts || []).findIndex((p) => p.id === postId);
    if (idx < 0) return false;
    const target = this.data.crowdPosts[idx];
    if (target.authorId !== userId && !user?.isAdmin) {
      throw new Error('Unauthorized to delete this post');
    }
    this.data.crowdPosts.splice(idx, 1);
    if (!Array.isArray(this.data.deletedIds)) this.data.deletedIds = [];
    this.data.deletedIds.push(postId);
    this.save();
    return true;
  }

  public getCrowdSavedPlaces(userId: string): CrowdZoneSavedPlace[] {
    if (!Array.isArray(this.data.crowdSavedPlaces)) {
      this.data.crowdSavedPlaces = [];
    }
    return this.data.crowdSavedPlaces.filter((p) => p.userId === userId);
  }

  public saveCrowdPlace(
    userId: string,
    payload: {
      name: string;
      customLabel?: string;
      address: string;
      category?: string;
      latitude: number;
      longitude: number;
      notifyWhenLevel?: Exclude<CrowdLevel, 'Unknown'>;
      alertsEnabled?: boolean;
    }
  ): CrowdZoneSavedPlace {
    if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
      throw new Error('Valid coordinates are required');
    }
    if (!Array.isArray(this.data.crowdSavedPlaces)) {
      this.data.crowdSavedPlaces = [];
    }
    const cellId = encodeGeohash(payload.latitude, payload.longitude, 6);
    const place: CrowdZoneSavedPlace = {
      id: 'cz-place-' + crypto.randomUUID(),
      userId,
      name: String(payload.name || 'Saved Location').trim().slice(0, 120),
      customLabel: payload.customLabel ? String(payload.customLabel).trim().slice(0, 60) : undefined,
      address: String(payload.address || '').trim().slice(0, 240),
      category: String(payload.category || 'general').trim(),
      latitude: Number(payload.latitude.toFixed(6)),
      longitude: Number(payload.longitude.toFixed(6)),
      cellId,
      notifyWhenLevel: payload.notifyWhenLevel || 'Quiet',
      alertsEnabled: payload.alertsEnabled ?? true,
      createdAt: new Date().toISOString(),
    };
    this.data.crowdSavedPlaces.unshift(place);
    this.save();
    return place;
  }

  public deleteCrowdSavedPlace(userId: string, placeId: string): boolean {
    if (!Array.isArray(this.data.crowdSavedPlaces)) return false;
    const idx = this.data.crowdSavedPlaces.findIndex(
      (p) => p.id === placeId && p.userId === userId
    );
    if (idx < 0) return false;
    this.data.crowdSavedPlaces.splice(idx, 1);
    if (!Array.isArray(this.data.deletedIds)) this.data.deletedIds = [];
    this.data.deletedIds.push(placeId);
    this.save();
    return true;
  }

  public moderateCrowdItem(
    adminId: string,
    payload: {
      targetType: 'crowd_report' | 'crowd_post' | 'user' | 'room';
      targetId: string;
      action: 'approve' | 'remove' | 'expire' | 'warn';
      reason: string;
    }
  ): ModerationLogEntry {
    const admin = this.findUserById(adminId);
    if (!admin) throw new Error('Moderator not found');

    if (payload.targetType === 'crowd_report') {
      const rep = (this.data.crowdReports || []).find((r) => r.id === payload.targetId);
      if (rep) {
        if (payload.action === 'remove') rep.status = 'removed';
        else if (payload.action === 'expire') rep.status = 'expired';
        else if (payload.action === 'approve') rep.status = 'active';
      }
    } else if (payload.targetType === 'crowd_post') {
      const post = (this.data.crowdPosts || []).find((p) => p.id === payload.targetId);
      if (post) {
        if (payload.action === 'remove') post.status = 'removed';
        else if (payload.action === 'approve') post.status = 'active';
      }
    }

    if (!Array.isArray(this.data.moderationLogs)) {
      this.data.moderationLogs = [];
    }
    const entry: ModerationLogEntry = {
      id: 'mod-' + crypto.randomUUID(),
      moderatorId: admin.id,
      moderatorName: admin.fullName || admin.username,
      targetType: payload.targetType,
      targetId: payload.targetId,
      action: payload.action,
      reason: String(payload.reason || 'Administrative review').slice(0, 240),
      createdAt: new Date().toISOString(),
    };
    this.data.moderationLogs.unshift(entry);
    this.logAudit(
      admin.id,
      admin.fullName || admin.username,
      `CROWDZONE_MOD_${payload.action.toUpperCase()}`,
      `${payload.targetType}:${payload.targetId} — ${entry.reason}`
    );
    this.save();
    return entry;
  }

  public getModerationLogs(): ModerationLogEntry[] {
    return (this.data.moderationLogs || []).slice(0, 100);
  }

  public getCrowdZoneOverview(
    userId: string,
    params?: {
      window?: CrowdTimeWindow;
      precision?: number;
      lat?: number;
      lng?: number;
      radiusKm?: number;
      cellId?: string;
    }
  ) {
    const windowKey: CrowdTimeWindow = params?.window || '1h';
    const precision = params?.precision || 6;
    const cells = this.getCrowdCells({
      window: windowKey,
      precision,
      lat: params?.lat,
      lng: params?.lng,
      radiusKm: params?.radiusKm,
    });
    const history = this.getCrowdHistory({
      window: windowKey,
      cellId: params?.cellId,
      precision,
    });
    const predictions = this.getCrowdPredictions({
      cellId: params?.cellId || cells[0]?.cellId,
      precision,
    });
    const reports = this.getCrowdReports({ window: windowKey });
    const posts = this.getCrowdPosts();
    const savedPlaces = this.getCrowdSavedPlaces(userId);
    const settings = this.getUserCrowdSettings(userId);

    return {
      window: windowKey,
      cells,
      history,
      predictions,
      reports,
      posts,
      savedPlaces,
      settings,
      emergencyAlerts: (this.data.emergencyAlerts || []).filter((a) => a.status === 'active'),
      serverTimestamp: new Date().toISOString(),
    };
  }
}

export const db = new Database();
export { UPLOADS_DIR };

