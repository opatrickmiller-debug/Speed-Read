import { useState, useEffect, useCallback } from "react";
import { Play, Square, Clock, Gauge, AlertTriangle, MapPin, Trash2, Lock, Car, Route, TrendingUp, Shield, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistance, formatSpeed, getUnitLabels, getSpeedUnit } from "@/utils/units";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const TripHistory = ({ 
  isRecording, 
  onStartRecording, 
  onStopRecording,
  currentTripStats 
}) => {
  const { isAuthenticated, token } = useAuth();
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);

  // Fetch trips on mount (only if authenticated with valid token)
  const fetchTrips = useCallback(async () => {
    if (!isAuthenticated || !token) return;
    
    setIsLoading(true);
    try {
      // Explicitly include the token to avoid race condition with axios interceptor
      const response = await axios.get(`${API}/trips?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrips(response.data.trips || []);
    } catch (error) {
      console.error("Error fetching trips:", error);
      if (error.response?.status === 401) {
        setTrips([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  // Refresh trips when recording stops
  useEffect(() => {
    if (!isRecording) {
      fetchTrips();
    }
  }, [isRecording, fetchTrips]);

  const handleDeleteTrip = async (tripId, e) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API}/trips/${tripId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrips(trips.filter(t => t.id !== tripId));
      toast.success("Trip deleted");
    } catch (error) {
      toast.error("Failed to delete trip");
    }
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
    });
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes || minutes === 0) return "< 1 min";
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Calculate safety rating for a trip
  const getSafetyRating = (trip) => {
    if (!trip.duration_minutes || trip.duration_minutes < 1) return { label: "N/A", color: "text-zinc-500", bg: "bg-zinc-500/20" };
    if (trip.total_alerts === 0) return { label: "Perfect", color: "text-green-400", bg: "bg-green-500/20" };
    const alertsPerHour = (trip.total_alerts / trip.duration_minutes) * 60;
    if (alertsPerHour <= 1) return { label: "Great", color: "text-emerald-400", bg: "bg-emerald-500/20" };
    if (alertsPerHour <= 3) return { label: "Good", color: "text-sky-400", bg: "bg-sky-500/20" };
    if (alertsPerHour <= 5) return { label: "Fair", color: "text-amber-400", bg: "bg-amber-500/20" };
    return { label: "Poor", color: "text-red-400", bg: "bg-red-500/20" };
  };

  // Group trips by date
  const groupTripsByDate = (trips) => {
    const grouped = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    trips.forEach(trip => {
      const tripDate = new Date(trip.start_time);
      tripDate.setHours(0, 0, 0, 0);
      
      let dateKey;
      if (tripDate.getTime() === today.getTime()) {
        dateKey = "Today";
      } else if (tripDate.getTime() === yesterday.getTime()) {
        dateKey = "Yesterday";
      } else {
        dateKey = tripDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      }

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(trip);
    });

    return grouped;
  };

  const groupedTrips = groupTripsByDate(trips);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          data-testid="trip-history-trigger"
          variant="ghost"
          size="icon"
          className={cn(
            "backdrop-blur-xl bg-black/50 border border-white/10",
            "hover:bg-black/70 hover:border-white/20",
            "rounded-none w-12 h-12",
            "transition-colors duration-200",
            isRecording && "border-red-500/50 bg-red-500/10"
          )}
        >
          <Clock className={cn("w-5 h-5", isRecording ? "text-red-400" : "text-zinc-300")} />
        </Button>
      </SheetTrigger>
      
      <SheetContent 
        side="left" 
        className="backdrop-blur-xl bg-zinc-950/95 border-r border-white/10 w-[380px] overflow-hidden flex flex-col p-0"
      >
        <div className="p-4 border-b border-zinc-800/50">
          <SheetHeader>
            <SheetTitle className="text-white font-chivo font-black uppercase tracking-wider flex items-center gap-2">
              <Car className="w-5 h-5 text-sky-400" />
              Trip History
            </SheetTitle>
            <SheetDescription className="text-zinc-500 font-mono text-xs">
              Track your driving performance
            </SheetDescription>
          </SheetHeader>
        </div>
        
        {/* Recording Controls */}
        <div className="p-4 bg-gradient-to-b from-zinc-900/80 to-transparent">
          {isRecording ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-400 font-mono text-sm font-semibold uppercase tracking-wider">
                    Recording Trip
                  </span>
                </div>
                <Button
                  data-testid="stop-recording-btn"
                  onClick={onStopRecording}
                  size="sm"
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              </div>
              
              {/* Current trip stats - Enhanced Layout */}
              {currentTripStats && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-3 bg-black/30 rounded-lg border border-zinc-800/50">
                    <TrendingUp className="w-4 h-4 text-sky-400 mx-auto mb-1" />
                    <div className="text-xl font-bold text-sky-400 font-mono">
                      {Math.round(currentTripStats.maxSpeed)}
                    </div>
                    <div className="text-[10px] text-zinc-500 uppercase font-medium">Max MPH</div>
                  </div>
                  <div className="text-center p-3 bg-black/30 rounded-lg border border-zinc-800/50">
                    <Gauge className="w-4 h-4 text-green-400 mx-auto mb-1" />
                    <div className="text-xl font-bold text-green-400 font-mono">
                      {Math.round(currentTripStats.avgSpeed)}
                    </div>
                    <div className="text-[10px] text-zinc-500 uppercase font-medium">Avg MPH</div>
                  </div>
                  <div className="text-center p-3 bg-black/30 rounded-lg border border-zinc-800/50">
                    <AlertTriangle className="w-4 h-4 text-red-400 mx-auto mb-1" />
                    <div className="text-xl font-bold text-red-400 font-mono">
                      {currentTripStats.alerts}
                    </div>
                    <div className="text-[10px] text-zinc-500 uppercase font-medium">Alerts</div>
                  </div>
                </div>
              )}
            </div>
          ) : !isAuthenticated ? (
            <div className="text-center p-6 bg-zinc-900/50 border border-zinc-800 rounded-lg">
              <Lock className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm font-medium mb-1">
                Sign in to record trips
              </p>
              <p className="text-zinc-600 text-xs">
                Track your driving and build your safety score
              </p>
            </div>
          ) : (
            <Button
              data-testid="start-recording-btn"
              onClick={onStartRecording}
              className="w-full h-14 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold text-base rounded-lg shadow-lg shadow-green-500/20"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Recording Trip
            </Button>
          )}
        </div>
        
        {/* Trip List - Grouped by Date */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {!isAuthenticated ? (
            <div className="text-center py-12 text-zinc-600">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No trip history</p>
              <p className="text-xs mt-1">Sign in to view your trips</p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Loading trips...</p>
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-12 text-zinc-600">
              <Route className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No trips recorded yet</p>
              <p className="text-xs mt-1">Start recording to track your drives</p>
            </div>
          ) : (
            Object.entries(groupedTrips).map(([dateGroup, groupTrips]) => (
              <div key={dateGroup} className="mb-4">
                {/* Date Header */}
                <div className="flex items-center gap-2 mb-2 sticky top-0 bg-zinc-950/90 backdrop-blur-sm py-2 -mx-4 px-4">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{dateGroup}</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-xs text-zinc-600">{groupTrips.length} trip{groupTrips.length !== 1 ? 's' : ''}</span>
                </div>
                
                {/* Trips for this date */}
                <div className="space-y-2">
                  {groupTrips.map((trip) => {
                    const safety = getSafetyRating(trip);
                    const isExpanded = selectedTrip?.id === trip.id;
                    
                    return (
                      <div
                        key={trip.id}
                        data-testid={`trip-item-${trip.id}`}
                        onClick={() => setSelectedTrip(isExpanded ? null : trip)}
                        className={cn(
                          "bg-zinc-900/60 border rounded-lg cursor-pointer transition-all duration-200",
                          isExpanded 
                            ? "border-sky-500/50 bg-sky-500/5 shadow-lg shadow-sky-500/10" 
                            : "border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900/80"
                        )}
                      >
                        {/* Main Trip Card */}
                        <div className="p-3">
                          {/* Header Row */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                                <Car className="w-4 h-4 text-zinc-400" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-zinc-200">
                                  {formatTime(trip.start_time)}
                                </div>
                                <div className="text-[10px] text-zinc-500">
                                  {formatDuration(trip.duration_minutes)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {trip.is_active && (
                                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-[10px] font-semibold uppercase rounded-full animate-pulse">
                                  Active
                                </span>
                              )}
                              <span className={cn("px-2 py-1 text-[10px] font-semibold uppercase rounded-full", safety.bg, safety.color)}>
                                {safety.label}
                              </span>
                            </div>
                          </div>
                          
                          {/* Stats Grid - Cleaner Layout */}
                          <div className="grid grid-cols-4 gap-2">
                            <div className="text-center p-2 bg-black/20 rounded-md">
                              <div className="text-sm font-bold text-sky-400 font-mono">
                                {Math.round(trip.max_speed || 0)}
                              </div>
                              <div className="text-[9px] text-zinc-500 uppercase">Max</div>
                            </div>
                            <div className="text-center p-2 bg-black/20 rounded-md">
                              <div className="text-sm font-bold text-emerald-400 font-mono">
                                {Math.round(trip.avg_speed || 0)}
                              </div>
                              <div className="text-[9px] text-zinc-500 uppercase">Avg</div>
                            </div>
                            <div className="text-center p-2 bg-black/20 rounded-md">
                              <div className={cn("text-sm font-bold font-mono", trip.total_alerts > 0 ? "text-red-400" : "text-green-400")}>
                                {trip.total_alerts || 0}
                              </div>
                              <div className="text-[9px] text-zinc-500 uppercase">Alerts</div>
                            </div>
                            <div className="text-center p-2 bg-black/20 rounded-md">
                              <div className="text-sm font-bold text-zinc-300 font-mono">
                                {formatDistance(trip.distance_miles, 1).value}
                              </div>
                              <div className="text-[9px] text-zinc-500 uppercase">{getUnitLabels().distanceShort}</div>
                            </div>
                          </div>
                          
                          {/* Expand Indicator */}
                          <div className="flex items-center justify-center mt-2 pt-2 border-t border-zinc-800/50">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-sky-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-zinc-600" />
                            )}
                          </div>
                        </div>
                        
                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-0 border-t border-zinc-800/50 animate-in slide-in-from-top-2 duration-200">
                            <div className="bg-zinc-800/30 rounded-lg p-3 space-y-3">
                              {/* Detailed Stats */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-zinc-500" />
                                  <div>
                                    <div className="text-[10px] text-zinc-500 uppercase">Duration</div>
                                    <div className="text-sm text-zinc-300 font-mono">{formatDuration(trip.duration_minutes)}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Route className="w-4 h-4 text-zinc-500" />
                                  <div>
                                    <div className="text-[10px] text-zinc-500 uppercase">Distance</div>
                                    <div className="text-sm text-zinc-300 font-mono">{trip.distance_miles?.toFixed(2) || '0.00'} mi</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4 text-zinc-500" />
                                  <div>
                                    <div className="text-[10px] text-zinc-500 uppercase">Top Speed</div>
                                    <div className="text-sm text-zinc-300 font-mono">{Math.round(trip.max_speed || 0)} {trip.speed_unit}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Gauge className="w-4 h-4 text-zinc-500" />
                                  <div>
                                    <div className="text-[10px] text-zinc-500 uppercase">Avg Speed</div>
                                    <div className="text-sm text-zinc-300 font-mono">{Math.round(trip.avg_speed || 0)} {trip.speed_unit}</div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Time Info */}
                              <div className="pt-2 border-t border-zinc-700/50 space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-zinc-500">Started</span>
                                  <span className="text-zinc-400 font-mono">{formatTime(trip.start_time)}</span>
                                </div>
                                {trip.end_time && (
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-500">Ended</span>
                                    <span className="text-zinc-400 font-mono">{formatTime(trip.end_time)}</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Safety Score Visual */}
                              <div className="pt-2 border-t border-zinc-700/50">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-zinc-500">Safety Rating</span>
                                  <span className={cn("text-xs font-semibold", safety.color)}>{safety.label}</span>
                                </div>
                                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                  <div 
                                    className={cn(
                                      "h-full rounded-full transition-all",
                                      safety.label === "Perfect" ? "bg-green-500 w-full" :
                                      safety.label === "Great" ? "bg-emerald-500 w-4/5" :
                                      safety.label === "Good" ? "bg-sky-500 w-3/5" :
                                      safety.label === "Fair" ? "bg-amber-500 w-2/5" :
                                      safety.label === "Poor" ? "bg-red-500 w-1/5" : "bg-zinc-600 w-0"
                                    )}
                                  />
                                </div>
                              </div>
                              
                              {/* Delete Button */}
                              <div className="pt-2">
                                <Button
                                  data-testid={`delete-trip-${trip.id}`}
                                  onClick={(e) => handleDeleteTrip(trip.id, e)}
                                  variant="ghost"
                                  size="sm"
                                  className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                                >
                                  <Trash2 className="w-3 h-3 mr-2" />
                                  Delete Trip
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
