import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const Speedometer = ({ speed, speedLimit, unit, isSpeeding, isOverLimit, speedingDuration, alertDelay, theme = "dark" }) => {
  const [displaySpeed, setDisplaySpeed] = useState(0);
  
  // Animate speed number changes
  useEffect(() => {
    const diff = speed - displaySpeed;
    if (Math.abs(diff) < 1) {
      setDisplaySpeed(speed);
      return;
    }
    
    const step = diff > 0 ? Math.ceil(diff / 5) : Math.floor(diff / 5);
    const timer = setTimeout(() => {
      setDisplaySpeed(prev => prev + step);
    }, 30);
    
    return () => clearTimeout(timer);
  }, [speed, displaySpeed]);

  // Determine color based on speed vs limit
  const getSpeedColor = () => {
    if (!speedLimit) return theme === "dark" ? "text-sky-400" : "text-sky-600";
    if (isSpeeding) return "text-red-500";
    if (isOverLimit) return "text-orange-500"; // Over limit but waiting for delay
    const ratio = speed / speedLimit;
    if (ratio >= 0.9) return "text-orange-500";
    return theme === "dark" ? "text-sky-400" : "text-sky-600";
  };

  return (
    <div 
      data-testid="speedometer"
      className={cn(
        "flex flex-col items-center justify-center",
        "backdrop-blur-xl border",
        "rounded-none shadow-2xl",
        "p-6 md:p-8 min-w-[200px]",
        theme === "dark" 
          ? "bg-black/50 border-white/10" 
          : "bg-white/80 border-gray-300",
        isSpeeding && "border-red-500/50"
      )}
    >
      {/* Current Speed */}
      <div className="relative">
        <span 
          data-testid="current-speed"
          className={cn(
            "font-black text-8xl md:text-9xl tabular-nums tracking-tighter",
            "font-chivo",
            getSpeedColor()
          )}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {Math.round(displaySpeed)}
        </span>
        
        {/* Glow effect when speeding */}
        {isSpeeding && (
          <div className="absolute inset-0 blur-2xl bg-red-500/30 -z-10" />
        )}
      </div>
      
      {/* Unit label */}
      <span 
        data-testid="speed-unit"
        className={cn(
          "text-xs md:text-sm uppercase tracking-[0.2em] font-mono mt-2",
          theme === "dark" ? "text-zinc-400" : "text-gray-600"
        )}
      >
        {unit}
      </span>
      
      {/* Status indicator */}
      <div className="mt-4 flex items-center gap-2">
        <div 
          className={cn(
            "w-2 h-2 rounded-full",
            isSpeeding ? "bg-red-500 animate-pulse" : "bg-green-500"
          )}
        />
        <span className={cn(
          "text-xs uppercase tracking-[0.15em] font-mono",
          theme === "dark" ? "text-zinc-500" : "text-gray-500"
        )}>
          {isSpeeding ? "OVER LIMIT" : "SAFE"}
        </span>
      </div>
    </div>
  );
};
