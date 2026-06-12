import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bilalrasheed.portfolio',
  appName: 'Bilal Rasheed Portfolio',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
