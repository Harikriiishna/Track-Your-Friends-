# 🌐 Beacon — Real-Time Location Sharing & Community Mesh

[![Direct APK Download](https://img.shields.io/badge/Download-app--debug.apk-emerald?logo=android&logoColor=white&style=for-the-badge)](https://github.com/Harikrishna8118/Track-Your-Friends-/releases/latest/download/app-debug.apk)
[![Android APK Ready](https://img.shields.io/badge/Android-APK%20Ready-brightgreen?logo=android&logoColor=white)](#-android-apk-compilation--deployment-runbook)
[![Capacitor 8](https://img.shields.io/badge/Capacitor-8.0-blue?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite 8](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4.0-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Beacon** is a real-time location sharing, community coordination, and communication mesh platform. It features sub-50ms coordinate streaming, a Discord-style 4-pane communication interface, hardware-accelerated mapping with geodesic interpolation, 6 physical glassmorphism themes, and native Android compilation support via Capacitor 8.

### 📲 Permanent Direct APK Download Link:
👉 **[Download Latest Android Debug APK (`app-debug.apk`)](https://github.com/Harikrishna8118/Track-Your-Friends-/releases/latest/download/app-debug.apk)**  
*(Automatically compiled and published by GitHub Actions on every push to `main`)*

---

## 📑 Table of Contents

- [Overview](#-overview)
- [System Architecture & Technical Specification (Artifact 1)](#-artifact-1-beacon-system-architecture--technical-specification)
  - [1. High-Level Architecture](#1-high-level-system-architecture)
  - [2. Core Subsystems](#2-core-subsystems)
    - [2.1 LiveMap & Marker Motion Engine](#21-livemap--marker-motion-engine)
    - [2.2 Discord-Style Communication Subsystem](#22-discord-style-communication-subsystem)
    - [2.3 Glassmorphic UI & Multi-Theme Engine](#23-glassmorphic-ui--multi-theme-engine)
    - [2.4 Realtime WebSocket Mesh Protocol](#24-realtime-websocket-mesh-protocol-ws)
    - [2.5 Security, Privacy & API Protection](#25-security-privacy--api-protection)
- [Android APK Compilation & Deployment Runbook (Artifact 2)](#-artifact-2-beacon-android-apk-compilation--deployment-runbook)
  - [1. Project Specifications](#1-project-specifications)
  - [2. Environment Prerequisites](#2-environment-prerequisites)
  - [3. Fast CLI Build Pipeline](#3-fast-cli-build-pipeline-no-gui-required)
  - [4. Hardware Permissions & AndroidManifest](#4-hardware-permissions--manifest-verification)
  - [5. Sideloading & Physical Device Installation](#5-apk-installation-on-physical-android-devices)
  - [6. Production Release Signing](#6-production-release-signing-google-play--signed-apk)
  - [7. Zero API Key Exposure Architecture](#7-security-architecture-zero-api-key-exposure)
- [Quick Start Development](#-quick-start-development)
- [Project Directory Structure](#-project-directory-structure)

---

## 🌟 Overview

Beacon combines the power of low-latency geolocation networking, real-time audio signaling, and sleek glass UI. Designed from the ground up for both modern mobile browsers and native installable Android devices, it functions seamlessly in environments requiring rapid field coordination, outdoor tracking, emergency dispatch, and community meetups.

---

# 🏛 Artifact 1: Beacon System Architecture & Technical Specification

Beacon is a real-time location sharing, community coordination, and communication mesh platform. This specification outlines the core architectural components, protocols, and styling engines powering the system.

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
- **Smooth Marker Interpolation**: Eliminates jarring GPS coordinate jumps by smoothly tweening marker coordinates over time using `requestAnimationFrame` and geodesic calculations.
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

---

# 📱 Artifact 2: Beacon Android APK Compilation & Deployment Runbook

This runbook provides complete, production-grade instructions for compiling, signing, and installing the **Beacon** mobile application into a standalone Android APK (`.apk`) using **Capacitor** and **Gradle**.

---

## 1. Project Specifications

| Attribute | Configuration |
|---|---|
| **App Name** | Beacon |
| **Package ID / ApplicationId** | `com.beacon.mesh` |
| **Framework** | React 19 + Vite 8 + TypeScript + Tailwind CSS v4 |
| **Mobile Runtime** | Capacitor 8 (`@capacitor/core`, `@capacitor/android`) |
| **Minimum Android SDK** | API 22 (Android 5.1 Lollipop) |
| **Target Android SDK** | API 34+ (Android 14 / 15) |
| **Build Tooling** | Gradle 8+ with Java OpenJDK 17 or 21 |
| **Output Debug APK** | `android/app/build/outputs/apk/debug/app-debug.apk` |
| **Output Release APK** | `android/app/build/outputs/apk/release/app-release-unsigned.apk` |

---

## 2. Environment Prerequisites

Before compiling locally, ensure the following tools are available on your system:

### 2.1 Java Development Kit (JDK 17 or 21)
Modern Android Gradle plugins require **Java 17+**.
- Verify:
  ```bash
  java -version
  ```
- If needed, install via:
  - **macOS**: `brew install openjdk@17`
  - **Ubuntu / Debian**: `sudo apt update && sudo apt install -y openjdk-17-jdk`
  - **Windows**: Install via [Eclipse Temurin](https://adoptium.net/) or Android Studio's bundled JBR.

### 2.2 Android SDK & Command-Line Tools
- Download and install **Android Studio** (version *Ladybug* or later).
- In Android Studio **SDK Manager**, confirm the following are checked:
  - Android SDK Platform 34 or 35
  - Android SDK Build-Tools 34.0.0+
  - Android SDK Command-line Tools (latest)
  - Android SDK Platform-Tools (contains `adb`)
- Configure environment variables in `~/.bashrc` or `~/.zshrc`:
  ```bash
  export ANDROID_HOME=$HOME/Android/Sdk          # Linux
  # macOS: export ANDROID_HOME=$HOME/Library/Android/sdk
  export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin
  ```

---

## 3. Fast CLI Build Pipeline (No GUI Required)

The repository includes pre-configured automation scripts in `package.json`.

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Build & Synchronize Web Assets into Android
This builds the production bundle into `/dist` and copies all static files and plugin configurations into `android/app/src/main/assets/public/`:
```bash
npm run cap:sync
```

### Step 3: Compile Standalone Debug APK
Execute the Gradle build tool directly from the terminal:

**On Linux / macOS:**
```bash
cd android
chmod +x ./gradlew
./gradlew assembleDebug
```

**On Windows (PowerShell):**
```powershell
cd android
.\gradlew.bat assembleDebug
```

*Tip:* You can also run the full single-command pipeline directly from root:
```bash
npm run build:apk
```

---

## 4. Hardware Permissions & Manifest Verification

The file `android/app/src/main/AndroidManifest.xml` is configured with all required permissions for Beacon:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

    <!-- Essential Beacon Mobile Hardware Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.VIBRATE" />
</manifest>
```

---

## 5. APK Installation on Physical Android Devices

Once compilation finishes with `BUILD SUCCESSFUL`, the `.apk` is located at:
```text
android/app/build/outputs/apk/debug/app-debug.apk
```

### Method A: Direct Sideloading via USB & ADB (Recommended)
1. On your Android phone, enable **Developer Options**:
   - Go to **Settings** > **About Phone**.
   - Tap **Build Number** 7 times until you see "You are now a developer!".
2. Under **Developer Options**, turn on **USB Debugging**.
3. Plug the phone into your computer via USB.
4. Verify your device is recognized:
   ```bash
   adb devices
   ```
   *(Accept the "Allow USB Debugging" RSA prompt on your phone's screen).*
5. Install directly:
   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```

### Method B: Over-the-Air Transfer (Google Drive / Telegram / Local Storage)
1. Copy `app-debug.apk` to Google Drive or directly into your phone's `Downloads` folder via USB file transfer.
2. Open the file on your device and tap **Install**.
3. If Google Play Protect displays "*Unrecognized Developer*", tap **More Details** > **Install Anyway**.

---

## 6. Production Release Signing (Google Play / Signed APK)

To create a release-ready signed APK:

### 1. Generate Keystore
```bash
keytool -genkey -v -keystore beacon-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias beacon
```

### 2. Assemble Release Bundle
```bash
cd android
./gradlew assembleRelease
```

### 3. Sign with Apksigner
```bash
$ANDROID_HOME/build-tools/34.0.0/zipalign -v -p 4 app/build/outputs/apk/release/app-release-unsigned.apk app-release-aligned.apk
$ANDROID_HOME/build-tools/34.0.0/apksigner sign --ks beacon-release-key.jks --out beacon-release-signed.apk app-release-aligned.apk
```

---

## 7. Security Architecture: Zero API Key Exposure

- The compiled APK acts as an authenticated client interface.
- **Never embed API secrets** inside client code (`VITE_GEMINI_API_KEY`).
- In this architecture, all generative AI calls, coordinate encryption, and user access tokens route through the backend server proxy (`server.ts`).
- Reverse engineering or decompiling the APK with `jadx-gui` or `apktool` yields zero plaintext credentials or cloud provider secrets.

---

## 🚀 Quick Start Development

### 1. Clone & Install
```bash
git clone https://github.com/your-username/beacon.git
cd beacon
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Run Dev Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production & Mobile
```bash
# Build React web bundle
npm run build

# Sync assets to Capacitor Android project
npm run cap:sync

# Open project in Android Studio (optional GUI)
npm run cap:open

# Compile standalone APK directly via CLI
npm run build:apk
```

---

## 📂 Project Directory Structure

```text
beacon/
├── .aistudio/artifacts/brain/     # System specs & compilation runbooks
├── android/                       # Native Capacitor Android Studio project
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml   # Mobile hardware permissions (GPS, Audio)
│   │   └── assets/public/        # Compiled web application distribution
│   ├── build.gradle              # Gradle root configuration
│   └── gradlew / gradlew.bat     # Gradle build executables
├── capacitor.config.ts            # Capacitor mobile bridge configuration
├── data/                          # JSON data store & rooms persistence
├── public/                        # Static web assets & icons
├── src/
│   ├── components/
│   │   ├── Chat/                  # Discord-style channels, voice notes & guild rail
│   │   ├── Map/                   # Leaflet map, GPS interpolation & path HUD
│   │   ├── Navigation/            # Glass Navbar, BottomNav & ThemeSelectorModal
│   │   └── Profile/               # Profile, stealth settings & APK Download Hub
│   ├── context/
│   │   ├── AuthContext.tsx        # Session state & authentication
│   │   └── ThemeContext.tsx       # 6 Glassmorphism theme engine
│   ├── App.tsx                    # Root application component
│   └── main.tsx                   # Client entry point
├── server.ts                      # Express API & WebSocket mesh server
├── package.json                   # Dependencies, Capacitor & build scripts
└── README.md                      # Comprehensive documentation & artifacts
```

---

## 📄 License
This project is licensed under the MIT License.
