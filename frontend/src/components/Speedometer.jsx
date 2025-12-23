import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const Speedometer = ({ speed, speedLimit, unit, isSpeeding }) => {
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
    if (!speedLimit) return "text-sky-400";
    const ratio = speed / speedLimit;
    if (ratio >= 1) return "text-red-500";
    if (ratio >= 0.9) return "text-orange-500";
    return "text-sky-400";
  };

  return (
    <div 
      data-testid="speedometer"
      className={cn(
        "flex flex-col items-center justify-center",
        "backdrop-blur-xl bg-black/50 border border-white/10",
        "rounded-none shadow-2xl",
        "p-6 md:p-8 min-w-[200px]",
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
        className="text-xs md:text-sm uppercase tracking-[0.2em] text-zinc-400 font-mono mt-2"
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
        <span className="text-xs uppercase tracking-[0.15em] text-zinc-500 font-mono">
          {isSpeeding ? "OVER LIMIT" : "SAFE"}
        </span>
      </div>
    </div>
  );
};
