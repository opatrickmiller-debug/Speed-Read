import { useState } from "react";
import { 
  Smartphone, 
  Battery, 
  Wifi, 
  WifiOff, 
  Download,
  Signal,
  Zap,
  HardDrive,
  RefreshCw
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useNetworkStatus, useBatteryStatus, useInstallPrompt, useOfflineQueue } from "@/utils/mobileOptimizations";

/**
 * Mobile Settings Section for the Settings Panel
 */
export function MobileSettingsSection({
  dataSaverEnabled,
  setDataSaverEnabled,
  lowPowerMode,
  setLowPowerMode,
  theme = "dark",
}) {
  const network = useNetworkStatus();
  const battery = useBatteryStatus();
  const { canInstall, isInstalled, isIOS, promptInstall } = useInstallPrompt();
  const { queueLength } = useOfflineQueue();

  const handleInstall = async () => {
    await promptInstall();
  };

  return (
    <div className="space-y-4">
      {/* Network Status */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono uppercase">
          {network.isOnline ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
          Network Status
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded p-3 space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-zinc-500">Status</span>
            <span className={network.isOnline ? "text-green-400" : "text-red-400"}>
              {network.isOnline ? "Online" : "Offline"}
            </span>
          </div>
          {network.effectiveType !== 'unknown' && (
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-500">Connection</span>
              <span className="text-zinc-300 flex items-center gap-1">
                <Signal className="w-3 h-3" />
                {network.effectiveType.toUpperCase()}
              </span>
            </div>
          )}
          {network.downlink && (
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-500">Speed</span>
              <span className="text-zinc-300">{network.downlink} Mbps</span>
            </div>
          )}
          {queueLength > 0 && (
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-500">Pending sync</span>
              <span className="text-amber-400">{queueLength} items</span>
            </div>
          )}
        </div>
      </div>

      {/* Battery Status */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono uppercase">
          <Battery className={cn(
            "w-4 h-4",
            battery.charging ? "text-green-500" : 
            battery.isLowPower ? "text-red-500" : "text-zinc-400"
          )} />
          Battery Status
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded p-3">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-zinc-500">Level</span>
            <span className={cn(
              battery.isLowPower ? "text-red-400" : "text-zinc-300"
            )}>
              {Math.round(battery.level * 100)}%
              {battery.charging && " ⚡ Charging"}
            </span>
          </div>
          {/* Battery bar */}
          <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-300 rounded-full",
                battery.charging ? "bg-green-500" :
                battery.isLowPower ? "bg-red-500" :
                battery.level < 0.5 ? "bg-amber-500" : "bg-green-500"
              )}
              style={{ width: `${battery.level * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Data Saver Mode */}
      <div className="space-y-2 pt-4 border-t border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Download className={cn(
              "w-5 h-5",
              dataSaverEnabled ? "text-green-500" : "text-zinc-500"
            )} />
            <div>
              <span className="text-sm font-medium text-zinc-200 font-mono uppercase tracking-wider block">
                Data Saver
              </span>
              <span className="text-xs text-zinc-500">
                Reduce cellular data usage
              </span>
            </div>
          </div>
          <Switch
            checked={dataSaverEnabled}
            onCheckedChange={setDataSaverEnabled}
            className="data-[state=checked]:bg-green-500"
          />
        </div>
        {dataSaverEnabled && (
          <div className="pl-8 text-xs text-green-400/70 font-mono space-y-1">
            <p>• Speed limit checks: every 15s (vs 5s)</p>
            <p>• Weather updates: every 5 min (vs 1 min)</p>
            <p>• Animations reduced</p>
          </div>
        )}
      </div>

      {/* Low Power Mode */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className={cn(
              "w-5 h-5",
              lowPowerMode ? "text-amber-500" : "text-zinc-500"
            )} />
            <div>
              <span className="text-sm font-medium text-zinc-200 font-mono uppercase tracking-wider block">
                Low Power Mode
              </span>
              <span className="text-xs text-zinc-500">
                Extend battery life while driving
              </span>
            </div>
          </div>
          <Switch
            checked={lowPowerMode}
            onCheckedChange={setLowPowerMode}
            className="data-[state=checked]:bg-amber-500"
          />
        </div>
        {lowPowerMode && (
          <div className="pl-8 text-xs text-amber-400/70 font-mono space-y-1">
            <p>• Reduced GPS accuracy when stationary</p>
            <p>• Fewer background updates</p>
            <p>• Screen brightness suggestions</p>
          </div>
        )}
        {battery.isLowPower && !lowPowerMode && (
          <p className="pl-8 text-xs text-red-400 font-mono">
            ⚠️ Battery low - consider enabling
          </p>
        )}
      </div>

      {/* Install App */}
      {!isInstalled && (canInstall || isIOS) && (
        <div className="space-y-2 pt-4 border-t border-zinc-800">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-sky-500" />
            <span className="text-sm font-medium text-zinc-200 font-mono uppercase tracking-wider">
              Install App
            </span>
          </div>
          {canInstall ? (
            <button
              onClick={handleInstall}
              className="w-full py-3 px-4 bg-sky-500/20 border border-sky-500/50 rounded-lg text-sky-400 font-mono text-sm hover:bg-sky-500/30 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Install Speed Alert
            </button>
          ) : isIOS ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded p-3 text-xs text-zinc-400 font-mono">
              <p className="mb-2">To install on iOS:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Tap the Share button</li>
                <li>Scroll down and tap &quot;Add to Home Screen&quot;</li>
                <li>Tap &quot;Add&quot;</li>
              </ol>
            </div>
          ) : null}
        </div>
      )}

      {/* Storage Info */}
      <div className="space-y-2 pt-4 border-t border-zinc-800">
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono uppercase">
          <HardDrive className="w-4 h-4" />
          Cached Data
        </div>
        <CacheInfo />
      </div>
    </div>
  );
}

/**
 * Cache Information Component
 */
function CacheInfo() {
  const [cacheSize, setCacheSize] = useState(null);
  const [isClearing, setIsClearing] = useState(false);

  const calculateCacheSize = async () => {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usedMB = ((estimate.usage || 0) / (1024 * 1024)).toFixed(2);
        const quotaMB = ((estimate.quota || 0) / (1024 * 1024)).toFixed(0);
        setCacheSize({ used: usedMB, quota: quotaMB });
      }
    } catch (e) {
      console.error('Could not estimate storage:', e);
    }
  };

  const clearCache = async () => {
    setIsClearing(true);
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      // Clear speed limit cache from localStorage
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('speedLimit_')) {
          localStorage.removeItem(key);
        }
      });
      await calculateCacheSize();
    } catch (e) {
      console.error('Could not clear cache:', e);
    }
    setIsClearing(false);
  };

  // Calculate on mount
  useState(() => {
    calculateCacheSize();
  });

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded p-3 space-y-2">
      {cacheSize ? (
        <>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-zinc-500">Used</span>
            <span className="text-zinc-300">{cacheSize.used} MB</span>
          </div>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-zinc-500">Available</span>
            <span className="text-zinc-300">{cacheSize.quota} MB</span>
          </div>
        </>
      ) : (
        <p className="text-xs text-zinc-500 font-mono">Calculating...</p>
      )}
      <button
        onClick={clearCache}
        disabled={isClearing}
        className="w-full mt-2 py-2 px-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs font-mono hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <RefreshCw className={cn("w-3 h-3", isClearing && "animate-spin")} />
        {isClearing ? "Clearing..." : "Clear Cache"}
      </button>
    </div>
  );
}

/**
 * Network Status Badge (for main UI)
 */
export function NetworkStatusBadge() {
  const network = useNetworkStatus();
  
  if (network.isOnline && !network.shouldReduceData) return null;

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-xl border",
      !network.isOnline 
        ? "bg-red-500/20 border-red-500/30 text-red-400"
        : "bg-amber-500/20 border-amber-500/30 text-amber-400"
    )}>
      {!network.isOnline ? (
        <>
          <WifiOff className="w-3 h-3" />
          <span className="text-xs font-mono uppercase">Offline</span>
        </>
      ) : (
        <>
          <Signal className="w-3 h-3" />
          <span className="text-xs font-mono uppercase">Slow</span>
        </>
      )}
    </div>
  );
}

/**
 * Battery Warning Badge (for main UI)
 */
export function BatteryWarningBadge() {
  const battery = useBatteryStatus();
  
  if (!battery.isLowPower) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-xl border bg-red-500/20 border-red-500/30 text-red-400">
      <Battery className="w-3 h-3" />
      <span className="text-xs font-mono uppercase">{Math.round(battery.level * 100)}%</span>
    </div>
  );
}
