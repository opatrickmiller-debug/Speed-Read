import { useState, useEffect, useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { MapPin, Crosshair, WifiOff, Database } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

import { Speedometer } from "@/components/Speedometer";
import { SpeedLimitSign } from "@/components/SpeedLimitSign";
import { AlertOverlay, AVAILABLE_LANGUAGES } from "@/components/AlertOverlay";
import { SettingsPanel } from "@/components/SettingsPanel";
import { TripHistory } from "@/components/TripHistory";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  cacheSpeedLimit, 
  getCachedSpeedLimit, 
  getCacheStats,
  isOnline 
} from "@/utils/speedLimitCache";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Dark map style for HUD aesthetic
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#64779e" }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
  { featureType: "landscape.man_made", elementType: "geometry.stroke", stylers: [{ color: "#334e87" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#023e58" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#283d6a" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6f9ba5" }] },
  { featureType: "poi", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
  { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#023e58" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#3C7680" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
  { featureType: "road", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2c6675" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#255763" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#b0d5ce" }] },
  { featureType: "road.highway", elementType: "labels.text.stroke", stylers: [{ color: "#023e58" }] },
  { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
  { featureType: "transit", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
  { featureType: "transit.line", elementType: "geometry.fill", stylers: [{ color: "#283d6a" }] },
  { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#3a4762" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4e6d70" }] },
];

const mapContainerStyle = {
  width: "100%",
  height: "100vh",
};

const defaultCenter = {
  lat: 37.7749,
  lng: -122.4194,
};

export default function SpeedMap() {
  // Map state
  const [map, setMap] = useState(null);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  
  // Speed state
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [speedLimit, setSpeedLimit] = useState(null);
  const [roadName, setRoadName] = useState(null);
  const [isLoadingSpeedLimit, setIsLoadingSpeedLimit] = useState(false);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // Settings state
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceLanguage, setVoiceLanguage] = useState("en");
  const [speedUnit, setSpeedUnit] = useState("mph");
  const [thresholdOffset, setThresholdOffset] = useState(5);
  const [demoMode, setDemoMode] = useState(false);
  const [offlineCacheEnabled, setOfflineCacheEnabled] = useState(true);
  
  // Trip recording state
  const [isRecording, setIsRecording] = useState(false);
  const [currentTripId, setCurrentTripId] = useState(null);
  const [currentTripStats, setCurrentTripStats] = useState(null);
  const tripDataRef = useRef({ speeds: [], alerts: 0 });
  
  // Demo mode state
  const demoIntervalRef = useRef(null);
  const [demoSpeed, setDemoSpeed] = useState(0);
  
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

  // Load Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // Calculate if speeding
  const displaySpeed = demoMode ? demoSpeed : currentSpeed;
  const effectiveLimit = speedLimit ? speedLimit + thresholdOffset : null;
  const isSpeeding = effectiveLimit !== null && displaySpeed > effectiveLimit;

  // Get current language info for display
  const currentLangInfo = AVAILABLE_LANGUAGES.find(l => l.code === voiceLanguage) || AVAILABLE_LANGUAGES[0];

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
  
  // Record data point during trip
  const recordDataPoint = useCallback(async (lat, lon, speed, limit, speeding) => {
    if (!isRecording || !currentTripId) return;
    
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
      
      const { speed_limit, unit, road_name } = response.data;
      
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
        setSpeedLimit(convertedLimit);
        setRoadName(road_name);
        setIsUsingCache(false);
      } else {
        setSpeedLimit(null);
        setRoadName(null);
        setIsUsingCache(false);
      }
    } catch (error) {
      console.error("Error fetching speed limit:", error);
      
      // Fallback to cache on error
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
          setIsUsingCache(true);
        }
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
        
        if (map) {
          map.panTo({ lat: latitude, lng: longitude });
        }
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
  }, [map, calculateSpeed, fetchSpeedLimit, demoMode]);

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

  // Center map on current position
  const centerOnPosition = useCallback(() => {
    if (currentPosition && map) {
      map.panTo(currentPosition);
      map.setZoom(17);
    }
  }, [currentPosition, map]);

  const onMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  if (loadError) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center text-red-500">
          <p className="text-xl font-mono">Map failed to load</p>
          <p className="text-sm text-zinc-500 mt-2">Check your Google Maps API key</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="speed-map-page" className="relative h-screen w-screen overflow-hidden bg-zinc-950">
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
      />
      
      {/* Google Map */}
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={currentPosition || defaultCenter}
          zoom={17}
          onLoad={onMapLoad}
          options={{
            styles: darkMapStyle,
            disableDefaultUI: true,
            zoomControl: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          }}
        >
          {currentPosition && (
            <Marker
              position={currentPosition}
              icon={{
                path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                scale: 10,
                fillColor: isSpeeding ? "#ef4444" : "#38bdf8",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 3,
              }}
            />
          )}
        </GoogleMap>
      ) : (
        <div className="h-full w-full flex items-center justify-center">
          <div className="text-zinc-500 font-mono animate-pulse">Loading map...</div>
        </div>
      )}
      
      {/* HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none">
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
            demoMode={demoMode}
            setDemoMode={setDemoMode}
            offlineCacheEnabled={offlineCacheEnabled}
            setOfflineCacheEnabled={setOfflineCacheEnabled}
          />
        </div>
        
        {/* Center on location button + Trip History */}
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
        </div>
        
        {/* Speed HUD */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 md:bottom-auto md:top-24 md:left-8 md:translate-x-0 pointer-events-auto">
          <div className="flex flex-col md:flex-row gap-4 items-center md:items-start">
            <Speedometer
              speed={displaySpeed}
              speedLimit={speedLimit}
              unit={speedUnit}
              isSpeeding={isSpeeding}
            />
            <SpeedLimitSign
              speedLimit={speedLimit}
              roadName={roadName}
              isLoading={isLoadingSpeedLimit}
              isCached={isUsingCache}
            />
          </div>
        </div>
        
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
        </div>
      </div>
    </div>
  );
}
