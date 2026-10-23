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
