import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'tv.trippin.app',
  appName: 'TrippinTV',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    AdMob: {
      // Replace these with your actual AdMob ad unit IDs
      // Get them from https://apps.admob.com
      android: {
        appId: 'ca-app-pub-6101922679995203~4843291770',
        adUnitId: 'ca-app-pub-6101922679995203/2624588478',
        rewardedAdUnitId: 'ca-app-pub-6101922679995203/7471776386',
      },
      // iOS (future)
      // ios: {
      //   appId: 'ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY',
      //   adUnitId: 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ',
      //   rewardedAdUnitId: 'ca-app-pub-XXXXXXXXXXXXXXXX/WWWWWWWWWW',
      // },
      testing: false, // Set to false in production
    },
  },
};

export default config;
