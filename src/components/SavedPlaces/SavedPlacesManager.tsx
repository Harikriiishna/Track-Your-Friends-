import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import type { SavedPlace } from '../../types.ts';
import { api } from '../../utils/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { MapPin, Plus, Trash2, Compass, Shield, Heart, Home, Briefcase, GraduationCap } from 'lucide-react';

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
  const [radiusMeters, setRadiusMeters] = useState(100);
  const [category, setCategory] = useState<SavedPlace['category']>('favorite');
  const [visibility, setVisibility] = useState<SavedPlace['visibility']>('private');

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
      });
      setPlaces((prev) => [...prev, res.place]);
      setShowAddModal(false);
      setName('');
      setDesc('');
      toast.success(`Saved place "${res.place.name}"`);
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

  const getCategoryIcon = (cat: SavedPlace['category']) => {
    switch (cat) {
      case 'home':
        return <Home className="w-4 h-4 text-blue-500" />;
      case 'work':
        return <Briefcase className="w-4 h-4 text-emerald-500" />;
      case 'school':
        return <GraduationCap className="w-4 h-4 text-purple-500" />;
      case 'emergency_point':
        return <Shield className="w-4 h-4 text-rose-500" />;
      default:
        return <Heart className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-900 text-lg">Saved Locations & Geofences</h2>
          <p className="text-xs text-slate-500">Save custom safe zones, meeting spots, or emergency shelters</p>
        </div>
        <button
          onClick={() => {
            handleUseCurrentLocation();
            setShowAddModal(true);
          }}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Save Place
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {places.map((place) => (
          <div
            key={place.id}
            className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                {getCategoryIcon(place.category)}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{place.name}</h4>
                <p className="text-xs text-slate-500">{place.description || 'No description'}</p>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                  <span>{place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}</span>
                  <span>·</span>
                  <span>Radius: {place.radiusMeters}m</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (onFocusMapLocation) onFocusMapLocation(place.latitude, place.longitude);
                }}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
                title="View on Map"
              >
                <Compass className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(place.id)}
                className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100">
            <h3 className="font-bold text-lg text-slate-900 mb-1">Save Location</h3>
            <p className="text-xs text-slate-500 mb-4">
              Name this location to link with reminders, meetings, and geofenced alerts.
            </p>

            <form onSubmit={handleCreatePlace} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Place Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Home Safe Zone / Central Station"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Notes or instructions"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
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
                  <span className="font-bold text-blue-600">{radiusMeters} meters</span>
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  >
                    <option value="home">Home</option>
                    <option value="work">Work</option>
                    <option value="school">School</option>
                    <option value="family">Family Spot</option>
                    <option value="emergency_point">Emergency Shelter</option>
                    <option value="favorite">Favorite</option>
                  </select>
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
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm"
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
