import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.9d2171e7e0014fe8ada560809059a2f2',
  appName: 'awkaf-payment-kiosk',
  webDir: 'dist',
  server: {
    url: 'https://9d2171e7-e001-4fe8-ada5-60809059a2f2.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: "#157F1F",
      showSpinner: false
    }
  }
};

export default config;