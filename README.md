<div align="center">

  <img src="public/icons/icon.svg" alt="Beacon Network Logo" width="108" height="108" />

  <h1>🛰️ BEACON NETWORK</h1>
  <p><strong>Next-Generation Real-Time Location Sharing, CrowdZone Map, Emergency SOS &amp; On-Device Error Tracking</strong></p>

  <p>
    <a href="#-working-principle"><img src="https://img.shields.io/badge/Architecture-React_19_%2B_Express_%2B_Capacitor-8957FF?style=flat-square&logo=react&logoColor=white" alt="Architecture" /></a>
    <a href="#-features-list"><img src="https://img.shields.io/badge/Live_Map-Leaflet_%2B_3D_Pitch-00D9FF?style=flat-square&logo=openstreetmap&logoColor=white" alt="Live Map" /></a>
    <a href="#-emergency-sos--safety-suite"><img src="https://img.shields.io/badge/Safety-Emergency_SOS_Siren-FF3B6B?style=flat-square&logo=statuspage&logoColor=white" alt="Emergency SOS" /></a>
    <a href="#-on-device-apperrorstracking-console"><img src="https://img.shields.io/badge/Diagnostics-AppErrorsTracking-FF8066?style=flat-square&logo=android&logoColor=white" alt="AppErrorsTracking" /></a>
    <a href="#-integrated-public-apis"><img src="https://img.shields.io/badge/Public_APIs-8_Zero--Key_Feeds-00D6A0?style=flat-square&logo=cloudflare&logoColor=white" alt="Public APIs" /></a>
    <a href="#-license"><img src="https://img.shields.io/badge/License-Apache_2.0-FFD166?style=flat-square" alt="License" /></a>
  </p>

  <p>
    <a href="#-project-reason">Project Reason</a> •
    <a href="#-working-principle">Working Principle</a> •
    <a href="#-features-list">Features List</a> •
    <a href="#-on-device-apperrorstracking-console">AppErrorsTracking</a> •
    <a href="#-integrated-public-apis">Public APIs</a> •
    <a href="#-release-channel">Release Channel</a> •
    <a href="#-quick-start">Quick Start</a>
  </p>

</div>

---

## 💡 Project Reason

When coordinating with friends, family, or field responders on mobile devices, standard maps lack **live social telemetry**, **instant emergency SOS broadcasting**, and **on-device crash diagnostics**. Furthermore, inspired by [`KitsunePie/AppErrorsTracking`](https://github.com/KitsunePie/AppErrorsTracking), when a mobile PWA or Capacitor Android APK encounters an unexpected runtime or network exception in the field while **not connected to a computer / ADB**, developers and power users have no way to inspect or export the stack trace.

**Beacon Network** solves both challenges in a single unified platform:
1. **Real-Time Spatial Coordination**: Sub-second GPS location sharing, interactive 2D/3D maps, CrowdZone live reports, geofenced room alerts, and 1-tap Emergency SOS sirens.
2. **Zero-Key Live Environmental & Spatial Intelligence**: Powered by 8 curated APIs from [`public-apis/public-apis`](https://github.com/public-apis/public-apis) for live weather, air quality, elevation, solar twilight, USGS seismic alerts, and public holidays.
3. **On-Device `AppErrorsTracking` Console**: Captures runtime crashes, unhandled promise rejections, and API errors directly on the device with an interactive stack-trace crash dialog, persistent error history records, statistics, and 1-tap Copy / Share / JSON Export.

---

## ⚙️ Working Principle

1. **Multi-Transport Real-Time Location Engine**: Streams live GPS coordinates, accuracy radius (`±m`), speed, heading, and battery telemetry over WebSockets (`Socket.IO`) with automatic HTTP/Cloud-Relay fallback and offline queue persistence.
2. **Zero-Key Public API Aggregator (`src/utils/publicApis.ts`)**: Queries 8 open geospatial and environmental endpoints in parallel based on your live GPS coordinates (`Open-Meteo Weather`, `Open-Meteo Air Quality`, `Open-Topo-Data Elevation`, `Sunrise-Sunset.org`, `USGS Earthquake GeoJSON`, `TimeAPI.io`, `Nager.Date Holidays`, and `REST Countries`).
3. **Global Exception Hook & Crash Interceptor (`src/utils/appErrorsTracker.ts`)**:
   - Hooks into `window.onerror`, `window.onunhandledrejection`, and React's `componentDidCatch` lifecycle (`<AppErrorsBoundary>`).
   - Replaces silent crashes or blank screens with an interactive **App Stopped / Stack Trace Dialog** offering **Copy Stack Trace**, **Share Report**, **Export `.json`**, and **Recover App**.
   - Persists up to 100 detailed stack trace records in on-device storage with live **Apps Errors Statistics** accessible anytime under **Profile → AppErrorsTracking Console**.

---

## ✅ Features List

- [x] **Interactive 2D / 3D Live Map** with smooth 60 FPS marker glides, 6 map tile layers (Street, Satellite, Hybrid, Terrain, Dark Matter, Cyber Night), and 3D pitch perspective
- [x] **Live CrowdZone Community Pinning** for real-time local vibe, safety, traffic, and event reports (100% live user pins, zero fake seeded clutter)
- [x] **Emergency SOS Broadcast & Siren** with Web Audio synthesized alarm, 5 km nearby responder radar, and shareable temporary live responder tracking links (`?sos_track=...`)
- [x] **Rooms, Universal Lounge & Geofence Alerts** with entry/exit push notifications and automatic room chat announcements
- [x] **Real-Time Direct & Room Chat** with rich media attachments, voice notes, location cards, and **1-tap Clear Unread Badges** on the Top Navbar, Bottom Nav, and Chat Header
- [x] **8 Integrated Public APIs (`public-apis`)** providing live Weather, US AQI & UV Index, Terrain Elevation (meters ASL), Golden Hour & Twilight, USGS Earthquakes within 1,500 km, Timezone, and Local Public Holidays
- [x] **Replace Original System/Silent Crash Dialog** (`AppErrorsBoundary`) with an interactive stack-trace recovery dialog
- [x] **Copy, Share, and Export (`.json`)** functions for all captured exception stack traces
- [x] **Errors History Record** with expandable stack traces, source tags (`window.onerror`, `unhandledrejection`, `react.boundary`, `network.api`), and search filter
- [x] **Apps Errors Statistics** dashboard tracking Total Exceptions, Fatal vs. Non-Fatal counts, 24-Hour velocity, and top affected modules
- [x] **Low Power Mode (Battery Saver)** adaptive GPS & 0.2 Hz map refresh throttling for extended mobile battery longevity

---

## 🐞 On-Device `AppErrorsTracking` Console

Inspired by [`KitsunePie/AppErrorsTracking`](https://github.com/KitsunePie/AppErrorsTracking), Beacon Network includes a built-in exception tracking subsystem designed for mobile devices running without a USB debugger:

| Capability | Implementation | Description |
| :--- | :--- | :--- |
| **Crash Dialog Replacement** | `<AppErrorsBoundary>` | Intercepts fatal React render exceptions and displays the full stack trace with 1-tap recovery instead of a blank screen |
| **Global Runtime Hooks** | `installAppErrorsTracking()` | Captures uncaught `window.onerror` exceptions and `unhandledrejection` promise failures automatically |
| **Copy / Share / Export** | `AppErrorsTrackerPanel` | Copy formatted stack trace reports to clipboard, share via native mobile sheet (`navigator.share`), or download `.json` logs |
| **Errors History & Stats** | `getAppErrorsStatistics()` | View total errors, fatal count, last 24h count, and per-source breakdown in **Profile → AppErrorsTracking Console** |

---

## 🌐 Integrated Public APIs

Powered by curated, zero-API-key services from [`public-apis/public-apis`](https://github.com/public-apis/public-apis):

| Category | Public API Provider | Live Telemetry Provided | Auth / Key |
| :--- | :--- | :--- | :---: |
| **Weather** | **Open-Meteo Forecast API** | Temperature, feels-like, humidity, wind speed, WMO weather condition | `No Key` |
| **Atmosphere** | **Open-Meteo Air Quality API** | US AQI, PM2.5, PM10, UV Index, health advisory level | `No Key` |
| **Geocoding / Terrain** | **Open-Topo-Data API** | Exact ground elevation in meters above sea level (`m ASL`) | `No Key` |
| **Environment / Solar** | **Sunrise-Sunset.org API** | Sunrise, sunset, solar noon, golden hour & civil twilight | `No Key` |
| **Science & Safety** | **USGS Earthquake Hazards API** | Real-time seismic events (`M1.0+`) within 1,500 km of your GPS fix | `No Key` |
| **Calendar** | **Nager.Date Public Holidays API** | Upcoming national & regional public holidays for your country | `No Key` |
| **Time & World** | **TimeAPI.io + REST Countries** | Local IANA timezone, UTC offset, currency, capital & calling code | `No Key` |

---

## 📦 Release Channel

| Channel | Link / Command |
| :--- | :--- |
| <img src="https://raw.githubusercontent.com/KitsunePie/AppErrorsTracking/master/art/github.png" width="26" /> **GitHub Source** | [Beacon Network Repository](https://github.com/) |
| **Web / PWA App** | Run `npm run dev` (Development) or `npm run build && npm start` (Production on Port `3000`) |
| **Android APK (Capacitor)** | Run `npm run android:prepare` → Open `android/` in Android Studio (`com.beacon.network`) |

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the full-stack Express + Vite + Socket.IO server on port 3000
npm run dev

# 3. Type-check and build for production
npm run lint
npm run build
```

---

## 📈 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=KitsunePie/AppErrorsTracking,public-apis/public-apis&type=Date)](https://star-history.com/#KitsunePie/AppErrorsTracking&public-apis/public-apis&Date)

---

## 📄 License

```text
Copyright (C) 2026 Beacon Network Contributors
Inspired by KitsunePie/AppErrorsTracking & public-apis/public-apis

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
