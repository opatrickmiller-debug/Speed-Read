// Fleet Dashboard Component
// Shows safety scores, trends, achievements, and key metrics

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Activity, MapPin, Gauge, Flame, Trophy, Star, Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScores, getTrips, getIncidents, getDeviceIdValue } from '@/services/tripService';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Badge icons
const BADGE_ICONS = {
  first_trip: "🚗",
  safe_week: "🛡️",
  road_warrior: "🏆",
  speed_demon_reformed: "😇",
  night_owl: "🦉",
  early_bird: "🐦",
  marathon_driver: "🏃",
  consistent: "📅",
  explorer: "🗺️",
  perfect_trip: "⭐",
};

// Score ring component
const ScoreRing = ({ score, size = 120, strokeWidth = 8, label }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = ((100 - score) / 100) * circumference;
  
  const getColor = (s) => {
    if (s >= 90) return '#22c55e'; // green
    if (s >= 80) return '#06b6d4'; // cyan
    if (s >= 70) return '#eab308'; // yellow
    if (s >= 60) return '#f97316'; // orange
    return '#ef4444'; // red
  };
  
  const color = getColor(score);
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-zinc-700"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{score}</span>
        {label && <span className="text-xs text-zinc-400 uppercase tracking-wider">{label}</span>}
      </div>
    </div>
  );
};

// Stat card component
const StatCard = ({ icon: Icon, label, value, subValue, iconColor = "text-cyan-400", highlight = false }) => (
  <div className={cn(
    "bg-zinc-800/50 border rounded-lg p-3",
    highlight ? "border-green-500/50 bg-green-500/10" : "border-zinc-700"
  )}>
    <div className="flex items-center gap-2 mb-1">
      <Icon className={cn("w-4 h-4", iconColor)} />
      <span className="text-xs text-zinc-400 uppercase tracking-wider">{label}</span>
    </div>
    <div className={cn("text-xl font-bold", highlight ? "text-green-400" : "text-white")}>{value}</div>
    {subValue && <div className="text-xs text-zinc-500">{subValue}</div>}
  </div>
);

// Trend indicator
const TrendIndicator = ({ trend, className }) => {
  const Icon = trend === 'improving' ? TrendingUp : 
               trend === 'declining' ? TrendingDown : Minus;
  const color = trend === 'improving' ? 'text-green-400' : 
                trend === 'declining' ? 'text-red-400' : 'text-zinc-400';
  
  return (
    <div className={cn("flex items-center gap-1 text-xs", color, className)}>
      <Icon className="w-3 h-3" />
      <span className="capitalize">{trend}</span>
    </div>
  );
};

// Streak Card
const StreakCard = ({ currentStreak, longestStreak }) => (
  <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 p-3 rounded-lg">
    <div className="flex items-center gap-3">
      <Flame className="w-6 h-6 text-orange-400" />
      <div>
        <p className="text-xl font-bold text-white">{currentStreak || 0}</p>
        <p className="text-[10px] text-orange-300">Day Streak (Best: {longestStreak || 0})</p>
      </div>
    </div>
  </div>
);

// Badges Display
const BadgesDisplay = ({ earnedBadges = [], allBadges = {} }) => {
  if (Object.keys(allBadges).length === 0) return null;
  
  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <span className="text-xs text-zinc-400 uppercase tracking-wider">Achievements</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(allBadges).map(([key, badge]) => {
          const earned = earnedBadges.includes(key);
          return (
            <div
              key={key}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] transition-all",
                earned 
                  ? "bg-yellow-500/20 border border-yellow-500/50 text-yellow-300" 
                  : "bg-zinc-800/50 border border-zinc-700 text-zinc-600"
              )}
              title={badge.description}
            >
              <span>{BADGE_ICONS[key] || badge.icon}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-zinc-500 mt-1.5">
        {earnedBadges.length} / {Object.keys(allBadges).length} earned
      </p>
    </div>
  );
};

// Recent incidents list
const RecentIncidents = ({ incidents }) => {
  if (!incidents || incidents.length === 0) {
    return (
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <span className="text-xs text-zinc-300">No Recent Issues</span>
        </div>
        <p className="text-[10px] text-zinc-500">Great job! Keep driving safely.</p>
      </div>
    );
  }
  
  const severityColor = {
    minor: 'text-yellow-400 bg-yellow-500/10',
    moderate: 'text-orange-400 bg-orange-500/10',
    severe: 'text-red-400 bg-red-500/10',
    extreme: 'text-red-500 bg-red-500/20'
  };
  
  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-orange-400" />
        <span className="text-xs text-zinc-300">Recent Issues</span>
      </div>
      <div className="space-y-1.5">
        {incidents.slice(0, 4).map((incident, i) => (
          <div key={i} className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className={cn("px-1 py-0.5 rounded", severityColor[incident.severity])}>
                {incident.severity}
              </span>
              <span className="text-zinc-400 truncate max-w-[100px]">{incident.road_name || 'Unknown'}</span>
            </div>
            <span className="text-zinc-500">
              {incident.max_speed} in {incident.posted_limit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main Dashboard Component
export const FleetDashboard = ({ speedUnit = 'mph' }) => {
  const { isAuthenticated } = useAuth();
  const [scores, setScores] = useState(null);
  const [recentTrips, setRecentTrips] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [gamificationStats, setGamificationStats] = useState(null);
  const [allBadges, setAllBadges] = useState({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, [isAuthenticated]);

  // Export to CSV
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const deviceId = getDeviceIdValue();
      const response = await fetch(`${API}/fleet/export/csv?device_id=${deviceId}`);
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `speedshield_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      toast.success('Report exported successfully');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Fleet data (always load)
      const [scoresData, tripsData, incidentsData] = await Promise.all([
        getScores(),
        getTrips(null, null, 7),
        getIncidents(null, null, null, 10)
      ]);
      
      setScores(scoresData);
      setRecentTrips(tripsData.trips || []);
      setIncidents(incidentsData || []);
      
      // Gamification data (only if authenticated)
      if (isAuthenticated) {
        try {
          const [statsRes, badgesRes] = await Promise.all([
            axios.get(`${API}/stats`),
            axios.get(`${API}/badges`)
          ]);
          setGamificationStats(statsRes.data);
          setAllBadges(badgesRes.data.badges || {});
        } catch (err) {
          console.log("Gamification stats not available");
        }
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Calculate stats from recent trips
  const totalTripsThisWeek = recentTrips.length;
  const totalMilesThisWeek = recentTrips.reduce((sum, t) => sum + (t.distance_miles || 0), 0);
  const totalSpeedingThisWeek = recentTrips.reduce((sum, t) => sum + (t.speeding_incidents_count || 0), 0);
  const safeTripsPercent = totalTripsThisWeek > 0 
    ? Math.round((recentTrips.filter(t => (t.speeding_incidents_count || 0) === 0).length / totalTripsThisWeek) * 100)
    : 100;

  return (
    <div className="space-y-3">
      {/* Main Score Section */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          {/* Weekly Score Ring */}
          <div className="flex flex-col items-center">
            <ScoreRing 
              score={scores?.weekly_score || 100} 
              size={100}
              label="Weekly"
            />
            <TrendIndicator trend={scores?.trend || 'stable'} className="mt-1" />
          </div>
          
          {/* Score Breakdown */}
          <div className="flex-1 ml-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-400">Today</span>
              <span className="text-base font-bold text-white">{scores?.daily_score || 100}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-400">Monthly</span>
              <span className="text-base font-bold text-white">{scores?.monthly_score || 100}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-400">Lifetime</span>
              <span className="text-base font-bold text-white">{scores?.lifetime_score || 100}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Streak Card (if authenticated) */}
      {isAuthenticated && gamificationStats && (
        <StreakCard 
          currentStreak={gamificationStats.current_streak} 
          longestStreak={gamificationStats.longest_streak} 
        />
      )}
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard 
          icon={MapPin}
          label="Trips"
          value={totalTripsThisWeek}
          subValue="this week"
          iconColor="text-cyan-400"
        />
        <StatCard 
          icon={Gauge}
          label="Miles"
          value={totalMilesThisWeek.toFixed(1)}
          subValue="this week"
          iconColor="text-green-400"
        />
        <StatCard 
          icon={Star}
          label="Safe %"
          value={`${safeTripsPercent}%`}
          iconColor="text-yellow-400"
          highlight={safeTripsPercent >= 80}
        />
        <StatCard 
          icon={Activity}
          label="Total"
          value={scores?.total_trips || 0}
          subValue={`${(scores?.total_miles || 0).toFixed(0)} mi`}
          iconColor="text-purple-400"
        />
      </div>
      
      {/* Badges (if authenticated) */}
      {isAuthenticated && gamificationStats && (
        <BadgesDisplay 
          earnedBadges={gamificationStats.badges || []} 
          allBadges={allBadges} 
        />
      )}
      
      {/* Recent Incidents */}
      <RecentIncidents incidents={incidents} />
      
      {/* Export Button */}
      <button
        onClick={handleExportCSV}
        disabled={exporting || (scores?.total_trips || 0) === 0}
        className={cn(
          "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all",
          "bg-cyan-500/20 border border-cyan-500/50 text-cyan-400",
          "hover:bg-cyan-500/30 hover:border-cyan-500",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        {exporting ? (
          <>
            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Exporting...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Export Report (CSV)</span>
          </>
        )}
      </button>
    </div>
  );
};

export default FleetDashboard;
