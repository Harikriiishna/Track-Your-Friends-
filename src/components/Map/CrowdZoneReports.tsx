import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Car,
  Clock,
  Construction,
  Landmark,
  Leaf,
  MapPin,
  Megaphone,
  ShieldAlert,
  Trash2,
  Users,
  Zap,
  Plus,
  List,
  Check,
  X,
  ArrowLeft,
  Crosshair,
  ImagePlus,
  ThumbsUp,
  Flag,
  Route as RouteIcon,
  ExternalLink,
  Share2,
  Send,
  CheckCircle2,
  Loader2,
  Building2,
  Sparkles,
  RotateCcw,
  Layers,
  Pentagon,
  CircleDot,
} from 'lucide-react';
import type { Room } from '../../types.ts';
import {
  CROWDZONE_CATEGORIES,
  CROWD_LEVELS,
  CROWDZONE_LAYERS,
  CROWDZONE_TIME_FILTERS,
  REPORT_STATUS_LABELS,
  getCrowdZoneCategory,
  getCategoryTtlHours,
  getEffectiveReportStatus,
  getReportConfidence,
  formatRelativeTimeAgo,
  type CrowdZoneCategoryId,
  type CrowdZoneLayerId,
  type CrowdLevelId,
  type CrowdZoneTimeWindowId,
  type CrowdZoneReport,
  type CrowdZoneReportStatus,
} from '../../utils/crowdzoneCategories.ts';
import { calculateDistanceMeters, formatDistance } from '../../utils/geo.ts';

export function renderCategoryIcon(categoryId: CrowdZoneCategoryId, className = 'w-4 h-4') {
  switch (categoryId) {
    case 'cleanliness':
      return <Trash2 className={className} />;
    case 'roads':
      return <Construction className={className} />;
    case 'traffic':
      return <Car className={className} />;
    case 'safety':
      return <ShieldAlert className={className} />;
    case 'facilities':
      return <Landmark className={className} />;
    case 'queue':
      return <Clock className={className} />;
    case 'crowd':
      return <Users className={className} />;
    case 'environment':
      return <Leaf className={className} />;
    case 'utilities':
      return <Zap className={className} />;
    case 'community':
      return <Megaphone className={className} />;
    default:
      return <MapPin className={className} />;
  }
}

export function renderLayerIcon(layerId: CrowdZoneLayerId, className = 'w-4 h-4') {
  switch (layerId) {
    case 'cleanliness':
      return <Trash2 className={className} />;
    case 'traffic':
      return <Car className={className} />;
    case 'crowd':
      return <Users className={className} />;
    case 'queue':
      return <Clock className={className} />;
    case 'safety':
      return <ShieldAlert className={className} />;
    case 'emergency':
      return <Building2 className={className} />;
    case 'events':
      return <Megaphone className={className} />;
    case 'reports':
    default:
      return <Construction className={className} />;
  }
}

export interface ComposerDraftState {
  open: boolean;
  step: 'category' | 'details';
  category: CrowdZoneCategoryId;
  subcategory: string;
  loc: { lat: number; lng: number } | null;
}

interface CrowdZoneOverlayProps {
  reports: CrowdZoneReport[];
  filteredReports: CrowdZoneReport[];
  activeLayers: Set<CrowdZoneLayerId>;
  onToggleLayer: (layerId: CrowdZoneLayerId) => void;
  timeFilter: CrowdZoneTimeWindowId;
  onChangeTimeFilter: (windowId: CrowdZoneTimeWindowId) => void;
  crowdWindow: '15m' | '1h' | '3h';
  onChangeCrowdWindow: (w: '15m' | '1h' | '3h') => void;
  showLayersMenu: boolean;
  onToggleLayersMenu: () => void;
  onCloseLayersMenu: () => void;
  isSearchingEmergency: boolean;
  onSearchEmergencyFacilities: () => void;
  onClearEmergencyFacilities: () => void;
  emergencyCount: number;
  // Pin placement mode
  isPickingPin: boolean;
  onCancelPickPin: () => void;
  onUseMyLocationForPin: () => void;
  onConfirmCenterPin: () => void;
  // Composer
  composerState: ComposerDraftState;
  setComposerState: React.Dispatch<React.SetStateAction<ComposerDraftState>>;
  onOpenComposer: (initialCategory?: CrowdZoneCategoryId) => void;
  onRequestMapPinPick: () => void;
  onSubmitReport: (newReport: CrowdZoneReport) => void;
  // Selected Report Detail & Delete Actions
  selectedReportId: string | null;
  onSelectReport: (reportId: string | null) => void;
  onDeleteReport: (reportId: string) => void;
  onDeleteReportUpdate: (reportId: string, updateId: string) => void;
  onDeleteAllReports: () => void;
  onResetSeedReports: () => void;
  onVoteReport: (reportId: string, vote: 'confirm' | 'flag') => void;
  onAddReportUpdate: (
    reportId: string,
    note: string,
    newStatus?: CrowdZoneReportStatus
  ) => void;
  onRouteToReport: (lat: number, lng: number, label: string) => void;
  onFocusReportOnMap: (lat: number, lng: number) => void;
  onShareReportToRoom?: (roomId: string, report: CrowdZoneReport) => void;
  rooms?: Room[];
  currentUserId: string;
  currentUserName: string;
  myCoords: { lat: number; lng: number } | null;
  roomOnlyMode?: boolean;
  // Unified Geofence Hub Integration
  geofencesCount?: number;
  geofenceAlertsCount?: number;
  isDrawingGeofence?: boolean;
  onOpenGeofenceManager?: () => void;
  onStartDrawGeofence?: (shape: 'polygon' | 'circle') => void;
  onDeleteAllGeofences?: () => void;
}

export const CrowdZoneOverlay: React.FC<CrowdZoneOverlayProps> = ({
  reports,
  filteredReports,
  activeLayers,
  onToggleLayer,
  timeFilter,
  onChangeTimeFilter,
  crowdWindow,
  onChangeCrowdWindow,
  showLayersMenu,
  onToggleLayersMenu,
  onCloseLayersMenu,
  isSearchingEmergency,
  onSearchEmergencyFacilities,
  onClearEmergencyFacilities,
  emergencyCount,
  isPickingPin,
  onCancelPickPin,
  onUseMyLocationForPin,
  onConfirmCenterPin,
  composerState,
  setComposerState,
  onOpenComposer,
  onRequestMapPinPick,
  onSubmitReport,
  selectedReportId,
  onSelectReport,
  onDeleteReport,
  onDeleteReportUpdate,
  onDeleteAllReports,
  onResetSeedReports,
  onVoteReport,
  onAddReportUpdate,
  onRouteToReport,
  onFocusReportOnMap,
  onShareReportToRoom,
  rooms = [],
  currentUserId,
  currentUserName,
  myCoords,
  roomOnlyMode = false,
  geofencesCount = 0,
  geofenceAlertsCount = 0,
  isDrawingGeofence = false,
  onOpenGeofenceManager,
  onStartDrawGeofence,
  onDeleteAllGeofences,
}) => {
  // Composer form fields
  const [description, setDescription] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [queuePeople, setQueuePeople] = useState('');
  const [queueWaitMin, setQueueWaitMin] = useState('');
  const [queueCounter, setQueueCounter] = useState('');
  const [crowdLevel, setCrowdLevel] = useState<CrowdLevelId>('moderate');
  const [mediaDataUrl, setMediaDataUrl] = useState<string | null>(null);
  const [mediaFileName, setMediaFileName] = useState<string | null>(null);
  const [mediaMimeType, setMediaMimeType] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Activity list drawer state & dedicated CrowdZone Quick-Report Hub toggle
  const [showActivityList, setShowActivityList] = useState(false);
  const [showQuickHub, setShowQuickHub] = useState(false);

  // Report Detail update form state
  const [updateNote, setUpdateNote] = useState('');
  const [showShareCommunities, setShowShareCommunities] = useState(false);

  const selectedReport = selectedReportId
    ? reports.find((r) => r.id === selectedReportId) || null
    : null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFileName(file.name);
    setMediaMimeType(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMediaDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const resetComposerForm = () => {
    setDescription('');
    setPlaceName('');
    setQueuePeople('');
    setQueueWaitMin('');
    setQueueCounter('');
    setCrowdLevel('moderate');
    setMediaDataUrl(null);
    setMediaFileName(null);
    setMediaMimeType(null);
  };

  const handleCreateReport = () => {
    if (!composerState.loc || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const now = Date.now();
      const ttlHours = getCategoryTtlHours(composerState.category);
      const expiresAt = new Date(now + ttlHours * 3600 * 1000).toISOString();
      const newReport: CrowdZoneReport = {
        id: `cz-${now}-${Math.random().toString(36).slice(2, 7)}`,
        category: composerState.category,
        subcategory:
          composerState.subcategory ||
          getCrowdZoneCategory(composerState.category).subs[0],
        description: description.trim() || undefined,
        place_name: placeName.trim() || undefined,
        lat: composerState.loc.lat,
        lng: composerState.loc.lng,
        status: 'active',
        created_at: new Date(now).toISOString(),
        expires_at: expiresAt,
        reporter_id: currentUserId,
        reporter_name: currentUserName,
        confirm_count: 1,
        flag_count: 0,
        votedBy: { [currentUserId]: 'confirm' },
        queue_people:
          composerState.category === 'queue' && queuePeople
            ? parseInt(queuePeople, 10)
            : null,
        queue_wait_min:
          composerState.category === 'queue' && queueWaitMin
            ? parseInt(queueWaitMin, 10)
            : null,
        queue_counter:
          composerState.category === 'queue' && queueCounter.trim()
            ? queueCounter.trim()
            : null,
        crowd_level: composerState.category === 'crowd' ? crowdLevel : null,
        media_url: mediaDataUrl,
        media_type: mediaMimeType,
        updates: [],
      };
      onSubmitReport(newReport);
      resetComposerForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentCat = getCrowdZoneCategory(composerState.category);

  return (
    <>
      {/* 1. CENTER CROSSHAIR & FLOATING BANNER WHEN PICKING EXACT PIN ON MAP */}
      {isPickingPin && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-full">
            <div className="flex flex-col items-center">
              <div className="px-2.5 py-1 rounded-full bg-slate-950/90 border border-[#FF705E]/60 text-[11px] font-bold text-white shadow-lg mb-1 whitespace-nowrap">
                Drag map to position report pin
              </div>
              <Crosshair
                className="w-10 h-10 text-[#FF705E] drop-shadow-[0_4px_12px_rgba(255,112,94,0.8)]"
                strokeWidth={2.5}
              />
            </div>
          </div>

          <div
            data-testid="crowdzone-pin-picker-bar"
            className={`absolute inset-x-3.5 ${
              roomOnlyMode ? 'bottom-6' : 'bottom-24'
            } right-16 z-40 rounded-2xl border border-white/15 bg-slate-950/95 backdrop-blur-xl p-3.5 shadow-2xl md:left-1/2 md:right-auto md:bottom-8 md:w-96 md:-translate-x-1/2 text-white`}
          >
            <p className="text-sm font-bold text-white">
              Move the map to place the pin exactly
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={onCancelPickPin}
                className="px-3 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-200 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onUseMyLocationForPin}
                className="px-3 py-2 rounded-xl border border-sky-400/40 bg-sky-500/15 hover:bg-sky-500/25 text-xs font-semibold text-sky-200 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-sky-400" />
                <span>My location</span>
              </button>
              <button
                type="button"
                onClick={onConfirmCenterPin}
                className="flex-1 px-3 py-2 rounded-xl bg-gradient-to-r from-[#FF705E] to-[#FF9B54] hover:opacity-95 text-xs font-bold text-slate-950 flex items-center justify-center gap-1.5 shadow-lg cursor-pointer transition-all"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Use this spot</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* 2. CROWDZONE COMMUNITY LAYERS MENU POPOVER */}
      {showLayersMenu && (
        <div
          data-testid="crowdzone-layers-popover"
          className={`absolute left-3.5 ${
            roomOnlyMode ? 'bottom-16' : 'bottom-36'
          } md:bottom-20 md:left-6 z-30 w-72 max-w-[calc(100vw-5.5rem)] rounded-2xl border border-white/15 bg-slate-950/95 backdrop-blur-xl p-3 shadow-2xl text-white animate-in fade-in slide-in-from-bottom-2 duration-150`}
        >
          <div className="flex items-center justify-between px-1 pb-2 border-b border-white/10">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#FF9B54]">
                CrowdZone Layers
              </p>
              <p className="text-[10px] text-slate-400">
                Queues, crowds, civic issues &amp; emergency pins
              </p>
            </div>
            <button
              type="button"
              onClick={onCloseLayersMenu}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-2 space-y-1 max-h-[45vh] overflow-y-auto pr-0.5">
            {CROWDZONE_LAYERS.map((layer) => {
              const isChecked = activeLayers.has(layer.id);
              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => onToggleLayer(layer.id)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <span
                    className="flex w-8 h-8 items-center justify-center rounded-xl border transition-colors shrink-0"
                    style={{
                      backgroundColor: isChecked ? `${layer.hex}28` : 'rgba(255,255,255,0.05)',
                      borderColor: isChecked ? layer.hex : 'rgba(255,255,255,0.12)',
                      color: isChecked ? layer.hex : '#94a3b8',
                    }}
                  >
                    {renderLayerIcon(layer.id, 'w-4 h-4')}
                  </span>
                  <span className="flex-1 text-xs font-semibold text-slate-100">
                    {layer.label}
                  </span>
                  <span
                    className={`flex w-5 h-5 items-center justify-center rounded-lg border ${
                      isChecked
                        ? 'border-[#FF705E] bg-[#FF705E] text-slate-950'
                        : 'border-white/20 bg-white/5'
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                  </span>
                </button>
              );
            })}

            {activeLayers.has('crowd') && (
              <div className="mt-1.5 pt-1.5 border-t border-white/10 px-1">
                <span className="text-[10px] text-slate-400 font-semibold block mb-1">
                  Crowd Heatmap Window:
                </span>
                <div className="flex gap-1.5">
                  {(['15m', '1h', '3h'] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => onChangeCrowdWindow(w)}
                      className={`flex-1 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                        crowdWindow === w
                          ? 'border-[#9B7BE0] bg-[#9B7BE0] text-slate-950'
                          : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeLayers.has('emergency') && (
              <div className="mt-2 pt-1.5 border-t border-white/10 px-1 space-y-1.5">
                <button
                  type="button"
                  onClick={onSearchEmergencyFacilities}
                  disabled={isSearchingEmergency}
                  className="w-full py-2 px-3 rounded-xl border border-sky-400/50 bg-sky-500/20 hover:bg-sky-500/30 disabled:opacity-50 text-xs font-bold text-sky-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  {isSearchingEmergency ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Building2 className="w-3.5 h-3.5 text-sky-300" />
                  )}
                  <span>
                    Search facilities here{emergencyCount > 0 ? ` (${emergencyCount})` : ''}
                  </span>
                </button>
                {emergencyCount > 0 && (
                  <button
                    type="button"
                    onClick={onClearEmergencyFacilities}
                    className="w-full py-1.5 px-3 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-[11px] font-bold text-rose-300 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete facility pins ({emergencyCount})</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Manage / Delete Reports Footer Actions */}
          {reports.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-1.5">
              <button
                type="button"
                data-testid="crowdzone-delete-all-layers-btn"
                onClick={onDeleteAllReports}
                className="flex-1 py-1.5 px-2 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-[11px] font-bold text-rose-300 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                title="Delete all community report pins"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete All ({reports.length})</span>
              </button>
            </div>
          )}

          <p className="px-1 pt-2 mt-1.5 border-t border-white/10 text-[10px] leading-snug text-slate-400">
            Crowd, queue &amp; issue pins: real-time community reports. Confirm or flag pins to update confidence scores.
          </p>
        </div>
      )}

      {/* 3A. UNIFIED ZONES & REPORTS HUB PANEL (Opened via the single clean bottom-left button) */}
      {!isPickingPin && !isDrawingGeofence && showQuickHub && (
        <div
          data-testid="crowdzone-quick-hub-panel"
          className={`absolute left-3.5 right-16 ${
            roomOnlyMode ? 'bottom-16' : 'bottom-36'
          } md:bottom-20 md:left-6 md:right-auto md:w-[420px] z-30 rounded-2xl border border-white/15 bg-slate-950/95 backdrop-blur-xl p-3.5 shadow-2xl text-white max-h-[70dvh] overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-150`}
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#FF9B54]">
                Zones &amp; Community Reports Hub
              </h4>
              <p className="text-[10px] text-slate-400">
                All custom geofences, community reports, layers &amp; filters in one place
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowQuickHub(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              title="Close Hub"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Actions: + Report, List, Layers */}
          <div className="mt-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Community Reports &amp; Map Layers
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                data-testid="crowdzone-report-issue-btn"
                onClick={() => {
                  setShowQuickHub(false);
                  onOpenComposer();
                }}
                className="h-9 px-2.5 rounded-xl bg-gradient-to-r from-[#FF705E] via-[#FF8552] to-[#FF9B54] hover:opacity-95 text-slate-950 font-extrabold text-[11px] flex items-center justify-center gap-1 shadow-md cursor-pointer active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.8]" />
                <span>Report</span>
              </button>

              <button
                type="button"
                data-testid="crowdzone-list-btn"
                onClick={() => {
                  setShowQuickHub(false);
                  setShowActivityList(true);
                }}
                className="h-9 px-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/15 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <List className="w-3.5 h-3.5 text-[#00D9FF]" />
                <span>List · {filteredReports.length}</span>
              </button>

              <button
                type="button"
                data-testid="crowdzone-bottom-layers-btn"
                onClick={() => {
                  setShowQuickHub(false);
                  onToggleLayersMenu();
                }}
                className={`h-9 px-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all ${
                  showLayersMenu
                    ? 'border-[#FF9B54] bg-[#FF9B54] text-slate-950'
                    : 'border-white/15 bg-white/5 hover:bg-white/15 text-[#FF9B54]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Layers</span>
              </button>
            </div>
          </div>

          {/* Custom Geofence Zones Section */}
          <div className="mt-3 pt-2.5 border-t border-white/10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#00D6A0]">
                Custom Geofence Zones &amp; Push Alerts
              </span>
              {geofenceAlertsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[9.5px] font-bold">
                  {geofenceAlertsCount} Alerts
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                data-testid="open-geofence-manager-btn"
                onClick={() => {
                  setShowQuickHub(false);
                  onOpenGeofenceManager?.();
                }}
                className="h-9 px-2 rounded-xl border border-[#00D6A0]/45 bg-[#00D6A0]/15 hover:bg-[#00D6A0]/25 text-white text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
              >
                <Pentagon className="w-3.5 h-3.5 text-[#00D6A0] shrink-0" />
                <span className="truncate">Zones · {geofencesCount}</span>
              </button>

              <button
                type="button"
                data-testid="quick-draw-geofence-btn"
                onClick={() => {
                  setShowQuickHub(false);
                  onStartDrawGeofence?.('polygon');
                }}
                className="h-9 px-2 rounded-xl border border-[#00D9FF]/45 bg-gradient-to-r from-[#00D6A0]/20 to-[#00D9FF]/20 hover:from-[#00D6A0]/35 hover:to-[#00D9FF]/35 text-[#00D9FF] text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                <span className="truncate">Polygon</span>
              </button>

              <button
                type="button"
                data-testid="quick-draw-circle-geofence-btn"
                onClick={() => {
                  setShowQuickHub(false);
                  onStartDrawGeofence?.('circle');
                }}
                className="h-9 px-2 rounded-xl border border-sky-400/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
              >
                <CircleDot className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                <span className="truncate">Circle</span>
              </button>
            </div>
          </div>

          {/* Quick Category Report Buttons Grid */}
          <div className="mt-3 pt-2.5 border-t border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Quick Report Categories
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-0.5">
              {CROWDZONE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  data-testid={`crowdzone-quick-${cat.id}-btn`}
                  onClick={() => {
                    setShowQuickHub(false);
                    onOpenComposer(cat.id);
                  }}
                  className="px-2.5 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/15 text-[11px] font-bold text-white flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all text-left"
                  title={`Report ${cat.label}`}
                >
                  <span style={{ color: cat.hex }} className="shrink-0">
                    {renderCategoryIcon(cat.id, 'w-3.5 h-3.5')}
                  </span>
                  <span className="truncate">+{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Time Window Filter Buttons */}
          <div className="mt-3 pt-2.5 border-t border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Time Window Filter
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {CROWDZONE_TIME_FILTERS.map((tf) => {
                const active = timeFilter === tf.id;
                return (
                  <button
                    key={tf.id}
                    type="button"
                    onClick={() => onChangeTimeFilter(tf.id)}
                    className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                      active
                        ? 'border-white bg-white text-slate-950 shadow-sm'
                        : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    {tf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Management & Delete Buttons inside Hub */}
          <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onResetSeedReports}
              className="flex-1 py-1.5 px-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
              <span>Reset Pins</span>
            </button>
            {reports.length > 0 && (
              <button
                type="button"
                data-testid="crowdzone-bottom-delete-all-btn"
                onClick={onDeleteAllReports}
                className="flex-1 py-1.5 px-2.5 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-[11px] font-bold text-rose-300 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Reports ({reports.length})</span>
              </button>
            )}
            {geofencesCount > 0 && onDeleteAllGeofences && (
              <button
                type="button"
                data-testid="geofence-hub-delete-all-btn"
                onClick={onDeleteAllGeofences}
                className="flex-1 py-1.5 px-2.5 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-[11px] font-bold text-rose-300 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Zones ({geofencesCount})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3B. SINGLE CLEAN FLOATING BUTTON AT BOTTOM-LEFT (Replaces the 7 separate buttons across 2 rows) */}
      {!isPickingPin && !isDrawingGeofence && (
        <div
          data-testid="crowdzone-bottom-bar"
          className={`pointer-events-none absolute left-3.5 ${
            roomOnlyMode ? 'bottom-4' : 'bottom-24'
          } md:bottom-6 md:left-6 z-20 flex items-center`}
        >
          <button
            type="button"
            data-testid="crowdzone-hub-toggle-btn"
            onClick={() => {
              setShowQuickHub((prev) => !prev);
              if (showLayersMenu) onCloseLayersMenu();
            }}
            className={`pointer-events-auto h-10 px-3.5 rounded-2xl border backdrop-blur-xl text-xs font-extrabold flex items-center gap-2 shadow-2xl cursor-pointer active:scale-95 transition-all ${
              showQuickHub
                ? 'border-[#FF705E] bg-gradient-to-r from-[#FF705E] to-[#FF9B54] text-slate-950'
                : 'border-white/20 bg-[#0B081B]/95 hover:bg-[#1B153A] text-white'
            }`}
            title="Open Unified Zones & Community Reports Hub"
          >
            <Sparkles
              className={`w-4 h-4 ${
                showQuickHub ? 'text-slate-950' : 'text-[#FF9B54]'
              }`}
            />
            <span>Zones &amp; Reports</span>
            <span
              className={`px-1.5 py-0.5 rounded-lg text-[10px] font-black ${
                showQuickHub
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-white/10 text-[#00D9FF]'
              }`}
            >
              {filteredReports.length + geofencesCount}
            </span>
          </button>
        </div>
      )}

      {/* 4. REPORT COMPOSER MODAL (2-Step: Category -> Details, portaled above BottomNav) */}
      {composerState.open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-testid="crowdzone-report-composer"
            className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-150"
          >
            <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-slate-950 text-white shadow-2xl max-h-[86dvh] sm:max-h-[88vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                {composerState.step === 'details' && (
                  <button
                    type="button"
                    onClick={() =>
                      setComposerState((prev) => ({ ...prev, step: 'category' }))
                    }
                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    {composerState.step === 'category'
                      ? 'What would you like to report?'
                      : `Report ${currentCat.label}`}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {composerState.step === 'category'
                      ? 'Select a category to pin live queues, crowds, or local issues'
                      : 'Add details so nearby community members can see and confirm'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setComposerState((prev) => ({ ...prev, open: false }))
                }
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

              {/* Scrollable Body */}
              <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-3.5">
              {composerState.step === 'category' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {CROWDZONE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setComposerState((prev) => ({
                          ...prev,
                          category: cat.id,
                          subcategory: cat.subs[0],
                          step: 'details',
                        }))
                      }
                      className="p-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/25 flex flex-col items-start gap-2 text-left transition-all cursor-pointer active:scale-95"
                    >
                      <span
                        className="w-10 h-10 rounded-2xl flex items-center justify-center border"
                        style={{
                          backgroundColor: `${cat.hex}22`,
                          borderColor: `${cat.hex}55`,
                          color: cat.hex,
                        }}
                      >
                        {renderCategoryIcon(cat.id, 'w-5 h-5')}
                      </span>
                      <div>
                        <span className="font-bold text-xs text-white block">
                          {cat.label}
                        </span>
                        <span className="text-[10px] text-slate-400 line-clamp-1">
                          {cat.subs.slice(0, 2).join(', ')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  {/* Subcategory Selector Pills */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Issue Type
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {currentCat.subs.map((sub) => {
                        const selected = composerState.subcategory === sub;
                        return (
                          <button
                            key={sub}
                            type="button"
                            onClick={() =>
                              setComposerState((prev) => ({
                                ...prev,
                                subcategory: sub,
                              }))
                            }
                            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                              selected
                                ? 'border-[#FF705E] bg-[#FF705E] text-slate-950 font-bold shadow-sm'
                                : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                            }`}
                          >
                            {sub}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Location Pin Bar */}
                  <div className="flex items-center justify-between gap-2 p-3 rounded-2xl border border-white/15 bg-slate-900/90">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MapPin className="w-4 h-4 text-[#FF705E] shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block">
                          {composerState.loc
                            ? `${composerState.loc.lat.toFixed(5)}, ${composerState.loc.lng.toFixed(5)}`
                            : 'No location selected'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Tap Move to drag the map crosshair to the exact spot
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onRequestMapPinPick}
                      className="px-3 py-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-xs font-bold text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Crosshair className="w-3.5 h-3.5 text-[#FF705E]" />
                      <span>{composerState.loc ? 'Move' : 'Pin'}</span>
                    </button>
                  </div>

                  {/* Queue Specific Inputs */}
                  {composerState.category === 'queue' && (
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-xs font-semibold text-slate-300">
                        People (approx)
                        <input
                          type="text"
                          inputMode="numeric"
                          value={queuePeople}
                          onChange={(e) =>
                            setQueuePeople(e.target.value.replace(/\D/g, '').slice(0, 4))
                          }
                          placeholder="If known"
                          className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900 px-2.5 py-2 text-xs text-white outline-none focus:border-[#B49AE8]"
                        />
                      </label>
                      <label className="text-xs font-semibold text-slate-300">
                        Wait (min)
                        <input
                          type="text"
                          inputMode="numeric"
                          value={queueWaitMin}
                          onChange={(e) =>
                            setQueueWaitMin(e.target.value.replace(/\D/g, '').slice(0, 4))
                          }
                          placeholder="If known"
                          className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900 px-2.5 py-2 text-xs text-white outline-none focus:border-[#B49AE8]"
                        />
                      </label>
                      <label className="text-xs font-semibold text-slate-300">
                        Counter
                        <input
                          type="text"
                          value={queueCounter}
                          onChange={(e) => setQueueCounter(e.target.value.slice(0, 60))}
                          placeholder="e.g. OPD"
                          className="mt-1 w-full rounded-xl border border-white/15 bg-slate-900 px-2.5 py-2 text-xs text-white outline-none focus:border-[#B49AE8]"
                        />
                      </label>
                    </div>
                  )}

                  {/* Crowd Specific Level Selector */}
                  {composerState.category === 'crowd' && (
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                        Crowd Density Level
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {CROWD_LEVELS.map((lvl) => (
                          <button
                            key={lvl.id}
                            type="button"
                            onClick={() => setCrowdLevel(lvl.id)}
                            className={`py-2 px-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                              crowdLevel === lvl.id
                                ? 'border-[#9B7BE0] bg-[#9B7BE0] text-slate-950 shadow-sm'
                                : 'border-white/15 bg-slate-900 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            {lvl.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description & Place Name */}
                  <div className="space-y-2.5">
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                      placeholder="Short description (optional)"
                      rows={3}
                      className="w-full rounded-2xl border border-white/15 bg-slate-900 px-3 py-2.5 text-xs text-white outline-none focus:border-[#FF705E]"
                    />
                    <input
                      type="text"
                      value={placeName}
                      onChange={(e) => setPlaceName(e.target.value.slice(0, 160))}
                      placeholder="Place / landmark (e.g. Gate 2, Metro Plaza)"
                      className="w-full rounded-2xl border border-white/15 bg-slate-900 px-3 py-2.5 text-xs text-white outline-none focus:border-[#FF705E]"
                    />
                  </div>

                  {/* Photo / Video Upload */}
                  {mediaFileName ? (
                    <div className="flex items-center justify-between rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs">
                      <span className="truncate text-slate-200">{mediaFileName}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setMediaDataUrl(null);
                          setMediaFileName(null);
                          setMediaMimeType(null);
                        }}
                        className="p-1 text-rose-400 hover:text-rose-200 cursor-pointer flex items-center gap-1"
                        title="Delete attached file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-slate-900/60 hover:bg-slate-900 py-3 text-xs font-semibold text-slate-300 transition-colors">
                      <ImagePlus className="w-4 h-4 text-[#FF9B54]" />
                      <span>Add photo or video</span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                  )}

                    <p className="text-center text-[10.5px] text-slate-400 pt-1">
                      Your report is public and shown as a community report, not an official record.
                    </p>
                  </>
                )}
              </div>

              {/* Pinned Sticky Footer for Submit Report Button */}
              {composerState.step === 'details' && (
                <div className="px-4 py-3 border-t border-white/10 bg-slate-950 shrink-0">
                  <button
                    type="button"
                    disabled={!composerState.loc || isSubmitting}
                    onClick={handleCreateReport}
                    className="w-full h-11 rounded-2xl bg-gradient-to-r from-[#FF705E] to-[#FF9B54] hover:opacity-95 disabled:opacity-50 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Submit report</span>
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* 5. SELECTED REPORT DETAIL MODAL / DRAWER (Portaled above BottomNav) */}
      {selectedReport &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-testid="crowdzone-report-detail"
            className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-150"
          >
            <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-slate-950 text-white shadow-2xl max-h-[86dvh] sm:max-h-[88vh] flex flex-col overflow-hidden">
            {(() => {
              const cat = getCrowdZoneCategory(selectedReport.category);
              const effStatus = getEffectiveReportStatus(selectedReport);
              const confidence = getReportConfidence(selectedReport);
              const myVote = selectedReport.votedBy?.[currentUserId];
              const isReporter = selectedReport.reporter_id === currentUserId;

              return (
                <>
                  {/* Detail Header */}
                  <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-white/10">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0"
                        style={{
                          backgroundColor: `${cat.hex}24`,
                          borderColor: `${cat.hex}66`,
                          color: cat.hex,
                        }}
                      >
                        {renderCategoryIcon(selectedReport.category, 'w-5 h-5')}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-extrabold text-white truncate">
                            {selectedReport.subcategory}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              effStatus === 'active'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : effStatus === 'resolved'
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {REPORT_STATUS_LABELS[effStatus]}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {cat.label} · Reported by {selectedReport.reporter_name} ·{' '}
                          {formatRelativeTimeAgo(selectedReport.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        data-testid="crowdzone-delete-report-header-btn"
                        onClick={() => onDeleteReport(selectedReport.id)}
                        className="px-2.5 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        title="Delete this report"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectReport(null)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Detail Content */}
                  <div className="p-4 overflow-y-auto space-y-4">
                    {selectedReport.media_url &&
                      (selectedReport.media_type?.startsWith('video') ? (
                        <video
                          src={selectedReport.media_url}
                          controls
                          className="max-h-64 w-full rounded-2xl bg-slate-900 object-cover"
                        />
                      ) : (
                        <img
                          src={selectedReport.media_url}
                          alt={selectedReport.subcategory}
                          className="max-h-64 w-full rounded-2xl bg-slate-900 object-cover"
                        />
                      ))}

                    {selectedReport.description && (
                      <p className="text-xs sm:text-sm leading-relaxed text-slate-100">
                        {selectedReport.description}
                      </p>
                    )}

                    {/* Queue Metrics Grid */}
                    {selectedReport.category === 'queue' && (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-2xl border border-white/10 bg-slate-900 p-2.5">
                          <Users className="mx-auto w-4 h-4 text-[#B49AE8]" />
                          <p className="mt-1 text-sm font-extrabold text-white">
                            {selectedReport.queue_people == null
                              ? 'Unknown'
                              : `~${selectedReport.queue_people}`}
                          </p>
                          <p className="text-[10px] text-slate-400">Waiting</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-900 p-2.5">
                          <Clock className="mx-auto w-4 h-4 text-[#B49AE8]" />
                          <p className="mt-1 text-sm font-extrabold text-white">
                            {selectedReport.queue_wait_min == null
                              ? 'Unknown'
                              : `${selectedReport.queue_wait_min} min`}
                          </p>
                          <p className="text-[10px] text-slate-400">Est. wait</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-900 p-2.5">
                          <MapPin className="mx-auto w-4 h-4 text-[#B49AE8]" />
                          <p className="mt-1 truncate text-sm font-extrabold text-white">
                            {selectedReport.queue_counter || '—'}
                          </p>
                          <p className="text-[10px] text-slate-400">Counter</p>
                        </div>
                      </div>
                    )}

                    {/* Crowd Level Pill */}
                    {selectedReport.category === 'crowd' && selectedReport.crowd_level && (
                      <div className="rounded-2xl border border-[#9B7BE0]/40 bg-[#9B7BE0]/15 p-3 text-xs font-bold text-[#d8c8ff] flex items-center justify-between">
                        <span>Reported crowd level:</span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#9B7BE0] text-slate-950 font-extrabold uppercase">
                          {CROWD_LEVELS.find((l) => l.id === selectedReport.crowd_level)
                            ?.label ?? selectedReport.crowd_level}
                        </span>
                      </div>
                    )}

                    {/* Location & Confidence Metadata Card */}
                    <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-3 text-xs space-y-1">
                      <p className="flex items-center gap-1.5 font-bold text-white">
                        <MapPin className="w-4 h-4 text-[#FF705E] shrink-0" />
                        <span>
                          {selectedReport.place_name ||
                            `${selectedReport.lat.toFixed(5)}, ${selectedReport.lng.toFixed(5)}`}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {selectedReport.confirm_count} confirmed ·{' '}
                        {selectedReport.flag_count} flagged · confidence{' '}
                        <span
                          className={`font-bold uppercase ${
                            confidence === 'high'
                              ? 'text-emerald-400'
                              : confidence === 'medium'
                              ? 'text-amber-300'
                              : 'text-slate-300'
                          }`}
                        >
                          {confidence}
                        </span>{' '}
                        · submitted{' '}
                        {new Date(selectedReport.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Submitted by a community member. Not officially verified.
                      </p>
                    </div>

                    {/* Action Grid: Confirm, Flag, Route, Google Maps, Delete Report */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onVoteReport(selectedReport.id, 'confirm')}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          myVote === 'confirm'
                            ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                            : 'border-white/15 bg-white/5 hover:bg-white/10 text-white'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>Confirm ({selectedReport.confirm_count})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onVoteReport(selectedReport.id, 'flag')}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          myVote === 'flag'
                            ? 'border-rose-400 bg-rose-500/25 text-rose-200'
                            : 'border-white/15 bg-white/5 hover:bg-white/10 text-white'
                        }`}
                      >
                        <Flag className="w-3.5 h-3.5" />
                        <span>Flag ({selectedReport.flag_count})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const target = selectedReport;
                          onSelectReport(null);
                          onRouteToReport(
                            target.lat,
                            target.lng,
                            target.place_name || target.subcategory
                          );
                        }}
                        className="py-2.5 px-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-sky-300 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <RouteIcon className="w-3.5 h-3.5" />
                        <span>Route</span>
                      </button>

                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${selectedReport.lat},${selectedReport.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2.5 px-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Google Maps</span>
                      </a>
                    </div>

                    {/* Share to a Community / Room + Delete Report Button Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setShowShareCommunities((v) => !v)}
                        className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5 text-[#00D9FF]" />
                        <span>Share to a community room</span>
                      </button>

                      <button
                        type="button"
                        data-testid="crowdzone-delete-report-btn"
                        onClick={() => onDeleteReport(selectedReport.id)}
                        className="px-3 py-2 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-xs font-bold text-rose-300 flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete report</span>
                      </button>
                    </div>

                    {showShareCommunities && (
                      <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-slate-900 border border-white/10">
                        {rooms.length === 0 ? (
                          <p className="text-xs text-slate-400">
                            You haven&apos;t joined any community rooms yet.
                          </p>
                        ) : (
                          rooms.map((rm) => (
                            <button
                              key={rm.id}
                              type="button"
                              onClick={() => {
                                onShareReportToRoom?.(rm.id, selectedReport);
                                setShowShareCommunities(false);
                              }}
                              className="px-2.5 py-1 rounded-xl border border-sky-400/40 bg-sky-500/15 hover:bg-sky-500/25 text-xs font-bold text-sky-200 cursor-pointer"
                            >
                              #{rm.name}
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {/* Live Updates Section */}
                    <div className="space-y-2.5 pt-2 border-t border-white/10">
                      <p className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                        Updates ({selectedReport.updates.length})
                      </p>

                      <div className="space-y-2">
                        <textarea
                          value={updateNote}
                          onChange={(e) => setUpdateNote(e.target.value.slice(0, 300))}
                          placeholder="Has the situation changed?"
                          rows={2}
                          className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-[#FF705E]"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!updateNote.trim()}
                            onClick={() => {
                              onAddReportUpdate(selectedReport.id, updateNote.trim());
                              setUpdateNote('');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#FF705E] hover:opacity-95 disabled:opacity-40 text-xs font-bold text-slate-950 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Post</span>
                          </button>

                          {effStatus !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => {
                                onAddReportUpdate(
                                  selectedReport.id,
                                  updateNote.trim() || 'Marked as resolved.',
                                  'resolved'
                                );
                                setUpdateNote('');
                              }}
                              className="px-3 py-1.5 rounded-xl border border-emerald-400/50 bg-emerald-500/15 hover:bg-emerald-500/25 text-xs font-bold text-emerald-300 flex items-center gap-1.5 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Mark resolved</span>
                            </button>
                          )}

                          {(isReporter || effStatus === 'resolved') &&
                            effStatus !== 'active' && (
                              <button
                                type="button"
                                onClick={() => {
                                  onAddReportUpdate(
                                    selectedReport.id,
                                    updateNote.trim() || 'Reported as still happening.',
                                    'active'
                                  );
                                  setUpdateNote('');
                                }}
                                className="px-3 py-1.5 rounded-xl border border-amber-400/50 bg-amber-500/15 hover:bg-amber-500/25 text-xs font-bold text-amber-300 cursor-pointer"
                              >
                                Still happening
                              </button>
                            )}
                        </div>
                      </div>

                      {selectedReport.updates.length === 0 ? (
                        <p className="text-xs text-slate-500">No updates yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {selectedReport.updates.map((u) => (
                            <li
                              key={u.id}
                              className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs flex items-start justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-slate-100 break-words">{u.note}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {u.authorName} · {formatRelativeTimeAgo(u.created_at)}
                                  {u.new_status ? ` · set to ${u.new_status}` : ''}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  onDeleteReportUpdate(selectedReport.id, u.id)
                                }
                                className="p-1.5 rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 shrink-0 cursor-pointer transition-colors"
                                title="Delete update"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
            </div>
          </div>,
          document.body
        )}

      {/* 6. ACTIVITY LIST DRAWER (`List · N`) WITH PER-ITEM & BULK DELETE BUTTONS (Portaled above BottomNav) */}
      {showActivityList &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-testid="crowdzone-activity-list"
            className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-150"
          >
            <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-slate-950 text-white shadow-2xl max-h-[86dvh] sm:max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-[#FF9B54] shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-white truncate">
                    Nearby Community Reports ({filteredReports.length})
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    Live queues, crowd levels, traffic &amp; neighbourhood updates
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {reports.length > 0 && (
                  <button
                    type="button"
                    data-testid="crowdzone-list-delete-all-btn"
                    onClick={onDeleteAllReports}
                    className="px-2.5 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-[11px] font-bold text-rose-300 flex items-center gap-1 cursor-pointer"
                    title="Delete all reports"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete All</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowActivityList(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-3 overflow-y-auto space-y-2">
              {filteredReports.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <p className="text-xs text-slate-400">
                    No community reports match the current filter.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowActivityList(false);
                        onOpenComposer();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#FF705E] text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Report an issue</span>
                    </button>
                    <button
                      type="button"
                      onClick={onResetSeedReports}
                      className="px-3.5 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                      <span>Restore Sample Reports</span>
                    </button>
                  </div>
                </div>
              ) : (
                filteredReports.map((rep) => {
                  const cat = getCrowdZoneCategory(rep.category);
                  const eff = getEffectiveReportStatus(rep);
                  const distMeters = myCoords
                    ? calculateDistanceMeters(
                        myCoords.lat,
                        myCoords.lng,
                        rep.lat,
                        rep.lng
                      )
                    : null;

                  return (
                    <div
                      key={rep.id}
                      className="w-full p-3 rounded-2xl border border-white/10 bg-slate-900/90 hover:bg-slate-900 hover:border-white/25 flex items-start gap-3 transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowActivityList(false);
                          onFocusReportOnMap(rep.lat, rep.lng);
                          onSelectReport(rep.id);
                        }}
                        className="flex items-start gap-3 flex-1 min-w-0 text-left cursor-pointer"
                      >
                        <span
                          className="w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 mt-0.5"
                          style={{
                            backgroundColor: `${cat.hex}22`,
                            borderColor: `${cat.hex}55`,
                            color: cat.hex,
                          }}
                        >
                          {renderCategoryIcon(rep.category, 'w-5 h-5')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-white truncate">
                              {rep.subcategory}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {formatRelativeTimeAgo(rep.created_at)}
                            </span>
                          </div>
                          {rep.place_name && (
                            <p className="text-[11px] text-sky-300 truncate mt-0.5">
                              {rep.place_name}
                            </p>
                          )}
                          {rep.description && (
                            <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">
                              {rep.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400 flex-wrap">
                            <span className="uppercase font-bold" style={{ color: cat.hex }}>
                              {cat.label}
                            </span>
                            <span>·</span>
                            <span>{rep.confirm_count} confirmed</span>
                            {rep.category === 'queue' && rep.queue_wait_min != null && (
                              <>
                                <span>·</span>
                                <span className="text-[#B49AE8] font-bold">
                                  ~{rep.queue_wait_min} min wait
                                </span>
                              </>
                            )}
                            {distMeters != null && (
                              <>
                                <span>·</span>
                                <span>{formatDistance(distMeters)} away</span>
                              </>
                            )}
                            {eff === 'resolved' && (
                              <>
                                <span>·</span>
                                <span className="text-emerald-400 font-bold">Resolved</span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        data-testid={`crowdzone-delete-item-${rep.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteReport(rep.id);
                        }}
                        className="p-2 rounded-xl border border-rose-500/35 bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 shrink-0 cursor-pointer transition-colors"
                        title="Delete this report"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
