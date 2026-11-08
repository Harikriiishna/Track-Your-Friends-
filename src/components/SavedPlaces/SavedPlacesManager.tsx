import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import type { SavedPlace } from '../../types.ts';
import { api } from '../../utils/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import {
  MapPin,
  Plus,
  Trash2,
  Compass,
  Heart,
  Sparkles,
  Check,
  Navigation,
} from 'lucide-react';
import {
  LOCATION_TYPES,
  MARKER_COLORS,
  getLocationTypeEmoji,
} from '../../utils/markerStyles.ts';

interface SavedPlacesManagerProps {
  savedPlaces?: SavedPlace[];
  onRefreshSavedPlaces?: () => void;
  onFocusMapLocation?: (lat: number, lng: number) => void;
  pendingCoords?: { lat: number; lng: number } | null;
  onClearPendingCoords?: () => void;
}

const PLACE_CARD_GRADIENTS = [
  'from-[#8957FF] to-[#FF4FA3]',
  'from-[#397BFF] to-[#00D9FF]',
  'from-[#00D6A0] to-[#00D9FF]',
  'from-[#FF4FA3] to-[#FF8066]',
  'from-[#8957FF] to-[#397BFF]',
];

export const SavedPlacesManager: React.FC<SavedPlacesManagerProps> = ({
  savedPlaces,
  onRefreshSavedPlaces,
  onFocusMapLocation,
  pendingCoords,
  onClearPendingCoords,
}) => {
  const { user } = useAuth();
  const { myLocation } = useRealtime();
  const { themeConfig } = useTheme();
  const isDark = themeConfig.isDark;
  const toast = useToast();

  const [places, setPlaces] = useState<SavedPlace[]>(savedPlaces || []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [latitude, setLatitude] = useState<number | string>('');
  const [longitude, setLongitude] = useState<number | string>('');
  const [radiusMeters, setRadiusMeters] = useState(150);
  const [category, setCategory] = useState<SavedPlace['category']>('home');
  const [visibility, setVisibility] = useState<SavedPlace['visibility']>('private');
  const [markerColor, setMarkerColor] = useState<string>('#8957FF');
  const [markerIcon, setMarkerIcon] = useState<string>('home');

  useEffect(() => {
    if (savedPlaces) {
      setPlaces(savedPlaces);
    }
  }, [savedPlaces]);

  const loadPlaces = async () => {
    if (!user || !api.getToken()) return;
    try {
      const res = await api.get<{ places: SavedPlace[] }>('/api/saved-places');
      setPlaces(res.places || []);
    } catch (err) {
      console.warn('Could not load saved places:', err);
    }
  };

  useEffect(() => {
    loadPlaces();
  }, [user?.id]);

  useEffect(() => {
    if (pendingCoords) {
      setLatitude(pendingCoords.lat.toFixed(6));
      setLongitude(pendingCoords.lng.toFixed(6));
      setShowAddModal(true);
      if (onClearPendingCoords) onClearPendingCoords();
    }
  }, [pendingCoords]);

  const handleUseCurrentLocation = () => {
    if (myLocation) {
      setLatitude(myLocation.latitude.toFixed(6));
      setLongitude(myLocation.longitude.toFixed(6));
    }
  };

  const handleCategoryChange = (cat: SavedPlace['category']) => {
    setCategory(cat);
    setMarkerIcon(cat);
    const locConfig = LOCATION_TYPES.find((t) => t.id === cat);
    if (locConfig) {
      setMarkerColor(locConfig.defaultColor);
    }
  };

  const handleCreatePlace = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post<{ place: SavedPlace }>('/api/saved-places', {
        name,
        description: desc,
        latitude: Number(latitude),
        longitude: Number(longitude),
        radiusMeters,
        category,
        visibility,
        markerColor,
        markerIcon,
      });
      setPlaces((prev) => [...prev, res.place]);
      onRefreshSavedPlaces?.();
      setShowAddModal(false);
      setName('');
      setDesc('');
      toast.success(`Saved place "${res.place.name}" with custom marker!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save place');
    }
  };

  const handleDelete = async (id: string, placeName?: string) => {
    try {
      await api.delete(`/api/saved-places/${id}`);
      setPlaces((prev) => prev.filter((p) => p.id !== id));
      onRefreshSavedPlaces?.();
      toast.success(
        placeName ? `Removed "${placeName}" from Saved Places` : 'Saved place removed'
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  return (
    <div
      className={`flex flex-col h-full overflow-y-auto p-4 md:p-6 pb-28 space-y-5 transition-colors duration-300 ${
        isDark ? 'bg-[#0B081B] text-[#F8F7FF]' : 'bg-[#F8F6FF] text-slate-900'
      }`}
    >
      {/* Colourful Social Places Header */}
      <div
        className={`rounded-[32px] p-5 sm:p-6 border flex items-center justify-between gap-4 flex-wrap ${
          isDark
            ? 'bg-gradient-to-br from-[#1B153A] via-[#130F2B] to-[#241445] border-[#8957FF]/35 shadow-xl'
            : 'bg-gradient-to-br from-white via-[#F8F6FF] to-[#FFF0F7] border-[#8957FF]/20 shadow-sm'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#00D6A0] to-[#00D9FF] text-slate-950 flex items-center justify-center shadow-lg">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-extrabold text-lg sm:text-xl">
              Saved Places, Hotspots & Geofences
            </h2>
            <p className={`text-xs ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
              Bookmark your favourite spots, family homes, campuses & custom geofence zones
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            handleUseCurrentLocation();
            setShowAddModal(true);
          }}
          className="px-4 py-2.5 bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] text-white rounded-2xl text-xs font-extrabold flex items-center gap-1.5 shadow-[0_6px_20px_rgba(255,79,163,0.35)] transition-transform cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Save New Place</span>
        </button>
      </div>

      {places.length === 0 ? (
        <div
          className={`rounded-[32px] border p-10 text-center space-y-2.5 ${
            isDark
              ? 'bg-[#130F2B]/85 border-white/10'
              : 'bg-white border-[#8957FF]/15 shadow-sm'
          }`}
        >
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-[#FF4FA3]/20 to-[#FF8066]/20 text-[#FF4FA3] flex items-center justify-center mx-auto">
            <Heart className="w-7 h-7" />
          </div>
          <p className="font-extrabold text-sm">No Saved Places Yet</p>
          <p className={`text-xs max-w-md mx-auto ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
            Save your favourite cafes, home, or meeting spots to get automatic geofence alerts when friends arrive!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {places.map((place, idx) => {
            const colorHex = place.markerColor || '#8957FF';
            const iconEmoji = getLocationTypeEmoji(place.markerIcon || place.category);
            const stripGrad = PLACE_CARD_GRADIENTS[idx % PLACE_CARD_GRADIENTS.length];

            return (
              <div
                key={place.id}
                className={`p-5 rounded-[28px] border flex flex-col justify-between gap-4 transition-all ${
                  isDark
                    ? 'bg-[#130F2B]/90 border-[#8957FF]/25 hover:border-[#00D9FF]/50 shadow-lg'
                    : 'bg-white border-[#8957FF]/15 hover:border-[#8957FF]/45 shadow-sm'
                }`}
              >
                <div>
                  <div className={`h-1.5 w-16 rounded-full bg-gradient-to-r ${stripGrad} mb-3.5`} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl text-white shadow-lg border-2 border-white shrink-0"
                        style={{ backgroundColor: colorHex }}
                      >
                        {iconEmoji}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-sm truncate">{place.name}</h3>
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold text-white uppercase shadow-xs"
                            style={{ backgroundColor: colorHex }}
                          >
                            {place.category === 'favorite' ? 'Hotspot' : place.category}
                          </span>
                        </div>
                        <p
                          className={`text-xs mt-1 line-clamp-2 ${
                            isDark ? 'text-[#A9A2D0]' : 'text-slate-500'
                          }`}
                        >
                          {place.description || 'Custom saved social map spot'}
                        </p>
                        <div
                          className={`flex items-center gap-2 text-[11px] font-mono mt-2 ${
                            isDark ? 'text-[#00D9FF]' : 'text-[#8957FF]'
                          }`}
                        >
                          <span>Zone: {place.radiusMeters}m</span>
                          <span>·</span>
                          <span>
                            {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={`pt-3 border-t flex items-center justify-end gap-2 ${
                    isDark ? 'border-white/10' : 'border-slate-100'
                  }`}
                >
                  {onFocusMapLocation && (
                    <button
                      onClick={() => onFocusMapLocation(place.latitude, place.longitude)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Show on Map"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>View on Map</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(place.id, place.name)}
                    className="px-3 py-1.5 text-[#FF4FA3] bg-[#FF4FA3]/15 hover:bg-[#FF4FA3]/25 border border-[#FF4FA3]/30 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
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

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`rounded-[32px] p-6 max-w-lg w-full shadow-2xl border max-h-[90vh] overflow-y-auto ${
              isDark
                ? 'bg-[#130F2B] border-[#8957FF]/40 text-[#F8F7FF]'
                : 'bg-white border-[#8957FF]/20 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
              <div>
                <h3 className="font-extrabold text-base">Save Location & Custom Pin</h3>
                <p className={`text-xs ${isDark ? 'text-[#A9A2D0]' : 'text-slate-500'}`}>
                  Pick an icon and vibrant color for this place on your social map.
                </p>
              </div>
              <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#8957FF]/20 to-[#FF4FA3]/20 text-lg">
                {getLocationTypeEmoji(markerIcon || category)}
              </span>
            </div>

            <form onSubmit={handleCreatePlace} className="space-y-4">
              {/* Live Marker Preview */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#8957FF]/20 via-[#1B153A] to-[#FF4FA3]/20 text-white flex items-center justify-between gap-4 border border-[#8957FF]/35">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl text-white flex items-center justify-center text-xl shadow-lg border-2 border-white shrink-0"
                    style={{ backgroundColor: markerColor }}
                  >
                    {getLocationTypeEmoji(markerIcon || category)}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-[#00D9FF] block font-extrabold">
                      Map Pin Preview
                    </span>
                    <span className="font-extrabold text-sm text-white block">
                      {name.trim() || 'Location Name'}
                    </span>
                    <span className="text-[11px] text-white/75 block">
                      Category: {category} · Geofence: {radiusMeters}m
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold mb-1">Place Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sunset Cafe / Home / Campus Quad"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-2xl border text-sm font-semibold focus:outline-none ${
                    isDark
                      ? 'bg-[#0B081B] border-[#8957FF]/35 text-white'
                      : 'bg-[#F8F6FF] border-[#8957FF]/25 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Notes or hangout details"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-2xl border text-sm font-semibold focus:outline-none ${
                    isDark
                      ? 'bg-[#0B081B] border-[#8957FF]/35 text-white'
                      : 'bg-[#F8F6FF] border-[#8957FF]/25 text-slate-900'
                  }`}
                />
              </div>

              {/* Location Type & Icon Selector */}
              <div>
                <label className="block text-xs font-extrabold mb-1.5">
                  Location Type & Icon
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1.5 border border-[#8957FF]/25 rounded-2xl">
                  {LOCATION_TYPES.map((t) => {
                    const isSelected = category === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleCategoryChange(t.id as any)}
                        className={`p-2 rounded-xl text-left flex items-center gap-2 transition-all cursor-pointer text-xs ${
                          isSelected
                            ? 'bg-gradient-to-r from-[#8957FF] to-[#FF4FA3] text-white font-extrabold shadow-sm'
                            : isDark
                              ? 'bg-[#1B153A] hover:bg-white/10 text-[#F8F7FF]'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="text-base">{t.emoji}</span>
                        <span className="truncate">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Marker Color Palette */}
              <div>
                <label className="block text-xs font-extrabold mb-1.5">
                  Pin Accent Color
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {MARKER_COLORS.map((c) => {
                    const isSelected = markerColor.toLowerCase() === c.hex.toLowerCase();
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setMarkerColor(c.hex)}
                        className={`p-1.5 rounded-xl border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#FF4FA3] ring-2 ring-[#FF4FA3]/40'
                            : 'border-white/15'
                        }`}
                        title={c.label}
                      >
                        <div
                          className="w-4 h-4 rounded-full border border-white shadow-xs flex items-center justify-center shrink-0"
                          style={{ backgroundColor: c.hex }}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                        </div>
                        <span className="text-[10px] font-bold truncate hidden sm:inline">
                          {c.label.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-extrabold mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono ${
                      isDark ? 'bg-[#0B081B] border-white/15' : 'bg-[#F8F6FF] border-slate-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono ${
                      isDark ? 'bg-[#0B081B] border-white/15' : 'bg-[#F8F6FF] border-slate-300'
                    }`}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-extrabold mb-1">
                  <span>Geofence Radius</span>
                  <span className="text-[#00D6A0]">{radiusMeters} meters</span>
                </div>
                <input
                  type="range"
                  min="25"
                  max="500"
                  step="25"
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(Number(e.target.value))}
                  className="w-full accent-[#FF4FA3]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-extrabold rounded-xl hover:bg-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-[#8957FF] via-[#FF4FA3] to-[#FF8066] rounded-xl shadow-md cursor-pointer"
                >
                  Save Place
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
