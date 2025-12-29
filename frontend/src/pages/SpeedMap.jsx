import { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Crosshair, WifiOff, Database, Trophy, Maximize2, Smartphone, AlertTriangle } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

import { SpeedometerPro } from "@/components/SpeedometerPro";
import { SpeedLimitSign } from "@/components/SpeedLimitSign";
import { AlertOverlay, AVAILABLE_LANGUAGES } from "@/components/AlertOverlay";
import { SettingsPanel } from "@/components/SettingsPanel";
import { TripHistory } from "@/components/TripHistory";
import { AuthPanel } from "@/components/AuthPanel";
import { FeaturesPanel } from "@/components/FeaturesPanel";
import { WeatherAlertBanner } from "@/components/WeatherAlert";
import { OnboardingFlow, useOnboarding } from "@/components/OnboardingFlow";
import { HUDMode } from "@/components/HUDMode";
import { useAlertSound } from "@/components/SoundCustomization";
import { useWakeLock } from "@/components/WakeLock";
import { SpeedPredictionBanner, SpeedPredictionIndicator, useBearing, useSpeedPrediction } from "@/components/SpeedPrediction";
import { NetworkStatusBadge, BatteryWarningBadge } from "@/components/MobileSettings";
import { DraggableContainer } from "@/components/DraggableHUD";
import { DraggableCompass } from "@/components/Compass";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { 
  cacheSpeedLimit, 
  getCachedSpeedLimit, 
  getCacheStats,
  isOnline 
} from "@/utils/speedLimitCache";

// App version - increment this when you want to clear user caches on update
const APP_VERSION = "2.2.0";

// Check for app updates and clear stale caches
const checkAppVersion = () => {
  const storedVersion = localStorage.getItem('appVersion');
  
  if (storedVersion !== APP_VERSION) {
    console.log(`App updated: ${storedVersion || 'none'} -> ${APP_VERSION}`);
    
    // Preserve user preferences across updates
    const preserveKeys = [
      'lastPosition',        // Last GPS location
      'theme',               // Light/dark mode
      'speedUnit',           // MPH or KM/H
      'alertDelay',          // Seconds before alert
      'thresholdRanges',     // Speed zone configurations
      'weatherAlertsEnabled', // Weather alerts toggle
      'onboardingComplete',   // Skip tutorial after first time
      'wakeLockEnabled',      // Keep screen on setting
      'alertSound',           // Selected alert sound
      'alertVolume',          // Alert volume level
      'speedPredictionEnabled', // AI speed prediction toggle
      'dataSaverEnabled',     // Mobile data saver mode
      'lowPowerMode',         // Battery saver mode
      'auth_token',           // Keep user signed in
      'auth_user'             // User info persistence
    ];
    const preserved = {};
    
    preserveKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) preserved[key] = value;
    });
    
    // Clear everything
    localStorage.clear();
    
    // Restore preserved items
    Object.entries(preserved).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
    
    // Set new version
    localStorage.setItem('appVersion', APP_VERSION);
    
    // Clear service worker caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    
    // Unregister old service workers and register fresh
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.update();
        });
      });
    }
    
    return true; // Version changed
  }
  
  return false; // No change
};

// Run version check on module load
const versionUpdated = checkAppVersion();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// OpenStreetMap tile URLs - using the same data source as speed limits!
const OSM_TILE_DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const OSM_TILE_LIGHT = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom user location marker
const createUserMarker = (isSpeeding) => {
  return L.divIcon({
    className: 'user-location-marker',
    html: `<div style="
      width: 24px;
      height: 24px;
      background-color: ${isSpeeding ? '#ef4444' : '#38bdf8'};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 10px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Component to update map center when position changes
const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], map.getZoom());
    }
  }, [center, map]);
  return null;
};

// Auto-wake backend servers on app load
const wakeBackendServers = async () => {
  try {
    console.log('[App] Waking up backend servers...');
    // Use health endpoint for fast wake-up
    const response = await fetch(`${BACKEND_URL}/api/health`, { 
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (response.ok) {
      console.log('[App] Backend is already awake!');
    }
  } catch (error) {
    console.log('[App] Backend wake-up ping sent, server may be starting...');
  }
};

// Start wake-up process immediately on module load
wakeBackendServers();

const mapContainerStyle = {
  width: "100%",
  height: "100vh",
};

// Get saved position or use default (San Francisco)
const getSavedPosition = () => {
  try {
    const saved = localStorage.getItem('lastPosition');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Error loading saved position:", e);
  }
  return { lat: 37.7749, lng: -122.4194 };
};

const defaultCenter = getSavedPosition();

export default function SpeedMap() {
  // Map state - using ref for Leaflet
  const [currentPosition, setCurrentPosition] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  
  // Backend wake state
  const [backendAwake, setBackendAwake] = useState(false);
  const [wakingUp, setWakingUp] = useState(true);
  
  // Speed state
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [speedLimit, setSpeedLimit] = useState(null);
  const [roadName, setRoadName] = useState(null);
  const [isLoadingSpeedLimit, setIsLoadingSpeedLimit] = useState(false);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Ref to track last known good speed limit (survives re-renders and API gaps)
  const lastKnownSpeedLimitRef = useRef(null);
  const lastKnownRoadNameRef = useRef(null);
  const lastKnownTimestampRef = useRef(null);
  const STICKY_MAX_AGE_MS = 120000; // Keep sticky value for 2 minutes (increased from 30s)
  
  // Auto-wake backend on component mount
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;  // Reduced from 5
    const timeout = 5000;  // 5 second timeout (reduced from 8)
    
    const checkBackend = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        // Use the health endpoint for faster wake-up check
        const response = await fetch(`${API}/health`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok && isMounted) {
          setBackendAwake(true);
          setWakingUp(false);
          console.log('[App] Backend is awake!');
          return true;
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.log(`[App] Backend check failed (attempt ${retryCount + 1}/${maxRetries}):`, error.message);
        } else {
          console.log(`[App] Backend check timed out (attempt ${retryCount + 1}/${maxRetries})`);
        }
      }
      return false;
    };
    
    const wakeUp = async () => {
      if (!isMounted) return;
      setWakingUp(true);
      
      while (retryCount < maxRetries && isMounted) {
        const isAwake = await checkBackend();
        if (isAwake) return;
        
        retryCount++;
        if (retryCount < maxRetries) {
          // Wait 1 second between retries
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Even if backend didn't respond, proceed to app (will work offline/cached)
      if (isMounted) {
        console.log('[App] Proceeding without confirmed backend connection');
        setBackendAwake(true); // Assume awake and let app handle errors gracefully
        setWakingUp(false);
      }
    };
    
    wakeUp();
    
    return () => {
      isMounted = false;
    };
  }, []);
  
  // Keep-alive ping to prevent server sleep (every 30 seconds)
  useEffect(() => {
    const keepAlive = setInterval(async () => {
      try {
        await fetch(`${API}/health`, { method: 'GET' });
      } catch (e) {
        // Silently ignore - server might be temporarily unavailable
      }
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(keepAlive);
  }, []);
  
  // HUD Mode state
  const [hudMode, setHudMode] = useState(false);
  
  // Onboarding
  const { showOnboarding, isChecking: isCheckingOnboarding, completeOnboarding } = useOnboarding();
  
  // Sound customization
  const { alertSound, setAlertSound, alertVolume, setAlertVolume, triggerAlert } = useAlertSound();
  
  // Wake Lock - keep screen on while driving
  const { isActive: wakeLockActive, requestWakeLock, releaseWakeLock, isSupported: wakeLockSupported } = useWakeLock();
  
  // State to track if user wants wake lock enabled (persisted)
  const [wakeLockEnabled, setWakeLockEnabled] = useState(() => {
    const saved = localStorage.getItem('wakeLockEnabled');
    return saved !== null ? saved === 'true' : true; // Default to enabled
  });
  
  // Request wake lock on mount if enabled
  useEffect(() => {
    if (wakeLockEnabled && !wakeLockActive) {
      requestWakeLock();
    }
  }, [wakeLockEnabled, wakeLockActive, requestWakeLock]);
  
  // Persist wake lock preference
  useEffect(() => {
    localStorage.setItem('wakeLockEnabled', wakeLockEnabled.toString());
  }, [wakeLockEnabled]);
  
  // Handle wake lock toggle
  const handleWakeLockToggle = async (enabled) => {
    setWakeLockEnabled(enabled);
    if (enabled) {
      await requestWakeLock();
    } else {
      await releaseWakeLock();
    }
  };
  
  // Settings state - load from localStorage where applicable
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceLanguage, setVoiceLanguage] = useState("en");
  const [speedUnit, setSpeedUnit] = useState(() => {
    return localStorage.getItem('speedUnit') || 'mph';
  });
  const [useDynamicThreshold, setUseDynamicThreshold] = useState(() => {
    const saved = localStorage.getItem('useDynamicThreshold');
    return saved !== null ? saved === 'true' : false; // Default OFF
  });
  const [thresholdOffset, setThresholdOffset] = useState(5); // Used when dynamic is off
  const [demoMode, setDemoMode] = useState(false);
  const [offlineCacheEnabled, setOfflineCacheEnabled] = useState(true);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });
  const [alertDelay, setAlertDelay] = useState(() => {
    const saved = localStorage.getItem('alertDelay');
    return saved ? parseInt(saved, 10) : 3;
  });
  const [weatherAlertsEnabled, setWeatherAlertsEnabled] = useState(() => {
    const saved = localStorage.getItem('weatherAlertsEnabled');
    return saved !== null ? saved === 'true' : false; // Default OFF
  });
  
  // Speed Prediction (AI look-ahead)
  const [speedPredictionEnabled, setSpeedPredictionEnabled] = useState(() => {
    const saved = localStorage.getItem('speedPredictionEnabled');
    return saved !== null ? saved === 'true' : false; // Default OFF
  });
  const [showPredictionBanner, setShowPredictionBanner] = useState(false);
  const { bearing, updateBearing } = useBearing();
  
  // Mobile optimizations
  const [dataSaverEnabled, setDataSaverEnabled] = useState(() => {
    const saved = localStorage.getItem('dataSaverEnabled');
    return saved !== null ? saved === 'true' : false;
  });
  const [lowPowerMode, setLowPowerMode] = useState(() => {
    const saved = localStorage.getItem('lowPowerMode');
    return saved !== null ? saved === 'true' : false;
  });
  
  // Compass enabled state
  const [compassEnabled, setCompassEnabled] = useState(() => {
    const saved = localStorage.getItem('compassEnabled');
    return saved !== null ? saved === 'true' : true; // Default ON
  });
  
  // Speedometer opacity (0.2 to 1.0)
  const [speedometerOpacity, setSpeedometerOpacity] = useState(() => {
    const saved = localStorage.getItem('speedometerOpacity');
    return saved !== null ? parseFloat(saved) : 0.85; // Default 85% opacity
  });
  
  // Dynamic threshold ranges (speed limit -> allowed over)
  const [thresholdRanges, setThresholdRanges] = useState(() => {
    const saved = localStorage.getItem('thresholdRanges');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [
          { minLimit: 0, maxLimit: 45, offset: 0 },
          { minLimit: 45, maxLimit: 65, offset: 5 },
          { minLimit: 65, maxLimit: 80, offset: 10 },
        ];
      }
    }
    return [
      { minLimit: 0, maxLimit: 45, offset: 0 },
      { minLimit: 45, maxLimit: 65, offset: 5 },
      { minLimit: 65, maxLimit: 80, offset: 10 },
    ];
  });
  
  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  useEffect(() => {
    localStorage.setItem('speedUnit', speedUnit);
  }, [speedUnit]);
  
  useEffect(() => {
    localStorage.setItem('alertDelay', alertDelay.toString());
  }, [alertDelay]);
  
  useEffect(() => {
    localStorage.setItem('thresholdRanges', JSON.stringify(thresholdRanges));
  }, [thresholdRanges]);
  
  useEffect(() => {
    localStorage.setItem('useDynamicThreshold', useDynamicThreshold.toString());
  }, [useDynamicThreshold]);
  
  useEffect(() => {
    localStorage.setItem('weatherAlertsEnabled', weatherAlertsEnabled.toString());
  }, [weatherAlertsEnabled]);
  
  useEffect(() => {
    localStorage.setItem('speedPredictionEnabled', speedPredictionEnabled.toString());
  }, [speedPredictionEnabled]);
  
  useEffect(() => {
    localStorage.setItem('dataSaverEnabled', dataSaverEnabled.toString());
  }, [dataSaverEnabled]);
  
  useEffect(() => {
    localStorage.setItem('lowPowerMode', lowPowerMode.toString());
  }, [lowPowerMode]);
  
  // Save compass enabled state
  useEffect(() => {
    localStorage.setItem('compassEnabled', compassEnabled.toString());
  }, [compassEnabled]);
  
  // Save speedometer opacity
  useEffect(() => {
    localStorage.setItem('speedometerOpacity', speedometerOpacity.toString());
  }, [speedometerOpacity]);
  
  // Save last known position to localStorage
  useEffect(() => {
    if (currentPosition && !demoMode) {
      localStorage.setItem('lastPosition', JSON.stringify(currentPosition));
    }
  }, [currentPosition, demoMode]);
  
  // Listen for service worker updates
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event) => {
        if (event.data?.type === 'SW_UPDATED') {
          toast.success(`App updated to v${event.data.version}!`, {
            description: "New features are now available.",
            duration: 5000
          });
        }
      };
      
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
  }, []);
  
  // Show update notification if version changed
  useEffect(() => {
    if (versionUpdated) {
      toast.success(`App updated to v${APP_VERSION}!`, {
        description: "Settings have been refreshed.",
        duration: 5000
      });
    }
  }, []);
  
  // Trip recording state
  const [isRecording, setIsRecording] = useState(false);
  const [currentTripId, setCurrentTripId] = useState(null);
  const [currentTripStats, setCurrentTripStats] = useState(null);
  const tripDataRef = useRef({ speeds: [], alerts: 0 });
  
  // Demo mode state
  const demoIntervalRef = useRef(null);
  const [demoSpeed, setDemoSpeed] = useState(0);
  
  // Features panel state
  const [showFeaturesPanel, setShowFeaturesPanel] = useState(false);
  
  // Previous position for speed calculation
  const prevPositionRef = useRef(null);
  const prevTimeRef = useRef(null);
  
  // Speed limit fetch throttle
  const lastFetchRef = useRef(0);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success("Back online");
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.warning("Offline - using cached speed limits");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Get auth context
  const { isAuthenticated } = useAuth();

  // Map is always loaded with Leaflet (no API key needed!)
  const isLoaded = true;

  // Calculate dynamic threshold based on speed limit
  const getDynamicThreshold = (limit) => {
    if (!limit || !useDynamicThreshold) return thresholdOffset;
    
    for (const range of thresholdRanges) {
      if (limit >= range.minLimit && limit < range.maxLimit) {
        return range.offset;
      }
    }
    return thresholdOffset; // fallback
  };

  // Calculate if over speed limit (raw)
  const displaySpeed = demoMode ? demoSpeed : currentSpeed;
  const currentThreshold = getDynamicThreshold(speedLimit);
  
  // BUFFER: Add 1 MPH buffer before alert timer starts
  // Example: If limit is 45 + threshold 0 = 45, driver must exceed 46 MPH to trigger
  // This gives drivers a 1 MPH grace zone before any alerts begin
  const ALERT_BUFFER = 1; // 1 MPH buffer over the effective limit
  const effectiveLimit = speedLimit ? speedLimit + currentThreshold : null;
  const alertTriggerLimit = effectiveLimit !== null ? effectiveLimit + ALERT_BUFFER : null;
  
  // isOverLimit now requires exceeding the buffer (e.g., 46+ when limit is 45)
  // If driver drops back to 45 or below, timers and alerts reset
  const isOverLimit = alertTriggerLimit !== null && displaySpeed > alertTriggerLimit;
  
  // Alert delay tracking
  const speedingStartTimeRef = useRef(null);
  const [speedingDuration, setSpeedingDuration] = useState(0);
  
  // Track how long user has been speeding
  useEffect(() => {
    let interval;
    if (isOverLimit) {
      if (!speedingStartTimeRef.current) {
        speedingStartTimeRef.current = Date.now();
      }
      interval = setInterval(() => {
        const duration = (Date.now() - speedingStartTimeRef.current) / 1000;
        setSpeedingDuration(duration);
      }, 100);
    } else {
      speedingStartTimeRef.current = null;
      setSpeedingDuration(0);
    }
    return () => clearInterval(interval);
  }, [isOverLimit]);
  
  // Only trigger alert after delay has passed
  const isSpeeding = isOverLimit && speedingDuration >= alertDelay;

  // Get current language info for display
  const currentLangInfo = AVAILABLE_LANGUAGES.find(l => l.code === voiceLanguage) || AVAILABLE_LANGUAGES[0];

  // Speed prediction - look ahead for lower speed zones (only when moving)
  const { prediction: speedPrediction } = useSpeedPrediction(
    currentPosition,
    bearing,
    speedLimit,
    speedPredictionEnabled && !demoMode && currentSpeed > 5  // Only predict when moving
  );

  // ==================== TRIP RECORDING ====================
  
  // Start recording a trip
  const handleStartRecording = useCallback(async () => {
    if (!currentPosition) {
      toast.error("Cannot start recording - no GPS position");
      return;
    }
    
    try {
      const response = await axios.post(`${API}/trips/start`, {
        start_lat: currentPosition.lat,
        start_lon: currentPosition.lng,
        speed_unit: speedUnit
      });
      
      setCurrentTripId(response.data.trip_id);
      setIsRecording(true);
      tripDataRef.current = { speeds: [], alerts: 0 };
      setCurrentTripStats({ maxSpeed: 0, avgSpeed: 0, alerts: 0 });
      toast.success("Trip recording started");
    } catch (error) {
      console.error("Error starting trip:", error);
      toast.error("Failed to start trip recording");
    }
  }, [currentPosition, speedUnit]);
  
  // Stop recording a trip
  const handleStopRecording = useCallback(async () => {
    if (!currentTripId || !currentPosition) return;
    
    try {
      const response = await axios.post(`${API}/trips/end`, {
        trip_id: currentTripId,
        end_lat: currentPosition.lat,
        end_lon: currentPosition.lng
      });
      
      setIsRecording(false);
      setCurrentTripId(null);
      setCurrentTripStats(null);
      toast.success(`Trip saved! Max: ${Math.round(response.data.max_speed)} ${speedUnit}, Alerts: ${response.data.total_alerts}`);
    } catch (error) {
      console.error("Error ending trip:", error);
      toast.error("Failed to save trip");
      setIsRecording(false);
      setCurrentTripId(null);
    }
  }, [currentTripId, currentPosition, speedUnit]);
  
  // Record data point during trip (only when moving)
  const recordDataPoint = useCallback(async (lat, lon, speed, limit, speeding) => {
    if (!isRecording || !currentTripId) return;
    
    // Don't record data when stationary (< 2 mph threshold)
    if (speed < 2) {
      console.log("Skipping data point - vehicle stationary");
      return;
    }
    
    try {
      await axios.post(`${API}/trips/data-point`, {
        trip_id: currentTripId,
        data_point: {
          timestamp: new Date().toISOString(),
          lat,
          lon,
          speed: Math.round(speed * 10) / 10,
          speed_limit: limit,
          is_speeding: speeding
        }
      });
      
      // Update local stats
      tripDataRef.current.speeds.push(speed);
      if (speeding) tripDataRef.current.alerts++;
      
      const speeds = tripDataRef.current.speeds;
      const maxSpeed = Math.max(...speeds);
      const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
      
      setCurrentTripStats({
        maxSpeed,
        avgSpeed,
        alerts: tripDataRef.current.alerts
      });
    } catch (error) {
      // Silently fail for data points to not interrupt driving
      console.error("Error recording data point:", error);
    }
  }, [isRecording, currentTripId]);

  // Mute all audio/voice
  const handleMuteAll = useCallback(() => {
    setAudioEnabled(false);
    setVoiceEnabled(false);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    toast.info("All alerts muted");
  }, []);

  // Convert speed between units
  const convertSpeed = useCallback((speedMps, toUnit) => {
    if (toUnit === "mph") {
      return speedMps * 2.23694;
    }
    return speedMps * 3.6;
  }, []);

  // Fetch speed limit from API with caching
  const fetchSpeedLimit = useCallback(async (lat, lon) => {
    // Throttle requests to every 5 seconds
    const now = Date.now();
    if (now - lastFetchRef.current < 5000) return;
    lastFetchRef.current = now;
    
    setIsLoadingSpeedLimit(true);
    
    // Check cache first if offline or cache is enabled
    if (offlineCacheEnabled) {
      const cached = getCachedSpeedLimit(lat, lon);
      
      // If offline, use cache immediately
      if (!isOnline() && cached) {
        let convertedLimit = cached.speedLimit;
        if (cached.unit === "km/h" && speedUnit === "mph") {
          convertedLimit = Math.round(cached.speedLimit * 0.621371);
        } else if (cached.unit === "mph" && speedUnit === "km/h") {
          convertedLimit = Math.round(cached.speedLimit * 1.60934);
        }
        setSpeedLimit(convertedLimit);
        setRoadName(cached.roadName);
        setIsUsingCache(true);
        setIsLoadingSpeedLimit(false);
        return;
      }
    }
    
    try {
      const response = await axios.get(`${API}/speed-limit`, {
        params: { lat, lon },
        timeout: 10000,
      });
      
      const { speed_limit, unit, road_name, source } = response.data;
      
      if (speed_limit) {
        // Cache the result
        if (offlineCacheEnabled) {
          cacheSpeedLimit(lat, lon, speed_limit, unit, road_name);
        }
        
        // Convert to user's preferred unit
        let convertedLimit = speed_limit;
        if (unit === "km/h" && speedUnit === "mph") {
          convertedLimit = Math.round(speed_limit * 0.621371);
        } else if (unit === "mph" && speedUnit === "km/h") {
          convertedLimit = Math.round(speed_limit * 1.60934);
        }
        
        // Update state and save as last known good value
        setSpeedLimit(convertedLimit);
        setRoadName(road_name);
        lastKnownSpeedLimitRef.current = convertedLimit;
        lastKnownRoadNameRef.current = road_name;
        lastKnownTimestampRef.current = Date.now();
        setIsUsingCache(false);
      } else {
        // API returned null - ALWAYS use sticky value if we have one
        // This prevents the speed limit from ever disappearing once we have data
        if (lastKnownSpeedLimitRef.current !== null) {
          // Keep showing last known speed limit indefinitely
          setSpeedLimit(lastKnownSpeedLimitRef.current);
          setRoadName(lastKnownRoadNameRef.current);
          setIsUsingCache(true);
          console.log("Using sticky speed limit:", lastKnownSpeedLimitRef.current);
        } else {
          // No previous value exists at all
          setSpeedLimit(null);
          setRoadName(null);
          setIsUsingCache(false);
        }
      }
    } catch (error) {
      console.error("Error fetching speed limit:", error);
      
      // On error, ALWAYS use sticky behavior - keep last known speed limit
      
      // First try offline cache
      if (offlineCacheEnabled) {
        const cached = getCachedSpeedLimit(lat, lon);
        if (cached) {
          let convertedLimit = cached.speedLimit;
          if (cached.unit === "km/h" && speedUnit === "mph") {
            convertedLimit = Math.round(cached.speedLimit * 0.621371);
          } else if (cached.unit === "mph" && speedUnit === "km/h") {
            convertedLimit = Math.round(cached.speedLimit * 1.60934);
          }
          setSpeedLimit(convertedLimit);
          setRoadName(cached.roadName);
          lastKnownSpeedLimitRef.current = convertedLimit;
          lastKnownRoadNameRef.current = cached.roadName;
          lastKnownTimestampRef.current = Date.now();
          setIsUsingCache(true);
          return;
        }
      }
      
      // Fall back to last known good value (sticky) - NO timeout
      if (lastKnownSpeedLimitRef.current !== null) {
        setSpeedLimit(lastKnownSpeedLimitRef.current);
        setRoadName(lastKnownRoadNameRef.current);
        setIsUsingCache(true);
      }
    } finally {
      setIsLoadingSpeedLimit(false);
    }
  }, [speedUnit, offlineCacheEnabled]);

  // Calculate speed from GPS positions
  const calculateSpeed = useCallback((position) => {
    const { latitude, longitude } = position.coords;
    const currentTime = position.timestamp;
    
    if (prevPositionRef.current && prevTimeRef.current) {
      const prevLat = prevPositionRef.current.latitude;
      const prevLon = prevPositionRef.current.longitude;
      const timeDiff = (currentTime - prevTimeRef.current) / 1000;
      
      if (timeDiff > 0) {
        const R = 6371000;
        const dLat = (latitude - prevLat) * Math.PI / 180;
        const dLon = (longitude - prevLon) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(prevLat * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        const speedMps = distance / timeDiff;
        const displaySpeedValue = convertSpeed(speedMps, speedUnit);
        
        if (displaySpeedValue < 200) {
          setCurrentSpeed(displaySpeedValue);
        }
      }
    }
    
    if (position.coords.speed !== null && position.coords.speed >= 0) {
      const gpsSpeed = convertSpeed(position.coords.speed, speedUnit);
      if (gpsSpeed < 200) {
        setCurrentSpeed(gpsSpeed);
      }
    }
    
    prevPositionRef.current = { latitude, longitude };
    prevTimeRef.current = currentTime;
  }, [convertSpeed, speedUnit]);

  // Watch position for real-time tracking
  useEffect(() => {
    if (demoMode) return;
    
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      setIsLoadingLocation(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentPosition({ lat: latitude, lng: longitude });
        setIsLoadingLocation(false);
        
        calculateSpeed(position);
        fetchSpeedLimit(latitude, longitude);
        
        // Update bearing for speed prediction
        updateBearing(latitude, longitude);
        
        // Map panning is handled by MapUpdater component in Leaflet
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.error("Unable to get your location. Enable GPS and try again.");
        setIsLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [calculateSpeed, fetchSpeedLimit, demoMode, updateBearing]);

  // Record trip data points every 5 seconds while recording
  useEffect(() => {
    if (!isRecording || !currentPosition) return;
    
    const interval = setInterval(() => {
      recordDataPoint(
        currentPosition.lat,
        currentPosition.lng,
        displaySpeed,
        speedLimit,
        isSpeeding
      );
    }, 5000);
    
    // Record initial data point
    recordDataPoint(
      currentPosition.lat,
      currentPosition.lng,
      displaySpeed,
      speedLimit,
      isSpeeding
    );
    
    return () => clearInterval(interval);
  }, [isRecording, currentPosition, displaySpeed, speedLimit, isSpeeding, recordDataPoint]);

  // Demo mode simulation
  useEffect(() => {
    if (demoMode) {
      const demoPos = { lat: 37.7749, lng: -122.4194 };
      setCurrentPosition(demoPos);
      setIsLoadingLocation(false);
      fetchSpeedLimit(demoPos.lat, demoPos.lng);
      
      let increasing = true;
      demoIntervalRef.current = setInterval(() => {
        setDemoSpeed((prev) => {
          if (prev >= 75) increasing = false;
          if (prev <= 20) increasing = true;
          return increasing ? prev + Math.random() * 3 : prev - Math.random() * 3;
        });
      }, 500);
      
      toast.info("Demo mode active - simulating driving");
    } else {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
      setDemoSpeed(0);
    }
    
    return () => {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
      }
    };
  }, [demoMode, fetchSpeedLimit]);

  // Center map on current position - will be handled by map ref
  const mapRef = useRef(null);
  
  const centerOnPosition = useCallback(() => {
    if (currentPosition && mapRef.current) {
      mapRef.current.setView([currentPosition.lat, currentPosition.lng], 17);
    }
  }, [currentPosition]);

  // No map load callback needed for Leaflet

  // Show onboarding for first-time users
  if (!isCheckingOnboarding && showOnboarding) {
    return <OnboardingFlow onComplete={completeOnboarding} />;
  }

  // Show waking up indicator
  if (wakingUp) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-sm">
          {/* Animated logo/icon */}
          <div className="relative w-20 h-20 mx-auto">
            <div className="w-20 h-20 border-4 border-cyan-500/30 rounded-full animate-ping absolute inset-0" />
            <div className="w-20 h-20 border-4 border-cyan-500 rounded-full flex items-center justify-center">
              <Smartphone className="w-10 h-10 text-cyan-500 animate-pulse" />
            </div>
          </div>
          
          {/* Status text */}
          <div className="space-y-2">
            <h2 className="text-xl font-mono text-zinc-200 uppercase tracking-wider">
              Connecting
            </h2>
            <p className="text-sm text-zinc-500 font-mono">
              Waking up servers...
            </p>
          </div>
          
          {/* Loading dots */}
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          
          {/* Skip button - more prominent */}
          <button
            onClick={() => {
              setBackendAwake(true);
              setWakingUp(false);
            }}
            className="mt-4 w-full px-6 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-cyan-500/50 text-zinc-300 hover:text-cyan-400 font-mono text-sm rounded-lg transition-all"
          >
            Skip & Continue →
          </button>
          
          <p className="text-xs text-zinc-600 font-mono">
            Tap skip if this takes too long
          </p>
        </div>
      </div>
    );
  }

  // HUD Mode - full screen display for windshield
  if (hudMode) {
    return (
      <HUDMode
        speed={displaySpeed}
        speedLimit={speedLimit}
        unit={speedUnit}
        isSpeeding={isSpeeding}
        onClose={() => setHudMode(false)}
      />
    );
  }

  return (
    <div 
      data-testid="speed-map-page" 
      className={cn(
        "relative h-screen w-screen overflow-hidden transition-colors duration-300",
        theme === "dark" ? "bg-zinc-950" : "bg-gray-100"
      )}
    >
      {/* Alert Overlay */}
      <AlertOverlay
        isActive={isSpeeding}
        audioEnabled={audioEnabled}
        voiceEnabled={voiceEnabled}
        voiceLanguage={voiceLanguage}
        currentSpeed={displaySpeed}
        speedLimit={speedLimit}
        speedUnit={speedUnit}
        onMuteClick={handleMuteAll}
        alertSound={alertSound}
        alertVolume={alertVolume}
        triggerAlert={triggerAlert}
      />
      
      {/* Weather Alert Banner */}
      {weatherAlertsEnabled && (
        <WeatherAlertBanner 
          currentPosition={currentPosition}
          theme={theme}
        />
      )}
      
      {/* Speed Prediction Banner - DISABLED until core speed limit is more stable */}
      {/* {speedPredictionEnabled && speedPrediction && currentSpeed > 5 && (
        <SpeedPredictionBanner
          prediction={speedPrediction}
          currentSpeedLimit={speedLimit}
          speedUnit={speedUnit}
          theme={theme}
          onDismiss={() => setShowPredictionBanner(false)}
        />
      )} */}
      
      {/* OpenStreetMap - Same data source as speed limits for better accuracy! */}
      {isLoaded ? (
        <MapContainer
          ref={mapRef}
          center={currentPosition ? [currentPosition.lat, currentPosition.lng] : [defaultCenter.lat, defaultCenter.lng]}
          zoom={17}
          style={mapContainerStyle}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url={theme === "dark" ? OSM_TILE_DARK : OSM_TILE_LIGHT}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          
          {/* Update map center when position changes */}
          <MapUpdater center={currentPosition} />
          
          {/* User location marker */}
          {currentPosition && (
            <>
              {/* Accuracy circle */}
              <Circle
                center={[currentPosition.lat, currentPosition.lng]}
                radius={15}
                pathOptions={{
                  color: isSpeeding ? '#ef4444' : '#38bdf8',
                  fillColor: isSpeeding ? '#ef4444' : '#38bdf8',
                  fillOpacity: 0.2,
                  weight: 2,
                }}
              />
              {/* User marker */}
              <Marker
                position={[currentPosition.lat, currentPosition.lng]}
                icon={createUserMarker(isSpeeding)}
              />
            </>
          )}
        </MapContainer>
      ) : (
        <div className="h-full w-full flex items-center justify-center">
          <div className="text-zinc-500 font-mono animate-pulse">Loading map...</div>
        </div>
      )}
      
      {/* HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Top bar with settings */}
        <div className="absolute top-4 right-4 pointer-events-auto flex gap-2">
          <SettingsPanel
            audioEnabled={audioEnabled}
            setAudioEnabled={setAudioEnabled}
            voiceEnabled={voiceEnabled}
            setVoiceEnabled={setVoiceEnabled}
            voiceLanguage={voiceLanguage}
            setVoiceLanguage={setVoiceLanguage}
            speedUnit={speedUnit}
            setSpeedUnit={setSpeedUnit}
            thresholdOffset={thresholdOffset}
            setThresholdOffset={setThresholdOffset}
            useDynamicThreshold={useDynamicThreshold}
            setUseDynamicThreshold={setUseDynamicThreshold}
            thresholdRanges={thresholdRanges}
            setThresholdRanges={setThresholdRanges}
            demoMode={demoMode}
            setDemoMode={setDemoMode}
            offlineCacheEnabled={offlineCacheEnabled}
            setOfflineCacheEnabled={setOfflineCacheEnabled}
            currentSpeedLimit={speedLimit}
            currentThreshold={currentThreshold}
            theme={theme}
            setTheme={setTheme}
            alertDelay={alertDelay}
            setAlertDelay={setAlertDelay}
            weatherAlertsEnabled={weatherAlertsEnabled}
            setWeatherAlertsEnabled={setWeatherAlertsEnabled}
            alertSound={alertSound}
            setAlertSound={setAlertSound}
            alertVolume={alertVolume}
            setAlertVolume={setAlertVolume}
            wakeLockEnabled={wakeLockEnabled}
            onWakeLockToggle={handleWakeLockToggle}
            wakeLockActive={wakeLockActive}
            speedPredictionEnabled={speedPredictionEnabled}
            setSpeedPredictionEnabled={setSpeedPredictionEnabled}
            dataSaverEnabled={dataSaverEnabled}
            setDataSaverEnabled={setDataSaverEnabled}
            lowPowerMode={lowPowerMode}
            setLowPowerMode={setLowPowerMode}
            speedometerOpacity={speedometerOpacity}
            setSpeedometerOpacity={setSpeedometerOpacity}
            compassEnabled={compassEnabled}
            setCompassEnabled={setCompassEnabled}
          />
          <AuthPanel />
        </div>
        
        {/* Center on location button + Trip History + Features + HUD Mode */}
        <div className="absolute top-4 left-4 pointer-events-auto flex gap-2">
          <Button
            data-testid="center-location-btn"
            variant="ghost"
            size="icon"
            onClick={centerOnPosition}
            disabled={!currentPosition}
            className={cn(
              "backdrop-blur-xl bg-black/50 border border-white/10",
              "hover:bg-black/70 hover:border-white/20",
              "rounded-none w-12 h-12",
              "transition-colors duration-200",
              "disabled:opacity-50"
            )}
          >
            <Crosshair className="w-5 h-5 text-zinc-300" />
          </Button>
          
          <TripHistory
            isRecording={isRecording}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            currentTripStats={currentTripStats}
          />
          
          <Button
            data-testid="features-btn"
            variant="ghost"
            size="icon"
            onClick={() => setShowFeaturesPanel(true)}
            className={cn(
              "backdrop-blur-xl bg-black/50 border border-white/10",
              "hover:bg-black/70 hover:border-yellow-500/50",
              "rounded-none w-12 h-12",
              "transition-colors duration-200"
            )}
          >
            <Trophy className="w-5 h-5 text-yellow-400" />
          </Button>
          
          {/* HUD Mode Button */}
          <Button
            data-testid="hud-mode-btn"
            variant="ghost"
            size="icon"
            onClick={() => setHudMode(true)}
            className={cn(
              "backdrop-blur-xl bg-black/50 border border-white/10",
              "hover:bg-black/70 hover:border-cyan-500/50",
              "rounded-none w-12 h-12",
              "transition-colors duration-200"
            )}
            title="HUD Mode"
          >
            <Maximize2 className="w-5 h-5 text-cyan-400" />
          </Button>
        </div>
        
        {/* Speed HUD - Draggable for user customization */}
        <DraggableContainer
          storageKey="speedHudPosition"
          defaultPosition={{ x: 0, y: 80 }}
          showHandle={true}
          className="left-1/2 -translate-x-1/2 pointer-events-auto"
        >
          <div 
            className="flex flex-col items-center gap-3 transition-opacity duration-200"
            style={{ opacity: speedometerOpacity }}
          >
            <SpeedometerPro
              speed={displaySpeed}
              speedLimit={speedLimit}
              unit={speedUnit}
              isSpeeding={isSpeeding}
              isOverLimit={isOverLimit}
              speedingDuration={speedingDuration}
              alertDelay={alertDelay}
              theme={theme}
              displayMode="digital"
            />
            <SpeedLimitSign
              speedLimit={speedLimit}
              lastKnownLimit={lastKnownSpeedLimitRef.current}
              roadName={roadName}
              lastKnownRoadName={lastKnownRoadNameRef.current}
              isLoading={isLoadingSpeedLimit}
              isCached={isUsingCache}
              theme={theme}
            />
          </div>
        </DraggableContainer>
        
        {/* Draggable Compass */}
        <DraggableCompass theme={theme} enabled={compassEnabled} />
        
        {/* Loading indicator */}
        {isLoadingLocation && !demoMode && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
            <div className="backdrop-blur-xl bg-black/70 border border-white/10 p-6 rounded-none">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-sky-400 animate-pulse" />
                <span className="text-zinc-300 font-mono text-sm">Acquiring GPS...</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Demo mode indicator */}
        {demoMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2">
            <div className="backdrop-blur-xl bg-green-500/20 border border-green-500/50 px-4 py-2 rounded-full">
              <span className="text-green-400 font-mono text-xs uppercase tracking-wider">
                Demo Mode Active
              </span>
            </div>
          </div>
        )}

        {/* Status indicators */}
        <div className="absolute bottom-4 right-4 pointer-events-auto flex gap-2">
          {/* Recording indicator */}
          {isRecording && (
            <div 
              data-testid="recording-indicator"
              className="backdrop-blur-xl bg-red-500/20 border border-red-500/50 px-3 py-1 rounded-full flex items-center gap-2 animate-pulse"
            >
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span className="text-red-400 font-mono text-xs uppercase tracking-wider">
                REC
              </span>
            </div>
          )}
          
          {/* Offline indicator */}
          {isOffline && (
            <div className="backdrop-blur-xl bg-red-500/20 border border-red-500/30 px-3 py-1 rounded-full flex items-center gap-2">
              <WifiOff className="w-3 h-3 text-red-400" />
              <span className="text-red-400 font-mono text-xs uppercase tracking-wider">
                Offline
              </span>
            </div>
          )}
          
          {/* Cache indicator */}
          {isUsingCache && (
            <div 
              data-testid="cache-indicator"
              className="backdrop-blur-xl bg-yellow-500/20 border border-yellow-500/30 px-3 py-1 rounded-full flex items-center gap-2"
            >
              <Database className="w-3 h-3 text-yellow-400" />
              <span className="text-yellow-400 font-mono text-xs uppercase tracking-wider">
                Cached
              </span>
            </div>
          )}
          
          {/* Voice indicator */}
          {voiceEnabled && (
            <div className="backdrop-blur-xl bg-green-500/20 border border-green-500/30 px-3 py-1 rounded-full flex items-center gap-2">
              <span className="text-sm">{currentLangInfo.flag}</span>
              <span className="text-green-400 font-mono text-xs uppercase tracking-wider">
                Voice
              </span>
            </div>
          )}
          
          {/* Audio indicator */}
          {audioEnabled && (
            <div className="backdrop-blur-xl bg-orange-500/20 border border-orange-500/30 px-3 py-1 rounded-full">
              <span className="text-orange-400 font-mono text-xs uppercase tracking-wider">
                Audio
              </span>
            </div>
          )}
          
          {/* Wake Lock indicator */}
          {wakeLockActive && (
            <div className="backdrop-blur-xl bg-cyan-500/20 border border-cyan-500/30 px-3 py-1 rounded-full flex items-center gap-2">
              <Smartphone className="w-3 h-3 text-cyan-400" />
              <span className="text-cyan-400 font-mono text-xs uppercase tracking-wider">
                Awake
              </span>
            </div>
          )}
          
          {/* Network & Battery Status Badges */}
          <NetworkStatusBadge />
          <BatteryWarningBadge />
          
          {/* Data Saver indicator */}
          {dataSaverEnabled && (
            <div className="backdrop-blur-xl bg-green-500/20 border border-green-500/30 px-3 py-1 rounded-full">
              <span className="text-green-400 font-mono text-xs uppercase tracking-wider">
                Data Saver
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Features Panel */}
      <FeaturesPanel 
        isOpen={showFeaturesPanel} 
        onClose={() => setShowFeaturesPanel(false)}
        currentPosition={currentPosition}
      />
    </div>
  );
}
