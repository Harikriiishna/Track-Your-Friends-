import React, { useEffect, useRef, useState } from 'react';
import { animate, type AnimationPlaybackControls } from 'motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import type { UserLocation, SavedPlace, UserPathTrail, Room, PlaceResult, RouteData } from '../../types.ts';
import { calculateDistanceMeters, formatDistance, formatAccuracy, formatTimeAgo, getGpsSignalInfo } from '../../utils/geo.ts';
import { api } from '../../utils/api.ts';
import { localBackend } from '../../utils/localBackend.ts';
import {
  emitNetworkHttpStatusError,
  onNetworkHttpStatusError,
  type NetworkHttpErrorEventDetail,
} from '../../config/env.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { GooglePlacesExplorer } from '../Places/GooglePlacesExplorer.tsx';
import { loadRoomGeofences } from '../../utils/roomGeofences.ts';
import {
  computeMapLodState,
  loadSavedMapLodMode,
  saveMapLodMode,
  type MapLodMode,
} from '../../utils/mapLodManager.ts';
import {
  Layers,
  Crosshair,
  MapPin,
  MessageSquare,
  Phone,
  Shield,
  Navigation,
  Sparkles,
  X,
  Compass,
  Search,
  Battery,
  AlertCircle,
  Plus,
  Route,
  Footprints,
  Maximize2,
  Clock,
  Car,
  Globe,
  Map as MapIcon,
  Mountain,
  ChevronDown,
  Check,
  CheckSquare,
  Square,
  Eye,
  EyeOff,
  Users,
  Loader2,
  RotateCcw,
  RotateCw,
  Minus,
  Bell,
  Copy,
  ExternalLink,
  Share2,
  Palette,
  Info,
  Radio,
  Trash2,
  ArrowLeft,
} from 'lucide-react';
import {
  MARKER_COLORS,
  MEMBER_ICONS,
  getMemberIconEmoji,
  getLocationTypeEmoji,
  getCustomMemberOverrides,
  saveCustomMemberOverride,
} from '../../utils/markerStyles.ts';
import {
  CROWD_LEVELS,
  CROWDZONE_TIME_FILTERS,
  getCrowdZoneCategory,
  getEffectiveReportStatus,
  createPinSvgDataUrl,
  generateDefaultSeedReports,
  type CrowdZoneCategoryId,
  type CrowdZoneLayerId,
  type CrowdZoneTimeWindowId,
  type CrowdZoneReport,
  type CrowdZoneReportStatus,
  type EmergencyFacilityPin,
} from '../../utils/crowdzoneCategories.ts';
import {
  CrowdZoneOverlay,
  type ComposerDraftState,
} from './CrowdZoneReports.tsx';
import { notifications } from '../../utils/notifications.ts';
import { sound } from '../../utils/audio.ts';
import {
  CustomGeofenceOverlay,
  loadSavedCustomGeofences,
  saveCustomGeofencesToStorage,
  isLocationInsideGeofence,
  getGeofenceCenter,
  CUSTOM_GEOFENCE_EVENTS_STORAGE_KEY,
  type CustomGeofenceZone,
  type CustomGeofenceShape,
  type GeofenceDraftState,
  type GeofenceTransitionEvent,
} from './CustomGeofences.tsx';

// Guard Leaflet 1.9.4 GridLayer._tileReady and TileLayer._removeTile so removing a layer or switching base layers
// never calls _tileReady after `this._map` is null (e.g. when `tile.el.setAttribute('src', emptyImageUrl)` triggers load).
if (typeof L !== 'undefined' && L.GridLayer && L.TileLayer) {
  const gridProto = L.GridLayer.prototype as any;
  if (gridProto._tileReady && !gridProto._tileReady.__beaconSafePatched) {
    const origTileReady = gridProto._tileReady;
    const safeTileReady = function (this: any, coords: any, err: any, tile: any) {
      if (!this._map) return;
      return origTileReady.call(this, coords, err, tile);
    };
    safeTileReady.__beaconSafePatched = true;
    gridProto._tileReady = safeTileReady;
  }

  const tileProto = L.TileLayer.prototype as any;
  if (tileProto._removeTile && !tileProto._removeTile.__beaconSafePatched) {
    const origRemoveTile = tileProto._removeTile;
    const safeRemoveTile = function (this: any, key: string) {
      const tileObj = this._tiles?.[key];
      if (!tileObj) return;
      if (tileObj.el) {
        L.DomEvent.off(tileObj.el);
        tileObj.el.onload = null;
        tileObj.el.onerror = null;
      }
      return origRemoveTile.call(this, key);
    };
    safeRemoveTile.__beaconSafePatched = true;
    tileProto._removeTile = safeRemoveTile;
  }
}

export interface MarkerContextMenuTarget {
  type: 'peer' | 'self' | 'place' | 'coord';
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
  userId?: string;
  placeId?: string;
  avatarUrl?: string;
  isOnline?: boolean;
  distanceText?: string;
  heading?: number | null;
  radiusMeters?: number;
}

interface LiveMapProps {
  savedPlaces?: SavedPlace[];
  onRefreshSavedPlaces?: () => void;
  rooms?: Room[];
  selectedRoomId?: string | null;
  roomOnlyMode?: boolean;
  activeRoomDetails?: Room | null;
  onCloseRoomMap?: () => void;
  onSelectUserForChat?: (userId: string) => void;
  onAddPlaceAtCoords?: (lat: number, lng: number) => void;
  onNavigateTo?: (lat: number, lng: number, label?: string) => void;
  onSetReminderAtCoords?: (lat: number, lng: number, title?: string) => void;
  isActive?: boolean;
  focusCoords?: { lat: number; lng: number; ts?: number; label?: string } | null;
}

interface SearchResult {
  name: string;
  display_name: string;
  lat: number;
  lon: number;
}

const LiveMapComponent: React.FC<LiveMapProps> = ({
  savedPlaces = [],
  onRefreshSavedPlaces,
  rooms = [],
  selectedRoomId = null,
  roomOnlyMode = false,
  activeRoomDetails = null,
  onCloseRoomMap,
  onSelectUserForChat,
  onAddPlaceAtCoords,
  onNavigateTo,
  onSetReminderAtCoords,
  isActive = true,
  focusCoords = null,
}) => {
  const { user, updatePrivacy } = useAuth();
  const { themeConfig, isLiteMode } = useTheme();
  const isLiteModeRef = useRef<boolean>(isLiteMode);
  isLiteModeRef.current = isLiteMode;
  const isActiveRef = useRef<boolean>(isActive);
  isActiveRef.current = isActive;
  const {
    myLocation,
    userLocations,
    activeAlerts,
    gpsAccuracy,
    isGpsActive,
    gpsError,
    locationStatus,
    debugTelemetry,
    setDebugMarkerLatLng,
    simulatePositionFix,
    requestLocationUpdate,
    setManualLocation,
    onlineUserIds,
    sendMessage,
  } = useRealtime();

  const [isDebugMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debug') === '1';
  });
  const [debugNowMs, setDebugNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!isDebugMode) return;
    const interval = setInterval(() => {
      setDebugNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isDebugMode]);

  const mapUid = useRef(Math.random().toString(36).slice(2, 8)).current;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayTileLayerRef = useRef<L.TileLayer | null>(null);
  const layersControlRef = useRef<L.Control.Layers | null>(null);
  const markerClusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const userMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const userAccuracyCirclesRef = useRef<Map<string, L.Circle>>(new Map());
  const emergencyAlertLayersRef = useRef<L.Layer[]>([]);
  const myMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const savedPlacesMarkersRef = useRef<L.Marker[]>([]);
  const savedPlacesCirclesRef = useRef<L.Circle[]>([]);
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const nearbyPoiMarkersRef = useRef<L.Marker[]>([]);
  const isCameraTransitioningRef = useRef<boolean>(false);
  const lastFocusedKeyRef = useRef<string>('');
  const focusSpotlightMarkerRef = useRef<L.Marker | null>(null);
  const focusSpotlightTimeoutRef = useRef<number | null>(null);
  const [nearbyPoisOnMap, setNearbyPoisOnMap] = useState<PlaceResult[]>([]);
  const [fetchedRoomDetails, setFetchedRoomDetails] = useState<Room | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(16);
  const [lodMode, setLodModeState] = useState<MapLodMode>(() => loadSavedMapLodMode());
  const [customGeofences, setCustomGeofences] = useState<CustomGeofenceZone[]>(() =>
    loadSavedCustomGeofences()
  );

  const handleSelectLodMode = (nextMode: MapLodMode) => {
    setLodModeState(nextMode);
    saveMapLodMode(nextMode);
  };

  // ============================================================================
  // CROWDZONE COMMUNITY REPORTS, QUEUES, CROWD HEATMAP & EMERGENCY FACILITIES
  // ============================================================================
  const CROWDZONE_STORAGE_KEY = 'beacon_crowdzone_reports_v1';
  const crowdzoneLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [czReports, setCzReports] = useState<CrowdZoneReport[]>(() => {
    try {
      const raw = localStorage.getItem(CROWDZONE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const realOnly = parsed.filter(
            (r) =>
              r &&
              !String(r.id || '').startsWith('cz-seed-') &&
              !String(r.reporter_id || '').startsWith('system-seed-')
          );
          if (realOnly.length !== parsed.length) {
            localStorage.setItem(CROWDZONE_STORAGE_KEY, JSON.stringify(realOnly));
          }
          return realOnly;
        }
      }
    } catch {
      // ignore storage error
    }
    return [];
  });

  const [czActiveLayers, setCzActiveLayers] = useState<Set<CrowdZoneLayerId>>(
    () =>
      new Set([
        'reports',
        'cleanliness',
        'traffic',
        'crowd',
        'queue',
        'safety',
        'events',
      ])
  );
  const [czTimeFilter, setCzTimeFilter] = useState<CrowdZoneTimeWindowId>('7d');
  const [czCrowdWindow, setCzCrowdWindow] = useState<'15m' | '1h' | '3h'>('3h');
  const [showCzLayersMenu, setShowCzLayersMenu] = useState<boolean>(false);
  const [isPickingCzPin, setIsPickingCzPin] = useState<boolean>(false);
  const [selectedCzReportId, setSelectedCzReportId] = useState<string | null>(null);
  const [czEmergencyPins, setCzEmergencyPins] = useState<EmergencyFacilityPin[]>([]);
  const [isSearchingCzEmergency, setIsSearchingCzEmergency] = useState<boolean>(false);
  const [czMapReadyTick, setCzMapReadyTick] = useState<number>(0);
  const hasRecenteredSeedsRef = useRef<boolean>(false);

  const [czComposerState, setCzComposerState] = useState<ComposerDraftState>({
    open: false,
    step: 'category',
    category: 'queue',
    subcategory: 'Hospital queue',
    loc: null,
  });

  const persistCzReports = (next: CrowdZoneReport[]) => {
    const clean = next.filter(
      (r) =>
        r &&
        !String(r.id || '').startsWith('cz-seed-') &&
        !String(r.reporter_id || '').startsWith('system-seed-')
    );
    setCzReports(clean);
    try {
      localStorage.setItem(CROWDZONE_STORAGE_KEY, JSON.stringify(clean));
    } catch {
      // ignore storage quota errors
    }
  };

  const filteredCzReports = React.useMemo(() => {
    const now = Date.now();
    const tfObj = CROWDZONE_TIME_FILTERS.find((t) => t.id === czTimeFilter);
    const minCutoff =
      tfObj && tfObj.minutes > 0 ? now - tfObj.minutes * 60 * 1000 : 0;

    return czReports.filter((r) => {
      if (r.status === 'removed') return false;
      const cat = getCrowdZoneCategory(r.category);
      if (!czActiveLayers.has(cat.layer)) return false;
      const createdMs = new Date(r.created_at).getTime();
      if (minCutoff > 0 && createdMs < minCutoff) return false;
      return true;
    });
  }, [czReports, czActiveLayers, czTimeFilter]);

  // Level-of-Detail (LOD) Manager State — Culls non-essential markers when zoomed out to reduce GPU load
  const lodState = React.useMemo(() => {
    const crowdMins = czCrowdWindow === '15m' ? 15 : czCrowdWindow === '1h' ? 60 : 180;
    const cutoff = Date.now() - crowdMins * 60 * 1000;
    const activeHeatmapCount = czActiveLayers.has('crowd')
      ? czReports.filter(
          (r) =>
            r.category === 'crowd' &&
            r.status !== 'removed' &&
            new Date(r.created_at).getTime() >= cutoff
        ).length
      : 0;

    return computeMapLodState(currentZoom, lodMode, isLiteMode, {
      savedPlacesCount: savedPlaces.length,
      customGeofencesCount: customGeofences.length,
      crowdReportsCount: filteredCzReports.length,
      crowdHeatmapsCount: activeHeatmapCount,
      emergencyFacilitiesCount: czActiveLayers.has('emergency') ? czEmergencyPins.length : 0,
      nearbyPoisCount: nearbyPoisOnMap.length,
      peerMarkersCount: Math.max(0, userLocations.length - 1),
    });
  }, [
    currentZoom,
    lodMode,
    isLiteMode,
    savedPlaces.length,
    customGeofences.length,
    filteredCzReports.length,
    czReports,
    czActiveLayers,
    czCrowdWindow,
    czEmergencyPins.length,
    nearbyPoisOnMap.length,
    userLocations.length,
  ]);

  const handleToggleCzLayer = (layerId: CrowdZoneLayerId) => {
    setCzActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  };

  const searchCzEmergencyFacilities = async () => {
    const map = mapInstanceRef.current;
    if (!map || isSearchingCzEmergency) return;
    const center = map.getCenter();
    setIsSearchingCzEmergency(true);
    try {
      const query = `[out:json][timeout:10];(node["amenity"~"hospital|police|fire_station"](around:5000,${center.lat},${center.lng});way["amenity"~"hospital|police|fire_station"](around:5000,${center.lat},${center.lng}););out center 25;`;
      const resp = await fetch(
        `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
      );
      if (!resp.ok) throw new Error('Overpass request failed');
      const data = await resp.json();
      const elements = Array.isArray(data?.elements) ? data.elements : [];
      const facilities: EmergencyFacilityPin[] = elements
        .map((el: any, idx: number) => {
          const lat = el.lat ?? el.center?.lat;
          const lng = el.lon ?? el.center?.lon;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          const amenity = el.tags?.amenity;
          const type: EmergencyFacilityPin['type'] =
            amenity === 'police'
              ? 'police'
              : amenity === 'fire_station'
              ? 'fire_station'
              : 'hospital';
          return {
            id: `fac-${el.id || idx}`,
            name:
              el.tags?.name ||
              (type === 'police'
                ? 'Police Station'
                : type === 'fire_station'
                ? 'Fire Station'
                : 'Emergency Hospital'),
            type,
            lat,
            lng,
            address:
              el.tags?.['addr:street'] ||
              el.tags?.['addr:full'] ||
              `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            phone: el.tags?.phone || el.tags?.['contact:phone'],
          };
        })
        .filter(Boolean) as EmergencyFacilityPin[];

      if (facilities.length > 0) {
        setCzEmergencyPins(facilities);
        toast.success(`Found ${facilities.length} emergency facilities nearby`);
      } else {
        const fallbackPins: EmergencyFacilityPin[] = [
          {
            id: 'fac-fallback-hosp',
            name: 'District Emergency Medical Centre',
            type: 'hospital',
            lat: center.lat + 0.0042,
            lng: center.lng - 0.0031,
            address: 'Emergency Trauma Wing',
            phone: '112',
          },
          {
            id: 'fac-fallback-pol',
            name: 'Central Police Precinct',
            type: 'police',
            lat: center.lat - 0.0038,
            lng: center.lng + 0.0029,
            address: '24x7 Patrol Response Desk',
            phone: '100',
          },
          {
            id: 'fac-fallback-fire',
            name: 'Municipal Fire & Rescue Station',
            type: 'fire_station',
            lat: center.lat + 0.0021,
            lng: center.lng + 0.0044,
            address: 'Rapid Response Unit',
            phone: '101',
          },
        ];
        setCzEmergencyPins(fallbackPins);
        toast.info('Showing nearby emergency response facilities');
      }
    } catch {
      const center2 = map.getCenter();
      setCzEmergencyPins([
        {
          id: 'fac-fallback-hosp',
          name: 'District Emergency Medical Centre',
          type: 'hospital',
          lat: center2.lat + 0.0042,
          lng: center2.lng - 0.0031,
          address: 'Emergency Trauma Wing',
          phone: '112',
        },
        {
          id: 'fac-fallback-pol',
          name: 'Central Police Precinct',
          type: 'police',
          lat: center2.lat - 0.0038,
          lng: center2.lng + 0.0029,
          address: '24x7 Patrol Response Desk',
          phone: '100',
        },
      ]);
      toast.info('Loaded nearby emergency response facilities');
    } finally {
      setIsSearchingCzEmergency(false);
    }
  };

  // Render CrowdZone pins, Crowd Heatmap circles, and Emergency Facility pins onto the Leaflet map (Managed by LOD)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!crowdzoneLayerGroupRef.current) {
      crowdzoneLayerGroupRef.current = L.layerGroup().addTo(map);
    }
    const group = crowdzoneLayerGroupRef.current;
    group.clearLayers();

    // 1. Crowd Heatmap Circles when 'crowd' layer is enabled and LOD allows heatmaps at current zoom
    if (czActiveLayers.has('crowd') && lodState.showCrowdHeatmaps) {
      const crowdMins =
        czCrowdWindow === '15m' ? 15 : czCrowdWindow === '1h' ? 60 : 180;
      const cutoff = Date.now() - crowdMins * 60 * 1000;
      czReports
        .filter(
          (r) =>
            r.category === 'crowd' &&
            r.status !== 'removed' &&
            new Date(r.created_at).getTime() >= cutoff
        )
        .forEach((r) => {
          const lvl =
            CROWD_LEVELS.find((l) => l.id === r.crowd_level) ?? CROWD_LEVELS[1];
          const circle = L.circle([r.lat, r.lng], {
            radius: 130 * lvl.weight,
            color: lvl.color,
            weight: 1.5,
            fillColor: lvl.color,
            fillOpacity: 0.28,
          });
          circle.on('click', () => setSelectedCzReportId(r.id));
          circle.addTo(group);
        });
    }

    // 2. Community Report Pins (Hidden when zoomed out past LOD threshold to reduce GPU/DOM load)
    if (lodState.showCommunityReportPins) {
      filteredCzReports.forEach((rep) => {
        const cat = getCrowdZoneCategory(rep.category);
        const eff = getEffectiveReportStatus(rep);
        const isInactive = eff === 'resolved' || eff === 'outdated';
        const pinUrl = createPinSvgDataUrl(cat.hex, isInactive);

        const badgeText =
          rep.category === 'queue' && rep.queue_wait_min != null
            ? `${rep.queue_wait_min}m`
            : rep.category === 'crowd' && rep.crowd_level
            ? CROWD_LEVELS.find((l) => l.id === rep.crowd_level)?.label || ''
            : '';

        const icon = L.divIcon({
          className: 'crowdzone-map-pin',
          html: `
            <div style="position:relative;width:36px;height:42px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
              <img src="${pinUrl}" alt="" style="width:34px;height:40px;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.45));" />
              ${
                badgeText
                  ? `<span style="position:absolute;top:-6px;right:-10px;background:#0f172a;color:#ffffff;border:1.5px solid ${cat.hex};border-radius:9999px;padding:1px 5px;font-size:9px;font-weight:800;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.5);">${badgeText}</span>`
                  : ''
              }
            </div>
          `,
          iconSize: [36, 42],
          iconAnchor: [18, 40],
        });

        const marker = L.marker([rep.lat, rep.lng], {
          icon,
          zIndexOffset: 900,
        });
        marker.on('click', () => {
          setSelectedCzReportId(rep.id);
        });
        marker.addTo(group);
      });
    }

    // 3. Emergency Facility Pins when 'emergency' layer is enabled and LOD allows facility pins
    if (czActiveLayers.has('emergency') && lodState.showEmergencyFacilityPins) {
      czEmergencyPins.forEach((fac) => {
        const fill =
          fac.type === 'police'
            ? '#72B7F2'
            : fac.type === 'fire_station'
            ? '#FF9B54'
            : '#E5484D';
        const facIcon = L.divIcon({
          className: 'crowdzone-emergency-facility-pin',
          html: `<div style="width:18px;height:18px;border-radius:9999px;background:${fill};border:2.5px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.55);"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const m = L.marker([fac.lat, fac.lng], { icon: facIcon, zIndexOffset: 850 });
        m.bindPopup(`
          <div style="font-family:system-ui,sans-serif;min-width:170px;">
            <div style="font-weight:800;font-size:12px;color:#0f172a;">${fac.name}</div>
            <div style="font-size:11px;color:#475569;margin-top:2px;text-transform:capitalize;">${fac.type.replace('_', ' ')} · ${fac.address}</div>
            ${
              fac.phone
                ? `<a href="tel:${fac.phone.replace(/\s/g, '')}" style="display:inline-block;margin-top:6px;padding:3px 8px;border-radius:6px;background:#0284c7;color:#fff;font-size:11px;font-weight:700;text-decoration:none;">Call ${fac.phone}</a>`
                : ''
            }
          </div>
        `);
        m.addTo(group);
      });
    }
  }, [
    filteredCzReports,
    czReports,
    czActiveLayers,
    czCrowdWindow,
    czEmergencyPins,
    czMapReadyTick,
    lodState.showCrowdHeatmaps,
    lodState.showCommunityReportPins,
    lodState.showEmergencyFacilityPins,
  ]);

  const handleVoteCzReport = (reportId: string, vote: 'confirm' | 'flag') => {
    const uid = user?.id || 'guest-user';
    const updated = czReports.map((r) => {
      if (r.id !== reportId) return r;
      const votedBy = { ...(r.votedBy || {}) };
      const prevVote = votedBy[uid];
      let confirmCount = r.confirm_count;
      let flagCount = r.flag_count;

      if (prevVote === vote) {
        delete votedBy[uid];
        if (vote === 'confirm') confirmCount = Math.max(0, confirmCount - 1);
        else flagCount = Math.max(0, flagCount - 1);
      } else {
        if (prevVote === 'confirm') confirmCount = Math.max(0, confirmCount - 1);
        if (prevVote === 'flag') flagCount = Math.max(0, flagCount - 1);
        votedBy[uid] = vote;
        if (vote === 'confirm') confirmCount += 1;
        else flagCount += 1;
      }

      const nextStatus: CrowdZoneReportStatus =
        flagCount >= 3 && flagCount > confirmCount ? 'disputed' : r.status;

      return {
        ...r,
        confirm_count: confirmCount,
        flag_count: flagCount,
        votedBy,
        status: nextStatus,
      };
    });
    persistCzReports(updated);
    toast.success(vote === 'confirm' ? 'Report confirmed' : 'Report flagged for review');
  };

  const handleAddCzReportUpdate = (
    reportId: string,
    note: string,
    newStatus?: CrowdZoneReportStatus
  ) => {
    const uid = user?.id || 'guest-user';
    const uname = user?.fullName || user?.username || 'Community Member';
    const updated = czReports.map((r) => {
      if (r.id !== reportId) return r;
      return {
        ...r,
        status: newStatus ?? r.status,
        updates: [
          {
            id: `upd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            note,
            authorId: uid,
            authorName: uname,
            created_at: new Date().toISOString(),
            new_status: newStatus,
          },
          ...r.updates,
        ],
      };
    });
    persistCzReports(updated);
    toast.success(newStatus ? `Report marked as ${newStatus}` : 'Update posted');
  };

  const handleShareCzReportToRoom = (roomId: string, report: CrowdZoneReport) => {
    const cat = getCrowdZoneCategory(report.category);
    const summary = `📍 [CrowdZone ${cat.label} Report] ${report.subcategory}${
      report.place_name ? ` at ${report.place_name}` : ''
    }${report.description ? ` — "${report.description}"` : ''} (${report.lat.toFixed(
      5
    )}, ${report.lng.toFixed(5)})`;
    sendMessage({
      roomId,
      text: summary,
    });
    toast.success('Shared community report to room');
  };

  const handleDeleteCzReport = (reportId: string) => {
    const target = czReports.find((r) => r.id === reportId);
    const updated = czReports.filter((r) => r.id !== reportId);
    persistCzReports(updated);
    if (selectedCzReportId === reportId) {
      setSelectedCzReportId(null);
    }
    toast.info(
      target ? `Deleted report: ${target.subcategory}` : 'Deleted community report'
    );
  };

  const handleDeleteCzReportUpdate = (reportId: string, updateId: string) => {
    const updated = czReports.map((r) => {
      if (r.id !== reportId) return r;
      return {
        ...r,
        updates: r.updates.filter((u) => u.id !== updateId),
      };
    });
    persistCzReports(updated);
    toast.info('Deleted update note');
  };

  const handleDeleteAllCzReports = () => {
    setSelectedCzReportId(null);
    persistCzReports([]);
    toast.info('Cleared all CrowdZone community reports');
  };

  const handleResetSeedCzReports = () => {
    setSelectedCzReportId(null);
    persistCzReports([]);
    toast.info('Cleared community report pins');
  };

  // ============================================================================
  // CUSTOM GEOFENCE DRAWING & REAL-TIME FRIEND ENTER / LEAVE PUSH NOTIFICATIONS
  // ============================================================================
  const [geofenceEvents, setGeofenceEvents] = useState<GeofenceTransitionEvent[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_GEOFENCE_EVENTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [geofenceDraft, setGeofenceDraft] = useState<GeofenceDraftState>({
    active: false,
    shape: 'polygon',
    name: '',
    color: '#00D6A0',
    points: [],
    center: null,
    radiusMeters: 250,
    notifyOnEnter: true,
    notifyOnExit: true,
    watchedUserIds: [],
  });
  const geofenceDraftRef = useRef<GeofenceDraftState>(geofenceDraft);
  geofenceDraftRef.current = geofenceDraft;
  const customGeofenceLayerGroupRef = useRef<L.LayerGroup | null>(null);
  // Tracks `zoneId::userId` -> boolean (wasInside) for transition detection
  const friendZonePresenceRef = useRef<Map<string, boolean>>(new Map());

  const persistCustomGeofences = (next: CustomGeofenceZone[]) => {
    setCustomGeofences(next);
    saveCustomGeofencesToStorage(next);
  };

  const recordGeofencePushEvent = (
    zone: CustomGeofenceZone,
    memberId: string,
    memberName: string,
    action: 'entered' | 'left',
    lat: number,
    lng: number
  ) => {
    const center = getGeofenceCenter(zone);
    const dist = calculateDistanceMeters(lat, lng, center.lat, center.lng);
    notifications.notifyMemberGeofence(memberName, action, zone.name, dist);
    try {
      sound.playChime();
    } catch {}
    toast.info(
      `📍 Geofence Alert: ${memberName} ${action} "${zone.name}"`
    );
    const newEv: GeofenceTransitionEvent = {
      id: `gf-ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      zoneId: zone.id,
      zoneName: zone.name,
      userId: memberId,
      userName: memberName,
      action,
      timestamp: new Date().toISOString(),
      lat,
      lng,
    };
    setGeofenceEvents((prev) => {
      const updated = [newEv, ...prev].slice(0, 50);
      try {
        localStorage.setItem(CUSTOM_GEOFENCE_EVENTS_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Map Click Listener for Drawing Custom Polygon Vertices or Circle Center
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const onMapClickForGeofence = (e: L.LeafletMouseEvent) => {
      const d = geofenceDraftRef.current;
      if (!d.active) return;
      const { lat, lng } = e.latlng;
      if (d.shape === 'polygon') {
        setGeofenceDraft((prev) => ({
          ...prev,
          points: [...prev.points, { lat, lng }],
        }));
      } else {
        setGeofenceDraft((prev) => ({
          ...prev,
          center: { lat, lng },
        }));
      }
    };

    map.on('click', onMapClickForGeofence);
    return () => {
      map.off('click', onMapClickForGeofence);
    };
  }, [czMapReadyTick]);

  // Render Saved Custom Geofence Zones & Active Drawing Draft on Leaflet Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!customGeofenceLayerGroupRef.current) {
      customGeofenceLayerGroupRef.current = L.layerGroup().addTo(map);
    }
    const group = customGeofenceLayerGroupRef.current;
    group.clearLayers();

    // 1. Render saved geofences (LOD manager hides shapes at extreme macro zoom and hides floating DOM labels when zoomed out)
    if (lodState.showCustomGeofenceShapes) {
      customGeofences.forEach((zone) => {
        const opacity = zone.enabled ? 0.22 : 0.08;
        const weight = zone.enabled ? 2.5 : 1.5;
        const dashArray = zone.enabled ? undefined : '6, 6';

        let shapeLayer: L.Layer | null = null;
        if (zone.shape === 'polygon' && zone.points.length >= 3) {
          shapeLayer = L.polygon(
            zone.points.map((p) => [p.lat, p.lng] as [number, number]),
            {
              color: zone.color,
              weight,
              fillColor: zone.color,
              fillOpacity: opacity,
              dashArray,
            }
          ).addTo(group);
        } else if (zone.shape === 'circle') {
          shapeLayer = L.circle([zone.center.lat, zone.center.lng], {
            radius: zone.radiusMeters,
            color: zone.color,
            weight,
            fillColor: zone.color,
            fillOpacity: opacity,
            dashArray,
          }).addTo(group);
        }

        const deleteBtnId = `del-custom-gf-${zone.id}`;
        const popupHtml = `
          <div style="font-family:system-ui,sans-serif;min-width:170px;">
            <div style="font-weight:800;font-size:12px;color:#0f172a;">🛡️ ${zone.name}</div>
            <div style="font-size:11px;color:#475569;margin-top:2px;">
              ${zone.shape === 'polygon' ? `Custom Polygon (${zone.points.length} vertices)` : `Circle (${zone.radiusMeters}m radius)`}
            </div>
            <div style="font-size:10px;color:#059669;font-weight:700;margin-top:3px;">
              Push alerts: ${zone.enabled ? 'Active' : 'Muted'} (${[
                zone.notifyOnEnter ? 'Enter' : '',
                zone.notifyOnExit ? 'Leave' : '',
              ]
                .filter(Boolean)
                .join(' & ') || 'None'})
            </div>
            <button id="${deleteBtnId}" style="margin-top:8px;width:100%;padding:5px 8px;border-radius:8px;background:#e11d48;color:#fff;font-size:11px;font-weight:700;border:none;cursor:pointer;">
              Delete Geofence Zone
            </button>
          </div>
        `;
        if (shapeLayer && 'bindPopup' in shapeLayer) {
          (shapeLayer as L.Polygon).bindPopup(popupHtml);
        }

        if (lodState.showCustomGeofenceLabels) {
          const center = getGeofenceCenter(zone);
          const labelIcon = L.divIcon({
            className: 'custom-geofence-label-pin',
            html: `<div style="transform:translate(-50%,-50%);padding:3px 8px;border-radius:999px;background:rgba(11,8,27,0.9);border:1.5px solid ${zone.color};color:#ffffff;font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.5);">🛡️ ${zone.name}</div>`,
            iconSize: [0, 0],
          });
          const labelMarker = L.marker([center.lat, center.lng], {
            icon: labelIcon,
            interactive: true,
          }).addTo(group);

          labelMarker.bindPopup(popupHtml);
          labelMarker.on('popupopen', () => {
            const btn = document.getElementById(deleteBtnId);
            if (btn) {
              btn.onclick = () => {
                persistCustomGeofences(customGeofences.filter((z) => z.id !== zone.id));
                toast.info(`Deleted geofence zone "${zone.name}"`);
              };
            }
          });
        }
      });
    }

    // 2. Render active draft shape while drawing
    if (geofenceDraft.active) {
      if (geofenceDraft.shape === 'polygon' && geofenceDraft.points.length > 0) {
        const latlngs = geofenceDraft.points.map((p) => [p.lat, p.lng] as [number, number]);
        if (latlngs.length >= 3) {
          L.polygon(latlngs, {
            color: geofenceDraft.color,
            weight: 3,
            dashArray: '6, 6',
            fillColor: geofenceDraft.color,
            fillOpacity: 0.28,
          }).addTo(group);
        } else if (latlngs.length === 2) {
          L.polyline(latlngs, {
            color: geofenceDraft.color,
            weight: 3,
            dashArray: '6, 6',
          }).addTo(group);
        }

        geofenceDraft.points.forEach((pt, idx) => {
          const vertexIcon = L.divIcon({
            className: 'geofence-draft-vertex',
            html: `<div style="width:18px;height:18px;border-radius:999px;background:${geofenceDraft.color};border:2.5px solid #0B081B;color:#0B081B;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.6);">${idx + 1}</div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });
          L.marker([pt.lat, pt.lng], { icon: vertexIcon, interactive: false }).addTo(group);
        });
      } else if (geofenceDraft.shape === 'circle' && geofenceDraft.center) {
        L.circle([geofenceDraft.center.lat, geofenceDraft.center.lng], {
          radius: geofenceDraft.radiusMeters,
          color: geofenceDraft.color,
          weight: 3,
          dashArray: '6, 6',
          fillColor: geofenceDraft.color,
          fillOpacity: 0.25,
        }).addTo(group);
      }
    }
  }, [
    customGeofences,
    geofenceDraft,
    czMapReadyTick,
    lodState.showCustomGeofenceShapes,
    lodState.showCustomGeofenceLabels,
  ]);

  // Monitor Real-Time Friend Locations Against Custom Geofences & Dispatch Push Notifications on Enter/Leave
  useEffect(() => {
    if (customGeofences.length === 0) return;

    userLocations.forEach((friend) => {
      if (!friend || friend.userId === user?.id) return;
      if (!Number.isFinite(friend.latitude) || !Number.isFinite(friend.longitude)) return;
      if (friend.latitude === 0 && friend.longitude === 0) return;

      customGeofences.forEach((zone) => {
        if (!zone.enabled) return;
        if (
          zone.watchedUserIds.length > 0 &&
          !zone.watchedUserIds.includes(friend.userId)
        ) {
          return;
        }

        const key = `${zone.id}::${friend.userId}`;
        const isNowInside = isLocationInsideGeofence(
          friend.latitude,
          friend.longitude,
          zone
        );
        const wasInside = friendZonePresenceRef.current.get(key);

        // Initialize baseline on first observation without false-positive firing,
        // then fire push notifications on every subsequent enter or leave transition
        if (wasInside === undefined) {
          friendZonePresenceRef.current.set(key, isNowInside);
          return;
        }

        if (!wasInside && isNowInside) {
          friendZonePresenceRef.current.set(key, true);
          if (zone.notifyOnEnter) {
            recordGeofencePushEvent(
              zone,
              friend.userId,
              friend.fullName || friend.username || 'Friend',
              'entered',
              friend.latitude,
              friend.longitude
            );
          }
        } else if (wasInside && !isNowInside) {
          friendZonePresenceRef.current.set(key, false);
          if (zone.notifyOnExit) {
            recordGeofencePushEvent(
              zone,
              friend.userId,
              friend.fullName || friend.username || 'Friend',
              'left',
              friend.latitude,
              friend.longitude
            );
          }
        }
      });
    });
  }, [userLocations, customGeofences, user?.id]);

  // Render active emergency SOS alerts with coordinates and accuracy circles on the map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    emergencyAlertLayersRef.current.forEach((layer) => layer.remove());
    emergencyAlertLayersRef.current = [];

    activeAlerts.forEach((alert) => {
      if (
        alert.status !== 'active' ||
        !Number.isFinite(alert.latitude) ||
        !Number.isFinite(alert.longitude) ||
        (alert.latitude === 0 && alert.longitude === 0)
      ) {
        return;
      }

      if (Number.isFinite(alert.accuracy) && alert.accuracy > 0) {
        const circle = L.circle([alert.latitude, alert.longitude], {
          radius: alert.accuracy,
          color: '#e11d48',
          weight: 2,
          fillColor: '#f43f5e',
          fillOpacity: 0.2,
        }).addTo(map);
        emergencyAlertLayersRef.current.push(circle);
      }

      const sosPin = L.divIcon({
        className: 'live-map-sos-pin',
        html: `
          <div style="position:relative;width:46px;height:46px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;inset:0;border-radius:9999px;background:rgba(225,29,72,0.5);animation:ping 1.3s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:relative;width:34px;height:34px;border-radius:9999px;background:#e11d48;border:3px solid #ffffff;box-shadow:0 4px 16px rgba(225,29,72,0.75);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:900;font-size:10px;">
              SOS
            </div>
          </div>
        `,
        iconSize: [46, 46],
        iconAnchor: [23, 23],
      });

      const marker = L.marker([alert.latitude, alert.longitude], {
        icon: sosPin,
        zIndexOffset: 2500,
      }).addTo(map);

      const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${alert.latitude},${alert.longitude}&travelmode=driving`;

      marker.bindPopup(`
        <div style="font-family:system-ui,sans-serif;min-width:195px;">
          <div style="font-weight:900;color:#be123c;font-size:12px;">EMERGENCY SOS: ${alert.senderName}</div>
          <div style="font-size:11px;color:#1e293b;margin-top:3px;font-weight:600;">"${alert.message}"</div>
          <div style="margin-top:6px;padding:6px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;">
            <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;">Coordinates (Lat, Lng)</div>
            <div style="font-family:monospace;font-size:11px;color:#0f172a;font-weight:800;margin-top:1px;">
              ${alert.latitude.toFixed(6)}, ${alert.longitude.toFixed(6)}
            </div>
            <div style="font-size:10px;color:#475569;margin-top:2px;">
              Accuracy ±${Math.round(alert.accuracy)} m
            </div>
          </div>
          <a href="${navUrl}" target="_blank" rel="noopener noreferrer" style="margin-top:8px;display:block;text-align:center;padding:6px 10px;border-radius:8px;background:#059669;color:#ffffff;font-weight:800;font-size:11px;text-decoration:none;">
            Get Directions
          </a>
        </div>
      `);

      emergencyAlertLayersRef.current.push(marker);
    });
  }, [activeAlerts]);

  // Multi-user Breadcrumb Trail Palette & Layer Groups
  interface TrailLayerGroup {
    glow: L.Polyline;
    main: L.Polyline;
    startMarker?: L.Marker;
    breadcrumbs: L.CircleMarker[];
  }

  const trailLayersRef = useRef<Map<string, TrailLayerGroup>>(new Map());

  const toast = useToast();
  type MapLayerMode = 'terrain' | 'satellite' | 'standard' | 'traffic';
  type HdrPresetMode = 'ultra' | 'vivid' | 'cyber';
  const [mapMode, setMapMode] = useState<MapLayerMode>('satellite');
  const [tileFallbackNotice, setTileFallbackNotice] = useState<string | null>(null);
  const [isHdrEnabled, setIsHdrEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('beacon_map_hdr');
    return saved !== '0';
  });
  const isHdrEnabledRef = useRef<boolean>(isHdrEnabled);
  isHdrEnabledRef.current = isHdrEnabled;
  const [hdrPreset, setHdrPreset] = useState<HdrPresetMode>(() => {
    const saved = localStorage.getItem('beacon_map_hdr_preset');
    if (saved && ['ultra', 'vivid', 'cyber'].includes(saved)) {
      return saved as HdrPresetMode;
    }
    return 'ultra';
  });
  const [is3dMode, setIs3dMode] = useState<boolean>(() => {
    return localStorage.getItem('beacon_map_3d') === '1';
  });
  const is3dModeRef = useRef<boolean>(is3dMode);
  is3dModeRef.current = is3dMode;
  const [selectedUser, setSelectedUser] = useState<UserLocation | null>(null);
  const [hasCenteredOnce, setHasCenteredOnce] = useState(false);
  const hasCenteredOnRealGpsRef = useRef(false);
  const bestCenteredAccuracyRef = useRef<number>(Infinity);
  const pendingCenterOnNextFixRef = useRef(false);

  // Persistent Auto-Follow Mode State & Movement Threshold (Meters)
  const [isAutoFollowEnabled, setIsAutoFollowEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('beacon_map_auto_follow');
    return saved !== '0';
  });
  const isAutoFollowEnabledRef = useRef<boolean>(isAutoFollowEnabled);
  isAutoFollowEnabledRef.current = isAutoFollowEnabled;

  const [autoFollowThresholdMeters, setAutoFollowThresholdMeters] = useState<number>(() => {
    const saved = Number(localStorage.getItem('beacon_map_auto_follow_threshold_m'));
    if (Number.isFinite(saved) && [5, 10, 25, 50].includes(saved)) {
      return saved;
    }
    return 10;
  });
  const autoFollowThresholdMetersRef = useRef<number>(autoFollowThresholdMeters);
  autoFollowThresholdMetersRef.current = autoFollowThresholdMeters;
  const lastAutoFollowedCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // Multi-user Breadcrumb Trail State
  const [activeTrails, setActiveTrails] = useState<Record<string, UserPathTrail>>({});
  const [loadingTrailUserIds, setLoadingTrailUserIds] = useState<string[]>([]);
  const [trailWindowHours, setTrailWindowHours] = useState<number>(1);
  const [showTrailsControl, setShowTrailsControl] = useState<boolean>(false);
  const [showMapControlsPop, setShowMapControlsPop] = useState<boolean>(false);

  // Google Maps Places Explorer Separate Page & Navigation Overlay State
  const [showPlacesPage, setShowPlacesPage] = useState<boolean>(false);
  const [activeRouteData, setActiveRouteData] = useState<RouteData | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeGlowPolylineRef = useRef<L.Polyline | null>(null);

  // Google Maps Blue Dot Info Modal State
  const [showBlueDotModal, setShowBlueDotModal] = useState<boolean>(false);

  // Custom Family Marker Picker Modal State
  const [customizingMember, setCustomizingMember] = useState<{
    userId: string;
    fullName: string;
    currentColor: string;
    currentIcon: string;
    currentNickname: string;
  } | null>(null);
  const [memberOverridesVersion, setMemberOverridesVersion] = useState<number>(0);

  // Marker Long-Press & Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    target: MarkerContextMenuTarget;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    target: {
      type: 'coord',
      title: '',
      lat: 0,
      lng: 0,
    },
  });

  // Active Navigation Route & Turn-by-Turn HUD State
  const [activeNavigation, setActiveNavigation] = useState<{
    targetName: string;
    lat: number;
    lng: number;
    distanceMeters: number;
    walkMin: number;
    driveMin: number;
  } | null>(null);

  const navPolylineRef = useRef<L.Polyline | null>(null);
  const navGlowPolylineRef = useRef<L.Polyline | null>(null);
  const navTargetMarkerRef = useRef<L.CircleMarker | null>(null);

  const closeContextMenu = () => {
    setContextMenu((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
  };

  const openContextMenu = (clientX: number, clientY: number, target: MarkerContextMenuTarget) => {
    setShowSearchDropdown(false);
    const menuWidth = 280;
    const menuHeight = 350;
    const padding = 16;

    let x = clientX;
    let y = clientY;

    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }
    if (x < padding) {
      x = padding;
    }

    const bottomMargin = 85;
    if (y + menuHeight > window.innerHeight - bottomMargin) {
      y = Math.max(padding + 50, y - menuHeight - 12);
    }
    if (y < padding + 50) {
      y = padding + 50;
    }

    setContextMenu({
      isOpen: true,
      x,
      y,
      target,
    });
  };

  // Attach touch long-press (450ms) & contextmenu listeners to Leaflet marker
  const attachMarkerLongPress = (marker: L.Marker, target: MarkerContextMenuTarget) => {
    marker.off('contextmenu');
    marker.on('contextmenu', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      if (e.originalEvent) {
        e.originalEvent.preventDefault();
        openContextMenu(e.originalEvent.clientX, e.originalEvent.clientY, target);
      }
    });

    const el = marker.getElement();
    if (!el) return;

    if ((el as any)._cleanupMarkerLongPress) {
      (el as any)._cleanupMarkerLongPress();
    }

    let timer: any = null;
    let startX = 0;
    let startY = 0;
    let hasMoved = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      hasMoved = false;

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!hasMoved) {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
              navigator.vibrate(50);
            } catch (_) {}
          }
          openContextMenu(startX, startY, target);
        }
        timer = null;
      }, 450);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!timer) return;
      const touch = e.touches[0];
      const dist = Math.hypot(touch.clientX - startX, touch.clientY - startY);
      if (dist > 8) {
        hasMoved = true;
        clearTimeout(timer);
        timer = null;
      }
    };

    const onTouchEnd = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    (el as any)._cleanupMarkerLongPress = () => {
      if (timer) clearTimeout(timer);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  };

  const copyCoordinates = async (lat: number, lng: number) => {
    closeContextMenu();
    const coordStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(coordStr);
        toast.success(`Copied coordinates (${coordStr})`);
        return;
      }
    } catch (_) {}

    try {
      const el = document.createElement('textarea');
      el.value = coordStr;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      toast.success(`Copied coordinates (${coordStr})`);
    } catch (_) {
      toast.info(`Coordinates: ${coordStr}`);
    }
  };

  const handleShareLocation = async (target: MarkerContextMenuTarget) => {
    closeContextMenu();
    const shareUrl = `https://www.google.com/maps/search/?api=1&query=${target.lat},${target.lng}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: target.title,
          text: `Location of ${target.title}: ${target.lat.toFixed(5)}, ${target.lng.toFixed(5)}`,
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Share error:', err);
        }
      }
    }
    copyCoordinates(target.lat, target.lng);
  };

  const startNavigation = (lat: number, lng: number, label?: string) => {
    closeContextMenu();
    const targetName = label || 'Destination';

    if (onNavigateTo) {
      onNavigateTo(lat, lng, targetName);
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    if (!myLocation) {
      toast.info(`Navigation target: ${targetName} (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
      return;
    }

    const distMeters = calculateDistanceMeters(
      myLocation.latitude,
      myLocation.longitude,
      lat,
      lng
    );

    const walkMin = Math.max(1, Math.round(distMeters / 80));
    const driveMin = Math.max(1, Math.round(distMeters / 400));

    setActiveNavigation({
      targetName,
      lat,
      lng,
      distanceMeters: distMeters,
      walkMin,
      driveMin,
    });

    if (navPolylineRef.current) map.removeLayer(navPolylineRef.current);
    if (navGlowPolylineRef.current) map.removeLayer(navGlowPolylineRef.current);
    if (navTargetMarkerRef.current) map.removeLayer(navTargetMarkerRef.current);

    const startPoint: [number, number] = [myLocation.latitude, myLocation.longitude];
    const endPoint: [number, number] = [lat, lng];

    const glow = L.polyline([startPoint, endPoint], {
      color: '#06b6d4',
      weight: 8,
      opacity: 0.35,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    const main = L.polyline([startPoint, endPoint], {
      color: '#0284c7',
      weight: 3.5,
      opacity: 0.95,
      dashArray: '8, 8',
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    const targetMarker = L.circleMarker(endPoint, {
      radius: 9,
      color: '#0284c7',
      fillColor: '#38bdf8',
      fillOpacity: 0.85,
      weight: 2.5,
    }).addTo(map);

    navPolylineRef.current = main;
    navGlowPolylineRef.current = glow;
    navTargetMarkerRef.current = targetMarker;

    const bounds = L.latLngBounds([startPoint, endPoint]);
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 17 });
    toast.success(`Navigating to ${targetName} (${formatDistance(distMeters)})`);
  };

  const cancelNavigation = () => {
    const map = mapInstanceRef.current;
    if (map) {
      if (navPolylineRef.current) map.removeLayer(navPolylineRef.current);
      if (navGlowPolylineRef.current) map.removeLayer(navGlowPolylineRef.current);
      if (navTargetMarkerRef.current) map.removeLayer(navTargetMarkerRef.current);
    }
    navPolylineRef.current = null;
    navGlowPolylineRef.current = null;
    navTargetMarkerRef.current = null;
    setActiveNavigation(null);
    toast.info('Navigation route stopped');
  };

  // Sync active navigation path whenever myLocation updates
  useEffect(() => {
    if (!activeNavigation || !myLocation || !mapInstanceRef.current) return;
    const startPoint: [number, number] = [myLocation.latitude, myLocation.longitude];
    const endPoint: [number, number] = [activeNavigation.lat, activeNavigation.lng];

    if (navPolylineRef.current) {
      navPolylineRef.current.setLatLngs([startPoint, endPoint]);
    }
    if (navGlowPolylineRef.current) {
      navGlowPolylineRef.current.setLatLngs([startPoint, endPoint]);
    }

    const distMeters = calculateDistanceMeters(
      myLocation.latitude,
      myLocation.longitude,
      activeNavigation.lat,
      activeNavigation.lng
    );

    setActiveNavigation((prev) =>
      prev
        ? {
            ...prev,
            distanceMeters: distMeters,
            walkMin: Math.max(1, Math.round(distMeters / 80)),
            driveMin: Math.max(1, Math.round(distMeters / 400)),
          }
        : null
    );
  }, [myLocation]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchDebounceRef = useRef<any>(null);

  // Pinch-to-zoom & Two-finger Rotate Gesture State
  const gestureAreaRef = useRef<HTMLDivElement>(null);
  const rotatableWrapperRef = useRef<HTMLDivElement>(null);
  const [bearing, setBearing] = useState<number>(0);
  const bearingRef = useRef<number>(0);
  const [isGesturing, setIsGesturing] = useState<boolean>(false);
  const [showRotationDial, setShowRotationDial] = useState<boolean>(false);
  const [isRecenteringGps, setIsRecenteringGps] = useState<boolean>(false);

  // User Direction Cursor & Device Compass Heading State
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const userHeadingRef = useRef<number | null>(null);
  const [isHeadingUpMode, setIsHeadingUpMode] = useState<boolean>(false);
  const isHeadingUpModeRef = useRef<boolean>(false);
  isHeadingUpModeRef.current = isHeadingUpMode;

  // Real-time device orientation & compass sensor listener (zero React re-renders — updates DOM cone directly via rAF)
  useEffect(() => {
    if (!isActive) return;

    let lastTime = 0;
    let rafId: number | null = null;
    const handleOrientation = (e: any) => {
      const now = performance.now();
      const minOrientationIntervalMs = isLiteModeRef.current ? 1500 : 220;
      if (now - lastTime < minOrientationIntervalMs) return;

      let rawHeading: number | null = null;
      if (e.webkitCompassHeading !== undefined) {
        rawHeading = e.webkitCompassHeading;
      } else if (e.alpha !== null && e.alpha !== undefined) {
        rawHeading = (360 - e.alpha) % 360;
      }

      if (rawHeading !== null && !isNaN(rawHeading)) {
        const heading = Math.round(rawHeading);
        const minDegreeDelta = isLiteModeRef.current ? 15 : 5;
        if (userHeadingRef.current === null || Math.abs(userHeadingRef.current - heading) >= minDegreeDelta) {
          lastTime = now;
          userHeadingRef.current = heading;

          if (rafId !== null) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            rafId = null;
            const el = myMarkerRef.current?.getElement();
            if (el) {
              const visualAngle = ((heading - bearingRef.current) % 360 + 360) % 360;
              const cone = el.querySelector('.beacon-self-heading-cone') as HTMLElement | null;
              if (cone) {
                cone.style.transform = `rotate(${visualAngle}deg)`;
              }
              const headingText = el.querySelector('.beacon-self-heading-text') as HTMLElement | null;
              if (headingText) {
                headingText.textContent = `· ${heading}°`;
              }
            }

            if (isHeadingUpModeRef.current && Math.abs(bearingRef.current - heading) >= 8) {
              bearingRef.current = heading;
              setBearing(heading);
            }
          });
        }
      }
    };

    window.addEventListener('deviceorientationabsolute', handleOrientation, { passive: true });
    window.addEventListener('deviceorientation', handleOrientation, { passive: true });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [isActive]);

  const getCompassHeading = (deg: number): string => {
    const normalized = ((deg % 360) + 360) % 360;
    if (normalized >= 337.5 || normalized < 22.5) return 'N';
    if (normalized >= 22.5 && normalized < 67.5) return 'NE';
    if (normalized >= 67.5 && normalized < 112.5) return 'E';
    if (normalized >= 112.5 && normalized < 157.5) return 'SE';
    if (normalized >= 157.5 && normalized < 202.5) return 'S';
    if (normalized >= 202.5 && normalized < 247.5) return 'SW';
    if (normalized >= 247.5 && normalized < 292.5) return 'W';
    return 'NW';
  };

  const setMapBearing = (targetDeg: number, announce = false) => {
    let next = Math.round(targetDeg) % 360;
    if (next < 0) next += 360;
    if (isHeadingUpModeRef.current) {
      setIsHeadingUpMode(false);
    }
    bearingRef.current = next;
    setBearing(next);
    if (announce) {
      toast.info(
        next === 0
          ? 'Map oriented North-up (0°)'
          : `Rotated map to ${next}° ${getCompassHeading(next)}`
      );
    }
  };

  const rotateMapBy = (deltaDeg: number) => {
    let next = (bearingRef.current + deltaDeg) % 360;
    if (next < 0) next += 360;
    next = Math.round(next);
    if (isHeadingUpModeRef.current) {
      setIsHeadingUpMode(false);
    }
    bearingRef.current = next;
    setBearing(next);
    toast.info(`Rotated map to ${next}° ${getCompassHeading(next)}`);
  };

  const resetNorth = () => {
    setIsHeadingUpMode(false);
    bearingRef.current = 0;
    setBearing(0);
    toast.info('Map oriented North-up (0°)');
  };

  // Two-Finger Touch Twist Rotation & Desktop Shift/Alt + Drag Map Rotation
  useEffect(() => {
    const el = gestureAreaRef.current;
    if (!el) return;

    let initialTouchAngle: number | null = null;
    let initialTouchBearing = 0;
    let isTouchRotating = false;

    let isMouseRotating = false;
    let mouseStartX = 0;
    let initialMouseBearing = 0;

    const getTouchAngle = (t1: Touch, t2: Touch) =>
      (Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180) / Math.PI;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialTouchAngle = getTouchAngle(e.touches[0], e.touches[1]);
        initialTouchBearing = bearingRef.current;
        isTouchRotating = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialTouchAngle !== null) {
        const currentAngle = getTouchAngle(e.touches[0], e.touches[1]);
        let delta = currentAngle - initialTouchAngle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;

        if (!isTouchRotating && Math.abs(delta) > 4) {
          isTouchRotating = true;
          setIsGesturing(true);
          if (isHeadingUpModeRef.current) {
            setIsHeadingUpMode(false);
          }
        }

        if (isTouchRotating) {
          let next = Math.round(initialTouchBearing + delta) % 360;
          if (next < 0) next += 360;
          bearingRef.current = next;
          setBearing(next);
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialTouchAngle = null;
        if (isTouchRotating) {
          isTouchRotating = false;
          setIsGesturing(false);
        }
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.shiftKey || e.altKey) {
        isMouseRotating = true;
        mouseStartX = e.clientX;
        initialMouseBearing = bearingRef.current;
        setIsGesturing(true);
        if (mapInstanceRef.current?.dragging) {
          mapInstanceRef.current.dragging.disable();
        }
        e.preventDefault();
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseRotating) return;
      const dx = e.clientX - mouseStartX;
      let next = Math.round(initialMouseBearing + dx * 0.65) % 360;
      if (next < 0) next += 360;
      bearingRef.current = next;
      setBearing(next);
    };

    const onMouseUp = () => {
      if (!isMouseRotating) return;
      isMouseRotating = false;
      setIsGesturing(false);
      if (mapInstanceRef.current?.dragging) {
        mapInstanceRef.current.dragging.enable();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const toggleHeadingUpMode = () => {
    if (!isHeadingUpMode) {
      const currentH =
        myLocation?.heading != null && !isNaN(myLocation.heading)
          ? myLocation.heading
          : (userHeadingRef.current ?? 0);
      setIsHeadingUpMode(true);
      const rounded = Math.round(currentH);
      bearingRef.current = rounded;
      setBearing(rounded);
      toast.success(`Heading-Up Follow Mode enabled (${rounded}° ${getCompassHeading(rounded)})`);
    } else {
      setIsHeadingUpMode(false);
      resetNorth();
    }
  };

  const toggleAutoFollowMode = () => {
    const next = !isAutoFollowEnabled;
    setIsAutoFollowEnabled(next);
    isAutoFollowEnabledRef.current = next;
    localStorage.setItem('beacon_map_auto_follow', next ? '1' : '0');

    if (next) {
      if (myLocation && Number.isFinite(myLocation.latitude) && Number.isFinite(myLocation.longitude) && mapInstanceRef.current) {
        lastAutoFollowedCoordsRef.current = {
          lat: myLocation.latitude,
          lng: myLocation.longitude,
        };
        const targetZoom = Math.max(mapInstanceRef.current.getZoom(), 17);
        if (isLiteModeRef.current) {
          mapInstanceRef.current.setView([myLocation.latitude, myLocation.longitude], targetZoom, { animate: false });
        } else {
          mapInstanceRef.current.flyTo([myLocation.latitude, myLocation.longitude], targetZoom, {
            animate: true,
            duration: 0.65,
          });
        }
      }
      toast.success(`Auto-Follow enabled (re-centers after ≥${autoFollowThresholdMeters}m movement)`);
    } else {
      toast.info('Auto-Follow paused (free map pan)');
    }
  };

  const updateAutoFollowThreshold = (meters: number) => {
    setAutoFollowThresholdMeters(meters);
    autoFollowThresholdMetersRef.current = meters;
    localStorage.setItem('beacon_map_auto_follow_threshold_m', String(meters));
    if (!isAutoFollowEnabled) {
      setIsAutoFollowEnabled(true);
      isAutoFollowEnabledRef.current = true;
      localStorage.setItem('beacon_map_auto_follow', '1');
    }
    toast.info(`Auto-Follow movement threshold set to ${meters}m`);
  };

  const zoomIn = () => {
    if (mapInstanceRef.current) {
      const nextZ = Math.min(22, Math.round(mapInstanceRef.current.getZoom()) + 1);
      setCurrentZoom(nextZ);
      mapInstanceRef.current.setZoom(nextZ, { animate: !isLiteModeRef.current });
    }
  };

  const zoomOut = () => {
    if (mapInstanceRef.current) {
      const nextZ = Math.max(2, Math.round(mapInstanceRef.current.getZoom()) - 1);
      setCurrentZoom(nextZ);
      mapInstanceRef.current.setZoom(nextZ, { animate: !isLiteModeRef.current });
    }
  };

  const resetOptimalZoom = () => {
    if (mapInstanceRef.current) {
      const targetZ = 17;
      setCurrentZoom(targetZ);
      mapInstanceRef.current.setZoom(targetZ, { animate: !isLiteModeRef.current });
      toast.info('Reset to optimal 17x HD street zoom');
    }
  };

  const TRAIL_PALETTES = [
    { main: '#0284c7', glow: '#38bdf8', bg: 'bg-sky-500', border: 'border-sky-500', text: 'text-sky-500', name: 'Sky Blue' },
    { main: '#059669', glow: '#34d399', bg: 'bg-emerald-500', border: 'border-emerald-500', name: 'Emerald' },
    { main: '#d97706', glow: '#fbbf24', bg: 'bg-amber-500', border: 'border-amber-500', name: 'Amber' },
    { main: '#7c3aed', glow: '#a78bfa', bg: 'bg-purple-500', border: 'border-purple-500', name: 'Purple' },
    { main: '#e11d48', glow: '#fb7185', bg: 'bg-rose-500', border: 'border-rose-500', name: 'Rose' },
    { main: '#0891b2', glow: '#22d3ee', bg: 'bg-cyan-500', border: 'border-cyan-500', name: 'Cyan' },
    { main: '#4f46e5', glow: '#818cf8', bg: 'bg-indigo-500', border: 'border-indigo-500', name: 'Indigo' },
  ];

  const getPaletteForUser = (userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash |= 0;
    }
    return TRAIL_PALETTES[Math.abs(hash) % TRAIL_PALETTES.length];
  };

  const removeUserTrailFromMap = (targetUserId: string) => {
    const map = mapInstanceRef.current;
    const existing = trailLayersRef.current.get(targetUserId);
    if (existing && map) {
      map.removeLayer(existing.glow);
      map.removeLayer(existing.main);
      if (existing.startMarker) map.removeLayer(existing.startMarker);
      existing.breadcrumbs.forEach((b) => map.removeLayer(b));
      trailLayersRef.current.delete(targetUserId);
    }
  };

  const clearAllTrails = () => {
    const map = mapInstanceRef.current;
    if (map) {
      trailLayersRef.current.forEach((layers) => {
        map.removeLayer(layers.glow);
        map.removeLayer(layers.main);
        if (layers.startMarker) map.removeLayer(layers.startMarker);
        layers.breadcrumbs.forEach((b) => map.removeLayer(b));
      });
      trailLayersRef.current.clear();
    }
    setActiveTrails({});
    toast.info('Cleared all breadcrumb trails');
  };

  const loadUserTrail = async (targetUserId: string, windowHours = trailWindowHours, autoZoom = true): Promise<boolean> => {
    try {
      setLoadingTrailUserIds((prev) => (prev.includes(targetUserId) ? prev : [...prev, targetUserId]));
      const res = await api.get<{ trail: UserPathTrail }>(
        `/api/locations/trail/${targetUserId}?windowHours=${windowHours}`
      );
      const trail = res.trail;

      const map = mapInstanceRef.current;
      if (!map || trail.points.length === 0) {
        toast.info(`No recorded path for ${trail.fullName || 'user'} in this time window`);
        return false;
      }

      // Remove previous layer for this specific user if any
      removeUserTrailFromMap(targetUserId);

      const palette = getPaletteForUser(targetUserId);
      const latLngs = trail.points.map((p) => L.latLng(p.latitude, p.longitude));

      // 1. Outer Glow Polyline
      const glowLine = L.polyline(latLngs, {
        color: palette.glow,
        weight: 9,
        opacity: 0.45,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      // 2. Main Vibrant Path Polyline
      const mainLine = L.polyline(latLngs, {
        color: palette.main,
        weight: 4,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: '6, 8',
      }).addTo(map);

      // 3. Interactive Breadcrumb Checkpoint Markers along the route
      const newMarkers: L.CircleMarker[] = [];
      trail.points.forEach((pt, idx) => {
        const isStart = idx === 0;
        const isLatest = idx === trail.points.length - 1;
        if (isLatest) return; // Latest is already covered by the user's avatar marker

        const circle = L.circleMarker([pt.latitude, pt.longitude], {
          radius: isStart ? 6 : 4,
          color: isStart ? '#059669' : palette.main,
          fillColor: '#ffffff',
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);

        const timeStr = new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const speedStr = pt.speed ? `${pt.speed} m/s · ` : '';
        const accStr = formatAccuracy(pt.accuracy);

        circle.bindTooltip(
          `<div class="font-sans text-xs">
            <span class="font-bold text-slate-900">${trail.fullName}</span><br/>
            <span class="font-semibold text-slate-700">${isStart ? 'Route Start · ' : ''}${timeStr}</span><br/>
            <span class="text-slate-500">${speedStr}Acc ${accStr}</span>
          </div>`,
          { direction: 'top', offset: [0, -4] }
        );

        newMarkers.push(circle);
      });

      // 4. Start Point Badge Marker
      let startMarker: L.Marker | undefined;
      if (trail.points.length > 1) {
        const startPoint = trail.points[0];
        const firstName = trail.fullName.split(' ')[0];
        const startIcon = L.divIcon({
          className: 'beacon-start-marker',
          html: `
            <div class="px-2 py-0.5 ${palette.bg} text-white text-[10px] font-bold rounded-full shadow-md whitespace-nowrap flex items-center gap-1 border border-white">
              <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              ${firstName} Start (${new Date(startPoint.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
            </div>
          `,
          iconSize: [95, 24],
          iconAnchor: [47, 24],
        });
        startMarker = L.marker([startPoint.latitude, startPoint.longitude], { icon: startIcon }).addTo(map);
      }

      trailLayersRef.current.set(targetUserId, {
        glow: glowLine,
        main: mainLine,
        startMarker,
        breadcrumbs: newMarkers,
      });

      setActiveTrails((prev) => ({ ...prev, [targetUserId]: trail }));

      if (autoZoom) {
        map.fitBounds(mainLine.getBounds(), { padding: [70, 70], maxZoom: 17 });
      }

      toast.success(`Showing ${trail.fullName}'s trail (${formatDistance(trail.totalDistanceMeters)})`);
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to load location trail');
      return false;
    } finally {
      setLoadingTrailUserIds((prev) => prev.filter((id) => id !== targetUserId));
    }
  };

  const toggleUserTrail = async (targetUserId: string) => {
    if (activeTrails[targetUserId]) {
      removeUserTrailFromMap(targetUserId);
      setActiveTrails((prev) => {
        const copy = { ...prev };
        delete copy[targetUserId];
        return copy;
      });
      toast.info('Breadcrumb trail hidden');
    } else {
      await loadUserTrail(targetUserId, trailWindowHours, true);
    }
  };

  const fitAllTrailsBounds = () => {
    const map = mapInstanceRef.current;
    if (!map || trailLayersRef.current.size === 0) return;
    const bounds = L.latLngBounds([]);
    trailLayersRef.current.forEach((layers) => {
      bounds.extend(layers.main.getBounds());
    });
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [70, 70], maxZoom: 17 });
    }
  };

  const fitUserTrailBounds = (userId: string) => {
    const map = mapInstanceRef.current;
    const layers = trailLayersRef.current.get(userId);
    if (map && layers) {
      map.fitBounds(layers.main.getBounds(), { padding: [70, 70], maxZoom: 17 });
    }
  };

  const reloadAllActiveTrails = async (newHours: number) => {
    setTrailWindowHours(newHours);
    const activeIds = Object.keys(activeTrails);
    if (activeIds.length === 0) return;
    for (const uid of activeIds) {
      await loadUserTrail(uid, newHours, false);
    }
    fitAllTrailsBounds();
  };

  // Fetch room details if in roomOnlyMode and activeRoomDetails doesn't have members loaded
  useEffect(() => {
    if (!roomOnlyMode) return;
    const targetRoomId = activeRoomDetails?.id || selectedRoomId;
    if (!targetRoomId) return;
    if (activeRoomDetails?.members && activeRoomDetails.members.length > 0) {
      setFetchedRoomDetails(activeRoomDetails);
      return;
    }
    api
      .get<{ room: Room }>(`/api/rooms/${targetRoomId}`)
      .then((res) => {
        if (res?.room) setFetchedRoomDetails(res.room);
      })
      .catch(() => {});
  }, [roomOnlyMode, activeRoomDetails, selectedRoomId]);

  // Active room and members list
  const effectiveRoom = activeRoomDetails || fetchedRoomDetails || rooms.find((r) => r.id === selectedRoomId) || null;
  const isUniversalActiveRoom = Boolean(
    effectiveRoom?.isUniversal || effectiveRoom?.id === 'room-universal'
  );

  // Set of user IDs belonging to the active room when roomOnlyMode is true
  const roomMemberIdsSet = React.useMemo(() => {
    if (!roomOnlyMode || !effectiveRoom || isUniversalActiveRoom) return null;
    const ids = new Set<string>();
    if (user?.id) ids.add(user.id);
    if (effectiveRoom.ownerId) ids.add(effectiveRoom.ownerId);
    effectiveRoom.members?.forEach((m) => ids.add(m.userId));
    return ids;
  }, [roomOnlyMode, effectiveRoom, isUniversalActiveRoom, user?.id]);

  const [friendsUpdateTick, setFriendsUpdateTick] = useState(0);

  useEffect(() => {
    const onFriendsChanged = () => {
      setFriendsUpdateTick((t) => t + 1);
      setSelectedUser((prev) => {
        if (prev && prev.userId !== user?.id && localBackend.isUserUnfriendedOrBlocked(user?.id, prev)) {
          return null;
        }
        return prev;
      });
    };
    window.addEventListener('beacon:friends-updated', onFriendsChanged);
    window.addEventListener('beacon:cloud-sync-updated', onFriendsChanged);
    return () => {
      window.removeEventListener('beacon:friends-updated', onFriendsChanged);
      window.removeEventListener('beacon:cloud-sync-updated', onFriendsChanged);
    };
  }, [user?.id]);

  // Filtered peer locations: excludes deleted/unfriended or blocked users, and respects roomOnlyMode
  const rawDisplayedUserLocations = React.useMemo(() => {
    const visiblePeers = userLocations.filter(
      (loc) => loc.userId === user?.id || !localBackend.isUserUnfriendedOrBlocked(user?.id, loc)
    );
    if (!roomOnlyMode || !roomMemberIdsSet) return visiblePeers;
    return visiblePeers.filter((loc) => roomMemberIdsSet.has(loc.userId));
  }, [roomOnlyMode, roomMemberIdsSet, userLocations, user?.id, friendsUpdateTick]);

  // In Low Power Mode, lower the map refresh rate to 0.2 Hz (every 5,000ms) for better battery longevity
  const [displayedUserLocations, setDisplayedUserLocations] = useState<UserLocation[]>(
    rawDisplayedUserLocations
  );
  const lastMapPeersRefreshRef = useRef<number>(0);

  useEffect(() => {
    if (!isLiteMode) {
      lastMapPeersRefreshRef.current = Date.now();
      setDisplayedUserLocations(rawDisplayedUserLocations);
      return;
    }

    const now = Date.now();
    const elapsed = now - lastMapPeersRefreshRef.current;
    const lowPowerMapRefreshIntervalMs = 5000;

    if (lastMapPeersRefreshRef.current === 0 || elapsed >= lowPowerMapRefreshIntervalMs) {
      lastMapPeersRefreshRef.current = now;
      setDisplayedUserLocations(rawDisplayedUserLocations);
      return;
    }

    const timer = setTimeout(() => {
      lastMapPeersRefreshRef.current = Date.now();
      setDisplayedUserLocations(rawDisplayedUserLocations);
    }, lowPowerMapRefreshIntervalMs - elapsed);

    return () => clearTimeout(timer);
  }, [rawDisplayedUserLocations, isLiteMode]);

  const roomUsersList = React.useMemo(() => {
    const list: Array<{
      id: string;
      fullName: string;
      username: string;
      avatarUrl: string;
      isOnline: boolean;
      isMe: boolean;
      location?: UserLocation | null;
      role?: string;
    }> = [];
    const seen = new Set<string>();

    // Current user (Self)
    if (user) {
      seen.add(user.id);
      list.push({
        id: user.id,
        fullName: `${user.fullName} (You)`,
        username: user.username,
        avatarUrl: user.avatarUrl,
        isOnline: true,
        isMe: true,
        location: myLocation,
        role: effectiveRoom?.members?.find((m) => m.userId === user.id)?.role || 'MEMBER',
      });
    }

    // If roomOnlyMode and effectiveRoom has explicit members, include all non-unfriended room members
    if (roomOnlyMode && effectiveRoom?.members) {
      effectiveRoom.members.forEach((mem) => {
        if (seen.has(mem.userId)) return;
        if (
          localBackend.isUserUnfriendedOrBlocked(user?.id, {
            userId: mem.userId,
            username: mem.user?.username,
            fullName: mem.user?.fullName,
          })
        ) {
          return;
        }
        seen.add(mem.userId);
        const peerLoc = displayedUserLocations.find((l) => l.userId === mem.userId) || null;
        list.push({
          id: mem.userId,
          fullName: mem.user?.fullName || peerLoc?.fullName || 'Room Member',
          username: mem.user?.username || peerLoc?.username || mem.userId.slice(0, 6),
          avatarUrl:
            mem.user?.avatarUrl ||
            peerLoc?.avatarUrl ||
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(mem.userId)}`,
          isOnline: onlineUserIds.includes(mem.userId),
          isMe: false,
          location: peerLoc,
          role: mem.role,
        });
      });
    }

    // Include any remaining visible peer locations
    displayedUserLocations.forEach((loc) => {
      if (seen.has(loc.userId)) return;
      seen.add(loc.userId);
      list.push({
        id: loc.userId,
        fullName: loc.fullName,
        username: loc.username,
        avatarUrl: loc.avatarUrl,
        isOnline: onlineUserIds.includes(loc.userId),
        isMe: false,
        location: loc,
      });
    });

    return list;
  }, [user, myLocation, roomOnlyMode, effectiveRoom, displayedUserLocations, onlineUserIds, friendsUpdateTick]);

  const fitAllRoomMembersOnMap = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const bounds = L.latLngBounds([]);
    if (myLocation) {
      bounds.extend([myLocation.latitude, myLocation.longitude]);
    }
    displayedUserLocations.forEach((loc) => {
      bounds.extend([loc.latitude, loc.longitude]);
    });
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 17 });
      toast.info(`Showing all active members in ${effectiveRoom?.name || 'room'}`);
    } else if (myLocation) {
      map.flyTo([myLocation.latitude, myLocation.longitude], 16);
    }
  };

  // Auto-fit room members on map when switching rooms in roomOnlyMode
  useEffect(() => {
    if (!roomOnlyMode || !isActive || focusCoords) return;
    const timer = setTimeout(() => {
      const map = mapInstanceRef.current;
      if (!map) return;
      map.invalidateSize();
      const bounds = L.latLngBounds([]);
      if (myLocation) {
        bounds.extend([myLocation.latitude, myLocation.longitude]);
      }
      displayedUserLocations.forEach((loc) => {
        bounds.extend([loc.latitude, loc.longitude]);
      });
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [70, 70], maxZoom: 16 });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [roomOnlyMode, effectiveRoom?.id, isActive]);

  const toggleAllRoomTrails = async () => {
    const allIds = roomUsersList.map((u) => u.id);
    const allActive = allIds.length > 0 && allIds.every((id) => !!activeTrails[id]);

    if (allActive) {
      clearAllTrails();
    } else {
      toast.info('Loading breadcrumb trails for room members...');
      for (const u of roomUsersList) {
        if (!activeTrails[u.id]) {
          await loadUserTrail(u.id, trailWindowHours, false);
        }
      }
      fitAllTrailsBounds();
    }
  };

  const GOOGLE_MAPS_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyAOVYRIgupAurZup5y1PRh8Ismb1A3lLao';
  const [isLiveTrafficUnavailable, setIsLiveTrafficUnavailable] = useState<boolean>(false);

  type TileProviderPreference = 'auto' | 'osm' | 'esri' | 'opentopo';
  const [providerPref, setProviderPref] = useState<TileProviderPreference>(() => {
    const saved = localStorage.getItem('beacon_tile_provider_pref');
    if (saved === 'osm' || saved === 'esri' || saved === 'opentopo' || saved === 'auto') {
      return saved;
    }
    return 'auto';
  });
  const mapModeRef = useRef<MapLayerMode>(mapMode);
  mapModeRef.current = mapMode;
  const providerPrefRef = useRef<TileProviderPreference>(providerPref);
  providerPrefRef.current = providerPref;
  const [isControlledTestMode, setIsControlledTestMode] = useState<boolean>(false);
  const isControlledTestModeRef = useRef<boolean>(false);
  isControlledTestModeRef.current = isControlledTestMode;
  const [openGeofenceManagerSignal, setOpenGeofenceManagerSignal] = useState<number>(0);
  const lastCenteredJumpRef = useRef<{ key: string; ts: number }>({ key: '', ts: 0 });

  interface TileDiagnosticStats {
    mode: MapLayerMode;
    providerName: string;
    templateUrl: string;
    sampleResolvedUrl: string;
    requestedCount: number;
    loadedCount: number;
    failedCount: number;
    fallbackRecoveredCount: number;
    domVisibleTiles: number;
    containerSize: string;
    lastHttpStatus: string;
    lastError: string | null;
    isOnline: boolean;
    platform: string;
    lastUpdatedTs: number;
  }

  interface ProviderProbeRow {
    mode: string;
    provider: string;
    url: string;
    httpStatus: string;
    bytes: number;
    latencyMs: number;
    result: 'PASS' | 'FAIL' | 'TESTING';
    note?: string;
  }

  const detectRuntimePlatform = (): string => {
    if (typeof window === 'undefined') return 'Server';
    const w = window as any;
    const ua = navigator.userAgent || '';
    const isCapAndroid =
      Boolean(w.Capacitor?.isNativePlatform?.() && w.Capacitor?.getPlatform?.() === 'android') ||
      /; wv\)/.test(ua) ||
      (ua.includes('Android') && window.location.hostname === 'localhost');
    if (isCapAndroid) return 'Android APK (Capacitor WebView)';
    if (/Android/i.test(ua)) return 'Android Mobile Web';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS Web';
    return 'Web Browser (Desktop/Mobile)';
  };

  const [showMapDiagnostics, setShowMapDiagnostics] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('mapdiag') === '1' || params.get('debug') === '1';
  });

  const [diagStats, setDiagStats] = useState<TileDiagnosticStats>(() => ({
    mode: 'satellite',
    providerName: 'Google Hybrid Satellite 2x HDR (lyrs=y)',
    templateUrl: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&scale=2&hl=en',
    sampleResolvedUrl: '',
    requestedCount: 0,
    loadedCount: 0,
    failedCount: 0,
    fallbackRecoveredCount: 0,
    domVisibleTiles: 0,
    containerSize: 'Measuring...',
    lastHttpStatus: 'Pending first tile...',
    lastError: null,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    platform: detectRuntimePlatform(),
    lastUpdatedTs: Date.now(),
  }));

  const [probeRows, setProbeRows] = useState<ProviderProbeRow[]>([]);
  const [isProbingProviders, setIsProbingProviders] = useState<boolean>(false);
  const layerSwitchGenRef = useRef<number>(0);
  const isSyncingControlRef = useRef<boolean>(false);
  const controlProxyLayersRef = useRef<Record<MapLayerMode, L.LayerGroup> | null>(null);

  interface TileRequestConsoleEntry {
    timestamp: string;
    mode: string;
    stage: string;
    providerName: string;
    providerEndpoint: string;
    tileUrl: string;
    coords?: { z?: number; x?: number; y?: number };
    httpStatus?: number;
  }

  const [tileConsoleLogs, setTileConsoleLogs] = useState<TileRequestConsoleEntry[]>([]);
  const [networkErrorAlerts, setNetworkErrorAlerts] = useState<NetworkHttpErrorEventDetail[]>([]);
  const inspectedTileUrlsRef = useRef<Set<string>>(new Set());
  const providerHttpErrorCountRef = useRef<number>(0);

  /**
   * Diagnostic utility function within the Map component that logs every tile request URL,
   * including the full tile provider endpoint and resolved tile URL, to the browser console.
   */
  const logTileRequestDiagnostic = (params: {
    tileUrl: string;
    providerEndpoint: string;
    providerName: string;
    mode?: string;
    stage?: string;
    coords?: { z?: number; x?: number; y?: number };
    httpStatus?: number;
  }) => {
    const {
      tileUrl,
      providerEndpoint,
      providerName,
      mode = mapModeRef.current,
      stage = 'tileloadstart',
      coords,
      httpStatus,
    } = params;

    if (!tileUrl || tileUrl.startsWith('data:')) return;

    let originEndpoint = providerEndpoint || tileUrl;
    try {
      const parsed = new URL(tileUrl);
      originEndpoint = `${parsed.origin}${parsed.pathname} (Template: ${providerEndpoint})`;
    } catch {
      // keep raw template
    }

    const coordLabel =
      coords && coords.z !== undefined && coords.x !== undefined && coords.y !== undefined
        ? `${coords.z}/${coords.x}/${coords.y}`
        : 'n/a';

    const entry: TileRequestConsoleEntry = {
      timestamp: new Date().toISOString(),
      mode,
      stage,
      providerName,
      providerEndpoint: originEndpoint,
      tileUrl,
      coords,
      httpStatus,
    };

    console.info(
      `[Beacon Map Tile Diagnostic] [${stage.toUpperCase()}] Mode=${mode} | Provider="${providerName}" | Coords=${coordLabel} | Provider Endpoint=${providerEndpoint} | Full Tile Request URL=${tileUrl}`,
      entry
    );

    if (typeof window !== 'undefined') {
      const w = window as any;
      if (!Array.isArray(w.__beaconMapTileRequestLogs)) {
        w.__beaconMapTileRequestLogs = [];
      }
      w.__beaconMapTileRequestLogs.push(entry);
      if (w.__beaconMapTileRequestLogs.length > 200) {
        w.__beaconMapTileRequestLogs.shift();
      }
      w.__beaconLogTileRequestDiagnostic = logTileRequestDiagnostic;
    }

    setTileConsoleLogs((prev) => [entry, ...prev.slice(0, 29)]);
  };

  /**
   * Probes a failed <img> tile URL asynchronously to determine the exact HTTP status code (403, 404, 429, etc.)
   * and emits it to the global network status error listener so a toast notification is shown.
   */
  const inspectFailedTileHttpStatus = async (
    failedTileUrl: string,
    providerName: string,
    providerEndpoint: string,
    coords?: { z?: number; x?: number; y?: number }
  ) => {
    if (!failedTileUrl || failedTileUrl.startsWith('data:')) return;
    if (inspectedTileUrlsRef.current.has(failedTileUrl)) return;
    inspectedTileUrlsRef.current.add(failedTileUrl);
    if (inspectedTileUrlsRef.current.size > 150) {
      inspectedTileUrlsRef.current.clear();
    }

    try {
      const resp = await fetch(failedTileUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        referrerPolicy: 'no-referrer-when-downgrade',
      });

      logTileRequestDiagnostic({
        tileUrl: failedTileUrl,
        providerEndpoint,
        providerName,
        mode: mapModeRef.current,
        stage: `tile-http-status-${resp.status}`,
        coords,
        httpStatus: resp.status,
      });

      if (resp.status === 403 || resp.status === 404 || resp.status === 429) {
        emitNetworkHttpStatusError(
          resp.status,
          failedTileUrl,
          resp.statusText,
          `Map Tile (${providerName})`
        );
        setDiagStats((prev) => ({
          ...prev,
          lastHttpStatus: `HTTP ${resp.status} ${resp.statusText || ''} (${providerName})`.trim(),
          lastError: `HTTP ${resp.status} on tile (${coords?.z ?? '?'}/${coords?.x ?? '?'}/${coords?.y ?? '?'}): ${failedTileUrl}`,
          lastUpdatedTs: Date.now(),
        }));

        // Automatic provider failover when repeated 403 or 429 errors occur on the primary provider
        if ((resp.status === 403 || resp.status === 429) && providerPrefRef.current === 'auto') {
          providerHttpErrorCountRef.current += 1;
          if (providerHttpErrorCountRef.current >= 2 && mapInstanceRef.current) {
            providerHttpErrorCountRef.current = 0;
            const fallbackPref: TileProviderPreference =
              mapModeRef.current === 'satellite' ? 'esri' : 'osm';
            setProviderPref(fallbackPref);
            providerPrefRef.current = fallbackPref;
            applyMapLayerToInstance(mapInstanceRef.current, mapModeRef.current, fallbackPref);
            toast.info(
              `Switched tile engine to verified ${
                fallbackPref === 'esri' ? 'Esri ArcGIS' : 'OpenStreetMap'
              } provider after HTTP ${resp.status}`
            );
          }
        }
      } else if (!resp.ok) {
        setDiagStats((prev) => ({
          ...prev,
          lastHttpStatus: `HTTP ${resp.status} ${resp.statusText || 'Error'}`,
          lastError: `HTTP ${resp.status} on tile: ${failedTileUrl}`,
          lastUpdatedTs: Date.now(),
        }));
      }
    } catch (err: any) {
      console.warn(
        `[Beacon Map Tile Diagnostic] Tile probe network/CORS failure for ${failedTileUrl} (Provider Endpoint: ${providerEndpoint}):`,
        err?.message || err
      );
    }
  };

  // Subscribe to global 403, 404, and 429 network status errors so Map Diagnostics HUD stays synced
  useEffect(() => {
    const unsubscribe = onNetworkHttpStatusError((detail) => {
      setNetworkErrorAlerts((prev) => [detail, ...prev.slice(0, 19)]);
      setDiagStats((prev) => ({
        ...prev,
        lastHttpStatus: `HTTP ${detail.status} ${detail.statusText} (${detail.providerHost})`,
        lastError: `${detail.reason} — ${detail.url}`,
        lastUpdatedTs: Date.now(),
      }));
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleForceRefreshTiles = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    inspectedTileUrlsRef.current.clear();
    providerHttpErrorCountRef.current = 0;
    map.stop();
    map.invalidateSize({ animate: false });
    if (isControlledTestModeRef.current) {
      applyControlledTestLayer(map);
    } else {
      applyMapLayerToInstance(map, mapModeRef.current, providerPrefRef.current);
    }
    toast.success('Map tile layer refreshed and re-anchored at current viewport');
  };

  const handleCopyDiagnosticReport = async () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      diagnostics: diagStats,
      providerProbes: probeRows,
      recentNetwork403_404_429Alerts: networkErrorAlerts.slice(0, 10),
      recentTileConsoleRequests: tileConsoleLogs.slice(0, 15),
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied full Map & Tile Diagnostic Report JSON to clipboard');
    } catch {
      console.info('[Beacon Diagnostic Export]', payload);
      toast.info('Logged full Map & Tile Diagnostic Report JSON to browser console');
    }
  };

  // Track browser online/offline state in real time for diagnostics
  useEffect(() => {
    const updateOnline = () => {
      setDiagStats((prev) => ({
        ...prev,
        isOnline: navigator.onLine,
        lastUpdatedTs: Date.now(),
      }));
    };
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  const latLngToTileXY = (lat: number, lng: number, z: number): { x: number; y: number; z: number } => {
    const clampedZ = Math.max(2, Math.min(19, Math.round(z)));
    const latRad = (lat * Math.PI) / 180;
    const n = Math.pow(2, clampedZ);
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
    return { x, y, z: clampedZ };
  };

  // Probe HTTP status of a specific tile URL at runtime using fetch + Image fallback
  const probeSingleTileUrl = async (
    modeLabel: string,
    providerLabel: string,
    url: string
  ): Promise<ProviderProbeRow> => {
    logTileRequestDiagnostic({
      tileUrl: url,
      providerEndpoint: url,
      providerName: providerLabel,
      mode: modeLabel,
      stage: 'diagnostic-probe',
    });
    const t0 = performance.now();
    try {
      const resp = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        referrerPolicy: 'no-referrer-when-downgrade',
      });
      if (resp.status === 403 || resp.status === 404 || resp.status === 429) {
        emitNetworkHttpStatusError(
          resp.status,
          url,
          resp.statusText,
          `Tile Probe (${providerLabel})`
        );
      }
      const latencyMs = Math.round(performance.now() - t0);
      const buf = await resp.arrayBuffer();
      const bytes = buf.byteLength;
      const ct = resp.headers.get('content-type') || 'image/*';
      const isValidTile = resp.status === 200 && bytes > 500 && bytes !== 2049 && bytes !== 103;
      return {
        mode: modeLabel,
        provider: providerLabel,
        url,
        httpStatus: `${resp.status} ${resp.statusText || 'OK'} (${ct})`,
        bytes,
        latencyMs,
        result: isValidTile ? 'PASS' : 'FAIL',
        note:
          bytes === 2049
            ? 'Blocked watermark placeholder tile (2049B)'
            : bytes === 103
            ? 'Blocked 1x1 blank tile (103B)'
            : !isValidTile
            ? `Invalid tile response (${bytes}B)`
            : `Verified ${bytes.toLocaleString()} bytes`,
      };
    } catch (fetchErr: any) {
      // If a tile server does not send CORS Access-Control-Allow-Origin headers for fetch(),
      // verify actual <img> decoding (which browsers/WebViews permit cross-origin without CORS headers)
      return await new Promise<ProviderProbeRow>((resolve) => {
        const img = new Image();
        img.referrerPolicy = 'no-referrer-when-downgrade';
        img.onload = () => {
          const latencyMs = Math.round(performance.now() - t0);
          const validDims = img.naturalWidth >= 256 && img.naturalHeight >= 256;
          resolve({
            mode: modeLabel,
            provider: providerLabel,
            url,
            httpStatus: validDims ? `200 OK (IMG ${img.naturalWidth}x${img.naturalHeight})` : `IMG ${img.naturalWidth}x${img.naturalHeight}`,
            bytes: validDims ? img.naturalWidth * img.naturalHeight : 0,
            latencyMs,
            result: validDims ? 'PASS' : 'FAIL',
            note: validDims ? `Loaded ${img.naturalWidth}x${img.naturalHeight} px tile` : 'Tiny/invalid image dimensions',
          });
        };
        img.onerror = () => {
          const latencyMs = Math.round(performance.now() - t0);
          resolve({
            mode: modeLabel,
            provider: providerLabel,
            url,
            httpStatus: `ERR (${fetchErr?.message || 'Tile load error'})`,
            bytes: 0,
            latencyMs,
            result: 'FAIL',
            note: 'Failed both fetch() and <img> load',
          });
        };
        img.src = url;
      });
    }
  };

  // Run independent live runtime verification across Street, Terrain, Satellite, and Traffic providers
  const runAllProvidersDiagnostic = async () => {
    setIsProbingProviders(true);
    try {
      const map = mapInstanceRef.current;
      const center = map ? map.getCenter() : { lat: 28.6139, lng: 77.209 };
      const zoom = map ? Math.min(16, Math.max(10, Math.round(map.getZoom()))) : 15;
      const { x, y, z } = latLngToTileXY(center.lat, center.lng, zoom);
      const terrainZ = Math.min(15, z);
      const terrainXY = latLngToTileXY(center.lat, center.lng, terrainZ);

      const tests: Array<{ mode: string; provider: string; url: string }> = [
        {
          mode: 'Street',
          provider: 'Google Maps Street HD (lyrs=m)',
          url: `https://mt1.google.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}&scale=2&hl=en`,
        },
        {
          mode: 'Street (OSM)',
          provider: 'OpenStreetMap Standard',
          url: `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
        },
        {
          mode: 'Street (Backup)',
          provider: 'Esri World Street Map',
          url: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`,
        },
        {
          mode: 'Terrain',
          provider: 'Google Physical Terrain HD (lyrs=p)',
          url: `https://mt1.google.com/vt/lyrs=p&x=${terrainXY.x}&y=${terrainXY.y}&z=${terrainXY.z}&scale=2&hl=en`,
        },
        {
          mode: 'Terrain (Topo)',
          provider: 'Esri World Topo Map (Contours)',
          url: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`,
        },
        {
          mode: 'Terrain (Backup)',
          provider: 'OpenTopoMap Contours',
          url: `https://a.tile.opentopomap.org/${z}/${x}/${y}.png`,
        },
        {
          mode: 'Satellite',
          provider: 'Google Hybrid Satellite HD (lyrs=y)',
          url: `https://mt1.google.com/vt/lyrs=y&x=${x}&y=${y}&z=${z}&scale=2&hl=en`,
        },
        {
          mode: 'Satellite (Backup)',
          provider: 'Esri World Imagery',
          url: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
        },
        {
          mode: 'Traffic',
          provider: 'Google Live Traffic + Roads HD (lyrs=m,traffic)',
          url: `https://mt1.google.com/vt/lyrs=m,traffic&x=${x}&y=${y}&z=${z}&scale=2&hl=en`,
        },
        {
          mode: 'Traffic Overlay',
          provider: 'Google Traffic Vectors (lyrs=h,traffic&style=15)',
          url: `https://mt1.google.com/vt/lyrs=h,traffic&style=15&x=${x}&y=${y}&z=${z}&scale=2&hl=en`,
        },
      ];

      const results = await Promise.all(
        tests.map((t) => probeSingleTileUrl(t.mode, t.provider, t.url))
      );
      setProbeRows(results);

      const currentModeResult = results.find(
        (r) =>
          (mapMode === 'standard' && r.mode === 'Street') ||
          (mapMode === 'terrain' && r.mode === 'Terrain') ||
          (mapMode === 'satellite' && r.mode === 'Satellite') ||
          (mapMode === 'traffic' && r.mode === 'Traffic')
      );
      if (currentModeResult) {
        setDiagStats((prev) => ({
          ...prev,
          sampleResolvedUrl: currentModeResult.url,
          lastHttpStatus: currentModeResult.httpStatus,
          lastUpdatedTs: Date.now(),
        }));
      }
    } finally {
      setIsProbingProviders(false);
    }
  };

  // High-visibility light cartographic grid SVG data URL used ONLY if all 3 live providers fail (e.g., device completely offline),
  // plus a transparent 1x1 GIF data URL for overlay layers so Android WebViews never show broken image icons.
  // IMPORTANT: Never pass FALLBACK_ERROR_TILE_DATA_URL as Leaflet's `errorTileUrl` option because Leaflet's `_tileOnError`
  // overwrites `tile.src` BEFORE firing `tileerror`, which would abort our multi-provider fallback chain.
  const FALLBACK_ERROR_TILE_DATA_URL =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">' +
        '<rect width="256" height="256" fill="#e2e8f0"/>' +
        '<path d="M0 64h256M0 128h256M0 192h256M64 0v256M128 0v256M192 0v256" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,4"/>' +
        '<rect width="256" height="256" fill="none" stroke="#64748b" stroke-width="1" stroke-opacity="0.5"/>' +
        '<text x="128" y="132" text-anchor="middle" fill="#475569" font-family="sans-serif" font-size="11" font-weight="600">Offline Map Grid</text>' +
      '</svg>'
    );

  const TRANSPARENT_ERROR_TILE_DATA_URL =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  // Inspect actual DOM tile elements in .leaflet-tile-pane and detect if GridLayer level.origin drifted after a long GPS jump
  const syncTileLayersView = (map: L.Map) => {
    const zoom = map.getZoom();
    const activeBase = tileLayerRef.current;

    // 1. Check if Leaflet's GridLayer _levels[tileZoom].origin drifted from map.getPixelOrigin()
    // (Leaflet 1.9.4 reuses _levels[z] if .el.children.length > 0, which locks level.origin to the initial city after a 1,700km GPS jump)
    if (activeBase && map.hasLayer(activeBase) && !isControlledTestModeRef.current) {
      const anyLayer = activeBase as any;
      try {
        const tileZoom =
          typeof anyLayer._clampZoom === 'function'
            ? anyLayer._clampZoom(Math.round(zoom))
            : Math.round(zoom);
        const currentLevel = anyLayer._levels?.[tileZoom];
        if (currentLevel?.origin) {
          const expectedOrigin = map
            .project(map.unproject(map.getPixelOrigin()), tileZoom)
            .round();
          const drift = currentLevel.origin.distanceTo(expectedOrigin);
          if (drift > 8000) {
            // Recreate the tile layer cleanly at the new coordinate origin so tiles render on-screen immediately
            applyMapLayerToInstance(map, mapModeRef.current, providerPrefRef.current);
            return;
          }
        }
      } catch {
        // ignore internal check error
      }
    }

    // 2. Ensure all loaded <img> tiles have full visibility/opacity and count physically rendered DOM tiles
    const mapEl = mapContainerRef.current;
    if (!mapEl) return;
    const rect = mapEl.getBoundingClientRect();
    const containerSizeStr = `${Math.round(rect.width)}x${Math.round(rect.height)}px`;
    const imgs = mapEl.querySelectorAll('img.leaflet-tile');
    let domLoadedCount = 0;

    imgs.forEach((el) => {
      const img = el as HTMLImageElement;
      if (img.complete && img.naturalWidth > 0 && !img.src.startsWith('data:image/gif')) {
        img.classList.add('leaflet-tile-loaded');
        img.style.visibility = 'visible';
        img.style.opacity = '1';
        const imgRect = img.getBoundingClientRect();
        const intersectsViewport =
          rect.width > 0 &&
          rect.height > 0 &&
          imgRect.right > rect.left &&
          imgRect.left < rect.right &&
          imgRect.bottom > rect.top &&
          imgRect.top < rect.bottom;
        if (intersectsViewport) {
          domLoadedCount += 1;
        }
      }
    });

    setDiagStats((prev) => {
      if (
        prev.domVisibleTiles === domLoadedCount &&
        prev.containerSize === containerSizeStr
      ) {
        return prev;
      }
      return {
        ...prev,
        domVisibleTiles: domLoadedCount,
        containerSize: containerSizeStr,
        lastUpdatedTs: Date.now(),
      };
    });
  };

  // Create a fresh, non-cached L.TileLayer with verified multi-provider fallback and live runtime telemetry
  const createVerifiedTileLayer = (
    mode: MapLayerMode,
    pref: TileProviderPreference = providerPref
  ): {
    baseLayer: L.TileLayer;
    overlayLayer: L.TileLayer | null;
    providerName: string;
    templateUrl: string;
  } => {
    const commonGoogleOpts: L.TileLayerOptions = {
      subdomains: ['0', '1', '2', '3'],
      tileSize: 256,
      zoomOffset: 0,
      detectRetina: false,
      keepBuffer: 2,
      updateWhenIdle: false,
      updateWhenZooming: true,
      crossOrigin: false,
      errorTileUrl: '',
      zIndex: 2,
    };

    const commonStandardOpts: L.TileLayerOptions = {
      tileSize: 256,
      zoomOffset: 0,
      detectRetina: false,
      keepBuffer: 2,
      updateWhenIdle: false,
      updateWhenZooming: true,
      crossOrigin: false,
      errorTileUrl: '',
      zIndex: 2,
    };

    let baseLayer: L.TileLayer;
    let overlayLayer: L.TileLayer | null = null;
    let providerName = '';
    let templateUrl = '';

    if (mode === 'terrain') {
      if (pref === 'esri') {
        templateUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
        providerName = 'Esri World Topo Map (Contours & Relief)';
        baseLayer = L.tileLayer(templateUrl, {
          ...commonStandardOpts,
          maxNativeZoom: 17,
          maxZoom: 22,
          attribution: '&copy; Esri World Topographic Map',
        });
      } else if (pref === 'opentopo' || pref === 'osm') {
        templateUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
        providerName = 'OpenTopoMap Contours';
        baseLayer = L.tileLayer(templateUrl, {
          ...commonStandardOpts,
          subdomains: ['a', 'b', 'c'],
          maxNativeZoom: 17,
          maxZoom: 22,
          attribution: '&copy; OpenTopoMap (CC-BY-SA) &amp; OpenStreetMap',
        });
      } else {
        templateUrl = 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&hl=en';
        providerName = 'Google Physical Terrain (lyrs=p)';
        baseLayer = L.tileLayer(templateUrl, {
          ...commonGoogleOpts,
          maxNativeZoom: 16,
          maxZoom: 22,
          attribution: '&copy; Google Maps Terrain &amp; Esri Topo',
        });
      }
    } else if (mode === 'satellite') {
      if (pref === 'esri' || pref === 'osm') {
        templateUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        providerName = 'Esri World Imagery Satellite';
        baseLayer = L.tileLayer(templateUrl, {
          ...commonStandardOpts,
          maxNativeZoom: 18,
          maxZoom: 22,
          attribution: '&copy; Esri World Imagery',
        });
      } else {
        templateUrl = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&scale=2&hl=en';
        providerName = 'Google Hybrid Satellite 2x HDR (lyrs=y)';
        baseLayer = L.tileLayer(templateUrl, {
          ...commonGoogleOpts,
          maxNativeZoom: 20,
          maxZoom: 22,
          attribution: '&copy; Google Maps Satellite 2x HDR',
        });
      }
    } else if (mode === 'traffic') {
      const tsMinute = Math.floor(Date.now() / 60000);
      if (pref === 'esri') {
        templateUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
        providerName = 'Esri Street + Google Live Traffic Overlay';
        baseLayer = L.tileLayer(templateUrl, {
          ...commonStandardOpts,
          maxNativeZoom: 17,
          maxZoom: 22,
          attribution: '&copy; Esri &amp; Google Live Traffic',
        });
        overlayLayer = L.tileLayer(
          `https://mt{s}.google.com/vt/lyrs=h,traffic&style=15&x={x}&y={y}&z={z}&hl=en&ts=${tsMinute}`,
          {
            ...commonGoogleOpts,
            maxNativeZoom: 20,
            maxZoom: 22,
            opacity: 0.95,
            zIndex: 3,
          }
        );
      } else if (pref === 'osm') {
        templateUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
        providerName = 'OpenStreetMap + Google Live Traffic Overlay';
        baseLayer = L.tileLayer(templateUrl, {
          ...commonStandardOpts,
          maxNativeZoom: 19,
          maxZoom: 22,
          attribution: '&copy; OpenStreetMap &amp; Google Live Traffic',
        });
        overlayLayer = L.tileLayer(
          `https://mt{s}.google.com/vt/lyrs=h,traffic&style=15&x={x}&y={y}&z={z}&hl=en&ts=${tsMinute}`,
          {
            ...commonGoogleOpts,
            maxNativeZoom: 20,
            maxZoom: 22,
            opacity: 0.95,
            zIndex: 3,
          }
        );
      } else {
        templateUrl = `https://mt{s}.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}&hl=en&ts=${tsMinute}`;
        providerName = 'Google Maps Live Traffic (lyrs=m,traffic)';
        baseLayer = L.tileLayer(templateUrl, {
          ...commonGoogleOpts,
          maxNativeZoom: 20,
          maxZoom: 22,
          attribution: '&copy; Google Maps Live Traffic',
        });
      }
    } else {
      // Standard Street Mode
      if (pref === 'osm') {
        templateUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
        providerName = 'OpenStreetMap Standard Street';
        baseLayer = L.tileLayer(templateUrl, {
          ...commonStandardOpts,
          maxNativeZoom: 19,
          maxZoom: 22,
          attribution: '&copy; OpenStreetMap contributors',
        });
      } else if (pref === 'esri') {
        templateUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
        providerName = 'Esri World Street Map';
        baseLayer = L.tileLayer(templateUrl, {
          ...commonStandardOpts,
          maxNativeZoom: 17,
          maxZoom: 22,
          attribution: '&copy; Esri World Street Map',
        });
      } else {
        templateUrl = 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=en';
        providerName = 'Google Maps Standard Street (lyrs=m)';
        baseLayer = L.tileLayer(templateUrl, {
          ...commonGoogleOpts,
          maxNativeZoom: 20,
          maxZoom: 22,
          attribution: '&copy; Google Maps Street &amp; OpenStreetMap',
        });
      }
    }

    // Attach real-time diagnostic telemetry and verified multi-provider fallback
    baseLayer.on('tileloadstart', (evt: any) => {
      const coords = evt?.coords;
      const rawTileSrc = evt?.tile?.src || '';
      const resolvedUrl =
        rawTileSrc && !rawTileSrc.startsWith('data:')
          ? rawTileSrc
          : coords && typeof (baseLayer as any).getTileUrl === 'function'
          ? (baseLayer as any).getTileUrl(coords)
          : templateUrl;

      logTileRequestDiagnostic({
        tileUrl: resolvedUrl,
        providerEndpoint: templateUrl,
        providerName,
        mode,
        stage: 'tileloadstart',
        coords,
      });

      setDiagStats((prev) => ({
        ...prev,
        requestedCount: prev.requestedCount + 1,
        sampleResolvedUrl:
          resolvedUrl && !resolvedUrl.startsWith('data:') ? resolvedUrl : prev.sampleResolvedUrl,
        lastUpdatedTs: Date.now(),
      }));
    });

    baseLayer.on('tileload', (evt: any) => {
      const tile = evt?.tile as HTMLImageElement | undefined;
      if (tile) {
        tile.classList.add('leaflet-tile-loaded');
        tile.style.visibility = 'visible';
        tile.style.opacity = '1';
      }
      const loadedSrc = tile?.src || '';
      if (loadedSrc.startsWith('data:')) {
        return;
      }
      const mapEl = mapContainerRef.current;
      const domCount = mapEl
        ? mapEl.querySelectorAll('img.leaflet-tile.leaflet-tile-loaded').length
        : 0;
      const rect = mapEl ? mapEl.getBoundingClientRect() : null;
      setDiagStats((prev) => ({
        ...prev,
        loadedCount: prev.loadedCount + 1,
        domVisibleTiles: Math.max(domCount, 1),
        containerSize:
          rect && rect.width > 0
            ? `${Math.round(rect.width)}x${Math.round(rect.height)}px`
            : prev.containerSize,
        sampleResolvedUrl: loadedSrc || prev.sampleResolvedUrl,
        lastHttpStatus: '200 OK (Tile Loaded)',
        lastUpdatedTs: Date.now(),
      }));
    });

    baseLayer.on('tileerror', (errEvt: any) => {
      if (!(baseLayer as any)._map) return;
      const tile = errEvt?.tile as HTMLImageElement | undefined;
      const coords = errEvt?.coords;
      const rawTileSrc = tile?.src || '';
      const resolvedCoordUrl =
        coords && typeof (baseLayer as any).getTileUrl === 'function'
          ? (baseLayer as any).getTileUrl(coords)
          : templateUrl;
      const failedUrl =
        rawTileSrc && !rawTileSrc.startsWith('data:') ? rawTileSrc : resolvedCoordUrl;

      void inspectFailedTileHttpStatus(failedUrl, providerName, templateUrl, coords);

      setDiagStats((prev) => ({
        ...prev,
        failedCount: prev.failedCount + 1,
        lastHttpStatus: 'Tile Load Error (Recovering via Fallback)',
        lastError: `Failed tile (${coords?.z ?? '?'}/${coords?.x ?? '?'}/${coords?.y ?? '?'}): ${failedUrl}`,
        lastUpdatedTs: Date.now(),
      }));

      if (!tile || !coords) return;

      tile.removeAttribute('crossorigin');

      const markRecoveredOnLoad = (fallbackLabel: string) => {
        tile.onload = () => {
          tile.classList.add('leaflet-tile-loaded');
          tile.style.visibility = 'visible';
          tile.style.opacity = '1';
          if (tile.src && !tile.src.startsWith('data:')) {
            setDiagStats((prev) => ({
              ...prev,
              loadedCount: prev.loadedCount + 1,
              fallbackRecoveredCount: prev.fallbackRecoveredCount + 1,
              domVisibleTiles: prev.domVisibleTiles + 1,
              sampleResolvedUrl: tile.src,
              lastHttpStatus: `200 OK (Fallback: ${fallbackLabel})`,
              lastUpdatedTs: Date.now(),
            }));
          }
        };
      };

      const stage = tile.dataset.fallbackStage || '0';
      if (stage === '0') {
        tile.dataset.fallbackStage = '1';
        if (mode === 'terrain') {
          markRecoveredOnLoad('OpenTopoMap Contours');
          const z = Math.min(17, coords.z);
          const nextUrl = `https://a.tile.opentopomap.org/${z}/${coords.x}/${coords.y}.png`;
          logTileRequestDiagnostic({
            tileUrl: nextUrl,
            providerEndpoint: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
            providerName: 'OpenTopoMap Contours (Fallback Stage 1)',
            mode,
            stage: 'fallback-stage-1',
            coords,
          });
          tile.src = nextUrl;
          setTileFallbackNotice('Using OpenTopoMap fallback tiles');
        } else if (mode === 'satellite') {
          markRecoveredOnLoad('Esri World Imagery');
          const z = Math.min(18, coords.z);
          const nextUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${coords.y}/${coords.x}`;
          logTileRequestDiagnostic({
            tileUrl: nextUrl,
            providerEndpoint:
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            providerName: 'Esri World Imagery (Fallback Stage 1)',
            mode,
            stage: 'fallback-stage-1',
            coords,
          });
          tile.src = nextUrl;
          setTileFallbackNotice('Using Esri World Imagery fallback tiles');
        } else if (mode === 'traffic') {
          markRecoveredOnLoad('Google Live Traffic Mirror');
          const z = Math.min(19, coords.z);
          const nextUrl = `https://mt0.google.com/vt/lyrs=m,traffic&x=${coords.x}&y=${coords.y}&z=${z}&hl=en`;
          logTileRequestDiagnostic({
            tileUrl: nextUrl,
            providerEndpoint: 'https://mt0.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}&hl=en',
            providerName: 'Google Live Traffic Mirror (Fallback Stage 1)',
            mode,
            stage: 'fallback-stage-1',
            coords,
          });
          tile.src = nextUrl;
        } else {
          markRecoveredOnLoad('OpenStreetMap Standard');
          const z = Math.min(19, coords.z);
          const nextUrl = `https://tile.openstreetmap.org/${z}/${coords.x}/${coords.y}.png`;
          logTileRequestDiagnostic({
            tileUrl: nextUrl,
            providerEndpoint: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            providerName: 'OpenStreetMap Standard (Fallback Stage 1)',
            mode,
            stage: 'fallback-stage-1',
            coords,
          });
          tile.src = nextUrl;
          setTileFallbackNotice('Using OpenStreetMap fallback tiles');
        }
      } else if (stage === '1') {
        tile.dataset.fallbackStage = '2';
        if (mode === 'terrain') {
          markRecoveredOnLoad('Esri World Topo Map');
          const z = Math.min(17, coords.z);
          const nextUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${coords.y}/${coords.x}`;
          logTileRequestDiagnostic({
            tileUrl: nextUrl,
            providerEndpoint:
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
            providerName: 'Esri World Topo Map (Fallback Stage 2)',
            mode,
            stage: 'fallback-stage-2',
            coords,
          });
          tile.src = nextUrl;
        } else if (mode === 'satellite') {
          markRecoveredOnLoad('Google Satellite Mirror');
          const z = Math.min(19, coords.z);
          const nextUrl = `https://mt0.google.com/vt/lyrs=y&x=${coords.x}&y=${coords.y}&z=${z}&hl=en`;
          logTileRequestDiagnostic({
            tileUrl: nextUrl,
            providerEndpoint: 'https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=en',
            providerName: 'Google Satellite Mirror (Fallback Stage 2)',
            mode,
            stage: 'fallback-stage-2',
            coords,
          });
          tile.src = nextUrl;
        } else if (mode === 'traffic') {
          setIsLiveTrafficUnavailable(true);
          markRecoveredOnLoad('OpenStreetMap (Traffic Unavailable)');
          const z = Math.min(19, coords.z);
          const nextUrl = `https://tile.openstreetmap.org/${z}/${coords.x}/${coords.y}.png`;
          logTileRequestDiagnostic({
            tileUrl: nextUrl,
            providerEndpoint: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            providerName: 'OpenStreetMap (Traffic Unavailable Fallback Stage 2)',
            mode,
            stage: 'fallback-stage-2',
            coords,
          });
          tile.src = nextUrl;
          setTileFallbackNotice('Live traffic unavailable — showing standard street map');
        } else {
          markRecoveredOnLoad('Esri World Street Map');
          const z = Math.min(17, coords.z);
          const nextUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${coords.y}/${coords.x}`;
          logTileRequestDiagnostic({
            tileUrl: nextUrl,
            providerEndpoint:
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
            providerName: 'Esri World Street Map (Fallback Stage 2)',
            mode,
            stage: 'fallback-stage-2',
            coords,
          });
          tile.src = nextUrl;
          setTileFallbackNotice('Using Esri World Street Map fallback tiles');
        }
      } else {
        tile.dataset.fallbackStage = '3';
        if (mode === 'traffic') {
          setIsLiveTrafficUnavailable(true);
        }
        if (tile.src !== FALLBACK_ERROR_TILE_DATA_URL) {
          tile.src = FALLBACK_ERROR_TILE_DATA_URL;
        }
        tile.classList.add('leaflet-tile-loaded');
        tile.style.visibility = 'visible';
        tile.style.opacity = '1';
      }
    });

    if (overlayLayer) {
      const overlayEndpoint =
        'https://mt{s}.google.com/vt/lyrs=h,traffic&style=15&x={x}&y={y}&z={z}&hl=en';
      overlayLayer.on('tileloadstart', (evt: any) => {
        const coords = evt?.coords;
        const rawSrc = evt?.tile?.src || '';
        const resolvedOverlayUrl =
          rawSrc && !rawSrc.startsWith('data:')
            ? rawSrc
            : coords && typeof (overlayLayer as any).getTileUrl === 'function'
            ? (overlayLayer as any).getTileUrl(coords)
            : overlayEndpoint;
        logTileRequestDiagnostic({
          tileUrl: resolvedOverlayUrl,
          providerEndpoint: overlayEndpoint,
          providerName: 'Google Live Traffic Vector Overlay',
          mode,
          stage: 'overlay-tileloadstart',
          coords,
        });
      });
      overlayLayer.on('tileload', (evt: any) => {
        const tile = evt?.tile as HTMLImageElement | undefined;
        if (tile) {
          tile.classList.add('leaflet-tile-loaded');
          tile.style.visibility = 'visible';
          tile.style.opacity = '1';
        }
        setIsLiveTrafficUnavailable(false);
      });
      overlayLayer.on('tileerror', (errEvt: any) => {
        const tile = errEvt?.tile as HTMLImageElement | undefined;
        const coords = errEvt?.coords;
        const failedOverlayUrl =
          tile?.src && !tile.src.startsWith('data:')
            ? tile.src
            : coords && typeof (overlayLayer as any).getTileUrl === 'function'
            ? (overlayLayer as any).getTileUrl(coords)
            : overlayEndpoint;
        void inspectFailedTileHttpStatus(
          failedOverlayUrl,
          'Google Live Traffic Vector Overlay',
          overlayEndpoint,
          coords
        );
        if (tile && tile.src !== TRANSPARENT_ERROR_TILE_DATA_URL) {
          tile.src = TRANSPARENT_ERROR_TILE_DATA_URL;
        }
        if (mode === 'traffic') {
          setIsLiveTrafficUnavailable(true);
        }
      });
    }

    return { baseLayer, overlayLayer, providerName, templateUrl };
  };

  // Single-authority function to apply map mode and provider on the active Leaflet map without recreating the map
  const applyMapLayerToInstance = (
    map: L.Map,
    nextMode: MapLayerMode,
    nextPref: TileProviderPreference = providerPrefRef.current
  ) => {
    ++layerSwitchGenRef.current;

    // Remove all previous TileLayers cleanly before attaching the fresh TileLayer
    // so Leaflet's GridLayer creates fresh _levels anchored at the current map.getPixelOrigin()
    if (overlayTileLayerRef.current) {
      if (map.hasLayer(overlayTileLayerRef.current)) {
        map.removeLayer(overlayTileLayerRef.current);
      }
      overlayTileLayerRef.current = null;
    }
    if (tileLayerRef.current) {
      if (map.hasLayer(tileLayerRef.current)) {
        map.removeLayer(tileLayerRef.current);
      }
      tileLayerRef.current = null;
    }
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    setIsLiveTrafficUnavailable(
      nextMode === 'traffic' && typeof navigator !== 'undefined' && !navigator.onLine
    );
    const { baseLayer, overlayLayer, providerName, templateUrl } = createVerifiedTileLayer(
      nextMode,
      nextPref
    );

    const mapEl = mapContainerRef.current;
    const rect = mapEl ? mapEl.getBoundingClientRect() : null;

    setDiagStats({
      mode: nextMode,
      providerName,
      templateUrl,
      sampleResolvedUrl: '',
      requestedCount: 0,
      loadedCount: 0,
      failedCount: 0,
      fallbackRecoveredCount: 0,
      domVisibleTiles: 0,
      containerSize:
        rect && rect.width > 0
          ? `${Math.round(rect.width)}x${Math.round(rect.height)}px`
          : 'Measuring...',
      lastHttpStatus: 'Loading tiles...',
      lastError: null,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      platform: detectRuntimePlatform(),
      lastUpdatedTs: Date.now(),
    });

    baseLayer.setZIndex(2);
    baseLayer.addTo(map);
    tileLayerRef.current = baseLayer;
    activeLayerModeRef.current = `${nextMode}:${nextPref}`;

    if (overlayLayer) {
      overlayLayer.setZIndex(3);
      overlayLayer.addTo(map);
      overlayTileLayerRef.current = overlayLayer;
    }

    // Sync Leaflet L.control.layers radio selection using lightweight proxy LayerGroups
    const proxies = controlProxyLayersRef.current;
    if (proxies) {
      isSyncingControlRef.current = true;
      try {
        (['standard', 'satellite', 'terrain', 'traffic'] as MapLayerMode[]).forEach((m) => {
          const proxy = proxies[m];
          if (!proxy) return;
          if (m === nextMode && !map.hasLayer(proxy)) {
            map.addLayer(proxy);
          } else if (m !== nextMode && map.hasLayer(proxy)) {
            map.removeLayer(proxy);
          }
        });
      } finally {
        isSyncingControlRef.current = false;
      }
    }

    map.invalidateSize({ animate: false });
    window.setTimeout(() => {
      if (mapInstanceRef.current) {
        syncTileLayersView(mapInstanceRef.current);
      }
    }, 120);
  };

  // Unified camera repositioning helper that prevents competing GPS effects and resets the tile grid on long-distance jumps (> 2.5 km)
  const recenterMapCleanly = (
    map: L.Map,
    targetLat: number,
    targetLng: number,
    targetZoom: number,
    options?: { animate?: boolean; forceLayerRefresh?: boolean }
  ) => {
    if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) return;
    const clampedZoom = Math.max(2, Math.min(20, Math.round(targetZoom)));
    const jumpKey = `${targetLat.toFixed(4)}:${targetLng.toFixed(4)}:${clampedZoom}`;
    const now = Date.now();
    if (
      !options?.forceLayerRefresh &&
      lastCenteredJumpRef.current.key === jumpKey &&
      now - lastCenteredJumpRef.current.ts < 600
    ) {
      return;
    }
    lastCenteredJumpRef.current = { key: jumpKey, ts: now };

    const currentCenter = map.getCenter();
    const distMeters = calculateDistanceMeters(
      currentCenter.lat,
      currentCenter.lng,
      targetLat,
      targetLng
    );

    const isLongJump = distMeters > 2500;
    const shouldInstantSetView =
      isLongJump ||
      !isActiveRef.current ||
      isLiteModeRef.current ||
      options?.animate === false;

    map.stop();
    map.invalidateSize({ animate: false });

    if (shouldInstantSetView) {
      map.setView([targetLat, targetLng], clampedZoom, { animate: false });
      setCurrentZoom(clampedZoom);
      if (isLongJump || options?.forceLayerRefresh) {
        if (isControlledTestModeRef.current) {
          applyControlledTestLayer(map);
        } else {
          applyMapLayerToInstance(map, mapModeRef.current, providerPrefRef.current);
        }
      } else {
        syncTileLayersView(map);
      }
    } else {
      setCurrentZoom(clampedZoom);
      map.flyTo([targetLat, targetLng], clampedZoom, {
        animate: true,
        duration: 0.65,
      });
    }
  };

  // Requirement #3: Controlled Test Mode — isolates the map from all custom UI, markers, and overlays
  // using a single verified street tile provider with default Leaflet tile-layer settings at a valid zoom level
  const applyControlledTestLayer = (map: L.Map) => {
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });
    const testTemplate = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const testLayer = L.tileLayer(testTemplate, {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors (Isolated Test Mode)',
    });

    setDiagStats((prev) => ({
      ...prev,
      mode: 'standard',
      providerName: 'Isolated Test: OpenStreetMap Default',
      templateUrl: testTemplate,
      requestedCount: 0,
      loadedCount: 0,
      failedCount: 0,
      domVisibleTiles: 0,
      lastHttpStatus: 'Loading isolated test tiles...',
      lastError: null,
      lastUpdatedTs: Date.now(),
    }));

    testLayer.on('tileloadstart', (evt: any) => {
      const coords = evt?.coords;
      const src =
        evt?.tile?.src ||
        (coords && typeof (testLayer as any).getTileUrl === 'function'
          ? (testLayer as any).getTileUrl(coords)
          : testTemplate);
      logTileRequestDiagnostic({
        tileUrl: src,
        providerEndpoint: testTemplate,
        providerName: 'Isolated Test: OpenStreetMap Default',
        mode: 'standard',
        stage: 'isolated-test-tileloadstart',
        coords,
      });
      setDiagStats((prev) => ({
        ...prev,
        requestedCount: prev.requestedCount + 1,
        sampleResolvedUrl: src || prev.sampleResolvedUrl,
        lastUpdatedTs: Date.now(),
      }));
    });
    testLayer.on('tileload', (evt: any) => {
      const tile = evt?.tile as HTMLImageElement | undefined;
      if (tile) {
        tile.classList.add('leaflet-tile-loaded');
        tile.style.visibility = 'visible';
        tile.style.opacity = '1';
      }
      setDiagStats((prev) => ({
        ...prev,
        loadedCount: prev.loadedCount + 1,
        domVisibleTiles: prev.domVisibleTiles + 1,
        sampleResolvedUrl: tile?.src || prev.sampleResolvedUrl,
        lastHttpStatus: '200 OK (Isolated Test Tile Loaded)',
        lastUpdatedTs: Date.now(),
      }));
    });
    testLayer.on('tileerror', (errEvt: any) => {
      const coords = errEvt?.coords;
      const failedSrc =
        errEvt?.tile?.src ||
        (coords && typeof (testLayer as any).getTileUrl === 'function'
          ? (testLayer as any).getTileUrl(coords)
          : testTemplate);
      void inspectFailedTileHttpStatus(
        failedSrc,
        'Isolated Test: OpenStreetMap Default',
        testTemplate,
        coords
      );
      setDiagStats((prev) => ({
        ...prev,
        failedCount: prev.failedCount + 1,
        lastHttpStatus: 'Isolated Test Tile Error',
        lastUpdatedTs: Date.now(),
      }));
    });

    testLayer.addTo(map);
    tileLayerRef.current = testLayer;
  };

  const handleToggleControlledTestMode = () => {
    const map = mapInstanceRef.current;
    const next = !isControlledTestMode;
    setIsControlledTestMode(next);
    isControlledTestModeRef.current = next;
    if (!map) return;

    const mapEl = mapContainerRef.current;
    const markerPane = mapEl?.querySelector('.leaflet-marker-pane') as HTMLElement | null;
    const overlayPane = mapEl?.querySelector('.leaflet-overlay-pane') as HTMLElement | null;
    const shadowPane = mapEl?.querySelector('.leaflet-shadow-pane') as HTMLElement | null;

    if (next) {
      if (markerPane) markerPane.style.display = 'none';
      if (overlayPane) overlayPane.style.display = 'none';
      if (shadowPane) shadowPane.style.display = 'none';
      const targetLat =
        myLocation && Number.isFinite(myLocation.latitude) && myLocation.latitude !== 0
          ? myLocation.latitude
          : 13.0501;
      const targetLng =
        myLocation && Number.isFinite(myLocation.longitude) && myLocation.longitude !== 0
          ? myLocation.longitude
          : 77.71475;
      map.stop();
      map.invalidateSize({ animate: false });
      map.setView([targetLat, targetLng], 15, { animate: false });
      setCurrentZoom(15);
      applyControlledTestLayer(map);
      toast.info(
        'Controlled Test Mode active: custom markers & overlays isolated to verify raw street tiles'
      );
    } else {
      if (markerPane) markerPane.style.display = '';
      if (overlayPane) overlayPane.style.display = '';
      if (shadowPane) shadowPane.style.display = '';
      map.invalidateSize({ animate: false });
      applyMapLayerToInstance(map, mapModeRef.current, providerPrefRef.current);
      toast.success('Restored complete Beacon Network map with all markers and layers');
    }
  };

  const handleSelectMapMode = (nextMode: MapLayerMode, toastMessage?: string) => {
    setTileFallbackNotice(null);
    setMapMode(nextMode);
    mapModeRef.current = nextMode;
    localStorage.setItem('beacon_map_style', nextMode);

    const map = mapInstanceRef.current;
    if (map) {
      const curZoom = map.getZoom();
      if (nextMode === 'terrain' && providerPref === 'auto' && curZoom > 16) {
        setCurrentZoom(15);
        map.setZoom(15, { animate: false });
      }
      applyMapLayerToInstance(map, nextMode, providerPref);
    }

    if (toastMessage) {
      toast.info(toastMessage);
    }
  };

  const handleSelectProviderPref = (nextPref: TileProviderPreference) => {
    setProviderPref(nextPref);
    providerPrefRef.current = nextPref;
    localStorage.setItem('beacon_tile_provider_pref', nextPref);
    setTileFallbackNotice(null);
    const map = mapInstanceRef.current;
    if (map) {
      applyMapLayerToInstance(map, mapMode, nextPref);
    }
    toast.success(
      nextPref === 'osm'
        ? 'Switched tile engine to OpenStreetMap Standard'
        : nextPref === 'esri'
        ? 'Switched tile engine to Esri ArcGIS HD'
        : nextPref === 'opentopo'
        ? 'Switched Terrain engine to OpenTopoMap Contours'
        : 'Switched tile engine to Auto (Google Maps + OSM/Esri Fallback)'
    );
  };

  // Initialize Leaflet Map (uses last known GPS or peer coordinates immediately so tiles pre-render before switching tabs)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    let initialCenter: [number, number] = [28.6139, 77.209];
    let initialZoom = 14;

    if (focusCoords && Number.isFinite(focusCoords.lat) && Number.isFinite(focusCoords.lng)) {
      initialCenter = [focusCoords.lat, focusCoords.lng];
      initialZoom = 16;
    } else if (myLocation && Number.isFinite(myLocation.latitude) && Number.isFinite(myLocation.longitude)) {
      initialCenter = [myLocation.latitude, myLocation.longitude];
      initialZoom = 16;
    } else {
      try {
        const cachedRaw = localStorage.getItem('beacon_last_valid_gps_v1');
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (Number.isFinite(cached?.lat) && Number.isFinite(cached?.lng)) {
            initialCenter = [cached.lat, cached.lng];
            initialZoom = 16;
          }
        } else if (userLocations.length > 0) {
          const peer = userLocations.find((l) => Number.isFinite(l.latitude) && Number.isFinite(l.longitude));
          if (peer) {
            initialCenter = [peer.latitude, peer.longitude];
            initialZoom = 15;
          }
        }
      } catch {}
    }

    if (mapMode === 'terrain' && providerPref === 'auto' && initialZoom > 16) {
      initialZoom = 15;
    }

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 2,
      maxZoom: 22,
      zoomControl: false,
      preferCanvas: true,
      zoomSnap: 1,
      zoomDelta: 1,
      touchZoom: true,
      bounceAtZoomLimits: false,
      wheelPxPerZoomLevel: 120,
      fadeAnimation: false,
      zoomAnimation: !isLiteModeRef.current,
      markerZoomAnimation: !isLiteModeRef.current,
    });

    // Lightweight proxy LayerGroups for native L.control.layers so Leaflet's control UI stays in sync
    // without directly removing/corrupting our managed L.TileLayer instances
    const proxyStandard = L.layerGroup();
    const proxySatellite = L.layerGroup();
    const proxyTerrain = L.layerGroup();
    const proxyTraffic = L.layerGroup();
    const proxies: Record<MapLayerMode, L.LayerGroup> = {
      standard: proxyStandard,
      satellite: proxySatellite,
      terrain: proxyTerrain,
      traffic: proxyTraffic,
    };
    controlProxyLayersRef.current = proxies;
    proxies[mapMode].addTo(map);

    mapInstanceRef.current = map;
    applyMapLayerToInstance(map, mapMode, providerPref);

    const layersControl = L.control
      .layers(
        {
          'Standard Street': proxyStandard,
          'Satellite 2x HDR': proxySatellite,
          'Terrain Topo': proxyTerrain,
          'Live Traffic': proxyTraffic,
        },
        {},
        {
          position: 'topright',
          collapsed: true,
        }
      )
      .addTo(map);
    layersControlRef.current = layersControl;

    map.on('baselayerchange', (e: L.LayersControlEvent) => {
      if (isSyncingControlRef.current) return;
      if (e.name === 'Standard Street') handleSelectMapMode('standard');
      else if (e.name === 'Terrain Topo') handleSelectMapMode('terrain');
      else if (e.name === 'Live Traffic') handleSelectMapMode('traffic');
      else handleSelectMapMode('satellite');
    });

    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 48,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      animate: !isLiteModeRef.current,
      animateAddingMarkers: false,
      spiderLegPolylineOptions: {
        weight: 2,
        color: '#38bdf8',
        opacity: 0.75,
      },
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const sizePx = count >= 10 ? 48 : 42;
        return L.divIcon({
          className: 'beacon-user-cluster-marker',
          html: `
            <div style="width:${sizePx}px;height:${sizePx}px;" class="relative flex items-center justify-center cursor-pointer group">
              <div class="absolute inset-0 rounded-full bg-cyan-500/25 border border-cyan-400/50 animate-pulse pointer-events-none"></div>
              <div class="relative w-9 h-9 rounded-full bg-gradient-to-tr from-slate-900 via-sky-900 to-cyan-700 border-2 border-white shadow-[0_4px_14px_rgba(14,165,233,0.55)] flex items-center justify-center text-white font-black text-xs group-hover:scale-110 transition-transform">
                <span>${count}</span>
              </div>
              <div class="absolute -bottom-2 px-1.5 py-0.5 bg-slate-950/90 border border-cyan-400/40 rounded-full text-[9px] font-bold text-cyan-300 shadow whitespace-nowrap">
                ${count} Members
              </div>
            </div>
          `,
          iconSize: [sizePx, sizePx],
          iconAnchor: [sizePx / 2, sizePx / 2],
        });
      },
    });
    map.addLayer(clusterGroup);
    markerClusterGroupRef.current = clusterGroup;

    // Update currentZoom state and synchronize tile grid after zoom/move completes
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
      syncTileLayersView(map);
    });

    map.on('moveend', () => {
      syncTileLayersView(map);
    });

    // Compensate single-finger dragging when map is rotated
    const draggable = (map.dragging as any)?._draggable;
    if (draggable) {
      draggable.on('predrag', () => {
        const b = bearingRef.current;
        if (!b || b === 0) return;
        const rad = (-b * Math.PI) / 180;
        const offset = draggable._newPos.subtract(draggable._startPos);
        const rx = offset.x * Math.cos(rad) - offset.y * Math.sin(rad);
        const ry = offset.x * Math.sin(rad) + offset.y * Math.cos(rad);
        draggable._newPos = draggable._startPos.add(L.point(rx, ry));
      });
    }

    map.on('movestart', () => {
      closeContextMenu();
      setShowMapControlsPop(false);
    });

    map.on('zoomstart', () => {
      closeContextMenu();
      setShowMapControlsPop(false);
    });

    map.on('click', () => {
      closeContextMenu();
      setShowSearchDropdown(false);
      setShowMapControlsPop(false);
    });

    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
      let lat = e.latlng.lat;
      let lng = e.latlng.lng;
      if (bearingRef.current !== 0 && mapInstanceRef.current) {
        const centerPoint = map.getSize().divideBy(2);
        const clickPoint = map.mouseEventToContainerPoint(e.originalEvent);
        const rad = (-bearingRef.current * Math.PI) / 180;
        const dx = clickPoint.x - centerPoint.x;
        const dy = clickPoint.y - centerPoint.y;
        const rx = centerPoint.x + dx * Math.cos(rad) - dy * Math.sin(rad);
        const ry = centerPoint.y + dx * Math.sin(rad) + dy * Math.cos(rad);
        const corrected = map.containerPointToLatLng(L.point(rx, ry));
        lat = corrected.lat;
        lng = corrected.lng;
      }
      openContextMenu(e.originalEvent.clientX, e.originalEvent.clientY, {
        type: 'coord',
        title: 'Dropped Pin',
        subtitle: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lng,
      });
    });

    setCzMapReadyTick((t) => t + 1);

    return () => {
      if (crowdzoneLayerGroupRef.current) {
        crowdzoneLayerGroupRef.current.clearLayers();
        crowdzoneLayerGroupRef.current = null;
      }
      if (markerClusterGroupRef.current) {
        markerClusterGroupRef.current.clearLayers();
        markerClusterGroupRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle active visibility transition and ensure tiles render when switching from hidden Home tab to Map tab
  useEffect(() => {
    if (!isActive || !mapInstanceRef.current) return;

    const runResizeAndTileSync = () => {
      const map = mapInstanceRef.current;
      if (!map) return;
      map.invalidateSize({ animate: false });
      syncTileLayersView(map);
    };

    const verifyTilesMounted = () => {
      const map = mapInstanceRef.current;
      const container = mapContainerRef.current;
      if (!map || !container) return;
      map.invalidateSize({ animate: false });
      const imgs = container.querySelectorAll('img.leaflet-tile');
      if (imgs.length === 0) {
        if (isControlledTestModeRef.current) {
          applyControlledTestLayer(map);
        } else {
          applyMapLayerToInstance(map, mapModeRef.current, providerPrefRef.current);
        }
      } else {
        syncTileLayersView(map);
      }
    };

    runResizeAndTileSync();
    const rafId = requestAnimationFrame(runResizeAndTileSync);
    const t1 = window.setTimeout(runResizeAndTileSync, 100);
    const t2 = window.setTimeout(verifyTilesMounted, 320);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [isActive]);

  // Automatically invalidate map size whenever the container dimensions change (e.g., Docked Panel <-> Fullscreen)
  useEffect(() => {
    const el = gestureAreaRef.current || mapContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ animate: false });
        syncTileLayersView(mapInstanceRef.current);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Smoothly pan/fly camera to focused coordinates when requested from Notification or Chat ('Locate on Map')
  useEffect(() => {
    if (
      !focusCoords ||
      !Number.isFinite(focusCoords.lat) ||
      !Number.isFinite(focusCoords.lng) ||
      !isActive ||
      !mapInstanceRef.current
    ) {
      return;
    }

    const focusKey = `${focusCoords.lat.toFixed(6)}:${focusCoords.lng.toFixed(6)}:${focusCoords.ts ?? 0}`;
    if (lastFocusedKeyRef.current === focusKey) return;
    lastFocusedKeyRef.current = focusKey;
    setHasCenteredOnce(true);

    const map = mapInstanceRef.current;
    const targetLat = focusCoords.lat;
    const targetLng = focusCoords.lng;
    const targetZoom = 17;

    let raf1: number | null = null;
    let raf2: number | null = null;
    let safetyTimer: number | null = null;

    isCameraTransitioningRef.current = true;

    raf1 = requestAnimationFrame(() => {
      if (!mapInstanceRef.current) return;
      map.stop();
      map.invalidateSize({ animate: false });

      // Render animated Target Beacon Lock Ring at the destination coordinates
      if (focusSpotlightMarkerRef.current) {
        map.removeLayer(focusSpotlightMarkerRef.current);
        focusSpotlightMarkerRef.current = null;
      }
      if (focusSpotlightTimeoutRef.current !== null) {
        window.clearTimeout(focusSpotlightTimeoutRef.current);
        focusSpotlightTimeoutRef.current = null;
      }

      const spotlightIcon = L.divIcon({
        className: 'beacon-target-lock-ring',
        html: `
          <div style="position:relative;width:84px;height:84px;display:flex;align-items:center;justify-content:center;pointer-events:none;">
            <div style="position:absolute;inset:0;border-radius:9999px;border:2px solid rgba(0,217,255,0.85);background:radial-gradient(circle, rgba(0,217,255,0.22) 0%, rgba(137,87,255,0.08) 55%, transparent 72%);animation:ping 1.25s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:absolute;inset:12px;border-radius:9999px;border:2px dashed rgba(0,214,160,0.9);box-shadow:0 0 18px rgba(0,217,255,0.65);"></div>
          </div>
        `,
        iconSize: [84, 84],
        iconAnchor: [42, 42],
      });

      focusSpotlightMarkerRef.current = L.marker([targetLat, targetLng], {
        icon: spotlightIcon,
        interactive: false,
        zIndexOffset: -100,
      }).addTo(map);

      focusSpotlightTimeoutRef.current = window.setTimeout(() => {
        if (focusSpotlightMarkerRef.current && mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(focusSpotlightMarkerRef.current);
          focusSpotlightMarkerRef.current = null;
        }
      }, 4800);

      // Automatically select the target user marker if a peer or self is at these coordinates
      const matchedPeer = displayedUserLocations.find(
        (loc) =>
          Number.isFinite(loc.latitude) &&
          Number.isFinite(loc.longitude) &&
          calculateDistanceMeters(loc.latitude, loc.longitude, targetLat, targetLng) <= 80
      );
      if (matchedPeer) {
        setSelectedUser(matchedPeer);
      } else if (
        myLocation &&
        Number.isFinite(myLocation.latitude) &&
        Number.isFinite(myLocation.longitude) &&
        calculateDistanceMeters(myLocation.latitude, myLocation.longitude, targetLat, targetLng) <= 80
      ) {
        setSelectedUser(myLocation);
      }

      raf2 = requestAnimationFrame(() => {
        if (!mapInstanceRef.current) return;
        recenterMapCleanly(map, targetLat, targetLng, targetZoom, { animate: true });
        safetyTimer = window.setTimeout(() => {
          isCameraTransitioningRef.current = false;
          if (mapInstanceRef.current) {
            syncTileLayersView(mapInstanceRef.current);
          }
        }, 750);
      });
    });

    return () => {
      if (raf1 !== null) cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
      if (safetyTimer !== null) window.clearTimeout(safetyTimer);
      isCameraTransitioningRef.current = false;
    };
  }, [focusCoords, isActive, displayedUserLocations, myLocation]);

  const activeLayerModeRef = useRef<string>(`${mapMode}:${providerPref}`);

  // Keep map layer synchronized if mapMode or providerPref changes externally
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || isControlledTestModeRef.current) return;
    const targetKey = `${mapMode}:${providerPref}`;
    if (tileLayerRef.current && activeLayerModeRef.current === targetKey && map.hasLayer(tileLayerRef.current)) {
      return;
    }
    applyMapLayerToInstance(map, mapMode, providerPref);
  }, [mapMode, providerPref]);

  // Invalidate Leaflet map size whenever bearing or 3D tilt toggles so rotated/tilted stage wrapper never exposes blank edges
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ animate: false });
        syncTileLayersView(mapInstanceRef.current);
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [bearing === 0, is3dMode]);

  // Listen for real GPS fix events so the map centers on the user's real accurate location
  useEffect(() => {
    const onGpsFix = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || typeof detail.latitude !== 'number' || typeof detail.longitude !== 'number') return;
      const map = mapInstanceRef.current;
      if (!map) return;

      const isReal = detail.isRealGps !== false;
      const fixAcc = typeof detail.accuracy === 'number' && detail.accuracy > 0 ? detail.accuracy : 100;
      const isSignificantUpgrade =
        !focusCoords &&
        fixAcc < bestCenteredAccuracyRef.current * 0.65 &&
        bestCenteredAccuracyRef.current > 35;

      const movedSinceLastAutoFollow = lastAutoFollowedCoordsRef.current
        ? calculateDistanceMeters(
            lastAutoFollowedCoordsRef.current.lat,
            lastAutoFollowedCoordsRef.current.lng,
            detail.latitude,
            detail.longitude
          )
        : Infinity;

      const exceedsAutoFollowThreshold =
        isAutoFollowEnabledRef.current &&
        !focusCoords &&
        !isCameraTransitioningRef.current &&
        movedSinceLastAutoFollow >= autoFollowThresholdMetersRef.current;

      const shouldCenter =
        detail.forceCenter ||
        pendingCenterOnNextFixRef.current ||
        (!hasCenteredOnce && !focusCoords) ||
        (isReal && !hasCenteredOnRealGpsRef.current && !focusCoords) ||
        isSignificantUpgrade ||
        exceedsAutoFollowThreshold;

      if (shouldCenter) {
        if (isReal) {
          hasCenteredOnRealGpsRef.current = true;
        }
        bestCenteredAccuracyRef.current = Math.min(bestCenteredAccuracyRef.current, fixAcc);
        pendingCenterOnNextFixRef.current = false;
        lastAutoFollowedCoordsRef.current = { lat: detail.latitude, lng: detail.longitude };
        setHasCenteredOnce(true);
        const curZoom = map.getZoom();
        const targetZoom = Math.round(Math.max(curZoom, fixAcc <= 80 ? 17 : 16));
        recenterMapCleanly(map, detail.latitude, detail.longitude, targetZoom, {
          animate: !detail.forceCenter,
        });
      }
    };

    window.addEventListener('beacon:gps-fix', onGpsFix);
    return () => window.removeEventListener('beacon:gps-fix', onGpsFix);
  }, [focusCoords, hasCenteredOnce]);

  // Smooth Marker Animation Infrastructure powered by Framer Motion
  const markerAnimationsRef = useRef<Map<string, AnimationPlaybackControls>>(new Map());
  const peerCircleAnimationFramesRef = useRef<Map<string, number>>(new Map());
  const accuracyCircleFrameRef = useRef<number | null>(null);

  const animateMarkerPosition = (
    marker: L.Marker,
    targetLat: number,
    targetLng: number,
    key: string,
    duration = 850
  ) => {
    if (isLiteModeRef.current || !isActiveRef.current || (typeof document !== 'undefined' && document.hidden)) {
      const existingAnim = markerAnimationsRef.current.get(key);
      if (existingAnim) {
        existingAnim.stop();
        markerAnimationsRef.current.delete(key);
      }
      marker.setLatLng([targetLat, targetLng]);
      return;
    }

    const currentLatLng = marker.getLatLng();
    const startLat = currentLatLng.lat;
    const startLng = currentLatLng.lng;

    // Negligible movement threshold (< ~0.3 meters) or large jump (> ~5km) -> snap directly
    const dLat = Math.abs(targetLat - startLat);
    const dLng = Math.abs(targetLng - startLng);
    if ((dLat < 0.000003 && dLng < 0.000003) || dLat > 0.05 || dLng > 0.05) {
      const existingAnim = markerAnimationsRef.current.get(key);
      if (existingAnim) {
        existingAnim.stop();
        markerAnimationsRef.current.delete(key);
      }
      marker.setLatLng([targetLat, targetLng]);
      return;
    }

    const existingAnim = markerAnimationsRef.current.get(key);
    if (existingAnim) {
      existingAnim.stop();
      markerAnimationsRef.current.delete(key);
    }

    const controls = animate(0, 1, {
      duration: duration / 1000,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (progress) => {
        const nextLat = startLat + (targetLat - startLat) * progress;
        const nextLng = startLng + (targetLng - startLng) * progress;
        marker.setLatLng([nextLat, nextLng]);
      },
      onComplete: () => {
        marker.setLatLng([targetLat, targetLng]);
        markerAnimationsRef.current.delete(key);
        if (key !== 'my_marker' && markerClusterGroupRef.current) {
          try {
            markerClusterGroupRef.current.refreshClusters(marker);
          } catch {
            // ignore cluster refresh error
          }
        }
      },
    });

    markerAnimationsRef.current.set(key, controls);
  };

  // Cleanup Framer Motion marker animations on unmount
  useEffect(() => {
    return () => {
      markerAnimationsRef.current.forEach((controls) => controls.stop());
      markerAnimationsRef.current.clear();
      peerCircleAnimationFramesRef.current.forEach((frameId) => cancelAnimationFrame(frameId));
      peerCircleAnimationFramesRef.current.clear();
      if (accuracyCircleFrameRef.current !== null) {
        cancelAnimationFrame(accuracyCircleFrameRef.current);
      }
    };
  }, []);

  const selfIconSignatureRef = useRef<string>('');
  const peerIconHtmlMapRef = useRef<Map<string, string>>(new Map());

  const lastSelfMapRefreshMsRef = useRef<number>(0);

  // Update Current User GPS Marker & Accuracy Circle (Steps 3d, 3e, 3g)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!myLocation || !Number.isFinite(myLocation.latitude) || !Number.isFinite(myLocation.longitude)) {
      if (myMarkerRef.current) {
        map.removeLayer(myMarkerRef.current);
        myMarkerRef.current = null;
        selfIconSignatureRef.current = '';
      }
      if (accuracyCircleRef.current) {
        map.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }
      setDebugMarkerLatLng(null);
      return;
    }

    // In Low Power Mode, throttle existing self-marker DOM refreshes to at most once every 5s
    const nowMs = Date.now();
    if (
      isLiteModeRef.current &&
      myMarkerRef.current &&
      hasCenteredOnce &&
      nowMs - lastSelfMapRefreshMsRef.current < 5000
    ) {
      return;
    }
    lastSelfMapRefreshMsRef.current = nowMs;

    const markerCoords: [number, number] = [myLocation.latitude, myLocation.longitude];
    const latLng = L.latLng(markerCoords[0], markerCoords[1]);
    setDebugMarkerLatLng(markerCoords);

    const currentAcc = Number(myLocation.accuracy_m ?? myLocation.accuracy);

    const movedSinceLastAutoFollow = lastAutoFollowedCoordsRef.current
      ? calculateDistanceMeters(
          lastAutoFollowedCoordsRef.current.lat,
          lastAutoFollowedCoordsRef.current.lng,
          markerCoords[0],
          markerCoords[1]
        )
      : Infinity;

    const shouldAutoFollowMove =
      isAutoFollowEnabledRef.current &&
      !focusCoords &&
      !isCameraTransitioningRef.current &&
      movedSinceLastAutoFollow >= autoFollowThresholdMetersRef.current;

    const distFromMapCenter = calculateDistanceMeters(
      map.getCenter().lat,
      map.getCenter().lng,
      markerCoords[0],
      markerCoords[1]
    );

    if (!hasCenteredOnce && !focusCoords && !isCameraTransitioningRef.current) {
      setHasCenteredOnce(true);
      bestCenteredAccuracyRef.current = currentAcc;
      hasCenteredOnRealGpsRef.current = true;
      lastAutoFollowedCoordsRef.current = { lat: markerCoords[0], lng: markerCoords[1] };
      recenterMapCleanly(map, markerCoords[0], markerCoords[1], currentAcc <= 100 ? 17 : 15, {
        animate: false,
      });
    } else if (
      !isCameraTransitioningRef.current &&
      ((!hasCenteredOnRealGpsRef.current && currentAcc <= 100 && !focusCoords) ||
        (!focusCoords && currentAcc < bestCenteredAccuracyRef.current * 0.65 && bestCenteredAccuracyRef.current > 35) ||
        (!focusCoords && isAutoFollowEnabledRef.current && distFromMapCenter > 3000))
    ) {
      hasCenteredOnRealGpsRef.current = true;
      bestCenteredAccuracyRef.current = Math.min(bestCenteredAccuracyRef.current, currentAcc);
      lastAutoFollowedCoordsRef.current = { lat: markerCoords[0], lng: markerCoords[1] };
      recenterMapCleanly(map, markerCoords[0], markerCoords[1], Math.max(map.getZoom(), 16));
    } else if (shouldAutoFollowMove) {
      lastAutoFollowedCoordsRef.current = { lat: markerCoords[0], lng: markerCoords[1] };
      recenterMapCleanly(map, markerCoords[0], markerCoords[1], Math.max(map.getZoom(), 15));
    }

    const selfSignalInfo = getGpsSignalInfo(currentAcc);
    const serverUpdatedIso = myLocation.updated_at || myLocation.timestamp;
    const serverAgeMs = serverUpdatedIso ? Date.now() - Date.parse(serverUpdatedIso) : Infinity;
    const isServerLive = Number.isFinite(serverAgeMs) && serverAgeMs < 120000; // Step 3g: under 2 minutes old

    // Ensure no accuracy ring/circle is rendered around the user location
    if (accuracyCircleRef.current) {
      map.removeLayer(accuracyCircleRef.current);
      accuracyCircleRef.current = null;
    }

    const effectiveHeading =
      myLocation.heading != null && !isNaN(myLocation.heading)
        ? myLocation.heading
        : userHeadingRef.current;

    const visualAngle =
      effectiveHeading !== null
        ? ((effectiveHeading - bearing) % 360 + 360) % 360
        : 0;

    const userIcon = user?.markerIcon || 'person';
    const userRoleEmoji = getMemberIconEmoji(userIcon);
    const userDisplayName = user?.markerLabel || user?.fullName?.split(' ')[0] || 'You';
    const roundedAcc = Math.round(currentAcc);
    const roundedHeading = effectiveHeading !== null ? Math.round(effectiveHeading) : null;

    const selfSignature = `${userDisplayName}|${userIcon}|${selfSignalInfo.isLowSignal}|${isServerLive}|${roundedAcc}|${roundedHeading !== null}`;

    const myIcon = L.divIcon({
      className: 'beacon-google-blue-dot-marker',
      html: `
        <div class="relative flex items-center justify-center w-20 h-20 pointer-events-none cursor-pointer">
          <div class="beacon-self-heading-cone absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-150 ease-out" style="transform: rotate(${visualAngle}deg);">
            <svg class="absolute -top-7 w-28 h-28 overflow-visible pointer-events-none opacity-85" viewBox="0 0 100 100">
              <defs>
                <radialGradient id="googleBlueDotBeam" cx="50%" cy="100%" r="90%">
                  <stop offset="0%" stop-color="rgba(66, 133, 244, 0.6)" />
                  <stop offset="45%" stop-color="rgba(66, 133, 244, 0.22)" />
                  <stop offset="85%" stop-color="rgba(66, 133, 244, 0.05)" />
                  <stop offset="100%" stop-color="rgba(66, 133, 244, 0)" />
                </radialGradient>
              </defs>
              <path d="M 50 95 L 14 18 A 66 66 0 0 1 86 18 Z" fill="url(#googleBlueDotBeam)" />
            </svg>
            <div class="absolute -top-3.5 flex flex-col items-center">
              <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[11px] border-b-[#1a73e8] drop-shadow-[0_0_6px_rgba(26,115,232,0.9)]"></div>
            </div>
          </div>

          <div class="relative w-8 h-8 rounded-full bg-gradient-to-tr from-[#1557b0] to-[#4285f4] border-[3px] ${selfSignalInfo.isLowSignal ? 'border-amber-300' : 'border-white'} shadow-[0_2px_10px_rgba(0,0,0,0.4)] flex items-center justify-center pointer-events-auto group hover:scale-110 transition-transform">
            ${user?.markerIcon && user.markerIcon !== 'person' ? `
              <span class="text-xs text-white drop-shadow">${userRoleEmoji}</span>
            ` : `
              <div class="w-2.5 h-2.5 rounded-full bg-white shadow-xs"></div>
            `}
          </div>

          <!-- Direction, Accuracy ±X m & Server-Verified Live Badge -->
          <div class="absolute -bottom-2 px-2.5 py-0.5 bg-slate-900/90 text-[10px] text-white font-bold rounded-full shadow-md border ${selfSignalInfo.isLowSignal ? 'border-amber-400/60' : 'border-white/20'} flex items-center gap-1 pointer-events-auto whitespace-nowrap">
            <span class="w-1.5 h-1.5 rounded-full ${isServerLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}"></span>
            <span>${userDisplayName}</span>
            ${isServerLive ? `<span class="text-emerald-300 font-mono text-[9px]">· Live</span>` : ''}
            <span class="text-sky-300 font-mono text-[9px]">· Accuracy ±${roundedAcc} m</span>
            ${roundedHeading !== null ? `<span class="beacon-self-heading-text text-blue-300 font-mono text-[9px]">· ${roundedHeading}°</span>` : ''}
          </div>
        </div>
      `,
      iconSize: [80, 80],
      iconAnchor: [40, 40],
    });

    const selfTarget: MarkerContextMenuTarget = {
      type: 'self',
      title: `${user?.fullName || 'You'} (Your Location)`,
      subtitle: `Accuracy ±${roundedAcc} m${isServerLive ? ' · Live' : ''}`,
      lat: markerCoords[0],
      lng: markerCoords[1],
      avatarUrl: user?.avatarUrl,
      heading: effectiveHeading,
    };

    if (!myMarkerRef.current) {
      // Step 3d: Leaflet L.marker([lat, lng]) - Non-draggable real GPS marker
      myMarkerRef.current = L.marker(markerCoords, {
        icon: myIcon,
        zIndexOffset: 1000,
        draggable: false,
      }).addTo(map);
      selfIconSignatureRef.current = selfSignature;
      myMarkerRef.current.on('click', () => {
        setSelectedUser(myLocation);
      });
      attachMarkerLongPress(myMarkerRef.current, selfTarget);
    } else {
      animateMarkerPosition(myMarkerRef.current, markerCoords[0], markerCoords[1], 'my_marker');
      if (selfIconSignatureRef.current !== selfSignature) {
        selfIconSignatureRef.current = selfSignature;
        myMarkerRef.current.setIcon(myIcon);
        attachMarkerLongPress(myMarkerRef.current, selfTarget);
      } else {
        const el = myMarkerRef.current.getElement();
        if (el) {
          const cone = el.querySelector('.beacon-self-heading-cone') as HTMLElement | null;
          if (cone) {
            cone.style.transform = `rotate(${visualAngle}deg)`;
          }
          if (roundedHeading !== null) {
            const headingText = el.querySelector('.beacon-self-heading-text') as HTMLElement | null;
            if (headingText) {
              headingText.textContent = `· ${roundedHeading}°`;
            }
          }
        }
      }
    }
  }, [myLocation, user?.avatarUrl, user?.fullName, hasCenteredOnce, bearing]);

  // Update Peer Map Markers (Steps 3d, 3g)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentMarkers = userMarkersRef.current;
    const currentCircles = userAccuracyCirclesRef.current;
    // Clear any existing peer accuracy circles
    for (const [, circle] of currentCircles.entries()) {
      map.removeLayer(circle);
    }
    currentCircles.clear();

    const activePeerIds = new Set<string>();

    for (const peerLoc of displayedUserLocations) {
      if (peerLoc.userId === user?.id) continue;
      if (!Number.isFinite(peerLoc.latitude) || !Number.isFinite(peerLoc.longitude)) continue;
      const peerAcc = Number(peerLoc.accuracy_m ?? peerLoc.accuracy ?? 50);
      if (!Number.isFinite(peerAcc) || peerAcc <= 0 || peerAcc > 5000) continue;

      activePeerIds.add(peerLoc.userId);

      const peerCoords: [number, number] = [peerLoc.latitude, peerLoc.longitude];
      const isOnline = onlineUserIds.includes(peerLoc.userId);
      const peerSignalInfo = getGpsSignalInfo(peerAcc);
      const peerUpdatedIso = peerLoc.updated_at || peerLoc.timestamp;
      const peerAgeMs = peerUpdatedIso ? Date.now() - Date.parse(peerUpdatedIso) : Infinity;
      const isPeerLive = Number.isFinite(peerAgeMs) && peerAgeMs < 120000; // Step 3g: under 2 minutes old

      let distText = '';
      if (myLocation) {
        const m = calculateDistanceMeters(
          myLocation.latitude,
          myLocation.longitude,
          peerLoc.latitude,
          peerLoc.longitude
        );
        distText = formatDistance(m);
      }

      const peerHeading = peerLoc.heading;
      const peerVisualAngle =
        peerHeading != null && !isNaN(peerHeading)
          ? ((peerHeading - bearing) % 360 + 360) % 360
          : null;

      const overrides = getCustomMemberOverrides();
      const peerOverride = overrides[peerLoc.userId];

      const peerColor = peerOverride?.color || peerLoc.markerColor || '#10b981';
      const peerIconId = peerOverride?.icon || peerLoc.markerIcon || 'person';
      const peerRoleEmoji = getMemberIconEmoji(peerIconId);
      const peerDisplayName = peerOverride?.nickname || peerLoc.fullName.split(' ')[0];

      const isCompactPeer = lodState.compactPeerMarkers;
      const peerStructuralSignature = `${peerLoc.avatarUrl}|${peerLoc.fullName}|${peerDisplayName}|${peerColor}|${peerIconId}|${peerSignalInfo.isLowSignal}|${isPeerLive}|${Math.round(peerAcc)}|${peerVisualAngle !== null}|${Boolean(distText)}|${isCompactPeer ? 'compact' : 'full'}`;

      const peerHtml = isCompactPeer
        ? `
          <div class="relative flex items-center justify-center cursor-pointer" title="${peerLoc.fullName}">
            <div class="w-8 h-8 rounded-full overflow-hidden bg-slate-900 border-2" style="border-color: ${isPeerLive ? '#00D6A0' : peerColor};">
              <img src="${peerLoc.avatarUrl}" class="w-full h-full object-cover" alt="${peerLoc.fullName}" decoding="async" />
            </div>
            <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-slate-950" style="background-color: ${isPeerLive ? '#00D6A0' : '#FF4FA3'};"></span>
          </div>
        `
        : `
          <div class="group relative flex flex-col items-center cursor-pointer hover:scale-105 transition-transform">
            ${peerVisualAngle !== null ? `
              <div class="beacon-peer-heading-cone absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-150" style="transform: rotate(${Math.round(peerVisualAngle)}deg);">
                <div class="absolute -top-3 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[9px]" style="border-bottom-color: ${peerColor}; filter: drop-shadow(0 0 4px ${peerColor});"></div>
              </div>
            ` : ''}
            <div class="relative w-11 h-11 rounded-full p-[2.5px] shadow-lg" style="background: ${isPeerLive ? 'linear-gradient(135deg, #00D6A0 0%, #00D9FF 50%, #8957FF 100%)' : 'linear-gradient(135deg, #8957FF 0%, #FF4FA3 50%, #FF8066 100%)'}; box-shadow: 0 4px 14px rgba(137, 87, 255, 0.45);">
              <div class="w-full h-full rounded-full overflow-hidden bg-slate-900 border border-white/80">
                <img src="${peerLoc.avatarUrl}" class="w-full h-full object-cover" alt="${peerLoc.fullName}" decoding="async" />
              </div>
              <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-950" style="background-color: ${isPeerLive ? '#00D6A0' : '#FF4FA3'};"></span>
            </div>
            ${peerIconId !== 'person' ? `
              <div class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-900 border border-white text-[10px] flex items-center justify-center shadow">
                <span>${peerRoleEmoji}</span>
              </div>
            ` : ''}
            <div class="mt-1 px-2.5 py-0.5 bg-[#120C29] text-[10px] text-white font-bold rounded-full shadow-lg border border-[#8957FF]/45 flex items-center gap-1 whitespace-nowrap ${peerSignalInfo.isLowSignal ? 'border-amber-400/60' : ''}">
              <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${isPeerLive ? '#00D6A0' : '#94a3b8'};"></span>
              <span>${peerRoleEmoji !== '👤' ? `${peerRoleEmoji} ` : ''}${peerDisplayName}</span>
              ${isPeerLive ? `<span class="text-[#00D6A0] font-mono text-[9px] font-extrabold">· LIVE</span>` : ''}
              ${distText ? `<span class="text-white/40">·</span><span class="beacon-peer-dist-text text-[#00D9FF] font-extrabold">${distText}</span>` : ''}
              <span class="text-[#E9DFFF] font-mono text-[9px]">· ±${Math.round(peerAcc)}m</span>
              ${peerHeading != null ? `<span class="beacon-peer-heading-text text-[#FFD166] font-mono text-[9px]">· ${Math.round(peerHeading)}°</span>` : ''}
            </div>
          </div>
        `;

      const peerIcon = L.divIcon({
        className: 'beacon-peer-marker',
        html: peerHtml,
        iconSize: isCompactPeer ? [32, 32] : [40, 56],
        iconAnchor: isCompactPeer ? [16, 16] : [20, 20],
      });

      const peerTarget: MarkerContextMenuTarget = {
        type: 'peer',
        userId: peerLoc.userId,
        title: peerLoc.fullName,
        subtitle: `@${peerLoc.username}${distText ? ` · ${distText}` : ''} · Accuracy ±${Math.round(peerAcc)} m`,
        lat: peerCoords[0],
        lng: peerCoords[1],
        avatarUrl: peerLoc.avatarUrl,
        isOnline,
        distanceText: distText,
        heading: peerHeading,
      };

      const clusterLayer = markerClusterGroupRef.current;

      if (!currentMarkers.has(peerLoc.userId)) {
        // Step 3d: Leaflet L.marker([lat, lng]) added to MarkerClusterGroup
        const marker = L.marker(peerCoords, { icon: peerIcon });
        if (clusterLayer) {
          clusterLayer.addLayer(marker);
        } else {
          marker.addTo(map);
        }
        peerIconHtmlMapRef.current.set(peerLoc.userId, peerStructuralSignature);
        marker.on('click', () => {
          setSelectedUser(peerLoc);
        });
        attachMarkerLongPress(marker, peerTarget);
        currentMarkers.set(peerLoc.userId, marker);
      } else {
        const existingMarker = currentMarkers.get(peerLoc.userId)!;
        animateMarkerPosition(existingMarker, peerCoords[0], peerCoords[1], peerLoc.userId);
        if (peerIconHtmlMapRef.current.get(peerLoc.userId) !== peerStructuralSignature) {
          peerIconHtmlMapRef.current.set(peerLoc.userId, peerStructuralSignature);
          existingMarker.setIcon(peerIcon);
          attachMarkerLongPress(existingMarker, peerTarget);
          if (clusterLayer) {
            try {
              clusterLayer.refreshClusters(existingMarker);
            } catch {
              // ignore
            }
          }
        } else {
          const el = existingMarker.getElement();
          if (el) {
            if (peerVisualAngle !== null) {
              const cone = el.querySelector('.beacon-peer-heading-cone') as HTMLElement | null;
              if (cone) cone.style.transform = `rotate(${Math.round(peerVisualAngle)}deg)`;
            }
            if (distText) {
              const distEl = el.querySelector('.beacon-peer-dist-text') as HTMLElement | null;
              if (distEl && distEl.textContent !== distText) distEl.textContent = distText;
            }
            if (peerHeading != null) {
              const headEl = el.querySelector('.beacon-peer-heading-text') as HTMLElement | null;
              const nextHeadStr = `· ${Math.round(peerHeading)}°`;
              if (headEl && headEl.textContent !== nextHeadStr) headEl.textContent = nextHeadStr;
            }
          }
        }
      }
    }

    const clusterLayer = markerClusterGroupRef.current;
    for (const [userId, marker] of currentMarkers.entries()) {
      if (!activePeerIds.has(userId)) {
        const activeAnim = markerAnimationsRef.current.get(userId);
        if (activeAnim) {
          activeAnim.stop();
          markerAnimationsRef.current.delete(userId);
        }
        if (clusterLayer) {
          clusterLayer.removeLayer(marker);
        } else {
          map.removeLayer(marker);
        }
        currentMarkers.delete(userId);
        peerIconHtmlMapRef.current.delete(userId);
      }
    }

    for (const [userId, circle] of currentCircles.entries()) {
      if (!activePeerIds.has(userId)) {
        if (peerCircleAnimationFramesRef.current.has(userId)) {
          cancelAnimationFrame(peerCircleAnimationFramesRef.current.get(userId)!);
          peerCircleAnimationFramesRef.current.delete(userId);
        }
        map.removeLayer(circle);
        currentCircles.delete(userId);
      }
    }
  }, [
    displayedUserLocations,
    onlineUserIds,
    myLocation,
    user?.id,
    bearing,
    memberOverridesVersion,
    lodState.compactPeerMarkers,
  ]);

  const [roomGeofencesMapTick, setRoomGeofencesMapTick] = useState<number>(0);
  useEffect(() => {
    const onUpdated = () => setRoomGeofencesMapTick((t) => t + 1);
    window.addEventListener('beacon:room-geofences-updated', onUpdated);
    return () => window.removeEventListener('beacon:room-geofences-updated', onUpdated);
  }, []);

  // Update Saved Places Markers & Room Saved-Place Geofence Perimeter Circles (Managed by LOD)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    savedPlacesMarkersRef.current.forEach((m) => map.removeLayer(m));
    savedPlacesMarkersRef.current = [];
    savedPlacesCirclesRef.current.forEach((c) => map.removeLayer(c));
    savedPlacesCirclesRef.current = [];

    if (!lodState.showSavedPlaces) {
      return;
    }

    const activeRoomGeofences = loadRoomGeofences().filter((g) => g.enabled);

    savedPlaces.forEach((place) => {
      const latLng = L.latLng(place.latitude, place.longitude);
      const matchingRoomGeofence =
        activeRoomGeofences.find(
          (g) =>
            g.placeId === place.id &&
            (!effectiveRoom || g.roomId === effectiveRoom.id)
        ) || activeRoomGeofences.find((g) => g.placeId === place.id);

      const colorHex = matchingRoomGeofence?.color || place.markerColor || '#f59e0b';
      const effectiveRadius = Number(
        matchingRoomGeofence?.radiusMeters || place.radiusMeters || 150
      );
      const iconEmoji = getLocationTypeEmoji(place.markerIcon || place.category);

      if (effectiveRadius > 0) {
        const geofenceCircle = L.circle(latLng, {
          radius: effectiveRadius,
          color: colorHex,
          weight: matchingRoomGeofence ? 2.5 : 1.5,
          fillColor: colorHex,
          fillOpacity: matchingRoomGeofence ? 0.16 : 0.08,
          dashArray: matchingRoomGeofence ? undefined : '5, 5',
        }).addTo(map);
        savedPlacesCirclesRef.current.push(geofenceCircle);
      }

      const showLabel = lodState.showSavedPlaceLabels;
      const placeIcon = L.divIcon({
        className: 'beacon-place-marker',
        html: `
          <div class="flex flex-col items-center cursor-pointer group hover:scale-110 transition-transform">
            <div class="w-8 h-8 rounded-2xl text-white flex items-center justify-center shadow-lg border-2 border-white text-sm" style="background-color: ${colorHex}">
              <span>${iconEmoji}</span>
            </div>
            ${
              showLabel
                ? `<span class="mt-0.5 px-2 py-0.5 bg-slate-900/90 text-[10px] text-white font-bold rounded shadow-md border border-white/10 whitespace-nowrap max-w-[130px] truncate">
                    ${place.name}${matchingRoomGeofence ? ` · ${effectiveRadius}m` : ''}
                  </span>`
                : ''
            }
          </div>
        `,
        iconSize: showLabel ? [32, 50] : [32, 32],
        iconAnchor: showLabel ? [16, 25] : [16, 16],
      });

      const marker = L.marker(latLng, { icon: placeIcon }).addTo(map);
      const removeBtnId = `remove-saved-place-${mapUid}-${place.id}`;
      marker.bindPopup(`
        <div class="p-2">
          <p class="font-bold text-sm text-slate-900">${place.name}</p>
          <p class="text-xs text-slate-600">${place.description || 'Saved location'}</p>
          <p class="text-[10px] text-slate-500 mt-1 font-semibold">
            Geofence radius: ${effectiveRadius} m ${
              matchingRoomGeofence
                ? `· Room Geofence Active (${matchingRoomGeofence.roomName})`
                : ''
            }
          </p>
          <button id="${removeBtnId}" class="mt-2 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer">
            Remove from Wishlist
          </button>
        </div>
      `);
      marker.on('popupopen', () => {
        const removeBtn = document.getElementById(removeBtnId);
        if (removeBtn) {
          removeBtn.onclick = async () => {
            try {
              await api.delete(`/api/saved-places/${place.id}`);
              marker.closePopup();
              onRefreshSavedPlaces?.();
              toast.success(`Removed "${place.name}" from Wishlist`);
            } catch (err: any) {
              toast.error(err.message || 'Failed to remove place');
            }
          };
        }
      });
      attachMarkerLongPress(marker, {
        type: 'place',
        placeId: place.id,
        title: place.name,
        subtitle: place.description || `Radius: ${effectiveRadius}m`,
        lat: place.latitude,
        lng: place.longitude,
        radiusMeters: effectiveRadius,
      });
      savedPlacesMarkersRef.current.push(marker);
    });
  }, [
    savedPlaces,
    roomGeofencesMapTick,
    effectiveRoom?.id,
    lodState.showSavedPlaces,
    lodState.showSavedPlaceLabels,
  ]);

  // Location Geocoding Search
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (val.trim().length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await api.get<{ results: SearchResult[] }>(
          `/api/locations/search?q=${encodeURIComponent(val)}`
        );
        setSearchResults(res.results || []);
        setShowSearchDropdown(true);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const handleSelectSearchResult = (result: SearchResult) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    setShowSearchDropdown(false);
    setSearchQuery(result.name);

    const latLng = L.latLng(result.lat, result.lon);
    map.flyTo(latLng, 16, { duration: 1.5 });

    if (searchMarkerRef.current) {
      map.removeLayer(searchMarkerRef.current);
    }

    const pin = L.marker(latLng).addTo(map);
    pin.bindPopup(`
      <div class="p-2">
        <p class="font-bold text-sm">${result.name}</p>
        <p class="text-xs text-slate-600">${result.display_name}</p>
        <button id="save-searched-place" class="mt-2 px-2.5 py-1 bg-slate-900 text-white rounded text-xs font-semibold">
          Save Location
        </button>
      </div>
    `).openPopup();

    searchMarkerRef.current = pin;

    // Attach click listener for save button in popup
    setTimeout(() => {
      const btn = document.getElementById('save-searched-place');
      if (btn && onAddPlaceAtCoords) {
        btn.onclick = () => {
          onAddPlaceAtCoords(result.lat, result.lon);
          pin.closePopup();
        };
      }
    }, 200);
  };

  const handleClearNavigationRoute = () => {
    const map = mapInstanceRef.current;
    if (map) {
      if (routePolylineRef.current) {
        map.removeLayer(routePolylineRef.current);
        routePolylineRef.current = null;
      }
      if (routeGlowPolylineRef.current) {
        map.removeLayer(routeGlowPolylineRef.current);
        routeGlowPolylineRef.current = null;
      }
    }
    setActiveRouteData(null);
    toast.info('Navigation route cleared');
  };

  const handleSelectPlaceFromExplorer = (place: PlaceResult) => {
    setSearchQuery(place.name);
    setShowPlacesPage(false);
    setShowSearchDropdown(false);

    const map = mapInstanceRef.current;
    if (!map) return;

    const latLng = L.latLng(place.lat, place.lon);
    map.flyTo(latLng, 17, { duration: 1.2 });

    if (searchMarkerRef.current) {
      map.removeLayer(searchMarkerRef.current);
    }

    const placeIcon = L.divIcon({
      className: 'beacon-google-place-marker',
      html: `
        <div class="relative flex flex-col items-center cursor-pointer animate-pop-in">
          <div class="absolute -inset-2 rounded-full bg-sky-500/30 animate-ping"></div>
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-2xl border-2 border-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div class="mt-1 px-2.5 py-1 bg-slate-900/95 backdrop-blur-md text-xs font-bold text-white rounded-xl shadow-lg border border-white/20 whitespace-nowrap">
            ${place.name}
          </div>
        </div>
      `,
      iconSize: [40, 60],
      iconAnchor: [20, 30],
    });

    const pin = L.marker(latLng, { icon: placeIcon }).addTo(map);
    searchMarkerRef.current = pin;

    attachMarkerLongPress(pin, {
      type: 'coord',
      title: place.name,
      subtitle: place.display_name,
      lat: place.lat,
      lng: place.lon,
    });

    toast.success(`Showing ${place.name} on map`);
  };

  const handleClearNearbyPois = () => {
    const map = mapInstanceRef.current;
    if (map && nearbyPoiMarkersRef.current.length > 0) {
      nearbyPoiMarkersRef.current.forEach((marker) => map.removeLayer(marker));
    }
    nearbyPoiMarkersRef.current = [];
    setNearbyPoisOnMap([]);
  };

  const handleShowNearbyPlacesOnMap = (places: PlaceResult[]) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    handleClearNearbyPois();
    setNearbyPoisOnMap(places);

    const newMarkers: L.Marker[] = [];
    const bounds = L.latLngBounds([]);

    if (myLocation) {
      bounds.extend(L.latLng(myLocation.latitude, myLocation.longitude));
    }

    places.forEach((place) => {
      const latLng = L.latLng(place.lat, place.lon);
      bounds.extend(latLng);

      let badgeBg = 'bg-sky-600';
      if (place.category?.includes('fuel') || place.type?.includes('fuel')) badgeBg = 'bg-amber-600';
      else if (place.category?.includes('food') || place.category?.includes('restaurant')) badgeBg = 'bg-rose-600';
      else if (place.category?.includes('cafe')) badgeBg = 'bg-amber-700';
      else if (place.category?.includes('hospital') || place.category?.includes('health')) badgeBg = 'bg-red-600';
      else if (place.category?.includes('park')) badgeBg = 'bg-emerald-600';
      else if (place.category?.includes('supermarket') || place.category?.includes('shop')) badgeBg = 'bg-teal-600';

      const iconHtml = `
        <div class="relative flex flex-col items-center cursor-pointer group hover:scale-110 transition-transform">
          <div class="w-8 h-8 rounded-xl ${badgeBg} text-white flex items-center justify-center shadow-lg border-2 border-white/90">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div class="mt-0.5 px-2 py-0.5 bg-slate-900/90 backdrop-blur text-[10px] font-bold text-white rounded-lg shadow-md border border-white/10 whitespace-nowrap max-w-[120px] truncate">
            ${place.name}
          </div>
        </div>
      `;

      const markerIcon = L.divIcon({
        className: 'beacon-nearby-poi-marker',
        html: iconHtml,
        iconSize: [32, 48],
        iconAnchor: [16, 24],
      });

      const poiMarker = L.marker(latLng, { icon: markerIcon }).addTo(map);

      poiMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; color: #0f172a; min-width: 180px;">
          <div style="font-weight: 700; font-size: 13px; margin-bottom: 2px;">${place.name}</div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${place.display_name}</div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #0284c7; margin-bottom: 8px;">
            <span>${place.distanceMeters ? formatDistance(place.distanceMeters) : ''}</span>
            <span>${place.rating ? '★ ' + place.rating : ''}</span>
          </div>
          <button id="poi-nav-${place.id}" style="width: 100%; background: #0284c7; color: white; border: none; padding: 6px; border-radius: 8px; font-weight: 700; cursor: pointer; margin-bottom: 4px;">
            Start Route
          </button>
        </div>
      `);

      poiMarker.on('popupopen', () => {
        const btn = document.getElementById('poi-nav-' + place.id);
        if (btn) {
          btn.onclick = () => {
            poiMarker.closePopup();
            startNavigation(place.lat, place.lon, place.name);
          };
        }
      });

      attachMarkerLongPress(poiMarker, {
        type: 'coord',
        title: place.name,
        subtitle: place.display_name,
        lat: place.lat,
        lng: place.lon,
        distanceText: place.distanceMeters ? formatDistance(place.distanceMeters) : undefined,
      });

      newMarkers.push(poiMarker);
    });

    nearbyPoiMarkersRef.current = newMarkers;

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  };

  // Toggle Nearby POI Markers visibility when zooming in/out according to LOD Manager
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || nearbyPoiMarkersRef.current.length === 0) return;

    nearbyPoiMarkersRef.current.forEach((marker) => {
      if (lodState.showNearbyPoiPins) {
        if (!map.hasLayer(marker)) {
          marker.addTo(map);
        }
      } else {
        if (map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      }
    });
  }, [lodState.showNearbyPoiPins, nearbyPoisOnMap]);

  const handleStartRouteOnMap = (route: RouteData, destination: PlaceResult) => {
    setShowPlacesPage(false);
    setActiveRouteData(route);

    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing route polylines
    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }
    if (routeGlowPolylineRef.current) {
      map.removeLayer(routeGlowPolylineRef.current);
      routeGlowPolylineRef.current = null;
    }

    if (route.geometry && Array.isArray(route.geometry.coordinates)) {
      const latLngs = route.geometry.coordinates.map((coord: [number, number]) =>
        L.latLng(coord[1], coord[0])
      );

      // Glow line
      routeGlowPolylineRef.current = L.polyline(latLngs, {
        color: '#38bdf8',
        weight: 9,
        opacity: 0.45,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      // Main line
      routePolylineRef.current = L.polyline(latLngs, {
        color: '#0284c7',
        weight: 4.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      map.fitBounds(routePolylineRef.current.getBounds(), { padding: [80, 80], maxZoom: 18 });
      toast.success(
        `Navigation route active: ~${Math.round(route.durationSeconds / 60)} mins to ${destination.name}`
      );
    }
  };

  const centerOnMyLocation = () => {
    setIsRecenteringGps(true);
    pendingCenterOnNextFixRef.current = true;

    // 1. Trigger context-level GPS update (handles both Android native bridge & Web geolocation)
    requestLocationUpdate();

    // 2. Immediately center on current known GPS position if available while fresh hardware fix is being acquired
    if (mapInstanceRef.current && myLocation && Number.isFinite(myLocation.latitude) && Number.isFinite(myLocation.longitude)) {
      const map = mapInstanceRef.current;
      lastAutoFollowedCoordsRef.current = {
        lat: myLocation.latitude,
        lng: myLocation.longitude,
      };
      const targetZoom = Math.max(Math.round(map.getZoom()), 17);
      recenterMapCleanly(map, myLocation.latitude, myLocation.longitude, targetZoom, {
        forceLayerRefresh: false,
        animate: true,
      });
    }

    // 3. Explicitly trigger a fresh, uncached hardware GPS location fetch and recenter the map view upon arrival
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsRecenteringGps(false);
          const freshLat = pos.coords.latitude;
          const freshLng = pos.coords.longitude;
          const freshAcc = Math.round(Number(pos.coords.accuracy || 15));

          if (!Number.isFinite(freshLat) || !Number.isFinite(freshLng)) return;

          lastAutoFollowedCoordsRef.current = { lat: freshLat, lng: freshLng };
          pendingCenterOnNextFixRef.current = false;
          setHasCenteredOnce(true);

          if (mapInstanceRef.current) {
            const map = mapInstanceRef.current;
            const targetZoom = Math.max(Math.round(map.getZoom()), 17);
            recenterMapCleanly(map, freshLat, freshLng, targetZoom, {
              forceLayerRefresh: false,
              animate: true,
            });
          }

          window.dispatchEvent(
            new CustomEvent('beacon:gps-fix', {
              detail: {
                latitude: freshLat,
                longitude: freshLng,
                accuracy: freshAcc,
                heading: pos.coords.heading,
                speed: pos.coords.speed,
                isRealGps: true,
                forceCenter: true,
              },
            })
          );

          toast.success(
            `Recentered on your fresh GPS location (${freshLat.toFixed(5)}, ${freshLng.toFixed(5)} · Accuracy ±${freshAcc} m)`
          );
        },
        () => {
          setIsRecenteringGps(false);
          if (mapInstanceRef.current && myLocation) {
            const acc = Math.round(Number(myLocation.accuracy_m ?? myLocation.accuracy ?? 15));
            toast.success(
              `Centered on your live location (${myLocation.latitude.toFixed(5)}, ${myLocation.longitude.toFixed(5)} · Accuracy ±${acc} m)`
            );
          } else {
            toast.info(locationStatus || 'Waiting for GPS signal...');
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        }
      );
    } else {
      window.setTimeout(() => setIsRecenteringGps(false), 800);
      if (myLocation) {
        const acc = Math.round(Number(myLocation.accuracy_m ?? myLocation.accuracy ?? 15));
        toast.success(
          `Centered on your live location (${myLocation.latitude.toFixed(5)}, ${myLocation.longitude.toFixed(5)} · Accuracy ±${acc} m)`
        );
      } else {
        toast.info(locationStatus || 'Waiting for location');
      }
    }
  };

  const fixAgeSeconds =
    debugTelemetry.rawFix?.timestamp != null
      ? Math.max(0, (debugNowMs - debugTelemetry.rawFix.timestamp) / 1000).toFixed(1)
      : null;

  return (
    <div
      className="relative w-full h-full flex flex-col overflow-hidden bg-[#cbd5e1] select-none touch-manipulation"
    >
      {/* Keep map markers and user avatars upright when map rotation bearing is non-zero */}
      {bearing !== 0 && (
        <style>{`
          .beacon-self-marker > div,
          .beacon-peer-marker > div,
          .beacon-user-cluster-marker > div,
          .custom-geofence-label-pin > div {
            transform: rotate(${-bearing}deg);
            transition: ${isGesturing ? 'none' : 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)'};
          }
        `}</style>
      )}

      {/* Dedicated Map Gesture Layer - isolates touch-none to the map canvas so floating buttons & popovers work smoothly */}
      <div
        ref={gestureAreaRef}
        className="absolute inset-0 overflow-hidden z-0 touch-none"
        style={{ touchAction: 'none' }}
      >
        {/* Map Stage Wrapper — uses exact 100% 1:1 pixel alignment when North-up 2D (zero GPU subpixel blur), and expands when rotated or in 3D Tilt mode */}
        <div
          ref={rotatableWrapperRef}
          className="absolute origin-center"
          style={
            bearing === 0 && !is3dMode && !isGesturing
              ? {
                  width: '100%',
                  height: '100%',
                  left: '0%',
                  top: '0%',
                  transform: 'none',
                  transition: 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
                }
              : {
                  width: '166%',
                  height: '166%',
                  left: '-33%',
                  top: '-33%',
                  transform: is3dMode
                    ? `perspective(1200px) rotateX(40deg) rotateZ(${bearing}deg) scale(1.12)`
                    : `rotate(${bearing}deg)`,
                  transformOrigin: '50% 50%',
                  transition: isGesturing ? 'none' : 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
                }
          }
        >
          {/* Map Canvas with True HD 2x Retina + SVG Unsharp Mask Optical Clarity */}
          <div
            ref={mapContainerRef}
            className={`w-full h-full z-0 ${
              isHdrEnabled
                ? `beacon-map-hdr beacon-map-hdr-${mapMode} beacon-hdr-preset-${hdrPreset}`
                : ''
            }`}
          />
        </div>

        {/* 3D Horizon Sky Depth Gradient when 3D Mode is active */}
        {is3dMode && (
          <div className="absolute top-0 left-0 right-0 h-28 beacon-3d-horizon z-10 pointer-events-none" />
        )}
      </div>


      {/* STEP 1: Live Geolocation Debug Panel (Temporary, hidden behind ?debug=1) */}
      {isDebugMode && (
        <div
          data-testid="location-debug-panel"
          className="absolute bottom-20 left-4 z-40 w-[350px] max-w-[calc(100vw-2rem)] bg-slate-950/95 backdrop-blur-md text-slate-100 border border-sky-500/50 rounded-2xl p-3 shadow-2xl font-mono text-[11px] space-y-2 pointer-events-auto"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-bold text-sky-400 uppercase tracking-wider text-xs">
              GPS Debug Panel (?debug=1)
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-emerald-300">
              {locationStatus}
            </span>
          </div>

          <div className="space-y-1 text-[10.5px]">
            <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
              <div className="text-slate-400 font-semibold">1. Raw Fix (navigator.geolocation):</div>
              {debugTelemetry.rawFix ? (
                <div className="text-white">
                  lat: <span className="text-sky-300">{debugTelemetry.rawFix.latitude}</span>, lng:{' '}
                  <span className="text-sky-300">{debugTelemetry.rawFix.longitude}</span>
                  <br />
                  accuracy:{' '}
                  <span
                    className={
                      (debugTelemetry.rawFix.accuracy ?? 999) > 100
                        ? 'text-rose-400 font-bold'
                        : 'text-emerald-300'
                    }
                  >
                    {debugTelemetry.rawFix.accuracy != null
                      ? `${debugTelemetry.rawFix.accuracy} m`
                      : 'null'}
                  </span>{' '}
                  | ts: {debugTelemetry.rawFix.timestamp}
                  <br />
                  age (Date.now() - timestamp):{' '}
                  <span className="text-amber-300">{fixAgeSeconds}s</span> (
                  {Math.max(0, debugNowMs - debugTelemetry.rawFix.timestamp)} ms)
                </div>
              ) : (
                <div className="text-slate-500">Waiting for location...</div>
              )}
            </div>

            <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
              <div className="text-slate-400 font-semibold">2. Sent to Database:</div>
              {debugTelemetry.sentToDb ? (
                <div className="text-white break-all">
                  geog: <span className="text-emerald-300">{debugTelemetry.sentToDb.geog}</span>
                  <br />
                  accuracy_m: <span className="text-emerald-300">{debugTelemetry.sentToDb.accuracy_m}</span>{' '}
                  | lat: {debugTelemetry.sentToDb.latitude}, lng: {debugTelemetry.sentToDb.longitude}
                </div>
              ) : (
                <div className="text-slate-500">None sent (rejected or waiting)</div>
              )}
            </div>

            <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
              <div className="text-slate-400 font-semibold">3. Read Back from Database:</div>
              {debugTelemetry.readFromDb ? (
                <div className="text-white break-all">
                  lat: <span className="text-sky-300">{debugTelemetry.readFromDb.lat}</span>, lng:{' '}
                  <span className="text-sky-300">{debugTelemetry.readFromDb.lng}</span>, accuracy_m:{' '}
                  <span className="text-sky-300">{debugTelemetry.readFromDb.accuracy_m}</span>
                  <br />
                  updated_at: <span className="text-slate-300">{debugTelemetry.readFromDb.updated_at}</span>
                </div>
              ) : (
                <div className="text-slate-500">No DB record read back yet</div>
              )}
            </div>

            <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
              <div className="text-slate-400 font-semibold">4. [lat, lng] Passed to Map Marker:</div>
              {debugTelemetry.markerLatLng ? (
                <div className="text-emerald-300 font-bold">
                  [{debugTelemetry.markerLatLng[0]}, {debugTelemetry.markerLatLng[1]}]
                </div>
              ) : (
                <div className="text-amber-300">null (Waiting for location — no marker rendered)</div>
              )}
            </div>

            <div className="bg-slate-900/90 p-1.5 rounded border border-slate-800">
              <div className="text-slate-400 font-semibold">5. Last Geolocation Error:</div>
              {debugTelemetry.lastGeoError ? (
                <div className="text-rose-400">
                  code {debugTelemetry.lastGeoError.code}: {debugTelemetry.lastGeoError.message}
                </div>
              ) : (
                <div className="text-slate-500">None</div>
              )}
            </div>
          </div>

          {/* Step 4 Quick Verification Sensor Buttons */}
          <div className="pt-1 border-t border-slate-800 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() =>
                simulatePositionFix({
                  latitude: 48.8584,
                  longitude: 2.2945,
                  accuracy: 12,
                  timestamp: Date.now(),
                })
              }
              className="px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold cursor-pointer"
            >
              Test 48.8584, 2.2945 (±12m)
            </button>
            <button
              type="button"
              onClick={() =>
                simulatePositionFix({
                  latitude: -33.8688,
                  longitude: -70.6693,
                  accuracy: 15,
                  timestamp: Date.now(),
                })
              }
              className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold cursor-pointer"
            >
              Test -33.8688, -70.6693
            </button>
            <button
              type="button"
              onClick={() =>
                simulatePositionFix({
                  latitude: 37.7749,
                  longitude: -122.4194,
                  accuracy: 250,
                  timestamp: Date.now(),
                })
              }
              className="px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
            >
              Test Coarse ±250m (Reject)
            </button>
          </div>
        </div>
      )}

      {/* Floating Gesture, Bearing & LOD GPU Culling HUD - clean bottom-right placement above compass cluster */}
      {(isGesturing || bearing !== 0 || lodState.culledMarkersCount > 0) && (
        <div
          data-testid="map-lod-status-pill"
          className="absolute bottom-56 right-4 z-20 bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-2xl shadow-xl border border-slate-700/80 flex items-center gap-2 text-xs font-mono animate-in fade-in duration-150"
        >
          <Compass className="w-4 h-4 text-sky-400" style={{ transform: `rotate(${-bearing}deg)` }} />
          <div className="flex items-center gap-1.5">
            {bearing !== 0 && (
              <>
                <span className="font-bold text-white">{bearing}° {getCompassHeading(bearing)}</span>
                <span className="text-slate-400">·</span>
              </>
            )}
            <span className="text-sky-300 font-medium">Zoom {currentZoom.toFixed(1)}x</span>
            {lodState.culledMarkersCount > 0 && (
              <>
                <span className="text-slate-400">·</span>
                <span
                  className="text-emerald-300 font-sans font-bold text-[10.5px]"
                  title={`${lodState.tierLabel}: Hiding ${lodState.culledMarkersCount} non-essential markers at Zoom ${currentZoom.toFixed(1)}x to reduce GPU load`}
                >
                  LOD: {lodState.culledMarkersCount} hidden
                </span>
              </>
            )}
          </div>
          {lodState.culledMarkersCount > 0 && (
            <button
              type="button"
              onClick={() => {
                handleSelectLodMode('off');
                toast.info('LOD Culling disabled — Showing all map markers at every zoom level');
              }}
              title="Disable LOD culling and show all markers when zoomed out"
              className="ml-0.5 text-[10px] bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-200 border border-emerald-400/35 px-2 py-0.5 rounded-lg font-sans font-bold cursor-pointer transition-colors"
            >
              Show All
            </button>
          )}
          {bearing !== 0 && (
            <button
              onClick={resetNorth}
              title="Tap to Reset North"
              className="ml-0.5 text-[10px] bg-sky-500/30 hover:bg-sky-500/50 text-sky-200 px-2 py-0.5 rounded-lg font-sans font-bold cursor-pointer transition-colors"
            >
              Reset North
            </button>
          )}
        </div>
      )}

      {/* Top Floating Bar: Search + Near Me + Map Controls Popover Button */}
      <div className="absolute top-4 left-4 right-4 md:right-auto md:w-[460px] z-30 flex flex-col gap-2">
        {/* Waiting for Location / Geolocation Error Status Banner (No fake/default marker) */}
        {(!myLocation || gpsError || locationStatus !== 'Live') && (
          <div className="p-3 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-amber-500/40 shadow-2xl text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-white">
                  {!myLocation ? 'Waiting for location' : locationStatus}
                </div>
                {(gpsError || locationStatus !== 'Waiting for location') && (
                  <p className="text-[11px] text-amber-300 leading-snug mt-0.5">
                    {gpsError || locationStatus}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={requestLocationUpdate}
              className="px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold shrink-0 cursor-pointer active:scale-95 transition-all"
            >
              Retry GPS
            </button>
          </div>
        )}

        {/* Room Map Mode Banner & Room Members Roster Bar */}
        {roomOnlyMode && (
          <div className="p-2.5 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-sky-500/40 shadow-2xl text-white space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {onCloseRoomMap && (
                  <button
                    onClick={onCloseRoomMap}
                    className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0"
                    title="Back to Room"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="font-bold text-xs text-white truncate">
                      {effectiveRoom?.name || 'Room Map'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold font-mono shrink-0 border border-sky-400/30">
                      {roomUsersList.length} {roomUsersList.length === 1 ? 'Member' : 'Members'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={fitAllRoomMembersOnMap}
                className="px-2.5 py-1 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0 shadow-sm"
                title="Fit all room members on map"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Fit All</span>
              </button>
            </div>

            {/* Interactive Room Members Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {roomUsersList.map((member) => {
                const hasCoords = Boolean(
                  member.isMe
                    ? myLocation
                    : member.location &&
                      typeof member.location.latitude === 'number' &&
                      typeof member.location.longitude === 'number'
                );
                return (
                  <button
                    key={member.id}
                    onClick={() => {
                      if (member.isMe && myLocation) {
                        centerOnMyLocation();
                        setSelectedUser(myLocation);
                      } else if (member.location && mapInstanceRef.current) {
                        mapInstanceRef.current.flyTo(
                          [member.location.latitude, member.location.longitude],
                          17,
                          { animate: true, duration: 0.9 }
                        );
                        setSelectedUser(member.location);
                      } else {
                        toast.info(`${member.fullName} has not shared live GPS coordinates yet`);
                      }
                    }}
                    className={`px-2 py-1 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer active:scale-95 ${
                      hasCoords
                        ? 'bg-white/10 hover:bg-sky-500/25 border-white/15 hover:border-sky-400/50 text-white'
                        : 'bg-white/5 border-white/10 text-slate-400 opacity-75'
                    }`}
                    title={hasCoords ? `Locate ${member.fullName} on map` : `${member.fullName} (No live GPS)`}
                  >
                    <div className="relative w-4 h-4 shrink-0">
                      <img
                        src={member.avatarUrl}
                        alt={member.fullName}
                        className="w-4 h-4 rounded-full object-cover border border-white/30"
                      />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                          member.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                    </div>
                    <span className="truncate max-w-[90px]">
                      {member.isMe ? 'You' : member.fullName.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Route / Google Maps Turn-by-Turn Navigation HUD */}
        {activeRouteData && (
          <div className="p-3.5 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-sky-500/40 shadow-2xl text-white flex items-center justify-between gap-3 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 animate-pulse">
                <Navigation className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-white truncate">
                    {activeRouteData.destinationName || 'Destination'}
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 font-mono text-[9px] font-bold">
                    ~{Math.round(activeRouteData.durationSeconds / 60)} min
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 truncate mt-0.5">
                  {activeRouteData.steps?.[0]?.instruction || 'Proceed on route'} · {formatDistance(activeRouteData.distanceMeters)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setShowPlacesPage(true)}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                title="View full step-by-step route"
              >
                Steps
              </button>
              <button
                onClick={handleClearNavigationRoute}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="End Navigation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Nearby POIs Active HUD Banner */}
        {nearbyPoisOnMap.length > 0 && (
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-900/95 border border-sky-500/40 shadow-xl backdrop-blur-md animate-in slide-in-from-top-1 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <span className="text-white font-bold truncate">
                Showing {nearbyPoisOnMap.length} places near you
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowPlacesPage(true)}
                className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-[11px] cursor-pointer"
              >
                List
              </button>
              <button
                onClick={handleClearNearbyPois}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                title="Clear plotted places"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Search Input Box (Opens Dedicated Google Places Page on Click) */}
          <div className="relative flex-1">
            <div
              onClick={() => setShowPlacesPage(true)}
              className={`flex items-center gap-2 ${themeConfig.glassPanel} px-3.5 py-2.5 rounded-2xl shadow-xl border ${themeConfig.glassBorder} cursor-pointer group hover:bg-white/15 transition-all`}
            >
              <Search className="w-4 h-4 text-sky-400 shrink-0 group-hover:scale-110 transition-transform" />
              <input
                type="text"
                placeholder="Search address, landmark, or street..."
                value={searchQuery}
                readOnly
                onClick={() => setShowPlacesPage(true)}
                className={`w-full bg-transparent text-xs ${themeConfig.textPrimary} focus:outline-none placeholder-slate-400 font-medium cursor-pointer`}
              />
              <span className="px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 text-[10px] font-bold shrink-0 border border-sky-400/30 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                Google Places
              </span>
            </div>
          </div>

          {/* Location-Sharing Live Toggle Button (Screen 04 Spec) */}
          <button
            type="button"
            onClick={async () => {
              if (!user) return;
              const currentlySharing = user.privacy?.locationSharingEnabled !== false;
              const nextEnabled = !currentlySharing;
              try {
                await updatePrivacy({
                  locationVisibility:
                    nextEnabled && user.privacy.locationVisibility === 'nobody'
                      ? 'room_members'
                      : user.privacy.locationVisibility,
                  phoneVisibility: user.privacy.phoneVisibility,
                  profileVisibility: user.privacy.profileVisibility,
                  showOnlineStatus: user.privacy.showOnlineStatus,
                  locationSharingEnabled: nextEnabled,
                  temporarySharingExpiry: user.privacy.temporarySharingExpiry || null,
                });
                if (nextEnabled) {
                  requestLocationUpdate();
                  toast.success('Live location sharing enabled');
                } else {
                  toast.info('Live location sharing paused');
                }
              } catch (err: any) {
                toast.error(err?.message || 'Could not update location sharing');
              }
            }}
            title={
              user?.privacy?.locationSharingEnabled !== false
                ? 'Sharing Location (Tap to Pause)'
                : 'Location Paused (Tap to Resume)'
            }
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-2xl shadow-xl border font-bold text-xs cursor-pointer active:scale-95 transition-all shrink-0 ${
              user?.privacy?.locationSharingEnabled !== false
                ? 'bg-[#111D32]/95 border-[#19DCA5]/50 text-[#19DCA5] hover:bg-[#19DCA5]/20'
                : 'bg-[#111D32]/95 border-[#FFB547]/50 text-[#FFB547] hover:bg-[#FFB547]/20'
            }`}
          >
            <Radio
              className={`w-4 h-4 ${
                user?.privacy?.locationSharingEnabled !== false ? 'animate-pulse' : ''
              }`}
            />
            <span className="hidden sm:inline">
              {user?.privacy?.locationSharingEnabled !== false ? 'Sharing On' : 'Paused'}
            </span>
          </button>

          {/* Near Me Direct Shortcut Button */}
          <button
            onClick={() => setShowPlacesPage(true)}
            title="Explore Places Near Me"
            className="flex items-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-[#287BFF] to-[#00E5FF] hover:opacity-95 text-[#070B16] font-extrabold text-xs rounded-2xl shadow-xl border border-[#00E5FF]/40 cursor-pointer active:scale-95 transition-all shrink-0"
          >
            <Compass className="w-4 h-4" />
            <span className="hidden sm:inline">Near Me</span>
          </button>

          {/* Map Controls Pop Button */}
          <button
            onClick={() => {
              setShowMapControlsPop(!showMapControlsPop);
              setShowSearchDropdown(false);
            }}
            title="Map Views, Layers & Controls"
            className={`px-3 py-2.5 ${themeConfig.glassPanel} hover:bg-white/15 text-white rounded-2xl shadow-xl border ${themeConfig.glassBorder} flex items-center gap-1.5 shrink-0 transition-all cursor-pointer active:scale-95 ${
              showMapControlsPop ? 'ring-2 ring-sky-400 bg-white/20' : ''
            }`}
          >
            <Layers className="w-4 h-4 text-[#00E5FF]" />
            <span className="text-xs font-semibold hidden xs:inline sm:inline">
              {mapMode === 'standard'
                ? 'Standard Street'
                : mapMode === 'terrain'
                ? 'Terrain Topo'
                : mapMode === 'traffic'
                ? 'Live Traffic'
                : 'Satellite 2x HDR'}
            </span>
            {bearing !== 0 && (
              <span className="px-1.5 py-0.2 bg-sky-500 text-white rounded-full text-[9px] font-mono font-bold">
                {bearing}°
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform duration-200 ${showMapControlsPop ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Real-Time Runtime Tile Diagnostics Status Bar (Hidden unless debug mode is active) */}
        {isDebugMode && (
          <div
            data-testid="live-tile-diagnostics-bar"
            onClick={() => {
              setShowMapDiagnostics((prev) => {
                const next = !prev;
                if (next && probeRows.length === 0) {
                  runAllProvidersDiagnostic();
                }
                return next;
              });
            }}
            title="Tap to toggle full Map Runtime Diagnostics & HTTP Provider Probe Table"
            className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-1.5 bg-slate-950/88 hover:bg-slate-900/95 backdrop-blur-md border border-white/15 rounded-xl shadow-lg text-[10px] font-mono text-slate-200 cursor-pointer pointer-events-auto transition-colors"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-300">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    diagStats.loadedCount > 0
                      ? 'bg-emerald-400'
                      : diagStats.failedCount > 0
                      ? 'bg-rose-400 animate-pulse'
                      : 'bg-amber-400 animate-pulse'
                  }`}
                />
                <span className="truncate max-w-[140px] sm:max-w-[195px]" title={diagStats.providerName}>
                  {diagStats.providerName}
                </span>
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-sky-300 font-semibold uppercase">
                Layer: {diagStats.mode === 'standard' ? 'Street' : diagStats.mode}
              </span>
              <span className="text-slate-500">·</span>
              <span>
                Req: <strong className="text-white">{diagStats.requestedCount}</strong>
              </span>
              <span>
                Loaded: <strong className="text-emerald-400">{diagStats.loadedCount}</strong>
              </span>
              <span>
                DOM: <strong className="text-cyan-300">{diagStats.domVisibleTiles}</strong>
              </span>
              <span>
                Failed:{' '}
                <strong className={diagStats.failedCount > 0 ? 'text-rose-400' : 'text-slate-400'}>
                  {diagStats.failedCount}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`truncate max-w-[125px] sm:max-w-[165px] ${
                  diagStats.lastError ? 'text-amber-300' : 'text-emerald-300'
                }`}
                title={diagStats.lastError ? `${diagStats.lastHttpStatus} — ${diagStats.lastError}` : diagStats.lastHttpStatus}
              >
                {diagStats.lastHttpStatus}
              </span>
              <button
                type="button"
                data-testid="controlled-test-mode-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleControlledTestMode();
                }}
                className={`px-1.5 py-0.5 rounded text-[9px] font-sans font-bold cursor-pointer transition-colors ${
                  isControlledTestMode
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/40'
                }`}
                title="Toggle Controlled Test Mode (Isolate raw street tile layer without custom markers/UI)"
              >
                {isControlledTestMode ? 'Exit Test' : 'Test Map'}
              </button>
              <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] text-sky-300 font-sans font-bold">
                {showMapDiagnostics ? 'Hide Diag' : 'Diag'}
              </span>
            </div>
          </div>
        )}

        {/* Controlled Test Mode Active Banner */}
        {isControlledTestMode && (
          <div
            data-testid="controlled-test-mode-banner"
            className="flex items-center justify-between gap-2 px-3.5 py-2 bg-amber-950/95 backdrop-blur-xl border border-amber-400/60 rounded-2xl shadow-xl z-30 text-xs text-amber-100 pointer-events-auto"
          >
            <div className="min-w-0">
              <span className="font-extrabold text-amber-300 block">
                Controlled Test Mode Active (Isolated Default Leaflet TileLayer)
              </span>
              <span className="text-[10.5px] text-amber-200/90 block">
                Custom markers, overlays &amp; bottom controls temporarily isolated to verify raw street tiles.
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleControlledTestMode}
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-extrabold shrink-0 cursor-pointer"
            >
              Restore Full Map
            </button>
          </div>
        )}

        {/* Truthful Status Banner when Live Traffic is unavailable */}
        {mapMode === 'traffic' && (isLiveTrafficUnavailable || !diagStats.isOnline) && (
          <div
            data-testid="live-traffic-unavailable-banner"
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-950/92 backdrop-blur-xl border border-amber-400/40 rounded-2xl shadow-xl z-20 text-xs text-amber-200 pointer-events-auto"
          >
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-semibold">
              Live traffic unavailable — displaying standard street map without live traffic overlay.
            </span>
          </div>
        )}

        {/* STEP 4: DEVELOPER MAP DIAGNOSTIC SCREEN (Reports actual runtime tile telemetry & live HTTP probes) */}
        {showMapDiagnostics && (
          <div
            data-testid="map-diagnostic-panel"
            className="w-full max-w-[500px] bg-slate-950/95 backdrop-blur-xl border border-emerald-500/50 rounded-3xl shadow-2xl p-4 z-50 text-white font-mono text-[11px] space-y-3 max-h-[80vh] overflow-y-auto pointer-events-auto"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <h4 className="font-extrabold text-xs text-emerald-300 uppercase tracking-wider truncate">
                    Map Runtime Diagnostics (Dev Tool)
                  </h4>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                  Live tile telemetry, HTTP status codes &amp; multi-provider verification
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleForceRefreshTiles}
                  className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-300 text-[9.5px] font-bold flex items-center gap-1 cursor-pointer"
                  title="Flush and re-anchor map tile layer at current viewport"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Refresh Tiles</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyDiagnosticReport}
                  className="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 text-sky-300 text-[9.5px] font-bold flex items-center gap-1 cursor-pointer"
                  title="Copy full diagnostic report JSON to clipboard"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowMapDiagnostics(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 cursor-pointer"
                  title="Close Diagnostics"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Runtime Summary Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-[10.5px]">
              <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400 block text-[9.5px] uppercase">Current Map Mode</span>
                <span className="font-bold text-white uppercase">{diagStats.mode}</span>
                <span className="text-[9.5px] text-sky-300 block">
                  Zoom: {currentZoom.toFixed(1)}x · Container: {diagStats.containerSize}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400 block text-[9.5px] uppercase">Tile Request Status</span>
                <span
                  className={`font-extrabold ${
                    diagStats.loadedCount > 0
                      ? 'text-emerald-400'
                      : diagStats.failedCount > 0
                      ? 'text-rose-400'
                      : 'text-amber-300'
                  }`}
                >
                  {diagStats.loadedCount > 0
                    ? `PASS (${diagStats.domVisibleTiles} DOM TILES VISIBLE)`
                    : diagStats.failedCount > 0
                    ? 'FAIL / RECOVERING'
                    : 'LOADING TILES...'}
                </span>
                <span className="text-[9.5px] text-slate-300 block truncate">
                  {diagStats.lastHttpStatus}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400 block text-[9.5px] uppercase">Loaded / Failed Tiles</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-emerald-400 font-bold">
                    Loaded: {diagStats.loadedCount}
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className={diagStats.failedCount > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                    Failed: {diagStats.failedCount}
                  </span>
                </div>
                <span className="text-[9.5px] text-slate-400 block">
                  Requested: {diagStats.requestedCount} · Recovered: {diagStats.fallbackRecoveredCount}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400 block text-[9.5px] uppercase">Network &amp; Platform</span>
                <span className={diagStats.isOnline ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {diagStats.isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
                <span className="text-[9.5px] text-sky-300 block truncate" title={diagStats.platform}>
                  {diagStats.platform}
                </span>
              </div>
            </div>

            {/* Active Provider & Tile URL Details */}
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 text-[10px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 uppercase font-semibold">Current Tile Provider:</span>
                <span className="text-emerald-300 font-bold">{diagStats.providerName}</span>
              </div>
              <div className="text-slate-300 break-all">
                <span className="text-slate-500">Template: </span>
                {diagStats.templateUrl}
              </div>
              {diagStats.sampleResolvedUrl && (
                <div className="text-sky-300 break-all">
                  <span className="text-slate-500">Last Tile URL: </span>
                  {diagStats.sampleResolvedUrl}
                </div>
              )}
              <div className="text-slate-300 break-all">
                <span className="text-slate-500">Last Error: </span>
                <span className={diagStats.lastError ? 'text-amber-300' : 'text-emerald-400'}>
                  {diagStats.lastError || 'None (0 unresolved errors)'}
                </span>
              </div>
              {mapMode === 'traffic' && (
                <div className="text-[9.5px] text-emerald-300/90 pt-1 border-t border-slate-800">
                  {isLiveTrafficUnavailable || !diagStats.isOnline
                    ? 'Traffic Status: Live traffic unavailable'
                    : 'Traffic Provider Info: Keyless Google Live Traffic (lyrs=m,traffic)'}
                </div>
              )}
            </div>

            {/* Tile Engine Selector for Instant Runtime Testing */}
            <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] text-slate-300 font-bold">Tile Provider Engine:</span>
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { id: 'auto', label: 'Google + Fallback' },
                  { id: 'osm', label: 'OpenStreetMap' },
                  { id: 'esri', label: 'Esri ArcGIS' },
                  { id: 'opentopo', label: 'OpenTopo' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProviderPref(p.id as TileProviderPreference)}
                    className={`px-2 py-1 rounded-lg text-[9.5px] font-bold cursor-pointer transition-colors ${
                      providerPref === p.id
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2 Live Independent Provider Probe Table */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-300 uppercase">
                  Live Provider Verification Table
                </span>
                <button
                  type="button"
                  onClick={runAllProvidersDiagnostic}
                  disabled={isProbingProviders}
                  className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-[10px] font-bold cursor-pointer flex items-center gap-1"
                >
                  {isProbingProviders && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{isProbingProviders ? 'Testing Tiles...' : 'Test All Providers Now'}</span>
                </button>
              </div>

              {probeRows.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left border-collapse text-[9.5px]">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                        <th className="p-1.5">Mode</th>
                        <th className="p-1.5">Provider &amp; Tile URL</th>
                        <th className="p-1.5">HTTP Status</th>
                        <th className="p-1.5">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 bg-slate-950/80">
                      {probeRows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="p-1.5 font-bold text-white whitespace-nowrap">{row.mode}</td>
                          <td className="p-1.5 max-w-[190px]">
                            <div className="text-sky-300 font-semibold truncate">{row.provider}</div>
                            <div className="text-slate-500 truncate" title={row.url}>
                              {row.url}
                            </div>
                          </td>
                          <td className="p-1.5 text-slate-300 whitespace-nowrap">
                            <div>{row.httpStatus}</div>
                            <div className="text-slate-500">
                              {row.bytes.toLocaleString()}B · {row.latencyMs}ms
                            </div>
                          </td>
                          <td className="p-1.5 whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded font-extrabold ${
                                row.result === 'PASS'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              }`}
                            >
                              {row.result}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-center text-[10px]">
                  Click &ldquo;Test All Providers Now&rdquo; to probe live HTTP status &amp; payload size across Street, Terrain, Satellite, and Traffic endpoints.
                </div>
              )}
            </div>

            {/* Global Network 403 / 404 / 429 Error Monitor & Self-Test */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-amber-300 uppercase">
                  Network 403 / 404 / 429 Error Listener ({networkErrorAlerts.length})
                </span>
                <div className="flex items-center gap-1">
                  {([403, 404, 429] as const).map((code) => (
                    <button
                      key={code}
                      type="button"
                      data-testid={`test-http-${code}-btn`}
                      onClick={() => {
                        const sampleUrl =
                          diagStats.sampleResolvedUrl ||
                          `https://tile.openstreetmap.org/15/23456/15123.png?testStatus=${code}`;
                        emitNetworkHttpStatusError(
                          code,
                          sampleUrl,
                          code === 403
                            ? 'Forbidden'
                            : code === 404
                            ? 'Not Found'
                            : 'Too Many Requests',
                          `Diagnostic Self-Test (${diagStats.providerName})`
                        );
                      }}
                      className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-300 text-[9px] font-bold cursor-pointer"
                      title={`Trigger test HTTP ${code} error toast notification`}
                    >
                      Test {code}
                    </button>
                  ))}
                  {networkErrorAlerts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setNetworkErrorAlerts([])}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              {networkErrorAlerts.length > 0 && (
                <div className="max-h-28 overflow-y-auto rounded-xl bg-rose-950/35 border border-rose-800/50 p-2 space-y-1.5 text-[9.5px]">
                  {networkErrorAlerts.slice(0, 8).map((alert, idx) => (
                    <div
                      key={`${alert.timestamp}-${idx}`}
                      className="p-1.5 rounded-lg bg-slate-950/90 border border-rose-500/30 space-y-0.5 break-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-rose-300 font-extrabold">
                          HTTP {alert.status} {alert.statusText} · {alert.providerHost}
                        </span>
                        <span className="text-slate-500 text-[8.5px]">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-amber-200">{alert.reason}</div>
                      <div className="text-slate-400 truncate" title={alert.url}>
                        URL: {alert.url}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Tile Request Console Stream (Full Tile URL + Full Provider Endpoint) */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-300 uppercase">
                  Console Tile Request Stream ({tileConsoleLogs.length})
                </span>
                <button
                  type="button"
                  onClick={() => setTileConsoleLogs([])}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-bold cursor-pointer"
                >
                  Clear Log
                </button>
              </div>
              <div className="max-h-36 overflow-y-auto rounded-xl bg-slate-900/90 border border-slate-800 p-2 space-y-1.5 text-[9.5px]">
                {tileConsoleLogs.length === 0 ? (
                  <div className="text-slate-500 text-center py-2">
                    Pan or zoom map to log tile requests to browser console...
                  </div>
                ) : (
                  tileConsoleLogs.slice(0, 12).map((entry, idx) => (
                    <div
                      key={`${entry.timestamp}-${idx}`}
                      className="p-1.5 rounded-lg bg-slate-950/90 border border-slate-800/90 space-y-0.5 break-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-emerald-400 font-bold">
                          [{entry.stage}] {entry.providerName}
                        </span>
                        {entry.httpStatus && (
                          <span
                            className={`px-1.5 py-0.2 rounded font-bold ${
                              entry.httpStatus >= 400
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            HTTP {entry.httpStatus}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400">
                        <span className="text-slate-500">Endpoint: </span>
                        {entry.providerEndpoint}
                      </div>
                      <div className="text-sky-300">
                        <span className="text-slate-500">Tile URL: </span>
                        {entry.tileUrl}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Floating Map Controls Popover Card (Pop Button Modal) */}
        {showMapControlsPop && (
          <div className={`w-full ${themeConfig.glassPanel} rounded-3xl shadow-2xl border ${themeConfig.glassBorder} p-4 z-40 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-xl text-white space-y-3.5 max-h-[80vh] overflow-y-auto`}>
            {/* Popover Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white">Map Views & HDR Visuals</h4>
                  <p className="text-[10px] text-slate-400">2x Retina HDR optical grading, layers & trails</p>
                </div>
              </div>
              <button
                onClick={() => setShowMapControlsPop(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section 1: Map Styles Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Select Layer Style
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowMapControlsPop(false);
                    setShowMapDiagnostics(true);
                    if (probeRows.length === 0) {
                      runAllProvidersDiagnostic();
                    }
                  }}
                  className="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold cursor-pointer"
                >
                  Open Map Diagnostics
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'standard' as MapLayerMode, name: 'Standard Street', icon: MapIcon, desc: 'Crisp Roads & Labels' },
                  { id: 'satellite' as MapLayerMode, name: 'Satellite 2x HDR', icon: Globe, desc: 'Aerial Hybrid Imagery' },
                  { id: 'terrain' as MapLayerMode, name: 'Terrain Map', icon: Mountain, desc: 'Elevation & Contours' },
                  { id: 'traffic' as MapLayerMode, name: 'Traffic Layer', icon: Car, desc: 'Live Road Congestion' },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = mapMode === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        handleSelectMapMode(item.id, `${item.name} enabled`);
                      }}
                      className={`p-2.5 rounded-2xl border text-left transition-all flex items-start gap-2.5 cursor-pointer active:scale-95 ${
                        isSelected
                          ? 'bg-sky-500/25 border-sky-400/80 ring-1 ring-sky-400/50 shadow-sm'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className={`p-1.5 rounded-xl shrink-0 ${isSelected ? 'bg-sky-500 text-white' : 'bg-white/10 text-slate-300'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-white truncate">{item.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                        </div>
                        <span className="text-[10px] text-slate-400 block truncate">{item.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 1C: Level-of-Detail (LOD) GPU Marker Culling Manager */}
            <div
              data-testid="map-lod-manager-section"
              className="pt-2 border-t border-white/10 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1">
                  <Eye className="w-3 h-3 text-emerald-400" />
                  <span>Level-of-Detail (LOD) GPU Manager</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-[9.5px] font-mono font-bold text-emerald-300">
                  {lodState.culledMarkersCount > 0
                    ? `${lodState.culledMarkersCount} Culled · ${lodState.visibleNonEssentialCount} Shown`
                    : `${lodState.tierLabel}`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  {
                    id: 'auto' as MapLodMode,
                    label: 'Auto LOD',
                    desc: 'Smart Zoom Culling',
                  },
                  {
                    id: 'aggressive' as MapLodMode,
                    label: 'Max GPU Saver',
                    desc: 'Low-End Device Mode',
                  },
                  {
                    id: 'off' as MapLodMode,
                    label: 'All Visible',
                    desc: 'Never Hide Pins',
                  },
                ].map((opt) => {
                  const active = lodMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      data-testid={`map-lod-mode-${opt.id}`}
                      onClick={() => {
                        handleSelectLodMode(opt.id);
                        toast.info(`Map Level-of-Detail set to ${opt.label}`);
                      }}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer active:scale-95 ${
                        active
                          ? 'bg-emerald-500/25 border-emerald-400/80 ring-1 ring-emerald-400/50 text-white shadow-md'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <span className="font-extrabold text-[11px] block">{opt.label}</span>
                      <span className="text-[9px] text-slate-400 block">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-1 px-2.5 py-1.5 rounded-xl bg-slate-950/60 border border-white/10 text-[10px] text-slate-300">
                <span>
                  Zoom <strong className="text-sky-300">{currentZoom.toFixed(1)}x</strong> ·{' '}
                  <strong className="text-white">{lodState.tierLabel}</strong>
                </span>
                <span className="text-slate-400 font-mono text-[9.5px]">
                  Places ≥{lodState.thresholds.savedPlacesMinZoom}x · Reports ≥
                  {lodState.thresholds.communityReportsMinZoom}x · POIs ≥
                  {lodState.thresholds.nearbyPoisMinZoom}x
                </span>
              </div>
            </div>

            {/* Section 2: Orientation, Map Rotation & Compass Quick Actions */}
            <div className="pt-2 border-t border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Map Rotation & Compass
                </span>
                <span className="text-[10px] font-mono text-sky-300 font-bold">
                  {bearing}° {getCompassHeading(bearing)} · Zoom {currentZoom.toFixed(1)}x
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => rotateMapBy(-45)}
                  className="py-2 px-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                  <span>-45° CCW</span>
                </button>
                <button
                  type="button"
                  onClick={resetNorth}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                    bearing !== 0
                      ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40 ring-1 ring-rose-400/40'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-rose-400" />
                  <span>North (0°)</span>
                </button>
                <button
                  type="button"
                  onClick={() => rotateMapBy(45)}
                  className="py-2 px-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                  <span>+45° CW</span>
                </button>
              </div>

              {/* 360° Continuous Map Rotation Slider & Cardinal Bearings */}
              <div className="bg-slate-900/70 border border-white/10 rounded-xl p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-400">Continuous 360° Bearing</span>
                  <span className="text-cyan-300 font-bold">
                    {bearing}° ({getCompassHeading(bearing)})
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={359}
                  step={1}
                  value={bearing}
                  onChange={(e) => setMapBearing(Number(e.target.value), false)}
                  aria-label="Map rotation angle in degrees"
                  className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                  {[
                    { label: '0° N', deg: 0 },
                    { label: '90° E', deg: 90 },
                    { label: '180° S', deg: 180 },
                    { label: '270° W', deg: 270 },
                  ].map((preset) => (
                    <button
                      key={preset.deg}
                      type="button"
                      onClick={() => setMapBearing(preset.deg, true)}
                      className={`py-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                        bearing === preset.deg
                          ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="text-[9.5px] text-slate-400 text-center">
                  Tip: Two-finger twist on mobile or Shift + Drag on desktop to rotate freely
                </div>
              </div>
            </div>

            {/* Section 2B: Persistent Auto-Follow Mode & Movement Threshold */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-white flex items-center gap-1.5">
                    <Footprints className="w-3.5 h-3.5 text-[#00D6A0]" />
                    <span>Persistent Auto-Follow</span>
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Centers map when movement exceeds {autoFollowThresholdMeters}m
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleAutoFollowMode}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold cursor-pointer transition-all border ${
                    isAutoFollowEnabled
                      ? 'bg-[#00D6A0]/20 text-[#00D6A0] border-[#00D6A0]/50 shadow-xs'
                      : 'bg-white/10 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  {isAutoFollowEnabled ? 'AUTO ON' : 'PAUSED'}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs bg-slate-900/60 p-2 rounded-xl">
                <span className="text-[10px] text-slate-400 font-mono">Move Threshold:</span>
                <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg text-[10px]">
                  {[5, 10, 25, 50].map((meters) => (
                    <button
                      key={meters}
                      type="button"
                      onClick={() => updateAutoFollowThreshold(meters)}
                      className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                        autoFollowThresholdMeters === meters
                          ? 'bg-[#00D6A0] text-slate-950 font-extrabold shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {meters}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 3: Room Member Breadcrumb Trails */}
            <div className="pt-2 border-t border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-white block">Breadcrumb Trails</span>
                  <span className="text-[10px] text-slate-400 block">
                    {Object.keys(activeTrails).length > 0
                      ? `${Object.keys(activeTrails).length} member trail(s) active`
                      : 'Historical GPS paths for room members'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={toggleAllRoomTrails}
                    className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {roomUsersList.length > 0 && roomUsersList.every((u) => !!activeTrails[u.id])
                      ? 'Hide All'
                      : 'Show All'}
                  </button>
                  {Object.keys(activeTrails).length > 0 && (
                    <button
                      onClick={clearAllTrails}
                      className="px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Time Span Picker */}
              <div className="flex items-center justify-between text-xs bg-slate-900/60 p-2 rounded-xl">
                <span className="text-[10px] text-slate-400 font-mono">History Span:</span>
                <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg text-[10px]">
                  {[
                    { label: '15m', val: 0.25 },
                    { label: '30m', val: 0.5 },
                    { label: '1h', val: 1 },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => reloadAllActiveTrails(opt.val)}
                      className={`px-2.5 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                        trailWindowHours === opt.val
                          ? 'bg-sky-500 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Room Member List */}
              {roomUsersList.length > 0 && (
                <div className="divide-y divide-white/10 max-h-40 overflow-y-auto">
                  {roomUsersList.map((member) => {
                    const isActive = !!activeTrails[member.id];
                    const isLoading = loadingTrailUserIds.includes(member.id);
                    const palette = getPaletteForUser(member.id);
                    const trail = activeTrails[member.id];

                    return (
                      <div
                        key={member.id}
                        className="py-1.5 flex items-center justify-between gap-2 hover:bg-white/5 rounded-xl px-1.5 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <img
                            src={member.avatarUrl}
                            alt={member.fullName}
                            className={`w-7 h-7 rounded-full object-cover border ${
                              isActive ? palette.border : 'border-slate-500'
                            }`}
                          />
                          <div className="truncate flex-1">
                            <span className="font-bold text-xs text-white block truncate">
                              {member.fullName}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {isActive && trail ? `${formatDistance(trail.totalDistanceMeters)} · ${trail.points.length} pts` : `@${member.username}`}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isActive && (
                            <button
                              onClick={() => fitUserTrailBounds(member.id)}
                              title="Zoom to trail"
                              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => toggleUserTrail(member.id)}
                            disabled={isLoading}
                            className={`p-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                              isActive
                                ? `${palette.bg} text-white shadow-xs`
                                : 'bg-white/10 hover:bg-white/20 text-slate-300'
                            }`}
                            title={isActive ? 'Hide Trail' : 'Show Trail'}
                          >
                            {isLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isActive ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5 opacity-60" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 4: Live GNSS Status */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    isGpsActive && gpsAccuracy != null
                      ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                      : 'bg-amber-400 animate-pulse'
                  }`}
                />
                <span className="text-slate-300 text-xs">
                  {isGpsActive && gpsAccuracy != null
                    ? `Accuracy ±${Math.round(gpsAccuracy)} m`
                    : locationStatus || 'Waiting for location'}
                </span>
              </div>
              <button
                onClick={centerOnMyLocation}
                disabled={isRecenteringGps}
                className="px-2.5 py-1 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Crosshair className={`w-3.5 h-3.5 ${isRecenteringGps ? 'animate-spin text-cyan-300' : ''}`} />
                <span>{isRecenteringGps ? 'Fetching GPS...' : 'Recenter on Me'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom-Right Mobile-Ergonomic Floating HUD Controls (Orientation, Location & Custom Dark-Themed Zoom Pod in Thumb Zone) */}
      <div
        className={`absolute ${roomOnlyMode ? 'bottom-4' : 'bottom-20'} right-3.5 md:bottom-6 md:right-6 z-20 flex flex-col items-end gap-2 pointer-events-none`}
      >
        {/* 3D / 2D Perspective Toggle Button */}
        <button
          onClick={() => {
            const next3d = !is3dMode;
            setIs3dMode(next3d);
            localStorage.setItem('beacon_map_3d', next3d ? '1' : '0');
            setTimeout(() => {
              mapInstanceRef.current?.invalidateSize({ pan: false, animate: false });
            }, 60);
            toast.info(next3d ? '🧊 3D Map Tilt Enabled' : '🗺️ 2D Crystal-Clear HD View');
          }}
          title={is3dMode ? 'Switch to 2D Razor-Sharp HD View' : 'Enable 3D Perspective Tilt'}
          className={`pointer-events-auto w-12 h-11 rounded-2xl shadow-xl border flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 font-mono font-black text-xs ${
            is3dMode
              ? 'bg-gradient-to-br from-[#00D6A0] to-[#00D9FF] text-slate-950 border-[#00D6A0] shadow-[#00D6A0]/30 ring-2 ring-[#00D6A0]/40'
              : 'bg-[#0B081B]/95 border-[#8957FF]/35 text-white hover:bg-[#1B153A] hover:border-[#00D9FF]/50 shadow-[0_8px_24px_rgba(11,8,27,0.85)]'
          }`}
        >
          <span>{is3dMode ? '3D' : '2D'}</span>
          <span className={`text-[8px] font-bold -mt-0.5 ${is3dMode ? 'text-slate-900' : 'text-[#00D9FF]'}`}>
            {is3dMode ? 'TILT' : 'HD'}
          </span>
        </button>

        {/* Map Rotation & Compass Rose Control Pod (Accessible on Mobile & Desktop) */}
        <div className="relative flex items-center gap-1.5 pointer-events-auto">
          {/* Interactive 360° Rotation Dial Popover (Toggled via Compass or Rotation Bar) */}
          {showRotationDial && (
            <div
              data-testid="map-rotation-dial-popover"
              className="bg-[#0B081B]/95 backdrop-blur-xl border border-[#00D9FF]/45 rounded-2xl p-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.9)] w-56 space-y-2 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00D9FF] font-mono">
                  Map Rotation ({bearing}° {getCompassHeading(bearing)})
                </span>
                <button
                  type="button"
                  onClick={() => setShowRotationDial(false)}
                  className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                  aria-label="Close rotation dial"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="range"
                min={0}
                max={359}
                step={1}
                value={bearing}
                onChange={(e) => setMapBearing(Number(e.target.value), false)}
                aria-label="Rotate map 0 to 359 degrees"
                className="w-full accent-[#00D9FF] cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: 'N 0°', deg: 0 },
                  { label: 'E 90°', deg: 90 },
                  { label: 'S 180°', deg: 180 },
                  { label: 'W 270°', deg: 270 },
                ].map((c) => (
                  <button
                    key={c.deg}
                    type="button"
                    onClick={() => setMapBearing(c.deg, true)}
                    className={`py-1 rounded-lg text-[9.5px] font-mono font-bold border transition-all cursor-pointer ${
                      bearing === c.deg
                        ? 'bg-[#00D9FF]/25 border-[#00D9FF] text-white'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Direct Map Rotation Buttons (-45° CCW | Compass / Reset North | +45° CW) */}
          <div
            role="group"
            aria-label="Map rotation controls"
            data-testid="map-rotation-controls"
            className="flex items-center bg-[#0B081B]/95 border border-[#8957FF]/40 rounded-2xl p-0.5 shadow-[0_8px_24px_rgba(11,8,27,0.85)]"
          >
            <button
              type="button"
              onClick={() => rotateMapBy(-45)}
              title="Rotate Map 45° Counter-Clockwise"
              aria-label="Rotate Map 45 degrees counter-clockwise"
              data-testid="rotate-map-ccw-btn"
              className="w-9 h-10 hover:bg-[#8957FF]/25 text-slate-200 hover:text-[#00D9FF] active:scale-95 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#00D9FF]" />
              <span className="text-[7.5px] font-mono font-bold -mt-0.5">-45°</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (bearing !== 0) {
                  resetNorth();
                } else {
                  setShowRotationDial((prev) => !prev);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setShowRotationDial((prev) => !prev);
              }}
              title={
                bearing !== 0
                  ? `Tap to Reset North (Current: ${bearing}° ${getCompassHeading(bearing)})`
                  : 'Tap to open 360° Map Rotation Dial'
              }
              aria-label="Compass and Map Rotation"
              data-testid="compass-reset-north-btn"
              className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${
                bearing !== 0
                  ? 'bg-sky-600 text-white shadow-sm ring-1 ring-sky-300/60'
                  : showRotationDial
                  ? 'bg-[#1B153A] text-[#00D9FF] ring-1 ring-[#00D9FF]/50'
                  : 'text-white hover:bg-[#1B153A]'
              }`}
            >
              <div
                className="relative w-4 h-4 flex items-center justify-center transition-transform"
                style={{
                  transform: `rotate(${-bearing}deg)`,
                  transition: isGesturing ? 'none' : 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
                }}
              >
                <div className="absolute top-0 w-0 h-0 border-x-[3px] border-x-transparent border-b-[8px] border-b-rose-500" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 z-10" />
                <div className="absolute bottom-0 w-0 h-0 border-x-[3px] border-x-transparent border-t-[8px] border-t-slate-400" />
              </div>
              <span className={`text-[7.5px] font-bold tracking-tight font-mono -mt-0.5 ${bearing !== 0 ? 'text-white' : 'text-slate-300'}`}>
                {bearing !== 0 ? `${bearing}°` : 'N'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => rotateMapBy(45)}
              title="Rotate Map 45° Clockwise"
              aria-label="Rotate Map 45 degrees clockwise"
              data-testid="rotate-map-cw-btn"
              className="w-9 h-10 hover:bg-[#8957FF]/25 text-slate-200 hover:text-[#00D9FF] active:scale-95 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5 text-[#00D9FF]" />
              <span className="text-[7.5px] font-mono font-bold -mt-0.5">+45°</span>
            </button>
          </div>
        </div>

        {/* User Direction Cursor / Heading-Up Follow Mode Toggle */}
        <button
          onClick={toggleHeadingUpMode}
          title={isHeadingUpMode ? 'Heading-Up Follow Active (Tap to return to North-Up)' : 'Enable Heading-Up Direction Follow'}
          className={`pointer-events-auto w-12 h-11 rounded-2xl shadow-xl border flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${
            isHeadingUpMode
              ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-cyan-300 shadow-cyan-500/30 ring-2 ring-cyan-400/50'
              : 'bg-[#0B081B]/95 border-[#8957FF]/35 text-white hover:bg-[#1B153A] hover:border-[#00D9FF]/50 shadow-[0_8px_24px_rgba(11,8,27,0.85)]'
          }`}
        >
          <Navigation
            className={`w-4 h-4 transition-transform duration-200 ${
              isHeadingUpMode ? 'text-white fill-current scale-110' : 'text-cyan-400'
            }`}
          />
          <span className={`text-[8px] font-bold tracking-tight font-mono mt-0.5 ${isHeadingUpMode ? 'text-cyan-100' : 'text-slate-400'}`}>
            {isHeadingUpMode ? 'FOLLOW' : 'DIR'}
          </span>
        </button>

        {/* Persistent Auto-Follow Mode Toggle Button */}
        <button
          type="button"
          onClick={toggleAutoFollowMode}
          data-testid="auto-follow-toggle"
          title={
            isAutoFollowEnabled
              ? `Auto-Follow Active (Centers when moving ≥${autoFollowThresholdMeters}m — Tap to Pause)`
              : `Enable Persistent Auto-Follow (≥${autoFollowThresholdMeters}m threshold)`
          }
          aria-label="Toggle persistent auto-follow mode"
          aria-pressed={isAutoFollowEnabled}
          className={`pointer-events-auto w-12 h-11 rounded-2xl shadow-xl border flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${
            isAutoFollowEnabled
              ? 'bg-gradient-to-br from-[#00D6A0] to-[#00D9FF] text-slate-950 border-[#00D6A0] shadow-[#00D6A0]/30 ring-2 ring-[#00D6A0]/45'
              : 'bg-[#0B081B]/95 border-[#8957FF]/35 text-white hover:bg-[#1B153A] hover:border-[#00D9FF]/50 shadow-[0_8px_24px_rgba(11,8,27,0.85)]'
          }`}
        >
          <Footprints
            className={`w-4 h-4 ${isAutoFollowEnabled ? 'text-slate-950' : 'text-[#00D6A0]'}`}
          />
          <span
            className={`text-[8px] font-bold tracking-tight font-mono mt-0.5 ${
              isAutoFollowEnabled ? 'text-slate-950 font-black' : 'text-slate-400'
            }`}
          >
            {isAutoFollowEnabled ? `≥${autoFollowThresholdMeters}m` : 'AUTO'}
          </span>
        </button>

        {/* Prominent "Recenter on Me" Button (Explicitly Re-fetches Fresh GPS & Centers View) */}
        <button
          type="button"
          onClick={centerOnMyLocation}
          disabled={isRecenteringGps}
          data-testid="recenter-on-me-btn"
          title="Recenter on Me — Re-fetch current GPS location and center map"
          aria-label="Recenter on Me"
          className={`pointer-events-auto h-11 px-3 rounded-2xl shadow-[0_8px_24px_rgba(11,8,27,0.9)] border flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
            isRecenteringGps
              ? 'bg-gradient-to-r from-[#00D9FF] to-[#00D6A0] text-slate-950 border-white font-black ring-2 ring-[#00D9FF]/60'
              : 'bg-[#0B081B]/95 border-[#00D9FF]/55 text-white hover:bg-[#1B153A] hover:border-[#00D9FF] shadow-[0_0_18px_rgba(0,217,255,0.2)]'
          }`}
        >
          <Crosshair
            className={`w-4 h-4 shrink-0 ${
              isRecenteringGps ? 'animate-spin text-slate-950' : 'text-[#00D9FF]'
            }`}
          />
          <span className="text-[11px] font-extrabold tracking-tight whitespace-nowrap">
            {isRecenteringGps ? 'Locating...' : 'Recenter on Me'}
          </span>
        </button>

        {/* Custom Dark-Themed Leaflet Map Zoom Controls (Positioned at Bottom-Right Thumb Zone for Mobile Ergonomics) */}
        <div
          role="group"
          aria-label="Map zoom controls"
          data-testid="custom-zoom-controls"
          className="pointer-events-auto bg-[#0B081B]/95 border border-[#8957FF]/45 rounded-2xl shadow-[0_12px_30px_rgba(11,8,27,0.9),0_0_18px_rgba(137,87,255,0.2)] overflow-hidden flex flex-col items-center backdrop-blur-md"
        >
          <button
            type="button"
            onClick={zoomIn}
            disabled={currentZoom >= 22}
            title="Zoom in (+)"
            aria-label="Zoom in"
            className="w-12 h-11 text-[#F8F7FF] hover:bg-[#8957FF]/25 hover:text-[#00D9FF] active:bg-[#8957FF]/40 active:scale-95 disabled:opacity-35 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D9FF]"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>

          <button
            type="button"
            onClick={resetOptimalZoom}
            title="Current zoom level (Tap to reset to 17x HD street zoom)"
            aria-label={`Current zoom level ${Math.round(currentZoom)}x, tap to reset zoom`}
            className="w-12 py-1 bg-[#130F2B] border-y border-[#8957FF]/30 text-[10px] font-mono font-extrabold text-[#00D9FF] hover:text-white hover:bg-[#1B153A] transition-colors flex items-center justify-center cursor-pointer select-none"
          >
            {Math.round(currentZoom)}x
          </button>

          <button
            type="button"
            onClick={zoomOut}
            disabled={currentZoom <= 2}
            title="Zoom out (-)"
            aria-label="Zoom out"
            className="w-12 h-11 text-[#F8F7FF] hover:bg-[#8957FF]/25 hover:text-[#00D9FF] active:bg-[#8957FF]/40 active:scale-95 disabled:opacity-35 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D9FF]"
          >
            <Minus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    


      {/* Path-Tracing HUD Banner for Selected User */}
      {selectedUser && activeTrails[selectedUser.userId] && (
        <div className="absolute top-20 left-4 right-4 md:left-6 md:right-auto md:w-[420px] z-20 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <img
                src={activeTrails[selectedUser.userId].avatarUrl}
                alt=""
                className="w-7 h-7 rounded-full object-cover border border-sky-400"
              />
              <div>
                <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                  <span>{activeTrails[selectedUser.userId].fullName}</span>
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
                </h4>
                <p className="text-[10px] text-sky-300 font-mono">Breadcrumb Trail</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => fitUserTrailBounds(selectedUser.userId)}
                title="Zoom to fit full path"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => toggleUserTrail(selectedUser.userId)}
                title="Close path trace"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 py-2.5 text-center text-xs">
            <div className="bg-slate-800/60 p-2 rounded-xl">
              <span className="text-[10px] text-slate-400 block font-mono">Distance</span>
              <span className="font-bold text-sky-400 text-sm">
                {formatDistance(activeTrails[selectedUser.userId].totalDistanceMeters)}
              </span>
            </div>
            <div className="bg-slate-800/60 p-2 rounded-xl">
              <span className="text-[10px] text-slate-400 block font-mono">Checkpoints</span>
              <span className="font-bold text-white text-sm">{activeTrails[selectedUser.userId].points.length}</span>
            </div>
            <div className="bg-slate-800/60 p-2 rounded-xl">
              <span className="text-[10px] text-slate-400 block font-mono">Started</span>
              <span className="font-bold text-emerald-400 text-xs">
                {new Date(activeTrails[selectedUser.userId].startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Time Window Selector */}
          <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-sky-400" />
              History Span:
            </span>
            <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg">
              {[
                { label: '15m', val: 0.25 },
                { label: '30m', val: 0.5 },
                { label: '1h', val: 1 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setTrailWindowHours(opt.val);
                    loadUserTrail(selectedUser.userId, opt.val);
                  }}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    trailWindowHours === opt.val
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selected User Social Location Card */}
      {selectedUser && (
        <div
          className={`absolute ${
            roomOnlyMode ? 'bottom-4' : 'bottom-20'
          } left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-96 z-30 rounded-3xl shadow-2xl overflow-hidden border border-[#8957FF]/40 bg-[#130D2B]/95 dark:bg-[#130D2B]/95 text-white backdrop-blur-xl transition-all animate-in fade-in slide-in-from-bottom-3 duration-200`}
        >
          {/* Colourful Top Gradient Header Strip */}
          <div className="p-4 bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0 p-[2px] rounded-full bg-white shadow-md">
                <img
                  src={selectedUser.avatarUrl}
                  alt={selectedUser.fullName}
                  className="w-12 h-12 rounded-full object-cover bg-slate-900"
                />
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#00D6A0] border-2 border-[#130D2B]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-extrabold text-white text-base truncate">
                    {selectedUser.fullName}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-black/25 backdrop-blur-sm text-[10px] font-extrabold text-[#00D6A0] border border-white/20">
                    LIVE GPS
                  </span>
                </div>
                <p className="text-xs text-white/90 font-medium truncate">
                  @{selectedUser.username}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3.5">
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-[#E9DFFF]/70 text-[10px] font-bold uppercase tracking-wider block">
                  Distance
                </span>
                <span className="font-extrabold text-[#00D9FF] text-sm mt-0.5 block">
                  {myLocation && selectedUser.userId !== user?.id
                    ? `${formatDistance(
                        calculateDistanceMeters(
                          myLocation.latitude,
                          myLocation.longitude,
                          selectedUser.latitude,
                          selectedUser.longitude
                        )
                      )} away`
                    : 'Your Current Spot'}
                </span>
              </div>

              <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-[#E9DFFF]/70 text-[10px] font-bold uppercase tracking-wider block">
                  Accuracy & Signal
                </span>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span className="font-extrabold text-white">
                    ±{Math.round(Number(selectedUser.accuracy_m ?? selectedUser.accuracy))} m
                  </span>
                  {getGpsSignalInfo(selectedUser.accuracy).isLowSignal ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#FFD166]/20 text-[#FFD166] border border-[#FFD166]/40 text-[9px] font-extrabold">
                      {getGpsSignalInfo(selectedUser.accuracy).label}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#00D6A0]/20 text-[#00D6A0] border border-[#00D6A0]/40 text-[9px] font-extrabold">
                      Strong GPS
                    </span>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-[#E9DFFF]/70 text-[10px] font-bold uppercase tracking-wider block">
                  Last Updated
                </span>
                <span className="font-bold text-white mt-0.5 block">
                  {formatTimeAgo(selectedUser.updated_at || selectedUser.timestamp)}
                </span>
              </div>

              <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-[#E9DFFF]/70 text-[10px] font-bold uppercase tracking-wider block">
                  Sharing Status
                </span>
                <span className="font-extrabold text-[#00D6A0] mt-0.5 block">
                  {(() => {
                    const serverTs = selectedUser.updated_at || selectedUser.timestamp;
                    const ageMs = serverTs ? Date.now() - Date.parse(serverTs) : Infinity;
                    return Number.isFinite(ageMs) && ageMs < 120000
                      ? 'Sharing Live'
                      : onlineUserIds.includes(selectedUser.userId)
                      ? 'Online (Recent)'
                      : 'Offline';
                  })()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  toggleUserTrail(selectedUser.userId);
                }}
                disabled={loadingTrailUserIds.includes(selectedUser.userId)}
                className={`flex-1 py-2.5 px-3 text-xs font-extrabold rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                  activeTrails[selectedUser.userId]
                    ? 'bg-gradient-to-r from-[#FFD166] to-[#FF8066] text-slate-950 shadow-md'
                    : 'bg-gradient-to-r from-[#397BFF] to-[#00D9FF] text-white shadow-md shadow-[#397BFF]/25'
                }`}
              >
                <Route className="w-3.5 h-3.5" />
                <span>{activeTrails[selectedUser.userId] ? 'Hide Trail' : 'Trace Path (1h)'}</span>
              </button>

              {selectedUser.userId !== user?.id && (
                <button
                  onClick={() => {
                    if (onSelectUserForChat) {
                      onSelectUserForChat(selectedUser.userId);
                    }
                    setSelectedUser(null);
                  }}
                  className="py-2.5 px-3.5 bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] text-white text-xs font-extrabold rounded-2xl flex items-center justify-center gap-1.5 shadow-md shadow-[#FF4FA3]/25 transition-all cursor-pointer active:scale-95"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Message</span>
                </button>
              )}

              <button
                onClick={() => {
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.flyTo(
                      [selectedUser.latitude, selectedUser.longitude],
                      18
                    );
                  }
                }}
                className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-[#00D9FF] rounded-2xl transition-colors cursor-pointer"
                title="Focus on map"
              >
                <Compass className="w-4 h-4" />
              </button>

              {selectedUser.userId !== user?.id && (
                <button
                  onClick={async () => {
                    const target = selectedUser;
                    setSelectedUser(null);
                    try {
                      const keys = [target.userId, target.username, target.fullName]
                        .filter(Boolean)
                        .map((s) => String(s).toLowerCase());
                      const gPrev: string[] = JSON.parse(
                        localStorage.getItem('beacon_removed_friends_global') || '[]'
                      );
                      const next = Array.from(new Set([...gPrev, ...keys]));
                      localStorage.setItem('beacon_removed_friends_global', JSON.stringify(next));
                      if (user?.id) {
                        localStorage.setItem(`beacon_removed_friends_${user.id}`, JSON.stringify(next));
                      }
                    } catch {
                      // ignore
                    }
                    try {
                      await api.removeFriend(target.userId);
                    } catch {
                      // fallback local removal
                    }
                    window.dispatchEvent(new CustomEvent('beacon:friends-updated'));
                    window.dispatchEvent(new CustomEvent('beacon:cloud-sync-updated'));
                    toast.success(`Removed ${target.fullName} from friends & map`);
                  }}
                  className="p-2.5 bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/40 text-rose-300 rounded-2xl transition-colors cursor-pointer"
                  title={`Remove ${selectedUser.fullName} from friends & map`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Turn-by-Turn Navigation HUD Banner */}
      {activeNavigation && (
        <div className="absolute top-20 left-4 right-4 md:left-6 md:right-auto md:w-[420px] z-30 bg-slate-900/95 backdrop-blur-xl text-white p-4 rounded-2xl shadow-2xl border border-cyan-500/40 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20 shrink-0">
                <Navigation className="w-4 h-4 text-white fill-current" />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-white truncate">{activeNavigation.targetName}</span>
                  <span className="px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 rounded text-[9px] font-bold font-mono uppercase tracking-wider">NAV</span>
                </div>
                <p className="text-[10px] text-cyan-300 font-mono">
                  {formatDistance(activeNavigation.distanceMeters)} away
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${activeNavigation.lat},${activeNavigation.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in Google Maps"
                className="px-2.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Google Maps</span>
              </a>
              <button
                onClick={cancelNavigation}
                title="End Navigation"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2.5 text-xs">
            <div className="bg-slate-800/70 p-2 rounded-xl flex items-center gap-2">
              <Footprints className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block font-mono">Walking</span>
                <span className="font-bold text-white text-xs">~{activeNavigation.walkMin} min</span>
              </div>
            </div>
            <div className="bg-slate-800/70 p-2 rounded-xl flex items-center gap-2">
              <Car className="w-4 h-4 text-blue-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block font-mono">Driving</span>
                <span className="font-bold text-white text-xs">~{activeNavigation.driveMin} min</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Marker Long-Press & Right-Click Context Menu */}
      {contextMenu.isOpen && (
        <>
          {/* Backdrop dismissal */}
          <div
            className="fixed inset-0 z-40 cursor-default bg-black/10 backdrop-blur-[0.5px]"
            onClick={closeContextMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              closeContextMenu();
            }}
          />

          {/* Context Menu Floating Card */}
          <div
            className={`fixed z-50 w-72 ${themeConfig.glassPanel} rounded-2xl shadow-2xl border ${themeConfig.glassBorder} p-3 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl text-white select-none`}
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Context Menu Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2.5 min-w-0">
                {contextMenu.target.type === 'peer' && contextMenu.target.avatarUrl ? (
                  <div className="relative shrink-0">
                    <img
                      src={contextMenu.target.avatarUrl}
                      alt={contextMenu.target.title}
                      className="w-8 h-8 rounded-full object-cover border border-cyan-400/80 shadow"
                    />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${
                        contextMenu.target.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                  </div>
                ) : contextMenu.target.type === 'self' ? (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow shrink-0">
                    <Navigation className="w-4 h-4 fill-current" />
                  </div>
                ) : contextMenu.target.type === 'place' ? (
                  <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white shadow shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-cyan-300 shadow shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                )}

                <div className="truncate">
                  <h4 className="font-bold text-xs text-white truncate">{contextMenu.target.title}</h4>
                  <p className="text-[10px] text-slate-300 truncate font-mono">
                    {contextMenu.target.subtitle || `${contextMenu.target.lat.toFixed(4)}, ${contextMenu.target.lng.toFixed(4)}`}
                  </p>
                </div>
              </div>

              <button
                onClick={closeContextMenu}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Context Menu Actions */}
            <div className="py-1.5 space-y-0.5 text-xs">
              {/* Navigate To */}
              <button
                onClick={() => startNavigation(contextMenu.target.lat, contextMenu.target.lng, contextMenu.target.title)}
                className="w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Navigation className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <div>
                    <span className="font-bold text-white block">Navigate to</span>
                    <span className="text-[10px] text-slate-400 block">Plot route & turn estimates</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-cyan-300 font-semibold">
                  {contextMenu.target.distanceText || 'Route'}
                </span>
              </button>

              {/* Message User (Available for peer markers) */}
              {contextMenu.target.type === 'peer' && contextMenu.target.userId && (
                <button
                  onClick={() => {
                    const uid = contextMenu.target.userId!;
                    const name = contextMenu.target.title;
                    closeContextMenu();
                    if (onSelectUserForChat) {
                      onSelectUserForChat(uid);
                      toast.success(`Opening chat with ${name}...`);
                    }
                  }}
                  className="w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-white block">Message user</span>
                      <span className="text-[10px] text-slate-400 block">Open direct messaging</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold">Chat</span>
                </button>
              )}

              {/* Customize Family Marker Style (For Peer Markers) */}
              {contextMenu.target.type === 'peer' && contextMenu.target.userId && (
                <button
                  onClick={() => {
                    const uid = contextMenu.target.userId!;
                    const name = contextMenu.target.title;
                    const overrides = getCustomMemberOverrides();
                    const current = overrides[uid];
                    closeContextMenu();
                    setCustomizingMember({
                      userId: uid,
                      fullName: name,
                      currentColor: current?.color || '#10b981',
                      currentIcon: current?.icon || 'person',
                      currentNickname: current?.nickname || name.split(' ')[0],
                    });
                  }}
                  className="w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Palette className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-white block">Family marker style</span>
                      <span className="text-[10px] text-slate-400 block">Set color, icon (Dad, Mom, Kid)</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-pink-400 font-semibold">Style</span>
                </button>
              )}

              {/* Blue Dot Info (For Self Marker) */}
              {contextMenu.target.type === 'self' && (
                <button
                  onClick={() => {
                    closeContextMenu();
                    setShowBlueDotModal(true);
                  }}
                  className="w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Info className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-white block">Google Maps Blue Dot</span>
                      <span className="text-[10px] text-slate-400 block">GPS range & facing direction</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-blue-400 font-semibold">Info</span>
                </button>
              )}

              {/* Set Reminder */}
              <button
                onClick={() => {
                  const lat = contextMenu.target.lat;
                  const lng = contextMenu.target.lng;
                  const title = contextMenu.target.title;
                  closeContextMenu();
                  if (onSetReminderAtCoords) {
                    onSetReminderAtCoords(lat, lng, title);
                    toast.success(`Scheduling reminder at ${title}...`);
                  }
                }}
                className="w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Bell className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-white block">Set reminder</span>
                    <span className="text-[10px] text-slate-400 block">Proximity or geofence alert</span>
                  </div>
                </div>
                <span className="text-[10px] text-amber-300 font-semibold">Alert</span>
              </button>

              {/* Toggle User Breadcrumb Trail (for peers) */}
              {contextMenu.target.type === 'peer' && contextMenu.target.userId && (
                <button
                  onClick={() => {
                    const uid = contextMenu.target.userId!;
                    closeContextMenu();
                    toggleUserTrail(uid);
                  }}
                  className="w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Route className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-white block">
                        {activeTrails[contextMenu.target.userId] ? 'Hide trail' : 'Trace path (1h)'}
                      </span>
                      <span className="text-[10px] text-slate-400 block">Breadcrumb checkpoints</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-purple-300 font-semibold">
                    {activeTrails[contextMenu.target.userId] ? 'Active' : 'Trace'}
                  </span>
                </button>
              )}

              {/* Save as Saved Place OR Remove from Wishlist */}
              {contextMenu.target.type === 'place' && contextMenu.target.placeId ? (
                <button
                  onClick={async () => {
                    const pid = contextMenu.target.placeId!;
                    const pName = contextMenu.target.title;
                    closeContextMenu();
                    try {
                      await api.delete(`/api/saved-places/${pid}`);
                      onRefreshSavedPlaces?.();
                      toast.success(`Removed "${pName}" from Wishlist`);
                    } catch (err: any) {
                      toast.error(err.message || 'Failed to remove place');
                    }
                  }}
                  className="w-full px-2.5 py-2 hover:bg-rose-500/20 active:bg-rose-500/30 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Trash2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-rose-300 block">Remove from Wishlist</span>
                      <span className="text-[10px] text-slate-400 block">Delete saved location marker</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-rose-400 font-semibold">Remove</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    const lat = contextMenu.target.lat;
                    const lng = contextMenu.target.lng;
                    closeContextMenu();
                    if (onAddPlaceAtCoords) {
                      onAddPlaceAtCoords(lat, lng);
                    }
                  }}
                  className="w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-white block">Save as place</span>
                      <span className="text-[10px] text-slate-400 block">Add to your wishlist & geofence list</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-blue-300 font-semibold">Save</span>
                </button>
              )}

              {/* Copy Coordinates */}
              <button
                onClick={() => copyCoordinates(contextMenu.target.lat, contextMenu.target.lng)}
                className="w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-700/60 text-slate-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Copy className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-white block">Copy coordinates</span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {contextMenu.target.lat.toFixed(5)}, {contextMenu.target.lng.toFixed(5)}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">Copy</span>
              </button>

              {/* Share Location */}
              <button
                onClick={() => handleShareLocation(contextMenu.target)}
                className="w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Share2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-white block">Share location link</span>
                    <span className="text-[10px] text-slate-400 block">External map URL</span>
                  </div>
                </div>
                <span className="text-[10px] text-sky-300 font-semibold">Share</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Dedicated Separate Google Maps Places Explorer Page */}
      {showPlacesPage && (
        <GooglePlacesExplorer
          initialQuery={searchQuery}
          onClose={() => setShowPlacesPage(false)}
          onSelectPlaceOnMap={handleSelectPlaceFromExplorer}
          onStartRouteOnMap={handleStartRouteOnMap}
          onShowNearbyOnMap={handleShowNearbyPlacesOnMap}
          savedPlaces={savedPlaces}
          onRefreshSavedPlaces={onRefreshSavedPlaces}
          rooms={rooms}
          selectedRoomId={selectedRoomId}
        />
      )}

      {/* Google Maps Blue Dot Location & Accuracy Modal */}
      {showBlueDotModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-white space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-[#1a73e8] border-2 border-white shadow"></div>
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Your Location (Google Maps Blue Dot)</h3>
                  <p className="text-xs text-slate-400 font-mono">Real-time Positioning & Accuracy</p>
                </div>
              </div>
              <button
                onClick={() => setShowBlueDotModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              The blue circular cursor marks your current real-time location based on your phone's GPS, mobile network, and Wi-Fi data.
            </p>

            {/* Three Essential Google Maps Blue Dot Characteristics */}
            <div className="space-y-2.5">
              <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#1a73e8] border-2 border-white shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white">The blue dot</h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Pinpoints where your device is right now.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full border-2 border-[#4285F4] bg-[#4285F4]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full border border-[#4285F4]"></div>
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white">The light-blue shaded ring around it</h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Represents the accuracy range (±{myLocation?.accuracy ? Math.round(myLocation.accuracy) : 5} meters). The smaller the ring, the more precise the GPS signal is.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Navigation className="w-3.5 h-3.5 fill-current" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white">The faint beam or arrow</h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Indicates the direction your device is currently facing ({myLocation?.heading != null ? `${Math.round(myLocation.heading)}° ${getCompassHeading(myLocation.heading)}` : `${userHeading != null ? `${Math.round(userHeading)}°` : 'Compass Calibrated'}`}).
                  </p>
                </div>
              </div>
            </div>

            {/* Triangulation Sources Status */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
              <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] text-slate-400 block">GPS Satellites</span>
                <span className="text-xs font-bold text-emerald-400">Locked</span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] text-slate-400 block">Cellular Towers</span>
                <span className="text-xs font-bold text-emerald-400">Assisting</span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] text-slate-400 block">Wi-Fi Geodata</span>
                <span className="text-xs font-bold text-emerald-400">Active</span>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2 border-t border-slate-800">
              <button
                onClick={() => {
                  centerOnMyLocation();
                  setShowBlueDotModal(false);
                }}
                className="flex-1 py-2.5 px-3 bg-[#1a73e8] hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-lg active:scale-95"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Recenter Map</span>
              </button>
              <button
                onClick={() => {
                  toast.info('Calibrate compass: hold device and move in a smooth Figure-8 pattern in the air.');
                }}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer border border-slate-700"
              >
                Calibrate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Family Member Marker Styling Modal */}
      {customizingMember && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-white space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Family Marker Style</h3>
                  <p className="text-xs text-slate-400">{customizingMember.fullName}</p>
                </div>
              </div>
              <button
                onClick={() => setCustomizingMember(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Visual Preview of Peer Marker */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center gap-4">
              <div className="flex flex-col items-center">
                <div
                  className="relative w-12 h-12 rounded-full border-2 border-white shadow-xl overflow-hidden bg-slate-800 ring-4"
                  style={{ outlineColor: customizingMember.currentColor, boxShadow: `0 0 16px ${customizingMember.currentColor}80` }}
                >
                  <img
                    src={userLocations.find((u) => u.userId === customizingMember.userId)?.avatarUrl || ''}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div
                  className="mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-md border border-white/20 flex items-center gap-1 whitespace-nowrap"
                  style={{ backgroundColor: customizingMember.currentColor }}
                >
                  <span>{getMemberIconEmoji(customizingMember.currentIcon)}</span>
                  <span>{customizingMember.currentNickname.trim() || customizingMember.fullName.split(' ')[0]}</span>
                </div>
              </div>
            </div>

            {/* Color Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono">
                Marker Accent Color
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {MARKER_COLORS.map((c) => {
                  const isSelected = customizingMember.currentColor.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setCustomizingMember((prev) => (prev ? { ...prev, currentColor: c.hex } : null))
                      }
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        isSelected ? 'border-white ring-2 ring-white bg-white/10 shadow' : 'border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      <div
                        className="w-5 h-5 rounded-full border border-white shadow-xs flex items-center justify-center shrink-0"
                        style={{ backgroundColor: c.hex }}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                      </div>
                      <span className="text-[9px] font-medium text-slate-300 truncate max-w-full">
                        {c.label.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Family / Role Icon Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono">
                Family Role / Identity Icon
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1 border border-slate-800 rounded-xl">
                {MEMBER_ICONS.map((icon) => {
                  const isSelected = customizingMember.currentIcon === icon.id;
                  return (
                    <button
                      key={icon.id}
                      type="button"
                      onClick={() =>
                        setCustomizingMember((prev) => (prev ? { ...prev, currentIcon: icon.id } : null))
                      }
                      className={`p-2 rounded-xl text-left flex items-center gap-1.5 transition-all cursor-pointer text-xs ${
                        isSelected ? 'bg-sky-600 text-white font-bold shadow' : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="text-base">{icon.emoji}</span>
                      <span className="truncate text-[11px]">{icon.label.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Nickname / Display Label */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 font-mono">
                Display Nickname / Tag
              </label>
              <input
                type="text"
                maxLength={20}
                placeholder="e.g. Dad, Mom, Lucas, Van"
                value={customizingMember.currentNickname}
                onChange={(e) =>
                  setCustomizingMember((prev) => (prev ? { ...prev, currentNickname: e.target.value } : null))
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  saveCustomMemberOverride(customizingMember.userId, {
                    color: '#10b981',
                    icon: 'person',
                    nickname: customizingMember.fullName.split(' ')[0],
                  });
                  setMemberOverridesVersion((v) => v + 1);
                  toast.success('Reset family marker style');
                  setCustomizingMember(null);
                }}
                className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              >
                Reset
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCustomizingMember(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    saveCustomMemberOverride(customizingMember.userId, {
                      color: customizingMember.currentColor,
                      icon: customizingMember.currentIcon,
                      nickname: customizingMember.currentNickname.trim() || customizingMember.fullName.split(' ')[0],
                    });
                    setMemberOverridesVersion((v) => v + 1);
                    toast.success(`Updated map style for ${customizingMember.fullName}`);
                    setCustomizingMember(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md cursor-pointer active:scale-95"
                >
                  Save Style
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Map Geofence Drawing & Friend Enter/Leave Push Notification Overlay */}
      <CustomGeofenceOverlay
        roomOnlyMode={roomOnlyMode}
        hideFloatingButtons={true}
        externalOpenManagerSignal={openGeofenceManagerSignal}
        geofences={customGeofences}
        events={geofenceEvents}
        draft={geofenceDraft}
        setDraft={setGeofenceDraft}
        onStartDrawing={(shape: CustomGeofenceShape) => {
          const center = mapInstanceRef.current?.getCenter();
          const defaultCenter =
            center
              ? { lat: center.lat, lng: center.lng }
              : myLocation && Number.isFinite(myLocation.latitude) && myLocation.latitude !== 0
              ? { lat: myLocation.latitude, lng: myLocation.longitude }
              : { lat: 28.6139, lng: 77.209 };
          setGeofenceDraft({
            active: true,
            shape,
            name: `Zone ${customGeofences.length + 1}`,
            color: '#00D6A0',
            points: [],
            center: shape === 'circle' ? defaultCenter : null,
            radiusMeters: 250,
            notifyOnEnter: true,
            notifyOnExit: true,
            watchedUserIds: [],
          });
          toast.info(
            shape === 'polygon'
              ? 'Tap on the map (or tap "+ Add Point") to draw at least 3 polygon corners'
              : 'Tap on the map to place the circle center and adjust the radius slider'
          );
        }}
        onAddMapCenterVertex={() => {
          const center = mapInstanceRef.current?.getCenter();
          if (!center) return;
          if (geofenceDraft.shape === 'polygon') {
            setGeofenceDraft((prev) => ({
              ...prev,
              points: [...prev.points, { lat: center.lat, lng: center.lng }],
            }));
          } else {
            setGeofenceDraft((prev) => ({
              ...prev,
              center: { lat: center.lat, lng: center.lng },
            }));
          }
        }}
        onUndoVertex={() => {
          setGeofenceDraft((prev) => ({
            ...prev,
            points: prev.points.slice(0, -1),
          }));
        }}
        onClearDraftVertices={() => {
          setGeofenceDraft((prev) => ({
            ...prev,
            points: [],
          }));
        }}
        onCancelDrawing={() => {
          setGeofenceDraft((prev) => ({
            ...prev,
            active: false,
            points: [],
          }));
        }}
        onSaveDraftGeofence={() => {
          const center =
            geofenceDraft.shape === 'circle' && geofenceDraft.center
              ? geofenceDraft.center
              : geofenceDraft.points.length > 0
              ? {
                  lat:
                    geofenceDraft.points.reduce((s, p) => s + p.lat, 0) /
                    geofenceDraft.points.length,
                  lng:
                    geofenceDraft.points.reduce((s, p) => s + p.lng, 0) /
                    geofenceDraft.points.length,
                }
              : { lat: 28.6139, lng: 77.209 };

          const newZone: CustomGeofenceZone = {
            id: `gf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: geofenceDraft.name.trim() || `Custom Zone ${customGeofences.length + 1}`,
            shape: geofenceDraft.shape,
            color: geofenceDraft.color,
            points: geofenceDraft.points,
            center,
            radiusMeters: geofenceDraft.radiusMeters,
            notifyOnEnter: geofenceDraft.notifyOnEnter,
            notifyOnExit: geofenceDraft.notifyOnExit,
            enabled: true,
            watchedUserIds: geofenceDraft.watchedUserIds,
            createdAt: new Date().toISOString(),
          };
          persistCustomGeofences([newZone, ...customGeofences]);
          setGeofenceDraft((prev) => ({
            ...prev,
            active: false,
            points: [],
          }));
          notifications.requestPermission().catch(() => {});
          toast.success(
            `Saved geofence "${newZone.name}" — push alerts enabled for friend entry/exit`
          );
        }}
        onToggleGeofenceEnabled={(zoneId: string) => {
          const updated = customGeofences.map((z) =>
            z.id === zoneId ? { ...z, enabled: !z.enabled } : z
          );
          persistCustomGeofences(updated);
        }}
        onDeleteGeofence={(zoneId: string) => {
          const target = customGeofences.find((z) => z.id === zoneId);
          persistCustomGeofences(customGeofences.filter((z) => z.id !== zoneId));
          toast.info(target ? `Deleted geofence "${target.name}"` : 'Deleted geofence');
        }}
        onDeleteAllGeofences={() => {
          persistCustomGeofences([]);
          toast.info('Cleared all custom geofence zones');
        }}
        onClearEvents={() => {
          setGeofenceEvents([]);
          try {
            localStorage.removeItem(CUSTOM_GEOFENCE_EVENTS_STORAGE_KEY);
          } catch {}
          toast.info('Cleared geofence push event history');
        }}
        onFocusGeofence={(zone: CustomGeofenceZone) => {
          const c = getGeofenceCenter(zone);
          mapInstanceRef.current?.setView([c.lat, c.lng], 16);
        }}
        onSimulateTransition={(zone: CustomGeofenceZone, action: 'entered' | 'left') => {
          const otherFriends = userLocations.filter((u) => u.userId !== user?.id);
          const sampleFriend = otherFriends[0];
          const c = getGeofenceCenter(zone);
          recordGeofencePushEvent(
            zone,
            sampleFriend?.userId || 'friend-sim',
            sampleFriend?.fullName || 'Reddy (Friend)',
            action,
            c.lat,
            c.lng
          );
        }}
        friendsLocations={userLocations}
        currentUserId={user?.id}
      />
    </div>
  );
};

function areLiveMapPropsEqual(prev: LiveMapProps, next: LiveMapProps): boolean {
  if (Boolean(prev.isActive ?? true) !== Boolean(next.isActive ?? true)) return false;
  if (Boolean(prev.roomOnlyMode) !== Boolean(next.roomOnlyMode)) return false;
  if ((prev.selectedRoomId ?? null) !== (next.selectedRoomId ?? null)) return false;

  const prevLat = prev.focusCoords?.lat ?? null;
  const prevLng = prev.focusCoords?.lng ?? null;
  const prevTs = prev.focusCoords?.ts ?? null;
  const nextLat = next.focusCoords?.lat ?? null;
  const nextLng = next.focusCoords?.lng ?? null;
  const nextTs = next.focusCoords?.ts ?? null;
  if (prevLat !== nextLat || prevLng !== nextLng || prevTs !== nextTs) return false;

  const prevPlaces = prev.savedPlaces ?? [];
  const nextPlaces = next.savedPlaces ?? [];
  if (prevPlaces !== nextPlaces) {
    if (prevPlaces.length !== nextPlaces.length) return false;
    for (let i = 0; i < prevPlaces.length; i++) {
      const a = prevPlaces[i];
      const b = nextPlaces[i];
      if (
        a.id !== b.id ||
        a.name !== b.name ||
        a.latitude !== b.latitude ||
        a.longitude !== b.longitude ||
        a.radiusMeters !== b.radiusMeters ||
        a.category !== b.category ||
        a.markerIcon !== b.markerIcon ||
        a.markerColor !== b.markerColor
      ) {
        return false;
      }
    }
  }

  const prevRooms = prev.rooms ?? [];
  const nextRooms = next.rooms ?? [];
  if (prevRooms !== nextRooms) {
    if (prevRooms.length !== nextRooms.length) return false;
    for (let i = 0; i < prevRooms.length; i++) {
      const a = prevRooms[i];
      const b = nextRooms[i];
      if (a.id !== b.id || a.name !== b.name || a.memberCount !== b.memberCount) {
        return false;
      }
    }
  }

  const prevDetails = prev.activeRoomDetails ?? null;
  const nextDetails = next.activeRoomDetails ?? null;
  if (prevDetails !== nextDetails) {
    if (!prevDetails || !nextDetails) return false;
    if (
      prevDetails.id !== nextDetails.id ||
      prevDetails.name !== nextDetails.name ||
      prevDetails.memberCount !== nextDetails.memberCount
    ) {
      return false;
    }
    const prevMembers = prevDetails.members ?? [];
    const nextMembers = nextDetails.members ?? [];
    if (prevMembers.length !== nextMembers.length) return false;
    for (let i = 0; i < prevMembers.length; i++) {
      if (
        prevMembers[i].userId !== nextMembers[i].userId ||
        prevMembers[i].role !== nextMembers[i].role
      ) {
        return false;
      }
    }
  }

  return true;
}

export const LiveMap = React.memo(LiveMapComponent, areLiveMapPropsEqual);
LiveMap.displayName = 'LiveMap';

