import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { AminoAcidRadar, AminoAcidList } from '../components/AminoAcidRadar';
import { FattyAcidChart, FattyAcidList, OmegaSummary } from '../components/FattyAcidChart';
import { FoodDetailSkeleton } from '../components/Skeletons';
import { Input } from '../components/ui/input';
import { foodsApi, logsApi, favoritesApi } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import { 
  ArrowLeft,
  Heart,
  Plus,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';

export const FoodDetails = () => {
  const { fdcId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  
  const [foodDetails, setFoodDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState(null);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [servings, setServings] = useState(1);
  const [mealType, setMealType] = useState('snack');

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Load food details
  useEffect(() => {
    const loadFoodDetails = async () => {
      if (!fdcId) return;
      
      setLoading(true);
      try {
        const [detailsRes, favRes] = await Promise.all([
          foodsApi.getDetails(fdcId),
          favoritesApi.check(fdcId)
        ]);
        setFoodDetails(detailsRes.data);
        setIsFavorite(favRes.data.is_favorite);
        setFavoriteId(favRes.data.favorite_id);
      } catch (err) {
        if (err.response?.status === 404) {
          toast.error('Food not found. It may have been removed.');
        } else {
          toast.error('Failed to load food details. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadFoodDetails();
  }, [fdcId]);

  const handleBack = () => {
    // Check if we came from search or another page
    if (location.state?.from) {
      navigate(location.state.from);
    } else {
      navigate('/search');
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
        servings,
        calories: foodDetails.calories,
        protein: foodDetails.protein,
        fat: foodDetails.fat,
        carbs: foodDetails.carbs,
        fiber: foodDetails.fiber,
        amino_acids: foodDetails.amino_acids?.map(aa => ({
          name: aa.name,
          value: aa.value,
          is_essential: aa.is_essential
        })) || [],
        fatty_acids: foodDetails.fatty_acids?.map(fa => ({
          name: fa.name,
          value: fa.value,
          is_essential: fa.is_essential,
          omega_type: fa.omega_type
        })) || [],
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

  // Memoize computed values
  const totalProtein = useMemo(() => 
    ((foodDetails?.protein || 0) * servings).toFixed(1)
  , [foodDetails?.protein, servings]);
  
  const totalCalories = useMemo(() => 
    ((foodDetails?.calories || 0) * servings).toFixed(0)
  , [foodDetails?.calories, servings]);

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          onClick={handleBack}
          data-testid="back-to-search-btn"
          className={cn(
            "flex items-center gap-2 mb-6 px-4 py-2 rounded-xl transition-all",
            theme === 'dark' 
              ? 'text-zinc-400 hover:text-white hover:bg-white/5' 
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          )}
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Search</span>
        </button>

        {loading ? (
          <GlassCard className="min-h-[500px]">
            <FoodDetailSkeleton />
          </GlassCard>
        ) : foodDetails ? (
          <GlassCard data-testid="food-detail-card">
            <GlassCardHeader className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <GlassCardTitle className="text-xl md:text-2xl">{foodDetails.description}</GlassCardTitle>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>
                    Per {foodDetails.serving_size}{foodDetails.serving_unit}
                  </p>
                  {/* Source badge */}
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    foodDetails.source === 'usda' ? 'bg-cyan-500/20 text-cyan-600' :
                    foodDetails.source === 'off' ? 'bg-orange-500/20 text-orange-600' :
                    foodDetails.source === 'custom' ? 'bg-purple-500/20 text-purple-600' :
                    theme === 'dark' ? 'bg-zinc-700/50 text-zinc-400' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {foodDetails.source === 'usda' ? 'USDA' :
                     foodDetails.source === 'off' ? 'Open Food Facts' :
                     foodDetails.source === 'custom' ? 'Custom' : 'Unknown'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={toggleFavorite}
                  data-testid="favorite-btn"
                  className={cn(
                    "p-3 rounded-xl transition-all",
                    isFavorite 
                      ? 'bg-pink-500/20 text-pink-500' 
                      : theme === 'dark'
                        ? 'bg-white/5 text-zinc-400 hover:text-white'
                        : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                  )}
                >
                  {isFavorite ? <Heart className="w-5 h-5 fill-current" /> : <Heart className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setLogDialogOpen(true)}
                  data-testid="add-to-log-btn"
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-3 rounded-xl transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Add to Log
                </button>
              </div>
            </GlassCardHeader>
            
            <GlassCardContent className="space-y-6">
              {/* Protein Status */}
              {foodDetails.has_amino_acids ? (
                <div className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border",
                  foodDetails.is_complete_protein 
                    ? 'bg-emerald-500/10 border-emerald-500/20' 
                    : 'bg-amber-500/10 border-amber-500/20'
                )}>
                  {foodDetails.is_complete_protein ? (
                    <>
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      <div>
                        <p className="text-emerald-600 font-semibold">Complete Protein</p>
                        <p className="text-xs text-emerald-600/70">Contains all 9 essential amino acids</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-6 h-6 text-amber-500" />
                      <div>
                        <p className="text-amber-600 font-semibold">Incomplete Protein</p>
                        <p className="text-xs text-amber-600/70">
                          Missing: {foodDetails.missing_amino_acids?.join(', ') || 'Some essential amino acids'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border",
                  theme === 'dark' 
                    ? 'bg-zinc-800/50 border-zinc-700/50'
                    : 'bg-gray-100 border-gray-200'
                )}>
                  <AlertTriangle className={cn(
                    "w-5 h-5",
                    theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
                  )} />
                  <div>
                    <p className={cn(
                      "font-medium text-sm",
                      theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                    )}>Basic Nutrition Data</p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                    )}>Amino acid profile not available for this item</p>
                  </div>
                </div>
              )}

              {/* Macros */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={cn(
                  "p-4 rounded-xl text-center border",
                  theme === 'dark' 
                    ? 'bg-black/30 border-white/5' 
                    : 'bg-emerald-50 border-emerald-100'
                )}>
                  <p className={cn(
                    "text-3xl font-bold",
                    theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                  )}>{foodDetails.protein?.toFixed(1)}</p>
                  <p className={cn(
                    "text-xs mt-1",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>Protein (g)</p>
                </div>
                <div className={cn(
                  "p-4 rounded-xl text-center border",
                  theme === 'dark' 
                    ? 'bg-black/30 border-white/5' 
                    : 'bg-gray-50 border-gray-100'
                )}>
                  <p className={cn(
                    "text-3xl font-bold",
                    theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                  )}>{foodDetails.calories?.toFixed(0)}</p>
                  <p className={cn(
                    "text-xs mt-1",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>Calories</p>
                </div>
                <div className={cn(
                  "p-4 rounded-xl text-center border",
                  theme === 'dark' 
                    ? 'bg-black/30 border-white/5' 
                    : 'bg-gray-50 border-gray-100'
                )}>
                  <p className={cn(
                    "text-3xl font-bold",
                    theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                  )}>{foodDetails.fat?.toFixed(1)}</p>
                  <p className={cn(
                    "text-xs mt-1",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>Fat (g)</p>
                </div>
                <div className={cn(
                  "p-4 rounded-xl text-center border",
                  theme === 'dark' 
                    ? 'bg-black/30 border-white/5' 
                    : 'bg-gray-50 border-gray-100'
                )}>
                  <p className={cn(
                    "text-3xl font-bold",
                    theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                  )}>{foodDetails.carbs?.toFixed(1)}</p>
                  <p className={cn(
                    "text-xs mt-1",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>Carbs (g)</p>
                </div>
              </div>

              {/* Amino Acid Radar */}
              {foodDetails.amino_acids?.length > 0 && (
                <div>
                  <h3 className={cn(
                    "text-sm font-bold uppercase tracking-[0.15em] mb-4",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>
                    Amino Acid Profile
                  </h3>
                  <div className="h-[320px]">
                    <AminoAcidRadar aminoAcids={foodDetails.amino_acids} />
                  </div>
                </div>
              )}

              {/* Amino Acid List */}
              {foodDetails.amino_acids?.length > 0 && (
                <div>
                  <h3 className={cn(
                    "text-sm font-bold uppercase tracking-[0.15em] mb-4",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>
                    Amino Acid Breakdown
                  </h3>
                  <AminoAcidList aminoAcids={foodDetails.amino_acids} showAll />
                </div>
              )}

              {/* Fatty Acid Summary */}
              <OmegaSummary 
                omega3Total={foodDetails.omega3_total || 0}
                omega6Total={foodDetails.omega6_total || 0}
                omegaRatio={foodDetails.omega_ratio}
              />

              {/* Fatty Acid Chart */}
              {foodDetails.fatty_acids?.length > 0 && (
                <div>
                  <h3 className={cn(
                    "text-sm font-bold uppercase tracking-[0.15em] mb-4",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>
                    Fatty Acid Profile
                  </h3>
                  <div className="h-[200px]">
                    <FattyAcidChart fattyAcids={foodDetails.fatty_acids} />
                  </div>
                </div>
              )}

              {/* Fatty Acid List */}
              {foodDetails.fatty_acids?.length > 0 && (
                <div>
                  <h3 className={cn(
                    "text-sm font-bold uppercase tracking-[0.15em] mb-4",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>
                    Fatty Acid Breakdown
                  </h3>
                  <FattyAcidList fattyAcids={foodDetails.fatty_acids} showAll />
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        ) : (
          <GlassCard className="min-h-[300px] flex items-center justify-center">
            <div className="text-center">
              <AlertTriangle className={cn(
                "w-12 h-12 mx-auto mb-4",
                theme === 'dark' ? 'text-zinc-700' : 'text-gray-400'
              )} />
              <p className={theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'}>
                Food not found
              </p>
              <button
                onClick={handleBack}
                className="mt-4 text-emerald-500 hover:text-emerald-400 transition-colors"
              >
                Return to search
              </button>
            </div>
          </GlassCard>
        )}
      </div>

      {/* Add to Log Dialog */}
      <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
        <DialogContent className={cn(
          "border",
          theme === 'dark' 
            ? 'bg-zinc-900 border-white/10 text-white' 
            : 'bg-white border-gray-200 text-gray-900'
        )}>
          <DialogHeader>
            <DialogTitle className="font-heading">Add to Food Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div>
              <p className={cn(
                "font-medium",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>{foodDetails?.description}</p>
              <p className={cn(
                "text-sm mt-1",
                theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
              )}>
                {foodDetails?.serving_size}{foodDetails?.serving_unit} = {foodDetails?.protein?.toFixed(1)}g protein
              </p>
            </div>

            <div className="space-y-2">
              <Label className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'}>Servings</Label>
              <Input
                type="number"
                value={servings}
                onChange={(e) => setServings(parseFloat(e.target.value) || 1)}
                min={0.25}
                step={0.25}
                data-testid="servings-input"
                className={cn(
                  "h-12",
                  theme === 'dark' 
                    ? 'bg-black/50 border-white/10 text-white' 
                    : 'bg-gray-50 border-gray-200 text-gray-900'
                )}
              />
              <p className="text-sm text-emerald-500">
                Total: {totalProtein}g protein, {totalCalories} cal
              </p>
            </div>

            <div className="space-y-2">
              <Label className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'}>Meal type</Label>
              <Select value={mealType} onValueChange={setMealType}>
                <SelectTrigger 
                  data-testid="meal-type-select" 
                  className={cn(
                    "h-12",
                    theme === 'dark' 
                      ? 'bg-black/50 border-white/10 text-white' 
                      : 'bg-gray-50 border-gray-200 text-gray-900'
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={cn(
                  theme === 'dark' 
                    ? 'bg-zinc-900 border-white/10' 
                    : 'bg-white border-gray-200'
                )}>
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
