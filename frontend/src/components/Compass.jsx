import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { DraggableContainer } from "@/components/DraggableHUD";

/**
 * Hook to get device heading/bearing from GPS or device orientation
 */
export function useCompass() {
  const [heading, setHeading] = useState(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    let watchId = null;

    // Try to get heading from GPS first (more reliable when moving)
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (position.coords.heading !== null && !isNaN(position.coords.heading)) {
            setHeading(Math.round(position.coords.heading));
          }
        },
        (error) => {
          console.log('[Compass] GPS heading not available:', error.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 5000
        }
      );
    }

    // Also try device orientation API as fallback
    const handleOrientation = (event) => {
      if (event.alpha !== null && heading === null) {
        // alpha is the compass direction the device is facing
        // Convert to heading (0 = North, 90 = East, etc.)
        let compassHeading = event.alpha;
        if (event.webkitCompassHeading) {
          // iOS provides this directly
          compassHeading = event.webkitCompassHeading;
        } else if (event.alpha) {
          // Android - alpha is reversed
          compassHeading = 360 - event.alpha;
        }
        setHeading(Math.round(compassHeading));
      }
    };

    // Request permission for device orientation on iOS 13+
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ requires permission
      DeviceOrientationEvent.requestPermission()
        .then(permission => {
          if (permission === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          }
        })
        .catch(console.error);
    } else {
      // Non-iOS or older iOS
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [heading]);

  return { heading, isSupported };
}

/**
 * Get cardinal direction from heading degrees
 */
function getCardinalDirection(heading) {
  if (heading === null) return { short: '--', long: 'Unknown' };
  
  const directions = [
    { short: 'N', long: 'North', min: 337.5, max: 360 },
    { short: 'N', long: 'North', min: 0, max: 22.5 },
    { short: 'NE', long: 'Northeast', min: 22.5, max: 67.5 },
    { short: 'E', long: 'East', min: 67.5, max: 112.5 },
    { short: 'SE', long: 'Southeast', min: 112.5, max: 157.5 },
    { short: 'S', long: 'South', min: 157.5, max: 202.5 },
    { short: 'SW', long: 'Southwest', min: 202.5, max: 247.5 },
    { short: 'W', long: 'West', min: 247.5, max: 292.5 },
    { short: 'NW', long: 'Northwest', min: 292.5, max: 337.5 },
  ];

  for (const dir of directions) {
    if (heading >= dir.min && heading < dir.max) {
      return dir;
    }
  }
  return { short: 'N', long: 'North' };
}

/**
 * Traditional Compass Component
 * Shows direction of travel with rotating N/E/W/S indicators
 */
export function CompassBadge({ heading, size = "md", theme = "dark" }) {
  const direction = getCardinalDirection(heading);
  
  const sizes = {
    sm: { container: "w-14 h-14", text: "text-[8px]", center: "text-xs", arrow: 10 },
    md: { container: "w-18 h-18", text: "text-[10px]", center: "text-sm", arrow: 14 },
    lg: { container: "w-24 h-24", text: "text-xs", center: "text-base", arrow: 18 }
  };
  
  const s = sizes[size] || sizes.md;
  
  // Rotation: negative heading so N points to the direction we're heading
  const rotation = heading !== null ? -heading : 0;

  return (
    <div 
      className={cn(
        "relative flex items-center justify-center rounded-full",
        "backdrop-blur-xl border-2 transition-all",
        theme === "dark" 
          ? "bg-black/80 border-cyan-500/50" 
          : "bg-white/80 border-cyan-600/50",
        size === "sm" ? "w-14 h-14" : size === "lg" ? "w-24 h-24" : "w-[72px] h-[72px]"
      )}
    >
      {/* Rotating compass dial with N/E/S/W */}
      <div 
        className="absolute inset-1 transition-transform duration-300 ease-out"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        {/* North indicator - Red/prominent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className={cn(
            "w-0 h-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent",
            "border-b-red-500"
          )} />
          <span className={cn(
            "font-bold mt-0.5",
            s.text,
            "text-red-500"
          )}>N</span>
        </div>
        
        {/* East indicator */}
        <div className="absolute top-1/2 right-0 -translate-y-1/2 flex items-center">
          <span className={cn(
            "font-bold mr-1",
            s.text,
            theme === "dark" ? "text-white/80" : "text-black/80"
          )}>E</span>
        </div>
        
        {/* South indicator */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <span className={cn(
            "font-bold mb-0.5",
            s.text,
            theme === "dark" ? "text-white/80" : "text-black/80"
          )}>S</span>
        </div>
        
        {/* West indicator */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 flex items-center">
          <span className={cn(
            "font-bold ml-1",
            s.text,
            theme === "dark" ? "text-white/80" : "text-black/80"
          )}>W</span>
        </div>
        
        {/* Tick marks for intermediate directions */}
        <div className="absolute top-[15%] right-[15%] w-1 h-1 rounded-full bg-white/40" />
        <div className="absolute bottom-[15%] right-[15%] w-1 h-1 rounded-full bg-white/40" />
        <div className="absolute bottom-[15%] left-[15%] w-1 h-1 rounded-full bg-white/40" />
        <div className="absolute top-[15%] left-[15%] w-1 h-1 rounded-full bg-white/40" />
      </div>
      
      {/* Center direction indicator (fixed, doesn't rotate) */}
      <div className={cn(
        "relative z-10 flex flex-col items-center justify-center",
        "rounded-full",
        theme === "dark" ? "bg-zinc-900/90" : "bg-white/90",
        size === "sm" ? "w-7 h-7" : size === "lg" ? "w-12 h-12" : "w-9 h-9"
      )}>
        {/* Direction arrow pointing up (direction of travel) */}
        <svg 
          viewBox="0 0 24 24" 
          className={cn(
            "fill-cyan-500",
            size === "sm" ? "w-3 h-3" : size === "lg" ? "w-5 h-5" : "w-4 h-4"
          )}
        >
          <path d="M12 2L8 10H11V22H13V10H16L12 2Z" />
        </svg>
        
        {/* Current heading text */}
        <span className={cn(
          "font-mono font-bold leading-none",
          s.center,
          theme === "dark" ? "text-cyan-400" : "text-cyan-600"
        )}>
          {heading !== null ? direction.short : '--'}
        </span>
      </div>
      
      {/* Outer glow effect */}
      <div className={cn(
        "absolute inset-0 rounded-full pointer-events-none",
        "border",
        theme === "dark" ? "border-cyan-500/20" : "border-cyan-600/20"
      )} />
    </div>
  );
}

/**
 * Draggable Compass Component
 */
export function DraggableCompass({ theme = "dark", enabled = true }) {
  const { heading } = useCompass();

  if (!enabled) return null;

  // Default position: top-right area of screen
  const getDefaultPosition = () => {
    if (typeof window === 'undefined') return { x: 20, y: 80 };
    return { 
      x: window.innerWidth - 100,  // 100px from right edge
      y: 80  // Below status bar
    };
  };

  return (
    <DraggableContainer
      storageKey="compassPositionV3"
      defaultPosition={getDefaultPosition()}
      className="pointer-events-auto"
    >
      <CompassBadge heading={heading} size="md" theme={theme} />
    </DraggableContainer>
  );
}

export default DraggableCompass;
