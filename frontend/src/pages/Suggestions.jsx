import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { OmegaSummary } from '../components/FattyAcidChart';
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
  ChefHat,
  Droplets,
  Fish
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const Suggestions = () => {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState(null);
  const [fattySuggestions, setFattySuggestions] = useState(null);
  const [completeProteins, setCompleteProteins] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedAA, setExpandedAA] = useState(null);
  const [expandedFA, setExpandedFA] = useState(null);
  const [activeTab, setActiveTab] = useState('amino'); // 'amino' or 'fatty'

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [suggestionsRes, fattyRes, completeRes] = await Promise.all([
        fetch(`${API_URL}/api/suggestions/amino-acids`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        }),
        fetch(`${API_URL}/api/suggestions/fatty-acids`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        }),
        fetch(`${API_URL}/api/suggestions/complete-protein`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        })
      ]);

      if (suggestionsRes.ok) {
        setSuggestions(await suggestionsRes.json());
      }
      if (fattyRes.ok) {
        setFattySuggestions(await fattyRes.json());
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

  const toggleExpandFA = (faName) => {
    setExpandedFA(expandedFA === faName ? null : faName);
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
            Nutrition Suggestions
          </h1>
          <p className="text-zinc-500 mt-2">
            Personalized food recommendations to complete your amino acid & fatty acid profile
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-2 mb-6 p-1 bg-zinc-900/50 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('amino')}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all',
              activeTab === 'amino' 
                ? 'bg-emerald-500 text-black' 
                : 'text-zinc-400 hover:text-white'
            )}
          >
            <Beaker className="w-4 h-4" />
            Amino Acids
          </button>
          <button
            onClick={() => setActiveTab('fatty')}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all',
              activeTab === 'fatty' 
                ? 'bg-cyan-500 text-black' 
                : 'text-zinc-400 hover:text-white'
            )}
          >
            <Droplets className="w-4 h-4" />
            Fatty Acids
          </button>
        </div>

        {/* Amino Acids Tab */}
        {activeTab === 'amino' && (
          <>
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
          </>
        )}

        {/* Fatty Acids Tab */}
        {activeTab === 'fatty' && (
          <>
            {/* Omega Summary */}
            <GlassCard className="mb-6" data-testid="fatty-status-card">
              <GlassCardContent className="p-6">
                <OmegaSummary 
                  omega3Total={fattySuggestions?.omega3_total || 0}
                  omega6Total={fattySuggestions?.omega6_total || 0}
                  omegaRatio={fattySuggestions?.omega_ratio}
                />
                <div className="mt-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  <p className="text-sm text-cyan-400">
                    <Fish className="w-4 h-4 inline mr-2" />
                    Ideal ratio is {fattySuggestions?.ideal_ratio || '1:4'} or lower. Lower omega-6:omega-3 ratio reduces inflammation.
                  </p>
                </div>
              </GlassCardContent>
            </GlassCard>

            {/* Fatty Acid Deficiencies */}
            {fattySuggestions?.low_fatty_acids && fattySuggestions.low_fatty_acids.length > 0 && (
              <div className="space-y-4 mb-8">
                <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-500">
                  Fatty Acids to Focus On
                </h3>
                
                {fattySuggestions.low_fatty_acids.map((item, idx) => (
                  <GlassCard 
                    key={item.fatty_acid} 
                    className="animate-fade-in"
                    style={{ animationDelay: `${idx * 0.1}s` }}
                    data-testid={`suggestion-fa-${item.fatty_acid}`}
                  >
                    <GlassCardContent className="p-0">
                      <button
                        onClick={() => toggleExpandFA(item.fatty_acid)}
                        className="w-full p-5 flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            item.omega_type === 3 ? 'bg-cyan-500/20' : 'bg-amber-500/20'
                          }`}>
                            <Droplets className={`w-6 h-6 ${
                              item.omega_type === 3 ? 'text-cyan-400' : 'text-amber-400'
                            }`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-semibold text-white">
                                {item.fatty_acid}
                              </h4>
                              <span className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded-full',
                                item.omega_type === 3 
                                  ? 'bg-cyan-500/20 text-cyan-400' 
                                  : 'bg-amber-500/20 text-amber-400'
                              )}>
                                Omega-{item.omega_type}
                              </span>
                            </div>
                            <p className="text-sm text-zinc-500">
                              {item.current_intake === 0 ? (
                                <span className="text-red-400">Not consumed today</span>
                              ) : (
                                <>
                                  {item.current_intake.toFixed(2)}g / {item.recommended_intake.toFixed(2)}g 
                                  <span className={cn(
                                    'ml-2',
                                    item.omega_type === 3 ? 'text-cyan-400' : 'text-amber-400'
                                  )}>
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
                            <p className={cn(
                              'text-lg font-semibold',
                              item.omega_type === 3 ? 'text-cyan-400' : 'text-amber-400'
                            )}>
                              {item.deficit.toFixed(2)}g
                            </p>
                          </div>
                          {expandedFA === item.fatty_acid ? (
                            <ChevronUp className="w-5 h-5 text-zinc-500" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-zinc-500" />
                          )}
                        </div>
                      </button>
                      
                      {expandedFA === item.fatty_acid && item.suggested_foods?.length > 0 && (
                        <div className="px-5 pb-5 border-t border-white/5 pt-4">
                          <h5 className="text-sm font-semibold text-zinc-400 mb-3">
                            Keto-Friendly Foods High in {item.fatty_acid}
                          </h5>
                          <div className="space-y-2">
                            {item.suggested_foods.map((food, fidx) => (
                              <button
                                key={fidx}
                                onClick={() => navigate(`/search?q=${encodeURIComponent(food.name)}`)}
                                className="w-full flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 hover:border-cyan-500/30 transition-all group"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-white font-medium group-hover:text-cyan-400 transition-colors">
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
                                    <span className="text-cyan-400">{food.per_100g}g per 100g</span>
                                  </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
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

            {/* Omega-3 Rich Foods */}
            <GlassCard data-testid="omega3-foods-card">
              <GlassCardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <Fish className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <GlassCardTitle>Omega-3 Rich Keto Foods</GlassCardTitle>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Best sources for EPA, DHA, and ALA
                    </p>
                  </div>
                </div>
              </GlassCardHeader>
              <GlassCardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { name: 'Salmon (Atlantic)', protein: 25, carbs: 0, omega3: '2.3g', keto: 'ultra_low' },
                    { name: 'Mackerel', protein: 19, carbs: 0, omega3: '2.6g', keto: 'ultra_low' },
                    { name: 'Sardines', protein: 25, carbs: 0, omega3: '1.5g', keto: 'ultra_low' },
                    { name: 'Flax Seeds', protein: 18, carbs: 1.6, omega3: '22.8g ALA', keto: 'ultra_low' },
                    { name: 'Chia Seeds', protein: 17, carbs: 7.7, omega3: '17.8g ALA', keto: 'low' },
                    { name: 'Walnuts', protein: 15, carbs: 7, omega3: '9.1g ALA', keto: 'low' },
                  ].map((food, idx) => (
                    <button
                      key={idx}
                      onClick={() => navigate(`/search?q=${encodeURIComponent(food.name)}`)}
                      className="flex items-start gap-3 p-4 rounded-xl bg-black/30 border border-white/5 hover:border-cyan-500/30 transition-all text-left group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                        <Droplets className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white font-medium group-hover:text-cyan-400 transition-colors truncate">
                            {food.name}
                          </p>
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap',
                            food.keto === 'ultra_low' 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'bg-cyan-500/20 text-cyan-400'
                          )}>
                            {food.carbs}g carbs
                          </span>
                        </div>
                        <div className="flex gap-3 text-xs">
                          <span className="text-emerald-400">{food.protein}g protein</span>
                          <span className="text-cyan-400">{food.omega3} omega-3</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                
                <div className="mt-4 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  <p className="text-sm text-cyan-400">
                    <Fish className="w-4 h-4 inline mr-2" />
                    Fatty fish like salmon and mackerel provide EPA & DHA directly. Plant sources like flax provide ALA which converts to EPA/DHA at ~5-10%.
                  </p>
                </div>
              </GlassCardContent>
            </GlassCard>
          </>
        )}
      </div>
    </Layout>
  );
};
