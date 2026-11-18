/**
 * Core domain types and protocols for Beacon location & communication platform
 */

export type UserRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER' | 'GUEST';

export type LocationVisibility = 'nobody' | 'room_members' | 'selected' | 'emergency_only';
export type PhoneVisibility = 'everyone' | 'room_members' | 'nobody';
export type ProfileVisibility = 'public' | 'room_members' | 'private';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl: string;
  about: string;
  phoneNumber: string;
  createdAt: string;
  isOnline: boolean;
  lastSeen: string;
  privacy: {
    locationVisibility: LocationVisibility;
    phoneVisibility: PhoneVisibility;
    profileVisibility: ProfileVisibility;
    showOnlineStatus: boolean;
    locationSharingEnabled?: boolean; // Master opt-in location toggle (OFF by default)
    approximateSharing?: boolean; // Round shared coordinates to ~500m when enabled
    sharingDurationMode?: 'off' | '15m' | '1h' | 'until_stopped';
    temporarySharingExpiry?: string | null; // ISO timestamp when location sharing auto-expires
    blockedUserIds?: string[]; // Array of blocked user IDs
    notificationPreferences?: {
      incidents: boolean;
      community: boolean;
      mentions: boolean;
    };
  };
  isAdmin?: boolean;
  markerColor?: string; // Custom hex color for live map marker
  markerIcon?: string; // Custom icon identifier e.g. person, dad, mom, kid, pet, car, etc.
  markerLabel?: string;
}

export type UserPrivacySettings = UserProfile['privacy'];

export interface UserSession {
  token: string;
  fullToken?: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  userAgent?: string;
  ip?: string;
  isCurrent?: boolean;
}

export interface UserLocation {
  userId: string;
  username: string;
  fullName: string;
  avatarUrl: string;
  latitude: number;
  longitude: number;
  accuracy: number; // in meters (e.g. 8.5)
  lat?: number;
  lng?: number;
  accuracy_m?: number;
  geog?: string;
  updated_at?: string;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: string; // ISO string
  batteryLevel?: number | null;
  markerColor?: string;
  markerIcon?: string;
  markerLabel?: string;
  isStale?: boolean;
}

export interface LocationBreadcrumb {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number | null;
  heading?: number | null;
  altitude?: number | null;
  timestamp: string;
}

export interface UserPathTrail {
  userId: string;
  fullName: string;
  avatarUrl: string;
  points: LocationBreadcrumb[];
  totalDistanceMeters: number;
  startTime: string;
  endTime: string;
}

export interface RoomMember {
  userId: string;
  roomId: string;
  role: UserRole;
  joinedAt: string;
  user: UserProfile;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  ownerId: string;
  hasPassword: boolean;
  createdAt: string;
  memberCount: number;
  members?: RoomMember[];
  isPrivate: boolean;
  isUniversal?: boolean;
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'voice' | 'file';
  url: string;
  name: string;
  size: number;
  duration?: number; // for audio in seconds
}

export interface ChatMessage {
  id: string;
  roomId?: string; // null if direct message
  channelId?: string; // for Discord-style text channels within a room (#general, #live-locations, #announcements)
  senderId: string;
  senderName: string;
  senderAvatar: string;
  recipientId?: string; // for direct messages
  text: string;
  attachments?: MessageAttachment[];
  replyToId?: string;
  replyToText?: string;
  replyToSender?: string;
  reactions: Record<string, string[]>; // emoji -> [userIds]
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  clientMsgId?: string;
}

export interface SavedPlace {
  id: string;
  userId: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  radiusMeters: number; // For geofencing
  category: 'home' | 'work' | 'school' | 'family' | 'favorite' | 'emergency_point' | 'hospital' | 'park' | 'groceries' | 'gym';
  visibility: 'private' | 'room' | 'public';
  roomId?: string;
  createdAt: string;
  markerColor?: string; // Custom color for map marker e.g. '#10b981'
  markerIcon?: string; // Custom icon e.g. 'home' | 'work' | 'school' | 'family' | 'favorite' | 'emergency_point' | 'hospital' | 'park' | 'groceries' | 'gym' | 'star'
}

export interface PlaceResult {
  id: string;
  name: string;
  display_name: string;
  lat: number;
  lon: number;
  category?: string;
  type?: string;
  city?: string;
  state?: string;
  country?: string;
  distanceMeters?: number;
  estimatedDriveMinutes?: number;
  rating?: number;
  isOpen?: boolean;
}

export interface NavigationStep {
  instruction: string;
  name: string;
  distanceMeters: number;
  durationSeconds: number;
  type?: string;
  modifier?: string;
}

export interface RouteData {
  distanceMeters: number;
  durationSeconds: number;
  geometry: any;
  steps: NavigationStep[];
  mode: 'driving' | 'walking' | 'cycling';
  destinationName?: string;
  destinationCoords?: { lat: number; lng: number };
}

export interface ReminderItem {
  id: string;
  userId: string;
  roomId?: string;
  title: string;
  description: string;
  dueDateTime: string;
  locationId?: string;
  locationName?: string;
  locationCoords?: { lat: number; lng: number; radiusMeters: number };
  isGeofenced: boolean; // Triggers when within radius
  hasTriggered?: boolean;
  repeat: 'never' | 'daily' | 'weekly';
  createdAt: string;
}

export interface MeetingItem {
  id: string;
  roomId: string;
  creatorId: string;
  creatorName: string;
  title: string;
  description: string;
  date: string;
  time: string;
  locationName: string;
  latitude?: number;
  longitude?: number;
  attendees: Array<{ userId: string; status: 'accepted' | 'declined' | 'tentative' }>;
  createdAt: string;
}

export interface EmergencyAlert {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderPhone?: string;
  message: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  roomId?: string;
  roomName?: string;
  timestamp: string;
  status: 'active' | 'resolved';
  acknowledgedBy: Array<{ userId: string; name: string; timestamp: string }>;
}

export interface LocationShareRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUsername?: string;
  fromUserAvatar: string;
  toUserId: string;
  toUserName?: string;
  toUsername?: string;
  toUserAvatar?: string;
  status: 'pending' | 'accepted' | 'temporary' | 'denied';
  expiresAt?: string; // for temporary sharing
  createdAt: string;
  updatedAt?: string;
}

export interface ReportItem {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: 'user' | 'message' | 'room';
  targetId: string;
  reason: string;
  timestamp: string;
  status: 'pending' | 'reviewed' | 'dismissed';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  ip?: string;
}

// WebSocket Signaling & Realtime Events
export type WsClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'location:update'; location: { geog?: string; accuracy_m?: number; latitude: number; longitude: number; accuracy: number; altitude?: number | null; heading?: number | null; speed?: number | null; batteryLevel?: number | null } }
  | { type: 'room:join'; roomId: string }
  | { type: 'room:leave'; roomId: string }
  | { type: 'chat:message'; roomId?: string; channelId?: string; recipientId?: string; text: string; attachments?: MessageAttachment[]; replyToId?: string; clientMsgId?: string }
  | { type: 'chat:typing'; roomId?: string; recipientId?: string; isTyping: boolean }
  | { type: 'chat:reaction'; messageId: string; emoji: string }
  | { type: 'chat:delete'; messageId: string }
  | { type: 'chat:edit'; messageId: string; text: string }
  | { type: 'voice:signal'; roomId: string; targetPeerId?: string; data: any }
  | { type: 'voice:join'; roomId: string }
  | { type: 'voice:leave'; roomId: string }
  | { type: 'voice:speaking'; roomId: string; isSpeaking: boolean }
  | { type: 'emergency:sos'; message: string; latitude: number; longitude: number; accuracy: number; roomId?: string }
  | { type: 'emergency:ack'; alertId: string };

export type WsServerMessage =
  | { type: 'auth:success'; user: UserProfile }
  | { type: 'auth:error'; message: string }
  | { type: 'presence:update'; userLocations: UserLocation[]; onlineUsers: string[] }
  | { type: 'location:broadcast'; location: UserLocation }
  | { type: 'chat:message'; message: ChatMessage }
  | { type: 'chat:typing'; senderId: string; senderName: string; roomId?: string; isTyping: boolean }
  | { type: 'chat:message_updated'; message: ChatMessage }
  | { type: 'chat:message_deleted'; messageId: string }
  | { type: 'chat:cleared'; roomId?: string; partnerId?: string }
  | { type: 'voice:peer_joined'; peerId: string; user: UserProfile }
  | { type: 'voice:peer_left'; peerId: string }
  | { type: 'voice:signal'; fromPeerId: string; data: any }
  | { type: 'voice:speaking_update'; roomId: string; peerId: string; isSpeaking: boolean }
  | { type: 'voice:participants'; roomId: string; participants: Array<{ peerId: string; user: UserProfile; isSpeaking: boolean }> }
  | { type: 'emergency:broadcast'; alert: EmergencyAlert }
  | { type: 'emergency:ack_update'; alert: EmergencyAlert }
  | { type: 'emergency:deleted'; alertId: string }
  | { type: 'notification'; title: string; body: string; notificationType: string; data?: any }
  | { type: 'location.updated'; location: UserLocation }
  | { type: 'crowd.updated'; cell?: CrowdCellSummary; cells?: CrowdCellSummary[] }
  | { type: 'report.created'; report: CrowdZoneCommunityReport }
  | { type: 'report.verified'; report: CrowdZoneCommunityReport }
  | { type: 'message.created'; message: ChatMessage }
  | { type: 'alert.created'; alert: EmergencyAlert }
  | { type: 'notification.created'; notification: CrowdZoneNotificationItem }
  | { type: 'room.updated'; room: Room };

// ============================================================================
// CROWDZONE MODULE DOMAIN TYPES (Geohash Crowd Intelligence & Community Feed)
// ============================================================================

export type CrowdLevel = 'Quiet' | 'Moderate' | 'Busy' | 'Very Busy' | 'Unknown';

export type CrowdActivityWindow = '15m' | '1h' | '3h' | '24h' | '7d' | 'all';
export type CrowdTimeWindow = CrowdActivityWindow;

export type CrowdTrendDirection = 'increasing' | 'decreasing' | 'stable';
export type CrowdTrend = CrowdTrendDirection;

export type CrowdReportCategory =
  | 'crowd_level'
  | 'queue_wait'
  | 'event'
  | 'incident'
  | 'traffic'
  | 'safety_hazard'
  | 'weather'
  | 'crowd'
  | 'queue'
  | 'safety'
  | 'transit'
  | 'facility';

export interface CrowdCellSummary {
  cellId: string;
  geohash: string;
  centerLat: number;
  centerLng: number;
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  crowdLevel: CrowdLevel;
  densityScore: number;
  confidenceScore: number; // 0 - 100
  trend: CrowdTrendDirection;
  dataSource: 'measured' | 'reported' | 'hybrid' | 'insufficient';
  dataOrigin: 'measured' | 'reported' | 'hybrid' | 'insufficient';
  insufficientData: boolean;
  activeSignalsBucket: number;
  verifiedReportCount: number;
  verifiedReportsCount: number;
  totalReportsCount: number;
  weightedScore: number;
  windowId: CrowdActivityWindow;
  updatedAt: string;
}

export interface CrowdHistoryBucket {
  bucketStart: string;
  bucketEnd: string;
  label: string;
  crowdLevel: CrowdLevel;
  densityScore: number;
  signalCount: number;
  reportCount: number;
  weightedScore: number;
  activityType: 'observed' | 'predicted';
}

export interface CrowdPredictionPoint {
  hourOffset: number;
  targetTime: string;
  label: string;
  hourLabel: string;
  predictedLevel: CrowdLevel;
  predictedDensityScore: number;
  predictedScore: number;
  confidenceScore: number;
  activityType: 'predicted';
  basis: string;
}

export interface CrowdZoneCommunityReport {
  id: string;
  cellId: string;
  geohash?: string;
  reporterId: string;
  reporterName: string;
  reporterAvatar?: string;
  authorId?: string;
  authorName?: string;
  placeName: string;
  category: CrowdReportCategory;
  crowdLevel: Exclude<CrowdLevel, 'Unknown'>;
  waitMinutes?: number | null;
  title?: string;
  description: string;
  latitude: number;
  longitude: number;
  verified?: boolean;
  verifiedBy: string[];
  verificationCount: number;
  verificationsCount?: number;
  confidenceScore: number;
  status: 'active' | 'expired' | 'resolved' | 'removed' | 'dismissed';
  createdAt: string;
  updatedAt?: string;
  expiresAt: string;
}

export interface CrowdZoneComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt: string;
}

export interface CrowdZonePost {
  id: string;
  cellId?: string;
  geohash?: string;
  placeName?: string;
  latitude?: number;
  longitude?: number;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  content?: string;
  crowdLevel?: CrowdLevel;
  category?: 'update' | 'tip' | 'question' | 'alert' | 'event';
  likes: string[];
  reactions: Record<string, string[]>;
  comments: CrowdZoneComment[];
  status: 'active' | 'removed';
  createdAt: string;
  updatedAt?: string;
}

export interface CrowdZoneSavedPlace {
  id: string;
  userId: string;
  name: string;
  customLabel?: string;
  address: string;
  category: string;
  latitude: number;
  longitude: number;
  cellId: string;
  geohash?: string;
  notifyWhenLevel: Exclude<CrowdLevel, 'Unknown'>;
  alertsEnabled: boolean;
  notifyOnCrowdChange?: boolean;
  alertThreshold?: CrowdLevel;
  createdAt: string;
}

export interface CrowdZoneUserSettings {
  userId: string;
  contributeAnonymousCrowdSignals: boolean;
  notificationRadiusKm: number;
  crowdAlertsEnabled: boolean;
  emergencyAlertsEnabled: boolean;
  communityReportAlertsEnabled: boolean;
  notifyNearbyCrowdChanges?: boolean;
  notifyEmergencyAlerts?: boolean;
  notifyCommunityReports?: boolean;
  notifySavedPlaceAlerts?: boolean;
  updatedAt: string;
}

export interface CrowdZoneNotificationItem {
  id: string;
  userId?: string;
  type: 'crowd_change' | 'emergency' | 'community_report' | 'saved_place';
  title: string;
  body: string;
  latitude?: number;
  longitude?: number;
  geohash?: string;
  crowdLevel?: CrowdLevel;
  createdAt: string;
}

export interface ModerationLogEntry {
  id: string;
  moderatorId: string;
  moderatorName: string;
  targetType: 'crowd_report' | 'crowd_post' | 'user' | 'room';
  targetId: string;
  action: 'approve' | 'remove' | 'expire' | 'warn' | 'verify' | 'dismiss' | 'flag_spam';
  reason: string;
  createdAt: string;
}


