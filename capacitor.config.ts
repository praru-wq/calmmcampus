import type { CapacitorConfig } from '@capacitor/cli';

// CalmCampus Android wrapper loads the live Render deployment.
// API keys live ONLY on Render env vars. Nothing secret is bundled in the APK.
const PUBLIC_APP_URL =
  process.env.PUBLIC_APP_URL || 'https://calmcampus.onrender.com';

const config: CapacitorConfig = {
  appId: 'com.calmcampus.app',
  appName: 'CalmCampus',
  // webDir is required by Capacitor but unused when server.url is set.
  webDir: 'dist-shell',
  server: {
    url: PUBLIC_APP_URL,
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
