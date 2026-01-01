// Practice Session History Component (Driver Training)
// Displays list of practice drives with grades

import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Gauge, AlertTriangle, ChevronRight, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTrips, getScores } from '@/services/tripService';
import { formatDistance, formatSpeed } from '@/utils/units';

// Grade colors
const getGradeColor = (score) => {
  if (score >= 90) return 'bg-green-500/20 text-green-400 border-green-500/50';
  if (score >= 80) return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50';
  if (score >= 70) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
  if (score >= 60) return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
  return 'bg-red-500/20 text-red-400 border-red-500/50';
};

const getGrade = (score) => {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 75) return 'C+';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
};

const getGradeLabel = (score) => {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Fair';
  if (score >= 60) return 'Needs Work';
  return 'Keep Practicing';
};

// Format duration
const formatDuration = (minutes) => {
  if (!minutes) return '0m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hrs}h ${mins}m`;
};

// Format date for grouping
const formatDateGroup = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

// Format time
const formatTime = (dateStr) => {
  return new Date(dateStr).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
};

// Trip Card Component
const TripCard = ({ trip, onClick, speedUnit }) => {
  const hasIncidents = trip.speeding_incidents_count > 0 || trip.hard_brake_count > 0;
  
  return (
    <button
      onClick={() => onClick(trip)}
      className={cn(
        "w-full text-left p-4 rounded-lg border transition-all",
        "bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left side - trip info */}
        <div className="flex-1 min-w-0">
          {/* Route */}
          <div className="flex items-center gap-2 text-sm text-white font-medium truncate">
            <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span className="truncate">
              {trip.start_location?.address || 'Start'} → {trip.end_location?.address || 'End'}
            </span>
          </div>
          
          {/* Time */}
          <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
            <Clock className="w-3 h-3" />
            <span>
              {formatTime(trip.start_time)}
              {trip.end_time && ` - ${formatTime(trip.end_time)}`}
            </span>
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-4 mt-2 text-xs text-zinc-300">
            <span>{formatDistance(trip.distance_miles || 0, speedUnit)}</span>
            <span>{formatDuration(trip.duration_minutes)}</span>
            <span className="flex items-center gap-1">
              <Gauge className="w-3 h-3" />
              Max {formatSpeed(trip.max_speed_mph || 0, speedUnit)}
            </span>
          </div>
          
          {/* Incidents */}
          {hasIncidents && (
            <div className="flex items-center gap-2 mt-2">
              {trip.speeding_incidents_count > 0 && (
                <span className="flex items-center gap-1 text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded">
                  <AlertTriangle className="w-3 h-3" />
                  {trip.speeding_incidents_count} speeding
                </span>
              )}
              {trip.hard_brake_count > 0 && (
                <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded">
                  {trip.hard_brake_count} hard brake
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Right side - score */}
        <div className="flex items-center gap-2">
          <div className={cn(
            "px-3 py-1.5 rounded-lg border text-center min-w-[60px]",
            getScoreColor(trip.safety_score || 100)
          )}>
            <div className="text-lg font-bold">{trip.safety_score || 100}</div>
            <div className="text-[10px] uppercase tracking-wider opacity-80">
              {getScoreLabel(trip.safety_score || 100)}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-500" />
        </div>
      </div>
    </button>
  );
};

// Score Summary Component
const ScoreSummary = ({ scores }) => {
  if (!scores) return null;
  
  const TrendIcon = scores.trend === 'improving' ? TrendingUp : 
                    scores.trend === 'declining' ? TrendingDown : Minus;
  const trendColor = scores.trend === 'improving' ? 'text-green-400' : 
                     scores.trend === 'declining' ? 'text-red-400' : 'text-zinc-400';
  
  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        {/* Weekly Score */}
        <div className="text-center">
          <div className={cn(
            "text-3xl font-bold",
            scores.weekly_score >= 80 ? 'text-green-400' : 
            scores.weekly_score >= 60 ? 'text-yellow-400' : 'text-red-400'
          )}>
            {scores.weekly_score}
          </div>
          <div className="text-xs text-zinc-400 uppercase tracking-wider">Weekly Score</div>
          <div className={cn("flex items-center justify-center gap-1 text-xs mt-1", trendColor)}>
            <TrendIcon className="w-3 h-3" />
            {scores.trend}
          </div>
        </div>
        
        {/* Divider */}
        <div className="h-12 w-px bg-zinc-700" />
        
        {/* Today */}
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{scores.daily_score}</div>
          <div className="text-xs text-zinc-400 uppercase tracking-wider">Today</div>
        </div>
        
        {/* Divider */}
        <div className="h-12 w-px bg-zinc-700" />
        
        {/* Total Stats */}
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{scores.total_trips}</div>
          <div className="text-xs text-zinc-400 uppercase tracking-wider">Trips</div>
          <div className="text-xs text-zinc-500">{(scores.total_miles || 0).toFixed(1)} mi</div>
        </div>
      </div>
    </div>
  );
};

// Main Fleet Trip History Component
export const FleetTripHistory = ({ onSelectTrip, speedUnit = 'mph' }) => {
  const [trips, setTrips] = useState([]);
  const [scores, setScores] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [tripsData, scoresData] = await Promise.all([
        getTrips(null, null, 50),
        getScores()
      ]);
      
      setTrips(tripsData.trips || []);
      setScores(scoresData);
    } catch (err) {
      setError('Failed to load trip data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Group trips by date
  const groupedTrips = trips.reduce((groups, trip) => {
    const dateKey = formatDateGroup(trip.start_time);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(trip);
    return groups;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 mb-4">{error}</p>
        <button 
          onClick={loadData}
          className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Score Summary */}
      <ScoreSummary scores={scores} />
      
      {/* Trip List */}
      {trips.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No trips recorded yet</p>
          <p className="text-xs text-zinc-500 mt-1">Your trips will appear here automatically</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTrips).map(([date, dateTrips]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {date}
              </h3>
              <div className="space-y-2">
                {dateTrips.map(trip => (
                  <TripCard 
                    key={trip.id} 
                    trip={trip} 
                    onClick={onSelectTrip || (() => {})}
                    speedUnit={speedUnit}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FleetTripHistory;
