import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.awkafpaymentkiosk',
  appName: 'Awkaf Payment Kiosk',
  webDir: 'dist',
  server: {
    // Enable hot-reload from Lovable preview during development
    url: 'https://9d2171e7-e001-4fe8-ada5-60809059a2f2.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#157F1F",
      showSpinner: false
    }
  },
  android: {
    allowMixedContent: true
  }
};

export default config;