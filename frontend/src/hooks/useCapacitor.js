import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

/**
 * Hook to initialize Capacitor plugins for native mobile apps
 * Handles status bar, splash screen, and keyboard behavior
 */
export const useCapacitor = () => {
  useEffect(() => {
    const initCapacitor = async () => {
      // Only run on native platforms
      if (!Capacitor.isNativePlatform()) {
        return;
      }

      try {
        // Configure status bar
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#050505' });

        // Hide splash screen after app is ready
        await SplashScreen.hide({
          fadeOutDuration: 500
        });
      } catch (error) {
        console.log('Capacitor init error:', error);
      }
    };

    initCapacitor();
  }, []);
};

/**
 * Check if running on a native platform (iOS/Android)
 */
export const isNativePlatform = () => {
  return Capacitor.isNativePlatform();
};

/**
 * Get the current platform
 */
export const getPlatform = () => {
  return Capacitor.getPlatform(); // 'ios', 'android', or 'web'
};
