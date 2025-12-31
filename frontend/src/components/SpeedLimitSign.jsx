import { cn } from "@/lib/utils";
import { Database, RefreshCw, ParkingCircle } from "lucide-react";

// Road types that are typically parking lots or private areas without posted limits
const PARKING_ROAD_TYPES = ['service', 'parking_aisle', 'driveway'];

// Road types that are public roads where you'd be driving (not parked stationary)
const PUBLIC_ROAD_TYPES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified'];

export const SpeedLimitSign = ({ 
  speedLimit, 
  lastKnownLimit, 
  roadName, 
  lastKnownRoadName, 
  roadType,
  currentSpeed = 0,
  isLoading, 
  isCached, 
  hideInParkingLots = true,  // Auto-hide in parking areas
  theme = "dark" 
}) => {
  // Check if we're in a parking lot / service area
  const isInParkingArea = PARKING_ROAD_TYPES.includes(roadType);
  
  // Key insight: If you're parked (0 mph) and the app shows you're on a public road,
  // you're almost certainly in a parking lot NEAR that road, not ON it.
  // Real scenario: parked in a shopping center lot next to "Como Avenue"
  const isLikelyParkedNearRoad = (
    currentSpeed < 3 &&  // Essentially stopped (< 3 mph)
    PUBLIC_ROAD_TYPES.includes(roadType)  // API says we're on a public road
  );
  
  // Auto-hide conditions:
  // 1. In a parking lot (service road) - ALWAYS show parking indicator
  // 2. Going very slow (< 10 mph) with no data (likely parked)
  // 3. Road type is explicitly "service" from the API (parking lot detected)
  // 4. Stopped (< 3 mph) while supposedly on a public road = probably in adjacent lot
  const shouldShowParkingIndicator = hideInParkingLots && (
    isInParkingArea ||  // Always show parking indicator when roadType is service/parking
    (currentSpeed < 10 && !speedLimit && !lastKnownLimit) ||
    isLikelyParkedNearRoad  // Parked near a public road = in parking lot
  );
  
  // Show parking indicator when in parking area (regardless of cached speed limits)
  if (shouldShowParkingIndicator) {
    return (
      <div 
        data-testid="speed-limit-parking"
        className={cn(
          "backdrop-blur-xl border p-3 rounded-none",
          theme === "dark" ? "bg-black/50 border-white/10" : "bg-white/80 border-gray-300"
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <div className={cn(
            "w-28 h-28 rounded-full border-[8px] flex flex-col items-center justify-center",
            theme === "dark" ? "border-zinc-600 bg-zinc-900/50" : "border-gray-400 bg-gray-100"
          )}>
            <ParkingCircle className={cn(
              "w-8 h-8 mb-1",
              theme === "dark" ? "text-blue-400" : "text-blue-600"
            )} />
            <span className={cn(
              "text-lg font-bold",
              theme === "dark" ? "text-zinc-400" : "text-gray-500"
            )}>SLOW</span>
          </div>
          <span className={cn(
            "text-xs font-mono uppercase tracking-wider",
            theme === "dark" ? "text-zinc-500" : "text-gray-500"
          )}>
            Private Area
          </span>
        </div>
      </div>
    );
  }

  // Always prefer to show a number - use lastKnownLimit as fallback
  const displayLimit = speedLimit || lastKnownLimit;
  const displayRoadName = roadName || lastKnownRoadName;
  const isUsingLastKnown = !speedLimit && lastKnownLimit;

  // Only show "?" if we truly have never had a speed limit
  if (!displayLimit) {
    return (
      <div 
        data-testid="speed-limit-unknown"
        className={cn(
          "backdrop-blur-xl border p-3 rounded-none",
          theme === "dark" ? "bg-black/50 border-white/10" : "bg-white/80 border-gray-300"
        )}
      >
        <div className="flex flex-col items-center gap-2">
          <div className={cn(
            "w-28 h-28 rounded-full border-[8px] flex items-center justify-center",
            isLoading ? "animate-pulse" : "",
            theme === "dark" ? "border-zinc-600" : "border-gray-400"
          )}>
            <span className={cn(
              "text-3xl font-bold",
              theme === "dark" ? "text-zinc-500" : "text-gray-500"
            )}>{isLoading ? "..." : "?"}</span>
          </div>
          <span className={cn(
            "text-xs font-mono uppercase tracking-wider",
            theme === "dark" ? "text-zinc-500" : "text-gray-500"
          )}>
            {isLoading ? "Loading" : "No Data"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div 
      data-testid="speed-limit-sign"
      className={cn(
        "backdrop-blur-xl border p-3 rounded-none",
        theme === "dark" ? "bg-black/50 border-white/10" : "bg-white/80 border-gray-300",
        (isCached || isUsingLastKnown) && "border-yellow-500/30"
      )}
    >
      <div className="flex flex-col items-center gap-2">
        {/* Speed Limit Sign - US Style - Larger to match speedometer */}
        <div 
          className={cn(
            "w-28 h-28 rounded-full",
            "bg-white border-[8px] border-red-600",
            "flex items-center justify-center",
            "shadow-lg relative",
            isLoading && "opacity-70"
          )}
        >
          <span 
            data-testid="speed-limit-value"
            className="text-5xl font-black text-black font-chivo"
          >
            {displayLimit}
          </span>
          
          {/* Loading/refresh indicator */}
          {isLoading && (
            <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-1">
              <RefreshCw className="w-3 h-3 text-white animate-spin" />
            </div>
          )}
          
          {/* Cache/last known indicator */}
          {!isLoading && (isCached || isUsingLastKnown) && (
            <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-1">
              <Database className="w-3 h-3 text-black" />
            </div>
          )}
        </div>
        
        {/* Label */}
        <span className={cn(
          "text-xs font-mono uppercase tracking-[0.15em]",
          theme === "dark" ? "text-zinc-400" : "text-gray-600"
        )}>
          LIMIT
        </span>
        
        {/* Road name if available */}
        {displayRoadName && (
          <div className={cn(
            "px-3 py-1 rounded",
            theme === "dark" ? "bg-zinc-800/50" : "bg-gray-200/80"
          )}>
            <span 
              data-testid="road-name"
              className={cn(
                "text-xs font-mono truncate max-w-[120px] block",
                theme === "dark" ? "text-zinc-300" : "text-gray-700",
                isUsingLastKnown && "opacity-70"
              )}
            >
              {displayRoadName}
            </span>
          </div>
        )}
        
        {/* Status indicator */}
        {(isCached || isUsingLastKnown) && !isLoading && (
          <div className="flex items-center gap-1 text-yellow-500">
            <Database className="w-3 h-3" />
            <span className="text-[10px] font-mono uppercase tracking-wider">
              {isUsingLastKnown ? "Last Known" : "Cached"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
