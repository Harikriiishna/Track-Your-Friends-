import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import type { SavedPlace } from '../../types.ts';
import { api } from '../../utils/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import {
  MapPin,
  Plus,
  Trash2,
  Compass,
  Shield,
  Heart,
  Home,
  Briefcase,
  GraduationCap,
  Sparkles,
  Palette,
  Check,
  Building2,
  ShoppingCart,
  TreePine,
  Dumbbell,
} from 'lucide-react';
import {
  LOCATION_TYPES,
  MARKER_COLORS,
  getLocationTypeEmoji,
} from '../../utils/markerStyles.ts';

interface SavedPlacesManagerProps {
  onFocusMapLocation?: (lat: number, lng: number) => void;
  pendingCoords?: { lat: number; lng: number } | null;
  onClearPendingCoords?: () => void;
}

export const SavedPlacesManager: React.FC<SavedPlacesManagerProps> = ({
  onFocusMapLocation,
  pendingCoords,
  onClearPendingCoords,
}) => {
  const { user } = useAuth();
  const { myLocation } = useRealtime();
  const toast = useToast();

  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [latitude, setLatitude] = useState<number | string>('');
  const [longitude, setLongitude] = useState<number | string>('');
  const [radiusMeters, setRadiusMeters] = useState(150);
  const [category, setCategory] = useState<SavedPlace['category']>('home');
  const [visibility, setVisibility] = useState<SavedPlace['visibility']>('private');
  const [markerColor, setMarkerColor] = useState<string>('#10b981'); // Emerald default for home
  const [markerIcon, setMarkerIcon] = useState<string>('home');

  const loadPlaces = async () => {
    try {
      const res = await api.get<{ places: SavedPlace[] }>('/api/saved-places');
      setPlaces(res.places);
    } catch (err) {
      console.error('Failed to load saved places:', err);
    }
  };

  useEffect(() => {
    loadPlaces();
  }, []);

  // When user clicks map to drop a pin
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
      setShowAddModal(false);
      setName('');
      setDesc('');
      toast.success(`Saved place "${res.place.name}" with custom marker!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save place');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/saved-places/${id}`);
      setPlaces((prev) => prev.filter((p) => p.id !== id));
      toast.success('Saved place removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto p-4 md:p-6 pb-28 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-900 text-lg">Saved Locations & Geofences</h2>
          <p className="text-xs text-slate-500">
            Color-code and customize map markers for family houses, work, schools, and emergency safe zones.
          </p>
        </div>
        <button
          onClick={() => {
            handleUseCurrentLocation();
            setShowAddModal(true);
          }}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Save Place</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {places.map((place) => {
          const colorHex = place.markerColor || '#f59e0b';
          const iconEmoji = getLocationTypeEmoji(place.markerIcon || place.category);

          return (
            <div
              key={place.id}
              className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between hover:border-slate-300 transition-all"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg text-white shadow-md border-2 border-white shrink-0"
                  style={{ backgroundColor: colorHex }}
                >
                  {iconEmoji}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{place.name}</h3>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase font-mono shadow-xs"
                      style={{ backgroundColor: colorHex }}
                    >
                      {place.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{place.description || 'Custom map location'}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-1">
                    <span>Radius: {place.radiusMeters}m</span>
                    <span>·</span>
                    <span>{place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {onFocusMapLocation && (
                  <button
                    onClick={() => onFocusMapLocation(place.latitude, place.longitude)}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer"
                    title="Focus on map"
                  >
                    <Compass className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(place.id)}
                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-base text-slate-900">Save Location & Style Marker</h3>
                <p className="text-xs text-slate-500">
                  Select a distinctive icon and color to identify this location type on your map.
                </p>
              </div>
              <span className="p-2 rounded-xl bg-slate-100 text-slate-600 text-base">
                {getLocationTypeEmoji(markerIcon || category)}
              </span>
            </div>

            <form onSubmit={handleCreatePlace} className="space-y-4">
              {/* Live Marker Preview */}
              <div className="p-4 rounded-2xl bg-slate-950 text-white flex items-center justify-between gap-4 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl text-white flex items-center justify-center text-xl shadow-lg border-2 border-white shrink-0"
                    style={{ backgroundColor: markerColor }}
                  >
                    {getLocationTypeEmoji(markerIcon || category)}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">
                      Map Marker Preview
                    </span>
                    <span className="font-bold text-sm text-white block">
                      {name.trim() || 'Location Name'}
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Category: {category} · Radius: {radiusMeters}m
                    </span>
                  </div>
                </div>

                <div
                  className="px-2.5 py-1 rounded-xl text-xs font-bold text-white shrink-0 font-mono shadow"
                  style={{ backgroundColor: markerColor }}
                >
                  Custom Style
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Place Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grandma's House / Downtown Office / Central Park"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Notes or details"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Location Type & Icon Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Location Type & Icon
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 border border-slate-200 rounded-xl">
                  {LOCATION_TYPES.map((t) => {
                    const isSelected = category === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleCategoryChange(t.id as any)}
                        className={`p-2 rounded-xl text-left flex items-center gap-2 transition-all cursor-pointer text-xs ${
                          isSelected
                            ? 'bg-slate-900 text-white font-bold shadow-sm'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Marker Map Color
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
                          isSelected ? 'border-slate-900 ring-2 ring-slate-900 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                        title={c.label}
                      >
                        <div
                          className="w-4 h-4 rounded-full border border-white shadow-xs flex items-center justify-center shrink-0"
                          style={{ backgroundColor: c.hex }}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                        </div>
                        <span className="text-[10px] font-semibold text-slate-700 truncate hidden sm:inline">
                          {c.label.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Geofence Detection Radius</span>
                  <span className="font-bold text-sky-600">{radiusMeters} meters</span>
                </div>
                <input
                  type="range"
                  min="25"
                  max="500"
                  step="25"
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(Number(e.target.value))}
                  className="w-full accent-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Visibility</label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                >
                  <option value="private">Private (Only Me)</option>
                  <option value="room">Room Members</option>
                  <option value="public">Public</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm cursor-pointer"
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
