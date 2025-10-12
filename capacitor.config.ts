import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.awkafpaymentkiosk',
  appName: 'awkaf-payment-kiosk',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: "#157F1F",
      showSpinner: false
    }
  }
};

export default config;