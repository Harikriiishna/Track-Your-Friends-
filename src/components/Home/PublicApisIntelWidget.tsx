import React, { useState, useEffect, useCallback } from 'react';
import {
  CloudSun,
  Wind,
  Droplets,
  Mountain,
  Sunrise,
  Sunset,
  Activity,
  RefreshCw,
  Globe,
  MapPin,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  fetchPublicLocationIntelligence,
  fetchPublicIpGeolocation,
  INTEGRATED_PUBLIC_APIS,
  type PublicLocationIntelligence,
} from '../../utils/publicApis.ts';

interface PublicApisIntelWidgetProps {
  latitude?: number | null;
  longitude?: number | null;
  isDark?: boolean;
  onFocusMapLocation?: (lat: number, lng: number) => void;
}

export const PublicApisIntelWidget: React.FC<PublicApisIntelWidgetProps> = ({
  latitude,
  longitude,
  isDark = true,
  onFocusMapLocation,
}) => {
  const [intel, setIntel] = useState<PublicLocationIntelligence | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showApiCatalog, setShowApiCatalog] = useState<boolean>(false);

  const loadIntel = useCallback(
    async (force = false) => {
      setIsLoading(true);
      try {
        let targetLat =
          typeof latitude === 'number' && Number.isFinite(latitude) && latitude !== 0
            ? latitude
            : null;
        let targetLng =
          typeof longitude === 'number' && Number.isFinite(longitude) && longitude !== 0
            ? longitude
            : null;

        if (targetLat == null || targetLng == null) {
          const ipGeo = await fetchPublicIpGeolocation();
          if (ipGeo) {
            targetLat = ipGeo.latitude;
            targetLng = ipGeo.longitude;
          } else {
            targetLat = 12.9716;
            targetLng = 77.5946;
          }
        }

        const result = await fetchPublicLocationIntelligence(targetLat, targetLng, force);
        setIntel(result);
      } finally {
        setIsLoading(false);
      }
    },
    [latitude, longitude]
  );

  useEffect(() => {
    void loadIntel(false);
  }, [loadIntel]);

  return (
    <section
      className={`rounded-[32px] border p-5 sm:p-6 transition-all ${
        isDark
          ? 'bg-gradient-to-br from-[#161130] via-[#120E29] to-[#1D153E] border-[#8957FF]/35 shadow-xl'
          : 'bg-gradient-to-br from-white via-[#F8F6FF] to-[#EEF8FF] border-[#8957FF]/25 shadow-sm'
      }`}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#00D6A0] via-[#00D9FF] to-[#397BFF] flex items-center justify-center text-slate-950 shadow-lg shrink-0">
            <CloudSun className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight truncate">
                Live Telemetry &amp; Environment
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-[#00D6A0]/15 border border-[#00D6A0]/35 text-[#00D6A0] text-[10px] font-black uppercase tracking-wider">
                Public APIs Live
              </span>
            </div>
            <p className={`text-xs truncate ${isDark ? 'text-[#A9A2D0]' : 'text-slate-600'}`}>
              {intel
                ? `${intel.locality}${intel.region ? `, ${intel.region}` : ''}${
                    intel.countryCode ? ` (${intel.countryCode})` : ''
                  }`
                : 'Fetching live weather, AQI, elevation & solar telemetry...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void loadIntel(true)}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
              isDark
                ? 'bg-[#1B153A] border-white/15 text-[#E9DFFF] hover:bg-white/10'
                : 'bg-[#F3EEFF] border-[#8957FF]/25 text-[#8957FF] hover:bg-[#8957FF]/15'
            }`}
            title="Refresh live Public APIs telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#00D9FF]' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowApiCatalog((v) => !v)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#8957FF]/20 to-[#00D9FF]/20 border border-[#00D9FF]/35 text-[#00D9FF] text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{INTEGRATED_PUBLIC_APIS.length} APIs</span>
            {showApiCatalog ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* 4-Card Live Telemetry Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Open-Meteo Weather */}
        <div
          className={`rounded-2xl border p-3.5 flex flex-col justify-between ${
            isDark ? 'bg-[#1B153A]/90 border-white/10' : 'bg-white border-[#8957FF]/15'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-[#00D9FF]">
            <span>Weather</span>
            <CloudSun className="w-4 h-4" />
          </div>
          <div className="my-1.5">
            <span className="text-xl sm:text-2xl font-black">
              {intel?.weather ? `${intel.weather.temperatureC}°C` : '—'}
            </span>
            <span className="block text-[11px] font-bold text-[#00D6A0] truncate">
              {intel?.weather?.conditionLabel || 'Acquiring...'}
            </span>
          </div>
          <div
            className={`text-[10px] flex items-center justify-between pt-1.5 border-t ${
              isDark ? 'border-white/10 text-[#A9A2D0]' : 'border-slate-100 text-slate-500'
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <Wind className="w-3 h-3" />
              {intel?.weather ? `${intel.weather.windSpeedKmh} km/h` : '—'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Droplets className="w-3 h-3" />
              {intel?.weather ? `${intel.weather.humidityPercent}%` : '—'}
            </span>
          </div>
        </div>

        {/* Card 2: Open-Meteo Air Quality */}
        <div
          className={`rounded-2xl border p-3.5 flex flex-col justify-between ${
            isDark ? 'bg-[#1B153A]/90 border-white/10' : 'bg-white border-[#8957FF]/15'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-[#00D6A0]">
            <span>Air Quality (AQI)</span>
            <Activity className="w-4 h-4" />
          </div>
          <div className="my-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black">
                {intel?.airQuality ? intel.airQuality.usAqi : '—'}
              </span>
              {intel?.airQuality && (
                <span
                  className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${intel.airQuality.colorHex}25`,
                    color: intel.airQuality.colorHex,
                  }}
                >
                  {intel.airQuality.category}
                </span>
              )}
            </div>
            <span
              className={`block text-[11px] font-semibold ${
                isDark ? 'text-[#A9A2D0]' : 'text-slate-500'
              }`}
            >
              US AQI Index
            </span>
          </div>
          <div
            className={`text-[10px] flex items-center justify-between pt-1.5 border-t ${
              isDark ? 'border-white/10 text-[#A9A2D0]' : 'border-slate-100 text-slate-500'
            }`}
          >
            <span>PM2.5: {intel?.airQuality ? `${intel.airQuality.pm25} µg` : '—'}</span>
            <span>PM10: {intel?.airQuality ? `${intel.airQuality.pm10} µg` : '—'}</span>
          </div>
        </div>

        {/* Card 3: Open-Meteo Terrain Elevation & UV */}
        <div
          className={`rounded-2xl border p-3.5 flex flex-col justify-between ${
            isDark ? 'bg-[#1B153A]/90 border-white/10' : 'bg-white border-[#8957FF]/15'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-[#8957FF]">
            <span>Terrain &amp; UV</span>
            <Mountain className="w-4 h-4" />
          </div>
          <div className="my-1.5">
            <span className="text-xl sm:text-2xl font-black">
              {intel?.elevationMeters != null ? `${intel.elevationMeters} m` : '—'}
            </span>
            <span
              className={`block text-[11px] font-semibold ${
                isDark ? 'text-[#A9A2D0]' : 'text-slate-500'
              }`}
            >
              Elevation ASL
            </span>
          </div>
          <div
            className={`text-[10px] flex items-center justify-between pt-1.5 border-t ${
              isDark ? 'border-white/10 text-[#A9A2D0]' : 'border-slate-100 text-slate-500'
            }`}
          >
            <span>UV Index: {intel?.weather ? intel.weather.uvIndex : '—'}</span>
            <span>
              Rain: {intel?.weather ? `${intel.weather.precipitationProbPercent}%` : '—'}
            </span>
          </div>
        </div>

        {/* Card 4: Sunrise-Sunset & USGS Seismic Safety */}
        <div
          className={`rounded-2xl border p-3.5 flex flex-col justify-between ${
            isDark ? 'bg-[#1B153A]/90 border-white/10' : 'bg-white border-[#8957FF]/15'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-[#FFB547]">
            <span>Solar &amp; Seismic</span>
            <Sunrise className="w-4 h-4" />
          </div>
          <div className="my-1.5 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 font-bold">
                <Sunrise className="w-3.5 h-3.5 text-amber-400" />
                {intel?.solar?.sunrise || '—'}
              </span>
              <span className="inline-flex items-center gap-1 font-bold">
                <Sunset className="w-3.5 h-3.5 text-rose-400" />
                {intel?.solar?.sunset || '—'}
              </span>
            </div>
            <span className="block text-[11px] font-bold text-[#00D6A0]">
              {intel?.recentEarthquakes && intel.recentEarthquakes.length > 0
                ? `${intel.recentEarthquakes.length} seismic event(s) (500km)`
                : 'No recent seismic hazards'}
            </span>
          </div>
          <div
            className={`text-[10px] flex items-center justify-between pt-1.5 border-t ${
              isDark ? 'border-white/10 text-[#A9A2D0]' : 'border-slate-100 text-slate-500'
            }`}
          >
            <span>Daylight: {intel?.solar?.dayLength || '—'}</span>
            {intel && onFocusMapLocation && (
              <button
                type="button"
                onClick={() => onFocusMapLocation(intel.latitude, intel.longitude)}
                className="text-[#00D9FF] font-extrabold inline-flex items-center gap-0.5 cursor-pointer hover:underline"
              >
                <MapPin className="w-3 h-3" />
                <span>Map</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible Connected Public APIs Directory */}
      {showApiCatalog && (
        <div
          className={`mt-4 pt-4 border-t space-y-2.5 ${
            isDark ? 'border-white/10' : 'border-[#8957FF]/15'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold flex items-center gap-1.5 text-[#00D9FF]">
              <Sparkles className="w-3.5 h-3.5 text-[#FF4FA3]" />
              Connected Public APIs (from github.com/public-apis/public-apis)
            </span>
            <span className="text-[10px] font-bold text-[#00D6A0] inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Zero API Keys · HTTPS · CORS Enabled
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {INTEGRATED_PUBLIC_APIS.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-2xl border flex items-start justify-between gap-2 ${
                  isDark ? 'bg-[#120E29] border-white/10' : 'bg-white border-slate-200'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#00D6A0] shrink-0" />
                    <span className="text-xs font-extrabold truncate">{item.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#8957FF]/20 text-[#8957FF] text-[9px] font-black">
                      {item.category}
                    </span>
                  </div>
                  <p
                    className={`text-[11px] mt-1 line-clamp-2 ${
                      isDark ? 'text-[#A9A2D0]' : 'text-slate-600'
                    }`}
                  >
                    {item.description}
                  </p>
                </div>
                <a
                  href={item.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-[#00D9FF] shrink-0"
                  title={`Open ${item.name} documentation`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
