import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.isotope.app',
  appName: 'Isotope',
  webDir: 'build',
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: "#050505",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      iosSpinnerStyle: "small"
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#050505"
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true
    },
    Camera: {
      presentationStyle: "fullscreen",
      saveToGallery: false
    }
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    backgroundColor: "#050505",
    scrollEnabled: true
  },
  android: {
    backgroundColor: "#050505",
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false
  }
};

export default config;
