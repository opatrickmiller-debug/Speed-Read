import { useState, useEffect } from "react";
import { Navigation } from "lucide-react";
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
 * Simple Compass Badge Component
 * Shows direction of travel (arrow always points up = forward)
 */
export function CompassBadge({ heading, size = "md", theme = "dark" }) {
  const direction = getCardinalDirection(heading);
  
  const sizes = {
    sm: "w-12 h-12 text-xs",
    md: "w-16 h-16 text-sm",
    lg: "w-20 h-20 text-base"
  };

  return (
    <div 
      className={cn(
        "relative flex flex-col items-center justify-center rounded-full",
        "backdrop-blur-xl border-2 transition-all",
        theme === "dark" 
          ? "bg-black/70 border-white/20" 
          : "bg-white/70 border-black/20",
        sizes[size]
      )}
    >
      {/* Arrow always points UP (direction of travel) */}
      <Navigation 
        className={cn(
          "transition-transform duration-300",
          theme === "dark" ? "text-cyan-400" : "text-cyan-600",
          size === "sm" ? "w-4 h-4" : size === "md" ? "w-5 h-5" : "w-6 h-6"
        )}
        style={{ 
          transform: 'rotate(0deg)'  // Always pointing up/forward
        }}
      />
      
      {/* Cardinal direction (W, N, E, S, etc.) */}
      <div className={cn(
        "font-mono font-bold",
        theme === "dark" ? "text-white" : "text-black",
        size === "sm" ? "text-xs" : "text-sm"
      )}>
        {heading !== null ? direction.short : '--'}
      </div>
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
      storageKey="compassPositionV2"
      defaultPosition={getDefaultPosition()}
      className="pointer-events-auto"
    >
      <CompassBadge heading={heading} size="md" theme={theme} />
    </DraggableContainer>
  );
}

export default DraggableCompass;
