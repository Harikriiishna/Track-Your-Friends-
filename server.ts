import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { db, UPLOADS_DIR } from './src/server/db.ts';
import type { WsClientMessage, WsServerMessage, UserProfile } from './src/types.ts';
import { fetchRealNearbyPlaces, searchRealPlacesByQuery } from './src/utils/nearbyPlaces.ts';

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

// Body parsers with large limits for media/voice uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS headers for mobile WebView / Capacitor and cross-origin clients
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Static uploads directory
app.use('/uploads', express.static(UPLOADS_DIR));

// WebSocket Server with dedicated /ws path for application realtime features
const wss = new WebSocketServer({ noServer: true });

// Dedicated transport server for Vite dev client / module runner
const viteHmrWss = new WebSocketServer({ noServer: true });

viteHmrWss.on('connection', (ws) => {
  try {
    ws.send(JSON.stringify({ type: 'connected' }));
  } catch (_) {}

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (_) {}
  });
});

server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      // Gracefully accept Vite HMR / Module runner WebSocket connections
      viteHmrWss.handleUpgrade(request, socket, head, (ws) => {
        viteHmrWss.emit('connection', ws, request);
      });
    }
  } catch (err) {
    console.error('Error handling upgrade:', err);
  }
});

interface ClientSession {
  ws: WebSocket;
  userId: string;
  activeRooms: Set<string>;
  activeVoiceRooms: Set<string>;
}

const clients = new Map<WebSocket, ClientSession>();

function broadcastToUser(targetUserId: string, message: WsServerMessage) {
  const payload = JSON.stringify(message);
  for (const session of clients.values()) {
    if (session.userId === targetUserId && session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(payload);
    }
  }
}

function broadcastToRoom(roomId: string, message: WsServerMessage, excludeUserId?: string) {
  const isUniversal = roomId === 'room-universal';
  const members = db.getRoomMembers(roomId);
  const memberUserIds = new Set(members.map((m) => m.userId));
  const payload = JSON.stringify(message);

  for (const session of clients.values()) {
    if (session.ws.readyState === WebSocket.OPEN) {
      if (session.userId === excludeUserId) continue;
      if (isUniversal || memberUserIds.has(session.userId) || session.activeRooms.has(roomId)) {
        session.ws.send(payload);
      }
    }
  }
}

function broadcastToAuthorizedPeers(userId: string, locationMessage: WsServerMessage) {
  const payload = JSON.stringify(locationMessage);
  for (const session of clients.values()) {
    if (session.userId === userId) continue;
    if (session.ws.readyState !== WebSocket.OPEN) continue;

    // Check if target session user is allowed to see userId's location
    const visibleLocations = db.getVisibleLocationsForUser(session.userId);
    const canSee = visibleLocations.some((loc) => loc.userId === userId);
    if (canSee) {
      session.ws.send(payload);
    }
  }
}

function broadcastGlobalEmergency(alertMessage: WsServerMessage) {
  const payload = JSON.stringify(alertMessage);
  for (const session of clients.values()) {
    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(payload);
    }
  }
}

function getCombinedOnlineUsers(): string[] {
  const wsOnline = Array.from(clients.values()).map((c) => c.userId);
  const cloudActive = db.getRecentlyActiveUserIds();
  return Array.from(new Set([...wsOnline, ...cloudActive]));
}

// Broadcast real-time events when Android APK or external clients sync via Cloud Firestore
db.onExternalCloudSync(({ newMessages, updatedLocations, newAlerts }) => {
  for (const chatMsg of newMessages) {
    if (chatMsg.roomId) {
      broadcastToRoom(chatMsg.roomId, { type: 'chat:message', message: chatMsg });
    } else if (chatMsg.recipientId) {
      broadcastToUser(chatMsg.recipientId, { type: 'chat:message', message: chatMsg });
      broadcastToUser(chatMsg.senderId, { type: 'chat:message', message: chatMsg });
    }
  }

  if (updatedLocations.length > 0) {
    const onlineUsers = getCombinedOnlineUsers();
    for (const session of clients.values()) {
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(
          JSON.stringify({
            type: 'presence:update',
            userLocations: db.getVisibleLocationsForUser(session.userId),
            onlineUsers,
          })
        );
      }
    }
  }

  for (const alert of newAlerts) {
    if (alert.roomId) {
      broadcastToRoom(alert.roomId, { type: 'emergency:broadcast', alert });
    } else {
      broadcastGlobalEmergency({ type: 'emergency:broadcast', alert });
    }
  }
});

// WebSocket connection lifecycle
wss.on('connection', (ws: WebSocket, req) => {
  let authenticatedUserId: string | null = null;

  ws.on('message', (rawData) => {
    try {
      const msg: WsClientMessage = JSON.parse(rawData.toString());

      if ((msg as any).type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        return;
      }

      if (msg.type === 'auth') {
        const user = db.getSessionUser(msg.token);
        if (!user) {
          ws.send(JSON.stringify({ type: 'auth:error', message: 'Invalid or expired session token' }));
          return;
        }

        authenticatedUserId = user.id;
        db.setOnlineStatus(user.id, true);

        // Preload user's joined rooms
        const userRooms = db.getUserRooms(user.id);
        const roomIds = new Set(userRooms.map((r) => r.id));

        clients.set(ws, {
          ws,
          userId: user.id,
          activeRooms: roomIds,
          activeVoiceRooms: new Set(),
        });

        ws.send(JSON.stringify({ type: 'auth:success', user }));

        // Broadcast initial presence and visible locations
        const visibleLocations = db.getVisibleLocationsForUser(user.id);
        const onlineUsers = getCombinedOnlineUsers();
        ws.send(JSON.stringify({ type: 'presence:update', userLocations: visibleLocations, onlineUsers }));

        // Notify peers that this user is online
        for (const session of clients.values()) {
          if (session.userId !== user.id && session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(
              JSON.stringify({
                type: 'presence:update',
                userLocations: db.getVisibleLocationsForUser(session.userId),
                onlineUsers,
              })
            );
          }
        }
        return;
      }

      if (!authenticatedUserId) {
        ws.send(JSON.stringify({ type: 'auth:error', message: 'Unauthorized. Send auth token first.' }));
        return;
      }

      const currentUserId = authenticatedUserId;
      const session = clients.get(ws);

      switch (msg.type) {
        case 'location:update': {
          const loc = db.updateLocation(currentUserId, msg.location);
          // Broadcast to authorized peers
          broadcastToAuthorizedPeers(currentUserId, { type: 'location:broadcast', location: loc });
          // Also echo back to sender to confirm saved state
          ws.send(JSON.stringify({ type: 'location:broadcast', location: loc }));
          break;
        }

        case 'room:join': {
          if (session) {
            session.activeRooms.add(msg.roomId);
          }
          break;
        }

        case 'room:leave': {
          if (session) {
            session.activeRooms.delete(msg.roomId);
          }
          break;
        }

        case 'chat:message': {
          const chatMsg = db.createMessage({
            senderId: currentUserId,
            roomId: msg.roomId,
            channelId: (msg as any).channelId,
            recipientId: msg.recipientId,
            text: msg.text,
            attachments: msg.attachments,
            replyToId: msg.replyToId,
            clientMsgId: (msg as any).clientMsgId,
          });

          if (msg.roomId) {
            broadcastToRoom(msg.roomId, { type: 'chat:message', message: chatMsg });
          } else if (msg.recipientId) {
            // 1-to-1 direct message: send to recipient and sender
            broadcastToUser(msg.recipientId, { type: 'chat:message', message: chatMsg });
            ws.send(JSON.stringify({ type: 'chat:message', message: chatMsg }));
          }
          break;
        }

        case 'chat:typing': {
          const user = db.findUserById(currentUserId);
          if (!user) break;
          const typingEvent: WsServerMessage = {
            type: 'chat:typing',
            senderId: currentUserId,
            senderName: user.fullName,
            roomId: msg.roomId,
            isTyping: msg.isTyping,
          };
          if (msg.roomId) {
            broadcastToRoom(msg.roomId, typingEvent, currentUserId);
          } else if (msg.recipientId) {
            broadcastToUser(msg.recipientId, typingEvent);
          }
          break;
        }

        case 'chat:reaction': {
          const updated = db.reactToMessage(currentUserId, msg.messageId, msg.emoji);
          const updateEvent: WsServerMessage = { type: 'chat:message_updated', message: updated };
          if (updated.roomId) {
            broadcastToRoom(updated.roomId, updateEvent);
          } else if (updated.recipientId) {
            broadcastToUser(updated.recipientId, updateEvent);
            ws.send(JSON.stringify(updateEvent));
          }
          break;
        }

        case 'chat:delete': {
          db.deleteMessage(currentUserId, msg.messageId);
          const deleteEvent: WsServerMessage = { type: 'chat:message_deleted', messageId: msg.messageId };
          for (const s of clients.values()) {
            if (s.ws.readyState === WebSocket.OPEN) {
              s.ws.send(JSON.stringify(deleteEvent));
            }
          }
          break;
        }

        case 'chat:edit': {
          const updated = db.editMessage(currentUserId, msg.messageId, msg.text);
          const updateEvent: WsServerMessage = { type: 'chat:message_updated', message: updated };
          if (updated.roomId) {
            broadcastToRoom(updated.roomId, updateEvent);
          } else if (updated.recipientId) {
            broadcastToUser(updated.recipientId, updateEvent);
            ws.send(JSON.stringify(updateEvent));
          }
          break;
        }

        // Real-Time WebRTC Voice Channels
        case 'voice:join': {
          if (!session) break;
          session.activeVoiceRooms.add(msg.roomId);
          const user = db.findUserById(currentUserId);
          if (!user) break;
          const safeUser = db.sanitizeUser(user);

          // Notify existing voice peers in this room
          for (const otherSession of clients.values()) {
            if (otherSession.userId !== currentUserId && otherSession.activeVoiceRooms.has(msg.roomId)) {
              otherSession.ws.send(
                JSON.stringify({
                  type: 'voice:peer_joined',
                  peerId: currentUserId,
                  user: safeUser,
                })
              );
            }
          }

          // Send current participants list to the joining peer
          const participants = Array.from(clients.values())
            .filter((s) => s.activeVoiceRooms.has(msg.roomId))
            .map((s) => {
              const u = db.findUserById(s.userId);
              return {
                peerId: s.userId,
                user: u ? db.sanitizeUser(u) : safeUser,
                isSpeaking: false,
              };
            });

          ws.send(JSON.stringify({ type: 'voice:participants', roomId: msg.roomId, participants }));
          break;
        }

        case 'voice:leave': {
          if (!session) break;
          session.activeVoiceRooms.delete(msg.roomId);
          // Notify room voice peers
          for (const otherSession of clients.values()) {
            if (otherSession.userId !== currentUserId && otherSession.activeVoiceRooms.has(msg.roomId)) {
              otherSession.ws.send(
                JSON.stringify({
                  type: 'voice:peer_left',
                  peerId: currentUserId,
                })
              );
            }
          }
          break;
        }

        case 'voice:signal': {
          // Relay WebRTC signaling (offer / answer / ICE candidate) to target peer
          if (msg.targetPeerId) {
            broadcastToUser(msg.targetPeerId, {
              type: 'voice:signal',
              fromPeerId: currentUserId,
              data: msg.data,
            });
          }
          break;
        }

        case 'voice:speaking': {
          for (const otherSession of clients.values()) {
            if (otherSession.activeVoiceRooms.has(msg.roomId)) {
              otherSession.ws.send(
                JSON.stringify({
                  type: 'voice:speaking_update',
                  roomId: msg.roomId,
                  peerId: currentUserId,
                  isSpeaking: msg.isSpeaking,
                })
              );
            }
          }
          break;
        }

        case 'emergency:sos': {
          const alert = db.createEmergencyAlert(currentUserId, {
            message: msg.message,
            latitude: msg.latitude,
            longitude: msg.longitude,
            accuracy: msg.accuracy,
            roomId: msg.roomId,
          });

          // Broadcast high priority SOS
          if (msg.roomId) {
            broadcastToRoom(msg.roomId, { type: 'emergency:broadcast', alert });
          } else {
            broadcastGlobalEmergency({ type: 'emergency:broadcast', alert });
          }
          break;
        }

        case 'emergency:ack': {
          const alert = db.acknowledgeEmergencyAlert(currentUserId, msg.alertId);
          broadcastGlobalEmergency({ type: 'emergency:ack_update', alert });
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    if (authenticatedUserId) {
      const closingUserId = authenticatedUserId;
      const s = clients.get(ws);
      if (s) {
        // Leave any active voice channels
        for (const roomId of s.activeVoiceRooms) {
          for (const otherSession of clients.values()) {
            if (otherSession.userId !== closingUserId && otherSession.activeVoiceRooms.has(roomId)) {
              otherSession.ws.send(JSON.stringify({ type: 'voice:peer_left', peerId: closingUserId }));
            }
          }
        }
      }

      clients.delete(ws);

      // Check if user has no remaining active sockets
      const hasOtherSockets = Array.from(clients.values()).some((c) => c.userId === closingUserId);
      if (!hasOtherSockets) {
        db.setOnlineStatus(closingUserId, false);
        const onlineUsers = Array.from(new Set(Array.from(clients.values()).map((c) => c.userId)));
        for (const session of clients.values()) {
          if (session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(
              JSON.stringify({
                type: 'presence:update',
                userLocations: db.getVisibleLocationsForUser(session.userId),
                onlineUsers,
              })
            );
          }
        }
      }
    }
  });
});

// Rate Limiter Memory Store (Spec Section 12 & 16)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function createRateLimiter(options: { max: number; windowMs: number; message?: string }) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const record = rateLimitMap.get(key);

    if (!record || now > record.resetTime) {
      rateLimitMap.set(key, { count: 1, resetTime: now + options.windowMs });
      return next();
    }

    if (record.count >= options.max) {
      res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
      res.status(429).json({
        error: options.message || 'Too many requests. Please wait a moment and try again.',
        code: 'RATE_LIMIT_EXCEEDED',
      });
      return;
    }

    record.count++;
    next();
  };
}

const authRateLimiter = createRateLimiter({
  max: 15,
  windowMs: 60 * 1000,
  message: 'Too many authentication attempts. Please wait 60 seconds.',
});

const sosRateLimiter = createRateLimiter({
  max: 6,
  windowMs: 60 * 1000,
  message: 'Emergency SOS broadcast rate limit reached. Please wait before broadcasting again.',
});

const uploadRateLimiter = createRateLimiter({
  max: 30,
  windowMs: 60 * 1000,
  message: 'File upload rate limit reached. Please wait a minute.',
});

// HTTP Authentication Middleware
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token as string);

  if (!token) {
    res.status(401).json({ error: 'Missing authentication token' });
    return;
  }

  const user = db.getSessionUser(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  (req as any).user = user;
  (req as any).token = token;
  next();
}

// REST API Endpoints

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'Beacon Production Backend',
    timestamp: new Date().toISOString(),
  });
});

// Authoritative Cross-Platform State Synchronization Endpoint (Web <-> Production Server <-> Android APK)
app.get('/api/sync/state', (_req, res) => {
  res.json({
    ok: true,
    updatedAt: new Date().toISOString(),
    state: db.getSyncSnapshot(),
  });
});

app.post('/api/sync/state', (req, res) => {
  try {
    const incoming = req.body?.state || req.body;
    const merged = db.applyIncomingSyncSnapshot(incoming || {});
    res.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      state: merged,
    });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Sync merge failed' });
  }
});

// Authentication
app.post('/api/auth/register', authRateLimiter, (req, res) => {
  try {
    const { email, username, fullName, password, phoneNumber, avatarUrl } = req.body;
    if (!email || !username || !fullName || !password) {
      res.status(400).json({ error: 'Missing required registration fields' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();

    const user = db.createUser({
      email: cleanEmail,
      username: cleanUsername,
      fullName: fullName.trim(),
      password,
      phoneNumber,
      avatarUrl,
    });
    const userAgent = req.headers['user-agent'] || 'Web / Mobile Client';
    const ip = req.ip || req.socket.remoteAddress || 'Local';
    const token = db.createSession(user.id, userAgent, ip);
    db.logAudit(user.id, user.fullName, 'USER_REGISTERED', `Account created with username ${cleanUsername}`, ip);

    res.json({ user, token });
  } catch (err: any) {
    const message = err.message || 'Registration failed';
    const isDuplicateEmail = message.toLowerCase().includes('email') && message.toLowerCase().includes('exists');
    const isDuplicateUsername = message.toLowerCase().includes('username') && message.toLowerCase().includes('taken');

    res.status(400).json({
      error: message,
      code: isDuplicateEmail ? 'EMAIL_ALREADY_EXISTS' : isDuplicateUsername ? 'USERNAME_TAKEN' : 'REGISTRATION_FAILED',
      suggestion: isDuplicateEmail ? 'login' : undefined,
      email: req.body?.email?.trim()?.toLowerCase(),
      username: req.body?.username?.trim(),
    });
  }
});

app.post('/api/auth/login', authRateLimiter, (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      res.status(400).json({ error: 'Username/email and password required' });
      return;
    }

    const cleanIdentifier = identifier.trim();
    const userRec = db.findUserByEmailOrUsername(cleanIdentifier);
    if (!userRec) {
      res.status(404).json({
        error: `No account found for "${cleanIdentifier}". Please check for typos or click Create Account.`,
        code: 'USER_NOT_FOUND',
        suggestion: 'register',
        identifier: cleanIdentifier,
      });
      return;
    }

    // Try both exact password and trimmed password (and APK-synced plaintext password)
    const isValid =
      db.verifyPassword(password, userRec.passwordHash, userRec.salt, userRec.password) ||
      db.verifyPassword(password.trim(), userRec.passwordHash, userRec.salt, userRec.password);

    if (!isValid) {
      db.logAudit(userRec.id, userRec.fullName, 'USER_LOGIN_FAILED', `Failed login attempt for ${cleanIdentifier}`, req.ip);
      res.status(401).json({
        error: `Incorrect password for ${userRec.email}. Tap "Reset Password" to set a new password, or sign in with test credentials.`,
        code: 'INVALID_PASSWORD',
        suggestion: 'reset',
        email: userRec.email,
        username: userRec.username,
      });
      return;
    }

    const userAgent = req.headers['user-agent'] || 'Web / Mobile Client';
    const ip = req.ip || req.socket.remoteAddress || 'Local';
    const token = db.createSession(userRec.id, userAgent, ip);
    const safeUser = db.sanitizeUser(userRec);
    db.setOnlineStatus(userRec.id, true);
    db.logAudit(userRec.id, userRec.fullName, 'USER_LOGIN', 'Logged into Beacon', ip);

    res.json({ user: safeUser, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

// Quick 1-click password reset endpoint
app.post('/api/auth/quick-reset', authRateLimiter, (req, res) => {
  try {
    const { identifier, newPassword } = req.body;
    if (!identifier || !newPassword) {
      res.status(400).json({ error: 'Username or email and new password required' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    const safeUser = db.directResetPassword(identifier.trim(), newPassword);
    const userAgent = req.headers['user-agent'] || 'Web / Mobile Client';
    const ip = req.ip || req.socket.remoteAddress || 'Local';
    const token = db.createSession(safeUser.id, userAgent, ip);
    db.setOnlineStatus(safeUser.id, true);
    res.json({
      success: true,
      message: 'Password updated successfully! Logged in.',
      user: safeUser,
      token,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Password reset failed' });
  }
});

// Demo 1-tap quick sign-in for testing
app.post('/api/auth/demo-login', (req, res) => {
  try {
    const allUsers = db.getAllUsers();
    if (allUsers.length === 0) {
      res.status(404).json({ error: 'No existing users found. Please create an account.' });
      return;
    }
    const targetUser = allUsers[0];
    const userAgent = req.headers['user-agent'] || 'Demo Client';
    const ip = req.ip || 'Local';
    const token = db.createSession(targetUser.id, userAgent, ip);
    db.setOnlineStatus(targetUser.id, true);
    db.logAudit(targetUser.id, targetUser.fullName, 'DEMO_LOGIN', 'One-tap login via Demo mode', ip);
    res.json({ user: targetUser, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Demo login failed' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  res.json({ user });
});

app.post('/api/auth/logout', authMiddleware, (req, res) => {
  const token = (req as any).token as string;
  const user = (req as any).user as UserProfile;
  db.deleteSession(token);
  db.setOnlineStatus(user.id, false);
  db.logAudit(user.id, user.fullName, 'USER_LOGOUT', 'Logged out of device session');
  res.json({ success: true });
});

// Active Sessions & Device Management (Spec Section 3)
app.get('/api/auth/sessions', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  const token = (req as any).token as string;
  const sessions = db.getUserSessions(user.id, token);
  res.json({ sessions });
});

app.post('/api/auth/sessions/revoke', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  const { sessionToken } = req.body;
  if (!sessionToken) {
    res.status(400).json({ error: 'Session token required' });
    return;
  }
  const success = db.revokeSession(user.id, sessionToken);
  res.json({ success });
});

app.post('/api/auth/sessions/revoke-others', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  const token = (req as any).token as string;
  const revokedCount = db.revokeOtherSessions(user.id, token);
  res.json({ success: true, revokedCount });
});

app.post('/api/auth/password-reset/request', authRateLimiter, (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email address is required' });
      return;
    }
    const cleanEmail = email.trim();
    let code = '******';
    try {
      code = db.createPasswordReset(cleanEmail);
    } catch (_) {
      // Defense against account enumeration (Spec Section 3):
      // Always acknowledge request without leaking whether the email exists.
    }
    res.json({
      success: true,
      message: 'If an account matches this email, reset instructions have been generated.',
      code,
      email: cleanEmail,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Password reset request failed' });
  }
});

app.post('/api/auth/password-reset/confirm', authRateLimiter, (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ error: 'Reset code and new password are required' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }
    const user = db.resetPassword(token.trim(), newPassword);
    res.json({ success: true, user });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Password reset failed' });
  }
});
// Profile & Privacy
app.put('/api/profile/update', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const updated = db.updateUserProfile(user.id, req.body);
    res.json({ user: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/privacy/update', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const updated = db.updateUserProfile(user.id, { privacy: req.body });
    res.json({ user: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// File & Audio Uploads (Base64 data or binary with strict MIME & size validation)
app.post('/api/upload', authMiddleware, uploadRateLimiter, (req, res) => {
  try {
    const { dataUrl, filename, mimeType } = req.body;
    if (!dataUrl) {
      res.status(400).json({ error: 'Missing dataUrl payload' });
      return;
    }

    const matches = dataUrl.match(/^data:([A-Za-z-+/0-9]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      res.status(400).json({ error: 'Invalid base64 Data URL format' });
      return;
    }

    const type = (mimeType || matches[1]).toLowerCase();

    // Strict whitelist of approved media types (Spec Section 11)
    const ALLOWED_MIME_TYPES = new Set([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'audio/webm',
      'audio/ogg',
      'audio/mp3',
      'audio/mp4',
      'audio/m4a',
      'audio/wav',
    ]);

    if (!ALLOWED_MIME_TYPES.has(type)) {
      res.status(400).json({ error: 'Security policy violation: Unsupported file type. Only images and audio notes are allowed.' });
      return;
    }

    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length > 10 * 1024 * 1024) {
      res.status(413).json({ error: 'File size exceeds maximum security limit of 10MB' });
      return;
    }

    let ext = '.bin';
    if (type.includes('image/png')) ext = '.png';
    else if (type.includes('image/jpeg') || type.includes('image/jpg')) ext = '.jpg';
    else if (type.includes('image/webp')) ext = '.webp';
    else if (type.includes('image/gif')) ext = '.gif';
    else if (type.includes('audio/webm')) ext = '.webm';
    else if (type.includes('audio/ogg')) ext = '.ogg';
    else if (type.includes('audio/mp4') || type.includes('audio/m4a')) ext = '.m4a';
    else if (type.includes('audio/wav')) ext = '.wav';

    // Unpredictable safe filename generation to prevent path traversal (Spec Section 11)
    const safeName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeName);

    fs.writeFileSync(filePath, buffer);
    const publicUrl = `/uploads/${safeName}`;

    res.json({
      url: publicUrl,
      name: filename ? path.basename(filename) : safeName,
      size: buffer.length,
      mimeType: type,
    });
  } catch (err: any) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Failed to process file upload' });
  }
});

// Rooms
app.get('/api/rooms', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  const rooms = db.getUserRooms(user.id);
  res.json({ rooms });
});

app.post('/api/rooms', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const { name, description, password, iconUrl, isPrivate } = req.body;
    if (!name || name.trim().length === 0) {
      res.status(400).json({ error: 'Room name is required' });
      return;
    }

    const room = db.createRoom(user.id, { name, description, password, iconUrl, isPrivate });
    db.logAudit(user.id, user.fullName, 'ROOM_CREATED', `Created room "${name}" (${room.id})`);
    res.json({ room });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/rooms/join', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const { roomId, password } = req.body;
    if (!roomId) {
      res.status(400).json({ error: 'Room ID is required' });
      return;
    }

    const room = db.joinRoom(user.id, roomId.trim(), password);
    db.logAudit(user.id, user.fullName, 'ROOM_JOINED', `Joined room "${room.name}" (${room.id})`);
    res.json({ room });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/rooms/:id', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  const room = db.getRoomDetails(req.params.id, user.id);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json({ room });
});

app.post('/api/rooms/:id/leave', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  db.leaveRoom(user.id, req.params.id);
  res.json({ success: true });
});

app.post('/api/rooms/:id/roles', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const { targetUserId, newRole } = req.body;
    db.updateMemberRole(user.id, req.params.id, targetUserId, newRole);
    res.json({ success: true });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.post('/api/rooms/:id/kick', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const { targetUserId } = req.body;
    db.kickMember(user.id, req.params.id, targetUserId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// User Blocking & Moderation (Spec Section 6 & 16)
app.get('/api/users/blocked', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  const blockedUsers = db.getBlockedUsers(user.id);
  res.json({ blockedUsers });
});

app.post('/api/users/:id/block', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    db.blockUser(user.id, req.params.id);
    res.json({ success: true, message: 'User blocked' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/users/:id/unblock', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    db.unblockUser(user.id, req.params.id);
    res.json({ success: true, message: 'User unblocked' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Location History Deletion (Spec Section 5 & 19)
app.delete('/api/locations/history', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const removedCount = db.clearUserLocationHistory(user.id);
    res.json({ success: true, removedCount, message: 'Location breadcrumbs successfully cleared.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Chat Messages with Membership Authorization
app.get('/api/rooms/:id/messages', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const limit = Number(req.query.limit) || 50;
    const messages = db.getRoomMessages(req.params.id, user.id, limit);
    res.json({ messages });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.delete('/api/rooms/:id/messages', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    db.clearRoomMessages(user.id, req.params.id);
    broadcastToRoom(req.params.id, { type: 'chat:cleared', roomId: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

app.get('/api/direct-messages/:userId', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  const limit = Number(req.query.limit) || 50;
  const messages = db.getDirectMessages(user.id, req.params.userId, limit);
  const partnerRec = db.findUserById(req.params.userId);
  res.json({
    messages,
    partner: partnerRec ? db.sanitizeUser(partnerRec) : null,
  });
});

app.delete('/api/direct-messages/:userId', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    db.clearDirectMessages(user.id, req.params.userId);
    broadcastToUser(req.params.userId, { type: 'chat:cleared', partnerId: user.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/direct-messages/threads/all', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  const threads = db.getDirectMessageThreads(user.id);
  res.json({ threads });
});

// REST Chat Message Endpoints (fallback for non-WS / mobile environments)
app.post('/api/messages/create', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const chatMsg = db.createMessage({
      senderId: user.id,
      roomId: req.body.roomId,
      channelId: req.body.channelId,
      recipientId: req.body.recipientId,
      text: req.body.text,
      attachments: req.body.attachments,
      replyToId: req.body.replyToId,
      clientMsgId: req.body.clientMsgId,
    });
    if (req.body.roomId) {
      broadcastToRoom(req.body.roomId, { type: 'chat:message', message: chatMsg });
    } else if (req.body.recipientId) {
      broadcastToUser(req.body.recipientId, { type: 'chat:message', message: chatMsg });
      broadcastToUser(user.id, { type: 'chat:message', message: chatMsg });
    }
    res.json({ message: chatMsg });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/messages/:id/react', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const updated = db.reactToMessage(user.id, req.params.id, req.body.emoji);
    const updateEvent: WsServerMessage = { type: 'chat:message_updated', message: updated };
    if (updated.roomId) {
      broadcastToRoom(updated.roomId, updateEvent);
    } else if (updated.recipientId) {
      broadcastToUser(updated.recipientId, updateEvent);
      broadcastToUser(user.id, updateEvent);
    }
    res.json({ message: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/messages/:id/edit', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const updated = db.editMessage(user.id, req.params.id, req.body.text);
    const updateEvent: WsServerMessage = { type: 'chat:message_updated', message: updated };
    if (updated.roomId) {
      broadcastToRoom(updated.roomId, updateEvent);
    } else if (updated.recipientId) {
      broadcastToUser(updated.recipientId, updateEvent);
      broadcastToUser(user.id, updateEvent);
    }
    res.json({ message: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/messages/:id', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    db.deleteMessage(user.id, req.params.id);
    const deleteEvent: WsServerMessage = { type: 'chat:message_deleted', messageId: req.params.id };
    for (const s of clients.values()) {
      if (s.ws.readyState === WebSocket.OPEN) {
        s.ws.send(JSON.stringify(deleteEvent));
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Locations
app.post('/api/locations/update', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const { geog, accuracy_m, latitude, longitude, accuracy, altitude, heading, speed, batteryLevel } = req.body;
    const hasCoords = (latitude !== undefined && longitude !== undefined) || typeof geog === 'string';
    const hasAccuracy = accuracy_m !== undefined || accuracy !== undefined;
    if (!hasCoords || !hasAccuracy) {
      res.status(400).json({ error: 'Missing coordinates (geog or latitude/longitude) or accuracy_m' });
      return;
    }

    const loc = db.updateLocation(user.id, {
      geog: typeof geog === 'string' ? geog : undefined,
      accuracy_m: accuracy_m !== undefined ? Number(accuracy_m) : undefined,
      latitude: latitude !== undefined ? Number(latitude) : undefined,
      longitude: longitude !== undefined ? Number(longitude) : undefined,
      accuracy: accuracy !== undefined ? Number(accuracy) : undefined,
      altitude: altitude !== undefined && altitude !== null ? Number(altitude) : null,
      heading: heading !== undefined && heading !== null ? Number(heading) : null,
      speed: speed !== undefined && speed !== null ? Number(speed) : null,
      batteryLevel: batteryLevel !== undefined && batteryLevel !== null ? Number(batteryLevel) : null,
    });

    broadcastToAuthorizedPeers(user.id, { type: 'location:broadcast', location: loc });
    res.json({ location: loc });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/locations/live', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  const locations = db.getVisibleLocationsForUser(user.id);
  res.json({ locations });
});

app.get('/api/locations/trail/:userId', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const windowHours = req.query.windowHours ? Number(req.query.windowHours) : 1;
    const trail = db.getLocationTrail(user.id, req.params.userId, windowHours);
    res.json({ trail });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// Google Maps & OSM Places Search API
app.get('/api/locations/search', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (!query || query.length < 2) {
      res.json({ results: [] });
      return;
    }

    const lat = req.query.lat ? Number(req.query.lat) : undefined;
    const lon = req.query.lon ? Number(req.query.lon) : undefined;

    const places = await searchRealPlacesByQuery(query, lat, lon);
    res.json({ results: places });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Location search error', results: [] });
  }
});

// Helper: Haversine distance in meters
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

// Nearby Places Categories API (Enhanced for "Places Near Me")
app.get('/api/locations/nearby', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const category = String(req.query.category || 'all').toLowerCase();
    const maxRadiusMeters = req.query.radius ? Number(req.query.radius) : 10000;

    if (isNaN(lat) || isNaN(lon)) {
      res.status(400).json({ error: 'Valid lat and lon are required' });
      return;
    }

    const results = await fetchRealNearbyPlaces(lat, lon, category, maxRadiusMeters);
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Nearby query failed', results: [] });
  }
});

// OSRM Real Turn-by-Turn Directions API
app.get('/api/locations/directions', async (req, res) => {
  try {
    const startLat = Number(req.query.startLat);
    const startLng = Number(req.query.startLng);
    const endLat = Number(req.query.endLat);
    const endLng = Number(req.query.endLng);
    const mode = String(req.query.mode || 'driving').toLowerCase();

    if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
      res.status(400).json({ error: 'Valid start and end coordinates are required' });
      return;
    }

    const profile = mode === 'walking' ? 'foot' : mode === 'cycling' ? 'bike' : 'car';
    const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const resp = await fetch(osrmUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'BeaconNavigator/1.0' },
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      throw new Error(`OSRM responded with status ${resp.status}`);
    }

    const data = await resp.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error(data.message || 'No route found between points');
    }

    const route = data.routes[0];
    const steps: any[] = [];

    if (Array.isArray(route.legs)) {
      route.legs.forEach((leg: any) => {
        if (Array.isArray(leg.steps)) {
          leg.steps.forEach((st: any) => {
            const maneuver = st.maneuver || {};
            let instruction = st.name ? `Proceed onto ${st.name}` : 'Continue straight';
            if (maneuver.type === 'turn') {
              instruction = `Turn ${maneuver.modifier || ''} onto ${st.name || 'road'}`;
            } else if (maneuver.type === 'depart') {
              instruction = `Start heading ${maneuver.modifier || 'forward'} on ${st.name || 'path'}`;
            } else if (maneuver.type === 'arrive') {
              instruction = `Arrive at destination`;
            } else if (maneuver.type === 'roundabout') {
              instruction = `Take roundabout exit onto ${st.name || 'road'}`;
            }

            steps.push({
              instruction,
              name: st.name || '',
              distanceMeters: Math.round(st.distance || 0),
              durationSeconds: Math.round(st.duration || 0),
              type: maneuver.type,
              modifier: maneuver.modifier,
            });
          });
        }
      });
    }

    res.json({
      success: true,
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      geometry: route.geometry,
      steps,
      mode,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Routing calculation failed' });
  }
});

// Saved Places
app.get('/api/saved-places', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  const places = db.getSavedPlaces(user.id);
  res.json({ places });
});

app.post('/api/saved-places', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const place = db.createSavedPlace(user.id, req.body);
    res.json({ place });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/saved-places/:id', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  db.deleteSavedPlace(user.id, req.params.id);
  res.json({ success: true });
});

// Reminders
app.get('/api/reminders', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  const reminders = db.getReminders(user.id);
  res.json({ reminders });
});

app.post('/api/reminders', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const reminder = db.createReminder(user.id, req.body);
    res.json({ reminder });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/reminders/:id/trigger', authMiddleware, (req, res) => {
  db.markReminderTriggered(req.params.id);
  res.json({ success: true });
});

app.delete('/api/reminders/:id', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  db.deleteReminder(user.id, req.params.id);
  res.json({ success: true });
});

// Meetings
app.get('/api/meetings', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  const meetings = db.getMeetings(user.id);
  res.json({ meetings });
});

app.post('/api/meetings', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const meeting = db.createMeeting(user.id, req.body);
    res.json({ meeting });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/meetings/:id/rsvp', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const meeting = db.rsvpMeeting(user.id, req.params.id, req.body.status);
    res.json({ meeting });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Emergency Alerts
app.post('/api/alerts/emergency', authMiddleware, sosRateLimiter, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const alert = db.createEmergencyAlert(user.id, req.body);
    broadcastGlobalEmergency({ type: 'emergency:broadcast', alert });
    res.json({ alert });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/alerts/emergency/active', authMiddleware, (_req, res) => {
  const alerts = db.getActiveEmergencyAlerts();
  res.json({ alerts });
});

app.get('/api/alerts/emergency', authMiddleware, (_req, res) => {
  const alerts = db.getActiveEmergencyAlerts();
  res.json({ alerts });
});

app.post('/api/alerts/emergency/:id/ack', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const alert = db.acknowledgeEmergencyAlert(user.id, req.params.id);
    broadcastGlobalEmergency({ type: 'emergency:ack_update', alert });
    res.json({ alert });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/alerts/emergency/:id/resolve', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const alert = db.resolveEmergencyAlert(user.id, req.params.id);
    broadcastGlobalEmergency({ type: 'emergency:ack_update', alert });
    res.json({ alert });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/alerts/emergency/:id', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    db.deleteEmergencyAlert(user.id, req.params.id);
    broadcastGlobalEmergency({ type: 'emergency:deleted', alertId: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// Temporary Secure Emergency SOS Live Tracking Links (2-hour TTL for Emergency Responders)
interface SosShareTokenRecord {
  token: string;
  alertId: string;
  senderId: string;
  createdAt: string;
  expiresAt: string;
}
const sosShareTokens = new Map<string, SosShareTokenRecord>();

app.post('/api/alerts/emergency/:id/share', authMiddleware, (req, res) => {
  try {
    const alertId = req.params.id;
    const alerts = db.getActiveEmergencyAlerts();
    const alert = alerts.find((a) => a.id === alertId);
    if (!alert) {
      res.status(404).json({ error: 'Active emergency alert not found' });
      return;
    }

    const durationMinutes = Math.min(Math.max(Number(req.body?.durationMinutes) || 120, 15), 720);
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    const token =
      typeof req.body?.token === 'string' && req.body.token.length >= 12
        ? req.body.token
        : `sos_${alert.id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

    const record: SosShareTokenRecord = {
      token,
      alertId: alert.id,
      senderId: alert.senderId,
      createdAt: new Date().toISOString(),
      expiresAt,
    };
    sosShareTokens.set(token, record);

    res.json({
      token,
      alertId: alert.id,
      expiresAt,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to generate tracking token' });
  }
});

// Public endpoint for Emergency Responders opening a temporary secure tracking link
app.get('/api/alerts/track/:token', (req, res) => {
  try {
    const token = req.params.token;
    const record = sosShareTokens.get(token);
    const alerts = db.getActiveEmergencyAlerts();

    let alert = record ? alerts.find((a) => a.id === record.alertId) : undefined;
    if (!alert && typeof req.query.alertId === 'string') {
      alert = alerts.find((a) => a.id === req.query.alertId);
    }

    if (record && Date.now() > new Date(record.expiresAt).getTime()) {
      sosShareTokens.delete(token);
      res.status(410).json({ error: 'This temporary emergency tracking link has expired.' });
      return;
    }

    if (!alert) {
      res.status(404).json({ error: 'Emergency alert is resolved or no longer active.' });
      return;
    }

    const liveLoc = db.getVisibleLocationsForUser(alert.senderId).find(
      (l) => l.userId === alert!.senderId
    );

    res.json({
      alert: {
        ...alert,
        latitude: liveLoc ? liveLoc.latitude : alert.latitude,
        longitude: liveLoc ? liveLoc.longitude : alert.longitude,
        accuracy: liveLoc ? liveLoc.accuracy : alert.accuracy,
        timestamp: liveLoc ? liveLoc.timestamp : alert.timestamp,
      },
      expiresAt: record?.expiresAt || new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load live tracking data' });
  }
});

// Location Sharing Requests
app.post('/api/locations/request', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const request = db.requestLocationShare(user.id, req.body.toUserId);
    broadcastToUser(req.body.toUserId, {
      type: 'notification',
      title: 'Location Request',
      body: `${user.fullName} requested to view your live location`,
      notificationType: 'location_request',
      data: request,
    });
    res.json({ request });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/locations/respond', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const { requestId, response } = req.body;
    const updated = db.respondLocationShare(user.id, requestId, response);
    broadcastToUser(updated.fromUserId, {
      type: 'notification',
      title: 'Location Request Responded',
      body: `${user.fullName} ${response === 'accepted' ? 'accepted' : response === 'temporary' ? 'temporarily accepted' : 'declined'} your location request`,
      notificationType: 'location_response',
      data: updated,
    });
    res.json({ request: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/locations/requests', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  const requests = db.getLocationShareRequests(user.id);
  res.json({ requests });
});

// Community Moderation & Reports
app.post('/api/community/report', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const report = db.createReport(user.id, req.body);
    res.json({ report });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin System
app.get('/api/admin/stats', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  if (!user.isAdmin) {
    res.status(403).json({ error: 'Administrative privileges required' });
    return;
  }
  res.json({
    stats: db.getAdminStats(),
    users: db.getAllUsers(),
    rooms: db.getAllRooms(),
    reports: db.getReports(),
    logs: db.getAuditLogs(),
  });
});

app.post('/api/admin/reports/:id/resolve', authMiddleware, (req, res) => {
  const user = (req as any).user as UserProfile;
  if (!user.isAdmin) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  db.resolveReport(req.params.id, req.body.status);
  res.json({ success: true });
});

// Google Search Engine Optimization (SEO): Dynamic robots.txt and XML Sitemap
const DEFAULT_PUBLIC_ORIGIN = 'https://ais-pre-dkfhfrzboel3a3xnlpek5a-752786783113.asia-northeast1.run.app';

function resolvePublicOrigin(req: express.Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${proto.split(',')[0].trim()}://${host.split(',')[0].trim()}`;
  }
  return process.env.APP_URL || DEFAULT_PUBLIC_ORIGIN;
}

app.get('/robots.txt', (req, res) => {
  const origin = resolvePublicOrigin(req);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const origin = resolvePublicOrigin(req);
  const nowIso = new Date().toISOString();
  const urls = [
    { loc: `${origin}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${origin}/?tab=map`, priority: '0.9', changefreq: 'hourly' },
    { loc: `${origin}/?tab=rooms`, priority: '0.9', changefreq: 'hourly' },
    { loc: `${origin}/?tab=chat`, priority: '0.8', changefreq: 'daily' },
    { loc: `${origin}/?tab=alerts`, priority: '0.8', changefreq: 'hourly' },
    { loc: `${origin}/?tab=saved`, priority: '0.7', changefreq: 'weekly' },
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
});

// Explicit API 404 fallback to ensure API routes never return index.html
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Mount Vite in development or serve static in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Beacon Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
