import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Slider } from '../components/ui/slider';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authApi } from '../lib/api';
import { 
  User, 
  Target, 
  Loader2, 
  Check,
  Scale,
  Calculator,
  Leaf,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export const Settings = () => {
  const { user, updateUser } = useAuth();
  const { theme } = useTheme();
  
  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  // Form states
  const [bodyWeight, setBodyWeight] = useState(user?.body_weight_kg || 70);
  const [bodyFat, setBodyFat] = useState(user?.body_fat_percentage || 20);
  const [proteinMultiplier, setProteinMultiplier] = useState(user?.protein_per_kg_lbm || 2.0);
  const [proteinGoal, setProteinGoal] = useState(user?.protein_goal || 150);
  const [carbLimit, setCarbLimit] = useState(user?.daily_carb_limit || 20);
  
  const [saving, setSaving] = useState(false);
  const [calculatedProtein, setCalculatedProtein] = useState(null);

  // Calculate lean body mass and recommended protein
  useEffect(() => {
    const lbm = bodyWeight * (1 - bodyFat / 100);
    const recommended = lbm * proteinMultiplier;
    setCalculatedProtein({
      lbm: lbm.toFixed(1),
      recommended: Math.round(recommended)
    });
  }, [bodyWeight, bodyFat, proteinMultiplier]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await authApi.updateSettings({
        body_weight_kg: bodyWeight,
        body_fat_percentage: bodyFat,
        protein_per_kg_lbm: proteinMultiplier,
        protein_goal: proteinGoal,
        daily_carb_limit: carbLimit
      });
      
      updateUser(res.data);
      toast.success('Settings saved!');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const applyCalculatedProtein = () => {
    if (calculatedProtein) {
      setProteinGoal(calculatedProtein.recommended);
    }
  };

  const getKetoTierLabel = (carbs) => {
    if (carbs <= 20) return { label: 'Strict Keto', color: 'emerald' };
    if (carbs <= 35) return { label: 'Moderate Keto', color: 'cyan' };
    if (carbs <= 50) return { label: 'Liberal Keto', color: 'amber' };
    return { label: 'Low Carb', color: 'orange' };
  };

  const ketoTier = getKetoTierLabel(carbLimit);

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={cn(
            "font-heading text-3xl md:text-4xl font-bold",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Settings
          </h1>
          <p className={theme === 'dark' ? 'text-zinc-500' : 'text-gray-600'}>
            Configure your keto goals and body composition
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <GlassCard data-testid="profile-card">
            <GlassCardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-emerald-500" />
                </div>
                <GlassCardTitle>Profile</GlassCardTitle>
              </div>
            </GlassCardHeader>
            <GlassCardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className={cn(
                    "text-xs uppercase tracking-wider",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>Name</Label>
                  <p className={cn(
                    "font-medium mt-1",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>{user?.name}</p>
                </div>
                <div>
                  <Label className={cn(
                    "text-xs uppercase tracking-wider",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>Email</Label>
                  <p className={cn(
                    "font-medium mt-1",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>{user?.email}</p>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Body Composition */}
          <GlassCard data-testid="body-comp-card">
            <GlassCardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Scale className="w-5 h-5 text-cyan-500" />
                </div>
                <div>
                  <GlassCardTitle>Body Composition</GlassCardTitle>
                  <p className={cn(
                    "text-xs mt-0.5",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>
                    Used to calculate your optimal protein intake
                  </p>
                </div>
              </div>
            </GlassCardHeader>
            <GlassCardContent className="pt-0 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'}>Body Weight</Label>
                    <span className={cn(
                      "font-mono",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{bodyWeight} kg</span>
                  </div>
                  <Slider
                    value={[bodyWeight]}
                    onValueChange={([v]) => setBodyWeight(v)}
                    min={40}
                    max={200}
                    step={0.5}
                    data-testid="weight-slider"
                    className="py-2"
                  />
                  <p className={cn(
                    "text-xs",
                    theme === 'dark' ? 'text-zinc-600' : 'text-gray-500'
                  )}>{(bodyWeight * 2.205).toFixed(0)} lbs</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'}>Body Fat %</Label>
                    <span className={cn(
                      "font-mono",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{bodyFat}%</span>
                  </div>
                  <Slider
                    value={[bodyFat]}
                    onValueChange={([v]) => setBodyFat(v)}
                    min={5}
                    max={50}
                    step={1}
                    data-testid="bodyfat-slider"
                    className="py-2"
                  />
                  <p className={cn(
                    "text-xs",
                    theme === 'dark' ? 'text-zinc-600' : 'text-gray-500'
                  )}>
                    Lean Body Mass: {calculatedProtein?.lbm} kg
                  </p>
                </div>
              </div>

              {/* Protein Calculator */}
              <div className={cn(
                "p-4 rounded-xl border",
                theme === 'dark' 
                  ? 'bg-violet-500/10 border-violet-500/20' 
                  : 'bg-violet-50 border-violet-200'
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="w-4 h-4 text-violet-500" />
                  <span className="text-sm font-semibold text-violet-600">Protein Calculator</span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                    )}>Protein per kg LBM</Label>
                    <span className={cn(
                      "font-mono",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{proteinMultiplier}g/kg</span>
                  </div>
                  <Slider
                    value={[proteinMultiplier]}
                    onValueChange={([v]) => setProteinMultiplier(v)}
                    min={1.2}
                    max={3.0}
                    step={0.1}
                    data-testid="protein-multiplier-slider"
                    className="py-2"
                  />
                  <div className={cn(
                    "flex items-center justify-between text-xs",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>
                    <span>1.2 (sedentary)</span>
                    <span>2.0 (active)</span>
                    <span>3.0 (athlete)</span>
                  </div>
                </div>

                <div className={cn(
                  "mt-4 p-3 rounded-lg flex items-center justify-between",
                  theme === 'dark' ? 'bg-black/30' : 'bg-white'
                )}>
                  <div>
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                    )}>Recommended Daily Protein</p>
                    <p className="text-2xl font-semibold text-violet-500">
                      {calculatedProtein?.recommended}g
                    </p>
                    <p className={cn(
                      "text-xs mt-1",
                      theme === 'dark' ? 'text-zinc-600' : 'text-gray-500'
                    )}>
                      {calculatedProtein?.lbm} kg LBM × {proteinMultiplier} g/kg
                    </p>
                  </div>
                  <button
                    onClick={applyCalculatedProtein}
                    className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-600 hover:bg-violet-500/30 transition-all text-sm font-medium"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Daily Targets */}
          <GlassCard data-testid="targets-card">
            <GlassCardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-orange-500" />
                </div>
                <GlassCardTitle>Daily Targets</GlassCardTitle>
              </div>
            </GlassCardHeader>
            <GlassCardContent className="pt-0 space-y-6">
              {/* Protein Goal */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'}>Daily Protein Goal</Label>
                  <span className="text-emerald-500 font-mono text-lg">{proteinGoal}g</span>
                </div>
                <Input
                  type="number"
                  value={proteinGoal}
                  onChange={(e) => setProteinGoal(parseFloat(e.target.value) || 0)}
                  min={50}
                  max={500}
                  data-testid="protein-goal-input"
                  className={cn(
                    "h-12 text-lg",
                    theme === 'dark' 
                      ? 'bg-black/50 border-white/10 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  )}
                />
              </div>

              {/* Carb Limit */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'}>Daily Carb Limit</Label>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      ketoTier.color === 'emerald' && 'text-emerald-600 bg-emerald-500/20',
                      ketoTier.color === 'cyan' && 'text-cyan-600 bg-cyan-500/20',
                      ketoTier.color === 'amber' && 'text-amber-600 bg-amber-500/20',
                      ketoTier.color === 'orange' && 'text-orange-600 bg-orange-500/20'
                    )}>
                      {ketoTier.label}
                    </span>
                    <span className={cn(
                      "font-mono",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{carbLimit}g</span>
                  </div>
                </div>
                <Slider
                  value={[carbLimit]}
                  onValueChange={([v]) => setCarbLimit(v)}
                  min={10}
                  max={100}
                  step={5}
                  data-testid="carb-limit-slider"
                  className="py-2"
                />
                <div className={cn(
                  "flex items-center justify-between text-xs",
                  theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                )}>
                  <span>10g (strict)</span>
                  <span>20g (standard)</span>
                  <span>50g (liberal)</span>
                  <span>100g (low carb)</span>
                </div>
                
                <div className={cn(
                  "mt-2 p-3 rounded-lg",
                  theme === 'dark' ? 'bg-black/30' : 'bg-gray-50'
                )}>
                  <div className="flex items-center gap-2 text-sm">
                    <Leaf className={cn(
                      'w-4 h-4',
                      ketoTier.color === 'emerald' && 'text-emerald-500',
                      ketoTier.color === 'cyan' && 'text-cyan-500',
                      ketoTier.color === 'amber' && 'text-amber-500',
                      ketoTier.color === 'orange' && 'text-orange-500'
                    )} />
                    <span className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'}>
                      {carbLimit <= 20 
                        ? "Optimal for deep ketosis and fat adaptation"
                        : carbLimit <= 35 
                        ? "Good for ketosis while allowing more food variety"
                        : carbLimit <= 50
                        ? "May maintain ketosis depending on activity level"
                        : "Low carb but may not achieve ketosis"}
                    </span>
                  </div>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Save Button */}
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            data-testid="save-settings-btn"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-8 py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Check className="w-5 h-5" />
                Save All Settings
              </>
            )}
          </button>

          {/* App Info */}
          <GlassCard>
            <GlassCardContent className="py-6 text-center">
              <p className={cn(
                "text-xs font-bold uppercase tracking-[0.2em] mb-2",
                theme === 'dark' ? 'text-zinc-600' : 'text-gray-500'
              )}>
                Isotope Protein Tracker
              </p>
              <p className={theme === 'dark' ? 'text-zinc-500' : 'text-gray-600'}>
                Keto-optimized nutrition tracking with amino acid analysis
              </p>
            </GlassCardContent>
          </GlassCard>
        </div>
      </div>
    </Layout>
  );
};
