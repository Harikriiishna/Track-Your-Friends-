import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import type { UserLocation, SavedPlace, UserPathTrail, Room } from '../../types.ts';
import { calculateDistanceMeters, formatDistance, formatAccuracy, formatTimeAgo } from '../../utils/geo.ts';
import { api } from '../../utils/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
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
} from 'lucide-react';

interface LiveMapProps {
  savedPlaces?: SavedPlace[];
  rooms?: Room[];
  selectedRoomId?: string | null;
  onSelectUserForChat?: (userId: string) => void;
  onAddPlaceAtCoords?: (lat: number, lng: number) => void;
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
  rooms = [],
  selectedRoomId = null,
  onSelectUserForChat,
  onAddPlaceAtCoords,
  isActive = true,
  focusCoords = null,
}) => {
  const { user } = useAuth();
  const { themeConfig } = useTheme();
  const {
    myLocation,
    userLocations,
    gpsAccuracy,
    isGpsActive,
    gpsError,
    requestLocationUpdate,
    onlineUserIds,
  } = useRealtime();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const userMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const myMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const savedPlacesMarkersRef = useRef<L.Marker[]>([]);
  const searchMarkerRef = useRef<L.Marker | null>(null);

  // Multi-user Breadcrumb Trail Palette & Layer Groups
  interface TrailLayerGroup {
    glow: L.Polyline;
    main: L.Polyline;
    startMarker?: L.Marker;
    breadcrumbs: L.CircleMarker[];
  }

  const trailLayersRef = useRef<Map<string, TrailLayerGroup>>(new Map());

  const toast = useToast();
  const [mapMode, setMapMode] = useState<'standard' | 'satellite' | 'traffic'>('standard');
  const [selectedUser, setSelectedUser] = useState<UserLocation | null>(null);
  const [hasCenteredOnce, setHasCenteredOnce] = useState(false);
  const [showPermissionBanner, setShowPermissionBanner] = useState(!isGpsActive && !myLocation);

  // Multi-user Breadcrumb Trail State
  const [activeTrails, setActiveTrails] = useState<Record<string, UserPathTrail>>({});
  const [loadingTrailUserIds, setLoadingTrailUserIds] = useState<string[]>([]);
  const [trailWindowHours, setTrailWindowHours] = useState<number>(1);
  const [showTrailsControl, setShowTrailsControl] = useState<boolean>(false);

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

  // Real-time device orientation & compass sensor listener
  useEffect(() => {
    const handleOrientation = (e: any) => {
      let rawHeading: number | null = null;
      if (e.webkitCompassHeading !== undefined) {
        rawHeading = e.webkitCompassHeading;
      } else if (e.alpha !== null && e.alpha !== undefined) {
        rawHeading = (360 - e.alpha) % 360;
      }

      if (rawHeading !== null && !isNaN(rawHeading)) {
        const heading = Math.round(rawHeading);
        if (userHeadingRef.current === null || Math.abs(userHeadingRef.current - heading) >= 1.5) {
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

    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

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

  // Active room and members list
  const activeRoom = rooms.find((r) => r.id === selectedRoomId);
  const roomUsersList = React.useMemo(() => {
    const list: Array<{
      id: string;
      fullName: string;
      username: string;
      avatarUrl: string;
      isOnline: boolean;
      isMe: boolean;
    }> = [];

    // Current user (Self)
    if (user) {
      list.push({
        id: user.id,
        fullName: `${user.fullName} (You)`,
        username: user.username,
        avatarUrl: user.avatarUrl,
        isOnline: true,
        isMe: true,
      });
    }

    // Room Peers
    userLocations.forEach((loc) => {
      if (user && loc.userId === user.id) return;
      list.push({
        id: loc.userId,
        fullName: loc.fullName,
        username: loc.username,
        avatarUrl: loc.avatarUrl,
        isOnline: onlineUserIds.includes(loc.userId),
        isMe: false,
      });
    });

    return list;
  }, [user, userLocations, onlineUserIds]);

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

  const createGoogleTileLayer = (mode: 'standard' | 'satellite' | 'traffic') => {
    if (mode === 'satellite') {
      return L.tileLayer(
        `https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=${GOOGLE_MAPS_KEY}`,
        {
          maxZoom: 21,
          subdomains: ['0', '1', '2', '3'],
          attribution: '&copy; Google Maps',
        }
      );
    } else if (mode === 'traffic') {
      return L.tileLayer(
        `https://mt{s}.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}&key=${GOOGLE_MAPS_KEY}`,
        {
          maxZoom: 21,
          subdomains: ['0', '1', '2', '3'],
          attribution: '&copy; Google Maps Traffic',
        }
      );
    } else {
      return L.tileLayer(
        `https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${GOOGLE_MAPS_KEY}`,
        {
          maxZoom: 21,
          subdomains: ['0', '1', '2', '3'],
          attribution: '&copy; Google Maps',
        }
      );
    }
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = myLocation ? myLocation.latitude : 37.7749;
    const initialLng = myLocation ? myLocation.longitude : -122.4194;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 16,
      zoomControl: false,
      zoomSnap: 0.1, // Smooth fractional zoom steps for pinch gestures
      zoomDelta: 0.5,
      touchZoom: false, // Handled concurrently with two-finger rotation in our gesture handler
      bounceAtZoomLimits: false,
    });

    const googleLayer = createGoogleTileLayer('standard').addTo(map);

    tileLayerRef.current = googleLayer;
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

    map.on('click', (e: L.LeafletMouseEvent) => {
      setShowSearchDropdown(false);
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
      if (onAddPlaceAtCoords) {
        onAddPlaceAtCoords(lat, lng);
      }
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
  }, [mapMode]);

  // Smooth Marker Animation Infrastructure
  const markerAnimationFramesRef = useRef<Map<string, number>>(new Map());
  const accuracyCircleFrameRef = useRef<number | null>(null);

  const animateMarkerPosition = (
    marker: L.Marker,
    targetLat: number,
    targetLng: number,
    key: string,
    duration = 850
  ) => {
    const currentLatLng = marker.getLatLng();
    const startLat = currentLatLng.lat;
    const startLng = currentLatLng.lng;

    // Negligible movement threshold (< ~0.3 meters)
    if (Math.abs(targetLat - startLat) < 0.000003 && Math.abs(targetLng - startLng) < 0.000003) {
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
    const currentLatLng = circle.getLatLng();
    const startLat = currentLatLng.lat;
    const startLng = currentLatLng.lng;
    const startRadius = circle.getRadius();

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

  // Cleanup marker animation frames on unmount
  useEffect(() => {
    return () => {
      markerAnimationFramesRef.current.forEach((frameId) => cancelAnimationFrame(frameId));
      markerAnimationFramesRef.current.clear();
      if (accuracyCircleFrameRef.current !== null) {
        cancelAnimationFrame(accuracyCircleFrameRef.current);
      }
    };
  }, []);

  // Update Current User GPS Marker & Accuracy Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !myLocation) return;

    const latLng = L.latLng(myLocation.latitude, myLocation.longitude);
    setShowPermissionBanner(false);

    if (!hasCenteredOnce) {
      map.setView(latLng, 16);
      setHasCenteredOnce(true);
    }

    if (myLocation.accuracy) {
      if (!accuracyCircleRef.current) {
        accuracyCircleRef.current = L.circle(latLng, {
          radius: myLocation.accuracy,
          color: '#3b82f6',
          fillColor: '#60a5fa',
          fillOpacity: 0.15,
          weight: 1.5,
        }).addTo(map);
      } else {
        animateAccuracyCircle(accuracyCircleRef.current, myLocation.latitude, myLocation.longitude, myLocation.accuracy);
      }
    }

    const effectiveHeading =
      myLocation.heading != null && !isNaN(myLocation.heading)
        ? myLocation.heading
        : userHeading;

    const visualAngle =
      effectiveHeading !== null
        ? ((effectiveHeading - bearing) % 360 + 360) % 360
        : 0;

    const avatar = user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.fullName || 'Me')}`;
    const myIcon = L.divIcon({
      className: 'beacon-my-marker',
      html: `
        <div class="relative flex items-center justify-center w-16 h-16 pointer-events-none">
          <!-- Directional Beam & Precision Arrowhead Cursor -->
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-150 ease-out" style="transform: rotate(${visualAngle}deg);">
            <!-- Radiant 60-degree Field-of-View Cone Beam -->
            <svg class="absolute -top-6 w-24 h-24 overflow-visible pointer-events-none opacity-85" viewBox="0 0 100 100">
              <defs>
                <radialGradient id="beaconBeamGradient" cx="50%" cy="100%" r="95%">
                  <stop offset="0%" stop-color="rgba(14, 165, 233, 0.55)" />
                  <stop offset="50%" stop-color="rgba(56, 189, 248, 0.22)" />
                  <stop offset="100%" stop-color="rgba(2, 132, 199, 0)" />
                </radialGradient>
              </defs>
              <path d="M 50 95 L 18 20 A 62 62 0 0 1 82 20 Z" fill="url(#beaconBeamGradient)" />
            </svg>
            <!-- Precision Arrowhead Direction Cursor -->
            <div class="absolute -top-3 flex flex-col items-center">
              <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[11px] border-b-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.95)]"></div>
            </div>
          </div>

          <!-- Pulsing Radar Halo -->
          <div class="absolute inset-2.5 rounded-full bg-cyan-500/20 animate-ping"></div>

          <!-- User Avatar Core -->
          <div class="relative w-10 h-10 rounded-full border-2 border-white shadow-xl overflow-hidden bg-slate-900 ring-2 ring-cyan-500 pointer-events-auto cursor-pointer">
            <img src="${avatar}" class="w-full h-full object-cover" alt="Me" />
          </div>

          <!-- Direction & Identity Badge -->
          <div class="absolute -bottom-1.5 px-2 py-0.2 bg-gradient-to-r from-blue-600 to-cyan-600 text-[10px] text-white font-bold rounded-full shadow-md flex items-center gap-1 pointer-events-auto whitespace-nowrap">
            <span>You</span>
            ${effectiveHeading !== null ? `<span class="text-cyan-200 font-mono text-[9px]">· ${Math.round(effectiveHeading)}°</span>` : ''}
          </div>
        </div>
      `,
      iconSize: [64, 64],
      iconAnchor: [32, 32],
    });

    if (!myMarkerRef.current) {
      myMarkerRef.current = L.marker(latLng, { icon: myIcon, zIndexOffset: 1000 }).addTo(map);
      myMarkerRef.current.on('click', () => {
        setSelectedUser(myLocation);
      });
    } else {
      animateMarkerPosition(myMarkerRef.current, myLocation.latitude, myLocation.longitude, 'my_marker');
      myMarkerRef.current.setIcon(myIcon);
    }
  }, [myLocation, user?.avatarUrl, user?.fullName, hasCenteredOnce, userHeading, bearing]);

  // Update Peer Map Markers with Fluid Smooth Interpolation & Heading Cursors
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentMarkers = userMarkersRef.current;
    const activePeerIds = new Set<string>();

    for (const peerLoc of userLocations) {
      if (peerLoc.userId === user?.id) continue;
      activePeerIds.add(peerLoc.userId);

      const latLng = L.latLng(peerLoc.latitude, peerLoc.longitude);
      const isOnline = onlineUserIds.includes(peerLoc.userId);

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

      const peerIcon = L.divIcon({
        className: 'beacon-peer-marker',
        html: `
          <div class="group relative flex flex-col items-center cursor-pointer">
            <!-- Peer Heading Direction Pointer Arrow -->
            ${peerVisualAngle !== null ? `
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-150" style="transform: rotate(${peerVisualAngle}deg);">
                <div class="absolute -top-3 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[9px] border-b-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.85)]"></div>
              </div>
            ` : ''}
            <div class="relative w-10 h-10 rounded-full border-2 border-white shadow-md overflow-hidden bg-slate-800 ${
              isOnline ? 'ring-2 ring-emerald-500' : 'ring-1 ring-slate-400'
            }">
              <img src="${peerLoc.avatarUrl}" class="w-full h-full object-cover" alt="${peerLoc.fullName}" />
            </div>
            <div class="mt-1 px-2 py-0.5 bg-slate-900/90 backdrop-blur-sm text-[10px] text-white font-medium rounded shadow flex items-center gap-1 whitespace-nowrap">
              <span>${peerLoc.fullName.split(' ')[0]}</span>
              ${distText ? `<span class="text-slate-400">·</span><span class="text-blue-400 font-semibold">${distText}</span>` : ''}
              ${peerHeading != null ? `<span class="text-emerald-400 font-mono text-[9px]">· ${Math.round(peerHeading)}°</span>` : ''}
            </div>
          </div>
        `,
        iconSize: [40, 56],
        iconAnchor: [20, 20],
      });

      if (!currentMarkers.has(peerLoc.userId)) {
        const marker = L.marker(latLng, { icon: peerIcon }).addTo(map);
        marker.on('click', () => {
          setSelectedUser(peerLoc);
        });
        currentMarkers.set(peerLoc.userId, marker);
      } else {
        const existingMarker = currentMarkers.get(peerLoc.userId)!;
        animateMarkerPosition(existingMarker, peerLoc.latitude, peerLoc.longitude, peerLoc.userId);
        existingMarker.setIcon(peerIcon);
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
  }, [userLocations, onlineUserIds, myLocation, user?.id, bearing]);

  // Update Saved Places Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    savedPlacesMarkersRef.current.forEach((m) => map.removeLayer(m));
    savedPlacesMarkersRef.current = [];

    savedPlaces.forEach((place) => {
      const latLng = L.latLng(place.latitude, place.longitude);
      const placeIcon = L.divIcon({
        className: 'beacon-place-marker',
        html: `
          <div class="flex flex-col items-center">
            <div class="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md border-2 border-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <span class="mt-0.5 px-1.5 py-0.5 bg-slate-900/90 text-[10px] text-white font-medium rounded shadow whitespace-nowrap">
              ${place.name}
            </span>
          </div>
        `,
        iconSize: [28, 48],
        iconAnchor: [14, 28],
      });

      const marker = L.marker(latLng, { icon: placeIcon }).addTo(map);
      marker.bindPopup(`
        <div class="p-2">
          <p class="font-bold text-sm">${place.name}</p>
          <p class="text-xs text-slate-600">${place.description || 'Saved location'}</p>
          <p class="text-[10px] text-slate-400 mt-1">Geofence radius: ${place.radiusMeters} m</p>
        </div>
      `);
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

  const centerOnMyLocation = () => {
    if (mapInstanceRef.current && myLocation) {
      mapInstanceRef.current.flyTo([myLocation.latitude, myLocation.longitude], 17, { duration: 1.2 });
    } else {
      requestLocationUpdate();
    }
  };

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

      {/* Floating Gesture & Bearing HUD */}
      {(isGesturing || bearing !== 0) && (
        <div className="absolute top-20 right-4 z-30 bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-2xl shadow-xl border border-slate-700/80 flex items-center gap-2 text-xs font-mono animate-in fade-in duration-150">
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

      {/* Top Floating Bar: Address Search & Map Mode Switcher */}
      <div className="absolute top-4 left-4 right-4 md:right-auto md:w-96 z-20 flex flex-col gap-2">
        {/* Search Input Box */}
        <div className="relative">
          <div className={`flex items-center gap-2 ${themeConfig.glassPanel} px-3.5 py-2.5 rounded-2xl shadow-xl border ${themeConfig.glassBorder}`}>
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search address, landmark, or street..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => {
                if (searchResults.length > 0) setShowSearchDropdown(true);
              }}
              className={`w-full bg-transparent text-xs ${themeConfig.textPrimary} focus:outline-none placeholder-slate-400 font-medium`}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchDropdown(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div className={`absolute top-full left-0 right-0 mt-1 ${themeConfig.glassPanel} rounded-2xl shadow-2xl border ${themeConfig.glassBorder} overflow-hidden divide-y divide-white/10 max-h-60 overflow-y-auto`}>
              {searchResults.map((res, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectSearchResult(res)}
                  className="w-full p-3 text-left hover:bg-white/10 transition-colors flex items-start gap-2.5"
                >
                  <MapPin className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div className="truncate">
                    <span className={`font-bold text-xs ${themeConfig.textPrimary} block truncate`}>{res.name}</span>
                    <span className="text-[10px] text-slate-400 block truncate">{res.display_name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Layer Toggle Control: Standard Map, Satellite View, and High-Contrast Traffic View */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 ${themeConfig.glassPanel} p-1 rounded-2xl shadow-xl border ${themeConfig.glassBorder}`}>
            <button
              onClick={() => {
                setMapMode('standard');
                toast.info('Standard map layer enabled');
              }}
              title="Standard Street Map"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                mapMode === 'standard'
                  ? 'bg-white/20 text-white shadow-sm ring-1 ring-white/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Standard</span>
            </button>
            <button
              onClick={() => {
                setMapMode('satellite');
                toast.info('Satellite imagery layer enabled');
              }}
              title="Satellite Aerial Imagery"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                mapMode === 'satellite'
                  ? 'bg-white/20 text-white shadow-sm ring-1 ring-white/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Satellite</span>
            </button>
            <button
              onClick={() => {
                setMapMode('traffic');
                toast.info('High-contrast traffic layer enabled');
              }}
              title="High-Contrast Traffic & Transit Network"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                mapMode === 'traffic'
                  ? 'bg-white/20 text-white shadow-sm ring-1 ring-sky-400/50'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>Traffic</span>
            </button>
          </div>

          {/* Breadcrumb Trail Toggle Control for Selected Users in Room */}
          <div className="relative">
            <button
              onClick={() => setShowTrailsControl(!showTrailsControl)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-2xl shadow-xl border transition-all cursor-pointer active:scale-95 whitespace-nowrap ${
                Object.keys(activeTrails).length > 0
                  ? 'bg-sky-600 text-white border-sky-400 shadow-sky-600/30 ring-2 ring-sky-400/40'
                  : `${themeConfig.glassPanel} text-white hover:text-white ${themeConfig.glassBorder} hover:bg-white/10`
              }`}
              title="Toggle breadcrumb trail (previous locations) for room members"
            >
              <Footprints className={`w-3.5 h-3.5 ${Object.keys(activeTrails).length > 0 ? 'text-white' : 'text-sky-400'}`} />
              <span>Trails</span>
              {Object.keys(activeTrails).length > 0 && (
                <span className="px-1.5 py-0.2 bg-white text-sky-800 rounded-full text-[10px] font-bold">
                  {Object.keys(activeTrails).length}
                </span>
              )}
              <ChevronDown className={`w-3 h-3 transition-transform ${showTrailsControl ? 'rotate-180' : ''}`} />
            </button>

            {/* Room Members Breadcrumb Popover Menu */}
            {showTrailsControl && (
              <div className={`absolute top-full left-0 mt-2 w-80 md:w-96 ${themeConfig.glassPanel} rounded-2xl shadow-2xl border ${themeConfig.glassBorder} p-4 z-40 animate-in fade-in slide-in-from-top-2 duration-150`}>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <Route className="w-3.5 h-3.5 text-sky-500" />
                      <span>Breadcrumb Trails</span>
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      {activeRoom ? `Room #${activeRoom.name}` : 'Toggle previous locations for room members'}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowTrailsControl(false)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* History Window & Batch Actions */}
                <div className="py-2.5 flex items-center justify-between gap-2 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px]">
                    {[
                      { label: '15m', val: 0.25 },
                      { label: '30m', val: 0.5 },
                      { label: '1h', val: 1 },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => reloadAllActiveTrails(opt.val)}
                        className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                          trailWindowHours === opt.val
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={toggleAllRoomTrails}
                      className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      {roomUsersList.length > 0 && roomUsersList.every((u) => !!activeTrails[u.id])
                        ? 'Hide All'
                        : 'Show All'}
                    </button>
                    {Object.keys(activeTrails).length > 0 && (
                      <button
                        onClick={clearAllTrails}
                        className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Member Checkbox/Toggle List */}
                <div className="mt-2 divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {roomUsersList.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400">
                      No members currently sharing location in this room.
                    </div>
                  ) : (
                    roomUsersList.map((member) => {
                      const isActive = !!activeTrails[member.id];
                      const isLoading = loadingTrailUserIds.includes(member.id);
                      const palette = getPaletteForUser(member.id);
                      const trail = activeTrails[member.id];

                      return (
                        <div
                          key={member.id}
                          className="py-2 flex items-center justify-between gap-2.5 hover:bg-slate-50/80 rounded-xl px-1.5 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="relative shrink-0">
                              <img
                                src={member.avatarUrl}
                                alt={member.fullName}
                                className={`w-8 h-8 rounded-full object-cover border-2 ${
                                  isActive ? palette.border : 'border-slate-200'
                                }`}
                              />
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                  member.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                                }`}
                              />
                            </div>

                            <div className="truncate flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-slate-900 truncate">
                                  {member.fullName}
                                </span>
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${palette.bg}`}
                                  title={`Trail color: ${palette.name}`}
                                />
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                {isActive && trail ? (
                                  <span className="text-sky-600 font-semibold font-mono">
                                    {formatDistance(trail.totalDistanceMeters)} · {trail.points.length} pts
                                  </span>
                                ) : (
                                  <span>@{member.username}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {isActive && (
                              <button
                                onClick={() => fitUserTrailBounds(member.id)}
                                title="Zoom to trail"
                                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => toggleUserTrail(member.id)}
                              disabled={isLoading}
                              className={`p-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                isActive
                                  ? `${palette.bg} text-white border-transparent shadow-xs`
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
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
                    })
                  )}
                </div>

                {Object.keys(activeTrails).length > 0 && (
                  <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">
                      {Object.keys(activeTrails).length} trail{Object.keys(activeTrails).length > 1 ? 's' : ''} active
                    </span>
                    <button
                      onClick={fitAllTrailsBounds}
                      className="text-sky-600 hover:text-sky-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" />
                      Fit All on Map
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Genuine GPS Accuracy Badge strictly formatted */}
          <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md border border-slate-200 flex items-center gap-2 text-xs">
            <div
              className={`w-2 h-2 rounded-full ${
                isGpsActive ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
              }`}
            />
            <span className="font-medium text-slate-800">
              {isGpsActive
                ? `Live GPS · ${gpsAccuracy ? formatAccuracy(gpsAccuracy) : 'Acquiring...'}`
                : 'GPS Initializing'}
            </span>
          </div>
        </div>
      </div>

      {/* Onboarding Explanation Banner (Section 7.1 & 7.2) */}
      {showPermissionBanner && !isGpsActive && (
        <div className="absolute top-24 left-4 right-4 md:left-4 md:w-96 z-20 bg-blue-900 text-white p-4 rounded-2xl shadow-2xl border border-blue-800 flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-xs">Enable Maximum Real-Time Accuracy</h4>
            <p className="text-[11px] text-blue-200 mt-0.5 leading-relaxed">
              Beacon uses GNSS and device sensors to calculate distances in meters, protect safety check-ins, and trigger geofenced reminders.
            </p>
            <button
              onClick={() => {
                requestLocationUpdate();
                setShowPermissionBanner(false);
              }}
              className="mt-2.5 px-3 py-1 bg-white text-blue-900 font-bold text-xs rounded-lg shadow"
            >
              Enable GPS Tracking
            </button>
          </div>
          <button onClick={() => setShowPermissionBanner(false)} className="text-blue-300 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating Controls: Zoom, Compass & Location */}
      <div className="absolute bottom-20 right-4 md:bottom-6 md:right-6 z-10 flex flex-col items-center gap-2.5">
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

      {/* GPS Error Banner */}
      {gpsError && (
        <div className="absolute top-24 right-4 max-w-sm z-20 bg-rose-50 border border-rose-200 p-3.5 rounded-2xl shadow-lg text-rose-900 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">GPS Permission Alert</p>
            <p className="mt-0.5 text-rose-700">{gpsError}</p>
          </div>
          <button
            onClick={requestLocationUpdate}
            className="text-xs bg-rose-600 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      )}


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
        <div className="absolute bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-96 z-30 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 p-4 transition-all">
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
              <span className="text-slate-400 block">Accuracy</span>
              <span className="font-semibold text-slate-800">
                {formatAccuracy(selectedUser.accuracy)}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block">Last Updated</span>
              <span className="font-medium text-slate-700">
                {formatTimeAgo(selectedUser.timestamp)}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block">Status</span>
              <span className="font-medium text-slate-700">
                {onlineUserIds.includes(selectedUser.userId) ? 'Online' : 'Offline'}
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
    </div>
  );
};
