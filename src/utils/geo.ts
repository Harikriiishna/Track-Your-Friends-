/**
 * Geolocation & GIS computation utilities
 */

// Calculate Haversine distance between two coordinates in meters
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's mean radius in meters
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

// Format distance strictly following product specification:
// meters under 1000m ("25 m", "840 m"), and kilometers for longer ("2.4 km")
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = (meters / 1000).toFixed(1);
  return `${km} km`;
}

// Check if a point is within geofence radius
export function isWithinRadius(
  currentLat: number,
  currentLng: number,
  targetLat: number,
  targetLng: number,
  radiusMeters: number
): boolean {
  const dist = calculateDistanceMeters(currentLat, currentLng, targetLat, targetLng);
  return dist <= radiusMeters;
}

// Format location accuracy: e.g. "±8 m"
export function formatAccuracy(accuracyMeters: number): string {
  const rounded = Math.round(accuracyMeters);
  return `±${rounded} m`;
}

// Threshold in meters above which GPS signal strength is considered low
export const LOW_GPS_ACCURACY_THRESHOLD_METERS = 25;

export interface GpsSignalInfo {
  isLowSignal: boolean;
  level: 'high' | 'low' | 'very_low';
  label: string;
  circleColor: string;
  badgeBgClass: string;
  badgeTextClass: string;
}

// Evaluate GPS signal strength based on reported accuracy radius (in meters)
export function getGpsSignalInfo(accuracyMeters?: number | null): GpsSignalInfo {
  const acc = typeof accuracyMeters === 'number' && !isNaN(accuracyMeters) ? accuracyMeters : 0;
  if (acc > 60) {
    return {
      isLowSignal: true,
      level: 'very_low',
      label: 'Poor GPS Signal',
      circleColor: '#f43f5e', // rose-500
      badgeBgClass: 'bg-rose-500/20 border-rose-500/40',
      badgeTextClass: 'text-rose-400',
    };
  }
  if (acc > LOW_GPS_ACCURACY_THRESHOLD_METERS) {
    return {
      isLowSignal: true,
      level: 'low',
      label: 'Low GPS Signal',
      circleColor: '#f59e0b', // amber-500
      badgeBgClass: 'bg-amber-500/20 border-amber-500/40',
      badgeTextClass: 'text-amber-400',
    };
  }
  return {
    isLowSignal: false,
    level: 'high',
    label: 'Strong GPS',
    circleColor: '#4285F4', // Google blue
    badgeBgClass: 'bg-emerald-500/20 border-emerald-500/40',
    badgeTextClass: 'text-emerald-400',
  };
}

// Time ago helper for last updated timestamps
export function formatTimeAgo(isoString: string): string {
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec} seconds ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  return new Date(isoString).toLocaleDateString();
}

// Calculate true bearing/heading between two coordinates in degrees (0 - 360)
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}
