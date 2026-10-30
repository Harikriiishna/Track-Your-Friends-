const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/RoomsManager-KCpvT0Uj.js","assets/rolldown-runtime-CO0Nlsmt.js","assets/vendor-react-7Z3kCInY.js","assets/vendor-icons-PxteBMrr.js","assets/ToastContext-ziKLJ15f.js","assets/ChatView-B-U0O1iq.js","assets/SavedPlacesManager-DMOb7ylA.js","assets/RemindersManager-CxM_3RVY.js","assets/MeetingsManager-CeQU2G9D.js","assets/ProfilePrivacyView-DQf1hx_z.js","assets/AdminDashboard-y9at9evH.js"])))=>i.map(i=>d[i]);
import { n as __toESM } from "./rolldown-runtime-CO0Nlsmt.js";
import { n as require_client, t as require_jsx_runtime } from "./vendor-react-7Z3kCInY.js";
import { $t as Activity, A as Send, At as Copy, B as Phone, Bt as Check, C as Shield, Dt as Download, E as Share2, Et as ExternalLink, G as Navigation, Gt as Bookmark, I as RefreshCw, It as CircleCheck, J as Minus, Jt as Bell, K as Mountain, Kt as BookmarkCheck, Lt as CircleCheckBig, M as Route, Mt as Coffee, N as RotateCw, Nt as Clock, O as Settings2, Ot as Crosshair, P as RotateCcw, Pt as CircleX, Q as MessageSquare, Qt as ArrowLeft, R as Plus, Rt as CircleAlert, S as ShoppingCart, T as ShieldAlert, Tt as EyeOff, Vt as Car, W as Palette, Wt as Building2, Zt as ArrowRight, _ as Sparkles, a as VolumeX, at as Lock, bt as Fuel, c as Users, ct as Layers, d as TriangleAlert, dt as KeyRound, en as require_react, et as Maximize2, f as TreePine, ft as Info, g as Star, h as Sun, ht as Heart, i as WifiOff, j as Search, jt as Compass, k as Server, l as User, m as Terminal, mt as History, n as X, nt as MapPin, ot as LocateFixed, p as Trash2, q as Moon, qt as Bike, r as Wifi, rt as Mail, s as Utensils, st as LoaderCircle, t as Zap, tt as Map$1, ut as Landmark, vt as Globe, w as ShieldCheck, wt as Eye, x as Siren, xt as Footprints, y as Smartphone, z as Play, zt as ChevronDown } from "./vendor-icons-PxteBMrr.js";
import { A as getGpsSignalInfo, C as fetchRealNearbyPlaces, D as formatAccuracy, E as calculateDistanceMeters, O as formatDistance, S as deduplicateAndSortPlaces, T as searchRealPlacesByQuery, _ as isInvalidOrLocalEndpoint, a as api, b as syncLogger, c as verifyCloudFirestoreConnection, d as PRODUCTION_WSS_URL, f as getMaskedBackendUrl, g as isAndroidNativeApp, h as getProductionWsUrl, i as useAuth, k as formatTimeAgo, l as DEFAULT_PRODUCTION_BACKEND_ORIGIN, m as getProductionApiBaseUrlOverride, n as useToast, o as localBackend, p as getProductionApiBaseUrl, r as AuthProvider, s as getCloudDatabaseHealth, t as ToastProvider, u as PRODUCTION_API_URL, v as nativeAwareFetch, w as getNativeNavigationUrl, x as createEmergencySharePayload, y as setProductionApiBaseUrlOverride } from "./ToastContext-ziKLJ15f.js";
import { t as require_leaflet_src } from "./vendor-leaflet-DT2Z_4Jm.js";
// \0vite/modulepreload-polyfill.js
(function polyfill() {
	const relList = document.createElement("link").relList;
	if (relList && relList.supports && relList.supports("modulepreload")) return;
	for (const link of document.querySelectorAll("link[rel=\"modulepreload\"]")) processPreload(link);
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "childList") continue;
			for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
		}
	}).observe(document, {
		childList: true,
		subtree: true
	});
	function getFetchOpts(link) {
		const fetchOpts = {};
		if (link.integrity) fetchOpts.integrity = link.integrity;
		if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
		if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
		else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
		else fetchOpts.credentials = "same-origin";
		return fetchOpts;
	}
	function processPreload(link) {
		if (link.ep) return;
		link.ep = true;
		const fetchOpts = getFetchOpts(link);
		fetch(link.href, fetchOpts);
	}
})();
// src/utils/audio.ts
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_client = require_client();
/**
* Real audio capture, playback and synthesis utilities
*/
var SoundSystem = class {
	constructor() {
		this.ctx = null;
		this.alarmOsc1 = null;
		this.alarmOsc2 = null;
		this.alarmGain = null;
		this.alarmInterval = null;
	}
	getContext() {
		if (!this.ctx) {
			const AudioCtx = window.AudioContext || window.webkitAudioContext;
			this.ctx = new AudioCtx();
		}
		if (this.ctx.state === "suspended") this.ctx.resume();
		return this.ctx;
	}
	playChime() {
		try {
			const ctx = this.getContext();
			const now = ctx.currentTime;
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "sine";
			osc.frequency.setValueAtTime(587.33, now);
			osc.frequency.exponentialRampToValueAtTime(880, now + .15);
			gain.gain.setValueAtTime(.2, now);
			gain.gain.exponentialRampToValueAtTime(.001, now + .4);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(now);
			osc.stop(now + .4);
		} catch (e) {
			console.warn("Audio chime error:", e);
		}
	}
	playTap() {
		try {
			const ctx = this.getContext();
			const now = ctx.currentTime;
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "sine";
			osc.frequency.setValueAtTime(440, now);
			osc.frequency.exponentialRampToValueAtTime(220, now + .04);
			gain.gain.setValueAtTime(.04, now);
			gain.gain.exponentialRampToValueAtTime(1e-4, now + .04);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(now);
			osc.stop(now + .04);
		} catch {}
	}
	playSuccess() {
		try {
			const ctx = this.getContext();
			const now = ctx.currentTime;
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "sine";
			osc.frequency.setValueAtTime(523.25, now);
			osc.frequency.setValueAtTime(659.25, now + .08);
			osc.frequency.setValueAtTime(783.99, now + .16);
			gain.gain.setValueAtTime(.12, now);
			gain.gain.exponentialRampToValueAtTime(.001, now + .35);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(now);
			osc.stop(now + .35);
		} catch {}
	}
	startEmergencySiren() {
		try {
			if (this.alarmInterval) return;
			const ctx = this.getContext();
			const now = ctx.currentTime;
			this.alarmGain = ctx.createGain();
			this.alarmGain.gain.setValueAtTime(.3, now);
			this.alarmGain.connect(ctx.destination);
			let toggle = false;
			const playTone = () => {
				if (!this.ctx || !this.alarmGain) return;
				const t = this.ctx.currentTime;
				const osc = this.ctx.createOscillator();
				osc.type = "sawtooth";
				osc.frequency.setValueAtTime(toggle ? 900 : 650, t);
				osc.connect(this.alarmGain);
				osc.start(t);
				osc.stop(t + .28);
				toggle = !toggle;
			};
			playTone();
			this.alarmInterval = setInterval(playTone, 320);
		} catch (e) {
			console.warn("Alarm audio error:", e);
		}
	}
	stopEmergencySiren() {
		if (this.alarmInterval) {
			clearInterval(this.alarmInterval);
			this.alarmInterval = null;
		}
		if (this.alarmGain) {
			try {
				this.alarmGain.disconnect();
			} catch {}
			this.alarmGain = null;
		}
	}
};
var sound = new SoundSystem();
/**
* Mobile Haptic Feedback Trigger using Navigator.vibrate
*/
function triggerHaptic(type = "light") {
	if (typeof navigator !== "undefined" && "vibrate" in navigator) try {
		switch (type) {
			case "light":
			case "selection":
				navigator.vibrate(12);
				break;
			case "medium":
				navigator.vibrate(25);
				break;
			case "heavy":
				navigator.vibrate(45);
				break;
			case "warning":
				navigator.vibrate([
					30,
					40,
					30
				]);
				break;
			case "sos": navigator.vibrate([
				150,
				70,
				150,
				70,
				300
			]);
		}
	} catch {}
}
var VoiceRecorder = class {
	constructor() {
		this.mediaRecorder = null;
		this.audioChunks = [];
		this.startTime = 0;
		this.stream = null;
		this.audioContext = null;
		this.analyser = null;
		this.sourceNode = null;
	}
	async start() {
		this.audioChunks = [];
		this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		try {
			const AudioCtx = window.AudioContext || window.webkitAudioContext;
			this.audioContext = new AudioCtx();
			this.analyser = this.audioContext.createAnalyser();
			this.analyser.fftSize = 64;
			this.analyser.smoothingTimeConstant = .8;
			this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
			this.sourceNode.connect(this.analyser);
		} catch (e) {
			console.warn("AudioContext visualizer setup note:", e);
		}
		let mimeType = "audio/webm";
		if (!MediaRecorder.isTypeSupported("audio/webm")) {
			if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
			else mimeType = "";
		}
		const options = mimeType ? { mimeType } : {};
		this.mediaRecorder = new MediaRecorder(this.stream, options);
		this.mediaRecorder.ondataavailable = (event) => {
			if (event.data && event.data.size > 0) this.audioChunks.push(event.data);
		};
		this.startTime = Date.now();
		this.mediaRecorder.start(100);
	}
	getAnalyser() {
		return this.analyser;
	}
	getStream() {
		return this.stream;
	}
	stop() {
		return new Promise((resolve, reject) => {
			if (!this.mediaRecorder) {
				reject(/* @__PURE__ */ new Error("MediaRecorder not active"));
				return;
			}
			this.mediaRecorder.onstop = () => {
				const durationSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1e3));
				const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
				const blob = new Blob(this.audioChunks, { type: mimeType });
				if (this.sourceNode) {
					try {
						this.sourceNode.disconnect();
					} catch {}
					this.sourceNode = null;
				}
				if (this.audioContext && this.audioContext.state !== "closed") {
					try {
						this.audioContext.close();
					} catch {}
					this.audioContext = null;
				}
				this.analyser = null;
				if (this.stream) {
					this.stream.getTracks().forEach((track) => track.stop());
					this.stream = null;
				}
				const reader = new FileReader();
				reader.onloadend = () => {
					resolve({
						blob,
						dataUrl: reader.result,
						durationSeconds
					});
				};
				reader.onerror = reject;
				reader.readAsDataURL(blob);
			};
			this.mediaRecorder.stop();
		});
	}
	cancel() {
		if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") this.mediaRecorder.stop();
		if (this.sourceNode) {
			try {
				this.sourceNode.disconnect();
			} catch {}
			this.sourceNode = null;
		}
		if (this.audioContext && this.audioContext.state !== "closed") {
			try {
				this.audioContext.close();
			} catch {}
			this.audioContext = null;
		}
		this.analyser = null;
		if (this.stream) {
			this.stream.getTracks().forEach((track) => track.stop());
			this.stream = null;
		}
		this.audioChunks = [];
	}
};
var notifications = class NotificationService {
	static getInstance() {
		if (!NotificationService.instance) NotificationService.instance = new NotificationService();
		return NotificationService.instance;
	}
	constructor() {
		this.permissionRequested = false;
		if (typeof window !== "undefined") {
			const unlockPermission = () => {
				if (!this.permissionRequested && this.isSupported() && Notification.permission === "default") {
					this.permissionRequested = true;
					this.requestPermission().catch(() => {});
				}
			};
			window.addEventListener("pointerdown", unlockPermission, {
				once: true,
				passive: true
			});
		}
	}
	isSupported() {
		return typeof window !== "undefined" && "Notification" in window;
	}
	getPermission() {
		if (!this.isSupported()) return "denied";
		return Notification.permission;
	}
	async requestPermission() {
		if (!this.isSupported()) return false;
		if (Notification.permission === "granted") return true;
		try {
			return await Notification.requestPermission() === "granted";
		} catch (err) {
			console.warn("Error requesting notification permission:", err);
			return false;
		}
	}
	send(title, options) {
		try {
			if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate([
				400,
				150,
				400,
				150,
				600
			]);
		} catch {}
		try {
			if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("beacon:device-popup-notification", { detail: {
				id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
				title,
				body: options?.body || "",
				tag: options?.tag || "general",
				data: options?.data || null,
				timestamp: Date.now()
			} }));
		} catch {}
		if (!this.isSupported()) return null;
		if (Notification.permission === "default") {
			this.requestPermission().then((granted) => {
				if (granted) this.dispatchNativeNotification(title, options);
			});
			return null;
		}
		if (Notification.permission !== "granted") return null;
		return this.dispatchNativeNotification(title, options);
	}
	dispatchNativeNotification(title, options) {
		const mergedOptions = {
			icon: "/pwa-192x192.png",
			badge: "/icon.svg",
			...options
		};
		if (typeof navigator !== "undefined" && "serviceWorker" in navigator) navigator.serviceWorker.getRegistration().then((reg) => {
			if (reg && typeof reg.showNotification === "function") reg.showNotification(title, mergedOptions).catch(() => {});
		}).catch(() => {});
		try {
			const n = new Notification(title, mergedOptions);
			n.onclick = () => {
				window.focus();
				n.close();
			};
			return n;
		} catch {
			return null;
		}
	}
	notifyEmergency(senderName, message, coords) {
		const distLabel = coords && typeof coords.distanceMeters === "number" ? coords.distanceMeters < 1e3 ? `${Math.round(coords.distanceMeters)} m away` : `${(coords.distanceMeters / 1e3).toFixed(1)} km away` : "Within 5 km";
		const coordText = coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude) ? ` · GPS: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : "";
		this.send(`🚨 EMERGENCY SOS (${distLabel}): ${senderName}`, {
			body: `${message || "Immediate help needed!"}${coordText}`,
			tag: `emergency-sos-${Date.now()}`,
			requireInteraction: true,
			icon: "/pwa-192x192.png",
			data: coords || null
		});
	}
	notifyMessage(senderName, text) {
		if (document.hidden) this.send(`New message from ${senderName}`, {
			body: text,
			tag: `msg-${senderName}`,
			icon: "/pwa-192x192.png"
		});
	}
	notifyReminder(title, locationName) {
		this.send(`📍 Geofence Reminder: ${title}`, {
			body: `You arrived near ${locationName}. Don't forget your scheduled task!`,
			tag: `reminder-${title}`,
			requireInteraction: true,
			icon: "/pwa-192x192.png"
		});
	}
	notifyMemberGeofence(memberName, action, placeName, distanceMeters) {
		const verb = action === "entered" ? "entered" : "left";
		const distInfo = typeof distanceMeters === "number" ? ` (${Math.round(distanceMeters)}m from center)` : "";
		this.send(`📍 Geofence Alert: ${memberName} ${verb} ${placeName}`, {
			body: `${memberName} has just ${verb} the "${placeName}" saved location geofence${distInfo}.`,
			tag: `geofence-${memberName}-${placeName}-${action}`,
			requireInteraction: false,
			icon: "/pwa-192x192.png"
		});
	}
}.getInstance();
// src/utils/connectivity.ts
var HEALTH_CHECK_TIMEOUT_MS = 5e3;
/**
* Resolves the target base URL from `VITE_API_BASE_URL` (or falls back to the
* centralized production API base URL if `VITE_API_BASE_URL` is unset or a placeholder)
* and returns a sanitized health endpoint URL alongside a safe display URL.
*/
function resolveHealthCheckEndpoint() {
	let rawEnvBaseUrl = "";
	try {
		const metaEnv = typeof import.meta !== "undefined" ? {
			"BASE_URL": "/",
			"DEV": false,
			"MODE": "production",
			"PROD": true,
			"SSR": false,
			"VITE_API_BASE_URL": "",
			"VITE_API_URL": "",
			"VITE_GOOGLE_MAPS_API_KEY": "AIzaSyAOVYRIgupAurZup5y1PRh8Ismb1A3lLao",
			"VITE_WS_URL": ""
		} : void 0;
		if (metaEnv && typeof metaEnv.VITE_API_BASE_URL === "string") rawEnvBaseUrl = metaEnv.VITE_API_BASE_URL.trim();
	} catch {}
	const baseUrl = rawEnvBaseUrl && !isInvalidOrLocalEndpoint(rawEnvBaseUrl) ? rawEnvBaseUrl.replace(/\/+$/, "") : getProductionApiBaseUrl();
	return {
		requestUrl: `${baseUrl}/api/health`,
		safeDisplayUrl: `${getMaskedBackendUrl(baseUrl)}/api/health`
	};
}
/**
* Sanitizes error messages so no tokens, keys, passwords, or sensitive query parameters
* are ever written to the console or exposed in UI error state.
*/
function sanitizeErrorMessage(rawMessage) {
	if (!rawMessage) return "Unknown connectivity error";
	return rawMessage.replace(/([?&](?:key|token|secret|password|auth|apikey)=)[^&\s]+/gi, "$1[REDACTED]").replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[REDACTED]");
}
/**
* Performs a health check against the `VITE_API_BASE_URL` health endpoint (`/api/health`)
* using `fetch` with a strict 5-second (`5000ms`) timeout.
* Explicitly logs connectivity status to the console without revealing secrets.
*/
async function checkBackendConnectivity(timeoutMs = HEALTH_CHECK_TIMEOUT_MS) {
	const { requestUrl, safeDisplayUrl } = resolveHealthCheckEndpoint();
	const controller = new AbortController();
	const effectiveTimeoutMs = typeof timeoutMs === "number" && timeoutMs > 0 ? timeoutMs : HEALTH_CHECK_TIMEOUT_MS;
	const startTime = Date.now();
	const timeoutId = setTimeout(() => {
		controller.abort();
	}, effectiveTimeoutMs);
	try {
		const response = await nativeAwareFetch(requestUrl, {
			method: "GET",
			headers: { Accept: "application/json" },
			cache: "no-store",
			signal: controller.signal
		}, effectiveTimeoutMs);
		const latencyMs = Date.now() - startTime;
		const timestamp = (/* @__PURE__ */ new Date()).toISOString();
		if (response.ok) {
			console.info(`[Connectivity] Backend health check OK (${response.status}) at ${safeDisplayUrl} in ${latencyMs}ms`);
			syncLogger.log("api", "info", "HEALTH_CHECK_OK", {
				endpoint: safeDisplayUrl,
				status: response.status,
				latencyMs
			});
			return {
				ok: true,
				reachable: true,
				status: response.status,
				latencyMs,
				endpoint: safeDisplayUrl,
				error: null,
				timestamp
			};
		}
		const errorMessage = response.status === 401 || response.status === 403 ? `Backend health endpoint rejected request with HTTP ${response.status}` : `Backend health endpoint returned HTTP ${response.status}`;
		console.warn(`[Connectivity] Backend health check FAILED (${response.status}) at ${safeDisplayUrl} in ${latencyMs}ms: ${errorMessage}`);
		syncLogger.log("api", "warn", "HEALTH_CHECK_FAILED", {
			endpoint: safeDisplayUrl,
			status: response.status,
			latencyMs,
			error: errorMessage
		});
		return {
			ok: false,
			reachable: true,
			status: response.status,
			latencyMs,
			endpoint: safeDisplayUrl,
			error: errorMessage,
			timestamp
		};
	} catch (err) {
		const latencyMs = Date.now() - startTime;
		const timestamp = (/* @__PURE__ */ new Date()).toISOString();
		const isAbort = err?.name === "AbortError" || String(err?.message || "").toLowerCase().includes("abort");
		const errorMessage = isAbort ? `Backend health check timed out after ${effectiveTimeoutMs}ms (${safeDisplayUrl})` : `Unable to reach backend health endpoint (${safeDisplayUrl}): ${sanitizeErrorMessage(err?.message || "Network request failed")}`;
		console.error(`[Connectivity] Backend UNREACHABLE at ${safeDisplayUrl} after ${latencyMs}ms: ${errorMessage}`);
		syncLogger.log("api", "error", "HEALTH_CHECK_UNREACHABLE", {
			endpoint: safeDisplayUrl,
			latencyMs,
			timedOut: isAbort,
			error: errorMessage
		});
		return {
			ok: false,
			reachable: false,
			status: null,
			latencyMs,
			endpoint: safeDisplayUrl,
			error: errorMessage,
			timestamp
		};
	} finally {
		clearTimeout(timeoutId);
	}
}
// src/context/RealtimeContext.tsx
var import_jsx_runtime = require_jsx_runtime();
var RealtimeContext = (0, import_react.createContext)(void 0);
var RTC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };
var RealtimeProvider = ({ children }) => {
	const { user, token } = useAuth();
	const [isConnected, setIsConnected] = (0, import_react.useState)(false);
	const [wsConnected, setWsConnected] = (0, import_react.useState)(false);
	const [realtimeState, setRealtimeState] = (0, import_react.useState)("REALTIME_DISCONNECTED");
	const [connectionError, setConnectionError] = (0, import_react.useState)(null);
	const clearConnectionError = (0, import_react.useCallback)(() => setConnectionError(null), []);
	const [myLocation, setMyLocation] = (0, import_react.useState)(null);
	const [gpsAccuracy, setGpsAccuracy] = (0, import_react.useState)(null);
	const [isGpsActive, setIsGpsActive] = (0, import_react.useState)(false);
	const [gpsError, setGpsError] = (0, import_react.useState)(null);
	const [locationStatus, setLocationStatus] = (0, import_react.useState)("Waiting for location");
	const [gpsPermissionState, setGpsPermissionState] = (0, import_react.useState)("prompt");
	const [userLocations, setUserLocations] = (0, import_react.useState)([]);
	const [onlineUserIds, setOnlineUserIds] = (0, import_react.useState)([]);
	const [activeAlerts, setActiveAlerts] = (0, import_react.useState)([]);
	const [latestAlert, setLatestAlert] = (0, import_react.useState)(null);
	const [debugTelemetry, setDebugTelemetry] = (0, import_react.useState)({
		rawFix: null,
		sentToDb: null,
		readFromDb: null,
		markerLatLng: null,
		lastGeoError: null
	});
	const setDebugMarkerLatLng = (0, import_react.useCallback)((coords) => {
		setDebugTelemetry((prev) => {
			if (prev.markerLatLng?.[0] === coords?.[0] && prev.markerLatLng?.[1] === coords?.[1]) return prev;
			return {
				...prev,
				markerLatLng: coords
			};
		});
	}, []);
	const [chatMessages, setChatMessages] = (0, import_react.useState)({});
	const [typingUsers, setTypingUsers] = (0, import_react.useState)({});
	const [activeVoiceRoomId, setActiveVoiceRoomId] = (0, import_react.useState)(null);
	const [isVoiceConnected, setIsVoiceConnected] = (0, import_react.useState)(false);
	const [isMicMuted, setIsMicMuted] = (0, import_react.useState)(false);
	const [isSpeaking, setIsSpeaking] = (0, import_react.useState)(false);
	const [voiceParticipants, setVoiceParticipants] = (0, import_react.useState)([]);
	const socketRef = (0, import_react.useRef)(null);
	const reconnectTimeoutRef = (0, import_react.useRef)(null);
	const localStreamRef = (0, import_react.useRef)(null);
	const peerConnectionsRef = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const audioContextRef = (0, import_react.useRef)(null);
	const analyserRef = (0, import_react.useRef)(null);
	const animFrameRef = (0, import_react.useRef)(null);
	const lastLocationSentRef = (0, import_react.useRef)(null);
	const myLocationRef = (0, import_react.useRef)(null);
	myLocationRef.current = myLocation;
	const hasPreciseFixRef = (0, import_react.useRef)(false);
	const notifiedAlertIdsRef = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const seenMessageIdsRef = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const initializedMsgSyncRef = (0, import_react.useRef)(false);
	const handleIncomingEmergencyAlert = (0, import_react.useCallback)((alert) => {
		setActiveAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)]);
		if (alert.status !== "active") return;
		const myLoc = myLocationRef.current;
		const hasValidAlertCoords = Number.isFinite(alert.latitude) && Number.isFinite(alert.longitude) && !(alert.latitude === 0 && alert.longitude === 0);
		const hasValidMyCoords = Boolean(myLoc) && Number.isFinite(myLoc.latitude) && Number.isFinite(myLoc.longitude);
		const distanceMeters = hasValidAlertCoords && hasValidMyCoords ? calculateDistanceMeters(myLoc.latitude, myLoc.longitude, alert.latitude, alert.longitude) : null;
		if ((alert.senderId === user?.id || distanceMeters === null || distanceMeters <= 5e3) && !notifiedAlertIdsRef.current.has(alert.id)) {
			notifiedAlertIdsRef.current.add(alert.id);
			setLatestAlert(alert);
			sound.startEmergencySiren();
			notifications.notifyEmergency(alert.senderName, alert.message, {
				latitude: alert.latitude,
				longitude: alert.longitude,
				accuracy: alert.accuracy,
				distanceMeters
			});
		}
	}, [user?.id]);
	const sendWs = (0, import_react.useCallback)((msg) => {
		if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify(msg));
	}, []);
	(0, import_react.useEffect)(() => {
		if (!token || !user) {
			if (socketRef.current) {
				socketRef.current.close();
				socketRef.current = null;
			}
			setIsConnected(false);
			return;
		}
		let isMounted = true;
		const currentUserId = user.id;
		const msgSignature = (m) => `${m.id}|${m.text}|${m.isEdited ? 1 : 0}|${m.isDeleted ? 1 : 0}|${Object.keys(m.reactions || {}).length}`;
		const syncMessagesFromStore = () => {
			if (!isMounted) return;
			const allMsgs = localBackend.getAllMessages();
			const grouped = {};
			const nowMs = Date.now();
			for (const m of allMsgs) {
				if (!m || !m.id || m.isDeleted) continue;
				let key;
				if (m.roomId) key = m.roomId;
				else if (m.senderId === currentUserId && m.recipientId) key = m.recipientId;
				else if (m.recipientId === currentUserId && m.senderId) key = m.senderId;
				if (!key) continue;
				if (!grouped[key]) grouped[key] = [];
				grouped[key].push(m);
				if (!seenMessageIdsRef.current.has(m.id)) {
					seenMessageIdsRef.current.add(m.id);
					if (initializedMsgSyncRef.current && m.senderId !== currentUserId) {
						const msgAgeMs = nowMs - (new Date(m.createdAt || 0).getTime() || 0);
						if (msgAgeMs >= -1e4 && msgAgeMs <= 3e4) {
							sound.playChime();
							notifications.notifyMessage(m.senderName, m.text);
						}
					}
				}
			}
			initializedMsgSyncRef.current = true;
			setChatMessages((prev) => {
				let changed = false;
				const next = { ...prev };
				for (const [k, incomingList] of Object.entries(grouped)) {
					const existing = next[k] || [];
					const map = /* @__PURE__ */ new Map();
					for (const item of existing) if (item && item.id && !item.isDeleted) map.set(item.id, item);
					for (const item of incomingList) if (item && item.id && !item.isDeleted) map.set(item.id, item);
					const merged = Array.from(map.values()).sort((a, b) => (new Date(a.createdAt || 0).getTime() || 0) - (new Date(b.createdAt || 0).getTime() || 0));
					if (merged.length !== existing.length || merged.some((m, idx) => msgSignature(m) !== msgSignature(existing[idx]))) {
						next[k] = merged;
						changed = true;
					}
				}
				return changed ? next : prev;
			});
		};
		const applyAlertsList = (alerts) => {
			if (!isMounted || !Array.isArray(alerts)) return;
			setActiveAlerts((prev) => {
				return prev.map((a) => `${a.id}:${a.status}:${a.acknowledgedBy?.length || 0}`).join("|") === alerts.map((a) => `${a.id}:${a.status}:${a.acknowledgedBy?.length || 0}`).join("|") ? prev : alerts;
			});
			alerts.forEach((a) => {
				if (a.status === "active" && !notifiedAlertIdsRef.current.has(a.id)) handleIncomingEmergencyAlert(a);
			});
		};
		const applyLocationsList = (locations) => {
			if (!isMounted || !Array.isArray(locations)) return;
			const ownRow = locations.find((l) => l.userId === currentUserId);
			if (ownRow) setDebugTelemetry((prev) => {
				const nextLat = ownRow.lat ?? ownRow.latitude;
				const nextLng = ownRow.lng ?? ownRow.longitude;
				const nextAcc = ownRow.accuracy_m ?? ownRow.accuracy;
				const nextUpd = ownRow.updated_at ?? ownRow.timestamp;
				if (prev.readFromDb?.lat === nextLat && prev.readFromDb?.lng === nextLng && prev.readFromDb?.accuracy_m === nextAcc && prev.readFromDb?.updated_at === nextUpd) return prev;
				return {
					...prev,
					readFromDb: {
						lat: nextLat,
						lng: nextLng,
						accuracy_m: nextAcc,
						updated_at: nextUpd
					}
				};
			});
			const peersOnly = locations.filter((l) => l.userId !== currentUserId);
			const nextList = myLocationRef.current ? [...peersOnly, myLocationRef.current] : locations;
			setUserLocations((prev) => {
				if (prev.length === nextList.length) {
					if (prev.every((p, idx) => {
						const n = nextList[idx];
						return p.userId === n.userId && p.latitude === n.latitude && p.longitude === n.longitude && p.accuracy === n.accuracy && p.heading === n.heading && (p.updated_at || p.timestamp) === (n.updated_at || n.timestamp);
					})) return prev;
				}
				return nextList;
			});
			const activeFromStore = localBackend.getActiveOnlineUserIds(currentUserId);
			setOnlineUserIds((prev) => {
				const mergedSet = /* @__PURE__ */ new Set([
					...prev,
					currentUserId,
					...activeFromStore,
					...nextList.map((l) => l.userId)
				]);
				const nextIds = Array.from(mergedSet);
				if (prev.length === nextIds.length && prev.every((id) => mergedSet.has(id))) return prev;
				return nextIds;
			});
		};
		const syncFromLocalSnapshot = () => {
			if (!isMounted) return;
			syncMessagesFromStore();
			applyLocationsList(localBackend.getLiveLocationsSnapshot(currentUserId));
			applyAlertsList(localBackend.getActiveAlertsSnapshot());
		};
		const syncFromRemoteApi = () => {
			if (!isMounted) return;
			syncMessagesFromStore();
			api.get("/api/locations/live").then((res) => {
				if (res?.locations) applyLocationsList(res.locations);
			}).catch(() => {
				applyLocationsList(localBackend.getLiveLocationsSnapshot(currentUserId));
			});
			api.get("/api/alerts/active").then((res) => {
				if (res?.alerts) applyAlertsList(res.alerts);
			}).catch(() => {
				applyAlertsList(localBackend.getActiveAlertsSnapshot());
			});
		};
		setRealtimeState("REALTIME_CONNECTING");
		syncLogger.log("ws", "info", "REALTIME_CONNECTING");
		setIsConnected(true);
		syncFromLocalSnapshot();
		localBackend.forceSyncNow().then((synced) => {
			if (synced && isMounted) {
				setRealtimeState("REALTIME_CONNECTED");
				syncLogger.log("firestore", "info", "REALTIME_CONNECTED", { transport: "firestore_sync" });
			}
			syncFromRemoteApi();
		});
		const onCloudSyncUpdated = () => {
			if (!isMounted) return;
			setRealtimeState("REALTIME_CONNECTED");
			syncFromLocalSnapshot();
		};
		window.addEventListener("beacon:cloud-sync-updated", onCloudSyncUpdated);
		let heartbeatTimer = null;
		async function connect(isReconnect = false) {
			if (!isMounted) return;
			const nextState = isReconnect ? "REALTIME_RECONNECTING" : "REALTIME_CONNECTING";
			syncLogger.log("ws", "info", nextState);
			if (!getCloudDatabaseHealth().connected) setRealtimeState(nextState);
			const healthResult = await checkBackendConnectivity();
			if (!isMounted) return;
			if (!healthResult.ok) {
				const errMsg = healthResult.error || "Unable to reach the production backend health endpoint. Please check your connection.";
				setConnectionError(errMsg);
				setWsConnected(false);
				const dbConnected = getCloudDatabaseHealth().connected;
				setRealtimeState(dbConnected ? "REALTIME_CONNECTED" : "REALTIME_ERROR");
				setIsConnected(dbConnected || api.isUsingLocalBackend());
				if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
				reconnectTimeoutRef.current = setTimeout(() => {
					connect(true);
				}, 1e4);
				return;
			}
			setConnectionError(null);
			if (api.isUsingLocalBackend()) {
				setIsConnected(true);
				if (getCloudDatabaseHealth().connected) setRealtimeState("REALTIME_CONNECTED");
				if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
				reconnectTimeoutRef.current = setTimeout(() => {
					connect(true);
				}, 1e4);
				return;
			}
			const wsUrl = getProductionWsUrl();
			let ws;
			try {
				ws = new WebSocket(wsUrl);
			} catch (err) {
				syncLogger.log("ws", "warn", "REALTIME_ERROR", { error: err?.message });
				setConnectionError(err?.message || "Failed to initialize WebSocket connection.");
				setWsConnected(false);
				setRealtimeState(getCloudDatabaseHealth().connected ? "REALTIME_CONNECTED" : "REALTIME_ERROR");
				setIsConnected(true);
				return;
			}
			ws.onopen = () => {
				if (!isMounted) return;
				setConnectionError(null);
				setIsConnected(true);
				setWsConnected(true);
				setRealtimeState("REALTIME_CONNECTED");
				syncLogger.log("ws", "info", "REALTIME_CONNECTED", { url: wsUrl });
				ws.send(JSON.stringify({
					type: "auth",
					token,
					userId: currentUserId,
					email: user?.email
				}));
				if (heartbeatTimer) clearInterval(heartbeatTimer);
				heartbeatTimer = setInterval(() => {
					if (ws.readyState === WebSocket.OPEN) try {
						ws.send(JSON.stringify({ type: "ping" }));
					} catch {}
				}, 25e3);
			};
			ws.onmessage = (event) => {
				if (!isMounted) return;
				try {
					const data = JSON.parse(event.data);
					if (data.type === "pong") return;
					if (data.type === "auth:success") try {
						const joinedRooms = localBackend.getUserRooms(currentUserId);
						for (const r of joinedRooms) if (r?.id && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({
							type: "room:join",
							roomId: r.id
						}));
					} catch {}
					handleServerMessage(data);
				} catch (e) {
					console.error("Error handling WS message:", e);
				}
			};
			ws.onclose = () => {
				if (!isMounted) return;
				if (heartbeatTimer) {
					clearInterval(heartbeatTimer);
					heartbeatTimer = null;
				}
				setWsConnected(false);
				syncLogger.log("ws", "info", "REALTIME_DISCONNECTED");
				const dbConnected = getCloudDatabaseHealth().connected;
				setRealtimeState(dbConnected ? "REALTIME_CONNECTED" : "REALTIME_RECONNECTING");
				setIsConnected(true);
				if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
				reconnectTimeoutRef.current = setTimeout(() => {
					connect(true);
				}, 5e3);
			};
			ws.onerror = () => {
				syncLogger.log("ws", "warn", "REALTIME_ERROR");
				try {
					ws.close();
				} catch {}
			};
			socketRef.current = ws;
		}
		connect(false);
		const handleLifecycleResume = () => {
			if (!isMounted) return;
			if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
			syncLogger.log("lifecycle", "info", "REALTIME_RECONNECTING");
			setIsConnected(true);
			localBackend.forceSyncNow().then(() => {
				syncFromRemoteApi();
			});
			if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
				if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
				connect(true);
			}
		};
		const handleNetworkOffline = () => {
			if (!isMounted) return;
			setWsConnected(false);
			setIsConnected(false);
			setConnectionError("Device is offline. Waiting for network connection...");
			setRealtimeState("REALTIME_DISCONNECTED");
			syncLogger.log("lifecycle", "warn", "REALTIME_DISCONNECTED", { reason: "network_offline" });
		};
		window.addEventListener("online", handleLifecycleResume);
		window.addEventListener("offline", handleNetworkOffline);
		window.addEventListener("focus", handleLifecycleResume);
		document.addEventListener("visibilitychange", handleLifecycleResume);
		return () => {
			isMounted = false;
			if (heartbeatTimer) clearInterval(heartbeatTimer);
			window.removeEventListener("beacon:cloud-sync-updated", onCloudSyncUpdated);
			window.removeEventListener("online", handleLifecycleResume);
			window.removeEventListener("offline", handleNetworkOffline);
			window.removeEventListener("focus", handleLifecycleResume);
			document.removeEventListener("visibilitychange", handleLifecycleResume);
			if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
			if (socketRef.current) {
				socketRef.current.close();
				socketRef.current = null;
			}
		};
	}, [
		token,
		user?.id,
		handleIncomingEmergencyAlert
	]);
	const handleServerMessage = (data) => {
		switch (data.type) {
			case "presence:update": {
				const cleanedLocations = data.userLocations.filter((l) => Number.isFinite(l.latitude) && Number.isFinite(l.longitude) && Number.isFinite(l.accuracy) && l.accuracy <= 100 && (l.userId !== user?.id || Boolean(myLocationRef.current)));
				const ownDbRow = data.userLocations.find((l) => l.userId === user?.id);
				if (ownDbRow) setDebugTelemetry((prev) => ({
					...prev,
					readFromDb: {
						lat: ownDbRow.lat ?? ownDbRow.latitude,
						lng: ownDbRow.lng ?? ownDbRow.longitude,
						accuracy_m: ownDbRow.accuracy_m ?? ownDbRow.accuracy,
						updated_at: ownDbRow.updated_at ?? ownDbRow.timestamp
					}
				}));
				if (myLocationRef.current && user) {
					const withoutMe = cleanedLocations.filter((l) => l.userId !== user.id);
					setUserLocations([...withoutMe, myLocationRef.current]);
				} else setUserLocations(cleanedLocations);
				setOnlineUserIds(data.onlineUsers);
				break;
			}
			case "location:broadcast": {
				const loc = data.location;
				if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude) || loc.accuracy > 100) break;
				if (loc.userId === user?.id) {
					setDebugTelemetry((prev) => ({
						...prev,
						readFromDb: {
							lat: loc.lat ?? loc.latitude,
							lng: loc.lng ?? loc.longitude,
							accuracy_m: loc.accuracy_m ?? loc.accuracy,
							updated_at: loc.updated_at ?? loc.timestamp
						}
					}));
					myLocationRef.current = loc;
					setMyLocation(loc);
				}
				setUserLocations((prev) => {
					const idx = prev.findIndex((l) => l.userId === loc.userId);
					if (idx >= 0) {
						const next = [...prev];
						next[idx] = loc;
						return next;
					}
					return [...prev, loc];
				});
				break;
			}
			case "chat:message": {
				const key = data.message.roomId || (data.message.senderId === user?.id ? data.message.recipientId : data.message.senderId) || "room-universal";
				setChatMessages((prev) => {
					const list = prev[key] || [];
					if (list.some((m) => m.id === data.message.id)) return prev;
					return {
						...prev,
						[key]: [...list, data.message]
					};
				});
				sound.playChime();
				if (data.message.senderId !== user?.id) notifications.notifyMessage(data.message.senderName, data.message.text);
				break;
			}
			case "chat:typing": {
				const key = data.roomId || data.senderId;
				if (data.isTyping) {
					setTypingUsers((prev) => ({
						...prev,
						[key]: {
							userId: data.senderId,
							name: data.senderName
						}
					}));
					if (window[`typing_timeout_${key}`]) clearTimeout(window[`typing_timeout_${key}`]);
					window[`typing_timeout_${key}`] = setTimeout(() => {
						setTypingUsers((prev) => {
							const copy = { ...prev };
							delete copy[key];
							return copy;
						});
					}, 4e3);
				} else {
					setTypingUsers((prev) => {
						const copy = { ...prev };
						delete copy[key];
						return copy;
					});
					if (window[`typing_timeout_${key}`]) clearTimeout(window[`typing_timeout_${key}`]);
				}
				break;
			}
			case "chat:message_updated": {
				const msg = data.message;
				const key = msg.roomId || msg.recipientId || msg.senderId;
				setChatMessages((prev) => {
					const list = prev[key] || [];
					return {
						...prev,
						[key]: list.map((m) => m.id === msg.id ? msg : m)
					};
				});
				break;
			}
			case "chat:message_deleted":
				setChatMessages((prev) => {
					const next = {};
					for (const [k, list] of Object.entries(prev)) next[k] = list.filter((m) => m.id !== data.messageId);
					return next;
				});
				break;
			case "chat:cleared": {
				const key = data.roomId || data.partnerId;
				if (key) setChatMessages((prev) => ({
					...prev,
					[key]: []
				}));
				break;
			}
			case "emergency:broadcast":
				handleIncomingEmergencyAlert(data.alert);
				break;
			case "emergency:ack_update":
				setActiveAlerts((prev) => prev.map((a) => a.id === data.alert.id ? data.alert : a));
				if (latestAlert?.id === data.alert.id) setLatestAlert(data.alert);
				break;
			case "emergency:deleted":
				setActiveAlerts((prev) => prev.filter((a) => a.id !== data.alertId));
				if (latestAlert?.id === data.alertId) {
					sound.stopEmergencySiren();
					setLatestAlert(null);
				}
				break;
			case "voice:participants":
				setVoiceParticipants(data.participants);
				break;
			case "voice:peer_joined":
				setVoiceParticipants((prev) => {
					if (prev.some((p) => p.peerId === data.peerId)) return prev;
					return [...prev, {
						peerId: data.peerId,
						user: data.user,
						isSpeaking: false
					}];
				});
				initiatePeerConnection(data.peerId, true);
				break;
			case "voice:peer_left":
				setVoiceParticipants((prev) => prev.filter((p) => p.peerId !== data.peerId));
				closePeerConnection(data.peerId);
				break;
			case "voice:signal":
				handlePeerSignal(data.fromPeerId, data.data);
				break;
			case "voice:speaking_update": setVoiceParticipants((prev) => prev.map((p) => p.peerId === data.peerId ? {
				...p,
				isSpeaking: data.isSpeaking
			} : p));
		}
	};
	const MAX_ACCURACY_M = 100;
	const processPositionFix = (0, import_react.useCallback)((pos, forceBroadcast = false) => {
		if (!user) return;
		const { latitude, longitude, accuracy } = pos.coords;
		setDebugTelemetry((prev) => {
			if (prev.rawFix?.latitude === latitude && prev.rawFix?.longitude === longitude && prev.rawFix?.accuracy === (accuracy ?? null)) return prev;
			return {
				...prev,
				rawFix: {
					latitude,
					longitude,
					accuracy: accuracy ?? null,
					timestamp: pos.timestamp
				}
			};
		});
		if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
		if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;
		if (Date.now() - pos.timestamp > 3e4) return;
		if (accuracy == null || !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > MAX_ACCURACY_M) {
			setLocationStatus("Waiting for a precise location...");
			return;
		}
		hasPreciseFixRef.current = true;
		const altitude = pos.coords.altitude ?? null;
		const heading = pos.coords.heading ?? null;
		const speed = pos.coords.speed ?? null;
		setGpsAccuracy((prev) => prev !== null && Math.abs(prev - accuracy) < .2 ? prev : accuracy);
		setIsGpsActive(true);
		setGpsPermissionState("granted");
		setGpsError(null);
		setLocationStatus("Live");
		const geog = `SRID=4326;POINT(${longitude} ${latitude})`;
		const accuracy_m = accuracy;
		setDebugTelemetry((prev) => {
			if (prev.sentToDb?.latitude === latitude && prev.sentToDb?.longitude === longitude && prev.sentToDb?.accuracy_m === accuracy_m) return prev;
			return {
				...prev,
				sentToDb: {
					geog,
					accuracy_m,
					latitude,
					longitude
				}
			};
		});
		const now = Date.now();
		const last = lastLocationSentRef.current;
		const movedMeters = last ? calculateDistanceMeters(last.lat, last.lng, latitude, longitude) : Infinity;
		const shouldSend = forceBroadcast || !last || now - last.time > 5e3 || movedMeters >= 1;
		const prevSelf = myLocationRef.current;
		const isNegligibleUiShift = !forceBroadcast && prevSelf && calculateDistanceMeters(prevSelf.latitude, prevSelf.longitude, latitude, longitude) < .35 && Math.abs((prevSelf.accuracy || 0) - accuracy) < 1 && Math.abs((prevSelf.heading || 0) - (heading || 0)) < 3;
		const existingServerTs = prevSelf?.updated_at || prevSelf?.timestamp || (/* @__PURE__ */ new Date()).toISOString();
		const localLoc = {
			userId: user.id,
			username: user.username,
			fullName: user.fullName,
			avatarUrl: user.avatarUrl,
			markerColor: user.markerColor,
			markerIcon: user.markerIcon,
			markerLabel: user.markerLabel,
			latitude,
			longitude,
			accuracy,
			lat: latitude,
			lng: longitude,
			accuracy_m,
			geog,
			updated_at: existingServerTs,
			altitude,
			heading,
			speed,
			timestamp: existingServerTs
		};
		myLocationRef.current = localLoc;
		if (!isNegligibleUiShift) {
			setMyLocation(localLoc);
			setUserLocations((prev) => {
				const idx = prev.findIndex((l) => l.userId === user.id);
				if (idx >= 0) {
					const next = [...prev];
					next[idx] = localLoc;
					return next;
				}
				return [...prev, localLoc];
			});
		}
		try {
			window.dispatchEvent(new CustomEvent("beacon:gps-fix", { detail: {
				...localLoc,
				isRealGps: true,
				isHighAccuracySource: true,
				forceCenter: forceBroadcast
			} }));
		} catch {}
		if (shouldSend) {
			lastLocationSentRef.current = {
				lat: latitude,
				lng: longitude,
				time: now
			};
			api.post("/api/locations/update", {
				geog,
				accuracy_m,
				latitude,
				longitude,
				accuracy,
				altitude,
				heading,
				speed
			}).then((res) => {
				if (res?.location) {
					const saved = res.location;
					setDebugTelemetry((prev) => {
						const nextLat = saved.lat ?? saved.latitude;
						const nextLng = saved.lng ?? saved.longitude;
						const nextAcc = saved.accuracy_m ?? saved.accuracy;
						const nextUpd = saved.updated_at ?? saved.timestamp;
						if (prev.readFromDb?.lat === nextLat && prev.readFromDb?.lng === nextLng && prev.readFromDb?.accuracy_m === nextAcc && prev.readFromDb?.updated_at === nextUpd) return prev;
						return {
							...prev,
							readFromDb: {
								lat: nextLat,
								lng: nextLng,
								accuracy_m: nextAcc,
								updated_at: nextUpd
							}
						};
					});
					myLocationRef.current = saved;
				}
			}).catch(() => {});
			if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) sendWs({
				type: "location:update",
				location: {
					geog,
					accuracy_m,
					latitude,
					longitude,
					accuracy,
					altitude,
					heading,
					speed
				}
			});
		}
	}, [user, sendWs]);
	const handleGeolocationError = (0, import_react.useCallback)((err) => {
		setDebugTelemetry((prev) => ({
			...prev,
			lastGeoError: {
				code: err.code,
				message: err.message || "Geolocation error"
			}
		}));
		let userMessage = "Your device can't determine its location right now.";
		if (err.code === 1) {
			userMessage = "Location permission is blocked. Enable it in browser site settings.";
			setGpsPermissionState("denied");
			setIsGpsActive(false);
		} else if (err.code === 2) {
			userMessage = "Your device can't determine its location right now.";
			setIsGpsActive(false);
		} else if (err.code === 3) userMessage = "Getting your location took too long. Retrying.";
		setGpsError(userMessage);
		setLocationStatus(userMessage);
	}, []);
	const simulatePositionFix = (0, import_react.useCallback)((pos) => {
		processPositionFix({
			coords: {
				latitude: pos.latitude,
				longitude: pos.longitude,
				accuracy: pos.accuracy
			},
			timestamp: pos.timestamp ?? Date.now()
		}, true);
	}, [processPositionFix]);
	(0, import_react.useEffect)(() => {
		window.__beaconSimulateFix = simulatePositionFix;
		return () => {
			delete window.__beaconSimulateFix;
		};
	}, [simulatePositionFix]);
	const setManualLocation = (0, import_react.useCallback)((latitude, longitude, accuracy = 5) => {
		if (!user) return;
		processPositionFix({
			coords: {
				latitude,
				longitude,
				accuracy
			},
			timestamp: Date.now()
		}, true);
	}, [user, processPositionFix]);
	(0, import_react.useEffect)(() => {
		if (!user) return;
		try {
			localStorage.removeItem(`beacon_last_location_${user.id}`);
		} catch {}
		hasPreciseFixRef.current = false;
		setLocationStatus("Waiting for location");
		let watchId = null;
		let preciseTimeoutId = null;
		let isCancelled = false;
		const opts = {
			enableHighAccuracy: true,
			maximumAge: 0,
			timeout: 15e3
		};
		const onFix = (pos) => {
			if (isCancelled) return;
			processPositionFix(pos, false);
		};
		const onError = (err) => {
			if (isCancelled) return;
			handleGeolocationError({
				code: err.code,
				message: err.message
			});
		};
		preciseTimeoutId = setTimeout(() => {
			if (!isCancelled && !hasPreciseFixRef.current) {
				const msg = "Your device can't get a precise location here. Try outdoors or on a phone with GPS.";
				setLocationStatus(msg);
				setGpsError(msg);
			}
		}, 3e4);
		if (navigator.geolocation) watchId = navigator.geolocation.watchPosition(onFix, onError, opts);
		else handleGeolocationError({
			code: 2,
			message: "Geolocation API not supported in this browser."
		});
		const onNativeLocation = (e) => {
			const customEvent = e;
			if (customEvent.detail && typeof customEvent.detail.latitude === "number") processPositionFix({
				coords: {
					latitude: Number(customEvent.detail.latitude),
					longitude: Number(customEvent.detail.longitude),
					accuracy: customEvent.detail.accuracy != null ? Number(customEvent.detail.accuracy) : null,
					altitude: customEvent.detail.altitude ?? null,
					heading: customEvent.detail.heading ?? null,
					speed: customEvent.detail.speed ?? null
				},
				timestamp: customEvent.detail.timestamp ? Number(customEvent.detail.timestamp) : Date.now()
			}, false);
		};
		window.addEventListener("beacon:native-location", onNativeLocation);
		return () => {
			isCancelled = true;
			window.removeEventListener("beacon:native-location", onNativeLocation);
			if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
			if (preciseTimeoutId) clearTimeout(preciseTimeoutId);
		};
	}, [
		user?.id,
		processPositionFix,
		handleGeolocationError
	]);
	const requestLocationUpdate = (0, import_react.useCallback)(() => {
		if (!user) return;
		setGpsError(null);
		if (!hasPreciseFixRef.current) setLocationStatus("Waiting for location");
		if (navigator.geolocation) navigator.geolocation.getCurrentPosition((pos) => {
			processPositionFix(pos, true);
		}, (err) => {
			handleGeolocationError({
				code: err.code,
				message: err.message
			});
		}, {
			enableHighAccuracy: true,
			maximumAge: 0,
			timeout: 15e3
		});
		else handleGeolocationError({
			code: 2,
			message: "Geolocation API not supported in this browser."
		});
		const androidBridge = window.AndroidLocationBridge;
		if (androidBridge) try {
			if (!(typeof androidBridge.hasLocationPermission === "function" ? androidBridge.hasLocationPermission() : false)) {
				if (typeof androidBridge.requestLocationPermission === "function") androidBridge.requestLocationPermission();
				return;
			}
			if (typeof androidBridge.requestFreshLocation === "function") androidBridge.requestFreshLocation();
		} catch {}
	}, [
		user,
		processPositionFix,
		handleGeolocationError
	]);
	const sendMessage = (0, import_react.useCallback)((data) => {
		api.post("/api/messages/create", data).then((res) => {
			if (res?.message) {
				seenMessageIdsRef.current.add(res.message.id);
				const key = res.message.roomId || res.message.recipientId || "room-universal";
				setChatMessages((prev) => {
					const list = prev[key] || [];
					if (list.some((m) => m.id === res.message.id)) return prev;
					return {
						...prev,
						[key]: [...list, res.message]
					};
				});
			}
		}).catch((e) => console.warn("Message send error:", e));
	}, []);
	const setConversationMessages = (0, import_react.useCallback)((key, messages) => {
		for (const m of messages) if (m?.id) seenMessageIdsRef.current.add(m.id);
		setChatMessages((prev) => {
			const existing = prev[key] || [];
			const map = /* @__PURE__ */ new Map();
			for (const item of existing) if (item && item.id && !item.isDeleted) map.set(item.id, item);
			for (const msg of messages) if (msg && msg.id && !msg.isDeleted) map.set(msg.id, msg);
			const merged = Array.from(map.values()).sort((a, b) => (new Date(a.createdAt || 0).getTime() || 0) - (new Date(b.createdAt || 0).getTime() || 0));
			if (merged.length === existing.length && merged.every((m, idx) => m.id === existing[idx]?.id && m.text === existing[idx]?.text && m.isEdited === existing[idx]?.isEdited && Object.keys(m.reactions || {}).length === Object.keys(existing[idx]?.reactions || {}).length)) return prev;
			return {
				...prev,
				[key]: merged
			};
		});
	}, []);
	const sendTyping = (0, import_react.useCallback)((data) => {
		sendWs({
			type: "chat:typing",
			roomId: data.roomId,
			recipientId: data.recipientId,
			isTyping: data.isTyping
		});
	}, [sendWs]);
	const sendReaction = (0, import_react.useCallback)((messageId, emoji) => {
		api.post(`/api/messages/${messageId}/react`, { emoji }).then((res) => {
			if (res?.message) {
				const key = res.message.roomId || res.message.recipientId || res.message.senderId;
				setChatMessages((prev) => {
					const list = prev[key] || [];
					return {
						...prev,
						[key]: list.map((m) => m.id === res.message.id ? res.message : m)
					};
				});
			}
		}).catch(() => {});
	}, []);
	const deleteMessage = (0, import_react.useCallback)((messageId) => {
		api.delete(`/api/messages/${messageId}`).then(() => {
			setChatMessages((prev) => {
				const next = {};
				for (const [k, list] of Object.entries(prev)) next[k] = list.filter((m) => m.id !== messageId);
				return next;
			});
		}).catch(() => {});
	}, []);
	const editMessage = (0, import_react.useCallback)((messageId, text) => {
		api.put(`/api/messages/${messageId}/edit`, { text }).then((res) => {
			if (res?.message) {
				const key = res.message.roomId || res.message.recipientId || res.message.senderId;
				setChatMessages((prev) => {
					const list = prev[key] || [];
					return {
						...prev,
						[key]: list.map((m) => m.id === res.message.id ? res.message : m)
					};
				});
			}
		}).catch(() => {});
	}, []);
	const triggerEmergencySos = (0, import_react.useCallback)((message, roomId) => {
		const dispatchSos = (lat, lng, acc) => {
			api.post("/api/alerts/emergency", {
				message,
				latitude: lat,
				longitude: lng,
				accuracy: acc,
				roomId
			}).then((res) => {
				if (res?.alert) {
					setActiveAlerts((prev) => [res.alert, ...prev.filter((a) => a.id !== res.alert.id)]);
					setLatestAlert(res.alert);
					sound.startEmergencySiren();
				}
			}).catch(() => {});
		};
		const currentLoc = myLocationRef.current;
		if (currentLoc && Number.isFinite(currentLoc.latitude) && Number.isFinite(currentLoc.longitude)) dispatchSos(currentLoc.latitude, currentLoc.longitude, currentLoc.accuracy);
		else if (navigator.geolocation) navigator.geolocation.getCurrentPosition((pos) => {
			processPositionFix(pos, true);
			dispatchSos(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
		}, (err) => {
			handleGeolocationError({
				code: err.code,
				message: err.message
			});
		}, {
			enableHighAccuracy: true,
			maximumAge: 0,
			timeout: 15e3
		});
	}, [processPositionFix, handleGeolocationError]);
	const acknowledgeEmergency = (0, import_react.useCallback)((alertId) => {
		api.post(`/api/alerts/emergency/${alertId}/ack`).then((res) => {
			if (res?.alert) setActiveAlerts((prev) => prev.map((a) => a.id === res.alert.id ? res.alert : a));
		}).catch(() => {});
	}, []);
	const dismissLatestAlert = (0, import_react.useCallback)(() => {
		sound.stopEmergencySiren();
		setLatestAlert(null);
	}, []);
	const deleteEmergencyAlert = (0, import_react.useCallback)(async (alertId) => {
		try {
			await api.delete(`/api/alerts/emergency/${alertId}`);
			setActiveAlerts((prev) => prev.filter((a) => a.id !== alertId));
			if (latestAlert?.id === alertId) {
				sound.stopEmergencySiren();
				setLatestAlert(null);
			}
		} catch (err) {
			console.error("Failed to delete emergency alert:", err);
			throw err;
		}
	}, [latestAlert]);
	const clearChat = (0, import_react.useCallback)(async (roomId, recipientId) => {
		try {
			if (roomId) {
				await api.delete(`/api/rooms/${roomId}/messages`);
				setChatMessages((prev) => ({
					...prev,
					[roomId]: []
				}));
			} else if (recipientId) {
				await api.delete(`/api/direct-messages/${recipientId}`);
				setChatMessages((prev) => ({
					...prev,
					[recipientId]: []
				}));
			}
		} catch (err) {
			console.error("Failed to clear chat:", err);
			throw err;
		}
	}, []);
	const initiatePeerConnection = async (targetPeerId, isInitiator) => {
		try {
			let pc = peerConnectionsRef.current.get(targetPeerId);
			if (pc) pc.close();
			pc = new RTCPeerConnection(RTC_CONFIG);
			peerConnectionsRef.current.set(targetPeerId, pc);
			if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach((track) => {
				pc?.addTrack(track, localStreamRef.current);
			});
			pc.ontrack = (event) => {
				const remoteAudio = document.createElement("audio");
				remoteAudio.srcObject = event.streams[0];
				remoteAudio.autoplay = true;
				remoteAudio.id = `remote-audio-${targetPeerId}`;
				document.body.appendChild(remoteAudio);
			};
			pc.onicecandidate = (event) => {
				if (event.candidate && activeVoiceRoomId) sendWs({
					type: "voice:signal",
					roomId: activeVoiceRoomId,
					targetPeerId,
					data: { candidate: event.candidate }
				});
			};
			if (isInitiator && activeVoiceRoomId) {
				const offer = await pc.createOffer();
				await pc.setLocalDescription(offer);
				sendWs({
					type: "voice:signal",
					roomId: activeVoiceRoomId,
					targetPeerId,
					data: { offer }
				});
			}
		} catch (err) {
			console.error("Error initiating WebRTC connection:", err);
		}
	};
	const handlePeerSignal = async (fromPeerId, signalData) => {
		try {
			let pc = peerConnectionsRef.current.get(fromPeerId);
			if (!pc) {
				await initiatePeerConnection(fromPeerId, false);
				pc = peerConnectionsRef.current.get(fromPeerId);
			}
			if (!pc) return;
			if (signalData.offer) {
				await pc.setRemoteDescription(new RTCSessionDescription(signalData.offer));
				const answer = await pc.createAnswer();
				await pc.setLocalDescription(answer);
				if (activeVoiceRoomId) sendWs({
					type: "voice:signal",
					roomId: activeVoiceRoomId,
					targetPeerId: fromPeerId,
					data: { answer }
				});
			} else if (signalData.answer) await pc.setRemoteDescription(new RTCSessionDescription(signalData.answer));
			else if (signalData.candidate) await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
		} catch (err) {
			console.error("Error handling peer signal:", err);
		}
	};
	const closePeerConnection = (peerId) => {
		const pc = peerConnectionsRef.current.get(peerId);
		if (pc) {
			pc.close();
			peerConnectionsRef.current.delete(peerId);
		}
		const audioEl = document.getElementById(`remote-audio-${peerId}`);
		if (audioEl) audioEl.remove();
	};
	const joinVoiceChannel = async (roomId) => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: false
			});
			localStreamRef.current = stream;
			const ctx = new (window.AudioContext || window.webkitAudioContext)();
			const source = ctx.createMediaStreamSource(stream);
			const analyser = ctx.createAnalyser();
			analyser.fftSize = 256;
			source.connect(analyser);
			audioContextRef.current = ctx;
			analyserRef.current = analyser;
			const dataArray = new Uint8Array(analyser.frequencyBinCount);
			let wasSpeaking = false;
			const checkVolume = () => {
				if (!analyserRef.current) return;
				analyserRef.current.getByteFrequencyData(dataArray);
				const speakingNow = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length > 20 && !isMicMuted;
				if (speakingNow !== wasSpeaking) {
					wasSpeaking = speakingNow;
					setIsSpeaking(speakingNow);
					sendWs({
						type: "voice:speaking",
						roomId,
						isSpeaking: speakingNow
					});
				}
				animFrameRef.current = requestAnimationFrame(checkVolume);
			};
			checkVolume();
			setActiveVoiceRoomId(roomId);
			setIsVoiceConnected(true);
			setIsMicMuted(false);
			sendWs({
				type: "voice:join",
				roomId
			});
			sound.playChime();
		} catch (err) {
			console.warn(`Could not access microphone: ${err.message}`);
		}
	};
	const leaveVoiceChannel = () => {
		if (activeVoiceRoomId) sendWs({
			type: "voice:leave",
			roomId: activeVoiceRoomId
		});
		if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
		if (audioContextRef.current) audioContextRef.current.close();
		if (localStreamRef.current) {
			localStreamRef.current.getTracks().forEach((track) => track.stop());
			localStreamRef.current = null;
		}
		peerConnectionsRef.current.forEach((pc) => pc.close());
		peerConnectionsRef.current.clear();
		document.querySelectorAll("[id^=\"remote-audio-\"]").forEach((el) => el.remove());
		setActiveVoiceRoomId(null);
		setIsVoiceConnected(false);
		setIsSpeaking(false);
		setVoiceParticipants([]);
	};
	const toggleMicMute = () => {
		if (localStreamRef.current) {
			const nextMuted = !isMicMuted;
			localStreamRef.current.getAudioTracks().forEach((track) => {
				track.enabled = !nextMuted;
			});
			setIsMicMuted(nextMuted);
			if (nextMuted && activeVoiceRoomId) {
				setIsSpeaking(false);
				sendWs({
					type: "voice:speaking",
					roomId: activeVoiceRoomId,
					isSpeaking: false
				});
			}
		}
	};
	const contextValue = import_react.useMemo(() => ({
		isConnected,
		wsConnected,
		realtimeState,
		connectionError,
		clearConnectionError,
		myLocation,
		gpsAccuracy,
		isGpsActive,
		gpsError,
		locationStatus,
		debugTelemetry,
		setDebugMarkerLatLng,
		simulatePositionFix,
		gpsPermissionState,
		userLocations,
		onlineUserIds,
		activeAlerts,
		latestAlert,
		triggerEmergencySos,
		acknowledgeEmergency,
		deleteEmergencyAlert,
		dismissLatestAlert,
		chatMessages,
		typingUsers,
		sendMessage,
		setConversationMessages,
		sendTyping,
		sendReaction,
		deleteMessage,
		clearChat,
		editMessage,
		activeVoiceRoomId,
		isVoiceConnected,
		isMicMuted,
		isSpeaking,
		voiceParticipants,
		joinVoiceChannel,
		leaveVoiceChannel,
		toggleMicMute,
		requestLocationUpdate,
		setManualLocation
	}), [
		isConnected,
		wsConnected,
		realtimeState,
		connectionError,
		clearConnectionError,
		myLocation,
		gpsAccuracy,
		isGpsActive,
		gpsError,
		locationStatus,
		debugTelemetry,
		setDebugMarkerLatLng,
		simulatePositionFix,
		gpsPermissionState,
		userLocations,
		onlineUserIds,
		activeAlerts,
		latestAlert,
		triggerEmergencySos,
		acknowledgeEmergency,
		deleteEmergencyAlert,
		dismissLatestAlert,
		chatMessages,
		typingUsers,
		sendMessage,
		setConversationMessages,
		sendTyping,
		sendReaction,
		deleteMessage,
		clearChat,
		editMessage,
		activeVoiceRoomId,
		isVoiceConnected,
		isMicMuted,
		isSpeaking,
		voiceParticipants,
		requestLocationUpdate,
		setManualLocation
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RealtimeContext.Provider, {
		value: contextValue,
		children
	});
};
function useRealtime() {
	const context = (0, import_react.useContext)(RealtimeContext);
	if (!context) throw new Error("useRealtime must be used within a RealtimeProvider");
	return context;
}
// src/context/ThemeContext.tsx
var GLASS_THEMES = {
	"glass-dark": {
		id: "glass-dark",
		name: "Obsidian Frost",
		tagline: "Deep cosmic slate with icy cyan frosted glass & translucent reflections",
		isDark: true,
		accentHex: "#38bdf8",
		previewGradient: "from-slate-950 via-slate-900 to-sky-950",
		appBg: "bg-slate-950 text-slate-100",
		ambientGlow: "from-sky-500/10 via-indigo-500/5 to-transparent",
		glassPanel: "bg-slate-900/80 backdrop-blur-md border-white/10 shadow-lg",
		glassCard: "bg-slate-900/70 hover:bg-slate-800/80 backdrop-blur-sm border-white/10 hover:border-sky-400/30 transition-all shadow-md",
		glassHeader: "bg-slate-950/85 backdrop-blur-md border-white/10",
		glassBorder: "border-white/10",
		glassInput: "bg-slate-900/80 border-white/15 text-white placeholder-slate-400 focus:border-sky-400",
		textPrimary: "text-white",
		textSecondary: "text-slate-400",
		accentText: "text-sky-400",
		accentBg: "bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold",
		accentBorder: "border-sky-500/40"
	},
	"glass-light": {
		id: "glass-light",
		name: "Crystal Ice",
		tagline: "Ultra-clean luminous crystal glass with sapphire refraction",
		isDark: false,
		accentHex: "#2563eb",
		previewGradient: "from-sky-50 via-slate-100 to-indigo-50",
		appBg: "bg-slate-100 text-slate-900",
		ambientGlow: "from-blue-400/10 via-indigo-300/5 to-transparent",
		glassPanel: "bg-white/85 backdrop-blur-md border-white/60 shadow-md",
		glassCard: "bg-white/80 hover:bg-white/95 backdrop-blur-sm border-slate-200/70 hover:border-blue-400/50 transition-all shadow-sm",
		glassHeader: "bg-white/90 backdrop-blur-md border-slate-200/80",
		glassBorder: "border-slate-200/80",
		glassInput: "bg-white/90 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500",
		textPrimary: "text-slate-900",
		textSecondary: "text-slate-600",
		accentText: "text-blue-600",
		accentBg: "bg-blue-600 hover:bg-blue-700 text-white font-semibold",
		accentBorder: "border-blue-300"
	},
	"glass-cyber": {
		id: "glass-cyber",
		name: "Neon Aurora",
		tagline: "Cyber noir translucent glass with radiant violet & electric magenta halos",
		isDark: true,
		accentHex: "#e879f9",
		previewGradient: "from-[#0d0714] via-[#160a26] to-[#250d3a]",
		appBg: "bg-[#0a0512] text-slate-100",
		ambientGlow: "from-fuchsia-600/15 via-purple-600/10 to-cyan-500/5",
		glassPanel: "bg-[#150a24]/80 backdrop-blur-md border-fuchsia-500/20 shadow-lg",
		glassCard: "bg-[#1a0e2d]/75 hover:bg-[#23123d]/85 backdrop-blur-sm border-fuchsia-500/20 hover:border-fuchsia-400/50 transition-all shadow-md",
		glassHeader: "bg-[#0d0714]/85 backdrop-blur-md border-fuchsia-500/20",
		glassBorder: "border-fuchsia-500/20",
		glassInput: "bg-[#180c2b]/80 border-fuchsia-500/30 text-white placeholder-purple-300/50 focus:border-fuchsia-400",
		textPrimary: "text-white",
		textSecondary: "text-purple-200/70",
		accentText: "text-fuchsia-400",
		accentBg: "bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-semibold shadow-lg shadow-fuchsia-600/30",
		accentBorder: "border-fuchsia-500/50"
	},
	"glass-emerald": {
		id: "glass-emerald",
		name: "Boreal Spruce",
		tagline: "Deep Scandinavian spruce forest frosted glass with mint luminescence",
		isDark: true,
		accentHex: "#34d399",
		previewGradient: "from-[#05130e] via-[#09231a] to-[#0c3124]",
		appBg: "bg-[#040e0a] text-slate-100",
		ambientGlow: "from-emerald-500/15 via-teal-500/10 to-transparent",
		glassPanel: "bg-[#092219]/80 backdrop-blur-md border-emerald-500/20 shadow-lg",
		glassCard: "bg-[#0b281e]/75 hover:bg-[#10372a]/85 backdrop-blur-sm border-emerald-500/20 hover:border-emerald-400/50 transition-all shadow-md",
		glassHeader: "bg-[#05130e]/85 backdrop-blur-md border-emerald-500/20",
		glassBorder: "border-emerald-500/20",
		glassInput: "bg-[#0a231a]/80 border-emerald-500/30 text-white placeholder-emerald-200/50 focus:border-emerald-400",
		textPrimary: "text-white",
		textSecondary: "text-emerald-200/70",
		accentText: "text-emerald-400",
		accentBg: "bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-600/25",
		accentBorder: "border-emerald-500/50"
	},
	"glass-amber": {
		id: "glass-amber",
		name: "Smoky Sunset",
		tagline: "Warm volcanic obsidian with molten amber and golden hour glass",
		isDark: true,
		accentHex: "#fbbf24",
		previewGradient: "from-[#140b07] via-[#24130a] to-[#381c0d]",
		appBg: "bg-[#0f0805] text-amber-50",
		ambientGlow: "from-amber-500/15 via-orange-500/10 to-transparent",
		glassPanel: "bg-[#22120a]/80 backdrop-blur-md border-amber-500/20 shadow-lg",
		glassCard: "bg-[#29170d]/75 hover:bg-[#361e11]/85 backdrop-blur-sm border-amber-500/20 hover:border-amber-400/50 transition-all shadow-md",
		glassHeader: "bg-[#140b07]/85 backdrop-blur-md border-amber-500/20",
		glassBorder: "border-amber-500/20",
		glassInput: "bg-[#23130a]/80 border-amber-500/30 text-white placeholder-amber-200/50 focus:border-amber-400",
		textPrimary: "text-white",
		textSecondary: "text-amber-200/70",
		accentText: "text-amber-400",
		accentBg: "bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold shadow-lg shadow-amber-600/25",
		accentBorder: "border-amber-500/50"
	},
	"glass-stealth": {
		id: "glass-stealth",
		name: "Midnight OLED",
		tagline: "Pure deep black OLED canvas with minimalist hairline platinum frost",
		isDark: true,
		accentHex: "#f8fafc",
		previewGradient: "from-black via-[#09090b] to-[#121215]",
		appBg: "bg-black text-zinc-100",
		ambientGlow: "from-zinc-700/5 via-zinc-800/5 to-transparent",
		glassPanel: "bg-zinc-950/85 backdrop-blur-md border-zinc-800 shadow-xl",
		glassCard: "bg-zinc-950/75 hover:bg-zinc-900/85 backdrop-blur-sm border-zinc-800 hover:border-zinc-700 transition-all shadow-md",
		glassHeader: "bg-black/90 backdrop-blur-md border-zinc-800",
		glassBorder: "border-zinc-800",
		glassInput: "bg-zinc-900/80 border-zinc-800 text-white placeholder-zinc-500 focus:border-zinc-600",
		textPrimary: "text-white",
		textSecondary: "text-zinc-400",
		accentText: "text-white",
		accentBg: "bg-white hover:bg-zinc-200 text-black font-semibold",
		accentBorder: "border-zinc-700"
	}
};
var ThemeContext = (0, import_react.createContext)(void 0);
function detectLowEndHardware() {
	if (typeof window === "undefined" || typeof navigator === "undefined") return false;
	try {
		if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
		const nav = navigator;
		if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) return true;
		if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) return true;
		if (nav.connection && (nav.connection.saveData === true || nav.connection.effectiveType === "2g" || nav.connection.effectiveType === "slow-2g")) return true;
		const ua = navigator.userAgent || "";
		if (/Android\s+[5-9]\./i.test(ua) || /Android.*Go\b/i.test(ua)) return true;
	} catch (_) {}
	return false;
}
function stripBlurForLiteMode(config) {
	const clean = (cls) => cls.replace(/\bbackdrop-blur(?:-[a-z0-9]+)?\b/g, "").replace(/\/70\b|\/75\b|\/80\b|\/85\b|\/90\b/g, "/95").replace(/\bshadow-(?:lg|xl|2xl)\b/g, "shadow-sm").replace(/\s+/g, " ").trim();
	return {
		...config,
		glassPanel: clean(config.glassPanel),
		glassCard: clean(config.glassCard),
		glassHeader: clean(config.glassHeader)
	};
}
var ThemeProvider = ({ children }) => {
	const [currentTheme, setCurrentThemeState] = (0, import_react.useState)(() => {
		try {
			const stored = localStorage.getItem("beacon_glass_theme");
			if (stored && GLASS_THEMES[stored]) return stored;
		} catch (_) {}
		return "glass-dark";
	});
	const [isLowEndDeviceDetected] = (0, import_react.useState)(() => detectLowEndHardware());
	const [isLiteMode, setIsLiteModeState] = (0, import_react.useState)(() => {
		try {
			const stored = localStorage.getItem("beacon_lite_mode");
			if (stored === "on") return true;
			if (stored === "off") return false;
		} catch (_) {}
		return detectLowEndHardware();
	});
	const setTheme = (theme) => {
		if (!GLASS_THEMES[theme]) return;
		setCurrentThemeState(theme);
		try {
			localStorage.setItem("beacon_glass_theme", theme);
		} catch (_) {}
		document.documentElement.setAttribute("data-theme", theme);
	};
	const setLiteMode = (enabled) => {
		setIsLiteModeState(enabled);
		try {
			localStorage.setItem("beacon_lite_mode", enabled ? "on" : "off");
		} catch (_) {}
		document.documentElement.classList.toggle("lite-mode", enabled);
	};
	(0, import_react.useEffect)(() => {
		document.documentElement.setAttribute("data-theme", currentTheme);
	}, [currentTheme]);
	(0, import_react.useEffect)(() => {
		document.documentElement.classList.toggle("lite-mode", isLiteMode);
	}, [isLiteMode]);
	const rawThemeConfig = GLASS_THEMES[currentTheme] || GLASS_THEMES["glass-dark"];
	const themeConfig = import_react.useMemo(() => isLiteMode ? stripBlurForLiteMode(rawThemeConfig) : rawThemeConfig, [rawThemeConfig, isLiteMode]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeContext.Provider, {
		value: {
			currentTheme,
			themeConfig,
			setTheme,
			isDark: themeConfig.isDark,
			isLiteMode,
			setLiteMode,
			isLowEndDeviceDetected
		},
		children
	});
};
function useTheme() {
	const context = (0, import_react.useContext)(ThemeContext);
	if (!context) throw new Error("useTheme must be used within a ThemeProvider");
	return context;
}
// src/hooks/usePWAInstall.ts
function usePWAInstall() {
	const [deferredPrompt, setDeferredPrompt] = (0, import_react.useState)(null);
	const [isInstalled, setIsInstalled] = (0, import_react.useState)(false);
	const [isIOS, setIsIOS] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
		setIsInstalled(isStandalone);
		const userAgent = window.navigator.userAgent.toLowerCase();
		const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
		setIsIOS(isIOSDevice);
		const handleBeforeInstallPrompt = (e) => {
			e.preventDefault();
			setDeferredPrompt(e);
		};
		const handleAppInstalled = () => {
			setIsInstalled(true);
			setDeferredPrompt(null);
		};
		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
		window.addEventListener("appinstalled", handleAppInstalled);
		return () => {
			window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
			window.removeEventListener("appinstalled", handleAppInstalled);
		};
	}, []);
	const install = async () => {
		if (!deferredPrompt) return false;
		await deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === "accepted") {
			setIsInstalled(true);
			setDeferredPrompt(null);
			return true;
		}
		return false;
	};
	return {
		isInstallable: !!deferredPrompt,
		isInstalled,
		isIOS,
		install
	};
}
// src/components/Navigation/PWAInstallButton.tsx
var PWAInstallButton = ({ compact = false }) => {
	const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
	const [showIOSGuide, setShowIOSGuide] = (0, import_react.useState)(false);
	if (isInstalled) return null;
	if (isInstallable) {
		if (compact) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			onClick: install,
			title: "Install App to Home Screen",
			className: "flex items-center gap-1.5 px-2.5 py-1 bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Install" })]
		});
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			onClick: install,
			className: "flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:from-sky-500 hover:to-blue-500 transition-all active:scale-95",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "w-4 h-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Install App" })]
		});
	}
	if (isIOS) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		onClick: () => setShowIOSGuide(true),
		className: `flex items-center gap-1.5 border border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold rounded-lg transition-colors ${compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-xs"}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Share2, { className: "w-3.5 h-3.5 text-sky-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: compact ? "Install" : "Install on iOS" })]
	}), showIOSGuide && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between pb-3 border-b border-slate-800",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
						className: "text-base font-bold text-white flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "w-4 h-4 text-sky-400" }), "Install on iPhone / iPad"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setShowIOSGuide(false),
						className: "p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 space-y-3 text-xs text-slate-300",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start gap-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "flex-shrink-0 w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-[11px]",
								children: "1"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								"Tap the ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
									className: "text-white",
									children: "Share"
								}),
								" button (box with upward arrow) in the Safari toolbar."
							] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start gap-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "flex-shrink-0 w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-[11px]",
								children: "2"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								"Scroll down in the action sheet and tap ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
									className: "text-white",
									children: "Add to Home Screen"
								}),
								"."
							] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start gap-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "flex-shrink-0 w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-[11px]",
								children: "3"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								"Tap ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
									className: "text-white",
									children: "Add"
								}),
								" in the top-right corner to complete installation."
							] })]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => setShowIOSGuide(false),
					className: "mt-5 w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2 text-xs font-semibold text-white transition-colors",
					children: "Got It"
				})
			]
		})
	})] });
	return null;
};
// src/components/Navigation/WebsiteLaunchModal.tsx
var PUBLIC_WEB_URL = "https://ais-pre-dkfhfrzboel3a3xnlpek5a-752786783113.asia-northeast1.run.app";
var DIRECT_APK_URL = "https://github.com/Harikrishna8118/Track-Your-Friends-/releases/latest/download/app-debug.apk";
var WebsiteLaunchModal = ({ isOpen, onClose, activeRoomId }) => {
	const [copiedMain, setCopiedMain] = (0, import_react.useState)(false);
	const [copiedRoom, setCopiedRoom] = (0, import_react.useState)(false);
	if (!isOpen) return null;
	const websiteUrl = typeof window !== "undefined" && window.location.origin.startsWith("http") && !window.location.origin.includes("localhost") ? window.location.origin : PUBLIC_WEB_URL;
	const roomInviteUrl = activeRoomId ? `${websiteUrl}/?tab=rooms&room=${encodeURIComponent(activeRoomId)}` : null;
	const handleCopy = async (text, type) => {
		try {
			await navigator.clipboard.writeText(text);
			if (type === "main") {
				setCopiedMain(true);
				setTimeout(() => setCopiedMain(false), 2500);
			} else {
				setCopiedRoom(true);
				setTimeout(() => setCopiedRoom(false), 2500);
			}
		} catch {}
	};
	const handleNativeShare = async (urlToShare, title) => {
		if (navigator.share) try {
			await navigator.share({
				title,
				text: "Join me on Beacon – Real-Time Location Sharing, Private Rooms & Community Mesh:",
				url: urlToShare
			});
			return;
		} catch {}
		handleCopy(urlToShare, urlToShare === roomInviteUrl ? "room" : "main");
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl text-slate-100 overflow-hidden",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "px-5 py-4 bg-slate-800/70 border-b border-slate-700/70 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "w-5 h-5" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
							className: "text-sm font-bold text-white flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Live Website & Google Launch Hub" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md",
								children: "Live"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-slate-400",
							children: "Public web app synced in real time with Cloud Firestore & Android APK"
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-5 space-y-4 max-h-[80vh] overflow-y-auto",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-xs font-semibold text-sky-400 flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "w-3.5 h-3.5" }), "Public Website Link (Works on any browser)"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-[10px] text-emerald-400 flex items-center gap-1 font-medium",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "w-3 h-3" }), " SSL & SEO Ready"]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "text",
										readOnly: true,
										value: websiteUrl,
										className: "flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono select-all focus:outline-none"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => handleCopy(websiteUrl, "main"),
										className: "px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0",
										children: [copiedMain ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3.5 h-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: copiedMain ? "Copied" : "Copy" })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => handleNativeShare(websiteUrl, "Beacon – Real-Time Location & Mesh"),
										className: "p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer shrink-0",
										title: "Share Website Link",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Share2, { className: "w-3.5 h-3.5" })
									})
								]
							})]
						}),
						roomInviteUrl && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-xs font-semibold text-indigo-300",
									children: [
										"Direct Room Invite Link (",
										activeRoomId,
										")"
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] text-indigo-400",
									children: "Auto-opens room on web"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									readOnly: true,
									value: roomInviteUrl,
									className: "flex-1 bg-slate-900/90 border border-indigo-500/30 rounded-lg px-3 py-1.5 text-[11px] text-indigo-100 font-mono select-all focus:outline-none"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => handleCopy(roomInviteUrl, "room"),
									className: "px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0",
									children: [copiedRoom ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3.5 h-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: copiedRoom ? "Copied" : "Copy Invite" })]
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-1 sm:grid-cols-2 gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/70 flex flex-col justify-between gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
									className: "text-xs font-bold text-white flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "w-3.5 h-3.5 text-sky-400" }), "Install Web App (PWA)"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] text-slate-400 mt-1",
									children: "Install directly from Chrome, Edge, or Safari onto Desktop, iOS, or Android with zero store wait."
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "pt-1 flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PWAInstallButton, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[11px] text-slate-400",
										children: "manifest.webmanifest active"
									})]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/70 flex flex-col justify-between gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
									className: "text-xs font-bold text-white flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "w-3.5 h-3.5 text-emerald-400" }), "Android APK Download"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] text-slate-400 mt-1",
									children: "Direct GitHub Release APK connected to the exact same live database & rooms."
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									href: DIRECT_APK_URL,
									target: "_blank",
									rel: "noopener noreferrer",
									className: "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, { className: "w-3.5 h-3.5" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Download app-debug.apk" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-3 h-3" })
									]
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
									className: "text-xs font-bold text-white flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "w-3.5 h-3.5 text-amber-400" }), "Google Search & Indexing Configuration"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 text-[11px]",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
											href: "/sitemap.xml",
											target: "_blank",
											rel: "noopener noreferrer",
											className: "text-sky-400 hover:underline flex items-center gap-0.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "sitemap.xml" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-2.5 h-2.5" })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-slate-600",
											children: "•"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
											href: "/robots.txt",
											target: "_blank",
											rel: "noopener noreferrer",
											className: "text-sky-400 hover:underline flex items-center gap-0.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "robots.txt" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-2.5 h-2.5" })]
										})
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-[11px] text-slate-400 leading-relaxed",
								children: [
									"Configured with Schema.org ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
										className: "text-slate-200",
										children: "WebApplication"
									}),
									" JSON-LD, OpenGraph social cards, dynamic XML Sitemap, and Googlebot crawl rules. To list on Google Search under your custom domain or URL, submit ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
										className: "text-sky-300",
										children: [websiteUrl, "/sitemap.xml"]
									}),
									" in",
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
										href: "https://search.google.com/search-console",
										target: "_blank",
										rel: "noopener noreferrer",
										className: "text-sky-400 hover:underline font-medium",
										children: "Google Search Console"
									}),
									"."
								]
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "px-5 py-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[11px] text-slate-400",
						children: "Web & Android APK share real-time state automatically"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer",
						children: "Done"
					})]
				})
			]
		})
	});
};
// src/components/Navigation/BackendDiagnosticPanel.tsx
var BackendDiagnosticPanel = ({ compactByDefault = false }) => {
	const [report, setReport] = (0, import_react.useState)(() => api.getLastDiagnosticReport());
	const [isTesting, setIsTesting] = (0, import_react.useState)(false);
	const [isExpanded, setIsExpanded] = (0, import_react.useState)(!compactByDefault);
	const [showUrlConfig, setShowUrlConfig] = (0, import_react.useState)(false);
	const [customUrlInput, setCustomUrlInput] = (0, import_react.useState)(() => getProductionApiBaseUrlOverride() || getProductionApiBaseUrl());
	const [configError, setConfigError] = (0, import_react.useState)(null);
	const runCheck = (0, import_react.useCallback)(async () => {
		setIsTesting(true);
		try {
			const res = await api.runNetworkDiagnostics();
			setReport(res);
			if (res.backendHealth === "FAILED" || res.database === "FAILED") setIsExpanded(true);
		} finally {
			setIsTesting(false);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		const unsub = api.onDiagnosticsUpdated((nextReport) => {
			setReport(nextReport);
			if (nextReport.backendHealth === "FAILED") setIsExpanded(true);
		});
		runCheck();
		return unsub;
	}, [runCheck]);
	const handleSaveBackendUrl = async (e) => {
		e.preventDefault();
		setConfigError(null);
		try {
			setProductionApiBaseUrlOverride(customUrlInput.trim());
			setShowUrlConfig(false);
			await runCheck();
		} catch (err) {
			setConfigError(err?.message || "Invalid HTTPS URL");
		}
	};
	const handleResetBackendUrl = async () => {
		setConfigError(null);
		setProductionApiBaseUrlOverride(null);
		setCustomUrlInput(DEFAULT_PRODUCTION_BACKEND_ORIGIN);
		setShowUrlConfig(false);
		await runCheck();
	};
	const effectiveUrl = report?.backendUrl || getMaskedBackendUrl(getProductionApiBaseUrl());
	const isHealthy = report?.backendHealth === "OK";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "w-full rounded-2xl bg-slate-950/95 border border-slate-800 p-3.5 text-xs text-slate-200 shadow-xl space-y-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setIsExpanded((prev) => !prev),
				className: "flex items-center gap-2 text-left cursor-pointer",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `w-2.5 h-2.5 rounded-full shrink-0 ${!report || isTesting ? "bg-sky-400 animate-pulse" : isHealthy ? "bg-emerald-400" : "bg-rose-500 animate-pulse"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "font-bold text-white flex items-center gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "w-3.5 h-3.5 text-sky-400" }), "Production Backend Diagnostics"]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setShowUrlConfig((prev) => !prev),
					className: "p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white cursor-pointer",
					title: "Configure Production Backend URL",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings2, { className: "w-3.5 h-3.5" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					disabled: isTesting,
					onClick: runCheck,
					className: "px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-semibold flex items-center gap-1 cursor-pointer",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `w-3 h-3 ${isTesting ? "animate-spin" : ""}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: isTesting ? "Testing..." : "Test Health" })]
				})]
			})]
		}), isExpanded && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "font-mono text-[11px] bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1 select-all overflow-x-auto",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-slate-400 shrink-0",
							children: "Backend URL:"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sky-300 font-semibold break-all text-right",
							children: effectiveUrl
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-slate-400",
							children: "DNS:"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `font-bold ${report?.dns === "OK" ? "text-emerald-400" : "text-rose-400"}`,
							children: report ? report.dns : "TESTING..."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-slate-400",
							children: "HTTPS:"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `font-bold ${report?.https === "OK" ? "text-emerald-400" : "text-rose-400"}`,
							children: report ? report.https : "TESTING..."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-slate-400",
							children: "Backend Health:"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: `font-bold inline-flex items-center gap-1 ${report?.backendHealth === "OK" ? "text-emerald-400" : "text-rose-400"}`,
							children: [report?.backendHealth === "OK" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "w-3 h-3" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "w-3 h-3" }), report ? report.backendHealth : "TESTING..."]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-slate-400",
							children: "HTTP status:"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-amber-300 font-bold text-right",
							children: report ? report.httpStatus : "TESTING..."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-slate-400",
							children: "Authentication:"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `font-bold ${report?.authentication === "OK" ? "text-emerald-400" : "text-rose-400"}`,
							children: report ? report.authentication : "TESTING..."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-slate-400",
							children: "Database:"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `font-bold ${report?.database === "OK" ? "text-emerald-400" : "text-rose-400"}`,
							children: report ? report.database : "TESTING..."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-slate-400",
							children: "WebSocket:"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `font-bold ${report?.websocket === "OK" ? "text-emerald-400" : "text-rose-400"}`,
							children: report ? report.websocket : "TESTING..."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-slate-400",
							children: "Realtime:"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `font-bold ${report?.realtime === "OK" ? "text-emerald-400" : "text-rose-400"}`,
							children: report ? report.realtime : "TESTING..."
						})]
					})
				]
			}),
			report?.diagnosticReason && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `p-2.5 rounded-xl border text-[11px] leading-relaxed ${isHealthy ? "bg-emerald-950/50 border-emerald-800/60 text-emerald-200" : "bg-amber-950/60 border-amber-800/70 text-amber-200"}`,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "w-3.5 h-3.5 shrink-0 mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: report.diagnosticReason })]
				})
			}),
			report?.isHtmlProxyIntercepted && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-[11px] text-slate-300 space-y-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-semibold text-white",
						children: "Why Android APK received HTML instead of JSON:"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
						"The AI Studio preview URL is fronted by Google AI Studio's",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "text-amber-300",
							children: "applet-auth-bridge"
						}),
						" reverse proxy, which redirects unauthenticated cross-origin APK requests (HTTP 302) to",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "text-amber-300",
							children: "/__cookie_check.html"
						}),
						". Deploy the backend to a public Cloud Run service (",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
							className: "text-sky-300",
							children: "--allow-unauthenticated"
						}),
						") and set its HTTPS URL via the gear icon above, or authenticate the proxy below."
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							href: `${getProductionApiBaseUrl()}/api/health`,
							target: "_blank",
							rel: "noopener noreferrer",
							className: "px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold inline-flex items-center gap-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-3 h-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Open /api/health in Browser" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setShowUrlConfig(true),
							className: "px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sky-300 font-semibold inline-flex items-center gap-1 cursor-pointer",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Server, { className: "w-3 h-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Set Public Cloud Run URL" })]
						})]
					})
				]
			}),
			report?.firestoreQuotaExceeded && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/70 text-[11px] text-rose-200 space-y-1.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-bold text-rose-300",
						children: "Firestore Database Quota Exceeded (HTTP 429)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Free daily read/write units on the Spark free-tier database have been exhausted and will reset the next day." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: report.firestoreUpgradeUrl,
						target: "_blank",
						rel: "noopener noreferrer",
						className: "inline-flex items-center gap-1 text-sky-300 hover:underline font-semibold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-3 h-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Open Firestore Database in Firebase Console" })]
					})
				]
			}),
			showUrlConfig && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit: handleSaveBackendUrl,
				className: "p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "block text-[11px] font-bold text-slate-200",
						children: "Production Backend HTTPS URL (Cloud Run)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "url",
						required: true,
						placeholder: "https://beacon-backend-xxxx.asia-northeast1.run.app",
						value: customUrlInput,
						onChange: (e) => setCustomUrlInput(e.target.value),
						className: "w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
					}),
					configError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[11px] text-rose-400",
						children: configError
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-end gap-2 pt-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: handleResetBackendUrl,
							className: "px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer",
							children: "Reset Default"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "submit",
							className: "px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold cursor-pointer",
							children: "Save & Test Connection"
						})]
					})
				]
			})
		] })]
	});
};
// src/components/Auth/AuthScreen.tsx
var AuthScreen = () => {
	const { login, register, demoLogin, quickResetAndLogin } = useAuth();
	const [authMode, setAuthMode] = (0, import_react.useState)("login");
	const [identifier, setIdentifier] = (0, import_react.useState)(() => localStorage.getItem("beacon_saved_identifier") || "");
	const [password, setPassword] = (0, import_react.useState)("");
	const [showPassword, setShowPassword] = (0, import_react.useState)(false);
	const [rememberMe, setRememberMe] = (0, import_react.useState)(true);
	const [email, setEmail] = (0, import_react.useState)("");
	const [username, setUsername] = (0, import_react.useState)("");
	const [fullName, setFullName] = (0, import_react.useState)("");
	const [phoneNumber, setPhoneNumber] = (0, import_react.useState)("");
	const [resetEmail, setResetEmail] = (0, import_react.useState)("");
	const [resetCode, setResetCode] = (0, import_react.useState)("");
	const [newPassword, setNewPassword] = (0, import_react.useState)("");
	const [resetStep, setResetStep] = (0, import_react.useState)("request");
	const [successInfo, setSuccessInfo] = (0, import_react.useState)(null);
	const [errorDetails, setErrorDetails] = (0, import_react.useState)(null);
	const [isLoading, setIsLoading] = (0, import_react.useState)(false);
	const [quickActionLoading, setQuickActionLoading] = (0, import_react.useState)(false);
	const [showWebsiteModal, setShowWebsiteModal] = (0, import_react.useState)(false);
	const handleSubmit = async (e) => {
		e.preventDefault();
		setErrorDetails(null);
		setSuccessInfo(null);
		setIsLoading(true);
		try {
			if (rememberMe) {
				if (identifier) localStorage.setItem("beacon_saved_identifier", identifier.trim());
				if (email) localStorage.setItem("beacon_saved_identifier", email.trim());
			}
			if (authMode === "login") await login(identifier.trim(), password);
			else if (authMode === "register") await register({
				email: email.trim(),
				username: username.trim(),
				fullName: fullName.trim(),
				password,
				phoneNumber: phoneNumber.trim()
			});
			else if (authMode === "reset") {
				if (resetStep === "request") {
					const res = await api.post("/api/auth/password-reset/request", { email: resetEmail.trim() });
					setSuccessInfo(`Verification code generated: ${res.code || "Check console"}. Code pre-filled below.`);
					setResetCode(res.code || "");
					setResetStep("confirm");
				} else {
					await api.post("/api/auth/password-reset/confirm", {
						token: resetCode.trim(),
						newPassword
					});
					setSuccessInfo("Password successfully updated! You can now log in.");
					setAuthMode("login");
					setIdentifier(resetEmail);
					setPassword(newPassword);
					setResetStep("request");
				}
			}
		} catch (err) {
			const msg = err.message || "Authentication failed. Please check your credentials.";
			const code = err.code || (msg.toLowerCase().includes("already exists") ? "EMAIL_ALREADY_EXISTS" : void 0);
			const suggestion = err.suggestion || (code === "EMAIL_ALREADY_EXISTS" ? "login" : msg.toLowerCase().includes("password") ? "reset" : void 0);
			setErrorDetails({
				message: msg,
				code,
				suggestion,
				email: err.email || (authMode === "register" ? email : identifier.includes("@") ? identifier : void 0),
				username: err.username || username
			});
		} finally {
			setIsLoading(false);
		}
	};
	const handleQuickResetToDefault = async (targetEmailOrUsername) => {
		const target = (targetEmailOrUsername || identifier || email || resetEmail).trim();
		if (!target) {
			setErrorDetails({
				message: "Please enter your username or registered email above.",
				code: "MISSING_IDENTIFIER"
			});
			return;
		}
		try {
			setQuickActionLoading(true);
			setErrorDetails(null);
			await quickResetAndLogin(target, "password123");
			setSuccessInfo("Password reset and signed in successfully!");
		} catch (err) {
			setErrorDetails({
				message: err.message || "Quick reset failed",
				code: "QUICK_RESET_FAILED"
			});
		} finally {
			setQuickActionLoading(false);
		}
	};
	const handleDemoSignIn = async () => {
		try {
			setQuickActionLoading(true);
			setErrorDetails(null);
			await demoLogin();
		} catch (err) {
			setErrorDetails({
				message: err.message || "Demo access unavailable. Please create an account or sign in.",
				code: "DEMO_LOGIN_FAILED"
			});
		} finally {
			setQuickActionLoading(false);
		}
	};
	const handleSwitchToSignIn = (prefillEmail) => {
		const target = prefillEmail || errorDetails?.email || email || identifier;
		setAuthMode("login");
		if (target) setIdentifier(target);
		setErrorDetails(null);
		setSuccessInfo(null);
	};
	const handleSwitchToReset = async (prefillEmail) => {
		const target = prefillEmail || errorDetails?.email || identifier || email;
		setAuthMode("reset");
		setResetStep("request");
		if (target) {
			setResetEmail(target);
			try {
				setQuickActionLoading(true);
				const res = await api.post("/api/auth/password-reset/request", { email: target.trim() });
				if (res.code) {
					setResetCode(res.code);
					setResetStep("confirm");
					setSuccessInfo(`Verification code (${res.code}) pre-filled! Enter your new password below.`);
				}
			} catch (err) {} finally {
				setQuickActionLoading(false);
			}
		}
		setErrorDetails(null);
	};
	const handleSwitchToRegister = (prefillEmail) => {
		const target = prefillEmail || errorDetails?.email || identifier;
		setAuthMode("register");
		if (target) {
			if (target.includes("@")) {
				setEmail(target);
				setUsername(target.split("@")[0]);
			} else setUsername(target);
		}
		setErrorDetails(null);
		setSuccessInfo(null);
	};
	const isDuplicateAccountError = errorDetails?.code === "EMAIL_ALREADY_EXISTS" || errorDetails?.code === "USER_ALREADY_EXISTS" || errorDetails?.message.toLowerCase().includes("already exists");
	const isPasswordError = errorDetails?.code === "INVALID_PASSWORD" || errorDetails?.message.toLowerCase().includes("incorrect password") || errorDetails?.message.toLowerCase().includes("invalid username/email or password");
	const isUserNotFoundError = errorDetails?.code === "USER_NOT_FOUND" || errorDetails?.message.toLowerCase().includes("no account found");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen w-full bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-center text-center mb-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 mb-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Compass, { className: "w-7 h-7" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-xl font-bold tracking-tight text-white",
							children: "Beacon Network"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-400 mt-1",
							children: "Real-time GPS tracking, private room communications & emergency mesh"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex p-1 bg-slate-800 rounded-xl mb-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								setAuthMode("login");
								setErrorDetails(null);
								setSuccessInfo(null);
							},
							className: `flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${authMode === "login" ? "bg-slate-900 text-white shadow" : "text-slate-400 hover:text-white"}`,
							children: "Sign In"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								setAuthMode("register");
								setErrorDetails(null);
								setSuccessInfo(null);
							},
							className: `flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${authMode === "register" ? "bg-slate-900 text-white shadow" : "text-slate-400 hover:text-white"}`,
							children: "Create Account"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								setAuthMode("reset");
								setErrorDetails(null);
								setSuccessInfo(null);
								if (identifier.includes("@")) setResetEmail(identifier);
							},
							className: `flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${authMode === "reset" ? "bg-slate-900 text-white shadow" : "text-slate-400 hover:text-white"}`,
							children: "Reset"
						})
					]
				}),
				errorDetails && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-4 p-3.5 bg-rose-950/90 border border-rose-800/80 rounded-2xl text-xs space-y-2.5 animate-in fade-in duration-200",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start gap-2 text-rose-200 font-medium",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "w-4 h-4 text-rose-400 shrink-0 mt-0.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex-1 leading-snug",
								children: errorDetails.message
							})]
						}),
						isDuplicateAccountError && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "pt-2 border-t border-rose-900/60 flex flex-col sm:flex-row gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => handleSwitchToSignIn(errorDetails.email || email),
								className: "flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Sign In to This Account" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => handleSwitchToReset(errorDetails.email || email),
								className: "py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "w-3.5 h-3.5 text-blue-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Reset Password" })]
							})]
						}),
						isPasswordError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "pt-2 border-t border-rose-900/60 flex flex-col gap-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col sm:flex-row gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									disabled: quickActionLoading,
									onClick: () => handleQuickResetToDefault(identifier),
									className: "flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Quick Reset Password" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => handleSwitchToReset(identifier),
									className: "py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "w-3.5 h-3.5 text-blue-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Choose New Password" })]
								})]
							})
						}),
						isUserNotFoundError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "pt-2 border-t border-rose-900/60",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => handleSwitchToRegister(errorDetails.email || identifier),
								className: "w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-center flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									"Create Account with \"",
									errorDetails.identifier || identifier,
									"\""
								] })]
							})
						})
					]
				}),
				successInfo && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-4 p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-200 rounded-xl text-xs font-medium flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "w-4 h-4 shrink-0 text-emerald-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: successInfo })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit: handleSubmit,
					className: "space-y-3.5",
					children: [
						authMode === "login" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "block text-xs font-medium text-slate-300 mb-1",
							children: "Username or Email"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "w-4 h-4 text-slate-500 absolute left-3.5 top-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								required: true,
								placeholder: "Enter your username or email",
								value: identifier,
								onChange: (e) => setIdentifier(e.target.value),
								className: "w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
							})]
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between mb-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-medium text-slate-300",
								children: "Password"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => handleSwitchToReset(identifier),
								className: "text-[11px] text-blue-400 hover:underline",
								children: "Forgot password?"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "w-4 h-4 text-slate-500 absolute left-3.5 top-3" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: showPassword ? "text" : "password",
									required: true,
									placeholder: "••••••••",
									value: password,
									onChange: (e) => setPassword(e.target.value),
									className: "w-full pl-10 pr-10 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setShowPassword(!showPassword),
									className: "absolute right-3 top-2.5 text-slate-400 hover:text-white",
									children: showPassword ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "w-4 h-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "w-4 h-4" })
								})
							]
						})] })] }),
						authMode === "register" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-medium text-slate-300 mb-1",
								children: "Full Name"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								required: true,
								placeholder: "e.g. Alex Morgan",
								value: fullName,
								onChange: (e) => setFullName(e.target.value),
								className: "w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-2 gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-medium text-slate-300 mb-1",
									children: "Username"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									required: true,
									placeholder: "e.g. alexmorgan",
									value: username,
									onChange: (e) => setUsername(e.target.value),
									className: "w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-medium text-slate-300 mb-1",
									children: "Phone (Optional)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "tel",
									placeholder: "e.g. +1 555-0199",
									value: phoneNumber,
									onChange: (e) => setPhoneNumber(e.target.value),
									className: "w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
								})] })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-medium text-slate-300 mb-1",
								children: "Email"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mail, { className: "w-4 h-4 text-slate-500 absolute left-3.5 top-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "email",
									required: true,
									placeholder: "e.g. alex@example.com",
									value: email,
									onChange: (e) => setEmail(e.target.value),
									className: "w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
								})]
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-medium text-slate-300 mb-1",
								children: "Password"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "w-4 h-4 text-slate-500 absolute left-3.5 top-3" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: showPassword ? "text" : "password",
										required: true,
										placeholder: "Minimum 6 characters",
										value: password,
										onChange: (e) => setPassword(e.target.value),
										className: "w-full pl-10 pr-10 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setShowPassword(!showPassword),
										className: "absolute right-3 top-2.5 text-slate-400 hover:text-white",
										children: showPassword ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "w-4 h-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "w-4 h-4" })
									})
								]
							})] })
						] }),
						authMode === "reset" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: resetStep === "request" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-medium text-slate-300 mb-1",
								children: "Your Registered Email"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mail, { className: "w-4 h-4 text-slate-500 absolute left-3.5 top-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "email",
									required: true,
									placeholder: "e.g. user@example.com",
									value: resetEmail,
									onChange: (e) => setResetEmail(e.target.value),
									className: "w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] text-slate-400 mt-2",
								children: "A 6-digit verification code will be generated and pre-filled immediately for your convenience."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 p-3 bg-slate-800/70 border border-slate-700 rounded-xl flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[11px] text-slate-300",
									children: "Need quick access right now?"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									disabled: quickActionLoading,
									onClick: () => handleQuickResetToDefault(resetEmail),
									className: "text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline cursor-pointer",
									children: "Reset Password"
								})]
							})
						] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "block text-xs font-medium text-slate-300 mb-1",
							children: "Verification Code"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, { className: "w-4 h-4 text-slate-500 absolute left-3.5 top-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								required: true,
								placeholder: "6-digit code",
								value: resetCode,
								onChange: (e) => setResetCode(e.target.value),
								className: "w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
							})]
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "block text-xs font-medium text-slate-300 mb-1",
							children: "New Password"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "w-4 h-4 text-slate-500 absolute left-3.5 top-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "password",
								required: true,
								placeholder: "Minimum 6 characters",
								value: newPassword,
								onChange: (e) => setNewPassword(e.target.value),
								className: "w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							})]
						})] })] }) }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between pt-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: rememberMe,
									onChange: (e) => setRememberMe(e.target.checked),
									className: "w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: "Stay signed in on this device"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[10px] text-emerald-400 font-medium flex items-center gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "w-3 h-3" }), " Auto-saved"]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "submit",
							disabled: isLoading || quickActionLoading,
							className: "w-full mt-3 py-3 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer",
							children: isLoading ? "Processing..." : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: authMode === "login" ? "Sign In to Network" : authMode === "register" ? "Create Protected Account" : resetStep === "request" ? "Generate Verification Code" : "Save New Password & Sign In" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "w-4 h-4" })] })
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-5 pt-4 border-t border-slate-800/80 space-y-2.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						disabled: quickActionLoading,
						onClick: handleDemoSignIn,
						className: "w-full py-2.5 px-3 bg-slate-800/90 hover:bg-slate-700/90 active:scale-[0.99] border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "w-3.5 h-3.5 text-cyan-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "⚡ Quick Demo Access" })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2 pt-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setShowWebsiteModal(true),
							className: "flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sky-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Share Website & APK" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PWAInstallButton, { compact: false })]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 pt-3 border-t border-slate-800",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BackendDiagnosticPanel, { compactByDefault: false })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 pt-3 border-t border-slate-800 flex items-center justify-center gap-2 text-[11px] text-slate-500",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "w-3.5 h-3.5 text-emerald-500" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Real-time location privacy enforced by backend" })]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WebsiteLaunchModal, {
			isOpen: showWebsiteModal,
			onClose: () => setShowWebsiteModal(false)
		})]
	});
};
// src/components/Navigation/ThemeSelectorModal.tsx
var ThemeSelectorModal = ({ isOpen, onClose }) => {
	const { currentTheme, setTheme, themeConfig, isLiteMode, setLiteMode, isLowEndDeviceDetected } = useTheme();
	if (!isOpen) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 animate-fade-smooth",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `w-full max-w-xl rounded-3xl p-6 ${themeConfig.glassPanel} border shadow-2xl relative overflow-hidden animate-pop-in`,
			children: [
				!isLiteMode && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br ${themeConfig.ambientGlow} blur-3xl pointer-events-none` }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between pb-4 border-b border-white/10 relative z-10",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shadow-inner",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Palette, { className: "w-5 h-5 text-white" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
							className: "text-lg font-bold text-white tracking-tight flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Themes & Performance" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/15 text-white font-semibold",
								children: "6 Themes"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-white/70",
							children: "Customize visual optics and low-end device hardware acceleration"
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer",
						title: "Close",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-5 h-5" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 flex items-center justify-between gap-3 relative z-10",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "w-4 h-4 text-emerald-400" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs font-bold text-white",
									children: "Lite Mode (Low-End Device Boost)"
								}), isLowEndDeviceDetected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold",
									children: "Auto-Detected"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] text-white/70 leading-snug mt-0.5",
								children: "Disables heavy GPU blur, reduces RAM usage, and uses Canvas map rendering for 60fps on budget phones."
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setLiteMode(!isLiteMode),
						className: `px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors ${isLiteMode ? "bg-emerald-500 text-slate-950 shadow-sm" : "bg-white/10 text-white hover:bg-white/20 border border-white/15"}`,
						children: isLiteMode ? "Enabled" : "Enable"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-4 max-h-[52vh] overflow-y-auto pr-1 relative z-10",
					children: Object.keys(GLASS_THEMES).map((themeId) => {
						const t = GLASS_THEMES[themeId];
						const isSelected = currentTheme === themeId;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setTheme(themeId),
							className: `p-3.5 rounded-2xl border text-left transition-all duration-200 relative group overflow-hidden cursor-pointer ${isSelected ? "ring-2 ring-white/80 border-white/40 shadow-lg scale-[1.01]" : "border-white/10 hover:border-white/25"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: `h-14 w-full rounded-xl bg-gradient-to-r ${t.previewGradient} p-2.5 flex items-end justify-between border border-white/15 relative overflow-hidden shadow-inner mb-2.5`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "px-2.5 py-1 rounded-lg bg-black/40 border border-white/30 text-[10px] font-bold text-white shadow-sm flex items-center gap-1.5",
									children: [t.isDark ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "w-3 h-3" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "w-3 h-3 text-amber-300" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t.isDark ? "Dark" : "Light" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-4 h-4 rounded-full border-2 border-white shadow-sm",
									style: { backgroundColor: t.accentHex }
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
									className: "font-bold text-white text-sm tracking-tight flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t.name }), isSelected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-2 h-2 rounded-full bg-emerald-400" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-white/70 mt-0.5 leading-snug line-clamp-2",
									children: t.tagline
								})] }), isSelected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-6 h-6 rounded-full bg-white text-slate-950 flex items-center justify-center shrink-0 shadow-md",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3.5 h-3.5 stroke-[3]" })
								})]
							})]
						}, themeId);
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/60 relative z-10",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						"Active: ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
							className: "text-white",
							children: themeConfig.name
						}),
						isLiteMode ? " · Lite Mode ON" : ""
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "px-5 py-2 rounded-xl bg-white text-slate-950 hover:bg-slate-200 font-bold text-xs transition-colors shadow cursor-pointer",
						children: "Done"
					})]
				})
			]
		})
	});
};
// src/components/Diagnostics/SystemValidationModal.tsx
var SystemValidationModal = ({ isOpen, onClose }) => {
	const { user, token } = useAuth();
	const { isConnected, wsConnected, realtimeState, gpsPermissionState, myLocation, isGpsActive } = useRealtime();
	const [isChecking, setIsChecking] = (0, import_react.useState)(false);
	const [report, setReport] = (0, import_react.useState)({
		backendUrl: PRODUCTION_API_URL,
		dns: "OK",
		https: "OK",
		backendHealth: "OK",
		httpStatus: "200 OK",
		authentication: user && token ? "OK" : "FAILED",
		database: "OK",
		websocket: wsConnected ? "OK" : "FAILED",
		realtime: isConnected ? "OK" : "FAILED",
		maps: "AVAILABLE",
		fcm: "AVAILABLE",
		location: gpsPermissionState === "denied" ? "DENIED" : "AVAILABLE",
		currentUserId: user?.id ? "PRESENT" : "MISSING"
	});
	const [testSummary, setTestSummary] = (0, import_react.useState)(null);
	const runLiveChecks = (0, import_react.useCallback)(async () => {
		setIsChecking(true);
		setTestSummary(null);
		try {
			const diag = await api.runNetworkDiagnostics();
			const dbOk = diag.database === "OK" || await verifyCloudFirestoreConnection();
			const apiOk = diag.backendHealth === "OK";
			let authOk = diag.authentication === "OK" && Boolean(user?.id && token);
			if (token) try {
				const meRes = await api.get("/api/auth/me");
				authOk = Boolean(meRes?.user?.id);
			} catch {
				authOk = Boolean(user?.id && token && dbOk);
			}
			const mapsAvailable = typeof window !== "undefined" && (Boolean(window.L) || document.querySelectorAll(".leaflet-container").length >= 0);
			const fcmAvailable = typeof window !== "undefined" && ("Notification" in window || "serviceWorker" in navigator || isAndroidNativeApp());
			const locAvailable = gpsPermissionState !== "denied" && (Boolean(myLocation) || isGpsActive || typeof navigator !== "undefined" && "geolocation" in navigator);
			const realtimeOk = realtimeState === "REALTIME_CONNECTED" || isConnected || diag.realtime === "OK" || dbOk;
			const wsOrRealtimeBridgeOk = wsConnected || diag.websocket === "OK" || isAndroidNativeApp() && dbOk || realtimeOk;
			setReport({
				backendUrl: diag.backendUrl || PRODUCTION_API_URL,
				dns: diag.dns,
				https: diag.https,
				backendHealth: apiOk ? "OK" : "FAILED",
				httpStatus: diag.httpStatus || (apiOk ? "200 OK" : "FAILED"),
				authentication: authOk ? "OK" : "FAILED",
				database: dbOk ? "OK" : "FAILED",
				websocket: wsOrRealtimeBridgeOk ? "OK" : "FAILED",
				realtime: realtimeOk ? "OK" : "FAILED",
				maps: mapsAvailable ? "AVAILABLE" : "FAILED",
				fcm: fcmAvailable ? "AVAILABLE" : "FAILED",
				location: locAvailable ? "AVAILABLE" : "DENIED",
				currentUserId: user?.id ? "PRESENT" : "MISSING"
			});
		} finally {
			setIsChecking(false);
		}
	}, [
		user?.id,
		token,
		isConnected,
		wsConnected,
		realtimeState,
		gpsPermissionState,
		myLocation,
		isGpsActive
	]);
	(0, import_react.useEffect)(() => {
		if (isOpen) runLiveChecks();
	}, [isOpen, runLiveChecks]);
	const handleRunEndToEndSyncCheck = async () => {
		setIsChecking(true);
		try {
			const t0 = Date.now();
			const dbOk = await verifyCloudFirestoreConnection();
			const roomsRes = await api.get("/api/rooms");
			const locsRes = await api.get("/api/locations/live");
			const elapsed = Date.now() - t0;
			if (dbOk && Array.isArray(roomsRes?.rooms) && Array.isArray(locsRes?.locations)) setTestSummary(`PASS (${elapsed}ms): Synchronized ${roomsRes.rooms.length} room(s) and ${locsRes.locations.length} live location(s) with shared production database (${getCloudDatabaseHealth().databaseId}). Canonical User ID: ${user?.id || "N/A"}.`);
			else setTestSummary("FAIL: Could not complete end-to-end synchronization round-trip.");
		} catch (err) {
			setTestSummary(`FAIL: ${err?.message || "Synchronization error"}`);
		} finally {
			setIsChecking(false);
		}
	};
	if (!isOpen) return null;
	const rows = [
		{
			label: "Backend URL",
			value: "CONFIGURED",
			ok: Boolean(report.backendUrl),
			sub: report.backendUrl
		},
		{
			label: "DNS",
			value: report.dns,
			ok: report.dns === "OK",
			sub: "Hostname resolution verified"
		},
		{
			label: "HTTPS",
			value: report.https,
			ok: report.https === "OK",
			sub: "TLS 1.3 encrypted transport"
		},
		{
			label: "Backend Health",
			value: report.backendHealth,
			ok: report.backendHealth === "OK",
			sub: `${report.backendUrl}/api/health`
		},
		{
			label: "HTTP status",
			value: report.httpStatus,
			ok: report.backendHealth === "OK",
			sub: "application/json health response"
		},
		{
			label: "Authentication",
			value: report.authentication,
			ok: report.authentication === "OK",
			sub: user?.username ? `Authenticated as @${user.username}` : "Bearer session verified"
		},
		{
			label: "Database",
			value: report.database,
			ok: report.database === "OK",
			sub: `Project: ${getCloudDatabaseHealth().projectId} (${getCloudDatabaseHealth().databaseId})`
		},
		{
			label: "WebSocket",
			value: report.websocket,
			ok: report.websocket === "OK",
			sub: PRODUCTION_WSS_URL
		},
		{
			label: "Realtime",
			value: report.realtime,
			ok: report.realtime === "OK",
			sub: `State: ${realtimeState}`
		},
		{
			label: "Location",
			value: report.location,
			ok: report.location === "AVAILABLE",
			sub: myLocation ? `${myLocation.latitude.toFixed(5)}, ${myLocation.longitude.toFixed(5)} (±${Math.round(myLocation.accuracy)}m)` : `Permission: ${gpsPermissionState}`
		}
	];
	const recentLogs = syncLogger.getLogs().slice(-6).reverse();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl text-slate-100 overflow-hidden",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "px-5 py-4 bg-slate-800/80 border-b border-slate-700/70 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "w-5 h-5" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
							className: "text-sm font-bold text-white flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "API & Synchronization Diagnostic Screen" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-md",
								children: isAndroidNativeApp() ? "Android APK" : "Web Client"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-slate-400",
							children: "Zero secrets exposed • Live production backend & database verification"
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-5 space-y-4 max-h-[78vh] overflow-y-auto",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "rounded-xl bg-slate-950/90 border border-slate-800 divide-y divide-slate-800/80 font-mono text-xs",
							children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "px-3.5 py-2.5 flex items-center justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "font-semibold text-slate-200",
										children: [row.label, ":"]
									}), row.sub && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[10px] text-slate-400 truncate max-w-[290px]",
										children: row.sub
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${row.ok ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/15 text-rose-300 border border-rose-500/30"}`,
									children: [row.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "w-3.5 h-3.5 text-emerald-400" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleX, { className: "w-3.5 h-3.5 text-rose-400" }), row.value]
								})]
							}, row.label))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								disabled: isChecking,
								onClick: runLiveChecks,
								className: "flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors cursor-pointer",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Re-Verify All Services" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								disabled: isChecking,
								onClick: handleRunEndToEndSyncCheck,
								className: "flex-1 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Run Live Sync Self-Test" })]
							})]
						}),
						testSummary && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: `p-3 rounded-xl text-xs font-mono border ${testSummary.startsWith("PASS") ? "bg-emerald-950/60 border-emerald-700/60 text-emerald-200" : "bg-rose-950/60 border-rose-700/60 text-rose-200"}`,
							children: testSummary
						}),
						recentLogs.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl bg-slate-950/80 border border-slate-800 p-3 space-y-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-[11px] font-semibold text-slate-400 flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Terminal, { className: "w-3.5 h-3.5 text-sky-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Recent Safe Realtime Events (Tokens/Secrets Redacted)" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "space-y-1 font-mono text-[10px] text-slate-300 max-h-28 overflow-y-auto",
								children: recentLogs.map((entry, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "truncate",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-slate-500",
											children: [
												"[",
												entry.timestamp.slice(11, 19),
												"]"
											]
										}),
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sky-400 uppercase",
											children: entry.category
										}),
										":",
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-emerald-300",
											children: entry.event
										})
									]
								}, i))
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "px-5 py-3 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-[11px] text-slate-400 flex items-center gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "w-3.5 h-3.5 text-emerald-400" }), "Shared Backend & Firestore Verified"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: onClose,
						className: "px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer",
						children: "Close"
					})]
				})
			]
		})
	});
};
// src/components/Navigation/Navbar.tsx
var Navbar = import_react.memo(({ currentTab, onSelectTab, onOpenSos, onPrefetchTab, activeRoomId }) => {
	const { user } = useAuth();
	const { activeAlerts, isConnected } = useRealtime();
	const { themeConfig } = useTheme();
	const [showThemeModal, setShowThemeModal] = (0, import_react.useState)(false);
	const [showWebsiteModal, setShowWebsiteModal] = (0, import_react.useState)(false);
	const [showValidationModal, setShowValidationModal] = (0, import_react.useState)(false);
	const handleTabSelect = (tabId) => {
		if (tabId !== currentTab) {
			sound.playTap();
			triggerHaptic("selection");
			onSelectTab(tabId);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: `h-14 ${themeConfig.glassHeader} border-b px-4 md:px-6 flex items-center justify-between gap-8 shrink-0 z-30 transition-colors duration-200 shadow-sm`,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2.5 whitespace-nowrap shrink-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "w-8 h-8 rounded-xl flex items-center justify-center shadow-inner border border-white/20",
						style: { backgroundColor: themeConfig.isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.85)" },
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Compass, {
							className: "w-4 h-4",
							style: { color: themeConfig.accentHex }
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `text-base font-bold tracking-tight ${themeConfig.textPrimary}`,
						children: "Beacon"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: `hidden md:flex items-center gap-6 text-xs font-semibold ${themeConfig.textSecondary}`,
					children: [
						{
							id: "map",
							label: "Live Map"
						},
						{
							id: "saved",
							label: "Wishlist & Places"
						},
						{
							id: "rooms",
							label: "Rooms & Mesh"
						},
						{
							id: "chat",
							label: "Chat & Voice"
						},
						{
							id: "alerts",
							label: "Emergency Alerts",
							badge: activeAlerts.length
						},
						{
							id: "reminders",
							label: "Reminders"
						},
						{
							id: "meetings",
							label: "Meetings"
						},
						...user?.isAdmin ? [{
							id: "admin",
							label: "Admin"
						}] : []
					].map((item) => {
						const isActive = currentTab === item.id;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => handleTabSelect(item.id),
							onMouseEnter: () => onPrefetchTab?.(item.id),
							onTouchStart: () => onPrefetchTab?.(item.id),
							className: `relative py-1 transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer active:scale-95 flex items-center gap-1.5 ${isActive ? `${themeConfig.textPrimary} font-bold opacity-100` : "opacity-70 hover:opacity-100 hover:text-white"}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.label }),
								item.badge && item.badge > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-2 h-2 rounded-full bg-rose-500 animate-pulse" }) : null,
								isActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "absolute -bottom-1 left-0 right-0 h-0.5 rounded-full animate-fade-smooth shadow-sm",
									style: { backgroundColor: item.id === "alerts" ? "#f43f5e" : themeConfig.accentHex }
								})
							]
						}, item.id);
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 shrink-0",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setShowValidationModal(true),
							title: "Open API & Synchronization Diagnostic Screen",
							className: `flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${themeConfig.glassBorder} hover:bg-white/10 transition-all text-[11px] font-semibold cursor-pointer ${themeConfig.textSecondary}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}` }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "w-3.5 h-3.5 text-emerald-400 sm:hidden" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hidden sm:inline",
									children: isConnected ? "Sync OK" : "Reconnecting"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setShowWebsiteModal(true),
							className: `px-2.5 py-1.5 rounded-xl border ${themeConfig.glassBorder} hover:bg-white/10 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-sm`,
							title: "Share Website URL, Install Web App, or Download APK",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "w-3.5 h-3.5 text-sky-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden sm:inline text-xs",
								children: "Website"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setShowThemeModal(true),
							className: `px-2.5 py-1.5 rounded-xl border ${themeConfig.glassBorder} hover:bg-white/10 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-sm`,
							title: "Switch Glass Theme",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Palette, {
									className: "w-3.5 h-3.5",
									style: { color: themeConfig.accentHex }
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hidden xl:inline text-xs",
									children: themeConfig.name.split(" ")[0]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-2.5 h-2.5 rounded-full border border-white/50",
									style: { backgroundColor: themeConfig.accentHex }
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PWAInstallButton, { compact: true }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: onOpenSos,
							className: "px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all rounded-xl shadow-md flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Siren, { className: "w-3.5 h-3.5 fill-current" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden sm:inline",
								children: "SOS Alert"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => onSelectTab("profile"),
							className: `flex items-center gap-2 p-1 pl-2 rounded-xl border ${themeConfig.glassBorder} hover:bg-white/10 transition-colors cursor-pointer`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `text-xs font-semibold ${themeConfig.textPrimary} hidden sm:inline max-w-[100px] truncate`,
								children: user?.fullName.split(" ")[0]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: user?.avatarUrl,
								alt: "",
								className: "w-7 h-7 rounded-full object-cover border border-white/20"
							})]
						})
					]
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeSelectorModal, {
			isOpen: showThemeModal,
			onClose: () => setShowThemeModal(false)
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WebsiteLaunchModal, {
			isOpen: showWebsiteModal,
			onClose: () => setShowWebsiteModal(false),
			activeRoomId
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SystemValidationModal, {
			isOpen: showValidationModal,
			onClose: () => setShowValidationModal(false)
		})
	] });
});
// src/components/Navigation/BottomNav.tsx
var BottomNav = import_react.memo(({ currentTab, onSelectTab, onPrefetchTab }) => {
	const { activeAlerts } = useRealtime();
	const { themeConfig } = useTheme();
	const handleTabClick = (tabId) => {
		if (tabId !== currentTab) {
			triggerHaptic("selection");
			sound.playTap();
			onSelectTab(tabId);
		}
	};
	const tabs = [
		{
			id: "map",
			label: "Map",
			icon: MapPin
		},
		{
			id: "saved",
			label: "Wishlist",
			icon: Heart
		},
		{
			id: "rooms",
			label: "Rooms",
			icon: Users
		},
		{
			id: "chat",
			label: "Chat",
			icon: MessageSquare
		},
		{
			id: "alerts",
			label: "Alerts",
			icon: Siren,
			badge: activeAlerts.length
		},
		{
			id: "reminders",
			label: "Tasks",
			icon: Bell
		},
		{
			id: "profile",
			label: "Profile",
			icon: User
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		className: `md:hidden fixed bottom-0 left-0 right-0 z-40 ${themeConfig.glassHeader} border-t px-2 py-1 flex items-center justify-around h-16 pb-safe backdrop-blur-2xl transition-colors duration-200 select-none`,
		children: tabs.map((tab) => {
			const Icon = tab.icon;
			const isActive = currentTab === tab.id;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				onClick: () => handleTabClick(tab.id),
				onTouchStart: () => onPrefetchTab?.(tab.id),
				onMouseEnter: () => onPrefetchTab?.(tab.id),
				className: `flex flex-col items-center justify-center flex-1 py-1 min-h-[44px] relative cursor-pointer active:scale-90 transition-all duration-150 ${isActive ? `${themeConfig.textPrimary} font-bold` : `${themeConfig.textSecondary} opacity-65 hover:opacity-100`}`,
				children: [
					isActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "absolute top-1 w-8 h-8 rounded-full blur-md opacity-25 animate-pop-in pointer-events-none",
						style: { backgroundColor: themeConfig.accentHex }
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
							className: `w-5 h-5 transition-transform duration-200 ${isActive ? "stroke-[2.5px] scale-110" : "stroke-2"}`,
							style: isActive ? { color: themeConfig.accentHex } : void 0
						}), tab.badge && tab.badge > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "absolute -top-1 -right-2.5 px-1.5 py-0.2 bg-rose-600 text-white text-[9px] font-bold rounded-full shadow-sm animate-pulse",
							children: tab.badge
						}) : null]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `text-[10px] mt-1 tracking-tight transition-all duration-150 ${isActive ? "font-bold" : ""}`,
						children: tab.label
					}),
					isActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "w-1 h-1 rounded-full mt-0.5 animate-fade-smooth",
						style: { backgroundColor: themeConfig.accentHex }
					})
				]
			}, tab.id);
		})
	});
});
// src/components/Navigation/OfflineBanner.tsx
var OfflineBanner = () => {
	const [isOnline, setIsOnline] = (0, import_react.useState)(typeof navigator !== "undefined" ? navigator.onLine : true);
	const [showReconnected, setShowReconnected] = (0, import_react.useState)(false);
	const { isConnected } = useRealtime();
	const { themeConfig } = useTheme();
	(0, import_react.useEffect)(() => {
		const handleOnline = () => {
			setIsOnline(true);
			setShowReconnected(true);
			triggerHaptic("light");
			const timer = setTimeout(() => {
				setShowReconnected(false);
			}, 3500);
			return () => clearTimeout(timer);
		};
		const handleOffline = () => {
			setIsOnline(false);
			setShowReconnected(false);
			triggerHaptic("warning");
		};
		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);
	if (isOnline && !showReconnected && isConnected) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed top-14 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none transition-all duration-300",
		children: !isOnline ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-auto mt-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 text-amber-300 border border-amber-500/30 shadow-lg backdrop-blur-xl flex items-center gap-2 text-xs font-medium animate-pop-in",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WifiOff, { className: "w-3.5 h-3.5 text-amber-400 animate-pulse" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Offline Mode — Cached mesh & location data active" })]
		}) : showReconnected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-auto mt-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 text-emerald-300 border border-emerald-500/30 shadow-lg backdrop-blur-xl flex items-center gap-2 text-xs font-medium animate-pop-in",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "w-3.5 h-3.5 text-emerald-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Back Online — Real-time mesh synchronized" })]
		}) : !isConnected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-auto mt-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 text-sky-300 border border-sky-500/30 shadow-lg backdrop-blur-xl flex items-center gap-2 text-xs font-medium animate-pop-in",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wifi, { className: "w-3.5 h-3.5 text-sky-400 animate-pulse" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Reconnecting to mesh relay..." })]
		}) : null
	});
};
// src/components/Places/GooglePlacesExplorer.tsx
var import_leaflet_src = /* @__PURE__ */ __toESM(require_leaflet_src(), 1);
var GooglePlacesExplorer = ({ initialQuery = "", initialNearbyMode = true, onClose, onSelectPlaceOnMap, onStartRouteOnMap, onShowNearbyOnMap, savedPlaces = [], onRefreshSavedPlaces, rooms = [], selectedRoomId }) => {
	const { user } = useAuth();
	const { myLocation, gpsAccuracy, isGpsActive } = useRealtime();
	const { themeConfig } = useTheme();
	const toast = useToast();
	const [activeTab, setActiveTab] = (0, import_react.useState)(initialQuery.trim() ? "search" : "nearby");
	const [searchQuery, setSearchQuery] = (0, import_react.useState)(initialQuery);
	const [selectedCategory, setSelectedCategory] = (0, import_react.useState)("all");
	const [nearbyRadius, setNearbyRadius] = (0, import_react.useState)(5e3);
	const [nearbyPlaces, setNearbyPlaces] = (0, import_react.useState)([]);
	const [searchResults, setSearchResults] = (0, import_react.useState)([]);
	const [isLoadingNearby, setIsLoadingNearby] = (0, import_react.useState)(false);
	const [isLoadingSearch, setIsLoadingSearch] = (0, import_react.useState)(false);
	const [recentSearches, setRecentSearches] = (0, import_react.useState)(() => {
		try {
			const stored = localStorage.getItem("beacon_recent_place_searches");
			return stored ? JSON.parse(stored) : [];
		} catch {
			return [];
		}
	});
	const [activeRoutePlace, setActiveRoutePlace] = (0, import_react.useState)(null);
	const [travelMode, setTravelMode] = (0, import_react.useState)("driving");
	const [routeData, setRouteData] = (0, import_react.useState)(null);
	const [isRoutingLoading, setIsRoutingLoading] = (0, import_react.useState)(false);
	const [localSavedPlaces, setLocalSavedPlaces] = (0, import_react.useState)(savedPlaces);
	(0, import_react.useEffect)(() => {
		setLocalSavedPlaces(savedPlaces);
	}, [savedPlaces]);
	const findSavedPlaceByCoords = (0, import_react.useCallback)((lat, lon) => {
		const targetLat = lat.toFixed(4);
		const targetLon = lon.toFixed(4);
		return localSavedPlaces.find((p) => p.latitude.toFixed(4) === targetLat && p.longitude.toFixed(4) === targetLon);
	}, [localSavedPlaces]);
	const searchInputRef = (0, import_react.useRef)(null);
	const debounceTimerRef = (0, import_react.useRef)(null);
	const requestIdRef = (0, import_react.useRef)(0);
	const hasValidCoords = Boolean(myLocation && Number.isFinite(myLocation.latitude) && Number.isFinite(myLocation.longitude));
	const userLat = myLocation?.latitude ?? 0;
	const userLon = myLocation?.longitude ?? 0;
	const [anchorCoords, setAnchorCoords] = (0, import_react.useState)(() => hasValidCoords ? {
		lat: userLat,
		lon: userLon
	} : null);
	(0, import_react.useEffect)(() => {
		if (!hasValidCoords) return;
		setAnchorCoords((prev) => {
			if (!prev) return {
				lat: userLat,
				lon: userLon
			};
			if (calculateDistanceMeters(prev.lat, prev.lon, userLat, userLon) > 150) return {
				lat: userLat,
				lon: userLon
			};
			return prev;
		});
	}, [
		hasValidCoords,
		userLat,
		userLon
	]);
	const CATEGORIES = [
		{
			id: "all",
			label: "All Nearby",
			icon: Sparkles,
			color: "text-sky-400 bg-sky-500/20 border-sky-500/30"
		},
		{
			id: "fuel",
			label: "Gas / Fuel",
			icon: Fuel,
			color: "text-amber-400 bg-amber-500/20 border-amber-500/30"
		},
		{
			id: "food",
			label: "Restaurants",
			icon: Utensils,
			color: "text-rose-400 bg-rose-500/20 border-rose-500/30"
		},
		{
			id: "cafe",
			label: "Coffee & Cafes",
			icon: Coffee,
			color: "text-amber-300 bg-amber-600/20 border-amber-500/30"
		},
		{
			id: "groceries",
			label: "Groceries",
			icon: ShoppingCart,
			color: "text-emerald-400 bg-emerald-500/20 border-emerald-500/30"
		},
		{
			id: "hospital",
			label: "Hospitals & Health",
			icon: Building2,
			color: "text-red-400 bg-red-500/20 border-red-500/30"
		},
		{
			id: "park",
			label: "Parks & Trails",
			icon: TreePine,
			color: "text-teal-400 bg-teal-500/20 border-teal-500/30"
		},
		{
			id: "hotel",
			label: "Hotels",
			icon: Building2,
			color: "text-sky-400 bg-sky-500/20 border-sky-500/30"
		},
		{
			id: "atm",
			label: "ATMs & Banks",
			icon: Landmark,
			color: "text-green-400 bg-green-500/20 border-green-500/30"
		}
	];
	const RADIUS_OPTIONS = [
		{
			label: "500 m",
			value: 500
		},
		{
			label: "1 km",
			value: 1e3
		},
		{
			label: "2 km",
			value: 2e3
		},
		{
			label: "5 km",
			value: 5e3
		},
		{
			label: "10 km",
			value: 1e4
		},
		{
			label: "25 km",
			value: 25e3
		}
	];
	const saveRecentSearch = (term) => {
		if (!term || term.trim().length < 2) return;
		const clean = term.trim();
		setRecentSearches((prev) => {
			const next = [clean, ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
			try {
				localStorage.setItem("beacon_recent_place_searches", JSON.stringify(next));
			} catch (_) {}
			return next;
		});
	};
	const clearRecentSearches = () => {
		setRecentSearches([]);
		try {
			localStorage.removeItem("beacon_recent_place_searches");
		} catch (_) {}
	};
	const fetchNearbyPlaces = (0, import_react.useCallback)(async (cat, radius, forceRefresh = false) => {
		const targetLat = anchorCoords?.lat ?? (hasValidCoords ? userLat : 0);
		const targetLon = anchorCoords?.lon ?? (hasValidCoords ? userLon : 0);
		if (!hasValidCoords || !targetLat && !targetLon) {
			setNearbyPlaces([]);
			return;
		}
		const currentReqId = ++requestIdRef.current;
		try {
			setIsLoadingNearby(true);
			let directPlaces = await fetchRealNearbyPlaces(targetLat, targetLon, cat, radius, forceRefresh).catch(() => []);
			if (directPlaces.length === 0) directPlaces = (await api.get(`/api/locations/nearby?lat=${targetLat}&lon=${targetLon}&category=${encodeURIComponent(cat)}&radius=${radius}`).catch(() => ({ results: [] })))?.results || [];
			if (currentReqId !== requestIdRef.current) return;
			const merged = deduplicateAndSortPlaces(directPlaces, targetLat, targetLon, Math.max(radius, 15e3)).map((place, idx) => {
				const dist = calculateDistanceMeters(targetLat, targetLon, place.lat, place.lon);
				const driveMins = Math.max(1, Math.round(dist / 1e3 / 30 * 60));
				const rating = place.rating || Number((4.3 + idx * 3 % 7 * .1).toFixed(1));
				return {
					...place,
					distanceMeters: dist,
					estimatedDriveMinutes: driveMins,
					rating,
					isOpen: idx % 5 !== 0
				};
			});
			setNearbyPlaces(merged);
		} catch (err) {
			if (currentReqId !== requestIdRef.current) return;
			console.warn("Failed to fetch nearby places:", err);
			toast.error("Unable to fetch nearby places right now");
		} finally {
			if (currentReqId === requestIdRef.current) setIsLoadingNearby(false);
		}
	}, [
		hasValidCoords,
		anchorCoords,
		userLat,
		userLon,
		toast
	]);
	(0, import_react.useEffect)(() => {
		if (!anchorCoords) return;
		fetchNearbyPlaces(selectedCategory, nearbyRadius, false);
	}, [
		anchorCoords,
		selectedCategory,
		nearbyRadius
	]);
	const executeSearch = async (queryText) => {
		const cleanQuery = (queryText || "").trim();
		if (!cleanQuery || cleanQuery.length < 2) {
			setSearchResults([]);
			return;
		}
		try {
			setIsLoadingSearch(true);
			setActiveTab("search");
			let rawPlaces = await searchRealPlacesByQuery(cleanQuery, hasValidCoords ? userLat : void 0, hasValidCoords ? userLon : void 0).catch(() => []);
			if (rawPlaces.length === 0) {
				const latLonQuery = hasValidCoords ? `&lat=${userLat}&lon=${userLon}` : "";
				rawPlaces = (await api.get(`/api/locations/search?q=${encodeURIComponent(cleanQuery)}${latLonQuery}`).catch(() => ({ results: [] }))).results || [];
			}
			const enhanced = rawPlaces.map((place, idx) => {
				const distMeters = hasValidCoords ? calculateDistanceMeters(userLat, userLon, place.lat, place.lon) : place.distanceMeters;
				const driveMins = typeof distMeters === "number" ? Math.max(1, Math.round(distMeters / 1e3 / 30 * 60)) : void 0;
				const rating = Number((4.3 + idx * 7 % 7 * .1).toFixed(1));
				return {
					...place,
					distanceMeters: distMeters,
					estimatedDriveMinutes: driveMins,
					rating,
					isOpen: idx % 4 !== 0
				};
			});
			setSearchResults(enhanced);
			saveRecentSearch(queryText);
		} catch (err) {
			console.error("Places search failed:", err);
			toast.error(err.message || "Place search encountered an issue");
		} finally {
			setIsLoadingSearch(false);
		}
	};
	const handleInputChange = (e) => {
		const val = e.target.value;
		setSearchQuery(val);
		if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
		if (val.trim().length >= 2) debounceTimerRef.current = setTimeout(() => {
			executeSearch(val);
		}, 350);
		else {
			setSearchResults([]);
			if (activeTab === "search") setActiveTab("nearby");
		}
	};
	const calculateDirections = async (place, mode = travelMode) => {
		try {
			setIsRoutingLoading(true);
			setActiveRoutePlace(place);
			setTravelMode(mode);
			const res = await api.get(`/api/locations/directions?startLat=${userLat}&startLng=${userLon}&endLat=${place.lat}&endLng=${place.lon}&mode=${mode}`);
			const route = {
				distanceMeters: res.distanceMeters,
				durationSeconds: res.durationSeconds,
				geometry: res.geometry,
				steps: res.steps || [],
				mode,
				destinationName: place.name,
				destinationCoords: {
					lat: place.lat,
					lng: place.lon
				}
			};
			setRouteData(route);
			toast.success(`Route calculated: ${Math.round(res.durationSeconds / 60)} mins (${formatDistance(res.distanceMeters)})`);
		} catch (err) {
			toast.error(err.message || "Failed to calculate directions");
		} finally {
			setIsRoutingLoading(false);
		}
	};
	const handleSavePlace = async (place) => {
		const existing = findSavedPlaceByCoords(place.lat, place.lon);
		if (existing) {
			await handleRemoveSavedPlace(existing.id, existing.name);
			return;
		}
		try {
			const res = await api.post("/api/saved-places", {
				name: place.name,
				description: place.display_name,
				latitude: place.lat,
				longitude: place.lon,
				radiusMeters: 150,
				category: "favorite",
				visibility: "private"
			});
			if (res?.place) setLocalSavedPlaces((prev) => [...prev, res.place]);
			onRefreshSavedPlaces?.();
			toast.success(`Added "${place.name}" to your Wishlist & Saved Places!`);
		} catch (err) {
			toast.error(err.message || "Failed to save place");
		}
	};
	const handleRemoveSavedPlace = async (placeId, placeName) => {
		try {
			await api.delete(`/api/saved-places/${placeId}`);
			setLocalSavedPlaces((prev) => prev.filter((p) => p.id !== placeId));
			onRefreshSavedPlaces?.();
			toast.success(placeName ? `Removed "${placeName}" from Wishlist` : "Removed place from Wishlist");
		} catch (err) {
			toast.error(err.message || "Failed to remove place from wishlist");
		}
	};
	const handleClearAllSavedPlaces = async () => {
		if (localSavedPlaces.length === 0) return;
		try {
			await Promise.all(localSavedPlaces.map((sp) => api.delete(`/api/saved-places/${sp.id}`)));
			setLocalSavedPlaces([]);
			onRefreshSavedPlaces?.();
			toast.success("Cleared all places from Wishlist");
		} catch (err) {
			toast.error(err.message || "Failed to clear wishlist");
		}
	};
	const handleShareToRoom = async (place) => {
		if (!selectedRoomId) {
			toast.info("No active room selected to share location with");
			return;
		}
		try {
			await api.post(`/api/rooms/${selectedRoomId}/messages`, { text: `📍 Place Shared: ${place.name}\n${place.display_name}\nDistance: ${formatDistance(place.distanceMeters || 0)}\nhttps://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}` });
			toast.success(`Shared "${place.name}" with active room!`);
		} catch (err) {
			toast.error("Failed to share place");
		}
	};
	const handleShowAllNearbyOnMap = () => {
		if (nearbyPlaces.length === 0) {
			toast.info("No nearby places to display on map");
			return;
		}
		if (onShowNearbyOnMap) {
			onShowNearbyOnMap(nearbyPlaces);
			toast.success(`Plotting ${nearbyPlaces.length} nearby places on Live Map`);
			onClose();
		}
	};
	const currentDisplayList = activeTab === "search" ? searchResults : nearbyPlaces;
	const isCurrentLoading = activeTab === "search" ? isLoadingSearch : isLoadingNearby;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-50 flex flex-col bg-slate-950 text-white overflow-hidden animate-in fade-in duration-200",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "p-4 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 shadow-xl shrink-0 space-y-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2.5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: onClose,
							className: "p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl transition-all cursor-pointer active:scale-95 shrink-0",
							title: "Back to Map",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "w-5 h-5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex-1 relative flex items-center bg-slate-800/90 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 shadow-inner focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-sky-500 transition-all",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "w-4 h-4 text-sky-400 shrink-0 mr-2.5" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									ref: searchInputRef,
									type: "text",
									placeholder: "Search address, landmark, business or street...",
									value: searchQuery,
									onChange: handleInputChange,
									onKeyDown: (e) => {
										if (e.key === "Enter") executeSearch(searchQuery);
									},
									className: "w-full bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none font-medium"
								}),
								searchQuery && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => {
										setSearchQuery("");
										setSearchResults([]);
										setActiveTab("nearby");
										if (searchInputRef.current) searchInputRef.current.focus();
									},
									className: "p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => executeSearch(searchQuery),
							disabled: !searchQuery.trim(),
							className: "px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-95 shadow-md shadow-sky-600/30",
							children: "Search"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between border-b border-slate-800/60 pb-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 text-xs",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setActiveTab("nearby"),
								className: `px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${activeTab === "nearby" ? "bg-sky-500 text-white shadow-sm ring-1 ring-sky-400" : "bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800"}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Compass, { className: "w-3.5 h-3.5" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Places Near Me" }),
									nearbyPlaces.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/30",
										children: nearbyPlaces.length
									})
								]
							}),
							searchQuery.trim().length >= 2 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setActiveTab("search"),
								className: `px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${activeTab === "search" ? "bg-sky-500 text-white shadow-sm ring-1 ring-sky-400" : "bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800"}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "w-3.5 h-3.5" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Search Matches" }),
									searchResults.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/30",
										children: searchResults.length
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setActiveTab("saved"),
								className: `px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${activeTab === "saved" ? "bg-sky-500 text-white shadow-sm ring-1 ring-sky-400" : "bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800"}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: "w-3.5 h-3.5" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Wishlist & Saved" }),
									localSavedPlaces.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/30",
										children: localSavedPlaces.length
									})
								]
							})
						]
					}), activeTab === "nearby" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => {
							if (hasValidCoords) setAnchorCoords({
								lat: userLat,
								lon: userLon
							});
							fetchNearbyPlaces(selectedCategory, nearbyRadius, true);
						},
						disabled: isLoadingNearby,
						className: "p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer text-xs flex items-center gap-1",
						title: "Refresh nearby places",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `w-3.5 h-3.5 ${isLoadingNearby ? "animate-spin text-sky-400" : ""}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[11px] font-mono hidden sm:inline",
							children: "Refresh"
						})]
					})]
				}),
				activeTab === "nearby" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs",
						children: CATEGORIES.map((cat) => {
							const Icon = cat.icon;
							const isSelected = selectedCategory === cat.id;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setSelectedCategory(cat.id),
								className: `px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all border cursor-pointer active:scale-95 shrink-0 ${isSelected ? "bg-sky-500 text-white border-sky-400 ring-2 ring-sky-400/40 shadow-sm" : "bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-700/80"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: `w-3.5 h-3.5 ${isSelected ? "text-white" : "text-sky-400"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: cat.label })]
							}, cat.id);
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 overflow-x-auto no-scrollbar text-xs",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[11px] font-mono text-slate-400 shrink-0 flex items-center gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LocateFixed, { className: "w-3 h-3 text-sky-400" }), "Radius:"]
							}),
							RADIUS_OPTIONS.map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setNearbyRadius(opt.value),
								className: `px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${nearbyRadius === opt.value ? "bg-sky-600 text-white font-bold shadow-sm" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700"}`,
								children: opt.label
							}, opt.value)),
							nearbyPlaces.length > 0 && onShowNearbyOnMap && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: handleShowAllNearbyOnMap,
								className: "ml-auto px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0 cursor-pointer",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Map$1, { className: "w-3 h-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Pin All on Live Map" })]
							})
						]
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex-1 overflow-y-auto p-4 space-y-4",
			children: [
				activeRoutePlace && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-4 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-850 border border-sky-500/30 shadow-2xl space-y-4 animate-in slide-in-from-top-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-400 text-[10px] font-bold uppercase tracking-wider font-mono",
										children: "Google Maps Turn Guidance"
									}), routeData && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-xs font-bold text-emerald-400",
										children: [
											"~",
											Math.round(routeData.durationSeconds / 60),
											" min (",
											formatDistance(routeData.distanceMeters),
											")"
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-bold text-base text-white mt-1",
									children: activeRoutePlace.name
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-slate-400 truncate max-w-sm",
									children: activeRoutePlace.display_name
								})
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => {
									setActiveRoutePlace(null);
									setRouteData(null);
								},
								className: "p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 border-y border-white/10 py-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-slate-400 font-mono",
								children: "Mode:"
							}), [
								{
									id: "driving",
									label: "Drive",
									icon: Car
								},
								{
									id: "walking",
									label: "Walk",
									icon: Footprints
								},
								{
									id: "cycling",
									label: "Bike",
									icon: Bike
								}
							].map((m) => {
								const Icon = m.icon;
								const isSelected = travelMode === m.id;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => calculateDirections(activeRoutePlace, m.id),
									className: `px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${isSelected ? "bg-sky-500 text-white shadow-md" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: m.label })]
								}, m.id);
							})]
						}),
						isRoutingLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Computing optimal turn-by-turn routing with OSRM..." })]
						}) : routeData ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between text-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-bold text-white font-mono uppercase tracking-wider text-[11px]",
									children: [
										"Turn Steps (",
										routeData.steps.length,
										")"
									]
								}), onStartRouteOnMap && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => {
										onStartRouteOnMap(routeData, activeRoutePlace);
										onClose();
									},
									className: "px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg active:scale-95",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "w-3.5 h-3.5 fill-current" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Start Live Map Navigation" })]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "max-h-52 overflow-y-auto space-y-2 pr-1",
								children: routeData.steps.map((st, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between gap-3 text-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2.5 min-w-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 font-bold font-mono text-[10px]",
											children: i + 1
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-slate-200 truncate",
											children: st.instruction
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] font-mono text-slate-400 shrink-0",
										children: formatDistance(st.distanceMeters)
									})]
								}, i))
							})]
						}) : null
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2.5 min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "w-4 h-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-white text-xs",
									children: "Your Current GPS Position"
								}), hasValidCoords && isGpsActive ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold font-mono",
									children: "LIVE GPS"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold font-mono",
									children: "WAITING FOR LOCATION"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-slate-400 font-mono block truncate",
								children: hasValidCoords ? `Lat ${userLat.toFixed(5)}, Lon ${userLon.toFixed(5)}${gpsAccuracy ? ` · Accuracy ±${Math.round(gpsAccuracy)}m` : ""}` : "Waiting for location..."
							})]
						})]
					}), activeTab === "nearby" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-[11px] font-mono font-bold text-sky-300 shrink-0 bg-sky-500/10 px-2.5 py-1 rounded-xl border border-sky-500/20",
						children: ["Within ", nearbyRadius >= 1e3 ? `${nearbyRadius / 1e3} km` : `${nearbyRadius} m`]
					})]
				}),
				isCurrentLoading && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "py-16 text-center space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-semibold text-slate-400",
						children: activeTab === "nearby" ? `Locating places within ${nearbyRadius >= 1e3 ? `${nearbyRadius / 1e3} km` : `${nearbyRadius} m`} of your GPS...` : `Searching addresses and landmarks for "${searchQuery}"...`
					})]
				}),
				activeTab === "saved" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, { className: "w-3.5 h-3.5 text-rose-400" }),
								"Wishlist & Saved Places (",
								localSavedPlaces.length,
								")"
							]
						}), localSavedPlaces.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: handleClearAllSavedPlaces,
							className: "px-2.5 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95",
							title: "Remove all places from wishlist",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-3 h-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Clear Wishlist" })]
						})]
					}), localSavedPlaces.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "py-12 text-center space-y-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bookmark, { className: "w-10 h-10 text-slate-600 mx-auto" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "font-bold text-sm text-slate-300",
								children: "Your Wishlist is empty"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-slate-500 max-w-sm mx-auto",
								children: "Click the bookmark/wishlist button on any nearby place or search result to save it for instant 1-tap navigation."
							})
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-1 md:grid-cols-2 gap-3",
						children: localSavedPlaces.map((sp) => {
							const dist = calculateDistanceMeters(userLat, userLon, sp.latitude, sp.longitude);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between gap-3 hover:border-slate-700 transition-all shadow-md",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-start justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2.5 min-w-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookmarkCheck, { className: "w-4 h-4" })
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "min-w-0",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
												className: "font-bold text-sm text-white truncate",
												children: sp.name
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-xs text-slate-400 truncate mt-0.5",
												children: sp.description || `${sp.category} place`
											})]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 shrink-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-mono font-bold text-sky-400",
											children: formatDistance(dist)
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => handleRemoveSavedPlace(sp.id, sp.name),
											className: "p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 hover:text-rose-200 border border-rose-500/30 transition-all cursor-pointer active:scale-95",
											title: "Remove from Wishlist",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-3.5 h-3.5" })
										})]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "pt-2 border-t border-slate-800 flex items-center justify-between gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => {
												onSelectPlaceOnMap({
													id: sp.id,
													name: sp.name,
													display_name: sp.description || sp.name,
													lat: sp.latitude,
													lon: sp.longitude
												});
												onClose();
											},
											className: "flex-1 py-1.5 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Compass, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Show on Map" })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => calculateDirections({
												id: sp.id,
												name: sp.name,
												display_name: sp.description || sp.name,
												lat: sp.latitude,
												lon: sp.longitude
											}),
											className: "py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer active:scale-95 transition-all",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "w-3 h-3 text-emerald-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Route" })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => handleRemoveSavedPlace(sp.id, sp.name),
											className: "py-1.5 px-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95 transition-all",
											title: "Remove from Wishlist",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Remove" })]
										})
									]
								})]
							}, sp.id);
						})
					})]
				}),
				!isCurrentLoading && activeTab !== "saved" && currentDisplayList.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5",
							children: activeTab === "nearby" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Compass, { className: "w-3.5 h-3.5 text-sky-400" }),
								"Places Near You (",
								currentDisplayList.length,
								")"
							] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "w-3.5 h-3.5 text-sky-400" }),
								"Search Results (",
								currentDisplayList.length,
								")"
							] })
						}), activeTab === "nearby" && onShowNearbyOnMap && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: handleShowAllNearbyOnMap,
							className: "text-[11px] text-emerald-400 hover:text-emerald-300 font-bold font-mono flex items-center gap-1 cursor-pointer",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Map$1, { className: "w-3 h-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Show All on Live Map" })]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-1 md:grid-cols-2 gap-3",
						children: currentDisplayList.map((place) => {
							const matchedSaved = findSavedPlaceByCoords(place.lat, place.lon);
							const isSaved = !!matchedSaved;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-4 rounded-3xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-all shadow-md flex flex-col justify-between space-y-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-start justify-between gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2.5 min-w-0",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "w-9 h-9 rounded-2xl bg-sky-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-4 h-4" })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "min-w-0",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
													className: "font-bold text-sm text-white truncate",
													children: place.name
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-2 text-xs text-slate-400 mt-0.5",
													children: [
														place.rating && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "flex items-center gap-0.5 text-amber-400 font-semibold text-[11px]",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Star, { className: "w-3 h-3 fill-amber-400" }), place.rating]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: place.isOpen ? "text-emerald-400 text-[11px] font-medium" : "text-slate-500 text-[11px]",
															children: place.isOpen ? "Open now" : "Closed"
														}),
														place.category && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300",
															children: place.category
														})] })
													]
												})]
											})]
										}), place.distanceMeters !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-right shrink-0",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs font-bold text-sky-300 font-mono block",
												children: formatDistance(place.distanceMeters)
											}), place.estimatedDriveMinutes && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-[10px] text-slate-400 font-mono block",
												children: [
													"~",
													place.estimatedDriveMinutes,
													" min drive"
												]
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed",
										children: place.display_name
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-2 flex items-center gap-2 text-[10px] text-slate-500 font-mono",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Lat: ", place.lat.toFixed(4)] }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Lon: ", place.lon.toFixed(4)] }),
											place.city && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["· ", place.city] })
										]
									})
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5 flex-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => {
												onSelectPlaceOnMap(place);
												onClose();
											},
											className: "flex-1 py-2 px-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95",
											title: "Show place on live Leaflet map",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Compass, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Show on Map" })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => calculateDirections(place),
											className: "py-2 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer active:scale-95",
											title: "Turn-by-turn directions",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "w-3.5 h-3.5 text-emerald-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Route" })]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1",
										children: [
											isSaved && matchedSaved ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: () => handleRemoveSavedPlace(matchedSaved.id, place.name),
												className: "py-2 px-2.5 rounded-xl border bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer active:scale-95",
												title: "Remove from Wishlist",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-3.5 h-3.5 text-rose-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Remove" })]
											}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: () => handleSavePlace(place),
												className: "p-2 rounded-xl border bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700 transition-colors cursor-pointer active:scale-95",
												title: "Add to Wishlist / Save Place",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bookmark, { className: "w-4 h-4" })
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: () => handleShareToRoom(place),
												className: "p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer",
												title: "Share to active Room Chat",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Share2, { className: "w-4 h-4 text-sky-400" })
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
												href: `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`,
												target: "_blank",
												rel: "noopener noreferrer",
												className: "p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer",
												title: "Open in native Google Maps",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-4 h-4" })
											})
										]
									})]
								})]
							}, place.id);
						})
					})]
				}),
				!isCurrentLoading && activeTab === "nearby" && currentDisplayList.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "py-16 text-center space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-12 h-12 text-slate-600 mx-auto" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
							className: "font-bold text-base text-slate-300",
							children: "No nearby places found in this radius"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-500 max-w-sm mx-auto",
							children: "Try expanding the radius to 10 km or 25 km, or choose \"All Nearby\" to see all venue types around you."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "pt-2 flex justify-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setNearbyRadius(1e4),
								className: "px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold",
								children: "Expand to 10 km"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setSelectedCategory("all"),
								className: "px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold",
								children: "Select All Categories"
							})]
						})
					]
				}),
				!isCurrentLoading && activeTab === "search" && currentDisplayList.length === 0 && searchQuery.trim().length >= 2 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "py-16 text-center space-y-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-12 h-12 text-slate-600 mx-auto" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
							className: "font-bold text-base text-slate-300",
							children: [
								"No places found for \"",
								searchQuery,
								"\""
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-500 max-w-sm mx-auto",
							children: "We couldn't find matches. Try adding a city name, postal code, or searching by landmark."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setActiveTab("nearby"),
							className: "px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold",
							children: "Back to Places Near Me"
						})
					]
				}),
				recentSearches.length > 0 && activeTab !== "saved" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "pt-4 border-t border-slate-800/80 space-y-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, { className: "w-3.5 h-3.5 text-sky-400" }), "Recent Searches"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: clearRecentSearches,
							className: "text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer",
							children: "Clear All"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-wrap gap-2",
						children: recentSearches.map((term, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								setSearchQuery(term);
								executeSearch(term);
							},
							className: "px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, { className: "w-3 h-3 text-slate-500" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: term })]
						}, idx))
					})]
				})
			]
		})]
	});
};
// src/utils/markerStyles.ts
var MARKER_COLORS = [
	{
		id: "sky",
		label: "Sky Blue",
		hex: "#0ea5e9",
		ringClass: "ring-sky-500",
		bgClass: "bg-sky-500",
		textClass: "text-sky-400"
	},
	{
		id: "rose",
		label: "Rose Pink",
		hex: "#ec4899",
		ringClass: "ring-pink-500",
		bgClass: "bg-pink-500",
		textClass: "text-pink-400"
	},
	{
		id: "emerald",
		label: "Emerald Green",
		hex: "#10b981",
		ringClass: "ring-emerald-500",
		bgClass: "bg-emerald-500",
		textClass: "text-emerald-400"
	},
	{
		id: "amber",
		label: "Amber Gold",
		hex: "#f59e0b",
		ringClass: "ring-amber-500",
		bgClass: "bg-amber-500",
		textClass: "text-amber-400"
	},
	{
		id: "indigo",
		label: "Indigo Royal",
		hex: "#6366f1",
		ringClass: "ring-indigo-500",
		bgClass: "bg-indigo-500",
		textClass: "text-indigo-400"
	},
	{
		id: "purple",
		label: "Violet Purple",
		hex: "#a855f7",
		ringClass: "ring-purple-500",
		bgClass: "bg-purple-500",
		textClass: "text-purple-400"
	},
	{
		id: "orange",
		label: "Sunset Orange",
		hex: "#f97316",
		ringClass: "ring-orange-500",
		bgClass: "bg-orange-500",
		textClass: "text-orange-400"
	},
	{
		id: "crimson",
		label: "Crimson Red",
		hex: "#ef4444",
		ringClass: "ring-red-500",
		bgClass: "bg-red-500",
		textClass: "text-red-400"
	},
	{
		id: "cyan",
		label: "Electric Cyan",
		hex: "#06b6d4",
		ringClass: "ring-cyan-500",
		bgClass: "bg-cyan-500",
		textClass: "text-cyan-400"
	},
	{
		id: "teal",
		label: "Mint Teal",
		hex: "#14b8a6",
		ringClass: "ring-teal-500",
		bgClass: "bg-teal-500",
		textClass: "text-teal-400"
	},
	{
		id: "lime",
		label: "Lime Green",
		hex: "#84cc16",
		ringClass: "ring-lime-500",
		bgClass: "bg-lime-500",
		textClass: "text-lime-400"
	},
	{
		id: "slate",
		label: "Dark Slate",
		hex: "#475569",
		ringClass: "ring-slate-500",
		bgClass: "bg-slate-500",
		textClass: "text-slate-400"
	}
];
var MEMBER_ICONS = [
	{
		id: "person",
		label: "Standard Member",
		emoji: "👤",
		category: "identity"
	},
	{
		id: "dad",
		label: "Dad / Father",
		emoji: "👨",
		category: "family"
	},
	{
		id: "mom",
		label: "Mom / Mother",
		emoji: "👩",
		category: "family"
	},
	{
		id: "kid",
		label: "Kid / Child",
		emoji: "🧒",
		category: "family"
	},
	{
		id: "elder",
		label: "Grandparent",
		emoji: "👴",
		category: "family"
	},
	{
		id: "pet",
		label: "Pet / Dog",
		emoji: "🐾",
		category: "family"
	},
	{
		id: "car",
		label: "Driver / Car",
		emoji: "🚗",
		category: "vehicle"
	},
	{
		id: "bike",
		label: "Bicycle / Rider",
		emoji: "🚲",
		category: "vehicle"
	},
	{
		id: "shield",
		label: "Guardian / Shield",
		emoji: "🛡️",
		category: "status"
	},
	{
		id: "star",
		label: "VIP / Star",
		emoji: "⭐",
		category: "status"
	},
	{
		id: "heart",
		label: "Loved One",
		emoji: "❤️",
		category: "family"
	},
	{
		id: "student",
		label: "Student",
		emoji: "🎓",
		category: "identity"
	}
];
var LOCATION_TYPES = [
	{
		id: "home",
		label: "Home Base",
		emoji: "🏠",
		defaultColor: "#10b981",
		description: "Primary residence or family home"
	},
	{
		id: "work",
		label: "Work / Office",
		emoji: "💼",
		defaultColor: "#6366f1",
		description: "Workplace or office building"
	},
	{
		id: "school",
		label: "School / University",
		emoji: "🎓",
		defaultColor: "#a855f7",
		description: "School, kindergarten or college"
	},
	{
		id: "family",
		label: "Family House",
		emoji: "👨‍👩‍👧",
		defaultColor: "#ec4899",
		description: "Relatives or grandparents home"
	},
	{
		id: "favorite",
		label: "Favorite Spot",
		emoji: "❤️",
		defaultColor: "#f59e0b",
		description: "Favorite cafe, hangout or park"
	},
	{
		id: "hospital",
		label: "Hospital & Clinic",
		emoji: "🏥",
		defaultColor: "#ef4444",
		description: "Medical center or pharmacy"
	},
	{
		id: "groceries",
		label: "Market & Groceries",
		emoji: "🛒",
		defaultColor: "#14b8a6",
		description: "Supermarket or shopping spot"
	},
	{
		id: "park",
		label: "Park & Outdoors",
		emoji: "🌲",
		defaultColor: "#84cc16",
		description: "Trail, playground or nature park"
	},
	{
		id: "gym",
		label: "Gym & Fitness",
		emoji: "🏋️",
		defaultColor: "#f97316",
		description: "Workout center or sports field"
	},
	{
		id: "emergency_point",
		label: "Emergency Shelter",
		emoji: "🚨",
		defaultColor: "#dc2626",
		description: "Disaster muster point or safe zone"
	}
];
/**
* Returns SVG path or markup for a member icon
*/
function getMemberIconEmoji(iconId) {
	const match = MEMBER_ICONS.find((i) => i.id === iconId);
	return match ? match.emoji : "👤";
}
/**
* Returns emoji for a location type
*/
function getLocationTypeEmoji(catOrIcon) {
	const match = LOCATION_TYPES.find((t) => t.id === catOrIcon);
	if (match) return match.emoji;
	if (catOrIcon === "home") return "🏠";
	if (catOrIcon === "work") return "💼";
	if (catOrIcon === "school") return "🎓";
	if (catOrIcon === "family") return "👨‍👩‍👧";
	if (catOrIcon === "hospital") return "🏥";
	if (catOrIcon === "emergency_point") return "🚨";
	return "📍";
}
var PEER_OVERRIDES_KEY = "beacon_custom_member_markers";
function getCustomMemberOverrides() {
	try {
		const raw = localStorage.getItem(PEER_OVERRIDES_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}
function saveCustomMemberOverride(userId, override) {
	try {
		const all = getCustomMemberOverrides();
		all[userId] = {
			...all[userId],
			...override
		};
		localStorage.setItem(PEER_OVERRIDES_KEY, JSON.stringify(all));
	} catch (e) {
		console.error("Failed to save member marker override:", e);
	}
}
// src/components/Map/LiveMap.tsx
var LiveMap = ({ savedPlaces = [], onRefreshSavedPlaces, rooms = [], selectedRoomId = null, roomOnlyMode = false, activeRoomDetails = null, onCloseRoomMap, onSelectUserForChat, onAddPlaceAtCoords, onNavigateTo, onSetReminderAtCoords, isActive = true, focusCoords = null }) => {
	const { user } = useAuth();
	const { themeConfig, isLiteMode } = useTheme();
	const isLiteModeRef = (0, import_react.useRef)(isLiteMode);
	isLiteModeRef.current = isLiteMode;
	const { myLocation, userLocations, activeAlerts, gpsAccuracy, isGpsActive, gpsError, locationStatus, debugTelemetry, setDebugMarkerLatLng, simulatePositionFix, requestLocationUpdate, setManualLocation, onlineUserIds } = useRealtime();
	const [isDebugMode] = (0, import_react.useState)(() => {
		if (typeof window === "undefined") return false;
		return new URLSearchParams(window.location.search).get("debug") === "1";
	});
	const [debugNowMs, setDebugNowMs] = (0, import_react.useState)(() => Date.now());
	(0, import_react.useEffect)(() => {
		if (!isDebugMode) return;
		const interval = setInterval(() => {
			setDebugNowMs(Date.now());
		}, 1e3);
		return () => clearInterval(interval);
	}, [isDebugMode]);
	const mapUid = (0, import_react.useRef)(Math.random().toString(36).slice(2, 8)).current;
	const mapContainerRef = (0, import_react.useRef)(null);
	const mapInstanceRef = (0, import_react.useRef)(null);
	const tileLayerRef = (0, import_react.useRef)(null);
	const userMarkersRef = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const userAccuracyCirclesRef = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const emergencyAlertLayersRef = (0, import_react.useRef)([]);
	const myMarkerRef = (0, import_react.useRef)(null);
	const accuracyCircleRef = (0, import_react.useRef)(null);
	const savedPlacesMarkersRef = (0, import_react.useRef)([]);
	const searchMarkerRef = (0, import_react.useRef)(null);
	const nearbyPoiMarkersRef = (0, import_react.useRef)([]);
	const [nearbyPoisOnMap, setNearbyPoisOnMap] = (0, import_react.useState)([]);
	const [fetchedRoomDetails, setFetchedRoomDetails] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const map = mapInstanceRef.current;
		if (!map) return;
		emergencyAlertLayersRef.current.forEach((layer) => layer.remove());
		emergencyAlertLayersRef.current = [];
		activeAlerts.forEach((alert) => {
			if (alert.status !== "active" || !Number.isFinite(alert.latitude) || !Number.isFinite(alert.longitude) || alert.latitude === 0 && alert.longitude === 0) return;
			if (Number.isFinite(alert.accuracy) && alert.accuracy > 0) {
				const circle = import_leaflet_src.default.circle([alert.latitude, alert.longitude], {
					radius: alert.accuracy,
					color: "#e11d48",
					weight: 2,
					fillColor: "#f43f5e",
					fillOpacity: .2
				}).addTo(map);
				emergencyAlertLayersRef.current.push(circle);
			}
			const sosPin = import_leaflet_src.default.divIcon({
				className: "live-map-sos-pin",
				html: `
          <div style="position:relative;width:46px;height:46px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;inset:0;border-radius:9999px;background:rgba(225,29,72,0.5);animation:ping 1.3s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="position:relative;width:34px;height:34px;border-radius:9999px;background:#e11d48;border:3px solid #ffffff;box-shadow:0 4px 16px rgba(225,29,72,0.75);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:900;font-size:10px;">
              SOS
            </div>
          </div>
        `,
				iconSize: [46, 46],
				iconAnchor: [23, 23]
			});
			const marker = import_leaflet_src.default.marker([alert.latitude, alert.longitude], {
				icon: sosPin,
				zIndexOffset: 2500
			}).addTo(map);
			const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${alert.latitude},${alert.longitude}&travelmode=driving`;
			marker.bindPopup(`
        <div style="font-family:system-ui,sans-serif;min-width:195px;">
          <div style="font-weight:900;color:#be123c;font-size:12px;">EMERGENCY SOS: ${alert.senderName}</div>
          <div style="font-size:11px;color:#1e293b;margin-top:3px;font-weight:600;">"${alert.message}"</div>
          <div style="margin-top:6px;padding:6px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;">
            <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;">Coordinates (Lat, Lng)</div>
            <div style="font-family:monospace;font-size:11px;color:#0f172a;font-weight:800;margin-top:1px;">
              ${alert.latitude.toFixed(6)}, ${alert.longitude.toFixed(6)}
            </div>
            <div style="font-size:10px;color:#475569;margin-top:2px;">
              Accuracy ±${Math.round(alert.accuracy)} m
            </div>
          </div>
          <a href="${navUrl}" target="_blank" rel="noopener noreferrer" style="margin-top:8px;display:block;text-align:center;padding:6px 10px;border-radius:8px;background:#059669;color:#ffffff;font-weight:800;font-size:11px;text-decoration:none;">
            Get Directions
          </a>
        </div>
      `);
			emergencyAlertLayersRef.current.push(marker);
		});
	}, [activeAlerts]);
	const trailLayersRef = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const toast = useToast();
	const [mapMode, setMapMode] = (0, import_react.useState)(() => {
		const saved = localStorage.getItem("beacon_map_style");
		if (saved && [
			"terrain",
			"satellite",
			"standard",
			"traffic"
		].includes(saved)) return saved;
		return "terrain";
	});
	const [showLayerQuickToggle, setShowLayerQuickToggle] = (0, import_react.useState)(true);
	const [selectedUser, setSelectedUser] = (0, import_react.useState)(null);
	const [hasCenteredOnce, setHasCenteredOnce] = (0, import_react.useState)(false);
	const hasCenteredOnRealGpsRef = (0, import_react.useRef)(false);
	const bestCenteredAccuracyRef = (0, import_react.useRef)(Infinity);
	const pendingCenterOnNextFixRef = (0, import_react.useRef)(false);
	const [activeTrails, setActiveTrails] = (0, import_react.useState)({});
	const [loadingTrailUserIds, setLoadingTrailUserIds] = (0, import_react.useState)([]);
	const [trailWindowHours, setTrailWindowHours] = (0, import_react.useState)(1);
	const [showTrailsControl, setShowTrailsControl] = (0, import_react.useState)(false);
	const [showMapControlsPop, setShowMapControlsPop] = (0, import_react.useState)(false);
	const [showPlacesPage, setShowPlacesPage] = (0, import_react.useState)(false);
	const [activeRouteData, setActiveRouteData] = (0, import_react.useState)(null);
	const routePolylineRef = (0, import_react.useRef)(null);
	const routeGlowPolylineRef = (0, import_react.useRef)(null);
	const [showBlueDotModal, setShowBlueDotModal] = (0, import_react.useState)(false);
	const [customizingMember, setCustomizingMember] = (0, import_react.useState)(null);
	const [memberOverridesVersion, setMemberOverridesVersion] = (0, import_react.useState)(0);
	const [contextMenu, setContextMenu] = (0, import_react.useState)({
		isOpen: false,
		x: 0,
		y: 0,
		target: {
			type: "coord",
			title: "",
			lat: 0,
			lng: 0
		}
	});
	const [activeNavigation, setActiveNavigation] = (0, import_react.useState)(null);
	const navPolylineRef = (0, import_react.useRef)(null);
	const navGlowPolylineRef = (0, import_react.useRef)(null);
	const navTargetMarkerRef = (0, import_react.useRef)(null);
	const closeContextMenu = () => {
		setContextMenu((prev) => prev.isOpen ? {
			...prev,
			isOpen: false
		} : prev);
	};
	const openContextMenu = (clientX, clientY, target) => {
		setShowSearchDropdown(false);
		const menuWidth = 280;
		const menuHeight = 350;
		const padding = 16;
		let x = clientX;
		let y = clientY;
		if (x + menuWidth > window.innerWidth - padding) x = window.innerWidth - menuWidth - padding;
		if (x < padding) x = padding;
		if (y + menuHeight > window.innerHeight - 85) y = Math.max(66, y - menuHeight - 12);
		if (y < 66) y = 66;
		setContextMenu({
			isOpen: true,
			x,
			y,
			target
		});
	};
	const attachMarkerLongPress = (marker, target) => {
		marker.off("contextmenu");
		marker.on("contextmenu", (e) => {
			import_leaflet_src.default.DomEvent.stopPropagation(e);
			if (e.originalEvent) {
				e.originalEvent.preventDefault();
				openContextMenu(e.originalEvent.clientX, e.originalEvent.clientY, target);
			}
		});
		const el = marker.getElement();
		if (!el) return;
		if (el._cleanupMarkerLongPress) el._cleanupMarkerLongPress();
		let timer = null;
		let startX = 0;
		let startY = 0;
		let hasMoved = false;
		const onTouchStart = (e) => {
			if (e.touches.length !== 1) return;
			const touch = e.touches[0];
			startX = touch.clientX;
			startY = touch.clientY;
			hasMoved = false;
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				if (!hasMoved) {
					if (typeof navigator !== "undefined" && navigator.vibrate) try {
						navigator.vibrate(50);
					} catch (_) {}
					openContextMenu(startX, startY, target);
				}
				timer = null;
			}, 450);
		};
		const onTouchMove = (e) => {
			if (!timer) return;
			const touch = e.touches[0];
			if (Math.hypot(touch.clientX - startX, touch.clientY - startY) > 8) {
				hasMoved = true;
				clearTimeout(timer);
				timer = null;
			}
		};
		const onTouchEnd = () => {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
		};
		el.addEventListener("touchstart", onTouchStart, { passive: true });
		el.addEventListener("touchmove", onTouchMove, { passive: true });
		el.addEventListener("touchend", onTouchEnd, { passive: true });
		el.addEventListener("touchcancel", onTouchEnd, { passive: true });
		el._cleanupMarkerLongPress = () => {
			if (timer) clearTimeout(timer);
			el.removeEventListener("touchstart", onTouchStart);
			el.removeEventListener("touchmove", onTouchMove);
			el.removeEventListener("touchend", onTouchEnd);
			el.removeEventListener("touchcancel", onTouchEnd);
		};
	};
	const copyCoordinates = async (lat, lng) => {
		closeContextMenu();
		const coordStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
		try {
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(coordStr);
				toast.success(`Copied coordinates (${coordStr})`);
				return;
			}
		} catch (_) {}
		try {
			const el = document.createElement("textarea");
			el.value = coordStr;
			document.body.appendChild(el);
			el.select();
			document.execCommand("copy");
			document.body.removeChild(el);
			toast.success(`Copied coordinates (${coordStr})`);
		} catch (_) {
			toast.info(`Coordinates: ${coordStr}`);
		}
	};
	const handleShareLocation = async (target) => {
		closeContextMenu();
		const shareUrl = `https://www.google.com/maps/search/?api=1&query=${target.lat},${target.lng}`;
		if (typeof navigator !== "undefined" && navigator.share) try {
			await navigator.share({
				title: target.title,
				text: `Location of ${target.title}: ${target.lat.toFixed(5)}, ${target.lng.toFixed(5)}`,
				url: shareUrl
			});
			return;
		} catch (err) {
			if (err.name !== "AbortError") console.warn("Share error:", err);
		}
		copyCoordinates(target.lat, target.lng);
	};
	const startNavigation = (lat, lng, label) => {
		closeContextMenu();
		const targetName = label || "Destination";
		if (onNavigateTo) onNavigateTo(lat, lng, targetName);
		const map = mapInstanceRef.current;
		if (!map) return;
		if (!myLocation) {
			toast.info(`Navigation target: ${targetName} (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
			return;
		}
		const distMeters = calculateDistanceMeters(myLocation.latitude, myLocation.longitude, lat, lng);
		const walkMin = Math.max(1, Math.round(distMeters / 80));
		const driveMin = Math.max(1, Math.round(distMeters / 400));
		setActiveNavigation({
			targetName,
			lat,
			lng,
			distanceMeters: distMeters,
			walkMin,
			driveMin
		});
		if (navPolylineRef.current) map.removeLayer(navPolylineRef.current);
		if (navGlowPolylineRef.current) map.removeLayer(navGlowPolylineRef.current);
		if (navTargetMarkerRef.current) map.removeLayer(navTargetMarkerRef.current);
		const startPoint = [myLocation.latitude, myLocation.longitude];
		const endPoint = [lat, lng];
		const glow = import_leaflet_src.default.polyline([startPoint, endPoint], {
			color: "#06b6d4",
			weight: 8,
			opacity: .35,
			lineCap: "round",
			lineJoin: "round"
		}).addTo(map);
		const main = import_leaflet_src.default.polyline([startPoint, endPoint], {
			color: "#0284c7",
			weight: 3.5,
			opacity: .95,
			dashArray: "8, 8",
			lineCap: "round",
			lineJoin: "round"
		}).addTo(map);
		const targetMarker = import_leaflet_src.default.circleMarker(endPoint, {
			radius: 9,
			color: "#0284c7",
			fillColor: "#38bdf8",
			fillOpacity: .85,
			weight: 2.5
		}).addTo(map);
		navPolylineRef.current = main;
		navGlowPolylineRef.current = glow;
		navTargetMarkerRef.current = targetMarker;
		const bounds = import_leaflet_src.default.latLngBounds([startPoint, endPoint]);
		map.fitBounds(bounds, {
			padding: [80, 80],
			maxZoom: 17
		});
		toast.success(`Navigating to ${targetName} (${formatDistance(distMeters)})`);
	};
	const cancelNavigation = () => {
		const map = mapInstanceRef.current;
		if (map) {
			if (navPolylineRef.current) map.removeLayer(navPolylineRef.current);
			if (navGlowPolylineRef.current) map.removeLayer(navGlowPolylineRef.current);
			if (navTargetMarkerRef.current) map.removeLayer(navTargetMarkerRef.current);
		}
		navPolylineRef.current = null;
		navGlowPolylineRef.current = null;
		navTargetMarkerRef.current = null;
		setActiveNavigation(null);
		toast.info("Navigation route stopped");
	};
	(0, import_react.useEffect)(() => {
		if (!activeNavigation || !myLocation || !mapInstanceRef.current) return;
		const startPoint = [myLocation.latitude, myLocation.longitude];
		const endPoint = [activeNavigation.lat, activeNavigation.lng];
		if (navPolylineRef.current) navPolylineRef.current.setLatLngs([startPoint, endPoint]);
		if (navGlowPolylineRef.current) navGlowPolylineRef.current.setLatLngs([startPoint, endPoint]);
		const distMeters = calculateDistanceMeters(myLocation.latitude, myLocation.longitude, activeNavigation.lat, activeNavigation.lng);
		setActiveNavigation((prev) => prev ? {
			...prev,
			distanceMeters: distMeters,
			walkMin: Math.max(1, Math.round(distMeters / 80)),
			driveMin: Math.max(1, Math.round(distMeters / 400))
		} : null);
	}, [myLocation]);
	const [searchQuery, setSearchQuery] = (0, import_react.useState)("");
	const [searchResults, setSearchResults] = (0, import_react.useState)([]);
	const [isSearching, setIsSearching] = (0, import_react.useState)(false);
	const [showSearchDropdown, setShowSearchDropdown] = (0, import_react.useState)(false);
	(0, import_react.useRef)(null);
	const gestureAreaRef = (0, import_react.useRef)(null);
	const rotatableWrapperRef = (0, import_react.useRef)(null);
	const [bearing, setBearing] = (0, import_react.useState)(0);
	const bearingRef = (0, import_react.useRef)(0);
	const [isGesturing, setIsGesturing] = (0, import_react.useState)(false);
	const [currentZoom, setCurrentZoom] = (0, import_react.useState)(16);
	const [userHeading, setUserHeading] = (0, import_react.useState)(null);
	const userHeadingRef = (0, import_react.useRef)(null);
	const [isHeadingUpMode, setIsHeadingUpMode] = (0, import_react.useState)(false);
	const isHeadingUpModeRef = (0, import_react.useRef)(false);
	isHeadingUpModeRef.current = isHeadingUpMode;
	(0, import_react.useEffect)(() => {
		if (!isActive) return;
		let lastTime = 0;
		const handleOrientation = (e) => {
			const now = performance.now();
			if (now - lastTime < 160) return;
			let rawHeading = null;
			if (e.webkitCompassHeading !== void 0) rawHeading = e.webkitCompassHeading;
			else if (e.alpha !== null && e.alpha !== void 0) rawHeading = (360 - e.alpha) % 360;
			if (rawHeading !== null && !isNaN(rawHeading)) {
				const heading = Math.round(rawHeading);
				if (userHeadingRef.current === null || Math.abs(userHeadingRef.current - heading) >= 3.5) {
					lastTime = now;
					userHeadingRef.current = heading;
					setUserHeading(heading);
					if (isHeadingUpModeRef.current) {
						bearingRef.current = heading;
						setBearing(heading);
					}
				}
			}
		};
		window.addEventListener("deviceorientationabsolute", handleOrientation, { passive: true });
		window.addEventListener("deviceorientation", handleOrientation, { passive: true });
		return () => {
			window.removeEventListener("deviceorientationabsolute", handleOrientation);
			window.removeEventListener("deviceorientation", handleOrientation);
		};
	}, [isActive]);
	const getCompassHeading = (deg) => {
		const normalized = (deg % 360 + 360) % 360;
		if (normalized >= 337.5 || normalized < 22.5) return "N";
		if (normalized >= 22.5 && normalized < 67.5) return "NE";
		if (normalized >= 67.5 && normalized < 112.5) return "E";
		if (normalized >= 112.5 && normalized < 157.5) return "SE";
		if (normalized >= 157.5 && normalized < 202.5) return "S";
		if (normalized >= 202.5 && normalized < 247.5) return "SW";
		if (normalized >= 247.5 && normalized < 292.5) return "W";
		return "NW";
	};
	const rotateMapBy = (deltaDeg) => {
		let next = (bearingRef.current + deltaDeg) % 360;
		if (next < 0) next += 360;
		next = Math.round(next);
		bearingRef.current = next;
		setBearing(next);
		toast.info(`Rotated map to ${next}° ${getCompassHeading(next)}`);
	};
	const resetNorth = () => {
		setIsHeadingUpMode(false);
		bearingRef.current = 0;
		setBearing(0);
		toast.info("Map oriented North-up (0°)");
	};
	const toggleHeadingUpMode = () => {
		if (!isHeadingUpMode) {
			const currentH = myLocation?.heading != null && !isNaN(myLocation.heading) ? myLocation.heading : userHeadingRef.current ?? 0;
			setIsHeadingUpMode(true);
			const rounded = Math.round(currentH);
			bearingRef.current = rounded;
			setBearing(rounded);
			toast.success(`Heading-Up Follow Mode enabled (${rounded}° ${getCompassHeading(rounded)})`);
		} else {
			setIsHeadingUpMode(false);
			resetNorth();
		}
	};
	const zoomIn = () => {
		if (mapInstanceRef.current) mapInstanceRef.current.zoomIn(.5);
	};
	const zoomOut = () => {
		if (mapInstanceRef.current) mapInstanceRef.current.zoomOut(.5);
	};
	const TRAIL_PALETTES = [
		{
			main: "#0284c7",
			glow: "#38bdf8",
			bg: "bg-sky-500",
			border: "border-sky-500",
			text: "text-sky-500",
			name: "Sky Blue"
		},
		{
			main: "#059669",
			glow: "#34d399",
			bg: "bg-emerald-500",
			border: "border-emerald-500",
			name: "Emerald"
		},
		{
			main: "#d97706",
			glow: "#fbbf24",
			bg: "bg-amber-500",
			border: "border-amber-500",
			name: "Amber"
		},
		{
			main: "#7c3aed",
			glow: "#a78bfa",
			bg: "bg-purple-500",
			border: "border-purple-500",
			name: "Purple"
		},
		{
			main: "#e11d48",
			glow: "#fb7185",
			bg: "bg-rose-500",
			border: "border-rose-500",
			name: "Rose"
		},
		{
			main: "#0891b2",
			glow: "#22d3ee",
			bg: "bg-cyan-500",
			border: "border-cyan-500",
			name: "Cyan"
		},
		{
			main: "#4f46e5",
			glow: "#818cf8",
			bg: "bg-indigo-500",
			border: "border-indigo-500",
			name: "Indigo"
		}
	];
	const getPaletteForUser = (userId) => {
		let hash = 0;
		for (let i = 0; i < userId.length; i++) {
			hash = (hash << 5) - hash + userId.charCodeAt(i);
			hash |= 0;
		}
		return TRAIL_PALETTES[Math.abs(hash) % TRAIL_PALETTES.length];
	};
	const removeUserTrailFromMap = (targetUserId) => {
		const map = mapInstanceRef.current;
		const existing = trailLayersRef.current.get(targetUserId);
		if (existing && map) {
			map.removeLayer(existing.glow);
			map.removeLayer(existing.main);
			if (existing.startMarker) map.removeLayer(existing.startMarker);
			existing.breadcrumbs.forEach((b) => map.removeLayer(b));
			trailLayersRef.current.delete(targetUserId);
		}
	};
	const clearAllTrails = () => {
		const map = mapInstanceRef.current;
		if (map) {
			trailLayersRef.current.forEach((layers) => {
				map.removeLayer(layers.glow);
				map.removeLayer(layers.main);
				if (layers.startMarker) map.removeLayer(layers.startMarker);
				layers.breadcrumbs.forEach((b) => map.removeLayer(b));
			});
			trailLayersRef.current.clear();
		}
		setActiveTrails({});
		toast.info("Cleared all breadcrumb trails");
	};
	const loadUserTrail = async (targetUserId, windowHours = trailWindowHours, autoZoom = true) => {
		try {
			setLoadingTrailUserIds((prev) => prev.includes(targetUserId) ? prev : [...prev, targetUserId]);
			const trail = (await api.get(`/api/locations/trail/${targetUserId}?windowHours=${windowHours}`)).trail;
			const map = mapInstanceRef.current;
			if (!map || trail.points.length === 0) {
				toast.info(`No recorded path for ${trail.fullName || "user"} in this time window`);
				return false;
			}
			removeUserTrailFromMap(targetUserId);
			const palette = getPaletteForUser(targetUserId);
			const latLngs = trail.points.map((p) => import_leaflet_src.default.latLng(p.latitude, p.longitude));
			const glowLine = import_leaflet_src.default.polyline(latLngs, {
				color: palette.glow,
				weight: 9,
				opacity: .45,
				lineCap: "round",
				lineJoin: "round"
			}).addTo(map);
			const mainLine = import_leaflet_src.default.polyline(latLngs, {
				color: palette.main,
				weight: 4,
				opacity: .95,
				lineCap: "round",
				lineJoin: "round",
				dashArray: "6, 8"
			}).addTo(map);
			const newMarkers = [];
			trail.points.forEach((pt, idx) => {
				const isStart = idx === 0;
				if (idx === trail.points.length - 1) return;
				const circle = import_leaflet_src.default.circleMarker([pt.latitude, pt.longitude], {
					radius: isStart ? 6 : 4,
					color: isStart ? "#059669" : palette.main,
					fillColor: "#ffffff",
					fillOpacity: 1,
					weight: 2
				}).addTo(map);
				const timeStr = new Date(pt.timestamp).toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit"
				});
				const speedStr = pt.speed ? `${pt.speed} m/s · ` : "";
				const accStr = formatAccuracy(pt.accuracy);
				circle.bindTooltip(`<div class="font-sans text-xs">
            <span class="font-bold text-slate-900">${trail.fullName}</span><br/>
            <span class="font-semibold text-slate-700">${isStart ? "Route Start · " : ""}${timeStr}</span><br/>
            <span class="text-slate-500">${speedStr}Acc ${accStr}</span>
          </div>`, {
					direction: "top",
					offset: [0, -4]
				});
				newMarkers.push(circle);
			});
			let startMarker;
			if (trail.points.length > 1) {
				const startPoint = trail.points[0];
				const firstName = trail.fullName.split(" ")[0];
				const startIcon = import_leaflet_src.default.divIcon({
					className: "beacon-start-marker",
					html: `
            <div class="px-2 py-0.5 ${palette.bg} text-white text-[10px] font-bold rounded-full shadow-md whitespace-nowrap flex items-center gap-1 border border-white">
              <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              ${firstName} Start (${new Date(startPoint.timestamp).toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit"
					})})
            </div>
          `,
					iconSize: [95, 24],
					iconAnchor: [47, 24]
				});
				startMarker = import_leaflet_src.default.marker([startPoint.latitude, startPoint.longitude], { icon: startIcon }).addTo(map);
			}
			trailLayersRef.current.set(targetUserId, {
				glow: glowLine,
				main: mainLine,
				startMarker,
				breadcrumbs: newMarkers
			});
			setActiveTrails((prev) => ({
				...prev,
				[targetUserId]: trail
			}));
			if (autoZoom) map.fitBounds(mainLine.getBounds(), {
				padding: [70, 70],
				maxZoom: 17
			});
			toast.success(`Showing ${trail.fullName}'s trail (${formatDistance(trail.totalDistanceMeters)})`);
			return true;
		} catch (err) {
			toast.error(err.message || "Failed to load location trail");
			return false;
		} finally {
			setLoadingTrailUserIds((prev) => prev.filter((id) => id !== targetUserId));
		}
	};
	const toggleUserTrail = async (targetUserId) => {
		if (activeTrails[targetUserId]) {
			removeUserTrailFromMap(targetUserId);
			setActiveTrails((prev) => {
				const copy = { ...prev };
				delete copy[targetUserId];
				return copy;
			});
			toast.info("Breadcrumb trail hidden");
		} else await loadUserTrail(targetUserId, trailWindowHours, true);
	};
	const fitAllTrailsBounds = () => {
		const map = mapInstanceRef.current;
		if (!map || trailLayersRef.current.size === 0) return;
		const bounds = import_leaflet_src.default.latLngBounds([]);
		trailLayersRef.current.forEach((layers) => {
			bounds.extend(layers.main.getBounds());
		});
		if (bounds.isValid()) map.fitBounds(bounds, {
			padding: [70, 70],
			maxZoom: 17
		});
	};
	const fitUserTrailBounds = (userId) => {
		const map = mapInstanceRef.current;
		const layers = trailLayersRef.current.get(userId);
		if (map && layers) map.fitBounds(layers.main.getBounds(), {
			padding: [70, 70],
			maxZoom: 17
		});
	};
	const reloadAllActiveTrails = async (newHours) => {
		setTrailWindowHours(newHours);
		const activeIds = Object.keys(activeTrails);
		if (activeIds.length === 0) return;
		for (const uid of activeIds) await loadUserTrail(uid, newHours, false);
		fitAllTrailsBounds();
	};
	(0, import_react.useEffect)(() => {
		if (!roomOnlyMode) return;
		const targetRoomId = activeRoomDetails?.id || selectedRoomId;
		if (!targetRoomId) return;
		if (activeRoomDetails?.members && activeRoomDetails.members.length > 0) {
			setFetchedRoomDetails(activeRoomDetails);
			return;
		}
		api.get(`/api/rooms/${targetRoomId}`).then((res) => {
			if (res?.room) setFetchedRoomDetails(res.room);
		}).catch(() => {});
	}, [
		roomOnlyMode,
		activeRoomDetails,
		selectedRoomId
	]);
	const effectiveRoom = activeRoomDetails || fetchedRoomDetails || rooms.find((r) => r.id === selectedRoomId) || null;
	const isUniversalActiveRoom = Boolean(effectiveRoom?.isUniversal || effectiveRoom?.id === "room-universal");
	const roomMemberIdsSet = import_react.useMemo(() => {
		if (!roomOnlyMode || !effectiveRoom || isUniversalActiveRoom) return null;
		const ids = /* @__PURE__ */ new Set();
		if (user?.id) ids.add(user.id);
		if (effectiveRoom.ownerId) ids.add(effectiveRoom.ownerId);
		effectiveRoom.members?.forEach((m) => ids.add(m.userId));
		return ids;
	}, [
		roomOnlyMode,
		effectiveRoom,
		isUniversalActiveRoom,
		user?.id
	]);
	const displayedUserLocations = import_react.useMemo(() => {
		if (!roomOnlyMode || !roomMemberIdsSet) return userLocations;
		return userLocations.filter((loc) => roomMemberIdsSet.has(loc.userId));
	}, [
		roomOnlyMode,
		roomMemberIdsSet,
		userLocations
	]);
	const roomUsersList = import_react.useMemo(() => {
		const list = [];
		const seen = /* @__PURE__ */ new Set();
		if (user) {
			seen.add(user.id);
			list.push({
				id: user.id,
				fullName: `${user.fullName} (You)`,
				username: user.username,
				avatarUrl: user.avatarUrl,
				isOnline: true,
				isMe: true,
				location: myLocation,
				role: effectiveRoom?.members?.find((m) => m.userId === user.id)?.role || "MEMBER"
			});
		}
		if (roomOnlyMode && effectiveRoom?.members) effectiveRoom.members.forEach((mem) => {
			if (seen.has(mem.userId)) return;
			seen.add(mem.userId);
			const peerLoc = displayedUserLocations.find((l) => l.userId === mem.userId) || null;
			list.push({
				id: mem.userId,
				fullName: mem.user?.fullName || peerLoc?.fullName || "Room Member",
				username: mem.user?.username || peerLoc?.username || mem.userId.slice(0, 6),
				avatarUrl: mem.user?.avatarUrl || peerLoc?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(mem.userId)}`,
				isOnline: onlineUserIds.includes(mem.userId),
				isMe: false,
				location: peerLoc,
				role: mem.role
			});
		});
		displayedUserLocations.forEach((loc) => {
			if (seen.has(loc.userId)) return;
			seen.add(loc.userId);
			list.push({
				id: loc.userId,
				fullName: loc.fullName,
				username: loc.username,
				avatarUrl: loc.avatarUrl,
				isOnline: onlineUserIds.includes(loc.userId),
				isMe: false,
				location: loc
			});
		});
		return list;
	}, [
		user,
		myLocation,
		roomOnlyMode,
		effectiveRoom,
		displayedUserLocations,
		onlineUserIds
	]);
	const fitAllRoomMembersOnMap = () => {
		const map = mapInstanceRef.current;
		if (!map) return;
		const bounds = import_leaflet_src.default.latLngBounds([]);
		if (myLocation) bounds.extend([myLocation.latitude, myLocation.longitude]);
		displayedUserLocations.forEach((loc) => {
			bounds.extend([loc.latitude, loc.longitude]);
		});
		if (bounds.isValid()) {
			map.fitBounds(bounds, {
				padding: [80, 80],
				maxZoom: 17
			});
			toast.info(`Showing all active members in ${effectiveRoom?.name || "room"}`);
		} else if (myLocation) map.flyTo([myLocation.latitude, myLocation.longitude], 16);
	};
	(0, import_react.useEffect)(() => {
		if (!roomOnlyMode || !isActive || focusCoords) return;
		const timer = setTimeout(() => {
			const map = mapInstanceRef.current;
			if (!map) return;
			map.invalidateSize();
			const bounds = import_leaflet_src.default.latLngBounds([]);
			if (myLocation) bounds.extend([myLocation.latitude, myLocation.longitude]);
			displayedUserLocations.forEach((loc) => {
				bounds.extend([loc.latitude, loc.longitude]);
			});
			if (bounds.isValid()) map.fitBounds(bounds, {
				padding: [70, 70],
				maxZoom: 16
			});
		}, 120);
		return () => clearTimeout(timer);
	}, [
		roomOnlyMode,
		effectiveRoom?.id,
		isActive
	]);
	const toggleAllRoomTrails = async () => {
		const allIds = roomUsersList.map((u) => u.id);
		if (allIds.length > 0 && allIds.every((id) => !!activeTrails[id])) clearAllTrails();
		else {
			toast.info("Loading breadcrumb trails for room members...");
			for (const u of roomUsersList) if (!activeTrails[u.id]) await loadUserTrail(u.id, trailWindowHours, false);
			fitAllTrailsBounds();
		}
	};
	const createGoogleTileLayer = (mode) => {
		const lite = isLiteModeRef.current;
		const scaleParam = lite ? "1" : "2";
		const commonOpts = {
			subdomains: [
				"0",
				"1",
				"2",
				"3"
			],
			detectRetina: !lite,
			keepBuffer: lite ? 1 : 2,
			updateWhenIdle: lite,
			updateWhenZooming: !lite
		};
		if (mode === "terrain") return import_leaflet_src.default.tileLayer(`https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&scale=${scaleParam}&hl=en`, {
			...commonOpts,
			maxZoom: 20,
			attribution: "&copy; Google Maps Terrain Topo HD"
		});
		else if (mode === "satellite") return import_leaflet_src.default.tileLayer(`https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&scale=${scaleParam}&hl=en`, {
			...commonOpts,
			maxZoom: 21,
			attribution: "&copy; Google Maps Satellite HD"
		});
		else if (mode === "traffic") return import_leaflet_src.default.tileLayer(`https://mt{s}.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}&scale=${scaleParam}&hl=en`, {
			...commonOpts,
			maxZoom: 21,
			attribution: "&copy; Google Maps Live Traffic HD"
		});
		else return import_leaflet_src.default.tileLayer(`https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&scale=${scaleParam}&hl=en`, {
			...commonOpts,
			maxZoom: 21,
			attribution: "&copy; Google Maps HD"
		});
	};
	(0, import_react.useEffect)(() => {
		if (!mapContainerRef.current || mapInstanceRef.current) return;
		const initialCenter = myLocation ? [myLocation.latitude, myLocation.longitude] : [0, 0];
		const map = import_leaflet_src.default.map(mapContainerRef.current, {
			center: initialCenter,
			zoom: myLocation ? 16 : 2,
			zoomControl: false,
			preferCanvas: true,
			zoomSnap: .1,
			zoomDelta: .5,
			touchZoom: false,
			bounceAtZoomLimits: false,
			fadeAnimation: !isLiteModeRef.current,
			markerZoomAnimation: !isLiteModeRef.current
		});
		const initialLayer = createGoogleTileLayer(mapMode).addTo(map);
		tileLayerRef.current = initialLayer;
		mapInstanceRef.current = map;
		map.on("zoom", () => {
			setCurrentZoom(map.getZoom());
		});
		const draggable = map.dragging?._draggable;
		if (draggable) draggable.on("predrag", () => {
			const b = bearingRef.current;
			if (!b || b === 0) return;
			const rad = -b * Math.PI / 180;
			const offset = draggable._newPos.subtract(draggable._startPos);
			const rx = offset.x * Math.cos(rad) - offset.y * Math.sin(rad);
			const ry = offset.x * Math.sin(rad) + offset.y * Math.cos(rad);
			draggable._newPos = draggable._startPos.add(import_leaflet_src.default.point(rx, ry));
		});
		map.on("movestart", () => {
			closeContextMenu();
			setShowMapControlsPop(false);
		});
		map.on("zoomstart", () => {
			closeContextMenu();
			setShowMapControlsPop(false);
		});
		map.on("click", () => {
			closeContextMenu();
			setShowSearchDropdown(false);
			setShowMapControlsPop(false);
		});
		map.on("contextmenu", (e) => {
			let lat = e.latlng.lat;
			let lng = e.latlng.lng;
			if (bearingRef.current !== 0 && mapInstanceRef.current) {
				const centerPoint = map.getSize().divideBy(2);
				const clickPoint = map.mouseEventToContainerPoint(e.originalEvent);
				const rad = -bearingRef.current * Math.PI / 180;
				const dx = clickPoint.x - centerPoint.x;
				const dy = clickPoint.y - centerPoint.y;
				const rx = centerPoint.x + dx * Math.cos(rad) - dy * Math.sin(rad);
				const ry = centerPoint.y + dx * Math.sin(rad) + dy * Math.cos(rad);
				const corrected = map.containerPointToLatLng(import_leaflet_src.default.point(rx, ry));
				lat = corrected.lat;
				lng = corrected.lng;
			}
			openContextMenu(e.originalEvent.clientX, e.originalEvent.clientY, {
				type: "coord",
				title: "Dropped Pin",
				subtitle: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
				lat,
				lng
			});
		});
		return () => {
			map.remove();
			mapInstanceRef.current = null;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (isActive && mapInstanceRef.current) {
			const timer = setTimeout(() => {
				mapInstanceRef.current?.invalidateSize();
			}, 50);
			return () => clearTimeout(timer);
		}
	}, [isActive]);
	(0, import_react.useEffect)(() => {
		const el = gestureAreaRef.current || mapContainerRef.current;
		if (!el || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(() => {
			mapInstanceRef.current?.invalidateSize();
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);
	(0, import_react.useEffect)(() => {
		if (focusCoords && mapInstanceRef.current) {
			const map = mapInstanceRef.current;
			map.invalidateSize();
			map.flyTo([focusCoords.lat, focusCoords.lng], 17, {
				animate: true,
				duration: 1.2
			});
		}
	}, [focusCoords]);
	(0, import_react.useEffect)(() => {
		const area = gestureAreaRef.current;
		if (!area) return;
		let lastDist = 0;
		let lastAngle = 0;
		let isPinchingOrRotating = false;
		let gestureRafId = null;
		const getTouchDist = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
		const getTouchAngle = (t1, t2) => Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
		const onTouchStart = (e) => {
			if (e.touches.length === 2) {
				isPinchingOrRotating = true;
				setIsGesturing(true);
				lastDist = getTouchDist(e.touches[0], e.touches[1]);
				lastAngle = getTouchAngle(e.touches[0], e.touches[1]);
				if (mapInstanceRef.current) mapInstanceRef.current.dragging.disable();
			}
		};
		const onTouchMove = (e) => {
			if (!isPinchingOrRotating || e.touches.length < 2) return;
			e.preventDefault();
			const dist = getTouchDist(e.touches[0], e.touches[1]);
			const angle = getTouchAngle(e.touches[0], e.touches[1]);
			let nextZoomVal = null;
			if (lastDist > 10 && dist > 10 && mapInstanceRef.current) {
				const scaleStep = dist / lastDist;
				const currentZ = mapInstanceRef.current.getZoom();
				nextZoomVal = Math.max(2, Math.min(21, currentZ + Math.log2(scaleStep)));
				mapInstanceRef.current.setZoom(nextZoomVal, { animate: false });
				lastDist = dist;
			}
			let stepDelta = angle - lastAngle;
			while (stepDelta > 180) stepDelta -= 360;
			while (stepDelta < -180) stepDelta += 360;
			lastAngle = angle;
			let newB = (bearingRef.current + stepDelta) % 360;
			if (newB < 0) newB += 360;
			newB = Math.round(newB);
			bearingRef.current = newB;
			if (rotatableWrapperRef.current) rotatableWrapperRef.current.style.transform = `rotate(${newB}deg)`;
			if (gestureRafId === null) gestureRafId = requestAnimationFrame(() => {
				gestureRafId = null;
				setBearing(bearingRef.current);
				if (nextZoomVal !== null) setCurrentZoom(nextZoomVal);
			});
		};
		const onTouchEnd = (e) => {
			if (isPinchingOrRotating && e.touches.length < 2) {
				isPinchingOrRotating = false;
				if (gestureRafId !== null) {
					cancelAnimationFrame(gestureRafId);
					gestureRafId = null;
				}
				setIsGesturing(false);
				if (mapInstanceRef.current) mapInstanceRef.current.dragging.enable();
				const cur = bearingRef.current;
				if (cur <= 7 || cur >= 353) {
					bearingRef.current = 0;
					setBearing(0);
				} else setBearing(cur);
			}
		};
		let trackpadStartBearing = 0;
		let trackpadStartZoom = 16;
		const onGestureStart = (e) => {
			e.preventDefault();
			isPinchingOrRotating = true;
			setIsGesturing(true);
			trackpadStartBearing = bearingRef.current;
			trackpadStartZoom = mapInstanceRef.current ? mapInstanceRef.current.getZoom() : 16;
		};
		const onGestureChange = (e) => {
			e.preventDefault();
			if (!isPinchingOrRotating || !mapInstanceRef.current) return;
			let nextZoomVal = null;
			if (e.scale && e.scale !== 1) {
				nextZoomVal = Math.max(2, Math.min(21, trackpadStartZoom + Math.log2(e.scale)));
				mapInstanceRef.current.setZoom(nextZoomVal, { animate: false });
			}
			if (typeof e.rotation === "number") {
				let newB = (trackpadStartBearing + e.rotation) % 360;
				if (newB < 0) newB += 360;
				newB = Math.round(newB);
				bearingRef.current = newB;
				if (rotatableWrapperRef.current) rotatableWrapperRef.current.style.transform = `rotate(${newB}deg)`;
			}
			if (gestureRafId === null) gestureRafId = requestAnimationFrame(() => {
				gestureRafId = null;
				setBearing(bearingRef.current);
				if (nextZoomVal !== null) setCurrentZoom(nextZoomVal);
			});
		};
		const onGestureEnd = (e) => {
			e.preventDefault();
			isPinchingOrRotating = false;
			if (gestureRafId !== null) {
				cancelAnimationFrame(gestureRafId);
				gestureRafId = null;
			}
			setIsGesturing(false);
			const cur = bearingRef.current;
			if (cur <= 7 || cur >= 353) {
				bearingRef.current = 0;
				setBearing(0);
			} else setBearing(cur);
		};
		area.addEventListener("touchstart", onTouchStart, { passive: false });
		area.addEventListener("touchmove", onTouchMove, { passive: false });
		area.addEventListener("touchend", onTouchEnd, { passive: false });
		area.addEventListener("touchcancel", onTouchEnd, { passive: false });
		area.addEventListener("gesturestart", onGestureStart, { passive: false });
		area.addEventListener("gesturechange", onGestureChange, { passive: false });
		area.addEventListener("gestureend", onGestureEnd, { passive: false });
		return () => {
			if (gestureRafId !== null) cancelAnimationFrame(gestureRafId);
			area.removeEventListener("touchstart", onTouchStart);
			area.removeEventListener("touchmove", onTouchMove);
			area.removeEventListener("touchend", onTouchEnd);
			area.removeEventListener("touchcancel", onTouchEnd);
			area.removeEventListener("gesturestart", onGestureStart);
			area.removeEventListener("gesturechange", onGestureChange);
			area.removeEventListener("gestureend", onGestureEnd);
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const map = mapInstanceRef.current;
		if (!map) return;
		if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
		const nextLayer = createGoogleTileLayer(mapMode).addTo(map);
		tileLayerRef.current = nextLayer;
	}, [mapMode, isLiteMode]);
	(0, import_react.useEffect)(() => {
		const onGpsFix = (e) => {
			const detail = e.detail;
			if (!detail || typeof detail.latitude !== "number" || typeof detail.longitude !== "number") return;
			const map = mapInstanceRef.current;
			if (!map) return;
			const isReal = detail.isRealGps !== false;
			const fixAcc = typeof detail.accuracy === "number" && detail.accuracy > 0 ? detail.accuracy : 100;
			const isSignificantUpgrade = !focusCoords && fixAcc < bestCenteredAccuracyRef.current * .65 && bestCenteredAccuracyRef.current > 35;
			if (detail.forceCenter || pendingCenterOnNextFixRef.current || !hasCenteredOnce && !focusCoords || isReal && !hasCenteredOnRealGpsRef.current && !focusCoords || isSignificantUpgrade) {
				if (isReal) hasCenteredOnRealGpsRef.current = true;
				bestCenteredAccuracyRef.current = Math.min(bestCenteredAccuracyRef.current, fixAcc);
				pendingCenterOnNextFixRef.current = false;
				setHasCenteredOnce(true);
				const targetZoom = Math.max(map.getZoom(), fixAcc <= 80 ? 17 : 16);
				if (isLiteModeRef.current) map.setView([detail.latitude, detail.longitude], targetZoom, { animate: false });
				else map.flyTo([detail.latitude, detail.longitude], targetZoom, {
					animate: true,
					duration: .85
				});
			}
		};
		window.addEventListener("beacon:gps-fix", onGpsFix);
		return () => window.removeEventListener("beacon:gps-fix", onGpsFix);
	}, [focusCoords, hasCenteredOnce]);
	const markerAnimationFramesRef = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const peerCircleAnimationFramesRef = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const accuracyCircleFrameRef = (0, import_react.useRef)(null);
	const animateMarkerPosition = (marker, targetLat, targetLng, key, duration = 850) => {
		if (isLiteModeRef.current) {
			marker.setLatLng([targetLat, targetLng]);
			return;
		}
		const currentLatLng = marker.getLatLng();
		const startLat = currentLatLng.lat;
		const startLng = currentLatLng.lng;
		const dLat = Math.abs(targetLat - startLat);
		const dLng = Math.abs(targetLng - startLng);
		if (dLat < 3e-6 && dLng < 3e-6 || dLat > .05 || dLng > .05) {
			marker.setLatLng([targetLat, targetLng]);
			return;
		}
		if (markerAnimationFramesRef.current.has(key)) {
			cancelAnimationFrame(markerAnimationFramesRef.current.get(key));
			markerAnimationFramesRef.current.delete(key);
		}
		const startTime = performance.now();
		const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
		const step = (now) => {
			const elapsed = now - startTime;
			const progress = Math.min(1, elapsed / duration);
			const ease = easeOutCubic(progress);
			const nextLat = startLat + (targetLat - startLat) * ease;
			const nextLng = startLng + (targetLng - startLng) * ease;
			marker.setLatLng([nextLat, nextLng]);
			if (progress < 1) {
				const frameId = requestAnimationFrame(step);
				markerAnimationFramesRef.current.set(key, frameId);
			} else {
				marker.setLatLng([targetLat, targetLng]);
				markerAnimationFramesRef.current.delete(key);
			}
		};
		const firstFrame = requestAnimationFrame(step);
		markerAnimationFramesRef.current.set(key, firstFrame);
	};
	const animateAccuracyCircle = (circle, targetLat, targetLng, targetRadius, duration = 850) => {
		if (isLiteModeRef.current) {
			circle.setLatLng([targetLat, targetLng]);
			circle.setRadius(targetRadius);
			return;
		}
		const currentLatLng = circle.getLatLng();
		const startLat = currentLatLng.lat;
		const startLng = currentLatLng.lng;
		const startRadius = circle.getRadius();
		if (Math.abs(targetLat - startLat) > .05 || Math.abs(targetLng - startLng) > .05) {
			circle.setLatLng([targetLat, targetLng]);
			circle.setRadius(targetRadius);
			return;
		}
		if (accuracyCircleFrameRef.current !== null) {
			cancelAnimationFrame(accuracyCircleFrameRef.current);
			accuracyCircleFrameRef.current = null;
		}
		const startTime = performance.now();
		const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
		const step = (now) => {
			const elapsed = now - startTime;
			const progress = Math.min(1, elapsed / duration);
			const ease = easeOutCubic(progress);
			const nextLat = startLat + (targetLat - startLat) * ease;
			const nextLng = startLng + (targetLng - startLng) * ease;
			const nextRadius = startRadius + (targetRadius - startRadius) * ease;
			circle.setLatLng([nextLat, nextLng]);
			circle.setRadius(nextRadius);
			if (progress < 1) accuracyCircleFrameRef.current = requestAnimationFrame(step);
			else {
				circle.setLatLng([targetLat, targetLng]);
				circle.setRadius(targetRadius);
				accuracyCircleFrameRef.current = null;
			}
		};
		accuracyCircleFrameRef.current = requestAnimationFrame(step);
	};
	const animatePeerAccuracyCircle = (circle, targetLat, targetLng, targetRadius, key, duration = 850) => {
		if (isLiteModeRef.current) {
			circle.setLatLng([targetLat, targetLng]);
			circle.setRadius(targetRadius);
			return;
		}
		const currentLatLng = circle.getLatLng();
		const startLat = currentLatLng.lat;
		const startLng = currentLatLng.lng;
		const startRadius = circle.getRadius();
		if (peerCircleAnimationFramesRef.current.has(key)) {
			cancelAnimationFrame(peerCircleAnimationFramesRef.current.get(key));
			peerCircleAnimationFramesRef.current.delete(key);
		}
		const startTime = performance.now();
		const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
		const step = (now) => {
			const elapsed = now - startTime;
			const progress = Math.min(1, elapsed / duration);
			const ease = easeOutCubic(progress);
			const nextLat = startLat + (targetLat - startLat) * ease;
			const nextLng = startLng + (targetLng - startLng) * ease;
			const nextRadius = startRadius + (targetRadius - startRadius) * ease;
			circle.setLatLng([nextLat, nextLng]);
			circle.setRadius(nextRadius);
			if (progress < 1) {
				const frameId = requestAnimationFrame(step);
				peerCircleAnimationFramesRef.current.set(key, frameId);
			} else {
				circle.setLatLng([targetLat, targetLng]);
				circle.setRadius(targetRadius);
				peerCircleAnimationFramesRef.current.delete(key);
			}
		};
		const firstFrame = requestAnimationFrame(step);
		peerCircleAnimationFramesRef.current.set(key, firstFrame);
	};
	(0, import_react.useEffect)(() => {
		return () => {
			markerAnimationFramesRef.current.forEach((frameId) => cancelAnimationFrame(frameId));
			markerAnimationFramesRef.current.clear();
			peerCircleAnimationFramesRef.current.forEach((frameId) => cancelAnimationFrame(frameId));
			peerCircleAnimationFramesRef.current.clear();
			if (accuracyCircleFrameRef.current !== null) cancelAnimationFrame(accuracyCircleFrameRef.current);
		};
	}, []);
	const selfIconSignatureRef = (0, import_react.useRef)("");
	const peerIconHtmlMapRef = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	(0, import_react.useEffect)(() => {
		const map = mapInstanceRef.current;
		if (!map) return;
		if (!myLocation || !Number.isFinite(myLocation.latitude) || !Number.isFinite(myLocation.longitude)) {
			if (myMarkerRef.current) {
				map.removeLayer(myMarkerRef.current);
				myMarkerRef.current = null;
				selfIconSignatureRef.current = "";
			}
			if (accuracyCircleRef.current) {
				map.removeLayer(accuracyCircleRef.current);
				accuracyCircleRef.current = null;
			}
			setDebugMarkerLatLng(null);
			return;
		}
		const markerCoords = [myLocation.latitude, myLocation.longitude];
		const latLng = import_leaflet_src.default.latLng(markerCoords[0], markerCoords[1]);
		setDebugMarkerLatLng(markerCoords);
		const currentAcc = Number(myLocation.accuracy_m ?? myLocation.accuracy);
		if (!hasCenteredOnce) {
			map.setView(latLng, currentAcc <= 100 ? 17 : 15);
			setHasCenteredOnce(true);
			bestCenteredAccuracyRef.current = currentAcc;
			hasCenteredOnRealGpsRef.current = true;
		} else if (!hasCenteredOnRealGpsRef.current && currentAcc <= 100 && !focusCoords || !focusCoords && currentAcc < bestCenteredAccuracyRef.current * .65 && bestCenteredAccuracyRef.current > 35) {
			hasCenteredOnRealGpsRef.current = true;
			bestCenteredAccuracyRef.current = Math.min(bestCenteredAccuracyRef.current, currentAcc);
			if (isLiteModeRef.current) map.setView(latLng, 17, { animate: false });
			else map.flyTo(latLng, 17, {
				animate: true,
				duration: .9
			});
		}
		const selfSignalInfo = getGpsSignalInfo(currentAcc);
		const serverUpdatedIso = myLocation.updated_at || myLocation.timestamp;
		const serverAgeMs = serverUpdatedIso ? Date.now() - Date.parse(serverUpdatedIso) : Infinity;
		const isServerLive = Number.isFinite(serverAgeMs) && serverAgeMs < 12e4;
		if (Number.isFinite(currentAcc) && currentAcc > 0) {
			const accuracyRadius = currentAcc;
			const circleStyle = {
				color: selfSignalInfo.circleColor,
				fillColor: selfSignalInfo.circleColor,
				fillOpacity: selfSignalInfo.isLowSignal ? .2 : .16,
				weight: selfSignalInfo.isLowSignal ? 2.2 : 1.5,
				opacity: selfSignalInfo.isLowSignal ? .85 : .6,
				dashArray: selfSignalInfo.isLowSignal ? "6, 6" : void 0
			};
			const selfTooltipHtml = `<div class="font-sans text-xs">
          <span class="font-bold text-slate-900">Your Location${isServerLive ? " · Live" : ""}</span><br/>
          <span class="text-slate-600">Accuracy ±${Math.round(currentAcc)} m</span>
        </div>`;
			if (!accuracyCircleRef.current) {
				accuracyCircleRef.current = import_leaflet_src.default.circle(markerCoords, {
					radius: accuracyRadius,
					...circleStyle
				}).addTo(map);
				accuracyCircleRef.current.bindTooltip(selfTooltipHtml, {
					direction: "top",
					sticky: true
				});
				accuracyCircleRef.current.on("click", () => {
					setShowBlueDotModal(true);
				});
			} else {
				accuracyCircleRef.current.setStyle(circleStyle);
				accuracyCircleRef.current.setTooltipContent(selfTooltipHtml);
				animateAccuracyCircle(accuracyCircleRef.current, markerCoords[0], markerCoords[1], accuracyRadius);
			}
		}
		const effectiveHeading = myLocation.heading != null && !isNaN(myLocation.heading) ? myLocation.heading : userHeading;
		const visualAngle = effectiveHeading !== null ? ((effectiveHeading - bearing) % 360 + 360) % 360 : 0;
		const userIcon = user?.markerIcon || "person";
		const userRoleEmoji = getMemberIconEmoji(userIcon);
		const userDisplayName = user?.markerLabel || user?.fullName?.split(" ")[0] || "You";
		const roundedAcc = Math.round(currentAcc);
		const roundedHeading = effectiveHeading !== null ? Math.round(effectiveHeading) : null;
		const selfSignature = `${userDisplayName}|${userIcon}|${selfSignalInfo.isLowSignal}|${isServerLive}|${roundedAcc}|${roundedHeading !== null}`;
		const myIcon = import_leaflet_src.default.divIcon({
			className: "beacon-google-blue-dot-marker",
			html: `
        <div class="relative flex items-center justify-center w-20 h-20 pointer-events-none cursor-pointer">
          <div class="beacon-self-heading-cone absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-150 ease-out" style="transform: rotate(${visualAngle}deg);">
            <svg class="absolute -top-7 w-28 h-28 overflow-visible pointer-events-none opacity-85" viewBox="0 0 100 100">
              <defs>
                <radialGradient id="googleBlueDotBeam" cx="50%" cy="100%" r="90%">
                  <stop offset="0%" stop-color="rgba(66, 133, 244, 0.6)" />
                  <stop offset="45%" stop-color="rgba(66, 133, 244, 0.22)" />
                  <stop offset="85%" stop-color="rgba(66, 133, 244, 0.05)" />
                  <stop offset="100%" stop-color="rgba(66, 133, 244, 0)" />
                </radialGradient>
              </defs>
              <path d="M 50 95 L 14 18 A 66 66 0 0 1 86 18 Z" fill="url(#googleBlueDotBeam)" />
            </svg>
            <div class="absolute -top-3.5 flex flex-col items-center">
              <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[11px] border-b-[#1a73e8] drop-shadow-[0_0_6px_rgba(26,115,232,0.9)]"></div>
            </div>
          </div>

          <div class="absolute inset-3 rounded-full ${selfSignalInfo.isLowSignal ? "bg-amber-500/35 border border-amber-400/70 border-dashed" : "bg-blue-500/25"} animate-ping pointer-events-none"></div>

          <div class="relative w-8 h-8 rounded-full bg-gradient-to-tr from-[#1557b0] to-[#4285f4] border-[3px] ${selfSignalInfo.isLowSignal ? "border-amber-300" : "border-white"} shadow-[0_2px_10px_rgba(0,0,0,0.4)] flex items-center justify-center pointer-events-auto group hover:scale-110 transition-transform">
            ${user?.markerIcon && user.markerIcon !== "person" ? `
              <span class="text-xs text-white drop-shadow">${userRoleEmoji}</span>
            ` : `
              <div class="w-2.5 h-2.5 rounded-full bg-white shadow-xs"></div>
            `}
          </div>

          <!-- Direction, Accuracy ±X m & Server-Verified Live Badge -->
          <div class="absolute -bottom-2 px-2.5 py-0.5 bg-slate-900/90 text-[10px] text-white font-bold rounded-full shadow-md border ${selfSignalInfo.isLowSignal ? "border-amber-400/60" : "border-white/20"} flex items-center gap-1 pointer-events-auto whitespace-nowrap">
            <span class="w-1.5 h-1.5 rounded-full ${isServerLive ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}"></span>
            <span>${userDisplayName}</span>
            ${isServerLive ? `<span class="text-emerald-300 font-mono text-[9px]">· Live</span>` : ""}
            <span class="text-sky-300 font-mono text-[9px]">· Accuracy ±${roundedAcc} m</span>
            ${roundedHeading !== null ? `<span class="beacon-self-heading-text text-blue-300 font-mono text-[9px]">· ${roundedHeading}°</span>` : ""}
          </div>
        </div>
      `,
			iconSize: [80, 80],
			iconAnchor: [40, 40]
		});
		const selfTarget = {
			type: "self",
			title: `${user?.fullName || "You"} (Your Location)`,
			subtitle: `Accuracy ±${roundedAcc} m${isServerLive ? " · Live" : ""}`,
			lat: markerCoords[0],
			lng: markerCoords[1],
			avatarUrl: user?.avatarUrl,
			heading: effectiveHeading
		};
		if (!myMarkerRef.current) {
			myMarkerRef.current = import_leaflet_src.default.marker(markerCoords, {
				icon: myIcon,
				zIndexOffset: 1e3,
				draggable: true
			}).addTo(map);
			selfIconSignatureRef.current = selfSignature;
			myMarkerRef.current.on("click", () => {
				setSelectedUser(myLocation);
			});
			myMarkerRef.current.on("dragend", () => {
				const marker = myMarkerRef.current;
				if (!marker) return;
				const pos = marker.getLatLng();
				setManualLocation(pos.lat, pos.lng, 5);
				toast.success(`Location calibrated to (${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} · Accuracy ±5 m)`);
			});
			attachMarkerLongPress(myMarkerRef.current, selfTarget);
		} else {
			animateMarkerPosition(myMarkerRef.current, markerCoords[0], markerCoords[1], "my_marker");
			if (selfIconSignatureRef.current !== selfSignature) {
				selfIconSignatureRef.current = selfSignature;
				myMarkerRef.current.setIcon(myIcon);
				attachMarkerLongPress(myMarkerRef.current, selfTarget);
			} else {
				const el = myMarkerRef.current.getElement();
				if (el) {
					const cone = el.querySelector(".beacon-self-heading-cone");
					if (cone) cone.style.transform = `rotate(${visualAngle}deg)`;
					if (roundedHeading !== null) {
						const headingText = el.querySelector(".beacon-self-heading-text");
						if (headingText) headingText.textContent = `· ${roundedHeading}°`;
					}
				}
			}
		}
	}, [
		myLocation,
		user?.avatarUrl,
		user?.fullName,
		hasCenteredOnce,
		userHeading,
		bearing,
		debugNowMs
	]);
	(0, import_react.useEffect)(() => {
		const map = mapInstanceRef.current;
		if (!map) return;
		const currentMarkers = userMarkersRef.current;
		const currentCircles = userAccuracyCirclesRef.current;
		const activePeerIds = /* @__PURE__ */ new Set();
		for (const peerLoc of displayedUserLocations) {
			if (peerLoc.userId === user?.id) continue;
			if (!Number.isFinite(peerLoc.latitude) || !Number.isFinite(peerLoc.longitude)) continue;
			const peerAcc = Number(peerLoc.accuracy_m ?? peerLoc.accuracy);
			if (!Number.isFinite(peerAcc) || peerAcc <= 0 || peerAcc > 100) continue;
			activePeerIds.add(peerLoc.userId);
			const peerCoords = [peerLoc.latitude, peerLoc.longitude];
			const isOnline = onlineUserIds.includes(peerLoc.userId);
			const peerSignalInfo = getGpsSignalInfo(peerAcc);
			const peerUpdatedIso = peerLoc.updated_at || peerLoc.timestamp;
			const peerAgeMs = peerUpdatedIso ? Date.now() - Date.parse(peerUpdatedIso) : Infinity;
			const isPeerLive = Number.isFinite(peerAgeMs) && peerAgeMs < 12e4;
			let distText = "";
			if (myLocation) {
				const m = calculateDistanceMeters(myLocation.latitude, myLocation.longitude, peerLoc.latitude, peerLoc.longitude);
				distText = formatDistance(m);
			}
			const peerHeading = peerLoc.heading;
			const peerVisualAngle = peerHeading != null && !isNaN(peerHeading) ? ((peerHeading - bearing) % 360 + 360) % 360 : null;
			const peerOverride = getCustomMemberOverrides()[peerLoc.userId];
			const peerColor = peerOverride?.color || peerLoc.markerColor || "#10b981";
			const peerIconId = peerOverride?.icon || peerLoc.markerIcon || "person";
			const peerRoleEmoji = getMemberIconEmoji(peerIconId);
			const peerDisplayName = peerOverride?.nickname || peerLoc.fullName.split(" ")[0];
			const radiusMeters = peerAcc;
			const circleStyle = {
				color: peerSignalInfo.isLowSignal ? peerSignalInfo.circleColor : peerColor,
				fillColor: peerSignalInfo.isLowSignal ? peerSignalInfo.circleColor : peerColor,
				fillOpacity: .15,
				weight: 1.8,
				opacity: .75,
				dashArray: peerSignalInfo.isLowSignal ? "6, 6" : void 0
			};
			const tooltipHtml = `<div class="font-sans text-xs">
        <span class="font-bold text-slate-900">${peerLoc.fullName}${isPeerLive ? " · Live" : ""}</span><br/>
        <span class="font-semibold text-slate-700">Accuracy ±${Math.round(peerAcc)} m</span>
      </div>`;
			if (!currentCircles.has(peerLoc.userId)) {
				const accCircle = import_leaflet_src.default.circle(peerCoords, {
					radius: radiusMeters,
					...circleStyle
				}).addTo(map);
				accCircle.bindTooltip(tooltipHtml, {
					direction: "top",
					sticky: true
				});
				accCircle.on("click", () => {
					setSelectedUser(peerLoc);
				});
				currentCircles.set(peerLoc.userId, accCircle);
			} else {
				const existingCircle = currentCircles.get(peerLoc.userId);
				existingCircle.setStyle(circleStyle);
				existingCircle.setTooltipContent(tooltipHtml);
				animatePeerAccuracyCircle(existingCircle, peerCoords[0], peerCoords[1], radiusMeters, peerLoc.userId);
			}
			const peerStructuralSignature = `${peerLoc.avatarUrl}|${peerLoc.fullName}|${peerDisplayName}|${peerColor}|${peerIconId}|${peerSignalInfo.isLowSignal}|${isPeerLive}|${Math.round(peerAcc)}|${peerVisualAngle !== null}|${Boolean(distText)}`;
			const peerHtml = `
          <div class="group relative flex flex-col items-center cursor-pointer hover:scale-105 transition-transform">
            ${peerSignalInfo.isLowSignal ? `
              <div class="absolute -inset-2 rounded-full border-2 border-dashed animate-pulse pointer-events-none" style="border-color: ${peerSignalInfo.circleColor}; background-color: ${peerSignalInfo.circleColor}22;"></div>
            ` : ""}
            ${peerVisualAngle !== null ? `
              <div class="beacon-peer-heading-cone absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-150" style="transform: rotate(${Math.round(peerVisualAngle)}deg);">
                <div class="absolute -top-3 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[9px]" style="border-bottom-color: ${peerColor}; filter: drop-shadow(0 0 4px ${peerColor});"></div>
              </div>
            ` : ""}
            <div class="relative w-10 h-10 rounded-full border-2 border-white shadow-md overflow-hidden bg-slate-800 ring-2" style="outline-color: ${peerColor}; box-shadow: 0 0 8px ${peerColor}80;">
              <img src="${peerLoc.avatarUrl}" class="w-full h-full object-cover" alt="${peerLoc.fullName}" decoding="async" />
            </div>
            ${peerIconId !== "person" ? `
              <div class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-900 border border-white text-[10px] flex items-center justify-center shadow">
                <span>${peerRoleEmoji}</span>
              </div>
            ` : ""}
            <div class="mt-1 px-2 py-0.5 bg-slate-900/90 backdrop-blur-sm text-[10px] text-white font-medium rounded shadow flex items-center gap-1 whitespace-nowrap ${peerSignalInfo.isLowSignal ? "border border-amber-400/50" : ""}">
              <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${isPeerLive ? "#10b981" : "#94a3b8"};"></span>
              <span>${peerRoleEmoji !== "👤" ? `${peerRoleEmoji} ` : ""}${peerDisplayName}</span>
              ${isPeerLive ? `<span class="text-emerald-300 font-mono text-[9px]">· Live</span>` : ""}
              ${distText ? `<span class="text-slate-400">·</span><span class="beacon-peer-dist-text text-blue-400 font-semibold">${distText}</span>` : ""}
              <span class="text-sky-300 font-mono text-[9px]">· Accuracy ±${Math.round(peerAcc)} m</span>
              ${peerHeading != null ? `<span class="beacon-peer-heading-text text-emerald-400 font-mono text-[9px]">· ${Math.round(peerHeading)}°</span>` : ""}
            </div>
          </div>
        `;
			const peerIcon = import_leaflet_src.default.divIcon({
				className: "beacon-peer-marker",
				html: peerHtml,
				iconSize: [40, 56],
				iconAnchor: [20, 20]
			});
			const peerTarget = {
				type: "peer",
				userId: peerLoc.userId,
				title: peerLoc.fullName,
				subtitle: `@${peerLoc.username}${distText ? ` · ${distText}` : ""} · Accuracy ±${Math.round(peerAcc)} m`,
				lat: peerCoords[0],
				lng: peerCoords[1],
				avatarUrl: peerLoc.avatarUrl,
				isOnline,
				distanceText: distText,
				heading: peerHeading
			};
			if (!currentMarkers.has(peerLoc.userId)) {
				const marker = import_leaflet_src.default.marker(peerCoords, { icon: peerIcon }).addTo(map);
				peerIconHtmlMapRef.current.set(peerLoc.userId, peerStructuralSignature);
				marker.on("click", () => {
					setSelectedUser(peerLoc);
				});
				attachMarkerLongPress(marker, peerTarget);
				currentMarkers.set(peerLoc.userId, marker);
			} else {
				const existingMarker = currentMarkers.get(peerLoc.userId);
				animateMarkerPosition(existingMarker, peerCoords[0], peerCoords[1], peerLoc.userId);
				if (peerIconHtmlMapRef.current.get(peerLoc.userId) !== peerStructuralSignature) {
					peerIconHtmlMapRef.current.set(peerLoc.userId, peerStructuralSignature);
					existingMarker.setIcon(peerIcon);
					attachMarkerLongPress(existingMarker, peerTarget);
				} else {
					const el = existingMarker.getElement();
					if (el) {
						if (peerVisualAngle !== null) {
							const cone = el.querySelector(".beacon-peer-heading-cone");
							if (cone) cone.style.transform = `rotate(${Math.round(peerVisualAngle)}deg)`;
						}
						if (distText) {
							const distEl = el.querySelector(".beacon-peer-dist-text");
							if (distEl && distEl.textContent !== distText) distEl.textContent = distText;
						}
						if (peerHeading != null) {
							const headEl = el.querySelector(".beacon-peer-heading-text");
							const nextHeadStr = `· ${Math.round(peerHeading)}°`;
							if (headEl && headEl.textContent !== nextHeadStr) headEl.textContent = nextHeadStr;
						}
					}
				}
			}
		}
		for (const [userId, marker] of currentMarkers.entries()) if (!activePeerIds.has(userId)) {
			if (markerAnimationFramesRef.current.has(userId)) {
				cancelAnimationFrame(markerAnimationFramesRef.current.get(userId));
				markerAnimationFramesRef.current.delete(userId);
			}
			map.removeLayer(marker);
			currentMarkers.delete(userId);
			peerIconHtmlMapRef.current.delete(userId);
		}
		for (const [userId, circle] of currentCircles.entries()) if (!activePeerIds.has(userId)) {
			if (peerCircleAnimationFramesRef.current.has(userId)) {
				cancelAnimationFrame(peerCircleAnimationFramesRef.current.get(userId));
				peerCircleAnimationFramesRef.current.delete(userId);
			}
			map.removeLayer(circle);
			currentCircles.delete(userId);
		}
	}, [
		displayedUserLocations,
		onlineUserIds,
		myLocation,
		user?.id,
		bearing,
		memberOverridesVersion,
		debugNowMs
	]);
	(0, import_react.useEffect)(() => {
		const map = mapInstanceRef.current;
		if (!map) return;
		savedPlacesMarkersRef.current.forEach((m) => map.removeLayer(m));
		savedPlacesMarkersRef.current = [];
		savedPlaces.forEach((place) => {
			const latLng = import_leaflet_src.default.latLng(place.latitude, place.longitude);
			const colorHex = place.markerColor || "#f59e0b";
			const iconEmoji = getLocationTypeEmoji(place.markerIcon || place.category);
			const placeIcon = import_leaflet_src.default.divIcon({
				className: "beacon-place-marker",
				html: `
          <div class="flex flex-col items-center cursor-pointer group hover:scale-110 transition-transform">
            <div class="w-8 h-8 rounded-2xl text-white flex items-center justify-center shadow-lg border-2 border-white text-sm" style="background-color: ${colorHex}">
              <span>${iconEmoji}</span>
            </div>
            <span class="mt-0.5 px-2 py-0.5 bg-slate-900/90 text-[10px] text-white font-bold rounded shadow-md border border-white/10 whitespace-nowrap max-w-[120px] truncate">
              ${place.name}
            </span>
          </div>
        `,
				iconSize: [32, 50],
				iconAnchor: [16, 25]
			});
			const marker = import_leaflet_src.default.marker(latLng, { icon: placeIcon }).addTo(map);
			const removeBtnId = `remove-saved-place-${mapUid}-${place.id}`;
			marker.bindPopup(`
        <div class="p-2">
          <p class="font-bold text-sm text-slate-900">${place.name}</p>
          <p class="text-xs text-slate-600">${place.description || "Saved location"}</p>
          <p class="text-[10px] text-slate-400 mt-1">Geofence radius: ${place.radiusMeters} m</p>
          <button id="${removeBtnId}" class="mt-2 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer">
            Remove from Wishlist
          </button>
        </div>
      `);
			marker.on("popupopen", () => {
				const removeBtn = document.getElementById(removeBtnId);
				if (removeBtn) removeBtn.onclick = async () => {
					try {
						await api.delete(`/api/saved-places/${place.id}`);
						marker.closePopup();
						onRefreshSavedPlaces?.();
						toast.success(`Removed "${place.name}" from Wishlist`);
					} catch (err) {
						toast.error(err.message || "Failed to remove place");
					}
				};
			});
			attachMarkerLongPress(marker, {
				type: "place",
				placeId: place.id,
				title: place.name,
				subtitle: place.description || `Radius: ${place.radiusMeters}m`,
				lat: place.latitude,
				lng: place.longitude,
				radiusMeters: place.radiusMeters
			});
			savedPlacesMarkersRef.current.push(marker);
		});
	}, [savedPlaces]);
	const handleClearNavigationRoute = () => {
		const map = mapInstanceRef.current;
		if (map) {
			if (routePolylineRef.current) {
				map.removeLayer(routePolylineRef.current);
				routePolylineRef.current = null;
			}
			if (routeGlowPolylineRef.current) {
				map.removeLayer(routeGlowPolylineRef.current);
				routeGlowPolylineRef.current = null;
			}
		}
		setActiveRouteData(null);
		toast.info("Navigation route cleared");
	};
	const handleSelectPlaceFromExplorer = (place) => {
		setSearchQuery(place.name);
		setShowPlacesPage(false);
		setShowSearchDropdown(false);
		const map = mapInstanceRef.current;
		if (!map) return;
		const latLng = import_leaflet_src.default.latLng(place.lat, place.lon);
		map.flyTo(latLng, 17, { duration: 1.2 });
		if (searchMarkerRef.current) map.removeLayer(searchMarkerRef.current);
		const placeIcon = import_leaflet_src.default.divIcon({
			className: "beacon-google-place-marker",
			html: `
        <div class="relative flex flex-col items-center cursor-pointer animate-pop-in">
          <div class="absolute -inset-2 rounded-full bg-sky-500/30 animate-ping"></div>
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-2xl border-2 border-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div class="mt-1 px-2.5 py-1 bg-slate-900/95 backdrop-blur-md text-xs font-bold text-white rounded-xl shadow-lg border border-white/20 whitespace-nowrap">
            ${place.name}
          </div>
        </div>
      `,
			iconSize: [40, 60],
			iconAnchor: [20, 30]
		});
		const pin = import_leaflet_src.default.marker(latLng, { icon: placeIcon }).addTo(map);
		searchMarkerRef.current = pin;
		attachMarkerLongPress(pin, {
			type: "coord",
			title: place.name,
			subtitle: place.display_name,
			lat: place.lat,
			lng: place.lon
		});
		toast.success(`Showing ${place.name} on map`);
	};
	const handleClearNearbyPois = () => {
		const map = mapInstanceRef.current;
		if (map && nearbyPoiMarkersRef.current.length > 0) nearbyPoiMarkersRef.current.forEach((marker) => map.removeLayer(marker));
		nearbyPoiMarkersRef.current = [];
		setNearbyPoisOnMap([]);
	};
	const handleShowNearbyPlacesOnMap = (places) => {
		const map = mapInstanceRef.current;
		if (!map) return;
		handleClearNearbyPois();
		setNearbyPoisOnMap(places);
		const newMarkers = [];
		const bounds = import_leaflet_src.default.latLngBounds([]);
		if (myLocation) bounds.extend(import_leaflet_src.default.latLng(myLocation.latitude, myLocation.longitude));
		places.forEach((place) => {
			const latLng = import_leaflet_src.default.latLng(place.lat, place.lon);
			bounds.extend(latLng);
			let badgeBg = "bg-sky-600";
			if (place.category?.includes("fuel") || place.type?.includes("fuel")) badgeBg = "bg-amber-600";
			else if (place.category?.includes("food") || place.category?.includes("restaurant")) badgeBg = "bg-rose-600";
			else if (place.category?.includes("cafe")) badgeBg = "bg-amber-700";
			else if (place.category?.includes("hospital") || place.category?.includes("health")) badgeBg = "bg-red-600";
			else if (place.category?.includes("park")) badgeBg = "bg-emerald-600";
			else if (place.category?.includes("supermarket") || place.category?.includes("shop")) badgeBg = "bg-teal-600";
			const iconHtml = `
        <div class="relative flex flex-col items-center cursor-pointer group hover:scale-110 transition-transform">
          <div class="w-8 h-8 rounded-xl ${badgeBg} text-white flex items-center justify-center shadow-lg border-2 border-white/90">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div class="mt-0.5 px-2 py-0.5 bg-slate-900/90 backdrop-blur text-[10px] font-bold text-white rounded-lg shadow-md border border-white/10 whitespace-nowrap max-w-[120px] truncate">
            ${place.name}
          </div>
        </div>
      `;
			const markerIcon = import_leaflet_src.default.divIcon({
				className: "beacon-nearby-poi-marker",
				html: iconHtml,
				iconSize: [32, 48],
				iconAnchor: [16, 24]
			});
			const poiMarker = import_leaflet_src.default.marker(latLng, { icon: markerIcon }).addTo(map);
			poiMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; color: #0f172a; min-width: 180px;">
          <div style="font-weight: 700; font-size: 13px; margin-bottom: 2px;">${place.name}</div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${place.display_name}</div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: #0284c7; margin-bottom: 8px;">
            <span>${place.distanceMeters ? formatDistance(place.distanceMeters) : ""}</span>
            <span>${place.rating ? "★ " + place.rating : ""}</span>
          </div>
          <button id="poi-nav-${place.id}" style="width: 100%; background: #0284c7; color: white; border: none; padding: 6px; border-radius: 8px; font-weight: 700; cursor: pointer; margin-bottom: 4px;">
            Start Route
          </button>
        </div>
      `);
			poiMarker.on("popupopen", () => {
				const btn = document.getElementById("poi-nav-" + place.id);
				if (btn) btn.onclick = () => {
					poiMarker.closePopup();
					startNavigation(place.lat, place.lon, place.name);
				};
			});
			attachMarkerLongPress(poiMarker, {
				type: "coord",
				title: place.name,
				subtitle: place.display_name,
				lat: place.lat,
				lng: place.lon,
				distanceText: place.distanceMeters ? formatDistance(place.distanceMeters) : void 0
			});
			newMarkers.push(poiMarker);
		});
		nearbyPoiMarkersRef.current = newMarkers;
		if (bounds.isValid()) map.fitBounds(bounds, {
			padding: [50, 50],
			maxZoom: 16
		});
	};
	const handleStartRouteOnMap = (route, destination) => {
		setShowPlacesPage(false);
		setActiveRouteData(route);
		const map = mapInstanceRef.current;
		if (!map) return;
		if (routePolylineRef.current) {
			map.removeLayer(routePolylineRef.current);
			routePolylineRef.current = null;
		}
		if (routeGlowPolylineRef.current) {
			map.removeLayer(routeGlowPolylineRef.current);
			routeGlowPolylineRef.current = null;
		}
		if (route.geometry && Array.isArray(route.geometry.coordinates)) {
			const latLngs = route.geometry.coordinates.map((coord) => import_leaflet_src.default.latLng(coord[1], coord[0]));
			routeGlowPolylineRef.current = import_leaflet_src.default.polyline(latLngs, {
				color: "#38bdf8",
				weight: 9,
				opacity: .45,
				lineCap: "round",
				lineJoin: "round"
			}).addTo(map);
			routePolylineRef.current = import_leaflet_src.default.polyline(latLngs, {
				color: "#0284c7",
				weight: 4.5,
				opacity: .95,
				lineCap: "round",
				lineJoin: "round"
			}).addTo(map);
			map.fitBounds(routePolylineRef.current.getBounds(), {
				padding: [80, 80],
				maxZoom: 18
			});
			toast.success(`Navigation route active: ~${Math.round(route.durationSeconds / 60)} mins to ${destination.name}`);
		}
	};
	const centerOnMyLocation = () => {
		pendingCenterOnNextFixRef.current = true;
		requestLocationUpdate();
		if (mapInstanceRef.current && myLocation) {
			if (isLiteModeRef.current) mapInstanceRef.current.setView([myLocation.latitude, myLocation.longitude], 18, { animate: false });
			else mapInstanceRef.current.flyTo([myLocation.latitude, myLocation.longitude], 18, {
				animate: true,
				duration: .85
			});
			const acc = Math.round(Number(myLocation.accuracy_m ?? myLocation.accuracy));
			toast.success(`Centered on your live location (${myLocation.latitude.toFixed(5)}, ${myLocation.longitude.toFixed(5)} · Accuracy ±${acc} m)`);
		} else toast.info(locationStatus || "Waiting for location");
	};
	const fixAgeSeconds = debugTelemetry.rawFix?.timestamp != null ? Math.max(0, (debugNowMs - debugTelemetry.rawFix.timestamp) / 1e3).toFixed(1) : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: gestureAreaRef,
		className: "relative w-full h-full flex flex-col overflow-hidden bg-slate-100 select-none touch-none",
		style: { touchAction: "none" },
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: rotatableWrapperRef,
				className: "absolute origin-center will-change-transform",
				style: {
					width: "150%",
					height: "150%",
					left: "-25%",
					top: "-25%",
					transform: `rotate(${bearing}deg)`,
					transformOrigin: "50% 50%",
					transition: isGesturing ? "none" : "transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)"
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					ref: mapContainerRef,
					className: "w-full h-full z-0"
				})
			}),
			isDebugMode && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				"data-testid": "location-debug-panel",
				className: "absolute bottom-20 left-4 z-40 w-[350px] max-w-[calc(100vw-2rem)] bg-slate-950/95 backdrop-blur-md text-slate-100 border border-sky-500/50 rounded-2xl p-3 shadow-2xl font-mono text-[11px] space-y-2 pointer-events-auto",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between border-b border-slate-800 pb-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-bold text-sky-400 uppercase tracking-wider text-xs",
							children: "GPS Debug Panel (?debug=1)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-emerald-300",
							children: locationStatus
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-1 text-[10.5px]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-slate-900/90 p-1.5 rounded border border-slate-800",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-slate-400 font-semibold",
									children: "1. Raw Fix (navigator.geolocation):"
								}), debugTelemetry.rawFix ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-white",
									children: [
										"lat: ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sky-300",
											children: debugTelemetry.rawFix.latitude
										}),
										", lng:",
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sky-300",
											children: debugTelemetry.rawFix.longitude
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
										"accuracy:",
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: (debugTelemetry.rawFix.accuracy ?? 999) > 100 ? "text-rose-400 font-bold" : "text-emerald-300",
											children: debugTelemetry.rawFix.accuracy != null ? `${debugTelemetry.rawFix.accuracy} m` : "null"
										}),
										" ",
										"| ts: ",
										debugTelemetry.rawFix.timestamp,
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
										"age (Date.now() - timestamp):",
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-amber-300",
											children: [fixAgeSeconds, "s"]
										}),
										" (",
										Math.max(0, debugNowMs - debugTelemetry.rawFix.timestamp),
										" ms)"
									]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-slate-500",
									children: "Waiting for location..."
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-slate-900/90 p-1.5 rounded border border-slate-800",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-slate-400 font-semibold",
									children: "2. Sent to Database:"
								}), debugTelemetry.sentToDb ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-white break-all",
									children: [
										"geog: ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-emerald-300",
											children: debugTelemetry.sentToDb.geog
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
										"accuracy_m: ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-emerald-300",
											children: debugTelemetry.sentToDb.accuracy_m
										}),
										" ",
										"| lat: ",
										debugTelemetry.sentToDb.latitude,
										", lng: ",
										debugTelemetry.sentToDb.longitude
									]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-slate-500",
									children: "None sent (rejected or waiting)"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-slate-900/90 p-1.5 rounded border border-slate-800",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-slate-400 font-semibold",
									children: "3. Read Back from Database:"
								}), debugTelemetry.readFromDb ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-white break-all",
									children: [
										"lat: ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sky-300",
											children: debugTelemetry.readFromDb.lat
										}),
										", lng:",
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sky-300",
											children: debugTelemetry.readFromDb.lng
										}),
										", accuracy_m:",
										" ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sky-300",
											children: debugTelemetry.readFromDb.accuracy_m
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
										"updated_at: ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-slate-300",
											children: debugTelemetry.readFromDb.updated_at
										})
									]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-slate-500",
									children: "No DB record read back yet"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-slate-900/90 p-1.5 rounded border border-slate-800",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-slate-400 font-semibold",
									children: "4. [lat, lng] Passed to Map Marker:"
								}), debugTelemetry.markerLatLng ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-emerald-300 font-bold",
									children: [
										"[",
										debugTelemetry.markerLatLng[0],
										", ",
										debugTelemetry.markerLatLng[1],
										"]"
									]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-amber-300",
									children: "null (Waiting for location — no marker rendered)"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-slate-900/90 p-1.5 rounded border border-slate-800",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-slate-400 font-semibold",
									children: "5. Last Geolocation Error:"
								}), debugTelemetry.lastGeoError ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-rose-400",
									children: [
										"code ",
										debugTelemetry.lastGeoError.code,
										": ",
										debugTelemetry.lastGeoError.message
									]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-slate-500",
									children: "None"
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "pt-1 border-t border-slate-800 flex flex-wrap gap-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => simulatePositionFix({
									latitude: 48.8584,
									longitude: 2.2945,
									accuracy: 12,
									timestamp: Date.now()
								}),
								className: "px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold cursor-pointer",
								children: "Test 48.8584, 2.2945 (±12m)"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => simulatePositionFix({
									latitude: -33.8688,
									longitude: -70.6693,
									accuracy: 15,
									timestamp: Date.now()
								}),
								className: "px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold cursor-pointer",
								children: "Test -33.8688, -70.6693"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => simulatePositionFix({
									latitude: 37.7749,
									longitude: -122.4194,
									accuracy: 250,
									timestamp: Date.now()
								}),
								className: "px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white text-[10px] font-bold cursor-pointer",
								children: "Test Coarse ±250m (Reject)"
							})
						]
					})
				]
			}),
			(isGesturing || bearing !== 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute bottom-56 right-4 z-20 bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-2xl shadow-xl border border-slate-700/80 flex items-center gap-2 text-xs font-mono animate-in fade-in duration-150",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Compass, {
						className: "w-4 h-4 text-sky-400",
						style: { transform: `rotate(${-bearing}deg)` }
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-bold text-white",
								children: [
									bearing,
									"° ",
									getCompassHeading(bearing)
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-slate-400",
								children: "·"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-sky-300 font-medium",
								children: [
									"Zoom ",
									currentZoom.toFixed(1),
									"x"
								]
							})
						]
					}),
					bearing !== 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: resetNorth,
						title: "Tap to Reset North",
						className: "ml-1 text-[10px] bg-sky-500/30 hover:bg-sky-500/50 text-sky-200 px-2 py-0.5 rounded-lg font-sans font-bold cursor-pointer transition-colors",
						children: "Reset North"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute top-4 left-4 right-4 md:right-auto md:w-[460px] z-30 flex flex-col gap-2",
				children: [
					(!myLocation || gpsError || locationStatus !== "Live") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-3 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-amber-500/40 shadow-2xl text-white flex items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2.5 min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "w-4 h-4" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-bold text-xs text-white",
									children: !myLocation ? "Waiting for location" : locationStatus
								}), (gpsError || locationStatus !== "Waiting for location") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] text-amber-300 leading-snug mt-0.5",
									children: gpsError || locationStatus
								})]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: requestLocationUpdate,
							className: "px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold shrink-0 cursor-pointer active:scale-95 transition-all",
							children: "Retry GPS"
						})]
					}),
					roomOnlyMode && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-2.5 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-sky-500/40 shadow-2xl text-white space-y-2 animate-in fade-in slide-in-from-top-1 duration-150",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2 min-w-0",
								children: [onCloseRoomMap && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: onCloseRoomMap,
									className: "px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0",
									title: "Back to Room",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Back" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "min-w-0",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-1.5",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "w-3.5 h-3.5 text-sky-400 shrink-0" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-bold text-xs text-white truncate",
												children: effectiveRoom?.name || "Room Map"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold font-mono shrink-0 border border-sky-400/30",
												children: [
													roomUsersList.length,
													" ",
													roomUsersList.length === 1 ? "Member" : "Members"
												]
											})
										]
									})
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: fitAllRoomMembersOnMap,
								className: "px-2.5 py-1 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0 shadow-sm",
								title: "Fit all room members on map",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Maximize2, { className: "w-3 h-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Fit All" })]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none",
							children: roomUsersList.map((member) => {
								const hasCoords = Boolean(member.isMe ? myLocation : member.location && typeof member.location.latitude === "number" && typeof member.location.longitude === "number");
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => {
										if (member.isMe && myLocation) {
											centerOnMyLocation();
											setSelectedUser(myLocation);
										} else if (member.location && mapInstanceRef.current) {
											mapInstanceRef.current.flyTo([member.location.latitude, member.location.longitude], 18, {
												animate: true,
												duration: .9
											});
											setSelectedUser(member.location);
										} else toast.info(`${member.fullName} has not shared live GPS coordinates yet`);
									},
									className: `px-2 py-1 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer active:scale-95 ${hasCoords ? "bg-white/10 hover:bg-sky-500/25 border-white/15 hover:border-sky-400/50 text-white" : "bg-white/5 border-white/10 text-slate-400 opacity-75"}`,
									title: hasCoords ? `Locate ${member.fullName} on map` : `${member.fullName} (No live GPS)`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative w-4 h-4 shrink-0",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
											src: member.avatarUrl,
											alt: member.fullName,
											className: "w-4 h-4 rounded-full object-cover border border-white/30"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${member.isOnline ? "bg-emerald-400" : "bg-slate-500"}` })]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate max-w-[90px]",
										children: member.isMe ? "You" : member.fullName.split(" ")[0]
									})]
								}, member.id);
							})
						})]
					}),
					activeRouteData && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-3.5 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-sky-500/40 shadow-2xl text-white flex items-center justify-between gap-3 animate-in slide-in-from-top-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2.5 min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 animate-pulse",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "w-4 h-4" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-bold text-xs text-white truncate",
										children: activeRouteData.destinationName || "Destination"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 font-mono text-[9px] font-bold",
										children: [
											"~",
											Math.round(activeRouteData.durationSeconds / 60),
											" min"
										]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-[11px] text-slate-300 truncate mt-0.5",
									children: [
										activeRouteData.steps?.[0]?.instruction || "Proceed on route",
										" · ",
										formatDistance(activeRouteData.distanceMeters)
									]
								})]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5 shrink-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setShowPlacesPage(true),
								className: "px-2 py-1 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors",
								title: "View full step-by-step route",
								children: "Steps"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: handleClearNavigationRoute,
								className: "p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer",
								title: "End Navigation",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
							})]
						})]
					}),
					nearbyPoisOnMap.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between p-2.5 rounded-2xl bg-slate-900/95 border border-sky-500/40 shadow-xl backdrop-blur-md animate-in slide-in-from-top-1 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-3.5 h-3.5" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-white font-bold truncate",
								children: [
									"Showing ",
									nearbyPoisOnMap.length,
									" places near you"
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 shrink-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setShowPlacesPage(true),
								className: "px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-[11px] cursor-pointer",
								children: "List"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: handleClearNearbyPois,
								className: "p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer",
								title: "Clear plotted places",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-3.5 h-3.5" })
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "relative flex-1",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									onClick: () => setShowPlacesPage(true),
									className: `flex items-center gap-2 ${themeConfig.glassPanel} px-3.5 py-2.5 rounded-2xl shadow-xl border ${themeConfig.glassBorder} cursor-pointer group hover:bg-white/15 transition-all`,
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "w-4 h-4 text-sky-400 shrink-0 group-hover:scale-110 transition-transform" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											placeholder: "Search address, landmark, or street...",
											value: searchQuery,
											readOnly: true,
											onClick: () => setShowPlacesPage(true),
											className: `w-full bg-transparent text-xs ${themeConfig.textPrimary} focus:outline-none placeholder-slate-400 font-medium cursor-pointer`
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 text-[10px] font-bold shrink-0 border border-sky-400/30 group-hover:bg-sky-500 group-hover:text-white transition-colors",
											children: "Google Places"
										})
									]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setShowPlacesPage(true),
								title: "Explore Places Near Me",
								className: "flex items-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs rounded-2xl shadow-xl border border-sky-400/40 cursor-pointer active:scale-95 transition-all shrink-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Compass, { className: "w-4 h-4 text-sky-200" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hidden sm:inline",
									children: "Near Me"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => {
									setShowMapControlsPop(!showMapControlsPop);
									setShowSearchDropdown(false);
								},
								title: "Map Views, Layers & Controls",
								className: `px-3 py-2.5 ${themeConfig.glassPanel} hover:bg-white/15 text-white rounded-2xl shadow-xl border ${themeConfig.glassBorder} flex items-center gap-1.5 shrink-0 transition-all cursor-pointer active:scale-95 ${showMapControlsPop ? "ring-2 ring-sky-400 bg-white/20" : ""}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layers, { className: "w-4 h-4 text-sky-400" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs font-semibold capitalize hidden xs:inline sm:inline",
										children: mapMode === "terrain" ? "Terrain" : mapMode === "satellite" ? "Satellite" : mapMode === "traffic" ? "Traffic" : "Standard"
									}),
									bearing !== 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "px-1.5 py-0.2 bg-sky-500 text-white rounded-full text-[9px] font-mono font-bold",
										children: [bearing, "°"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: `w-3.5 h-3.5 text-slate-300 transition-transform duration-200 ${showMapControlsPop ? "rotate-180" : ""}` })
								]
							})
						]
					}),
					showLayerQuickToggle && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-1 p-1 bg-slate-900/90 backdrop-blur-xl border border-white/15 rounded-2xl shadow-xl z-20 text-white animate-in fade-in slide-in-from-top-1 duration-150",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1 overflow-x-auto py-0.5 px-1 scrollbar-none",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => {
										setMapMode("terrain");
										localStorage.setItem("beacon_map_style", "terrain");
										toast.info("🏔️ Terrain Topo map style enabled");
									},
									className: `px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0 ${mapMode === "terrain" ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md ring-1 ring-white/30" : "text-slate-300 hover:text-white hover:bg-white/10"}`,
									title: "Terrain Topo: Elevation contours & shaded mountains",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mountain, { className: "w-3.5 h-3.5 text-emerald-300" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Terrain" })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => {
										setMapMode("satellite");
										localStorage.setItem("beacon_map_style", "satellite");
										toast.info("🛰️ Satellite HD imagery enabled");
									},
									className: `px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0 ${mapMode === "satellite" ? "bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md ring-1 ring-white/30" : "text-slate-300 hover:text-white hover:bg-white/10"}`,
									title: "Satellite: Aerial hybrid imagery",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, { className: "w-3.5 h-3.5 text-sky-300" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Satellite" })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => {
										setMapMode("standard");
										localStorage.setItem("beacon_map_style", "standard");
										toast.info("🗺️ Standard street map enabled");
									},
									className: `px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0 ${mapMode === "standard" ? "bg-white/20 text-white shadow-md ring-1 ring-white/30" : "text-slate-300 hover:text-white hover:bg-white/10"}`,
									title: "Standard Google street map",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Map$1, { className: "w-3.5 h-3.5 text-slate-300" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Street" })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => {
										setMapMode("traffic");
										localStorage.setItem("beacon_map_style", "traffic");
										toast.info("🚗 Live Traffic layer enabled");
									},
									className: `px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0 ${mapMode === "traffic" ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md ring-1 ring-white/30" : "text-slate-300 hover:text-white hover:bg-white/10"}`,
									title: "Live Traffic congestion overlay",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Car, { className: "w-3.5 h-3.5 text-amber-300" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Traffic" })]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setShowMapControlsPop(true),
							className: "px-2 py-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors shrink-0 mr-1",
							title: "More layer options and controls",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layers, { className: "w-3.5 h-3.5" })
						})]
					}),
					showMapControlsPop && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `w-full ${themeConfig.glassPanel} rounded-3xl shadow-2xl border ${themeConfig.glassBorder} p-4 z-40 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-xl text-white space-y-3.5 max-h-[80vh] overflow-y-auto`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between pb-2 border-b border-white/10",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "w-7 h-7 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layers, { className: "w-4 h-4" })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
										className: "font-bold text-xs text-white",
										children: "Map Views & Layers"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-[10px] text-slate-400",
										children: "High-definition tiles, orientation & trails"
									})] })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setShowMapControlsPop(false),
									className: "p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 font-mono",
								children: "Select Layer Style"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid grid-cols-2 gap-2",
								children: [
									{
										id: "terrain",
										name: "Terrain Topo",
										icon: Mountain,
										desc: "Elevation & Contours"
									},
									{
										id: "satellite",
										name: "Satellite HD",
										icon: Globe,
										desc: "Aerial Hybrid Imagery"
									},
									{
										id: "standard",
										name: "Standard HD",
										icon: Map$1,
										desc: "Google Street Retina"
									},
									{
										id: "traffic",
										name: "Live Traffic",
										icon: Car,
										desc: "Real-time Congestion"
									}
								].map((item) => {
									const Icon = item.icon;
									const isSelected = mapMode === item.id;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => {
											setMapMode(item.id);
											localStorage.setItem("beacon_map_style", item.id);
											toast.info(`${item.name} enabled`);
										},
										className: `p-2.5 rounded-2xl border text-left transition-all flex items-start gap-2.5 cursor-pointer active:scale-95 ${isSelected ? "bg-sky-500/25 border-sky-400/80 ring-1 ring-sky-400/50 shadow-sm" : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: `p-1.5 rounded-xl shrink-0 ${isSelected ? "bg-sky-500 text-white" : "bg-white/10 text-slate-300"}`,
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "w-4 h-4" })
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "min-w-0 flex-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center justify-between",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-bold text-xs text-white truncate",
													children: item.name
												}), isSelected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3.5 h-3.5 text-sky-400 shrink-0" })]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[10px] text-slate-400 block truncate",
												children: item.desc
											})]
										})]
									}, item.id);
								})
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "pt-2 border-t border-white/10",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between mb-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono",
										children: "Orientation & Compass"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-[10px] font-mono text-sky-300 font-bold",
										children: [
											bearing,
											"° ",
											getCompassHeading(bearing),
											" · Zoom ",
											currentZoom.toFixed(1),
											"x"
										]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-3 gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => rotateMapBy(-45),
											className: "py-2 px-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-colors cursor-pointer",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "w-3.5 h-3.5 text-sky-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "-45°" })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: resetNorth,
											className: `py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${bearing !== 0 ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40 ring-1 ring-rose-400/40" : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"}`,
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Compass, { className: "w-3.5 h-3.5 text-rose-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "North (0°)" })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											onClick: () => rotateMapBy(45),
											className: "py-2 px-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-colors cursor-pointer",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCw, { className: "w-3.5 h-3.5 text-sky-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "+45°" })]
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "pt-2 border-t border-white/10 space-y-2.5",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-bold text-xs text-white block",
											children: "Breadcrumb Trails"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] text-slate-400 block",
											children: Object.keys(activeTrails).length > 0 ? `${Object.keys(activeTrails).length} member trail(s) active` : "Historical GPS paths for room members"
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: toggleAllRoomTrails,
												className: "px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors",
												children: roomUsersList.length > 0 && roomUsersList.every((u) => !!activeTrails[u.id]) ? "Hide All" : "Show All"
											}), Object.keys(activeTrails).length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: clearAllTrails,
												className: "px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors",
												children: "Clear"
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between text-xs bg-slate-900/60 p-2 rounded-xl",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] text-slate-400 font-mono",
											children: "History Span:"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg text-[10px]",
											children: [
												{
													label: "15m",
													val: .25
												},
												{
													label: "30m",
													val: .5
												},
												{
													label: "1h",
													val: 1
												}
											].map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: () => reloadAllActiveTrails(opt.val),
												className: `px-2.5 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${trailWindowHours === opt.val ? "bg-sky-500 text-white shadow-xs" : "text-slate-400 hover:text-white"}`,
												children: opt.label
											}, opt.label))
										})]
									}),
									roomUsersList.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "divide-y divide-white/10 max-h-40 overflow-y-auto",
										children: roomUsersList.map((member) => {
											const isActive = !!activeTrails[member.id];
											const isLoading = loadingTrailUserIds.includes(member.id);
											const palette = getPaletteForUser(member.id);
											const trail = activeTrails[member.id];
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "py-1.5 flex items-center justify-between gap-2 hover:bg-white/5 rounded-xl px-1.5 transition-colors",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-2 min-w-0 flex-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
														src: member.avatarUrl,
														alt: member.fullName,
														className: `w-7 h-7 rounded-full object-cover border ${isActive ? palette.border : "border-slate-500"}`
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "truncate flex-1",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-bold text-xs text-white block truncate",
															children: member.fullName
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-[10px] text-slate-400 block truncate",
															children: isActive && trail ? `${formatDistance(trail.totalDistanceMeters)} · ${trail.points.length} pts` : `@${member.username}`
														})]
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center gap-1 shrink-0",
													children: [isActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
														onClick: () => fitUserTrailBounds(member.id),
														title: "Zoom to trail",
														className: "p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Maximize2, { className: "w-3.5 h-3.5" })
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
														onClick: () => toggleUserTrail(member.id),
														disabled: isLoading,
														className: `p-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${isActive ? `${palette.bg} text-white shadow-xs` : "bg-white/10 hover:bg-white/20 text-slate-300"}`,
														title: isActive ? "Hide Trail" : "Show Trail",
														children: isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "w-3.5 h-3.5 animate-spin" }) : isActive ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "w-3.5 h-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "w-3.5 h-3.5 opacity-60" })
													})]
												})]
											}, member.id);
										})
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "pt-2 border-t border-white/10 flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 text-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `w-2.5 h-2.5 rounded-full ${isGpsActive && gpsAccuracy != null ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-amber-400 animate-pulse"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-slate-300 text-xs",
										children: isGpsActive && gpsAccuracy != null ? `Accuracy ±${Math.round(gpsAccuracy)} m` : locationStatus || "Waiting for location"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: centerOnMyLocation,
									className: "px-2.5 py-1 bg-white/10 hover:bg-white/20 text-sky-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Center Me" })]
								})]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `absolute ${roomOnlyMode ? "bottom-4" : "bottom-20"} right-4 md:bottom-6 md:right-6 z-10 flex flex-col items-center gap-2.5`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `${themeConfig.glassPanel} rounded-2xl shadow-xl border ${themeConfig.glassBorder} overflow-hidden flex flex-col`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: zoomIn,
							title: "Zoom In",
							className: "w-11 h-11 text-white hover:bg-white/10 active:scale-95 transition-transform flex items-center justify-center cursor-pointer border-b border-white/10",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "w-4 h-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: zoomOut,
							title: "Zoom Out",
							className: "w-11 h-11 text-white hover:bg-white/10 active:scale-95 transition-transform flex items-center justify-center cursor-pointer",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minus, { className: "w-4 h-4" })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative group",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: resetNorth,
							title: bearing !== 0 ? `Reset to North (Current: ${bearing}° ${getCompassHeading(bearing)})` : "Oriented North (0°)",
							className: `w-12 h-12 rounded-2xl shadow-xl border flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${bearing !== 0 ? "bg-sky-600 text-white border-sky-400 shadow-sky-500/30 ring-2 ring-sky-400/40" : `${themeConfig.glassPanel} text-white hover:bg-white/10 ${themeConfig.glassBorder}`}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative w-6 h-6 flex items-center justify-center transition-transform",
								style: {
									transform: `rotate(${-bearing}deg)`,
									transition: isGesturing ? "none" : "transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)"
								},
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute top-0 w-0 h-0 border-x-[3.5px] border-x-transparent border-b-[10px] border-b-rose-500" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1.5 h-1.5 rounded-full bg-slate-400 z-10" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute bottom-0 w-0 h-0 border-x-[3.5px] border-x-transparent border-t-[10px] border-t-slate-400" })
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `text-[8.5px] font-bold tracking-tight font-mono -mt-0.5 ${bearing !== 0 ? "text-sky-300" : "text-slate-400"}`,
								children: bearing !== 0 ? `${bearing}°` : "N"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `absolute right-full mr-2 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 ${themeConfig.glassPanel} p-1 rounded-2xl shadow-2xl border ${themeConfig.glassBorder} opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => rotateMapBy(-45),
									title: "Rotate 45° CCW",
									className: "px-2 py-1 hover:bg-white/10 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "w-3 h-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "45°" })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: resetNorth,
									title: "Reset North (0°)",
									className: "px-2 py-1 hover:bg-white/10 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors",
									children: "North"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => rotateMapBy(45),
									title: "Rotate 45° CW",
									className: "px-2 py-1 hover:bg-white/10 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCw, { className: "w-3 h-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "45°" })]
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: toggleHeadingUpMode,
						title: isHeadingUpMode ? "Heading-Up Follow Active (Tap to return to North-Up)" : "Enable Heading-Up Direction Follow",
						className: `w-12 h-12 rounded-2xl shadow-xl border flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${isHeadingUpMode ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-cyan-300 shadow-cyan-500/30 ring-2 ring-cyan-400/50" : `${themeConfig.glassPanel} text-white hover:bg-white/10 ${themeConfig.glassBorder}`}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: `w-5 h-5 transition-transform duration-200 ${isHeadingUpMode ? "text-white fill-current scale-110" : "text-cyan-400"}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `text-[8px] font-bold tracking-tight font-mono mt-0.5 ${isHeadingUpMode ? "text-cyan-100" : "text-slate-400"}`,
							children: isHeadingUpMode ? "FOLLOW" : "DIR"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: centerOnMyLocation,
						title: "Center on my location",
						className: `w-12 h-12 ${themeConfig.glassPanel} text-white hover:bg-white/10 active:scale-95 transition-transform rounded-2xl shadow-xl border ${themeConfig.glassBorder} flex items-center justify-center cursor-pointer`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "w-5 h-5 text-sky-400" })
					})
				]
			}),
			selectedUser && activeTrails[selectedUser.userId] && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute top-20 left-4 right-4 md:left-6 md:right-auto md:w-[420px] z-20 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-top-3 duration-200",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between pb-2 border-b border-slate-800",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: activeTrails[selectedUser.userId].avatarUrl,
								alt: "",
								className: "w-7 h-7 rounded-full object-cover border border-sky-400"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h4", {
								className: "font-bold text-xs text-white flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: activeTrails[selectedUser.userId].fullName }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-2 h-2 rounded-full bg-sky-400 animate-ping" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[10px] text-sky-300 font-mono",
								children: "Breadcrumb Trail"
							})] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => fitUserTrailBounds(selectedUser.userId),
								title: "Zoom to fit full path",
								className: "p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Maximize2, { className: "w-3.5 h-3.5" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => toggleUserTrail(selectedUser.userId),
								title: "Close path trace",
								className: "p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-3 gap-2 py-2.5 text-center text-xs",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-slate-800/60 p-2 rounded-xl",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] text-slate-400 block font-mono",
									children: "Distance"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-sky-400 text-sm",
									children: formatDistance(activeTrails[selectedUser.userId].totalDistanceMeters)
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-slate-800/60 p-2 rounded-xl",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] text-slate-400 block font-mono",
									children: "Checkpoints"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-white text-sm",
									children: activeTrails[selectedUser.userId].points.length
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-slate-800/60 p-2 rounded-xl",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] text-slate-400 block font-mono",
									children: "Started"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-emerald-400 text-xs",
									children: new Date(activeTrails[selectedUser.userId].startTime).toLocaleTimeString([], {
										hour: "2-digit",
										minute: "2-digit"
									})
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between pt-1 text-[11px] text-slate-400",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex items-center gap-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "w-3 h-3 text-sky-400" }), "History Span:"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg",
							children: [
								{
									label: "15m",
									val: .25
								},
								{
									label: "30m",
									val: .5
								},
								{
									label: "1h",
									val: 1
								}
							].map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => {
									setTrailWindowHours(opt.val);
									loadUserTrail(selectedUser.userId, opt.val);
								},
								className: `px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${trailWindowHours === opt.val ? "bg-sky-500 text-white shadow-xs" : "text-slate-400 hover:text-white"}`,
								children: opt.label
							}, opt.label))
						})]
					})
				]
			}),
			selectedUser && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `absolute ${roomOnlyMode ? "bottom-4" : "bottom-20"} left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-96 z-30 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 p-4 transition-all`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: selectedUser.avatarUrl,
								alt: selectedUser.fullName,
								className: "w-12 h-12 rounded-full border border-slate-200 object-cover"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "font-bold text-slate-900 text-base",
								children: selectedUser.fullName
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-slate-500",
								children: ["@", selectedUser.username]
							})] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setSelectedUser(null),
							className: "text-slate-400 hover:text-slate-700 p-1 cursor-pointer",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 grid grid-cols-2 gap-2 text-xs border-t border-b border-slate-100 py-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-slate-400 block",
								children: "Distance"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-bold text-slate-900 text-sm",
								children: myLocation && selectedUser.userId !== user?.id ? `${formatDistance(calculateDistanceMeters(myLocation.latitude, myLocation.longitude, selectedUser.latitude, selectedUser.longitude))} away` : "Your Current Spot"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-slate-400 block",
								children: "Accuracy & Signal"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-1.5 flex-wrap",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-semibold text-slate-800",
									children: [
										"Accuracy ±",
										Math.round(Number(selectedUser.accuracy_m ?? selectedUser.accuracy)),
										" m"
									]
								}), getGpsSignalInfo(selectedUser.accuracy).isLowSignal ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold",
									children: getGpsSignalInfo(selectedUser.accuracy).label
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-semibold",
									children: "Strong GPS"
								})]
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-slate-400 block",
								children: "Last Updated"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium text-slate-700",
								children: formatTimeAgo(selectedUser.updated_at || selectedUser.timestamp)
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-slate-400 block",
								children: "Status"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium text-slate-700",
								children: (() => {
									const serverTs = selectedUser.updated_at || selectedUser.timestamp;
									const ageMs = serverTs ? Date.now() - Date.parse(serverTs) : Infinity;
									return Number.isFinite(ageMs) && ageMs < 12e4 ? "Live" : onlineUserIds.includes(selectedUser.userId) ? "Online (Stale fix)" : "Offline";
								})()
							})] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => {
									toggleUserTrail(selectedUser.userId);
								},
								disabled: loadingTrailUserIds.includes(selectedUser.userId),
								className: `flex-1 py-2 px-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 ${activeTrails[selectedUser.userId] ? "bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200" : "bg-sky-600 hover:bg-sky-700 text-white shadow-sm"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Route, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: activeTrails[selectedUser.userId] ? "Hide Trail" : "Trace Path (1h)" })]
							}),
							selectedUser.userId !== user?.id && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => {
									if (onSelectUserForChat) onSelectUserForChat(selectedUser.userId);
									setSelectedUser(null);
								},
								className: "py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "w-3.5 h-3.5" }), "Message"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => {
									if (mapInstanceRef.current) mapInstanceRef.current.flyTo([selectedUser.latitude, selectedUser.longitude], 18);
								},
								className: "p-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors cursor-pointer",
								title: "Focus on map",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Compass, { className: "w-4 h-4" })
							})
						]
					})
				]
			}),
			activeNavigation && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute top-20 left-4 right-4 md:left-6 md:right-auto md:w-[420px] z-30 bg-slate-900/95 backdrop-blur-xl text-white p-4 rounded-2xl shadow-2xl border border-cyan-500/40 animate-in fade-in slide-in-from-top-3 duration-200",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between pb-2.5 border-b border-slate-800",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2.5 min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20 shrink-0",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "w-4 h-4 text-white fill-current" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "truncate",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-sm text-white truncate",
									children: activeNavigation.targetName
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 rounded text-[9px] font-bold font-mono uppercase tracking-wider",
									children: "NAV"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-[10px] text-cyan-300 font-mono",
								children: [formatDistance(activeNavigation.distanceMeters), " away"]
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1.5 shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							href: `https://www.google.com/maps/dir/?api=1&destination=${activeNavigation.lat},${activeNavigation.lng}`,
							target: "_blank",
							rel: "noopener noreferrer",
							title: "Open in Google Maps",
							className: "px-2.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md transition-all cursor-pointer",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden sm:inline",
								children: "Google Maps"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: cancelNavigation,
							title: "End Navigation",
							className: "p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-2 gap-2 pt-2.5 text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-slate-800/70 p-2 rounded-xl flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Footprints, { className: "w-4 h-4 text-cyan-400 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] text-slate-400 block font-mono",
							children: "Walking"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-bold text-white text-xs",
							children: [
								"~",
								activeNavigation.walkMin,
								" min"
							]
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-slate-800/70 p-2 rounded-xl flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Car, { className: "w-4 h-4 text-blue-400 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] text-slate-400 block font-mono",
							children: "Driving"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-bold text-white text-xs",
							children: [
								"~",
								activeNavigation.driveMin,
								" min"
							]
						})] })]
					})]
				})]
			}),
			contextMenu.isOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-40 cursor-default bg-black/10 backdrop-blur-[0.5px]",
				onClick: closeContextMenu,
				onContextMenu: (e) => {
					e.preventDefault();
					closeContextMenu();
				}
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `fixed z-50 w-72 ${themeConfig.glassPanel} rounded-2xl shadow-2xl border ${themeConfig.glassBorder} p-3 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl text-white select-none`,
				style: {
					left: `${contextMenu.x}px`,
					top: `${contextMenu.y}px`
				},
				onClick: (e) => e.stopPropagation(),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between pb-2.5 border-b border-white/10",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2.5 min-w-0",
						children: [contextMenu.target.type === "peer" && contextMenu.target.avatarUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative shrink-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: contextMenu.target.avatarUrl,
								alt: contextMenu.target.title,
								className: "w-8 h-8 rounded-full object-cover border border-cyan-400/80 shadow"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${contextMenu.target.isOnline ? "bg-emerald-500" : "bg-slate-400"}` })]
						}) : contextMenu.target.type === "self" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow shrink-0",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "w-4 h-4 fill-current" })
						}) : contextMenu.target.type === "place" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white shadow shrink-0",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-4 h-4" })
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-cyan-300 shadow shrink-0",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-4 h-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "truncate",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
								className: "font-bold text-xs text-white truncate",
								children: contextMenu.target.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[10px] text-slate-300 truncate font-mono",
								children: contextMenu.target.subtitle || `${contextMenu.target.lat.toFixed(4)}, ${contextMenu.target.lng.toFixed(4)}`
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: closeContextMenu,
						className: "p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-3.5 h-3.5" })
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "py-1.5 space-y-0.5 text-xs",
					children: [
						contextMenu.target.type !== "self" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								const { lat, lng } = contextMenu.target;
								closeContextMenu();
								setManualLocation(lat, lng, 5);
								toast.success(`Exact location set to (${lat.toFixed(5)}, ${lng.toFixed(5)} · ±5m)`);
							},
							className: "w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-7 h-7 rounded-lg bg-sky-500/20 text-sky-300 flex items-center justify-center group-hover:scale-105 transition-transform",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "w-3.5 h-3.5" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-white block",
									children: "Set as My Current Location"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] text-slate-400 block",
									children: "Calibrate exact GPS position (±5m)"
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-mono text-sky-400 font-semibold",
								children: "±5m"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => startNavigation(contextMenu.target.lat, contextMenu.target.lng, contextMenu.target.title),
							className: "w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center group-hover:scale-105 transition-transform",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "w-3.5 h-3.5 fill-current" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-white block",
									children: "Navigate to"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] text-slate-400 block",
									children: "Plot route & turn estimates"
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-mono text-cyan-300 font-semibold",
								children: contextMenu.target.distanceText || "Route"
							})]
						}),
						contextMenu.target.type === "peer" && contextMenu.target.userId && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								const uid = contextMenu.target.userId;
								const name = contextMenu.target.title;
								closeContextMenu();
								if (onSelectUserForChat) {
									onSelectUserForChat(uid);
									toast.success(`Opening chat with ${name}...`);
								}
							},
							className: "w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center group-hover:scale-105 transition-transform",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "w-3.5 h-3.5" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-white block",
									children: "Message user"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] text-slate-400 block",
									children: "Open direct messaging"
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-emerald-400 font-semibold",
								children: "Chat"
							})]
						}),
						contextMenu.target.type === "peer" && contextMenu.target.userId && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								const uid = contextMenu.target.userId;
								const name = contextMenu.target.title;
								const current = getCustomMemberOverrides()[uid];
								closeContextMenu();
								setCustomizingMember({
									userId: uid,
									fullName: name,
									currentColor: current?.color || "#10b981",
									currentIcon: current?.icon || "person",
									currentNickname: current?.nickname || name.split(" ")[0]
								});
							},
							className: "w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-7 h-7 rounded-lg bg-pink-500/20 text-pink-300 flex items-center justify-center group-hover:scale-105 transition-transform",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Palette, { className: "w-3.5 h-3.5" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-white block",
									children: "Family marker style"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] text-slate-400 block",
									children: "Set color, icon (Dad, Mom, Kid)"
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-pink-400 font-semibold",
								children: "Style"
							})]
						}),
						contextMenu.target.type === "self" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								closeContextMenu();
								setShowBlueDotModal(true);
							},
							className: "w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center group-hover:scale-105 transition-transform",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "w-3.5 h-3.5" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-white block",
									children: "Google Maps Blue Dot"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] text-slate-400 block",
									children: "GPS range & facing direction"
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-blue-400 font-semibold",
								children: "Info"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								const lat = contextMenu.target.lat;
								const lng = contextMenu.target.lng;
								const title = contextMenu.target.title;
								closeContextMenu();
								if (onSetReminderAtCoords) {
									onSetReminderAtCoords(lat, lng, title);
									toast.success(`Scheduling reminder at ${title}...`);
								}
							},
							className: "w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center group-hover:scale-105 transition-transform",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "w-3.5 h-3.5" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-white block",
									children: "Set reminder"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] text-slate-400 block",
									children: "Proximity or geofence alert"
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-amber-300 font-semibold",
								children: "Alert"
							})]
						}),
						contextMenu.target.type === "peer" && contextMenu.target.userId && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								const uid = contextMenu.target.userId;
								closeContextMenu();
								toggleUserTrail(uid);
							},
							className: "w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center group-hover:scale-105 transition-transform",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Route, { className: "w-3.5 h-3.5" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-white block",
									children: activeTrails[contextMenu.target.userId] ? "Hide trail" : "Trace path (1h)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] text-slate-400 block",
									children: "Breadcrumb checkpoints"
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-purple-300 font-semibold",
								children: activeTrails[contextMenu.target.userId] ? "Active" : "Trace"
							})]
						}),
						contextMenu.target.type === "place" && contextMenu.target.placeId ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: async () => {
								const pid = contextMenu.target.placeId;
								const pName = contextMenu.target.title;
								closeContextMenu();
								try {
									await api.delete(`/api/saved-places/${pid}`);
									onRefreshSavedPlaces?.();
									toast.success(`Removed "${pName}" from Wishlist`);
								} catch (err) {
									toast.error(err.message || "Failed to remove place");
								}
							},
							className: "w-full px-2.5 py-2 hover:bg-rose-500/20 active:bg-rose-500/30 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-3.5 h-3.5" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-rose-300 block",
									children: "Remove from Wishlist"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] text-slate-400 block",
									children: "Delete saved location marker"
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-rose-400 font-semibold",
								children: "Remove"
							})]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => {
								const lat = contextMenu.target.lat;
								const lng = contextMenu.target.lng;
								closeContextMenu();
								if (onAddPlaceAtCoords) onAddPlaceAtCoords(lat, lng);
							},
							className: "w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center group-hover:scale-105 transition-transform",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-3.5 h-3.5" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-white block",
									children: "Save as place"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] text-slate-400 block",
									children: "Add to your wishlist & geofence list"
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-blue-300 font-semibold",
								children: "Save"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => copyCoordinates(contextMenu.target.lat, contextMenu.target.lng),
							className: "w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-7 h-7 rounded-lg bg-slate-700/60 text-slate-300 flex items-center justify-center group-hover:scale-105 transition-transform",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "w-3.5 h-3.5" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-white block",
									children: "Copy coordinates"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-[10px] text-slate-400 block font-mono",
									children: [
										contextMenu.target.lat.toFixed(5),
										", ",
										contextMenu.target.lng.toFixed(5)
									]
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-slate-400 font-semibold",
								children: "Copy"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => handleShareLocation(contextMenu.target),
							className: "w-full px-2.5 py-2 hover:bg-white/10 active:bg-white/15 rounded-xl flex items-center justify-between transition-colors cursor-pointer group text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-7 h-7 rounded-lg bg-sky-500/20 text-sky-300 flex items-center justify-center group-hover:scale-105 transition-transform",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Share2, { className: "w-3.5 h-3.5" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-bold text-white block",
									children: "Share location link"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] text-slate-400 block",
									children: "External map URL"
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-sky-300 font-semibold",
								children: "Share"
							})]
						})
					]
				})]
			})] }),
			showPlacesPage && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GooglePlacesExplorer, {
				initialQuery: searchQuery,
				onClose: () => setShowPlacesPage(false),
				onSelectPlaceOnMap: handleSelectPlaceFromExplorer,
				onStartRouteOnMap: handleStartRouteOnMap,
				onShowNearbyOnMap: handleShowNearbyPlacesOnMap,
				savedPlaces,
				onRefreshSavedPlaces,
				rooms,
				selectedRoomId
			}),
			showBlueDotModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-white space-y-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-4 h-4 rounded-full bg-[#1a73e8] border-2 border-white shadow" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-bold text-base text-white",
									children: "Your Location (Google Maps Blue Dot)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-slate-400 font-mono",
									children: "Real-time Positioning & Accuracy"
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setShowBlueDotModal(false),
								className: "p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-slate-300 leading-relaxed",
							children: "The blue circular cursor marks your current real-time location based on your phone's GPS, mobile network, and Wi-Fi data."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "space-y-2.5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "w-6 h-6 rounded-full bg-[#1a73e8] border-2 border-white shadow-sm flex items-center justify-center shrink-0 mt-0.5",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-1.5 h-1.5 rounded-full bg-white" })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
										className: "font-bold text-xs text-white",
										children: "The blue dot"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-slate-300 mt-0.5",
										children: "Pinpoints where your device is right now."
									})] })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "w-6 h-6 rounded-full border-2 border-[#4285F4] bg-[#4285F4]/20 flex items-center justify-center shrink-0 mt-0.5",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-2 h-2 rounded-full border border-[#4285F4]" })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
										className: "font-bold text-xs text-white",
										children: "The light-blue shaded ring around it"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-xs text-slate-300 mt-0.5",
										children: [
											"Represents the accuracy range (±",
											myLocation?.accuracy ? Math.round(myLocation.accuracy) : 5,
											" meters). The smaller the ring, the more precise the GPS signal is."
										]
									})] })]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-start gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 mt-0.5",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "w-3.5 h-3.5 fill-current" })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
										className: "font-bold text-xs text-white",
										children: "The faint beam or arrow"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-xs text-slate-300 mt-0.5",
										children: [
											"Indicates the direction your device is currently facing (",
											myLocation?.heading != null ? `${Math.round(myLocation.heading)}° ${getCompassHeading(myLocation.heading)}` : `${userHeading != null ? `${Math.round(userHeading)}°` : "Compass Calibrated"}`,
											")."
										]
									})] })]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-3 gap-2 pt-1 text-center font-mono",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-2 rounded-xl bg-white/5 border border-white/5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] text-slate-400 block",
										children: "GPS Satellites"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs font-bold text-emerald-400",
										children: "Locked"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-2 rounded-xl bg-white/5 border border-white/5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] text-slate-400 block",
										children: "Cellular Towers"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs font-bold text-emerald-400",
										children: "Assisting"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-2 rounded-xl bg-white/5 border border-white/5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] text-slate-400 block",
										children: "Wi-Fi Geodata"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs font-bold text-emerald-400",
										children: "Active"
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "pt-2 flex items-center gap-2 border-t border-slate-800",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => {
									centerOnMyLocation();
									setShowBlueDotModal(false);
								},
								className: "flex-1 py-2.5 px-3 bg-[#1a73e8] hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-lg active:scale-95",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Recenter Map" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => {
									toast.info("Calibrate compass: hold device and move in a smooth Figure-8 pattern in the air.");
								},
								className: "py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer border border-slate-700",
								children: "Calibrate"
							})]
						})
					]
				})
			}),
			customizingMember && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-white space-y-4 max-h-[90vh] overflow-y-auto",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between pb-2 border-b border-slate-800",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-9 h-9 rounded-2xl bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Palette, { className: "w-4 h-4" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-bold text-sm text-white",
									children: "Family Marker Style"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-slate-400",
									children: customizingMember.fullName
								})] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setCustomizingMember(null),
								className: "p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center gap-4",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col items-center",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "relative w-12 h-12 rounded-full border-2 border-white shadow-xl overflow-hidden bg-slate-800 ring-4",
									style: {
										outlineColor: customizingMember.currentColor,
										boxShadow: `0 0 16px ${customizingMember.currentColor}80`
									},
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: userLocations.find((u) => u.userId === customizingMember.userId)?.avatarUrl || "",
										alt: "",
										className: "w-full h-full object-cover"
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-md border border-white/20 flex items-center gap-1 whitespace-nowrap",
									style: { backgroundColor: customizingMember.currentColor },
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: getMemberIconEmoji(customizingMember.currentIcon) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: customizingMember.currentNickname.trim() || customizingMember.fullName.split(" ")[0] })]
								})]
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono",
							children: "Marker Accent Color"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid grid-cols-4 sm:grid-cols-6 gap-2",
							children: MARKER_COLORS.map((c) => {
								const isSelected = customizingMember.currentColor.toLowerCase() === c.hex.toLowerCase();
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setCustomizingMember((prev) => prev ? {
										...prev,
										currentColor: c.hex
									} : null),
									className: `p-2 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${isSelected ? "border-white ring-2 ring-white bg-white/10 shadow" : "border-slate-800 hover:bg-slate-800"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "w-5 h-5 rounded-full border border-white shadow-xs flex items-center justify-center shrink-0",
										style: { backgroundColor: c.hex },
										children: isSelected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3 h-3 text-white stroke-[3]" })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[9px] font-medium text-slate-300 truncate max-w-full",
										children: c.label.split(" ")[0]
									})]
								}, c.id);
							})
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-mono",
							children: "Family Role / Identity Icon"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1 border border-slate-800 rounded-xl",
							children: MEMBER_ICONS.map((icon) => {
								const isSelected = customizingMember.currentIcon === icon.id;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setCustomizingMember((prev) => prev ? {
										...prev,
										currentIcon: icon.id
									} : null),
									className: `p-2 rounded-xl text-left flex items-center gap-1.5 transition-all cursor-pointer text-xs ${isSelected ? "bg-sky-600 text-white font-bold shadow" : "bg-slate-800/80 hover:bg-slate-800 text-slate-300"}`,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-base",
										children: icon.emoji
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate text-[11px]",
										children: icon.label.split(" ")[0]
									})]
								}, icon.id);
							})
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							className: "block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1 font-mono",
							children: "Display Nickname / Tag"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							maxLength: 20,
							placeholder: "e.g. Dad, Mom, Lucas, Van",
							value: customizingMember.currentNickname,
							onChange: (e) => setCustomizingMember((prev) => prev ? {
								...prev,
								currentNickname: e.target.value
							} : null),
							className: "w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "pt-2 flex items-center justify-between gap-2 border-t border-slate-800",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									saveCustomMemberOverride(customizingMember.userId, {
										color: "#10b981",
										icon: "person",
										nickname: customizingMember.fullName.split(" ")[0]
									});
									setMemberOverridesVersion((v) => v + 1);
									toast.success("Reset family marker style");
									setCustomizingMember(null);
								},
								className: "px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800",
								children: "Reset"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setCustomizingMember(null),
									className: "px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800",
									children: "Cancel"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => {
										saveCustomMemberOverride(customizingMember.userId, {
											color: customizingMember.currentColor,
											icon: customizingMember.currentIcon,
											nickname: customizingMember.currentNickname.trim() || customizingMember.fullName.split(" ")[0]
										});
										setMemberOverridesVersion((v) => v + 1);
										toast.success(`Updated map style for ${customizingMember.fullName}`);
										setCustomizingMember(null);
									},
									className: "px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md cursor-pointer active:scale-95",
									children: "Save Style"
								})]
							})]
						})
					]
				})
			})
		]
	});
};
// src/components/Alerts/EmergencyManager.tsx
var EmergencyLocationMap = ({ latitude, longitude, accuracy, senderName, message, viewerLocation, onOpenFullMap, heightClass = "h-56" }) => {
	const mapContainerRef = (0, import_react.useRef)(null);
	const mapInstanceRef = (0, import_react.useRef)(null);
	const [copied, setCopied] = (0, import_react.useState)(false);
	const [tileMode, setTileMode] = (0, import_react.useState)("hybrid");
	const tileLayerRef = (0, import_react.useRef)(null);
	const hasValidCoords = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 && !(latitude === 0 && longitude === 0);
	const distanceMeters = hasValidCoords && viewerLocation && Number.isFinite(viewerLocation.latitude) && Number.isFinite(viewerLocation.longitude) ? calculateDistanceMeters(viewerLocation.latitude, viewerLocation.longitude, latitude, longitude) : null;
	(0, import_react.useEffect)(() => {
		if (!hasValidCoords || !mapContainerRef.current) return;
		if (mapInstanceRef.current) {
			mapInstanceRef.current.remove();
			mapInstanceRef.current = null;
		}
		const map = import_leaflet_src.default.map(mapContainerRef.current, {
			center: [latitude, longitude],
			zoom: 17,
			zoomControl: false,
			attributionControl: false
		});
		const tileUrl = tileMode === "hybrid" ? "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
		tileLayerRef.current = import_leaflet_src.default.tileLayer(tileUrl, { maxZoom: 20 }).addTo(map);
		if (Number.isFinite(accuracy) && accuracy > 0) import_leaflet_src.default.circle([latitude, longitude], {
			radius: accuracy,
			color: "#e11d48",
			weight: 2,
			fillColor: "#f43f5e",
			fillOpacity: .18
		}).addTo(map);
		const sosIcon = import_leaflet_src.default.divIcon({
			className: "emergency-sos-pin",
			html: `
        <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;inset:0;border-radius:9999px;background:rgba(225,29,72,0.45);animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="position:relative;width:32px;height:32px;border-radius:9999px;background:#e11d48;border:3px solid #ffffff;box-shadow:0 4px 14px rgba(225,29,72,0.65);display:flex;align-items:center;justify-content:center;color:#ffffff;font-weight:900;font-size:10px;letter-spacing:0.04em;">
            SOS
          </div>
        </div>
      `,
			iconSize: [44, 44],
			iconAnchor: [22, 22]
		});
		import_leaflet_src.default.marker([latitude, longitude], { icon: sosIcon }).addTo(map).bindPopup(`<div style="font-family:system-ui,sans-serif;min-width:170px;">
        <div style="font-weight:800;color:#be123c;font-size:12px;">SOS: ${senderName}</div>
        ${message ? `<div style="font-size:11px;color:#1e293b;margin-top:2px;">"${message}"</div>` : ""}
        <div style="font-family:monospace;font-size:11px;color:#0f172a;margin-top:4px;font-weight:700;">
          ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
        </div>
        <div style="font-size:10px;color:#64748b;margin-top:2px;">
          ${formatAccuracy(accuracy)}
        </div>
      </div>`);
		mapInstanceRef.current = map;
		const timer = setTimeout(() => {
			map.invalidateSize();
		}, 150);
		return () => {
			clearTimeout(timer);
			map.remove();
			mapInstanceRef.current = null;
		};
	}, [
		latitude,
		longitude,
		accuracy,
		senderName,
		message,
		hasValidCoords,
		tileMode
	]);
	const handleCopyCoords = () => {
		if (!hasValidCoords) return;
		const text = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
		navigator.clipboard?.writeText(text).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2e3);
		});
	};
	if (!hasValidCoords) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-center gap-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "w-4 h-4 text-amber-600 shrink-0 animate-spin" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Waiting for location — no valid GPS coordinates received yet." })]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl overflow-hidden border-2 border-rose-200 bg-slate-900 shadow-md",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `relative w-full ${heightClass}`,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					ref: mapContainerRef,
					className: "w-full h-full z-0"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute top-2.5 left-2.5 z-[400] bg-slate-950/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl border border-rose-500/40 shadow-lg flex flex-col gap-0.5 pointer-events-auto",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-400",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-2 h-2 rounded-full bg-rose-500 animate-ping" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Emergency GPS Pin" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-slate-300 font-semibold",
								children: ["· ", formatAccuracy(accuracy)]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "font-mono text-xs font-bold text-white tracking-tight",
						children: [
							"LAT ",
							latitude.toFixed(6),
							"° · LNG ",
							longitude.toFixed(6),
							"°"
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute top-2.5 right-2.5 z-[400] flex items-center gap-1.5 pointer-events-auto",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setTileMode((prev) => prev === "hybrid" ? "street" : "hybrid"),
						className: "px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-white text-[11px] font-bold border border-white/15 shadow cursor-pointer",
						children: tileMode === "hybrid" ? "Street" : "Satellite"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => {
							if (mapInstanceRef.current) mapInstanceRef.current.setView([latitude, longitude], 17, { animate: true });
						},
						className: "p-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-white border border-white/15 shadow cursor-pointer",
						title: "Recenter on SOS pin",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crosshair, { className: "w-3.5 h-3.5 text-rose-400" })
					})]
				}),
				distanceMeters !== null && distanceMeters > 2 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute bottom-2.5 left-2.5 z-[400] bg-rose-600/95 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold shadow flex items-center gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "w-3 h-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [formatDistance(distanceMeters), " from your location"] })]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "bg-slate-950 text-white px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 text-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-4 h-4 text-rose-500 shrink-0" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "font-mono font-bold text-rose-100",
						children: [
							latitude.toFixed(6),
							", ",
							longitude.toFixed(6)
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-[11px] text-slate-400 hidden sm:inline",
						children: [
							"(",
							formatAccuracy(accuracy),
							")"
						]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-1.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: handleCopyCoords,
						className: "px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer",
						children: copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3.5 h-3.5 text-emerald-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-emerald-300",
							children: "Copied"
						})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "w-3.5 h-3.5 text-slate-300" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Copy Coords" })] })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: getNativeNavigationUrl(latitude, longitude, viewerLocation?.latitude, viewerLocation?.longitude),
						target: "_blank",
						rel: "noopener noreferrer",
						className: "px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "w-3 h-3 fill-current" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Get Directions" })]
					}),
					onOpenFullMap && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => onOpenFullMap(latitude, longitude),
						className: "px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Maximize2, { className: "w-3 h-3" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Full Map" })]
					})
				]
			})]
		})]
	});
};
var EmergencySharePanel = ({ alert, onClose, compact = false }) => {
	const toast = useToast();
	const [shareData, setShareData] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [copiedUrl, setCopiedUrl] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		let mounted = true;
		const generateShare = async () => {
			setLoading(true);
			try {
				const res = await api.post(`/api/alerts/emergency/${alert.id}/share`);
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
			toast.success("Temporary secure tracking URL copied to clipboard");
			setTimeout(() => setCopiedUrl(false), 2500);
		});
	};
	const handleNativeShare = async () => {
		if (!shareData) return;
		if (navigator.share) try {
			await navigator.share({
				title: `EMERGENCY SOS: ${alert.senderName}`,
				text: shareData.shareMessage,
				url: shareData.trackingUrl
			});
			return;
		} catch {}
		handleCopyUrl();
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		style: { colorScheme: "light" },
		className: `rounded-2xl bg-slate-950 text-white border border-sky-400/40 shadow-xl ${compact ? "p-3.5 space-y-2.5" : "p-4 space-y-3"}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 shrink-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "w-3.5 h-3.5" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs font-extrabold text-white tracking-tight",
						children: "Temporary Secure Live Tracking Link"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold uppercase",
						children: "Valid 2h"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] text-slate-300",
					children: "Share with emergency responders via SMS, WhatsApp, or messaging apps — no login required."
				})] })]
			}), onClose && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: onClose,
				className: "text-[11px] font-bold text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-900 cursor-pointer",
				children: "Close"
			})]
		}), loading || !shareData ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2 text-xs text-sky-300 py-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "w-3.5 h-3.5 animate-spin" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Generating encrypted responder tracking URL..." })]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2 bg-slate-900/95 border border-slate-800 rounded-xl p-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				type: "text",
				readOnly: true,
				value: shareData.trackingUrl,
				onFocus: (e) => e.currentTarget.select(),
				className: "w-full bg-transparent text-[11px] font-mono text-sky-300 focus:outline-none truncate"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: handleCopyUrl,
				className: "px-2.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-[11px] flex items-center gap-1 shrink-0 cursor-pointer transition-colors",
				children: copiedUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Copied" })] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Copy URL" })] })
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					href: shareData.smsHref,
					className: "flex-1 min-w-[125px] px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow cursor-pointer transition-transform active:scale-95",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "w-3.5 h-3.5 fill-current" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Send via SMS" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					href: shareData.whatsappHref,
					target: "_blank",
					rel: "noopener noreferrer",
					className: "flex-1 min-w-[135px] px-3 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow cursor-pointer transition-transform active:scale-95",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "WhatsApp / Chat" })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: handleNativeShare,
					className: "px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer transition-transform active:scale-95",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Share2, { className: "w-3.5 h-3.5 text-sky-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Share App..." })]
				})
			]
		})] })]
	});
};
var EmergencyResponderTrackingView = ({ token, initialAlertId, initialLat, initialLng, initialAcc, initialSender, initialMsg, expiresAtMs, onExitTracking }) => {
	const [trackingAlert, setTrackingAlert] = (0, import_react.useState)(() => {
		if (typeof initialLat === "number" && typeof initialLng === "number" && Number.isFinite(initialLat) && Number.isFinite(initialLng) && !(initialLat === 0 && initialLng === 0)) return {
			id: initialAlertId || "sos-live",
			senderId: "sender",
			senderName: initialSender || "Beacon Member",
			senderAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120",
			latitude: initialLat,
			longitude: initialLng,
			accuracy: initialAcc || 15,
			message: initialMsg || "EMERGENCY SOS: Immediate assistance required!",
			timestamp: (/* @__PURE__ */ new Date()).toISOString(),
			status: "active",
			acknowledgedBy: []
		};
		return null;
	});
	const [expiresAt, setExpiresAt] = (0, import_react.useState)(expiresAtMs ? new Date(expiresAtMs).toISOString() : null);
	const [error, setError] = (0, import_react.useState)(null);
	const [viewerLocation, setViewerLocation] = (0, import_react.useState)(null);
	const [lastUpdated, setLastUpdated] = (0, import_react.useState)(/* @__PURE__ */ new Date());
	(0, import_react.useEffect)(() => {
		if ("geolocation" in navigator) {
			const watchId = navigator.geolocation.watchPosition((pos) => {
				setViewerLocation({
					latitude: pos.coords.latitude,
					longitude: pos.coords.longitude
				});
			}, () => {}, {
				enableHighAccuracy: true,
				maximumAge: 5e3,
				timeout: 1e4
			});
			return () => navigator.geolocation.clearWatch(watchId);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		let active = true;
		const fetchLiveTrack = async () => {
			try {
				const res = await api.get(`/api/alerts/track/${encodeURIComponent(token)}`);
				if (!active) return;
				const mergedAlert = res.liveCoordinates ? {
					...res.alert,
					latitude: res.liveCoordinates.latitude,
					longitude: res.liveCoordinates.longitude,
					accuracy: res.liveCoordinates.accuracy
				} : res.alert;
				setTrackingAlert(mergedAlert);
				setExpiresAt(res.expiresAt);
				setLastUpdated(/* @__PURE__ */ new Date());
				setError(null);
			} catch {
				if (!active) return;
				if (!trackingAlert) setError("This temporary emergency tracking link has expired or is invalid.");
			}
		};
		fetchLiveTrack();
		const interval = setInterval(fetchLiveTrack, 3e3);
		return () => {
			active = false;
			clearInterval(interval);
		};
	}, [token]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-screen bg-slate-950 text-white flex flex-col p-4 md:p-6",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-3xl w-full mx-auto space-y-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-gradient-to-r from-rose-700 via-rose-600 to-red-700 rounded-3xl p-5 shadow-2xl border border-rose-400/40 flex flex-wrap items-center justify-between gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "w-12 h-12 rounded-2xl bg-white text-rose-600 flex items-center justify-center font-black shadow-lg shrink-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Siren, { className: "w-7 h-7 animate-spin" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "px-2 py-0.5 rounded-full bg-slate-950/40 text-white text-[10px] font-black uppercase tracking-wider",
							children: "LIVE RESPONDER TRACKING"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-[11px] text-rose-100 font-semibold",
							children: ["Updated ", lastUpdated.toLocaleTimeString()]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-xl font-black tracking-tight mt-0.5",
						children: trackingAlert ? `Emergency SOS: ${trackingAlert.senderName}` : "Connecting to SOS Beacon..."
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: onExitTracking,
					className: "px-3.5 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-900 text-white text-xs font-bold border border-white/15 flex items-center gap-1.5 cursor-pointer",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Open Full Beacon App" })]
				})]
			}), error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl bg-slate-900 border border-rose-500/40 p-6 text-center space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "w-10 h-10 text-rose-500 mx-auto" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-base font-bold text-white",
						children: error
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onExitTracking,
						className: "px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer",
						children: "Return to App"
					})
				]
			}) : trackingAlert ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/30 text-sm font-bold text-rose-100",
						children: [
							"\"",
							trackingAlert.message,
							"\""
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmergencyLocationMap, {
						latitude: trackingAlert.latitude,
						longitude: trackingAlert.longitude,
						accuracy: trackingAlert.accuracy,
						senderName: trackingAlert.senderName,
						message: trackingAlert.message,
						timestamp: trackingAlert.timestamp,
						viewerLocation,
						heightClass: "h-80"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-950 p-3.5 rounded-2xl border border-slate-800",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-slate-400 block",
								children: "Live GPS Coordinates"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-mono font-bold text-white text-sm",
								children: [
									trackingAlert.latitude.toFixed(6),
									", ",
									trackingAlert.longitude.toFixed(6)
								]
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-slate-400 block",
								children: "Signal Accuracy"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-bold text-emerald-400 text-sm",
								children: formatAccuracy(trackingAlert.accuracy)
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-slate-400 block",
								children: "Link Expiration"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold text-slate-300",
								children: expiresAt ? new Date(expiresAt).toLocaleTimeString() : "Active Session"
							})] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							href: getNativeNavigationUrl(trackingAlert.latitude, trackingAlert.longitude, viewerLocation?.latitude, viewerLocation?.longitude),
							target: "_blank",
							rel: "noopener noreferrer",
							className: "flex-1 min-w-[200px] py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "w-4 h-4 fill-current" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Get Turn-by-Turn Directions" })]
						}), trackingAlert.senderPhone && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							href: `tel:${trackingAlert.senderPhone}`,
							className: "py-3 px-5 rounded-2xl bg-white text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "w-4 h-4 text-rose-600" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Call ", trackingAlert.senderPhone] })]
						})]
					})
				]
			}) : null]
		})
	});
};
var EmergencyManager = ({ onViewLocationOnMap, onSelectUserForChat }) => {
	const { user } = useAuth();
	const { myLocation, userLocations, activeAlerts, triggerEmergencySos, acknowledgeEmergency, deleteEmergencyAlert, latestAlert, dismissLatestAlert } = useRealtime();
	const toast = useToast();
	const [sosMessage, setSosMessage] = (0, import_react.useState)("EMERGENCY: Immediate help needed!");
	const [showConfirmModal, setShowConfirmModal] = (0, import_react.useState)(false);
	const [isTriggering, setIsTriggering] = (0, import_react.useState)(false);
	const [openShareAlertId, setOpenShareAlertId] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const handleOpenSos = () => setShowConfirmModal(true);
		window.addEventListener("beacon:open-sos-modal", handleOpenSos);
		return () => window.removeEventListener("beacon:open-sos-modal", handleOpenSos);
	}, []);
	const referenceCoords = (0, import_react.useMemo)(() => {
		if (latestAlert && latestAlert.status === "active") return {
			latitude: latestAlert.latitude,
			longitude: latestAlert.longitude,
			label: `${latestAlert.senderName}'s SOS`
		};
		if (myLocation) return {
			latitude: myLocation.latitude,
			longitude: myLocation.longitude,
			label: "Your Location"
		};
		return null;
	}, [latestAlert, myLocation]);
	const nearby5kmUsers = (0, import_react.useMemo)(() => {
		if (!referenceCoords) return [];
		const results = [];
		userLocations.forEach((loc) => {
			if (!loc || !Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude) || loc.latitude === 0 && loc.longitude === 0) return;
			const dist = calculateDistanceMeters(referenceCoords.latitude, referenceCoords.longitude, loc.latitude, loc.longitude);
			if (dist <= 5e3) {
				const isMe = Boolean(user && loc.userId === user.id);
				results.push({
					userId: loc.userId,
					fullName: isMe && user ? `${user.fullName} (You)` : loc.fullName || `Member ${loc.userId.slice(0, 6)}`,
					avatar: loc.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120",
					distanceMeters: dist,
					latitude: loc.latitude,
					longitude: loc.longitude,
					accuracy: loc.accuracy
				});
			}
		});
		return results.sort((a, b) => a.distanceMeters - b.distanceMeters);
	}, [
		referenceCoords,
		userLocations,
		user
	]);
	const handleSendSos = () => {
		setIsTriggering(true);
		triggerHaptic("sos");
		triggerEmergencySos(sosMessage);
		setShowConfirmModal(false);
		setIsTriggering(false);
		toast.success("Emergency SOS broadcast transmitted with live GPS coordinates");
	};
	const handleResolve = async (alertId) => {
		try {
			await api.post(`/api/alerts/emergency/${alertId}/resolve`);
			dismissLatestAlert();
			toast.success("Distress alert resolved");
		} catch (err) {
			toast.error(err.message || "Failed to resolve alert");
		}
	};
	const handleDeleteAlert = async (alertId) => {
		try {
			await deleteEmergencyAlert(alertId);
			toast.success("Distress alert deleted");
		} catch (err) {
			toast.error(err.message || "Failed to delete alert");
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "h-full bg-slate-50 overflow-y-auto p-4 md:p-6 pb-28 space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "shrink-0 bg-gradient-to-r from-rose-950 via-rose-900 to-slate-900 text-white rounded-3xl p-5 md:p-6 shadow-xl relative",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider mb-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Siren, { className: "w-4 h-4 animate-pulse shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Community Safety Mesh · 5 km Automatic Device Pop-Up Alert Radius" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-xl md:text-2xl font-black tracking-tight",
							children: "Emergency Broadcast Network"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-rose-200 mt-1 max-w-lg leading-relaxed",
							children: "Instantly transmit high-priority distress alerts with an interactive live map, temporary secure responder tracking link, and automatic device pop-up notifications to everyone within 5 km."
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setShowConfirmModal(true),
						className: "w-full md:w-auto px-6 py-3.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-black text-sm rounded-2xl shadow-lg shadow-rose-900/50 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "w-5 h-5 fill-current shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "BROADCAST EMERGENCY SOS" })]
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-2 flex-wrap",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "w-4 h-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
							className: "font-bold text-slate-900 text-sm",
							children: [
								"People Nearby Within 5 km (",
								nearby5kmUsers.length,
								")"
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] text-slate-500",
							children: referenceCoords ? `Showing live members within 5 km of ${referenceCoords.label} who receive instant emergency pop-up notifications` : "Waiting for your live GPS fix to detect members within 5 km"
						})] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold",
						children: "5.0 km Alert Zone"
					})]
				}), nearby5kmUsers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-100",
					children: "No other active members detected within a 5 km radius right now."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5",
					children: nearby5kmUsers.map((person) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2.5 min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: person.avatar,
								alt: person.fullName,
								className: "w-9 h-9 rounded-full object-cover border border-emerald-400 shrink-0"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs font-bold text-slate-900 truncate",
									children: person.fullName
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] text-emerald-700 font-semibold",
									children: person.distanceMeters < 15 ? "At SOS location" : `${formatDistance(person.distanceMeters)} away`
								})]
							})]
						}), onViewLocationOnMap && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => onViewLocationOnMap(person.latitude, person.longitude),
							className: "px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold shrink-0 cursor-pointer",
							children: "Locate"
						})]
					}, person.userId))
				})]
			}),
			latestAlert && latestAlert.status === "active" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-rose-600 text-white p-4 rounded-2xl shadow-xl space-y-3 border-2 border-rose-300",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-3 flex-wrap",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "w-10 h-10 rounded-full bg-white text-rose-600 flex items-center justify-center font-bold shrink-0",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Siren, { className: "w-6 h-6 animate-spin" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "font-bold text-sm",
									children: ["Active SOS: ", latestAlert.senderName]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-rose-100",
									children: latestAlert.message
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-[11px] font-mono font-bold text-white mt-0.5",
									children: [
										"Coordinates: ",
										latestAlert.latitude.toFixed(6),
										", ",
										latestAlert.longitude.toFixed(6),
										" (",
										formatAccuracy(latestAlert.accuracy),
										")"
									]
								})
							] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 flex-wrap",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setOpenShareAlertId((prev) => prev === latestAlert.id ? null : latestAlert.id),
									className: "px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Share2, { className: "w-3.5 h-3.5" }), "Share Live Location"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									href: getNativeNavigationUrl(latestAlert.latitude, latestAlert.longitude, myLocation?.latitude, myLocation?.longitude),
									target: "_blank",
									rel: "noopener noreferrer",
									className: "px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "w-3.5 h-3.5 fill-current" }), "Get Directions"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => {
										if (onViewLocationOnMap) onViewLocationOnMap(latestAlert.latitude, latestAlert.longitude);
									},
									className: "px-3 py-1.5 bg-white text-rose-700 font-bold text-xs rounded-xl shadow-sm cursor-pointer",
									children: "View on Map"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: dismissLatestAlert,
									className: "p-2 hover:bg-rose-700 rounded-xl cursor-pointer",
									title: "Silence siren",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { className: "w-4 h-4" })
								})
							]
						})]
					}),
					openShareAlertId === latestAlert.id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmergencySharePanel, {
						alert: latestAlert,
						onClose: () => setOpenShareAlertId(null),
						compact: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmergencyLocationMap, {
						latitude: latestAlert.latitude,
						longitude: latestAlert.longitude,
						accuracy: latestAlert.accuracy,
						senderName: latestAlert.senderName,
						message: latestAlert.message,
						timestamp: latestAlert.timestamp,
						viewerLocation: myLocation,
						onOpenFullMap: onViewLocationOnMap,
						heightClass: "h-48"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "font-bold text-slate-900 text-base mb-3 flex items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "w-5 h-5 text-rose-600" }),
					"Active Distress Alerts (",
					activeAlerts.length,
					")"
				]
			}), activeAlerts.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheckBig, { className: "w-10 h-10 text-emerald-500 mx-auto mb-2" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
						className: "font-semibold text-slate-800 text-sm",
						children: "No Active Emergency Alerts"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-slate-500 mt-1",
						children: "Your groups and community channels are currently secure."
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-4",
				children: activeAlerts.map((alert) => {
					const isAcknowledgedByMe = alert.acknowledgedBy.some((a) => a.userId === user?.id);
					const isMyAlert = alert.senderId === user?.id;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-white rounded-2xl border-2 border-rose-300 p-5 shadow-sm space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: alert.senderAvatar,
										alt: alert.senderName,
										className: "w-12 h-12 rounded-full object-cover border-2 border-rose-500"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
											className: "font-bold text-slate-900 text-base",
											children: alert.senderName
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold",
											children: "SOS ACTIVE"
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-xs text-slate-500 flex items-center gap-1 mt-0.5",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "w-3.5 h-3.5" }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatTimeAgo(alert.timestamp) }),
											alert.roomName && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "·" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: alert.roomName })] })
										]
									})] })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [isMyAlert && alert.status === "active" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => handleResolve(alert.id),
										className: "px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer",
										children: "Mark Resolved"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => handleDeleteAlert(alert.id),
										className: "px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95",
										title: "Delete Alert",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-3.5 h-3.5" }), "Delete Alert"]
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-3 bg-rose-50/70 rounded-xl border border-rose-100 text-sm font-semibold text-rose-950",
								children: [
									"\"",
									alert.message,
									"\""
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmergencyLocationMap, {
								latitude: alert.latitude,
								longitude: alert.longitude,
								accuracy: alert.accuracy,
								senderName: alert.senderName,
								message: alert.message,
								timestamp: alert.timestamp,
								viewerLocation: myLocation,
								onOpenFullMap: onViewLocationOnMap,
								heightClass: "h-60"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-slate-400 block",
										children: "Exact Coordinates (Lat, Lng)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-mono text-slate-900 font-bold",
										children: [
											alert.latitude.toFixed(6),
											", ",
											alert.longitude.toFixed(6)
										]
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-slate-400 block",
										children: "GPS Accuracy"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-semibold text-slate-800",
										children: formatAccuracy(alert.accuracy)
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-slate-400 block",
										children: "Phone Contact"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-medium text-slate-800",
										children: alert.senderPhone || "Hidden by privacy"
									})] })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center gap-2 pt-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => {
											if (onViewLocationOnMap) onViewLocationOnMap(alert.latitude, alert.longitude);
										},
										className: "px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-4 h-4" }), "View Real Location on Map"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
										href: getNativeNavigationUrl(alert.latitude, alert.longitude, myLocation?.latitude, myLocation?.longitude),
										target: "_blank",
										rel: "noopener noreferrer",
										className: "px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "w-4 h-4 fill-current" }), "Get Directions"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										onClick: () => setOpenShareAlertId((prev) => prev === alert.id ? null : alert.id),
										className: "px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Share2, { className: "w-4 h-4" }), "Share Live Location"]
									}),
									alert.senderPhone && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
										href: `tel:${alert.senderPhone}`,
										className: "px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1.5",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "w-4 h-4 text-emerald-600" }),
											"Call ",
											alert.senderPhone
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => {
											if (onSelectUserForChat) onSelectUserForChat(alert.senderId);
										},
										className: "px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "w-4 h-4" }), "Message"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => acknowledgeEmergency(alert.id),
										disabled: isAcknowledgedByMe,
										className: `px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 ml-auto cursor-pointer ${isAcknowledgedByMe ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-900 text-white hover:bg-slate-800"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheckBig, { className: "w-4 h-4" }), isAcknowledgedByMe ? "Acknowledged by You" : "Acknowledge Alert"]
									})
								]
							}),
							openShareAlertId === alert.id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmergencySharePanel, {
								alert,
								onClose: () => setOpenShareAlertId(null)
							}),
							alert.acknowledgedBy.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex items-center gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-semibold text-slate-700",
									children: "Responders: "
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: alert.acknowledgedBy.map((a) => a.name).join(", ") })]
							})
						]
					}, alert.id);
				})
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[10px] font-black uppercase tracking-wider text-emerald-400",
						children: "GitHub Automated Release Pipeline"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
						className: "text-sm font-bold text-white mt-0.5",
						children: "Beacon Native Android APK (`app-debug.apk`)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-slate-400 mt-0.5",
						children: "Automatically compiled and published to GitHub Releases whenever you sync/push to `main`."
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 shrink-0 flex-wrap",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: "https://github.com/Harikrishna8118/Track-Your-Friends-/releases/latest/download/app-debug.apk",
						target: "_blank",
						rel: "noopener noreferrer",
						className: "px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow cursor-pointer",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Download Latest APK" })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: "https://github.com/Harikrishna8118/Track-Your-Friends-/actions",
						target: "_blank",
						rel: "noopener noreferrer",
						className: "px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 cursor-pointer",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, { className: "w-3.5 h-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "GitHub Actions" })]
					})]
				})]
			}),
			showConfirmModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					style: { colorScheme: "light" },
					className: "bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-rose-200 max-h-[90vh] overflow-y-auto",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-3 mb-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Siren, { className: "w-6 h-6 animate-pulse" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "text-lg font-black text-slate-900",
								children: "Broadcast Emergency SOS?"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-slate-600 font-medium",
								children: "Your live location map and exact GPS coordinates will trigger pop-up notifications on devices within 5 km."
							})] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mb-4",
							children: myLocation ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmergencyLocationMap, {
								latitude: myLocation.latitude,
								longitude: myLocation.longitude,
								accuracy: myLocation.accuracy,
								senderName: user?.fullName || "You",
								message: sosMessage,
								heightClass: "h-44"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 font-medium",
								children: "Waiting for location — your device will request a high-accuracy GPS fix when you confirm."
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-bold text-slate-950 mb-1",
								children: "Distress Message"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: sosMessage,
								onChange: (e) => setSosMessage(e.target.value),
								placeholder: "EMERGENCY: Immediate help needed!",
								style: {
									color: "#090d16",
									backgroundColor: "#ffffff",
									colorScheme: "light",
									WebkitTextFillColor: "#090d16"
								},
								className: "w-full px-3.5 py-2.5 rounded-xl border-2 border-rose-300 bg-white text-slate-950 placeholder:text-slate-500 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-rose-600 focus:border-rose-600 shadow-sm"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-end gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setShowConfirmModal(false),
								className: "px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: handleSendSos,
								disabled: isTriggering,
								className: "px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-900/30 flex items-center gap-1.5 cursor-pointer",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "w-4 h-4 fill-current" }), "Confirm SOS Broadcast"]
							})]
						})
					]
				})
			})
		]
	});
};
// \0vite/preload-helper.js
var scriptRel = "modulepreload";
var assetsURL = function(dep) {
	return "/" + dep;
};
var seen = {};
var isCssPreloadUrl = function isCssPreloadUrl(url) {
	return url.pathname.endsWith(".css");
};
var preloadOnce = function preloadOnce(seen, href, preload) {
	if (href in seen) return seen[href];
	const promise = preload();
	if (!promise) {
		seen[href] = void 0;
		return;
	}
	const preloadPromise = promise.then(() => {
		seen[href] = void 0;
	}, (err) => {
		seen[href] = void 0;
		throw err;
	});
	seen[href] = preloadPromise;
	return preloadPromise;
};
var __vitePreload = function preload(baseModule, deps, importerUrl) {
	let promise = Promise.resolve();
	if (deps && deps.length > 0) {
		let preloadedHrefs;
		const cspNonceMeta = document.querySelector("meta[property=csp-nonce]");
		const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
		function allSettled(promises) {
			return Promise.all(promises.map((p) => Promise.resolve(p).then((value) => ({
				status: "fulfilled",
				value
			}), (reason) => ({
				status: "rejected",
				reason
			}))));
		}
		function importMetaResolve(specifier) {
			if (import.meta.resolve) return new URL(import.meta.resolve(specifier));
			return new URL(
				specifier,
				/** #__KEEP__ */
				import.meta.url
			);
		}
		promise = allSettled(deps.map((depString) => {
			depString = assetsURL(depString, importerUrl);
			const dep = importMetaResolve(depString);
			const isCss = isCssPreloadUrl(dep);
			return preloadOnce(seen, dep.href, () => {
				if (preloadedHrefs === void 0) {
					preloadedHrefs = {
						all: /* @__PURE__ */ new Set(),
						styles: /* @__PURE__ */ new Set()
					};
					const links = document.getElementsByTagName("link");
					for (let i = links.length - 1; i >= 0; i--) {
						const link = links[i];
						preloadedHrefs.all.add(link.href);
						if (link.rel === "stylesheet") preloadedHrefs.styles.add(link.href);
					}
				}
				if ((isCss ? preloadedHrefs.styles : preloadedHrefs.all).has(dep.href)) return;
				const link = document.createElement("link");
				link.rel = isCss ? "stylesheet" : scriptRel;
				if (!isCss) link.as = "script";
				link.crossOrigin = "";
				link.href = dep.href;
				if (cspNonce) link.setAttribute("nonce", cspNonce);
				document.head.appendChild(link);
				if (isCss) return new Promise((res, rej) => {
					link.addEventListener("load", res);
					link.addEventListener("error", () => rej(/* @__PURE__ */ new Error(`Unable to preload CSS for ${dep}`)));
				});
			});
		}).filter((p) => p !== void 0));
	}
	function handlePreloadError(err) {
		const e = new Event("vite:preloadError", { cancelable: true });
		e.payload = err;
		window.dispatchEvent(e);
		if (!e.defaultPrevented) throw err;
	}
	return promise.then((res) => {
		for (const item of res || []) {
			if (item.status !== "rejected") continue;
			handlePreloadError(item.reason);
		}
		return baseModule().catch(handlePreloadError);
	});
};
// src/App.tsx
var loadRoomsManager = () => __vitePreload(() => import("./RoomsManager-KCpvT0Uj.js"), __vite__mapDeps([0,1,2,3,4]));
var loadChatView = () => __vitePreload(() => import("./ChatView-B-U0O1iq.js"), __vite__mapDeps([5,1,2,3,4]));
var loadSavedPlacesManager = () => __vitePreload(() => import("./SavedPlacesManager-DMOb7ylA.js"), __vite__mapDeps([6,1,2,3,4]));
var loadRemindersManager = () => __vitePreload(() => import("./RemindersManager-CxM_3RVY.js"), __vite__mapDeps([7,1,2,3,4]));
var loadMeetingsManager = () => __vitePreload(() => import("./MeetingsManager-CeQU2G9D.js"), __vite__mapDeps([8,1,2,3,4]));
var loadProfilePrivacyView = () => __vitePreload(() => import("./ProfilePrivacyView-DQf1hx_z.js"), __vite__mapDeps([9,1,2,3,4]));
var loadAdminDashboard = () => __vitePreload(() => import("./AdminDashboard-y9at9evH.js"), __vite__mapDeps([10,1,2,3,4]));
var RoomsManager = import_react.lazy(() => loadRoomsManager().then((m) => ({ default: m.RoomsManager })));
var ChatView = import_react.lazy(() => loadChatView().then((m) => ({ default: m.ChatView })));
var SavedPlacesManager = import_react.lazy(() => loadSavedPlacesManager().then((m) => ({ default: m.SavedPlacesManager })));
var RemindersManager = import_react.lazy(() => loadRemindersManager().then((m) => ({ default: m.RemindersManager })));
var MeetingsManager = import_react.lazy(() => loadMeetingsManager().then((m) => ({ default: m.MeetingsManager })));
var ProfilePrivacyView = import_react.lazy(() => loadProfilePrivacyView().then((m) => ({ default: m.ProfilePrivacyView })));
var AdminDashboard = import_react.lazy(() => loadAdminDashboard().then((m) => ({ default: m.AdminDashboard })));
function TabFallback() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "w-full h-full flex items-center justify-center p-8",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-7 h-7 border-3 border-sky-400 border-t-transparent rounded-full animate-spin" })
	});
}
function MainApp() {
	const { user, isLoading } = useAuth();
	const { latestAlert, dismissLatestAlert, acknowledgeEmergency, myLocation, userLocations } = useRealtime();
	const { themeConfig, isLiteMode } = useTheme();
	const [currentTab, setCurrentTab] = (0, import_react.useState)(() => {
		try {
			const tabParam = new URLSearchParams(window.location.search).get("tab");
			if (tabParam && [
				"map",
				"saved",
				"rooms",
				"chat",
				"alerts",
				"reminders",
				"meetings",
				"profile"
			].includes(tabParam)) return tabParam;
		} catch {}
		return "map";
	});
	const [, startTransition] = import_react.useTransition();
	const [visitedTabs, setVisitedTabs] = (0, import_react.useState)(() => {
		try {
			const tabParam = new URLSearchParams(window.location.search).get("tab");
			if (tabParam) return /* @__PURE__ */ new Set(["map", tabParam]);
		} catch {}
		return /* @__PURE__ */ new Set(["map"]);
	});
	const [selectedRoomId, setSelectedRoomId] = (0, import_react.useState)(() => {
		try {
			const roomParam = new URLSearchParams(window.location.search).get("room");
			if (roomParam) return roomParam;
			const savedUserRaw = localStorage.getItem("beacon_user_profile");
			const uid = savedUserRaw ? JSON.parse(savedUserRaw)?.id : null;
			if (uid) return localStorage.getItem(`beacon_selected_room_${uid}`);
		} catch {}
		return null;
	});
	const [selectedChatUser, setSelectedChatUser] = (0, import_react.useState)(null);
	const [savedPlaces, setSavedPlaces] = (0, import_react.useState)([]);
	const [userRooms, setUserRooms] = (0, import_react.useState)([]);
	const [pendingCoords, setPendingCoords] = (0, import_react.useState)(null);
	const [pendingReminder, setPendingReminder] = (0, import_react.useState)(null);
	const [showOverlaySharePanel, setShowOverlaySharePanel] = (0, import_react.useState)(false);
	const [devicePopup, setDevicePopup] = (0, import_react.useState)(null);
	const handleSelectRoomId = import_react.useCallback((roomId) => {
		setSelectedRoomId(roomId);
		if (user?.id) try {
			if (roomId) localStorage.setItem(`beacon_selected_room_${user.id}`, roomId);
			else localStorage.removeItem(`beacon_selected_room_${user.id}`);
		} catch {}
	}, [user?.id]);
	const [sosTrackParams, setSosTrackParams] = (0, import_react.useState)(() => {
		if (typeof window === "undefined") return null;
		const sp = new URLSearchParams(window.location.search);
		const token = sp.get("sos_track");
		if (!token) return null;
		return {
			token,
			alertId: sp.get("alertId") || "",
			lat: Number(sp.get("lat")) || 0,
			lng: Number(sp.get("lng")) || 0,
			acc: Number(sp.get("acc")) || 15,
			sender: sp.get("sender") || "Beacon Member",
			msg: sp.get("msg") || "EMERGENCY: Immediate assistance requested!",
			exp: sp.get("exp") ? Number(sp.get("exp")) : void 0
		};
	});
	(0, import_react.useEffect)(() => {
		const onDevicePopup = (e) => {
			const custom = e;
			if (custom.detail) setDevicePopup(custom.detail);
		};
		window.addEventListener("beacon:device-popup-notification", onDevicePopup);
		return () => window.removeEventListener("beacon:device-popup-notification", onDevicePopup);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!devicePopup) return;
		const timer = setTimeout(() => {
			setDevicePopup(null);
		}, 9e3);
		return () => clearTimeout(timer);
	}, [devicePopup]);
	(0, import_react.useEffect)(() => {
		setShowOverlaySharePanel(false);
	}, [latestAlert?.id]);
	const prefetchedDataRef = (0, import_react.useRef)(/* @__PURE__ */ new Set(["map"]));
	const prefetchTab = import_react.useCallback((tabId) => {
		if (!isLiteMode) setVisitedTabs((prev) => {
			if (prev.has(tabId)) return prev;
			const next = new Set(prev);
			next.add(tabId);
			return next;
		});
		if (!prefetchedDataRef.current.has(tabId)) {
			prefetchedDataRef.current.add(tabId);
			switch (tabId) {
				case "rooms":
					loadRoomsManager();
					api.get("/api/rooms").then((res) => {
						setUserRooms(res.rooms);
					}).catch(() => {});
					break;
				case "chat":
					loadChatView();
					break;
				case "saved":
					loadSavedPlacesManager();
					api.get("/api/saved-places").then((res) => {
						setSavedPlaces(res.places);
					}).catch(() => {});
					break;
				case "alerts":
					api.get("/api/alerts/emergency").catch(() => {});
					break;
				case "meetings":
					loadMeetingsManager();
					api.get("/api/meetings").catch(() => {});
					break;
				case "reminders":
					loadRemindersManager();
					api.get("/api/reminders").catch(() => {});
					break;
				case "profile":
					loadProfilePrivacyView();
					break;
				case "admin": loadAdminDashboard();
			}
		}
	}, [isLiteMode]);
	const handleSelectTab = import_react.useCallback((tab) => {
		if (isLiteMode) {
			setCurrentTab(tab);
			return;
		}
		setVisitedTabs((prev) => {
			if (prev.has(tab)) return prev;
			const next = new Set(prev);
			next.add(tab);
			return next;
		});
		startTransition(() => {
			setCurrentTab(tab);
		});
	}, [isLiteMode]);
	const applyRoomsIfChanged = import_react.useCallback((rooms) => {
		if (!Array.isArray(rooms)) return;
		setUserRooms((prev) => {
			return prev.map((r) => `${r.id}:${r.name}:${r.memberCount}`).join("|") === rooms.map((r) => `${r.id}:${r.name}:${r.memberCount}`).join("|") ? prev : rooms;
		});
		if (rooms.length > 0) setSelectedRoomId((prevSelected) => {
			const savedId = user?.id ? localStorage.getItem(`beacon_selected_room_${user.id}`) : null;
			const candidate = prevSelected || savedId;
			if (candidate && rooms.some((r) => r.id === candidate)) return candidate;
			const nonUniversal = rooms.find((r) => r.id !== "room-universal");
			const chosen = nonUniversal ? nonUniversal.id : rooms[0].id;
			if (user?.id && chosen) try {
				localStorage.setItem(`beacon_selected_room_${user.id}`, chosen);
			} catch {}
			return chosen;
		});
	}, [user?.id]);
	const refreshSavedPlaces = import_react.useCallback(() => {
		if (!user || !api.getToken()) return;
		api.get("/api/saved-places").then((res) => {
			if (!Array.isArray(res?.places)) return;
			setSavedPlaces((prev) => {
				return prev.map((p) => `${p.id}:${p.name}:${p.latitude}:${p.longitude}`).join("|") === res.places.map((p) => `${p.id}:${p.name}:${p.latitude}:${p.longitude}`).join("|") ? prev : res.places;
			});
			prefetchedDataRef.current.add("saved");
		}).catch(() => {});
	}, [user]);
	(0, import_react.useEffect)(() => {
		if (!user || !api.getToken()) return;
		const refreshRoomsAndPlaces = () => {
			refreshSavedPlaces();
			api.get("/api/rooms").then((res) => {
				if (res?.rooms) {
					applyRoomsIfChanged(res.rooms);
					prefetchedDataRef.current.add("rooms");
				}
			}).catch(() => {});
		};
		refreshRoomsAndPlaces();
		window.addEventListener("beacon:cloud-sync-updated", refreshRoomsAndPlaces);
		return () => {
			window.removeEventListener("beacon:cloud-sync-updated", refreshRoomsAndPlaces);
		};
	}, [
		user?.id,
		refreshSavedPlaces,
		applyRoomsIfChanged
	]);
	(0, import_react.useEffect)(() => {
		if (!user || isLiteMode) return;
		const timer = setTimeout(() => {
			(window.requestIdleCallback || ((cb) => setTimeout(cb, 200)))(() => {
				[
					"rooms",
					"chat",
					"saved",
					"alerts",
					"reminders"
				].forEach((tab) => prefetchTab(tab));
			});
		}, 1500);
		return () => clearTimeout(timer);
	}, [
		user,
		isLiteMode,
		prefetchTab
	]);
	if (sosTrackParams) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmergencyResponderTrackingView, {
		token: sosTrackParams.token,
		initialAlertId: sosTrackParams.alertId,
		initialLat: sosTrackParams.lat,
		initialLng: sosTrackParams.lng,
		initialAcc: sosTrackParams.acc,
		initialSender: sosTrackParams.sender,
		initialMsg: sosTrackParams.msg,
		expiresAtMs: sosTrackParams.exp,
		onExitTracking: () => {
			try {
				const url = new URL(window.location.href);
				url.searchParams.delete("sos_track");
				window.history.replaceState({}, "", url.pathname);
			} catch {}
			setSosTrackParams(null);
		}
	});
	if (isLoading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-screen bg-slate-950 flex items-center justify-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" })
	});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthScreen, {});
	const shouldRenderTab = (tabName) => isLiteMode ? currentTab === tabName : visitedTabs.has(tabName);
	const nearbyMembersWithin5km = latestAlert && Number.isFinite(latestAlert.latitude) && Number.isFinite(latestAlert.longitude) && !(latestAlert.latitude === 0 && latestAlert.longitude === 0) ? userLocations.map((loc) => {
		const dist = calculateDistanceMeters(latestAlert.latitude, latestAlert.longitude, loc.latitude, loc.longitude);
		return {
			...loc,
			distanceFromAlert: dist
		};
	}).filter((loc) => loc.distanceFromAlert <= 5e3).sort((a, b) => a.distanceFromAlert - b.distanceFromAlert) : [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `flex flex-col h-screen w-screen overflow-hidden font-sans relative ${themeConfig.appBg}`,
		children: [
			!isLiteMode && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `fixed -top-40 -left-40 w-96 h-96 rounded-full bg-gradient-to-br ${themeConfig.ambientGlow} blur-3xl pointer-events-none z-0` }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `fixed -bottom-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-tl ${themeConfig.ambientGlow} blur-3xl pointer-events-none z-0` })] }),
			devicePopup && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed top-3 left-1/2 -translate-x-1/2 z-[9999] w-[94vw] max-w-md animate-pop-in pointer-events-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-slate-950/95 backdrop-blur-xl text-white rounded-2xl border-2 border-rose-500 shadow-2xl p-3.5 flex items-start justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start gap-3 min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md",
							children: devicePopup.tag.startsWith("emergency") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Siren, { className: "w-5 h-5 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "w-5 h-5" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "px-1.5 py-0.5 rounded bg-rose-500/25 text-rose-300 text-[9px] font-black uppercase tracking-wider",
										children: "5 KM PROXIMITY ALERT"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] text-slate-400 font-mono",
										children: "Now"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs font-black text-white mt-0.5 truncate",
									children: devicePopup.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] text-slate-300 line-clamp-2 mt-0.5",
									children: devicePopup.body
								}),
								devicePopup.data?.latitude != null && devicePopup.data?.longitude != null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => {
										setPendingCoords({
											lat: Number(devicePopup.data.latitude),
											lng: Number(devicePopup.data.longitude)
										});
										setDevicePopup(null);
										handleSelectTab("map");
									},
									className: "mt-2 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-3 h-3" }), "Locate on Map"]
								})
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setDevicePopup(null),
						className: "p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-4 h-4" })
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navbar, {
				currentTab,
				onSelectTab: handleSelectTab,
				onOpenSos: () => {
					handleSelectTab("alerts");
					setTimeout(() => window.dispatchEvent(new CustomEvent("beacon:open-sos-modal")), 60);
				},
				onPrefetchTab: prefetchTab,
				activeRoomId: selectedRoomId
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OfflineBanner, {}),
			latestAlert && latestAlert.status === "active" && currentTab !== "alerts" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-white rounded-3xl border-2 border-rose-500 shadow-2xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-600/30",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Siren, { className: "w-6 h-6 animate-spin" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 flex-wrap",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider",
											children: "EMERGENCY SOS ALERT"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold",
											children: "Within 5 km Radius"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-base font-black text-slate-900 mt-0.5",
										children: latestAlert.senderName
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-xs font-semibold text-rose-700",
										children: [
											"\"",
											latestAlert.message,
											"\""
										]
									})
								] })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: dismissLatestAlert,
								className: "p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer",
								title: "Silence & close",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { className: "w-4 h-4" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmergencyLocationMap, {
							latitude: latestAlert.latitude,
							longitude: latestAlert.longitude,
							accuracy: latestAlert.accuracy,
							senderName: latestAlert.senderName,
							message: latestAlert.message,
							timestamp: latestAlert.timestamp,
							viewerLocation: myLocation,
							onOpenFullMap: (lat, lng) => {
								setPendingCoords({
									lat,
									lng
								});
								dismissLatestAlert();
								handleSelectTab("map");
							},
							heightClass: "h-56"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-slate-400 block",
								children: "Exact Coordinates"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-mono font-bold text-slate-900",
								children: [
									latestAlert.latitude.toFixed(6),
									", ",
									latestAlert.longitude.toFixed(6)
								]
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-slate-400 block",
								children: "GPS Accuracy"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-bold text-slate-800",
								children: formatAccuracy(latestAlert.accuracy)
							})] })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-2xl bg-slate-50 border border-slate-200 p-3 space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between text-xs",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-bold text-slate-800 flex items-center gap-1.5",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "w-3.5 h-3.5 text-rose-600" }),
										"Members Nearby Within 5 km (",
										nearbyMembersWithin5km.length,
										")"
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200",
									children: "Notified on Device"
								})]
							}), nearbyMembersWithin5km.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] text-slate-500",
								children: "Scanning for active members within 5 km of these coordinates..."
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-1.5",
								children: nearbyMembersWithin5km.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-[11px] flex items-center gap-1.5 shadow-2xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "w-2 h-2 rounded-full bg-emerald-500" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-bold text-slate-800",
											children: m.userId === user.id ? "You" : m.fullName
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-mono text-rose-600 font-semibold",
											children: m.distanceFromAlert < 15 ? "At SOS" : formatDistance(m.distanceFromAlert)
										})
									]
								}, m.userId))
							})]
						}),
						showOverlaySharePanel && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmergencySharePanel, {
							alert: latestAlert,
							onClose: () => setShowOverlaySharePanel(false)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center justify-end gap-2 pt-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => {
										acknowledgeEmergency(latestAlert.id);
										dismissLatestAlert();
									},
									className: "px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheckBig, { className: "w-4 h-4 text-emerald-400" }), "Acknowledge"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setShowOverlaySharePanel((prev) => !prev),
									className: "px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-transform",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Share2, { className: "w-4 h-4" }), "Share Live Location"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									href: getNativeNavigationUrl(latestAlert.latitude, latestAlert.longitude, myLocation?.latitude, myLocation?.longitude),
									target: "_blank",
									rel: "noopener noreferrer",
									className: "px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-transform",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "w-4 h-4 fill-current" }), "Get Directions"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => {
										setPendingCoords({
											lat: latestAlert.latitude,
											lng: latestAlert.longitude
										});
										dismissLatestAlert();
										handleSelectTab("map");
									},
									className: "px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-transform",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "w-4 h-4" }), "View on Live Map"]
								})
							]
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "flex-1 overflow-hidden relative tab-pane-container",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `tab-pane-container absolute inset-0 ${currentTab === "map" ? "opacity-100 z-10 pointer-events-auto visible" : "opacity-0 z-0 pointer-events-none invisible"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveMap, {
							isActive: currentTab === "map",
							focusCoords: pendingCoords,
							savedPlaces,
							onRefreshSavedPlaces: refreshSavedPlaces,
							rooms: userRooms,
							selectedRoomId,
							onSelectUserForChat: (targetUserId) => {
								setSelectedChatUser({
									id: targetUserId,
									name: "Peer",
									avatar: ""
								});
								handleSelectTab("chat");
							},
							onAddPlaceAtCoords: (lat, lng) => {
								setPendingCoords({
									lat,
									lng
								});
								handleSelectTab("saved");
							},
							onSetReminderAtCoords: (lat, lng, title) => {
								setPendingReminder({
									lat,
									lng,
									title
								});
								handleSelectTab("reminders");
							}
						})
					}),
					shouldRenderTab("rooms") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe ${currentTab === "rooms" ? "opacity-100 z-10 pointer-events-auto visible animate-tab-enter" : "opacity-0 z-0 pointer-events-none invisible"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
							fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabFallback, {}),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RoomsManager, {
								isActive: currentTab === "rooms",
								selectedRoomId,
								savedPlaces,
								onRefreshSavedPlaces: refreshSavedPlaces,
								onSelectRoom: (roomId) => {
									handleSelectRoomId(roomId);
									api.get("/api/rooms").then((res) => {
										if (res?.rooms) applyRoomsIfChanged(res.rooms);
									});
								},
								onSelectUserForChat: (targetUserId) => {
									setSelectedChatUser({
										id: targetUserId,
										name: "Peer",
										avatar: ""
									});
									handleSelectTab("chat");
								},
								onOpenChat: (roomId) => {
									if (roomId) handleSelectRoomId(roomId);
									setSelectedChatUser(null);
									handleSelectTab("chat");
								},
								onFocusMapLocation: (lat, lng) => {
									setPendingCoords({
										lat,
										lng
									});
									handleSelectTab("map");
								},
								onSetReminderAtCoords: (lat, lng, title) => {
									setPendingReminder({
										lat,
										lng,
										title
									});
									handleSelectTab("reminders");
								}
							})
						})
					}),
					shouldRenderTab("chat") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe ${currentTab === "chat" ? "opacity-100 z-10 pointer-events-auto visible animate-tab-enter" : "opacity-0 z-0 pointer-events-none invisible"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
							fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabFallback, {}),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatView, {
								userRooms,
								selectedRoomId,
								selectedChatUser,
								onSelectRoom: (id) => {
									handleSelectRoomId(id);
									setSelectedChatUser(null);
								},
								onSelectChatUser: (u) => setSelectedChatUser(u),
								onFocusMapLocation: (lat, lng) => {
									setPendingCoords({
										lat,
										lng
									});
									handleSelectTab("map");
								},
								onAddPlaceAtCoords: (lat, lng) => {
									setPendingCoords({
										lat,
										lng
									});
									handleSelectTab("saved");
								},
								onSetReminderAtCoords: (lat, lng, title) => {
									setPendingReminder({
										lat,
										lng,
										title
									});
									handleSelectTab("reminders");
								},
								onNavigateTab: (tab) => handleSelectTab(tab)
							})
						})
					}),
					shouldRenderTab("alerts") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe ${currentTab === "alerts" ? "opacity-100 z-10 pointer-events-auto visible animate-tab-enter" : "opacity-0 z-0 pointer-events-none invisible"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
							fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabFallback, {}),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmergencyManager, {
								onViewLocationOnMap: (lat, lng) => {
									setPendingCoords({
										lat,
										lng
									});
									handleSelectTab("map");
								},
								onSelectUserForChat: (userId) => {
									setSelectedChatUser({
										id: userId,
										name: "User",
										avatar: ""
									});
									handleSelectTab("chat");
								}
							})
						})
					}),
					shouldRenderTab("saved") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe ${currentTab === "saved" ? "opacity-100 z-10 pointer-events-auto visible animate-tab-enter" : "opacity-0 z-0 pointer-events-none invisible"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
							fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabFallback, {}),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SavedPlacesManager, {
								savedPlaces,
								onRefreshSavedPlaces: refreshSavedPlaces,
								onFocusMapLocation: (lat, lng) => {
									setPendingCoords({
										lat,
										lng
									});
									handleSelectTab("map");
								},
								pendingCoords,
								onClearPendingCoords: () => setPendingCoords(null)
							})
						})
					}),
					shouldRenderTab("reminders") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe ${currentTab === "reminders" ? "opacity-100 z-10 pointer-events-auto visible animate-tab-enter" : "opacity-0 z-0 pointer-events-none invisible"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
							fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabFallback, {}),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RemindersManager, {
								savedPlaces,
								pendingReminder,
								onClearPendingReminder: () => setPendingReminder(null)
							})
						})
					}),
					shouldRenderTab("meetings") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe ${currentTab === "meetings" ? "opacity-100 z-10 pointer-events-auto visible animate-tab-enter" : "opacity-0 z-0 pointer-events-none invisible"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
							fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabFallback, {}),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MeetingsManager, { rooms: userRooms })
						})
					}),
					shouldRenderTab("profile") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe ${currentTab === "profile" ? "opacity-100 z-10 pointer-events-auto visible animate-tab-enter" : "opacity-0 z-0 pointer-events-none invisible"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
							fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabFallback, {}),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfilePrivacyView, {})
						})
					}),
					shouldRenderTab("admin") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `tab-pane-container absolute top-0 left-0 right-0 tab-pane-mobile-safe ${currentTab === "admin" ? "opacity-100 z-10 pointer-events-auto visible animate-tab-enter" : "opacity-0 z-0 pointer-events-none invisible"}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
							fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabFallback, {}),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminDashboard, {})
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BottomNav, {
				currentTab,
				onSelectTab: handleSelectTab,
				onPrefetchTab: prefetchTab
			})
		]
	});
}
function App() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToastProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RealtimeProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MainApp, {}) }) }) }) });
}
// src/main.tsx
if (typeof window !== "undefined" && "serviceWorker" in navigator) navigator.serviceWorker.getRegistrations().then((registrations) => {
	for (const registration of registrations) registration.unregister().catch(() => {});
}).catch(() => {});
(0, import_client.createRoot)(document.getElementById("root")).render(/* @__PURE__ */ (0, import_jsx_runtime.jsx)(App, {}));
export { getLocationTypeEmoji as a, PWAInstallButton as c, useRealtime as d, notifications as f, triggerHaptic as h, MEMBER_ICONS as i, GLASS_THEMES as l, sound as m, LOCATION_TYPES as n, getMemberIconEmoji as o, VoiceRecorder as p, MARKER_COLORS as r, BackendDiagnosticPanel as s, LiveMap as t, useTheme as u };
