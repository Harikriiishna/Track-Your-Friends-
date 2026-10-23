# Beacon - System Architecture & Technical Specification

Beacon is a real-time location sharing, community coordination, and communication mesh platform. This document outlines the core architectural components, protocols, and styling engines powering the system.

---

## 1. High-Level System Architecture

```text
[ Browser / Mobile Client ]
   ├── React 19 SPA (Vite 8, Tailwind CSS v4)
   ├── Leaflet Map Canvas (Hardware Accelerated, Smooth Marker Interpolation)
   ├── Glassmorphism Multi-Theme Engine (ThemeContext, 6 Themes)
   └── Capacitor 8 Native Mobile Wrapper (Android APK / Webview)
            │
            │ HTTP/JSON API & WebSockets (wss://)
            ▼
[ Node.js + Express Backend Server (server.ts) ]
   ├── REST Endpoints (/api/auth, /api/rooms, /api/alerts, /api/places)
   ├── Realtime WebSocket Server (/ws - Sub-50ms coordinate mesh)
   ├── WebRTC Audio Signaling & Voice Channel Manager
   └── JSON Document & Geolocation Storage Engine (data/)
```

---

## 2. Core Subsystems

### 2.1 LiveMap & Marker Motion Engine
- **Hardware-Accelerated Canvas**: Powered by Leaflet with customizable layer options (OpenStreetMap vector, CartoDB Positron, Satellite Hybrid, Dark Matter Night mode).
- **Smooth Marker Interpolation**: Eliminates jarring GPS coordinate jumps by smoothly tweening marker coordinates over time using requestAnimationFrame and geodesic calculations.
- **Pinch-to-Zoom & Two-Finger Map Rotation**: Custom multi-touch gesture engine allows fluid map rotation with true-north compass reset.
- **Geocoded Autocomplete Search**: Floating glass address search with live Nominatim geocoding and reverse geocoding.
- **Path-Tracing HUD**: Real-time breadcrumb recording and 1-hour historical trail inspection with checkpoint metrics and distance calculation.

### 2.2 Discord-Style Communication Subsystem
- **Leftmost Guild Rail (`72px`)**: Quick server switcher featuring the **pinned Universal Lounge** on top with glowing halo, room avatars, and direct message channels.
- **Channel Sidebar (`240px`)**:
  - `#general`: Text chatter and updates.
  - `#live-locations`: Live GPS coordinate broadcasts with rich map embed cards and one-click "View on Map" fly-to actions.
  - `#announcements`: High-priority mesh notifications.
  - `Voice Channels`: General Voice and Field Ops Radio with RTC audio indicators, speaking highlights, and mute/deafen controls.
- **Interactive Message Feed**:
  - Live reaction pills with user counters.
  - Quoted replies and in-place message editing.
  - Voice note recording with real-time audio waveform visualizer and inline playback.
- **Collapsible Member Roster (`240px`)**: Live online/offline member statuses, real-time distance calculations from user's current location, and user profile popouts.

### 2.3 Glassmorphic UI & Multi-Theme Engine
The styling engine uses Tailwind CSS v4 `@layer utilities` and dynamic `ThemeProvider` state:
- **`backdrop-blur-2xl` & Luminous Depth**: Translucent panels with layered ambient gradient orbs (`blur-3xl`) for realistic physical light refraction.
- **6 Production Glass Themes**:
  1. **Obsidian Frost** (*Default*): Cosmic slate frosted glass with cyan luminescence.
  2. **Crystal Ice**: Daylight crystal glass with clean sapphire refraction.
  3. **Neon Aurora**: Cyberpunk dark glass infused with magenta, purple, and electric cyan.
  4. **Boreal Spruce**: Deep alpine forest translucent glass with mint and emerald glows.
  5. **Smoky Sunset**: Dark slate glass with warm bronze, amber, and golden light.
  6. **Midnight OLED**: Deep black OLED canvas with minimalist hairline platinum frost.
- **Zero-Reload Switching**: Instant theme switching accessible via the `Navbar` palette modal or the `Profile & Settings` tab with `localStorage` persistence.

### 2.4 Realtime WebSocket Mesh Protocol (`/ws`)
Client and server communicate over structured JSON packets:

```typescript
// Location Broadcast Packet
{
  "type": "LOCATION_UPDATE",
  "payload": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "accuracy": 8.5,
    "timestamp": 1729668000000,
    "battery": 82
  }
}

// Emergency Distress Packet
{
  "type": "EMERGENCY_SOS",
  "payload": {
    "message": "Immediate assistance required",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "accuracy": 5.0
  }
}
```

### 2.5 Security, Privacy & API Protection
- **No Client API Keys**: All third-party integrations, Gemini models, and external APIs are strictly routed through server-side proxy routes (`/api/*`).
- **Granular Privacy Controls**: User can configure exact location visibility:
  - `EVERYONE`: Public coordinates across shared rooms.
  - `ROOM_MEMBERS`: Visible only to authenticated room peers.
  - `NOBODY`: Complete stealth mode.
- **Decompilation Protection**: The exported Android APK contains only the client webview presentation layer; decompiling the APK reveals zero cloud credentials or private keys.
