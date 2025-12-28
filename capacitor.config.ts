import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.awkafpaymentkiosk',
  appName: 'Awkaf Payment Kiosk',
  webDir: 'dist',
  // Note: For development with hot-reload, uncomment the server block below
  // For production APK builds, keep it commented out so the app loads from bundled assets
  // server: {
  //   url: 'https://9d2171e7-e001-4fe8-ada5-60809059a2f2.lovableproject.com?forceHideBadge=true',
  //   cleartext: true
  // },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#157F1F",
      showSpinner: false
    },
    UsbSerial: {
      // Plugin configuration for OM-A880 POS
    }
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
