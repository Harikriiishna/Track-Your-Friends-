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
  UserSession,
  UserPathTrail,
  LocationBreadcrumb,
} from '../types.ts';

interface LocalUserRecord extends UserProfile {
  password?: string;
}

interface LocalRoomRecord extends Room {
  password?: string;
}

interface LocalDatabaseSchema {
  users: LocalUserRecord[];
  sessions: Array<{
    token: string;
    userId: string;
    createdAt: string;
    expiresAt: string;
    userAgent?: string;
    ip?: string;
  }>;
  rooms: LocalRoomRecord[];
  roomMembers: Array<{ roomId: string; userId: string; role: UserRole; joinedAt: string }>;
  locations: Record<string, UserLocation>;
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

const STORAGE_KEY = 'beacon_local_db_v1';
const UNIVERSAL_ROOM_ID = 'room-universal';

const UNIVERSAL_ROOM: LocalRoomRecord = {
  id: UNIVERSAL_ROOM_ID,
  name: '🌐 Universal Lounge',
  description:
    'The open global town square for everyone on Beacon. Coordinate live locations, chat across channels, and meet members worldwide.',
  iconUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=128&q=80',
  ownerId: 'system',
  hasPassword: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  memberCount: 1,
  isPrivate: false,
  isUniversal: true,
};

function generateId(prefix = ''): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}-${rand}` : rand;
}

function haversineDistMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

class LocalBackendEngine {
  private data: LocalDatabaseSchema;

  constructor() {
    this.data = this.load();
    this.ensureUniversalRoom();
    this.syncCachedAuthFromStorage();
  }

  private getInitialSchema(): LocalDatabaseSchema {
    return {
      users: [],
      sessions: [],
      rooms: [{ ...UNIVERSAL_ROOM }],
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
  }

  private load(): LocalDatabaseSchema {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...this.getInitialSchema(),
          ...parsed,
        };
      }
    } catch (e) {
      console.warn('Failed to load local DB, initializing clean store:', e);
    }
    return this.getInitialSchema();
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to persist local DB:', e);
    }
  }

  public syncCachedAuthFromStorage() {
    try {
      const savedUserRaw = localStorage.getItem('beacon_user_profile');
      const savedToken = localStorage.getItem('beacon_token');
      if (savedUserRaw) {
        const savedUser = JSON.parse(savedUserRaw) as UserProfile;
        if (savedUser && savedUser.id) {
          this.syncUserSession(savedUser, savedToken || undefined);
        }
      }
    } catch {
      // ignore
    }
  }

  public syncUserSession(user: UserProfile, token?: string | null) {
    if (!user || !user.id) return;
    const existingIdx = this.data.users.findIndex(
      (u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase()
    );
    if (existingIdx >= 0) {
      this.data.users[existingIdx] = {
        ...this.data.users[existingIdx],
        ...user,
      };
    } else {
      this.data.users.push({
        ...user,
        password: 'password123',
      });
    }

    const effectiveUserId = existingIdx >= 0 ? this.data.users[existingIdx].id : user.id;
    this.ensureUniversalRoom(effectiveUserId);

    if (token) {
      const hasSession = this.data.sessions.some((s) => s.token === token);
      if (!hasSession) {
        const now = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        this.data.sessions.push({
          token,
          userId: effectiveUserId,
          createdAt: now,
          expiresAt,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Mobile Client',
          ip: 'Device Local',
        });
      }
    }

    this.save();
  }

  private sanitizeUser(u: LocalUserRecord): UserProfile {
    const { password, ...safe } = u;
    return safe;
  }

  private ensureUniversalRoom(userId?: string): LocalRoomRecord {
    let room = this.data.rooms.find((r) => r.id === UNIVERSAL_ROOM_ID);
    if (!room) {
      room = { ...UNIVERSAL_ROOM };
      this.data.rooms.unshift(room);
    } else {
      room.isUniversal = true;
      room.hasPassword = false;
      room.isPrivate = false;
    }

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
      const alreadyMember = this.data.roomMembers.some(
        (m) => m.roomId === UNIVERSAL_ROOM_ID && m.userId === userId
      );
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
    room.memberCount = Math.max(1, universalMembers.length, this.data.users.length);
    return room;
  }

  private getRoomMembers(roomId: string): RoomMember[] {
    const members = this.data.roomMembers.filter((m) => m.roomId === roomId);
    return members.map((m) => {
      const u = this.data.users.find((usr) => usr.id === m.userId);
      const safeUser: UserProfile = u
        ? this.sanitizeUser(u)
        : {
            id: m.userId,
            email: '',
            username: 'Member',
            fullName: 'Community Member',
            avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.userId)}`,
            about: 'Member of Beacon Community',
            phoneNumber: '',
            createdAt: new Date().toISOString(),
            isOnline: true,
            lastSeen: new Date().toISOString(),
            privacy: {
              locationVisibility: 'room_members',
              phoneVisibility: 'room_members',
              profileVisibility: 'public',
              showOnlineStatus: true,
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

  private sanitizeRoom(r: LocalRoomRecord): Room {
    const { password, ...safe } = r;
    const members = this.getRoomMembers(r.id);
    return {
      ...safe,
      members,
      memberCount: Math.max(1, members.length),
    };
  }

  private getAuthenticatedUser(token?: string | null): LocalUserRecord | null {
    this.syncCachedAuthFromStorage();
    if (token) {
      const session = this.data.sessions.find((s) => s.token === token);
      if (session) {
        const found = this.data.users.find((u) => u.id === session.userId);
        if (found) return found;
      }
    }
    try {
      const savedUserRaw = localStorage.getItem('beacon_user_profile');
      if (savedUserRaw) {
        const parsed = JSON.parse(savedUserRaw) as UserProfile;
        const found = this.data.users.find((u) => u.id === parsed.id || u.email === parsed.email);
        if (found) return found;
      }
    } catch {
      // ignore
    }
    return this.data.users[0] || null;
  }

  private createSession(userId: string): string {
    const token = generateId('tok') + generateId();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    this.data.sessions.push({
      token,
      userId,
      createdAt,
      expiresAt,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Mobile / Web Client',
      ip: 'Local Device',
    });
    this.save();
    return token;
  }

  private createError(message: string, status = 400, extra: Record<string, any> = {}): Error {
    const err: any = new Error(message);
    err.status = status;
    Object.assign(err, extra);
    return err;
  }

  public async handleRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string | null
  ): Promise<T> {
    const method = (options.method || 'GET').toUpperCase();
    const urlObj = new URL(endpoint, 'http://localhost');
    const pathname = urlObj.pathname;
    const query = urlObj.searchParams;

    let body: any = {};
    if (options.body && typeof options.body === 'string') {
      try {
        body = JSON.parse(options.body);
      } catch {
        body = {};
      }
    }

    // 1. AUTHENTICATION ENDPOINTS
    if (method === 'POST' && pathname === '/api/auth/register') {
      const { email, username, fullName, password, phoneNumber, avatarUrl } = body;
      if (!email || !username || !fullName || !password) {
        throw this.createError('Missing required registration fields', 400);
      }
      if (String(password).length < 6) {
        throw this.createError('Password must be at least 6 characters long', 400);
      }

      const cleanEmail = String(email).trim().toLowerCase();
      const cleanUsername = String(username).trim();

      const existingEmail = this.data.users.find((u) => u.email.toLowerCase() === cleanEmail);
      if (existingEmail) {
        // If user submits the same credentials or registers again on device, update & sign them in seamlessly
        existingEmail.fullName = String(fullName).trim() || existingEmail.fullName;
        existingEmail.username = cleanUsername || existingEmail.username;
        existingEmail.password = String(password);
        if (phoneNumber) existingEmail.phoneNumber = String(phoneNumber).trim();
        existingEmail.isOnline = true;
        existingEmail.lastSeen = new Date().toISOString();
        this.ensureUniversalRoom(existingEmail.id);
        const sessionToken = this.createSession(existingEmail.id);
        this.save();
        return { user: this.sanitizeUser(existingEmail), token: sessionToken } as unknown as T;
      }

      const existingUsername = this.data.users.find(
        (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
      );
      if (existingUsername) {
        throw this.createError(
          `The username "${cleanUsername}" is already taken. Please choose another username.`,
          400,
          { code: 'USERNAME_TAKEN', username: cleanUsername }
        );
      }

      const userId = generateId('usr');
      const isFirstUser = this.data.users.length === 0;
      const newUser: LocalUserRecord = {
        id: userId,
        email: cleanEmail,
        username: cleanUsername,
        fullName: String(fullName).trim(),
        avatarUrl:
          avatarUrl ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(String(fullName).trim())}`,
        about: 'Member of Beacon Community',
        phoneNumber: phoneNumber ? String(phoneNumber).trim() : '',
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
        isAdmin: isFirstUser,
        password: String(password),
      };

      this.data.users.push(newUser);
      this.ensureUniversalRoom(newUser.id);
      const sessionToken = this.createSession(newUser.id);
      this.save();

      return { user: this.sanitizeUser(newUser), token: sessionToken } as unknown as T;
    }

    if (method === 'POST' && pathname === '/api/auth/login') {
      const { identifier, password } = body;
      if (!identifier || !password) {
        throw this.createError('Username/email and password required', 400);
      }
      const cleanId = String(identifier).trim();
      const lower = cleanId.toLowerCase();
      const userRec = this.data.users.find(
        (u) => u.email.toLowerCase() === lower || u.username.toLowerCase() === lower
      );

      if (!userRec) {
        throw this.createError(
          `No account found for "${cleanId}". Please check for typos or click Create Account.`,
          404,
          {
            code: 'USER_NOT_FOUND',
            suggestion: 'register',
            identifier: cleanId,
          }
        );
      }

      if (
        userRec.password &&
        userRec.password !== String(password) &&
        userRec.password !== String(password).trim()
      ) {
        throw this.createError(
          `Incorrect password for ${userRec.email}. Tap "Reset Password" to set a new password.`,
          401,
          {
            code: 'INVALID_PASSWORD',
            suggestion: 'reset',
            email: userRec.email,
            username: userRec.username,
          }
        );
      }

      userRec.isOnline = true;
      userRec.lastSeen = new Date().toISOString();
      this.ensureUniversalRoom(userRec.id);
      const sessionToken = this.createSession(userRec.id);
      this.save();

      return { user: this.sanitizeUser(userRec), token: sessionToken } as unknown as T;
    }

    if (method === 'POST' && pathname === '/api/auth/quick-reset') {
      const { identifier, newPassword } = body;
      if (!identifier || !newPassword) {
        throw this.createError('Username or email and new password required', 400);
      }
      if (String(newPassword).length < 6) {
        throw this.createError('Password must be at least 6 characters long', 400);
      }
      const cleanId = String(identifier).trim();
      const lower = cleanId.toLowerCase();
      let userRec = this.data.users.find(
        (u) => u.email.toLowerCase() === lower || u.username.toLowerCase() === lower
      );

      if (!userRec) {
        // Create account on the fly if quick-resetting on a new device
        const isEmail = cleanId.includes('@');
        const derivedUsername = isEmail ? cleanId.split('@')[0] : cleanId;
        const derivedEmail = isEmail ? lower : `${lower}@beacon.local`;
        userRec = {
          id: generateId('usr'),
          email: derivedEmail,
          username: derivedUsername,
          fullName: derivedUsername,
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(derivedUsername)}`,
          about: 'Member of Beacon Community',
          phoneNumber: '',
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
          isAdmin: this.data.users.length === 0,
          password: String(newPassword),
        };
        this.data.users.push(userRec);
      } else {
        userRec.password = String(newPassword);
      }

      this.ensureUniversalRoom(userRec.id);
      const sessionToken = this.createSession(userRec.id);
      this.save();

      return {
        success: true,
        message: 'Password updated successfully! Logged in.',
        user: this.sanitizeUser(userRec),
        token: sessionToken,
      } as unknown as T;
    }

    if (method === 'POST' && pathname === '/api/auth/demo-login') {
      let targetUser = this.data.users[0];
      if (!targetUser) {
        targetUser = {
          id: generateId('usr'),
          email: 'demo@beacon.network',
          username: 'alex_beacon',
          fullName: 'Alex Morgan',
          avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Alex%20Morgan',
          about: 'Beacon Explorer & Mesh Coordinator',
          phoneNumber: '+1 555-0199',
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
          isAdmin: true,
          password: 'password123',
        };
        this.data.users.push(targetUser);
      }
      this.ensureUniversalRoom(targetUser.id);
      const sessionToken = this.createSession(targetUser.id);
      this.save();
      return { user: this.sanitizeUser(targetUser), token: sessionToken } as unknown as T;
    }

    if (method === 'GET' && pathname === '/api/auth/me') {
      const user = this.getAuthenticatedUser(token);
      if (!user) {
        throw this.createError('Invalid or expired session', 401);
      }
      return { user: this.sanitizeUser(user) } as unknown as T;
    }

    if (method === 'POST' && pathname === '/api/auth/logout') {
      if (token) {
        this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
        this.save();
      }
      return { success: true } as unknown as T;
    }

    if (method === 'POST' && pathname === '/api/auth/password-reset/request') {
      const cleanEmail = String(body.email || '').trim();
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      this.data.passwordResets = this.data.passwordResets.filter(
        (r) => r.email.toLowerCase() !== cleanEmail.toLowerCase()
      );
      this.data.passwordResets.push({
        email: cleanEmail,
        token: code,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
      this.save();
      return {
        success: true,
        message: 'Verification code generated.',
        code,
        email: cleanEmail,
      } as unknown as T;
    }

    if (method === 'POST' && pathname === '/api/auth/password-reset/confirm') {
      const { token: resetToken, newPassword } = body;
      const rec = this.data.passwordResets.find((r) => r.token === String(resetToken).trim());
      const userRec = rec
        ? this.data.users.find((u) => u.email.toLowerCase() === rec.email.toLowerCase())
        : this.data.users[0];
      if (!userRec) {
        throw this.createError('User not found', 404);
      }
      userRec.password = String(newPassword);
      this.save();
      return { success: true, user: this.sanitizeUser(userRec) } as unknown as T;
    }

    // Authenticated user context for remaining routes
    const currentUser = this.getAuthenticatedUser(token);

    if (method === 'GET' && pathname === '/api/auth/sessions') {
      if (!currentUser) return { sessions: [] } as unknown as T;
      const sessions: UserSession[] = this.data.sessions
        .filter((s) => s.userId === currentUser.id)
        .map((s) => ({
          token: s.token.slice(0, 8) + '...',
          fullToken: s.token === token ? s.token : undefined,
          userId: s.userId,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          userAgent: s.userAgent || 'Mobile / Web Client',
          ip: s.ip || 'Local Device',
          isCurrent: s.token === token,
        }));
      if (sessions.length === 0) {
        sessions.push({
          token: (token || 'active00').slice(0, 8) + '...',
          fullToken: token || undefined,
          userId: currentUser.id,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Mobile Client',
          ip: 'Local Device',
          isCurrent: true,
        });
      }
      return { sessions } as unknown as T;
    }

    if (method === 'POST' && pathname === '/api/auth/sessions/revoke') {
      if (currentUser && body.sessionToken) {
        const prefix = String(body.sessionToken).replace('...', '');
        this.data.sessions = this.data.sessions.filter(
          (s) => !(s.userId === currentUser.id && s.token.startsWith(prefix))
        );
        this.save();
      }
      return { success: true } as unknown as T;
    }

    if (method === 'POST' && pathname === '/api/auth/sessions/revoke-others') {
      let revokedCount = 0;
      if (currentUser) {
        const before = this.data.sessions.length;
        this.data.sessions = this.data.sessions.filter(
          (s) => s.userId !== currentUser.id || s.token === token
        );
        revokedCount = before - this.data.sessions.length;
        this.save();
      }
      return { success: true, revokedCount } as unknown as T;
    }

    // 2. PROFILE & PRIVACY
    if (method === 'PUT' && pathname === '/api/profile/update') {
      if (!currentUser) throw this.createError('Unauthorized', 401);
      if (body.fullName !== undefined) currentUser.fullName = body.fullName;
      if (body.about !== undefined) currentUser.about = body.about;
      if (body.phoneNumber !== undefined) currentUser.phoneNumber = body.phoneNumber;
      if (body.avatarUrl !== undefined) currentUser.avatarUrl = body.avatarUrl;
      if (body.markerColor !== undefined) currentUser.markerColor = body.markerColor;
      if (body.markerIcon !== undefined) currentUser.markerIcon = body.markerIcon;
      if (body.markerLabel !== undefined) currentUser.markerLabel = body.markerLabel;
      if (body.privacy !== undefined) {
        currentUser.privacy = { ...currentUser.privacy, ...body.privacy };
      }
      this.save();
      return { user: this.sanitizeUser(currentUser) } as unknown as T;
    }

    if (method === 'PUT' && pathname === '/api/privacy/update') {
      if (!currentUser) throw this.createError('Unauthorized', 401);
      currentUser.privacy = { ...currentUser.privacy, ...body };
      this.save();
      return { user: this.sanitizeUser(currentUser) } as unknown as T;
    }

    // 3. UPLOAD
    if (method === 'POST' && pathname === '/api/upload') {
      const { dataUrl, filename } = body;
      if (!dataUrl) throw this.createError('Missing dataUrl payload', 400);
      return {
        url: dataUrl,
        name: filename || `upload-${Date.now()}`,
        size: String(dataUrl).length,
      } as unknown as T;
    }

    // 4. ROOMS
    if (method === 'GET' && pathname === '/api/rooms') {
      const uid = currentUser?.id || 'guest';
      this.ensureUniversalRoom(uid);
      const memberships = this.data.roomMembers.filter((m) => m.userId === uid);
      const roomIds = new Set(memberships.map((m) => m.roomId));
      roomIds.add(UNIVERSAL_ROOM_ID);

      const rooms = this.data.rooms
        .filter((r) => roomIds.has(r.id) || r.id === UNIVERSAL_ROOM_ID)
        .map((r) => this.sanitizeRoom(r))
        .sort((a, b) => {
          if (a.id === UNIVERSAL_ROOM_ID) return -1;
          if (b.id === UNIVERSAL_ROOM_ID) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      return { rooms } as unknown as T;
    }

    if (method === 'POST' && pathname === '/api/rooms') {
      if (!currentUser) throw this.createError('Unauthorized', 401);
      const { name, description, password, iconUrl, isPrivate } = body;
      if (!name || !String(name).trim()) {
        throw this.createError('Room name is required', 400);
      }
      const cleanName = String(name).trim();
      let baseId = cleanName
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      if (!baseId) baseId = 'room';

      let roomId = baseId;
      let counter = 1;
      while (this.data.rooms.some((r) => r.id.toLowerCase() === roomId.toLowerCase())) {
        roomId = `${baseId}-${counter}`;
        counter++;
      }

      const newRoom: LocalRoomRecord = {
        id: roomId,
        name: cleanName,
        description: String(description || '').trim(),
        iconUrl,
        ownerId: currentUser.id,
        hasPassword: Boolean(password && String(password).trim()),
        password: password ? String(password).trim() : undefined,
        createdAt: new Date().toISOString(),
        memberCount: 1,
        isPrivate: isPrivate ?? true,
      };

      this.data.rooms.push(newRoom);
      this.data.roomMembers.push({
        roomId,
        userId: currentUser.id,
        role: 'OWNER',
        joinedAt: new Date().toISOString(),
      });
      this.save();
      return { room: this.sanitizeRoom(newRoom) } as unknown as T;
    }

    if (method === 'POST' && pathname === '/api/rooms/join') {
      if (!currentUser) throw this.createError('Unauthorized', 401);
      const { roomId, password } = body;
      if (!roomId) throw this.createError('Room ID is required', 400);
      const cleanTarget = String(roomId).trim().toLowerCase();
      let room = this.data.rooms.find(
        (r) =>
          r.id === roomId ||
          r.id.toLowerCase() === cleanTarget ||
          r.name.toLowerCase() === cleanTarget
      );

      if (!room) {
        throw this.createError('Room not found. Check the Room ID or Name.', 400);
      }

      if (room.hasPassword && room.password && room.password !== String(password || '').trim()) {
        throw this.createError('Incorrect room password', 400);
      }

      const isMember = this.data.roomMembers.some(
        (m) => m.roomId === room!.id && m.userId === currentUser.id
      );
      if (!isMember) {
        this.data.roomMembers.push({
          roomId: room.id,
          userId: currentUser.id,
          role: 'MEMBER',
          joinedAt: new Date().toISOString(),
        });
      }
      this.save();
      return { room: this.sanitizeRoom(room) } as unknown as T;
    }

    const roomDetailMatch = pathname.match(/^\/api\/rooms\/([^/]+)$/);
    if (method === 'GET' && roomDetailMatch) {
      const roomId = decodeURIComponent(roomDetailMatch[1]);
      if (roomId === UNIVERSAL_ROOM_ID) {
        this.ensureUniversalRoom(currentUser?.id);
      }
      const room = this.data.rooms.find(
        (r) => r.id === roomId || r.id.toLowerCase() === roomId.toLowerCase()
      );
      if (!room) throw this.createError('Room not found', 404);
      return { room: this.sanitizeRoom(room) } as unknown as T;
    }

    const roomLeaveMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/leave$/);
    if (method === 'POST' && roomLeaveMatch) {
      const roomId = decodeURIComponent(roomLeaveMatch[1]);
      if (currentUser) {
        this.data.roomMembers = this.data.roomMembers.filter(
          (m) => !(m.roomId === roomId && m.userId === currentUser.id)
        );
        this.save();
      }
      return { success: true } as unknown as T;
    }

    const roomRolesMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/roles$/);
    if (method === 'POST' && roomRolesMatch) {
      const roomId = decodeURIComponent(roomRolesMatch[1]);
      const { targetUserId, newRole } = body;
      const mem = this.data.roomMembers.find(
        (m) => m.roomId === roomId && m.userId === targetUserId
      );
      if (mem) {
        mem.role = newRole;
        this.save();
      }
      return { success: true } as unknown as T;
    }

    const roomKickMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/kick$/);
    if (method === 'POST' && roomKickMatch) {
      const roomId = decodeURIComponent(roomKickMatch[1]);
      const { targetUserId } = body;
      this.data.roomMembers = this.data.roomMembers.filter(
        (m) => !(m.roomId === roomId && m.userId === targetUserId)
      );
      this.save();
      return { success: true } as unknown as T;
    }

    // 5. CHAT MESSAGES
    const roomMsgsMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/messages$/);
    if (roomMsgsMatch) {
      const roomId = decodeURIComponent(roomMsgsMatch[1]);
      if (method === 'GET') {
        const limit = Number(query.get('limit')) || 50;
        const messages = this.data.messages
          .filter((m) => m.roomId === roomId && !m.isDeleted)
          .slice(-limit);
        return { messages } as unknown as T;
      }
      if (method === 'DELETE') {
        this.data.messages = this.data.messages.filter((m) => m.roomId !== roomId);
        this.save();
        return { success: true } as unknown as T;
      }
    }

    if (method === 'POST' && pathname === '/api/messages/create') {
      if (!currentUser) throw this.createError('Unauthorized', 401);
      const { roomId, channelId, recipientId, text, attachments, replyToId, clientMsgId } = body;
      let replyToText: string | undefined;
      let replyToSender: string | undefined;
      if (replyToId) {
        const orig = this.data.messages.find((m) => m.id === replyToId);
        if (orig) {
          replyToText = orig.text.slice(0, 100);
          replyToSender = orig.senderName;
        }
      }
      const message: ChatMessage = {
        id: generateId('msg'),
        roomId,
        channelId,
        recipientId,
        senderId: currentUser.id,
        senderName: currentUser.fullName,
        senderAvatar: currentUser.avatarUrl,
        text: String(text || '').trim(),
        attachments: attachments || [],
        replyToId,
        replyToText,
        replyToSender,
        reactions: {},
        createdAt: new Date().toISOString(),
        isEdited: false,
        isDeleted: false,
        clientMsgId,
      };
      this.data.messages.push(message);
      this.save();
      return { message } as unknown as T;
    }

    const msgReactMatch = pathname.match(/^\/api\/messages\/([^/]+)\/react$/);
    if (method === 'POST' && msgReactMatch) {
      if (!currentUser) throw this.createError('Unauthorized', 401);
      const messageId = decodeURIComponent(msgReactMatch[1]);
      const { emoji } = body;
      const msg = this.data.messages.find((m) => m.id === messageId);
      if (!msg) throw this.createError('Message not found', 404);
      if (!msg.reactions) msg.reactions = {};
      if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
      const idx = msg.reactions[emoji].indexOf(currentUser.id);
      if (idx >= 0) {
        msg.reactions[emoji].splice(idx, 1);
        if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
      } else {
        msg.reactions[emoji].push(currentUser.id);
      }
      this.save();
      return { message: msg } as unknown as T;
    }

    const msgEditMatch = pathname.match(/^\/api\/messages\/([^/]+)\/edit$/);
    if (method === 'PUT' && msgEditMatch) {
      const messageId = decodeURIComponent(msgEditMatch[1]);
      const msg = this.data.messages.find((m) => m.id === messageId);
      if (!msg) throw this.createError('Message not found', 404);
      msg.text = String(body.text || '').trim();
      msg.isEdited = true;
      msg.updatedAt = new Date().toISOString();
      this.save();
      return { message: msg } as unknown as T;
    }

    const msgDeleteMatch = pathname.match(/^\/api\/messages\/([^/]+)$/);
    if (method === 'DELETE' && msgDeleteMatch) {
      const messageId = decodeURIComponent(msgDeleteMatch[1]);
      const msg = this.data.messages.find((m) => m.id === messageId);
      if (msg) {
        msg.isDeleted = true;
        msg.text = '[Message deleted]';
        this.save();
      }
      return { success: true } as unknown as T;
    }

    if (method === 'GET' && pathname === '/api/direct-messages/threads/all') {
      if (!currentUser) return { threads: [] } as unknown as T;
      const directMsgs = this.data.messages.filter(
        (m) =>
          !m.roomId &&
          !m.isDeleted &&
          (m.senderId === currentUser.id || m.recipientId === currentUser.id)
      );
      const partnerIds = new Set<string>();
      for (const m of directMsgs) {
        if (m.senderId === currentUser.id && m.recipientId) partnerIds.add(m.recipientId);
        if (m.recipientId === currentUser.id) partnerIds.add(m.senderId);
      }
      const threads = [];
      for (const pid of partnerIds) {
        const partner = this.data.users.find((u) => u.id === pid);
        if (partner) {
          const lastMessage = directMsgs
            .filter(
              (m) =>
                (m.senderId === currentUser.id && m.recipientId === pid) ||
                (m.senderId === pid && m.recipientId === currentUser.id)
            )
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
          threads.push({
            user: this.sanitizeUser(partner),
            lastMessage,
          });
        }
      }
      return { threads } as unknown as T;
    }

    const dmUserMatch = pathname.match(/^\/api\/direct-messages\/([^/]+)$/);
    if (dmUserMatch) {
      const partnerId = decodeURIComponent(dmUserMatch[1]);
      if (method === 'GET') {
        const uid = currentUser?.id || '';
        const messages = this.data.messages.filter(
          (m) =>
            !m.roomId &&
            !m.isDeleted &&
            ((m.senderId === uid && m.recipientId === partnerId) ||
              (m.senderId === partnerId && m.recipientId === uid))
        );
        const partner = this.data.users.find((u) => u.id === partnerId);
        return {
          messages,
          partner: partner ? this.sanitizeUser(partner) : null,
        } as unknown as T;
      }
      if (method === 'DELETE') {
        const uid = currentUser?.id || '';
        this.data.messages = this.data.messages.filter(
          (m) =>
            m.roomId ||
            !(
              (m.senderId === uid && m.recipientId === partnerId) ||
              (m.senderId === partnerId && m.recipientId === uid)
            )
        );
        this.save();
        return { success: true } as unknown as T;
      }
    }

    // 6. BLOCKED USERS
    if (method === 'GET' && pathname === '/api/users/blocked') {
      if (!currentUser || !currentUser.privacy.blockedUserIds) {
        return { blockedUsers: [] } as unknown as T;
      }
      const blockedUsers = currentUser.privacy.blockedUserIds
        .map((id) => this.data.users.find((u) => u.id === id))
        .filter((u): u is LocalUserRecord => Boolean(u))
        .map((u) => this.sanitizeUser(u));
      return { blockedUsers } as unknown as T;
    }

    const blockMatch = pathname.match(/^\/api\/users\/([^/]+)\/block$/);
    if (method === 'POST' && blockMatch) {
      const targetId = decodeURIComponent(blockMatch[1]);
      if (currentUser) {
        if (!currentUser.privacy.blockedUserIds) currentUser.privacy.blockedUserIds = [];
        if (!currentUser.privacy.blockedUserIds.includes(targetId)) {
          currentUser.privacy.blockedUserIds.push(targetId);
          this.save();
        }
      }
      return { success: true, message: 'User blocked' } as unknown as T;
    }

    const unblockMatch = pathname.match(/^\/api\/users\/([^/]+)\/unblock$/);
    if (method === 'POST' && unblockMatch) {
      const targetId = decodeURIComponent(unblockMatch[1]);
      if (currentUser && currentUser.privacy.blockedUserIds) {
        currentUser.privacy.blockedUserIds = currentUser.privacy.blockedUserIds.filter(
          (id) => id !== targetId
        );
        this.save();
      }
      return { success: true, message: 'User unblocked' } as unknown as T;
    }

    // 7. LOCATIONS, SEARCH, NEARBY & DIRECTIONS
    if (method === 'DELETE' && pathname === '/api/locations/history') {
      if (!currentUser) return { success: true, removedCount: 0, message: 'Cleared' } as unknown as T;
      const before = this.data.locationHistory.length;
      this.data.locationHistory = this.data.locationHistory.filter(
        (h) => h.userId !== currentUser.id
      );
      const removedCount = before - this.data.locationHistory.length;
      this.save();
      return {
        success: true,
        removedCount,
        message: 'Location breadcrumbs successfully cleared.',
      } as unknown as T;
    }

    if (method === 'POST' && pathname === '/api/locations/update') {
      if (!currentUser) throw this.createError('Unauthorized', 401);
      const loc: UserLocation = {
        userId: currentUser.id,
        username: currentUser.username,
        fullName: currentUser.fullName,
        avatarUrl: currentUser.avatarUrl,
        markerColor: currentUser.markerColor,
        markerIcon: currentUser.markerIcon,
        markerLabel: currentUser.markerLabel,
        latitude: Number(body.latitude),
        longitude: Number(body.longitude),
        accuracy: Number(body.accuracy || 10),
        altitude: body.altitude != null ? Number(body.altitude) : null,
        heading: body.heading != null ? Number(body.heading) : null,
        speed: body.speed != null ? Number(body.speed) : null,
        batteryLevel: body.batteryLevel != null ? Number(body.batteryLevel) : null,
        timestamp: new Date().toISOString(),
        isStale: false,
      };
      this.data.locations[currentUser.id] = loc;
      this.data.locationHistory.push({
        id: generateId('loc'),
        userId: currentUser.id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
        altitude: loc.altitude,
        heading: loc.heading,
        speed: loc.speed,
        timestamp: loc.timestamp,
      });
      this.save();
      return { location: loc } as unknown as T;
    }

    if (method === 'GET' && pathname === '/api/locations/live') {
      return { locations: Object.values(this.data.locations) } as unknown as T;
    }

    const trailMatch = pathname.match(/^\/api\/locations\/trail\/([^/]+)$/);
    if (method === 'GET' && trailMatch) {
      const targetUserId = decodeURIComponent(trailMatch[1]);
      const windowHours = Number(query.get('windowHours')) || 1;
      const targetUser =
        this.data.users.find((u) => u.id === targetUserId) || currentUser;
      const now = Date.now();
      const windowMs = Math.max(0.25, Math.min(24, windowHours)) * 3600000;
      const points: LocationBreadcrumb[] = this.data.locationHistory
        .filter(
          (p) =>
            p.userId === targetUserId &&
            new Date(p.timestamp).getTime() >= now - windowMs
        )
        .map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          accuracy: p.accuracy,
          speed: p.speed,
          heading: p.heading,
          altitude: p.altitude,
          timestamp: p.timestamp,
        }));

      const trail: UserPathTrail = {
        userId: targetUserId,
        fullName: targetUser?.fullName || 'User',
        avatarUrl: targetUser?.avatarUrl || '',
        points,
        totalDistanceMeters: 0,
        startTime: points[0]?.timestamp || new Date(now - windowMs).toISOString(),
        endTime: points[points.length - 1]?.timestamp || new Date().toISOString(),
      };
      return { trail } as unknown as T;
    }

    if (method === 'GET' && pathname === '/api/locations/search') {
      const q = (query.get('q') || '').trim();
      if (!q || q.length < 2) return { results: [] } as unknown as T;
      const lat = query.get('lat');
      const lon = query.get('lon');
      try {
        const photonUrl = new URL('https://photon.komoot.io/api/');
        photonUrl.searchParams.set('q', q);
        photonUrl.searchParams.set('limit', '15');
        if (lat && lon) {
          photonUrl.searchParams.set('lat', lat);
          photonUrl.searchParams.set('lon', lon);
        }
        const resp = await fetch(photonUrl.toString());
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data.features)) {
            const results = data.features.map((feat: any, idx: number) => {
              const props = feat.properties || {};
              const coords = feat.geometry?.coordinates || [0, 0];
              const name =
                props.name ||
                [props.housenumber, props.street].filter(Boolean).join(' ') ||
                props.city ||
                q;
              const fullAddress = [
                props.name,
                props.street,
                props.city || props.town || props.village,
                props.state,
                props.country,
              ]
                .filter(Boolean)
                .join(', ');
              return {
                id: `place-photon-${idx}-${coords[0]}-${coords[1]}`,
                name,
                display_name: fullAddress || name,
                lat: coords[1],
                lon: coords[0],
                category: props.osm_key || 'place',
                type: props.osm_value || 'poi',
                city: props.city || props.town || props.village,
                state: props.state,
                country: props.country,
              };
            });
            return { results } as unknown as T;
          }
        }
      } catch {
        // fallback below
      }
      return { results: [] } as unknown as T;
    }

    if (method === 'GET' && pathname === '/api/locations/nearby') {
      const lat = Number(query.get('lat'));
      const lon = Number(query.get('lon'));
      const category = (query.get('category') || 'all').toLowerCase();
      const maxRadiusMeters = Number(query.get('radius')) || 10000;
      if (isNaN(lat) || isNaN(lon)) return { results: [] } as unknown as T;

      const categoryKeywords: Record<string, string> = {
        all: 'restaurant cafe supermarket fuel pharmacy hospital park atm',
        fuel: 'fuel gas station petrol',
        food: 'restaurant food dining',
        cafe: 'cafe coffee bakery',
        groceries: 'supermarket grocery market',
        hospital: 'hospital pharmacy clinic medical',
        parking: 'parking lot garage',
        hotel: 'hotel resort inn hostel',
        park: 'park garden trail',
        atm: 'atm bank',
      };
      const queryTerm = categoryKeywords[category] || category;

      try {
        const photonUrl = new URL('https://photon.komoot.io/api/');
        photonUrl.searchParams.set('q', queryTerm);
        photonUrl.searchParams.set('lat', String(lat));
        photonUrl.searchParams.set('lon', String(lon));
        photonUrl.searchParams.set('limit', '24');
        const resp = await fetch(photonUrl.toString());
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data.features)) {
            const results = data.features
              .map((feat: any, idx: number) => {
                const props = feat.properties || {};
                const coords = feat.geometry?.coordinates || [lon, lat];
                const pLat = coords[1];
                const pLon = coords[0];
                const dist = haversineDistMeters(lat, lon, pLat, pLon);
                const name =
                  props.name ||
                  [props.housenumber, props.street].filter(Boolean).join(' ') ||
                  `${category.toUpperCase()} Place`;
                const address = [props.name, props.street, props.city || props.town, props.state]
                  .filter(Boolean)
                  .join(', ');
                return {
                  id: `nearby-${category}-${idx}-${pLon.toFixed(4)}-${pLat.toFixed(4)}`,
                  name,
                  display_name: address || name,
                  lat: pLat,
                  lon: pLon,
                  category: props.osm_value || category,
                  type: props.osm_value || category,
                  city: props.city || props.town,
                  distanceMeters: dist,
                  estimatedDriveMinutes: Math.max(1, Math.round((dist / 1000 / 30) * 60)),
                  rating: Number((4.2 + ((idx * 5) % 8) * 0.1).toFixed(1)),
                  isOpen: true,
                };
              })
              .filter((p: any) => p.distanceMeters <= maxRadiusMeters)
              .sort((a: any, b: any) => a.distanceMeters - b.distanceMeters);
            return { results } as unknown as T;
          }
        }
      } catch {
        // fallback below
      }
      return { results: [] } as unknown as T;
    }

    if (method === 'GET' && pathname === '/api/locations/directions') {
      const startLat = Number(query.get('startLat'));
      const startLng = Number(query.get('startLng'));
      const endLat = Number(query.get('endLat'));
      const endLng = Number(query.get('endLng'));
      const mode = (query.get('mode') || 'driving').toLowerCase();
      const profile = mode === 'walking' ? 'foot' : mode === 'cycling' ? 'bike' : 'car';
      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
        const resp = await fetch(osrmUrl);
        if (resp.ok) {
          const data = await resp.json();
          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const steps: any[] = [];
            if (Array.isArray(route.legs)) {
              route.legs.forEach((leg: any) => {
                if (Array.isArray(leg.steps)) {
                  leg.steps.forEach((st: any) => {
                    steps.push({
                      instruction: st.name ? `Proceed onto ${st.name}` : 'Continue straight',
                      name: st.name || '',
                      distanceMeters: Math.round(st.distance || 0),
                      durationSeconds: Math.round(st.duration || 0),
                    });
                  });
                }
              });
            }
            return {
              success: true,
              distanceMeters: Math.round(route.distance),
              durationSeconds: Math.round(route.duration),
              geometry: route.geometry,
              steps,
              mode,
            } as unknown as T;
          }
        }
      } catch {
        // fallback line geometry
      }
      const dist = haversineDistMeters(startLat, startLng, endLat, endLng);
      return {
        success: true,
        distanceMeters: dist,
        durationSeconds: Math.max(60, Math.round(dist / 10)),
        geometry: {
          type: 'LineString',
          coordinates: [
            [startLng, startLat],
            [endLng, endLat],
          ],
        },
        steps: [
          {
            instruction: 'Head directly toward destination',
            name: 'Direct Route',
            distanceMeters: dist,
            durationSeconds: Math.max(60, Math.round(dist / 10)),
          },
        ],
        mode,
      } as unknown as T;
    }

    // 8. SAVED PLACES (WISHLIST)
    if (method === 'GET' && pathname === '/api/saved-places') {
      const uid = currentUser?.id || '';
      const places = this.data.savedPlaces.filter(
        (p) => p.userId === uid || p.visibility === 'public'
      );
      return { places } as unknown as T;
    }

    if (method === 'POST' && pathname === '/api/saved-places') {
      if (!currentUser) throw this.createError('Unauthorized', 401);
      const place: SavedPlace = {
        ...body,
        id: generateId('place'),
        userId: currentUser.id,
        createdAt: new Date().toISOString(),
      };
      this.data.savedPlaces.push(place);
      this.save();
      return { place } as unknown as T;
    }

    const deletePlaceMatch = pathname.match(/^\/api\/saved-places\/([^/]+)$/);
    if (method === 'DELETE' && deletePlaceMatch) {
      const placeId = decodeURIComponent(deletePlaceMatch[1]);
      this.data.savedPlaces = this.data.savedPlaces.filter((p) => p.id !== placeId);
      this.save();
      return { success: true } as unknown as T;
    }

    // 9. REMINDERS
    if (method === 'GET' && pathname === '/api/reminders') {
      const uid = currentUser?.id || '';
      const reminders = this.data.reminders.filter((r) => r.userId === uid);
      return { reminders } as unknown as T;
    }

    if (method === 'POST' && pathname === '/api/reminders') {
      if (!currentUser) throw this.createError('Unauthorized', 401);
      const reminder: ReminderItem = {
        ...body,
        id: generateId('rem'),
        userId: currentUser.id,
        createdAt: new Date().toISOString(),
        hasTriggered: false,
      };
      this.data.reminders.push(reminder);
      this.save();
      return { reminder } as unknown as T;
    }

    const triggerReminderMatch = pathname.match(/^\/api\/reminders\/([^/]+)\/trigger$/);
    if (method === 'PUT' && triggerReminderMatch) {
      const remId = decodeURIComponent(triggerReminderMatch[1]);
      const rem = this.data.reminders.find((r) => r.id === remId);
      if (rem) {
        rem.hasTriggered = true;
        this.save();
      }
      return { success: true } as unknown as T;
    }

    const deleteReminderMatch = pathname.match(/^\/api\/reminders\/([^/]+)$/);
    if (method === 'DELETE' && deleteReminderMatch) {
      const remId = decodeURIComponent(deleteReminderMatch[1]);
      this.data.reminders = this.data.reminders.filter((r) => r.id !== remId);
      this.save();
      return { success: true } as unknown as T;
    }

    // 10. MEETINGS
    if (method === 'GET' && pathname === '/api/meetings') {
      return { meetings: this.data.meetings } as unknown as T;
    }

    if (method === 'POST' && pathname === '/api/meetings') {
      if (!currentUser) throw this.createError('Unauthorized', 401);
      const meeting: MeetingItem = {
        ...body,
        id: generateId('meet'),
        creatorId: currentUser.id,
        creatorName: currentUser.fullName,
        createdAt: new Date().toISOString(),
      };
      this.data.meetings.push(meeting);
      this.save();
      return { meeting } as unknown as T;
    }

    const rsvpMatch = pathname.match(/^\/api\/meetings\/([^/]+)\/rsvp$/);
    if (method === 'POST' && rsvpMatch) {
      if (!currentUser) throw this.createError('Unauthorized', 401);
      const meetId = decodeURIComponent(rsvpMatch[1]);
      const meeting = this.data.meetings.find((m) => m.id === meetId);
      if (!meeting) throw this.createError('Meeting not found', 404);
      const idx = meeting.attendees.findIndex((a) => a.userId === currentUser.id);
      if (idx >= 0) {
        meeting.attendees[idx].status = body.status;
      } else {
        meeting.attendees.push({ userId: currentUser.id, status: body.status });
      }
      this.save();
      return { meeting } as unknown as T;
    }

    // 11. EMERGENCY ALERTS
    if (
      method === 'GET' &&
      (pathname === '/api/alerts/emergency/active' || pathname === '/api/alerts/emergency')
    ) {
      const alerts = this.data.emergencyAlerts.filter((a) => a.status === 'active');
      return { alerts } as unknown as T;
    }

    if (method === 'POST' && pathname === '/api/alerts/emergency') {
      if (!currentUser) throw this.createError('Unauthorized', 401);
      const alert: EmergencyAlert = {
        id: generateId('sos'),
        senderId: currentUser.id,
        senderName: currentUser.fullName,
        senderAvatar: currentUser.avatarUrl,
        senderPhone: currentUser.phoneNumber,
        message: body.message || 'EMERGENCY: Immediate assistance requested!',
        latitude: Number(body.latitude || 0),
        longitude: Number(body.longitude || 0),
        accuracy: Number(body.accuracy || 10),
        roomId: body.roomId,
        timestamp: new Date().toISOString(),
        status: 'active',
        acknowledgedBy: [],
      };
      this.data.emergencyAlerts.unshift(alert);
      this.save();
      return { alert } as unknown as T;
    }

    const ackAlertMatch = pathname.match(/^\/api\/alerts\/emergency\/([^/]+)\/ack$/);
    if (method === 'POST' && ackAlertMatch) {
      if (!currentUser) throw this.createError('Unauthorized', 401);
      const alertId = decodeURIComponent(ackAlertMatch[1]);
      const alert = this.data.emergencyAlerts.find((a) => a.id === alertId);
      if (!alert) throw this.createError('Alert not found', 404);
      if (!alert.acknowledgedBy.some((ack) => ack.userId === currentUser.id)) {
        alert.acknowledgedBy.push({
          userId: currentUser.id,
          name: currentUser.fullName,
          timestamp: new Date().toISOString(),
        });
        this.save();
      }
      return { alert } as unknown as T;
    }

    const resolveAlertMatch = pathname.match(/^\/api\/alerts\/emergency\/([^/]+)\/resolve$/);
    if (method === 'POST' && resolveAlertMatch) {
      const alertId = decodeURIComponent(resolveAlertMatch[1]);
      const alert = this.data.emergencyAlerts.find((a) => a.id === alertId);
      if (!alert) throw this.createError('Alert not found', 404);
      alert.status = 'resolved';
      this.save();
      return { alert } as unknown as T;
    }

    const deleteAlertMatch = pathname.match(/^\/api\/alerts\/emergency\/([^/]+)$/);
    if (method === 'DELETE' && deleteAlertMatch) {
      const alertId = decodeURIComponent(deleteAlertMatch[1]);
      this.data.emergencyAlerts = this.data.emergencyAlerts.filter((a) => a.id !== alertId);
      this.save();
      return { success: true } as unknown as T;
    }

    // 12. LOCATION SHARE REQUESTS
    if (method === 'GET' && pathname === '/api/locations/requests') {
      const uid = currentUser?.id || '';
      const requests = this.data.locationShareRequests.filter(
        (r) => r.toUserId === uid || r.fromUserId === uid
      );
      return { requests } as unknown as T;
    }

    if (method === 'POST' && pathname === '/api/locations/request') {
      if (!currentUser) throw this.createError('Unauthorized', 401);
      const request: LocationShareRequest = {
        id: generateId('req'),
        fromUserId: currentUser.id,
        fromUserName: currentUser.fullName,
        fromUserAvatar: currentUser.avatarUrl,
        toUserId: body.toUserId,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      this.data.locationShareRequests.unshift(request);
      this.save();
      return { request } as unknown as T;
    }

    if (method === 'POST' && pathname === '/api/locations/respond') {
      const req = this.data.locationShareRequests.find((r) => r.id === body.requestId);
      if (!req) throw this.createError('Request not found', 404);
      req.status = body.response;
      if (body.response === 'temporary') {
        req.expiresAt = new Date(Date.now() + 3600000).toISOString();
      }
      this.save();
      return { request: req } as unknown as T;
    }

    // 13. COMMUNITY REPORTS & ADMIN
    if (method === 'POST' && pathname === '/api/community/report') {
      const report: ReportItem = {
        id: generateId('rep'),
        reporterId: currentUser?.id || 'anon',
        reporterName: currentUser?.fullName || 'Anonymous',
        targetType: body.targetType,
        targetId: body.targetId,
        reason: body.reason,
        timestamp: new Date().toISOString(),
        status: 'pending',
      };
      this.data.reports.push(report);
      this.save();
      return { report } as unknown as T;
    }

    if (method === 'GET' && pathname === '/api/admin/stats') {
      return {
        stats: {
          totalUsers: this.data.users.length,
          onlineUsers: this.data.users.filter((u) => u.isOnline).length,
          totalRooms: this.data.rooms.length,
          totalMessages: this.data.messages.length,
          activeAlerts: this.data.emergencyAlerts.filter((a) => a.status === 'active').length,
          pendingReports: this.data.reports.filter((r) => r.status === 'pending').length,
        },
        users: this.data.users.map((u) => this.sanitizeUser(u)),
        rooms: this.data.rooms.map((r) => this.sanitizeRoom(r)),
        reports: this.data.reports,
        logs: this.data.auditLogs,
      } as unknown as T;
    }

    const resolveReportMatch = pathname.match(/^\/api\/admin\/reports\/([^/]+)\/resolve$/);
    if (method === 'POST' && resolveReportMatch) {
      const repId = decodeURIComponent(resolveReportMatch[1]);
      const rep = this.data.reports.find((r) => r.id === repId);
      if (rep) {
        rep.status = body.status;
        this.save();
      }
      return { success: true } as unknown as T;
    }

    return {} as T;
  }
}

export const localBackend = new LocalBackendEngine();
