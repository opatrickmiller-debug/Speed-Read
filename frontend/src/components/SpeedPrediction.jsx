import { useState, useEffect, useRef, useCallback } from "react";
import { AlertTriangle, Navigation, ArrowDown, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Format distance for prediction display
 * Shows meters for short distances, converts to display unit for longer ones
 */
const formatPredictionDistance = (meters, speedUnit = 'mph') => {
  const isMetricUnit = speedUnit === 'km/h';
  
  if (isMetricUnit) {
    // Metric: show meters for < 1000m, km for >= 1000m
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  } else {
    // Imperial: show feet for < 1000ft (~305m), miles for longer
    const feet = meters * 3.28084;
    if (feet < 1000) {
      return `${Math.round(feet)}ft`;
    }
    const miles = meters / 1609.34;
    return `${miles.toFixed(1)}mi`;
  }
};

/**
 * Convert speed limit to display unit
 * Backend returns speed in the road's native unit (usually mph in US)
 */
const formatPredictionSpeed = (speed, sourceUnit, targetUnit = 'mph') => {
  // Normalize units for comparison
  const normalizedSourceUnit = sourceUnit === 'kmh' ? 'km/h' : sourceUnit;
  const normalizedTargetUnit = targetUnit === 'kmh' ? 'km/h' : targetUnit;
  
  // If the speed is already in user's preferred unit, return as-is
  if (normalizedSourceUnit === normalizedTargetUnit) {
    return { value: Math.round(speed), unit: normalizedTargetUnit };
  }
  
  // Convert if needed
  if (normalizedSourceUnit === 'km/h' && normalizedTargetUnit === 'mph') {
    return { value: Math.round(speed * 0.621371), unit: 'mph' };
  }
  if (normalizedSourceUnit === 'mph' && normalizedTargetUnit === 'km/h') {
    return { value: Math.round(speed * 1.60934), unit: 'km/h' };
  }
  
  return { value: Math.round(speed), unit: normalizedTargetUnit };
};

/**
 * Hook to calculate bearing/heading from GPS movement
 */
export function useBearing() {
  const [bearing, setBearing] = useState(0);
  const prevPositionRef = useRef(null);

  const updateBearing = useCallback((newLat, newLon) => {
    if (prevPositionRef.current) {
      const { lat: prevLat, lon: prevLon } = prevPositionRef.current;
      
      // Calculate bearing between two points
      const dLon = (newLon - prevLon) * Math.PI / 180;
      const lat1 = prevLat * Math.PI / 180;
      const lat2 = newLat * Math.PI / 180;
      
      const y = Math.sin(dLon) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
      
      let brng = Math.atan2(y, x) * 180 / Math.PI;
      brng = (brng + 360) % 360; // Normalize to 0-360
      
      // Only update if there's meaningful movement (>5 meters)
      const R = 6371000;
      const dLat = (newLat - prevLat) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      
      if (distance > 5) {
        setBearing(brng);
      }
    }
    
    prevPositionRef.current = { lat: newLat, lon: newLon };
  }, []);

  return { bearing, updateBearing };
}

/**
 * Hook to fetch speed predictions
 * Now includes road type for smarter filtering (ignores side streets when on highways)
 */
export function useSpeedPrediction(position, bearing, currentSpeedLimit, currentRoadType, enabled = true) {
  const [prediction, setPrediction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastFetchRef = useRef(0);

  useEffect(() => {
    if (!enabled || !position || bearing === null) return;

    const fetchPrediction = async () => {
      const now = Date.now();
      // Throttle to every 10 seconds
      if (now - lastFetchRef.current < 10000) return;
      lastFetchRef.current = now;

      setIsLoading(true);
      try {
        const params = {
          lat: position.lat,
          lon: position.lng,
          bearing: bearing
        };
        
        if (currentSpeedLimit) {
          params.current_speed_limit = currentSpeedLimit;
        }
        
        // Pass road type so backend can filter appropriately
        if (currentRoadType) {
          params.current_road_type = currentRoadType;
        }

        const response = await axios.get(`${BACKEND_URL}/api/speed-ahead`, { params });
        setPrediction(response.data);
      } catch (error) {
        console.error("Speed prediction error:", error);
        setPrediction(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrediction();
  }, [position, bearing, currentSpeedLimit, currentRoadType, enabled]);

  return { prediction, isLoading };
}

/**
 * Speed Prediction Warning Banner
 */
export function SpeedPredictionBanner({ 
  prediction, 
  currentSpeedLimit, 
  speedUnit,
  theme = "dark",
  onDismiss 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Reset dismissed state when warning changes - using a ref to track previous warning
  const prevWarningRef = useRef(prediction?.warning);
  
  if (prediction?.warning !== prevWarningRef.current) {
    prevWarningRef.current = prediction?.warning;
    if (prediction?.warning && isDismissed) {
      setIsDismissed(false);
    }
  }

  if (!prediction || isDismissed) return null;

  const { warning, upcoming_limits, current_direction } = prediction;
  
  // Check if there's a lower speed zone ahead
  const hasLowerZone = upcoming_limits?.some(
    limit => currentSpeedLimit && limit.speed_limit < currentSpeedLimit
  );

  if (!warning && !hasLowerZone) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={cn(
        "absolute top-16 left-1/2 -translate-x-1/2 z-30",
        "pointer-events-auto",
        "transition-all duration-300",
        isExpanded ? "w-80" : "w-auto"
      )}
    >
      <div
        className={cn(
          "backdrop-blur-xl rounded-lg overflow-hidden",
          "border shadow-lg",
          warning?.includes("SLOW DOWN")
            ? "bg-red-500/90 border-red-400"
            : "bg-amber-500/90 border-amber-400"
        )}
      >
        {/* Main Warning */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn(
              "w-5 h-5",
              warning?.includes("SLOW DOWN") ? "text-white animate-pulse" : "text-amber-900"
            )} />
            <span className={cn(
              "font-bold text-sm",
              warning?.includes("SLOW DOWN") ? "text-white" : "text-amber-900"
            )}>
              {warning || `Lower speed zone ahead`}
            </span>
          </div>
          <ChevronDown className={cn(
            "w-4 h-4 transition-transform",
            warning?.includes("SLOW DOWN") ? "text-white" : "text-amber-900",
            isExpanded && "rotate-180"
          )} />
        </button>

        {/* Expanded Details */}
        {isExpanded && upcoming_limits?.length > 0 && (
          <div className={cn(
            "px-4 pb-3 space-y-2 border-t",
            warning?.includes("SLOW DOWN") 
              ? "border-red-400/50 bg-red-600/50" 
              : "border-amber-400/50 bg-amber-600/50"
          )}>
            <div className="flex items-center gap-2 pt-2 text-xs text-white/80">
              <Navigation className="w-3 h-3" />
              <span>Heading {current_direction || 'N'}</span>
            </div>
            
            {upcoming_limits.map((limit, idx) => {
              const formattedSpeed = formatPredictionSpeed(limit.speed_limit, limit.unit, speedUnit);
              return (
                <div 
                  key={idx}
                  className={cn(
                    "flex items-center justify-between text-sm",
                    "text-white"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <ArrowDown className="w-3 h-3" />
                    <span className="font-mono">{formatPredictionDistance(limit.distance_meters, speedUnit)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-white/70">{limit.road_name}</span>
                    <span className={cn(
                      "font-bold px-2 py-0.5 rounded",
                      limit.speed_limit < currentSpeedLimit 
                        ? "bg-red-700" 
                        : "bg-green-700"
                    )}>
                      {formattedSpeed.value} {formattedSpeed.unit}
                    </span>
                  </span>
                </div>
              );
            })}

            <button
              onClick={handleDismiss}
              className="w-full mt-2 py-1 text-xs text-white/70 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact Speed Prediction Indicator
 */
export function SpeedPredictionIndicator({ 
  prediction, 
  currentSpeedLimit,
  onClick 
}) {
  if (!prediction?.upcoming_limits?.length) return null;

  const hasLowerZone = prediction.upcoming_limits.some(
    limit => currentSpeedLimit && limit.speed_limit < currentSpeedLimit
  );

  if (!hasLowerZone) return null;

  const lowestUpcoming = prediction.upcoming_limits
    .filter(l => l.speed_limit < currentSpeedLimit)
    .sort((a, b) => a.distance_meters - b.distance_meters)[0];

  const formattedSpeed = formatPredictionSpeed(lowestUpcoming.speed_limit, lowestUpcoming.unit);
  const formattedDistance = formatPredictionDistance(lowestUpcoming.distance_meters);

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full",
        "backdrop-blur-xl border transition-all",
        "animate-pulse",
        lowestUpcoming.distance_meters <= 200
          ? "bg-red-500/30 border-red-500/50 text-red-400"
          : "bg-amber-500/30 border-amber-500/50 text-amber-400"
      )}
    >
      <AlertTriangle className="w-4 h-4" />
      <span className="text-xs font-mono font-bold">
        {formattedSpeed.value} {formattedSpeed.unit} in {formattedDistance}
      </span>
    </button>
  );
}
