import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import type { ReminderItem, SavedPlace } from '../../types.ts';
import { api } from '../../utils/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { isWithinRadius } from '../../utils/geo.ts';
import { sound } from '../../utils/audio.ts';
import { Bell, MapPin, Calendar, Plus, Trash2, Check, Clock, AlertCircle } from 'lucide-react';

interface RemindersManagerProps {
  savedPlaces?: SavedPlace[];
}

export const RemindersManager: React.FC<RemindersManagerProps> = ({ savedPlaces = [] }) => {
  const { user } = useAuth();
  const { myLocation } = useRealtime();
  const toast = useToast();

  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDateTime, setDueDateTime] = useState('');
  const [isGeofenced, setIsGeofenced] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>('');
  const [triggeredAlerts, setTriggeredAlerts] = useState<ReminderItem[]>([]);

  const loadReminders = async () => {
    try {
      const res = await api.get<{ reminders: ReminderItem[] }>('/api/reminders');
      setReminders(res.reminders);
    } catch (err) {
      console.error('Failed to load reminders:', err);
    }
  };

  useEffect(() => {
    loadReminders();
  }, []);

  // Real-time Geofence monitoring engine: runs whenever user's device location updates!
  useEffect(() => {
    if (!myLocation || reminders.length === 0) return;

    reminders.forEach(async (rem) => {
      if (rem.isGeofenced && !rem.hasTriggered && rem.locationCoords) {
        const inArea = isWithinRadius(
          myLocation.latitude,
          myLocation.longitude,
          rem.locationCoords.lat,
          rem.locationCoords.lng,
          rem.locationCoords.radiusMeters
        );

        if (inArea) {
          // Trigger reminder!
          sound.playChime();
          setTriggeredAlerts((prev) => [...prev, rem]);
          try {
            await api.put(`/api/reminders/${rem.id}/trigger`);
            setReminders((prev) =>
              prev.map((r) => (r.id === rem.id ? { ...r, hasTriggered: true } : r))
            );
          } catch (e) {
            console.error('Error triggering reminder on server:', e);
          }
        }
      }
    });
  }, [myLocation, reminders]);

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    let locationCoords: ReminderItem['locationCoords'] = undefined;
    let locationName: string | undefined = undefined;

    if (isGeofenced && selectedPlaceId) {
      const place = savedPlaces.find((p) => p.id === selectedPlaceId);
      if (place) {
        locationName = place.name;
        locationCoords = {
          lat: place.latitude,
          lng: place.longitude,
          radiusMeters: place.radiusMeters,
        };
      }
    }

    try {
      const res = await api.post<{ reminder: ReminderItem }>('/api/reminders', {
        title,
        description,
        dueDateTime: dueDateTime || new Date(Date.now() + 3600000).toISOString(),
        isGeofenced,
        locationId: selectedPlaceId || undefined,
        locationName,
        locationCoords,
        repeat: 'never',
      });
      setReminders((prev) => [...prev, res.reminder]);
      setShowAddModal(false);
      setTitle('');
      setDescription('');
      setDueDateTime('');
      setIsGeofenced(false);
      setSelectedPlaceId('');
      toast.success('Reminder scheduled');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create reminder');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/reminders/${id}`);
      setReminders((prev) => prev.filter((r) => r.id !== id));
      toast.success('Reminder removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete reminder');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-900 text-lg">Reminders & Geofences</h2>
          <p className="text-xs text-slate-500">
            Time-based tasks and «Remind me when I reach this location» triggers
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Reminder
        </button>
      </div>

      {/* Geofence Trigger Banner */}
      {triggeredAlerts.length > 0 && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase">
            <Check className="w-4 h-4 text-emerald-600" />
            Location Geofence Reached!
          </div>
          {triggeredAlerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-xs text-emerald-900">
              <span>
                <strong>{a.title}</strong> at {a.locationName}
              </span>
              <button
                onClick={() => setTriggeredAlerts((prev) => prev.filter((item) => item.id !== a.id))}
                className="text-[10px] text-emerald-700 underline"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Reminder Cards List */}
      <div className="space-y-3">
        {reminders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
            <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 text-sm">No Active Reminders</p>
            <p className="text-xs text-slate-500 mt-1">
              Add reminders with custom dates or location triggers.
            </p>
          </div>
        ) : (
          reminders.map((rem) => (
            <div
              key={rem.id}
              className={`p-4 bg-white rounded-2xl border shadow-sm flex items-start justify-between transition-colors ${
                rem.hasTriggered ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2.5 rounded-xl ${
                    rem.isGeofenced ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {rem.isGeofenced ? <MapPin className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-sm">{rem.title}</h4>
                    {rem.hasTriggered && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        Triggered
                      </span>
                    )}
                  </div>
                  {rem.description && (
                    <p className="text-xs text-slate-600 mt-0.5">{rem.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                    {rem.isGeofenced && rem.locationName && (
                      <span className="flex items-center gap-1 text-blue-600 font-medium">
                        <MapPin className="w-3 h-3" /> When entering {rem.locationName}
                      </span>
                    )}
                    <span>·</span>
                    <span>{new Date(rem.dueDateTime).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDelete(rem.id)}
                className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add Reminder Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100">
            <h3 className="font-bold text-lg text-slate-900 mb-1">New Reminder</h3>
            <p className="text-xs text-slate-500 mb-4">
              Schedule time notifications or geofenced proximity triggers.
            </p>

            <form onSubmit={handleCreateReminder} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Check in with team / Call mom upon arrival"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Extra instructions or details"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  value={dueDateTime}
                  onChange={(e) => setDueDateTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
                />
              </div>

              {/* Geofence Proximity Trigger Option */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isGeofenced}
                    onChange={(e) => setIsGeofenced(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 accent-slate-900"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    «Remind me when I reach this location»
                  </span>
                </label>

                {isGeofenced && (
                  <div className="mt-2 p-3 bg-blue-50/60 rounded-xl border border-blue-200">
                    <label className="block text-xs font-semibold text-blue-900 mb-1">
                      Choose Target Location
                    </label>
                    {savedPlaces.length === 0 ? (
                      <p className="text-xs text-amber-700">
                        No saved locations found. Please save a place in "Saved Places" first.
                      </p>
                    ) : (
                      <select
                        value={selectedPlaceId}
                        onChange={(e) => setSelectedPlaceId(e.target.value)}
                        required={isGeofenced}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-blue-200 text-xs text-slate-800"
                      >
                        <option value="">Select a saved location...</option>
                        {savedPlaces.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.radiusMeters}m radius)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
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
                  Set Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
