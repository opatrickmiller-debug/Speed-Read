import { cn } from "@/lib/utils";

export const SpeedLimitSign = ({ speedLimit, roadName, isLoading }) => {
  if (isLoading) {
    return (
      <div 
        data-testid="speed-limit-loading"
        className="backdrop-blur-xl bg-black/50 border border-white/10 p-4 rounded-none"
      >
        <div className="w-20 h-20 rounded-full border-4 border-zinc-700 flex items-center justify-center animate-pulse">
          <span className="text-zinc-600 text-sm font-mono">...</span>
        </div>
      </div>
    );
  }

  if (!speedLimit) {
    return (
      <div 
        data-testid="speed-limit-unknown"
        className="backdrop-blur-xl bg-black/50 border border-white/10 p-4 rounded-none"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-full border-4 border-zinc-600 flex items-center justify-center">
            <span className="text-zinc-500 text-xl font-bold">?</span>
          </div>
          <span className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
            No Data
          </span>
        </div>
      </div>
    );
  }

  return (
    <div 
      data-testid="speed-limit-sign"
      className="backdrop-blur-xl bg-black/50 border border-white/10 p-4 rounded-none"
    >
      <div className="flex flex-col items-center gap-3">
        {/* Speed Limit Sign - US Style */}
        <div 
          className={cn(
            "w-20 h-20 rounded-full",
            "bg-white border-[6px] border-red-600",
            "flex items-center justify-center",
            "shadow-lg"
          )}
        >
          <span 
            data-testid="speed-limit-value"
            className="text-3xl font-black text-black font-chivo"
          >
            {speedLimit}
          </span>
        </div>
        
        {/* Label */}
        <span className="text-xs text-zinc-400 font-mono uppercase tracking-[0.15em]">
          LIMIT
        </span>
        
        {/* Road name if available */}
        {roadName && (
          <div className="mt-1 px-3 py-1 bg-zinc-800/50 rounded">
            <span 
              data-testid="road-name"
              className="text-xs text-zinc-300 font-mono truncate max-w-[120px] block"
            >
              {roadName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
