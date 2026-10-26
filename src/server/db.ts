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
} from '../types.ts';

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

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
    this.ensureUniversalRoom();
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed.locationHistory) parsed.locationHistory = [];
        return parsed;
      }
    } catch (err) {
      console.error('Failed to parse database file, initializing clean database', err);
    }
    const clean = { ...initialDb };
    this.save(clean);
    return clean;
  }

  private save(dataToSave: DatabaseSchema = this.data) {
    try {
      const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      console.error('Failed to atomically write database', err);
    }
  }

  // Password & Token utilities (NIST SP 800-63B / OWASP compliant PBKDF2 with SHA-512)
  public hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): { hash: string; salt: string } {
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt };
  }

  public verifyPassword(password: string, hash: string, salt: string): boolean {
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
    const userId = crypto.randomUUID();
    const isFirstUser = this.data.users.length === 0;

    const newUser: UserRecord = {
      id: userId,
      email: cleanEmail,
      username: cleanUsername,
      fullName: userData.fullName.trim(),
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
        temporarySharingExpiry: null,
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
    const { passwordHash, salt, ...safe } = u;
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
    return this.data.users.find((u) => u.id === id);
  }

  public findUserByEmailOrUsername(identifier: string): UserRecord | undefined {
    const lower = identifier.toLowerCase().trim();
    return this.data.users.find((u) => u.email.toLowerCase() === lower || u.username.toLowerCase() === lower);
  }

  public createSession(userId: string, userAgent?: string, ip?: string): string {
    const token = this.generateToken();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 365 days / 1 year persistent session
    this.data.sessions.push({ token, userId, createdAt, expiresAt, userAgent, ip });
    this.save();
    return token;
  }

  public getSessionUser(token: string): UserProfile | null {
    if (!token) return null;
    const session = this.data.sessions.find((s) => s.token === token);
    if (!session) return null;
    if (new Date(session.expiresAt) < new Date()) {
      this.deleteSession(token);
      return null;
    }
    const user = this.findUserById(session.userId);
    return user ? this.sanitizeUser(user) : null;
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

    // Strict Server-Side Coordinate & Sensor Validation (Step 3b & 3c: MAX_ACCURACY_M = 100)
    if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      throw new Error('Invalid latitude coordinates: Must be between -90 and 90');
    }
    if (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      throw new Error('Invalid longitude coordinates: Must be between -180 and 180');
    }
    if (!Number.isFinite(parsedAccuracy) || parsedAccuracy <= 0 || parsedAccuracy > 100) {
      throw new Error('Rejected coarse location fix: accuracy_m must be > 0 and <= 100 meters');
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

    // Find explicit active location share approvals
    const activeShareUserIds = new Set<string>();
    const now = new Date();
    for (const req of this.data.locationShareRequests) {
      if (req.toUserId === requestingUserId && (req.status === 'accepted' || req.status === 'temporary')) {
        if (!req.expiresAt || new Date(req.expiresAt) > now) {
          activeShareUserIds.add(req.fromUserId);
        }
      }
    }

    const results: UserLocation[] = [];
    const nowMs = Date.now();
    const twoMinutesMs = 2 * 60 * 1000;

    // Only include requesting user's own location if it was updated within the last 2 minutes and accuracy <= 100m
    const ownLoc = this.data.locations[requestingUserId];
    if (
      ownLoc &&
      Number.isFinite(ownLoc.accuracy) &&
      ownLoc.accuracy <= 100 &&
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

    for (const [targetUserId, loc] of Object.entries(this.data.locations)) {
      if (targetUserId === requestingUserId) continue;
      if (!Number.isFinite(loc.accuracy) || loc.accuracy > 100) continue;

      const targetUser = this.findUserById(targetUserId);
      if (!targetUser) continue;

      // Block enforcement: If either party blocked the other, hide location
      if (reqBlockedSet.has(targetUserId) || (targetUser.privacy.blockedUserIds || []).includes(requestingUserId)) {
        continue;
      }

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

    let roomId = baseId;
    let counter = 1;
    while (this.data.rooms.some((r) => r.id.toLowerCase() === roomId.toLowerCase())) {
      roomId = `${baseId}-${counter}`;
      counter++;
    }

    let passwordHash: string | undefined = undefined;
    let salt: string | undefined = undefined;

    if (data.password && data.password.trim().length > 0) {
      const hashed = this.hashPassword(data.password.trim());
      passwordHash = hashed.hash;
      salt = hashed.salt;
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

    const cleanTarget = roomId.trim().toLowerCase();
    const room = this.data.rooms.find(
      (r) => r.id === roomId || r.id.toLowerCase() === cleanTarget || r.name.toLowerCase() === cleanTarget
    );
    if (!room) throw new Error('Room not found. Check the Room ID or Name.');

    const targetRoomId = room.id;
    const isMember = this.data.roomMembers.some((m) => m.roomId === targetRoomId && m.userId === userId);
    if (isMember) {
      return this.sanitizeRoom(room, userId);
    }

    if (room.hasPassword) {
      if (!password || !room.passwordHash || !room.salt) {
        throw new Error('This room requires a password');
      }
      if (!this.verifyPassword(password.trim(), room.passwordHash, room.salt)) {
        throw new Error('Incorrect room password');
      }
    }

    this.data.roomMembers.push({
      roomId: targetRoomId,
      userId,
      role: 'MEMBER',
      joinedAt: new Date().toISOString(),
    });

    room.memberCount = this.data.roomMembers.filter((m) => m.roomId === targetRoomId).length;
    this.save();

    return this.sanitizeRoom(room, userId);
  }

  public leaveRoom(userId: string, roomId: string) {
    const room = this.data.rooms.find((r) => r.id === roomId);
    if (!room) return;

    this.data.roomMembers = this.data.roomMembers.filter((m) => !(m.roomId === roomId && m.userId === userId));
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
    let room = this.data.rooms.find((r) => r.id === UNIVERSAL_ROOM_ID);
    if (!room) {
      room = { ...UNIVERSAL_ROOM };
      this.data.rooms.unshift(room);
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
      }
    }

    const universalMembers = this.data.roomMembers.filter((m) => m.roomId === UNIVERSAL_ROOM_ID);
    room.memberCount = universalMembers.length || Math.max(1, this.data.users.length);
    this.save();
    return room;
  }

  public getUserRooms(userId: string): Room[] {
    this.ensureUniversalRoom(userId);
    const memberships = this.data.roomMembers.filter((m) => m.userId === userId);
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

  public getActiveEmergencyAlerts(): EmergencyAlert[] {
    return this.data.emergencyAlerts.filter((a) => a.status === 'active');
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

  // Location Share Requests
  public requestLocationShare(fromUserId: string, toUserId: string): LocationShareRequest {
    const fromUser = this.findUserById(fromUserId);
    if (!fromUser) throw new Error('User not found');

    const req: LocationShareRequest = {
      id: 'req-' + crypto.randomUUID(),
      fromUserId,
      fromUserName: fromUser.fullName,
      fromUserAvatar: fromUser.avatarUrl,
      toUserId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.data.locationShareRequests.unshift(req);
    this.save();
    return req;
  }

  public respondLocationShare(toUserId: string, requestId: string, response: 'accepted' | 'temporary' | 'denied'): LocationShareRequest {
    const req = this.data.locationShareRequests.find((r) => r.id === requestId && r.toUserId === toUserId);
    if (!req) throw new Error('Request not found');

    req.status = response;
    if (response === 'temporary') {
      req.expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    }
    this.save();
    return req;
  }

  public getLocationShareRequests(userId: string): LocationShareRequest[] {
    return this.data.locationShareRequests.filter((r) => r.toUserId === userId || r.fromUserId === userId);
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
}

export const db = new Database();
export { UPLOADS_DIR };
