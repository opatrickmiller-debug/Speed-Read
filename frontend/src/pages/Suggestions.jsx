import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { 
  Sparkles, 
  Loader2, 
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Beaker,
  Target,
  ChevronDown,
  ChevronUp,
  Leaf,
  ChefHat
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const Suggestions = () => {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState(null);
  const [completeProteins, setCompleteProteins] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedAA, setExpandedAA] = useState(null);

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [suggestionsRes, completeRes] = await Promise.all([
        fetch(`${API_URL}/api/suggestions/amino-acids`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        }),
        fetch(`${API_URL}/api/suggestions/complete-protein`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        })
      ]);

      if (suggestionsRes.ok) {
        setSuggestions(await suggestionsRes.json());
      }
      if (completeRes.ok) {
        setCompleteProteins(await completeRes.json());
      }
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (aaName) => {
    setExpandedAA(expandedAA === aaName ? null : aaName);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-white">
            Amino Acid Suggestions
          </h1>
          <p className="text-zinc-500 mt-2">
            Personalized food recommendations to complete your amino acid profile
          </p>
        </div>

        {/* Profile Status */}
        <GlassCard className="mb-6" data-testid="profile-status-card">
          <GlassCardContent className="p-6">
            <div className="flex items-center gap-4">
              {suggestions?.complete_profile ? (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center animate-pulse-glow">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-emerald-400">
                      Complete Amino Acid Profile!
                    </h2>
                    <p className="text-zinc-500 text-sm mt-1">
                      You've consumed adequate amounts of all 9 essential amino acids today.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                    <Target className="w-7 h-7 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      {suggestions?.low_amino_acids?.length || 0} Amino Acids Need Attention
                    </h2>
                    <p className="text-zinc-500 text-sm mt-1">
                      {format(new Date(), 'MMMM d, yyyy')} · Based on your daily intake vs. recommended values
                    </p>
                  </div>
                </>
              )}
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Amino Acid Deficiencies */}
        {suggestions?.low_amino_acids && suggestions.low_amino_acids.length > 0 && (
          <div className="space-y-4 mb-8">
            <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-500">
              Amino Acids to Focus On
            </h3>
            
            {suggestions.low_amino_acids.map((item, idx) => (
              <GlassCard 
                key={item.amino_acid} 
                className="animate-fade-in"
                style={{ animationDelay: `${idx * 0.1}s` }}
                data-testid={`suggestion-${item.amino_acid}`}
              >
                <GlassCardContent className="p-0">
                  <button
                    onClick={() => toggleExpand(item.amino_acid)}
                    className="w-full p-5 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        item.current_intake === 0 
                          ? 'bg-red-500/20' 
                          : 'bg-amber-500/20'
                      }`}>
                        <Beaker className={`w-6 h-6 ${
                          item.current_intake === 0 ? 'text-red-400' : 'text-amber-400'
                        }`} />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-white">
                          {item.amino_acid}
                        </h4>
                        <p className="text-sm text-zinc-500">
                          {item.current_intake === 0 ? (
                            <span className="text-red-400">Not consumed today</span>
                          ) : (
                            <>
                              {item.current_intake.toFixed(2)}g / {item.recommended_intake.toFixed(2)}g 
                              <span className="text-amber-400 ml-2">
                                ({((item.current_intake / item.recommended_intake) * 100).toFixed(0)}%)
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm text-zinc-400">Deficit</p>
                        <p className="text-lg font-semibold text-amber-400">
                          {item.deficit.toFixed(2)}g
                        </p>
                      </div>
                      {expandedAA === item.amino_acid ? (
                        <ChevronUp className="w-5 h-5 text-zinc-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-zinc-500" />
                      )}
                    </div>
                  </button>
                  
                  {expandedAA === item.amino_acid && (
                      <div className="px-5 pb-5 border-t border-white/5 pt-4">
                      <h5 className="text-sm font-semibold text-zinc-400 mb-3">
                        Keto-Friendly Foods High in {item.amino_acid}
                      </h5>
                      <div className="space-y-2">
                        {item.suggested_foods.map((food, fidx) => (
                          <button
                            key={fidx}
                            onClick={() => navigate(`/search?q=${encodeURIComponent(food.name)}`)}
                            className="w-full flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 hover:border-emerald-500/30 transition-all group"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-white font-medium group-hover:text-emerald-400 transition-colors">
                                  {food.name}
                                </p>
                                {food.keto === 'ultra_low' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                                    0 carb
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-3 mt-1 text-xs">
                                <span className="text-emerald-400">{food.protein}g protein</span>
                                <span className="text-zinc-500">{food.carbs}g carbs</span>
                                <span className="text-cyan-400">{food.per_100g}g {item.amino_acid}</span>
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </GlassCardContent>
              </GlassCard>
            ))}
          </div>
        )}

        {/* Complete Protein Foods */}
        <GlassCard data-testid="complete-proteins-card">
          <GlassCardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <GlassCardTitle>Keto Complete Proteins</GlassCardTitle>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Low carb foods with all 9 essential amino acids
                </p>
              </div>
            </div>
          </GlassCardHeader>
          <GlassCardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {completeProteins?.complete_protein_foods?.map((food, idx) => (
                <button
                  key={idx}
                  onClick={() => navigate(`/search?q=${encodeURIComponent(food.name)}`)}
                  className="flex items-start gap-3 p-4 rounded-xl bg-black/30 border border-white/5 hover:border-emerald-500/30 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-medium group-hover:text-emerald-400 transition-colors truncate">
                        {food.name}
                      </p>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap',
                        food.keto_tier === 'ultra_low' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-cyan-500/20 text-cyan-400'
                      )}>
                        {food.carbs_per_100g}g carbs
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs mb-1">
                      <span className="text-emerald-400">{food.protein_per_100g}g protein</span>
                      <span className="text-cyan-400">{food.fat_per_100g}g fat</span>
                    </div>
                    <p className="text-xs text-zinc-600 line-clamp-2">
                      {food.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            
            {completeProteins?.tip && (
              <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-sm text-emerald-400">
                  <Leaf className="w-4 h-4 inline mr-2" />
                  {completeProteins.tip}
                </p>
              </div>
            )}

            {/* Meal Builder CTA */}
            <button
              onClick={() => navigate('/meal-builder')}
              className="w-full mt-4 flex items-center justify-center gap-3 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-all"
            >
              <ChefHat className="w-5 h-5" />
              <span className="font-medium">Build Custom Keto Meal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </GlassCardContent>
        </GlassCard>
      </div>
    </Layout>
  );
};
