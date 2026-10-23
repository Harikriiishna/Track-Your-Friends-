# Beacon Android APK Compilation & Deployment Runbook

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

*Tip:* You can also run the full single-command pipeline from root:
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

### Method B: Over-the-Air Transfer (Google Drive / Telegram / Storage)
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
