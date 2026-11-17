export type CrowdZoneCategoryId =
  | 'cleanliness'
  | 'roads'
  | 'traffic'
  | 'safety'
  | 'facilities'
  | 'queue'
  | 'crowd'
  | 'environment'
  | 'utilities'
  | 'community';

export type CrowdZoneLayerId =
  | 'reports'
  | 'cleanliness'
  | 'traffic'
  | 'crowd'
  | 'queue'
  | 'safety'
  | 'emergency'
  | 'events';

export type CrowdLevelId = 'low' | 'moderate' | 'high' | 'very_high';

export type CrowdZoneTimeWindowId = '15m' | '1h' | '3h' | '24h' | '7d' | 'all';

export type CrowdZoneReportStatus = 'active' | 'resolved' | 'disputed' | 'outdated' | 'removed';

export interface CrowdZoneCategory {
  id: CrowdZoneCategoryId;
  label: string;
  tone: 'orange' | 'yellow' | 'coral' | 'sky' | 'lavender' | 'mint';
  hex: string;
  layer: CrowdZoneLayerId;
  subs: string[];
}

export interface CrowdZoneReportUpdate {
  id: string;
  note: string;
  authorId: string;
  authorName: string;
  created_at: string;
  new_status?: CrowdZoneReportStatus;
}

export interface CrowdZoneReport {
  id: string;
  category: CrowdZoneCategoryId;
  subcategory: string;
  description?: string;
  place_name?: string;
  lat: number;
  lng: number;
  status: CrowdZoneReportStatus;
  created_at: string;
  expires_at: string;
  reporter_id: string;
  reporter_name: string;
  confirm_count: number;
  flag_count: number;
  votedBy?: Record<string, 'confirm' | 'flag'>;
  // Queue specific fields
  queue_people?: number | null;
  queue_wait_min?: number | null;
  queue_counter?: string | null;
  // Crowd specific fields
  crowd_level?: CrowdLevelId | null;
  // Media attachment (data URL or URL)
  media_url?: string | null;
  media_type?: string | null;
  updates: CrowdZoneReportUpdate[];
}

export interface EmergencyFacilityPin {
  id: string;
  name: string;
  type: 'hospital' | 'police' | 'fire_station';
  lat: number;
  lng: number;
  address: string;
  phone?: string;
}

export const CROWDZONE_CATEGORIES: CrowdZoneCategory[] = [
  {
    id: 'cleanliness',
    label: 'Cleanliness',
    tone: 'orange',
    hex: '#FF9B54',
    layer: 'cleanliness',
    subs: [
      'Garbage dumping',
      'Overflowing dustbin',
      'Littering',
      'Dirty street',
      'Sewage problem',
      'Dirty public toilet',
    ],
  },
  {
    id: 'roads',
    label: 'Roads',
    tone: 'yellow',
    hex: '#E9B53C',
    layer: 'reports',
    subs: [
      'Pothole',
      'Damaged road',
      'Broken streetlight',
      'Waterlogging',
      'Blocked road',
      'Fallen tree',
      'Damaged infrastructure',
    ],
  },
  {
    id: 'traffic',
    label: 'Traffic',
    tone: 'coral',
    hex: '#FF705E',
    layer: 'traffic',
    subs: [
      'Traffic congestion',
      'Accident',
      'Road closure',
      'Diversion',
      'Parking problem',
    ],
  },
  {
    id: 'safety',
    label: 'Safety',
    tone: 'coral',
    hex: '#E5484D',
    layer: 'safety',
    subs: [
      'Fire incident',
      'Dangerous electrical wires',
      'Unsafe location',
      'Public disturbance',
      'Other public hazard',
    ],
  },
  {
    id: 'facilities',
    label: 'Facilities',
    tone: 'sky',
    hex: '#72B7F2',
    layer: 'reports',
    subs: [
      'Water shortage',
      'Broken public tap',
      'Damaged bench',
      'Poorly maintained space',
      'Non-functional facility',
    ],
  },
  {
    id: 'queue',
    label: 'Queues',
    tone: 'lavender',
    hex: '#B49AE8',
    layer: 'queue',
    subs: [
      'Hospital queue',
      'Bank queue',
      'Government office queue',
      'College office queue',
      'Ticket counter queue',
      'Service centre queue',
    ],
  },
  {
    id: 'crowd',
    label: 'Crowd',
    tone: 'lavender',
    hex: '#9B7BE0',
    layer: 'crowd',
    subs: ['Crowd level'],
  },
  {
    id: 'environment',
    label: 'Environment',
    tone: 'mint',
    hex: '#65C9A5',
    layer: 'reports',
    subs: [
      'Air pollution',
      'Smoke',
      'Noise pollution',
      'Flooding',
      'Environmental hazard',
    ],
  },
  {
    id: 'utilities',
    label: 'Utilities',
    tone: 'yellow',
    hex: '#F0B429',
    layer: 'reports',
    subs: [
      'Electricity outage',
      'Water supply disruption',
      'Internet / network problem',
    ],
  },
  {
    id: 'community',
    label: 'Community',
    tone: 'mint',
    hex: '#3FAE87',
    layer: 'events',
    subs: [
      'Lost and found',
      'Local event',
      'Public announcement',
      'Neighbourhood info',
    ],
  },
];

export const CROWDZONE_CATEGORY_MAP: Record<CrowdZoneCategoryId, CrowdZoneCategory> =
  Object.fromEntries(CROWDZONE_CATEGORIES.map((c) => [c.id, c])) as Record<
    CrowdZoneCategoryId,
    CrowdZoneCategory
  >;

export function getCrowdZoneCategory(id: string): CrowdZoneCategory {
  return (
    CROWDZONE_CATEGORY_MAP[id as CrowdZoneCategoryId] ?? CROWDZONE_CATEGORIES[0]
  );
}

export const CROWD_LEVELS: Array<{
  id: CrowdLevelId;
  label: string;
  weight: number;
  color: string;
}> = [
  { id: 'low', label: 'Light', weight: 1, color: '#65C9A5' },
  { id: 'moderate', label: 'Moderate', weight: 2, color: '#F0B429' },
  { id: 'high', label: 'Busy', weight: 3, color: '#FF9B54' },
  { id: 'very_high', label: 'Packed', weight: 4, color: '#E5484D' },
];

export const CROWDZONE_LAYERS: Array<{
  id: CrowdZoneLayerId;
  label: string;
  tone: 'yellow' | 'orange' | 'coral' | 'lavender' | 'sky' | 'mint';
  hex: string;
}> = [
  { id: 'reports', label: 'Community reports', tone: 'yellow', hex: '#E9B53C' },
  { id: 'cleanliness', label: 'Garbage & cleanliness', tone: 'orange', hex: '#FF9B54' },
  { id: 'traffic', label: 'Traffic (Live + reports)', tone: 'coral', hex: '#FF705E' },
  { id: 'crowd', label: 'Crowd heatmap', tone: 'lavender', hex: '#9B7BE0' },
  { id: 'queue', label: 'Queues', tone: 'lavender', hex: '#B49AE8' },
  { id: 'safety', label: 'Public safety', tone: 'coral', hex: '#E5484D' },
  { id: 'emergency', label: 'Emergency facilities', tone: 'sky', hex: '#72B7F2' },
  { id: 'events', label: 'Events & community', tone: 'mint', hex: '#3FAE87' },
];

export const CROWDZONE_TIME_FILTERS: Array<{
  id: CrowdZoneTimeWindowId;
  label: string;
  minutes: number;
}> = [
  { id: '15m', label: '15 min', minutes: 15 },
  { id: '1h', label: '1 hr', minutes: 60 },
  { id: '3h', label: '3 hr', minutes: 180 },
  { id: '24h', label: '24 hr', minutes: 1440 },
  { id: '7d', label: '7 days', minutes: 10080 },
  { id: 'all', label: 'All', minutes: 0 },
];

const CATEGORY_TTL_HOURS: Partial<Record<CrowdZoneCategoryId, number>> = {
  traffic: 2,
  queue: 3,
  crowd: 3,
  safety: 12,
  utilities: 24,
  environment: 24,
  community: 168,
};

export function getCategoryTtlHours(category: CrowdZoneCategoryId): number {
  return CATEGORY_TTL_HOURS[category] ?? 336;
}

export function getEffectiveReportStatus(
  report: CrowdZoneReport,
  nowMs = Date.now()
): CrowdZoneReportStatus {
  if (report.status === 'resolved') return 'resolved';
  if (report.status === 'removed') return 'removed';
  if (report.status === 'disputed') return 'disputed';
  if (new Date(report.expires_at).getTime() < nowMs) return 'outdated';
  return 'active';
}

export const REPORT_STATUS_LABELS: Record<CrowdZoneReportStatus, string> = {
  active: 'Active',
  resolved: 'Resolved',
  disputed: 'Disputed',
  outdated: 'Outdated',
  removed: 'Removed',
};

export function getReportConfidence(
  report: CrowdZoneReport,
  nowMs = Date.now()
): 'high' | 'medium' | 'low' {
  const totalSpan =
    new Date(report.expires_at).getTime() - new Date(report.created_at).getTime();
  const elapsed = nowMs - new Date(report.created_at).getTime();
  const freshness = totalSpan > 0 ? Math.max(0, 1 - elapsed / totalSpan) : 0;
  const netScore = report.confirm_count - report.flag_count;
  if (netScore >= 3 && freshness > 0.3) return 'high';
  if (netScore >= 1 || freshness > 0.6) return 'medium';
  return 'low';
}

export function formatRelativeTimeAgo(iso: string, nowMs = Date.now()): string {
  const diffSec = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'just now';
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export function createPinSvgDataUrl(hex: string, isInactive = false): string {
  const fill = isInactive ? '#94a3b8' : hex;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="40" viewBox="0 0 34 40"><path d="M9 2h16a7 7 0 0 1 7 7v14a7 7 0 0 1-7 7h-4l-4 6-4-6H9a7 7 0 0 1-7-7V9a7 7 0 0 1 7-7z" fill="${fill}" stroke="#ffffff" stroke-width="2.5"/><circle cx="17" cy="16" r="5" fill="#ffffff"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function isSeedOrSampleCrowdZoneReport(report: any): boolean {
  if (!report || typeof report !== 'object') return false;
  const id = String(report.id || '');
  const reporterId = String(report.reporter_id || '');
  return id.startsWith('cz-seed-') || reporterId.startsWith('system-seed-');
}

export function generateDefaultSeedReports(_centerLat: number, _centerLng: number): CrowdZoneReport[] {
  return [];
}

