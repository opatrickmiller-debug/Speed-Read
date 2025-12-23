import { useState, useEffect, useCallback } from "react";
import { Play, Square, Clock, Gauge, AlertTriangle, MapPin, ChevronRight, Trash2, X } from "lucide-react";
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const TripHistory = ({ 
  isRecording, 
  onStartRecording, 
  onStopRecording,
  currentTripStats 
}) => {
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);

  // Fetch trips on mount
  const fetchTrips = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/trips?limit=50`);
      setTrips(response.data.trips || []);
    } catch (error) {
      console.error("Error fetching trips:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      await axios.delete(`${API}/trips/${tripId}`);
      setTrips(trips.filter(t => t.id !== tripId));
      toast.success("Trip deleted");
    } catch (error) {
      toast.error("Failed to delete trip");
    }
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes) return "0m";
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

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
        className="backdrop-blur-xl bg-zinc-950/95 border-r border-white/10 w-[360px] overflow-hidden flex flex-col"
      >
        <SheetHeader>
          <SheetTitle className="text-white font-chivo font-black uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Trip History
          </SheetTitle>
          <SheetDescription className="text-zinc-500 font-mono text-xs">
            Record and review your driving trips
          </SheetDescription>
        </SheetHeader>
        
        {/* Recording Controls */}
        <div className="mt-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded">
          {isRecording ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-400 font-mono text-sm uppercase tracking-wider">
                    Recording
                  </span>
                </div>
                <Button
                  data-testid="stop-recording-btn"
                  onClick={onStopRecording}
                  size="sm"
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              </div>
              
              {/* Current trip stats */}
              {currentTripStats && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="text-center p-2 bg-zinc-800/50 rounded">
                    <div className="text-lg font-bold text-sky-400 font-mono">
                      {Math.round(currentTripStats.maxSpeed)}
                    </div>
                    <div className="text-[10px] text-zinc-500 uppercase">Max</div>
                  </div>
                  <div className="text-center p-2 bg-zinc-800/50 rounded">
                    <div className="text-lg font-bold text-green-400 font-mono">
                      {Math.round(currentTripStats.avgSpeed)}
                    </div>
                    <div className="text-[10px] text-zinc-500 uppercase">Avg</div>
                  </div>
                  <div className="text-center p-2 bg-zinc-800/50 rounded">
                    <div className="text-lg font-bold text-red-400 font-mono">
                      {currentTripStats.alerts}
                    </div>
                    <div className="text-[10px] text-zinc-500 uppercase">Alerts</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Button
              data-testid="start-recording-btn"
              onClick={onStartRecording}
              className="w-full bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Recording Trip
            </Button>
          )}
        </div>
        
        {/* Trip List */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-2">
          {isLoading ? (
            <div className="text-center py-8 text-zinc-500 font-mono text-sm">
              Loading trips...
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 font-mono text-sm">
              No trips recorded yet
            </div>
          ) : (
            trips.map((trip) => (
              <div
                key={trip.id}
                data-testid={`trip-item-${trip.id}`}
                onClick={() => setSelectedTrip(selectedTrip?.id === trip.id ? null : trip)}
                className={cn(
                  "p-3 bg-zinc-900/50 border border-zinc-800 rounded cursor-pointer",
                  "hover:border-zinc-700 transition-colors",
                  selectedTrip?.id === trip.id && "border-sky-500/50 bg-sky-500/5"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-zinc-500" />
                    <span className="text-sm text-zinc-300 font-mono">
                      {formatDate(trip.start_time)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {trip.is_active && (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-mono uppercase rounded">
                        Active
                      </span>
                    )}
                    <button
                      data-testid={`delete-trip-${trip.id}`}
                      onClick={(e) => handleDeleteTrip(trip.id, e)}
                      className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Trip Stats */}
                <div className="flex items-center gap-4 mt-2 text-xs font-mono">
                  <div className="flex items-center gap-1 text-zinc-400">
                    <Clock className="w-3 h-3" />
                    {formatDuration(trip.duration_minutes)}
                  </div>
                  <div className="flex items-center gap-1 text-sky-400">
                    <Gauge className="w-3 h-3" />
                    {Math.round(trip.max_speed)} {trip.speed_unit}
                  </div>
                  {trip.total_alerts > 0 && (
                    <div className="flex items-center gap-1 text-red-400">
                      <AlertTriangle className="w-3 h-3" />
                      {trip.total_alerts}
                    </div>
                  )}
                  {trip.distance_miles && (
                    <div className="text-zinc-500">
                      {trip.distance_miles.toFixed(1)} mi
                    </div>
                  )}
                </div>
                
                {/* Expanded Details */}
                {selectedTrip?.id === trip.id && (
                  <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-zinc-500">Avg Speed:</span>
                        <span className="text-zinc-300 ml-2">{Math.round(trip.avg_speed)} {trip.speed_unit}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Distance:</span>
                        <span className="text-zinc-300 ml-2">{trip.distance_miles?.toFixed(2) || '0'} mi</span>
                      </div>
                    </div>
                    {trip.end_time && (
                      <div className="text-xs font-mono text-zinc-500">
                        Ended: {formatDate(trip.end_time)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
