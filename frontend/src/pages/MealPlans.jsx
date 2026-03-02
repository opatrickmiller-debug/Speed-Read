import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { mealPlansApi, foodsApi } from '../lib/api';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { 
  Plus, 
  Trash2, 
  Loader2,
  CalendarDays,
  Search,
  X,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

export const MealPlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDescription, setNewPlanDescription] = useState('');
  const [selectedFoods, setSelectedFoods] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const res = await mealPlansApi.getAll();
      setPlans(res.data);
    } catch (err) {
      console.error('Failed to load meal plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    
    try {
      const res = await foodsApi.search(searchQuery, 1, 10);
      setSearchResults(res.data.foods || []);
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const addFoodToPlan = async (food) => {
    try {
      const details = await foodsApi.getDetails(food.fdc_id);
      setSelectedFoods([...selectedFoods, {
        fdc_id: details.data.fdc_id,
        description: details.data.description,
        serving_size: details.data.serving_size,
        serving_unit: details.data.serving_unit,
        servings: 1,
        protein: details.data.protein,
        calories: details.data.calories
      }]);
      setSearchResults([]);
      setSearchQuery('');
    } catch (err) {
      toast.error('Failed to add food');
    }
  };

  const removeFoodFromPlan = (index) => {
    setSelectedFoods(selectedFoods.filter((_, i) => i !== index));
  };

  const updateServings = (index, servings) => {
    const updated = [...selectedFoods];
    updated[index].servings = servings;
    setSelectedFoods(updated);
  };

  const handleCreatePlan = async () => {
    if (!newPlanName.trim() || selectedFoods.length === 0) {
      toast.error('Please add a name and at least one food');
      return;
    }
    
    try {
      await mealPlansApi.create({
        name: newPlanName,
        description: newPlanDescription,
        foods: selectedFoods
      });
      toast.success('Meal plan created!');
      setCreateDialogOpen(false);
      setNewPlanName('');
      setNewPlanDescription('');
      setSelectedFoods([]);
      loadPlans();
    } catch (err) {
      toast.error('Failed to create meal plan');
    }
  };

  const handleDeletePlan = async (planId) => {
    try {
      await mealPlansApi.delete(planId);
      toast.success('Meal plan deleted');
      loadPlans();
    } catch (err) {
      toast.error('Failed to delete meal plan');
    }
  };

  const totalProtein = selectedFoods.reduce(
    (sum, food) => sum + (food.protein * food.servings), 0
  );
  const totalCalories = selectedFoods.reduce(
    (sum, food) => sum + (food.calories * food.servings), 0
  );

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-white">
              Meal Plans
            </h1>
            <p className="text-zinc-500 mt-2">
              Create and save your favorite meal combinations
            </p>
          </div>
          
          <button
            onClick={() => setCreateDialogOpen(true)}
            data-testid="create-meal-plan-btn"
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-3 rounded-full transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
          >
            <Plus className="w-5 h-5" />
            Create Plan
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : plans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {plans.map((plan) => (
              <GlassCard key={plan.id} data-testid={`meal-plan-${plan.id}`}>
                <GlassCardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <GlassCardTitle>{plan.name}</GlassCardTitle>
                    {plan.description && (
                      <p className="text-sm text-zinc-500 mt-1">{plan.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeletePlan(plan.id)}
                    data-testid={`delete-plan-${plan.id}`}
                    className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </GlassCardHeader>
                <GlassCardContent className="pt-0">
                  <div className="flex items-center gap-6 mb-4 py-3 border-b border-white/5">
                    <div>
                      <p className="text-2xl font-semibold text-emerald-400">
                        {plan.total_protein?.toFixed(0)}g
                      </p>
                      <p className="text-xs text-zinc-500">Protein</p>
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-zinc-300">
                        {plan.total_calories?.toFixed(0)}
                      </p>
                      <p className="text-xs text-zinc-500">Calories</p>
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-zinc-300">
                        {plan.foods?.length || 0}
                      </p>
                      <p className="text-xs text-zinc-500">Foods</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {plan.foods?.slice(0, 3).map((food, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                        <span className="text-sm text-zinc-300 truncate flex-1">
                          {food.description}
                        </span>
                        <span className="text-sm text-emerald-400 ml-3">
                          {(food.protein * food.servings).toFixed(1)}g
                        </span>
                      </div>
                    ))}
                    {plan.foods?.length > 3 && (
                      <p className="text-xs text-zinc-600 pt-1">
                        +{plan.foods.length - 3} more foods
                      </p>
                    )}
                  </div>
                </GlassCardContent>
              </GlassCard>
            ))}
          </div>
        ) : (
          <GlassCard>
            <GlassCardContent className="py-16 text-center">
              <CalendarDays className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500">No meal plans yet</p>
              <p className="text-sm text-zinc-600 mt-2">
                Create your first meal plan to save your favorite combinations
              </p>
            </GlassCardContent>
          </GlassCard>
        )}
      </div>

      {/* Create Plan Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Create Meal Plan</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label className="text-zinc-400">Plan Name</Label>
              <Input
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                placeholder="e.g., High Protein Day"
                data-testid="plan-name-input"
                className="bg-black/50 border-white/10 text-white h-12"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-zinc-400">Description (optional)</Label>
              <Input
                value={newPlanDescription}
                onChange={(e) => setNewPlanDescription(e.target.value)}
                placeholder="Brief description of this meal plan"
                data-testid="plan-description-input"
                className="bg-black/50 border-white/10 text-white h-12"
              />
            </div>

            {/* Food Search */}
            <div className="space-y-3">
              <Label className="text-zinc-400">Add Foods</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search foods..."
                    data-testid="plan-food-search"
                    className="pl-10 bg-black/50 border-white/10 text-white h-10"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="px-4 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                </button>
              </div>
              
              {searchResults.length > 0 && (
                <div className="bg-black/30 rounded-xl border border-white/5 max-h-48 overflow-y-auto">
                  {searchResults.map((food, idx) => (
                    <button
                      key={food.fdc_id}
                      onClick={() => addFoodToPlan(food)}
                      className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-all border-b border-white/5 last:border-0"
                    >
                      <span className="text-sm text-zinc-300 truncate">{food.description}</span>
                      <ChevronRight className="w-4 h-4 text-zinc-600" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Foods */}
            {selectedFoods.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-zinc-400">Selected Foods</Label>
                  <div className="text-sm">
                    <span className="text-emerald-400 font-semibold">{totalProtein.toFixed(1)}g</span>
                    <span className="text-zinc-500"> protein · </span>
                    <span className="text-zinc-300">{totalCalories.toFixed(0)}</span>
                    <span className="text-zinc-500"> cal</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {selectedFoods.map((food, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-white/5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{food.description}</p>
                        <p className="text-xs text-zinc-500">{food.protein}g protein per serving</p>
                      </div>
                      <Input
                        type="number"
                        value={food.servings}
                        onChange={(e) => updateServings(idx, parseFloat(e.target.value) || 1)}
                        min={0.25}
                        step={0.25}
                        className="w-20 h-8 bg-black/50 border-white/10 text-white text-center text-sm"
                      />
                      <button
                        onClick={() => removeFoodFromPlan(idx)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleCreatePlan}
              disabled={!newPlanName.trim() || selectedFoods.length === 0}
              data-testid="save-meal-plan-btn"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-8 py-3.5 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Meal Plan
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};
