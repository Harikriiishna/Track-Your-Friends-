package com.beacon.mesh;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final int LOCATION_PERMISSION_REQUEST_CODE = 1001;
    private LocationManager locationManager;
    private volatile Location latestNativeLocation;
    private boolean isListeningNativeLocation = false;

    private final LocationListener nativeLocationListener = new LocationListener() {
        @Override
        public void onLocationChanged(@NonNull Location location) {
            latestNativeLocation = location;
            dispatchNativeLocationToWebView(location);
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
            try {
                webView.addJavascriptInterface(new AndroidLocationBridge(), "AndroidLocationBridge");
            } catch (Exception ignored) {}
        }

        if (hasLocationPermission()) {
            startNativeLocationUpdates();
        } else {
            requestLocationPermissionsNative();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (hasLocationPermission()) {
            startNativeLocationUpdates();
            notifyWebViewPermissionGranted();
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

    private void requestLocationPermissionsNative() {
        if (!hasLocationPermission()) {
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                    },
                    LOCATION_PERMISSION_REQUEST_CODE
            );
        }
    }

    @SuppressLint("MissingPermission")
    private void startNativeLocationUpdates() {
        if (!hasLocationPermission() || locationManager == null) return;

        try {
            Location gpsLoc = null;
            Location netLoc = null;
            Location passiveLoc = null;

            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                gpsLoc = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                if (!isListeningNativeLocation) {
                    locationManager.requestLocationUpdates(
                            LocationManager.GPS_PROVIDER,
                            3000L,
                            2.0f,
                            nativeLocationListener,
                            Looper.getMainLooper()
                    );
                }
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                netLoc = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                if (!isListeningNativeLocation) {
                    locationManager.requestLocationUpdates(
                            LocationManager.NETWORK_PROVIDER,
                            5000L,
                            5.0f,
                            nativeLocationListener,
                            Looper.getMainLooper()
                    );
                }
            }
            passiveLoc = locationManager.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER);
            isListeningNativeLocation = true;

            Location best = chooseBestLocation(gpsLoc, netLoc, passiveLoc);
            if (best != null) {
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
        Location best = latestNativeLocation;
        for (Location loc : candidates) {
            if (loc == null) continue;
            if (best == null) {
                best = loc;
            } else if (loc.getTime() > best.getTime() + 30000) {
                best = loc;
            } else if (loc.hasAccuracy() && best.hasAccuracy() && loc.getAccuracy() < best.getAccuracy()) {
                best = loc;
            }
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

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_REQUEST_CODE) {
            if (hasLocationPermission()) {
                startNativeLocationUpdates();
                notifyWebViewPermissionGranted();
            }
        }
    }

    public class AndroidLocationBridge {
        @JavascriptInterface
        public boolean hasLocationPermission() {
            return MainActivity.this.hasLocationPermission();
        }

        @JavascriptInterface
        public void requestLocationPermission() {
            runOnUiThread(() -> {
                if (MainActivity.this.hasLocationPermission()) {
                    startNativeLocationUpdates();
                    notifyWebViewPermissionGranted();
                } else {
                    requestLocationPermissionsNative();
                }
            });
        }

        @JavascriptInterface
        public String getLastKnownLocationJson() {
            if (!MainActivity.this.hasLocationPermission()) {
                return "";
            }
            if (latestNativeLocation != null) {
                return locationToJsonString(latestNativeLocation);
            }
            try {
                if (locationManager != null) {
                    @SuppressLint("MissingPermission")
                    Location gps = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                    @SuppressLint("MissingPermission")
                    Location net = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                    @SuppressLint("MissingPermission")
                    Location passive = locationManager.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER);
                    Location best = chooseBestLocation(gps, net, passive);
                    if (best != null) {
                        latestNativeLocation = best;
                        return locationToJsonString(best);
                    }
                }
            } catch (Exception ignored) {}
            return "";
        }
    }
}
