import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Shield,
  Pentagon,
  CircleDot,
  Plus,
  Trash2,
  Check,
  X,
  Undo2,
  Bell,
  BellOff,
  MapPin,
  Crosshair,
  Sparkles,
  Play,
  Eye,
} from 'lucide-react';
import type { UserLocation } from '../../types.ts';
import { calculateDistanceMeters, formatDistance } from '../../utils/geo.ts';

export type CustomGeofenceShape = 'polygon' | 'circle';

export interface CustomGeofenceZone {
  id: string;
  name: string;
  shape: CustomGeofenceShape;
  color: string;
  /** For 'polygon': array of [lat, lng] vertices (minimum 3) */
  points: Array<{ lat: number; lng: number }>;
  /** For 'circle': center coordinate and radius in meters */
  center: { lat: number; lng: number };
  radiusMeters: number;
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
  enabled: boolean;
  watchedUserIds: string[]; // empty array = watch all friends
  createdAt: string;
}

export interface GeofenceTransitionEvent {
  id: string;
  zoneId: string;
  zoneName: string;
  userId: string;
  userName: string;
  action: 'entered' | 'left';
  timestamp: string;
  lat: number;
  lng: number;
}

export const GEOFENCE_COLORS = [
  { id: 'emerald', hex: '#00D6A0', label: 'Emerald' },
  { id: 'cyan', hex: '#00D9FF', label: 'Cyan' },
  { id: 'violet', hex: '#8957FF', label: 'Violet' },
  { id: 'pink', hex: '#FF4FA3', label: 'Magenta' },
  { id: 'amber', hex: '#FFB547', label: 'Amber' },
  { id: 'coral', hex: '#FF705E', label: 'Coral' },
];

export const CUSTOM_GEOFENCES_STORAGE_KEY = 'beacon_custom_geofences_v1';
export const CUSTOM_GEOFENCE_EVENTS_STORAGE_KEY = 'beacon_custom_geofence_events_v1';

/**
 * Ray-casting algorithm to determine whether a (lat, lng) coordinate is inside a polygon
 */
export function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: Array<{ lat: number; lng: number }>
): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat;
    const yi = polygon[i].lng;
    const xj = polygon[j].lat;
    const yj = polygon[j].lng;

    const intersect =
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Compute centroid of a polygon or return circle center
 */
export function getGeofenceCenter(zone: CustomGeofenceZone): { lat: number; lng: number } {
  if (zone.shape === 'circle' || zone.points.length === 0) {
    return zone.center;
  }
  const sum = zone.points.reduce(
    (acc, pt) => ({ lat: acc.lat + pt.lat, lng: acc.lng + pt.lng }),
    { lat: 0, lng: 0 }
  );
  return {
    lat: sum.lat / zone.points.length,
    lng: sum.lng / zone.points.length,
  };
}

/**
 * Evaluate whether a coordinate is inside a CustomGeofenceZone (polygon or circle)
 */
export function isLocationInsideGeofence(
  lat: number,
  lng: number,
  zone: CustomGeofenceZone
): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (zone.shape === 'polygon') {
    return isPointInPolygon(lat, lng, zone.points);
  }
  const dist = calculateDistanceMeters(lat, lng, zone.center.lat, zone.center.lng);
  return dist <= zone.radiusMeters;
}

export function loadSavedCustomGeofences(): CustomGeofenceZone[] {
  try {
    const raw = localStorage.getItem(CUSTOM_GEOFENCES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

export function saveCustomGeofencesToStorage(zones: CustomGeofenceZone[]): void {
  try {
    localStorage.setItem(CUSTOM_GEOFENCES_STORAGE_KEY, JSON.stringify(zones));
  } catch {}
}

export interface GeofenceDraftState {
  active: boolean;
  shape: CustomGeofenceShape;
  name: string;
  color: string;
  points: Array<{ lat: number; lng: number }>;
  center: { lat: number; lng: number } | null;
  radiusMeters: number;
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
  watchedUserIds: string[];
}

interface CustomGeofenceOverlayProps {
  roomOnlyMode?: boolean;
  hideFloatingButtons?: boolean;
  externalOpenManagerSignal?: number;
  geofences: CustomGeofenceZone[];
  events: GeofenceTransitionEvent[];
  draft: GeofenceDraftState;
  setDraft: React.Dispatch<React.SetStateAction<GeofenceDraftState>>;
  onStartDrawing: (shape: CustomGeofenceShape) => void;
  onAddMapCenterVertex: () => void;
  onUndoVertex: () => void;
  onClearDraftVertices: () => void;
  onCancelDrawing: () => void;
  onSaveDraftGeofence: () => void;
  onToggleGeofenceEnabled: (id: string) => void;
  onDeleteGeofence: (id: string) => void;
  onDeleteAllGeofences: () => void;
  onClearEvents: () => void;
  onFocusGeofence: (zone: CustomGeofenceZone) => void;
  onSimulateTransition: (zone: CustomGeofenceZone, action: 'entered' | 'left') => void;
  friendsLocations: UserLocation[];
  currentUserId?: string;
}

export const CustomGeofenceOverlay: React.FC<CustomGeofenceOverlayProps> = ({
  roomOnlyMode = false,
  hideFloatingButtons = false,
  externalOpenManagerSignal = 0,
  geofences,
  events,
  draft,
  setDraft,
  onStartDrawing,
  onAddMapCenterVertex,
  onUndoVertex,
  onClearDraftVertices,
  onCancelDrawing,
  onSaveDraftGeofence,
  onToggleGeofenceEnabled,
  onDeleteGeofence,
  onDeleteAllGeofences,
  onClearEvents,
  onFocusGeofence,
  onSimulateTransition,
  friendsLocations,
  currentUserId,
}) => {
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [showFinalizeSheet, setShowFinalizeSheet] = useState(false);
  const [activeTab, setActiveTab] = useState<'zones' | 'alerts'>('zones');

  React.useEffect(() => {
    if (externalOpenManagerSignal > 0) {
      setShowManagerModal(true);
    }
  }, [externalOpenManagerSignal]);

  const otherFriends = friendsLocations.filter((u) => u.userId !== currentUserId);

  const canFinishDrawing =
    draft.shape === 'polygon' ? draft.points.length >= 3 : Boolean(draft.center);

  return (
    <>
      {/* 1. ACTIVE MAP DRAWING HUD BANNER (When user is drawing a polygon or circle geofence on the map) */}
      {draft.active && (
        <>
          {/* Center Map Crosshair for precise mobile vertex / center placement */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-full">
            <div className="flex flex-col items-center">
              <div
                className="px-2.5 py-1 rounded-full bg-slate-950/90 border text-[11px] font-bold text-white shadow-lg mb-1 whitespace-nowrap"
                style={{ borderColor: draft.color }}
              >
                {draft.shape === 'polygon'
                  ? `Tap map or "+ Point" (${draft.points.length} pts)`
                  : `Tap map or "Set Center" (${draft.radiusMeters}m)`}
              </div>
              <Crosshair
                className="w-9 h-9 drop-shadow-[0_4px_12px_rgba(0,214,160,0.8)]"
                style={{ color: draft.color }}
                strokeWidth={2.4}
              />
            </div>
          </div>

          {/* Bottom Drawing Control Card (Safely above mobile BottomNav & left of zoom controls) */}
          <div
            data-testid="geofence-drawing-toolbar"
            className={`absolute left-3.5 right-16 ${
              roomOnlyMode ? 'bottom-6' : 'bottom-24'
            } md:left-1/2 md:right-auto md:bottom-8 md:w-[430px] md:-translate-x-1/2 z-30 rounded-2xl border border-white/15 bg-slate-950/95 backdrop-blur-xl p-3.5 shadow-2xl text-white`}
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${draft.color}25`, color: draft.color }}
                >
                  {draft.shape === 'polygon' ? (
                    <Pentagon className="w-4 h-4" />
                  ) : (
                    <CircleDot className="w-4 h-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <h4 className="text-xs font-extrabold text-white truncate">
                    {draft.shape === 'polygon'
                      ? 'Draw Custom Polygon Geofence'
                      : 'Draw Custom Circle Geofence'}
                  </h4>
                  <p className="text-[10px] text-slate-400 truncate">
                    {draft.shape === 'polygon'
                      ? `${draft.points.length} vertices placed (need at least 3)`
                      : `Radius: ${formatDistance(draft.radiusMeters)}`}
                  </p>
                </div>
              </div>

              {/* Switch between Polygon and Circle drawing */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, shape: 'polygon' }))
                  }
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                    draft.shape === 'polygon'
                      ? 'bg-[#00D6A0] text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Pentagon className="w-3 h-3" />
                  <span>Polygon</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, shape: 'circle' }))
                  }
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                    draft.shape === 'circle'
                      ? 'bg-[#00D6A0] text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <CircleDot className="w-3 h-3" />
                  <span>Circle</span>
                </button>
              </div>
            </div>

            {/* Radius Slider when in Circle Mode */}
            {draft.shape === 'circle' && (
              <div className="mt-2.5 flex items-center gap-3">
                <span className="text-[11px] font-semibold text-slate-300 shrink-0">
                  Radius: <strong className="text-[#00D9FF]">{draft.radiusMeters}m</strong>
                </span>
                <input
                  type="range"
                  min={50}
                  max={3000}
                  step={25}
                  value={draft.radiusMeters}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      radiusMeters: Number(e.target.value),
                    }))
                  }
                  className="flex-1 accent-[#00D6A0] cursor-pointer"
                />
              </div>
            )}

            {/* Drawing Action Buttons */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onCancelDrawing}
                className="px-2.5 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                data-testid="geofence-add-center-point-btn"
                onClick={onAddMapCenterVertex}
                className="px-2.5 py-2 rounded-xl border border-sky-400/40 bg-sky-500/15 hover:bg-sky-500/25 text-xs font-bold text-sky-200 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{draft.shape === 'polygon' ? 'Add Point' : 'Set Center'}</span>
              </button>

              {draft.shape === 'polygon' && draft.points.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={onUndoVertex}
                    className="p-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-200 cursor-pointer"
                    title="Undo last point"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onClearDraftVertices}
                    className="p-2 rounded-xl border border-rose-500/35 bg-rose-500/15 hover:bg-rose-500/25 text-xs font-semibold text-rose-300 cursor-pointer"
                    title="Clear all points"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}

              <button
                type="button"
                data-testid="geofence-complete-shape-btn"
                disabled={!canFinishDrawing}
                onClick={() => setShowFinalizeSheet(true)}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] hover:opacity-95 disabled:opacity-40 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-lg cursor-pointer transition-all"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Configure &amp; Save</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* 2. SEPARATE FLOATING GEOFENCE BUTTON (Hidden when unified into the single clean Map Hub button) */}
      {!draft.active && !hideFloatingButtons && (
        <div
          className={`pointer-events-none absolute left-3.5 ${
            roomOnlyMode ? 'bottom-16' : 'bottom-36'
          } md:bottom-20 md:left-6 z-20 flex items-center gap-1.5`}
        >
          <button
            type="button"
            data-testid="open-geofence-manager-btn"
            onClick={() => setShowManagerModal(true)}
            className="pointer-events-auto h-10 px-3 rounded-2xl border border-[#00D6A0]/45 bg-[#0B081B]/95 hover:bg-[#1B153A] backdrop-blur-xl text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xl cursor-pointer active:scale-95 transition-all"
            title="Draw Custom Geofences & Manage Friend Entry/Exit Push Alerts"
          >
            <Pentagon className="w-3.5 h-3.5 text-[#00D6A0]" />
            <span>Zones · {geofences.length}</span>
          </button>

          <button
            type="button"
            data-testid="quick-draw-geofence-btn"
            onClick={() => onStartDrawing('polygon')}
            className="pointer-events-auto h-10 px-3 rounded-2xl border border-[#00D9FF]/45 bg-gradient-to-r from-[#00D6A0]/20 to-[#00D9FF]/20 hover:from-[#00D6A0]/35 hover:to-[#00D9FF]/35 backdrop-blur-xl text-[#00D9FF] text-xs font-extrabold flex items-center gap-1 shadow-xl cursor-pointer active:scale-95 transition-all"
            title="Draw a custom polygon or circle geofence on the map"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Draw Zone</span>
          </button>
        </div>
      )}

      {/* 3. FINALIZE & SAVE GEOFENCE MODAL (Portaled to document.body so BottomNav never overlaps) */}
      {showFinalizeSheet &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-testid="geofence-finalize-modal"
            className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-150"
          >
            <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-950 text-white shadow-2xl max-h-[86dvh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <span
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${draft.color}25`, color: draft.color }}
                  >
                    <Shield className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">
                      Save Custom Geofence Zone
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Receive push notifications when friends enter or leave
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFinalizeSheet(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-4">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Zone Name
                  </label>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, name: e.target.value.slice(0, 60) }))
                    }
                    placeholder="e.g. Campus Safe Zone, Home Perimeter, Office"
                    className="w-full rounded-2xl border border-white/15 bg-slate-900 px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#00D6A0]"
                  />
                  {/* Quick Zone Presets */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      { label: 'Home Safe Zone', radius: 150, color: '#00D6A0' },
                      { label: 'Campus / College', radius: 400, color: '#00D9FF' },
                      { label: 'Office Perimeter', radius: 250, color: '#8957FF' },
                      { label: 'Neighborhood Watch', radius: 500, color: '#FFB547' },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            name: preset.label,
                            radiusMeters: preset.radius,
                            color: preset.color,
                          }))
                        }
                        className="px-2.5 py-1 rounded-xl border border-white/15 bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Sparkles className="w-3 h-3 text-[#00D6A0]" />
                        <span>{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Zone Color Picker */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Zone Boundary Color
                  </label>
                  <div className="flex items-center gap-2">
                    {GEOFENCE_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setDraft((prev) => ({ ...prev, color: c.hex }))}
                        className={`w-8 h-8 rounded-xl border-2 transition-transform cursor-pointer ${
                          draft.color === c.hex
                            ? 'scale-110 border-white shadow-lg'
                            : 'border-transparent opacity-75 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Push Notification Triggers */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Push Notification Triggers
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          notifyOnEnter: !prev.notifyOnEnter,
                        }))
                      }
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        draft.notifyOnEnter
                          ? 'border-[#00D6A0] bg-[#00D6A0]/15 text-white'
                          : 'border-white/10 bg-slate-900 text-slate-400'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-extrabold block">Friend Enters</span>
                        <span className="text-[10px] text-slate-400">Push alert on arrival</span>
                      </div>
                      <Bell
                        className={`w-4 h-4 ${
                          draft.notifyOnEnter ? 'text-[#00D6A0]' : 'text-slate-500'
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          notifyOnExit: !prev.notifyOnExit,
                        }))
                      }
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        draft.notifyOnExit
                          ? 'border-[#FF4FA3] bg-[#FF4FA3]/15 text-white'
                          : 'border-white/10 bg-slate-900 text-slate-400'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-extrabold block">Friend Leaves</span>
                        <span className="text-[10px] text-slate-400">Push alert on exit</span>
                      </div>
                      <Bell
                        className={`w-4 h-4 ${
                          draft.notifyOnExit ? 'text-[#FF4FA3]' : 'text-slate-500'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Watched Friends Filter */}
                {otherFriends.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Monitored Friends
                      </label>
                      <span className="text-[10px] text-[#00D9FF] font-semibold">
                        {draft.watchedUserIds.length === 0
                          ? 'All Friends'
                          : `${draft.watchedUserIds.length} selected`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, watchedUserIds: [] }))
                        }
                        className={`px-2.5 py-1 rounded-xl border text-xs font-bold cursor-pointer ${
                          draft.watchedUserIds.length === 0
                            ? 'border-[#00D6A0] bg-[#00D6A0] text-slate-950'
                            : 'border-white/15 bg-slate-900 text-slate-300'
                        }`}
                      >
                        All Friends
                      </button>
                      {otherFriends.map((f) => {
                        const selected = draft.watchedUserIds.includes(f.userId);
                        return (
                          <button
                            key={f.userId}
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                watchedUserIds: selected
                                  ? prev.watchedUserIds.filter((id) => id !== f.userId)
                                  : [...prev.watchedUserIds, f.userId],
                              }))
                            }
                            className={`px-2.5 py-1 rounded-xl border text-xs font-bold cursor-pointer ${
                              selected
                                ? 'border-[#00D9FF] bg-[#00D9FF]/25 text-white'
                                : 'border-white/15 bg-slate-900 text-slate-300'
                            }`}
                          >
                            {f.fullName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Sticky Footer */}
              <div className="px-4 py-3 border-t border-white/10 bg-slate-950 flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowFinalizeSheet(false)}
                  className="px-4 py-2.5 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 cursor-pointer"
                >
                  Back to Map
                </button>
                <button
                  type="button"
                  data-testid="save-custom-geofence-btn"
                  onClick={() => {
                    onSaveDraftGeofence();
                    setShowFinalizeSheet(false);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] hover:opacity-95 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Save Geofence Zone</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* 4. GEOFENCE ZONES & PUSH ALERT HISTORY MANAGER MODAL (Portaled to document.body) */}
      {showManagerModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-testid="geofence-manager-modal"
            className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-150"
          >
            <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-slate-950 text-white shadow-2xl max-h-[86dvh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-[#00D6A0]/20 border border-[#00D6A0]/40 text-[#00D6A0] flex items-center justify-center shrink-0">
                    <Pentagon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-white truncate">
                      Custom Geofence Zones ({geofences.length})
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate">
                      Draw custom zones &amp; get push alerts when friends enter or leave
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManagerModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Action Bar & Tabs */}
              <div className="px-4 py-2.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 bg-slate-900/60 shrink-0">
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setActiveTab('zones')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      activeTab === 'zones'
                        ? 'bg-[#00D6A0] text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Zones ({geofences.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('alerts')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      activeTab === 'alerts'
                        ? 'bg-[#00D9FF] text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Activity Log ({events.length})
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowManagerModal(false);
                      onStartDrawing('polygon');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    <Pentagon className="w-3.5 h-3.5" />
                    <span>+ Draw Polygon</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowManagerModal(false);
                      onStartDrawing('circle');
                    }}
                    className="px-2.5 py-1.5 rounded-xl border border-[#00D9FF]/40 bg-[#00D9FF]/15 text-[#00D9FF] text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <CircleDot className="w-3.5 h-3.5" />
                    <span>+ Circle</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-2.5">
                {activeTab === 'zones' ? (
                  geofences.length === 0 ? (
                    <div className="py-10 text-center space-y-3">
                      <Pentagon className="w-10 h-10 text-[#00D6A0] mx-auto opacity-80" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-white">
                          No custom geofence zones drawn yet
                        </p>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto">
                          Draw a custom polygon or circle anywhere on the map to receive instant push notifications when a friend enters or leaves.
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowManagerModal(false);
                            onStartDrawing('polygon');
                          }}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#00D6A0] to-[#00D9FF] text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Pentagon className="w-3.5 h-3.5" />
                          <span>Draw Polygon Zone</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowManagerModal(false);
                            onStartDrawing('circle');
                          }}
                          className="px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <CircleDot className="w-3.5 h-3.5 text-[#00D9FF]" />
                          <span>Draw Circle Zone</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    geofences.map((zone) => {
                      const insideFriends = otherFriends.filter((f) =>
                        isLocationInsideGeofence(f.latitude, f.longitude, zone)
                      );

                      return (
                        <div
                          key={zone.id}
                          className="p-3 rounded-2xl border border-white/10 bg-slate-900/90 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span
                                className="w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 mt-0.5"
                                style={{
                                  backgroundColor: `${zone.color}22`,
                                  borderColor: `${zone.color}66`,
                                  color: zone.color,
                                }}
                              >
                                {zone.shape === 'polygon' ? (
                                  <Pentagon className="w-4 h-4" />
                                ) : (
                                  <CircleDot className="w-4 h-4" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-white truncate">
                                    {zone.name}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-white/10 text-slate-300">
                                    {zone.shape === 'polygon'
                                      ? `${zone.points.length} pts`
                                      : `${zone.radiusMeters}m`}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  Alerts:{' '}
                                  {zone.notifyOnEnter && zone.notifyOnExit
                                    ? 'Enter & Leave'
                                    : zone.notifyOnEnter
                                    ? 'Enter only'
                                    : zone.notifyOnExit
                                    ? 'Leave only'
                                    : 'Muted'}{' '}
                                  ·{' '}
                                  <span className="text-[#00D6A0] font-semibold">
                                    {insideFriends.length} friend(s) inside now
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowManagerModal(false);
                                  onFocusGeofence(zone);
                                }}
                                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-sky-300 cursor-pointer"
                                title="Zoom to zone on map"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onToggleGeofenceEnabled(zone.id)}
                                className={`p-1.5 rounded-xl cursor-pointer ${
                                  zone.enabled
                                    ? 'bg-[#00D6A0]/20 text-[#00D6A0]'
                                    : 'bg-white/5 text-slate-500'
                                }`}
                                title={
                                  zone.enabled
                                    ? 'Push notifications active (Tap to mute)'
                                    : 'Zone muted (Tap to enable)'
                                }
                              >
                                {zone.enabled ? (
                                  <Bell className="w-4 h-4" />
                                ) : (
                                  <BellOff className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteGeofence(zone.id)}
                                className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 cursor-pointer"
                                title="Delete this geofence zone"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Live Per-Friend Presence & Distance Badges */}
                          {otherFriends.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {otherFriends.map((f) => {
                                const isInside = isLocationInsideGeofence(
                                  f.latitude,
                                  f.longitude,
                                  zone
                                );
                                const zCenter = getGeofenceCenter(zone);
                                const distM = calculateDistanceMeters(
                                  f.latitude,
                                  f.longitude,
                                  zCenter.lat,
                                  zCenter.lng
                                );
                                return (
                                  <span
                                    key={f.userId}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                                      isInside
                                        ? 'border-[#00D6A0]/50 bg-[#00D6A0]/15 text-[#00D6A0]'
                                        : 'border-white/10 bg-slate-950 text-slate-400'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        isInside ? 'bg-[#00D6A0]' : 'bg-slate-500'
                                      }`}
                                    />
                                    <span>
                                      {f.fullName}: {isInside ? 'Inside' : formatDistance(distM)}
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Test Push Alert Simulation Row */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                            <span className="text-[10px] text-slate-400">
                              Test live push notification:
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                data-testid={`simulate-enter-${zone.id}`}
                                onClick={() => onSimulateTransition(zone, 'entered')}
                                className="px-2.5 py-1 rounded-lg bg-[#00D6A0]/20 hover:bg-[#00D6A0]/30 border border-[#00D6A0]/40 text-[#00D6A0] text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Play className="w-3 h-3" />
                                <span>Test Enter Push</span>
                              </button>
                              <button
                                type="button"
                                data-testid={`simulate-leave-${zone.id}`}
                                onClick={() => onSimulateTransition(zone, 'left')}
                                className="px-2.5 py-1 rounded-lg bg-[#FF4FA3]/20 hover:bg-[#FF4FA3]/30 border border-[#FF4FA3]/40 text-[#FF4FA3] text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Play className="w-3 h-3" />
                                <span>Test Leave Push</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : events.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <Bell className="w-8 h-8 text-slate-500 mx-auto" />
                    <p className="text-xs text-slate-400">
                      No friend entry/exit push events recorded yet.
                    </p>
                  </div>
                ) : (
                  events.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-2xl border border-white/10 bg-slate-900 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                            ev.action === 'entered'
                              ? 'bg-[#00D6A0]/20 text-[#00D6A0]'
                              : 'bg-[#FF4FA3]/20 text-[#FF4FA3]'
                          }`}
                        >
                          <MapPin className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">
                            {ev.userName}{' '}
                            <span
                              className={
                                ev.action === 'entered'
                                  ? 'text-[#00D6A0]'
                                  : 'text-[#FF4FA3]'
                              }
                            >
                              {ev.action}
                            </span>{' '}
                            {ev.zoneName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(ev.timestamp).toLocaleTimeString()} ·{' '}
                            {ev.lat.toFixed(4)}, {ev.lng.toFixed(4)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Sticky Footer */}
              <div className="px-4 py-3 border-t border-white/10 bg-slate-950 flex items-center justify-between gap-2 shrink-0">
                {activeTab === 'zones' && geofences.length > 0 ? (
                  <button
                    type="button"
                    onClick={onDeleteAllGeofences}
                    className="px-3 py-2 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-xs font-bold text-rose-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete All Zones</span>
                  </button>
                ) : activeTab === 'alerts' && events.length > 0 ? (
                  <button
                    type="button"
                    onClick={onClearEvents}
                    className="px-3 py-2 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-xs font-bold text-rose-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Log</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    Push notifications active for all enabled zones
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setShowManagerModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
