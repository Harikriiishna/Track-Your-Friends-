import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function patchFile(filePath, replacer) {
  if (!fs.existsSync(filePath)) return;
  const original = fs.readFileSync(filePath, 'utf8');
  const updated = replacer(original);
  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`[prepare-android-apk] Patched ${path.relative(rootDir, filePath)}`);
  }
}

function walkGradleFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'build' && entry.name !== '.gradle') {
        walkGradleFiles(fullPath, fileList);
      }
    } else if (entry.isFile() && entry.name.endsWith('.gradle')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

// 1. Ensure required Capacitor Cordova & App lib folders exist
ensureDir(path.join(rootDir, 'android/capacitor-cordova-android-plugins/src/main/libs'));
ensureDir(path.join(rootDir, 'android/app/libs'));

// 2. Normalize android/capacitor.settings.gradle paths relative to settingsDir
patchFile(path.join(rootDir, 'android/capacitor.settings.gradle'), (content) =>
  content.replace(/new File\('\.\.\/node_modules\//g, "new File(settingsDir, '../node_modules/")
);

// 3. Normalize android/app/capacitor.build.gradle
patchFile(path.join(rootDir, 'android/app/capacitor.build.gradle'), (content) =>
  content
    .replace(/VERSION_21/g, 'VERSION_17')
    .replace(
      'apply from: "../capacitor-cordova-android-plugins/cordova.variables.gradle"',
      'apply from: file("../capacitor-cordova-android-plugins/cordova.variables.gradle")'
    )
);

// 4. Normalize all .gradle files in android/ and node_modules/@capacitor/ for Java 17 & Gradle 9
const gradleFiles = [
  ...walkGradleFiles(path.join(rootDir, 'android')),
  ...walkGradleFiles(path.join(rootDir, 'node_modules/@capacitor')),
];

for (const file of gradleFiles) {
  patchFile(file, (content) =>
    content
      .replace(/VERSION_21/g, 'VERSION_17')
      .replace(/com\.android\.tools\.build:gradle:8\.13\.0/g, 'com.android.tools.build:gradle:9.1.1')
      .replace(/tasks\.withType\(Javadoc\)\.all/g, 'tasks.withType(Javadoc).configureEach')
  );
}

// 5. Ensure gradlew is executable
const gradlewPath = path.join(rootDir, 'android/gradlew');
if (fs.existsSync(gradlewPath)) {
  try {
    fs.chmodSync(gradlewPath, 0o755);
  } catch {
    // ignore on Windows
  }
}

// 6. Ensure debug.keystore exists for out-of-the-box installable APK signing
const rootKeystore = path.join(rootDir, 'debug.keystore');
if (!fs.existsSync(rootKeystore)) {
  try {
    execSync(
      'keytool -genkeypair -v -keystore "./debug.keystore" -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"',
      { cwd: rootDir, stdio: 'ignore' }
    );
    console.log('[prepare-android-apk] Generated debug.keystore');
  } catch {
    // keytool may not be in PATH in lightweight web-only environments
  }
}

if (fs.existsSync(rootKeystore)) {
  fs.copyFileSync(rootKeystore, path.join(rootDir, 'android/debug.keystore'));
  fs.copyFileSync(rootKeystore, path.join(rootDir, 'android/app/debug.keystore'));
}

console.log('[prepare-android-apk] Android project is ready for Gradle APK build.');
