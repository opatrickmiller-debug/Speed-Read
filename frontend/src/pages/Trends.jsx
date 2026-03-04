import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { statsApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../lib/utils';

const CustomTooltip = ({ active, payload, label, theme }) => {
  if (active && payload && payload.length) {
    return (
      <div className={cn(
        "backdrop-blur-xl border rounded-xl px-4 py-3 shadow-2xl",
        theme === 'dark' 
          ? 'bg-zinc-900/95 border-white/10' 
          : 'bg-white border-gray-200'
      )}>
        <p className={cn(
          "font-medium text-sm",
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>{label}</p>
        <p className="text-emerald-500 text-sm mt-1">
          {payload[0].value.toFixed(1)}g protein
        </p>
        <p className={cn(
          "text-xs mt-1",
          theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
        )}>
          {payload[0].payload.calories?.toFixed(0) || 0} calories
        </p>
      </div>
    );
  }
  return null;
};

export const Trends = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [weeklyData, setWeeklyData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    loadTrends();
  }, []);

  const loadTrends = async () => {
    try {
      const res = await statsApi.getWeekly();
      setWeeklyData(res.data);
    } catch (err) {
      console.error('Failed to load trends:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const days = weeklyData?.days || [];
  const avgProtein = days.length > 0 
    ? days.reduce((sum, d) => sum + d.protein, 0) / days.length 
    : 0;
  const maxProtein = Math.max(...days.map(d => d.protein), 0);
  const daysAtGoal = days.filter(d => d.protein >= (weeklyData?.protein_goal || 150)).length;
  
  // Trend calculation (compare last 3 days to previous 3 days)
  const recent = days.slice(-3).reduce((sum, d) => sum + d.protein, 0) / 3;
  const previous = days.slice(0, 3).reduce((sum, d) => sum + d.protein, 0) / 3;
  const trendDirection = recent > previous * 1.1 ? 'up' : recent < previous * 0.9 ? 'down' : 'stable';

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={cn(
            "font-heading text-3xl md:text-4xl font-bold",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Trends
          </h1>
          <p className={theme === 'dark' ? 'text-zinc-500' : 'text-gray-600'}>
            Your protein intake over the last 7 days
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <GlassCard>
                <GlassCardContent className="p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500 mb-2">
                    Weekly Average
                  </p>
                  <p className="text-3xl font-light text-white">
                    {avgProtein.toFixed(0)}
                    <span className="text-lg text-zinc-500">g</span>
                  </p>
                </GlassCardContent>
              </GlassCard>
              
              <GlassCard>
                <GlassCardContent className="p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500 mb-2">
                    Best Day
                  </p>
                  <p className="text-3xl font-light text-emerald-400">
                    {maxProtein.toFixed(0)}
                    <span className="text-lg text-emerald-400/50">g</span>
                  </p>
                </GlassCardContent>
              </GlassCard>
              
              <GlassCard>
                <GlassCardContent className="p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500 mb-2">
                    Days at Goal
                  </p>
                  <p className="text-3xl font-light text-white">
                    {daysAtGoal}
                    <span className="text-lg text-zinc-500">/7</span>
                  </p>
                </GlassCardContent>
              </GlassCard>
              
              <GlassCard>
                <GlassCardContent className="p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500 mb-2">
                    Trend
                  </p>
                  <div className="flex items-center gap-2">
                    {trendDirection === 'up' && (
                      <>
                        <TrendingUp className="w-6 h-6 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Improving</span>
                      </>
                    )}
                    {trendDirection === 'down' && (
                      <>
                        <TrendingDown className="w-6 h-6 text-amber-400" />
                        <span className="text-amber-400 font-medium">Declining</span>
                      </>
                    )}
                    {trendDirection === 'stable' && (
                      <>
                        <Minus className="w-6 h-6 text-zinc-400" />
                        <span className="text-zinc-400 font-medium">Stable</span>
                      </>
                    )}
                  </div>
                </GlassCardContent>
              </GlassCard>
            </div>

            {/* Chart */}
            <GlassCard data-testid="weekly-chart-card">
              <GlassCardHeader>
                <GlassCardTitle>Weekly Protein Intake</GlassCardTitle>
                <p className="text-xs text-zinc-500 mt-1">
                  Daily goal: {weeklyData?.protein_goal || user?.protein_goal || 150}g
                </p>
              </GlassCardHeader>
              <GlassCardContent className="pt-0">
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={days} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke="#27272A" 
                        vertical={false} 
                      />
                      <XAxis 
                        dataKey="day_name" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#71717A', fontSize: 12 }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#71717A', fontSize: 12 }}
                        domain={[0, 'auto']}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <ReferenceLine 
                        y={weeklyData?.protein_goal || 150} 
                        stroke="#10B981" 
                        strokeDasharray="5 5"
                        strokeWidth={2}
                      />
                      <Bar 
                        dataKey="protein" 
                        fill="#10B981"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={50}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-6 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                    <span className="text-sm text-zinc-500">Daily Protein</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-0.5 bg-emerald-500" style={{ borderStyle: 'dashed' }} />
                    <span className="text-sm text-zinc-500">Daily Goal</span>
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>

            {/* Daily Breakdown */}
            <GlassCard>
              <GlassCardHeader>
                <GlassCardTitle>Daily Breakdown</GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent className="pt-0">
                <div className="space-y-3">
                  {days.map((day) => {
                    const percentage = Math.min((day.protein / (weeklyData?.protein_goal || 150)) * 100, 100);
                    const atGoal = day.protein >= (weeklyData?.protein_goal || 150);
                    
                    return (
                      <div key={day.date} className="flex items-center gap-4">
                        <div className="w-12 text-right">
                          <span className="text-sm font-medium text-zinc-400">{day.day_name}</span>
                        </div>
                        <div className="flex-1">
                          <div className="h-6 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                atGoal ? 'bg-emerald-500' : 'bg-emerald-600/50'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-20 text-right">
                          <span className={`text-sm font-medium ${atGoal ? 'text-emerald-400' : 'text-zinc-400'}`}>
                            {day.protein.toFixed(0)}g
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCardContent>
            </GlassCard>
          </div>
        )}
      </div>
    </Layout>
  );
};
