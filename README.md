# Beacon Network

Beacon Network is a real-time location sharing, group room coordination, live chat, and safety hub built for Web and Android (Capacitor APK).

---

## Core Features

- **Live HD Interactive Map**
  - Multi-layer geographical tiles (**Street**, **Terrain**, **Satellite**, **Hybrid**) with automatic provider failover.
  - Real-time GPS tracking for yourself and connected friends/room members with live distance and bearing indicators.
  - **Level-of-Detail (LOD) Manager**: Automatically hides non-essential map markers and overlays when zoomed out to reduce GPU load on low-end devices.
  - Place search, saved places, turn-by-turn routing, and custom drawn polygon/circle geofences.

- **Rooms & Saved-Place Geofences**
  - Create or join public and private rooms (plus the global **Universal Lounge**).
  - Define a custom geofence radius (`50m`–`5000m`) around any Saved Place inside a room to trigger automatic push notifications and optional room chat alerts whenever a group member enters or leaves that area.

- **Real-Time Chat & Voice**
  - Multi-channel room chat (`#general`, `#live-locations`, `#announcements`, `#lounge`) and 1-on-1 direct messaging.
  - Share live GPS coordinate cards, voice notes with waveform playback, attachments, message reactions, and replies.
  - WebRTC live voice channels (`General Voice`, `Field Ops Radio`).
  - One-tap **Clear** buttons on the Chat header, bottom navigation badge, and top notification bell badge.

- **Friends & Location Sharing**
  - Connect with friends by `@username` or email.
  - Approve permanent mutual sharing or 1-hour temporary GPS access.

- **Emergency SOS Center**
  - One-tap SOS broadcast with live responder tracking links (`?sos_track=...`), nearby member proximity alerts within 5 km, and instant turn-by-turn navigation.

- **Low Power Mode & Privacy**
  - **Low Power Mode** toggle in Settings reduces GPS polling frequency (`30s` intervals with `25m` distance filter) and lowers the map refresh rate for extended battery life.
  - Granular location, phone, and profile visibility controls plus 6 customizable UI themes.

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

Starts the full-stack Express + WebSocket + Vite server on `http://localhost:3000`.

### 3. Production Build & Start

```bash
npm run build
npm start
```

### 4. Type Check / Lint

```bash
npm run lint
```

---

## Android APK Build (Capacitor)

```bash
# Sync web build to Android project
npm run cap:sync

# Build debug APK
npm run build:apk

# Build debug + release APKs
npm run release:apk
```

---

## Project Structure

```text
├── server.ts                         # Express REST API & WebSocket (/ws) server
├── src/
│   ├── App.tsx                       # Main application shell & tab router
│   ├── config/env.ts                 # Runtime, Cloud Sync & network status monitor
│   ├── context/
│   │   ├── AuthContext.tsx           # Authentication & session restoration
│   │   ├── RealtimeContext.tsx       # Live GPS, WebSocket, chat & voice state
│   │   ├── ThemeContext.tsx          # Themes, Lite Mode & Low Power Mode
│   │   └── ToastContext.tsx          # Toast notifications & HTTP error listener
│   ├── components/
│   │   ├── Map/LiveMap.tsx           # Interactive Leaflet map & LOD integration
│   │   ├── Rooms/RoomsManager.tsx    # Rooms & saved-place geofence alerts
│   │   ├── Chat/ChatView.tsx         # Real-time room & direct chat + voice
│   │   ├── Friends/FriendsView.tsx   # Friend requests & live sharing controls
│   │   ├── Alerts/EmergencyManager.tsx # SOS broadcasts & live responder view
│   │   ├── Notifications/            # Unified activity & notification center
│   │   └── Profile/                  # Profile, privacy & Low Power Mode settings
│   └── utils/
│       ├── mapLodManager.ts          # Zoom-based Level-of-Detail (LOD) manager
│       ├── roomGeofences.ts          # Room saved-place geofence engine
│       ├── cloudSync.ts              # Cross-device Cloud Firestore & relay sync
│       └── localBackend.ts           # Offline-resilient local API fallback
└── android/                          # Capacitor Android native project
```
