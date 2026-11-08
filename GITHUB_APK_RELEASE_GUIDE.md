# 🚀 Beacon Network — GitHub APK Build & Release Guide

This repository is fully configured to compile, sign, and publish the **Beacon Network** Android APK (`com.beacon.mesh`) directly to **GitHub Releases** using **GitHub Actions** or local CLI scripts.

---

## 📦 Key Files Included in the Repository

| File Path | Purpose |
|---|---|
| `.github/workflows/build-apk.yml` | Automated GitHub Actions workflow that builds the Web bundle, syncs Capacitor Android, compiles `app-debug.apk` and signed `app-release.apk`, generates `Beacon-Network.apk` + `SHA256SUMS.txt`, and publishes a GitHub Release. |
| `scripts/prepare-android-apk.mjs` | Automated Node preparation script that normalizes Capacitor 8 Gradle configs (`JavaVersion.VERSION_17`, Gradle 9.3.1) and ensures keystore availability. |
| `capacitor.config.ts` | Capacitor 8 Android configuration (`appId: "com.beacon.mesh"`, `appName: "Beacon Network"`). |
| `android/app/build.gradle` | Android module Gradle script with automatic release/debug signing fallback so both `app-debug.apk` and `app-release.apk` are signed and ready to install on any Android device. |
| `android/app/src/main/AndroidManifest.xml` | Native Android permissions (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `INTERNET`, `RECORD_AUDIO`, `VIBRATE`). |

---

## ⚡ Method 1: Automatic GitHub Release (Push to `main` or Tag)

Every push to the `main` (or `master`) branch — or pushing a version tag (`v*`) — automatically triggers `.github/workflows/build-apk.yml`.

### Step 1: Enable GitHub Actions Write Permissions (One-Time Setup)
1. Open your GitHub repository in the browser.
2. Go to **Settings** → **Actions** → **General**.
3. Scroll down to **Workflow permissions**.
4. Select **Read and write permissions** and click **Save**.

### Step 2: Push Your Code to GitHub
```bash
git add .
git commit -m "Release Beacon Network Android APK with HDR Map & Smooth Animations"
git push origin main
```

### Step 3: Optional — Trigger a Versioned Tag Release
If you want a specific version tag (e.g., `v1.2.0`):
```bash
git tag v1.2.0
git push origin v1.2.0
```

### Step 4: Download Your Released APKs
Once the workflow finishes (~2–3 minutes):
1. Open your repository's **Releases** tab on GitHub (`https://github.com/<your-username>/<your-repo>/releases`).
2. Download any of the published APK assets:
   - **`Beacon-Network.apk`** *(Recommended signed release APK)*
   - **`app-release.apk`** *(Signed release APK)*
   - **`app-debug.apk`** *(Debug APK)*
   - **`SHA256SUMS.txt`** *(SHA-256 verification checksums)*

Permanent direct download links for your latest GitHub Release:
- `https://github.com/<your-username>/<your-repo>/releases/latest/download/Beacon-Network.apk`
- `https://github.com/<your-username>/<your-repo>/releases/latest/download/app-release.apk`
- `https://github.com/<your-username>/<your-repo>/releases/latest/download/app-debug.apk`

---

## 🖱️ Method 2: Manual 1-Click Release from GitHub UI (`workflow_dispatch`)

You can also trigger a new APK release anytime without pushing code:
1. Open your repository on GitHub and click the **Actions** tab.
2. Select **Build & Release Beacon Network Android APK** in the left sidebar.
3. Click **Run workflow** (top right).
4. *(Optional)* Enter a custom release tag such as `v1.5.0`, then click the green **Run workflow** button.

---

## 🔐 Optional: Custom Production Keystore Signing in GitHub Secrets

By default, the workflow automatically generates and signs the APK so it installs immediately on any Android phone. If you want to sign with your own production `.jks` keystore for Google Play Store distribution:

1. Generate a keystore locally:
   ```bash
   keytool -genkeypair -v -keystore beacon-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias beacon
   ```
2. Base64-encode the keystore:
   ```bash
   base64 -w 0 beacon-release.jks > keystore.b64
   ```
3. In your GitHub repo, go to **Settings** → **Secrets and variables** → **Actions** and add:
   - `ANDROID_KEYSTORE_BASE64`: Contents of `keystore.b64`
   - `ANDROID_KEYSTORE_PASSWORD`: Your keystore password
   - `ANDROID_KEY_ALIAS`: `beacon`
   - `ANDROID_KEY_PASSWORD`: Your key password

---

## 💻 Method 3: Build the APK Locally via CLI

If you have **Node.js 22+** and **Java 17+ / Android SDK** installed locally:

```bash
# 1. Install dependencies
npm install

# 2. Build web bundle, sync Capacitor Android, and normalize Gradle files
npm run cap:sync

# 3. Build both Debug and Release APKs
npm run release:apk
```

Generated local APK paths:
- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release APK: `android/app/build/outputs/apk/release/app-release.apk`
