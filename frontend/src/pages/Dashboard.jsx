import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { ProteinProgress, MacroCard } from '../components/ProteinProgress';
import { AminoAcidRadar, AminoAcidList } from '../components/AminoAcidRadar';
import { NutritionScoreCard } from '../components/NutritionScore';
import { DashboardSkeleton } from '../components/Skeletons';
import { InfoTooltip, LearnMoreLink } from '../components/Education';
import { statsApi, logsApi, ketoApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Flame, 
  Beef, 
  Wheat, 
  Droplets,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Sparkles,
  ScanBarcode,
  Leaf,
  ChefHat
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

export const Dashboard = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [stats, setStats] = useState(null);
  const [ketoScore, setKetoScore] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const [statsRes, logsRes, ketoRes] = await Promise.all([
        statsApi.getDaily(today),
        logsApi.getAll(today),
        ketoApi.getScore()
      ]);
      setStats(statsRes.data);
      setRecentLogs(logsRes.data.slice(0, 5));
      setKetoScore(ketoRes.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Convert amino acid totals to array format for radar
  const aminoAcidsArray = stats?.amino_acid_totals 
    ? Object.entries(stats.amino_acid_totals).map(([name, value]) => ({
        name,
        value,
        is_essential: ['Histidine', 'Isoleucine', 'Leucine', 'Lysine', 'Methionine', 
                       'Phenylalanine', 'Threonine', 'Tryptophan', 'Valine'].includes(name)
      }))
    : [];

  if (loading) {
    return (
      <Layout>
        <DashboardSkeleton />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <p className={cn(
            "text-xs font-bold uppercase tracking-[0.2em] mb-2",
            theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
          )}>
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
          <h1 className={cn(
            "font-heading text-3xl md:text-4xl font-bold",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
          
          {/* Protein Progress - Large */}
          <GlassCard className="lg:col-span-7" data-testid="protein-progress-card">
            <GlassCardContent className="p-8">
              <ProteinProgress 
                current={stats?.total_protein || 0} 
                goal={stats?.protein_goal || user?.protein_goal || 150}
                size="large"
              />
              
              {/* Macros Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
                <MacroCard 
                  label="Calories" 
                  value={stats?.total_calories || 0} 
                  unit="kcal"
                  color="orange"
                  icon={<Flame className="w-4 h-4 text-orange-400" />}
                />
                <MacroCard 
                  label="Fat" 
                  value={stats?.total_fat || 0} 
                  color="cyan"
                  icon={<Droplets className="w-4 h-4 text-cyan-400" />}
                />
                <MacroCard 
                  label="Carbs" 
                  value={stats?.total_carbs || 0} 
                  color="violet"
                  icon={<Wheat className="w-4 h-4 text-violet-400" />}
                />
                <MacroCard 
                  label="Fiber" 
                  value={stats?.total_fiber || 0} 
                  color="emerald"
                  icon={<Beef className="w-4 h-4 text-emerald-400" />}
                />
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Quick Actions - Add Food */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <GlassCard className="flex-shrink-0" data-testid="quick-add-card">
              <GlassCardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Link
                    to="/search"
                    data-testid="quick-add-food-btn"
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 px-4 rounded-xl transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    Add Food
                  </Link>
                  <Link
                    to="/barcode"
                    data-testid="quick-scan-btn"
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all font-medium",
                      theme === 'dark'
                        ? 'bg-white/5 hover:bg-white/10 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    )}
                  >
                    <ScanBarcode className="w-5 h-5" />
                    Scan
                  </Link>
                  <Link
                    to="/meal-builder"
                    data-testid="quick-meal-btn"
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 px-4 rounded-xl transition-all font-medium",
                      theme === 'dark'
                        ? 'bg-white/5 hover:bg-white/10 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    )}
                  >
                    <ChefHat className="w-5 h-5" />
                    Meal
                  </Link>
                </div>
              </GlassCardContent>
            </GlassCard>

            {/* Keto Score */}
            <GlassCard className="flex-1" data-testid="keto-score-card">
              <GlassCardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Leaf className="w-5 h-5 text-emerald-500" />
                    <GlassCardTitle>Keto Score</GlassCardTitle>
                    <InfoTooltip contentKey="ketoScore" />
                  </div>
                  <div className={cn(
                    'text-4xl font-bold',
                    ketoScore?.color === 'emerald' && 'text-emerald-500',
                    ketoScore?.color === 'amber' && 'text-amber-500',
                    ketoScore?.color === 'red' && 'text-red-500'
                  )}>
                    {ketoScore?.score || 0}
                  </div>
                </div>
              </GlassCardHeader>
              <GlassCardContent className="pt-0">
                {ketoScore ? (
                  <div className="space-y-4">
                    {/* Progress bar */}
                    <div className={cn(
                      "relative h-4 rounded-full overflow-hidden",
                      theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-200'
                    )}>
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          ketoScore.color === 'emerald' && 'bg-gradient-to-r from-emerald-600 to-emerald-400',
                          ketoScore.color === 'amber' && 'bg-gradient-to-r from-amber-600 to-amber-400',
                          ketoScore.color === 'red' && 'bg-gradient-to-r from-red-600 to-red-400'
                        )}
                        style={{ width: `${Math.min(100, ((ketoScore.total_carbs || ketoScore.net_carbs || 0) / ketoScore.carb_limit) * 100)}%` }}
                      />
                    </div>
                    
                    {/* Stats */}
                    <div className="flex justify-between text-sm">
                      <div>
                        <p className={cn(
                          'text-2xl font-semibold',
                          ketoScore.color === 'emerald' && 'text-emerald-500',
                          ketoScore.color === 'amber' && 'text-amber-500',
                          ketoScore.color === 'red' && 'text-red-500'
                        )}>
                          {ketoScore.total_carbs ?? ketoScore.net_carbs}g
                        </p>
                        <p className={theme === 'dark' ? 'text-zinc-500' : 'text-gray-600'}>Total Carbs</p>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-2xl font-semibold",
                          theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                        )}>
                          {ketoScore.carbs_remaining}g
                        </p>
                        <p className={theme === 'dark' ? 'text-zinc-500' : 'text-gray-600'}>Remaining</p>
                      </div>
                    </div>

                    {/* Fiber note */}
                    {ketoScore.fiber > 0 && (
                      <p className={cn(
                        "text-xs",
                        theme === 'dark' ? 'text-zinc-600' : 'text-gray-500'
                      )}>
                        Includes {ketoScore.fiber}g fiber
                      </p>
                    )}
                    
                    {/* Message */}
                    <div className={cn(
                      'p-3 rounded-xl text-sm',
                      ketoScore.color === 'emerald' && 'bg-emerald-500/10 text-emerald-600',
                      ketoScore.color === 'amber' && 'bg-amber-500/10 text-amber-600',
                      ketoScore.color === 'red' && 'bg-red-500/10 text-red-600'
                    )}>
                      {ketoScore.status === 'ketosis' && <CheckCircle2 className="w-4 h-4 inline mr-2" />}
                      {ketoScore.status === 'borderline' && <AlertTriangle className="w-4 h-4 inline mr-2" />}
                      {ketoScore.status === 'over_limit' && <AlertTriangle className="w-4 h-4 inline mr-2" />}
                      {ketoScore.message}
                    </div>
                  </div>
                ) : (
                  <div className={cn(
                    "py-8 text-center",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>
                    <p>No data yet</p>
                  </div>
                )}
              </GlassCardContent>
            </GlassCard>
          </div>

          {/* Nutrition Score */}
          <div className="lg:col-span-5" data-testid="nutrition-score-card">
            <NutritionScoreCard />
          </div>

          {/* Amino Acid Radar */}
          <GlassCard className="lg:col-span-7" data-testid="amino-radar-card">
            <GlassCardHeader>
              <GlassCardTitle>Amino Acid Profile</GlassCardTitle>
              <p className="text-xs text-zinc-500 mt-1">Essential amino acids from today's intake</p>
            </GlassCardHeader>
            <GlassCardContent className="pt-0">
              {aminoAcidsArray.length > 0 ? (
                <div className="h-[320px]">
                  <AminoAcidRadar aminoAcids={aminoAcidsArray} />
                </div>
              ) : (
                <div className="h-[280px] flex flex-col items-center justify-center text-zinc-500">
                  <AlertTriangle className="w-8 h-8 mb-3 text-zinc-600" />
                  <p className="text-sm">No amino acid data yet</p>
                  <p className="text-xs mt-1">Log some protein-rich foods</p>
                </div>
              )}
            </GlassCardContent>
          </GlassCard>

          {/* Recent Logs */}
          <GlassCard className="lg:col-span-7" data-testid="recent-logs-card">
            <GlassCardHeader className="flex flex-row items-center justify-between pb-4">
              <GlassCardTitle>Recent Foods</GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="pt-0">
              {recentLogs.length > 0 ? (
                <div className="space-y-3">
                  {recentLogs.map((log, idx) => (
                    <div 
                      key={log.id}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border transition-all animate-fade-in",
                        theme === 'dark' 
                          ? 'bg-black/30 border-white/5 hover:border-white/10' 
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      )}
                      style={{ animationDelay: `${idx * 0.1}s` }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-medium truncate",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>{log.description}</p>
                        <p className={cn(
                          "text-xs mt-1",
                          theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                        )}>
                          {log.servings} × {log.serving_size}{log.serving_unit} · {log.meal_type}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-emerald-500 font-semibold">
                          {(log.protein * log.servings).toFixed(1)}g
                        </p>
                        <p className={cn(
                          "text-xs",
                          theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                        )}>protein</p>
                      </div>
                    </div>
                  ))}
                  <Link 
                    to="/log"
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 transition-colors",
                      theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                    )}
                  >
                    View all logs
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className={theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'}>No foods logged today</p>
                  <Link 
                    to="/search"
                    className="inline-flex items-center gap-2 mt-4 text-emerald-500 hover:text-emerald-400 font-medium"
                  >
                    Search for foods
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </GlassCardContent>
          </GlassCard>

          {/* Amino Acid List */}
          <GlassCard className="lg:col-span-5" data-testid="amino-list-card">
            <GlassCardHeader>
              <GlassCardTitle>Essential Amino Acids</GlassCardTitle>
              <p className="text-xs text-zinc-500 mt-1">Daily totals breakdown</p>
            </GlassCardHeader>
            <GlassCardContent className="pt-0">
              {aminoAcidsArray.length > 0 ? (
                <>
                  <AminoAcidList aminoAcids={aminoAcidsArray} showAll={false} />
                  <Link 
                    to="/suggestions"
                    data-testid="get-suggestions-btn"
                    className="flex items-center justify-center gap-2 mt-4 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-all text-sm font-medium"
                  >
                    <Sparkles className="w-4 h-4" />
                    Get Food Suggestions
                  </Link>
                </>
              ) : (
                <div className="py-8 text-center text-zinc-500 text-sm">
                  <p>No amino acids tracked yet</p>
                </div>
              )}
            </GlassCardContent>
          </GlassCard>

          {/* Quick Actions */}
          <GlassCard className="lg:col-span-12" data-testid="quick-actions-card">
            <GlassCardContent className="p-6">
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  to="/barcode"
                  data-testid="quick-barcode-btn"
                  className="flex items-center gap-3 px-6 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all"
                >
                  <ScanBarcode className="w-5 h-5" />
                  <span className="font-medium">Scan Barcode</span>
                </Link>
                <Link
                  to="/suggestions"
                  data-testid="quick-suggestions-btn"
                  className="flex items-center gap-3 px-6 py-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-all"
                >
                  <Sparkles className="w-5 h-5" />
                  <span className="font-medium">Food Suggestions</span>
                </Link>
                <Link
                  to="/search"
                  className="flex items-center gap-3 px-6 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-medium">Add Food</span>
                </Link>
              </div>
            </GlassCardContent>
          </GlassCard>

        </div>
      </div>
    </Layout>
  );
};
