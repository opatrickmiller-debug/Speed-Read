import { useState, useEffect } from "react";
import { X, RotateCcw, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export function HUDMode({ 
  speed, 
  speedLimit, 
  unit, 
  isSpeeding,
  onClose 
}) {
  const [brightness, setBrightness] = useState(100);
  const [isReversed, setIsReversed] = useState(true); // Mirror by default for windshield
  const [showControls, setShowControls] = useState(true);

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    if (showControls) {
      const timer = setTimeout(() => setShowControls(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showControls]);

  // Calculate color
  const getColor = () => {
    if (!speedLimit) return "text-cyan-400";
    if (isSpeeding) return "text-red-500";
    if (speed >= speedLimit * 0.9) return "text-orange-400";
    return "text-cyan-400";
  };

  return (
    <div 
      className="fixed inset-0 z-[200] bg-black cursor-pointer"
      onClick={() => setShowControls(true)}
      style={{ 
        opacity: brightness / 100,
      }}
    >
      {/* Main HUD Display */}
      <div 
        className={cn(
          "h-full flex flex-col items-center justify-center",
          "transition-transform duration-300"
        )}
        style={{ 
          transform: isReversed ? "scaleX(-1)" : "none"
        }}
      >
        {/* Speed */}
        <div className="relative">
          <span 
            className={cn(
              "font-black tabular-nums block",
              "text-[14rem] md:text-[18rem] leading-none",
              getColor(),
              isSpeeding && "animate-pulse"
            )}
            style={{
              textShadow: isSpeeding 
                ? "0 0 60px rgba(239, 68, 68, 0.8)" 
                : "0 0 40px rgba(34, 211, 238, 0.4)"
            }}
          >
            {Math.round(speed)}
          </span>
        </div>

        {/* Unit */}
        <span className="text-3xl text-zinc-600 font-mono tracking-[0.5em] mt-2">
          {unit.toUpperCase()}
        </span>

        {/* Speed Limit */}
        {speedLimit && (
          <div className="flex items-center gap-6 mt-8">
            <span className="text-2xl text-zinc-700 font-mono">
              LIMIT
            </span>
            <span 
              className={cn(
                "text-5xl font-black",
                isSpeeding ? "text-red-600" : "text-zinc-500"
              )}
            >
              {speedLimit}
            </span>
          </div>
        )}

        {/* Warning bar */}
        {speedLimit && (
          <div className="absolute bottom-20 left-0 right-0 px-8">
            <div className="h-3 bg-zinc-900 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  isSpeeding ? "bg-red-500" :
                  speed >= speedLimit * 0.9 ? "bg-orange-500" :
                  "bg-cyan-500"
                )}
                style={{ width: `${Math.min(100, (speed / speedLimit) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Controls (tap to show) */}
      {showControls && (
        <div 
          className="absolute top-4 left-0 right-0 flex justify-between items-center px-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="p-3 bg-zinc-800/80 rounded-full text-white hover:bg-zinc-700"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Mirror toggle */}
            <button
              onClick={() => setIsReversed(!isReversed)}
              className={cn(
                "p-3 rounded-full text-white",
                isReversed ? "bg-cyan-600" : "bg-zinc-800/80 hover:bg-zinc-700"
              )}
              title={isReversed ? "Mirror ON (for windshield)" : "Mirror OFF"}
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* Brightness */}
            <div className="flex items-center gap-2 bg-zinc-800/80 rounded-full px-3 py-2">
              <Moon className="w-4 h-4 text-zinc-400" />
              <input
                type="range"
                min="20"
                max="100"
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value))}
                className="w-20 accent-cyan-500"
              />
              <Sun className="w-4 h-4 text-zinc-400" />
            </div>
          </div>
        </div>
      )}

      {/* Tap hint */}
      {!showControls && (
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <span className="text-zinc-700 text-sm font-mono">
            Tap for controls
          </span>
        </div>
      )}
    </div>
  );
}
