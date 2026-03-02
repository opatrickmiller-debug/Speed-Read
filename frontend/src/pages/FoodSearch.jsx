import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { AminoAcidRadar, AminoAcidList } from '../components/AminoAcidRadar';
import { Input } from '../components/ui/input';
import { foodsApi, logsApi, favoritesApi } from '../lib/api';
import { 
  Search as SearchIcon, 
  Loader2, 
  Heart,
  HeartOff,
  Plus,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';

export const FoodSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [foodDetails, setFoodDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [servings, setServings] = useState(1);
  const [mealType, setMealType] = useState('snack');
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSelectedFood(null);
    setFoodDetails(null);
    
    try {
      const res = await foodsApi.search(query);
      setResults(res.data.foods || []);
    } catch (err) {
      toast.error('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFood = async (food) => {
    setSelectedFood(food);
    setDetailsLoading(true);
    
    try {
      const [detailsRes, favRes] = await Promise.all([
        foodsApi.getDetails(food.fdc_id),
        favoritesApi.check(food.fdc_id)
      ]);
      setFoodDetails(detailsRes.data);
      setIsFavorite(favRes.data.is_favorite);
      setFavoriteId(favRes.data.favorite_id);
    } catch (err) {
      toast.error('Failed to load food details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleAddToLog = async () => {
    if (!foodDetails) return;
    
    try {
      await logsApi.create({
        fdc_id: foodDetails.fdc_id,
        description: foodDetails.description,
        serving_size: foodDetails.serving_size,
        serving_unit: foodDetails.serving_unit,
        servings: servings,
        calories: foodDetails.calories,
        protein: foodDetails.protein,
        fat: foodDetails.fat,
        carbs: foodDetails.carbs,
        fiber: foodDetails.fiber,
        amino_acids: foodDetails.amino_acids.map(aa => ({
          name: aa.name,
          value: aa.value,
          is_essential: aa.is_essential
        })),
        meal_type: mealType
      });
      
      toast.success('Food added to log!');
      setLogDialogOpen(false);
      setServings(1);
    } catch (err) {
      toast.error('Failed to add food to log');
    }
  };

  const toggleFavorite = async () => {
    if (!foodDetails) return;
    
    try {
      if (isFavorite && favoriteId) {
        await favoritesApi.delete(favoriteId);
        setIsFavorite(false);
        setFavoriteId(null);
        toast.success('Removed from favorites');
      } else {
        const res = await favoritesApi.add({
          fdc_id: foodDetails.fdc_id,
          description: foodDetails.description,
          protein_per_100g: foodDetails.protein,
          is_complete_protein: foodDetails.is_complete_protein
        });
        setIsFavorite(true);
        setFavoriteId(res.data.id);
        toast.success('Added to favorites');
      }
    } catch (err) {
      toast.error('Failed to update favorites');
    }
  };

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-white">
            Food Search
          </h1>
          <p className="text-zinc-500 mt-2">
            Search the USDA database for detailed amino acid profiles
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex gap-3 mb-8">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search for chicken, eggs, salmon..."
              data-testid="food-search-input"
              className="pl-12 bg-black/50 border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 h-14 text-lg"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            data-testid="food-search-btn"
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-8 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
          </button>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Search Results */}
          <div className="lg:col-span-5 space-y-3">
            {results.length > 0 ? (
              results.map((food, idx) => (
                <button
                  key={food.fdc_id}
                  onClick={() => handleSelectFood(food)}
                  data-testid={`food-result-${idx}`}
                  className={`w-full text-left p-4 rounded-xl border transition-all animate-fade-in ${
                    selectedFood?.fdc_id === food.fdc_id
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-zinc-900/40 border-white/5 hover:border-white/10'
                  }`}
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{food.description}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {food.brand_owner || food.data_type}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <div className="text-right">
                        <p className="text-emerald-400 font-semibold text-sm">
                          {food.protein_per_100g?.toFixed(1) || 0}g
                        </p>
                        <p className="text-[10px] text-zinc-500">per 100g</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-600" />
                    </div>
                  </div>
                </button>
              ))
            ) : !loading && (
              <div className="py-20 text-center">
                <SearchIcon className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                <p className="text-zinc-500">
                  {query ? 'No results found' : 'Search for foods to see their amino acid profiles'}
                </p>
              </div>
            )}
          </div>

          {/* Food Details */}
          <div className="lg:col-span-7">
            {detailsLoading ? (
              <GlassCard className="h-full flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              </GlassCard>
            ) : foodDetails ? (
              <GlassCard data-testid="food-detail-card">
                <GlassCardHeader className="flex flex-row items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <GlassCardTitle className="text-xl">{foodDetails.description}</GlassCardTitle>
                    <p className="text-sm text-zinc-500 mt-1">
                      Per {foodDetails.serving_size}{foodDetails.serving_unit}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={toggleFavorite}
                      data-testid="favorite-btn"
                      className={`p-2.5 rounded-xl transition-all ${
                        isFavorite 
                          ? 'bg-pink-500/20 text-pink-400' 
                          : 'bg-white/5 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {isFavorite ? <Heart className="w-5 h-5 fill-current" /> : <Heart className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => setLogDialogOpen(true)}
                      data-testid="add-to-log-btn"
                      className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-xl transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Add to Log
                    </button>
                  </div>
                </GlassCardHeader>
                
                <GlassCardContent className="space-y-6">
                  {/* Protein Status */}
                  <div className={`flex items-center gap-3 p-4 rounded-xl ${
                    foodDetails.is_complete_protein 
                      ? 'bg-emerald-500/10 border border-emerald-500/20' 
                      : 'bg-amber-500/10 border border-amber-500/20'
                  }`}>
                    {foodDetails.is_complete_protein ? (
                      <>
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        <div>
                          <p className="text-emerald-400 font-semibold">Complete Protein</p>
                          <p className="text-xs text-emerald-400/70">Contains all 9 essential amino acids</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-6 h-6 text-amber-400" />
                        <div>
                          <p className="text-amber-400 font-semibold">Incomplete Protein</p>
                          <p className="text-xs text-amber-400/70">
                            Missing: {foodDetails.missing_amino_acids?.join(', ') || 'Some essential amino acids'}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Macros */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-center">
                      <p className="text-2xl font-semibold text-white">{foodDetails.protein?.toFixed(1)}</p>
                      <p className="text-xs text-zinc-500 mt-1">Protein (g)</p>
                    </div>
                    <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-center">
                      <p className="text-2xl font-semibold text-zinc-300">{foodDetails.calories?.toFixed(0)}</p>
                      <p className="text-xs text-zinc-500 mt-1">Calories</p>
                    </div>
                    <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-center">
                      <p className="text-2xl font-semibold text-zinc-300">{foodDetails.fat?.toFixed(1)}</p>
                      <p className="text-xs text-zinc-500 mt-1">Fat (g)</p>
                    </div>
                    <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-center">
                      <p className="text-2xl font-semibold text-zinc-300">{foodDetails.carbs?.toFixed(1)}</p>
                      <p className="text-xs text-zinc-500 mt-1">Carbs (g)</p>
                    </div>
                  </div>

                  {/* Amino Acid Radar */}
                  {foodDetails.amino_acids?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-500 mb-4">
                        Amino Acid Profile
                      </h3>
                      <AminoAcidRadar aminoAcids={foodDetails.amino_acids} />
                    </div>
                  )}

                  {/* Amino Acid List */}
                  {foodDetails.amino_acids?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-500 mb-4">
                        Amino Acid Breakdown
                      </h3>
                      <AminoAcidList aminoAcids={foodDetails.amino_acids} showAll />
                    </div>
                  )}
                </GlassCardContent>
              </GlassCard>
            ) : (
              <GlassCard className="h-full flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <SearchIcon className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
                  <p className="text-zinc-500">Select a food to view details</p>
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      </div>

      {/* Add to Log Dialog */}
      <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="font-heading">Add to Food Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div>
              <p className="text-white font-medium">{foodDetails?.description}</p>
              <p className="text-sm text-zinc-500 mt-1">
                {foodDetails?.serving_size}{foodDetails?.serving_unit} = {foodDetails?.protein?.toFixed(1)}g protein
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-zinc-400">Number of servings</Label>
              <Input
                type="number"
                value={servings}
                onChange={(e) => setServings(parseFloat(e.target.value) || 1)}
                min={0.25}
                step={0.25}
                data-testid="servings-input"
                className="bg-black/50 border-white/10 text-white h-12"
              />
              <p className="text-sm text-emerald-400">
                Total: {((foodDetails?.protein || 0) * servings).toFixed(1)}g protein
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400">Meal type</Label>
              <Select value={mealType} onValueChange={setMealType}>
                <SelectTrigger data-testid="meal-type-select" className="bg-black/50 border-white/10 text-white h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10">
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="snack">Snack</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <button
              onClick={handleAddToLog}
              data-testid="confirm-add-log-btn"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-8 py-3.5 rounded-full transition-all"
            >
              Add to Log
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};
