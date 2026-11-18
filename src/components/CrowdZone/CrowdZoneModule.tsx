import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import L from 'leaflet';
import {
  Radar,
  Compass,
  Map as MapIcon,
  Activity,
  Users,
  Bell,
  Bookmark,
  BarChart3,
  Settings,
  Search,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  MessageSquare,
  Send,
  Trash2,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  MapPin,
  Lock,
  Crosshair,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import type {
  UserProfile,
  UserLocation,
  EmergencyAlert,
  CrowdTimeWindow,
  CrowdLevel,
  CrowdCellSummary,
  CrowdHistoryBucket,
  CrowdPredictionPoint,
  CrowdZoneCommunityReport,
  CrowdZonePost,
  CrowdZoneSavedPlace,
  CrowdZoneUserSettings,
  CrowdReportCategory,
  ModerationLogEntry,
} from '../../types.ts';
import {
  TIME_WINDOW_LABELS,
  encodeGeohash,
  recommendAlternativePlaces,
  haversineMeters,
} from '../../utils/crowdIntelligenceEngine.ts';
import {
  fetchRealNearbyPlaces,
  searchRealPlacesByQuery,
} from '../../utils/nearbyPlaces.ts';
import { CrowdTrendD3Chart } from './CrowdTrendD3Chart.tsx';

interface NearbyPlace {
  id: string;
  name: string;
  address: string;
  display_name?: string;
  category: string;
  type?: string;
  lat: number;
  lon: number;
  distanceMeters?: number;
  rating?: number;
  isOpen?: boolean;
  estimatedDriveMinutes?: number;
}

interface CrowdZoneModuleProps {
  user: UserProfile;
  myLocation: UserLocation | null;
  userLocations: UserLocation[];
  activeAlerts: EmergencyAlert[];
  apiFetch: <T = any>(path: string, options?: RequestInit) => Promise<T>;
  onRequestFreshGps?: () => void;
}

type CrowdZoneSubTab =
  | 'explore'
  | 'map'
  | 'activity'
  | 'community'
  | 'alerts'
  | 'saved'
  | 'analytics'
  | 'settings';

const SUB_TABS: Array<{
  id: CrowdZoneSubTab;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'map', label: 'Live Crowd Map', icon: MapIcon },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'saved', label: 'Saved Places', icon: Bookmark },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const TIME_WINDOWS: CrowdTimeWindow[] = ['15m', '1h', '3h', '24h', '7d', 'all'];

const CROWD_LEVEL_META: Record<
  CrowdLevel,
  { color: string; bg: string; border: string; text: string; badge: string }
> = {
  Quiet: {
    color: '#00E59B',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-400/40',
    text: 'text-emerald-300',
    badge: 'Quiet · Low Density',
  },
  Moderate: {
    color: '#FFB800',
    bg: 'bg-amber-500/15',
    border: 'border-amber-400/40',
    text: 'text-amber-300',
    badge: 'Moderate · Steady Flow',
  },
  Busy: {
    color: '#FF7A00',
    bg: 'bg-orange-500/15',
    border: 'border-orange-400/40',
    text: 'text-orange-300',
    badge: 'Busy · High Activity',
  },
  'Very Busy': {
    color: '#FF3B5C',
    bg: 'bg-rose-500/15',
    border: 'border-rose-400/40',
    text: 'text-rose-300',
    badge: 'Very Busy · Peak Crowd',
  },
  Unknown: {
    color: '#64748B',
    bg: 'bg-slate-500/15',
    border: 'border-slate-500/35',
    text: 'text-slate-300',
    badge: 'Unknown · Insufficient Signals',
  },
};

const REPORT_CATEGORIES: Array<{ id: CrowdReportCategory; label: string }> = [
  { id: 'crowd_level', label: 'Crowd Density' },
  { id: 'queue_wait', label: 'Queue / Wait Time' },
  { id: 'event', label: 'Live Event / Gathering' },
  { id: 'traffic', label: 'Congestion / Transit' },
  { id: 'incident', label: 'Incident / Disruption' },
  { id: 'safety_hazard', label: 'Public Safety Hazard' },
  { id: 'weather', label: 'Localized Weather' },
];

const PLACE_CATEGORIES = [
  { id: 'all', label: 'All Nearby' },
  { id: 'food', label: 'Cafes & Dining' },
  { id: 'park', label: 'Parks & Outdoors' },
  { id: 'shopping', label: 'Shopping & Malls' },
  { id: 'transit', label: 'Transit Hubs' },
  { id: 'hospital', label: 'Medical & Safety' },
  { id: 'education', label: 'Campuses & Libraries' },
];

interface CrowdZoneLeafletMapProps {
  center: [number, number];
  zoom: number;
  bearing: number;
  recenterSignal: number;
  myLocation: UserLocation | null;
  cells: CrowdCellSummary[];
  reports: CrowdZoneCommunityReport[];
  showHeatmapCells: boolean;
  showReportPins: boolean;
  onSelectCell: (cellId: string) => void;
}

const CrowdZoneLeafletMap: React.FC<CrowdZoneLeafletMapProps> = ({
  center,
  zoom,
  bearing,
  recenterSignal,
  myLocation,
  cells,
  reports,
  showHeatmapCells,
  showReportPins,
  onSelectCell,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const prevCenterKeyRef = useRef<string>('');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
    });
    L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&scale=2', {
      attribution: 'Google Maps Satellite 2x HDR · CROWDZONE Spatial Engine',
      maxZoom: 21,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    overlayGroupRef.current = group;
    prevCenterKeyRef.current = `${center[0].toFixed(4)}:${center[1].toFixed(4)}:${zoom}`;

    return () => {
      map.remove();
      mapRef.current = null;
      overlayGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const key = `${center[0].toFixed(5)}:${center[1].toFixed(5)}:${zoom}:${recenterSignal}`;
    if (prevCenterKeyRef.current !== key) {
      prevCenterKeyRef.current = key;
      map.flyTo(center, zoom, { duration: 0.75 });
    }
  }, [center, zoom, recenterSignal]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      mapRef.current?.invalidateSize({ animate: false });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [bearing === 0]);

  useEffect(() => {
    const group = overlayGroupRef.current;
    if (!group) return;
    group.clearLayers();

    if (myLocation && Number.isFinite(myLocation.latitude) && Number.isFinite(myLocation.longitude)) {
      const userIcon = L.divIcon({
        className: 'crowdzone-user-gps',
        html: `<div style="width:22px;height:22px;border-radius:50%;background:#00D9FF;border:3px solid #ffffff;box-shadow:0 0 16px rgba(0,217,255,0.9);"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      L.marker([myLocation.latitude, myLocation.longitude], { icon: userIcon })
        .bindPopup(
          `<div style="font-size:12px;font-weight:700;color:#0f172a;">Your Live GPS Position (±${Math.round(
            myLocation.accuracy || 15
          )}m)</div>`
        )
        .addTo(group);
    }

    if (showHeatmapCells) {
      cells.forEach((cell) => {
        const color = CROWD_LEVEL_META[cell.crowdLevel]?.color || '#64748B';
        const rect = L.rectangle(
          [
            [cell.bounds.minLat, cell.bounds.minLng],
            [cell.bounds.maxLat, cell.bounds.maxLng],
          ],
          {
            color,
            weight: 1.5,
            fillColor: color,
            fillOpacity: cell.crowdLevel === 'Unknown' ? 0.12 : 0.24,
          }
        );
        rect.on('click', () => onSelectCell(cell.cellId));
        rect.bindPopup(
          `<div style="color:#0f172a;min-width:190px;font-size:11px;line-height:1.45;">
            <div style="font-weight:900;font-size:12px;text-transform:uppercase;margin-bottom:4px;">Zone ${cell.cellId.toUpperCase()} · ${cell.crowdLevel}</div>
            <div>Density Score: <b>${cell.densityScore}/100</b></div>
            <div>Confidence: <b>${cell.confidenceScore}%</b> (${cell.dataSource})</div>
            <div>Verified Reports: <b>${cell.verifiedReportCount}</b></div>
            <div>Trend: <b style="text-transform:capitalize;">${cell.trend}</b></div>
            <div style="font-size:10px;color:#64748b;margin-top:3px;">Updated ${new Date(cell.updatedAt).toLocaleTimeString()}</div>
          </div>`
        );
        rect.addTo(group);

        if (cell.crowdLevel !== 'Unknown') {
          L.circle([cell.centerLat, cell.centerLng], {
            radius: Math.max(120, cell.densityScore * 3.2),
            color,
            weight: 0,
            fillColor: color,
            fillOpacity: 0.28,
          }).addTo(group);
        }
      });
    }

    if (showReportPins) {
      reports
        .filter((r) => r.status === 'active')
        .forEach((rep) => {
          const color = CROWD_LEVEL_META[rep.crowdLevel]?.color || '#00D9FF';
          const icon = L.divIcon({
            className: 'crowdzone-report-marker',
            html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:2px solid #060812;box-shadow:0 0 14px ${color};display:flex;align-items:center;justify-content:center;color:#060812;font-weight:900;font-size:11px;">!</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });
          L.marker([rep.latitude, rep.longitude], { icon })
            .bindPopup(
              `<div style="color:#0f172a;min-width:200px;font-size:11px;line-height:1.4;">
                <div style="font-weight:700;font-size:12px;margin-bottom:2px;">${rep.placeName} (${rep.crowdLevel})</div>
                <div>${rep.description}</div>
                <div style="font-size:10px;color:#475569;margin-top:3px;">Verified by ${rep.verificationCount} · Confidence ${rep.confidenceScore}%</div>
              </div>`
            )
            .addTo(group);
        });
    }
  }, [myLocation, cells, reports, showHeatmapCells, showReportPins, onSelectCell]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        className="absolute origin-center"
        style={
          bearing === 0
            ? {
                width: '100%',
                height: '100%',
                left: '0%',
                top: '0%',
                transform: 'none',
                transition: 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
              }
            : {
                width: '156%',
                height: '156%',
                left: '-28%',
                top: '-28%',
                transform: `rotate(${bearing}deg)`,
                transformOrigin: '50% 50%',
                transition: 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
              }
        }
      >
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
};

export const CrowdZoneModule: React.FC<CrowdZoneModuleProps> = ({
  user,
  myLocation,
  userLocations,
  activeAlerts,
  apiFetch,
  onRequestFreshGps,
}) => {
  const [subTab, setSubTab] = useState<CrowdZoneSubTab>('explore');
  const [timeWindow, setTimeWindow] = useState<CrowdTimeWindow>('1h');
  const [loading, setLoading] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Backend state
  const [cells, setCells] = useState<CrowdCellSummary[]>([]);
  const [history, setHistory] = useState<CrowdHistoryBucket[]>([]);
  const [predictions, setPredictions] = useState<CrowdPredictionPoint[]>([]);
  const [reports, setReports] = useState<CrowdZoneCommunityReport[]>([]);
  const [posts, setPosts] = useState<CrowdZonePost[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<CrowdZoneSavedPlace[]>([]);
  const [settings, setSettings] = useState<CrowdZoneUserSettings>({
    userId: user.id,
    contributeAnonymousCrowdSignals: true,
    notificationRadiusKm: 5,
    crowdAlertsEnabled: true,
    emergencyAlertsEnabled: true,
    communityReportAlertsEnabled: true,
    updatedAt: new Date().toISOString(),
  });
  const [moderationLogs, setModerationLogs] = useState<ModerationLogEntry[]>([]);
  const [lastUpdatedIso, setLastUpdatedIso] = useState<string>(new Date().toISOString());

  // Explore & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [searchResults, setSearchResults] = useState<NearbyPlace[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [selectedPlaceCategory, setSelectedPlaceCategory] = useState<string>('all');
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);
  const [nearbyCrowdFilter, setNearbyCrowdFilter] = useState<CrowdLevel | 'ALL'>('ALL');

  // Map state & filters
  const defaultCoords: [number, number] = useMemo(() => {
    if (myLocation && Number.isFinite(myLocation.latitude) && Number.isFinite(myLocation.longitude)) {
      return [myLocation.latitude, myLocation.longitude];
    }
    const firstPeer = userLocations.find(
      (l) => Number.isFinite(l.latitude) && Number.isFinite(l.longitude)
    );
    if (firstPeer) {
      return [firstPeer.latitude, firstPeer.longitude];
    }
    return [13.0358, 77.597];
  }, [myLocation, userLocations]);

  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCoords);
  const [mapZoom, setMapZoom] = useState<number>(15);
  const [mapBearing, setMapBearing] = useState<number>(0);
  const [recenterSignal, setRecenterSignal] = useState<number>(0);
  const [isRecenteringCzGps, setIsRecenteringCzGps] = useState<boolean>(false);
  const [levelFilter, setLevelFilter] = useState<CrowdLevel | 'ALL'>('ALL');
  const [showHeatmapCells, setShowHeatmapCells] = useState(true);
  const [showReportPins, setShowReportPins] = useState(true);
  const [selectedCellId, setSelectedCellId] = useState<string | undefined>(undefined);

  const rotateCzMapBy = (delta: number) => {
    setMapBearing((prev) => {
      let next = Math.round(prev + delta) % 360;
      if (next < 0) next += 360;
      return next;
    });
  };

  const handleRecenterOnMe = () => {
    setIsRecenteringCzGps(true);
    onRequestFreshGps?.();

    if (myLocation && Number.isFinite(myLocation.latitude) && Number.isFinite(myLocation.longitude)) {
      setMapCenter([myLocation.latitude, myLocation.longitude]);
      setMapZoom(16);
      setRecenterSignal((s) => s + 1);
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsRecenteringCzGps(false);
          const freshLat = pos.coords.latitude;
          const freshLng = pos.coords.longitude;
          if (Number.isFinite(freshLat) && Number.isFinite(freshLng)) {
            setMapCenter([freshLat, freshLng]);
            setMapZoom(16);
            setRecenterSignal((s) => s + 1);
            setStatusToast(
              `Recentered on fresh GPS (${freshLat.toFixed(5)}, ${freshLng.toFixed(5)} · ±${Math.round(
                pos.coords.accuracy || 15
              )}m)`
            );
          }
        },
        () => {
          setIsRecenteringCzGps(false);
          if (myLocation && Number.isFinite(myLocation.latitude) && Number.isFinite(myLocation.longitude)) {
            setMapCenter([myLocation.latitude, myLocation.longitude]);
            setMapZoom(16);
            setRecenterSignal((s) => s + 1);
            setStatusToast(
              `Recentered on your location (${myLocation.latitude.toFixed(5)}, ${myLocation.longitude.toFixed(5)})`
            );
          } else {
            setStatusToast('Waiting for GPS location...');
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    } else {
      window.setTimeout(() => setIsRecenteringCzGps(false), 600);
    }
  };

  // Community Report composer state
  const [reportPlaceName, setReportPlaceName] = useState('');
  const [reportCategory, setReportCategory] = useState<CrowdReportCategory>('crowd_level');
  const [reportCrowdLevel, setReportCrowdLevel] = useState<Exclude<CrowdLevel, 'Unknown'>>('Moderate');
  const [reportDescription, setReportDescription] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // Community Post composer state
  const [postText, setPostText] = useState('');
  const [postPlaceName, setPostPlaceName] = useState('');
  const [postCrowdLevel, setPostCrowdLevel] = useState<CrowdLevel>('Moderate');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  // Saved Place composer state
  const [newPlaceName, setNewPlaceName] = useState('');
  const [newPlaceLabel, setNewPlaceLabel] = useState('');
  const [newPlaceAddress, setNewPlaceAddress] = useState('');
  const [newPlaceNotifyLevel, setNewPlaceNotifyLevel] =
    useState<Exclude<CrowdLevel, 'Unknown'>>('Quiet');

  const showToast = useCallback((msg: string) => {
    setStatusToast(msg);
    setTimeout(() => {
      setStatusToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Keep mapCenter updated when myLocation first arrives
  useEffect(() => {
    if (myLocation && Number.isFinite(myLocation.latitude) && Number.isFinite(myLocation.longitude)) {
      setMapCenter([myLocation.latitude, myLocation.longitude]);
    }
  }, [myLocation?.latitude, myLocation?.longitude]);

  const fetchOverview = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({
          window: timeWindow,
          precision: '6',
          lat: String(mapCenter[0]),
          lng: String(mapCenter[1]),
        });
        if (selectedCellId) {
          params.set('cellId', selectedCellId);
        }
        const data = await apiFetch(`/api/crowdzone/overview?${params.toString()}`);
        if (data) {
          if (Array.isArray(data.cells)) setCells(data.cells);
          if (Array.isArray(data.history)) setHistory(data.history);
          if (Array.isArray(data.predictions)) setPredictions(data.predictions);
          if (Array.isArray(data.reports)) setReports(data.reports);
          if (Array.isArray(data.posts)) setPosts(data.posts);
          if (Array.isArray(data.savedPlaces)) setSavedPlaces(data.savedPlaces);
          if (data.settings) setSettings(data.settings);
          setLastUpdatedIso(data.serverTimestamp || new Date().toISOString());
        }
        if (user.isAdmin) {
          const adminData = await apiFetch('/api/admin/crowdzone').catch(() => null);
          if (adminData?.moderationLogs) {
            setModerationLogs(adminData.moderationLogs);
          }
        }
      } catch (err: any) {
        console.warn('CROWDZONE overview fetch warning:', err?.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [apiFetch, timeWindow, mapCenter, selectedCellId, user.isAdmin]
  );

  useEffect(() => {
    void fetchOverview(false);
    const interval = setInterval(() => {
      void fetchOverview(true);
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  // Listen for cloud sync updates
  useEffect(() => {
    const onSync = () => {
      void fetchOverview(true);
    };
    window.addEventListener('beacon:cloud-sync-updated', onSync);
    return () => window.removeEventListener('beacon:cloud-sync-updated', onSync);
  }, [fetchOverview]);

  const normalizePlaceItem = useCallback(
    (raw: any, originLat: number, originLon: number): NearbyPlace => {
      const lat = Number(raw.lat);
      const lon = Number(raw.lon);
      const dist =
        typeof raw.distanceMeters === 'number' && Number.isFinite(raw.distanceMeters)
          ? raw.distanceMeters
          : haversineMeters(originLat, originLon, lat, lon);
      return {
        id: String(raw.id || `${lat.toFixed(5)}_${lon.toFixed(5)}`),
        name: String(raw.name || 'Local Venue'),
        address: String(raw.address || raw.display_name || raw.name || 'Nearby Location'),
        display_name: raw.display_name,
        category: String(raw.category || raw.type || 'Venue'),
        type: raw.type,
        lat,
        lon,
        distanceMeters: dist,
        rating: typeof raw.rating === 'number' ? raw.rating : undefined,
        isOpen: typeof raw.isOpen === 'boolean' ? raw.isOpen : true,
        estimatedDriveMinutes:
          typeof raw.estimatedDriveMinutes === 'number'
            ? raw.estimatedDriveMinutes
            : Math.max(1, Math.round(dist / 450)),
      };
    },
    []
  );

  // Fetch nearby places when location or category changes
  const fetchNearby = useCallback(async () => {
    setLoadingNearby(true);
    const originLat = mapCenter[0];
    const originLon = mapCenter[1];
    try {
      const params = new URLSearchParams({
        lat: String(originLat),
        lon: String(originLon),
        radius: '5000',
        category: selectedPlaceCategory,
      });
      const res = await apiFetch<{ places?: any[]; results?: any[] }>(
        `/api/locations/nearby?${params.toString()}`
      ).catch(() => null);

      const rawList = Array.isArray(res?.places)
        ? res!.places
        : Array.isArray(res?.results)
          ? res!.results
          : [];

      if (rawList.length > 0) {
        setNearbyPlaces(rawList.map((item) => normalizePlaceItem(item, originLat, originLon)));
        return;
      }

      // Direct client discovery fallback if backend returned empty
      const direct = await fetchRealNearbyPlaces(
        originLat,
        originLon,
        selectedPlaceCategory,
        5000
      );
      setNearbyPlaces(direct.map((item) => normalizePlaceItem(item, originLat, originLon)));
    } catch {
      try {
        const direct = await fetchRealNearbyPlaces(
          originLat,
          originLon,
          selectedPlaceCategory,
          5000
        );
        setNearbyPlaces(direct.map((item) => normalizePlaceItem(item, originLat, originLon)));
      } catch {
        // ignore
      }
    } finally {
      setLoadingNearby(false);
    }
  }, [apiFetch, mapCenter, selectedPlaceCategory, normalizePlaceItem]);

  useEffect(() => {
    void fetchNearby();
  }, [fetchNearby]);

  // Worldwide place search debounce
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchingPlaces(false);
      return;
    }
    let cancelled = false;
    setSearchingPlaces(true);
    const originLat = mapCenter[0];
    const originLon = mapCenter[1];
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q,
          lat: String(originLat),
          lon: String(originLon),
        });
        const res = await apiFetch<{ results?: any[]; places?: any[] }>(
          `/api/locations/search?${params.toString()}`
        ).catch(() => null);
        const list = Array.isArray(res?.results)
          ? res!.results
          : Array.isArray(res?.places)
            ? res!.places
            : [];
        if (!cancelled && list.length > 0) {
          setSearchResults(list.map((item) => normalizePlaceItem(item, originLat, originLon)));
          return;
        }
        const direct = await searchRealPlacesByQuery(q, originLat, originLon);
        if (!cancelled) {
          setSearchResults(direct.map((item) => normalizePlaceItem(item, originLat, originLon)));
        }
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearchingPlaces(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, mapCenter, apiFetch, normalizePlaceItem]);

  // Helper to lookup crowd cell status for any coordinate
  const getCrowdStatusForCoords = useCallback(
    (lat: number, lng: number): CrowdCellSummary | undefined => {
      const cellId = encodeGeohash(lat, lng, 6);
      const exact = cells.find((c) => c.cellId === cellId);
      if (exact) return exact;
      return cells.find(
        (c) => haversineMeters(lat, lng, c.centerLat, c.centerLng) <= 650
      );
    },
    [cells]
  );

  // Real-time venue crowd status calculator combining geohash cells, active reports, live GPS peers, and venue diurnal activity
  const getVenueCrowdIntel = useCallback(
    (
      place: NearbyPlace
    ): {
      crowdLevel: CrowdLevel;
      densityScore: number;
      confidenceScore: number;
      sourceLabel: string;
      reportCount: number;
      liveSignalCount: number;
      cellId: string;
    } => {
      const cellId = encodeGeohash(place.lat, place.lon, 6);
      const cell = getCrowdStatusForCoords(place.lat, place.lon);
      const venueReports = reports.filter(
        (r) =>
          r.status === 'active' &&
          (r.placeName.toLowerCase() === place.name.toLowerCase() ||
            haversineMeters(place.lat, place.lon, r.latitude, r.longitude) <= 450)
      );

      let nearbyPeers = 0;
      if (
        myLocation &&
        haversineMeters(place.lat, place.lon, myLocation.latitude, myLocation.longitude) <= 350
      ) {
        nearbyPeers += 1;
      }
      userLocations.forEach((uLoc) => {
        if (
          uLoc.userId !== user.id &&
          haversineMeters(place.lat, place.lon, uLoc.latitude, uLoc.longitude) <= 350
        ) {
          nearbyPeers += 1;
        }
      });

      if (venueReports.length > 0) {
        const latest = venueReports[0];
        const level = latest.crowdLevel;
        const baseScore =
          level === 'Very Busy'
            ? 88
            : level === 'Busy'
              ? 68
              : level === 'Moderate'
                ? 44
                : 18;
        const densityScore = Math.min(99, baseScore + Math.min(10, venueReports.length * 3));
        return {
          crowdLevel: level,
          densityScore,
          confidenceScore: Math.min(98, Math.max(72, latest.confidenceScore || 78)),
          sourceLabel: `${venueReports.length} Live Report${venueReports.length > 1 ? 's' : ''}`,
          reportCount: venueReports.length,
          liveSignalCount: Math.max(nearbyPeers, cell?.activeSignalsBucket || 1),
          cellId,
        };
      }

      if (cell && cell.crowdLevel !== 'Unknown') {
        return {
          crowdLevel: cell.crowdLevel,
          densityScore: cell.densityScore,
          confidenceScore: cell.confidenceScore,
          sourceLabel: `Geohash ${cell.cellId.toUpperCase()} (${cell.dataSource})`,
          reportCount: cell.verifiedReportCount,
          liveSignalCount: Math.max(nearbyPeers, cell.activeSignalsBucket || 1),
          cellId: cell.cellId,
        };
      }

      // Compute deterministic real-time diurnal activity estimate for discovered venues
      const hour = new Date().getHours();
      const isPeakHour = (hour >= 8 && hour <= 10) || (hour >= 12 && hour <= 14) || (hour >= 17 && hour <= 21);
      const isNight = hour >= 23 || hour < 6;
      let hash = 0;
      for (let i = 0; i < place.id.length; i++) {
        hash = (hash * 31 + place.id.charCodeAt(i)) % 997;
      }
      const catLower = (place.category || '').toLowerCase();
      const catBoost =
        catLower.includes('transit') || catLower.includes('station') || catLower.includes('mall')
          ? 24
          : catLower.includes('food') || catLower.includes('restaurant') || catLower.includes('cafe')
            ? 16
            : catLower.includes('hospital')
              ? 14
              : 6;

      const diurnalBase = isNight ? 12 : isPeakHour ? 42 : 26;
      const peerBoost = nearbyPeers * 18;
      const densityScore = Math.max(
        10,
        Math.min(94, diurnalBase + catBoost + (hash % 24) + peerBoost)
      );
      const crowdLevel: CrowdLevel =
        densityScore >= 78
          ? 'Very Busy'
          : densityScore >= 52
            ? 'Busy'
            : densityScore >= 26
              ? 'Moderate'
              : 'Quiet';

      return {
        crowdLevel,
        densityScore,
        confidenceScore: nearbyPeers > 0 ? 84 : 68,
        sourceLabel: nearbyPeers > 0 ? `${nearbyPeers} Live GPS Signal${nearbyPeers > 1 ? 's' : ''}` : 'Spatial Telemetry',
        reportCount: 0,
        liveSignalCount: nearbyPeers,
        cellId,
      };
    },
    [getCrowdStatusForCoords, reports, myLocation, userLocations, user.id]
  );

  // Filtered nearby places by crowd level
  const displayedNearbyPlaces = useMemo(() => {
    if (nearbyCrowdFilter === 'ALL') return nearbyPlaces;
    return nearbyPlaces.filter((p) => getVenueCrowdIntel(p).crowdLevel === nearbyCrowdFilter);
  }, [nearbyPlaces, nearbyCrowdFilter, getVenueCrowdIntel]);

  // Alternative less-crowded place recommendations
  const alternativePlaces = useMemo(() => {
    const originLat = selectedPlace ? selectedPlace.lat : mapCenter[0];
    const originLng = selectedPlace ? selectedPlace.lon : mapCenter[1];
    return recommendAlternativePlaces({
      targetLat: originLat,
      targetLng: originLng,
      targetCategory: selectedPlace?.category,
      candidatePlaces: nearbyPlaces.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        lat: p.lat,
        lon: p.lon,
        address: p.address,
      })),
      cells,
      precision: 6,
    });
  }, [selectedPlace, mapCenter, nearbyPlaces, cells]);

  // Filtered cells for map
  const filteredCells = useMemo(() => {
    if (levelFilter === 'ALL') return cells;
    return cells.filter((c) => c.crowdLevel === levelFilter);
  }, [cells, levelFilter]);

  // Nearby alerts within user's notification radius
  const nearbyCrowdAlerts = useMemo(() => {
    const radiusMeters = (settings.notificationRadiusKm || 5) * 1000;
    const originLat = myLocation?.latitude ?? mapCenter[0];
    const originLng = myLocation?.longitude ?? mapCenter[1];

    const cellAlerts = cells
      .filter(
        (c) =>
          (c.crowdLevel === 'Busy' || c.crowdLevel === 'Very Busy') &&
          haversineMeters(originLat, originLng, c.centerLat, c.centerLng) <= radiusMeters
      )
      .map((c) => ({
        id: `cell-alert-${c.cellId}`,
        type: 'crowd_surge' as const,
        title: `${c.crowdLevel} Crowd Activity Detected`,
        subtitle: `Geohash Zone ${c.cellId.toUpperCase()} · Confidence ${c.confidenceScore}%`,
        distanceMeters: haversineMeters(originLat, originLng, c.centerLat, c.centerLng),
        timestamp: c.updatedAt,
        crowdLevel: c.crowdLevel,
        lat: c.centerLat,
        lng: c.centerLng,
      }));

    const reportAlerts = reports
      .filter(
        (r) =>
          r.status === 'active' &&
          haversineMeters(originLat, originLng, r.latitude, r.longitude) <= radiusMeters
      )
      .map((r) => ({
        id: `rep-alert-${r.id}`,
        type: 'community_report' as const,
        title: `${r.placeName} (${r.crowdLevel})`,
        subtitle: `${r.description} · Verified by ${r.verificationCount}`,
        distanceMeters: haversineMeters(originLat, originLng, r.latitude, r.longitude),
        timestamp: r.createdAt,
        crowdLevel: r.crowdLevel,
        lat: r.latitude,
        lng: r.longitude,
      }));

    return [...cellAlerts, ...reportAlerts].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [cells, reports, settings.notificationRadiusKm, myLocation, mapCenter]);

  // Handlers
  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDescription.trim()) {
      showToast('Please enter a brief report description');
      return;
    }
    setSubmittingReport(true);
    try {
      const targetLat = selectedPlace?.lat ?? myLocation?.latitude ?? mapCenter[0];
      const targetLng = selectedPlace?.lon ?? myLocation?.longitude ?? mapCenter[1];
      const res = await apiFetch<{ report: CrowdZoneCommunityReport }>('/api/crowdzone/reports', {
        method: 'POST',
        body: JSON.stringify({
          placeName:
            reportPlaceName.trim() ||
            selectedPlace?.name ||
            `Zone ${encodeGeohash(targetLat, targetLng, 6).toUpperCase()}`,
          category: reportCategory,
          crowdLevel: reportCrowdLevel,
          description: reportDescription.trim(),
          latitude: targetLat,
          longitude: targetLng,
          ttlMinutes: 120,
        }),
      });
      if (res?.report) {
        setReports((prev) => [res.report, ...prev]);
        setReportDescription('');
        setReportPlaceName('');
        showToast('Live crowd report published & indexed');
        void fetchOverview(true);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to submit report');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleQuickPlaceCrowdCheckIn = async (
    place: NearbyPlace,
    level: Exclude<CrowdLevel, 'Unknown'>
  ) => {
    try {
      const res = await apiFetch<{ report: CrowdZoneCommunityReport }>('/api/crowdzone/reports', {
        method: 'POST',
        body: JSON.stringify({
          placeName: place.name,
          category: 'crowd_level',
          crowdLevel: level,
          description: `Live crowd check-in at ${place.name}: ${level} density observed.`,
          latitude: place.lat,
          longitude: place.lon,
          ttlMinutes: 120,
        }),
      });
      if (res?.report) {
        setReports((prev) => [res.report, ...prev]);
        setSelectedCellId(encodeGeohash(place.lat, place.lon, 6));
        showToast(`Updated "${place.name}" crowd status to ${level}`);
        void fetchOverview(true);
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not update venue crowd level');
    }
  };

  const handleVerifyReport = async (reportId: string) => {
    try {
      const res = await apiFetch<{ report: CrowdZoneCommunityReport }>(
        `/api/crowdzone/reports/${encodeURIComponent(reportId)}/verify`,
        { method: 'POST' }
      );
      if (res?.report) {
        setReports((prev) => prev.map((r) => (r.id === reportId ? res.report : r)));
        showToast('Report verified · Confidence score updated');
        void fetchOverview(true);
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not verify report');
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim()) return;
    try {
      const targetLat = selectedPlace?.lat ?? myLocation?.latitude ?? mapCenter[0];
      const targetLng = selectedPlace?.lon ?? myLocation?.longitude ?? mapCenter[1];
      const res = await apiFetch<{ post: CrowdZonePost }>('/api/crowdzone/posts', {
        method: 'POST',
        body: JSON.stringify({
          text: postText.trim(),
          placeName: postPlaceName.trim() || selectedPlace?.name || undefined,
          crowdLevel: postCrowdLevel,
          latitude: targetLat,
          longitude: targetLng,
        }),
      });
      if (res?.post) {
        setPosts((prev) => [res.post, ...prev]);
        setPostText('');
        setPostPlaceName('');
        showToast('Posted to CROWDZONE Community Feed');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to publish post');
    }
  };

  const handleReactPost = async (postId: string, emoji: string) => {
    try {
      const res = await apiFetch<{ post: CrowdZonePost }>(
        `/api/crowdzone/posts/${encodeURIComponent(postId)}/react`,
        {
          method: 'POST',
          body: JSON.stringify({ emoji }),
        }
      );
      if (res?.post) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? res.post : p)));
      }
    } catch {
      // ignore
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = (commentDrafts[postId] || '').trim();
    if (!text) return;
    try {
      const res = await apiFetch<{ post: CrowdZonePost }>(
        `/api/crowdzone/posts/${encodeURIComponent(postId)}/comments`,
        {
          method: 'POST',
          body: JSON.stringify({ text }),
        }
      );
      if (res?.post) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? res.post : p)));
        setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to post comment');
    }
  };

  const handleSavePlace = async (placeData: {
    name: string;
    customLabel?: string;
    address: string;
    category?: string;
    latitude: number;
    longitude: number;
    notifyWhenLevel?: Exclude<CrowdLevel, 'Unknown'>;
  }) => {
    try {
      const res = await apiFetch<{ place: CrowdZoneSavedPlace }>('/api/crowdzone/places', {
        method: 'POST',
        body: JSON.stringify({
          ...placeData,
          alertsEnabled: true,
        }),
      });
      if (res?.place) {
        setSavedPlaces((prev) => [res.place, ...prev]);
        showToast(`Saved "${res.place.name}" to CROWDZONE Places`);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to save place');
    }
  };

  const handleDeleteSavedPlace = async (placeId: string) => {
    try {
      await apiFetch(`/api/crowdzone/places/${encodeURIComponent(placeId)}`, {
        method: 'DELETE',
      });
      setSavedPlaces((prev) => prev.filter((p) => p.id !== placeId));
      showToast('Removed saved place');
    } catch {
      showToast('Failed to remove saved place');
    }
  };

  const handleUpdateSettings = async (patch: Partial<CrowdZoneUserSettings>) => {
    try {
      const next = { ...settings, ...patch };
      setSettings(next);
      const res = await apiFetch<{ settings: CrowdZoneUserSettings }>('/api/crowdzone/settings', {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      if (res?.settings) {
        setSettings(res.settings);
        showToast('CROWDZONE settings saved');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to update settings');
    }
  };

  const handleAdminModerate = async (
    targetType: 'crowd_report' | 'crowd_post',
    targetId: string,
    action: 'approve' | 'remove' | 'expire'
  ) => {
    try {
      await apiFetch('/api/admin/crowdzone/moderate', {
        method: 'POST',
        body: JSON.stringify({
          targetType,
          targetId,
          action,
          reason: `Admin ${action} action`,
        }),
      });
      showToast(`Moderation action (${action}) applied`);
      void fetchOverview(true);
    } catch (err: any) {
      showToast(err?.message || 'Moderation action failed');
    }
  };

  // Summary metrics
  const activeVerifiedReportsCount = useMemo(
    () => reports.filter((r) => r.status === 'active').length,
    [reports]
  );

  const measuredCellsCount = useMemo(
    () => cells.filter((c) => c.crowdLevel !== 'Unknown').length,
    [cells]
  );

  return (
    <div className="h-full w-full overflow-y-auto bg-[#060913] text-white pb-28">
      {/* Top Hero Header */}
      <div className="sticky top-0 z-30 backdrop-blur-2xl bg-[#060913]/90 border-b border-cyan-500/20 px-4 py-3.5 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#00D9FF]/25 via-[#397BFF]/20 to-[#060913] border border-[#00D9FF]/45 flex items-center justify-center shadow-[0_0_25px_rgba(0,217,255,0.28)]">
                <Radar className="w-6 h-6 text-[#00D9FF]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black tracking-wider bg-gradient-to-r from-[#00D9FF] via-cyan-200 to-[#397BFF] bg-clip-text text-transparent">
                    CROWDZONE
                  </h1>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-md bg-[#00D9FF]/15 text-[#00D9FF] border border-[#00D9FF]/30">
                    Live Spatial Intelligence
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Real-time geohash crowd aggregation, community verification & predictive activity
                </p>
              </div>
            </div>

            {/* Live Status & Time Window Selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-[#0C1222] border border-white/10 rounded-xl p-1">
                {TIME_WINDOWS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setTimeWindow(w)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      timeWindow === w
                        ? 'bg-gradient-to-r from-[#00D9FF] to-[#397BFF] text-[#050811] shadow-[0_0_12px_rgba(0,217,255,0.4)]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {w === 'all' ? 'ALL' : w.toUpperCase()}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (onRequestFreshGps) onRequestFreshGps();
                  void fetchOverview(false);
                }}
                className="p-2 rounded-xl bg-[#0C1222] border border-cyan-500/30 text-[#00D9FF] hover:bg-cyan-500/15 transition-all"
                title="Refresh Crowd Intelligence"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Sub-Navigation Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {SUB_TABS.map((item) => {
              const Icon = item.icon;
              const active = subTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSubTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    active
                      ? 'bg-gradient-to-r from-[#00D9FF]/20 to-[#397BFF]/20 text-[#00D9FF] border border-[#00D9FF]/50 shadow-[0_0_18px_rgba(0,217,255,0.22)]'
                      : 'bg-[#0C1222]/80 text-slate-400 border border-white/5 hover:text-slate-200 hover:border-white/15'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {item.id === 'alerts' && nearbyCrowdAlerts.length + activeAlerts.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-black">
                      {nearbyCrowdAlerts.length + activeAlerts.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Toast Banner */}
      {statusToast && (
        <div className="fixed bottom-24 right-4 z-50 px-4 py-2.5 rounded-xl bg-[#0C1428]/95 border border-[#00D9FF]/50 text-[#00D9FF] text-xs font-bold shadow-[0_0_24px_rgba(0,217,255,0.35)] flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 py-5 sm:px-6 space-y-6">
        {/* Top Real-Time Telemetry Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-[#0B1020]/90 border border-cyan-500/20 p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Active Geohash Cells
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-[#00D9FF]">{cells.length}</span>
              <span className="text-[11px] text-emerald-400 font-semibold">
                {measuredCellsCount} classified
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0B1020]/90 border border-cyan-500/20 p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Community Reports
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-white">{activeVerifiedReportsCount}</span>
              <span className="text-[11px] text-cyan-300 font-semibold">
                Window: {TIME_WINDOW_LABELS[timeWindow]}
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0B1020]/90 border border-cyan-500/20 p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Saved Watch Places
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-300">{savedPlaces.length}</span>
              <span className="text-[11px] text-slate-400">Custom thresholds</span>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0B1020]/90 border border-cyan-500/20 p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Last Spatial Sync
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm font-bold text-slate-200">
                {new Date(lastUpdatedIso).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
              <span className="text-[11px] text-[#00D9FF] font-semibold">
                Radius {settings.notificationRadiusKm} km
              </span>
            </div>
          </div>
        </div>

        {/* ===================================================================
            A. EXPLORE SCREEN
           =================================================================== */}
        {subTab === 'explore' && (
          <div className="space-y-6">
            {/* Search & Current Location Bar */}
            <div className="rounded-2xl bg-[#0B1020]/95 border border-cyan-500/25 p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#00D9FF] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search any worldwide venue, street, transit hub, campus, or city..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#060913] border border-white/15 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00D9FF]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onRequestFreshGps) onRequestFreshGps();
                    if (myLocation) {
                      setMapCenter([myLocation.latitude, myLocation.longitude]);
                      showToast('Centered on your live GPS coordinates');
                    }
                  }}
                  className="px-4 py-3 rounded-xl bg-gradient-to-r from-[#00D9FF] to-[#397BFF] text-[#050811] font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,217,255,0.3)]"
                >
                  <Navigation className="w-4 h-4" />
                  <span>Current Location</span>
                </button>
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
                {PLACE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedPlaceCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      selectedPlaceCategory === cat.id
                        ? 'bg-[#00D9FF]/20 text-[#00D9FF] border border-[#00D9FF]/50'
                        : 'bg-[#060913] text-slate-400 border border-white/10 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Search Suggestions Dropdown */}
              {searchQuery.trim().length >= 2 && (
                <div className="rounded-xl bg-[#060913] border border-cyan-500/30 divide-y divide-white/5 max-h-72 overflow-y-auto">
                  {searchingPlaces ? (
                    <div className="p-4 text-xs text-slate-400 flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00D9FF]" />
                      <span>Searching global places & computing crowd density...</span>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-4 text-xs text-slate-400">
                      No matching places found for "{searchQuery}".
                    </div>
                  ) : (
                    searchResults.map((place) => {
                      const intel = getVenueCrowdIntel(place);
                      const meta = CROWD_LEVEL_META[intel.crowdLevel];
                      return (
                        <button
                          key={place.id}
                          type="button"
                          onClick={() => {
                            setSelectedPlace(place);
                            setSelectedCellId(intel.cellId);
                            setMapCenter([place.lat, place.lon]);
                            setSearchQuery('');
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-white/5 transition-all flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white truncate">{place.name}</div>
                            <div className="text-xs text-slate-400 truncate">{place.address}</div>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 ${meta.bg} ${meta.border} ${meta.text}`}
                          >
                            {intel.crowdLevel} · {intel.densityScore}%
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Selected Place Detail Panel */}
            {selectedPlace && (
              <div className="rounded-2xl bg-gradient-to-br from-[#0D162C] to-[#080D1A] border border-[#00D9FF]/45 p-5 space-y-4 shadow-[0_0_30px_rgba(0,217,255,0.15)]">
                {(() => {
                  const intel = getVenueCrowdIntel(selectedPlace);
                  const meta = CROWD_LEVEL_META[intel.crowdLevel];
                  return (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="font-bold uppercase text-[#00D9FF]">
                              {selectedPlace.category}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">
                              Geohash {intel.cellId.toUpperCase()}
                            </span>
                            {selectedPlace.distanceMeters != null && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  {(selectedPlace.distanceMeters / 1000).toFixed(2)} km away
                                </span>
                              </>
                            )}
                          </div>
                          <h2 className="text-lg font-black text-white mt-1">
                            {selectedPlace.name}
                          </h2>
                          <p className="text-xs text-slate-300 mt-0.5">{selectedPlace.address}</p>
                        </div>

                        <div className="flex flex-col items-end gap-1 font-mono tabular-nums">
                          <span
                            className={`px-3 py-1 rounded-xl text-xs font-black border ${meta.bg} ${meta.border} ${meta.text}`}
                          >
                            {intel.crowdLevel} · {intel.densityScore}% Density
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Confidence {intel.confidenceScore}% · {intel.sourceLabel}
                          </span>
                        </div>
                      </div>

                      {/* Quick 1-Tap Crowd Status Update Bar */}
                      <div className="rounded-xl bg-[#060913]/90 border border-white/10 p-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-300">
                          Update real-time crowd status at this venue:
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(['Quiet', 'Moderate', 'Busy', 'Very Busy'] as const).map((lvl) => {
                            const lvlMeta = CROWD_LEVEL_META[lvl];
                            const isCurrent = intel.crowdLevel === lvl;
                            return (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => handleQuickPlaceCrowdCheckIn(selectedPlace, lvl)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                  isCurrent
                                    ? `${lvlMeta.bg} ${lvlMeta.border} ${lvlMeta.text}`
                                    : 'bg-[#0B1020] border-white/10 text-slate-300 hover:border-white/30'
                                }`}
                              >
                                {lvl}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => {
                            setMapCenter([selectedPlace.lat, selectedPlace.lon]);
                            setMapZoom(17);
                            setSubTab('map');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-[#00D9FF] text-[#050811] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <MapIcon className="w-3.5 h-3.5" />
                          <span>View on Live Crowd Map</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCellId(intel.cellId);
                            setSubTab('activity');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-[#00D9FF] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span>Inspect D3 Trend</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleSavePlace({
                              name: selectedPlace.name,
                              address: selectedPlace.address,
                              category: selectedPlace.category,
                              latitude: selectedPlace.lat,
                              longitude: selectedPlace.lon,
                              notifyWhenLevel: 'Quiet',
                            })
                          }
                          className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Bookmark className="w-3.5 h-3.5 text-[#00D9FF]" />
                          <span>Save Place</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setReportPlaceName(selectedPlace.name);
                            setSubTab('community');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-amber-400" />
                          <span>Detailed Report</span>
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Real-Time D3 Crowd Trend Chart in Explore */}
            <CrowdTrendD3Chart
              history={history}
              cells={cells}
              reports={reports}
              timeWindow={timeWindow}
              selectedCellId={selectedCellId}
              selectedPlaceName={selectedPlace?.name}
              onSelectTimeWindow={(w) => setTimeWindow(w)}
              onClearCellFilter={() => {
                setSelectedCellId(undefined);
                setSelectedPlace(null);
              }}
            />

            {/* Nearby Places & Real-Time Crowd Status Grid */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                    Nearby Places & Real-Time Crowd Status
                  </h2>
                  <p className="text-xs text-slate-400">
                    Live crowd density, confidence telemetry, and 1-tap crowd check-in for {displayedNearbyPlaces.length} nearby locations
                  </p>
                </div>

                {/* Crowd Status Filter + Refresh */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['ALL', 'Quiet', 'Moderate', 'Busy', 'Very Busy'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setNearbyCrowdFilter(lvl)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        nearbyCrowdFilter === lvl
                          ? 'bg-[#00D9FF] text-[#050811]'
                          : 'bg-[#0B1020] text-slate-300 border border-white/10 hover:text-white'
                      }`}
                    >
                      {lvl === 'ALL' ? 'All Statuses' : lvl}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void fetchNearby()}
                    className="px-3 py-1.5 rounded-xl bg-[#0B1020] border border-cyan-500/30 text-[#00D9FF] text-xs font-bold flex items-center gap-1.5 hover:bg-cyan-500/15 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingNearby ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {loadingNearby && nearbyPlaces.length === 0 ? (
                <div className="rounded-2xl bg-[#0B1020]/70 border border-white/10 p-8 text-center space-y-2">
                  <RefreshCw className="w-7 h-7 text-[#00D9FF] mx-auto animate-spin" />
                  <div className="text-sm font-bold text-white">
                    Scanning nearby places & calculating live crowd density...
                  </div>
                </div>
              ) : displayedNearbyPlaces.length === 0 ? (
                <div className="rounded-2xl bg-[#0B1020]/70 border border-white/10 p-8 text-center space-y-3">
                  <Compass className="w-8 h-8 text-[#00D9FF] mx-auto opacity-80" />
                  <div className="text-sm font-bold text-white">
                    No nearby places match the "{nearbyCrowdFilter}" crowd filter
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    {nearbyCrowdFilter !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => setNearbyCrowdFilter('ALL')}
                        className="px-4 py-2 rounded-xl bg-[#00D9FF] text-[#050811] text-xs font-bold cursor-pointer"
                      >
                        Show All Places
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void fetchNearby()}
                      className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-bold cursor-pointer"
                    >
                      Scan Again
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayedNearbyPlaces.slice(0, 18).map((place) => {
                    const intel = getVenueCrowdIntel(place);
                    const meta = CROWD_LEVEL_META[intel.crowdLevel];
                    const isSelected = selectedPlace?.id === place.id;
                    return (
                      <div
                        key={place.id}
                        onClick={() => {
                          setSelectedPlace(place);
                          setSelectedCellId(intel.cellId);
                        }}
                        className={`cursor-pointer rounded-2xl bg-[#0B1020]/95 border p-4 transition-all flex flex-col justify-between gap-3.5 ${
                          isSelected
                            ? 'border-[#00D9FF] shadow-[0_0_24px_rgba(0,217,255,0.18)]'
                            : 'border-white/10 hover:border-[#00D9FF]/50'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-[11px] text-slate-400 font-medium">
                              <span className="text-[#00D9FF] font-semibold uppercase">
                                {place.category}
                              </span>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono tabular-nums">
                                {place.distanceMeters != null
                                  ? place.distanceMeters < 1000
                                    ? `${Math.round(place.distanceMeters)} m`
                                    : `${(place.distanceMeters / 1000).toFixed(2)} km`
                                  : 'Nearby'}
                              </span>
                            </div>

                            <span
                              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border shrink-0 ${meta.bg} ${meta.border} ${meta.text}`}
                            >
                              {intel.crowdLevel}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-sm font-bold text-white line-clamp-1">
                              {place.name}
                            </h3>
                            <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                              {place.address}
                            </p>
                          </div>

                          {/* Real-Time Density Progress Bar */}
                          <div className="space-y-1 pt-1">
                            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                              <span className="text-slate-300">
                                Crowd Density: <b>{intel.densityScore}%</b>
                              </span>
                              <span className="text-slate-400">
                                Conf. {intel.confidenceScore}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-[#060913] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${intel.densityScore}%`,
                                  backgroundColor: meta.color,
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                              <span>{intel.sourceLabel}</span>
                              {place.estimatedDriveMinutes && (
                                <span className="font-mono tabular-nums">
                                  ~{place.estimatedDriveMinutes} min drive
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Interactive Venue Actions + 1-Tap Crowd Check-In */}
                        <div
                          className="pt-2.5 border-t border-white/10 space-y-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] text-slate-400">Check-In:</span>
                            <div className="flex items-center gap-1">
                              {(['Quiet', 'Moderate', 'Busy', 'Very Busy'] as const).map((lvl) => (
                                <button
                                  key={lvl}
                                  type="button"
                                  onClick={() => handleQuickPlaceCrowdCheckIn(place, lvl)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                                    intel.crowdLevel === lvl
                                      ? 'bg-[#00D9FF] text-[#050811]'
                                      : 'bg-[#060913] text-slate-400 hover:text-white border border-white/10'
                                  }`}
                                  title={`Report ${place.name} as ${lvl}`}
                                >
                                  {lvl === 'Very Busy' ? 'Peak' : lvl}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPlace(place);
                                setMapCenter([place.lat, place.lon]);
                                setMapZoom(17);
                                setSubTab('map');
                              }}
                              className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#00D9FF]/15 hover:bg-[#00D9FF]/25 border border-[#00D9FF]/35 text-[#00D9FF] text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <MapIcon className="w-3 h-3" />
                              <span>Locate</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPlace(place);
                                setSelectedCellId(intel.cellId);
                                setSubTab('activity');
                              }}
                              className="flex-1 py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <BarChart3 className="w-3 h-3 text-[#00D9FF]" />
                              <span>Trend</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleSavePlace({
                                  name: place.name,
                                  address: place.address,
                                  category: place.category,
                                  latitude: place.lat,
                                  longitude: place.lon,
                                  notifyWhenLevel: 'Quiet',
                                })
                              }
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[#00D9FF] cursor-pointer"
                              title="Save & Monitor Place"
                            >
                              <Bookmark className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            B. LIVE CROWD MAP SCREEN
           =================================================================== */}
        {subTab === 'map' && (
          <div className="space-y-4">
            {/* Map Filter Controls */}
            <div className="rounded-2xl bg-[#0B1020]/95 border border-cyan-500/25 p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['ALL', 'Quiet', 'Moderate', 'Busy', 'Very Busy'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevelFilter(lvl)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      levelFilter === lvl
                        ? 'bg-[#00D9FF] text-[#050811]'
                        : 'bg-[#060913] text-slate-300 border border-white/10 hover:border-white/25'
                    }`}
                  >
                    {lvl === 'ALL' ? 'All Levels' : lvl}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Map Rotation Controls */}
                <div className="flex items-center bg-[#060913] border border-white/15 rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={() => rotateCzMapBy(-45)}
                    title="Rotate Map 45° CCW"
                    className="px-2 py-1 hover:bg-white/10 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#00D9FF]" />
                    <span>-45°</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapBearing(0)}
                    title="Reset Map to North (0°)"
                    className={`px-2 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors ${
                      mapBearing !== 0
                        ? 'bg-sky-500/25 text-sky-300'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {mapBearing !== 0 ? `${mapBearing}°` : '0° N'}
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateCzMapBy(45)}
                    title="Rotate Map 45° CW"
                    className="px-2 py-1 hover:bg-white/10 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-[#00D9FF]" />
                    <span>+45°</span>
                  </button>
                </div>

                {/* Recenter on Me Button */}
                <button
                  type="button"
                  onClick={handleRecenterOnMe}
                  disabled={isRecenteringCzGps}
                  className="px-3 py-1.5 rounded-xl text-xs font-extrabold border border-[#00D9FF]/50 bg-[#00D9FF]/15 hover:bg-[#00D9FF]/25 text-[#00D9FF] flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <Crosshair className={`w-3.5 h-3.5 ${isRecenteringCzGps ? 'animate-spin' : ''}`} />
                  <span>{isRecenteringCzGps ? 'Locating...' : 'Recenter on Me'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowHeatmapCells((v) => !v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    showHeatmapCells
                      ? 'bg-cyan-500/20 border-cyan-400/50 text-[#00D9FF]'
                      : 'bg-[#060913] border-white/10 text-slate-400'
                  }`}
                >
                  Heatmap Cells
                </button>
                <button
                  type="button"
                  onClick={() => setShowReportPins((v) => !v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    showReportPins
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                      : 'bg-[#060913] border-white/10 text-slate-400'
                  }`}
                >
                  Report Pins ({activeVerifiedReportsCount})
                </button>
              </div>
            </div>

            {/* Interactive Leaflet Map (Satellite 2x HDR) */}
            <div className="relative h-[520px] w-full rounded-2xl overflow-hidden border border-cyan-500/30 shadow-[0_0_35px_rgba(0,217,255,0.15)]">
              <CrowdZoneLeafletMap
                center={mapCenter}
                zoom={mapZoom}
                bearing={mapBearing}
                recenterSignal={recenterSignal}
                myLocation={myLocation}
                cells={filteredCells}
                reports={reports}
                showHeatmapCells={showHeatmapCells}
                showReportPins={showReportPins}
                onSelectCell={(cellId) => setSelectedCellId(cellId)}
              />

              {/* Floating Recenter on Me & Rotation Pod on Map Canvas */}
              <div className="absolute bottom-3 right-3 z-[400] flex flex-col items-end gap-2">
                <div className="flex items-center bg-[#060913]/95 backdrop-blur-md border border-cyan-500/35 rounded-xl p-0.5 shadow-lg">
                  <button
                    type="button"
                    onClick={() => rotateCzMapBy(-45)}
                    title="Rotate Map 45° CCW"
                    className="px-2 py-1.5 hover:bg-white/10 text-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#00D9FF]" />
                    <span>-45°</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapBearing(0)}
                    title="Reset North (0°)"
                    className="px-2 py-1.5 hover:bg-white/10 text-cyan-300 rounded-lg text-[11px] font-mono font-bold cursor-pointer"
                  >
                    {mapBearing !== 0 ? `${mapBearing}°` : 'N'}
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateCzMapBy(45)}
                    title="Rotate Map 45° CW"
                    className="px-2 py-1.5 hover:bg-white/10 text-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-[#00D9FF]" />
                    <span>+45°</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleRecenterOnMe}
                  disabled={isRecenteringCzGps}
                  className="px-3 py-2 rounded-xl bg-[#060913]/95 backdrop-blur-md border border-[#00D9FF]/50 hover:border-[#00D9FF] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg cursor-pointer active:scale-95 transition-all"
                >
                  <Crosshair className={`w-4 h-4 text-[#00D9FF] ${isRecenteringCzGps ? 'animate-spin' : ''}`} />
                  <span>{isRecenteringCzGps ? 'Locating...' : 'Recenter on Me'}</span>
                </button>
              </div>

              {/* Map Legend Overlay */}
              <div className="absolute bottom-3 left-3 z-[400] rounded-xl bg-[#060913]/90 backdrop-blur-md border border-white/15 p-3 text-[11px] space-y-1.5">
                <div className="font-bold text-white uppercase tracking-wider text-[10px]">
                  Crowd Density Classification
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {(['Quiet', 'Moderate', 'Busy', 'Very Busy', 'Unknown'] as CrowdLevel[]).map(
                    (lvl) => (
                      <div key={lvl} className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: CROWD_LEVEL_META[lvl].color }}
                        />
                        <span className="text-slate-200 font-medium">{lvl}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            C. ACTIVITY SCREEN (15m, 1h, 3h, 24h, 7d, All)
           =================================================================== */}
        {subTab === 'activity' && (
          <div className="space-y-6">
            <CrowdTrendD3Chart
              history={history}
              cells={cells}
              reports={reports}
              timeWindow={timeWindow}
              selectedCellId={selectedCellId}
              selectedPlaceName={selectedPlace?.name}
              onSelectTimeWindow={(w) => setTimeWindow(w)}
              onClearCellFilter={() => {
                setSelectedCellId(undefined);
                setSelectedPlace(null);
              }}
            />

            <div className="rounded-2xl bg-[#0B1020]/95 border border-cyan-500/25 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-white">
                    Time-Window Activity Intelligence ({TIME_WINDOW_LABELS[timeWindow]})
                  </h2>
                  <p className="text-xs text-slate-400">
                    Real backend aggregation across {TIME_WINDOW_LABELS[timeWindow]} — zero hardcoded crowd counts
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {TIME_WINDOWS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setTimeWindow(w)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        timeWindow === w
                          ? 'bg-[#00D9FF] text-[#050811]'
                          : 'bg-[#060913] text-slate-400 border border-white/10 hover:text-white'
                      }`}
                    >
                      {TIME_WINDOW_LABELS[w]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Geohash Cells Table */}
              {cells.length === 0 ? (
                <div className="rounded-xl bg-[#060913] border border-white/10 p-6 text-center space-y-2">
                  <Activity className="w-7 h-7 text-[#00D9FF] mx-auto" />
                  <div className="text-sm font-bold text-white">
                    No Crowd Signals Recorded in {TIME_WINDOW_LABELS[timeWindow]}
                  </div>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    When consenting users share GPS updates or submit community reports within this window, geohash cells will automatically classify here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cells.map((cell) => {
                    const meta = CROWD_LEVEL_META[cell.crowdLevel];
                    return (
                      <div
                        key={cell.cellId}
                        className="rounded-xl bg-[#060913] border border-white/10 p-4 flex items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#00D9FF]">
                              CELL {cell.cellId.toUpperCase()}
                            </span>
                            <span className="text-[11px] text-slate-400 capitalize">
                              Source: {cell.dataSource}
                            </span>
                          </div>
                          <div className="text-xs text-slate-300">
                            Confidence <b>{cell.confidenceScore}%</b> · Verified Reports:{' '}
                            <b>{cell.verifiedReportCount}</b>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Updated {new Date(cell.updatedAt).toLocaleTimeString()}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${meta.bg} ${meta.border} ${meta.text}`}
                          >
                            {cell.crowdLevel}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            {cell.trend === 'increasing' && (
                              <>
                                <TrendingUp className="w-3.5 h-3.5 text-rose-400" /> Increasing
                              </>
                            )}
                            {cell.trend === 'decreasing' && (
                              <>
                                <TrendingDown className="w-3.5 h-3.5 text-emerald-400" /> Decreasing
                              </>
                            )}
                            {cell.trend === 'stable' && (
                              <>
                                <Minus className="w-3.5 h-3.5 text-cyan-400" /> Stable
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            D. COMMUNITY SCREEN (Reports, Verification, Public Posts, Comments)
           =================================================================== */}
        {subTab === 'community' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Submit & Verify Crowd Reports */}
            <div className="lg:col-span-5 space-y-5">
              <form
                onSubmit={handleCreateReport}
                className="rounded-2xl bg-[#0B1020]/95 border border-cyan-500/30 p-5 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#00D9FF]" />
                  <h2 className="text-base font-black text-white">Submit Live Crowd Report</h2>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                      Location / Venue Name
                    </label>
                    <input
                      type="text"
                      value={reportPlaceName}
                      onChange={(e) => setReportPlaceName(e.target.value)}
                      placeholder={selectedPlace?.name || 'Current GPS Zone or Venue Name'}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#060913] border border-white/15 text-xs text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        Category
                      </label>
                      <select
                        value={reportCategory}
                        onChange={(e) => setReportCategory(e.target.value as CrowdReportCategory)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#060913] border border-white/15 text-xs text-white"
                      >
                        {REPORT_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        Observed Crowd Level
                      </label>
                      <select
                        value={reportCrowdLevel}
                        onChange={(e) =>
                          setReportCrowdLevel(e.target.value as Exclude<CrowdLevel, 'Unknown'>)
                        }
                        className="w-full px-3 py-2.5 rounded-xl bg-[#060913] border border-white/15 text-xs text-white"
                      >
                        {(['Quiet', 'Moderate', 'Busy', 'Very Busy'] as const).map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                      Observation Details
                    </label>
                    <textarea
                      rows={3}
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                      placeholder="Describe queue length, crowd flow, transit wait times, or safety conditions..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#060913] border border-white/15 text-xs text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingReport}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00D9FF] to-[#397BFF] text-[#050811] font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(0,217,255,0.3)]"
                  >
                    {submittingReport ? 'Publishing Report...' : 'Broadcast Verified Report'}
                  </button>
                </div>
              </form>

              {/* Active Community Reports List */}
              <div className="rounded-2xl bg-[#0B1020]/95 border border-white/10 p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Recent Community Reports ({reports.length})
                </h3>
                {reports.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    No active reports yet. Submit the first ground-truth observation above.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                    {reports.map((rep) => {
                      const meta = CROWD_LEVEL_META[rep.crowdLevel];
                      const alreadyVerified = (rep.verifiedBy || []).includes(user.id);
                      return (
                        <div
                          key={rep.id}
                          className="rounded-xl bg-[#060913] border border-white/10 p-3.5 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-xs font-bold text-white">{rep.placeName}</div>
                              <div className="text-[11px] text-slate-400">
                                by {rep.reporterName} ·{' '}
                                {new Date(rep.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${meta.bg} ${meta.border} ${meta.text}`}
                            >
                              {rep.crowdLevel}
                            </span>
                          </div>

                          <p className="text-xs text-slate-200">{rep.description}</p>

                          <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <span className="text-[11px] text-cyan-300 font-semibold">
                              Confidence {rep.confidenceScore}% · {rep.verificationCount} verified
                            </span>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleVerifyReport(rep.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                                  alreadyVerified
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                    : 'bg-cyan-500/20 text-[#00D9FF] border border-cyan-400/40 hover:bg-cyan-500/30'
                                }`}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{alreadyVerified ? 'Verified' : 'Verify'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Public Community Posts, Reactions & Comments */}
            <div className="lg:col-span-7 space-y-5">
              <form
                onSubmit={handleCreatePost}
                className="rounded-2xl bg-[#0B1020]/95 border border-cyan-500/25 p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-[#00D9FF]" />
                    <span>Public Community Feed</span>
                  </h2>
                  <span className="text-[11px] text-slate-400">Visible across CROWDZONE</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={postPlaceName}
                    onChange={(e) => setPostPlaceName(e.target.value)}
                    placeholder="Place or Area Tag (optional)"
                    className="px-3.5 py-2 rounded-xl bg-[#060913] border border-white/15 text-xs text-white"
                  />
                  <select
                    value={postCrowdLevel}
                    onChange={(e) => setPostCrowdLevel(e.target.value as CrowdLevel)}
                    className="px-3.5 py-2 rounded-xl bg-[#060913] border border-white/15 text-xs text-white"
                  >
                    {(['Quiet', 'Moderate', 'Busy', 'Very Busy'] as CrowdLevel[]).map((lvl) => (
                      <option key={lvl} value={lvl}>
                        Tag Status: {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    placeholder="Share live venue updates, tips, or nearby crowd activity..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#060913] border border-white/15 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-[#00D9FF] text-[#050811] font-black text-xs flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Post</span>
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                {posts.length === 0 ? (
                  <div className="rounded-2xl bg-[#0B1020]/70 border border-white/10 p-8 text-center text-xs text-slate-400">
                    No community posts yet. Start a conversation about a nearby place above!
                  </div>
                ) : (
                  posts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-2xl bg-[#0B1020]/95 border border-white/10 p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{post.authorName}</span>
                            {post.placeName && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-500/15 text-[#00D9FF]">
                                📍 {post.placeName}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(post.createdAt).toLocaleString()}
                          </div>
                        </div>

                        {post.crowdLevel && (
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                              CROWD_LEVEL_META[post.crowdLevel].bg
                            } ${CROWD_LEVEL_META[post.crowdLevel].border} ${
                              CROWD_LEVEL_META[post.crowdLevel].text
                            }`}
                          >
                            {post.crowdLevel}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-200 leading-relaxed">{post.text}</p>

                      {/* Emoji Reactions */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {['👍', '🔥', '⚡', '👀', '✅'].map((emoji) => {
                          const count = (post.reactions?.[emoji] || []).length;
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleReactPost(post.id, emoji)}
                              className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                                count > 0
                                  ? 'bg-cyan-500/15 border-cyan-400/40 text-white'
                                  : 'bg-[#060913] border-white/10 text-slate-400 hover:text-white'
                              }`}
                            >
                              {emoji} {count > 0 && <span className="font-bold ml-1">{count}</span>}
                            </button>
                          );
                        })}
                      </div>

                      {/* Comments */}
                      {(post.comments || []).length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-white/5">
                          {post.comments.map((c) => (
                            <div
                              key={c.id}
                              className="text-xs bg-[#060913] rounded-lg px-3 py-1.5 flex items-baseline justify-between gap-2"
                            >
                              <div>
                                <span className="font-bold text-[#00D9FF] mr-1.5">
                                  {c.authorName}:
                                </span>
                                <span className="text-slate-300">{c.text}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Comment Input */}
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={commentDrafts[post.id] || ''}
                          onChange={(e) =>
                            setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          placeholder="Write a comment..."
                          className="flex-1 px-3 py-1.5 rounded-lg bg-[#060913] border border-white/10 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddComment(post.id)}
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-[#00D9FF]"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            E. ALERTS SCREEN
           =================================================================== */}
        {subTab === 'alerts' && (
          <div className="space-y-6">
            {/* Notification Radius Bar */}
            <div className="rounded-2xl bg-[#0B1020]/95 border border-cyan-500/30 p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-[#00D9FF]" />
                  <span>Proximity Crowd & Emergency Alerts</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Monitoring high-density surges, emergency SOS broadcasts, and verified safety hazards within{' '}
                  <b className="text-[#00D9FF]">{settings.notificationRadiusKm} km</b>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-300 font-semibold">Alert Radius:</span>
                <input
                  type="range"
                  min={1}
                  max={50}
                  step={1}
                  value={settings.notificationRadiusKm}
                  onChange={(e) =>
                    handleUpdateSettings({ notificationRadiusKm: Number(e.target.value) })
                  }
                  className="w-36 accent-[#00D9FF]"
                />
                <span className="text-xs font-black text-[#00D9FF] min-w-[48px]">
                  {settings.notificationRadiusKm} km
                </span>
              </div>
            </div>

            {/* Active Emergency SOS Alerts */}
            {activeAlerts.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400">
                  Active Emergency SOS Broadcasts ({activeAlerts.length})
                </h3>
                {activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-2xl bg-rose-950/40 border border-rose-500/50 p-4 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span className="text-sm font-black text-white">
                          SOS from {alert.senderName}
                        </span>
                      </div>
                      <p className="text-xs text-rose-200">{alert.message}</p>
                      <div className="text-[11px] text-rose-300/80">
                        Coordinates: {alert.latitude.toFixed(4)}, {alert.longitude.toFixed(4)} ·{' '}
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMapCenter([alert.latitude, alert.longitude]);
                        setMapZoom(17);
                        setSubTab('map');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-rose-500 text-white font-bold text-xs shrink-0"
                    >
                      Locate on Map
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Nearby Crowd Surge & Safety Report Alerts */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Nearby Crowd & Safety Updates ({nearbyCrowdAlerts.length})
              </h3>
              {nearbyCrowdAlerts.length === 0 ? (
                <div className="rounded-2xl bg-[#0B1020]/70 border border-white/10 p-8 text-center space-y-2">
                  <Bell className="w-7 h-7 text-[#00D9FF] mx-auto opacity-80" />
                  <div className="text-sm font-bold text-white">
                    No Crowd Surges or Hazards Within {settings.notificationRadiusKm} km
                  </div>
                  <p className="text-xs text-slate-400">
                    All monitored geohash zones within your alert radius are currently Quiet or Moderate.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {nearbyCrowdAlerts.map((item) => {
                    const meta = CROWD_LEVEL_META[item.crowdLevel];
                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl bg-[#0B1020]/95 border border-white/10 p-4 flex items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${meta.bg} ${meta.border} ${meta.text}`}
                            >
                              {item.crowdLevel}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {(item.distanceMeters / 1000).toFixed(2)} km away
                            </span>
                          </div>
                          <div className="text-sm font-bold text-white">{item.title}</div>
                          <div className="text-xs text-slate-400">{item.subtitle}</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setMapCenter([item.lat, item.lng]);
                            setMapZoom(16);
                            setSubTab('map');
                          }}
                          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#00D9FF]"
                        >
                          <MapPin className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            F. SAVED PLACES SCREEN
           =================================================================== */}
        {subTab === 'saved' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newPlaceName.trim()) return;
                  const targetLat = selectedPlace?.lat ?? myLocation?.latitude ?? mapCenter[0];
                  const targetLng = selectedPlace?.lon ?? myLocation?.longitude ?? mapCenter[1];
                  void handleSavePlace({
                    name: newPlaceName.trim(),
                    customLabel: newPlaceLabel.trim() || undefined,
                    address:
                      newPlaceAddress.trim() ||
                      `${targetLat.toFixed(4)}, ${targetLng.toFixed(4)}`,
                    latitude: targetLat,
                    longitude: targetLng,
                    notifyWhenLevel: newPlaceNotifyLevel,
                  });
                  setNewPlaceName('');
                  setNewPlaceLabel('');
                  setNewPlaceAddress('');
                }}
                className="rounded-2xl bg-[#0B1020]/95 border border-cyan-500/30 p-5 space-y-4"
              >
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Bookmark className="w-5 h-5 text-[#00D9FF]" />
                  <span>Save Place with Crowd Alert Rule</span>
                </h2>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                      Place Name
                    </label>
                    <input
                      type="text"
                      value={newPlaceName}
                      onChange={(e) => setNewPlaceName(e.target.value)}
                      placeholder="e.g., Central Metro Station, Library, Gym"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#060913] border border-white/15 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                      Custom Label (Optional)
                    </label>
                    <input
                      type="text"
                      value={newPlaceLabel}
                      onChange={(e) => setNewPlaceLabel(e.target.value)}
                      placeholder="e.g., Morning Commute, Study Spot"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#060913] border border-white/15 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                      Address / Note
                    </label>
                    <input
                      type="text"
                      value={newPlaceAddress}
                      onChange={(e) => setNewPlaceAddress(e.target.value)}
                      placeholder="Uses selected place or current GPS coordinates"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#060913] border border-white/15 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                      Notify Me When Crowd Level Is
                    </label>
                    <select
                      value={newPlaceNotifyLevel}
                      onChange={(e) =>
                        setNewPlaceNotifyLevel(e.target.value as Exclude<CrowdLevel, 'Unknown'>)
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#060913] border border-white/15 text-xs text-white"
                    >
                      {(['Quiet', 'Moderate', 'Busy', 'Very Busy'] as const).map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00D9FF] to-[#397BFF] text-[#050811] font-black text-xs uppercase tracking-wider"
                  >
                    Save Monitored Place
                  </button>
                </div>
              </form>
            </div>

            <div className="lg:col-span-7 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Your Monitored CROWDZONE Places ({savedPlaces.length})
              </h3>
              {savedPlaces.length === 0 ? (
                <div className="rounded-2xl bg-[#0B1020]/70 border border-white/10 p-8 text-center text-xs text-slate-400">
                  No saved places yet. Save locations from Explore or add one on the left to monitor live crowd status.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savedPlaces.map((pl) => {
                    const cell = getCrowdStatusForCoords(pl.latitude, pl.longitude);
                    const liveLevel: CrowdLevel = cell?.crowdLevel || 'Unknown';
                    const meta = CROWD_LEVEL_META[liveLevel];
                    return (
                      <div
                        key={pl.id}
                        className="rounded-2xl bg-[#0B1020]/95 border border-white/10 p-4 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-bold text-white">{pl.name}</div>
                              {pl.customLabel && (
                                <span className="text-[10px] font-bold text-[#00D9FF]">
                                  {pl.customLabel}
                                </span>
                              )}
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${meta.bg} ${meta.border} ${meta.text}`}
                            >
                              {liveLevel}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">{pl.address}</p>
                        </div>

                        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">
                            Alert Target: <b className="text-white">{pl.notifyWhenLevel}</b>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setMapCenter([pl.latitude, pl.longitude]);
                                setMapZoom(16);
                                setSubTab('map');
                              }}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#00D9FF]"
                              title="View on Live Crowd Map"
                            >
                              <MapIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSavedPlace(pl.id)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-rose-400"
                              title="Delete Saved Place"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            G. ANALYTICS SCREEN (Historical Activity, Predictions, Alternatives)
           =================================================================== */}
        {subTab === 'analytics' && (
          <div className="space-y-6">
            {/* Real-Time D3 Crowd Trend Chart */}
            <CrowdTrendD3Chart
              history={history}
              cells={cells}
              reports={reports}
              timeWindow={timeWindow}
              selectedCellId={selectedCellId}
              selectedPlaceName={selectedPlace?.name}
              onSelectTimeWindow={(w) => setTimeWindow(w)}
              onClearCellFilter={() => {
                setSelectedCellId(undefined);
                setSelectedPlace(null);
              }}
            />

            {/* Next 6-Hour Crowd Predictions (Explicitly Labeled PREDICTED) */}
            <div className="rounded-2xl bg-[#0B1020]/95 border border-cyan-500/25 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-black text-white">
                    Next 6-Hour Crowd Forecast
                  </h2>
                  <p className="text-xs text-slate-400">
                    Projected from observed historical buckets & current cell trend direction
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-cyan-500/15 text-[#00D9FF] border border-cyan-400/30">
                  PREDICTED ACTIVITY
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {predictions.map((pred) => {
                  const meta = CROWD_LEVEL_META[pred.predictedLevel];
                  return (
                    <div
                      key={pred.hourOffset}
                      className="rounded-xl bg-[#060913] border border-white/10 p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{pred.label}</span>
                        <span className="text-[10px] text-slate-400">+{pred.hourOffset}h</span>
                      </div>
                      <div
                        className={`px-2 py-1 rounded-lg text-xs font-bold text-center border ${meta.bg} ${meta.border} ${meta.text}`}
                      >
                        {pred.predictedLevel}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span>Score {pred.predictedDensityScore}%</span>
                        <span>Conf. {pred.confidenceScore}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Alternative Less-Crowded Places Recommendations */}
            <div className="rounded-2xl bg-[#0B1020]/95 border border-cyan-500/25 p-5 space-y-4">
              <div>
                <h2 className="text-base font-black text-white">
                  Recommended Less-Crowded Nearby Alternatives
                </h2>
                <p className="text-xs text-slate-400">
                  Ranked by lower observed crowd density, spatial proximity, and category match
                </p>
              </div>

              {alternativePlaces.length === 0 ? (
                <div className="text-xs text-slate-400 py-4">
                  Searching nearby candidate locations for alternative recommendations...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {alternativePlaces.map((alt) => {
                    const meta = CROWD_LEVEL_META[alt.crowdLevel];
                    return (
                      <div
                        key={alt.placeId}
                        className="rounded-xl bg-[#060913] border border-white/10 p-4 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase text-[#00D9FF]">
                              {alt.category}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${meta.bg} ${meta.border} ${meta.text}`}
                            >
                              {alt.crowdLevel}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-white">{alt.name}</div>
                          <div className="text-xs text-slate-400">{alt.reason}</div>
                        </div>

                        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">
                            {(alt.distanceMeters / 1000).toFixed(2)} km away
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setMapCenter([alt.latitude, alt.longitude]);
                              setMapZoom(16);
                              setSubTab('map');
                            }}
                            className="text-[#00D9FF] font-bold hover:underline"
                          >
                            View on Map →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            H. SETTINGS & PRIVACY SCREEN (+ Admin Moderation)
           =================================================================== */}
        {subTab === 'settings' && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-[#0B1020]/95 border border-cyan-500/30 p-5 space-y-5">
              <div className="flex items-center gap-2.5">
                <Lock className="w-5 h-5 text-[#00D9FF]" />
                <div>
                  <h2 className="text-base font-black text-white">
                    CROWDZONE Privacy & Signal Contribution Controls
                  </h2>
                  <p className="text-xs text-slate-400">
                    Your exact GPS coordinates are never exposed in public crowd cells. Signals are anonymized and aggregated into geohash zones.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  {
                    key: 'contributeAnonymousCrowdSignals' as const,
                    title: 'Contribute Anonymous Crowd Signals',
                    desc: 'Allow your anonymized, deduplicated location signal to improve geohash cell crowd estimates when location sharing is enabled.',
                  },
                  {
                    key: 'crowdAlertsEnabled' as const,
                    title: 'Nearby Crowd Surge Notifications',
                    desc: 'Receive alerts when geohash zones within your notification radius become Busy or Very Busy.',
                  },
                  {
                    key: 'emergencyAlertsEnabled' as const,
                    title: 'Emergency SOS Priority Alerts',
                    desc: 'Receive immediate high-priority alerts for nearby SOS broadcasts.',
                  },
                  {
                    key: 'communityReportAlertsEnabled' as const,
                    title: 'Verified Community Report Updates',
                    desc: 'Notify when nearby crowd or public safety reports are verified by peers.',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="rounded-xl bg-[#060913] border border-white/10 p-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-sm font-bold text-white">{item.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateSettings({ [item.key]: !settings[item.key] })
                      }
                      className={`w-12 h-7 rounded-full transition-all p-1 shrink-0 ${
                        settings[item.key] ? 'bg-[#00D9FF]' : 'bg-slate-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-[#050811] transition-transform ${
                          settings[item.key] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Admin Moderation Section */}
            {user.isAdmin && (
              <div className="rounded-2xl bg-[#0B1020]/95 border border-amber-500/30 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-amber-300">
                    Admin Moderation & Verification Queue
                  </h3>
                  <span className="text-xs text-slate-400">
                    {moderationLogs.length} moderation actions logged
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {reports.slice(0, 8).map((rep) => (
                    <div
                      key={rep.id}
                      className="rounded-xl bg-[#060913] border border-white/10 p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {rep.placeName} ({rep.crowdLevel})
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {rep.description}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAdminModerate('crowd_report', rep.id, 'approve')}
                          className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdminModerate('crowd_report', rep.id, 'remove')}
                          className="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-[10px] font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
