import { useState } from 'react';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../lib/api';
import { User, Target, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

export const Settings = () => {
  const { user, updateUser } = useAuth();
  const [proteinGoal, setProteinGoal] = useState(user?.protein_goal || 150);
  const [saving, setSaving] = useState(false);

  const handleSaveGoal = async () => {
    setSaving(true);
    try {
      await authApi.updateProteinGoal(proteinGoal);
      updateUser({ protein_goal: proteinGoal });
      toast.success('Protein goal updated!');
    } catch (err) {
      toast.error('Failed to update goal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-white">
            Settings
          </h1>
          <p className="text-zinc-500 mt-2">
            Manage your account and preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <GlassCard data-testid="profile-card">
            <GlassCardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-emerald-400" />
                </div>
                <GlassCardTitle>Profile</GlassCardTitle>
              </div>
            </GlassCardHeader>
            <GlassCardContent className="pt-0">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-zinc-500 text-xs uppercase tracking-wider">Name</Label>
                    <p className="text-white font-medium mt-1">{user?.name}</p>
                  </div>
                  <div>
                    <Label className="text-zinc-500 text-xs uppercase tracking-wider">Email</Label>
                    <p className="text-white font-medium mt-1">{user?.email}</p>
                  </div>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Protein Goal Section */}
          <GlassCard data-testid="protein-goal-card">
            <GlassCardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <GlassCardTitle>Daily Protein Goal</GlassCardTitle>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Set your daily protein target in grams
                  </p>
                </div>
              </div>
            </GlassCardHeader>
            <GlassCardContent className="pt-0">
              <div className="flex items-end gap-4">
                <div className="flex-1 max-w-xs space-y-2">
                  <Label className="text-zinc-400">Protein Goal (grams)</Label>
                  <Input
                    type="number"
                    value={proteinGoal}
                    onChange={(e) => setProteinGoal(parseFloat(e.target.value) || 0)}
                    min={50}
                    max={500}
                    data-testid="protein-goal-input"
                    className="bg-black/50 border-white/10 text-white h-12 text-lg"
                  />
                </div>
                <button
                  onClick={handleSaveGoal}
                  disabled={saving || proteinGoal === user?.protein_goal}
                  data-testid="save-goal-btn"
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Save
                    </>
                  )}
                </button>
              </div>
              
              <div className="mt-6 p-4 rounded-xl bg-black/30 border border-white/5">
                <p className="text-sm text-zinc-400">
                  <strong className="text-white">Recommended daily protein:</strong>
                </p>
                <ul className="mt-2 space-y-1 text-sm text-zinc-500">
                  <li>• Sedentary adults: 0.8g per kg body weight</li>
                  <li>• Active individuals: 1.2-1.6g per kg body weight</li>
                  <li>• Athletes/Bodybuilders: 1.6-2.2g per kg body weight</li>
                  <li>• Keto diet: 20-25% of daily calories from protein</li>
                </ul>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* App Info */}
          <GlassCard>
            <GlassCardContent className="py-6 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-600 mb-2">
                Isotope Protein Tracker
              </p>
              <p className="text-zinc-500 text-sm">
                Powered by USDA FoodData Central API
              </p>
            </GlassCardContent>
          </GlassCard>
        </div>
      </div>
    </Layout>
  );
};
