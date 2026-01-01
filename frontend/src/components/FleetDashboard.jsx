// Progress Dashboard Component (Driver Training)
// Shows driving grades, practice hours, achievements, and skill analytics

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Activity, MapPin, Gauge, Flame, Trophy, Star, Download, Clock, Moon, Sun, Share2, Users, Plus, X, Copy, Link, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScores, getTrips, getIncidents, getDeviceIdValue } from '@/services/tripService';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// US State Practice Hour Requirements (simplified)
const STATE_REQUIREMENTS = {
  AL: { total: 50, night: 10 }, AK: { total: 40, night: 10 }, AZ: { total: 30, night: 0 },
  AR: { total: 60, night: 10 }, CA: { total: 50, night: 10 }, CO: { total: 50, night: 10 },
  CT: { total: 40, night: 0 }, DE: { total: 50, night: 10 }, FL: { total: 50, night: 10 },
  GA: { total: 40, night: 6 }, HI: { total: 50, night: 10 }, ID: { total: 50, night: 10 },
  IL: { total: 50, night: 10 }, IN: { total: 50, night: 10 }, IA: { total: 20, night: 0 },
  KS: { total: 50, night: 10 }, KY: { total: 60, night: 10 }, LA: { total: 50, night: 15 },
  ME: { total: 70, night: 10 }, MD: { total: 60, night: 10 }, MA: { total: 40, night: 0 },
  MI: { total: 50, night: 10 }, MN: { total: 50, night: 15 }, MS: { total: 30, night: 0 },
  MO: { total: 40, night: 10 }, MT: { total: 50, night: 10 }, NE: { total: 50, night: 10 },
  NV: { total: 50, night: 10 }, NH: { total: 40, night: 10 }, NJ: { total: 6, night: 0 },
  NM: { total: 50, night: 10 }, NY: { total: 50, night: 15 }, NC: { total: 60, night: 10 },
  ND: { total: 50, night: 10 }, OH: { total: 50, night: 10 }, OK: { total: 50, night: 10 },
  OR: { total: 100, night: 10 }, PA: { total: 65, night: 10 }, RI: { total: 50, night: 10 },
  SC: { total: 40, night: 10 }, SD: { total: 50, night: 0 }, TN: { total: 50, night: 10 },
  TX: { total: 30, night: 10 }, UT: { total: 40, night: 10 }, VT: { total: 40, night: 10 },
  VA: { total: 45, night: 15 }, WA: { total: 50, night: 10 }, WV: { total: 50, night: 10 },
  WI: { total: 30, night: 10 }, WY: { total: 50, night: 10 }, DC: { total: 40, night: 10 },
};

// Grade labels
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
const ScoreRing = ({ score, size = 120, strokeWidth = 8 }) => {
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
        <span className={cn("text-3xl font-bold", getGradeColor(score))}>{grade}</span>
        <span className="text-[10px] text-zinc-400 uppercase">{label}</span>
      </div>
    </div>
  );
};

// Practice Hours Progress with Manual Entry
const PracticeHoursCard = ({ practiceData, onStateChange, onAddSession, onRefresh }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSession, setNewSession] = useState({
    session_type: 'day',
    duration_minutes: 60,
    date: new Date().toISOString().split('T')[0],
    supervisor_name: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onAddSession(newSession);
      setShowAddForm(false);
      setNewSession({
        session_type: 'day',
        duration_minutes: 60,
        date: new Date().toISOString().split('T')[0],
        supervisor_name: '',
        notes: ''
      });
      toast.success('Practice session added!');
      onRefresh();
    } catch (err) {
      toast.error('Failed to add session');
    } finally {
      setSubmitting(false);
    }
  };

  if (!practiceData) return null;

  const { total_hours, night_hours, selected_state, state_requirement_total, state_requirement_night, total_progress_percent, night_progress_percent, requirements_met } = practiceData;
  
  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span className="text-xs text-zinc-300 font-medium">Practice Hours</span>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={selected_state}
            onChange={(e) => onStateChange(e.target.value)}
            className="bg-zinc-700 text-xs text-white px-2 py-1 rounded border border-zinc-600"
          >
            {Object.keys(STATE_REQUIREMENTS).sort().map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-1 bg-cyan-500/20 border border-cyan-500/50 rounded hover:bg-cyan-500/30 transition-colors"
          >
            {showAddForm ? <X className="w-3.5 h-3.5 text-cyan-400" /> : <Plus className="w-3.5 h-3.5 text-cyan-400" />}
          </button>
        </div>
      </div>
      
      {/* Add Session Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="mb-3 p-2 bg-zinc-700/50 rounded-lg space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Type</label>
              <select
                value={newSession.session_type}
                onChange={(e) => setNewSession({...newSession, session_type: e.target.value})}
                className="w-full bg-zinc-700 text-xs text-white px-2 py-1.5 rounded border border-zinc-600"
              >
                <option value="day">Day</option>
                <option value="night">Night</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Duration (min)</label>
              <input
                type="number"
                min="1"
                max="480"
                value={newSession.duration_minutes}
                onChange={(e) => setNewSession({...newSession, duration_minutes: parseInt(e.target.value) || 0})}
                className="w-full bg-zinc-700 text-xs text-white px-2 py-1.5 rounded border border-zinc-600"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Date</label>
              <input
                type="date"
                value={newSession.date}
                onChange={(e) => setNewSession({...newSession, date: e.target.value})}
                className="w-full bg-zinc-700 text-xs text-white px-2 py-1.5 rounded border border-zinc-600"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Supervisor</label>
              <input
                type="text"
                placeholder="Name (optional)"
                value={newSession.supervisor_name}
                onChange={(e) => setNewSession({...newSession, supervisor_name: e.target.value})}
                className="w-full bg-zinc-700 text-xs text-white px-2 py-1.5 rounded border border-zinc-600"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || newSession.duration_minutes < 1}
            className="w-full py-1.5 bg-cyan-500 text-white text-xs font-medium rounded hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Adding...' : 'Add Practice Session'}
          </button>
        </form>
      )}
      
      {/* Total Hours */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-zinc-400 flex items-center gap-1">
            <Sun className="w-3 h-3" /> Total Hours
          </span>
          <span className={cn("font-medium", total_progress_percent >= 100 ? "text-green-400" : "text-white")}>
            {total_hours.toFixed(1)} / {state_requirement_total}
          </span>
        </div>
        <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
          <div 
            className={cn("h-full rounded-full transition-all", total_progress_percent >= 100 ? "bg-green-500" : "bg-cyan-500")}
            style={{ width: `${Math.min(100, total_progress_percent)}%` }}
          />
        </div>
      </div>
      
      {/* Night Hours */}
      {state_requirement_night > 0 && (
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-zinc-400 flex items-center gap-1">
              <Moon className="w-3 h-3" /> Night Hours
            </span>
            <span className={cn("font-medium", night_progress_percent >= 100 ? "text-green-400" : "text-white")}>
              {night_hours.toFixed(1)} / {state_requirement_night}
            </span>
          </div>
          <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div 
              className={cn("h-full rounded-full transition-all", night_progress_percent >= 100 ? "bg-green-500" : "bg-purple-500")}
              style={{ width: `${Math.min(100, night_progress_percent)}%` }}
            />
          </div>
        </div>
      )}
      
      {requirements_met && (
        <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> {selected_state} requirements met!
        </p>
      )}
    </div>
  );
};

// Skill Stat Card
const SkillCard = ({ icon: Icon, label, value, subValue, iconColor = "text-cyan-400", highlight = false }) => (
  <div className={cn("bg-zinc-800/50 border rounded-lg p-3", highlight ? "border-green-500/50 bg-green-500/10" : "border-zinc-700")}>
    <div className="flex items-center gap-2 mb-1">
      <Icon className={cn("w-4 h-4", iconColor)} />
      <span className="text-xs text-zinc-400 uppercase tracking-wider">{label}</span>
    </div>
    <div className={cn("text-xl font-bold", highlight ? "text-green-400" : "text-white")}>{value}</div>
    {subValue && <div className="text-xs text-zinc-500">{subValue}</div>}
  </div>
);

// Areas to Improve
const AreasToImprove = ({ incidents }) => {
  if (!incidents || incidents.length === 0) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <span className="text-xs text-green-300 font-medium">Great Job!</span>
        </div>
        <p className="text-[10px] text-green-400/70 mt-1">No areas needing improvement. Keep it up!</p>
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
        <span className="text-xs text-zinc-300 font-medium">Areas to Improve</span>
      </div>
      <div className="space-y-1.5">
        {incidents.slice(0, 4).map((inc, i) => (
          <div key={i} className="flex items-center justify-between text-[10px]">
            <span className={cn("px-1.5 py-0.5 rounded", severityColor[inc.severity])}>
              {inc.severity === 'minor' ? 'Watch speed' : inc.severity === 'moderate' ? 'Slow down' : 'Too fast'}
            </span>
            <span className="text-zinc-400">{inc.road_name || 'Unknown road'}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Share/Parent Access Card with Backend Integration
const ShareAccessCard = ({ deviceId, onRefresh }) => {
  const [shares, setShares] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newShare, setNewShare] = useState({
    recipient_name: '',
    recipient_email: '',
    expires_days: 30
  });

  useEffect(() => {
    loadShares();
  }, [deviceId]);

  const loadShares = async () => {
    if (!deviceId) return;
    try {
      const response = await fetch(`${API}/practice/share/list?device_id=${deviceId}`);
      if (response.ok) {
        const data = await response.json();
        setShares(data);
      }
    } catch (err) {
      console.error('Error loading shares:', err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newShare.recipient_name) {
      toast.error('Please enter a name');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API}/practice/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          ...newShare
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success('Share link created!');
        navigator.clipboard.writeText(`${window.location.origin}/progress/${data.share_code}`);
        toast.success('Link copied to clipboard!');
        setShowForm(false);
        setNewShare({ recipient_name: '', recipient_email: '', expires_days: 30 });
        loadShares();
      } else {
        toast.error('Failed to create share link');
      }
    } catch (err) {
      toast.error('Error creating share link');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (shareCode) => {
    try {
      const response = await fetch(`${API}/practice/share/${shareCode}?device_id=${deviceId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        toast.success('Share link revoked');
        loadShares();
      }
    } catch (err) {
      toast.error('Error revoking link');
    }
  };

  const copyLink = (shareCode) => {
    navigator.clipboard.writeText(`${window.location.origin}/progress/${shareCode}`);
    toast.success('Link copied!');
  };
  
  return (
    <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          <span className="text-xs text-purple-300 font-medium">Parent/Instructor Access</span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="p-1 bg-purple-500/20 border border-purple-500/50 rounded hover:bg-purple-500/30 transition-colors"
        >
          {showForm ? <X className="w-3.5 h-3.5 text-purple-400" /> : <Plus className="w-3.5 h-3.5 text-purple-400" />}
        </button>
      </div>
      
      <p className="text-[10px] text-purple-400/70 mb-2">Share your progress with a parent or instructor</p>
      
      {/* Create Share Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-3 p-2 bg-zinc-700/50 rounded-lg space-y-2">
          <div>
            <label className="text-[10px] text-zinc-400 block mb-1">Recipient Name *</label>
            <input
              type="text"
              placeholder="e.g., Mom, Dad, Instructor"
              value={newShare.recipient_name}
              onChange={(e) => setNewShare({...newShare, recipient_name: e.target.value})}
              className="w-full bg-zinc-700 text-xs text-white px-2 py-1.5 rounded border border-zinc-600"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-400 block mb-1">Email (optional)</label>
            <input
              type="email"
              placeholder="their@email.com"
              value={newShare.recipient_email}
              onChange={(e) => setNewShare({...newShare, recipient_email: e.target.value})}
              className="w-full bg-zinc-700 text-xs text-white px-2 py-1.5 rounded border border-zinc-600"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-400 block mb-1">Link expires in</label>
            <select
              value={newShare.expires_days}
              onChange={(e) => setNewShare({...newShare, expires_days: parseInt(e.target.value)})}
              className="w-full bg-zinc-700 text-xs text-white px-2 py-1.5 rounded border border-zinc-600"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={365}>1 year</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading || !newShare.recipient_name}
            className="w-full py-1.5 bg-purple-500 text-white text-xs font-medium rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating...' : 'Create Share Link'}
          </button>
        </form>
      )}
      
      {/* Active Share Links */}
      {shares.length > 0 && (
        <div className="space-y-2">
          {shares.map((share) => (
            <div key={share.share_code} className="flex items-center justify-between bg-zinc-800/50 rounded px-2 py-1.5">
              <div className="flex-1">
                <div className="text-xs text-white">{share.recipient_name}</div>
                <div className="text-[10px] text-zinc-500">
                  {share.access_count > 0 ? `Viewed ${share.access_count}x` : 'Not viewed yet'}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => copyLink(share.share_code)}
                  className="p-1.5 hover:bg-zinc-700 rounded transition-colors"
                  title="Copy link"
                >
                  <Copy className="w-3 h-3 text-zinc-400" />
                </button>
                <button
                  onClick={() => handleRevoke(share.share_code)}
                  className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                  title="Revoke access"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {shares.length === 0 && !showForm && (
        <div className="text-center py-2">
          <p className="text-[10px] text-zinc-500">No active share links</p>
        </div>
      )}
    </div>
  );
};

// Trend indicator
const TrendIndicator = ({ trend, className }) => {
  const Icon = trend === 'improving' ? TrendingUp : trend === 'declining' ? TrendingDown : Minus;
  const color = trend === 'improving' ? 'text-green-400' : trend === 'declining' ? 'text-red-400' : 'text-zinc-400';
  const label = trend === 'improving' ? 'Improving!' : trend === 'declining' ? 'Needs work' : 'Steady';
  
  return (
    <div className={cn("flex items-center gap-1 text-xs", color, className)}>
      <Icon className="w-3 h-3" />
      <span>{label}</span>
    </div>
  );
};

// Main Dashboard Component
export const FleetDashboard = ({ speedUnit = 'mph' }) => {
  const { isAuthenticated } = useAuth();
  const [scores, setScores] = useState(null);
  const [recentTrips, setRecentTrips] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [practiceData, setPracticeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, [isAuthenticated]);

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
      a.download = `drivecoach_progress_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success('Progress report exported!');
    } catch (err) {
      toast.error('Failed to export');
    } finally {
      setExporting(false);
    }
  };

  const loadPracticeData = async () => {
    try {
      const deviceId = getDeviceIdValue();
      const response = await fetch(`${API}/practice/summary?device_id=${deviceId}`);
      if (response.ok) {
        const data = await response.json();
        setPracticeData(data);
      }
    } catch (err) {
      console.error('Error loading practice data:', err);
    }
  };

  const handleStateChange = async (state) => {
    try {
      const deviceId = getDeviceIdValue();
      await fetch(`${API}/practice/settings?device_id=${deviceId}&state=${state}`, {
        method: 'POST'
      });
      loadPracticeData();
    } catch (err) {
      console.error('Error saving state:', err);
    }
  };

  const handleAddPracticeSession = async (sessionData) => {
    const deviceId = getDeviceIdValue();
    const response = await fetch(`${API}/practice/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        ...sessionData
      })
    });
    
    if (!response.ok) throw new Error('Failed to add session');
    return response.json();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [scoresData, tripsData, incidentsData] = await Promise.all([
        getScores(),
        getTrips(null, null, 100),
        getIncidents(null, null, null, 10)
      ]);
      
      setScores(scoresData);
      setRecentTrips(tripsData.trips || []);
      setIncidents(incidentsData || []);
      
      // Load practice data separately
      await loadPracticeData();
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

  // Calculate practice hours from trips
  const totalHours = recentTrips.reduce((sum, t) => sum + (t.duration_minutes || 0), 0) / 60;
  const nightHours = recentTrips.reduce((sum, t) => {
    const startTime = new Date(t.start_time);
    const hour = startTime.getHours();
    // Night = 9pm to 6am
    if (hour >= 21 || hour < 6) {
      return sum + (t.duration_minutes || 0) / 60;
    }
    return sum;
  }, 0);
  
  const totalSessions = recentTrips.length;
  const totalMiles = recentTrips.reduce((sum, t) => sum + (t.distance_miles || 0), 0);
  const safeSessions = recentTrips.filter(t => (t.speeding_incidents_count || 0) === 0).length;
  const safePercent = totalSessions > 0 ? Math.round((safeSessions / totalSessions) * 100) : 100;

  return (
    <div className="space-y-3">
      {/* Driving Grade Section */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center">
            <ScoreRing score={scores?.weekly_score || 100} size={100} />
            <TrendIndicator trend={scores?.trend || 'stable'} className="mt-1" />
          </div>
          
          <div className="flex-1 ml-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-400">Today</span>
              <span className={cn("text-base font-bold", getGradeColor(scores?.daily_score || 100))}>
                {getGradeLabel(scores?.daily_score || 100).grade}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-400">This Month</span>
              <span className={cn("text-base font-bold", getGradeColor(scores?.monthly_score || 100))}>
                {getGradeLabel(scores?.monthly_score || 100).grade}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-400">Overall</span>
              <span className={cn("text-base font-bold", getGradeColor(scores?.lifetime_score || 100))}>
                {getGradeLabel(scores?.lifetime_score || 100).grade}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Practice Hours */}
      <PracticeHoursCard 
        totalHours={totalHours}
        nightHours={nightHours}
        state={selectedState}
        onStateChange={setSelectedState}
      />
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        <SkillCard icon={MapPin} label="Sessions" value={totalSessions} subValue="practice drives" iconColor="text-cyan-400" />
        <SkillCard icon={Gauge} label="Miles" value={totalMiles.toFixed(1)} subValue="driven" iconColor="text-green-400" />
        <SkillCard icon={Star} label="Clean %" value={`${safePercent}%`} iconColor="text-yellow-400" highlight={safePercent >= 80} />
        <SkillCard icon={Clock} label="Hours" value={totalHours.toFixed(1)} subValue="total practice" iconColor="text-purple-400" />
      </div>
      
      {/* Areas to Improve */}
      <AreasToImprove incidents={incidents} />
      
      {/* Share with Parent/Instructor */}
      <ShareAccessCard deviceId={getDeviceIdValue()} />
      
      {/* Export Button */}
      <button
        onClick={handleExportCSV}
        disabled={exporting || totalSessions === 0}
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
            <span className="text-sm font-medium">Export Progress Report</span>
          </>
        )}
      </button>
    </div>
  );
};

export default FleetDashboard;
