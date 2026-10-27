import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import type { UserLocation, SavedPlace, UserPathTrail, Room, PlaceResult, RouteData } from '../../types.ts';
import { calculateDistanceMeters, formatDistance, formatAccuracy, formatTimeAgo, getGpsSignalInfo } from '../../utils/geo.ts';
import { api } from '../../utils/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { GooglePlacesExplorer } from '../Places/GooglePlacesExplorer.tsx';
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
  focusCoords?: { lat: number; lng: number } | null;
}

interface SearchResult {
  name: string;
  display_name: string;
  lat: number;
  lon: number;
}

export const LiveMap: React.FC<LiveMapProps> = ({
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
  const { user } = useAuth();
  const { themeConfig, isLiteMode } = useTheme();
  const isLiteModeRef = useRef<boolean>(isLiteMode);
  isLiteModeRef.current = isLiteMode;
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
  const userMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const userAccuracyCirclesRef = useRef<Map<string, L.Circle>>(new Map());
  const emergencyAlertLayersRef = useRef<L.Layer[]>([]);
  const myMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const savedPlacesMarkersRef = useRef<L.Marker[]>([]);
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const nearbyPoiMarkersRef = useRef<L.Marker[]>([]);
  const [nearbyPoisOnMap, setNearbyPoisOnMap] = useState<PlaceResult[]>([]);
  const [fetchedRoomDetails, setFetchedRoomDetails] = useState<Room | null>(null);

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
  const [mapMode, setMapMode] = useState<MapLayerMode>(() => {
    const saved = localStorage.getItem('beacon_map_style');
    if (saved && ['terrain', 'satellite', 'standard', 'traffic'].includes(saved)) {
      return saved as MapLayerMode;
    }
    return 'terrain';
  });
  const [showLayerQuickToggle, setShowLayerQuickToggle] = useState<boolean>(true);
  const [selectedUser, setSelectedUser] = useState<UserLocation | null>(null);
  const [hasCenteredOnce, setHasCenteredOnce] = useState(false);
  const hasCenteredOnRealGpsRef = useRef(false);
  const bestCenteredAccuracyRef = useRef<number>(Infinity);
  const pendingCenterOnNextFixRef = useRef(false);

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
  const [currentZoom, setCurrentZoom] = useState<number>(16);

  // User Direction Cursor & Device Compass Heading State
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const userHeadingRef = useRef<number | null>(null);
  const [isHeadingUpMode, setIsHeadingUpMode] = useState<boolean>(false);
  const isHeadingUpModeRef = useRef<boolean>(false);
  isHeadingUpModeRef.current = isHeadingUpMode;

  // Real-time device orientation & compass sensor listener (throttled & paused when tab inactive)
  useEffect(() => {
    if (!isActive) return;

    let lastTime = 0;
    const handleOrientation = (e: any) => {
      const now = performance.now();
      if (now - lastTime < 160) return; // Throttle to max ~6fps for sensor updates

      let rawHeading: number | null = null;
      if (e.webkitCompassHeading !== undefined) {
        rawHeading = e.webkitCompassHeading;
      } else if (e.alpha !== null && e.alpha !== undefined) {
        rawHeading = (360 - e.alpha) % 360;
      }

      if (rawHeading !== null && !isNaN(rawHeading)) {
        const heading = Math.round(rawHeading);
        if (userHeadingRef.current === null || Math.abs(userHeadingRef.current - heading) >= 3.5) {
          lastTime = now;
          userHeadingRef.current = heading;
          setUserHeading(heading);

          // If heading-up mode is engaged, smoothly sync map bearing with physical orientation
          if (isHeadingUpModeRef.current) {
            bearingRef.current = heading;
            setBearing(heading);
          }
        }
      }
    };

    window.addEventListener('deviceorientationabsolute', handleOrientation, { passive: true });
    window.addEventListener('deviceorientation', handleOrientation, { passive: true });

    return () => {
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

  const rotateMapBy = (deltaDeg: number) => {
    let next = (bearingRef.current + deltaDeg) % 360;
    if (next < 0) next += 360;
    next = Math.round(next);
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

  const zoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn(0.5);
    }
  };

  const zoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut(0.5);
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

  // Filtered peer locations: shows all peers on Home Map, or only room members in Room Map
  const displayedUserLocations = React.useMemo(() => {
    if (!roomOnlyMode || !roomMemberIdsSet) return userLocations;
    return userLocations.filter((loc) => roomMemberIdsSet.has(loc.userId));
  }, [roomOnlyMode, roomMemberIdsSet, userLocations]);

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

    // If roomOnlyMode and effectiveRoom has explicit members, include all room members
    if (roomOnlyMode && effectiveRoom?.members) {
      effectiveRoom.members.forEach((mem) => {
        if (seen.has(mem.userId)) return;
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
  }, [user, myLocation, roomOnlyMode, effectiveRoom, displayedUserLocations, onlineUserIds]);

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

  const createGoogleTileLayer = (mode: 'standard' | 'satellite' | 'terrain' | 'traffic') => {
    const lite = isLiteModeRef.current;
    const scaleParam = lite ? '1' : '2';
    const commonOpts: L.TileLayerOptions = {
      subdomains: ['0', '1', '2', '3'],
      detectRetina: !lite,
      keepBuffer: lite ? 1 : 2,
      updateWhenIdle: lite,
      updateWhenZooming: !lite,
    };

    if (mode === 'terrain') {
      return L.tileLayer(
        `https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&scale=${scaleParam}&hl=en`,
        {
          ...commonOpts,
          maxZoom: 20,
          attribution: '&copy; Google Maps Terrain Topo HD',
        }
      );
    } else if (mode === 'satellite') {
      return L.tileLayer(
        `https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&scale=${scaleParam}&hl=en`,
        {
          ...commonOpts,
          maxZoom: 21,
          attribution: '&copy; Google Maps Satellite HD',
        }
      );
    } else if (mode === 'traffic') {
      return L.tileLayer(
        `https://mt{s}.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}&scale=${scaleParam}&hl=en`,
        {
          ...commonOpts,
          maxZoom: 21,
          attribution: '&copy; Google Maps Live Traffic HD',
        }
      );
    } else {
      return L.tileLayer(
        `https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&scale=${scaleParam}&hl=en`,
        {
          ...commonOpts,
          maxZoom: 21,
          attribution: '&copy; Google Maps HD',
        }
      );
    }
  };

  // Initialize Leaflet Map (no hard-coded location coordinates; world view until a valid fix arrives)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = myLocation
      ? [myLocation.latitude, myLocation.longitude]
      : [0, 0];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: myLocation ? 16 : 2,
      zoomControl: false,
      preferCanvas: true,
      zoomSnap: 0.1,
      zoomDelta: 0.5,
      touchZoom: false,
      bounceAtZoomLimits: false,
      fadeAnimation: !isLiteModeRef.current,
      markerZoomAnimation: !isLiteModeRef.current,
    });

    const initialLayer = createGoogleTileLayer(mapMode).addTo(map);

    tileLayerRef.current = initialLayer;
    mapInstanceRef.current = map;

    // Track current zoom level for HUD
    map.on('zoom', () => {
      setCurrentZoom(map.getZoom());
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

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle active visibility transition and smooth canvas resize
  useEffect(() => {
    if (isActive && mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  // Automatically invalidate map size whenever the container dimensions change (e.g., Docked Panel <-> Fullscreen)
  useEffect(() => {
    const el = gestureAreaRef.current || mapContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      mapInstanceRef.current?.invalidateSize();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Smoothly swoop/fly to focused coordinates when requested from external card/alert/chat
  useEffect(() => {
    if (focusCoords && mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      map.invalidateSize();
      map.flyTo([focusCoords.lat, focusCoords.lng], 17, {
        animate: true,
        duration: 1.2,
      });
    }
  }, [focusCoords]);

  // Pinch-to-zoom and Two-finger Rotate Touch Gesture Handler
  useEffect(() => {
    const area = gestureAreaRef.current;
    if (!area) return;

    let lastDist = 0;
    let lastAngle = 0;
    let isPinchingOrRotating = false;

    const getTouchDist = (t1: Touch, t2: Touch) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const getTouchAngle = (t1: Touch, t2: Touch) => Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isPinchingOrRotating = true;
        setIsGesturing(true);
        lastDist = getTouchDist(e.touches[0], e.touches[1]);
        lastAngle = getTouchAngle(e.touches[0], e.touches[1]);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.dragging.disable();
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPinchingOrRotating || e.touches.length < 2) return;
      e.preventDefault();

      const dist = getTouchDist(e.touches[0], e.touches[1]);
      const angle = getTouchAngle(e.touches[0], e.touches[1]);

      // 1. Pinch to Zoom
      if (lastDist > 10 && dist > 10 && mapInstanceRef.current) {
        const scaleStep = dist / lastDist;
        const currentZ = mapInstanceRef.current.getZoom();
        const newZoom = Math.max(2, Math.min(21, currentZ + Math.log2(scaleStep)));
        mapInstanceRef.current.setZoom(newZoom, { animate: false });
        setCurrentZoom(newZoom);
        lastDist = dist;
      }

      // 2. Two-Finger Rotate
      let stepDelta = angle - lastAngle;
      while (stepDelta > 180) stepDelta -= 360;
      while (stepDelta < -180) stepDelta += 360;
      lastAngle = angle;

      let newB = (bearingRef.current + stepDelta) % 360;
      if (newB < 0) newB += 360;
      newB = Math.round(newB);
      bearingRef.current = newB;
      setBearing(newB);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (isPinchingOrRotating && e.touches.length < 2) {
        isPinchingOrRotating = false;
        setIsGesturing(false);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.dragging.enable();
        }

        // Auto-snap to North if within +/- 7 degrees
        const cur = bearingRef.current;
        if (cur <= 7 || cur >= 353) {
          bearingRef.current = 0;
          setBearing(0);
        }
      }
    };

    // Trackpad gesture support for Safari / macOS
    let trackpadStartBearing = 0;
    let trackpadStartZoom = 16;
    const onGestureStart = (e: any) => {
      e.preventDefault();
      isPinchingOrRotating = true;
      setIsGesturing(true);
      trackpadStartBearing = bearingRef.current;
      trackpadStartZoom = mapInstanceRef.current ? mapInstanceRef.current.getZoom() : 16;
    };

    const onGestureChange = (e: any) => {
      e.preventDefault();
      if (!isPinchingOrRotating || !mapInstanceRef.current) return;

      if (e.scale && e.scale !== 1) {
        const newZoom = Math.max(2, Math.min(21, trackpadStartZoom + Math.log2(e.scale)));
        mapInstanceRef.current.setZoom(newZoom, { animate: false });
        setCurrentZoom(newZoom);
      }

      if (typeof e.rotation === 'number') {
        let newB = (trackpadStartBearing + e.rotation) % 360;
        if (newB < 0) newB += 360;
        newB = Math.round(newB);
        bearingRef.current = newB;
        setBearing(newB);
      }
    };

    const onGestureEnd = (e: any) => {
      e.preventDefault();
      isPinchingOrRotating = false;
      setIsGesturing(false);
      const cur = bearingRef.current;
      if (cur <= 7 || cur >= 353) {
        bearingRef.current = 0;
        setBearing(0);
      }
    };

    area.addEventListener('touchstart', onTouchStart, { passive: false });
    area.addEventListener('touchmove', onTouchMove, { passive: false });
    area.addEventListener('touchend', onTouchEnd, { passive: false });
    area.addEventListener('touchcancel', onTouchEnd, { passive: false });

    area.addEventListener('gesturestart', onGestureStart as any, { passive: false });
    area.addEventListener('gesturechange', onGestureChange as any, { passive: false });
    area.addEventListener('gestureend', onGestureEnd as any, { passive: false });

    return () => {
      area.removeEventListener('touchstart', onTouchStart);
      area.removeEventListener('touchmove', onTouchMove);
      area.removeEventListener('touchend', onTouchEnd);
      area.removeEventListener('touchcancel', onTouchEnd);

      area.removeEventListener('gesturestart', onGestureStart as any);
      area.removeEventListener('gesturechange', onGestureChange as any);
      area.removeEventListener('gestureend', onGestureEnd as any);
    };
  }, []);

  // Map Mode Switcher (Google Standard, Google Satellite, Google Traffic)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const nextLayer = createGoogleTileLayer(mapMode).addTo(map);
    tileLayerRef.current = nextLayer;
  }, [mapMode, isLiteMode]);

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

      const shouldCenter =
        detail.forceCenter ||
        pendingCenterOnNextFixRef.current ||
        (!hasCenteredOnce && !focusCoords) ||
        (isReal && !hasCenteredOnRealGpsRef.current && !focusCoords) ||
        isSignificantUpgrade;

      if (shouldCenter) {
        if (isReal) {
          hasCenteredOnRealGpsRef.current = true;
        }
        bestCenteredAccuracyRef.current = Math.min(bestCenteredAccuracyRef.current, fixAcc);
        pendingCenterOnNextFixRef.current = false;
        setHasCenteredOnce(true);
        const targetZoom = Math.max(map.getZoom(), fixAcc <= 80 ? 17 : 16);
        if (isLiteModeRef.current) {
          map.setView([detail.latitude, detail.longitude], targetZoom, { animate: false });
        } else {
          map.flyTo([detail.latitude, detail.longitude], targetZoom, { animate: true, duration: 0.85 });
        }
      }
    };

    window.addEventListener('beacon:gps-fix', onGpsFix);
    return () => window.removeEventListener('beacon:gps-fix', onGpsFix);
  }, [focusCoords, hasCenteredOnce]);

  // Smooth Marker Animation Infrastructure
  const markerAnimationFramesRef = useRef<Map<string, number>>(new Map());
  const peerCircleAnimationFramesRef = useRef<Map<string, number>>(new Map());
  const accuracyCircleFrameRef = useRef<number | null>(null);

  const animateMarkerPosition = (
    marker: L.Marker,
    targetLat: number,
    targetLng: number,
    key: string,
    duration = 850
  ) => {
    if (isLiteModeRef.current) {
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
      marker.setLatLng([targetLat, targetLng]);
      return;
    }

    if (markerAnimationFramesRef.current.has(key)) {
      cancelAnimationFrame(markerAnimationFramesRef.current.get(key)!);
      markerAnimationFramesRef.current.delete(key);
    }

    const startTime = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = easeOutCubic(progress);

      const nextLat = startLat + (targetLat - startLat) * ease;
      const nextLng = startLng + (targetLng - startLng) * ease;

      marker.setLatLng([nextLat, nextLng]);

      if (progress < 1) {
        const frameId = requestAnimationFrame(step);
        markerAnimationFramesRef.current.set(key, frameId);
      } else {
        marker.setLatLng([targetLat, targetLng]);
        markerAnimationFramesRef.current.delete(key);
      }
    };

    const firstFrame = requestAnimationFrame(step);
    markerAnimationFramesRef.current.set(key, firstFrame);
  };

  const animateAccuracyCircle = (
    circle: L.Circle,
    targetLat: number,
    targetLng: number,
    targetRadius: number,
    duration = 850
  ) => {
    if (isLiteModeRef.current) {
      circle.setLatLng([targetLat, targetLng]);
      circle.setRadius(targetRadius);
      return;
    }

    const currentLatLng = circle.getLatLng();
    const startLat = currentLatLng.lat;
    const startLng = currentLatLng.lng;
    const startRadius = circle.getRadius();

    if (Math.abs(targetLat - startLat) > 0.05 || Math.abs(targetLng - startLng) > 0.05) {
      circle.setLatLng([targetLat, targetLng]);
      circle.setRadius(targetRadius);
      return;
    }

    if (accuracyCircleFrameRef.current !== null) {
      cancelAnimationFrame(accuracyCircleFrameRef.current);
      accuracyCircleFrameRef.current = null;
    }

    const startTime = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = easeOutCubic(progress);

      const nextLat = startLat + (targetLat - startLat) * ease;
      const nextLng = startLng + (targetLng - startLng) * ease;
      const nextRadius = startRadius + (targetRadius - startRadius) * ease;

      circle.setLatLng([nextLat, nextLng]);
      circle.setRadius(nextRadius);

      if (progress < 1) {
        accuracyCircleFrameRef.current = requestAnimationFrame(step);
      } else {
        circle.setLatLng([targetLat, targetLng]);
        circle.setRadius(targetRadius);
        accuracyCircleFrameRef.current = null;
      }
    };

    accuracyCircleFrameRef.current = requestAnimationFrame(step);
  };

  const animatePeerAccuracyCircle = (
    circle: L.Circle,
    targetLat: number,
    targetLng: number,
    targetRadius: number,
    key: string,
    duration = 850
  ) => {
    if (isLiteModeRef.current) {
      circle.setLatLng([targetLat, targetLng]);
      circle.setRadius(targetRadius);
      return;
    }

    const currentLatLng = circle.getLatLng();
    const startLat = currentLatLng.lat;
    const startLng = currentLatLng.lng;
    const startRadius = circle.getRadius();

    if (peerCircleAnimationFramesRef.current.has(key)) {
      cancelAnimationFrame(peerCircleAnimationFramesRef.current.get(key)!);
      peerCircleAnimationFramesRef.current.delete(key);
    }

    const startTime = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = easeOutCubic(progress);

      const nextLat = startLat + (targetLat - startLat) * ease;
      const nextLng = startLng + (targetLng - startLng) * ease;
      const nextRadius = startRadius + (targetRadius - startRadius) * ease;

      circle.setLatLng([nextLat, nextLng]);
      circle.setRadius(nextRadius);

      if (progress < 1) {
        const frameId = requestAnimationFrame(step);
        peerCircleAnimationFramesRef.current.set(key, frameId);
      } else {
        circle.setLatLng([targetLat, targetLng]);
        circle.setRadius(targetRadius);
        peerCircleAnimationFramesRef.current.delete(key);
      }
    };

    const firstFrame = requestAnimationFrame(step);
    peerCircleAnimationFramesRef.current.set(key, firstFrame);
  };

  // Cleanup marker animation frames on unmount
  useEffect(() => {
    return () => {
      markerAnimationFramesRef.current.forEach((frameId) => cancelAnimationFrame(frameId));
      markerAnimationFramesRef.current.clear();
      peerCircleAnimationFramesRef.current.forEach((frameId) => cancelAnimationFrame(frameId));
      peerCircleAnimationFramesRef.current.clear();
      if (accuracyCircleFrameRef.current !== null) {
        cancelAnimationFrame(accuracyCircleFrameRef.current);
      }
    };
  }, []);

  // Update Current User GPS Marker & Accuracy Circle (Steps 3d, 3e, 3g)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!myLocation || !Number.isFinite(myLocation.latitude) || !Number.isFinite(myLocation.longitude)) {
      if (myMarkerRef.current) {
        map.removeLayer(myMarkerRef.current);
        myMarkerRef.current = null;
      }
      if (accuracyCircleRef.current) {
        map.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }
      setDebugMarkerLatLng(null);
      return;
    }

    const markerCoords: [number, number] = [myLocation.latitude, myLocation.longitude];
    const latLng = L.latLng(markerCoords[0], markerCoords[1]);
    setDebugMarkerLatLng(markerCoords);

    const currentAcc = Number(myLocation.accuracy_m ?? myLocation.accuracy);

    if (!hasCenteredOnce) {
      map.setView(latLng, currentAcc <= 100 ? 17 : 15);
      setHasCenteredOnce(true);
      bestCenteredAccuracyRef.current = currentAcc;
      hasCenteredOnRealGpsRef.current = true;
    } else if (
      (!hasCenteredOnRealGpsRef.current && currentAcc <= 100 && !focusCoords) ||
      (!focusCoords && currentAcc < bestCenteredAccuracyRef.current * 0.65 && bestCenteredAccuracyRef.current > 35)
    ) {
      hasCenteredOnRealGpsRef.current = true;
      bestCenteredAccuracyRef.current = Math.min(bestCenteredAccuracyRef.current, currentAcc);
      if (isLiteModeRef.current) {
        map.setView(latLng, 17, { animate: false });
      } else {
        map.flyTo(latLng, 17, { animate: true, duration: 0.9 });
      }
    }

    const selfSignalInfo = getGpsSignalInfo(currentAcc);
    const serverUpdatedIso = myLocation.updated_at || myLocation.timestamp;
    const serverAgeMs = serverUpdatedIso ? Date.now() - Date.parse(serverUpdatedIso) : Infinity;
    const isServerLive = Number.isFinite(serverAgeMs) && serverAgeMs < 120000; // Step 3g: under 2 minutes old

    // Step 3e: Draw an accuracy circle (radius = accuracy_m meters) around each marker so users see the real uncertainty.
    if (Number.isFinite(currentAcc) && currentAcc > 0) {
      const accuracyRadius = currentAcc; // Exact accuracy_m in meters (never fabricated or clamped)
      const circleStyle: L.PathOptions = {
        color: selfSignalInfo.circleColor,
        fillColor: selfSignalInfo.circleColor,
        fillOpacity: selfSignalInfo.isLowSignal ? 0.2 : 0.16,
        weight: selfSignalInfo.isLowSignal ? 2.2 : 1.5,
        opacity: selfSignalInfo.isLowSignal ? 0.85 : 0.6,
        dashArray: selfSignalInfo.isLowSignal ? '6, 6' : undefined,
      };

      if (!accuracyCircleRef.current) {
        accuracyCircleRef.current = L.circle(markerCoords, {
          radius: accuracyRadius,
          ...circleStyle,
        }).addTo(map);

        accuracyCircleRef.current.on('click', () => {
          setShowBlueDotModal(true);
        });
      } else {
        accuracyCircleRef.current.setStyle(circleStyle);
        animateAccuracyCircle(accuracyCircleRef.current, markerCoords[0], markerCoords[1], accuracyRadius);
      }

      accuracyCircleRef.current.unbindTooltip();
      accuracyCircleRef.current.bindTooltip(
        `<div class="font-sans text-xs">
          <span class="font-bold text-slate-900">Your Location${isServerLive ? ' · Live' : ''}</span><br/>
          <span class="text-slate-600">Accuracy ±${Math.round(currentAcc)} m</span>
        </div>`,
        { direction: 'top', sticky: true }
      );
    }

    const effectiveHeading =
      myLocation.heading != null && !isNaN(myLocation.heading)
        ? myLocation.heading
        : userHeading;

    const visualAngle =
      effectiveHeading !== null
        ? ((effectiveHeading - bearing) % 360 + 360) % 360
        : 0;

    const userIcon = user?.markerIcon || 'person';
    const userRoleEmoji = getMemberIconEmoji(userIcon);
    const userDisplayName = user?.markerLabel || user?.fullName?.split(' ')[0] || 'You';

    const myIcon = L.divIcon({
      className: 'beacon-google-blue-dot-marker',
      html: `
        <div class="relative flex items-center justify-center w-20 h-20 pointer-events-none cursor-pointer">
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-200 ease-out" style="transform: rotate(${visualAngle}deg);">
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

          <div class="absolute inset-3 rounded-full ${selfSignalInfo.isLowSignal ? 'bg-amber-500/35 border border-amber-400/70 border-dashed' : 'bg-blue-500/25'} animate-ping pointer-events-none"></div>

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
            <span class="text-sky-300 font-mono text-[9px]">· Accuracy ±${Math.round(currentAcc)} m</span>
            ${effectiveHeading !== null ? `<span class="text-blue-300 font-mono text-[9px]">· ${Math.round(effectiveHeading)}°</span>` : ''}
          </div>
        </div>
      `,
      iconSize: [80, 80],
      iconAnchor: [40, 40],
    });

    const selfTarget: MarkerContextMenuTarget = {
      type: 'self',
      title: `${user?.fullName || 'You'} (Your Location)`,
      subtitle: `Accuracy ±${Math.round(currentAcc)} m${isServerLive ? ' · Live' : ''}`,
      lat: markerCoords[0],
      lng: markerCoords[1],
      avatarUrl: user?.avatarUrl,
      heading: effectiveHeading,
    };

    if (!myMarkerRef.current) {
      // Step 3d: Leaflet L.marker([lat, lng])
      myMarkerRef.current = L.marker(markerCoords, {
        icon: myIcon,
        zIndexOffset: 1000,
        draggable: true,
      }).addTo(map);
      myMarkerRef.current.on('click', () => {
        setSelectedUser(myLocation);
      });
      myMarkerRef.current.on('dragend', () => {
        const marker = myMarkerRef.current;
        if (!marker) return;
        const pos = marker.getLatLng();
        setManualLocation(pos.lat, pos.lng, 5);
        toast.success(`Location calibrated to (${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} · Accuracy ±5 m)`);
      });
      attachMarkerLongPress(myMarkerRef.current, selfTarget);
    } else {
      animateMarkerPosition(myMarkerRef.current, markerCoords[0], markerCoords[1], 'my_marker');
      myMarkerRef.current.setIcon(myIcon);
      attachMarkerLongPress(myMarkerRef.current, selfTarget);
    }
  }, [myLocation, user?.avatarUrl, user?.fullName, hasCenteredOnce, userHeading, bearing, debugNowMs]);

  // Update Peer Map Markers & Accuracy Circles (Steps 3d, 3e, 3g)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentMarkers = userMarkersRef.current;
    const currentCircles = userAccuracyCirclesRef.current;
    const activePeerIds = new Set<string>();

    for (const peerLoc of displayedUserLocations) {
      if (peerLoc.userId === user?.id) continue;
      if (!Number.isFinite(peerLoc.latitude) || !Number.isFinite(peerLoc.longitude)) continue;
      const peerAcc = Number(peerLoc.accuracy_m ?? peerLoc.accuracy);
      if (!Number.isFinite(peerAcc) || peerAcc <= 0 || peerAcc > 100) continue;

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

      // Step 3e: Draw an accuracy circle (radius = accuracy_m meters) around EACH marker so users see real uncertainty
      const radiusMeters = peerAcc;
      const circleStyle: L.PathOptions = {
        color: peerSignalInfo.isLowSignal ? peerSignalInfo.circleColor : peerColor,
        fillColor: peerSignalInfo.isLowSignal ? peerSignalInfo.circleColor : peerColor,
        fillOpacity: 0.15,
        weight: 1.8,
        opacity: 0.75,
        dashArray: peerSignalInfo.isLowSignal ? '6, 6' : undefined,
      };

      const tooltipHtml = `<div class="font-sans text-xs">
        <span class="font-bold text-slate-900">${peerLoc.fullName}${isPeerLive ? ' · Live' : ''}</span><br/>
        <span class="font-semibold text-slate-700">Accuracy ±${Math.round(peerAcc)} m</span>
      </div>`;

      if (!currentCircles.has(peerLoc.userId)) {
        const accCircle = L.circle(peerCoords, {
          radius: radiusMeters,
          ...circleStyle,
        }).addTo(map);
        accCircle.bindTooltip(tooltipHtml, { direction: 'top', sticky: true });
        accCircle.on('click', () => {
          setSelectedUser(peerLoc);
        });
        currentCircles.set(peerLoc.userId, accCircle);
      } else {
        const existingCircle = currentCircles.get(peerLoc.userId)!;
        existingCircle.setStyle(circleStyle);
        existingCircle.unbindTooltip();
        existingCircle.bindTooltip(tooltipHtml, { direction: 'top', sticky: true });
        animatePeerAccuracyCircle(
          existingCircle,
          peerCoords[0],
          peerCoords[1],
          radiusMeters,
          peerLoc.userId
        );
      }

      const peerIcon = L.divIcon({
        className: 'beacon-peer-marker',
        html: `
          <div class="group relative flex flex-col items-center cursor-pointer hover:scale-105 transition-transform">
            ${peerSignalInfo.isLowSignal ? `
              <div class="absolute -inset-2 rounded-full border-2 border-dashed animate-pulse pointer-events-none" style="border-color: ${peerSignalInfo.circleColor}; background-color: ${peerSignalInfo.circleColor}22;"></div>
            ` : ''}
            ${peerVisualAngle !== null ? `
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-150" style="transform: rotate(${peerVisualAngle}deg);">
                <div class="absolute -top-3 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[9px]" style="border-bottom-color: ${peerColor}; filter: drop-shadow(0 0 4px ${peerColor});"></div>
              </div>
            ` : ''}
            <div class="relative w-10 h-10 rounded-full border-2 border-white shadow-md overflow-hidden bg-slate-800 ring-2" style="outline-color: ${peerColor}; box-shadow: 0 0 8px ${peerColor}80;">
              <img src="${peerLoc.avatarUrl}" class="w-full h-full object-cover" alt="${peerLoc.fullName}" />
            </div>
            ${peerIconId !== 'person' ? `
              <div class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-900 border border-white text-[10px] flex items-center justify-center shadow">
                <span>${peerRoleEmoji}</span>
              </div>
            ` : ''}
            <div class="mt-1 px-2 py-0.5 bg-slate-900/90 backdrop-blur-sm text-[10px] text-white font-medium rounded shadow flex items-center gap-1 whitespace-nowrap ${peerSignalInfo.isLowSignal ? 'border border-amber-400/50' : ''}">
              <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${isPeerLive ? '#10b981' : '#94a3b8'};"></span>
              <span>${peerRoleEmoji !== '👤' ? `${peerRoleEmoji} ` : ''}${peerDisplayName}</span>
              ${isPeerLive ? `<span class="text-emerald-300 font-mono text-[9px]">· Live</span>` : ''}
              ${distText ? `<span class="text-slate-400">·</span><span class="text-blue-400 font-semibold">${distText}</span>` : ''}
              <span class="text-sky-300 font-mono text-[9px]">· Accuracy ±${Math.round(peerAcc)} m</span>
              ${peerHeading != null ? `<span class="text-emerald-400 font-mono text-[9px]">· ${Math.round(peerHeading)}°</span>` : ''}
            </div>
          </div>
        `,
        iconSize: [40, 56],
        iconAnchor: [20, 20],
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

      if (!currentMarkers.has(peerLoc.userId)) {
        // Step 3d: Leaflet L.marker([lat, lng])
        const marker = L.marker(peerCoords, { icon: peerIcon }).addTo(map);
        marker.on('click', () => {
          setSelectedUser(peerLoc);
        });
        attachMarkerLongPress(marker, peerTarget);
        currentMarkers.set(peerLoc.userId, marker);
      } else {
        const existingMarker = currentMarkers.get(peerLoc.userId)!;
        animateMarkerPosition(existingMarker, peerCoords[0], peerCoords[1], peerLoc.userId);
        existingMarker.setIcon(peerIcon);
        attachMarkerLongPress(existingMarker, peerTarget);
      }
    }

    for (const [userId, marker] of currentMarkers.entries()) {
      if (!activePeerIds.has(userId)) {
        if (markerAnimationFramesRef.current.has(userId)) {
          cancelAnimationFrame(markerAnimationFramesRef.current.get(userId)!);
          markerAnimationFramesRef.current.delete(userId);
        }
        map.removeLayer(marker);
        currentMarkers.delete(userId);
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
  }, [displayedUserLocations, onlineUserIds, myLocation, user?.id, bearing, memberOverridesVersion, debugNowMs]);

  // Update Saved Places Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    savedPlacesMarkersRef.current.forEach((m) => map.removeLayer(m));
    savedPlacesMarkersRef.current = [];

    savedPlaces.forEach((place) => {
      const latLng = L.latLng(place.latitude, place.longitude);
      const colorHex = place.markerColor || '#f59e0b';
      const iconEmoji = getLocationTypeEmoji(place.markerIcon || place.category);

      const placeIcon = L.divIcon({
        className: 'beacon-place-marker',
        html: `
          <div class="flex flex-col items-center cursor-pointer group hover:scale-110 transition-transform">
            <div class="w-8 h-8 rounded-2xl text-white flex items-center justify-center shadow-lg border-2 border-white text-sm" style="background-color: ${colorHex}">
              <span>${iconEmoji}</span>
            </div>
            <span class="mt-0.5 px-2 py-0.5 bg-slate-900/90 text-[10px] text-white font-bold rounded shadow-md border border-white/10 whitespace-nowrap max-w-[120px] truncate">
              ${place.name}
            </span>
          </div>
        `,
        iconSize: [32, 50],
        iconAnchor: [16, 25],
      });

      const marker = L.marker(latLng, { icon: placeIcon }).addTo(map);
      const removeBtnId = `remove-saved-place-${mapUid}-${place.id}`;
      marker.bindPopup(`
        <div class="p-2">
          <p class="font-bold text-sm text-slate-900">${place.name}</p>
          <p class="text-xs text-slate-600">${place.description || 'Saved location'}</p>
          <p class="text-[10px] text-slate-400 mt-1">Geofence radius: ${place.radiusMeters} m</p>
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
        subtitle: place.description || `Radius: ${place.radiusMeters}m`,
        lat: place.latitude,
        lng: place.longitude,
        radiusMeters: place.radiusMeters,
      });
      savedPlacesMarkersRef.current.push(marker);
    });
  }, [savedPlaces]);

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
    pendingCenterOnNextFixRef.current = true;
    requestLocationUpdate();
    if (mapInstanceRef.current && myLocation) {
      if (isLiteModeRef.current) {
        mapInstanceRef.current.setView([myLocation.latitude, myLocation.longitude], 18, { animate: false });
      } else {
        mapInstanceRef.current.flyTo([myLocation.latitude, myLocation.longitude], 18, {
          animate: true,
          duration: 0.85,
        });
      }
      const acc = Math.round(Number(myLocation.accuracy_m ?? myLocation.accuracy));
      toast.success(
        `Centered on your live location (${myLocation.latitude.toFixed(5)}, ${myLocation.longitude.toFixed(5)} · Accuracy ±${acc} m)`
      );
    } else {
      toast.info(locationStatus || 'Waiting for location');
    }
  };

  const fixAgeSeconds =
    debugTelemetry.rawFix?.timestamp != null
      ? Math.max(0, (debugNowMs - debugTelemetry.rawFix.timestamp) / 1000).toFixed(1)
      : null;

  return (
    <div
      ref={gestureAreaRef}
      className="relative w-full h-full flex flex-col overflow-hidden bg-slate-100 select-none touch-none"
      style={{ touchAction: 'none' }}
    >
      {/* Rotatable Map Container - 150% oversized to seamlessly cover all 360-degree rotation angles */}
      <div
        ref={rotatableWrapperRef}
        className="absolute origin-center will-change-transform"
        style={{
          width: '150%',
          height: '150%',
          left: '-25%',
          top: '-25%',
          transform: `rotate(${bearing}deg)`,
          transformOrigin: '50% 50%',
          transition: isGesturing ? 'none' : 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {/* Map Canvas */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />
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

      {/* Floating Gesture & Bearing HUD - clean bottom-right placement above compass cluster */}
      {(isGesturing || bearing !== 0) && (
        <div className="absolute bottom-56 right-4 z-20 bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-2xl shadow-xl border border-slate-700/80 flex items-center gap-2 text-xs font-mono animate-in fade-in duration-150">
          <Compass className="w-4 h-4 text-sky-400" style={{ transform: `rotate(${-bearing}deg)` }} />
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white">{bearing}° {getCompassHeading(bearing)}</span>
            <span className="text-slate-400">·</span>
            <span className="text-sky-300 font-medium">Zoom {currentZoom.toFixed(1)}x</span>
          </div>
          {bearing !== 0 && (
            <button
              onClick={resetNorth}
              title="Tap to Reset North"
              className="ml-1 text-[10px] bg-sky-500/30 hover:bg-sky-500/50 text-sky-200 px-2 py-0.5 rounded-lg font-sans font-bold cursor-pointer transition-colors"
            >
              Reset North
            </button>
          )}
        </div>
      )}

      {/* Top Floating Bar: Address Search, Navigation HUD & Quick Pop Button */}
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
                          18,
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

          {/* Near Me Direct Shortcut Button */}
          <button
            onClick={() => setShowPlacesPage(true)}
            title="Explore Places Near Me"
            className="flex items-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs rounded-2xl shadow-xl border border-sky-400/40 cursor-pointer active:scale-95 transition-all shrink-0"
          >
            <Compass className="w-4 h-4 text-sky-200" />
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
            <Layers className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold capitalize hidden xs:inline sm:inline">
              {mapMode === 'terrain' ? 'Terrain' : mapMode === 'satellite' ? 'Satellite' : mapMode === 'traffic' ? 'Traffic' : 'Standard'}
            </span>
            {bearing !== 0 && (
              <span className="px-1.5 py-0.2 bg-sky-500 text-white rounded-full text-[9px] font-mono font-bold">
                {bearing}°
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform duration-200 ${showMapControlsPop ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Toggle-able Layer Controller Floating Bar: Instant 1-tap switch between Terrain, Satellite, Street, and Traffic */}
        {showLayerQuickToggle && (
          <div className="flex items-center justify-between gap-1 p-1 bg-slate-900/90 backdrop-blur-xl border border-white/15 rounded-2xl shadow-xl z-20 text-white animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-1 overflow-x-auto py-0.5 px-1 scrollbar-none">
              <button
                onClick={() => {
                  setMapMode('terrain');
                  localStorage.setItem('beacon_map_style', 'terrain');
                  toast.info('🏔️ Terrain Topo map style enabled');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0 ${
                  mapMode === 'terrain'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md ring-1 ring-white/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title="Terrain Topo: Elevation contours & shaded mountains"
              >
                <Mountain className="w-3.5 h-3.5 text-emerald-300" />
                <span>Terrain</span>
              </button>

              <button
                onClick={() => {
                  setMapMode('satellite');
                  localStorage.setItem('beacon_map_style', 'satellite');
                  toast.info('🛰️ Satellite HD imagery enabled');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0 ${
                  mapMode === 'satellite'
                    ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md ring-1 ring-white/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title="Satellite: Aerial hybrid imagery"
              >
                <Globe className="w-3.5 h-3.5 text-sky-300" />
                <span>Satellite</span>
              </button>

              <button
                onClick={() => {
                  setMapMode('standard');
                  localStorage.setItem('beacon_map_style', 'standard');
                  toast.info('🗺️ Standard street map enabled');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0 ${
                  mapMode === 'standard'
                    ? 'bg-white/20 text-white shadow-md ring-1 ring-white/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title="Standard Google street map"
              >
                <MapIcon className="w-3.5 h-3.5 text-slate-300" />
                <span>Street</span>
              </button>

              <button
                onClick={() => {
                  setMapMode('traffic');
                  localStorage.setItem('beacon_map_style', 'traffic');
                  toast.info('🚗 Live Traffic layer enabled');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0 ${
                  mapMode === 'traffic'
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md ring-1 ring-white/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title="Live Traffic congestion overlay"
              >
                <Car className="w-3.5 h-3.5 text-amber-300" />
                <span>Traffic</span>
              </button>
            </div>

            <button
              onClick={() => setShowMapControlsPop(true)}
              className="px-2 py-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors shrink-0 mr-1"
              title="More layer options and controls"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
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
                  <h4 className="font-bold text-xs text-white">Map Views & Layers</h4>
                  <p className="text-[10px] text-slate-400">High-definition tiles, orientation & trails</p>
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
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 font-mono">
                Select Layer Style
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'terrain', name: 'Terrain Topo', icon: Mountain, desc: 'Elevation & Contours' },
                  { id: 'satellite', name: 'Satellite HD', icon: Globe, desc: 'Aerial Hybrid Imagery' },
                  { id: 'standard', name: 'Standard HD', icon: MapIcon, desc: 'Google Street Retina' },
                  { id: 'traffic', name: 'Live Traffic', icon: Car, desc: 'Real-time Congestion' },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = mapMode === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setMapMode(item.id as any);
                        localStorage.setItem('beacon_map_style', item.id);
                        toast.info(`${item.name} enabled`);
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

            {/* Section 2: Orientation & Compass Quick Actions */}
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Orientation & Compass
                </span>
                <span className="text-[10px] font-mono text-sky-300 font-bold">
                  {bearing}° {getCompassHeading(bearing)} · Zoom {currentZoom.toFixed(1)}x
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => rotateMapBy(-45)}
                  className="py-2 px-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                  <span>-45°</span>
                </button>
                <button
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
                  onClick={() => rotateMapBy(45)}
                  className="py-2 px-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                  <span>+45°</span>
                </button>
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
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-sky-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Center Me</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Controls: Zoom, Compass & Location */}
      <div className={`absolute ${roomOnlyMode ? 'bottom-4' : 'bottom-20'} right-4 md:bottom-6 md:right-6 z-10 flex flex-col items-center gap-2.5`}>
        {/* Zoom In & Out */}
        <div className={`${themeConfig.glassPanel} rounded-2xl shadow-xl border ${themeConfig.glassBorder} overflow-hidden flex flex-col`}>
          <button
            onClick={zoomIn}
            title="Zoom In"
            className="w-11 h-11 text-white hover:bg-white/10 active:scale-95 transition-transform flex items-center justify-center cursor-pointer border-b border-white/10"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={zoomOut}
            title="Zoom Out"
            className="w-11 h-11 text-white hover:bg-white/10 active:scale-95 transition-transform flex items-center justify-center cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        {/* Compass Rose Widget (Oriented to True North with Tap-to-Reset) */}
        <div className="relative group">
          <button
            onClick={resetNorth}
            title={bearing !== 0 ? `Reset to North (Current: ${bearing}° ${getCompassHeading(bearing)})` : 'Oriented North (0°)'}
            className={`w-12 h-12 rounded-2xl shadow-xl border flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${
              bearing !== 0
                ? 'bg-sky-600 text-white border-sky-400 shadow-sky-500/30 ring-2 ring-sky-400/40'
                : `${themeConfig.glassPanel} text-white hover:bg-white/10 ${themeConfig.glassBorder}`
            }`}
          >
            {/* Rotating Compass Needle */}
            <div
              className="relative w-6 h-6 flex items-center justify-center transition-transform"
              style={{
                transform: `rotate(${-bearing}deg)`,
                transition: isGesturing ? 'none' : 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
            >
              {/* North Pointer (Red) */}
              <div className="absolute top-0 w-0 h-0 border-x-[3.5px] border-x-transparent border-b-[10px] border-b-rose-500" />
              {/* Pivot */}
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400 z-10" />
              {/* South Pointer (Silver) */}
              <div className="absolute bottom-0 w-0 h-0 border-x-[3.5px] border-x-transparent border-t-[10px] border-t-slate-400" />
            </div>
            <span className={`text-[8.5px] font-bold tracking-tight font-mono -mt-0.5 ${bearing !== 0 ? 'text-sky-300' : 'text-slate-400'}`}>
              {bearing !== 0 ? `${bearing}°` : 'N'}
            </span>
          </button>

          {/* Quick Rotation Buttons (Hover or tap) */}
          <div className={`absolute right-full mr-2 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 ${themeConfig.glassPanel} p-1 rounded-2xl shadow-2xl border ${themeConfig.glassBorder} opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap`}>
            <button
              onClick={() => rotateMapBy(-45)}
              title="Rotate 45° CCW"
              className="px-2 py-1 hover:bg-white/10 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>45°</span>
            </button>
            <button
              onClick={resetNorth}
              title="Reset North (0°)"
              className="px-2 py-1 hover:bg-white/10 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              North
            </button>
            <button
              onClick={() => rotateMapBy(45)}
              title="Rotate 45° CW"
              className="px-2 py-1 hover:bg-white/10 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCw className="w-3 h-3" />
              <span>45°</span>
            </button>
          </div>
        </div>

        {/* User Direction Cursor / Heading-Up Follow Mode Toggle */}
        <button
          onClick={toggleHeadingUpMode}
          title={isHeadingUpMode ? 'Heading-Up Follow Active (Tap to return to North-Up)' : 'Enable Heading-Up Direction Follow'}
          className={`w-12 h-12 rounded-2xl shadow-xl border flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${
            isHeadingUpMode
              ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-cyan-300 shadow-cyan-500/30 ring-2 ring-cyan-400/50'
              : `${themeConfig.glassPanel} text-white hover:bg-white/10 ${themeConfig.glassBorder}`
          }`}
        >
          <Navigation
            className={`w-5 h-5 transition-transform duration-200 ${
              isHeadingUpMode ? 'text-white fill-current scale-110' : 'text-cyan-400'
            }`}
          />
          <span className={`text-[8px] font-bold tracking-tight font-mono mt-0.5 ${isHeadingUpMode ? 'text-cyan-100' : 'text-slate-400'}`}>
            {isHeadingUpMode ? 'FOLLOW' : 'DIR'}
          </span>
        </button>

        {/* Center on My Location Button */}
        <button
          onClick={centerOnMyLocation}
          title="Center on my location"
          className={`w-12 h-12 ${themeConfig.glassPanel} text-white hover:bg-white/10 active:scale-95 transition-transform rounded-2xl shadow-xl border ${themeConfig.glassBorder} flex items-center justify-center cursor-pointer`}
        >
          <Crosshair className="w-5 h-5 text-sky-400" />
        </button>
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

      {/* Selected User Location Card (Product Spec Section 9) */}
      {selectedUser && (
        <div className={`absolute ${roomOnlyMode ? 'bottom-4' : 'bottom-20'} left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-96 z-30 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 p-4 transition-all`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <img
                src={selectedUser.avatarUrl}
                alt={selectedUser.fullName}
                className="w-12 h-12 rounded-full border border-slate-200 object-cover"
              />
              <div>
                <h4 className="font-bold text-slate-900 text-base">{selectedUser.fullName}</h4>
                <p className="text-xs text-slate-500">@{selectedUser.username}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs border-t border-b border-slate-100 py-3">
            <div>
              <span className="text-slate-400 block">Distance</span>
              <span className="font-bold text-slate-900 text-sm">
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

            <div>
              <span className="text-slate-400 block">Accuracy & Signal</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-slate-800">
                  Accuracy ±{Math.round(Number(selectedUser.accuracy_m ?? selectedUser.accuracy))} m
                </span>
                {getGpsSignalInfo(selectedUser.accuracy).isLowSignal ? (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold">
                    {getGpsSignalInfo(selectedUser.accuracy).label}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                    Strong GPS
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block">Last Updated</span>
              <span className="font-medium text-slate-700">
                {formatTimeAgo(selectedUser.updated_at || selectedUser.timestamp)}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block">Status</span>
              <span className="font-medium text-slate-700">
                {(() => {
                  const serverTs = selectedUser.updated_at || selectedUser.timestamp;
                  const ageMs = serverTs ? Date.now() - Date.parse(serverTs) : Infinity;
                  return Number.isFinite(ageMs) && ageMs < 120000
                    ? 'Live'
                    : onlineUserIds.includes(selectedUser.userId)
                    ? 'Online (Stale fix)'
                    : 'Offline';
                })()}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => {
                toggleUserTrail(selectedUser.userId);
              }}
              disabled={loadingTrailUserIds.includes(selectedUser.userId)}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                activeTrails[selectedUser.userId]
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                  : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm'
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
                className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Message
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
              className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors cursor-pointer"
              title="Focus on map"
            >
              <Compass className="w-4 h-4" />
            </button>
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
              {/* Set as My Current Location (Exact Calibration) */}
              {contextMenu.target.type !== 'self' && (
                <button
                  onClick={() => {
                    const { lat, lng } = contextMenu.target;
                    closeContextMenu();
                    setManualLocation(lat, lng, 5);
                    toast.success(`Exact location set to (${lat.toFixed(5)}, ${lng.toFixed(5)} · ±5m)`);
                  }}
                  className="w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Crosshair className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-white block">Set as My Current Location</span>
                      <span className="text-[10px] text-slate-400 block">Calibrate exact GPS position (±5m)</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-sky-400 font-semibold">±5m</span>
                </button>
              )}

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
    </div>
  );
};
