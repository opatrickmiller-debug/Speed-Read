import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { AminoAcidRadar } from '../components/AminoAcidRadar';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { 
  ChefHat, 
  Loader2, 
  CheckCircle2,
  AlertTriangle,
  Plus,
  X,
  Search,
  Leaf,
  Flame,
  Beef,
  ArrowRight,
  Sparkles,
  Save,
  BookmarkPlus
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { customMealsApi } from '../lib/api';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const MealBuilder = () => {
  const navigate = useNavigate();
  const [selectedFoods, setSelectedFoods] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [ketoMeals, setKetoMeals] = useState([]);
  const [customMeals, setCustomMeals] = useState([]);
  const [loadingMeals, setLoadingMeals] = useState(true);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [mealName, setMealName] = useState('');
  const [mealDescription, setMealDescription] = useState('');
  const [savingMeal, setSavingMeal] = useState(false);

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    loadKetoMeals();
    loadCustomMeals();
  }, []);

  useEffect(() => {
    if (selectedFoods.length > 0) {
      analyzeMeal();
    } else {
      setAnalysis(null);
    }
  }, [selectedFoods]);

  const loadCustomMeals = async () => {
    try {
      const res = await customMealsApi.getAll();
      setCustomMeals(res.data || []);
    } catch (err) {
      console.error('Failed to load custom meals:', err);
    }
  };

  const loadKetoMeals = async () => {
    try {
      const res = await fetch(`${API_URL}/api/suggestions/keto-meals`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setKetoMeals(data.meal_combos || []);
      }
    } catch (err) {
      console.error('Failed to load keto meals:', err);
    } finally {
      setLoadingMeals(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    
    try {
      const res = await fetch(
        `${API_URL}/api/foods/search?query=${encodeURIComponent(searchQuery)}&page_size=8`,
        { headers: { 'Authorization': `Bearer ${getToken()}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.foods || []);
      }
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const addFood = (food) => {
    if (selectedFoods.find(f => f.fdc_id === food.fdc_id)) {
      toast.error('Food already added');
      return;
    }
    if (selectedFoods.length >= 10) {
      toast.error('Maximum 10 foods per meal');
      return;
    }
    setSelectedFoods([...selectedFoods, food]);
    setSearchResults([]);
    setSearchQuery('');
  };

  const removeFood = (fdcId) => {
    setSelectedFoods(selectedFoods.filter(f => f.fdc_id !== fdcId));
  };

  const analyzeMeal = async () => {
    if (selectedFoods.length === 0) return;
    setAnalyzing(true);
    
    try {
      const fdcIds = selectedFoods.map(f => f.fdc_id);
      const queryString = fdcIds.map(id => `food_ids=${id}`).join('&');
      
      const res = await fetch(
        `${API_URL}/api/meal-builder/analyze?${queryString}`,
        { 
          method: 'POST',
          headers: { 'Authorization': `Bearer ${getToken()}` } 
        }
      );
      
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const getKetoTierColor = (tier) => {
    switch (tier) {
      case 'ultra_low': return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
      case 'low': return 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30';
      case 'moderate': return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
      default: return 'text-red-400 bg-red-500/20 border-red-500/30';
    }
  };

  const handleSaveCustomMeal = async () => {
    if (!mealName.trim() || selectedFoods.length === 0) {
      toast.error('Please add a name and at least one food');
      return;
    }

    setSavingMeal(true);
    try {
      // Prepare foods data with analysis info
      const foodsData = analysis?.foods || selectedFoods.map(f => ({
        fdc_id: f.fdc_id,
        description: f.description,
        protein: f.protein_per_100g || 0,
        carbs: 0,
        fat: 0,
        calories: 0,
        servings: 1,
        serving_size: 100,
        serving_unit: 'g',
        amino_acids: []
      }));

      await customMealsApi.create({
        name: mealName,
        description: mealDescription,
        foods: foodsData
      });

      toast.success('Custom meal saved!');
      setSaveDialogOpen(false);
      setMealName('');
      setMealDescription('');
      loadCustomMeals();
    } catch (err) {
      toast.error('Failed to save meal');
    } finally {
      setSavingMeal(false);
    }
  };

  const handleLogCustomMeal = async (mealId) => {
    try {
      await customMealsApi.log(mealId, 'snack');
      toast.success('Meal added to today\'s log!');
    } catch (err) {
      toast.error('Failed to log meal');
    }
  };

  const handleDeleteCustomMeal = async (mealId) => {
    try {
      await customMealsApi.delete(mealId);
      toast.success('Custom meal deleted');
      loadCustomMeals();
    } catch (err) {
      toast.error('Failed to delete meal');
    }
  };

  // Convert analysis amino acids to array for radar
  const aminoAcidsArray = analysis?.combined_amino_acids 
    ? Object.entries(analysis.combined_amino_acids).map(([name, value]) => ({
        name,
        value,
        is_essential: ['Histidine', 'Isoleucine', 'Leucine', 'Lysine', 'Methionine', 
                       'Phenylalanine', 'Threonine', 'Tryptophan', 'Valine'].includes(name)
      }))
    : [];

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/20 flex items-center justify-center">
              <ChefHat className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="font-heading text-3xl md:text-4xl font-bold text-white">
                Keto Meal Builder
              </h1>
              <p className="text-zinc-500 text-sm">
                Combine foods to create complete protein meals • Low carb focus
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Food Selection */}
          <div className="lg:col-span-5 space-y-6">
            {/* Search */}
            <GlassCard data-testid="food-search-card">
              <GlassCardHeader>
                <GlassCardTitle>Add Foods to Meal</GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent className="pt-0 space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Search keto foods..."
                      data-testid="meal-food-search"
                      className="pl-10 bg-black/50 border-white/10 text-white h-11"
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={searching}
                    className="px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg transition-all"
                  >
                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="bg-black/30 rounded-xl border border-white/5 max-h-64 overflow-y-auto">
                    {searchResults.map((food) => (
                      <button
                        key={food.fdc_id}
                        onClick={() => addFood(food)}
                        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-all border-b border-white/5 last:border-0"
                      >
                        <div className="text-left">
                          <p className="text-sm text-white truncate">{food.description}</p>
                          <p className="text-xs text-emerald-400">{food.protein_per_100g}g protein</p>
                        </div>
                        <Plus className="w-4 h-4 text-emerald-400" />
                      </button>
                    ))}
                  </div>
                )}
              </GlassCardContent>
            </GlassCard>

            {/* Selected Foods */}
            <GlassCard data-testid="selected-foods-card">
              <GlassCardHeader>
                <div className="flex items-center justify-between">
                  <GlassCardTitle>Your Meal ({selectedFoods.length}/10)</GlassCardTitle>
                  {selectedFoods.length > 0 && (
                    <button
                      onClick={() => setSelectedFoods([])}
                      className="text-xs text-zinc-500 hover:text-white transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </GlassCardHeader>
              <GlassCardContent className="pt-0">
                {selectedFoods.length > 0 ? (
                  <div className="space-y-2">
                    {selectedFoods.map((food) => (
                      <div
                        key={food.fdc_id}
                        className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{food.description}</p>
                          <p className="text-xs text-zinc-500">{food.protein_per_100g}g protein per 100g</p>
                        </div>
                        <button
                          onClick={() => removeFood(food.fdc_id)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors ml-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <ChefHat className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-500 text-sm">Search and add foods to build your meal</p>
                  </div>
                )}
              </GlassCardContent>
            </GlassCard>

            {/* Pre-built Keto Meals */}
            <GlassCard data-testid="keto-meals-card">
              <GlassCardHeader>
                <div className="flex items-center gap-2">
                  <Leaf className="w-4 h-4 text-emerald-400" />
                  <GlassCardTitle>Quick Keto Combos</GlassCardTitle>
                </div>
              </GlassCardHeader>
              <GlassCardContent className="pt-0">
                {loadingMeals ? (
                  <div className="py-4 text-center">
                    <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ketoMeals.slice(0, 4).map((meal, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-black/30 border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-white font-medium text-sm">{meal.name}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                            {meal.total_carbs}g carbs
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500">{meal.foods.join(' + ')}</p>
                        <p className="text-xs text-emerald-400 mt-1">{meal.total_protein}g protein</p>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCardContent>
            </GlassCard>
          </div>

          {/* Right: Analysis Results */}
          <div className="lg:col-span-7">
            <GlassCard className="h-full" data-testid="meal-analysis-card">
              <GlassCardHeader>
                <GlassCardTitle>Meal Analysis</GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent className="pt-0">
                {analyzing ? (
                  <div className="py-20 text-center">
                    <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-4" />
                    <p className="text-zinc-500">Analyzing your meal...</p>
                  </div>
                ) : analysis ? (
                  <div className="space-y-6">
                    {/* Keto Status */}
                    <div className={cn(
                      'flex items-center gap-4 p-4 rounded-xl border',
                      getKetoTierColor(analysis.keto_analysis?.tier)
                    )}>
                      <Leaf className="w-8 h-8" />
                      <div>
                        <p className="font-semibold">{analysis.keto_analysis?.label}</p>
                        <p className="text-sm opacity-80">
                          {analysis.keto_analysis?.net_carbs}g net carbs
                          {analysis.keto_analysis?.is_keto_friendly 
                            ? ' • Keto approved!' 
                            : ' • Consider reducing carbs'}
                        </p>
                      </div>
                    </div>

                    {/* Protein Status */}
                    <div className={cn(
                      'flex items-center gap-4 p-4 rounded-xl border',
                      analysis.amino_acid_analysis?.is_complete_protein
                        ? 'bg-emerald-500/10 border-emerald-500/20'
                        : 'bg-amber-500/10 border-amber-500/20'
                    )}>
                      {analysis.amino_acid_analysis?.is_complete_protein ? (
                        <>
                          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                          <div>
                            <p className="text-emerald-400 font-semibold">Complete Protein!</p>
                            <p className="text-sm text-emerald-400/70">
                              All 9 essential amino acids present
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-8 h-8 text-amber-400" />
                          <div>
                            <p className="text-amber-400 font-semibold">
                              {analysis.amino_acid_analysis?.completeness_score}% Complete
                            </p>
                            <p className="text-sm text-amber-400/70">
                              Missing: {analysis.amino_acid_analysis?.essential_missing?.join(', ')}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Macros */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                        <Beef className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                        <p className="text-2xl font-semibold text-emerald-400">
                          {analysis.combined_macros?.protein}g
                        </p>
                        <p className="text-xs text-zinc-500">Protein</p>
                      </div>
                      <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-center">
                        <p className="text-2xl font-semibold text-violet-400">
                          {analysis.combined_macros?.carbs}g
                        </p>
                        <p className="text-xs text-zinc-500">Carbs</p>
                      </div>
                      <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-center">
                        <p className="text-2xl font-semibold text-cyan-400">
                          {analysis.combined_macros?.fat}g
                        </p>
                        <p className="text-xs text-zinc-500">Fat</p>
                      </div>
                      <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center">
                        <Flame className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                        <p className="text-2xl font-semibold text-orange-400">
                          {analysis.combined_macros?.calories}
                        </p>
                        <p className="text-xs text-zinc-500">Calories</p>
                      </div>
                    </div>

                    {/* Amino Acid Radar */}
                    {aminoAcidsArray.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-500 mb-2">
                          Combined Amino Acid Profile
                        </h3>
                        <div className="h-[280px]">
                          <AminoAcidRadar aminoAcids={aminoAcidsArray} />
                        </div>
                      </div>
                    )}

                    {/* Suggestion */}
                    {!analysis.amino_acid_analysis?.is_complete_protein && (
                      <button
                        onClick={() => navigate('/suggestions')}
                        className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-all"
                      >
                        <Sparkles className="w-5 h-5" />
                        Get suggestions to complete your amino acids
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}

                    {/* Save Custom Meal Button */}
                    <button
                      onClick={() => setSaveDialogOpen(true)}
                      data-testid="save-custom-meal-btn"
                      className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold transition-all"
                    >
                      <BookmarkPlus className="w-5 h-5" />
                      Save as Custom Meal
                    </button>
                  </div>
                ) : (
                  <div className="py-20 text-center">
                    <ChefHat className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
                    <p className="text-zinc-500">Add foods to see combined nutrition analysis</p>
                    <p className="text-xs text-zinc-600 mt-2">
                      Build keto meals with complete amino acid profiles
                    </p>
                  </div>
                )}
              </GlassCardContent>
            </GlassCard>

            {/* Custom Meals */}
            {customMeals.length > 0 && (
              <GlassCard className="mt-6" data-testid="custom-meals-card">
                <GlassCardHeader>
                  <div className="flex items-center gap-2">
                    <BookmarkPlus className="w-4 h-4 text-orange-400" />
                    <GlassCardTitle>Your Custom Meals</GlassCardTitle>
                  </div>
                </GlassCardHeader>
                <GlassCardContent className="pt-0">
                  <div className="space-y-3">
                    {customMeals.map((meal) => (
                      <div
                        key={meal.id}
                        className="p-4 rounded-xl bg-black/30 border border-white/5"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-white font-medium">{meal.name}</p>
                            {meal.description && (
                              <p className="text-xs text-zinc-500 mt-0.5">{meal.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full',
                              meal.keto_tier === 'ultra_low' && 'bg-emerald-500/20 text-emerald-400',
                              meal.keto_tier === 'low' && 'bg-cyan-500/20 text-cyan-400',
                              meal.keto_tier === 'moderate' && 'bg-amber-500/20 text-amber-400',
                              meal.keto_tier === 'high' && 'bg-red-500/20 text-red-400'
                            )}>
                              {meal.total_carbs}g carbs
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm mb-3">
                          <span className="text-emerald-400">{meal.total_protein}g protein</span>
                          <span className="text-cyan-400">{meal.total_fat}g fat</span>
                          <span className="text-orange-400">{meal.total_calories} cal</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleLogCustomMeal(meal.id)}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all text-sm"
                          >
                            <Plus className="w-4 h-4" />
                            Log Meal
                          </button>
                          <button
                            onClick={() => handleDeleteCustomMeal(meal.id)}
                            className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-sm"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCardContent>
              </GlassCard>
            )}
          </div>
        </div>
      </div>

      {/* Save Custom Meal Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="font-heading">Save Custom Meal</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            {analysis && (
              <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-400 text-sm">{selectedFoods.length} foods</span>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    getKetoTierColor(analysis.keto_analysis?.tier)
                  )}>
                    {analysis.combined_macros?.carbs}g carbs
                  </span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-emerald-400">{analysis.combined_macros?.protein}g protein</span>
                  <span className="text-cyan-400">{analysis.combined_macros?.fat}g fat</span>
                  <span className="text-orange-400">{analysis.combined_macros?.calories} cal</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-zinc-400">Meal Name</Label>
              <Input
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                placeholder="e.g., Morning Protein Bomb"
                data-testid="custom-meal-name-input"
                className="bg-black/50 border-white/10 text-white h-12"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400">Description (optional)</Label>
              <Input
                value={mealDescription}
                onChange={(e) => setMealDescription(e.target.value)}
                placeholder="Brief description"
                data-testid="custom-meal-desc-input"
                className="bg-black/50 border-white/10 text-white h-12"
              />
            </div>

            <button
              onClick={handleSaveCustomMeal}
              disabled={savingMeal || !mealName.trim()}
              data-testid="confirm-save-meal-btn"
              className="w-full bg-orange-500 hover:bg-orange-400 text-black font-bold px-8 py-3.5 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {savingMeal ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Meal
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};
