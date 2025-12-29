import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { 
  CloudRain, 
  CloudSnow, 
  Wind, 
  CloudFog, 
  AlertTriangle, 
  Thermometer,
  CloudLightning,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Map weather events to icons
const getWeatherIcon = (event) => {
  const eventLower = event.toLowerCase();
  if (eventLower.includes("snow") || eventLower.includes("blizzard") || eventLower.includes("ice") || eventLower.includes("sleet") || eventLower.includes("winter")) {
    return CloudSnow;
  }
  if (eventLower.includes("rain") || eventLower.includes("flood")) {
    return CloudRain;
  }
  if (eventLower.includes("wind") || eventLower.includes("tornado") || eventLower.includes("hurricane")) {
    return Wind;
  }
  if (eventLower.includes("fog")) {
    return CloudFog;
  }
  if (eventLower.includes("thunder") || eventLower.includes("lightning")) {
    return CloudLightning;
  }
  if (eventLower.includes("heat") || eventLower.includes("cold") || eventLower.includes("freeze") || eventLower.includes("frost")) {
    return Thermometer;
  }
  return AlertTriangle;
};

// Get severity color
const getSeverityColor = (severity) => {
  switch (severity) {
    case "Extreme":
      return "bg-red-600 border-red-500 text-white";
    case "Severe":
      return "bg-orange-600 border-orange-500 text-white";
    case "Moderate":
      return "bg-yellow-600 border-yellow-500 text-white";
    default:
      return "bg-sky-600 border-sky-500 text-white";
  }
};

const getSeverityBadge = (severity) => {
  switch (severity) {
    case "Extreme":
      return "bg-red-500/20 text-red-400 border-red-500/50";
    case "Severe":
      return "bg-orange-500/20 text-orange-400 border-orange-500/50";
    case "Moderate":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
    default:
      return "bg-sky-500/20 text-sky-400 border-sky-500/50";
  }
};

export function WeatherAlertBanner({ currentPosition, theme = "dark" }) {
  const [alerts, setAlerts] = useState([]);
  const [hazards, setHazards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dismissed, setDismissed] = useState(new Set());
  const [expanded, setExpanded] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);

  const fetchAlerts = useCallback(async () => {
    if (!currentPosition) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${API}/weather/alerts`, {
        params: {
          lat: currentPosition.lat,
          lon: currentPosition.lng
        }
      });
      
      setAlerts(response.data.alerts || []);
      setHazards(response.data.driving_hazards || []);
      setLastFetch(new Date());
    } catch (err) {
      console.error("Weather fetch error:", err);
      setError("Unable to fetch weather alerts");
    } finally {
      setLoading(false);
    }
  }, [currentPosition]);

  // Fetch alerts on position change (debounced)
  useEffect(() => {
    if (!currentPosition) return;
    
    // Initial fetch
    fetchAlerts();
    
    // Refresh every 10 minutes
    const interval = setInterval(fetchAlerts, 10 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [currentPosition?.lat?.toFixed(1), currentPosition?.lng?.toFixed(1)]);

  // Filter out dismissed alerts
  const visibleAlerts = alerts.filter(alert => !dismissed.has(alert.id));
  const severeAlerts = visibleAlerts.filter(a => a.severity === "Extreme" || a.severity === "Severe");
  const otherAlerts = visibleAlerts.filter(a => a.severity !== "Extreme" && a.severity !== "Severe");

  const dismissAlert = (alertId) => {
    setDismissed(prev => new Set([...prev, alertId]));
  };

  // Don't show anything if no alerts
  if (visibleAlerts.length === 0 && !loading) {
    return null;
  }

  // Compact banner for severe alerts
  if (severeAlerts.length > 0 && !expanded) {
    const topAlert = severeAlerts[0];
    const Icon = getWeatherIcon(topAlert.event);
    
    return (
      <div 
        className={cn(
          "fixed top-32 left-4 right-4 z-40 rounded-lg shadow-lg",
          getSeverityColor(topAlert.severity)
        )}
      >
        <div className="max-w-screen-xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Icon className="w-5 h-5 flex-shrink-0 animate-pulse" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{topAlert.event}</p>
                <p className="text-xs opacity-90 truncate">{topAlert.driving_impact}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {visibleAlerts.length > 1 && (
                <span className="text-xs bg-black/20 px-2 py-0.5 rounded">
                  +{visibleAlerts.length - 1} more
                </span>
              )}
              <button
                onClick={() => setExpanded(true)}
                className="p-1 hover:bg-black/20 rounded"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => dismissAlert(topAlert.id)}
                className="p-1 hover:bg-black/20 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Expanded view
  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto">
        <div className="max-w-lg mx-auto p-4 pt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              Weather Alerts ({visibleAlerts.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchAlerts}
                disabled={loading}
                className="p-2 text-zinc-400 hover:text-white rounded"
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </button>
              <button
                onClick={() => setExpanded(false)}
                className="p-2 text-zinc-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {lastFetch && (
            <p className="text-xs text-zinc-500 mb-4">
              Last updated: {lastFetch.toLocaleTimeString()}
            </p>
          )}

          <div className="space-y-3">
            {visibleAlerts.map((alert) => {
              const Icon = getWeatherIcon(alert.event);
              return (
                <div
                  key={alert.id}
                  className={cn(
                    "rounded-lg border p-4",
                    theme === "dark" 
                      ? "bg-zinc-900/90 border-zinc-700" 
                      : "bg-white border-gray-300"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        getSeverityBadge(alert.severity)
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={cn(
                            "font-bold",
                            theme === "dark" ? "text-white" : "text-gray-900"
                          )}>
                            {alert.event}
                          </h3>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded border",
                            getSeverityBadge(alert.severity)
                          )}>
                            {alert.severity}
                          </span>
                        </div>
                        <p className={cn(
                          "text-sm font-medium mb-2",
                          alert.severity === "Extreme" || alert.severity === "Severe"
                            ? "text-red-400"
                            : "text-yellow-400"
                        )}>
                          🚗 {alert.driving_impact}
                        </p>
                        <p className={cn(
                          "text-xs",
                          theme === "dark" ? "text-zinc-400" : "text-gray-600"
                        )}>
                          {alert.headline}
                        </p>
                        {alert.expires && (
                          <p className="text-xs text-zinc-500 mt-2">
                            Expires: {new Date(alert.expires).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className={cn(
                        "p-1 rounded hover:bg-zinc-700",
                        theme === "dark" ? "text-zinc-500" : "text-gray-400"
                      )}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => setExpanded(false)}
              className="text-sm text-zinc-400 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Minor alerts - small indicator
  if (otherAlerts.length > 0) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={cn(
          "fixed top-4 right-20 z-40 flex items-center gap-2 px-3 py-2 rounded-full",
          "backdrop-blur-xl border transition-all",
          theme === "dark" 
            ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/30"
            : "bg-yellow-500/30 border-yellow-500 text-yellow-700 hover:bg-yellow-500/40"
        )}
      >
        <AlertTriangle className="w-4 h-4" />
        <span className="text-xs font-medium">{otherAlerts.length} Weather Alert{otherAlerts.length > 1 ? 's' : ''}</span>
      </button>
    );
  }

  return null;
}

// Compact inline weather indicator for the HUD
export function WeatherIndicator({ currentPosition, onClick, theme = "dark" }) {
  const [hasAlerts, setHasAlerts] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [topSeverity, setTopSeverity] = useState(null);

  useEffect(() => {
    if (!currentPosition) return;

    const checkAlerts = async () => {
      try {
        const response = await axios.get(`${API}/weather/alerts`, {
          params: {
            lat: currentPosition.lat,
            lon: currentPosition.lng
          }
        });
        
        const alerts = response.data.alerts || [];
        setAlertCount(alerts.length);
        setHasAlerts(alerts.length > 0);
        
        if (alerts.length > 0) {
          // Find highest severity
          const severities = ["Extreme", "Severe", "Moderate", "Minor"];
          for (const sev of severities) {
            if (alerts.some(a => a.severity === sev)) {
              setTopSeverity(sev);
              break;
            }
          }
        } else {
          setTopSeverity(null);
        }
      } catch (err) {
        console.error("Weather check error:", err);
      }
    };

    checkAlerts();
    const interval = setInterval(checkAlerts, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentPosition?.lat?.toFixed(1), currentPosition?.lng?.toFixed(1)]);

  if (!hasAlerts) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono",
        "transition-all",
        topSeverity === "Extreme" && "bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse",
        topSeverity === "Severe" && "bg-orange-500/20 text-orange-400 border border-orange-500/50",
        topSeverity === "Moderate" && "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50",
        (!topSeverity || topSeverity === "Minor") && "bg-sky-500/20 text-sky-400 border border-sky-500/50"
      )}
    >
      <AlertTriangle className="w-3 h-3" />
      <span>{alertCount}</span>
    </button>
  );
}
