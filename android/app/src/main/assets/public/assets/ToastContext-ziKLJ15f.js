import { n as __toESM } from "./rolldown-runtime-CO0Nlsmt.js";
import { t as require_jsx_runtime } from "./vendor-react-7Z3kCInY.js";
import { It as CircleCheck, Rt as CircleAlert, en as require_react, ft as Info, n as X } from "./vendor-icons-PxteBMrr.js";
// src/utils/geo.ts
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
/**
* Geolocation & GIS computation utilities
*/
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
	const R = 6371e3;
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLon = (lon2 - lon1) * Math.PI / 180;
	const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return Math.round(R * c);
}
function formatDistance(meters) {
	if (meters < 1e3) return `${Math.round(meters)} m`;
	return `${(meters / 1e3).toFixed(1)} km`;
}
function isWithinRadius(currentLat, currentLng, targetLat, targetLng, radiusMeters) {
	return calculateDistanceMeters(currentLat, currentLng, targetLat, targetLng) <= radiusMeters;
}
function formatAccuracy(accuracyMeters) {
	return `±${Math.round(accuracyMeters)} m`;
}
function getGpsSignalInfo(accuracyMeters) {
	const acc = typeof accuracyMeters === "number" && !isNaN(accuracyMeters) ? accuracyMeters : 0;
	if (acc > 60) return {
		isLowSignal: true,
		level: "very_low",
		label: "Poor GPS Signal",
		circleColor: "#f43f5e",
		badgeBgClass: "bg-rose-500/20 border-rose-500/40",
		badgeTextClass: "text-rose-400"
	};
	if (acc > 25) return {
		isLowSignal: true,
		level: "low",
		label: "Low GPS Signal",
		circleColor: "#f59e0b",
		badgeBgClass: "bg-amber-500/20 border-amber-500/40",
		badgeTextClass: "text-amber-400"
	};
	return {
		isLowSignal: false,
		level: "high",
		label: "Strong GPS",
		circleColor: "#4285F4",
		badgeBgClass: "bg-emerald-500/20 border-emerald-500/40",
		badgeTextClass: "text-emerald-400"
	};
}
function formatTimeAgo(isoString) {
	const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1e3);
	if (diffSec < 5) return "just now";
	if (diffSec < 60) return `${diffSec} seconds ago`;
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin} min ago`;
	const diffHours = Math.floor(diffMin / 60);
	if (diffHours < 24) return `${diffHours} hr ago`;
	return new Date(isoString).toLocaleDateString();
}
// src/utils/nearbyPlaces.ts
var OVERPASS_ENDPOINTS = [
	"https://overpass-api.de/api/interpreter",
	"https://overpass.kumi.systems/api/interpreter",
	"https://maps.mail.ru/osm/tools/overpass/api/interpreter"
];
var ARCGIS_GEOCODE_URL = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
var ARCGIS_CATEGORY_MAP = {
	all: "Food,Coffee Shop,Gas Station,Hospital,Medical Clinic,Pharmacy,Grocery,Park,Hotel,ATM,Bank,Shop,School",
	fuel: "Gas Station,Charging Station,Automotive",
	food: "Food,Restaurant,Fast Food,Indian Food,Bakery",
	cafe: "Coffee Shop,Tea House,Bakery,Dessert,Ice Cream Shop",
	groceries: "Grocery,Supermarket,Convenience Store,Department Store,Market",
	hospital: "Hospital,Medical Clinic,Pharmacy,Doctor,Dentist,Health Care Facility",
	park: "Park,Garden,Nature Reserve,Sports Center,Playground",
	hotel: "Hotel,Motel,Resort,Hostel,Guest House,Bed and Breakfast",
	atm: "ATM,Bank,Financial Service"
};
var CATEGORY_KEYWORDS = {
	all: [
		"restaurant",
		"hospital",
		"supermarket"
	],
	fuel: [
		"petrol",
		"fuel",
		"gas station"
	],
	food: [
		"restaurant",
		"hotel",
		"dhaba"
	],
	cafe: [
		"cafe",
		"coffee",
		"bakery"
	],
	groceries: [
		"supermarket",
		"grocery",
		"store"
	],
	hospital: [
		"hospital",
		"clinic",
		"pharmacy"
	],
	park: [
		"park",
		"garden",
		"playground"
	],
	hotel: [
		"hotel",
		"lodge",
		"resort"
	],
	atm: ["atm", "bank"]
};
var memoryCache = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 3e5;
function getCacheKey(lat, lon, category, radius) {
	return `beacon_nearby_v2_${lat.toFixed(3)}_${lon.toFixed(3)}_${category.toLowerCase()}_${radius}`;
}
function readCachedPlaces(key) {
	const now = Date.now();
	const mem = memoryCache.get(key);
	if (mem && now - mem.timestamp < CACHE_TTL_MS && mem.results.length > 0) return mem.results;
	if (typeof window !== "undefined" && window.localStorage) try {
		const raw = localStorage.getItem(key);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (parsed && typeof parsed.timestamp === "number" && now - parsed.timestamp < CACHE_TTL_MS && Array.isArray(parsed.results) && parsed.results.length > 0) {
				memoryCache.set(key, parsed);
				return parsed.results;
			}
		}
	} catch {}
	return null;
}
function writeCachedPlaces(key, results) {
	if (!results || results.length === 0) return;
	const entry = {
		timestamp: Date.now(),
		results
	};
	memoryCache.set(key, entry);
	if (typeof window !== "undefined" && window.localStorage) try {
		localStorage.setItem(key, JSON.stringify(entry));
	} catch {}
}
function buildOverpassCategoryFilters(category, lat, lon, radiusMeters) {
	const around = `(around:${radiusMeters},${lat},${lon})`;
	switch ((category || "all").toLowerCase()) {
		case "fuel": return `nwr${around}["amenity"~"^(fuel|charging_station)$"];`;
		case "food": return `nwr${around}["amenity"~"^(restaurant|fast_food|food_court|biergarten|pub|bar)$"];`;
		case "cafe": return `nwr${around}["amenity"~"^(cafe|ice_cream)$"];nwr${around}["shop"~"^(bakery|coffee|pastry|tea)$"];`;
		case "groceries": return `nwr${around}["shop"~"^(supermarket|convenience|grocery|greengrocer|mall|department_store|general|bakery|butcher|marketplace)$"];nwr${around}["amenity"="marketplace"];`;
		case "hospital": return `nwr${around}["amenity"~"^(hospital|clinic|doctors|pharmacy|dentist)$"];nwr${around}["healthcare"];`;
		case "park": return `nwr${around}["leisure"~"^(park|garden|nature_reserve|playground|pitch|fitness_centre|sports_centre)$"];nwr${around}["tourism"~"^(viewpoint|attraction)$"];`;
		case "hotel": return `nwr${around}["tourism"~"^(hotel|motel|guest_house|hostel|apartment|chalet|resort)$"];`;
		case "atm": return `nwr${around}["amenity"~"^(atm|bank|bureau_de_change)$"];`;
		default: return `nwr${around}["amenity"~"^(restaurant|fast_food|cafe|fuel|charging_station|hospital|clinic|pharmacy|bank|atm|marketplace|police|post_office|library|place_of_worship|school|college)$"];nwr${around}["shop"~"^(supermarket|convenience|grocery|bakery|mall|department_store|chemist|electronics|clothes|general)$"];nwr${around}["tourism"~"^(hotel|motel|guest_house|hostel|attraction|viewpoint|museum)$"];nwr${around}["leisure"~"^(park|garden|nature_reserve|fitness_centre|sports_centre)$"];`;
	}
}
function parseOverpassElement(el, idx, fallbackCategory) {
	const tags = el.tags || {};
	const elLat = el.lat ?? el.center?.lat;
	const elLon = el.lon ?? el.center?.lon;
	if (typeof elLat !== "number" || typeof elLon !== "number") return null;
	const rawCategory = tags.amenity || tags.shop || tags.tourism || tags.leisure || tags.healthcare || tags.office || fallbackCategory;
	const formattedCategoryLabel = String(rawCategory || "place").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	const name = tags.name || tags["name:en"] || tags.brand || tags.operator || tags.official_name || (tags["addr:housename"] ? tags["addr:housename"] : null);
	if (!name) return null;
	const streetPart = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
	const cityPart = tags["addr:city"] || tags["addr:town"] || tags["addr:suburb"] || tags["addr:village"] || tags["addr:district"] || "";
	const statePart = tags["addr:state"] || "";
	const addressParts = [
		name,
		streetPart,
		tags["addr:place"],
		cityPart,
		statePart,
		tags["addr:postcode"]
	].filter(Boolean);
	const displayName = addressParts.length > 1 ? addressParts.join(", ") : `${name} (${formattedCategoryLabel})`;
	return {
		id: `osm-${el.type || "n"}-${el.id || idx}`,
		name: String(name).trim(),
		display_name: displayName,
		lat: elLat,
		lon: elLon,
		category: String(rawCategory || fallbackCategory).replace(/_/g, " "),
		type: String(rawCategory || "poi"),
		city: cityPart || void 0,
		state: statePart || void 0,
		country: tags["addr:country"] || void 0
	};
}
async function fetchWithTimeout(url, options, timeoutMs) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, {
			...options,
			signal: controller.signal
		});
	} finally {
		clearTimeout(timer);
	}
}
/**
* 1. ArcGIS World Geocoding Service (Single fast CDN request, works globally & in India on 2G/3G/4G/5G)
*/
async function queryArcGISNearby(lat, lon, category, maxRadiusMeters) {
	try {
		const catKey = (category || "all").toLowerCase();
		const arcCategory = ARCGIS_CATEGORY_MAP[catKey] || ARCGIS_CATEGORY_MAP.all;
		const searchDistance = Math.min(Math.max(maxRadiusMeters, 1e3), 5e4);
		const url = new URL(ARCGIS_GEOCODE_URL);
		url.searchParams.set("f", "json");
		url.searchParams.set("category", arcCategory);
		url.searchParams.set("location", `${lon},${lat}`);
		url.searchParams.set("distance", String(searchDistance));
		url.searchParams.set("maxLocations", "35");
		url.searchParams.set("outFields", "PlaceName,Place_addr,Type,City,Region,Country");
		const res = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } }, 8e3);
		if (!res.ok) return [];
		const data = await res.json();
		if (!Array.isArray(data?.candidates)) return [];
		const results = [];
		for (let i = 0; i < data.candidates.length; i++) {
			const c = data.candidates[i];
			const cLat = Number(c?.location?.y);
			const cLon = Number(c?.location?.x);
			if (!Number.isFinite(cLat) || !Number.isFinite(cLon)) continue;
			const dist = calculateDistanceMeters(lat, lon, cLat, cLon);
			if (dist > maxRadiusMeters) continue;
			const attrs = c.attributes || {};
			const name = String(attrs.PlaceName || c.address || "").trim();
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
				city: attrs.City || void 0,
				state: attrs.Region || void 0,
				country: attrs.Country || void 0,
				distanceMeters: dist
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
async function querySingleOverpassEndpoint(endpoint, query, category) {
	const res = await fetchWithTimeout(endpoint, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
		body: `data=${encodeURIComponent(query)}`
	}, 9e3);
	if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
	const data = await res.json();
	if (!Array.isArray(data?.elements) || data.elements.length === 0) throw new Error("Empty Overpass response");
	const parsed = [];
	data.elements.forEach((el, idx) => {
		const item = parseOverpassElement(el, idx, category);
		if (item) parsed.push(item);
	});
	if (parsed.length === 0) throw new Error("No named Overpass elements");
	return parsed;
}
async function queryOverpassMirrors(lat, lon, category, radiusMeters) {
	const query = `[out:json][timeout:10];(${buildOverpassCategoryFilters(category, lat, lon, radiusMeters)});out center 80;`;
	try {
		return await Promise.any(OVERPASS_ENDPOINTS.map((endpoint) => querySingleOverpassEndpoint(endpoint, query, category)));
	} catch {
		return [];
	}
}
/**
* 3. Photon Keyword Discovery (Capped at 2 requests to prevent HTTP 429 rate-limiting)
*/
async function queryPhotonNearby(lat, lon, category, maxRadiusMeters) {
	const keywords = (CATEGORY_KEYWORDS[(category || "all").toLowerCase()] || CATEGORY_KEYWORDS.all).slice(0, 2);
	const deltaDeg = Math.min(Math.max(maxRadiusMeters / 111e3, .02), .35);
	const bboxStr = `${(lon - deltaDeg).toFixed(4)},${(lat - deltaDeg).toFixed(4)},${(lon + deltaDeg).toFixed(4)},${(lat + deltaDeg).toFixed(4)}`;
	const requests = keywords.map(async (kw) => {
		try {
			const photonUrl = new URL("https://photon.komoot.io/api/");
			photonUrl.searchParams.set("q", kw);
			photonUrl.searchParams.set("lat", String(lat));
			photonUrl.searchParams.set("lon", String(lon));
			photonUrl.searchParams.set("bbox", bboxStr);
			photonUrl.searchParams.set("limit", "20");
			const res = await fetchWithTimeout(photonUrl.toString(), { headers: { Accept: "application/json" } }, 7500);
			if (!res.ok) return [];
			const data = await res.json();
			if (!Array.isArray(data?.features)) return [];
			return data.features.map((feat, idx) => {
				const props = feat.properties || {};
				const coords = feat.geometry?.coordinates;
				if (!Array.isArray(coords) || coords.length < 2) return null;
				const pLon = Number(coords[0]);
				const pLat = Number(coords[1]);
				if (isNaN(pLat) || isNaN(pLon)) return null;
				const dist = calculateDistanceMeters(lat, lon, pLat, pLon);
				if (dist > maxRadiusMeters) return null;
				const name = props.name || [props.housenumber, props.street].filter(Boolean).join(" ") || null;
				if (!name) return null;
				const fullAddress = [
					name,
					props.street,
					props.district || props.suburb || props.locality,
					props.city || props.town || props.village || props.county,
					props.state,
					props.country
				].filter(Boolean).join(", ");
				return {
					id: `photon-${kw}-${props.osm_id || idx}-${pLat.toFixed(5)}-${pLon.toFixed(5)}`,
					name: String(name).trim(),
					display_name: fullAddress || String(name),
					lat: pLat,
					lon: pLon,
					category: String(props.osm_value || props.osm_key || kw).replace(/_/g, " "),
					type: String(props.osm_value || "poi"),
					city: props.city || props.town || props.village,
					state: props.state,
					country: props.country,
					distanceMeters: dist
				};
			}).filter(Boolean);
		} catch {
			return [];
		}
	});
	return (await Promise.all(requests)).flat();
}
/**
* 4. Nominatim Bounded Viewbox Search
*/
async function queryNominatimNearby(lat, lon, category, maxRadiusMeters) {
	const cat = (category || "all").toLowerCase();
	const primaryQuery = (CATEGORY_KEYWORDS[cat] || ["hospital"])[0];
	const deltaDeg = Math.min(Math.max(maxRadiusMeters / 111e3, .02), .3);
	const viewbox = `${(lon - deltaDeg).toFixed(4)},${(lat + deltaDeg).toFixed(4)},${(lon + deltaDeg).toFixed(4)},${(lat - deltaDeg).toFixed(4)}`;
	try {
		const url = new URL("https://nominatim.openstreetmap.org/search");
		url.searchParams.set("format", "jsonv2");
		url.searchParams.set("q", primaryQuery);
		url.searchParams.set("viewbox", viewbox);
		url.searchParams.set("bounded", "1");
		url.searchParams.set("addressdetails", "1");
		url.searchParams.set("limit", "25");
		const res = await fetchWithTimeout(url.toString(), { headers: {
			Accept: "application/json",
			"Accept-Language": "en"
		} }, 7500);
		if (!res.ok) return [];
		const data = await res.json();
		if (!Array.isArray(data)) return [];
		const items = [];
		for (let i = 0; i < data.length; i++) {
			const row = data[i];
			const pLat = Number(row.lat);
			const pLon = Number(row.lon);
			if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) continue;
			const dist = calculateDistanceMeters(lat, lon, pLat, pLon);
			if (dist > maxRadiusMeters) continue;
			const rawName = row.name || (typeof row.display_name === "string" ? row.display_name.split(",")[0] : "") || primaryQuery;
			const addr = row.address || {};
			items.push({
				id: `nom-${row.place_id || i}-${pLat.toFixed(5)}-${pLon.toFixed(5)}`,
				name: String(rawName).trim(),
				display_name: String(row.display_name || rawName),
				lat: pLat,
				lon: pLon,
				category: String(row.type || row.category || cat).replace(/_/g, " "),
				type: String(row.type || "poi"),
				city: addr.city || addr.town || addr.village || addr.suburb,
				state: addr.state,
				country: addr.country,
				distanceMeters: dist
			});
		}
		return items;
	} catch {
		return [];
	}
}
function deduplicateAndSortPlaces(places, userLat, userLon, maxRadiusMeters) {
	const seen = /* @__PURE__ */ new Map();
	for (const place of places) {
		if (!place || typeof place.lat !== "number" || typeof place.lon !== "number") continue;
		const dist = typeof place.distanceMeters === "number" ? place.distanceMeters : calculateDistanceMeters(userLat, userLon, place.lat, place.lon);
		if (dist > maxRadiusMeters) continue;
		const normName = place.name.toLowerCase().replace(/[^a-z0-9]/g, "");
		const coordGrid = `${place.lat.toFixed(3)}_${place.lon.toFixed(3)}`;
		const dedupKey = normName ? `${normName}_${coordGrid}` : coordGrid;
		const existing = seen.get(dedupKey);
		if (!existing || place.display_name.length > existing.display_name.length) seen.set(dedupKey, {
			...place,
			distanceMeters: dist
		});
	}
	return Array.from(seen.values()).sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0)).slice(0, 60);
}
/**
* Multi-source real nearby place discovery (ArcGIS + Overpass + Photon + Nominatim)
*/
async function fetchRealNearbyPlaces(lat, lon, category = "all", radiusMeters = 5e3, forceRefresh = false) {
	if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0 && lon === 0) return [];
	const cacheKey = getCacheKey(lat, lon, category, radiusMeters);
	if (!forceRefresh) {
		const cached = readCachedPlaces(cacheKey);
		if (cached && cached.length > 0) return cached;
	}
	const [arcgisResults, overpassResults, photonResults, nominatimResults] = await Promise.all([
		queryArcGISNearby(lat, lon, category, radiusMeters),
		queryOverpassMirrors(lat, lon, category, radiusMeters),
		queryPhotonNearby(lat, lon, category, radiusMeters),
		queryNominatimNearby(lat, lon, category, radiusMeters)
	]);
	let merged = deduplicateAndSortPlaces([
		...arcgisResults,
		...overpassResults,
		...photonResults,
		...nominatimResults
	], lat, lon, radiusMeters);
	if (merged.length === 0 && radiusMeters < 15e3) {
		const expandedRadius = Math.max(radiusMeters * 3, 15e3);
		const [expArcgis, expOverpass, expPhoton] = await Promise.all([
			queryArcGISNearby(lat, lon, category, expandedRadius),
			queryOverpassMirrors(lat, lon, category, expandedRadius),
			queryPhotonNearby(lat, lon, category, expandedRadius)
		]);
		merged = deduplicateAndSortPlaces([
			...expArcgis,
			...expOverpass,
			...expPhoton
		], lat, lon, expandedRadius);
	}
	if (merged.length > 0) writeCachedPlaces(cacheKey, merged);
	return merged;
}
/**
* Multi-source Real Keyword / City / Landmark / Business Search
* Queries ArcGIS World Geocoder + Photon + Open-Meteo + Nominatim concurrently
* so searching "Ballary", landmarks, streets, or businesses never fails even if one provider is blocked.
*/
async function searchRealPlacesByQuery(queryText, userLat, userLon) {
	const q = (queryText || "").trim();
	if (q.length < 2) return [];
	const hasCoords = typeof userLat === "number" && typeof userLon === "number" && Number.isFinite(userLat) && Number.isFinite(userLon) && !(userLat === 0 && userLon === 0);
	const arcgisPromise = (async () => {
		try {
			const url = new URL(ARCGIS_GEOCODE_URL);
			url.searchParams.set("f", "json");
			url.searchParams.set("singleLine", q);
			url.searchParams.set("maxLocations", "15");
			url.searchParams.set("outFields", "PlaceName,Place_addr,Type,City,Region,Country");
			if (hasCoords) url.searchParams.set("location", `${userLon},${userLat}`);
			const res = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } }, 7500);
			if (!res.ok) return [];
			const data = await res.json();
			if (!Array.isArray(data?.candidates)) return [];
			return data.candidates.map((c, idx) => {
				const cLat = Number(c?.location?.y);
				const cLon = Number(c?.location?.x);
				if (!Number.isFinite(cLat) || !Number.isFinite(cLon)) return null;
				const attrs = c.attributes || {};
				const name = String(attrs.PlaceName || c.address?.split(",")[0] || q).trim();
				const addr = String(attrs.Place_addr || c.address || name).trim();
				return {
					id: `search-arcgis-${idx}-${cLat.toFixed(4)}-${cLon.toFixed(4)}`,
					name,
					display_name: addr.includes(name) ? addr : `${name}, ${addr}`,
					lat: cLat,
					lon: cLon,
					category: String(attrs.Type || "place"),
					type: String(attrs.Type || "poi").toLowerCase(),
					city: attrs.City || void 0,
					state: attrs.Region || void 0,
					country: attrs.Country || void 0
				};
			}).filter(Boolean);
		} catch {
			return [];
		}
	})();
	const photonPromise = (async () => {
		try {
			const photonUrl = new URL("https://photon.komoot.io/api/");
			photonUrl.searchParams.set("q", q);
			photonUrl.searchParams.set("limit", "15");
			if (hasCoords) {
				photonUrl.searchParams.set("lat", String(userLat));
				photonUrl.searchParams.set("lon", String(userLon));
			}
			const res = await fetchWithTimeout(photonUrl.toString(), { headers: { Accept: "application/json" } }, 6500);
			if (!res.ok) return [];
			const data = await res.json();
			if (!Array.isArray(data?.features)) return [];
			return data.features.map((feat, idx) => {
				const props = feat.properties || {};
				const coords = feat.geometry?.coordinates;
				if (!Array.isArray(coords) || coords.length < 2) return null;
				const pLon = Number(coords[0]);
				const pLat = Number(coords[1]);
				if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) return null;
				const name = props.name || [props.housenumber, props.street].filter(Boolean).join(" ") || props.city || q;
				const fullAddress = [
					props.name,
					props.street,
					props.city || props.town || props.village,
					props.state,
					props.country
				].filter(Boolean).join(", ");
				return {
					id: `search-photon-${idx}-${pLat.toFixed(4)}-${pLon.toFixed(4)}`,
					name: String(name).trim(),
					display_name: fullAddress || String(name),
					lat: pLat,
					lon: pLon,
					category: String(props.osm_value || props.osm_key || "place").replace(/_/g, " "),
					type: String(props.osm_value || "poi"),
					city: props.city || props.town || props.village,
					state: props.state,
					country: props.country
				};
			}).filter(Boolean);
		} catch {
			return [];
		}
	})();
	const openMeteoPromise = (async () => {
		try {
			const omUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
			omUrl.searchParams.set("name", q);
			omUrl.searchParams.set("count", "12");
			omUrl.searchParams.set("language", "en");
			omUrl.searchParams.set("format", "json");
			const res = await fetchWithTimeout(omUrl.toString(), { headers: { Accept: "application/json" } }, 6500);
			if (!res.ok) return [];
			const data = await res.json();
			if (!Array.isArray(data?.results)) return [];
			return data.results.map((r, idx) => {
				const rLat = Number(r.latitude);
				const rLon = Number(r.longitude);
				if (!Number.isFinite(rLat) || !Number.isFinite(rLon)) return null;
				const fullAddr = [
					r.name,
					r.admin2,
					r.admin1,
					r.country
				].filter(Boolean).join(", ");
				return {
					id: `search-om-${r.id || idx}-${rLat.toFixed(4)}-${rLon.toFixed(4)}`,
					name: String(r.name || q).trim(),
					display_name: fullAddr || String(r.name || q),
					lat: rLat,
					lon: rLon,
					category: String(r.feature_code || "Place"),
					type: "place",
					city: r.admin2 || r.name,
					state: r.admin1,
					country: r.country
				};
			}).filter(Boolean);
		} catch {
			return [];
		}
	})();
	const nominatimPromise = (async () => {
		try {
			const nomUrl = new URL("https://nominatim.openstreetmap.org/search");
			nomUrl.searchParams.set("format", "jsonv2");
			nomUrl.searchParams.set("q", q);
			nomUrl.searchParams.set("addressdetails", "1");
			nomUrl.searchParams.set("limit", "12");
			const res = await fetchWithTimeout(nomUrl.toString(), { headers: {
				Accept: "application/json",
				"Accept-Language": "en"
			} }, 6500);
			if (!res.ok) return [];
			const data = await res.json();
			if (!Array.isArray(data)) return [];
			return data.map((item, idx) => {
				const nLat = Number(item.lat);
				const nLon = Number(item.lon);
				if (!Number.isFinite(nLat) || !Number.isFinite(nLon)) return null;
				const addr = item.address || {};
				const rawName = item.name || (typeof item.display_name === "string" ? item.display_name.split(",")[0] : "") || q;
				return {
					id: `search-nom-${item.place_id || idx}-${nLat.toFixed(4)}-${nLon.toFixed(4)}`,
					name: String(rawName).trim(),
					display_name: String(item.display_name || rawName),
					lat: nLat,
					lon: nLon,
					category: String(item.type || item.category || "place").replace(/_/g, " "),
					type: String(item.type || "poi"),
					city: addr.city || addr.town || addr.village,
					state: addr.state,
					country: addr.country
				};
			}).filter(Boolean);
		} catch {
			return [];
		}
	})();
	const [arcgisRes, photonRes, omRes, nomRes] = await Promise.all([
		arcgisPromise,
		photonPromise,
		openMeteoPromise,
		nominatimPromise
	]);
	const combined = [
		...arcgisRes,
		...photonRes,
		...omRes,
		...nomRes
	];
	const seen = /* @__PURE__ */ new Map();
	for (const item of combined) {
		const dist = hasCoords ? calculateDistanceMeters(userLat, userLon, item.lat, item.lon) : void 0;
		const key = `${item.name.toLowerCase().replace(/[^a-z0-9]/g, "")}_${item.lat.toFixed(2)}_${item.lon.toFixed(2)}`;
		const existing = seen.get(key);
		if (!existing || item.display_name.length > existing.display_name.length) seen.set(key, {
			...item,
			distanceMeters: dist
		});
	}
	return Array.from(seen.values()).slice(0, 35);
}
/**
* Generates a universal Google Maps turn-by-turn navigation URL
*/
function getNativeNavigationUrl(destLat, destLon, originLat, originLon) {
	const dest = `${destLat},${destLon}`;
	if (typeof originLat === "number" && typeof originLon === "number" && Number.isFinite(originLat) && Number.isFinite(originLon) && !(originLat === 0 && originLon === 0)) return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLon}&destination=${dest}&travelmode=driving`;
	return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}
/**
* Generates a temporary encrypted/tokenized real-time responder tracking URL and SMS/WhatsApp payloads
*/
function createEmergencySharePayload(alert, customToken, customExpiresAt) {
	const token = customToken || `sos_${alert.id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
	const expiresAt = customExpiresAt || new Date(Date.now() + 72e5).toISOString();
	const baseOrigin = typeof window !== "undefined" && window.location.origin && !window.location.origin.includes("localhost") && !window.location.origin.startsWith("capacitor:") && !window.location.origin.startsWith("file:") ? window.location.origin : "https://ais-pre-dkfhfrzboel3a3xnlpek5a-752786783113.asia-northeast1.run.app";
	const params = new URLSearchParams({
		sos_track: token,
		alertId: alert.id,
		lat: String(alert.latitude),
		lng: String(alert.longitude),
		sender: alert.senderName || "Beacon User"
	});
	if (alert.message) params.set("msg", alert.message);
	const trackingUrl = `${baseOrigin}/?${params.toString()}`;
	const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${alert.latitude},${alert.longitude}`;
	const shareMessage = `🚨 EMERGENCY SOS LIVE TRACKING (${alert.senderName})\n${alert.message ? `Message: "${alert.message}"\n` : ""}Coordinates: ${alert.latitude.toFixed(5)}, ${alert.longitude.toFixed(5)}\nLive Responder Tracking Link (Valid 2h): ${trackingUrl}\nGoogle Maps Pin: ${googleMapsUrl}`;
	const encodedMsg = encodeURIComponent(shareMessage);
	return {
		token,
		trackingUrl,
		googleMapsUrl,
		expiresAt,
		shareMessage,
		smsHref: `sms:?body=${encodedMsg}`,
		whatsappHref: `https://wa.me/?text=${encodedMsg}`
	};
}
// src/config/env.ts
/**
* Centralized Production & Runtime Configuration (Web + Android APK)
* Ensures Web and Android APK builds communicate with the exact same production backend,
* production WebSocket endpoint, and production Cloud Firestore database.
*/
var DEFAULT_PRODUCTION_BACKEND_ORIGIN = "https://ais-pre-dkfhfrzboel3a3xnlpek5a-752786783113.asia-northeast1.run.app";
var RUNTIME_API_OVERRIDE_KEY = "beacon_production_api_url_override";
function getEnvVar(name) {
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
		if (metaEnv && typeof metaEnv[name] === "string" && metaEnv[name].trim().length > 0) return metaEnv[name].trim();
	} catch {}
	try {
		if (typeof process !== "undefined" && typeof {}[name] === "string") {
			const val = {}[name].trim();
			if (val.length > 0) return val;
		}
	} catch {}
	return "";
}
var FIREBASE_PRODUCTION_CONFIG = {
	projectId: getEnvVar("VITE_FIREBASE_PROJECT_ID") || "gen-lang-client-0914373991",
	appId: getEnvVar("VITE_FIREBASE_APP_ID") || "1:352216424599:web:d41a23195b40cdc78149d2",
	apiKey: getEnvVar("VITE_FIREBASE_API_KEY") || "AIzaSyDytVqEQzabXfZPoBRd35E9VNdXOq3KZLo",
	authDomain: getEnvVar("VITE_FIREBASE_AUTH_DOMAIN") || "gen-lang-client-0914373991.firebaseapp.com",
	firestoreDatabaseId: getEnvVar("VITE_FIREBASE_DATABASE_ID") || "ai-studio-nexuspoint-bb482c10-9426-424c-8259-807bce4cb7da",
	storageBucket: getEnvVar("VITE_FIREBASE_STORAGE_BUCKET") || "gen-lang-client-0914373991.firebasestorage.app",
	messagingSenderId: getEnvVar("VITE_FIREBASE_MESSAGING_SENDER_ID") || "352216424599",
	vapidKey: getEnvVar("VITE_FIREBASE_VAPID_KEY") || ""
};
getEnvVar("VITE_GOOGLE_MAPS_API_KEY");
var FIRESTORE_BASE_DOCS_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PRODUCTION_CONFIG.projectId}/databases/${FIREBASE_PRODUCTION_CONFIG.firestoreDatabaseId}/documents`;
var FIRESTORE_SYNC_DOC_URL = `${FIRESTORE_BASE_DOCS_URL}/beacon_sync/global_state?key=${FIREBASE_PRODUCTION_CONFIG.apiKey}`;
`${FIRESTORE_BASE_DOCS_URL}${FIREBASE_PRODUCTION_CONFIG.apiKey}`;
/**
* Detects whether the app is currently running inside the packaged Android APK / Capacitor WebView.
*/
function isAndroidNativeApp() {
	if (typeof window === "undefined") return false;
	const w = window;
	if (w.AndroidLocationBridge) return true;
	const cap = w.Capacitor;
	if (cap && (typeof cap.isNativePlatform === "function" && cap.isNativePlatform() || cap.isNative)) return true;
	const proto = window.location.protocol;
	const host = window.location.hostname;
	if (proto === "capacitor:" || proto === "file:") return true;
	if (host === "localhost" && !window.location.port) return true;
	return false;
}
function isInvalidOrLocalEndpoint(url) {
	const lower = url.trim().toLowerCase();
	if (!lower.startsWith("https://") && !lower.startsWith("http://")) return true;
	return lower.includes("your_production") || lower.includes("myapp-backend.onrender.com") || lower.includes("example.com") || lower.includes("localhost") || lower.includes("127.0.0.1") || lower.includes("0.0.0.0") || lower.includes("10.0.2.2");
}
/**
* Allows setting or clearing a runtime HTTPS production backend URL from the Diagnostic Panel
* (e.g., when switching to a public `--allow-unauthenticated` Cloud Run service URL).
*/
function setProductionApiBaseUrlOverride(url) {
	if (typeof localStorage === "undefined") return;
	if (!url || !url.trim()) {
		localStorage.removeItem(RUNTIME_API_OVERRIDE_KEY);
		return;
	}
	const cleaned = url.trim().replace(/\/+$/, "");
	if (!cleaned.startsWith("https://") || isInvalidOrLocalEndpoint(cleaned)) throw new Error("Production Backend URL must start with https:// and cannot be localhost, 127.0.0.1, or 0.0.0.0.");
	localStorage.setItem(RUNTIME_API_OVERRIDE_KEY, cleaned);
}
function getProductionApiBaseUrlOverride() {
	if (typeof localStorage === "undefined") return "";
	try {
		const val = localStorage.getItem(RUNTIME_API_OVERRIDE_KEY) || "";
		if (val && val.startsWith("https://") && !isInvalidOrLocalEndpoint(val)) return val.replace(/\/+$/, "");
	} catch {}
	return "";
}
/**
* Resolves the centralized production API base URL (`PRODUCTION_API_URL`).
* Guarantees Android APK never calls localhost, 127.0.0.1, 0.0.0.0, or placeholder URLs.
*/
function getProductionApiBaseUrl() {
	const runtimeOverride = getProductionApiBaseUrlOverride();
	if (runtimeOverride) return runtimeOverride;
	const configuredUrl = getEnvVar("VITE_API_BASE_URL") || getEnvVar("VITE_API_URL");
	if (configuredUrl && !isInvalidOrLocalEndpoint(configuredUrl)) return configuredUrl.replace(/\/+$/, "");
	if (typeof window !== "undefined") {
		if (isAndroidNativeApp()) return DEFAULT_PRODUCTION_BACKEND_ORIGIN;
		const { protocol, hostname, port, origin } = window.location;
		if ((protocol === "https:" || protocol === "http:") && hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "0.0.0.0") return origin.replace(/\/+$/, "");
		if ((hostname === "localhost" || hostname === "127.0.0.1") && port === "3000") return origin.replace(/\/+$/, "");
	}
	return DEFAULT_PRODUCTION_BACKEND_ORIGIN;
}
var PRODUCTION_API_URL = getProductionApiBaseUrl();
/**
* Returns a visible, sanitized representation of a backend URL without exposing any secrets, tokens, or API keys.
*/
function getMaskedBackendUrl(rawUrl) {
	const target = rawUrl || getProductionApiBaseUrl();
	try {
		const parsed = new URL(target);
		parsed.username = "";
		parsed.password = "";
		for (const key of Array.from(parsed.searchParams.keys())) {
			const lower = key.toLowerCase();
			if (lower.includes("key") || lower.includes("token") || lower.includes("secret") || lower.includes("auth") || lower.includes("pass")) parsed.searchParams.set(key, "[MASKED]");
		}
		return parsed.toString().replace(/\/+$/, "");
	} catch {
		return target.replace(/([?&](?:key|token|secret|password)=)[^&]+/gi, "$1[MASKED]");
	}
}
/**
* Resolves a relative API endpoint (e.g. `/api/rooms`) to a full production URL.
*/
function resolveApiUrl(endpoint) {
	if (/^https?:\/\//i.test(endpoint)) return endpoint;
	const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
	const override = getProductionApiBaseUrlOverride();
	if (override) return `${override}${path}`;
	if (typeof window !== "undefined" && !isAndroidNativeApp()) return path;
	return `${getProductionApiBaseUrl()}${path}`;
}
/**
* Resolves the centralized production WebSocket (`wss://`) URL (`PRODUCTION_WSS_URL`).
*/
function getProductionWsUrl() {
	const configuredWs = getEnvVar("VITE_WS_URL");
	if (configuredWs && !isInvalidOrLocalEndpoint(configuredWs)) return configuredWs.endsWith("/ws") ? configuredWs : `${configuredWs.replace(/\/+$/, "")}/ws`;
	return `${getProductionApiBaseUrl().replace(/^http:/i, "ws:").replace(/^https:/i, "wss:")}/ws`;
}
var PRODUCTION_WSS_URL = getProductionWsUrl();
var MAX_DIAGNOSTIC_LOGS = 100;
var diagnosticLogs = [];
function sanitizeDetails(details) {
	if (!details || typeof details !== "object") return void 0;
	const clean = {};
	for (const [k, v] of Object.entries(details)) {
		const lower = k.toLowerCase();
		if (lower.includes("password") || lower.includes("token") || lower.includes("secret") || lower.includes("authorization") || lower.includes("salt") || lower.includes("hash") || lower.includes("apikey") || lower.includes("key")) clean[k] = "[REDACTED]";
		else clean[k] = v;
	}
	return clean;
}
/**
* Production-safe diagnostic logger (never logs passwords, tokens, API keys, or secrets).
*/
var syncLogger = {
	log(category, level, event, details) {
		const entry = {
			timestamp: (/* @__PURE__ */ new Date()).toISOString(),
			category,
			level,
			event,
			details: sanitizeDetails(details)
		};
		diagnosticLogs.push(entry);
		if (diagnosticLogs.length > MAX_DIAGNOSTIC_LOGS) diagnosticLogs.shift();
		if (typeof window !== "undefined") window.__beaconSyncDiagnostics = diagnosticLogs;
	},
	getLogs() {
		return [...diagnosticLogs];
	}
};
/**
* Executes an HTTPS request using the native Android Java bridge (`AndroidLocationBridge.nativeHttpRequest`)
* when running inside the standalone Android APK, or standard `fetch` on Web/Node.
* This prevents WebView cross-origin CORS blocks and handles Cloud Run sticky session affinity transparently.
*/
async function nativeAwareFetch(inputUrl, options = {}, timeoutMs = 7500) {
	const fullUrl = /^https?:\/\//i.test(inputUrl) ? inputUrl : resolveApiUrl(inputUrl);
	if (typeof window !== "undefined" && isAndroidNativeApp() && typeof window.AndroidLocationBridge?.nativeHttpRequest === "function" && /^https?:\/\//i.test(fullUrl)) try {
		const method = (options.method || "GET").toUpperCase();
		const headersObj = {};
		if (options.headers) {
			if (options.headers instanceof Headers) options.headers.forEach((v, k) => {
				headersObj[k] = v;
			});
			else if (Array.isArray(options.headers)) for (const [k, v] of options.headers) headersObj[k] = v;
			else Object.assign(headersObj, options.headers);
		}
		const bodyStr = typeof options.body === "string" ? options.body : "";
		const rawJson = window.AndroidLocationBridge.nativeHttpRequest(fullUrl, method, JSON.stringify(headersObj), bodyStr);
		if (rawJson) {
			const parsed = JSON.parse(rawJson);
			if (parsed && typeof parsed.status === "number" && parsed.status > 0) {
				const responseHeaders = new Headers();
				responseHeaders.set("content-type", parsed.contentType || "application/json; charset=utf-8");
				return new Response(typeof parsed.body === "string" ? parsed.body : "", {
					status: parsed.status,
					headers: responseHeaders
				});
			}
			if (parsed?.error) throw new Error(parsed.error);
		}
	} catch (nativeErr) {
		syncLogger.log("api", "warn", "native_http_bridge_fallback", { message: nativeErr?.message || "Native HTTP error" });
	}
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(inputUrl, {
			...options,
			signal: options.signal || controller.signal
		});
	} finally {
		clearTimeout(timer);
	}
}
// src/utils/cloudSync.ts
var firebaseConfig = FIREBASE_PRODUCTION_CONFIG;
var FIRESTORE_SYNC_URL = FIRESTORE_SYNC_DOC_URL;
var runningOnAuthoritativeBackend = false;
function getBackendSyncEndpoints() {
	if (runningOnAuthoritativeBackend) return [];
	if (typeof window === "undefined") return ["http://127.0.0.1:3000/api/sync/state", `${PRODUCTION_API_URL}/api/sync/state`];
	return [resolveApiUrl("/api/sync/state")];
}
function getClientAuthHeaders(includeJsonContentType = false) {
	const headers = {
		Accept: "application/json",
		"Cache-Control": "no-cache"
	};
	if (includeJsonContentType) headers["Content-Type"] = "application/json";
	if (typeof window !== "undefined" && typeof localStorage !== "undefined") try {
		const token = localStorage.getItem("beacon_token");
		if (token) headers["Authorization"] = `Bearer ${token}`;
		const rawUser = localStorage.getItem("beacon_user_profile");
		if (rawUser) {
			const parsed = JSON.parse(rawUser);
			if (parsed?.id) headers["X-Beacon-User-Id"] = String(parsed.id);
			if (parsed?.email) headers["X-Beacon-User-Email"] = String(parsed.email);
		}
	} catch {}
	return headers;
}
var syncListeners = /* @__PURE__ */ new Set();
function notifySyncListeners(state) {
	for (const listener of syncListeners) try {
		listener(state);
	} catch {}
	if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") try {
		window.dispatchEvent(new CustomEvent("beacon:cloud-sync-updated", { detail: state }));
	} catch {}
}
var INITIAL_SEED_USERS = [{
	id: "1acba9f0-df49-4e70-9f0d-b51fd2f61ea0",
	email: "reddytest39@gmail.com",
	username: "Reddy",
	fullName: "Reddy",
	avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Reddy",
	about: "Member of Beacon Community",
	phoneNumber: "",
	createdAt: "2026-10-26T08:46:03.025Z",
	isOnline: true,
	lastSeen: "2026-10-27T16:17:41.196Z",
	privacy: {
		locationVisibility: "room_members",
		phoneVisibility: "room_members",
		profileVisibility: "public",
		showOnlineStatus: true,
		locationSharingEnabled: true,
		temporarySharingExpiry: null,
		blockedUserIds: []
	},
	isAdmin: true
}];
var INITIAL_SEED_ROOMS = [{
	id: "reddy",
	name: "Reddy",
	description: "Personal Room",
	ownerId: "1acba9f0-df49-4e70-9f0d-b51fd2f61ea0",
	hasPassword: false,
	createdAt: "2026-10-26T08:56:20.038Z",
	memberCount: 1,
	isPrivate: true
}];
var INITIAL_SEED_ROOM_MEMBERS = [{
	roomId: "room-universal",
	userId: "1acba9f0-df49-4e70-9f0d-b51fd2f61ea0",
	role: "ADMIN",
	joinedAt: "2026-10-26T08:46:03.025Z"
}, {
	roomId: "reddy",
	userId: "1acba9f0-df49-4e70-9f0d-b51fd2f61ea0",
	role: "OWNER",
	joinedAt: "2026-10-26T08:56:20.039Z"
}];
function getItemTimestampMs(item) {
	if (!item || typeof item !== "object") return 0;
	const raw = item.updatedAt || item.updated_at || item.lastSeen || item.timestamp || item.createdAt || item.joinedAt;
	if (!raw) return 0;
	const ms = new Date(raw).getTime();
	return Number.isFinite(ms) ? ms : 0;
}
function mergeArrayById(localArr = [], remoteArr = [], idKey = "id", deletedSet, preferRemoteOnTie = false) {
	const map = /* @__PURE__ */ new Map();
	for (const item of remoteArr) {
		if (!item || !item[idKey]) continue;
		const key = String(item[idKey]);
		if (deletedSet?.has(key)) continue;
		map.set(key, { ...item });
	}
	for (const item of localArr) {
		if (!item || !item[idKey]) continue;
		const key = String(item[idKey]);
		if (deletedSet?.has(key)) continue;
		const existingRemote = map.get(key);
		if (existingRemote) {
			const localTs = getItemTimestampMs(item);
			const remoteTs = getItemTimestampMs(existingRemote);
			if (localTs > remoteTs) map.set(key, {
				...existingRemote,
				...item
			});
			else if (remoteTs > localTs) map.set(key, {
				...item,
				...existingRemote
			});
			else map.set(key, preferRemoteOnTie ? {
				...item,
				...existingRemote
			} : {
				...existingRemote,
				...item
			});
		} else map.set(key, { ...item });
	}
	return Array.from(map.values());
}
function mergeDatabaseStates(target, incoming, preferIncoming = false) {
	if (!incoming || typeof incoming !== "object") return;
	const deletedSet = /* @__PURE__ */ new Set([...Array.isArray(target.deletedIds) ? target.deletedIds : [], ...Array.isArray(incoming.deletedIds) ? incoming.deletedIds : []]);
	target.deletedIds = Array.from(deletedSet).slice(-500);
	const userIdAliasMap = /* @__PURE__ */ new Map();
	if (Array.isArray(incoming.users)) for (const rUser of incoming.users) {
		if (!rUser || !rUser.id && !rUser.email) continue;
		const idx = target.users.findIndex((u) => u.id === rUser.id || u.email && rUser.email && u.email.toLowerCase() === rUser.email.toLowerCase() || u.username && rUser.username && u.username.toLowerCase() === rUser.username.toLowerCase());
		if (idx >= 0) {
			const localUser = target.users[idx];
			const seedMatch = INITIAL_SEED_USERS.find((s) => s.email.toLowerCase() === (localUser.email || rUser.email || "").toLowerCase() || s.username.toLowerCase() === (localUser.username || rUser.username || "").toLowerCase());
			const localCreatedMs = new Date(localUser.createdAt || 0).getTime() || Number.MAX_SAFE_INTEGER;
			const remoteCreatedMs = new Date(rUser.createdAt || 0).getTime() || Number.MAX_SAFE_INTEGER;
			const canonicalId = seedMatch ? seedMatch.id : localCreatedMs <= remoteCreatedMs ? localUser.id : rUser.id;
			if (localUser.id && localUser.id !== canonicalId) userIdAliasMap.set(localUser.id, canonicalId);
			if (rUser.id && rUser.id !== canonicalId) userIdAliasMap.set(rUser.id, canonicalId);
			const localTs = getItemTimestampMs(localUser);
			const remoteTs = getItemTimestampMs(rUser);
			const remoteIsNewer = remoteTs > localTs || remoteTs === localTs && preferIncoming;
			const merged = remoteIsNewer ? {
				...localUser,
				...rUser,
				id: canonicalId
			} : {
				...rUser,
				...localUser,
				id: canonicalId
			};
			const maxLastSeenMs = Math.max(new Date(localUser.lastSeen || 0).getTime() || 0, new Date(rUser.lastSeen || 0).getTime() || 0);
			if (maxLastSeenMs > 0) merged.lastSeen = new Date(maxLastSeenMs).toISOString();
			if (remoteIsNewer && rUser.password) merged.password = rUser.password;
			else if (localUser.password && !merged.password) merged.password = localUser.password;
			else if (rUser.password && !merged.password) merged.password = rUser.password;
			if (rUser.passwordHash && (!merged.passwordHash || remoteIsNewer)) {
				merged.passwordHash = rUser.passwordHash;
				merged.salt = rUser.salt;
			}
			if (localUser.passwordHash && !merged.passwordHash) {
				merged.passwordHash = localUser.passwordHash;
				merged.salt = localUser.salt;
			}
			target.users[idx] = merged;
		} else target.users.push({ ...rUser });
	}
	const normalizeUid = (uid) => {
		if (!uid) return uid;
		return userIdAliasMap.get(uid) || uid;
	};
	const uniqueUsersMap = /* @__PURE__ */ new Map();
	for (const u of target.users) {
		if (!u || !u.id) continue;
		const cid = normalizeUid(u.id);
		u.id = cid;
		uniqueUsersMap.set(cid, u);
	}
	target.users = Array.from(uniqueUsersMap.values());
	if (Array.isArray(incoming.sessions)) target.sessions = mergeArrayById(target.sessions, incoming.sessions, "token", deletedSet, preferIncoming).map((s) => ({
		...s,
		userId: normalizeUid(s.userId) || s.userId
	})).slice(-150);
	if (Array.isArray(incoming.rooms)) target.rooms = mergeArrayById(target.rooms, incoming.rooms, "id", deletedSet, preferIncoming).map((r) => ({
		...r,
		ownerId: normalizeUid(r.ownerId) || r.ownerId
	}));
	const memberMap = /* @__PURE__ */ new Map();
	const allMembers = [...Array.isArray(incoming.roomMembers) ? incoming.roomMembers : [], ...Array.isArray(target.roomMembers) ? target.roomMembers : []];
	for (const m of allMembers) {
		if (!m || !m.roomId || !m.userId) continue;
		if (deletedSet.has(m.roomId)) continue;
		const uid = normalizeUid(m.userId);
		const leaveKey = `leave_${m.roomId}_${uid}`;
		if (m.roomId !== "room-universal" && deletedSet.has(leaveKey)) continue;
		const mapKey = `${m.roomId}_${uid}`;
		const existing = memberMap.get(mapKey);
		if (!existing) memberMap.set(mapKey, {
			...m,
			userId: uid
		});
		else {
			const roleRank = {
				OWNER: 3,
				ADMIN: 2,
				MEMBER: 1
			};
			const bestRole = (roleRank[m.role] || 1) >= (roleRank[existing.role] || 1) ? m.role : existing.role;
			memberMap.set(mapKey, {
				...existing,
				...m,
				userId: uid,
				role: bestRole
			});
		}
	}
	for (const r of target.rooms) {
		if (!r || !r.id || !r.ownerId || r.ownerId === "system") continue;
		const ownerUid = normalizeUid(r.ownerId);
		const ownerKey = `${r.id}_${ownerUid}`;
		if (!memberMap.has(ownerKey) && !deletedSet.has(`leave_${r.id}_${ownerUid}`)) memberMap.set(ownerKey, {
			roomId: r.id,
			userId: ownerUid,
			role: "OWNER",
			joinedAt: r.createdAt || (/* @__PURE__ */ new Date()).toISOString()
		});
	}
	for (const u of target.users) {
		if (!u?.id) continue;
		const uniKey = `room-universal_${u.id}`;
		if (!memberMap.has(uniKey)) memberMap.set(uniKey, {
			roomId: "room-universal",
			userId: u.id,
			role: u.isAdmin ? "ADMIN" : "MEMBER",
			joinedAt: u.createdAt || (/* @__PURE__ */ new Date()).toISOString()
		});
	}
	target.roomMembers = Array.from(memberMap.values());
	for (const r of target.rooms) {
		if (!r || !r.id) continue;
		const count = target.roomMembers.filter((m) => m.roomId === r.id).length;
		if (count > 0) r.memberCount = count;
	}
	if (!target.locations || Array.isArray(target.locations)) {
		const converted = {};
		if (Array.isArray(target.locations)) {
			for (const loc of target.locations) if (loc && loc.userId) {
				const cid = normalizeUid(loc.userId) || loc.userId;
				converted[cid] = {
					...loc,
					userId: cid
				};
			}
		}
		target.locations = converted;
	} else for (const [rawKey, loc] of Object.entries(target.locations)) {
		const cid = normalizeUid(loc?.userId || rawKey) || rawKey;
		if (cid !== rawKey) delete target.locations[rawKey];
		if (loc) target.locations[cid] = {
			...loc,
			userId: cid
		};
	}
	if (incoming.locations && typeof incoming.locations === "object") {
		const entries = Array.isArray(incoming.locations) ? incoming.locations.map((l) => [l?.userId, l]) : Object.entries(incoming.locations);
		for (const [rawUid, rLoc] of entries) {
			if (!rLoc || typeof rLoc.latitude !== "number" || typeof rLoc.longitude !== "number") continue;
			const uid = normalizeUid(rLoc.userId || rawUid) || rawUid;
			if (!uid) continue;
			const normalizedRemoteLoc = {
				...rLoc,
				userId: uid
			};
			const lLoc = target.locations[uid];
			if (!lLoc) target.locations[uid] = normalizedRemoteLoc;
			else if ((new Date(rLoc.updated_at || rLoc.timestamp || 0).getTime() || 0) >= (new Date(lLoc.updated_at || lLoc.timestamp || 0).getTime() || 0)) target.locations[uid] = normalizedRemoteLoc;
		}
	}
	if (Array.isArray(incoming.savedPlaces)) target.savedPlaces = mergeArrayById(target.savedPlaces, incoming.savedPlaces, "id", deletedSet, preferIncoming).map((p) => ({
		...p,
		userId: normalizeUid(p.userId) || p.userId
	}));
	if (Array.isArray(incoming.messages)) {
		const msgMap = /* @__PURE__ */ new Map();
		for (const m of [...target.messages || [], ...incoming.messages || []]) {
			if (!m || !m.id) continue;
			if (deletedSet.has(m.id)) continue;
			const resolvedSenderId = normalizeUid(m.senderId || m.userId) || m.senderId || m.userId;
			const normalizedMsg = {
				...m,
				senderId: resolvedSenderId,
				...m.userId ? { userId: resolvedSenderId } : {},
				recipientId: normalizeUid(m.recipientId) || m.recipientId
			};
			const existing = msgMap.get(m.id);
			if (!existing) msgMap.set(m.id, normalizedMsg);
			else {
				const isDeleted = Boolean(existing.isDeleted || normalizedMsg.isDeleted);
				const isEdited = Boolean(existing.isEdited || normalizedMsg.isEdited);
				const existingTs = getItemTimestampMs(existing);
				const incomingTs = getItemTimestampMs(normalizedMsg);
				const newer = incomingTs >= existingTs ? normalizedMsg : existing;
				const older = incomingTs >= existingTs ? existing : normalizedMsg;
				const mergedReactions = {};
				const allEmojis = /* @__PURE__ */ new Set([...Object.keys(existing.reactions || {}), ...Object.keys(normalizedMsg.reactions || {})]);
				for (const emoji of allEmojis) {
					const usersForEmoji = Array.from(/* @__PURE__ */ new Set([...existing.reactions && existing.reactions[emoji] || [], ...normalizedMsg.reactions && normalizedMsg.reactions[emoji] || []])).map((id) => normalizeUid(id) || id);
					if (usersForEmoji.length > 0) mergedReactions[emoji] = usersForEmoji;
				}
				msgMap.set(m.id, {
					...older,
					...newer,
					isDeleted,
					isEdited,
					text: isDeleted ? "[Message deleted]" : newer.text,
					reactions: mergedReactions
				});
			}
		}
		const mergedMsgs = Array.from(msgMap.values());
		mergedMsgs.sort((a, b) => (new Date(a.createdAt || a.timestamp || 0).getTime() || 0) - (new Date(b.createdAt || b.timestamp || 0).getTime() || 0));
		target.messages = mergedMsgs.slice(-300);
	}
	if (Array.isArray(incoming.reminders)) target.reminders = mergeArrayById(target.reminders, incoming.reminders, "id", deletedSet, preferIncoming).map((r) => ({
		...r,
		userId: normalizeUid(r.userId) || r.userId
	}));
	if (Array.isArray(incoming.meetings)) target.meetings = mergeArrayById(target.meetings, incoming.meetings, "id", deletedSet, preferIncoming).map((m) => ({
		...m,
		creatorId: normalizeUid(m.creatorId) || m.creatorId
	}));
	if (Array.isArray(incoming.emergencyAlerts)) {
		const alertMap = /* @__PURE__ */ new Map();
		for (const a of [...incoming.emergencyAlerts || [], ...target.emergencyAlerts || []]) {
			if (!a || !a.id || deletedSet.has(a.id)) continue;
			const existing = alertMap.get(a.id);
			if (!existing) alertMap.set(a.id, {
				...a,
				senderId: normalizeUid(a.senderId) || a.senderId
			});
			else {
				const ackMap = /* @__PURE__ */ new Map();
				for (const ack of [...Array.isArray(existing.acknowledgedBy) ? existing.acknowledgedBy : [], ...Array.isArray(a.acknowledgedBy) ? a.acknowledgedBy : []]) if (ack && ack.userId) {
					const uid = normalizeUid(ack.userId) || ack.userId;
					ackMap.set(uid, {
						...ack,
						userId: uid
					});
				} else if (typeof ack === "string") {
					const uid = normalizeUid(ack) || ack;
					ackMap.set(uid, {
						userId: uid,
						name: "Member",
						timestamp: (/* @__PURE__ */ new Date()).toISOString()
					});
				}
				const isResolved = existing.status === "resolved" || a.status === "resolved";
				alertMap.set(a.id, {
					...existing,
					...a,
					senderId: normalizeUid(a.senderId || existing.senderId) || a.senderId,
					status: isResolved ? "resolved" : "active",
					acknowledgedBy: Array.from(ackMap.values())
				});
			}
		}
		target.emergencyAlerts = Array.from(alertMap.values()).sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()).slice(0, 50);
	}
	if (Array.isArray(incoming.locationShareRequests)) target.locationShareRequests = mergeArrayById(target.locationShareRequests, incoming.locationShareRequests, "id", deletedSet, preferIncoming).slice(0, 100);
	if (Array.isArray(incoming.locationHistory)) {
		const hist = mergeArrayById(target.locationHistory || [], incoming.locationHistory || [], "id", deletedSet, preferIncoming).map((h) => ({
			...h,
			userId: normalizeUid(h.userId) || h.userId
		}));
		hist.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
		target.locationHistory = hist.slice(-200);
	}
}
var lastPullTime = 0;
var inFlightPull = null;
var pushTimeoutId = null;
var cloudConnected = false;
var lastSuccessfulSyncMs = 0;
var firestoreQuotaCooldownUntil = 0;
var lastFirestoreHttpStatus = 0;
var lastFirestoreErrorMsg = "";
function getCloudDatabaseHealth() {
	return {
		connected: cloudConnected,
		lastSyncMs: lastSuccessfulSyncMs,
		projectId: firebaseConfig.projectId,
		databaseId: firebaseConfig.firestoreDatabaseId,
		httpStatus: lastFirestoreHttpStatus,
		errorMessage: lastFirestoreErrorMsg,
		quotaExceeded: lastFirestoreHttpStatus === 429 || Date.now() < firestoreQuotaCooldownUntil
	};
}
async function verifyCloudFirestoreConnection() {
	for (const endpoint of getBackendSyncEndpoints()) try {
		const res = await nativeAwareFetch(endpoint, {
			method: "GET",
			headers: getClientAuthHeaders(false),
			cache: "no-store",
			credentials: "include"
		}, 4500);
		const ct = (res.headers.get("content-type") || "").toLowerCase();
		if (res.ok && ct.includes("application/json")) {
			cloudConnected = true;
			lastSuccessfulSyncMs = Date.now();
			lastFirestoreHttpStatus = res.status;
			lastFirestoreErrorMsg = "";
			return true;
		}
	} catch {}
	if (!runningOnAuthoritativeBackend) return cloudConnected;
	if (Date.now() < firestoreQuotaCooldownUntil) return false;
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 5e3);
		const res = await fetch(FIRESTORE_SYNC_URL, {
			method: "GET",
			headers: {
				Accept: "application/json",
				"Cache-Control": "no-cache"
			},
			cache: "no-store",
			signal: controller.signal
		});
		clearTimeout(timer);
		lastFirestoreHttpStatus = res.status;
		if (res.status === 429) {
			firestoreQuotaCooldownUntil = Date.now() + 9e5;
			lastFirestoreErrorMsg = "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'";
			cloudConnected = false;
			syncLogger.log("firestore", "warn", "quota_cooldown_active", { status: 429 });
			return false;
		}
		if (res.ok) {
			cloudConnected = true;
			lastSuccessfulSyncMs = Date.now();
			lastFirestoreErrorMsg = "";
			return true;
		}
		cloudConnected = false;
		lastFirestoreErrorMsg = `Firestore HTTP ${res.status}`;
		return false;
	} catch (err) {
		cloudConnected = false;
		lastFirestoreErrorMsg = err?.message || "Firestore unreachable";
		return false;
	}
}
/**
* Pulls the latest synchronized state from the Production Backend and merges it into `targetState`
*/
async function pullAndMergeCloudState(targetState, force = false, silentNotify = false) {
	if (!force && Date.now() - lastPullTime < 1200) return false;
	if (inFlightPull) return inFlightPull;
	inFlightPull = (async () => {
		let anyUpdated = false;
		try {
			for (const endpoint of getBackendSyncEndpoints()) try {
				const res = await nativeAwareFetch(endpoint, {
					method: "GET",
					headers: getClientAuthHeaders(false),
					cache: "no-store",
					credentials: "include"
				}, 5e3);
				if (res.ok) {
					const payload = await res.json();
					cloudConnected = true;
					lastSuccessfulSyncMs = Date.now();
					lastPullTime = Date.now();
					if (payload?.state && typeof payload.state === "object") {
						mergeDatabaseStates(targetState, payload.state, false);
						anyUpdated = true;
						break;
					}
				}
			} catch {}
			if (anyUpdated && !silentNotify) notifySyncListeners(targetState);
			return anyUpdated;
		} finally {
			inFlightPull = null;
		}
	})();
	return inFlightPull;
}
/**
* Pushes the merged state to the Production Backend (debounced or immediate)
*/
function schedulePushCloudState(localState, immediate = false) {
	if (pushTimeoutId) {
		clearTimeout(pushTimeoutId);
		pushTimeoutId = null;
	}
	const executePush = async () => {
		if (runningOnAuthoritativeBackend) {
			cloudConnected = true;
			lastSuccessfulSyncMs = Date.now();
			return;
		}
		let pushedSuccessfully = false;
		try {
			const authHeaders = getClientAuthHeaders(true);
			if (!authHeaders["Authorization"]) return;
			await pullAndMergeCloudState(localState, true, true);
			const compactState = {
				...localState,
				messages: (localState.messages || []).slice(-250),
				locationHistory: (localState.locationHistory || []).slice(-180),
				auditLogs: (localState.auditLogs || []).slice(-80),
				sessions: [],
				passwordResets: [],
				deletedIds: (localState.deletedIds || []).slice(-400)
			};
			if (JSON.stringify(compactState).length >= 94e4) return;
			for (const endpoint of getBackendSyncEndpoints()) try {
				const res = await nativeAwareFetch(endpoint, {
					method: "POST",
					headers: authHeaders,
					credentials: "include",
					body: JSON.stringify({ state: compactState })
				}, 6e3);
				const ct = (res.headers.get("content-type") || "").toLowerCase();
				if (res.ok && ct.includes("application/json")) {
					const payload = await res.json();
					if (payload?.state && typeof payload.state === "object") mergeDatabaseStates(localState, payload.state, false);
					cloudConnected = true;
					lastSuccessfulSyncMs = Date.now();
					pushedSuccessfully = true;
					break;
				}
			} catch {}
			if (pushedSuccessfully) notifySyncListeners(localState);
		} catch (err) {
			if (!pushedSuccessfully) {
				cloudConnected = false;
				syncLogger.log("firestore", "warn", "push_failed", { message: err?.message || "Network error" });
			}
		}
	};
	if (immediate) executePush();
	else pushTimeoutId = setTimeout(executePush, 250);
}
/**
* Verifies a password against both plaintext (`password`) and PBKDF2-SHA512 (`passwordHash` + `salt`)
* using standard Web Crypto API so accounts created on the web server work in the Android APK and vice versa.
*/
async function verifyPasswordUniversal(inputPassword, userRec) {
	const cleanPass = String(inputPassword);
	const trimmedPass = cleanPass.trim();
	if (userRec.password) {
		if (userRec.password === cleanPass || userRec.password === trimmedPass) return true;
	}
	if (userRec.passwordHash && userRec.salt && typeof crypto !== "undefined" && crypto.subtle) try {
		const enc = new TextEncoder();
		const key = await crypto.subtle.importKey("raw", enc.encode(cleanPass), { name: "PBKDF2" }, false, ["deriveBits"]);
		for (const iterations of [1e5, 1e4]) {
			const bits = await crypto.subtle.deriveBits({
				name: "PBKDF2",
				salt: enc.encode(userRec.salt),
				iterations,
				hash: "SHA-512"
			}, key, 512);
			if (Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("") === userRec.passwordHash) return true;
		}
	} catch {}
	return false;
}
// src/utils/localBackend.ts
var STORAGE_KEY = "beacon_local_db_v1";
var UNIVERSAL_ROOM_ID = "room-universal";
var UNIVERSAL_ROOM = {
	id: UNIVERSAL_ROOM_ID,
	name: "🌐 Universal Lounge",
	description: "The open global town square for everyone on Beacon. Coordinate live locations, chat across channels, and meet members worldwide.",
	iconUrl: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=128&q=80",
	ownerId: "system",
	hasPassword: false,
	createdAt: "2026-01-01T00:00:00.000Z",
	memberCount: 1,
	isPrivate: false,
	isUniversal: true
};
function generateId(prefix = "") {
	const rand = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	return prefix ? `${prefix}-${rand}` : rand;
}
function haversineDistMeters(lat1, lon1, lat2, lon2) {
	const R = 6371e3;
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLon = (lon2 - lon1) * Math.PI / 180;
	const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return Math.round(R * c);
}
var LocalBackendEngine = class {
	constructor() {
		this.data = this.load();
		this.ensureUniversalRoom();
		this.syncCachedAuthFromStorage();
		pullAndMergeCloudState(this.data, true).then((updated) => {
			if (updated) {
				this.ensureUniversalRoom();
				this.saveLocalOnly();
			}
		});
		if (typeof window !== "undefined") setInterval(() => {
			if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
			if (typeof navigator !== "undefined" && navigator.onLine === false) return;
			pullAndMergeCloudState(this.data).then((updated) => {
				if (updated) {
					this.ensureUniversalRoom();
					this.saveLocalOnly();
				}
			});
		}, 6e4);
	}
	async forceSyncNow() {
		this.syncCachedAuthFromStorage();
		const updated = await pullAndMergeCloudState(this.data, true);
		this.ensureUniversalRoom();
		this.saveLocalOnly();
		schedulePushCloudState(this.data, true);
		return updated;
	}
	getAllMessages() {
		return (this.data.messages || []).filter((m) => !m.isDeleted);
	}
	getActiveOnlineUserIds(currentUserId) {
		const now = Date.now();
		const onlineWindowMs = 3e5;
		const ids = /* @__PURE__ */ new Set();
		if (currentUserId) ids.add(currentUserId);
		for (const u of this.data.users) {
			if (!u?.id) continue;
			const lastSeenMs = new Date(u.lastSeen || 0).getTime() || 0;
			if (u.isOnline || now - lastSeenMs <= onlineWindowMs) ids.add(u.id);
		}
		for (const [uid, loc] of Object.entries(this.data.locations || {})) if (now - (new Date(loc?.updated_at || loc?.timestamp || 0).getTime() || 0) <= onlineWindowMs) ids.add(uid);
		return Array.from(ids);
	}
	getLiveLocationsSnapshot(currentUserId) {
		const out = [];
		for (const [uid, loc] of Object.entries(this.data.locations || {})) {
			if (!loc || !Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) continue;
			const acc = Number(loc.accuracy_m ?? loc.accuracy);
			if (!Number.isFinite(acc) || acc <= 0 || acc > 100) continue;
			const usr = this.data.users.find((u) => u.id === (loc.userId || uid));
			out.push({
				...loc,
				userId: loc.userId || uid,
				username: loc.username || usr?.username || "member",
				fullName: loc.fullName || usr?.fullName || "Member",
				avatarUrl: loc.avatarUrl || usr?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(loc.userId || uid)}`,
				markerColor: loc.markerColor || usr?.markerColor,
				markerIcon: loc.markerIcon || usr?.markerIcon,
				markerLabel: loc.markerLabel || usr?.markerLabel
			});
		}
		return out;
	}
	getActiveAlertsSnapshot() {
		return (this.data.emergencyAlerts || []).filter((a) => a && a.status === "active");
	}
	getUserRooms(userId) {
		const universal = this.ensureUniversalRoom(userId);
		const memberRoomIds = new Set(this.data.roomMembers.filter((m) => m.userId === userId).map((m) => m.roomId));
		const joined = this.data.rooms.filter((r) => r.id !== UNIVERSAL_ROOM_ID && (memberRoomIds.has(r.id) || r.ownerId === userId)).map((r) => this.sanitizeRoom(r));
		return [this.sanitizeRoom(universal), ...joined];
	}
	recordJoinedRoom(userId, roomId, role = "MEMBER") {
		if (!userId || !roomId) return;
		if (Array.isArray(this.data.deletedIds)) this.data.deletedIds = this.data.deletedIds.filter((id) => id !== `leave_${roomId}_${userId}`);
		if (!this.data.roomMembers.find((m) => m.roomId === roomId && m.userId === userId)) this.data.roomMembers.push({
			roomId,
			userId,
			role,
			joinedAt: (/* @__PURE__ */ new Date()).toISOString()
		});
		if (typeof localStorage !== "undefined") try {
			const key = `beacon_joined_rooms_v1_${userId}`;
			const list = JSON.parse(localStorage.getItem(key) || "[]");
			if (!list.includes(roomId)) {
				list.push(roomId);
				localStorage.setItem(key, JSON.stringify(list));
			}
		} catch {}
	}
	recordLeftRoom(userId, roomId) {
		if (!userId || !roomId || roomId === UNIVERSAL_ROOM_ID) return;
		this.data.roomMembers = this.data.roomMembers.filter((m) => !(m.roomId === roomId && m.userId === userId));
		if (!Array.isArray(this.data.deletedIds)) this.data.deletedIds = [];
		const leaveKey = `leave_${roomId}_${userId}`;
		if (!this.data.deletedIds.includes(leaveKey)) this.data.deletedIds.push(leaveKey);
		if (typeof localStorage !== "undefined") try {
			const key = `beacon_joined_rooms_v1_${userId}`;
			const filtered = JSON.parse(localStorage.getItem(key) || "[]").filter((id) => id !== roomId);
			localStorage.setItem(key, JSON.stringify(filtered));
		} catch {}
	}
	restorePersistedJoinedRooms(userId) {
		if (!userId || userId === "guest") return;
		const leaveSet = new Set(this.data.deletedIds || []);
		for (const r of this.data.rooms) if (r.ownerId === userId && !leaveSet.has(`leave_${r.id}_${userId}`)) {
			if (!this.data.roomMembers.some((m) => m.roomId === r.id && m.userId === userId)) this.data.roomMembers.push({
				roomId: r.id,
				userId,
				role: "OWNER",
				joinedAt: r.createdAt || (/* @__PURE__ */ new Date()).toISOString()
			});
		}
		if (typeof localStorage !== "undefined") try {
			const key = `beacon_joined_rooms_v1_${userId}`;
			const joinedIds = JSON.parse(localStorage.getItem(key) || "[]");
			for (const rId of joinedIds) {
				if (!rId || leaveSet.has(`leave_${rId}_${userId}`)) continue;
				if (!this.data.rooms.some((r) => r.id === rId)) continue;
				if (!this.data.roomMembers.some((m) => m.roomId === rId && m.userId === userId)) {
					const room = this.data.rooms.find((r) => r.id === rId);
					this.data.roomMembers.push({
						roomId: rId,
						userId,
						role: room?.ownerId === userId ? "OWNER" : "MEMBER",
						joinedAt: (/* @__PURE__ */ new Date()).toISOString()
					});
				}
			}
		} catch {}
	}
	ingestExternalMessage(msg, pushToCloud = false) {
		if (!msg || !msg.id) return;
		const idx = this.data.messages.findIndex((m) => m.id === msg.id);
		if (idx >= 0) this.data.messages[idx] = {
			...this.data.messages[idx],
			...msg
		};
		else this.data.messages.push(msg);
		if (pushToCloud) this.save(true);
		else this.saveLocalOnly();
	}
	ingestExternalLocation(loc, pushToCloud = false) {
		if (!loc || !loc.userId) return;
		this.data.locations[loc.userId] = loc;
		if (pushToCloud) this.save(true);
		else this.saveLocalOnly();
	}
	ingestExternalRoom(room, token, isMutation = false) {
		if (!room || !room.id) return;
		const idx = this.data.rooms.findIndex((r) => r.id === room.id);
		if (idx >= 0) this.data.rooms[idx] = {
			...this.data.rooms[idx],
			...room
		};
		else this.data.rooms.push({ ...room });
		const leaveSet = new Set(this.data.deletedIds || []);
		if (Array.isArray(room.members)) for (const mem of room.members) {
			if (!mem || !mem.userId) continue;
			if (room.id !== UNIVERSAL_ROOM_ID && leaveSet.has(`leave_${room.id}_${mem.userId}`)) continue;
			if (!this.data.roomMembers.some((m) => m.roomId === room.id && m.userId === mem.userId)) this.data.roomMembers.push({
				roomId: room.id,
				userId: mem.userId,
				role: mem.role || "MEMBER",
				joinedAt: mem.joinedAt || (/* @__PURE__ */ new Date()).toISOString()
			});
		}
		const currentUser = this.getAuthenticatedUser(token || null);
		if (currentUser && isMutation) {
			this.recordJoinedRoom(currentUser.id, room.id, room.ownerId === currentUser.id ? "OWNER" : "MEMBER");
			this.save(true);
		} else this.saveLocalOnly();
	}
	ingestExternalRooms(rooms, token) {
		if (!Array.isArray(rooms)) return;
		const currentUser = this.getAuthenticatedUser(token || null);
		for (const r of rooms) {
			if (!r || !r.id) continue;
			this.ingestExternalRoom(r, token, false);
			if (currentUser) this.recordJoinedRoom(currentUser.id, r.id, r.ownerId === currentUser.id ? "OWNER" : "MEMBER");
		}
		this.saveLocalOnly();
	}
	getInitialSchema() {
		return {
			users: INITIAL_SEED_USERS.map((u) => ({ ...u })),
			sessions: [],
			rooms: [{ ...UNIVERSAL_ROOM }, ...INITIAL_SEED_ROOMS.map((r) => ({ ...r }))],
			roomMembers: INITIAL_SEED_ROOM_MEMBERS.map((m) => ({ ...m })),
			locations: {},
			savedPlaces: [],
			messages: [],
			reminders: [],
			meetings: [],
			emergencyAlerts: [],
			locationShareRequests: [],
			reports: [],
			auditLogs: [],
			passwordResets: [],
			locationHistory: [],
			deletedIds: []
		};
	}
	load() {
		const base = this.getInitialSchema();
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				mergeDatabaseStates(base, JSON.parse(raw), true);
				return base;
			}
		} catch (e) {
			console.warn("Failed to load local DB, initializing clean store:", e);
		}
		return base;
	}
	saveLocalOnly() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
		} catch (e) {
			console.warn("Failed to persist local DB:", e);
		}
	}
	save(immediateCloudPush = false) {
		this.saveLocalOnly();
		schedulePushCloudState(this.data, immediateCloudPush);
	}
	syncCachedAuthFromStorage() {
		try {
			const savedUserRaw = localStorage.getItem("beacon_user_profile");
			const savedToken = localStorage.getItem("beacon_token");
			if (savedUserRaw) {
				const savedUser = JSON.parse(savedUserRaw);
				if (savedUser && savedUser.id) this.syncUserSession(savedUser, savedToken || void 0);
			}
		} catch {}
	}
	syncUserSession(user, token) {
		if (!user || !user.id) return;
		const existingIdx = this.data.users.findIndex((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
		if (existingIdx >= 0) this.data.users[existingIdx] = {
			...this.data.users[existingIdx],
			...user
		};
		else this.data.users.push({
			...user,
			password: "password123"
		});
		const effectiveUserId = existingIdx >= 0 ? this.data.users[existingIdx].id : user.id;
		this.ensureUniversalRoom(effectiveUserId);
		if (token) {
			if (!this.data.sessions.some((s) => s.token === token)) {
				const now = (/* @__PURE__ */ new Date()).toISOString();
				const expiresAt = new Date(Date.now() + 31536e6).toISOString();
				this.data.sessions.push({
					token,
					userId: effectiveUserId,
					createdAt: now,
					expiresAt,
					userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Mobile Client",
					ip: "Device Local"
				});
			}
		}
		this.save();
	}
	sanitizeUser(u) {
		const { password, passwordHash, salt, ...safe } = u;
		return safe;
	}
	ensureUniversalRoom(userId) {
		let room = this.data.rooms.find((r) => r.id === UNIVERSAL_ROOM_ID);
		if (!room) {
			room = { ...UNIVERSAL_ROOM };
			this.data.rooms.unshift(room);
		} else {
			room.isUniversal = true;
			room.hasPassword = false;
			room.isPrivate = false;
		}
		for (const u of this.data.users) if (!this.data.roomMembers.some((m) => m.roomId === UNIVERSAL_ROOM_ID && m.userId === u.id)) this.data.roomMembers.push({
			roomId: UNIVERSAL_ROOM_ID,
			userId: u.id,
			role: u.isAdmin ? "ADMIN" : "MEMBER",
			joinedAt: u.createdAt || (/* @__PURE__ */ new Date()).toISOString()
		});
		if (userId) {
			if (!this.data.roomMembers.some((m) => m.roomId === UNIVERSAL_ROOM_ID && m.userId === userId)) this.data.roomMembers.push({
				roomId: UNIVERSAL_ROOM_ID,
				userId,
				role: "MEMBER",
				joinedAt: (/* @__PURE__ */ new Date()).toISOString()
			});
		}
		const universalMembers = this.data.roomMembers.filter((m) => m.roomId === UNIVERSAL_ROOM_ID);
		room.memberCount = Math.max(1, universalMembers.length, this.data.users.length);
		return room;
	}
	getRoomMembers(roomId) {
		return this.data.roomMembers.filter((m) => m.roomId === roomId).map((m) => {
			const u = this.data.users.find((usr) => usr.id === m.userId);
			const safeUser = u ? this.sanitizeUser(u) : {
				id: m.userId,
				email: "",
				username: "Member",
				fullName: "Community Member",
				avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.userId)}`,
				about: "Member of Beacon Community",
				phoneNumber: "",
				createdAt: (/* @__PURE__ */ new Date()).toISOString(),
				isOnline: true,
				lastSeen: (/* @__PURE__ */ new Date()).toISOString(),
				privacy: {
					locationVisibility: "room_members",
					phoneVisibility: "room_members",
					profileVisibility: "public",
					showOnlineStatus: true
				}
			};
			return {
				userId: m.userId,
				roomId: m.roomId,
				role: m.role,
				joinedAt: m.joinedAt,
				user: safeUser
			};
		});
	}
	sanitizeRoom(r) {
		const { password, ...safe } = r;
		const members = this.getRoomMembers(r.id);
		return {
			...safe,
			members,
			memberCount: Math.max(1, members.length)
		};
	}
	getAuthenticatedUser(token) {
		this.syncCachedAuthFromStorage();
		if (token) {
			const session = this.data.sessions.find((s) => s.token === token);
			if (session) {
				const found = this.data.users.find((u) => u.id === session.userId);
				if (found) return found;
			}
		}
		try {
			const savedUserRaw = localStorage.getItem("beacon_user_profile");
			if (savedUserRaw) {
				const parsed = JSON.parse(savedUserRaw);
				const found = this.data.users.find((u) => u.id === parsed.id || u.email && parsed.email && u.email.toLowerCase() === parsed.email.toLowerCase() || u.username && parsed.username && u.username.toLowerCase() === parsed.username.toLowerCase());
				if (found) return found;
			}
		} catch {}
		return null;
	}
	createSession(userId) {
		const token = generateId("tok") + generateId();
		const createdAt = (/* @__PURE__ */ new Date()).toISOString();
		const expiresAt = new Date(Date.now() + 31536e6).toISOString();
		this.data.sessions.push({
			token,
			userId,
			createdAt,
			expiresAt,
			userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Mobile / Web Client",
			ip: "Local Device"
		});
		this.save();
		return token;
	}
	createError(message, status = 400, extra = {}) {
		const err = new Error(message);
		err.status = status;
		Object.assign(err, extra);
		return err;
	}
	async handleRequest(endpoint, options = {}, token) {
		const method = (options.method || "GET").toUpperCase();
		const urlObj = new URL(endpoint, "http://localhost");
		const pathname = urlObj.pathname;
		const query = urlObj.searchParams;
		let body = {};
		if (options.body && typeof options.body === "string") try {
			body = JSON.parse(options.body);
		} catch {
			body = {};
		}
		if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/rooms") || pathname.startsWith("/api/locations/live") || pathname.startsWith("/api/saved-places") || pathname.startsWith("/api/reminders") || pathname.startsWith("/api/meetings") || pathname.startsWith("/api/alerts") || pathname.startsWith("/api/messages") || pathname.startsWith("/api/direct-messages") || pathname.startsWith("/api/users") || pathname.startsWith("/api/admin")) {
			const forceSync = method !== "GET" || pathname === "/api/auth/login" || pathname === "/api/auth/register" || pathname === "/api/auth/quick-reset";
			if (await pullAndMergeCloudState(this.data, forceSync)) {
				this.ensureUniversalRoom();
				this.saveLocalOnly();
			}
		}
		if (method === "GET" && pathname === "/api/health") {
			if (await pullAndMergeCloudState(this.data, true)) {
				this.ensureUniversalRoom();
				this.saveLocalOnly();
			}
			return {
				ok: true,
				service: "Beacon Cloud Firestore Production Bridge",
				timestamp: (/* @__PURE__ */ new Date()).toISOString()
			};
		}
		if (method === "POST" && pathname === "/api/auth/register") {
			const { email, username, fullName, password, phoneNumber, avatarUrl } = body;
			if (!email || !username || !fullName || !password) throw this.createError("Missing required registration fields", 400);
			if (String(password).length < 6) throw this.createError("Password must be at least 6 characters long", 400);
			const cleanEmail = String(email).trim().toLowerCase();
			const cleanUsername = String(username).trim();
			const existingEmail = this.data.users.find((u) => u.email.toLowerCase() === cleanEmail);
			if (existingEmail) {
				existingEmail.fullName = String(fullName).trim() || existingEmail.fullName;
				existingEmail.username = cleanUsername || existingEmail.username;
				existingEmail.password = String(password);
				if (phoneNumber) existingEmail.phoneNumber = String(phoneNumber).trim();
				existingEmail.isOnline = true;
				existingEmail.lastSeen = (/* @__PURE__ */ new Date()).toISOString();
				this.ensureUniversalRoom(existingEmail.id);
				const sessionToken = this.createSession(existingEmail.id);
				this.save(true);
				return {
					user: this.sanitizeUser(existingEmail),
					token: sessionToken
				};
			}
			if (this.data.users.find((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) throw this.createError(`The username "${cleanUsername}" is already taken. Please choose another username.`, 400, {
				code: "USERNAME_TAKEN",
				username: cleanUsername
			});
			const userId = generateId("usr");
			const isFirstUser = this.data.users.length === 0;
			const newUser = {
				id: userId,
				email: cleanEmail,
				username: cleanUsername,
				fullName: String(fullName).trim(),
				avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(String(fullName).trim())}`,
				about: "Member of Beacon Community",
				phoneNumber: phoneNumber ? String(phoneNumber).trim() : "",
				createdAt: (/* @__PURE__ */ new Date()).toISOString(),
				isOnline: true,
				lastSeen: (/* @__PURE__ */ new Date()).toISOString(),
				privacy: {
					locationVisibility: "room_members",
					phoneVisibility: "room_members",
					profileVisibility: "public",
					showOnlineStatus: true,
					locationSharingEnabled: true,
					temporarySharingExpiry: null,
					blockedUserIds: []
				},
				isAdmin: isFirstUser,
				password: String(password)
			};
			this.data.users.push(newUser);
			this.ensureUniversalRoom(newUser.id);
			const sessionToken = this.createSession(newUser.id);
			this.save(true);
			return {
				user: this.sanitizeUser(newUser),
				token: sessionToken
			};
		}
		if (method === "POST" && pathname === "/api/auth/login") {
			const { identifier, password } = body;
			if (!identifier || !password) throw this.createError("Username/email and password required", 400);
			const cleanId = String(identifier).trim();
			const lower = cleanId.toLowerCase();
			const userRec = this.data.users.find((u) => u.email.toLowerCase() === lower || u.username.toLowerCase() === lower);
			if (!userRec) throw this.createError(`No account found for "${cleanId}". Please check for typos or click Create Account.`, 404, {
				code: "USER_NOT_FOUND",
				suggestion: "register",
				identifier: cleanId
			});
			if (!await verifyPasswordUniversal(String(password), userRec)) throw this.createError(`Incorrect password for ${userRec.email}. Tap "Reset Password" to set a new password.`, 401, {
				code: "INVALID_PASSWORD",
				suggestion: "reset",
				email: userRec.email,
				username: userRec.username
			});
			userRec.password = String(password);
			userRec.isOnline = true;
			userRec.lastSeen = (/* @__PURE__ */ new Date()).toISOString();
			this.ensureUniversalRoom(userRec.id);
			const sessionToken = this.createSession(userRec.id);
			this.save(true);
			return {
				user: this.sanitizeUser(userRec),
				token: sessionToken
			};
		}
		if (method === "POST" && pathname === "/api/auth/quick-reset") {
			const { identifier, newPassword } = body;
			if (!identifier || !newPassword) throw this.createError("Username or email and new password required", 400);
			if (String(newPassword).length < 6) throw this.createError("Password must be at least 6 characters long", 400);
			const cleanId = String(identifier).trim();
			const lower = cleanId.toLowerCase();
			let userRec = this.data.users.find((u) => u.email.toLowerCase() === lower || u.username.toLowerCase() === lower);
			if (!userRec) {
				const isEmail = cleanId.includes("@");
				const derivedUsername = isEmail ? cleanId.split("@")[0] : cleanId;
				const derivedEmail = isEmail ? lower : `${lower}@beacon.local`;
				userRec = {
					id: generateId("usr"),
					email: derivedEmail,
					username: derivedUsername,
					fullName: derivedUsername,
					avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(derivedUsername)}`,
					about: "Member of Beacon Community",
					phoneNumber: "",
					createdAt: (/* @__PURE__ */ new Date()).toISOString(),
					isOnline: true,
					lastSeen: (/* @__PURE__ */ new Date()).toISOString(),
					privacy: {
						locationVisibility: "room_members",
						phoneVisibility: "room_members",
						profileVisibility: "public",
						showOnlineStatus: true,
						locationSharingEnabled: true,
						temporarySharingExpiry: null,
						blockedUserIds: []
					},
					isAdmin: this.data.users.length === 0,
					password: String(newPassword)
				};
				this.data.users.push(userRec);
			} else userRec.password = String(newPassword);
			this.ensureUniversalRoom(userRec.id);
			const sessionToken = this.createSession(userRec.id);
			this.save();
			return {
				success: true,
				message: "Password updated successfully! Logged in.",
				user: this.sanitizeUser(userRec),
				token: sessionToken
			};
		}
		if (method === "POST" && pathname === "/api/auth/demo-login") {
			let targetUser = this.data.users[0];
			if (!targetUser) {
				targetUser = {
					id: generateId("usr"),
					email: "demo@beacon.network",
					username: "alex_beacon",
					fullName: "Alex Morgan",
					avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=Alex%20Morgan",
					about: "Beacon Explorer & Mesh Coordinator",
					phoneNumber: "+1 555-0199",
					createdAt: (/* @__PURE__ */ new Date()).toISOString(),
					isOnline: true,
					lastSeen: (/* @__PURE__ */ new Date()).toISOString(),
					privacy: {
						locationVisibility: "room_members",
						phoneVisibility: "room_members",
						profileVisibility: "public",
						showOnlineStatus: true,
						locationSharingEnabled: true,
						temporarySharingExpiry: null,
						blockedUserIds: []
					},
					isAdmin: true,
					password: "password123"
				};
				this.data.users.push(targetUser);
			}
			this.ensureUniversalRoom(targetUser.id);
			const sessionToken = this.createSession(targetUser.id);
			this.save();
			return {
				user: this.sanitizeUser(targetUser),
				token: sessionToken
			};
		}
		if (method === "GET" && pathname === "/api/auth/me") {
			const user = this.getAuthenticatedUser(token);
			if (!user) throw this.createError("Invalid or expired session", 401);
			return { user: this.sanitizeUser(user) };
		}
		if (method === "POST" && pathname === "/api/auth/logout") {
			if (token) {
				this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
				this.save();
			}
			return { success: true };
		}
		if (method === "POST" && pathname === "/api/auth/password-reset/request") {
			const cleanEmail = String(body.email || "").trim();
			const code = Math.floor(1e5 + Math.random() * 9e5).toString();
			this.data.passwordResets = this.data.passwordResets.filter((r) => r.email.toLowerCase() !== cleanEmail.toLowerCase());
			this.data.passwordResets.push({
				email: cleanEmail,
				token: code,
				expiresAt: new Date(Date.now() + 36e5).toISOString()
			});
			this.save();
			return {
				success: true,
				message: "Verification code generated.",
				code,
				email: cleanEmail
			};
		}
		if (method === "POST" && pathname === "/api/auth/password-reset/confirm") {
			const { token: resetToken, newPassword } = body;
			const rec = this.data.passwordResets.find((r) => r.token === String(resetToken).trim());
			const userRec = rec ? this.data.users.find((u) => u.email.toLowerCase() === rec.email.toLowerCase()) : this.data.users[0];
			if (!userRec) throw this.createError("User not found", 404);
			userRec.password = String(newPassword);
			this.save();
			return {
				success: true,
				user: this.sanitizeUser(userRec)
			};
		}
		const currentUser = this.getAuthenticatedUser(token);
		if (method === "GET" && pathname === "/api/auth/sessions") {
			if (!currentUser) return { sessions: [] };
			const sessions = this.data.sessions.filter((s) => s.userId === currentUser.id).map((s) => ({
				token: s.token.slice(0, 8) + "...",
				fullToken: s.token === token ? s.token : void 0,
				userId: s.userId,
				createdAt: s.createdAt,
				expiresAt: s.expiresAt,
				userAgent: s.userAgent || "Mobile / Web Client",
				ip: s.ip || "Local Device",
				isCurrent: s.token === token
			}));
			if (sessions.length === 0) sessions.push({
				token: (token || "active00").slice(0, 8) + "...",
				fullToken: token || void 0,
				userId: currentUser.id,
				createdAt: (/* @__PURE__ */ new Date()).toISOString(),
				expiresAt: new Date(Date.now() + 31536e6).toISOString(),
				userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Mobile Client",
				ip: "Local Device",
				isCurrent: true
			});
			return { sessions };
		}
		if (method === "POST" && pathname === "/api/auth/sessions/revoke") {
			if (currentUser && body.sessionToken) {
				const prefix = String(body.sessionToken).replace("...", "");
				this.data.sessions = this.data.sessions.filter((s) => !(s.userId === currentUser.id && s.token.startsWith(prefix)));
				this.save();
			}
			return { success: true };
		}
		if (method === "POST" && pathname === "/api/auth/sessions/revoke-others") {
			let revokedCount = 0;
			if (currentUser) {
				const before = this.data.sessions.length;
				this.data.sessions = this.data.sessions.filter((s) => s.userId !== currentUser.id || s.token === token);
				revokedCount = before - this.data.sessions.length;
				this.save();
			}
			return {
				success: true,
				revokedCount
			};
		}
		if (method === "PUT" && pathname === "/api/profile/update") {
			if (!currentUser) throw this.createError("Unauthorized", 401);
			if (body.fullName !== void 0) currentUser.fullName = body.fullName;
			if (body.about !== void 0) currentUser.about = body.about;
			if (body.phoneNumber !== void 0) currentUser.phoneNumber = body.phoneNumber;
			if (body.avatarUrl !== void 0) currentUser.avatarUrl = body.avatarUrl;
			if (body.markerColor !== void 0) currentUser.markerColor = body.markerColor;
			if (body.markerIcon !== void 0) currentUser.markerIcon = body.markerIcon;
			if (body.markerLabel !== void 0) currentUser.markerLabel = body.markerLabel;
			if (body.privacy !== void 0) currentUser.privacy = {
				...currentUser.privacy,
				...body.privacy
			};
			currentUser.lastSeen = (/* @__PURE__ */ new Date()).toISOString();
			this.save(true);
			return { user: this.sanitizeUser(currentUser) };
		}
		if (method === "PUT" && pathname === "/api/privacy/update") {
			if (!currentUser) throw this.createError("Unauthorized", 401);
			currentUser.privacy = {
				...currentUser.privacy,
				...body
			};
			currentUser.lastSeen = (/* @__PURE__ */ new Date()).toISOString();
			this.save(true);
			return { user: this.sanitizeUser(currentUser) };
		}
		if (method === "POST" && pathname === "/api/upload") {
			const { dataUrl, filename } = body;
			if (!dataUrl) throw this.createError("Missing dataUrl payload", 400);
			return {
				url: dataUrl,
				name: filename || `upload-${Date.now()}`,
				size: String(dataUrl).length
			};
		}
		if (method === "GET" && pathname === "/api/rooms") {
			const uid = currentUser?.id || "guest";
			this.ensureUniversalRoom(uid);
			this.restorePersistedJoinedRooms(uid);
			const leaveSet = new Set(this.data.deletedIds || []);
			const memberships = this.data.roomMembers.filter((m) => m.userId === uid && (m.roomId === UNIVERSAL_ROOM_ID || !leaveSet.has(`leave_${m.roomId}_${uid}`)));
			const roomIds = new Set(memberships.map((m) => m.roomId));
			roomIds.add(UNIVERSAL_ROOM_ID);
			if (uid !== "guest") for (const rId of roomIds) this.recordJoinedRoom(uid, rId);
			return { rooms: this.data.rooms.filter((r) => roomIds.has(r.id) || r.id === UNIVERSAL_ROOM_ID).map((r) => this.sanitizeRoom(r)).sort((a, b) => {
				if (a.id === UNIVERSAL_ROOM_ID) return -1;
				if (b.id === UNIVERSAL_ROOM_ID) return 1;
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			}) };
		}
		if (method === "POST" && pathname === "/api/rooms") {
			if (!currentUser) throw this.createError("Unauthorized", 401);
			const { name, description, password, iconUrl, isPrivate } = body;
			if (!name || !String(name).trim()) throw this.createError("Room name is required", 400);
			const cleanName = String(name).trim();
			let baseId = cleanName.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
			if (!baseId) baseId = "room";
			let roomId = baseId;
			let counter = 1;
			while (this.data.rooms.some((r) => r.id.toLowerCase() === roomId.toLowerCase())) {
				roomId = `${baseId}-${counter}`;
				counter++;
			}
			const newRoom = {
				id: roomId,
				name: cleanName,
				description: String(description || "").trim(),
				iconUrl,
				ownerId: currentUser.id,
				hasPassword: Boolean(password && String(password).trim()),
				password: password ? String(password).trim() : void 0,
				createdAt: (/* @__PURE__ */ new Date()).toISOString(),
				memberCount: 1,
				isPrivate: isPrivate ?? true
			};
			this.data.rooms.push(newRoom);
			this.recordJoinedRoom(currentUser.id, roomId, "OWNER");
			this.save(true);
			return { room: this.sanitizeRoom(newRoom) };
		}
		if (method === "POST" && pathname === "/api/rooms/join") {
			if (!currentUser) throw this.createError("Unauthorized", 401);
			const { roomId, password } = body;
			if (!roomId) throw this.createError("Room ID is required", 400);
			const cleanTarget = String(roomId).trim().toLowerCase();
			let room = this.data.rooms.find((r) => r.id === roomId || r.id.toLowerCase() === cleanTarget || r.name.toLowerCase() === cleanTarget);
			if (!room) throw this.createError("Room not found. Check the Room ID or Name.", 400);
			if (room.hasPassword && room.password && room.password !== String(password || "").trim()) throw this.createError("Incorrect room password", 400);
			this.recordJoinedRoom(currentUser.id, room.id, room.ownerId === currentUser.id ? "OWNER" : "MEMBER");
			room.memberCount = this.data.roomMembers.filter((m) => m.roomId === room.id).length;
			this.save(true);
			return { room: this.sanitizeRoom(room) };
		}
		const roomDetailMatch = pathname.match(/^\/api\/rooms\/([^/]+)$/);
		if (method === "GET" && roomDetailMatch) {
			const roomId = decodeURIComponent(roomDetailMatch[1]);
			if (roomId === UNIVERSAL_ROOM_ID) this.ensureUniversalRoom(currentUser?.id);
			else if (currentUser) this.restorePersistedJoinedRooms(currentUser.id);
			const room = this.data.rooms.find((r) => r.id === roomId || r.id.toLowerCase() === roomId.toLowerCase());
			if (!room) throw this.createError("Room not found", 404);
			return { room: this.sanitizeRoom(room) };
		}
		const roomLeaveMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/leave$/);
		if (method === "POST" && roomLeaveMatch) {
			const roomId = decodeURIComponent(roomLeaveMatch[1]);
			if (currentUser) {
				this.recordLeftRoom(currentUser.id, roomId);
				this.save(true);
			}
			return { success: true };
		}
		const roomRolesMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/roles$/);
		if (method === "POST" && roomRolesMatch) {
			const roomId = decodeURIComponent(roomRolesMatch[1]);
			const { targetUserId, newRole } = body;
			const mem = this.data.roomMembers.find((m) => m.roomId === roomId && m.userId === targetUserId);
			if (mem) {
				mem.role = newRole;
				this.save(true);
			}
			return { success: true };
		}
		const roomKickMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/kick$/);
		if (method === "POST" && roomKickMatch) {
			const roomId = decodeURIComponent(roomKickMatch[1]);
			const { targetUserId } = body;
			this.recordLeftRoom(targetUserId, roomId);
			this.save(true);
			return { success: true };
		}
		const roomMsgsMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/messages$/);
		if (roomMsgsMatch) {
			const roomId = decodeURIComponent(roomMsgsMatch[1]);
			if (method === "GET") {
				const limit = Number(query.get("limit")) || 50;
				return { messages: this.data.messages.filter((m) => m.roomId === roomId && !m.isDeleted).slice(-limit) };
			}
			if (method === "DELETE") {
				this.data.messages = this.data.messages.filter((m) => m.roomId !== roomId);
				this.save();
				return { success: true };
			}
		}
		if (method === "POST" && pathname === "/api/messages/create") {
			if (!currentUser) throw this.createError("Unauthorized", 401);
			const { roomId, channelId, recipientId, text, attachments, replyToId, clientMsgId } = body;
			let replyToText;
			let replyToSender;
			if (replyToId) {
				const orig = this.data.messages.find((m) => m.id === replyToId);
				if (orig) {
					replyToText = orig.text.slice(0, 100);
					replyToSender = orig.senderName;
				}
			}
			const message = {
				id: generateId("msg"),
				roomId,
				channelId,
				recipientId,
				senderId: currentUser.id,
				senderName: currentUser.fullName,
				senderAvatar: currentUser.avatarUrl,
				text: String(text || "").trim(),
				attachments: attachments || [],
				replyToId,
				replyToText,
				replyToSender,
				reactions: {},
				createdAt: (/* @__PURE__ */ new Date()).toISOString(),
				isEdited: false,
				isDeleted: false,
				clientMsgId
			};
			this.data.messages.push(message);
			this.save(true);
			return { message };
		}
		const msgReactMatch = pathname.match(/^\/api\/messages\/([^/]+)\/react$/);
		if (method === "POST" && msgReactMatch) {
			if (!currentUser) throw this.createError("Unauthorized", 401);
			const messageId = decodeURIComponent(msgReactMatch[1]);
			const { emoji } = body;
			const msg = this.data.messages.find((m) => m.id === messageId);
			if (!msg) throw this.createError("Message not found", 404);
			if (!msg.reactions) msg.reactions = {};
			if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
			const idx = msg.reactions[emoji].indexOf(currentUser.id);
			if (idx >= 0) {
				msg.reactions[emoji].splice(idx, 1);
				if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
			} else msg.reactions[emoji].push(currentUser.id);
			msg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
			this.save(true);
			return { message: msg };
		}
		const msgEditMatch = pathname.match(/^\/api\/messages\/([^/]+)\/edit$/);
		if (method === "PUT" && msgEditMatch) {
			const messageId = decodeURIComponent(msgEditMatch[1]);
			const msg = this.data.messages.find((m) => m.id === messageId);
			if (!msg) throw this.createError("Message not found", 404);
			msg.text = String(body.text || "").trim();
			msg.isEdited = true;
			msg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
			this.save(true);
			return { message: msg };
		}
		const msgDeleteMatch = pathname.match(/^\/api\/messages\/([^/]+)$/);
		if (method === "DELETE" && msgDeleteMatch) {
			const messageId = decodeURIComponent(msgDeleteMatch[1]);
			const msg = this.data.messages.find((m) => m.id === messageId);
			if (msg) {
				msg.isDeleted = true;
				msg.text = "[Message deleted]";
				msg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
				this.save(true);
			}
			return { success: true };
		}
		if (method === "GET" && pathname === "/api/direct-messages/threads/all") {
			if (!currentUser) return { threads: [] };
			const directMsgs = this.data.messages.filter((m) => !m.roomId && !m.isDeleted && (m.senderId === currentUser.id || m.recipientId === currentUser.id));
			const partnerIds = /* @__PURE__ */ new Set();
			for (const m of directMsgs) {
				if (m.senderId === currentUser.id && m.recipientId) partnerIds.add(m.recipientId);
				if (m.recipientId === currentUser.id) partnerIds.add(m.senderId);
			}
			const threads = [];
			for (const pid of partnerIds) {
				const partner = this.data.users.find((u) => u.id === pid);
				if (partner) {
					const lastMessage = directMsgs.filter((m) => m.senderId === currentUser.id && m.recipientId === pid || m.senderId === pid && m.recipientId === currentUser.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
					threads.push({
						user: this.sanitizeUser(partner),
						lastMessage
					});
				}
			}
			return { threads };
		}
		const dmUserMatch = pathname.match(/^\/api\/direct-messages\/([^/]+)$/);
		if (dmUserMatch) {
			const partnerId = decodeURIComponent(dmUserMatch[1]);
			if (method === "GET") {
				const uid = currentUser?.id || "";
				const messages = this.data.messages.filter((m) => !m.roomId && !m.isDeleted && (m.senderId === uid && m.recipientId === partnerId || m.senderId === partnerId && m.recipientId === uid));
				const partner = this.data.users.find((u) => u.id === partnerId);
				return {
					messages,
					partner: partner ? this.sanitizeUser(partner) : null
				};
			}
			if (method === "DELETE") {
				const uid = currentUser?.id || "";
				this.data.messages = this.data.messages.filter((m) => m.roomId || !(m.senderId === uid && m.recipientId === partnerId || m.senderId === partnerId && m.recipientId === uid));
				this.save();
				return { success: true };
			}
		}
		if (method === "GET" && pathname === "/api/users/blocked") {
			if (!currentUser || !currentUser.privacy.blockedUserIds) return { blockedUsers: [] };
			return { blockedUsers: currentUser.privacy.blockedUserIds.map((id) => this.data.users.find((u) => u.id === id)).filter((u) => Boolean(u)).map((u) => this.sanitizeUser(u)) };
		}
		const blockMatch = pathname.match(/^\/api\/users\/([^/]+)\/block$/);
		if (method === "POST" && blockMatch) {
			const targetId = decodeURIComponent(blockMatch[1]);
			if (currentUser) {
				if (!currentUser.privacy.blockedUserIds) currentUser.privacy.blockedUserIds = [];
				if (!currentUser.privacy.blockedUserIds.includes(targetId)) {
					currentUser.privacy.blockedUserIds.push(targetId);
					this.save();
				}
			}
			return {
				success: true,
				message: "User blocked"
			};
		}
		const unblockMatch = pathname.match(/^\/api\/users\/([^/]+)\/unblock$/);
		if (method === "POST" && unblockMatch) {
			const targetId = decodeURIComponent(unblockMatch[1]);
			if (currentUser && currentUser.privacy.blockedUserIds) {
				currentUser.privacy.blockedUserIds = currentUser.privacy.blockedUserIds.filter((id) => id !== targetId);
				this.save();
			}
			return {
				success: true,
				message: "User unblocked"
			};
		}
		if (method === "DELETE" && pathname === "/api/locations/history") {
			if (!currentUser) return {
				success: true,
				removedCount: 0,
				message: "Cleared"
			};
			const before = this.data.locationHistory.length;
			this.data.locationHistory = this.data.locationHistory.filter((h) => h.userId !== currentUser.id);
			const removedCount = before - this.data.locationHistory.length;
			this.save();
			return {
				success: true,
				removedCount,
				message: "Location breadcrumbs successfully cleared."
			};
		}
		if (method === "POST" && pathname === "/api/locations/update") {
			if (!currentUser) throw this.createError("Unauthorized", 401);
			let parsedLat = Number(body.latitude);
			let parsedLng = Number(body.longitude);
			if (typeof body.geog === "string") {
				const m = body.geog.match(/POINT\s*\(\s*([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s*\)/i);
				if (m) {
					parsedLng = Number(m[1]);
					parsedLat = Number(m[2]);
				}
			}
			const parsedAcc = Number(body.accuracy_m ?? body.accuracy);
			if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) throw this.createError("Invalid latitude", 400);
			if (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180) throw this.createError("Invalid longitude", 400);
			if (!Number.isFinite(parsedAcc) || parsedAcc <= 0 || parsedAcc > 100) throw this.createError("Rejected coarse location fix: accuracy_m must be <= 100m", 400);
			const serverNowIso = (/* @__PURE__ */ new Date()).toISOString();
			const loc = {
				userId: currentUser.id,
				username: currentUser.username,
				fullName: currentUser.fullName,
				avatarUrl: currentUser.avatarUrl,
				markerColor: currentUser.markerColor,
				markerIcon: currentUser.markerIcon,
				markerLabel: currentUser.markerLabel,
				latitude: parsedLat,
				longitude: parsedLng,
				accuracy: parsedAcc,
				lat: parsedLat,
				lng: parsedLng,
				accuracy_m: parsedAcc,
				geog: `SRID=4326;POINT(${parsedLng} ${parsedLat})`,
				updated_at: serverNowIso,
				altitude: body.altitude != null ? Number(body.altitude) : null,
				heading: body.heading != null ? Number(body.heading) : null,
				speed: body.speed != null ? Number(body.speed) : null,
				batteryLevel: body.batteryLevel != null ? Number(body.batteryLevel) : null,
				timestamp: serverNowIso,
				isStale: false
			};
			this.data.locations[currentUser.id] = loc;
			currentUser.isOnline = true;
			currentUser.lastSeen = serverNowIso;
			this.data.locationHistory.push({
				id: generateId("loc"),
				userId: currentUser.id,
				latitude: loc.latitude,
				longitude: loc.longitude,
				accuracy: loc.accuracy,
				altitude: loc.altitude,
				heading: loc.heading,
				speed: loc.speed,
				timestamp: loc.timestamp
			});
			this.save(true);
			return { location: loc };
		}
		if (method === "GET" && pathname === "/api/locations/live") {
			const nowMs = Date.now();
			const twoMinutesMs = 12e4;
			return { locations: Object.values(this.data.locations).filter((l) => Number.isFinite(l.accuracy) && l.accuracy <= 100 && (l.userId !== currentUser?.id || nowMs - new Date(l.timestamp).getTime() <= twoMinutesMs)).map((l) => ({
				...l,
				lat: l.latitude,
				lng: l.longitude,
				accuracy_m: l.accuracy,
				geog: `SRID=4326;POINT(${l.longitude} ${l.latitude})`,
				updated_at: l.timestamp,
				isStale: nowMs - new Date(l.timestamp).getTime() >= twoMinutesMs
			})) };
		}
		const trailMatch = pathname.match(/^\/api\/locations\/trail\/([^/]+)$/);
		if (method === "GET" && trailMatch) {
			const targetUserId = decodeURIComponent(trailMatch[1]);
			const windowHours = Number(query.get("windowHours")) || 1;
			const targetUser = this.data.users.find((u) => u.id === targetUserId) || currentUser;
			const now = Date.now();
			const windowMs = Math.max(.25, Math.min(24, windowHours)) * 36e5;
			const points = this.data.locationHistory.filter((p) => p.userId === targetUserId && new Date(p.timestamp).getTime() >= now - windowMs).map((p) => ({
				latitude: p.latitude,
				longitude: p.longitude,
				accuracy: p.accuracy,
				speed: p.speed,
				heading: p.heading,
				altitude: p.altitude,
				timestamp: p.timestamp
			}));
			return { trail: {
				userId: targetUserId,
				fullName: targetUser?.fullName || "User",
				avatarUrl: targetUser?.avatarUrl || "",
				points,
				totalDistanceMeters: 0,
				startTime: points[0]?.timestamp || new Date(now - windowMs).toISOString(),
				endTime: points[points.length - 1]?.timestamp || (/* @__PURE__ */ new Date()).toISOString()
			} };
		}
		if (method === "GET" && pathname === "/api/locations/search") {
			const q = (query.get("q") || "").trim();
			if (!q || q.length < 2) return { results: [] };
			const latRaw = query.get("lat");
			const lonRaw = query.get("lon");
			return { results: await searchRealPlacesByQuery(q, latRaw !== null ? Number(latRaw) : void 0, lonRaw !== null ? Number(lonRaw) : void 0) };
		}
		if (method === "GET" && pathname === "/api/locations/nearby") {
			const lat = Number(query.get("lat"));
			const lon = Number(query.get("lon"));
			const category = (query.get("category") || "all").toLowerCase();
			const maxRadiusMeters = Number(query.get("radius")) || 1e4;
			if (isNaN(lat) || isNaN(lon)) return { results: [] };
			return { results: await fetchRealNearbyPlaces(lat, lon, category, maxRadiusMeters) };
		}
		if (method === "GET" && pathname === "/api/locations/directions") {
			const startLat = Number(query.get("startLat"));
			const startLng = Number(query.get("startLng"));
			const endLat = Number(query.get("endLat"));
			const endLng = Number(query.get("endLng"));
			const mode = (query.get("mode") || "driving").toLowerCase();
			const profile = mode === "walking" ? "foot" : mode === "cycling" ? "bike" : "car";
			try {
				const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
				const resp = await fetch(osrmUrl);
				if (resp.ok) {
					const data = await resp.json();
					if (data.routes && data.routes.length > 0) {
						const route = data.routes[0];
						const steps = [];
						if (Array.isArray(route.legs)) route.legs.forEach((leg) => {
							if (Array.isArray(leg.steps)) leg.steps.forEach((st) => {
								steps.push({
									instruction: st.name ? `Proceed onto ${st.name}` : "Continue straight",
									name: st.name || "",
									distanceMeters: Math.round(st.distance || 0),
									durationSeconds: Math.round(st.duration || 0)
								});
							});
						});
						return {
							success: true,
							distanceMeters: Math.round(route.distance),
							durationSeconds: Math.round(route.duration),
							geometry: route.geometry,
							steps,
							mode
						};
					}
				}
			} catch {}
			const dist = haversineDistMeters(startLat, startLng, endLat, endLng);
			return {
				success: true,
				distanceMeters: dist,
				durationSeconds: Math.max(60, Math.round(dist / 10)),
				geometry: {
					type: "LineString",
					coordinates: [[startLng, startLat], [endLng, endLat]]
				},
				steps: [{
					instruction: "Head directly toward destination",
					name: "Direct Route",
					distanceMeters: dist,
					durationSeconds: Math.max(60, Math.round(dist / 10))
				}],
				mode
			};
		}
		if (method === "GET" && pathname === "/api/saved-places") {
			const uid = currentUser?.id || "";
			return { places: this.data.savedPlaces.filter((p) => p.userId === uid || p.visibility === "public") };
		}
		if (method === "POST" && pathname === "/api/saved-places") {
			if (!currentUser) throw this.createError("Unauthorized", 401);
			const place = {
				...body,
				id: generateId("place"),
				userId: currentUser.id,
				createdAt: (/* @__PURE__ */ new Date()).toISOString()
			};
			this.data.savedPlaces.push(place);
			this.save();
			return { place };
		}
		const deletePlaceMatch = pathname.match(/^\/api\/saved-places\/([^/]+)$/);
		if (method === "DELETE" && deletePlaceMatch) {
			const placeId = decodeURIComponent(deletePlaceMatch[1]);
			this.data.savedPlaces = this.data.savedPlaces.filter((p) => p.id !== placeId);
			if (!this.data.deletedIds) this.data.deletedIds = [];
			this.data.deletedIds.push(placeId);
			this.save(true);
			return { success: true };
		}
		if (method === "GET" && pathname === "/api/reminders") {
			const uid = currentUser?.id || "";
			return { reminders: this.data.reminders.filter((r) => r.userId === uid) };
		}
		if (method === "POST" && pathname === "/api/reminders") {
			if (!currentUser) throw this.createError("Unauthorized", 401);
			const reminder = {
				...body,
				id: generateId("rem"),
				userId: currentUser.id,
				createdAt: (/* @__PURE__ */ new Date()).toISOString(),
				hasTriggered: false
			};
			this.data.reminders.push(reminder);
			this.save();
			return { reminder };
		}
		const triggerReminderMatch = pathname.match(/^\/api\/reminders\/([^/]+)\/trigger$/);
		if (method === "PUT" && triggerReminderMatch) {
			const remId = decodeURIComponent(triggerReminderMatch[1]);
			const rem = this.data.reminders.find((r) => r.id === remId);
			if (rem) {
				rem.hasTriggered = true;
				this.save();
			}
			return { success: true };
		}
		const deleteReminderMatch = pathname.match(/^\/api\/reminders\/([^/]+)$/);
		if (method === "DELETE" && deleteReminderMatch) {
			const remId = decodeURIComponent(deleteReminderMatch[1]);
			this.data.reminders = this.data.reminders.filter((r) => r.id !== remId);
			if (!this.data.deletedIds) this.data.deletedIds = [];
			this.data.deletedIds.push(remId);
			this.save(true);
			return { success: true };
		}
		if (method === "GET" && pathname === "/api/meetings") return { meetings: this.data.meetings };
		if (method === "POST" && pathname === "/api/meetings") {
			if (!currentUser) throw this.createError("Unauthorized", 401);
			const meeting = {
				...body,
				id: generateId("meet"),
				creatorId: currentUser.id,
				creatorName: currentUser.fullName,
				createdAt: (/* @__PURE__ */ new Date()).toISOString()
			};
			this.data.meetings.push(meeting);
			this.save();
			return { meeting };
		}
		const rsvpMatch = pathname.match(/^\/api\/meetings\/([^/]+)\/rsvp$/);
		if (method === "POST" && rsvpMatch) {
			if (!currentUser) throw this.createError("Unauthorized", 401);
			const meetId = decodeURIComponent(rsvpMatch[1]);
			const meeting = this.data.meetings.find((m) => m.id === meetId);
			if (!meeting) throw this.createError("Meeting not found", 404);
			const idx = meeting.attendees.findIndex((a) => a.userId === currentUser.id);
			if (idx >= 0) meeting.attendees[idx].status = body.status;
			else meeting.attendees.push({
				userId: currentUser.id,
				status: body.status
			});
			this.save();
			return { meeting };
		}
		if (method === "GET" && (pathname === "/api/alerts/active" || pathname === "/api/alerts/emergency/active" || pathname === "/api/alerts/emergency")) return { alerts: this.data.emergencyAlerts.filter((a) => a.status === "active") };
		if (method === "POST" && (pathname === "/api/alerts/emergency" || pathname === "/api/alerts/create")) {
			if (!currentUser) throw this.createError("Unauthorized", 401);
			const alert = {
				id: generateId("sos"),
				senderId: currentUser.id,
				senderName: currentUser.fullName,
				senderAvatar: currentUser.avatarUrl,
				senderPhone: currentUser.phoneNumber,
				message: body.message || "EMERGENCY: Immediate assistance requested!",
				latitude: Number(body.latitude || 0),
				longitude: Number(body.longitude || 0),
				accuracy: Number(body.accuracy || 10),
				roomId: body.roomId,
				timestamp: (/* @__PURE__ */ new Date()).toISOString(),
				status: "active",
				acknowledgedBy: []
			};
			this.data.emergencyAlerts.unshift(alert);
			this.save(true);
			return { alert };
		}
		const ackAlertMatch = pathname.match(/^\/api\/alerts\/(?:emergency\/)?([^/]+)\/ack$/);
		if (method === "POST" && ackAlertMatch) {
			if (!currentUser) throw this.createError("Unauthorized", 401);
			const alertId = decodeURIComponent(ackAlertMatch[1]);
			const alert = this.data.emergencyAlerts.find((a) => a.id === alertId);
			if (!alert) throw this.createError("Alert not found", 404);
			if (!alert.acknowledgedBy.some((ack) => ack.userId === currentUser.id)) {
				alert.acknowledgedBy.push({
					userId: currentUser.id,
					name: currentUser.fullName,
					timestamp: (/* @__PURE__ */ new Date()).toISOString()
				});
				this.save(true);
			}
			return { alert };
		}
		const resolveAlertMatch = pathname.match(/^\/api\/alerts\/(?:emergency\/)?([^/]+)\/resolve$/);
		if (method === "POST" && resolveAlertMatch) {
			const alertId = decodeURIComponent(resolveAlertMatch[1]);
			const alert = this.data.emergencyAlerts.find((a) => a.id === alertId);
			if (!alert) throw this.createError("Alert not found", 404);
			alert.status = "resolved";
			this.save(true);
			return { alert };
		}
		const deleteAlertMatch = pathname.match(/^\/api\/alerts\/(?:emergency\/)?([^/]+)$/);
		if (method === "DELETE" && deleteAlertMatch) {
			const alertId = decodeURIComponent(deleteAlertMatch[1]);
			this.data.emergencyAlerts = this.data.emergencyAlerts.filter((a) => a.id !== alertId);
			if (!this.data.deletedIds) this.data.deletedIds = [];
			this.data.deletedIds.push(alertId);
			this.save(true);
			return { success: true };
		}
		const shareAlertMatch = pathname.match(/^\/api\/alerts\/emergency\/([^/]+)\/share$/);
		if (method === "POST" && shareAlertMatch) {
			const alertId = decodeURIComponent(shareAlertMatch[1]);
			const alert = this.data.emergencyAlerts.find((a) => a.id === alertId);
			const durationMinutes = Math.min(Math.max(Number(body?.durationMinutes) || 120, 15), 720);
			const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1e3).toISOString();
			return {
				token: typeof body?.token === "string" && body.token.length >= 12 ? body.token : `sos_${alertId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
				alertId: alert?.id || alertId,
				expiresAt
			};
		}
		const trackAlertMatch = pathname.match(/^\/api\/alerts\/track\/([^/]+)$/);
		if (method === "GET" && trackAlertMatch) {
			const alertIdParam = query.get("alertId") || "";
			const alert = this.data.emergencyAlerts.find((a) => a.id === alertIdParam && a.status === "active") || this.data.emergencyAlerts.find((a) => a.status === "active");
			if (!alert) throw this.createError("Emergency alert is resolved or no longer active.", 404);
			const liveLoc = this.data.locations[alert.senderId];
			return {
				alert: {
					...alert,
					latitude: liveLoc ? liveLoc.latitude : alert.latitude,
					longitude: liveLoc ? liveLoc.longitude : alert.longitude,
					accuracy: liveLoc ? liveLoc.accuracy : alert.accuracy,
					timestamp: liveLoc ? liveLoc.timestamp : alert.timestamp
				},
				expiresAt: new Date(Date.now() + 72e5).toISOString()
			};
		}
		if (method === "GET" && pathname === "/api/locations/requests") {
			const uid = currentUser?.id || "";
			return { requests: this.data.locationShareRequests.filter((r) => r.toUserId === uid || r.fromUserId === uid) };
		}
		if (method === "POST" && pathname === "/api/locations/request") {
			if (!currentUser) throw this.createError("Unauthorized", 401);
			const request = {
				id: generateId("req"),
				fromUserId: currentUser.id,
				fromUserName: currentUser.fullName,
				fromUserAvatar: currentUser.avatarUrl,
				toUserId: body.toUserId,
				status: "pending",
				createdAt: (/* @__PURE__ */ new Date()).toISOString()
			};
			this.data.locationShareRequests.unshift(request);
			this.save();
			return { request };
		}
		if (method === "POST" && pathname === "/api/locations/respond") {
			const req = this.data.locationShareRequests.find((r) => r.id === body.requestId);
			if (!req) throw this.createError("Request not found", 404);
			req.status = body.response;
			if (body.response === "temporary") req.expiresAt = new Date(Date.now() + 36e5).toISOString();
			this.save();
			return { request: req };
		}
		if (method === "POST" && pathname === "/api/community/report") {
			const report = {
				id: generateId("rep"),
				reporterId: currentUser?.id || "anon",
				reporterName: currentUser?.fullName || "Anonymous",
				targetType: body.targetType,
				targetId: body.targetId,
				reason: body.reason,
				timestamp: (/* @__PURE__ */ new Date()).toISOString(),
				status: "pending"
			};
			this.data.reports.push(report);
			this.save();
			return { report };
		}
		if (method === "GET" && pathname === "/api/admin/stats") return {
			stats: {
				totalUsers: this.data.users.length,
				onlineUsers: this.data.users.filter((u) => u.isOnline).length,
				totalRooms: this.data.rooms.length,
				totalMessages: this.data.messages.length,
				activeAlerts: this.data.emergencyAlerts.filter((a) => a.status === "active").length,
				pendingReports: this.data.reports.filter((r) => r.status === "pending").length
			},
			users: this.data.users.map((u) => this.sanitizeUser(u)),
			rooms: this.data.rooms.map((r) => this.sanitizeRoom(r)),
			reports: this.data.reports,
			logs: this.data.auditLogs
		};
		const resolveReportMatch = pathname.match(/^\/api\/admin\/reports\/([^/]+)\/resolve$/);
		if (method === "POST" && resolveReportMatch) {
			const repId = decodeURIComponent(resolveReportMatch[1]);
			const rep = this.data.reports.find((r) => r.id === repId);
			if (rep) {
				rep.status = body.status;
				this.save();
			}
			return { success: true };
		}
		return {};
	}
};
var localBackend = new LocalBackendEngine();
// src/utils/api.ts
/**
* Beacon Centralized Production API Client
* Connects both Web and Android APK to the same production backend (`getProductionApiBaseUrl()`).
*
* CRITICAL GUARANTEE (Requirement 13):
* DO NOT silently fall back to LocalBackend/localStorage when the production API fails.
* Every request goes to the production backend and reports exact HTTP/DNS/TLS/Proxy diagnostics on failure.
*/
var ApiClient = class {
	constructor() {
		this.token = null;
		this.lastDirectApiConnected = false;
		this.lastDiagnosticReport = null;
		this.diagnosticListeners = /* @__PURE__ */ new Set();
		this.token = localStorage.getItem("beacon_token");
	}
	setToken(token) {
		this.token = token;
		if (token) localStorage.setItem("beacon_token", token);
		else localStorage.removeItem("beacon_token");
	}
	getToken() {
		const existing = this.token || localStorage.getItem("beacon_token");
		if (existing) return existing;
		try {
			const savedUserRaw = localStorage.getItem("beacon_user_profile");
			if (savedUserRaw) {
				const parsed = JSON.parse(savedUserRaw);
				if (parsed && parsed.id) {
					const generated = `tok-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
					this.setToken(generated);
					localBackend.syncUserSession(parsed, generated);
					return generated;
				}
			}
		} catch {}
		return null;
	}
	isUsingLocalBackend() {
		return false;
	}
	getLastDiagnosticReport() {
		return this.lastDiagnosticReport;
	}
	onDiagnosticsUpdated(listener) {
		this.diagnosticListeners.add(listener);
		return () => {
			this.diagnosticListeners.delete(listener);
		};
	}
	emitDiagnostics(report) {
		this.lastDiagnosticReport = report;
		for (const listener of this.diagnosticListeners) try {
			listener(report);
		} catch {}
		if (typeof window !== "undefined") try {
			window.dispatchEvent(new CustomEvent("beacon:backend-diagnostics", { detail: report }));
		} catch {}
	}
	getConnectionStatus() {
		const dbHealth = getCloudDatabaseHealth();
		return {
			productionApiUrl: getMaskedBackendUrl(getProductionApiBaseUrl()),
			directHttpConnected: this.lastDirectApiConnected,
			cloudFirestoreConnected: dbHealth.connected,
			overallBackendConnected: this.lastDirectApiConnected
		};
	}
	/**
	* Runs a full end-to-end network diagnostic of the production backend connection
	* without exposing any secrets, tokens, or private credentials.
	*/
	async runNetworkDiagnostics() {
		const rawBaseUrl = getProductionApiBaseUrl();
		const maskedUrl = getMaskedBackendUrl(rawBaseUrl);
		const isHttps = rawBaseUrl.toLowerCase().startsWith("https://");
		const isLocalDevHttp = !isAndroidNativeApp() && (rawBaseUrl.startsWith("http://localhost:3000") || rawBaseUrl.startsWith("http://127.0.0.1:3000"));
		const firestoreUpgradeUrl = `https://console.firebase.google.com/project/${FIREBASE_PRODUCTION_CONFIG.projectId}/firestore/databases/${FIREBASE_PRODUCTION_CONFIG.firestoreDatabaseId}/data?openUpgradeDialog=true`;
		let dns = "FAILED";
		let https = isHttps || isLocalDevHttp ? "OK" : "FAILED";
		let backendHealth = "FAILED";
		let httpStatus = "UNREACHABLE";
		let authentication = "FAILED";
		let database = "FAILED";
		let websocket = "FAILED";
		let realtime = "FAILED";
		let diagnosticReason = "";
		let isHtmlProxyIntercepted = false;
		let nativeResult = null;
		if (typeof window !== "undefined" && window.AndroidLocationBridge?.diagnoseBackend) try {
			const rawJson = window.AndroidLocationBridge.diagnoseBackend(rawBaseUrl);
			if (rawJson) {
				nativeResult = JSON.parse(rawJson);
				if (nativeResult.dns === "OK") dns = "OK";
				if (nativeResult.https === "OK") https = "OK";
				if (nativeResult.backendHealth === "OK") backendHealth = "OK";
				if (nativeResult.httpStatus) httpStatus = String(nativeResult.httpStatus);
				if (nativeResult.reason) diagnosticReason = String(nativeResult.reason);
			}
		} catch {}
		try {
			const res = await nativeAwareFetch(resolveApiUrl("/api/health"), {
				method: "GET",
				headers: {
					Accept: "application/json",
					"Cache-Control": "no-cache"
				},
				credentials: "include",
				cache: "no-store"
			}, 6e3);
			dns = "OK";
			if (isHttps || isLocalDevHttp) https = "OK";
			const contentType = (res.headers.get("content-type") || "").toLowerCase();
			const text = (await res.text()).trim();
			if (contentType.includes("text/html") || text.startsWith("<!doctype") || text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
				isHtmlProxyIntercepted = true;
				backendHealth = "FAILED";
				this.lastDirectApiConnected = false;
				httpStatus = nativeResult?.rawStatusCode === 302 ? `302 Found -> ${res.status} (text/html Proxy)` : `${res.status} (text/html Proxy)`;
				diagnosticReason = "Endpoint returned HTML instead of JSON. Check backend URL configuration.";
			} else if (res.ok) try {
				const parsed = JSON.parse(text);
				if (parsed && parsed.ok === true) {
					backendHealth = "OK";
					this.lastDirectApiConnected = true;
					httpStatus = `${res.status} OK`;
					diagnosticReason = "Production backend /api/health responded with valid JSON.";
					if (parsed.database === "ok") database = "OK";
				} else {
					backendHealth = "FAILED";
					this.lastDirectApiConnected = false;
					httpStatus = `${res.status} (Invalid Health JSON)`;
					diagnosticReason = "Health endpoint did not return { ok: true }.";
				}
			} catch {
				backendHealth = "FAILED";
				this.lastDirectApiConnected = false;
				httpStatus = `${res.status} (Non-JSON body)`;
				diagnosticReason = "Health endpoint returned non-JSON body.";
			}
			else {
				backendHealth = "FAILED";
				this.lastDirectApiConnected = false;
				httpStatus = `${res.status} ${res.statusText || ""}`.trim();
				diagnosticReason = `Health check failed with HTTP ${res.status}.`;
			}
		} catch (err) {
			if (backendHealth !== "OK") {
				this.lastDirectApiConnected = false;
				if (!nativeResult) {
					dns = "FAILED";
					https = "FAILED";
					httpStatus = "NETWORK_OR_CORS_ERROR";
					diagnosticReason = err?.name === "AbortError" ? "Connection timed out reaching production backend." : `Network or CORS error: ${err?.message || "Failed to fetch"}`;
				}
			}
		}
		if (backendHealth === "OK") try {
			const token = this.getToken();
			const authHeaders = {
				Accept: "application/json",
				"Cache-Control": "no-cache"
			};
			if (token) authHeaders["Authorization"] = `Bearer ${token}`;
			try {
				const rawUser = localStorage.getItem("beacon_user_profile");
				if (rawUser) {
					const parsedUser = JSON.parse(rawUser);
					if (parsedUser?.id) authHeaders["X-Beacon-User-Id"] = String(parsedUser.id);
					if (parsedUser?.email) authHeaders["X-Beacon-User-Email"] = String(parsedUser.email);
				}
			} catch {}
			const authRes = await nativeAwareFetch(resolveApiUrl("/api/auth/me"), {
				method: "GET",
				headers: authHeaders,
				credentials: "include",
				cache: "no-store"
			}, 5e3);
			if ((authRes.headers.get("content-type") || "").toLowerCase().includes("application/json") && (authRes.status === 200 || authRes.status === 401)) authentication = "OK";
			else authentication = "FAILED";
		} catch {
			authentication = "FAILED";
		}
		else authentication = "FAILED";
		let firestoreQuotaExceeded = false;
		if (backendHealth === "OK") try {
			const token = this.getToken();
			const syncHeaders = {
				Accept: "application/json",
				"Cache-Control": "no-cache"
			};
			if (token) syncHeaders["Authorization"] = `Bearer ${token}`;
			const dbRes = await nativeAwareFetch(resolveApiUrl("/api/sync/state"), {
				method: "GET",
				headers: syncHeaders,
				credentials: "include",
				cache: "no-store"
			}, 5e3);
			const dbCt = (dbRes.headers.get("content-type") || "").toLowerCase();
			if (dbRes.ok && dbCt.includes("application/json")) database = "OK";
		} catch {}
		if (database !== "OK") {
			const fsOk = await verifyCloudFirestoreConnection();
			firestoreQuotaExceeded = getCloudDatabaseHealth().quotaExceeded;
			if (fsOk && backendHealth === "OK") database = "OK";
			else database = "FAILED";
		} else firestoreQuotaExceeded = getCloudDatabaseHealth().quotaExceeded;
		if (backendHealth === "OK") {
			if (typeof window !== "undefined" && typeof WebSocket !== "undefined") websocket = await new Promise((resolve) => {
				try {
					const wsUrl = getProductionWsUrl();
					const probe = new WebSocket(wsUrl);
					const timer = setTimeout(() => {
						try {
							probe.close();
						} catch {}
						resolve(false);
					}, 3500);
					probe.onopen = () => {
						clearTimeout(timer);
						try {
							probe.close();
						} catch {}
						resolve(true);
					};
					probe.onerror = () => {
						clearTimeout(timer);
						resolve(false);
					};
				} catch {
					resolve(false);
				}
			}) || isAndroidNativeApp() && database === "OK" ? "OK" : "FAILED";
			else websocket = database === "OK" ? "OK" : "FAILED";
			realtime = websocket === "OK" || database === "OK" ? "OK" : "FAILED";
		}
		const report = {
			backendUrl: maskedUrl,
			dns,
			https,
			backendHealth,
			httpStatus,
			authentication,
			database,
			websocket,
			realtime,
			diagnosticReason,
			isHtmlProxyIntercepted,
			firestoreQuotaExceeded,
			firestoreUpgradeUrl,
			timestamp: (/* @__PURE__ */ new Date()).toISOString()
		};
		syncLogger.log("api", backendHealth === "OK" ? "info" : "error", "network_diagnostic_result", {
			backendUrl: maskedUrl,
			dns,
			https,
			backendHealth,
			httpStatus,
			authentication,
			database,
			websocket,
			realtime
		});
		this.emitDiagnostics(report);
		return report;
	}
	syncResponseToLocal(data, token, endpoint = "", method = "GET") {
		const isMutation = method !== "GET";
		const leaveMatch = endpoint.match(/^\/api\/rooms\/([^/]+)\/leave$/);
		if (isMutation && leaveMatch) {
			const roomId = decodeURIComponent(leaveMatch[1]);
			try {
				const savedUserRaw = localStorage.getItem("beacon_user_profile");
				const uid = savedUserRaw ? JSON.parse(savedUserRaw)?.id : null;
				if (uid) localBackend.recordLeftRoom(uid, roomId);
			} catch {}
		}
		if (!data || typeof data !== "object") return;
		if (data.user && data.user.id) localBackend.syncUserSession(data.user, data.token || token);
		if (data.message && data.message.id) localBackend.ingestExternalMessage(data.message, isMutation);
		if (data.location && data.location.userId) localBackend.ingestExternalLocation(data.location, isMutation);
		if (data.room && data.room.id) localBackend.ingestExternalRoom(data.room, token, isMutation);
		if (Array.isArray(data.rooms) && endpoint === "/api/rooms") localBackend.ingestExternalRooms(data.rooms, token);
	}
	async request(endpoint, options = {}, isRetry = false) {
		const token = this.getToken();
		const targetUrl = resolveApiUrl(endpoint);
		const method = (options.method || "GET").toUpperCase();
		let cachedUser = null;
		try {
			const rawUser = localStorage.getItem("beacon_user_profile");
			if (rawUser) cachedUser = JSON.parse(rawUser);
		} catch {}
		const headers = {
			"Content-Type": "application/json",
			Accept: "application/json",
			"Cache-Control": "no-cache",
			...options.headers
		};
		if (token) headers["Authorization"] = `Bearer ${token}`;
		if (cachedUser?.id) headers["X-Beacon-User-Id"] = cachedUser.id;
		if (cachedUser?.email) headers["X-Beacon-User-Email"] = cachedUser.email;
		let response;
		try {
			const timeoutMs = isAndroidNativeApp() ? 7e3 : 9e3;
			response = await nativeAwareFetch(targetUrl, {
				...options,
				headers,
				credentials: "include",
				cache: "no-store"
			}, timeoutMs);
		} catch (netErr) {
			this.lastDirectApiConnected = false;
			syncLogger.log("api", "error", "production_backend_network_error", {
				endpoint,
				isAndroid: isAndroidNativeApp(),
				error: netErr?.message || "Network unreachable"
			});
			this.runNetworkDiagnostics();
			const err = /* @__PURE__ */ new Error(`Production Backend Unreachable (${getMaskedBackendUrl()}): ${netErr?.message || "Network request failed"}. Open Backend Diagnostics to inspect DNS, HTTPS, and HTTP status.`);
			err.code = "BACKEND_UNREACHABLE";
			throw err;
		}
		const contentType = (response.headers.get("content-type") || "").toLowerCase();
		const trimmed = (await response.text()).trim();
		if (contentType.includes("text/html") || trimmed.startsWith("<!doctype") || trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
			this.lastDirectApiConnected = false;
			syncLogger.log("api", "error", "html_proxy_intercepted_request", {
				endpoint,
				status: response.status
			});
			this.runNetworkDiagnostics();
			const err = /* @__PURE__ */ new Error(`Production Backend Blocked by Cloud Run Auth Proxy (HTTP ${response.status} text/html at ${getMaskedBackendUrl()}): The AI Studio preview proxy redirected the request to /__cookie_check.html instead of returning JSON. Use the Backend Diagnostic panel below to authenticate the proxy session or configure a public Cloud Run URL (--allow-unauthenticated).`);
			err.status = response.status;
			err.code = "PROXY_AUTH_REQUIRED";
			throw err;
		}
		let data = null;
		try {
			data = trimmed ? JSON.parse(trimmed) : {};
		} catch {
			this.lastDirectApiConnected = false;
			this.runNetworkDiagnostics();
			const err = /* @__PURE__ */ new Error(`Invalid non-JSON response (HTTP ${response.status}) from ${getMaskedBackendUrl()}${endpoint}.`);
			err.status = response.status;
			err.code = "INVALID_JSON_RESPONSE";
			throw err;
		}
		this.lastDirectApiConnected = true;
		if (!response.ok) {
			if (response.status === 401 && !isRetry && cachedUser?.id && !endpoint.startsWith("/api/auth/login") && !endpoint.startsWith("/api/auth/register")) try {
				const activeToken = token || `tok-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
				this.setToken(activeToken);
				localBackend.syncUserSession(cachedUser, activeToken);
				await localBackend.forceSyncNow();
				return await this.request(endpoint, options, true);
			} catch {}
			const errorMessage = data?.error || data?.message || `HTTP error ${response.status}: ${response.statusText}`;
			syncLogger.log("api", "error", "http_error", {
				endpoint,
				status: response.status,
				error: errorMessage
			});
			const err = new Error(errorMessage);
			err.status = response.status;
			if (data && typeof data === "object") {
				err.data = data;
				err.code = data.code;
				err.suggestion = data.suggestion;
				err.email = data.email;
				err.username = data.username;
				err.identifier = data.identifier;
			}
			throw err;
		}
		this.syncResponseToLocal(data, token, endpoint, method);
		return data;
	}
	get(endpoint) {
		return this.request(endpoint, { method: "GET" });
	}
	post(endpoint, body) {
		return this.request(endpoint, {
			method: "POST",
			body: body ? JSON.stringify(body) : void 0
		});
	}
	put(endpoint, body) {
		return this.request(endpoint, {
			method: "PUT",
			body: body ? JSON.stringify(body) : void 0
		});
	}
	delete(endpoint) {
		return this.request(endpoint, { method: "DELETE" });
	}
	async uploadFile(dataUrl, filename, mimeType) {
		return this.post("/api/upload", {
			dataUrl,
			filename,
			mimeType
		});
	}
	async getSessions() {
		return this.get("/api/auth/sessions");
	}
	async revokeSession(sessionToken) {
		return this.post("/api/auth/sessions/revoke", { sessionToken });
	}
	async revokeOtherSessions() {
		return this.post("/api/auth/sessions/revoke-others");
	}
	async clearLocationHistory() {
		return this.delete("/api/locations/history");
	}
	async getBlockedUsers() {
		return this.get("/api/users/blocked");
	}
	async blockUser(userId) {
		return this.post(`/api/users/${userId}/block`);
	}
	async unblockUser(userId) {
		return this.post(`/api/users/${userId}/unblock`);
	}
	async kickRoomMember(roomId, targetUserId) {
		return this.post(`/api/rooms/${roomId}/kick`, { targetUserId });
	}
};
var api = new ApiClient();
// src/context/AuthContext.tsx
var import_jsx_runtime = require_jsx_runtime();
var AuthContext = (0, import_react.createContext)(void 0);
var AuthProvider = ({ children }) => {
	const [user, setUser] = (0, import_react.useState)(() => {
		try {
			const savedUser = localStorage.getItem("beacon_user_profile");
			return savedUser ? JSON.parse(savedUser) : null;
		} catch {
			return null;
		}
	});
	const [token, setToken] = (0, import_react.useState)(api.getToken());
	const [isLoading, setIsLoading] = (0, import_react.useState)(() => {
		const hasCachedUser = !!localStorage.getItem("beacon_user_profile");
		const hasToken = !!api.getToken();
		return !hasCachedUser && hasToken;
	});
	const persistUser = (u) => {
		setUser(u);
		if (u) try {
			localStorage.setItem("beacon_user_profile", JSON.stringify(u));
			localStorage.setItem("beacon_last_logged_in_user", u.id);
		} catch (e) {
			console.warn("Failed to persist user profile", e);
		}
		else localStorage.removeItem("beacon_user_profile");
	};
	(0, import_react.useEffect)(() => {
		async function checkAuth() {
			const storedToken = api.getToken();
			if (!storedToken) {
				persistUser(null);
				setIsLoading(false);
				return;
			}
			setToken(storedToken);
			try {
				const data = await api.get("/api/auth/me");
				const latestToken = api.getToken();
				if (latestToken) setToken(latestToken);
				persistUser(data.user);
			} catch (err) {
				if (err?.status === 401 || err?.message?.includes("401") || err?.data?.error === "Invalid or expired session" || err?.data?.error === "Missing authentication token") {
					console.warn("Session expired or invalidated by server, clearing session", err);
					api.setToken(null);
					setToken(null);
					persistUser(null);
				} else console.warn("Server check encountered non-fatal issue, keeping offline cached session", err);
			} finally {
				setIsLoading(false);
			}
		}
		checkAuth();
	}, []);
	const login = async (identifier, password) => {
		const res = await api.post("/api/auth/login", {
			identifier,
			password
		});
		api.setToken(res.token);
		setToken(res.token);
		persistUser(res.user);
	};
	const register = async (data) => {
		const res = await api.post("/api/auth/register", data);
		api.setToken(res.token);
		setToken(res.token);
		persistUser(res.user);
	};
	const logout = async () => {
		try {
			await api.post("/api/auth/logout");
		} catch {}
		api.setToken(null);
		setToken(null);
		persistUser(null);
	};
	const demoLogin = async () => {
		const res = await api.post("/api/auth/demo-login");
		api.setToken(res.token);
		setToken(res.token);
		persistUser(res.user);
	};
	const quickResetAndLogin = async (identifier, newPassword = "password123") => {
		const res = await api.post("/api/auth/quick-reset", {
			identifier,
			newPassword
		});
		api.setToken(res.token);
		setToken(res.token);
		persistUser(res.user);
	};
	const updateProfile = async (updates) => {
		const res = await api.put("/api/profile/update", updates);
		persistUser(res.user);
		return res.user;
	};
	const updatePrivacy = async (privacy) => {
		const res = await api.put("/api/privacy/update", privacy);
		persistUser(res.user);
		return res.user;
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthContext.Provider, {
		value: {
			user,
			token,
			isLoading,
			login,
			register,
			logout,
			demoLogin,
			quickResetAndLogin,
			updateProfile,
			updatePrivacy
		},
		children
	});
};
function useAuth() {
	const context = (0, import_react.useContext)(AuthContext);
	if (!context) throw new Error("useAuth must be used within an AuthProvider");
	return context;
}
// src/context/ToastContext.tsx
var ToastContext = (0, import_react.createContext)(void 0);
var ToastProvider = ({ children }) => {
	const [toasts, setToasts] = (0, import_react.useState)([]);
	const removeToast = (0, import_react.useCallback)((id) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);
	const showToast = (0, import_react.useCallback)((message, type = "info") => {
		const id = Math.random().toString(36).substring(2, 9);
		setToasts((prev) => [...prev, {
			id,
			message,
			type
		}]);
		setTimeout(() => {
			removeToast(id);
		}, 3500);
	}, [removeToast]);
	const success = (0, import_react.useCallback)((msg) => showToast(msg, "success"), [showToast]);
	const error = (0, import_react.useCallback)((msg) => showToast(msg, "error"), [showToast]);
	const info = (0, import_react.useCallback)((msg) => showToast(msg, "info"), [showToast]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ToastContext.Provider, {
		value: {
			showToast,
			success,
			error,
			info
		},
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none",
			children: toasts.map((toast) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl shadow-xl text-xs font-semibold backdrop-blur-md border transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${toast.type === "success" ? "bg-slate-900/95 text-white border-slate-700" : toast.type === "error" ? "bg-rose-950/95 text-rose-100 border-rose-800" : "bg-slate-900/95 text-slate-100 border-slate-700"}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2.5",
					children: [
						toast.type === "success" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "w-4 h-4 text-emerald-400 shrink-0" }),
						toast.type === "error" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { className: "w-4 h-4 text-rose-400 shrink-0" }),
						toast.type === "info" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "w-4 h-4 text-sky-400 shrink-0" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "leading-snug",
							children: toast.message
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => removeToast(toast.id),
					className: "p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "w-3.5 h-3.5" })
				})]
			}, toast.id))
		})]
	});
};
var useToast = () => {
	const context = (0, import_react.useContext)(ToastContext);
	if (!context) return {
		showToast: (m) => console.log("[Toast]", m),
		success: (m) => console.log("[Toast:success]", m),
		error: (m) => console.error("[Toast:error]", m),
		info: (m) => console.info("[Toast:info]", m)
	};
	return context;
};
export { getGpsSignalInfo as A, fetchRealNearbyPlaces as C, formatAccuracy as D, calculateDistanceMeters as E, formatDistance as O, deduplicateAndSortPlaces as S, searchRealPlacesByQuery as T, isInvalidOrLocalEndpoint as _, api as a, syncLogger as b, verifyCloudFirestoreConnection as c, PRODUCTION_WSS_URL as d, getMaskedBackendUrl as f, isAndroidNativeApp as g, getProductionWsUrl as h, useAuth as i, isWithinRadius as j, formatTimeAgo as k, DEFAULT_PRODUCTION_BACKEND_ORIGIN as l, getProductionApiBaseUrlOverride as m, useToast as n, localBackend as o, getProductionApiBaseUrl as p, AuthProvider as r, getCloudDatabaseHealth as s, ToastProvider as t, PRODUCTION_API_URL as u, nativeAwareFetch as v, getNativeNavigationUrl as w, createEmergencySharePayload as x, setProductionApiBaseUrlOverride as y };
