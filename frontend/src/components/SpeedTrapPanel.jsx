import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { AlertTriangle, Camera, Shield, Construction, GraduationCap, Plus, Check, X, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistance, isMetric, milesToKm } from "@/utils/units";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TRAP_TYPES = [
  { id: "speed_camera", icon: Camera, label: "Speed Camera", color: "text-red-400" },
  { id: "police", icon: Shield, label: "Police", color: "text-blue-400" },
  { id: "construction", icon: Construction, label: "Construction", color: "text-orange-400" },
  { id: "school_zone", icon: GraduationCap, label: "School Zone", color: "text-yellow-400" },
];

// Get search radius in miles based on user's unit preference
const getSearchRadius = () => {
  // Always search 5 miles, but display will be converted
  return 5;
};

export function SpeedTrapPanel({ currentPosition }) {
  const { isAuthenticated } = useAuth();
  const [traps, setTraps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [selectedType, setSelectedType] = useState("speed_camera");
  const [reporting, setReporting] = useState(false);

  const fetchNearbyTraps = useCallback(async () => {
    if (!currentPosition) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API}/traps/nearby`, {
        params: {
          lat: currentPosition.lat,
          lon: currentPosition.lng,
          radius_miles: 5
        }
      });
      setTraps(response.data.traps || []);
    } catch (error) {
      console.error("Error fetching traps:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPosition]);

  // Fetch traps on mount and when position changes significantly
  useEffect(() => {
    if (currentPosition) {
      fetchNearbyTraps();
      // Refresh every 60 seconds
      const interval = setInterval(fetchNearbyTraps, 60000);
      return () => clearInterval(interval);
    }
  }, [currentPosition?.lat?.toFixed(2), currentPosition?.lng?.toFixed(2), fetchNearbyTraps]);

  const reportTrap = async () => {
    if (!currentPosition || !isAuthenticated) {
      toast.error(isAuthenticated ? "No GPS position" : "Sign in to report");
      return;
    }
    setReporting(true);
    try {
      const response = await axios.post(`${API}/traps/report`, {
        lat: currentPosition.lat,
        lon: currentPosition.lng,
        trap_type: selectedType
      });
      toast.success(response.data.new ? "Speed trap reported!" : "Trap confirmed!");
      setShowReport(false);
      fetchNearbyTraps();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to report");
    } finally {
      setReporting(false);
    }
  };

  const dismissTrap = async (trapId) => {
    if (!isAuthenticated) {
      toast.error("Sign in to dismiss traps");
      return;
    }
    try {
      await axios.post(`${API}/traps/${trapId}/dismiss`);
      toast.success("Trap dismissed");
      setTraps(traps.filter(t => t.id !== trapId));
    } catch (error) {
      toast.error("Failed to dismiss");
    }
  };

  const getTrapIcon = (type) => {
    const trap = TRAP_TYPES.find(t => t.id === type);
    if (!trap) return AlertTriangle;
    return trap.icon;
  };

  const getTrapColor = (type) => {
    const trap = TRAP_TYPES.find(t => t.id === type);
    return trap?.color || "text-zinc-400";
  };

  return (
    <div className="space-y-4">
      {/* Report Button */}
      {showReport ? (
        <div className="bg-zinc-900/80 border border-zinc-700 p-3 rounded-lg space-y-3">
          <p className="text-xs text-zinc-400 text-center">Select trap type at your current location</p>
          <div className="grid grid-cols-2 gap-2">
            {TRAP_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={cn(
                  "flex items-center gap-2 p-2 rounded border transition-all",
                  selectedType === type.id
                    ? "border-sky-500 bg-sky-500/20"
                    : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                )}
              >
                <type.icon className={cn("w-4 h-4", type.color)} />
                <span className="text-xs text-white">{type.label}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={reportTrap}
              disabled={reporting || !isAuthenticated}
              className="flex-1 bg-sky-600 hover:bg-sky-700"
            >
              {reporting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <><Check className="w-4 h-4 mr-1" /> Report</>               )}
            </Button>
            <Button
              onClick={() => setShowReport(false)}
              variant="ghost"
              className="border-zinc-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => setShowReport(true)}
          className="w-full bg-orange-600 hover:bg-orange-700"
        >
          <Plus className="w-4 h-4 mr-1" />
          Report Speed Trap
        </Button>
      )}

      {/* Nearby Traps List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Nearby Alerts</p>
          {loading && (
            <div className="w-3 h-3 border border-sky-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {traps.length === 0 ? (
          <div className="text-center py-6">
            <Shield className="w-8 h-8 text-green-500/50 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">No traps reported nearby</p>
            <p className="text-zinc-600 text-xs">You're in the clear!</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {traps.map((trap) => {
              const TrapIcon = getTrapIcon(trap.trap_type);
              return (
                <div
                  key={trap.id}
                  className="bg-zinc-900/50 border border-zinc-800 p-3 rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      "bg-zinc-800"
                    )}>
                      <TrapIcon className={cn("w-4 h-4", getTrapColor(trap.trap_type))} />
                    </div>
                    <div>
                      <p className="text-sm text-white capitalize">
                        {trap.trap_type.replace('_', ' ')}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <MapPin className="w-3 h-3" />
                        <span>{trap.distance_miles} mi</span>
                        <span>•</span>
                        <span>{trap.reporter_count} report{trap.reporter_count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                  {isAuthenticated && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => dismissTrap(trap.id)}
                      className="text-zinc-500 hover:text-red-400 h-8 w-8 p-0"
                      title="Dismiss (not there anymore)"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!isAuthenticated && (
        <p className="text-xs text-zinc-500 text-center">
          Sign in to report & dismiss traps
        </p>
      )}
    </div>
  );
}
