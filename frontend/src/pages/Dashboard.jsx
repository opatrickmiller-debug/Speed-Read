import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { ProteinProgress, MacroCard } from '../components/ProteinProgress';
import { NutritionScoreCard } from '../components/NutritionScore';
import { statsApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Flame, 
  Beef, 
  Wheat, 
  Droplets,
  Plus,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

export const Dashboard = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const res = await statsApi.getDaily(today);
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </Layout>
    );
  }

  // Get stats with defaults
  const calories = stats?.total_calories || 0;
  const protein = stats?.total_protein || 0;
  const fat = stats?.total_fat || 0;
  const carbs = stats?.total_carbs || 0;
  const proteinGoal = stats?.protein_goal || user?.protein_goal || 150;

  return (
    <Layout>
      <div className={cn(
        "min-h-screen pb-8",
        theme === 'dark' ? 'bg-zinc-950' : 'bg-gray-50'
      )}>
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <div className="mb-2">
            <p className={cn(
              "text-xs font-bold uppercase tracking-wider",
              theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
            )}>
              {format(new Date(), 'EEEE, MMMM d')}
            </p>
            <h1 className={cn(
              "text-3xl font-bold mt-1",
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Welcome, {user?.name?.split(' ')[0] || 'there'}
            </h1>
          </div>

          {/* Protein Progress Card */}
          <GlassCard data-testid="protein-progress-card">
            <GlassCardContent className="p-6">
              <ProteinProgress 
                current={protein} 
                goal={proteinGoal}
                size="large"
              />
            </GlassCardContent>
          </GlassCard>

          {/* Macro Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Calories */}
            <GlassCard data-testid="calories-card">
              <GlassCardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    theme === 'dark' ? 'bg-orange-500/20' : 'bg-orange-100'
                  )}>
                    <Flame className="w-4 h-4 text-orange-500" />
                  </div>
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>Calories</span>
                </div>
                <p className={cn(
                  "text-3xl font-bold",
                  theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
                )} data-testid="calories-value">
                  {Math.round(calories)}
                </p>
                <p className={cn(
                  "text-xs mt-1",
                  theme === 'dark' ? 'text-zinc-600' : 'text-gray-500'
                )}>kcal consumed</p>
              </GlassCardContent>
            </GlassCard>

            {/* Protein */}
            <GlassCard data-testid="protein-card">
              <GlassCardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'
                  )}>
                    <Beef className="w-4 h-4 text-red-500" />
                  </div>
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>Protein</span>
                </div>
                <p className={cn(
                  "text-3xl font-bold",
                  theme === 'dark' ? 'text-red-400' : 'text-red-600'
                )} data-testid="protein-value">
                  {protein.toFixed(1)}
                </p>
                <p className={cn(
                  "text-xs mt-1",
                  theme === 'dark' ? 'text-zinc-600' : 'text-gray-500'
                )}>of {proteinGoal}g goal</p>
              </GlassCardContent>
            </GlassCard>

            {/* Fat */}
            <GlassCard data-testid="fat-card">
              <GlassCardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    theme === 'dark' ? 'bg-yellow-500/20' : 'bg-yellow-100'
                  )}>
                    <Droplets className="w-4 h-4 text-yellow-500" />
                  </div>
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>Fat</span>
                </div>
                <p className={cn(
                  "text-3xl font-bold",
                  theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
                )} data-testid="fat-value">
                  {fat.toFixed(1)}
                </p>
                <p className={cn(
                  "text-xs mt-1",
                  theme === 'dark' ? 'text-zinc-600' : 'text-gray-500'
                )}>grams</p>
              </GlassCardContent>
            </GlassCard>

            {/* Carbs */}
            <GlassCard data-testid="carbs-card">
              <GlassCardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'
                  )}>
                    <Wheat className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>Carbs</span>
                </div>
                <p className={cn(
                  "text-3xl font-bold",
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                )} data-testid="carbs-value">
                  {carbs.toFixed(1)}
                </p>
                <p className={cn(
                  "text-xs mt-1",
                  theme === 'dark' ? 'text-zinc-600' : 'text-gray-500'
                )}>grams</p>
              </GlassCardContent>
            </GlassCard>
          </div>

          {/* Nutrition Score */}
          <NutritionScoreCard />

          {/* Quick Actions */}
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle>Quick Actions</GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="p-4 pt-0">
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/search"
                  data-testid="add-food-btn"
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl transition-colors",
                    theme === 'dark' 
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20' 
                      : 'bg-emerald-50 hover:bg-emerald-100'
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className={cn(
                      "font-semibold",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Add Food</p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                    )}>Search & log</p>
                  </div>
                </Link>
                
                <Link
                  to="/log"
                  data-testid="view-log-btn"
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl transition-colors",
                    theme === 'dark' 
                      ? 'bg-cyan-500/10 hover:bg-cyan-500/20' 
                      : 'bg-cyan-50 hover:bg-cyan-100'
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <ArrowRight className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div>
                    <p className={cn(
                      "font-semibold",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>View Log</p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                    )}>Today's foods</p>
                  </div>
                </Link>
              </div>
            </GlassCardContent>
          </GlassCard>
        </div>
      </div>
    </Layout>
  );
};
