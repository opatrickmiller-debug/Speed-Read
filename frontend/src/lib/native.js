import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Check if running in native app
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

// Initialize native app features
export const initNativeApp = async () => {
  if (!isNative) return;

  try {
    // Configure status bar
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#050505' });
  } catch (e) {
    console.log('StatusBar not available:', e);
  }

  // Handle keyboard events
  try {
    Keyboard.addListener('keyboardWillShow', (info) => {
      document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
    });

    Keyboard.addListener('keyboardWillHide', () => {
      document.body.style.setProperty('--keyboard-height', '0px');
    });
  } catch (e) {
    console.log('Keyboard not available:', e);
  }

  // Handle app state changes
  try {
    App.addListener('appStateChange', ({ isActive }) => {
      console.log('App state changed. Is active?', isActive);
    });

    // Handle back button on Android
    App.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        App.exitApp();
      } else {
        window.history.back();
      }
    });
  } catch (e) {
    console.log('App plugin not available:', e);
  }
};

// Haptic feedback helper
export const hapticFeedback = async (style = ImpactStyle.Light) => {
  if (!isNative) return;
  
  try {
    await Haptics.impact({ style });
  } catch (e) {
    console.log('Haptics not available:', e);
  }
};

// Vibrate helper for success/error feedback
export const hapticSuccess = () => hapticFeedback(ImpactStyle.Medium);
export const hapticError = () => hapticFeedback(ImpactStyle.Heavy);
export const hapticTap = () => hapticFeedback(ImpactStyle.Light);
