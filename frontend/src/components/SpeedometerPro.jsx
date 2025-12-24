import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";

export const SpeedometerPro = ({ 
  speed, 
  speedLimit, 
  unit, 
  isSpeeding, 
  isOverLimit,
  speedingDuration,
  alertDelay,
  theme = "dark",
  displayMode = "digital" // "digital" | "minimal" | "hud"
}) => {
  const [displaySpeed, setDisplaySpeed] = useState(0);
  
  // Animate speed number changes
  useEffect(() => {
    const diff = speed - displaySpeed;
    if (Math.abs(diff) < 1) {
      setDisplaySpeed(speed);
      return;
    }
    
    const step = diff > 0 ? Math.ceil(diff / 3) : Math.floor(diff / 3);
    const timer = setTimeout(() => {
      setDisplaySpeed(prev => prev + step);
    }, 20);
    
    return () => clearTimeout(timer);
  }, [speed, displaySpeed]);

  // Calculate color based on speed vs limit (gradient effect)
  const speedColor = useMemo(() => {
    if (!speedLimit) return { text: "text-sky-400", bg: "bg-sky-500/20", glow: "shadow-sky-500/30" };
    
    const ratio = speed / speedLimit;
    
    if (ratio >= 1.0) {
      // Over limit - RED
      return { 
        text: "text-red-500", 
        bg: "bg-red-500/20", 
        glow: "shadow-red-500/50",
        pulse: true 
      };
    } else if (ratio >= 0.9) {
      // 90-100% - ORANGE/YELLOW warning
      return { 
        text: "text-orange-400", 
        bg: "bg-orange-500/20", 
        glow: "shadow-orange-500/30" 
      };
    } else if (ratio >= 0.75) {
      // 75-90% - YELLOW caution
      return { 
        text: "text-yellow-400", 
        bg: "bg-yellow-500/10", 
        glow: "shadow-yellow-500/20" 
      };
    } else {
      // Under 75% - GREEN/BLUE safe
      return { 
        text: theme === "dark" ? "text-emerald-400" : "text-emerald-600", 
        bg: "bg-emerald-500/10", 
        glow: "shadow-emerald-500/20" 
      };
    }
  }, [speed, speedLimit, theme]);

  // HUD Mode - Mirrored for windshield reflection
  if (displayMode === "hud") {
    return (
      <div 
        className={cn(
          "flex flex-col items-center justify-center p-8",
          "bg-black min-h-screen",
          "transform scale-x-[-1]" // Mirror horizontally
        )}
        style={{ transform: "scaleX(-1)" }}
      >
        <span 
          className={cn(
            "font-black tabular-nums tracking-tighter",
            "text-[12rem] leading-none",
            speedColor.text
          )}
        >
          {Math.round(displaySpeed)}
        </span>
        {speedLimit && (
          <div className="flex items-center gap-4 mt-4">
            <span className="text-4xl text-zinc-600 font-bold">
              LIMIT
            </span>
            <span className={cn(
              "text-6xl font-black",
              isSpeeding ? "text-red-500" : "text-zinc-400"
            )}>
              {speedLimit}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Minimal Mode - Just the essentials
  if (displayMode === "minimal") {
    return (
      <div className="flex flex-col items-center">
        <span 
          className={cn(
            "font-black tabular-nums tracking-tighter",
            "text-8xl md:text-9xl",
            speedColor.text
          )}
        >
          {Math.round(displaySpeed)}
        </span>
        <span className={cn(
          "text-sm uppercase tracking-widest mt-1",
          theme === "dark" ? "text-zinc-500" : "text-gray-500"
        )}>
          {unit}
        </span>
      </div>
    );
  }

  // Digital Mode (Default) - Full featured
  return (
    <div 
      data-testid="speedometer-pro"
      className={cn(
        "relative flex flex-col items-center justify-center",
        "backdrop-blur-xl border rounded-2xl",
        "p-6 md:p-8 min-w-[220px]",
        "transition-all duration-300",
        theme === "dark" 
          ? "bg-black/60 border-white/10" 
          : "bg-white/80 border-gray-200",
        speedColor.pulse && "animate-pulse",
        isSpeeding && "border-red-500/50 shadow-lg shadow-red-500/20"
      )}
    >
      {/* Speed limit indicator ring */}
      {speedLimit && (
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          <div 
            className={cn(
              "absolute bottom-0 left-0 right-0 transition-all duration-500",
              speedColor.bg
            )}
            style={{ 
              height: `${Math.min(100, (speed / speedLimit) * 100)}%`,
              opacity: 0.3
            }}
          />
        </div>
      )}

      {/* Current Speed */}
      <div className="relative z-10">
        <span 
          data-testid="current-speed"
          className={cn(
            "font-black tabular-nums tracking-tighter block text-center",
            "text-[6rem] md:text-[8rem] leading-none",
            speedColor.text,
            "transition-colors duration-300",
            "drop-shadow-lg"
          )}
          style={{ 
            fontVariantNumeric: "tabular-nums",
            textShadow: isSpeeding ? "0 0 30px rgba(239, 68, 68, 0.5)" : "none"
          }}
        >
          {Math.round(displaySpeed)}
        </span>
        
        {/* Glow effect when speeding */}
        {isSpeeding && (
          <div className="absolute inset-0 blur-3xl bg-red-500/40 -z-10 animate-pulse" />
        )}
      </div>
      
      {/* Unit label */}
      <span 
        data-testid="speed-unit"
        className={cn(
          "text-sm md:text-base uppercase tracking-[0.3em] font-mono mt-2",
          theme === "dark" ? "text-zinc-400" : "text-gray-500"
        )}
      >
        {unit}
      </span>
      
      {/* Speed limit comparison bar */}
      {speedLimit && (
        <div className="w-full mt-4 px-2">
          <div className="flex justify-between text-xs font-mono mb-1">
            <span className={theme === "dark" ? "text-zinc-500" : "text-gray-500"}>0</span>
            <span className={cn(
              "font-bold",
              isSpeeding ? "text-red-400" : theme === "dark" ? "text-zinc-400" : "text-gray-600"
            )}>
              {speedLimit}
            </span>
          </div>
          <div className={cn(
            "h-2 rounded-full overflow-hidden",
            theme === "dark" ? "bg-zinc-800" : "bg-gray-200"
          )}>
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-300",
                speed >= speedLimit ? "bg-red-500" :
                speed >= speedLimit * 0.9 ? "bg-orange-500" :
                speed >= speedLimit * 0.75 ? "bg-yellow-500" :
                "bg-emerald-500"
              )}
              style={{ width: `${Math.min(100, (speed / speedLimit) * 100)}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Status indicator */}
      <div className="mt-4 flex items-center gap-2">
        <div 
          className={cn(
            "w-2.5 h-2.5 rounded-full transition-colors",
            isSpeeding ? "bg-red-500 animate-pulse" : 
            isOverLimit ? "bg-orange-500 animate-pulse" : 
            "bg-emerald-500"
          )}
        />
        <span className={cn(
          "text-xs uppercase tracking-[0.15em] font-mono font-medium",
          isSpeeding ? "text-red-400" :
          isOverLimit ? "text-orange-400" :
          theme === "dark" ? "text-zinc-400" : "text-gray-500"
        )}>
          {isSpeeding ? "OVER LIMIT" : 
           isOverLimit ? `ALERT IN ${Math.ceil(alertDelay - speedingDuration)}s` : 
           "SAFE"}
        </span>
      </div>
    </div>
  );
};
