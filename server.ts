import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { db, UPLOADS_DIR } from './src/server/db.ts';
import type { WsClientMessage, WsServerMessage, UserProfile } from './src/types.ts';

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

// Body parsers with large limits for media/voice uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
  const members = db.getRoomMembers(roomId);
  const memberUserIds = new Set(members.map((m) => m.userId));
  const payload = JSON.stringify(message);

  for (const session of clients.values()) {
    if (memberUserIds.has(session.userId) && session.userId !== excludeUserId && session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(payload);
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

// WebSocket connection lifecycle
wss.on('connection', (ws: WebSocket, req) => {
  let authenticatedUserId: string | null = null;

  ws.on('message', (rawData) => {
    try {
      const msg: WsClientMessage = JSON.parse(rawData.toString());

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
        const onlineUsers = Array.from(new Set(Array.from(clients.values()).map((c) => c.userId)));
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

// Authentication
app.post('/api/auth/register', (req, res) => {
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

    const user = db.createUser({ email, username, fullName, password, phoneNumber, avatarUrl });
    const token = db.createSession(user.id);
    db.logAudit(user.id, user.fullName, 'USER_REGISTERED', `Account created with username ${username}`);

    res.json({ user, token });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      res.status(400).json({ error: 'Username/email and password required' });
      return;
    }

    const userRec = db.findUserByEmailOrUsername(identifier);
    if (!userRec) {
      res.status(401).json({ error: 'Invalid username/email or password' });
      return;
    }

    const isValid = db.verifyPassword(password, userRec.passwordHash, userRec.salt);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid username/email or password' });
      return;
    }

    const token = db.createSession(userRec.id);
    const safeUser = db.sanitizeUser(userRec);
    db.setOnlineStatus(userRec.id, true);
    db.logAudit(userRec.id, userRec.fullName, 'USER_LOGIN', 'Logged into Beacon');

    res.json({ user: safeUser, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed' });
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
  res.json({ success: true });
});

app.post('/api/auth/password-reset/request', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email address is required' });
      return;
    }
    const code = db.createPasswordReset(email.trim());
    // Return code for instant user entry (production would email it)
    res.json({
      success: true,
      message: 'Reset verification code sent',
      code, // Provided so user can immediately copy/paste in interface
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Password reset request failed' });
  }
});

app.post('/api/auth/password-reset/confirm', (req, res) => {
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

// Proxy for Geocoding search (OpenStreetMap Nominatim) with proper headers
app.get('/api/locations/search', async (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q || q.trim().length === 0) {
      res.json({ results: [] });
      return;
    }

    const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      q.trim()
    )}&limit=5`;

    const nominatimRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'BeaconCommunityApp/1.0 (contact: support@beacon-app.local)',
        'Accept-Language': 'en',
      },
    });

    if (!nominatimRes.ok) {
      res.json({ results: [] });
      return;
    }

    const data: any = await nominatimRes.json();
    const results = (Array.isArray(data) ? data : []).map((item: any) => ({
      name: item.display_name.split(',')[0],
      display_name: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
    }));

    res.json({ results });
  } catch (err: any) {
    console.warn('Geocoding search error:', err.message);
    res.json({ results: [] });
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

// File & Audio Uploads (Base64 data or binary)
app.post('/api/upload', authMiddleware, (req, res) => {
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

    const type = mimeType || matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    let ext = '.bin';
    if (type.includes('image/png')) ext = '.png';
    else if (type.includes('image/jpeg')) ext = '.jpg';
    else if (type.includes('image/webp')) ext = '.webp';
    else if (type.includes('audio/webm')) ext = '.webm';
    else if (type.includes('audio/ogg')) ext = '.ogg';
    else if (type.includes('audio/mp4') || type.includes('audio/m4a')) ext = '.m4a';
    else if (type.includes('audio/wav')) ext = '.wav';

    const safeName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeName);

    fs.writeFileSync(filePath, buffer);
    const publicUrl = `/uploads/${safeName}`;

    res.json({
      url: publicUrl,
      name: filename || safeName,
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

// Chat Messages
app.get('/api/rooms/:id/messages', authMiddleware, (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const messages = db.getRoomMessages(req.params.id, limit);
  res.json({ messages });
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

// Locations
app.post('/api/locations/update', authMiddleware, (req, res) => {
  try {
    const user = (req as any).user as UserProfile;
    const { latitude, longitude, accuracy, altitude, heading, speed, batteryLevel } = req.body;
    if (latitude === undefined || longitude === undefined || accuracy === undefined) {
      res.status(400).json({ error: 'Missing coordinates or accuracy' });
      return;
    }

    const loc = db.updateLocation(user.id, {
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: Number(accuracy),
      altitude: altitude !== undefined ? Number(altitude) : null,
      heading: heading !== undefined ? Number(heading) : null,
      speed: speed !== undefined ? Number(speed) : null,
      batteryLevel: batteryLevel !== undefined ? Number(batteryLevel) : null,
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
app.post('/api/alerts/emergency', authMiddleware, (req, res) => {
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
