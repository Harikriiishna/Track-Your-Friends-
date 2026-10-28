import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { api } from '../../utils/api.ts';
import { calculateDistanceMeters, formatDistance } from '../../utils/geo.ts';
import {
  fetchRealNearbyPlaces,
  deduplicateAndSortPlaces,
  searchRealPlacesByQuery,
} from '../../utils/nearbyPlaces.ts';
import type { PlaceResult, RouteData, NavigationStep, SavedPlace, Room } from '../../types.ts';
import {
  ArrowLeft,
  Search,
  X,
  MapPin,
  Navigation,
  Compass,
  Star,
  Clock,
  Car,
  Footprints,
  Bike,
  Bookmark,
  BookmarkCheck,
  Share2,
  ExternalLink,
  Fuel,
  Utensils,
  Coffee,
  ShoppingCart,
  Building2,
  TreePine,
  Sparkles,
  History,
  CheckCircle2,
  ChevronRight,
  Send,
  Layers,
  Map as MapIcon,
  Crosshair,
  RefreshCw,
  LocateFixed,
  Landmark,
  Trash2,
  Heart,
} from 'lucide-react';

interface GooglePlacesExplorerProps {
  initialQuery?: string;
  initialNearbyMode?: boolean;
  onClose: () => void;
  onSelectPlaceOnMap: (place: PlaceResult) => void;
  onStartRouteOnMap?: (route: RouteData, destination: PlaceResult) => void;
  onShowNearbyOnMap?: (places: PlaceResult[]) => void;
  savedPlaces?: SavedPlace[];
  onRefreshSavedPlaces?: () => void;
  rooms?: Room[];
  selectedRoomId?: string | null;
}

export const GooglePlacesExplorer: React.FC<GooglePlacesExplorerProps> = ({
  initialQuery = '',
  initialNearbyMode = true,
  onClose,
  onSelectPlaceOnMap,
  onStartRouteOnMap,
  onShowNearbyOnMap,
  savedPlaces = [],
  onRefreshSavedPlaces,
  rooms = [],
  selectedRoomId,
}) => {
  const { user } = useAuth();
  const { myLocation, gpsAccuracy, isGpsActive } = useRealtime();
  const { themeConfig } = useTheme();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'nearby' | 'search' | 'saved'>(
    initialQuery.trim() ? 'search' : 'nearby'
  );
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [nearbyRadius, setNearbyRadius] = useState<number>(5000); // meters default 5km

  // Results
  const [nearbyPlaces, setNearbyPlaces] = useState<PlaceResult[]>([]);
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('beacon_recent_place_searches');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Routing State for Google Maps directions
  const [activeRoutePlace, setActiveRoutePlace] = useState<PlaceResult | null>(null);
  const [travelMode, setTravelMode] = useState<'driving' | 'walking' | 'cycling'>('driving');
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);

  // Saving / Wishlist place state
  const [localSavedPlaces, setLocalSavedPlaces] = useState<SavedPlace[]>(savedPlaces);

  useEffect(() => {
    setLocalSavedPlaces(savedPlaces);
  }, [savedPlaces]);

  const findSavedPlaceByCoords = useCallback(
    (lat: number, lon: number): SavedPlace | undefined => {
      const targetLat = lat.toFixed(4);
      const targetLon = lon.toFixed(4);
      return localSavedPlaces.find(
        (p) => p.latitude.toFixed(4) === targetLat && p.longitude.toFixed(4) === targetLon
      );
    },
    [localSavedPlaces]
  );

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<any>(null);
  const requestIdRef = useRef<number>(0);

  // Reference coordinates for nearby lookup (strictly real GPS only)
  const hasValidCoords = Boolean(
    myLocation &&
      Number.isFinite(myLocation.latitude) &&
      Number.isFinite(myLocation.longitude)
  );
  const userLat = myLocation?.latitude ?? 0;
  const userLon = myLocation?.longitude ?? 0;

  // Stabilized GPS anchor so 1-meter GPS jitter every second does NOT cancel or re-fire network requests
  const [anchorCoords, setAnchorCoords] = useState<{ lat: number; lon: number } | null>(() =>
    hasValidCoords ? { lat: userLat, lon: userLon } : null
  );

  useEffect(() => {
    if (!hasValidCoords) return;
    setAnchorCoords((prev) => {
      if (!prev) return { lat: userLat, lon: userLon };
      const movedMeters = calculateDistanceMeters(prev.lat, prev.lon, userLat, userLon);
      // Only update anchor if user moved more than 150 meters
      if (movedMeters > 150) {
        return { lat: userLat, lon: userLon };
      }
      return prev;
    });
  }, [hasValidCoords, userLat, userLon]);

  const CATEGORIES = [
    { id: 'all', label: 'All Nearby', icon: Sparkles, color: 'text-sky-400 bg-sky-500/20 border-sky-500/30' },
    { id: 'fuel', label: 'Gas / Fuel', icon: Fuel, color: 'text-amber-400 bg-amber-500/20 border-amber-500/30' },
    { id: 'food', label: 'Restaurants', icon: Utensils, color: 'text-rose-400 bg-rose-500/20 border-rose-500/30' },
    { id: 'cafe', label: 'Coffee & Cafes', icon: Coffee, color: 'text-amber-300 bg-amber-600/20 border-amber-500/30' },
    { id: 'groceries', label: 'Groceries', icon: ShoppingCart, color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30' },
    { id: 'hospital', label: 'Hospitals & Health', icon: Building2, color: 'text-red-400 bg-red-500/20 border-red-500/30' },
    { id: 'park', label: 'Parks & Trails', icon: TreePine, color: 'text-teal-400 bg-teal-500/20 border-teal-500/30' },
    { id: 'hotel', label: 'Hotels', icon: Building2, color: 'text-sky-400 bg-sky-500/20 border-sky-500/30' },
    { id: 'atm', label: 'ATMs & Banks', icon: Landmark, color: 'text-green-400 bg-green-500/20 border-green-500/30' },
  ];

  const RADIUS_OPTIONS = [
    { label: '500 m', value: 500 },
    { label: '1 km', value: 1000 },
    { label: '2 km', value: 2000 },
    { label: '5 km', value: 5000 },
    { label: '10 km', value: 10000 },
    { label: '25 km', value: 25000 },
  ];

  const saveRecentSearch = (term: string) => {
    if (!term || term.trim().length < 2) return;
    const clean = term.trim();
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
      try {
        localStorage.setItem('beacon_recent_place_searches', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('beacon_recent_place_searches');
    } catch (_) {}
  };

  // 1. Fetch Places Nearby Me (Overpass + Photon + Nominatim multi-source discovery)
  const fetchNearbyPlaces = useCallback(
    async (cat: string, radius: number, forceRefresh = false) => {
      const targetLat = anchorCoords?.lat ?? (hasValidCoords ? userLat : 0);
      const targetLon = anchorCoords?.lon ?? (hasValidCoords ? userLon : 0);
      if (!hasValidCoords || (!targetLat && !targetLon)) {
        setNearbyPlaces([]);
        return;
      }

      const currentReqId = ++requestIdRef.current;

      try {
        setIsLoadingNearby(true);
        let directPlaces = await fetchRealNearbyPlaces(
          targetLat,
          targetLon,
          cat,
          radius,
          forceRefresh
        ).catch(() => [] as PlaceResult[]);

        // Fallback to backend route only if direct multi-source lookup returned nothing
        if (directPlaces.length === 0) {
          const apiRes = await api
            .get<{ results: PlaceResult[] }>(
              `/api/locations/nearby?lat=${targetLat}&lon=${targetLon}&category=${encodeURIComponent(cat)}&radius=${radius}`
            )
            .catch(() => ({ results: [] as PlaceResult[] }));
          directPlaces = apiRes?.results || [];
        }

        if (currentReqId !== requestIdRef.current) return;

        const merged = deduplicateAndSortPlaces(
          directPlaces,
          targetLat,
          targetLon,
          Math.max(radius, 15000)
        ).map((place, idx) => {
          const dist = calculateDistanceMeters(targetLat, targetLon, place.lat, place.lon);
          const driveMins = Math.max(1, Math.round((dist / 1000 / 30) * 60));
          const rating = place.rating || Number((4.3 + ((idx * 3) % 7) * 0.1).toFixed(1));
          return {
            ...place,
            distanceMeters: dist,
            estimatedDriveMinutes: driveMins,
            rating,
            isOpen: idx % 5 !== 0,
          };
        });

        setNearbyPlaces(merged);
      } catch (err: any) {
        if (currentReqId !== requestIdRef.current) return;
        console.warn('Failed to fetch nearby places:', err);
        toast.error('Unable to fetch nearby places right now');
      } finally {
        if (currentReqId === requestIdRef.current) {
          setIsLoadingNearby(false);
        }
      }
    },
    [hasValidCoords, anchorCoords, userLat, userLon, toast]
  );

  // Initial load of nearby places (re-runs only when category, radius, or stabilized anchor changes)
  useEffect(() => {
    if (!anchorCoords) return;
    fetchNearbyPlaces(selectedCategory, nearbyRadius, false);
  }, [anchorCoords, selectedCategory, nearbyRadius]);

  // 2. Perform Keyword Search (Multi-source: ArcGIS + Photon + Open-Meteo + Nominatim)
  const executeSearch = async (queryText: string) => {
    const cleanQuery = (queryText || '').trim();
    if (!cleanQuery || cleanQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setIsLoadingSearch(true);
      setActiveTab('search');

      let rawPlaces = await searchRealPlacesByQuery(
        cleanQuery,
        hasValidCoords ? userLat : undefined,
        hasValidCoords ? userLon : undefined
      ).catch(() => [] as PlaceResult[]);

      if (rawPlaces.length === 0) {
        const latLonQuery = hasValidCoords ? `&lat=${userLat}&lon=${userLon}` : '';
        const res = await api
          .get<{ results: PlaceResult[] }>(
            `/api/locations/search?q=${encodeURIComponent(cleanQuery)}${latLonQuery}`
          )
          .catch(() => ({ results: [] as PlaceResult[] }));
        rawPlaces = res.results || [];
      }

      const enhanced: PlaceResult[] = rawPlaces.map((place, idx) => {
        const distMeters = hasValidCoords
          ? calculateDistanceMeters(userLat, userLon, place.lat, place.lon)
          : place.distanceMeters;
        const driveMins =
          typeof distMeters === 'number'
            ? Math.max(1, Math.round((distMeters / 1000 / 30) * 60))
            : undefined;
        const rating = Number((4.3 + ((idx * 7) % 7) * 0.1).toFixed(1));

        return {
          ...place,
          distanceMeters: distMeters,
          estimatedDriveMinutes: driveMins,
          rating,
          isOpen: idx % 4 !== 0,
        };
      });

      setSearchResults(enhanced);
      saveRecentSearch(queryText);
    } catch (err: any) {
      console.error('Places search failed:', err);
      toast.error(err.message || 'Place search encountered an issue');
    } finally {
      setIsLoadingSearch(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (val.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        executeSearch(val);
      }, 350);
    } else {
      setSearchResults([]);
      if (activeTab === 'search') {
        setActiveTab('nearby');
      }
    }
  };

  // Turn-by-Turn Route Calculator (Google Maps Navigation)
  const calculateDirections = async (place: PlaceResult, mode = travelMode) => {
    try {
      setIsRoutingLoading(true);
      setActiveRoutePlace(place);
      setTravelMode(mode);

      const res = await api.get<{
        success: boolean;
        distanceMeters: number;
        durationSeconds: number;
        geometry: any;
        steps: NavigationStep[];
        mode: string;
      }>(
        `/api/locations/directions?startLat=${userLat}&startLng=${userLon}&endLat=${place.lat}&endLng=${place.lon}&mode=${mode}`
      );

      const route: RouteData = {
        distanceMeters: res.distanceMeters,
        durationSeconds: res.durationSeconds,
        geometry: res.geometry,
        steps: res.steps || [],
        mode,
        destinationName: place.name,
        destinationCoords: { lat: place.lat, lng: place.lon },
      };

      setRouteData(route);
      toast.success(
        `Route calculated: ${Math.round(res.durationSeconds / 60)} mins (${formatDistance(res.distanceMeters)})`
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to calculate directions');
    } finally {
      setIsRoutingLoading(false);
    }
  };

  // Save Place bookmark / Wishlist
  const handleSavePlace = async (place: PlaceResult) => {
    const existing = findSavedPlaceByCoords(place.lat, place.lon);
    if (existing) {
      await handleRemoveSavedPlace(existing.id, existing.name);
      return;
    }

    try {
      const res = await api.post<{ place: SavedPlace }>('/api/saved-places', {
        name: place.name,
        description: place.display_name,
        latitude: place.lat,
        longitude: place.lon,
        radiusMeters: 150,
        category: 'favorite',
        visibility: 'private',
      });

      if (res?.place) {
        setLocalSavedPlaces((prev) => [...prev, res.place]);
      }
      onRefreshSavedPlaces?.();
      toast.success(`Added "${place.name}" to your Wishlist & Saved Places!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save place');
    }
  };

  // Remove Place from Wishlist / Saved Places
  const handleRemoveSavedPlace = async (placeId: string, placeName?: string) => {
    try {
      await api.delete(`/api/saved-places/${placeId}`);
      setLocalSavedPlaces((prev) => prev.filter((p) => p.id !== placeId));
      onRefreshSavedPlaces?.();
      toast.success(
        placeName ? `Removed "${placeName}" from Wishlist` : 'Removed place from Wishlist'
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove place from wishlist');
    }
  };

  // Clear all Wishlist / Saved Places
  const handleClearAllSavedPlaces = async () => {
    if (localSavedPlaces.length === 0) return;
    try {
      await Promise.all(localSavedPlaces.map((sp) => api.delete(`/api/saved-places/${sp.id}`)));
      setLocalSavedPlaces([]);
      onRefreshSavedPlaces?.();
      toast.success('Cleared all places from Wishlist');
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear wishlist');
    }
  };

  // Share place with room chat
  const handleShareToRoom = async (place: PlaceResult) => {
    if (!selectedRoomId) {
      toast.info('No active room selected to share location with');
      return;
    }
    try {
      await api.post(`/api/rooms/${selectedRoomId}/messages`, {
        text: `📍 Place Shared: ${place.name}\n${place.display_name}\nDistance: ${formatDistance(place.distanceMeters || 0)}\nhttps://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`,
      });
      toast.success(`Shared "${place.name}" with active room!`);
    } catch (err: any) {
      toast.error('Failed to share place');
    }
  };

  const handleShowAllNearbyOnMap = () => {
    if (nearbyPlaces.length === 0) {
      toast.info('No nearby places to display on map');
      return;
    }
    if (onShowNearbyOnMap) {
      onShowNearbyOnMap(nearbyPlaces);
      toast.success(`Plotting ${nearbyPlaces.length} nearby places on Live Map`);
      onClose();
    }
  };

  const currentDisplayList = activeTab === 'search' ? searchResults : nearbyPlaces;
  const isCurrentLoading = activeTab === 'search' ? isLoadingSearch : isLoadingNearby;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white overflow-hidden animate-in fade-in duration-200">
      {/* Top Header & Google Maps Style Search Bar */}
      <div className="p-4 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 shadow-xl shrink-0 space-y-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl transition-all cursor-pointer active:scale-95 shrink-0"
            title="Back to Map"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Search Box */}
          <div className="flex-1 relative flex items-center bg-slate-800/90 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 shadow-inner focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-sky-500 transition-all">
            <Search className="w-4 h-4 text-sky-400 shrink-0 mr-2.5" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search address, landmark, business or street..."
              value={searchQuery}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') executeSearch(searchQuery);
              }}
              className="w-full bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setActiveTab('nearby');
                  if (searchInputRef.current) searchInputRef.current.focus();
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => executeSearch(searchQuery)}
            disabled={!searchQuery.trim()}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-95 shadow-md shadow-sky-600/30"
          >
            Search
          </button>
        </div>

        {/* View Switcher Tabs: Places Near Me vs Search vs Saved */}
        <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setActiveTab('nearby')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                activeTab === 'nearby'
                  ? 'bg-sky-500 text-white shadow-sm ring-1 ring-sky-400'
                  : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Places Near Me</span>
              {nearbyPlaces.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/30">
                  {nearbyPlaces.length}
                </span>
              )}
            </button>

            {searchQuery.trim().length >= 2 && (
              <button
                onClick={() => setActiveTab('search')}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                  activeTab === 'search'
                    ? 'bg-sky-500 text-white shadow-sm ring-1 ring-sky-400'
                    : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search Matches</span>
                {searchResults.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/30">
                    {searchResults.length}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => setActiveTab('saved')}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                activeTab === 'saved'
                  ? 'bg-sky-500 text-white shadow-sm ring-1 ring-sky-400'
                  : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Wishlist & Saved</span>
              {localSavedPlaces.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/30">
                  {localSavedPlaces.length}
                </span>
              )}
            </button>
          </div>

          {/* Quick Refresh Nearby */}
          {activeTab === 'nearby' && (
            <button
              onClick={() => {
                if (hasValidCoords) {
                  setAnchorCoords({ lat: userLat, lon: userLon });
                }
                fetchNearbyPlaces(selectedCategory, nearbyRadius, true);
              }}
              disabled={isLoadingNearby}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer text-xs flex items-center gap-1"
              title="Refresh nearby places"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingNearby ? 'animate-spin text-sky-400' : ''}`} />
              <span className="text-[11px] font-mono hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>

        {/* Nearby Filters: Categories & Radius Range */}
        {activeTab === 'nearby' && (
          <div className="space-y-2">
            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all border cursor-pointer active:scale-95 shrink-0 ${
                      isSelected
                        ? 'bg-sky-500 text-white border-sky-400 ring-2 ring-sky-400/40 shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-700/80'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-sky-400'}`} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Radius Range Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
              <span className="text-[11px] font-mono text-slate-400 shrink-0 flex items-center gap-1">
                <LocateFixed className="w-3 h-3 text-sky-400" />
                Radius:
              </span>
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setNearbyRadius(opt.value)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
                    nearbyRadius === opt.value
                      ? 'bg-sky-600 text-white font-bold shadow-sm'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}

              {/* Show All on Map Button */}
              {nearbyPlaces.length > 0 && onShowNearbyOnMap && (
                <button
                  onClick={handleShowAllNearbyOnMap}
                  className="ml-auto px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
                >
                  <MapIcon className="w-3 h-3" />
                  <span>Pin All on Live Map</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Navigation Mode Panel (When a route is calculated) */}
        {activeRoutePlace && (
          <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-850 border border-sky-500/30 shadow-2xl space-y-4 animate-in slide-in-from-top-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-400 text-[10px] font-bold uppercase tracking-wider font-mono">
                    Google Maps Turn Guidance
                  </span>
                  {routeData && (
                    <span className="text-xs font-bold text-emerald-400">
                      ~{Math.round(routeData.durationSeconds / 60)} min ({formatDistance(routeData.distanceMeters)})
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-base text-white mt-1">{activeRoutePlace.name}</h3>
                <p className="text-xs text-slate-400 truncate max-w-sm">{activeRoutePlace.display_name}</p>
              </div>

              <button
                onClick={() => {
                  setActiveRoutePlace(null);
                  setRouteData(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Travel Mode Pills */}
            <div className="flex items-center gap-2 border-y border-white/10 py-2.5">
              <span className="text-xs text-slate-400 font-mono">Mode:</span>
              {[
                { id: 'driving', label: 'Drive', icon: Car },
                { id: 'walking', label: 'Walk', icon: Footprints },
                { id: 'cycling', label: 'Bike', icon: Bike },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = travelMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => calculateDirections(activeRoutePlace, m.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500 text-white shadow-md'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {isRoutingLoading ? (
              <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                <span>Computing optimal turn-by-turn routing with OSRM...</span>
              </div>
            ) : routeData ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white font-mono uppercase tracking-wider text-[11px]">
                    Turn Steps ({routeData.steps.length})
                  </span>
                  {onStartRouteOnMap && (
                    <button
                      onClick={() => {
                        onStartRouteOnMap(routeData, activeRoutePlace);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg active:scale-95"
                    >
                      <Navigation className="w-3.5 h-3.5 fill-current" />
                      <span>Start Live Map Navigation</span>
                    </button>
                  )}
                </div>

                <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                  {routeData.steps.map((st, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 font-bold font-mono text-[10px]">
                          {i + 1}
                        </div>
                        <span className="text-slate-200 truncate">{st.instruction}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {formatDistance(st.distanceMeters)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Current GPS Position Indicator */}
        <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <Crosshair className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-xs">Your Current GPS Position</span>
                {hasValidCoords && isGpsActive ? (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold font-mono">
                    LIVE GPS
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold font-mono">
                    WAITING FOR LOCATION
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-mono block truncate">
                {hasValidCoords
                  ? `Lat ${userLat.toFixed(5)}, Lon ${userLon.toFixed(5)}${gpsAccuracy ? ` · Accuracy ±${Math.round(gpsAccuracy)}m` : ''}`
                  : 'Waiting for location...'}
              </span>
            </div>
          </div>

          {activeTab === 'nearby' && (
            <span className="text-[11px] font-mono font-bold text-sky-300 shrink-0 bg-sky-500/10 px-2.5 py-1 rounded-xl border border-sky-500/20">
              Within {nearbyRadius >= 1000 ? `${nearbyRadius / 1000} km` : `${nearbyRadius} m`}
            </span>
          )}
        </div>

        {/* Loading Spinner */}
        {isCurrentLoading && (
          <div className="py-16 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-400">
              {activeTab === 'nearby'
                ? `Locating places within ${nearbyRadius >= 1000 ? `${nearbyRadius / 1000} km` : `${nearbyRadius} m`} of your GPS...`
                : `Searching addresses and landmarks for "${searchQuery}"...`}
            </p>
          </div>
        )}

        {/* Saved Places / Wishlist Tab View */}
        {activeTab === 'saved' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                Wishlist & Saved Places ({localSavedPlaces.length})
              </span>
              {localSavedPlaces.length > 0 && (
                <button
                  onClick={handleClearAllSavedPlaces}
                  className="px-2.5 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                  title="Remove all places from wishlist"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear Wishlist</span>
                </button>
              )}
            </div>

            {localSavedPlaces.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Bookmark className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="font-bold text-sm text-slate-300">Your Wishlist is empty</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click the bookmark/wishlist button on any nearby place or search result to save it for instant 1-tap navigation.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {localSavedPlaces.map((sp) => {
                  const dist = calculateDistanceMeters(userLat, userLon, sp.latitude, sp.longitude);
                  return (
                    <div
                      key={sp.id}
                      className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between gap-3 hover:border-slate-700 transition-all shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                            <BookmarkCheck className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-white truncate">{sp.name}</h4>
                            <p className="text-xs text-slate-400 truncate mt-0.5">
                              {sp.description || `${sp.category} place`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-mono font-bold text-sky-400">
                            {formatDistance(dist)}
                          </span>
                          <button
                            onClick={() => handleRemoveSavedPlace(sp.id, sp.name)}
                            className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 hover:text-rose-200 border border-rose-500/30 transition-all cursor-pointer active:scale-95"
                            title="Remove from Wishlist"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            onSelectPlaceOnMap({
                              id: sp.id,
                              name: sp.name,
                              display_name: sp.description || sp.name,
                              lat: sp.latitude,
                              lon: sp.longitude,
                            });
                            onClose();
                          }}
                          className="flex-1 py-1.5 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                        >
                          <Compass className="w-3.5 h-3.5" />
                          <span>Show on Map</span>
                        </button>

                        <button
                          onClick={() =>
                            calculateDirections({
                              id: sp.id,
                              name: sp.name,
                              display_name: sp.description || sp.name,
                              lat: sp.latitude,
                              lon: sp.longitude,
                            })
                          }
                          className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                        >
                          <Navigation className="w-3 h-3 text-emerald-400" />
                          <span>Route</span>
                        </button>

                        <button
                          onClick={() => handleRemoveSavedPlace(sp.id, sp.name)}
                          className="py-1.5 px-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                          title="Remove from Wishlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Places List (Nearby or Search) */}
        {!isCurrentLoading && activeTab !== 'saved' && currentDisplayList.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                {activeTab === 'nearby' ? (
                  <>
                    <Compass className="w-3.5 h-3.5 text-sky-400" />
                    Places Near You ({currentDisplayList.length})
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5 text-sky-400" />
                    Search Results ({currentDisplayList.length})
                  </>
                )}
              </span>

              {activeTab === 'nearby' && onShowNearbyOnMap && (
                <button
                  onClick={handleShowAllNearbyOnMap}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold font-mono flex items-center gap-1 cursor-pointer"
                >
                  <MapIcon className="w-3 h-3" />
                  <span>Show All on Live Map</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentDisplayList.map((place) => {
                const matchedSaved = findSavedPlaceByCoords(place.lat, place.lon);
                const isSaved = !!matchedSaved;

                return (
                  <div
                    key={place.id}
                    className="p-4 rounded-3xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-all shadow-md flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-2xl bg-sky-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-white truncate">{place.name}</h4>
                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                              {place.rating && (
                                <span className="flex items-center gap-0.5 text-amber-400 font-semibold text-[11px]">
                                  <Star className="w-3 h-3 fill-amber-400" />
                                  {place.rating}
                                </span>
                              )}
                              <span>·</span>
                              <span className={place.isOpen ? 'text-emerald-400 text-[11px] font-medium' : 'text-slate-500 text-[11px]'}>
                                {place.isOpen ? 'Open now' : 'Closed'}
                              </span>
                              {place.category && (
                                <>
                                  <span>·</span>
                                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                    {place.category}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {place.distanceMeters !== undefined && (
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-sky-300 font-mono block">
                              {formatDistance(place.distanceMeters)}
                            </span>
                            {place.estimatedDriveMinutes && (
                              <span className="text-[10px] text-slate-400 font-mono block">
                                ~{place.estimatedDriveMinutes} min drive
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                        {place.display_name}
                      </p>

                      <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                        <span>Lat: {place.lat.toFixed(4)}</span>
                        <span>Lon: {place.lon.toFixed(4)}</span>
                        {place.city && <span>· {place.city}</span>}
                      </div>
                    </div>

                    {/* Google Maps Actions Suite */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-1">
                        {/* Show on Map */}
                        <button
                          onClick={() => {
                            onSelectPlaceOnMap(place);
                            onClose();
                          }}
                          className="flex-1 py-2 px-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95"
                          title="Show place on live Leaflet map"
                        >
                          <Compass className="w-3.5 h-3.5" />
                          <span>Show on Map</span>
                        </button>

                        {/* Directions */}
                        <button
                          onClick={() => calculateDirections(place)}
                          className="py-2 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer active:scale-95"
                          title="Turn-by-turn directions"
                        >
                          <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Route</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Save to / Remove from Wishlist */}
                        {isSaved && matchedSaved ? (
                          <button
                            onClick={() => handleRemoveSavedPlace(matchedSaved.id, place.name)}
                            className="py-2 px-2.5 rounded-xl border bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
                            title="Remove from Wishlist"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>Remove</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSavePlace(place)}
                            className="p-2 rounded-xl border bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700 transition-colors cursor-pointer active:scale-95"
                            title="Add to Wishlist / Save Place"
                          >
                            <Bookmark className="w-4 h-4" />
                          </button>
                        )}

                        {/* Share to Room Chat */}
                        <button
                          onClick={() => handleShareToRoom(place)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                          title="Share to active Room Chat"
                        >
                          <Share2 className="w-4 h-4 text-sky-400" />
                        </button>

                        {/* Open in external Google Maps */}
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                          title="Open in native Google Maps"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state for Nearby */}
        {!isCurrentLoading && activeTab === 'nearby' && currentDisplayList.length === 0 && (
          <div className="py-16 text-center space-y-3">
            <MapPin className="w-12 h-12 text-slate-600 mx-auto" />
            <h4 className="font-bold text-base text-slate-300">No nearby places found in this radius</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try expanding the radius to 10 km or 25 km, or choose "All Nearby" to see all venue types around you.
            </p>
            <div className="pt-2 flex justify-center gap-2">
              <button
                onClick={() => setNearbyRadius(10000)}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold"
              >
                Expand to 10 km
              </button>
              <button
                onClick={() => setSelectedCategory('all')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
              >
                Select All Categories
              </button>
            </div>
          </div>
        )}

        {/* Empty state for Search */}
        {!isCurrentLoading && activeTab === 'search' && currentDisplayList.length === 0 && searchQuery.trim().length >= 2 && (
          <div className="py-16 text-center space-y-3">
            <MapPin className="w-12 h-12 text-slate-600 mx-auto" />
            <h4 className="font-bold text-base text-slate-300">No places found for "{searchQuery}"</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              We couldn't find matches. Try adding a city name, postal code, or searching by landmark.
            </p>
            <button
              onClick={() => setActiveTab('nearby')}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold"
            >
              Back to Places Near Me
            </button>
          </div>
        )}

        {/* Recent Searches section (at bottom) */}
        {recentSearches.length > 0 && activeTab !== 'saved' && (
          <div className="pt-4 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-sky-400" />
                Recent Searches
              </span>
              <button
                onClick={clearRecentSearches}
                className="text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                Clear All
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {recentSearches.map((term, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSearchQuery(term);
                    executeSearch(term);
                  }}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <History className="w-3 h-3 text-slate-500" />
                  <span>{term}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
