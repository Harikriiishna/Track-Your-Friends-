import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import type { MeetingItem, Room } from '../../types.ts';
import { api } from '../../utils/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { Calendar, Clock, MapPin, Users, Plus, Check, X, HelpCircle } from 'lucide-react';

interface MeetingsManagerProps {
  rooms: Room[];
}

export const MeetingsManager: React.FC<MeetingsManagerProps> = ({ rooms }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const [roomId, setRoomId] = useState(rooms[0]?.id || '');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [locationName, setLocationName] = useState('');

  const loadMeetings = async () => {
    try {
      const res = await api.get<{ meetings: MeetingItem[] }>('/api/meetings');
      setMeetings(res.meetings);
    } catch (err) {
      console.error('Failed to load meetings:', err);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post<{ meeting: MeetingItem }>('/api/meetings', {
        roomId,
        title,
        description: desc,
        date,
        time,
        locationName,
        attendees: [{ userId: user?.id || '', status: 'accepted' }],
      });
      setMeetings((prev) => [...prev, res.meeting]);
      setShowAddModal(false);
      setTitle('');
      setDesc('');
      setDate('');
      setTime('');
      setLocationName('');
      toast.success('Meeting scheduled');
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule meeting');
    }
  };

  const handleRsvp = async (meetingId: string, status: 'accepted' | 'declined' | 'tentative') => {
    try {
      const res = await api.post<{ meeting: MeetingItem }>(`/api/meetings/${meetingId}/rsvp`, { status });
      setMeetings((prev) => prev.map((m) => (m.id === meetingId ? res.meeting : m)));
      toast.success(`RSVP updated: ${status}`);
    } catch (err: any) {
      toast.error(err.message || 'RSVP failed');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto p-4 md:p-6 pb-28 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-900 text-lg">Room Meetings</h2>
          <p className="text-xs text-slate-500">Plan meetups, check-ins and emergency rendezvous points</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Schedule Meeting
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {meetings.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 text-sm">No Scheduled Meetings</p>
            <p className="text-xs text-slate-500 mt-1">
              Create a meeting for your room to sync coordinates and timing.
            </p>
          </div>
        ) : (
          meetings.map((m) => {
            const myRsvp = m.attendees?.find((a) => a.userId === user?.id)?.status;
            const acceptedCount = m.attendees?.filter((a) => a.status === 'accepted').length || 0;

            return (
              <div
                key={m.id}
                className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3"
              >
                <div>
                  <h4 className="font-bold text-slate-900 text-base">{m.title}</h4>
                  <p className="text-xs text-slate-600 mt-0.5">{m.description || 'No description provided'}</p>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>{m.date} at {m.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="font-medium text-slate-900">{m.locationName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Organized by {m.creatorName} · {acceptedCount} attending</span>
                  </div>
                </div>

                {/* RSVP Selector */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">Your RSVP:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleRsvp(m.id, 'accepted')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 ${
                        myRsvp === 'accepted'
                          ? 'bg-emerald-600 text-white shadow'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Accept
                    </button>
                    <button
                      onClick={() => handleRsvp(m.id, 'tentative')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 ${
                        myRsvp === 'tentative'
                          ? 'bg-amber-600 text-white shadow'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      Maybe
                    </button>
                    <button
                      onClick={() => handleRsvp(m.id, 'declined')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 ${
                        myRsvp === 'declined'
                          ? 'bg-rose-600 text-white shadow'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            style={{ colorScheme: 'light' }}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200"
          >
            <h3 className="font-bold text-lg text-slate-950 mb-1">Schedule Room Meeting</h3>
            <p className="text-xs text-slate-600 mb-4 font-medium">
              Set a date, time, and physical meeting location for room members.
            </p>

            <form onSubmit={handleCreateMeeting} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-950 mb-1">Room</label>
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  style={{ color: '#090d16', backgroundColor: '#ffffff', colorScheme: 'light' }}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-950 font-semibold text-sm"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-950 mb-1">Meeting Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weekly Family Dinner / Team Sync"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ color: '#090d16', backgroundColor: '#ffffff', colorScheme: 'light', WebkitTextFillColor: '#090d16' }}
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-950 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={{ color: '#090d16', backgroundColor: '#ffffff', colorScheme: 'light', WebkitTextFillColor: '#090d16' }}
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-slate-950 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-950 mb-1">Time</label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    style={{ color: '#090d16', backgroundColor: '#ffffff', colorScheme: 'light', WebkitTextFillColor: '#090d16' }}
                    className="w-full px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-slate-950 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-950 mb-1">Location Name or Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 124 Market St, Community Hall"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  style={{ color: '#090d16', backgroundColor: '#ffffff', colorScheme: 'light', WebkitTextFillColor: '#090d16' }}
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-950 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Meeting agenda or details"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  style={{ color: '#090d16', backgroundColor: '#ffffff', colorScheme: 'light', WebkitTextFillColor: '#090d16' }}
                  className="w-full px-3.5 py-2 rounded-xl border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-sm"
                />
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
                  Create Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
