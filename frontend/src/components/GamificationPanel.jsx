import { useState, useEffect } from "react";
import axios from "axios";
import { Trophy, Flame, Star, Target, Award, TrendingUp, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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

export function GamificationPanel({ onClose }) {
  const { isAuthenticated } = useAuth();
  const [stats, setStats] = useState(null);
  const [allBadges, setAllBadges] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const fetchData = async () => {
      try {
        const [statsRes, badgesRes] = await Promise.all([
          axios.get(`${API}/stats`),
          axios.get(`${API}/badges`)
        ]);
        setStats(statsRes.data);
        setAllBadges(badgesRes.data.badges || {});
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="text-center py-8">
        <Trophy className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-400 text-sm">Sign in to track your stats</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-400 text-sm">No stats available yet. Start driving!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Streak Card */}
      <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 p-4 rounded-lg">
        <div className="flex items-center gap-3">
          <Flame className="w-8 h-8 text-orange-400" />
          <div>
            <p className="text-2xl font-bold text-white">{stats.current_streak}</p>
            <p className="text-xs text-orange-300">Day Streak (Best: {stats.longest_streak})</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={<Target className="w-4 h-4" />} label="Trips" value={stats.total_trips} />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Miles" value={stats.total_distance.toFixed(0)} />
        <StatCard 
          icon={<Star className="w-4 h-4" />} 
          label="Safe %" 
          value={`${stats.safe_trip_percentage.toFixed(0)}%`}
          highlight={stats.safe_trip_percentage >= 80}
        />
        <StatCard icon={<Award className="w-4 h-4" />} label="Badges" value={stats.badges.length} />
      </div>

      {/* Badges */}
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Badges</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(allBadges).map(([key, badge]) => {
            const earned = stats.badges.includes(key);
            return (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-all",
                  earned 
                    ? "bg-yellow-500/20 border border-yellow-500/50 text-yellow-300" 
                    : "bg-zinc-800/50 border border-zinc-700 text-zinc-500"
                )}
                title={badge.description}
              >
                <span>{BADGE_ICONS[key] || badge.icon}</span>
                <span className="hidden sm:inline">{badge.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weekly Progress */}
      {stats.weekly_stats && (
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Weekly Progress</p>
          <div className="space-y-1">
            {Object.entries(stats.weekly_stats)
              .slice(0, 4)
              .map(([week, data], idx) => (
                <div key={week} className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 w-16">
                    {idx === 0 ? "This week" : idx === 1 ? "Last week" : `${idx}w ago`}
                  </span>
                  <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-sky-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (data.trips / 10) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-400 w-8">{data.trips}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, highlight }) {
  return (
    <div className={cn(
      "bg-zinc-900/50 border border-zinc-800 p-3 rounded-lg",
      highlight && "border-green-500/50 bg-green-500/10"
    )}>
      <div className="flex items-center gap-2 text-zinc-400 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={cn("text-lg font-bold", highlight ? "text-green-400" : "text-white")}>{value}</p>
    </div>
  );
}
