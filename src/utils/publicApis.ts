/**
 * Zero-Auth Public APIs Integration (curated from https://github.com/public-apis/public-apis)
 *
 * All endpoints below are:
 * - Auth: No (Zero API keys required)
 * - HTTPS: Yes
 * - CORS: Yes
 *
 * Integrated APIs:
 * 1. Open-Meteo Weather Forecast API (`https://api.open-meteo.com/v1/forecast`)
 * 2. Open-Meteo Air Quality API (`https://air-quality-api.open-meteo.com/v1/air-quality`)
 * 3. Open-Meteo Terrain Elevation API (`https://api.open-meteo.com/v1/elevation`)
 * 4. Sunrise-Sunset Solar API (`https://api.sunrise-sunset.org/json`)
 * 5. USGS Earthquake Hazards API (`https://earthquake.usgs.gov/fdsnws/event/1/query`)
 * 6. BigDataCloud Client Reverse Geocode API (`https://api.bigdatacloud.net/data/reverse-geocode-client`)
 * 7. GeoJS IP Geolocation API (`https://get.geojs.io/v1/ip/geo.json`)
 */

export interface PublicWeatherIntel {
  temperatureC: number;
  feelsLikeC: number;
  humidityPercent: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  uvIndex: number;
  precipitationProbPercent: number;
  weatherCode: number;
  conditionLabel: string;
  isDay: boolean;
}

export interface PublicAirQualityIntel {
  usAqi: number;
  europeanAqi: number;
  pm25: number;
  pm10: number;
  category: 'Good' | 'Moderate' | 'Sensitive' | 'Unhealthy' | 'Hazardous';
  colorHex: string;
}

export interface PublicSolarIntel {
  sunrise: string;
  sunset: string;
  dayLength: string;
}

export interface PublicSeismicAlert {
  id: string;
  magnitude: number;
  place: string;
  timeIso: string;
  depthKm: number;
  latitude: number;
  longitude: number;
}

export interface PublicLocationIntelligence {
  latitude: number;
  longitude: number;
  locality: string;
  region: string;
  countryName: string;
  countryCode: string;
  elevationMeters: number | null;
  weather: PublicWeatherIntel | null;
  airQuality: PublicAirQualityIntel | null;
  solar: PublicSolarIntel | null;
  recentEarthquakes: PublicSeismicAlert[];
  fetchedAt: string;
}

export interface PublicApiCatalogEntry {
  id: string;
  name: string;
  category: 'Weather' | 'Environment' | 'Geocoding' | 'Earth & Safety' | 'Routing & Maps';
  endpoint: string;
  docsUrl: string;
  description: string;
}

export const INTEGRATED_PUBLIC_APIS: PublicApiCatalogEntry[] = [
  {
    id: 'open-meteo-weather',
    name: 'Open-Meteo Weather Forecast',
    category: 'Weather',
    endpoint: 'https://api.open-meteo.com/v1/forecast',
    docsUrl: 'https://open-meteo.com/',
    description: 'Real-time temperature, feels-like, wind speed, humidity, UV index & WMO conditions.',
  },
  {
    id: 'open-meteo-aqi',
    name: 'Open-Meteo Air Quality',
    category: 'Environment',
    endpoint: 'https://air-quality-api.open-meteo.com/v1/air-quality',
    docsUrl: 'https://open-meteo.com/en/docs/air-quality-api',
    description: 'Live US AQI, European AQI, PM2.5 and PM10 particulate telemetry.',
  },
  {
    id: 'open-meteo-elevation',
    name: 'Open-Meteo Digital Elevation Model',
    category: 'Earth & Safety',
    endpoint: 'https://api.open-meteo.com/v1/elevation',
    docsUrl: 'https://open-meteo.com/en/docs/elevation-api',
    description: '90m global SRTM terrain elevation above sea level at any GPS coordinate.',
  },
  {
    id: 'sunrise-sunset',
    name: 'Sunrise-Sunset Solar Times',
    category: 'Weather',
    endpoint: 'https://api.sunrise-sunset.org/json',
    docsUrl: 'https://sunrise-sunset.org/api',
    description: 'Exact local sunrise, sunset, civil twilight & daylight duration.',
  },
  {
    id: 'usgs-earthquakes',
    name: 'USGS Earthquake Hazards Program',
    category: 'Earth & Safety',
    endpoint: 'https://earthquake.usgs.gov/fdsnws/event/1/query',
    docsUrl: 'https://earthquake.usgs.gov/fdsnws/event/1/',
    description: 'Real-time nearby seismic activity and magnitude monitoring within 500 km.',
  },
  {
    id: 'bigdatacloud-geocode',
    name: 'BigDataCloud Reverse Geocoding',
    category: 'Geocoding',
    endpoint: 'https://api.bigdatacloud.net/data/reverse-geocode-client',
    docsUrl: 'https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api',
    description: 'Instant zero-key city, locality, state, and country lookup from coordinates.',
  },
  {
    id: 'nominatim-osm',
    name: 'OpenStreetMap Nominatim Geocoder',
    category: 'Geocoding',
    endpoint: 'https://nominatim.openstreetmap.org/search',
    docsUrl: 'https://nominatim.org/release-docs/latest/api/Overview/',
    description: 'Global street-address search and reverse geocoding.',
  },
  {
    id: 'project-osrm',
    name: 'Project OSRM Routing Engine',
    category: 'Routing & Maps',
    endpoint: 'https://router.project-osrm.org/route/v1',
    docsUrl: 'http://project-osrm.org/',
    description: 'Turn-by-turn road, walking, and cycling route geometry & ETA calculation.',
  },
];

const intelCache = new Map<string, { data: PublicLocationIntelligence; expiresAt: number }>();

export function describeWmoWeatherCode(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code === 1) return 'Mainly Clear';
  if (code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Light Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snowfall';
  if (code >= 80 && code <= 82) return 'Rain Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Fair';
}

export function classifyUsAqi(aqi: number): {
  category: PublicAirQualityIntel['category'];
  colorHex: string;
} {
  if (aqi <= 50) return { category: 'Good', colorHex: '#00D6A0' };
  if (aqi <= 100) return { category: 'Moderate', colorHex: '#FFD166' };
  if (aqi <= 150) return { category: 'Sensitive', colorHex: '#FF9B54' };
  if (aqi <= 200) return { category: 'Unhealthy', colorHex: '#FF4FA3' };
  return { category: 'Hazardous', colorHex: '#FF3B6B' };
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 4500): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches live Weather, Air Quality, Elevation, Sunrise/Sunset, Reverse Geocode,
 * and USGS Seismic activity for a given (lat, lng) coordinate using zero-key public APIs.
 */
export async function fetchPublicLocationIntelligence(
  lat: number,
  lng: number,
  forceRefresh = false
): Promise<PublicLocationIntelligence> {
  const roundedLat = Number(lat.toFixed(3));
  const roundedLng = Number(lng.toFixed(3));
  const cacheKey = `${roundedLat},${roundedLng}`;
  const now = Date.now();

  if (!forceRefresh) {
    const cached = intelCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
  }

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${roundedLat}&longitude=${roundedLng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m&hourly=uv_index,precipitation_probability&forecast_days=1&timezone=auto`;
  const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${roundedLat}&longitude=${roundedLng}&current=us_aqi,european_aqi,pm10,pm2_5`;
  const elevationUrl = `https://api.open-meteo.com/v1/elevation?latitude=${roundedLat}&longitude=${roundedLng}`;
  const solarUrl = `https://api.sunrise-sunset.org/json?lat=${roundedLat}&lng=${roundedLng}&formatted=0`;
  const geocodeUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${roundedLat}&longitude=${roundedLng}&localityLanguage=en`;
  const sinceIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const usgsUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${roundedLat}&longitude=${roundedLng}&maxradiuskm=500&starttime=${encodeURIComponent(
    sinceIso
  )}&minmagnitude=2.5&limit=5`;

  const [weatherRaw, aqiRaw, elevRaw, solarRaw, geoRaw, usgsRaw] = await Promise.all([
    fetchJsonWithTimeout<any>(weatherUrl),
    fetchJsonWithTimeout<any>(aqiUrl),
    fetchJsonWithTimeout<any>(elevationUrl),
    fetchJsonWithTimeout<any>(solarUrl),
    fetchJsonWithTimeout<any>(geocodeUrl),
    fetchJsonWithTimeout<any>(usgsUrl),
  ]);

  let weather: PublicWeatherIntel | null = null;
  if (weatherRaw?.current) {
    const c = weatherRaw.current;
    const code = Number(c.weather_code ?? 0);
    const uvArr = weatherRaw?.hourly?.uv_index;
    const precipArr = weatherRaw?.hourly?.precipitation_probability;
    const hourIdx = new Date().getHours();
    weather = {
      temperatureC: Math.round(Number(c.temperature_2m ?? 0) * 10) / 10,
      feelsLikeC: Math.round(Number(c.apparent_temperature ?? c.temperature_2m ?? 0) * 10) / 10,
      humidityPercent: Math.round(Number(c.relative_humidity_2m ?? 0)),
      windSpeedKmh: Math.round(Number(c.wind_speed_10m ?? 0) * 10) / 10,
      windDirectionDeg: Math.round(Number(c.wind_direction_10m ?? 0)),
      uvIndex: Array.isArray(uvArr) ? Math.round(Number(uvArr[hourIdx] ?? 0) * 10) / 10 : 0,
      precipitationProbPercent: Array.isArray(precipArr)
        ? Math.round(Number(precipArr[hourIdx] ?? 0))
        : 0,
      weatherCode: code,
      conditionLabel: describeWmoWeatherCode(code),
      isDay: Boolean(c.is_day ?? 1),
    };
  }

  let airQuality: PublicAirQualityIntel | null = null;
  if (aqiRaw?.current) {
    const ac = aqiRaw.current;
    const usAqi = Math.round(Number(ac.us_aqi ?? 0));
    const classified = classifyUsAqi(usAqi);
    airQuality = {
      usAqi,
      europeanAqi: Math.round(Number(ac.european_aqi ?? 0)),
      pm25: Math.round(Number(ac.pm2_5 ?? 0) * 10) / 10,
      pm10: Math.round(Number(ac.pm10 ?? 0) * 10) / 10,
      category: classified.category,
      colorHex: classified.colorHex,
    };
  }

  let elevationMeters: number | null = null;
  if (Array.isArray(elevRaw?.elevation) && typeof elevRaw.elevation[0] === 'number') {
    elevationMeters = Math.round(elevRaw.elevation[0]);
  }

  let solar: PublicSolarIntel | null = null;
  if (solarRaw?.results) {
    const r = solarRaw.results;
    const fmtTime = (iso: string) => {
      try {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch {
        return iso;
      }
    };
    const sec = Number(r.day_length ?? 0);
    const hrs = Math.floor(sec / 3600);
    const mins = Math.round((sec % 3600) / 60);
    solar = {
      sunrise: fmtTime(r.sunrise),
      sunset: fmtTime(r.sunset),
      dayLength: sec > 0 ? `${hrs}h ${mins}m` : '12h 0m',
    };
  }

  const recentEarthquakes: PublicSeismicAlert[] = [];
  if (Array.isArray(usgsRaw?.features)) {
    for (const feat of usgsRaw.features.slice(0, 5)) {
      const props = feat?.properties;
      const coords = feat?.geometry?.coordinates;
      if (props && Array.isArray(coords) && coords.length >= 2) {
        recentEarthquakes.push({
          id: String(feat.id || Math.random()),
          magnitude: Math.round(Number(props.mag ?? 0) * 10) / 10,
          place: String(props.place || 'Nearby region'),
          timeIso: new Date(Number(props.time || Date.now())).toISOString(),
          depthKm: Math.round(Number(coords[2] ?? 10) * 10) / 10,
          longitude: Number(coords[0]),
          latitude: Number(coords[1]),
        });
      }
    }
  }

  const intel: PublicLocationIntelligence = {
    latitude: roundedLat,
    longitude: roundedLng,
    locality:
      geoRaw?.city ||
      geoRaw?.locality ||
      geoRaw?.principalSubdivision ||
      `${roundedLat.toFixed(3)}°, ${roundedLng.toFixed(3)}°`,
    region: geoRaw?.principalSubdivision || '',
    countryName: geoRaw?.countryName || '',
    countryCode: geoRaw?.countryCode || '',
    elevationMeters,
    weather,
    airQuality,
    solar,
    recentEarthquakes,
    fetchedAt: new Date().toISOString(),
  };

  intelCache.set(cacheKey, { data: intel, expiresAt: now + 5 * 60 * 1000 });
  return intel;
}

/**
 * Zero-key IP Geolocation fallback from `public-apis` (GeoJS) when GPS is unavailable.
 */
export async function fetchPublicIpGeolocation(): Promise<{
  latitude: number;
  longitude: number;
  city: string;
  country: string;
} | null> {
  const data = await fetchJsonWithTimeout<any>('https://get.geojs.io/v1/ip/geo.json', 3500);
  if (!data) return null;
  const lat = parseFloat(data.latitude);
  const lng = parseFloat(data.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    latitude: lat,
    longitude: lng,
    city: String(data.city || ''),
    country: String(data.country || ''),
  };
}
