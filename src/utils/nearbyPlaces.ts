import { calculateDistanceMeters } from './geo.ts';

export interface DiscoveredPlace {
  id: string;
  name: string;
  display_name: string;
  lat: number;
  lon: number;
  category?: string;
  type?: string;
  city?: string;
  state?: string;
  country?: string;
  distanceMeters?: number;
  rating?: number;
  isOpen?: boolean;
  estimatedDriveMinutes?: number;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const ARCGIS_GEOCODE_URL =
  'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';

const ARCGIS_CATEGORY_MAP: Record<string, string> = {
  all: 'Food,Coffee Shop,Gas Station,Hospital,Medical Clinic,Pharmacy,Grocery,Park,Hotel,ATM,Bank,Shop,School',
  fuel: 'Gas Station,Charging Station,Automotive',
  food: 'Food,Restaurant,Fast Food,Indian Food,Bakery',
  cafe: 'Coffee Shop,Tea House,Bakery,Dessert,Ice Cream Shop',
  groceries: 'Grocery,Supermarket,Convenience Store,Department Store,Market',
  hospital: 'Hospital,Medical Clinic,Pharmacy,Doctor,Dentist,Health Care Facility',
  park: 'Park,Garden,Nature Reserve,Sports Center,Playground',
  hotel: 'Hotel,Motel,Resort,Hostel,Guest House,Bed and Breakfast',
  atm: 'ATM,Bank,Financial Service',
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  all: ['restaurant', 'hospital', 'supermarket'],
  fuel: ['petrol', 'fuel', 'gas station'],
  food: ['restaurant', 'hotel', 'dhaba'],
  cafe: ['cafe', 'coffee', 'bakery'],
  groceries: ['supermarket', 'grocery', 'store'],
  hospital: ['hospital', 'clinic', 'pharmacy'],
  park: ['park', 'garden', 'playground'],
  hotel: ['hotel', 'lodge', 'resort'],
  atm: ['atm', 'bank'],
};

// In-memory cache keyed by rounded lat/lon + category + radius
const memoryCache = new Map<string, { timestamp: number; results: DiscoveredPlace[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(lat: number, lon: number, category: string, radius: number): string {
  // Round to ~110m grid (3 decimal places) so 1-meter GPS jitter hits the cache immediately
  return `beacon_nearby_v2_${lat.toFixed(3)}_${lon.toFixed(3)}_${category.toLowerCase()}_${radius}`;
}

function readCachedPlaces(key: string): DiscoveredPlace[] | null {
  const now = Date.now();
  const mem = memoryCache.get(key);
  if (mem && now - mem.timestamp < CACHE_TTL_MS && mem.results.length > 0) {
    return mem.results;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.timestamp === 'number' &&
          now - parsed.timestamp < CACHE_TTL_MS &&
          Array.isArray(parsed.results) &&
          parsed.results.length > 0
        ) {
          memoryCache.set(key, parsed);
          return parsed.results;
        }
      }
    } catch {
      // ignore storage errors
    }
  }
  return null;
}

function writeCachedPlaces(key: string, results: DiscoveredPlace[]): void {
  if (!results || results.length === 0) return;
  const entry = { timestamp: Date.now(), results };
  memoryCache.set(key, entry);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(key, JSON.stringify(entry));
    } catch {
      // ignore quota errors
    }
  }
}

export function buildOverpassCategoryFilters(
  category: string,
  lat: number,
  lon: number,
  radiusMeters: number
): string {
  const around = `(around:${radiusMeters},${lat},${lon})`;
  const cat = (category || 'all').toLowerCase();

  switch (cat) {
    case 'fuel':
      return `nwr${around}["amenity"~"^(fuel|charging_station)$"];`;
    case 'food':
      return `nwr${around}["amenity"~"^(restaurant|fast_food|food_court|biergarten|pub|bar)$"];`;
    case 'cafe':
      return `nwr${around}["amenity"~"^(cafe|ice_cream)$"];nwr${around}["shop"~"^(bakery|coffee|pastry|tea)$"];`;
    case 'groceries':
      return `nwr${around}["shop"~"^(supermarket|convenience|grocery|greengrocer|mall|department_store|general|bakery|butcher|marketplace)$"];nwr${around}["amenity"="marketplace"];`;
    case 'hospital':
      return `nwr${around}["amenity"~"^(hospital|clinic|doctors|pharmacy|dentist)$"];nwr${around}["healthcare"];`;
    case 'park':
      return `nwr${around}["leisure"~"^(park|garden|nature_reserve|playground|pitch|fitness_centre|sports_centre)$"];nwr${around}["tourism"~"^(viewpoint|attraction)$"];`;
    case 'hotel':
      return `nwr${around}["tourism"~"^(hotel|motel|guest_house|hostel|apartment|chalet|resort)$"];`;
    case 'atm':
      return `nwr${around}["amenity"~"^(atm|bank|bureau_de_change)$"];`;
    case 'all':
    default:
      return (
        `nwr${around}["amenity"~"^(restaurant|fast_food|cafe|fuel|charging_station|hospital|clinic|pharmacy|bank|atm|marketplace|police|post_office|library|place_of_worship|school|college)$"];` +
        `nwr${around}["shop"~"^(supermarket|convenience|grocery|bakery|mall|department_store|chemist|electronics|clothes|general)$"];` +
        `nwr${around}["tourism"~"^(hotel|motel|guest_house|hostel|attraction|viewpoint|museum)$"];` +
        `nwr${around}["leisure"~"^(park|garden|nature_reserve|fitness_centre|sports_centre)$"];`
      );
  }
}

function parseOverpassElement(el: any, idx: number, fallbackCategory: string): DiscoveredPlace | null {
  const tags = el.tags || {};
  const elLat = el.lat ?? el.center?.lat;
  const elLon = el.lon ?? el.center?.lon;

  if (typeof elLat !== 'number' || typeof elLon !== 'number') return null;

  const rawCategory =
    tags.amenity ||
    tags.shop ||
    tags.tourism ||
    tags.leisure ||
    tags.healthcare ||
    tags.office ||
    fallbackCategory;

  const formattedCategoryLabel = String(rawCategory || 'place')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const name =
    tags.name ||
    tags['name:en'] ||
    tags.brand ||
    tags.operator ||
    tags.official_name ||
    (tags['addr:housename'] ? tags['addr:housename'] : null);

  if (!name) return null;

  const streetPart = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const cityPart =
    tags['addr:city'] ||
    tags['addr:town'] ||
    tags['addr:suburb'] ||
    tags['addr:village'] ||
    tags['addr:district'] ||
    '';
  const statePart = tags['addr:state'] || '';

  const addressParts = [
    name,
    streetPart,
    tags['addr:place'],
    cityPart,
    statePart,
    tags['addr:postcode'],
  ].filter(Boolean);

  const displayName =
    addressParts.length > 1
      ? addressParts.join(', ')
      : `${name} (${formattedCategoryLabel})`;

  return {
    id: `osm-${el.type || 'n'}-${el.id || idx}`,
    name: String(name).trim(),
    display_name: displayName,
    lat: elLat,
    lon: elLon,
    category: String(rawCategory || fallbackCategory).replace(/_/g, ' '),
    type: String(rawCategory || 'poi'),
    city: cityPart || undefined,
    state: statePart || undefined,
    country: tags['addr:country'] || undefined,
  };
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 1. ArcGIS World Geocoding Service (Single fast CDN request, works globally & in India on 2G/3G/4G/5G)
 */
async function queryArcGISNearby(
  lat: number,
  lon: number,
  category: string,
  maxRadiusMeters: number
): Promise<DiscoveredPlace[]> {
  try {
    const catKey = (category || 'all').toLowerCase();
    const arcCategory = ARCGIS_CATEGORY_MAP[catKey] || ARCGIS_CATEGORY_MAP.all;
    const searchDistance = Math.min(Math.max(maxRadiusMeters, 1000), 50000);

    const url = new URL(ARCGIS_GEOCODE_URL);
    url.searchParams.set('f', 'json');
    url.searchParams.set('category', arcCategory);
    url.searchParams.set('location', `${lon},${lat}`);
    url.searchParams.set('distance', String(searchDistance));
    url.searchParams.set('maxLocations', '35');
    url.searchParams.set('outFields', 'PlaceName,Place_addr,Type,City,Region,Country');

    const res = await fetchWithTimeout(
      url.toString(),
      { headers: { Accept: 'application/json' } },
      8000
    );
    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data?.candidates)) return [];

    const results: DiscoveredPlace[] = [];
    for (let i = 0; i < data.candidates.length; i++) {
      const c = data.candidates[i];
      const cLat = Number(c?.location?.y);
      const cLon = Number(c?.location?.x);
      if (!Number.isFinite(cLat) || !Number.isFinite(cLon)) continue;

      const dist = calculateDistanceMeters(lat, lon, cLat, cLon);
      if (dist > maxRadiusMeters) continue;

      const attrs = c.attributes || {};
      const name = String(attrs.PlaceName || c.address || '').trim();
      if (!name) continue;

      const addr = String(attrs.Place_addr || c.address || name).trim();
      const typeLabel = String(attrs.Type || catKey).trim();

      results.push({
        id: `arcgis-${i}-${cLat.toFixed(5)}-${cLon.toFixed(5)}`,
        name,
        display_name: addr.includes(name) ? addr : `${name}, ${addr}`,
        lat: cLat,
        lon: cLon,
        category: typeLabel,
        type: typeLabel.toLowerCase(),
        city: attrs.City || undefined,
        state: attrs.Region || undefined,
        country: attrs.Country || undefined,
        distanceMeters: dist,
      });
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * 2. Overpass API mirrors
 */
async function querySingleOverpassEndpoint(
  endpoint: string,
  query: string,
  category: string
): Promise<DiscoveredPlace[]> {
  const res = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: `data=${encodeURIComponent(query)}`,
    },
    9000
  );

  if (!res.ok) {
    throw new Error(`Overpass HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data?.elements) || data.elements.length === 0) {
    throw new Error('Empty Overpass response');
  }

  const parsed: DiscoveredPlace[] = [];
  data.elements.forEach((el: any, idx: number) => {
    const item = parseOverpassElement(el, idx, category);
    if (item) parsed.push(item);
  });

  if (parsed.length === 0) {
    throw new Error('No named Overpass elements');
  }

  return parsed;
}

async function queryOverpassMirrors(
  lat: number,
  lon: number,
  category: string,
  radiusMeters: number
): Promise<DiscoveredPlace[]> {
  const filters = buildOverpassCategoryFilters(category, lat, lon, radiusMeters);
  const query = `[out:json][timeout:10];(${filters});out center 80;`;

  try {
    return await Promise.any(
      OVERPASS_ENDPOINTS.map((endpoint) =>
        querySingleOverpassEndpoint(endpoint, query, category)
      )
    );
  } catch {
    return [];
  }
}

/**
 * 3. Photon Keyword Discovery (Capped at 2 requests to prevent HTTP 429 rate-limiting)
 */
async function queryPhotonNearby(
  lat: number,
  lon: number,
  category: string,
  maxRadiusMeters: number
): Promise<DiscoveredPlace[]> {
  const cat = (category || 'all').toLowerCase();
  const keywords = (CATEGORY_KEYWORDS[cat] || CATEGORY_KEYWORDS.all).slice(0, 2);

  const deltaDeg = Math.min(Math.max(maxRadiusMeters / 111000, 0.02), 0.35);
  const minLon = (lon - deltaDeg).toFixed(4);
  const minLat = (lat - deltaDeg).toFixed(4);
  const maxLon = (lon + deltaDeg).toFixed(4);
  const maxLat = (lat + deltaDeg).toFixed(4);
  const bboxStr = `${minLon},${minLat},${maxLon},${maxLat}`;

  const requests = keywords.map(async (kw) => {
    try {
      const photonUrl = new URL('https://photon.komoot.io/api/');
      photonUrl.searchParams.set('q', kw);
      photonUrl.searchParams.set('lat', String(lat));
      photonUrl.searchParams.set('lon', String(lon));
      photonUrl.searchParams.set('bbox', bboxStr);
      photonUrl.searchParams.set('limit', '20');

      const res = await fetchWithTimeout(
        photonUrl.toString(),
        { headers: { Accept: 'application/json' } },
        7500
      );
      if (!res.ok) return [];

      const data = await res.json();
      if (!Array.isArray(data?.features)) return [];

      return data.features
        .map((feat: any, idx: number): DiscoveredPlace | null => {
          const props = feat.properties || {};
          const coords = feat.geometry?.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) return null;

          const pLon = Number(coords[0]);
          const pLat = Number(coords[1]);
          if (isNaN(pLat) || isNaN(pLon)) return null;

          const dist = calculateDistanceMeters(lat, lon, pLat, pLon);
          if (dist > maxRadiusMeters) return null;

          const name =
            props.name ||
            [props.housenumber, props.street].filter(Boolean).join(' ') ||
            null;
          if (!name) return null;

          const fullAddress = [
            name,
            props.street,
            props.district || props.suburb || props.locality,
            props.city || props.town || props.village || props.county,
            props.state,
            props.country,
          ]
            .filter(Boolean)
            .join(', ');

          return {
            id: `photon-${kw}-${props.osm_id || idx}-${pLat.toFixed(5)}-${pLon.toFixed(5)}`,
            name: String(name).trim(),
            display_name: fullAddress || String(name),
            lat: pLat,
            lon: pLon,
            category: String(props.osm_value || props.osm_key || kw).replace(/_/g, ' '),
            type: String(props.osm_value || 'poi'),
            city: props.city || props.town || props.village,
            state: props.state,
            country: props.country,
            distanceMeters: dist,
          };
        })
        .filter(Boolean) as DiscoveredPlace[];
    } catch {
      return [];
    }
  });

  const batches = await Promise.all(requests);
  return batches.flat();
}

/**
 * 4. Nominatim Bounded Viewbox Search
 */
async function queryNominatimNearby(
  lat: number,
  lon: number,
  category: string,
  maxRadiusMeters: number
): Promise<DiscoveredPlace[]> {
  const cat = (category || 'all').toLowerCase();
  const primaryQuery = (CATEGORY_KEYWORDS[cat] || ['hospital'])[0];

  const deltaDeg = Math.min(Math.max(maxRadiusMeters / 111000, 0.02), 0.3);
  const viewbox = `${(lon - deltaDeg).toFixed(4)},${(lat + deltaDeg).toFixed(4)},${(lon + deltaDeg).toFixed(4)},${(lat - deltaDeg).toFixed(4)}`;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('q', primaryQuery);
    url.searchParams.set('viewbox', viewbox);
    url.searchParams.set('bounded', '1');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '25');

    const res = await fetchWithTimeout(
      url.toString(),
      {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
      },
      7500
    );
    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const items: DiscoveredPlace[] = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const pLat = Number(row.lat);
      const pLon = Number(row.lon);
      if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) continue;

      const dist = calculateDistanceMeters(lat, lon, pLat, pLon);
      if (dist > maxRadiusMeters) continue;

      const rawName =
        row.name ||
        (typeof row.display_name === 'string' ? row.display_name.split(',')[0] : '') ||
        primaryQuery;
      const addr = row.address || {};

      items.push({
        id: `nom-${row.place_id || i}-${pLat.toFixed(5)}-${pLon.toFixed(5)}`,
        name: String(rawName).trim(),
        display_name: String(row.display_name || rawName),
        lat: pLat,
        lon: pLon,
        category: String(row.type || row.category || cat).replace(/_/g, ' '),
        type: String(row.type || 'poi'),
        city: addr.city || addr.town || addr.village || addr.suburb,
        state: addr.state,
        country: addr.country,
        distanceMeters: dist,
      });
    }
    return items;
  } catch {
    return [];
  }
}

export function deduplicateAndSortPlaces(
  places: DiscoveredPlace[],
  userLat: number,
  userLon: number,
  maxRadiusMeters: number
): DiscoveredPlace[] {
  const seen = new Map<string, DiscoveredPlace>();

  for (const place of places) {
    if (!place || typeof place.lat !== 'number' || typeof place.lon !== 'number') continue;
    const dist =
      typeof place.distanceMeters === 'number'
        ? place.distanceMeters
        : calculateDistanceMeters(userLat, userLon, place.lat, place.lon);

    if (dist > maxRadiusMeters) continue;

    const normName = place.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const coordGrid = `${place.lat.toFixed(3)}_${place.lon.toFixed(3)}`;
    const dedupKey = normName ? `${normName}_${coordGrid}` : coordGrid;

    const existing = seen.get(dedupKey);
    if (!existing || place.display_name.length > existing.display_name.length) {
      seen.set(dedupKey, {
        ...place,
        distanceMeters: dist,
      });
    }
  }

  return Array.from(seen.values())
    .sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0))
    .slice(0, 60);
}

/**
 * Multi-source real nearby place discovery (ArcGIS + Overpass + Photon + Nominatim)
 */
export async function fetchRealNearbyPlaces(
  lat: number,
  lon: number,
  category = 'all',
  radiusMeters = 5000,
  forceRefresh = false
): Promise<DiscoveredPlace[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) {
    return [];
  }

  const cacheKey = getCacheKey(lat, lon, category, radiusMeters);
  if (!forceRefresh) {
    const cached = readCachedPlaces(cacheKey);
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  const [arcgisResults, overpassResults, photonResults, nominatimResults] = await Promise.all([
    queryArcGISNearby(lat, lon, category, radiusMeters),
    queryOverpassMirrors(lat, lon, category, radiusMeters),
    queryPhotonNearby(lat, lon, category, radiusMeters),
    queryNominatimNearby(lat, lon, category, radiusMeters),
  ]);

  let merged = deduplicateAndSortPlaces(
    [...arcgisResults, ...overpassResults, ...photonResults, ...nominatimResults],
    lat,
    lon,
    radiusMeters
  );

  // If a tight radius (e.g. 500m - 5km) yielded 0 results, automatically expand search radius up to 15km
  if (merged.length === 0 && radiusMeters < 15000) {
    const expandedRadius = Math.max(radiusMeters * 3, 15000);
    const [expArcgis, expOverpass, expPhoton] = await Promise.all([
      queryArcGISNearby(lat, lon, category, expandedRadius),
      queryOverpassMirrors(lat, lon, category, expandedRadius),
      queryPhotonNearby(lat, lon, category, expandedRadius),
    ]);
    merged = deduplicateAndSortPlaces(
      [...expArcgis, ...expOverpass, ...expPhoton],
      lat,
      lon,
      expandedRadius
    );
  }

  if (merged.length > 0) {
    writeCachedPlaces(cacheKey, merged);
  }

  return merged;
}

/**
 * Multi-source Real Keyword / City / Landmark / Business Search
 * Queries ArcGIS World Geocoder + Photon + Open-Meteo + Nominatim concurrently
 * so searching "Ballary", landmarks, streets, or businesses never fails even if one provider is blocked.
 */
export async function searchRealPlacesByQuery(
  queryText: string,
  userLat?: number,
  userLon?: number
): Promise<DiscoveredPlace[]> {
  const q = (queryText || '').trim();
  if (q.length < 2) return [];

  const hasCoords =
    typeof userLat === 'number' &&
    typeof userLon === 'number' &&
    Number.isFinite(userLat) &&
    Number.isFinite(userLon) &&
    !(userLat === 0 && userLon === 0);

  // 1. ArcGIS World Geocoding Search
  const arcgisPromise = (async (): Promise<DiscoveredPlace[]> => {
    try {
      const url = new URL(ARCGIS_GEOCODE_URL);
      url.searchParams.set('f', 'json');
      url.searchParams.set('singleLine', q);
      url.searchParams.set('maxLocations', '15');
      url.searchParams.set('outFields', 'PlaceName,Place_addr,Type,City,Region,Country');
      if (hasCoords) {
        url.searchParams.set('location', `${userLon},${userLat}`);
      }

      const res = await fetchWithTimeout(
        url.toString(),
        { headers: { Accept: 'application/json' } },
        7500
      );
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data?.candidates)) return [];

      return data.candidates
        .map((c: any, idx: number): DiscoveredPlace | null => {
          const cLat = Number(c?.location?.y);
          const cLon = Number(c?.location?.x);
          if (!Number.isFinite(cLat) || !Number.isFinite(cLon)) return null;
          const attrs = c.attributes || {};
          const name = String(attrs.PlaceName || c.address?.split(',')[0] || q).trim();
          const addr = String(attrs.Place_addr || c.address || name).trim();
          return {
            id: `search-arcgis-${idx}-${cLat.toFixed(4)}-${cLon.toFixed(4)}`,
            name,
            display_name: addr.includes(name) ? addr : `${name}, ${addr}`,
            lat: cLat,
            lon: cLon,
            category: String(attrs.Type || 'place'),
            type: String(attrs.Type || 'poi').toLowerCase(),
            city: attrs.City || undefined,
            state: attrs.Region || undefined,
            country: attrs.Country || undefined,
          };
        })
        .filter(Boolean) as DiscoveredPlace[];
    } catch {
      return [];
    }
  })();

  // 2. Photon Search
  const photonPromise = (async (): Promise<DiscoveredPlace[]> => {
    try {
      const photonUrl = new URL('https://photon.komoot.io/api/');
      photonUrl.searchParams.set('q', q);
      photonUrl.searchParams.set('limit', '15');
      if (hasCoords) {
        photonUrl.searchParams.set('lat', String(userLat));
        photonUrl.searchParams.set('lon', String(userLon));
      }

      const res = await fetchWithTimeout(
        photonUrl.toString(),
        { headers: { Accept: 'application/json' } },
        6500
      );
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data?.features)) return [];

      return data.features
        .map((feat: any, idx: number): DiscoveredPlace | null => {
          const props = feat.properties || {};
          const coords = feat.geometry?.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) return null;
          const pLon = Number(coords[0]);
          const pLat = Number(coords[1]);
          if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) return null;

          const name =
            props.name ||
            [props.housenumber, props.street].filter(Boolean).join(' ') ||
            props.city ||
            q;
          const fullAddress = [
            props.name,
            props.street,
            props.city || props.town || props.village,
            props.state,
            props.country,
          ]
            .filter(Boolean)
            .join(', ');

          return {
            id: `search-photon-${idx}-${pLat.toFixed(4)}-${pLon.toFixed(4)}`,
            name: String(name).trim(),
            display_name: fullAddress || String(name),
            lat: pLat,
            lon: pLon,
            category: String(props.osm_value || props.osm_key || 'place').replace(/_/g, ' '),
            type: String(props.osm_value || 'poi'),
            city: props.city || props.town || props.village,
            state: props.state,
            country: props.country,
          };
        })
        .filter(Boolean) as DiscoveredPlace[];
    } catch {
      return [];
    }
  })();

  // 3. Open-Meteo Global City/Place Geocoding Search
  const openMeteoPromise = (async (): Promise<DiscoveredPlace[]> => {
    try {
      const omUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
      omUrl.searchParams.set('name', q);
      omUrl.searchParams.set('count', '12');
      omUrl.searchParams.set('language', 'en');
      omUrl.searchParams.set('format', 'json');

      const res = await fetchWithTimeout(
        omUrl.toString(),
        { headers: { Accept: 'application/json' } },
        6500
      );
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data?.results)) return [];

      return data.results
        .map((r: any, idx: number): DiscoveredPlace | null => {
          const rLat = Number(r.latitude);
          const rLon = Number(r.longitude);
          if (!Number.isFinite(rLat) || !Number.isFinite(rLon)) return null;
          const fullAddr = [r.name, r.admin2, r.admin1, r.country].filter(Boolean).join(', ');
          return {
            id: `search-om-${r.id || idx}-${rLat.toFixed(4)}-${rLon.toFixed(4)}`,
            name: String(r.name || q).trim(),
            display_name: fullAddr || String(r.name || q),
            lat: rLat,
            lon: rLon,
            category: String(r.feature_code || 'Place'),
            type: 'place',
            city: r.admin2 || r.name,
            state: r.admin1,
            country: r.country,
          };
        })
        .filter(Boolean) as DiscoveredPlace[];
    } catch {
      return [];
    }
  })();

  // 4. Nominatim Search
  const nominatimPromise = (async (): Promise<DiscoveredPlace[]> => {
    try {
      const nomUrl = new URL('https://nominatim.openstreetmap.org/search');
      nomUrl.searchParams.set('format', 'jsonv2');
      nomUrl.searchParams.set('q', q);
      nomUrl.searchParams.set('addressdetails', '1');
      nomUrl.searchParams.set('limit', '12');

      const res = await fetchWithTimeout(
        nomUrl.toString(),
        { headers: { Accept: 'application/json', 'Accept-Language': 'en' } },
        6500
      );
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data
        .map((item: any, idx: number): DiscoveredPlace | null => {
          const nLat = Number(item.lat);
          const nLon = Number(item.lon);
          if (!Number.isFinite(nLat) || !Number.isFinite(nLon)) return null;
          const addr = item.address || {};
          const rawName =
            item.name ||
            (typeof item.display_name === 'string' ? item.display_name.split(',')[0] : '') ||
            q;
          return {
            id: `search-nom-${item.place_id || idx}-${nLat.toFixed(4)}-${nLon.toFixed(4)}`,
            name: String(rawName).trim(),
            display_name: String(item.display_name || rawName),
            lat: nLat,
            lon: nLon,
            category: String(item.type || item.category || 'place').replace(/_/g, ' '),
            type: String(item.type || 'poi'),
            city: addr.city || addr.town || addr.village,
            state: addr.state,
            country: addr.country,
          };
        })
        .filter(Boolean) as DiscoveredPlace[];
    } catch {
      return [];
    }
  })();

  const [arcgisRes, photonRes, omRes, nomRes] = await Promise.all([
    arcgisPromise,
    photonPromise,
    openMeteoPromise,
    nominatimPromise,
  ]);

  const combined = [...arcgisRes, ...photonRes, ...omRes, ...nomRes];
  const seen = new Map<string, DiscoveredPlace>();

  for (const item of combined) {
    const dist = hasCoords
      ? calculateDistanceMeters(userLat!, userLon!, item.lat, item.lon)
      : undefined;
    const key = `${item.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${item.lat.toFixed(2)}_${item.lon.toFixed(2)}`;
    const existing = seen.get(key);
    if (!existing || item.display_name.length > existing.display_name.length) {
      seen.set(key, {
        ...item,
        distanceMeters: dist,
      });
    }
  }

  return Array.from(seen.values()).slice(0, 35);
}

/**
 * Generates a universal Google Maps turn-by-turn navigation URL
 */
export function getNativeNavigationUrl(
  destLat: number,
  destLon: number,
  originLat?: number | null,
  originLon?: number | null
): string {
  const dest = `${destLat},${destLon}`;
  if (
    typeof originLat === 'number' &&
    typeof originLon === 'number' &&
    Number.isFinite(originLat) &&
    Number.isFinite(originLon) &&
    !(originLat === 0 && originLon === 0)
  ) {
    return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLon}&destination=${dest}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}

export interface EmergencySharePayload {
  token: string;
  trackingUrl: string;
  googleMapsUrl: string;
  expiresAt: string;
  shareMessage: string;
  smsHref: string;
  whatsappHref: string;
}

/**
 * Generates a temporary encrypted/tokenized real-time responder tracking URL and SMS/WhatsApp payloads
 */
export function createEmergencySharePayload(
  alert: {
    id: string;
    senderName: string;
    latitude: number;
    longitude: number;
    message?: string;
  },
  customToken?: string,
  customExpiresAt?: string
): EmergencySharePayload {
  const token =
    customToken ||
    `sos_${alert.id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const expiresAt =
    customExpiresAt || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  const baseOrigin =
    typeof window !== 'undefined' &&
    window.location.origin &&
    !window.location.origin.includes('localhost') &&
    !window.location.origin.startsWith('capacitor:') &&
    !window.location.origin.startsWith('file:')
      ? window.location.origin
      : 'https://ais-pre-dkfhfrzboel3a3xnlpek5a-752786783113.asia-northeast1.run.app';

  const params = new URLSearchParams({
    sos_track: token,
    alertId: alert.id,
    lat: String(alert.latitude),
    lng: String(alert.longitude),
    sender: alert.senderName || 'Beacon User',
  });
  if (alert.message) {
    params.set('msg', alert.message);
  }

  const trackingUrl = `${baseOrigin}/?${params.toString()}`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${alert.latitude},${alert.longitude}`;

  const shareMessage =
    `🚨 EMERGENCY SOS LIVE TRACKING (${alert.senderName})\n` +
    `${alert.message ? `Message: "${alert.message}"\n` : ''}` +
    `Coordinates: ${alert.latitude.toFixed(5)}, ${alert.longitude.toFixed(5)}\n` +
    `Live Responder Tracking Link (Valid 2h): ${trackingUrl}\n` +
    `Google Maps Pin: ${googleMapsUrl}`;

  const encodedMsg = encodeURIComponent(shareMessage);
  return {
    token,
    trackingUrl,
    googleMapsUrl,
    expiresAt,
    shareMessage,
    smsHref: `sms:?body=${encodedMsg}`,
    whatsappHref: `https://wa.me/?text=${encodedMsg}`,
  };
}

