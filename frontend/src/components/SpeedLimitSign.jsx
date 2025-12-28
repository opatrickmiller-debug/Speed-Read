import { cn } from "@/lib/utils";
import { Database } from "lucide-react";

export const SpeedLimitSign = ({ speedLimit, roadName, isLoading, isCached, theme = "dark" }) => {
  if (isLoading) {
    return (
      <div 
        data-testid="speed-limit-loading"
        className={cn(
          "backdrop-blur-xl border p-3 rounded-none",
          theme === "dark" ? "bg-black/50 border-white/10" : "bg-white/80 border-gray-300"
        )}
      >
        <div className={cn(
          "w-28 h-28 rounded-full border-[8px] flex items-center justify-center animate-pulse",
          theme === "dark" ? "border-zinc-700" : "border-gray-300"
        )}>
          <span className={cn(
            "text-lg font-mono",
            theme === "dark" ? "text-zinc-600" : "text-gray-400"
          )}>...</span>
        </div>
      </div>
    );
  }

  if (!speedLimit) {
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
            theme === "dark" ? "border-zinc-600" : "border-gray-400"
          )}>
            <span className={cn(
              "text-3xl font-bold",
              theme === "dark" ? "text-zinc-500" : "text-gray-500"
            )}>?</span>
          </div>
          <span className={cn(
            "text-xs font-mono uppercase tracking-wider",
            theme === "dark" ? "text-zinc-500" : "text-gray-500"
          )}>
            No Data
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
        isCached && "border-yellow-500/30"
      )}
    >
      <div className="flex flex-col items-center gap-2">
        {/* Speed Limit Sign - US Style - Larger to match speedometer */}
        <div 
          className={cn(
            "w-28 h-28 rounded-full",
            "bg-white border-[8px] border-red-600",
            "flex items-center justify-center",
            "shadow-lg relative"
          )}
        >
          <span 
            data-testid="speed-limit-value"
            className="text-5xl font-black text-black font-chivo"
          >
            {speedLimit}
          </span>
          
          {/* Cache indicator on sign */}
          {isCached && (
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
        {roadName && (
          <div className={cn(
            "px-3 py-1 rounded",
            theme === "dark" ? "bg-zinc-800/50" : "bg-gray-200/80"
          )}>
            <span 
              data-testid="road-name"
              className={cn(
                "text-xs font-mono truncate max-w-[120px] block",
                theme === "dark" ? "text-zinc-300" : "text-gray-700"
              )}
            >
              {roadName}
            </span>
          </div>
        )}
        
        {/* Cached data indicator */}
        {isCached && (
          <div className="flex items-center gap-1 text-yellow-500">
            <Database className="w-3 h-3" />
            <span className="text-[10px] font-mono uppercase tracking-wider">
              Cached
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
