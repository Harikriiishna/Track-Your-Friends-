package com.beacon.mesh;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URL;

public class MainActivity extends BridgeActivity {
    private static final int LOCATION_PERMISSION_REQUEST_CODE = 1001;
    private LocationManager locationManager;
    private volatile Location latestNativeLocation;
    private boolean isListeningNativeLocation = false;
    private boolean isRequestingLocationPermission = false;
    private boolean hasRequestedOnStartup = false;
    private GeolocationPermissions.Callback pendingGeoCallback = null;
    private String pendingGeoOrigin = null;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private final LocationListener nativeLocationListener = new LocationListener() {
        @Override
        public void onLocationChanged(@NonNull Location location) {
            if (!isLocationFresh(location, 30000L)) {
                return;
            }
            latestNativeLocation = selectNewerAccurateLocation(location, latestNativeLocation);
            dispatchNativeLocationToWebView(latestNativeLocation != null ? latestNativeLocation : location);
        }

        @Override
        public void onStatusChanged(String provider, int status, Bundle extras) {}

        @Override
        public void onProviderEnabled(@NonNull String provider) {}

        @Override
        public void onProviderDisabled(@NonNull String provider) {}
    };

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        } catch (Exception ignored) {}

        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            WebSettings settings = webView.getSettings();
            settings.setGeolocationEnabled(true);
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);

            try {
                CookieManager cookieManager = CookieManager.getInstance();
                cookieManager.setAcceptCookie(true);
                cookieManager.setAcceptThirdPartyCookies(webView, true);
            } catch (Exception ignored) {}

            try {
                webView.addJavascriptInterface(new AndroidLocationBridge(), "AndroidLocationBridge");
            } catch (Exception ignored) {}

            final WebChromeClient existingClient = webView.getWebChromeClient();
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                    if (hasLocationPermission()) {
                        callback.invoke(origin, true, false);
                        startNativeLocationUpdates();
                    } else {
                        pendingGeoOrigin = origin;
                        pendingGeoCallback = callback;
                        requestLocationPermissionsNative(false);
                    }
                }

                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    if (existingClient != null) {
                        existingClient.onPermissionRequest(request);
                    } else {
                        request.grant(request.getResources());
                    }
                }

                @Override
                public boolean onShowFileChooser(
                        WebView webView,
                        ValueCallback<Uri[]> filePathCallback,
                        FileChooserParams fileChooserParams
                ) {
                    if (existingClient != null) {
                        return existingClient.onShowFileChooser(webView, filePathCallback, fileChooserParams);
                    }
                    return super.onShowFileChooser(webView, filePathCallback, fileChooserParams);
                }
            });
        }

        if (hasLocationPermission()) {
            startNativeLocationUpdates();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (hasLocationPermission()) {
            isRequestingLocationPermission = false;
            startNativeLocationUpdates();
            notifyWebViewPermissionGranted();
        } else if (!hasRequestedOnStartup && !isRequestingLocationPermission) {
            hasRequestedOnStartup = true;
            // Delay slightly until Activity window is focused and visible so Android never drops the prompt
            mainHandler.postDelayed(() -> {
                if (!hasLocationPermission() && !isRequestingLocationPermission) {
                    requestLocationPermissionsNative(false);
                }
            }, 450);
        }
    }

    @Override
    public void onDestroy() {
        stopNativeLocationUpdates();
        super.onDestroy();
    }

    private boolean hasLocationPermission() {
        boolean fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        return fine || coarse;
    }

    private boolean isLocationServicesEnabled() {
        if (locationManager == null) return false;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                return locationManager.isLocationEnabled();
            }
            return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
                    || locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        } catch (Exception e) {
            return true;
        }
    }

    private void requestLocationPermissionsNative(boolean userInitiated) {
        if (hasLocationPermission()) {
            isRequestingLocationPermission = false;
            if (pendingGeoCallback != null && pendingGeoOrigin != null) {
                pendingGeoCallback.invoke(pendingGeoOrigin, true, false);
                pendingGeoCallback = null;
                pendingGeoOrigin = null;
            }
            startNativeLocationUpdates();
            notifyWebViewPermissionGranted();
            return;
        }

        // Guard against concurrent requestPermissions calls which cause Android OS to cancel the dialog
        if (isRequestingLocationPermission) {
            return;
        }

        isRequestingLocationPermission = true;
        ActivityCompat.requestPermissions(
                this,
                new String[]{
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                },
                LOCATION_PERMISSION_REQUEST_CODE
        );
    }

    private boolean isLocationFresh(Location loc, long maxAgeMs) {
        if (loc == null) return false;
        try {
            long ageNanos = android.os.SystemClock.elapsedRealtimeNanos() - loc.getElapsedRealtimeNanos();
            if (ageNanos >= 0) {
                return (ageNanos / 1_000_000L) <= maxAgeMs;
            }
        } catch (Exception ignored) {}
        long ageMs = System.currentTimeMillis() - loc.getTime();
        return ageMs >= -5000L && ageMs <= maxAgeMs;
    }

    private Location selectNewerAccurateLocation(Location incoming, Location currentBest) {
        if (incoming == null) return currentBest;
        if (currentBest == null || !isLocationFresh(currentBest, 15000L)) {
            return incoming;
        }
        long timeDelta = incoming.getTime() - currentBest.getTime();
        // If incoming is from a coarse network provider (> 80m) right after a sharp GPS lock (<= 25m), keep the sharp GPS lock
        if (timeDelta >= 0 && timeDelta < 8000L
                && currentBest.hasAccuracy() && incoming.hasAccuracy()
                && currentBest.getAccuracy() <= 25.0f && incoming.getAccuracy() > 80.0f) {
            return currentBest;
        }
        // Always accept newer or equal-time location fixes so moving users never stay stuck at a previous spot
        if (timeDelta >= -1000L) {
            return incoming;
        }
        if (incoming.hasAccuracy() && currentBest.hasAccuracy() && incoming.getAccuracy() < currentBest.getAccuracy()) {
            return incoming;
        }
        return currentBest;
    }

    @SuppressLint("MissingPermission")
    private void startNativeLocationUpdates() {
        if (!hasLocationPermission() || locationManager == null) return;

        try {
            if (!isLocationFresh(latestNativeLocation, 10000L)) {
                latestNativeLocation = null;
            }

            Location gpsLoc = null;
            Location netLoc = null;
            Location fusedLoc = null;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                try {
                    if (locationManager.isProviderEnabled(LocationManager.FUSED_PROVIDER)) {
                        Location cand = locationManager.getLastKnownLocation(LocationManager.FUSED_PROVIDER);
                        if (isLocationFresh(cand, 10000L)) {
                            fusedLoc = cand;
                        }
                        if (!isListeningNativeLocation) {
                            locationManager.requestLocationUpdates(
                                    LocationManager.FUSED_PROVIDER,
                                    1000L,
                                    0.0f,
                                    nativeLocationListener,
                                    Looper.getMainLooper()
                            );
                        }
                        locationManager.getCurrentLocation(
                                LocationManager.FUSED_PROVIDER,
                                null,
                                ContextCompat.getMainExecutor(this),
                                loc -> {
                                    if (loc != null) {
                                        latestNativeLocation = selectNewerAccurateLocation(loc, latestNativeLocation);
                                        dispatchNativeLocationToWebView(latestNativeLocation);
                                    }
                                }
                        );
                    }
                } catch (Exception ignored) {}
            }

            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                Location cand = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                if (isLocationFresh(cand, 10000L)) {
                    gpsLoc = cand;
                }
                if (!isListeningNativeLocation) {
                    locationManager.requestLocationUpdates(
                            LocationManager.GPS_PROVIDER,
                            1000L,
                            0.0f,
                            nativeLocationListener,
                            Looper.getMainLooper()
                    );
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    try {
                        locationManager.getCurrentLocation(
                                LocationManager.GPS_PROVIDER,
                                null,
                                ContextCompat.getMainExecutor(this),
                                loc -> {
                                    if (loc != null) {
                                        latestNativeLocation = selectNewerAccurateLocation(loc, latestNativeLocation);
                                        dispatchNativeLocationToWebView(latestNativeLocation);
                                    }
                                }
                        );
                    } catch (Exception ignored) {}
                }
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                Location cand = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                if (isLocationFresh(cand, 10000L)) {
                    netLoc = cand;
                }
                if (!isListeningNativeLocation) {
                    locationManager.requestLocationUpdates(
                            LocationManager.NETWORK_PROVIDER,
                            2000L,
                            0.0f,
                            nativeLocationListener,
                            Looper.getMainLooper()
                    );
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    try {
                        locationManager.getCurrentLocation(
                                LocationManager.NETWORK_PROVIDER,
                                null,
                                ContextCompat.getMainExecutor(this),
                                loc -> {
                                    if (loc != null) {
                                        latestNativeLocation = selectNewerAccurateLocation(loc, latestNativeLocation);
                                        dispatchNativeLocationToWebView(latestNativeLocation);
                                    }
                                }
                        );
                    } catch (Exception ignored) {}
                }
            }
            isListeningNativeLocation = true;

            Location best = chooseBestLocation(gpsLoc, fusedLoc, netLoc);
            if (best != null && isLocationFresh(best, 10000L)) {
                latestNativeLocation = best;
                dispatchNativeLocationToWebView(best);
            }
        } catch (Exception ignored) {}
    }

    private void stopNativeLocationUpdates() {
        if (locationManager != null && isListeningNativeLocation) {
            try {
                locationManager.removeUpdates(nativeLocationListener);
            } catch (Exception ignored) {}
            isListeningNativeLocation = false;
        }
    }

    private Location chooseBestLocation(Location... candidates) {
        Location best = isLocationFresh(latestNativeLocation, 10000L) ? latestNativeLocation : null;
        for (Location loc : candidates) {
            if (!isLocationFresh(loc, 10000L)) continue;
            best = selectNewerAccurateLocation(loc, best);
        }
        return best;
    }

    private String locationToJsonString(Location loc) {
        if (loc == null) return "";
        try {
            JSONObject obj = new JSONObject();
            obj.put("latitude", loc.getLatitude());
            obj.put("longitude", loc.getLongitude());
            obj.put("accuracy", loc.hasAccuracy() ? loc.getAccuracy() : 15.0);
            obj.put("altitude", loc.hasAltitude() ? loc.getAltitude() : JSONObject.NULL);
            obj.put("heading", loc.hasBearing() ? loc.getBearing() : JSONObject.NULL);
            obj.put("speed", loc.hasSpeed() ? loc.getSpeed() : JSONObject.NULL);
            obj.put("timestamp", loc.getTime());
            return obj.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private void dispatchNativeLocationToWebView(Location loc) {
        if (this.bridge == null || this.bridge.getWebView() == null || loc == null) return;
        final String json = locationToJsonString(loc);
        if (json.isEmpty()) return;
        runOnUiThread(() -> {
            try {
                if (this.bridge != null && this.bridge.getWebView() != null) {
                    this.bridge.getWebView().evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('beacon:native-location', { detail: " + json + " }));",
                            null
                    );
                }
            } catch (Exception ignored) {}
        });
    }

    private void notifyWebViewPermissionGranted() {
        if (this.bridge == null || this.bridge.getWebView() == null) return;
        runOnUiThread(() -> {
            try {
                if (this.bridge != null && this.bridge.getWebView() != null) {
                    this.bridge.getWebView().evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('beacon:permission-granted'));",
                            null
                    );
                }
            } catch (Exception ignored) {}
        });
    }

    private void notifyWebViewPermissionDenied(boolean permanentlyDenied) {
        if (this.bridge == null || this.bridge.getWebView() == null) return;
        runOnUiThread(() -> {
            try {
                if (this.bridge != null && this.bridge.getWebView() != null) {
                    this.bridge.getWebView().evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('beacon:permission-denied', { detail: { permanentlyDenied: "
                                    + (permanentlyDenied ? "true" : "false") + " } }));",
                            null
                    );
                }
            } catch (Exception ignored) {}
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_REQUEST_CODE) {
            isRequestingLocationPermission = false;
            if (hasLocationPermission()) {
                if (pendingGeoCallback != null && pendingGeoOrigin != null) {
                    pendingGeoCallback.invoke(pendingGeoOrigin, true, false);
                    pendingGeoCallback = null;
                    pendingGeoOrigin = null;
                }
                startNativeLocationUpdates();
                notifyWebViewPermissionGranted();
            } else if (grantResults.length > 0) {
                if (pendingGeoCallback != null && pendingGeoOrigin != null) {
                    pendingGeoCallback.invoke(pendingGeoOrigin, false, false);
                    pendingGeoCallback = null;
                    pendingGeoOrigin = null;
                }
                boolean showRationale = ActivityCompat.shouldShowRequestPermissionRationale(
                        this, Manifest.permission.ACCESS_FINE_LOCATION
                ) || ActivityCompat.shouldShowRequestPermissionRationale(
                        this, Manifest.permission.ACCESS_COARSE_LOCATION
                );
                notifyWebViewPermissionDenied(!showRationale);
            }
        }
    }

    public class AndroidLocationBridge {
        @JavascriptInterface
        public boolean hasLocationPermission() {
            return MainActivity.this.hasLocationPermission();
        }

        @JavascriptInterface
        public boolean isLocationEnabled() {
            return MainActivity.this.isLocationServicesEnabled();
        }

        @JavascriptInterface
        public void requestLocationPermission() {
            runOnUiThread(() -> {
                if (MainActivity.this.hasLocationPermission()) {
                    startNativeLocationUpdates();
                    notifyWebViewPermissionGranted();
                } else {
                    requestLocationPermissionsNative(true);
                }
            });
        }

        @JavascriptInterface
        public void requestFreshLocation() {
            runOnUiThread(() -> {
                if (MainActivity.this.hasLocationPermission()) {
                    latestNativeLocation = null;
                    stopNativeLocationUpdates();
                    startNativeLocationUpdates();
                } else {
                    requestLocationPermissionsNative(true);
                }
            });
        }

        @JavascriptInterface
        public void openAppLocationSettings() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    Uri uri = Uri.fromParts("package", getPackageName(), null);
                    intent.setData(uri);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public void openLocationServicesSettings() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public String getLastKnownLocationJson() {
            if (!MainActivity.this.hasLocationPermission()) {
                return "";
            }
            if (isLocationFresh(latestNativeLocation, 10000L)) {
                return locationToJsonString(latestNativeLocation);
            }
            return "";
        }

        @JavascriptInterface
        public String diagnoseBackend(String baseUrl) {
            JSONObject result = new JSONObject();
            try {
                String cleanBase = baseUrl != null ? baseUrl.trim().replaceAll("/+$", "") : "";
                result.put("backendUrl", cleanBase);

                URL parsed = new URL(cleanBase + "/api/health");
                String host = parsed.getHost();
                String protocol = parsed.getProtocol();

                // 1. Test DNS resolution directly from Android OS
                try {
                    InetAddress addr = InetAddress.getByName(host);
                    result.put("dns", "OK");
                    result.put("resolvedIp", addr.getHostAddress());
                } catch (Exception dnsEx) {
                    result.put("dns", "FAILED");
                    result.put("https", "FAILED");
                    result.put("backendHealth", "FAILED");
                    result.put("httpStatus", "DNS_RESOLUTION_FAILED");
                    result.put("reason", dnsEx.getMessage() != null ? dnsEx.getMessage() : "Unable to resolve hostname");
                    return result.toString();
                }

                if (!"https".equalsIgnoreCase(protocol)) {
                    result.put("https", "FAILED");
                    result.put("backendHealth", "FAILED");
                    result.put("httpStatus", "NON_HTTPS_BLOCKED");
                    result.put("reason", "Protocol must be HTTPS");
                    return result.toString();
                }

                // 2. Test HTTPS handshake & raw HTTP response status on /api/health without following proxy redirects
                HttpURLConnection conn = null;
                try {
                    conn = (HttpURLConnection) parsed.openConnection();
                    conn.setInstanceFollowRedirects(false);
                    conn.setConnectTimeout(6000);
                    conn.setReadTimeout(6000);
                    conn.setRequestMethod("GET");
                    conn.setRequestProperty("Accept", "application/json");
                    conn.setRequestProperty("Cache-Control", "no-cache");

                    try {
                        String cookies = CookieManager.getInstance().getCookie(cleanBase);
                        if (cookies != null && !cookies.isEmpty()) {
                            conn.setRequestProperty("Cookie", cookies);
                        }
                    } catch (Exception ignored) {}

                    int code = conn.getResponseCode();
                    String contentType = conn.getContentType() != null ? conn.getContentType() : "";
                    String locationHeader = conn.getHeaderField("Location");

                    result.put("https", "OK");
                    result.put("rawStatusCode", code);
                    result.put("contentType", contentType);
                    if (locationHeader != null) {
                        result.put("redirectLocation", locationHeader);
                    }

                    InputStream is = (code >= 200 && code < 400) ? conn.getInputStream() : conn.getErrorStream();
                    StringBuilder sb = new StringBuilder();
                    if (is != null) {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(is));
                        String line;
                        while ((line = reader.readLine()) != null && sb.length() < 2048) {
                            sb.append(line);
                        }
                        reader.close();
                    }
                    String body = sb.toString().trim();

                    if (code == 200 && contentType.toLowerCase().contains("application/json") && body.contains("\"ok\":true")) {
                        result.put("backendHealth", "OK");
                        result.put("httpStatus", "200 OK (application/json)");
                        result.put("reason", "Production backend health check passed");
                    } else if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                        result.put("backendHealth", "FAILED");
                        String locShort = locationHeader != null ? locationHeader : "redirect";
                        if (locShort.contains("__cookie_check.html") || locShort.contains("applet-auth-bridge")) {
                            result.put("httpStatus", code + " Found (Redirect to AI Studio Cookie Check / Auth Bridge)");
                            result.put("reason", "Cloud Run URL is behind Google AI Studio's applet-auth-bridge proxy. Unauthenticated APK requests are redirected (HTTP 302) to /__cookie_check.html instead of reaching server.ts.");
                        } else {
                            result.put("httpStatus", code + " Redirect");
                            result.put("reason", "Redirected to " + locShort);
                        }
                    } else if (contentType.toLowerCase().contains("text/html") || body.toLowerCase().startsWith("<!doctype") || body.toLowerCase().startsWith("<html")) {
                        result.put("backendHealth", "FAILED");
                        result.put("httpStatus", code + " (text/html proxy page instead of JSON)");
                        result.put("reason", "Endpoint returned an HTML page instead of JSON health response.");
                    } else {
                        result.put("backendHealth", "FAILED");
                        result.put("httpStatus", String.valueOf(code));
                        result.put("reason", "Unexpected response from /api/health");
                    }
                } catch (Exception tlsEx) {
                    result.put("https", "FAILED");
                    result.put("backendHealth", "FAILED");
                    result.put("httpStatus", "TLS_OR_SOCKET_ERROR");
                    result.put("reason", tlsEx.getMessage() != null ? tlsEx.getMessage() : "HTTPS connection failed");
                } finally {
                    if (conn != null) {
                        conn.disconnect();
                    }
                }
            } catch (Exception e) {
                try {
                    result.put("dns", "FAILED");
                    result.put("https", "FAILED");
                    result.put("backendHealth", "FAILED");
                    result.put("httpStatus", "INVALID_URL");
                    result.put("reason", e.getMessage() != null ? e.getMessage() : "Diagnostic error");
                } catch (Exception ignored) {}
            }
            return result.toString();
        }
    }
}
