import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'tv.trippin.app',
  appName: 'TrippinTV',
  webDir: 'dist',
  server: {
    // During development you can point the WebView at your dev server.
    // For a production build, leave this commented out so it serves from `dist`.
    // url: 'http://10.0.2.2:3000',
    androidScheme: 'https',
  },
  android: {
    // Allow the WebView to call your local backend during dev (cleartext).
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;
