import type { Room, SavedPlace, UserLocation } from '../types.ts';
import { calculateDistanceMeters } from './geo.ts';
import { notifications } from './notifications.ts';
import { sound, triggerHaptic } from './audio.ts';

export interface RoomSavedPlaceGeofence {
  id: string;
  roomId: string;
  roomName: string;
  placeId: string;
  placeName: string;
  placeCategory?: SavedPlace['category'];
  placeIcon?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  color: string;
  enabled: boolean;
  notifyOnEnter: boolean;
  notifyOnLeave: boolean;
  postToRoomChat: boolean;
  watchedMemberIds: string[]; // empty array = monitor all group members in the room
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomGeofenceAlertEvent {
  id: string;
  geofenceId: string;
  roomId: string;
  roomName: string;
  placeId: string;
  placeName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  userId: string;
  memberName: string;
  memberAvatar?: string;
  action: 'entered' | 'left';
  distanceMeters: number;
  timestamp: string;
  isSimulated?: boolean;
}

export const ROOM_GEOFENCES_STORAGE_KEY = 'beacon_room_place_geofences_v1';
export const ROOM_GEOFENCE_EVENTS_STORAGE_KEY = 'beacon_room_place_geofence_events_v1';

// Singleton state map to track inside/outside state across tabs without duplicate notifications
// Key: `${geofenceId}::${userId}` -> boolean (true = inside, false = outside)
const memberInsideGeofenceStateMap = new Map<string, boolean>();
// Cooldown map to prevent duplicate firing within 8 seconds for the same geofence + member + action
const recentTransitionCooldownMap = new Map<string, number>();

export function loadRoomGeofences(): RoomSavedPlaceGeofence[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ROOM_GEOFENCES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRoomGeofences(list: RoomSavedPlaceGeofence[]): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ROOM_GEOFENCES_STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(
      new CustomEvent('beacon:room-geofences-updated', { detail: list })
    );
  } catch {
    // ignore storage errors
  }
}

export function upsertRoomGeofence(
  geofence: RoomSavedPlaceGeofence,
  currentLocations: UserLocation[] = []
): RoomSavedPlaceGeofence[] {
  const list = loadRoomGeofences();
  const idx = list.findIndex(
    (g) =>
      g.id === geofence.id ||
      (g.roomId === geofence.roomId && g.placeId === geofence.placeId)
  );

  let nextList: RoomSavedPlaceGeofence[];
  let savedItem: RoomSavedPlaceGeofence = geofence;

  if (idx >= 0) {
    savedItem = {
      ...list[idx],
      ...geofence,
      id: list[idx].id,
      updatedAt: new Date().toISOString(),
    };
    nextList = [...list];
    nextList[idx] = savedItem;
  } else {
    nextList = [geofence, ...list];
  }

  // Snapshot baseline inside/outside state for currently known peer locations so saving doesn't false-fire
  for (const loc of currentLocations) {
    if (!loc || !Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) continue;
    const dist = calculateDistanceMeters(
      loc.latitude,
      loc.longitude,
      savedItem.latitude,
      savedItem.longitude
    );
    const isInside = dist <= (savedItem.radiusMeters || 150);
    memberInsideGeofenceStateMap.set(`${savedItem.id}::${loc.userId}`, isInside);
  }

  saveRoomGeofences(nextList);
  return nextList;
}

export function deleteRoomGeofence(geofenceId: string): RoomSavedPlaceGeofence[] {
  const list = loadRoomGeofences();
  const nextList = list.filter((g) => g.id !== geofenceId);
  saveRoomGeofences(nextList);
  return nextList;
}

export function loadRoomGeofenceEvents(): RoomGeofenceAlertEvent[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ROOM_GEOFENCE_EVENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendRoomGeofenceEvent(
  event: RoomGeofenceAlertEvent
): RoomGeofenceAlertEvent[] {
  const existing = loadRoomGeofenceEvents();
  const next = [event, ...existing.filter((e) => e.id !== event.id)].slice(0, 60);
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ROOM_GEOFENCE_EVENTS_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(
        new CustomEvent('beacon:room-geofence-events-updated', { detail: next })
      );
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearRoomGeofenceEvents(roomId?: string): RoomGeofenceAlertEvent[] {
  const existing = loadRoomGeofenceEvents();
  const next = roomId ? existing.filter((e) => e.roomId !== roomId) : [];
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ROOM_GEOFENCE_EVENTS_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(
        new CustomEvent('beacon:room-geofence-events-updated', { detail: next })
      );
    } catch {
      // ignore
    }
  }
  return next;
}

export interface EvaluateRoomGeofencesOptions {
  currentUserId?: string;
  geofences: RoomSavedPlaceGeofence[];
  savedPlaces: SavedPlace[];
  userLocations: UserLocation[];
  rooms?: Room[];
  activeRoomDetails?: Room | null;
  onAlertTriggered?: (event: RoomGeofenceAlertEvent, geofence: RoomSavedPlaceGeofence) => void;
}

/**
 * Evaluates all enabled Room Saved-Place Geofences against live member locations.
 * Automatically dispatches push notifications, sound chimes, and logs transition events
 * when a watched group member enters or leaves a saved place's geofence area.
 */
export function evaluateRoomSavedPlaceGeofences({
  currentUserId,
  geofences,
  savedPlaces,
  userLocations,
  rooms = [],
  activeRoomDetails = null,
  onAlertTriggered,
}: EvaluateRoomGeofencesOptions): RoomGeofenceAlertEvent[] {
  if (!geofences || geofences.length === 0 || !userLocations || userLocations.length === 0) {
    return [];
  }

  const triggeredEvents: RoomGeofenceAlertEvent[] = [];
  const nowMs = Date.now();

  for (const gf of geofences) {
    if (!gf || !gf.enabled) continue;

    // Resolve up-to-date coordinates from savedPlaces if available
    const linkedPlace = savedPlaces.find((p) => p.id === gf.placeId);
    const targetLat = linkedPlace ? linkedPlace.latitude : gf.latitude;
    const targetLng = linkedPlace ? linkedPlace.longitude : gf.longitude;
    const targetName = linkedPlace ? linkedPlace.name : gf.placeName;
    const radius = Math.max(15, Number(gf.radiusMeters || linkedPlace?.radiusMeters || 150));

    if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) continue;

    // Determine room metadata and member roster if available
    const roomObj =
      activeRoomDetails?.id === gf.roomId
        ? activeRoomDetails
        : rooms.find((r) => r.id === gf.roomId);
    const roomName = roomObj?.name || gf.roomName || 'Room';
    const roomMemberIds =
      roomObj?.members && roomObj.members.length > 0
        ? new Set(roomObj.members.map((m) => m.userId))
        : null;

    for (const peerLoc of userLocations) {
      if (!peerLoc || !peerLoc.userId) continue;
      if (currentUserId && peerLoc.userId === currentUserId) continue;

      // If watching specific members, enforce member filter
      if (gf.watchedMemberIds && gf.watchedMemberIds.length > 0) {
        if (!gf.watchedMemberIds.includes(peerLoc.userId)) continue;
      } else if (roomMemberIds && gf.roomId !== 'room-universal') {
        // Otherwise, if we have the room's member roster, check membership
        if (!roomMemberIds.has(peerLoc.userId)) continue;
      }

      const dist = calculateDistanceMeters(
        peerLoc.latitude,
        peerLoc.longitude,
        targetLat,
        targetLng
      );
      const isInside = dist <= radius;
      const stateKey = `${gf.id}::${peerLoc.userId}`;
      const wasInside = memberInsideGeofenceStateMap.get(stateKey);

      if (wasInside === undefined) {
        // Establish baseline on first location fix so initial load doesn't false-fire
        memberInsideGeofenceStateMap.set(stateKey, isInside);
        continue;
      }

      if (wasInside === isInside) {
        continue;
      }

      // Transition detected! Update state immediately
      memberInsideGeofenceStateMap.set(stateKey, isInside);
      const action: 'entered' | 'left' = isInside ? 'entered' : 'left';

      if (action === 'entered' && !gf.notifyOnEnter) continue;
      if (action === 'left' && !gf.notifyOnLeave) continue;

      const cooldownKey = `${gf.id}::${peerLoc.userId}::${action}`;
      const lastFiredAt = recentTransitionCooldownMap.get(cooldownKey) || 0;
      if (nowMs - lastFiredAt < 8000) {
        continue;
      }
      recentTransitionCooldownMap.set(cooldownKey, nowMs);

      const memberFromRoom = roomObj?.members?.find((m) => m.userId === peerLoc.userId);
      const memberName =
        memberFromRoom?.user?.fullName ||
        peerLoc.fullName ||
        peerLoc.username ||
        'Group Member';
      const memberAvatar = memberFromRoom?.user?.avatarUrl || peerLoc.avatarUrl;

      const event: RoomGeofenceAlertEvent = {
        id: `rgf-ev-${nowMs}-${peerLoc.userId}-${gf.id}-${action}`,
        geofenceId: gf.id,
        roomId: gf.roomId,
        roomName,
        placeId: gf.placeId,
        placeName: targetName,
        latitude: targetLat,
        longitude: targetLng,
        radiusMeters: radius,
        userId: peerLoc.userId,
        memberName,
        memberAvatar,
        action,
        distanceMeters: Math.round(dist),
        timestamp: new Date().toISOString(),
      };

      // 1. Persist event and broadcast update
      appendRoomGeofenceEvent(event);
      triggeredEvents.push(event);

      // 2. Play chime + haptic feedback + dispatch OS/Browser/Device Push Notification
      sound.playChime();
      triggerHaptic('medium');
      notifications.notifyMemberGeofence(memberName, action, targetName, dist, {
        roomId: gf.roomId,
        roomName,
        latitude: targetLat,
        longitude: targetLng,
        radiusMeters: radius,
      });

      // 3. Notify caller (for Toast and optional Room Chat announcement)
      if (onAlertTriggered) {
        onAlertTriggered(event, gf);
      }
    }
  }

  return triggeredEvents;
}

/**
 * Triggers a live test/simulated Enter or Leave transition for a Room Saved-Place Geofence
 * so users can immediately verify push notifications, device banners, sound, and chat announcements.
 */
export function triggerSimulatedRoomGeofenceAlert(
  geofence: RoomSavedPlaceGeofence,
  action: 'entered' | 'left',
  member: { userId: string; fullName: string; avatarUrl?: string },
  onAlertTriggered?: (event: RoomGeofenceAlertEvent, geofence: RoomSavedPlaceGeofence) => void
): RoomGeofenceAlertEvent {
  const simulatedDistance =
    action === 'entered'
      ? Math.max(5, Math.round(geofence.radiusMeters * 0.35))
      : Math.round(geofence.radiusMeters * 1.35);

  // Sync internal state map so subsequent live updates reflect this transition
  memberInsideGeofenceStateMap.set(
    `${geofence.id}::${member.userId}`,
    action === 'entered'
  );

  const event: RoomGeofenceAlertEvent = {
    id: `rgf-sim-${Date.now()}-${member.userId}-${geofence.id}-${action}`,
    geofenceId: geofence.id,
    roomId: geofence.roomId,
    roomName: geofence.roomName,
    placeId: geofence.placeId,
    placeName: geofence.placeName,
    latitude: geofence.latitude,
    longitude: geofence.longitude,
    radiusMeters: geofence.radiusMeters,
    userId: member.userId,
    memberName: member.fullName,
    memberAvatar: member.avatarUrl,
    action,
    distanceMeters: simulatedDistance,
    timestamp: new Date().toISOString(),
    isSimulated: true,
  };

  appendRoomGeofenceEvent(event);
  sound.playChime();
  triggerHaptic('medium');
  notifications.notifyMemberGeofence(
    member.fullName,
    action,
    geofence.placeName,
    simulatedDistance,
    {
      roomId: geofence.roomId,
      roomName: geofence.roomName,
      latitude: geofence.latitude,
      longitude: geofence.longitude,
      radiusMeters: geofence.radiusMeters,
    }
  );

  if (onAlertTriggered) {
    onAlertTriggered(event, geofence);
  }

  return event;
}
