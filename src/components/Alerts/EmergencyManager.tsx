import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { useAuth } from '../../context/AuthContext.tsx';
import { useRealtime } from '../../context/RealtimeContext.tsx';
import { formatAccuracy, formatTimeAgo, calculateDistanceMeters, formatDistance } from '../../utils/geo.ts';
import { getNativeNavigationUrl, createEmergencySharePayload, EmergencySharePayload } from '../../utils/nearbyPlaces.ts';
import { api } from '../../utils/api.ts';
import { useToast } from '../../context/ToastContext.tsx';
import { triggerHaptic } from '../../utils/audio.ts';
import type { EmergencyAlert } from '../../types.ts';
import {
  AlertTriangle,
  Siren,
  Phone,
  CheckCircle,
  MapPin,
  Clock,
  ShieldAlert,
  MessageSquare,
  VolumeX,
  Trash2,
  Copy,
  Check,
  Navigation,
  Crosshair,
  Maximize2,
  Share2,
  Send,
  Lock,
  ExternalLink,
  RefreshCw,
  Users,
  Download,
} from 'lucide-react';

export interface EmergencyLocationMapProps {
  latitude: number;
  longitude: number;
  accuracy: number;
  senderName: string;
  message?: string;
  timestamp?: string;
  viewerLocation?: { latitude: number; longitude: number } | null;
  onOpenFullMap?: (lat: number, lng: number) => void;
  heightClass?: string;
}

export const EmergencyLocationMap: React.FC<EmergencyLocationMapProps> = ({
  latitude,
  longitude,
  accuracy,
  senderName,
  message,
  viewerLocation,
  onOpenFullMap,
  heightClass = 'h-56',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [copied, setCopied] = useState(false);
  const [tileMode, setTileMode] = useState<'hybrid' | 'street'>('hybrid');
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const hasValidCoords =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0);

  const distanceMeters =
    hasValidCoords &&
    viewerLocation &&
    Number.isFinite(viewerLocation.latitude) &&
    Number.isFinite(viewerLocation.longitude)
      ? calculateDistanceMeters(
          viewerLocation.latitude,
          viewerLocation.longitude,
          latitude,
          longitude
        )
      : null;

  useEffect(() => {
    if (!hasValidCoords || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: 17,
      zoomControl: false,
      attributionControl: false,
    });

    const tileUrl =
      tileMode === 'hybrid'
        ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      maxZoom: 20,
    }).addTo(map);

    if (Number.isFinite(accuracy) && accuracy > 0) {
      L.circle([latitude, longitude], {
        radius: accuracy,
        color: '#e11d48',
        weight: 2,
        fillColor: '#f43f5e',
        fillOpacity: 0.18,
      }).addTo(map);
    }

    const sosIcon = L.divIcon({
      className: 'emergency-sos-pin',
      html: `
        <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;inset:0;border-radius:9999px;background:rgba(225,29,72,0.45);animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="position:relative;width:32px;height:32px;border-radius:9999px;background:#e11d48;border:3px solid #ffffff;box-shadow:0 4px 14px rgba(225,29,72,0.65);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:900;font-size:10px;letter-spacing:0.04em;">
            SOS
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    const marker = L.marker([latitude, longitude], { icon: sosIcon }).addTo(map);
    marker.bindPopup(
      `<div style="font-family:system-ui,sans-serif;min-width:170px;">
        <div style="font-weight:800;color:#be123c;font-size:12px;">SOS: ${senderName}</div>
        ${message ? `<div style="font-size:11px;color:#1e293b;margin-top:2px;">"${message}"</div>` : ''}
        <div style="font-family:monospace;font-size:11px;color:#0f172a;margin-top:4px;font-weight:700;">
          ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
        </div>
        <div style="font-size:10px;color:#64748b;margin-top:2px;">
          ${formatAccuracy(accuracy)}
        </div>
      </div>`
    );

    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [latitude, longitude, accuracy, senderName, message, hasValidCoords, tileMode]);

  const handleCopyCoords = () => {
    if (!hasValidCoords) return;
    const text = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!hasValidCoords) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-center gap-2.5">
        <Crosshair className="w-4 h-4 text-amber-600 shrink-0 animate-spin" />
        <span>Waiting for location — no valid GPS coordinates received yet.</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border-2 border-rose-200 bg-slate-900 shadow-md">
      {/* Embedded Interactive Map */}
      <div className={`relative w-full ${heightClass}`}>
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Top-left Live Coordinates Overlay Badge */}
        <div className="absolute top-2.5 left-2.5 z-[400] bg-slate-950/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-rose-500/40 shadow-lg flex flex-col gap-0.5 pointer-events-auto">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>Emergency GPS Pin</span>
            <span className="text-slate-300 font-semibold">· {formatAccuracy(accuracy)}</span>
          </div>
          <div className="font-mono text-xs font-bold text-white tracking-tight">
            LAT {latitude.toFixed(6)}° · LNG {longitude.toFixed(6)}°
          </div>
        </div>

        {/* Top-right Map Controls */}
        <div className="absolute top-2.5 right-2.5 z-[400] flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={() => setTileMode((prev) => (prev === 'hybrid' ? 'street' : 'hybrid'))}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-white text-[11px] font-bold border border-white/15 shadow cursor-pointer"
          >
            {tileMode === 'hybrid' ? 'Street' : 'Satellite'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.setView([latitude, longitude], 17, { animate: true });
              }
            }}
            className="p-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-white border border-white/15 shadow cursor-pointer"
            title="Recenter on SOS pin"
          >
            <Crosshair className="w-3.5 h-3.5 text-rose-400" />
          </button>
        </div>

        {/* Bottom-left Distance Badge if viewer has GPS */}
        {distanceMeters !== null && distanceMeters > 2 && (
          <div className="absolute bottom-2.5 left-2.5 z-[400] bg-rose-600/95 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold shadow flex items-center gap-1">
            <Navigation className="w-3 h-3" />
            <span>{formatDistance(distanceMeters)} from your location</span>
          </div>
        )}
      </div>

      {/* Coordinate & Quick Actions Bar */}
      <div className="bg-slate-950 text-white px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
        <div className="flex items-center gap-2 text-xs">
          <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
          <span className="font-mono font-bold text-rose-100">
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            ({formatAccuracy(accuracy)})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyCoords}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-300" />
                <span>Copy Coords</span>
              </>
            )}
          </button>

          <a
            href={getNativeNavigationUrl(
              latitude,
              longitude,
              viewerLocation?.latitude,
              viewerLocation?.longitude
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Navigation className="w-3 h-3 fill-current" />
            <span>Get Directions</span>
          </a>

          {onOpenFullMap && (
            <button
              type="button"
              onClick={() => onOpenFullMap(latitude, longitude)}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Full Map</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export interface EmergencySharePanelProps {
  alert: EmergencyAlert;
  onClose?: () => void;
  compact?: boolean;
}

export const EmergencySharePanel: React.FC<EmergencySharePanelProps> = ({
  alert,
  onClose,
  compact = false,
}) => {
  const toast = useToast();
  const [shareData, setShareData] = useState<EmergencySharePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    let mounted = true;
    const generateShare = async () => {
      setLoading(true);
      try {
        const res = await api.post<{ token?: string; expiresAt?: string }>(
          `/api/alerts/emergency/${alert.id}/share`
        );
        if (!mounted) return;
        const payload = createEmergencySharePayload(alert, res.token, res.expiresAt);
        setShareData(payload);
      } catch {
        if (!mounted) return;
        const fallback = createEmergencySharePayload(alert);
        setShareData(fallback);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    generateShare();
    return () => {
      mounted = false;
    };
  }, [alert]);

  const handleCopyUrl = () => {
    if (!shareData) return;
    navigator.clipboard?.writeText(shareData.trackingUrl).then(() => {
      setCopiedUrl(true);
      toast.success('Temporary secure tracking URL copied to clipboard');
      setTimeout(() => setCopiedUrl(false), 2500);
    });
  };

  const handleNativeShare = async () => {
    if (!shareData) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `EMERGENCY SOS: ${alert.senderName}`,
          text: shareData.shareMessage,
          url: shareData.trackingUrl,
        });
        return;
      } catch {
        // Fallback to copy if user cancels
      }
    }
    handleCopyUrl();
  };

  return (
    <div
      style={{ colorScheme: 'light' }}
      className={`rounded-2xl bg-slate-950 text-white border border-sky-400/40 shadow-xl ${
        compact ? 'p-3.5 space-y-2.5' : 'p-4 space-y-3'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 shrink-0">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold text-white tracking-tight">
                Temporary Secure Live Tracking Link
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold uppercase">
                Valid 2h
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Share with emergency responders via SMS, WhatsApp, or messaging apps — no login required.
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-bold text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-900 cursor-pointer"
          >
            Close
          </button>
        )}
      </div>

      {loading || !shareData ? (
        <div className="flex items-center gap-2 text-xs text-sky-300 py-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Generating encrypted responder tracking URL...</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 bg-slate-900/95 border border-slate-800 rounded-xl p-2">
            <input
              type="text"
              readOnly
              value={shareData.trackingUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full bg-transparent text-[11px] font-mono text-sky-300 focus:outline-none truncate"
            />
            <button
              type="button"
              onClick={handleCopyUrl}
              className="px-2.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-[11px] flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
            >
              {copiedUrl ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy URL</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={shareData.smsHref}
              className="flex-1 min-w-[125px] px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow cursor-pointer transition-transform active:scale-95"
            >
              <MessageSquare className="w-3.5 h-3.5 fill-current" />
              <span>Send via SMS</span>
            </a>

            <a
              href={shareData.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[135px] px-3 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow cursor-pointer transition-transform active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>WhatsApp / Chat</span>
            </a>

            <button
              type="button"
              onClick={handleNativeShare}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer transition-transform active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Share App...</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export interface EmergencyResponderTrackingViewProps {
  token: string;
  initialAlertId?: string;
  initialLat?: number;
  initialLng?: number;
  initialAcc?: number;
  initialSender?: string;
  initialMsg?: string;
  expiresAtMs?: number;
  onExitTracking: () => void;
}

export const EmergencyResponderTrackingView: React.FC<EmergencyResponderTrackingViewProps> = ({
  token,
  initialAlertId,
  initialLat,
  initialLng,
  initialAcc,
  initialSender,
  initialMsg,
  expiresAtMs,
  onExitTracking,
}) => {
  const [trackingAlert, setTrackingAlert] = useState<EmergencyAlert | null>(() => {
    if (
      typeof initialLat === 'number' &&
      typeof initialLng === 'number' &&
      Number.isFinite(initialLat) &&
      Number.isFinite(initialLng) &&
      !(initialLat === 0 && initialLng === 0)
    ) {
      return {
        id: initialAlertId || 'sos-live',
        senderId: 'sender',
        senderName: initialSender || 'Beacon Member',
        senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120',
        latitude: initialLat,
        longitude: initialLng,
        accuracy: initialAcc || 15,
        message: initialMsg || 'EMERGENCY SOS: Immediate assistance required!',
        timestamp: new Date().toISOString(),
        status: 'active',
        acknowledgedBy: [],
      };
    }
    return null;
  });
  const [expiresAt, setExpiresAt] = useState<string | null>(
    expiresAtMs ? new Date(expiresAtMs).toISOString() : null
  );
  const [error, setError] = useState<string | null>(null);
  const [viewerLocation, setViewerLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setViewerLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const fetchLiveTrack = async () => {
      try {
        const res = await api.get<{
          alert: EmergencyAlert;
          expiresAt: string;
          liveCoordinates?: { latitude: number; longitude: number; accuracy: number; timestamp: string };
        }>(`/api/alerts/track/${encodeURIComponent(token)}`);
        if (!active) return;
        const mergedAlert: EmergencyAlert = res.liveCoordinates
          ? {
              ...res.alert,
              latitude: res.liveCoordinates.latitude,
              longitude: res.liveCoordinates.longitude,
              accuracy: res.liveCoordinates.accuracy,
            }
          : res.alert;
        setTrackingAlert(mergedAlert);
        setExpiresAt(res.expiresAt);
        setLastUpdated(new Date());
        setError(null);
      } catch {
        if (!active) return;
        if (!trackingAlert) {
          setError('This temporary emergency tracking link has expired or is invalid.');
        }
      }
    };

    fetchLiveTrack();
    const interval = setInterval(fetchLiveTrack, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col p-4 md:p-6">
      <div className="max-w-3xl w-full mx-auto space-y-4">
        <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-red-700 rounded-3xl p-5 shadow-2xl border border-rose-400/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white text-rose-600 flex items-center justify-center font-black shadow-lg shrink-0">
              <Siren className="w-7 h-7 animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-slate-950/40 text-white text-[10px] font-black uppercase tracking-wider">
                  LIVE RESPONDER TRACKING
                </span>
                <span className="text-[11px] text-rose-100 font-semibold">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              </div>
              <h1 className="text-xl font-black tracking-tight mt-0.5">
                {trackingAlert ? `Emergency SOS: ${trackingAlert.senderName}` : 'Connecting to SOS Beacon...'}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={onExitTracking}
            className="px-3.5 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-900 text-white text-xs font-bold border border-white/15 flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Full Beacon App</span>
          </button>
        </div>

        {error ? (
          <div className="rounded-2xl bg-slate-900 border border-rose-500/40 p-6 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
            <h2 className="text-base font-bold text-white">{error}</h2>
            <button
              type="button"
              onClick={onExitTracking}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
            >
              Return to App
            </button>
          </div>
        ) : trackingAlert ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/30 text-sm font-bold text-rose-100">
              "{trackingAlert.message}"
            </div>

            <EmergencyLocationMap
              latitude={trackingAlert.latitude}
              longitude={trackingAlert.longitude}
              accuracy={trackingAlert.accuracy}
              senderName={trackingAlert.senderName}
              message={trackingAlert.message}
              timestamp={trackingAlert.timestamp}
              viewerLocation={viewerLocation}
              heightClass="h-80"
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <div>
                <span className="text-slate-400 block">Live GPS Coordinates</span>
                <span className="font-mono font-bold text-white text-sm">
                  {trackingAlert.latitude.toFixed(6)}, {trackingAlert.longitude.toFixed(6)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Signal Accuracy</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {formatAccuracy(trackingAlert.accuracy)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Link Expiration</span>
                <span className="font-semibold text-slate-300">
                  {expiresAt ? new Date(expiresAt).toLocaleTimeString() : 'Active Session'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href={getNativeNavigationUrl(
                  trackingAlert.latitude,
                  trackingAlert.longitude,
                  viewerLocation?.latitude,
                  viewerLocation?.longitude
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[200px] py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <Navigation className="w-4 h-4 fill-current" />
                <span>Get Turn-by-Turn Directions</span>
              </a>

              {trackingAlert.senderPhone && (
                <a
                  href={`tel:${trackingAlert.senderPhone}`}
                  className="py-3 px-5 rounded-2xl bg-white text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg"
                >
                  <Phone className="w-4 h-4 text-rose-600" />
                  <span>Call {trackingAlert.senderPhone}</span>
                </a>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

interface EmergencyManagerProps {
  onViewLocationOnMap?: (lat: number, lng: number) => void;
  onSelectUserForChat?: (userId: string) => void;
}

export const EmergencyManager: React.FC<EmergencyManagerProps> = ({
  onViewLocationOnMap,
  onSelectUserForChat,
}) => {
  const { user } = useAuth();
  const {
    myLocation,
    userLocations,
    activeAlerts,
    triggerEmergencySos,
    acknowledgeEmergency,
    deleteEmergencyAlert,
    latestAlert,
    dismissLatestAlert,
  } = useRealtime();

  const toast = useToast();
  const [sosMessage, setSosMessage] = useState('EMERGENCY: Immediate help needed!');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [openShareAlertId, setOpenShareAlertId] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenSos = () => setShowConfirmModal(true);
    window.addEventListener('beacon:open-sos-modal', handleOpenSos);
    return () => window.removeEventListener('beacon:open-sos-modal', handleOpenSos);
  }, []);

  // Compute who is nearby within 5 km (5,000 meters) of my location or active SOS alert
  const referenceCoords = useMemo(() => {
    if (latestAlert && latestAlert.status === 'active') {
      return {
        latitude: latestAlert.latitude,
        longitude: latestAlert.longitude,
        label: `${latestAlert.senderName}'s SOS`,
      };
    }
    if (myLocation) {
      return {
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
        label: 'Your Location',
      };
    }
    return null;
  }, [latestAlert, myLocation]);

  const nearby5kmUsers = useMemo(() => {
    if (!referenceCoords) return [];
    const results: Array<{
      userId: string;
      fullName: string;
      avatar: string;
      distanceMeters: number;
      latitude: number;
      longitude: number;
      accuracy: number;
    }> = [];

    userLocations.forEach((loc) => {
      if (
        !loc ||
        !Number.isFinite(loc.latitude) ||
        !Number.isFinite(loc.longitude) ||
        (loc.latitude === 0 && loc.longitude === 0)
      ) {
        return;
      }
      const dist = calculateDistanceMeters(
        referenceCoords.latitude,
        referenceCoords.longitude,
        loc.latitude,
        loc.longitude
      );
      if (dist <= 5000) {
        const isMe = Boolean(user && loc.userId === user.id);
        results.push({
          userId: loc.userId,
          fullName:
            isMe && user
              ? `${user.fullName} (You)`
              : loc.fullName || `Member ${loc.userId.slice(0, 6)}`,
          avatar:
            (loc as any).avatar ||
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120',
          distanceMeters: dist,
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy,
        });
      }
    });

    return results.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [referenceCoords, userLocations, user]);

  const handleSendSos = () => {
    setIsTriggering(true);
    triggerHaptic('sos');
    triggerEmergencySos(sosMessage);
    setShowConfirmModal(false);
    setIsTriggering(false);
    toast.success('Emergency SOS broadcast transmitted with live GPS coordinates');
  };

  const handleResolve = async (alertId: string) => {
    try {
      await api.post(`/api/alerts/emergency/${alertId}/resolve`);
      dismissLatestAlert();
      toast.success('Distress alert resolved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to resolve alert');
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      await deleteEmergencyAlert(alertId);
      toast.success('Distress alert deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete alert');
    }
  };

  return (
    <div className="h-full bg-slate-50 overflow-y-auto p-4 md:p-6 pb-28 space-y-5">
      {/* Top Banner & SOS Trigger */}
      <div className="shrink-0 bg-gradient-to-r from-rose-950 via-rose-900 to-slate-900 text-white rounded-3xl p-5 md:p-6 shadow-xl relative">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider mb-1">
              <Siren className="w-4 h-4 animate-pulse shrink-0" />
              <span>Community Safety Mesh · 5 km Automatic Device Pop-Up Alert Radius</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">
              Emergency Broadcast Network
            </h2>
            <p className="text-xs text-rose-200 mt-1 max-w-lg leading-relaxed">
              Instantly transmit high-priority distress alerts with an interactive live map, temporary secure responder tracking link, and automatic device pop-up notifications to everyone within 5 km.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="w-full md:w-auto px-6 py-3.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-black text-sm rounded-2xl shadow-lg shadow-rose-900/50 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
          >
            <AlertTriangle className="w-5 h-5 fill-current shrink-0" />
            <span>BROADCAST EMERGENCY SOS</span>
          </button>
        </div>
      </div>

      {/* Who is Nearby Within 5 km Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                People Nearby Within 5 km ({nearby5kmUsers.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                {referenceCoords
                  ? `Showing live members within 5 km of ${referenceCoords.label} who receive instant emergency pop-up notifications`
                  : 'Waiting for your live GPS fix to detect members within 5 km'}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
            5.0 km Alert Zone
          </span>
        </div>

        {nearby5kmUsers.length === 0 ? (
          <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-100">
            No other active members detected within a 5 km radius right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {nearby5kmUsers.map((person) => (
              <div
                key={person.userId}
                className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={person.avatar}
                    alt={person.fullName}
                    className="w-9 h-9 rounded-full object-cover border border-emerald-400 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{person.fullName}</p>
                    <p className="text-[11px] text-emerald-700 font-semibold">
                      {person.distanceMeters < 15
                        ? 'At SOS location'
                        : `${formatDistance(person.distanceMeters)} away`}
                    </p>
                  </div>
                </div>
                {onViewLocationOnMap && (
                  <button
                    type="button"
                    onClick={() => onViewLocationOnMap(person.latitude, person.longitude)}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold shrink-0 cursor-pointer"
                  >
                    Locate
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Active Emergency Banner (If latest alert received) */}
      {latestAlert && latestAlert.status === 'active' && (
        <div className="bg-rose-600 text-white p-4 rounded-2xl shadow-xl space-y-3 border-2 border-rose-300">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white text-rose-600 flex items-center justify-center font-bold shrink-0">
                <Siren className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <p className="font-bold text-sm">Active SOS: {latestAlert.senderName}</p>
                <p className="text-xs text-rose-100">{latestAlert.message}</p>
                <p className="text-[11px] font-mono font-bold text-white mt-0.5">
                  Coordinates: {latestAlert.latitude.toFixed(6)}, {latestAlert.longitude.toFixed(6)} ({formatAccuracy(latestAlert.accuracy)})
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  setOpenShareAlertId((prev) => (prev === latestAlert.id ? null : latestAlert.id))
                }
                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share Live Location
              </button>
              <a
                href={getNativeNavigationUrl(
                  latestAlert.latitude,
                  latestAlert.longitude,
                  myLocation?.latitude,
                  myLocation?.longitude
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5 fill-current" />
                Get Directions
              </a>
              <button
                onClick={() => {
                  if (onViewLocationOnMap) {
                    onViewLocationOnMap(latestAlert.latitude, latestAlert.longitude);
                  }
                }}
                className="px-3 py-1.5 bg-white text-rose-700 font-bold text-xs rounded-xl shadow-sm cursor-pointer"
              >
                View on Map
              </button>
              <button
                onClick={dismissLatestAlert}
                className="p-2 hover:bg-rose-700 rounded-xl cursor-pointer"
                title="Silence siren"
              >
                <VolumeX className="w-4 h-4" />
              </button>
            </div>
          </div>

          {openShareAlertId === latestAlert.id && (
            <EmergencySharePanel
              alert={latestAlert}
              onClose={() => setOpenShareAlertId(null)}
              compact
            />
          )}

          <EmergencyLocationMap
            latitude={latestAlert.latitude}
            longitude={latestAlert.longitude}
            accuracy={latestAlert.accuracy}
            senderName={latestAlert.senderName}
            message={latestAlert.message}
            timestamp={latestAlert.timestamp}
            viewerLocation={myLocation}
            onOpenFullMap={onViewLocationOnMap}
            heightClass="h-48"
          />
        </div>
      )}

      {/* Active Alerts List */}
      <div>
        <h3 className="font-bold text-slate-900 text-base mb-3 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-600" />
          Active Distress Alerts ({activeAlerts.length})
        </h3>

        {activeAlerts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h4 className="font-semibold text-slate-800 text-sm">No Active Emergency Alerts</h4>
            <p className="text-xs text-slate-500 mt-1">Your groups and community channels are currently secure.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeAlerts.map((alert) => {
              const isAcknowledgedByMe = alert.acknowledgedBy.some((a) => a.userId === user?.id);
              const isMyAlert = alert.senderId === user?.id;

              return (
                <div
                  key={alert.id}
                  className="bg-white rounded-2xl border-2 border-rose-300 p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={alert.senderAvatar}
                        alt={alert.senderName}
                        className="w-12 h-12 rounded-full object-cover border-2 border-rose-500"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-base">{alert.senderName}</h4>
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                            SOS ACTIVE
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatTimeAgo(alert.timestamp)}</span>
                          {alert.roomName && (
                            <>
                              <span>·</span>
                              <span>{alert.roomName}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isMyAlert && alert.status === 'active' && (
                        <button
                          onClick={() => handleResolve(alert.id)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                        >
                          Mark Resolved
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteAlert(alert.id)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                        title="Delete Alert"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Alert
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-100 text-sm font-semibold text-rose-950">
                    "{alert.message}"
                  </div>

                  {/* Interactive Emergency Location Map with Pin, Accuracy Circle & Coordinates */}
                  <EmergencyLocationMap
                    latitude={alert.latitude}
                    longitude={alert.longitude}
                    accuracy={alert.accuracy}
                    senderName={alert.senderName}
                    message={alert.message}
                    timestamp={alert.timestamp}
                    viewerLocation={myLocation}
                    onOpenFullMap={onViewLocationOnMap}
                    heightClass="h-60"
                  />

                  {/* Geolocation Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-400 block">Exact Coordinates (Lat, Lng)</span>
                      <span className="font-mono text-slate-900 font-bold">
                        {alert.latitude.toFixed(6)}, {alert.longitude.toFixed(6)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">GPS Accuracy</span>
                      <span className="font-semibold text-slate-800">
                        {formatAccuracy(alert.accuracy)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Phone Contact</span>
                      <span className="font-medium text-slate-800">
                        {alert.senderPhone || 'Hidden by privacy'}
                      </span>
                    </div>
                  </div>

                  {/* Action Shortcuts */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={() => {
                        if (onViewLocationOnMap) {
                          onViewLocationOnMap(alert.latitude, alert.longitude);
                        }
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <MapPin className="w-4 h-4" />
                      View Real Location on Map
                    </button>

                    <a
                      href={getNativeNavigationUrl(
                        alert.latitude,
                        alert.longitude,
                        myLocation?.latitude,
                        myLocation?.longitude
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Navigation className="w-4 h-4 fill-current" />
                      Get Directions
                    </a>

                    <button
                      type="button"
                      onClick={() =>
                        setOpenShareAlertId((prev) => (prev === alert.id ? null : alert.id))
                      }
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" />
                      Share Live Location
                    </button>

                    {alert.senderPhone && (
                      <a
                        href={`tel:${alert.senderPhone}`}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1.5"
                      >
                        <Phone className="w-4 h-4 text-emerald-600" />
                        Call {alert.senderPhone}
                      </a>
                    )}

                    <button
                      onClick={() => {
                        if (onSelectUserForChat) {
                          onSelectUserForChat(alert.senderId);
                        }
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Message
                    </button>

                    <button
                      onClick={() => acknowledgeEmergency(alert.id)}
                      disabled={isAcknowledgedByMe}
                      className={`px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 ml-auto cursor-pointer ${
                        isAcknowledgedByMe
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      <CheckCircle className="w-4 h-4" />
                      {isAcknowledgedByMe ? 'Acknowledged by You' : 'Acknowledge Alert'}
                    </button>
                  </div>

                  {openShareAlertId === alert.id && (
                    <EmergencySharePanel
                      alert={alert}
                      onClose={() => setOpenShareAlertId(null)}
                    />
                  )}

                  {/* Acknowledged by List */}
                  {alert.acknowledgedBy.length > 0 && (
                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex items-center gap-1">
                      <span className="font-semibold text-slate-700">Responders: </span>
                      <span>{alert.acknowledgedBy.map((a) => a.name).join(', ')}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* GitHub Android APK Release & Direct Download Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
            GitHub Automated Release Pipeline
          </span>
          <h4 className="text-sm font-bold text-white mt-0.5">
            Beacon Native Android APK (`app-debug.apk`)
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Automatically compiled and published to GitHub Releases whenever you sync/push to `main`.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <a
            href="https://github.com/Harikrishna8118/Track-Your-Friends-/releases/latest/download/app-debug.apk"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Latest APK</span>
          </a>
          <a
            href="https://github.com/Harikrishna8118/Track-Your-Friends-/actions"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>GitHub Actions</span>
          </a>
        </div>
      </div>

      {/* Confirmation Modal to prevent accidental SOS broadcast */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            style={{ colorScheme: 'light' }}
            className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-rose-200 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Siren className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Broadcast Emergency SOS?</h3>
                <p className="text-xs text-slate-600 font-medium">
                  Your live location map and exact GPS coordinates will trigger pop-up notifications on devices within 5 km.
                </p>
              </div>
            </div>

            {/* Live Location Map Preview inside SOS Confirmation Modal */}
            <div className="mb-4">
              {myLocation ? (
                <EmergencyLocationMap
                  latitude={myLocation.latitude}
                  longitude={myLocation.longitude}
                  accuracy={myLocation.accuracy}
                  senderName={user?.fullName || 'You'}
                  message={sosMessage}
                  heightClass="h-44"
                />
              ) : (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 font-medium">
                  Waiting for location — your device will request a high-accuracy GPS fix when you confirm.
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-950 mb-1">Distress Message</label>
              <input
                type="text"
                value={sosMessage}
                onChange={(e) => setSosMessage(e.target.value)}
                placeholder="EMERGENCY: Immediate help needed!"
                style={{ color: '#090d16', backgroundColor: '#ffffff', colorScheme: 'light', WebkitTextFillColor: '#090d16' }}
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-rose-300 bg-white text-slate-950 placeholder:text-slate-500 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-rose-600 focus:border-rose-600 shadow-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSendSos}
                disabled={isTriggering}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-900/30 flex items-center gap-1.5 cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4 fill-current" />
                Confirm SOS Broadcast
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
