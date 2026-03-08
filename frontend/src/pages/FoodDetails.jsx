import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AminoAcidRadar } from '../components/AminoAcidRadar';
import { FattyAcidChart } from '../components/FattyAcidChart';
import { foodsApi, logsApi } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { cn, unitToGrams, getUnitOptions } from '../lib/utils';
import { 
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Flame,
  Beef,
  Droplets,
  Wheat,
  Salad,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';

export const FoodDetails = () => {
  const { fdcId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  const [food, setFood] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Log food modal state
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [portionAmount, setPortionAmount] = useState(1);
  const [portionUnit, setPortionUnit] = useState('serving');
  const [selectedServing, setSelectedServing] = useState(null); // USDA serving option
  const [mealType, setMealType] = useState('lunch');
  const [logging, setLogging] = useState(false);
  const [quickLogging, setQuickLogging] = useState(false);
  
  // Live nutrition calculation from server
  const [calculatedNutrition, setCalculatedNutrition] = useState(null);
  const [calculating, setCalculating] = useState(false);

  // Get last logged meal from localStorage or default to time-based meal
  const getSmartDefaultMeal = () => {
    // Check localStorage for last meal
    const lastMeal = localStorage.getItem('lastLoggedMeal');
    if (lastMeal) return lastMeal;
    
    // Time-based default
    const hour = new Date().getHours();
    if (hour < 10) return 'breakfast';
    if (hour < 14) return 'lunch';
    if (hour < 18) return 'snack';
    return 'dinner';
  };

  // Initialize modal state when opening
  useEffect(() => {
    if (logModalOpen && food) {
      setMealType(getSmartDefaultMeal());
      setPortionAmount(1);
      
      // If USDA servings available, select the best default
      if (food.servings && food.servings.length > 0) {
        // Find a good default serving (prefer "large" or first one around 50-100g)
        const defaultServing = food.servings.find(s => 
          s.modifier?.includes('large') || 
          (s.grams >= 50 && s.grams <= 100)
        ) || food.servings[0];
        
        setSelectedServing(defaultServing);
        setPortionUnit('usda_serving');
      } else {
        setSelectedServing(null);
        setPortionUnit('serving');
      }
    }
  }, [logModalOpen, food]);

  // Get serving weight based on selection
  const getServingWeight = () => {
    if (selectedServing) return selectedServing.grams;
    if (food?.serving_size_grams) return food.serving_size_grams;
    if (food?.serving_size && food?.serving_size_unit === 'g') return food.serving_size;
    return 100;
  };

  // Get serving label (e.g., "1 large egg (50g)")
  const getServingLabel = () => {
    if (selectedServing) return selectedServing.label;
    const weight = getServingWeight();
    if (food?.serving_description) {
      return `${food.serving_description} (${weight}g)`;
    }
    return `1 serving (${weight}g)`;
  };

  // Get unit options with dynamic serving size
  const unitConversions = getUnitOptions(getServingWeight(), getServingLabel());

  // Calculate grams from portion amount and unit/serving
  const getGrams = () => {
    if (portionUnit === 'usda_serving' && selectedServing) {
      return portionAmount * selectedServing.grams;
    }
    return unitToGrams(portionAmount, portionUnit, getServingWeight());
  };

  // Get multiplier for nutrition calculation
  const getMultiplier = () => {
    return getGrams() / 100;
  };

  // Calculate nutrition from server when amount or unit changes
  useEffect(() => {
    const calculateFromServer = async () => {
      if (!food || !logModalOpen || portionAmount <= 0) return;
      
      // Get the unit key for the API
      let unitKey = portionUnit;
      if (portionUnit === 'usda_serving' && selectedServing) {
        // Find the unit key from serving index
        const idx = food.servings?.findIndex(s => s.grams === selectedServing.grams);
        if (idx >= 0) {
          // Use the modifier or generate a key
          const s = food.servings[idx];
          const modifier = s.modifier?.toLowerCase().replace(/\s+/g, '_') || `serving_${idx}`;
          const item = food.description?.split(',')[0].toLowerCase().replace(/\s+/g, '_') || '';
          unitKey = modifier.includes('cup') ? 'cup' : 
                    modifier.includes('tbsp') ? 'tbsp' : 
                    `${modifier}_${item}`;
        }
      }
      
      setCalculating(true);
      try {
        const result = await foodsApi.calculate({
          food_id: fdcId,
          amount: portionAmount,
          unit: unitKey
        });
        setCalculatedNutrition(result);
      } catch (err) {
        // Fallback to client-side calculation
        console.log('Server calculation failed, using client-side:', err);
        setCalculatedNutrition(null);
      } finally {
        setCalculating(false);
      }
    };
    
    // Debounce the calculation
    const timer = setTimeout(calculateFromServer, 300);
    return () => clearTimeout(timer);
  }, [fdcId, portionAmount, portionUnit, selectedServing, logModalOpen, food]);

  // Fetch food details on mount
  useEffect(() => {
    const fetchFood = async () => {
      if (!fdcId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const res = await foodsApi.getDetails(fdcId);
        setFood(res.data);
      } catch (err) {
        console.error('Failed to fetch food:', err);
        if (err.response?.status === 404) {
          setError('Food not found');
        } else {
          setError('Failed to load food details');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchFood();
  }, [fdcId]);

  // Calculate nutrition based on portion (converted to grams)
  const calculateValue = (per100g) => {
    if (!per100g) return 0;
    return per100g * getMultiplier();
  };

  // Get serving index for API call
  const getSelectedServingIndex = () => {
    if (!selectedServing || !food?.servings) return -1;
    return food.servings.findIndex(s => s.grams === selectedServing.grams);
  };

  // Handle log food (main function)
  const handleLogFood = async (customGrams = null, customMeal = null) => {
    if (!food) return;
    
    const meal = customMeal || mealType;
    const servingIndex = getSelectedServingIndex();
    
    setLogging(true);
    try {
      let response;
      
      // Use serving endpoint if USDA serving selected, otherwise use grams
      if (portionUnit === 'usda_serving' && servingIndex >= 0) {
        response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/logs/serving`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            food_id: fdcId,
            amount: portionAmount,
            serving_index: servingIndex,
            meal: meal
          })
        });
      } else {
        // Fallback to gram-based logging
        const gramsAmount = customGrams !== null ? customGrams : getGrams();
        response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/logs/quick`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            food_id: fdcId,
            amount: gramsAmount,
            meal: meal
          })
        });
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to log food');
      }
      
      // Save last meal to localStorage for smart defaults
      localStorage.setItem('lastLoggedMeal', meal);
      
      // Show success toast with serving description
      const mealLabel = meal.charAt(0).toUpperCase() + meal.slice(1);
      const servingDesc = data.serving_description || `${Math.round(data.grams || getGrams())}g`;
      toast.success(`Added to ${mealLabel}`, {
        description: servingDesc
      });
      
      // Close modal
      setLogModalOpen(false);
      
      // Navigate to food log
      navigate('/log');
    } catch (err) {
      console.error('Failed to log food:', err);
      toast.error(err.message || 'Failed to log food');
    } finally {
      setLogging(false);
    }
  };

  // Quick 1-tap log (1 serving to current meal)
  const handleQuickLog = async () => {
    if (!food) return;
    
    setQuickLogging(true);
    const servingGrams = getServingWeight();
    const meal = getSmartDefaultMeal();
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/logs/quick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          food_id: fdcId,
          amount: servingGrams,
          meal: meal
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to log food');
      }
      
      // Save last meal
      localStorage.setItem('lastLoggedMeal', meal);
      
      // Show success toast
      const mealLabel = meal.charAt(0).toUpperCase() + meal.slice(1);
      toast.success(`Logged 1 serving to ${mealLabel}`, {
        description: `${servingGrams}g • ${Math.round(food.calories || 0)} cal`
      });
      
      // Navigate to food log
      navigate('/log');
    } catch (err) {
      console.error('Quick log failed:', err);
      toast.error(err.message || 'Failed to log food');
    } finally {
      setQuickLogging(false);
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

  // Error state
  if (error || !food) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-4 py-12">
          <div className={cn(
            "rounded-xl p-8 text-center",
            theme === 'dark' ? 'bg-zinc-900' : 'bg-white'
          )}>
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
            <h2 className={cn(
              "text-xl font-bold mb-2",
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              {error || 'Food Not Found'}
            </h2>
            <p className={cn(
              "mb-6",
              theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
            )}>
              This food may have been removed from the database.
            </p>
            <button
              onClick={() => navigate('/search')}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Back to Search
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={cn(
        "min-h-screen pb-24",
        theme === 'dark' ? 'bg-zinc-950' : 'bg-gray-50'
      )}>
        {/* Header */}
        <div className={cn(
          "sticky top-0 z-10 flex items-center gap-4 px-4 py-4 border-b",
          theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-gray-200'
        )}>
          <button
            onClick={() => navigate('/search')}
            data-testid="back-btn"
            className={cn(
              "p-2 rounded-lg transition-colors",
              theme === 'dark' ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-600'
            )}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className={cn(
            "text-lg font-semibold truncate",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Food Details
          </h1>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* Food Description */}
          <div className={cn(
            "rounded-xl p-6",
            theme === 'dark' ? 'bg-zinc-900' : 'bg-white'
          )}>
            <h2 className={cn(
              "text-2xl font-bold mb-2",
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )} data-testid="food-description">
              {food.description}
            </h2>
            <span className={cn(
              "inline-block text-xs px-2 py-1 rounded font-medium",
              food.source === 'usda' ? 'bg-cyan-500/20 text-cyan-500' :
              food.source === 'off' ? 'bg-orange-500/20 text-orange-500' :
              'bg-purple-500/20 text-purple-500'
            )}>
              {food.source === 'usda' ? 'USDA' : food.source === 'off' ? 'Open Food Facts' : 'Custom'}
            </span>
          </div>

          {/* Nutrition Facts */}
          <div className={cn(
            "rounded-xl p-6",
            theme === 'dark' ? 'bg-zinc-900' : 'bg-white'
          )}>
            <h3 className={cn(
              "text-sm font-bold uppercase tracking-wider mb-4",
              theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
            )}>
              Nutrition per 100g
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {/* Calories */}
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? 'bg-orange-500/10' : 'bg-orange-50'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className={cn(
                    "text-sm font-medium",
                    theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
                  )}>Calories</span>
                </div>
                <p className={cn(
                  "text-3xl font-bold",
                  theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
                )} data-testid="calories-value">
                  {Math.round(food.calories || 0)}
                </p>
                <p className={cn(
                  "text-xs",
                  theme === 'dark' ? 'text-orange-400/70' : 'text-orange-500/70'
                )}>kcal</p>
              </div>

              {/* Protein */}
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Beef className="w-5 h-5 text-red-500" />
                  <span className={cn(
                    "text-sm font-medium",
                    theme === 'dark' ? 'text-red-400' : 'text-red-600'
                  )}>Protein</span>
                </div>
                <p className={cn(
                  "text-3xl font-bold",
                  theme === 'dark' ? 'text-red-400' : 'text-red-600'
                )} data-testid="protein-value">
                  {(food.protein || 0).toFixed(1)}
                </p>
                <p className={cn(
                  "text-xs",
                  theme === 'dark' ? 'text-red-400/70' : 'text-red-500/70'
                )}>grams</p>
              </div>

              {/* Fat */}
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? 'bg-yellow-500/10' : 'bg-yellow-50'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Droplets className="w-5 h-5 text-yellow-500" />
                  <span className={cn(
                    "text-sm font-medium",
                    theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
                  )}>Fat</span>
                </div>
                <p className={cn(
                  "text-3xl font-bold",
                  theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
                )} data-testid="fat-value">
                  {(food.fat || 0).toFixed(1)}
                </p>
                <p className={cn(
                  "text-xs",
                  theme === 'dark' ? 'text-yellow-400/70' : 'text-yellow-500/70'
                )}>grams</p>
              </div>

              {/* Carbs */}
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Wheat className="w-5 h-5 text-blue-500" />
                  <span className={cn(
                    "text-sm font-medium",
                    theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                  )}>Carbs</span>
                </div>
                <p className={cn(
                  "text-3xl font-bold",
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                )} data-testid="carbs-value">
                  {(food.carbs || 0).toFixed(1)}
                </p>
                <p className={cn(
                  "text-xs",
                  theme === 'dark' ? 'text-blue-400/70' : 'text-blue-500/70'
                )}>grams</p>
              </div>

              {/* Fiber */}
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? 'bg-green-500/10' : 'bg-green-50'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Salad className="w-5 h-5 text-green-500" />
                  <span className={cn(
                    "text-sm font-medium",
                    theme === 'dark' ? 'text-green-400' : 'text-green-600'
                  )}>Fiber</span>
                </div>
                <p className={cn(
                  "text-3xl font-bold",
                  theme === 'dark' ? 'text-green-400' : 'text-green-600'
                )} data-testid="fiber-value">
                  {(food.fiber || 0).toFixed(1)}
                </p>
                <p className={cn(
                  "text-xs",
                  theme === 'dark' ? 'text-green-400/70' : 'text-green-500/70'
                )}>grams</p>
              </div>
            </div>
          </div>

          {/* Amino Acid Radar */}
          {food.amino_acids?.length > 0 && (
            <div className={cn(
              "rounded-xl p-6",
              theme === 'dark' ? 'bg-zinc-900' : 'bg-white'
            )}>
              <h3 className={cn(
                "text-sm font-bold uppercase tracking-wider mb-4",
                theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
              )}>
                Amino Acid Profile
              </h3>
              <div className="h-[320px]">
                <AminoAcidRadar aminoAcids={food.amino_acids} />
              </div>
              
              {/* Amino acid list */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {food.amino_acids.filter(aa => aa.is_essential).map(aa => (
                  <div key={aa.name} className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg",
                    theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-50'
                  )}>
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                    )}>{aa.name}</span>
                    <span className="text-sm font-mono text-emerald-500">
                      {aa.value?.toFixed(2)}g
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fatty Acid Chart */}
          {food.fatty_acids?.length > 0 && (
            <div className={cn(
              "rounded-xl p-6",
              theme === 'dark' ? 'bg-zinc-900' : 'bg-white'
            )}>
              <h3 className={cn(
                "text-sm font-bold uppercase tracking-wider mb-4",
                theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
              )}>
                Fatty Acid Profile
              </h3>
              
              {/* Omega Summary */}
              {(food.omega3_total > 0 || food.omega6_total > 0) && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className={cn(
                    "p-3 rounded-lg text-center",
                    theme === 'dark' ? 'bg-cyan-500/10' : 'bg-cyan-50'
                  )}>
                    <p className={cn(
                      "text-xs font-medium",
                      theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
                    )}>Omega-3</p>
                    <p className={cn(
                      "text-xl font-bold",
                      theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
                    )}>{(food.omega3_total || 0).toFixed(2)}g</p>
                  </div>
                  <div className={cn(
                    "p-3 rounded-lg text-center",
                    theme === 'dark' ? 'bg-amber-500/10' : 'bg-amber-50'
                  )}>
                    <p className={cn(
                      "text-xs font-medium",
                      theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                    )}>Omega-6</p>
                    <p className={cn(
                      "text-xl font-bold",
                      theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                    )}>{(food.omega6_total || 0).toFixed(2)}g</p>
                  </div>
                </div>
              )}
              
              <div className="h-[200px]">
                <FattyAcidChart fattyAcids={food.fatty_acids} />
              </div>
            </div>
          )}
        </div>

        {/* Fixed Log Food Buttons */}
        <div className={cn(
          "fixed bottom-0 left-0 right-0 p-4 border-t",
          theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-gray-200'
        )}>
          <div className="max-w-2xl mx-auto space-y-2">
            {/* Quick 1-Tap Log Button */}
            <button
              onClick={handleQuickLog}
              disabled={quickLogging}
              data-testid="quick-log-btn"
              className={cn(
                "w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl transition-colors",
                theme === 'dark' 
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200'
              )}
            >
              {quickLogging ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Log 1 Serving ({getServingWeight()}g)
            </button>
            
            {/* Custom Portion Button */}
            <button
              onClick={() => setLogModalOpen(true)}
              data-testid="log-food-btn"
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-xl transition-colors text-lg"
            >
              <Plus className="w-5 h-5" />
              Log Custom Portion
            </button>
          </div>
        </div>

        {/* Log Food Modal */}
        <Dialog open={logModalOpen} onOpenChange={setLogModalOpen}>
          <DialogContent className={cn(
            "border max-w-md",
            theme === 'dark' ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-gray-200'
          )}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Log Food</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-5 pt-4">
              {/* How much? - MyFitnessPal style */}
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-3",
                  theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                )}>
                  How much?
                </label>
                
                {/* [ 1.0 ] servings of [ 1 egg ▼ ] */}
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={portionAmount}
                    onChange={(e) => setPortionAmount(parseFloat(e.target.value) || 0)}
                    min={0.1}
                    step={0.5}
                    data-testid="portion-amount-input"
                    className={cn(
                      "h-12 text-lg font-medium w-20 text-center",
                      theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-200'
                    )}
                  />
                  
                  <span className={cn(
                    "text-sm",
                    theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                  )}>
                    servings of
                  </span>
                  
                  {/* Serving dropdown - includes USDA servings + standard units */}
                  <select
                    value={selectedServing ? `usda_${selectedServing.grams}` : portionUnit}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith('usda_')) {
                        // USDA serving selected
                        const grams = parseFloat(val.replace('usda_', ''));
                        const serving = food?.servings?.find(s => s.grams === grams);
                        if (serving) {
                          setSelectedServing(serving);
                          setPortionUnit('usda_serving');
                        }
                      } else {
                        // Standard unit selected
                        setSelectedServing(null);
                        setPortionUnit(val);
                      }
                    }}
                    data-testid="serving-selector"
                    className={cn(
                      "h-12 px-3 rounded-lg text-sm font-medium border cursor-pointer flex-1 min-w-0",
                      theme === 'dark' 
                        ? 'bg-zinc-800 border-zinc-700 text-white' 
                        : 'bg-gray-50 border-gray-200 text-gray-900'
                    )}
                  >
                    {/* USDA Servings */}
                    {food?.servings && food.servings.length > 0 && (
                      <optgroup label="Servings">
                        {food.servings.map((serving, idx) => (
                          <option key={`usda_${idx}`} value={`usda_${serving.grams}`}>
                            {serving.label}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    
                    {/* Standard Units */}
                    <optgroup label="Units">
                      <option value="g">1 g</option>
                      <option value="oz">1 oz (28g)</option>
                      <option value="lb">1 lb (454g)</option>
                      <option value="cup">1 cup (240g)</option>
                      <option value="tbsp">1 tbsp (15g)</option>
                      <option value="tsp">1 tsp (5g)</option>
                    </optgroup>
                  </select>
                </div>
                
                {/* Quick amount buttons */}
                <div className="flex items-center gap-2 mt-3">
                  <span className={cn(
                    "text-xs",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>Quick:</span>
                  {[0.5, 1, 2, 3].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setPortionAmount(amt)}
                      data-testid={`quick-${amt}`}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        portionAmount === amt
                          ? 'bg-emerald-500 text-black'
                          : theme === 'dark'
                            ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      {amt === 0.5 ? '½' : amt}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Total = Xg */}
              <div className={cn(
                "p-3 rounded-lg text-center",
                theme === 'dark' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-100'
              )}>
                <p className={cn(
                  "text-lg font-bold",
                  theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                )}>
                  = {getGrams().toFixed(0)}g
                </p>
              </div>

              {/* Meal Type - Single Row */}
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                )}>
                  Add to
                </label>
                <div className="flex gap-2">
                  {['breakfast', 'lunch', 'dinner', 'snack'].map(meal => (
                    <button
                      key={meal}
                      onClick={() => setMealType(meal)}
                      data-testid={`meal-${meal}`}
                      className={cn(
                        "flex-1 px-2 py-2.5 rounded-lg text-sm font-medium capitalize transition-colors",
                        mealType === meal
                          ? 'bg-emerald-500 text-black'
                          : theme === 'dark'
                            ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      {meal === 'breakfast' ? 'Bkfst' : meal === 'dinner' ? 'Dinner' : meal.charAt(0).toUpperCase() + meal.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calculated Nutrition */}
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-50'
              )}>
                <div className="flex items-center justify-between mb-3">
                  <p className={cn(
                    "text-xs font-medium uppercase tracking-wider",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>
                    Nutrition for {calculatedNutrition?.grams?.toFixed(0) || getGrams().toFixed(0)}g
                  </p>
                  {calculating && (
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-orange-500">
                      {Math.round(calculatedNutrition?.nutrition?.calories ?? calculateValue(food.calories))}
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                    )}>cal</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-500">
                      {(calculatedNutrition?.nutrition?.protein ?? calculateValue(food.protein)).toFixed(1)}g
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                    )}>protein</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-yellow-500">
                      {(calculatedNutrition?.nutrition?.fat ?? calculateValue(food.fat)).toFixed(1)}g
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                    )}>fat</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-blue-500">
                      {(calculatedNutrition?.nutrition?.carbs ?? calculateValue(food.carbs)).toFixed(1)}g
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                    )}>carbs</p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleLogFood}
                disabled={logging}
                data-testid="confirm-log-btn"
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-4 rounded-xl transition-colors"
              >
                {logging ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                Add to {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};
