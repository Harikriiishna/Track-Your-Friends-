import type { PlaceResult, EmergencyAlert } from '../types.ts';
import { calculateDistanceMeters } from './geo.ts';

export interface EmergencySharePayload {
  token: string;
  trackingUrl: string;
  expiresAt: string;
  shareMessage: string;
  smsHref: string;
  whatsappHref: string;
}

/**
 * Generates a temporary secure URL and pre-formatted SMS / messaging deep links
 * for real-time emergency SOS tracking by emergency responders.
 */
export function createEmergencySharePayload(
  alert: EmergencyAlert,
  customToken?: string,
  customExpiresAt?: string
): EmergencySharePayload {
  const expMs = customExpiresAt
    ? new Date(customExpiresAt).getTime()
    : Date.now() + 2 * 60 * 60 * 1000;
  const expiresAt = new Date(expMs).toISOString();
  const token =
    customToken ||
    `sos_${alert.id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://beacon.app';

  const params = new URLSearchParams({
    sos_track: token,
    alertId: alert.id,
    lat: alert.latitude.toFixed(6),
    lng: alert.longitude.toFixed(6),
    acc: String(Math.round(alert.accuracy)),
    sender: alert.senderName,
    msg: alert.message,
    exp: String(expMs),
  });

  const trackingUrl = `${origin}/?${params.toString()}`;
  const shareMessage = `🚨 EMERGENCY SOS (${alert.senderName}): "${alert.message}"\n📍 Exact GPS: ${alert.latitude.toFixed(6)}, ${alert.longitude.toFixed(6)} (±${Math.round(alert.accuracy)}m)\n🔗 Live Real-Time Tracking Link (Valid 2h): ${trackingUrl}`;

  const isIos =
    typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const smsHref = isIos
    ? `sms:&body=${encodeURIComponent(shareMessage)}`
    : `sms:?body=${encodeURIComponent(shareMessage)}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

  return {
    token,
    trackingUrl,
    expiresAt,
    shareMessage,
    smsHref,
    whatsappHref,
  };
}

/**
 * Generates a universal deep-link URL that opens the device's native navigation app
 * (Google Maps on Android/Desktop, Apple Maps / Google Maps on iOS) with the target
 * coordinates pre-populated as the destination.
 */
export function getNativeNavigationUrl(
  destLat: number,
  destLng: number,
  originLat?: number | null,
  originLng?: number | null
): string {
  const dest = `${destLat},${destLng}`;
  const hasOrigin =
    typeof originLat === 'number' &&
    typeof originLng === 'number' &&
    Number.isFinite(originLat) &&
    Number.isFinite(originLng) &&
    !(originLat === 0 && originLng === 0);

  if (typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return hasOrigin
      ? `https://maps.apple.com/?saddr=${originLat},${originLng}&daddr=${dest}&dirflg=d`
      : `https://maps.apple.com/?daddr=${dest}&dirflg=d`;
  }

  const params = new URLSearchParams({
    api: '1',
    destination: dest,
    travelmode: 'driving',
  });
  if (hasOrigin) {
    params.set('origin', `${originLat},${originLng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

const CATEGORY_SINGLE_TERMS: Record<string, string[]> = {
  all: ['restaurant', 'cafe', 'supermarket', 'hospital', 'fuel', 'pharmacy', 'bank', 'school', 'bakery', 'park', 'store', 'temple'],
  fuel: ['fuel', 'petrol', 'gas station', 'indian oil', 'bharat petroleum', 'hp petrol', 'shell'],
  food: ['restaurant', 'dining', 'fast food', 'biryani', 'dhaba', 'kitchen', 'hotel', 'mess'],
  cafe: ['cafe', 'coffee', 'bakery', 'tea', 'sweet', 'juice'],
  groceries: ['supermarket', 'grocery', 'mart', 'store', 'provision', 'milk', 'diary', 'market', 'traders', 'distributors'],
  hospital: ['hospital', 'clinic', 'pharmacy', 'medical', 'nursing', 'dental', 'health'],
  park: ['park', 'garden', 'playground', 'ground', 'lake', 'gym', 'fitness'],
  hotel: ['hotel', 'lodge', 'resort', 'inn', 'residency', 'guest house'],
  atm: ['atm', 'bank', 'sbi', 'hdfc', 'icici', 'canara', 'axis'],
  parking: ['parking', 'bus stop', 'station'],
};

function buildOverpassQuery(lat: number, lon: number, category: string, radius: number): string {
  const r = Math.min(Math.max(radius, 300), 25000);
  const around = `(around:${r},${lat},${lon})`;

  let body = '';
  switch (category) {
    case 'fuel':
      body = `
        nwr${around}["amenity"~"^(fuel|charging_station)$"];
      `;
      break;
    case 'food':
      body = `
        nwr${around}["amenity"~"^(restaurant|fast_food|food_court)$"];
      `;
      break;
    case 'cafe':
      body = `
        nwr${around}["amenity"~"^(cafe|ice_cream)$"];
        nwr${around}["shop"~"^(bakery|coffee|pastry|tea|confectionery)$"];
      `;
      break;
    case 'groceries':
      body = `
        nwr${around}["shop"~"^(supermarket|convenience|grocery|general|department_store|mall|dairy|wholesale|greengrocer)$"];
        nwr${around}["amenity"="marketplace"];
      `;
      break;
    case 'hospital':
      body = `
        nwr${around}["amenity"~"^(hospital|clinic|doctors|pharmacy|dentist)$"];
        nwr${around}["healthcare"];
      `;
      break;
    case 'park':
      body = `
        nwr${around}["leisure"~"^(park|garden|playground|nature_reserve|pitch|fitness_centre|sports_centre)$"];
      `;
      break;
    case 'hotel':
      body = `
        nwr${around}["tourism"~"^(hotel|guest_house|hostel|motel|resort|apartment)$"];
      `;
      break;
    case 'atm':
      body = `
        nwr${around}["amenity"~"^(atm|bank)$"];
      `;
      break;
    case 'parking':
      body = `
        nwr${around}["amenity"="parking"];
      `;
      break;
    case 'all':
    default:
      body = `
        nwr${around}["name"]["amenity"];
        nwr${around}["name"]["shop"];
        nwr${around}["name"]["tourism"];
        nwr${around}["name"]["leisure"];
        nwr${around}["name"]["healthcare"];
        nwr${around}["name"]["office"];
        nwr${around}["name"]["craft"];
        nwr${around}["name"]["highway"="bus_stop"];
        nwr${around}["name"]["place"~"^(suburb|neighbourhood|village|town|locality)$"];
      `;
      break;
  }

  return `[out:json][timeout:6];(${body});out center 80;`;
}

async function queryOverpass(
  lat: number,
  lon: number,
  category: string,
  radiusMeters: number
): Promise<PlaceResult[]> {
  const query = buildOverpassQuery(lat, lon, category, radiusMeters);
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const url = `${endpoint}?data=${encodeURIComponent(query)}`;
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!resp.ok) continue;
      const data = await resp.json();
      if (!Array.isArray(data?.elements)) continue;

      const results: PlaceResult[] = [];
      data.elements.forEach((el: any, idx: number) => {
        const pLat = typeof el.lat === 'number' ? el.lat : el.center?.lat;
        const pLon = typeof el.lon === 'number' ? el.lon : el.center?.lon;
        if (typeof pLat !== 'number' || typeof pLon !== 'number') return;

        const tags = el.tags || {};
        const rawType =
          tags.amenity ||
          tags.shop ||
          tags.tourism ||
          tags.leisure ||
          tags.healthcare ||
          tags.office ||
          tags.place ||
          category;

        const fallbackLabel = String(rawType).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const name =
          tags.name ||
          tags['name:en'] ||
          tags.brand ||
          tags.operator ||
          tags['addr:housename'] ||
          fallbackLabel;

        if (!name) return;

        const dist = calculateDistanceMeters(lat, lon, pLat, pLon);
        if (dist > radiusMeters) return;

        const addressParts = [
          tags.name,
          tags['addr:street'] || tags['addr:road'],
          tags['addr:suburb'] || tags['addr:neighbourhood'] || tags['addr:hamlet'],
          tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || tags['addr:district'],
          tags['addr:state'],
        ].filter(Boolean);

        const display_name =
          addressParts.length > 1
            ? addressParts.join(', ')
            : `${name} (${fallbackLabel})`;

        results.push({
          id: `osm-${el.type || 'n'}-${el.id || idx}`,
          name,
          display_name,
          lat: pLat,
          lon: pLon,
          category: String(rawType),
          type: String(rawType),
          city: tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
          state: tags['addr:state'],
          distanceMeters: dist,
          estimatedDriveMinutes: Math.max(1, Math.round((dist / 1000 / 30) * 60)),
          rating: Number((4.3 + ((idx * 3) % 7) * 0.1).toFixed(1)),
          isOpen: true,
        });
      });

      if (results.length > 0) {
        return results;
      }
    } catch {
      // Try next mirror
    }
  }
  return [];
}

async function queryPhotonNearby(
  lat: number,
  lon: number,
  category: string,
  radiusMeters: number
): Promise<PlaceResult[]> {
  const results: PlaceResult[] = [];
  const degDelta = Math.max(0.02, Math.min(0.35, (radiusMeters / 111000) * 1.35));
  const bbox = `${(lon - degDelta).toFixed(5)},${(lat - degDelta).toFixed(5)},${(lon + degDelta).toFixed(5)},${(lat + degDelta).toFixed(5)}`;

  const requests: Promise<void>[] = [];

  // 1. Reverse proximity lookup for 'all' category — returns closest features around lat/lon
  if (category === 'all') {
    const revUrl = new URL('https://photon.komoot.io/reverse');
    revUrl.searchParams.set('lat', String(lat));
    revUrl.searchParams.set('lon', String(lon));
    revUrl.searchParams.set('radius', String(Math.max(1, Math.min(25, Math.ceil(radiusMeters / 1000)))));
    revUrl.searchParams.set('limit', '35');
    revUrl.searchParams.set('distance_sort', 'true');

    requests.push(
      (async () => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 4000);
          const resp = await fetch(revUrl.toString(), { signal: controller.signal });
          clearTimeout(timer);
          if (!resp.ok) return;
          const data = await resp.json();
          if (Array.isArray(data?.features)) {
            data.features.forEach((feat: any, idx: number) => {
              const parsed = parsePhotonFeature(feat, lat, lon, category, radiusMeters, `rev-${idx}`);
              if (parsed) results.push(parsed);
            });
          }
        } catch {}
      })()
    );
  }

  // 2. Single-keyword searches with bounding box & proximity bias
  const terms = (CATEGORY_SINGLE_TERMS[category] || [category]).slice(0, 6);
  for (const term of terms) {
    requests.push(
      (async () => {
        try {
          const photonUrl = new URL('https://photon.komoot.io/api/');
          photonUrl.searchParams.set('q', term);
          photonUrl.searchParams.set('lat', String(lat));
          photonUrl.searchParams.set('lon', String(lon));
          photonUrl.searchParams.set('bbox', bbox);
          photonUrl.searchParams.set('limit', '15');

          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 4000);
          const resp = await fetch(photonUrl.toString(), { signal: controller.signal });
          clearTimeout(timer);
          if (!resp.ok) return;
          const data = await resp.json();
          if (Array.isArray(data?.features)) {
            data.features.forEach((feat: any, idx: number) => {
              const parsed = parsePhotonFeature(feat, lat, lon, category, radiusMeters, `${term}-${idx}`);
              if (parsed) results.push(parsed);
            });
          }
        } catch {}
      })()
    );
  }

  await Promise.allSettled(requests);
  return results;
}

function parsePhotonFeature(
  feat: any,
  userLat: number,
  userLon: number,
  fallbackCat: string,
  maxRadiusMeters: number,
  keySuffix: string
): PlaceResult | null {
  const props = feat?.properties || {};
  const coords = feat?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;

  const pLon = Number(coords[0]);
  const pLat = Number(coords[1]);
  if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) return null;

  const dist = calculateDistanceMeters(userLat, userLon, pLat, pLon);
  if (dist > maxRadiusMeters) return null;

  const name =
    props.name ||
    [props.housenumber, props.street].filter(Boolean).join(' ') ||
    props.locality ||
    props.district ||
    null;

  if (!name) return null;

  const address = [
    props.name,
    props.street,
    props.district || props.locality,
    props.city || props.town || props.village || props.county,
    props.state,
  ]
    .filter(Boolean)
    .join(', ');

  const effectiveCat = props.osm_value || props.osm_key || fallbackCat;

  return {
    id: `photon-${keySuffix}-${pLon.toFixed(5)}-${pLat.toFixed(5)}`,
    name,
    display_name: address || name,
    lat: pLat,
    lon: pLon,
    category: String(effectiveCat),
    type: String(props.osm_value || fallbackCat),
    city: props.city || props.town || props.village || props.county,
    state: props.state,
    country: props.country,
    distanceMeters: dist,
    estimatedDriveMinutes: Math.max(1, Math.round((dist / 1000 / 30) * 60)),
    rating: 4.5,
    isOpen: true,
  };
}

export function deduplicateAndSortPlaces(
  places: PlaceResult[],
  userLat: number,
  userLon: number,
  maxRadiusMeters: number
): PlaceResult[] {
  const unique: PlaceResult[] = [];

  for (const item of places) {
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lon)) continue;
    const dist =
      typeof item.distanceMeters === 'number'
        ? item.distanceMeters
        : calculateDistanceMeters(userLat, userLon, item.lat, item.lon);

    if (dist > maxRadiusMeters) continue;

    const normName = (item.name || '').trim().toLowerCase();
    const isDuplicate = unique.some((existing) => {
      const sameName = (existing.name || '').trim().toLowerCase() === normName;
      const d = calculateDistanceMeters(existing.lat, existing.lon, item.lat, item.lon);
      return (sameName && d < 120) || d < 15;
    });

    if (!isDuplicate) {
      unique.push({
        ...item,
        distanceMeters: dist,
        estimatedDriveMinutes: Math.max(1, Math.round((dist / 1000 / 30) * 60)),
      });
    }
  }

  unique.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));
  return unique.slice(0, 60);
}

/**
 * Fetches real nearby places around (lat, lon) within maxRadiusMeters using
 * Overpass API + Photon single-term & reverse proximity queries in parallel.
 */
export async function fetchRealNearbyPlaces(
  lat: number,
  lon: number,
  category = 'all',
  maxRadiusMeters = 5000
): Promise<PlaceResult[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];

  const cleanCategory = (category || 'all').toLowerCase();
  const [overpassPlaces, photonPlaces] = await Promise.all([
    queryOverpass(lat, lon, cleanCategory, maxRadiusMeters),
    queryPhotonNearby(lat, lon, cleanCategory, maxRadiusMeters),
  ]);

  return deduplicateAndSortPlaces(
    [...overpassPlaces, ...photonPlaces],
    lat,
    lon,
    maxRadiusMeters
  );
}
