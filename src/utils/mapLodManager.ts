export type MapLodMode = 'auto' | 'aggressive' | 'off';

export type MapLodTier = 'macro' | 'city' | 'neighborhood' | 'street';

export interface MapLodCountsInput {
  savedPlacesCount: number;
  customGeofencesCount: number;
  crowdReportsCount: number;
  crowdHeatmapsCount: number;
  emergencyFacilitiesCount: number;
  nearbyPoisCount: number;
  peerMarkersCount: number;
}

export interface MapLodState {
  mode: MapLodMode;
  tier: MapLodTier;
  tierLabel: string;
  zoom: number;
  effectiveOffset: number;
  // Layer & Marker Visibility Flags
  showSavedPlaces: boolean;
  showSavedPlaceLabels: boolean;
  showCustomGeofenceShapes: boolean;
  showCustomGeofenceLabels: boolean;
  showCrowdHeatmaps: boolean;
  showCommunityReportPins: boolean;
  showEmergencyFacilityPins: boolean;
  showNearbyPoiPins: boolean;
  compactPeerMarkers: boolean;
  // Telemetry counts for UI feedback
  culledMarkersCount: number;
  visibleNonEssentialCount: number;
  totalNonEssentialCount: number;
  thresholds: {
    savedPlacesMinZoom: number;
    crowdHeatmapMinZoom: number;
    communityReportsMinZoom: number;
    nearbyPoisMinZoom: number;
    fullPeerDetailMinZoom: number;
  };
}

export const MAP_LOD_STORAGE_KEY = 'beacon_map_lod_mode_v1';

export function loadSavedMapLodMode(): MapLodMode {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'auto';
  }
  try {
    const raw = localStorage.getItem(MAP_LOD_STORAGE_KEY);
    if (raw === 'auto' || raw === 'aggressive' || raw === 'off') {
      return raw;
    }
  } catch {
    // ignore storage errors
  }
  return 'auto';
}

export function saveMapLodMode(mode: MapLodMode): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(MAP_LOD_STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent('beacon:map-lod-changed', { detail: { mode } }));
  } catch {
    // ignore storage errors
  }
}

/**
 * Computes the active Level-of-Detail (LOD) visibility state for LiveMap based on
 * current zoom level, selected LOD mode ('auto' | 'aggressive' | 'off'), Low Power Mode,
 * and current marker counts.
 */
export function computeMapLodState(
  zoom: number,
  mode: MapLodMode,
  isLowPowerMode: boolean,
  counts: MapLodCountsInput
): MapLodState {
  const safeZoom = Number.isFinite(zoom) ? zoom : 15;

  // Aggressive mode or Low Power Mode raises zoom thresholds so non-essential markers
  // are hidden earlier when zooming out, reducing GPU draw calls & DOM nodes.
  const effectiveOffset =
    mode === 'off' ? -99 : mode === 'aggressive' ? 1.5 : isLowPowerMode ? 1.0 : 0;

  const savedPlacesMinZoom = Math.round((11 + effectiveOffset) * 10) / 10;
  const crowdHeatmapMinZoom = Math.round((11.5 + effectiveOffset) * 10) / 10;
  const fullPeerDetailMinZoom = Math.round((12.5 + effectiveOffset) * 10) / 10;
  const communityReportsMinZoom = Math.round((13 + effectiveOffset) * 10) / 10;
  const nearbyPoisMinZoom = Math.round((14 + effectiveOffset) * 10) / 10;

  const isLodDisabled = mode === 'off';

  const showSavedPlaces = isLodDisabled || safeZoom >= savedPlacesMinZoom;
  const showSavedPlaceLabels = isLodDisabled || safeZoom >= fullPeerDetailMinZoom;
  const showCustomGeofenceShapes = isLodDisabled || safeZoom >= savedPlacesMinZoom;
  const showCustomGeofenceLabels = isLodDisabled || safeZoom >= communityReportsMinZoom;
  const showCrowdHeatmaps = isLodDisabled || safeZoom >= crowdHeatmapMinZoom;
  const showCommunityReportPins = isLodDisabled || safeZoom >= communityReportsMinZoom;
  const showEmergencyFacilityPins = isLodDisabled || safeZoom >= communityReportsMinZoom;
  const showNearbyPoiPins = isLodDisabled || safeZoom >= nearbyPoisMinZoom;
  const compactPeerMarkers = !isLodDisabled && safeZoom < fullPeerDetailMinZoom;

  let tier: MapLodTier = 'street';
  let tierLabel = 'Street Detail (Full LOD)';
  if (!isLodDisabled) {
    if (safeZoom < savedPlacesMinZoom) {
      tier = 'macro';
      tierLabel = 'Macro Overview (Essential Only)';
    } else if (safeZoom < communityReportsMinZoom) {
      tier = 'city';
      tierLabel = 'City LOD (Places & Zones)';
    } else if (safeZoom < nearbyPoisMinZoom) {
      tier = 'neighborhood';
      tierLabel = 'Neighborhood LOD (Reports Active)';
    } else {
      tier = 'street';
      tierLabel = 'Street Detail (All Markers)';
    }
  } else {
    tierLabel = 'LOD Off (All Markers Forced On)';
  }

  const totalNonEssentialCount =
    counts.savedPlacesCount +
    counts.customGeofencesCount +
    counts.crowdReportsCount +
    counts.crowdHeatmapsCount +
    counts.emergencyFacilitiesCount +
    counts.nearbyPoisCount;

  const visibleNonEssentialCount =
    (showSavedPlaces ? counts.savedPlacesCount : 0) +
    (showCustomGeofenceLabels ? counts.customGeofencesCount : 0) +
    (showCommunityReportPins ? counts.crowdReportsCount : 0) +
    (showCrowdHeatmaps ? counts.crowdHeatmapsCount : 0) +
    (showEmergencyFacilityPins ? counts.emergencyFacilitiesCount : 0) +
    (showNearbyPoiPins ? counts.nearbyPoisCount : 0);

  const culledMarkersCount = Math.max(0, totalNonEssentialCount - visibleNonEssentialCount);

  return {
    mode,
    tier,
    tierLabel,
    zoom: safeZoom,
    effectiveOffset,
    showSavedPlaces,
    showSavedPlaceLabels,
    showCustomGeofenceShapes,
    showCustomGeofenceLabels,
    showCrowdHeatmaps,
    showCommunityReportPins,
    showEmergencyFacilityPins,
    showNearbyPoiPins,
    compactPeerMarkers,
    culledMarkersCount,
    visibleNonEssentialCount,
    totalNonEssentialCount,
    thresholds: {
      savedPlacesMinZoom,
      crowdHeatmapMinZoom,
      communityReportsMinZoom,
      nearbyPoisMinZoom,
      fullPeerDetailMinZoom,
    },
  };
}
