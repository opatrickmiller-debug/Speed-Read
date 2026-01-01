// Fleet Dashboard Component
// Shows safety scores, trends, and key metrics

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Activity, MapPin, Clock, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScores, getTrips, getIncidents } from '@/services/tripService';

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
const StatCard = ({ icon: Icon, label, value, subValue, iconColor = "text-cyan-400" }) => (
  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
    <div className="flex items-center gap-2 mb-1">
      <Icon className={cn("w-4 h-4", iconColor)} />
      <span className="text-xs text-zinc-400 uppercase tracking-wider">{label}</span>
    </div>
    <div className="text-xl font-bold text-white">{value}</div>
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

// Weekly chart (simplified bar chart)
const WeeklyChart = ({ data }) => {
  if (!data || data.length === 0) return null;
  
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const maxScore = 100;
  
  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-3">7-Day Trend</h3>
      <div className="flex items-end justify-between h-20 gap-1">
        {days.map((day, i) => {
          const score = data[i]?.daily_score || 0;
          const height = (score / maxScore) * 100;
          const barColor = score >= 80 ? 'bg-green-500' : 
                          score >= 60 ? 'bg-yellow-500' : 'bg-red-500';
          
          return (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div className="w-full flex justify-center mb-1">
                <div 
                  className={cn("w-4 rounded-t transition-all", score > 0 ? barColor : 'bg-zinc-700')}
                  style={{ height: `${Math.max(height, 4)}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-500">{day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Recent incidents list
const RecentIncidents = ({ incidents }) => {
  if (!incidents || incidents.length === 0) {
    return (
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-400" />
          No Recent Issues
        </h3>
        <p className="text-xs text-zinc-500">Great job! Keep driving safely.</p>
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
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-orange-400" />
        Recent Issues
      </h3>
      <div className="space-y-2">
        {incidents.slice(0, 5).map((incident, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={cn("px-1.5 py-0.5 rounded", severityColor[incident.severity])}>
                {incident.severity}
              </span>
              <span className="text-zinc-400">{incident.road_name || 'Unknown road'}</span>
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
  const [scores, setScores] = useState(null);
  const [recentTrips, setRecentTrips] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [scoresData, tripsData, incidentsData] = await Promise.all([
        getScores(),
        getTrips(null, null, 7),
        getIncidents(null, null, null, 10)
      ]);
      
      setScores(scoresData);
      setRecentTrips(tripsData.trips || []);
      setIncidents(incidentsData || []);
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

  return (
    <div className="space-y-4">
      {/* Main Score Section */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
        <div className="flex items-center justify-between">
          {/* Weekly Score Ring */}
          <div className="flex flex-col items-center">
            <ScoreRing 
              score={scores?.weekly_score || 100} 
              label="Weekly"
            />
            <TrendIndicator trend={scores?.trend || 'stable'} className="mt-2" />
          </div>
          
          {/* Score Breakdown */}
          <div className="flex-1 ml-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Today</span>
              <span className="text-lg font-bold text-white">{scores?.daily_score || 100}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">This Month</span>
              <span className="text-lg font-bold text-white">{scores?.monthly_score || 100}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">All Time</span>
              <span className="text-lg font-bold text-white">{scores?.lifetime_score || 100}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
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
          icon={AlertTriangle}
          label="Speeding"
          value={totalSpeedingThisWeek}
          subValue="incidents"
          iconColor="text-orange-400"
        />
        <StatCard 
          icon={Activity}
          label="Total"
          value={scores?.total_trips || 0}
          subValue={`${(scores?.total_miles || 0).toFixed(0)} mi lifetime`}
          iconColor="text-purple-400"
        />
      </div>
      
      {/* Weekly Chart */}
      {/* <WeeklyChart data={weeklyData} /> */}
      
      {/* Recent Incidents */}
      <RecentIncidents incidents={incidents} />
    </div>
  );
};

export default FleetDashboard;
