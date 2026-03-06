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
  const [portionAmount, setPortionAmount] = useState(100);
  const [portionUnit, setPortionUnit] = useState('g');
  
  // Get meal type from URL params
  const urlParams = new URLSearchParams(location.search);
  const [mealType, setMealType] = useState(urlParams.get('meal') || 'snack');

  const [notFoundError, setNotFoundError] = useState(false);

  // Portion unit conversions to grams
  const UNIT_TO_GRAMS = {
    'g': 1,
    'oz': 28.35,
    'cup': 240,
    'tbsp': 15,
    'tsp': 5,
    'serving': null // Will use food's serving_size
  };

  // Calculate grams from current portion selection
  const getGramsFromPortion = () => {
    if (portionUnit === 'serving' && foodDetails?.serving_size) {
      return portionAmount * foodDetails.serving_size;
    }
    return portionAmount * (UNIT_TO_GRAMS[portionUnit] || 1);
  };

  // Calculate nutrition values based on portion
  const calculateNutrition = (value) => {
    if (!value) return 0;
    const grams = getGramsFromPortion();
    return (value * grams / 100).toFixed(1);
  };

  const totalProtein = calculateNutrition(foodDetails?.protein);
  const totalCalories = Math.round(calculateNutrition(foodDetails?.calories));
  const totalFat = calculateNutrition(foodDetails?.fat);
  const totalCarbs = calculateNutrition(foodDetails?.carbs);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Load food details
  useEffect(() => {
    const loadFoodDetails = async () => {
      if (!fdcId) return;
      
      setLoading(true);
      setNotFoundError(false);
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
          setNotFoundError(true);
          toast.error('Food not found. It may have been removed from the database.');
        } else {
          toast.error('Failed to load food details. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadFoodDetails();
  }, [fdcId]);

  // Get search query from URL params to pass back
  const searchParams = new URLSearchParams(location.search);
  const searchQuery = searchParams.get('q');
  const mealParam = searchParams.get('meal') || 'snack';

  const handleBack = () => {
    // Build the return URL with preserved search query and meal
    let returnUrl = '/search';
    const params = new URLSearchParams();
    params.set('meal', mealParam);
    if (searchQuery) {
      params.set('q', searchQuery);
    }
    returnUrl += '?' + params.toString();
    navigate(returnUrl);
  };

  const handleAddToLog = async () => {
    if (!foodDetails) return;
    
    const grams = getGramsFromPortion();
    const servingsCalc = grams / (foodDetails.serving_size || 100);
    
    try {
      await logsApi.create({
        fdc_id: foodDetails.fdc_id,
        description: foodDetails.description,
        serving_size: grams,
        serving_unit: 'g',
        servings: 1,
        calories: parseFloat(totalCalories) || 0,
        protein: parseFloat(totalProtein) || 0,
        fat: parseFloat(totalFat) || 0,
        carbs: parseFloat(totalCarbs) || 0,
        fiber: calculateNutrition(foodDetails.fiber) || 0,
        amino_acids: foodDetails.amino_acids?.map(aa => ({
          name: aa.name,
          value: parseFloat((aa.value * grams / 100).toFixed(2)),
          is_essential: aa.is_essential
        })) || [],
        fatty_acids: foodDetails.fatty_acids?.map(fa => ({
          name: fa.name,
          value: parseFloat((fa.value * grams / 100).toFixed(2)),
          is_essential: fa.is_essential,
          omega_type: fa.omega_type
        })) || [],
        meal_type: mealType
      });
      
      toast.success('Food added to log!');
      setLogDialogOpen(false);
      setPortionAmount(100);
      setPortionUnit('g');
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
        ) : notFoundError ? (
          <GlassCard className="min-h-[300px] flex items-center justify-center">
            <div className="text-center px-6">
              <AlertTriangle className={cn(
                "w-12 h-12 mx-auto mb-4",
                theme === 'dark' ? 'text-amber-500' : 'text-amber-500'
              )} />
              <p className={cn(
                "text-lg font-semibold mb-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Food Not Found
              </p>
              <p className={cn(
                "text-sm mb-4",
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
              )}>
                This item may have been removed from the USDA database. 
                Please search for a similar food.
              </p>
              <button
                onClick={handleBack}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                Search Again
              </button>
            </div>
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
          "border max-w-md",
          theme === 'dark' 
            ? 'bg-zinc-900 border-white/10 text-white' 
            : 'bg-white border-gray-200 text-gray-900'
        )}>
          <DialogHeader>
            <DialogTitle className="font-heading">Add to Food Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-4">
            <div>
              <p className={cn(
                "font-medium",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>{foodDetails?.description}</p>
              <p className={cn(
                "text-sm mt-1",
                theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
              )}>
                Per 100g: {foodDetails?.protein?.toFixed(1)}g protein, {Math.round(foodDetails?.calories || 0)} cal
              </p>
            </div>

            {/* Portion Amount & Unit */}
            <div className="space-y-2">
              <Label className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'}>Portion Size</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={portionAmount}
                  onChange={(e) => setPortionAmount(parseFloat(e.target.value) || 0)}
                  min={0}
                  step={portionUnit === 'g' ? 10 : 0.25}
                  data-testid="portion-amount-input"
                  className={cn(
                    "h-12 flex-1",
                    theme === 'dark' 
                      ? 'bg-black/50 border-white/10 text-white' 
                      : 'bg-gray-50 border-gray-200 text-gray-900'
                  )}
                />
                <Select value={portionUnit} onValueChange={setPortionUnit}>
                  <SelectTrigger 
                    data-testid="portion-unit-select" 
                    className={cn(
                      "h-12 w-28",
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
                    <SelectItem value="g">grams</SelectItem>
                    <SelectItem value="oz">oz</SelectItem>
                    <SelectItem value="cup">cup</SelectItem>
                    <SelectItem value="tbsp">tbsp</SelectItem>
                    <SelectItem value="tsp">tsp</SelectItem>
                    {foodDetails?.serving_size && (
                      <SelectItem value="serving">
                        serving ({foodDetails.serving_size}g)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Quick portion buttons */}
              <div className="flex flex-wrap gap-2 mt-2">
                {portionUnit === 'g' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPortionAmount(50)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        portionAmount === 50
                          ? 'bg-emerald-500 text-black'
                          : theme === 'dark'
                            ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      50g
                    </button>
                    <button
                      type="button"
                      onClick={() => setPortionAmount(100)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        portionAmount === 100
                          ? 'bg-emerald-500 text-black'
                          : theme === 'dark'
                            ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      100g
                    </button>
                    <button
                      type="button"
                      onClick={() => setPortionAmount(150)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        portionAmount === 150
                          ? 'bg-emerald-500 text-black'
                          : theme === 'dark'
                            ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      150g
                    </button>
                    <button
                      type="button"
                      onClick={() => setPortionAmount(200)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        portionAmount === 200
                          ? 'bg-emerald-500 text-black'
                          : theme === 'dark'
                            ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      200g
                    </button>
                  </>
                )}
                {portionUnit === 'oz' && (
                  <>
                    {[1, 2, 3, 4, 6].map(oz => (
                      <button
                        key={oz}
                        type="button"
                        onClick={() => setPortionAmount(oz)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                          portionAmount === oz
                            ? 'bg-emerald-500 text-black'
                            : theme === 'dark'
                              ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        )}
                      >
                        {oz} oz
                      </button>
                    ))}
                  </>
                )}
                {portionUnit === 'cup' && (
                  <>
                    {[0.25, 0.5, 0.75, 1].map(cup => (
                      <button
                        key={cup}
                        type="button"
                        onClick={() => setPortionAmount(cup)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                          portionAmount === cup
                            ? 'bg-emerald-500 text-black'
                            : theme === 'dark'
                              ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        )}
                      >
                        {cup === 0.25 ? '¼' : cup === 0.5 ? '½' : cup === 0.75 ? '¾' : cup} cup
                      </button>
                    ))}
                  </>
                )}
                {portionUnit === 'serving' && foodDetails?.serving_size && (
                  <>
                    {[0.5, 1, 1.5, 2].map(srv => (
                      <button
                        key={srv}
                        type="button"
                        onClick={() => setPortionAmount(srv)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                          portionAmount === srv
                            ? 'bg-emerald-500 text-black'
                            : theme === 'dark'
                              ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        )}
                      >
                        {srv === 0.5 ? '½' : srv} srv
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Nutrition Summary */}
            <div className={cn(
              "p-4 rounded-xl",
              theme === 'dark' ? 'bg-black/30' : 'bg-gray-50'
            )}>
              <p className={cn(
                "text-xs uppercase tracking-wider mb-2",
                theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
              )}>
                Nutrition for {portionAmount} {portionUnit}
                {portionUnit !== 'g' && ` (${Math.round(getGramsFromPortion())}g)`}
              </p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-emerald-500">{totalCalories}</p>
                  <p className={cn("text-xs", theme === 'dark' ? 'text-zinc-500' : 'text-gray-500')}>cal</p>
                </div>
                <div>
                  <p className={cn("text-lg font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{totalProtein}g</p>
                  <p className={cn("text-xs", theme === 'dark' ? 'text-zinc-500' : 'text-gray-500')}>protein</p>
                </div>
                <div>
                  <p className={cn("text-lg font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{totalCarbs}g</p>
                  <p className={cn("text-xs", theme === 'dark' ? 'text-zinc-500' : 'text-gray-500')}>carbs</p>
                </div>
                <div>
                  <p className={cn("text-lg font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{totalFat}g</p>
                  <p className={cn("text-xs", theme === 'dark' ? 'text-zinc-500' : 'text-gray-500')}>fat</p>
                </div>
              </div>
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
