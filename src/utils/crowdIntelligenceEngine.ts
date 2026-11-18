import type {
  CrowdActivityWindow,
  CrowdTimeWindow,
  CrowdCellSummary,
  CrowdHistoryBucket,
  CrowdLevel,
  CrowdPredictionPoint,
  CrowdTrendDirection,
  CrowdZoneCommunityReport,
} from '../types.ts';
import { calculateDistanceMeters } from './geo.ts';

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export const TIME_WINDOW_LABELS: Record<CrowdTimeWindow, string> = {
  '15m': 'Last 15 Minutes',
  '1h': 'Last 1 Hour',
  '3h': 'Last 3 Hours',
  '24h': 'Last 24 Hours',
  '7d': 'Last 7 Days',
  all: 'All Available History',
};

export const CROWD_ACTIVITY_WINDOWS: Array<{
  id: CrowdActivityWindow;
  label: string;
  shortLabel: string;
  durationMs: number;
  bucketMs: number;
}> = [
  { id: '15m', label: 'Last 15 Minutes', shortLabel: '15m', durationMs: 15 * 60 * 1000, bucketMs: 3 * 60 * 1000 },
  { id: '1h', label: 'Last 1 Hour', shortLabel: '1h', durationMs: 60 * 60 * 1000, bucketMs: 10 * 60 * 1000 },
  { id: '3h', label: 'Last 3 Hours', shortLabel: '3h', durationMs: 3 * 60 * 60 * 1000, bucketMs: 30 * 60 * 1000 },
  { id: '24h', label: 'Last 24 Hours', shortLabel: '24h', durationMs: 24 * 60 * 60 * 1000, bucketMs: 2 * 60 * 60 * 1000 },
  { id: '7d', label: 'Last 7 Days', shortLabel: '7d', durationMs: 7 * 24 * 60 * 60 * 1000, bucketMs: 12 * 60 * 60 * 1000 },
  { id: 'all', label: 'All Available History', shortLabel: 'All', durationMs: 365 * 24 * 60 * 60 * 1000, bucketMs: 24 * 60 * 60 * 1000 },
];

export function getWindowConfig(windowId: CrowdActivityWindow = '1h') {
  return CROWD_ACTIVITY_WINDOWS.find((w) => w.id === windowId) || CROWD_ACTIVITY_WINDOWS[1];
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return calculateDistanceMeters(lat1, lon1, lat2, lon2);
}

/**
 * Encodes (latitude, longitude) into a standard Base32 Geohash string.
 * Precision 6 = ~1.2km x 0.6km; Precision 7 = ~153m x 153m.
 */
export function encodeGeohash(latitude: number, longitude: number, precision = 6): string {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '000000';
  const lat = Math.max(-90, Math.min(90, latitude));
  const lng = Math.max(-180, Math.min(180, longitude));

  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';

  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const lngMid = (lngMin + lngMax) / 2;
      if (lng >= lngMid) {
        idx = idx * 2 + 1;
        lngMin = lngMid;
      } else {
        idx = idx * 2;
        lngMax = lngMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (lat >= latMid) {
        idx = idx * 2 + 1;
        latMin = latMid;
      } else {
        idx = idx * 2;
        latMax = latMid;
      }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += BASE32.charAt(idx);
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
}

/**
 * Decodes a Base32 Geohash into its bounding box and center point.
 */
export function decodeGeohashBounds(geohash: string): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centerLat: number;
  centerLng: number;
} {
  let evenBit = true;
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  const clean = String(geohash || '').toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    const chr = clean.charAt(i);
    const idx = BASE32.indexOf(chr);
    if (idx === -1) break;

    for (let n = 4; n >= 0; n--) {
      const bitN = (idx >> n) & 1;
      if (evenBit) {
        const lngMid = (lngMin + lngMax) / 2;
        if (bitN === 1) {
          lngMin = lngMid;
        } else {
          lngMax = lngMid;
        }
      } else {
        const latMid = (latMin + latMax) / 2;
        if (bitN === 1) {
          latMin = latMid;
        } else {
          latMax = latMid;
        }
      }
      evenBit = !evenBit;
    }
  }

  return {
    minLat: latMin,
    maxLat: latMax,
    minLng: lngMin,
    maxLng: lngMax,
    centerLat: Number(((latMin + latMax) / 2).toFixed(6)),
    centerLng: Number(((lngMin + lngMax) / 2).toFixed(6)),
  };
}

export interface RawLocationSignalInput {
  id?: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number | null;
  timestamp: string;
  contributesToCrowd?: boolean;
  consentGiven?: boolean;
}

export function isEligibleCrowdSignal(
  sig: RawLocationSignalInput,
  cutoffMs: number,
  maxAccuracyMeters = 250
): boolean {
  if (!sig) return false;
  if (sig.contributesToCrowd === false || sig.consentGiven === false) return false;
  if (!Number.isFinite(sig.latitude) || !Number.isFinite(sig.longitude)) return false;
  if (sig.latitude === 0 && sig.longitude === 0) return false;
  if (sig.latitude < -90 || sig.latitude > 90 || sig.longitude < -180 || sig.longitude > 180) {
    return false;
  }
  const acc = Number(sig.accuracy);
  if (!Number.isFinite(acc) || acc <= 0 || acc > maxAccuracyMeters) return false;
  if (sig.speed != null && Number.isFinite(sig.speed) && Number(sig.speed) > 120) {
    return false;
  }
  const tsMs = new Date(sig.timestamp || 0).getTime();
  if (!Number.isFinite(tsMs) || tsMs < cutoffMs) return false;
  return true;
}

export function classifyCrowdLevelFromScore(
  weightedDensityScore: number,
  hasSufficientData: boolean
): CrowdLevel {
  if (!hasSufficientData || weightedDensityScore <= 0) return 'Unknown';
  if (weightedDensityScore < 2.2) return 'Quiet';
  if (weightedDensityScore < 4.8) return 'Moderate';
  if (weightedDensityScore < 8.5) return 'Busy';
  return 'Very Busy';
}

export interface AggregateCrowdInput {
  signals: RawLocationSignalInput[];
  reports: CrowdZoneCommunityReport[];
  window?: CrowdTimeWindow;
  precision?: number;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
  minAnonymousSignals?: number;
  nowMs?: number;
}

/**
 * Privacy-Preserving Geohash Crowd Aggregation Engine.
 * - Groups eligible consented GPS signals and community reports into geohash cells.
 * - Deduplicates multiple breadcrumbs from the same user within the same cell.
 * - Never leaks user IDs, names, or exact personal coordinates.
 */
export function aggregateCrowdCells(input: AggregateCrowdInput): CrowdCellSummary[] {
  const windowId: CrowdActivityWindow = input.window || '1h';
  const winCfg = getWindowConfig(windowId);
  const nowMs = input.nowMs || Date.now();
  const cutoffMs = nowMs - winCfg.durationMs;
  const prevCutoffMs = cutoffMs - winCfg.durationMs;
  const precision = input.precision || 6;
  const minAnonymousSignals = input.minAnonymousSignals ?? 1;

  interface CellBucketAccumulator {
    geohash: string;
    currentUsers: Map<string, { accuracy: number; tsMs: number }>;
    previousUsers: Set<string>;
    reports: CrowdZoneCommunityReport[];
    latestTsMs: number;
  }

  const cellsMap = new Map<string, CellBucketAccumulator>();

  const ensureCell = (gh: string): CellBucketAccumulator => {
    let acc = cellsMap.get(gh);
    if (!acc) {
      acc = {
        geohash: gh,
        currentUsers: new Map(),
        previousUsers: new Set(),
        reports: [],
        latestTsMs: 0,
      };
      cellsMap.set(gh, acc);
    }
    return acc;
  };

  for (const sig of input.signals || []) {
    const tsMs = new Date(sig.timestamp || 0).getTime();
    if (!Number.isFinite(tsMs)) continue;

    if (isEligibleCrowdSignal(sig, cutoffMs)) {
      const gh = encodeGeohash(sig.latitude, sig.longitude, precision);
      const cell = ensureCell(gh);
      const existing = cell.currentUsers.get(sig.userId);
      if (!existing || tsMs > existing.tsMs) {
        cell.currentUsers.set(sig.userId, { accuracy: sig.accuracy, tsMs });
      }
      if (tsMs > cell.latestTsMs) cell.latestTsMs = tsMs;
    } else if (tsMs >= prevCutoffMs && tsMs < cutoffMs && isEligibleCrowdSignal(sig, prevCutoffMs)) {
      const gh = encodeGeohash(sig.latitude, sig.longitude, precision);
      const cell = ensureCell(gh);
      cell.previousUsers.add(sig.userId);
    }
  }

  for (const rep of input.reports || []) {
    if (!rep || rep.status === 'removed' || rep.status === 'dismissed' || rep.status === 'expired') {
      continue;
    }
    const repMs = new Date(rep.updatedAt || rep.createdAt || 0).getTime();
    if (!Number.isFinite(repMs) || repMs < cutoffMs) continue;
    if (!Number.isFinite(rep.latitude) || !Number.isFinite(rep.longitude)) continue;

    const gh = rep.cellId || rep.geohash || encodeGeohash(rep.latitude, rep.longitude, precision);
    const cell = ensureCell(gh);
    cell.reports.push(rep);
    if (repMs > cell.latestTsMs) cell.latestTsMs = repMs;
  }

  const results: CrowdCellSummary[] = [];

  for (const cell of cellsMap.values()) {
    const bounds = decodeGeohashBounds(cell.geohash);

    if (
      input.centerLat != null &&
      input.centerLng != null &&
      Number.isFinite(input.centerLat) &&
      Number.isFinite(input.centerLng) &&
      input.radiusKm != null &&
      input.radiusKm > 0
    ) {
      const distMeters = calculateDistanceMeters(
        input.centerLat,
        input.centerLng,
        bounds.centerLat,
        bounds.centerLng
      );
      if (distMeters > input.radiusKm * 1000) {
        continue;
      }
    }

    const uniqueSignalCount = cell.currentUsers.size;
    const prevSignalCount = cell.previousUsers.size;
    const verifiedReports = cell.reports.filter(
      (r) => (r.verificationCount || r.verificationsCount || 0) >= 1 || r.verified
    );
    const unverifiedReports = cell.reports.filter(
      (r) => !((r.verificationCount || r.verificationsCount || 0) >= 1 || r.verified)
    );

    let reportWeight = 0;
    for (const r of cell.reports) {
      const verMult =
        r.verified || (r.verificationCount || r.verificationsCount || 0) > 0 ? 1.35 : 0.85;
      if (r.crowdLevel === 'Very Busy') reportWeight += 6.5 * verMult;
      else if (r.crowdLevel === 'Busy') reportWeight += 4.2 * verMult;
      else if (r.crowdLevel === 'Moderate') reportWeight += 2.5 * verMult;
      else if (r.crowdLevel === 'Quiet') reportWeight += 1.0 * verMult;
      else reportWeight += 2.0 * verMult;
    }

    const hasSufficientData =
      uniqueSignalCount >= minAnonymousSignals || cell.reports.length >= 1;

    const weightedDensityScore = Number((uniqueSignalCount * 1.6 + reportWeight).toFixed(2));
    const densityScore = hasSufficientData
      ? Math.min(100, Math.max(12, Math.round(weightedDensityScore * 10.5)))
      : 0;
    const crowdLevel = classifyCrowdLevelFromScore(weightedDensityScore, hasSufficientData);

    let confidenceScore = 0;
    if (hasSufficientData) {
      let avgAccuracy = 35;
      if (uniqueSignalCount > 0) {
        let sumAcc = 0;
        cell.currentUsers.forEach((v) => {
          sumAcc += v.accuracy;
        });
        avgAccuracy = sumAcc / uniqueSignalCount;
      }
      const accuracyBonus = avgAccuracy <= 15 ? 25 : avgAccuracy <= 40 ? 18 : 10;
      const signalScore = Math.min(45, uniqueSignalCount * 16);
      const reportScore = Math.min(35, verifiedReports.length * 18 + unverifiedReports.length * 10);
      const ageMinutes = Math.max(0, (nowMs - cell.latestTsMs) / 60000);
      const freshnessPenalty = Math.min(25, Math.floor(ageMinutes / 15) * 4);
      confidenceScore = Math.max(
        20,
        Math.min(99, Math.round(25 + accuracyBonus + signalScore + reportScore - freshnessPenalty))
      );
    }

    let trend: CrowdTrendDirection = 'stable';
    const currentEffective = uniqueSignalCount + cell.reports.length;
    if (currentEffective > prevSignalCount + 1) {
      trend = 'increasing';
    } else if (prevSignalCount > currentEffective + 1) {
      trend = 'decreasing';
    }

    const dataOrigin: CrowdCellSummary['dataOrigin'] =
      uniqueSignalCount > 0 && cell.reports.length > 0
        ? 'hybrid'
        : uniqueSignalCount > 0
        ? 'measured'
        : cell.reports.length > 0
        ? 'reported'
        : 'insufficient';

    results.push({
      cellId: cell.geohash,
      geohash: cell.geohash,
      centerLat: bounds.centerLat,
      centerLng: bounds.centerLng,
      bounds: {
        minLat: bounds.minLat,
        maxLat: bounds.maxLat,
        minLng: bounds.minLng,
        maxLng: bounds.maxLng,
      },
      crowdLevel,
      densityScore,
      confidenceScore,
      trend,
      dataSource: dataOrigin,
      dataOrigin,
      insufficientData: !hasSufficientData,
      activeSignalsBucket: hasSufficientData ? Math.max(uniqueSignalCount, cell.reports.length) : 0,
      verifiedReportCount: verifiedReports.length,
      verifiedReportsCount: verifiedReports.length,
      totalReportsCount: cell.reports.length,
      weightedScore: weightedDensityScore,
      windowId,
      updatedAt: new Date(cell.latestTsMs || nowMs).toISOString(),
    });
  }

  return results.sort((a, b) => b.weightedScore - a.weightedScore);
}

/**
 * Builds a real time-bucketed crowd history series for a given area/geohash and time window.
 */
export function buildCrowdHistorySeries(input: {
  signals: RawLocationSignalInput[];
  reports: CrowdZoneCommunityReport[];
  window?: CrowdTimeWindow;
  cellId?: string;
  precision?: number;
  nowMs?: number;
}): CrowdHistoryBucket[] {
  const windowId: CrowdActivityWindow = input.window || '1h';
  const winCfg = getWindowConfig(windowId);
  const nowMs = input.nowMs || Date.now();
  const numBuckets = windowId === '15m' ? 15 : windowId === '7d' || windowId === 'all' ? 14 : 12;
  const stepMs = Math.max(60 * 1000, Math.floor(winCfg.durationMs / numBuckets));
  const startMs = nowMs - stepMs * numBuckets;
  const precision = input.precision || 6;

  // Compute active baseline signals in this window so continuous presence is reflected across buckets
  const eligibleSignals = (input.signals || []).filter((sig) => {
    if (!sig || sig.contributesToCrowd === false) return false;
    if (input.cellId) {
      const gh = encodeGeohash(sig.latitude, sig.longitude, precision);
      if (gh !== input.cellId) return false;
    }
    return true;
  });

  const eligibleReports = (input.reports || []).filter((r) => {
    if (!r || r.status === 'removed' || r.status === 'dismissed') return false;
    const repCell = r.cellId || r.geohash || encodeGeohash(r.latitude, r.longitude, precision);
    if (input.cellId && repCell !== input.cellId) return false;
    return true;
  });

  const buckets: CrowdHistoryBucket[] = [];
  for (let i = 0; i < numBuckets; i++) {
    const bStart = startMs + i * stepMs;
    const bEnd = bStart + stepMs;
    const uniqueUsers = new Set<string>();
    let reportsInBucket = 0;
    let reportWeight = 0;
    let activeCarryWeight = 0;

    for (const sig of eligibleSignals) {
      const ts = new Date(sig.timestamp || 0).getTime();
      if (!Number.isFinite(ts)) continue;
      if (ts >= bStart && ts < bEnd) {
        uniqueUsers.add(sig.userId);
      } else if (ts <= bEnd && bEnd - ts <= Math.max(stepMs * 4, 25 * 60 * 1000)) {
        // Active session presence carry-over with exponential decay
        const ageSteps = Math.max(1, (bEnd - ts) / stepMs);
        activeCarryWeight += Math.max(0.25, 1.15 * Math.exp(-0.28 * ageSteps));
      }
    }

    for (const r of eligibleReports) {
      const ts = new Date(r.createdAt || 0).getTime();
      const expMs = r.expiresAt ? new Date(r.expiresAt).getTime() : ts + 2 * 60 * 60 * 1000;
      const baseW =
        r.crowdLevel === 'Very Busy'
          ? 6.2
          : r.crowdLevel === 'Busy'
            ? 4.2
            : r.crowdLevel === 'Moderate'
              ? 2.6
              : 1.2;
      if (ts >= bStart && ts < bEnd) {
        reportsInBucket += 1;
        reportWeight += baseW;
      } else if (ts < bStart && expMs >= bStart) {
        const elapsedRatio = Math.min(1, Math.max(0, (bStart - ts) / Math.max(1, expMs - ts)));
        reportWeight += baseW * Math.max(0.35, 1 - elapsedRatio * 0.55);
      }
    }

    const effectiveSignals = uniqueUsers.size + (activeCarryWeight > 0 ? Math.ceil(activeCarryWeight * 0.6) : 0);
    const totalSignals = effectiveSignals + reportsInBucket + (reportWeight > 0 ? 1 : 0);
    const score = Number((uniqueUsers.size * 1.6 + activeCarryWeight + reportWeight).toFixed(2));
    const densityScore =
      totalSignals > 0 ? Math.min(100, Math.max(10, Math.round(score * 10.5))) : 0;
    const level = classifyCrowdLevelFromScore(score, totalSignals > 0);

    const endDate = new Date(bEnd);
    const label =
      windowId === '7d' || windowId === 'all'
        ? endDate.toLocaleDateString([], { weekday: 'short', hour: '2-digit' })
        : endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    buckets.push({
      bucketStart: new Date(bStart).toISOString(),
      bucketEnd: endDate.toISOString(),
      label,
      crowdLevel: level,
      densityScore,
      signalCount: effectiveSignals,
      reportCount: reportsInBucket,
      weightedScore: score,
      activityType: 'observed',
    });
  }

  return buckets;
}

/**
 * Generates next-6-hours crowd predictions strictly derived from observed historical signals
 * in the database (distinguishing 'observed' from 'predicted' activity).
 */
export function predictCrowdActivitySeries(input: {
  historyBuckets: CrowdHistoryBucket[];
  currentTrend?: CrowdTrendDirection;
  nowMs?: number;
}): CrowdPredictionPoint[] {
  const observedHistory = input.historyBuckets || [];
  const nowMs = input.nowMs || Date.now();
  const nonEmpty = observedHistory.filter((b) => b.weightedScore > 0);
  const hasObservedBaseline = nonEmpty.length > 0;
  const avgScore = hasObservedBaseline
    ? nonEmpty.reduce((acc, b) => acc + b.weightedScore, 0) / nonEmpty.length
    : 0;

  const recentSlice = observedHistory.slice(-3);
  const olderSlice = observedHistory.slice(-6, -3);
  const recentAvg =
    recentSlice.reduce((s, b) => s + b.weightedScore, 0) / Math.max(1, recentSlice.length);
  const olderAvg =
    olderSlice.reduce((s, b) => s + b.weightedScore, 0) / Math.max(1, olderSlice.length);
  const slope = recentAvg - olderAvg;

  const predictions: CrowdPredictionPoint[] = [];
  for (let h = 1; h <= 6; h++) {
    const targetMs = nowMs + h * 60 * 60 * 1000;
    const targetDate = new Date(targetMs);
    const hourLabel = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!hasObservedBaseline) {
      predictions.push({
        hourOffset: h,
        targetTime: targetDate.toISOString(),
        label: hourLabel,
        hourLabel,
        predictedLevel: 'Unknown',
        predictedDensityScore: 0,
        predictedScore: 0,
        confidenceScore: 0,
        activityType: 'predicted',
        basis: 'Insufficient observed historical data in this cell to project crowd density',
      });
      continue;
    }

    const decayFactor = Math.max(0.35, 1 - h * 0.1);
    const projectedScore = Math.max(0.4, Number((avgScore + slope * 0.45 * decayFactor).toFixed(2)));
    const predictedDensityScore = Math.min(100, Math.max(12, Math.round(projectedScore * 10.5)));
    const predictedLevel = classifyCrowdLevelFromScore(projectedScore, true);
    const confidence = Math.max(25, Math.min(85, Math.round(72 - h * 7 + nonEmpty.length * 2)));

    predictions.push({
      hourOffset: h,
      targetTime: targetDate.toISOString(),
      label: hourLabel,
      hourLabel,
      predictedLevel,
      predictedDensityScore,
      predictedScore: projectedScore,
      confidenceScore: confidence,
      activityType: 'predicted',
      basis: `Projected from ${nonEmpty.length} observed historical buckets`,
    });
  }

  return predictions;
}

/**
 * Recommends alternative less-crowded nearby places by cross-referencing discovered places
 * against live geohash crowd cells.
 */
export function recommendAlternativePlaces(input: {
  targetLat: number;
  targetLng: number;
  targetCategory?: string;
  candidatePlaces: Array<{
    id: string;
    name: string;
    category: string;
    lat: number;
    lon: number;
    address: string;
  }>;
  cells: CrowdCellSummary[];
  precision?: number;
}): Array<{
  placeId: string;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  crowdLevel: CrowdLevel;
  confidenceScore: number;
  reason: string;
}> {
  const precision = input.precision || 6;
  const cellMap = new Map<string, CrowdCellSummary>();
  for (const c of input.cells || []) {
    cellMap.set(c.cellId || c.geohash, c);
  }

  const annotated = (input.candidatePlaces || []).map((place) => {
    const gh = encodeGeohash(place.lat, place.lon, precision);
    const cell = cellMap.get(gh);
    const dist = calculateDistanceMeters(input.targetLat, input.targetLng, place.lat, place.lon);
    const crowdLevel: CrowdLevel = cell ? cell.crowdLevel : 'Quiet';
    const confidenceScore = cell ? cell.confidenceScore : 65;

    let reason = 'No congestion or queue reports in this sector';
    if (cell?.crowdLevel === 'Quiet') {
      reason = 'Verified Quiet zone with low foot traffic';
    } else if (cell?.crowdLevel === 'Moderate') {
      reason = 'Moderate activity · Lower wait time than peak areas';
    }

    return {
      placeId: place.id,
      name: place.name,
      category: place.category,
      address: place.address,
      latitude: place.lat,
      longitude: place.lon,
      distanceMeters: dist,
      crowdLevel,
      confidenceScore,
      reason,
    };
  });

  return annotated
    .filter((item) => item.crowdLevel !== 'Busy' && item.crowdLevel !== 'Very Busy')
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 6);
}
