// Shared Progress Page - Public view for parents/instructors
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus, Clock, Sun, Moon, MapPin, Gauge, CheckCircle, AlertTriangle, Car, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Grade calculation
const getGradeLabel = (score) => {
  if (score >= 95) return { grade: 'A+', label: 'Excellent' };
  if (score >= 90) return { grade: 'A', label: 'Great' };
  if (score >= 85) return { grade: 'B+', label: 'Good' };
  if (score >= 80) return { grade: 'B', label: 'Above Average' };
  if (score >= 75) return { grade: 'C+', label: 'Average' };
  if (score >= 70) return { grade: 'C', label: 'Needs Practice' };
  if (score >= 60) return { grade: 'D', label: 'Needs Improvement' };
  return { grade: 'F', label: 'Keep Practicing' };
};

const getGradeColor = (score) => {
  if (score >= 90) return 'text-green-400';
  if (score >= 80) return 'text-cyan-400';
  if (score >= 70) return 'text-yellow-400';
  if (score >= 60) return 'text-orange-400';
  return 'text-red-400';
};

// Score ring component
const ScoreRing = ({ score, size = 140, strokeWidth = 10 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = ((100 - score) / 100) * circumference;
  const { grade, label } = getGradeLabel(score);
  
  const getColor = (s) => {
    if (s >= 90) return '#22c55e';
    if (s >= 80) return '#06b6d4';
    if (s >= 70) return '#eab308';
    if (s >= 60) return '#f97316';
    return '#ef4444';
  };
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-zinc-700" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={getColor(score)} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={progress} strokeLinecap="round" className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-4xl font-bold", getGradeColor(score))}>{grade}</span>
        <span className="text-sm text-zinc-400">{label}</span>
      </div>
    </div>
  );
};

// Trend indicator
const TrendIndicator = ({ trend }) => {
  const Icon = trend === 'improving' ? TrendingUp : trend === 'declining' ? TrendingDown : Minus;
  const color = trend === 'improving' ? 'text-green-400' : trend === 'declining' ? 'text-red-400' : 'text-zinc-400';
  const label = trend === 'improving' ? 'Improving' : trend === 'declining' ? 'Needs work' : 'Steady';
  
  return (
    <div className={cn("flex items-center gap-1", color)}>
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
};

// Stat Card
const StatCard = ({ icon: Icon, label, value, subValue, iconColor = "text-cyan-400" }) => (
  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
    <div className="flex items-center gap-2 mb-2">
      <Icon className={cn("w-5 h-5", iconColor)} />
      <span className="text-sm text-zinc-400">{label}</span>
    </div>
    <div className="text-2xl font-bold text-white">{value}</div>
    {subValue && <div className="text-xs text-zinc-500">{subValue}</div>}
  </div>
);

// Progress bar
const ProgressBar = ({ value, max, label, icon: Icon, color = "bg-cyan-500" }) => {
  const percent = Math.min(100, (value / max) * 100);
  const isComplete = percent >= 100;
  
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-zinc-400 flex items-center gap-1">
          <Icon className="w-4 h-4" /> {label}
        </span>
        <span className={cn("font-medium", isComplete ? "text-green-400" : "text-white")}>
          {value.toFixed(1)} / {max} hours
        </span>
      </div>
      <div className="h-3 bg-zinc-700 rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all", isComplete ? "bg-green-500" : color)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export const SharedProgress = () => {
  const { shareCode } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSharedData();
  }, [shareCode]);

  const loadSharedData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API}/practice/shared/${shareCode}`);
      
      if (response.status === 404) {
        setError('This share link is not valid or has been revoked.');
        return;
      }
      
      if (response.status === 410) {
        setError('This share link has expired.');
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to load progress data');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error loading shared data:', err);
      setError('Unable to load progress data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-zinc-400">Loading progress...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Link Not Available</h2>
          <p className="text-zinc-400 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
          >
            Go to DriveCoach
          </button>
        </div>
      </div>
    );
  }

  const { practice_hours, safety_score, total_trips, total_miles, recent_trips, trend, generated_at } = data;

  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Header */}
      <div className="bg-zinc-800 border-b border-zinc-700 py-4 px-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-6 h-6 text-cyan-400" />
            <span className="text-lg font-semibold text-white">DriveCoach</span>
          </div>
          <span className="text-xs text-zinc-500">Progress Report</span>
        </div>
      </div>
      
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Main Score */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 text-center">
          <h1 className="text-lg text-zinc-300 mb-4">Driving Grade</h1>
          <div className="flex justify-center mb-4">
            <ScoreRing score={safety_score} />
          </div>
          <TrendIndicator trend={trend} />
        </div>
        
        {/* Practice Hours */}
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-medium text-white">Practice Hours</h2>
            <span className="text-xs text-zinc-500 ml-auto">{practice_hours.selected_state} Requirements</span>
          </div>
          
          <ProgressBar 
            value={practice_hours.total_hours}
            max={practice_hours.state_requirement_total}
            label="Total Hours"
            icon={Sun}
            color="bg-cyan-500"
          />
          
          {practice_hours.state_requirement_night > 0 && (
            <ProgressBar 
              value={practice_hours.night_hours}
              max={practice_hours.state_requirement_night}
              label="Night Hours"
              icon={Moon}
              color="bg-purple-500"
            />
          )}
          
          {practice_hours.requirements_met && (
            <div className="flex items-center gap-2 text-green-400 mt-4 justify-center">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">{practice_hours.selected_state} requirements met!</span>
            </div>
          )}
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={MapPin} label="Practice Sessions" value={total_trips} iconColor="text-cyan-400" />
          <StatCard icon={Gauge} label="Miles Driven" value={total_miles.toFixed(1)} iconColor="text-green-400" />
          <StatCard icon={Clock} label="Total Hours" value={practice_hours.total_hours.toFixed(1)} iconColor="text-purple-400" />
          <StatCard 
            icon={Shield} 
            label="Safe Drives" 
            value={`${recent_trips.filter(t => t.speeding_incidents === 0).length}/${recent_trips.length}`} 
            iconColor="text-yellow-400" 
          />
        </div>
        
        {/* Recent Trips */}
        {recent_trips.length > 0 && (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
            <h2 className="text-lg font-medium text-white mb-3">Recent Practice Sessions</h2>
            <div className="space-y-2">
              {recent_trips.slice(0, 5).map((trip, i) => {
                const tripDate = new Date(trip.date);
                const isNight = tripDate.getHours() >= 21 || tripDate.getHours() < 6;
                
                return (
                  <div key={i} className="flex items-center justify-between bg-zinc-700/30 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      {isNight ? <Moon className="w-4 h-4 text-purple-400" /> : <Sun className="w-4 h-4 text-yellow-400" />}
                      <div>
                        <div className="text-sm text-white">
                          {tripDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {trip.duration_minutes.toFixed(0)} min • {trip.distance_miles.toFixed(1)} mi
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn("text-lg font-bold", getGradeColor(trip.safety_score))}>
                        {getGradeLabel(trip.safety_score).grade}
                      </div>
                      {trip.speeding_incidents > 0 && (
                        <div className="text-xs text-orange-400">{trip.speeding_incidents} incidents</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className="text-center text-xs text-zinc-600 py-4">
          <p>Last updated: {new Date(generated_at).toLocaleString()}</p>
          <p className="mt-1">Powered by DriveCoach</p>
        </div>
      </div>
    </div>
  );
};

export default SharedProgress;
