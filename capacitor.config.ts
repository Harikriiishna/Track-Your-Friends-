import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.beacon.mesh',
  appName: 'Beacon',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#090d16',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#090d16',
      overlaysWebView: true,
    },
  },
};

export default config;
