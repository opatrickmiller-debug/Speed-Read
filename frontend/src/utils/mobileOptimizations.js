import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Mobile Optimization Utilities
 * Provides hooks and utilities for optimizing the app on cellular/mobile
 */

// ==================== NETWORK STATUS ====================

/**
 * Hook to monitor network connection type and quality
 */
export function useNetworkStatus() {
  const [networkInfo, setNetworkInfo] = useState({
    isOnline: navigator.onLine,
    connectionType: 'unknown', // 4g, 3g, 2g, slow-2g, wifi
    effectiveType: 'unknown',
    downlink: null, // Mbps
    rtt: null, // Round-trip time in ms
    saveData: false, // User's data saver preference
  });

  useEffect(() => {
    const updateNetworkInfo = () => {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      
      setNetworkInfo({
        isOnline: navigator.onLine,
        connectionType: connection?.type || 'unknown',
        effectiveType: connection?.effectiveType || 'unknown',
        downlink: connection?.downlink || null,
        rtt: connection?.rtt || null,
        saveData: connection?.saveData || false,
      });
    };

    updateNetworkInfo();

    window.addEventListener('online', updateNetworkInfo);
    window.addEventListener('offline', updateNetworkInfo);
    
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      connection.addEventListener('change', updateNetworkInfo);
    }

    return () => {
      window.removeEventListener('online', updateNetworkInfo);
      window.removeEventListener('offline', updateNetworkInfo);
      if (connection) {
        connection.removeEventListener('change', updateNetworkInfo);
      }
    };
  }, []);

  // Determine if we should reduce data usage
  const shouldReduceData = networkInfo.saveData || 
    ['slow-2g', '2g'].includes(networkInfo.effectiveType) ||
    (networkInfo.rtt && networkInfo.rtt > 500);

  return { ...networkInfo, shouldReduceData };
}

// ==================== BATTERY STATUS ====================

/**
 * Hook to monitor battery status
 */
export function useBatteryStatus() {
  const [battery, setBattery] = useState({
    level: 1,
    charging: true,
    chargingTime: null,
    dischargingTime: null,
    isLowPower: false,
  });

  useEffect(() => {
    let batteryManager = null;

    const updateBattery = (bm) => {
      setBattery({
        level: bm.level,
        charging: bm.charging,
        chargingTime: bm.chargingTime,
        dischargingTime: bm.dischargingTime,
        isLowPower: !bm.charging && bm.level < 0.2, // <20% and not charging
      });
    };

    if ('getBattery' in navigator) {
      navigator.getBattery().then((bm) => {
        batteryManager = bm;
        updateBattery(bm);

        bm.addEventListener('chargingchange', () => updateBattery(bm));
        bm.addEventListener('levelchange', () => updateBattery(bm));
      }).catch(() => {
        // Battery API not available
      });
    }

    return () => {
      if (batteryManager) {
        batteryManager.removeEventListener('chargingchange', () => {});
        batteryManager.removeEventListener('levelchange', () => {});
      }
    };
  }, []);

  return battery;
}

// ==================== SMART GPS ====================

/**
 * Hook for smart GPS polling - reduces frequency when stationary
 */
export function useSmartGPS(onPositionUpdate, enabled = true) {
  const [isMoving, setIsMoving] = useState(false);
  const [accuracy, setAccuracy] = useState('high');
  const lastPositionRef = useRef(null);
  const lastMoveTimeRef = useRef(Date.now());
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);

  const calculateDistance = useCallback((pos1, pos2) => {
    if (!pos1 || !pos2) return Infinity;
    
    const R = 6371000; // Earth's radius in meters
    const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const dLon = (pos2.lng - pos1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }, []);

  const handlePosition = useCallback((position) => {
    const newPos = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };

    // Check if moving (>5 meters since last position)
    const distance = calculateDistance(lastPositionRef.current, newPos);
    const moving = distance > 5;
    
    if (moving) {
      lastMoveTimeRef.current = Date.now();
      setIsMoving(true);
    } else {
      // Consider stationary after 30 seconds of no movement
      const timeSinceMove = Date.now() - lastMoveTimeRef.current;
      if (timeSinceMove > 30000) {
        setIsMoving(false);
      }
    }

    lastPositionRef.current = newPos;
    onPositionUpdate?.(position);
  }, [calculateDistance, onPositionUpdate]);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;

    // Use high accuracy when moving, low accuracy when stationary
    const options = {
      enableHighAccuracy: isMoving || accuracy === 'high',
      timeout: isMoving ? 10000 : 30000,
      maximumAge: isMoving ? 0 : 10000,
    };

    // Clear existing watch
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    // Set up new watch
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      (error) => console.error('GPS error:', error),
      options
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [enabled, isMoving, accuracy, handlePosition]);

  return { isMoving, setAccuracy };
}

// ==================== REQUEST THROTTLING ====================

/**
 * Hook for intelligent API request throttling based on network/battery
 */
export function useThrottledRequests(baseInterval = 5000) {
  const { shouldReduceData, effectiveType } = useNetworkStatus();
  const { isLowPower } = useBatteryStatus();

  // Calculate throttle multiplier
  let multiplier = 1;
  
  if (shouldReduceData) multiplier *= 2;
  if (isLowPower) multiplier *= 1.5;
  if (effectiveType === '2g') multiplier *= 3;
  if (effectiveType === 'slow-2g') multiplier *= 4;

  const throttledInterval = Math.round(baseInterval * multiplier);
  const maxInterval = 30000; // Never wait more than 30 seconds

  return {
    interval: Math.min(throttledInterval, maxInterval),
    multiplier,
    shouldReduceData,
    isLowPower,
  };
}

// ==================== DATA SAVER MODE ====================

/**
 * Hook for managing data saver mode
 */
export function useDataSaver() {
  const [dataSaverEnabled, setDataSaverEnabled] = useState(() => {
    const saved = localStorage.getItem('dataSaverMode');
    if (saved !== null) return saved === 'true';
    
    // Auto-enable if system data saver is on
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return connection?.saveData || false;
  });

  useEffect(() => {
    localStorage.setItem('dataSaverMode', dataSaverEnabled.toString());
  }, [dataSaverEnabled]);

  const settings = {
    // API call frequencies (in ms)
    speedLimitInterval: dataSaverEnabled ? 15000 : 5000,
    weatherInterval: dataSaverEnabled ? 300000 : 60000, // 5 min vs 1 min
    predictionInterval: dataSaverEnabled ? 30000 : 10000,
    
    // Feature toggles
    enableAnimations: !dataSaverEnabled,
    enableWeatherAlerts: !dataSaverEnabled,
    enableSpeedPrediction: !dataSaverEnabled,
    enableAutoRefresh: !dataSaverEnabled,
    
    // Quality settings
    mapQuality: dataSaverEnabled ? 'low' : 'high',
    gpsAccuracy: dataSaverEnabled ? 'low' : 'high',
  };

  return {
    dataSaverEnabled,
    setDataSaverEnabled,
    settings,
  };
}

// ==================== OFFLINE QUEUE ====================

/**
 * Hook for queueing actions when offline
 */
export function useOfflineQueue() {
  const [queue, setQueue] = useState(() => {
    try {
      const saved = localStorage.getItem('offlineQueue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Save queue to localStorage
  useEffect(() => {
    localStorage.setItem('offlineQueue', JSON.stringify(queue));
  }, [queue]);

  // Add item to queue
  const enqueue = useCallback((action) => {
    setQueue((prev) => [...prev, {
      ...action,
      id: Date.now(),
      timestamp: new Date().toISOString(),
    }]);
  }, []);

  // Process queue when back online
  const processQueue = useCallback(async (processor) => {
    if (queue.length === 0 || isSyncing) return;
    
    setIsSyncing(true);
    const failed = [];

    for (const item of queue) {
      try {
        await processor(item);
      } catch (error) {
        console.error('Failed to process queued item:', error);
        failed.push(item);
      }
    }

    setQueue(failed);
    setIsSyncing(false);
  }, [queue, isSyncing]);

  // Auto-process when coming back online
  useEffect(() => {
    const handleOnline = () => {
      // Trigger sync via service worker if available
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.sync.register('sync-queued-actions');
        });
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return {
    queue,
    enqueue,
    processQueue,
    isSyncing,
    queueLength: queue.length,
  };
}

// ==================== INSTALL PROMPT ====================

/**
 * Hook for PWA install prompt
 */
export function useInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Check for iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for install prompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const promptInstall = async () => {
    if (!installPrompt) return false;
    
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      return true;
    }
    return false;
  };

  return {
    canInstall: !!installPrompt,
    isInstalled,
    isIOS,
    promptInstall,
  };
}

// ==================== VIEWPORT/ORIENTATION ====================

/**
 * Hook to detect mobile viewport and orientation
 */
export function useMobileViewport() {
  const [viewport, setViewport] = useState({
    isMobile: window.innerWidth < 768,
    isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
    isDesktop: window.innerWidth >= 1024,
    orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
    width: window.innerWidth,
    height: window.innerHeight,
    safeAreaInsets: {
      top: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0'),
      bottom: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0'),
    },
  });

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        isMobile: window.innerWidth < 768,
        isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
        isDesktop: window.innerWidth >= 1024,
        orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
        width: window.innerWidth,
        height: window.innerHeight,
        safeAreaInsets: {
          top: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0'),
          bottom: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0'),
        },
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return viewport;
}

// ==================== HAPTIC FEEDBACK ====================

/**
 * Utility for haptic feedback on mobile
 */
export const haptics = {
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  },
  medium: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(25);
    }
  },
  heavy: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  },
  alert: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }
  },
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 50, 150]);
    }
  },
};
