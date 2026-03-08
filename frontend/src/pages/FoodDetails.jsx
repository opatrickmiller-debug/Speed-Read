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
  const [mealType, setMealType] = useState('snack');
  const [logging, setLogging] = useState(false);

  // Get serving weight from USDA data or default to 100g
  const getServingWeight = () => {
    if (food?.serving_size_grams) return food.serving_size_grams;
    if (food?.serving_size && food?.serving_size_unit === 'g') return food.serving_size;
    return 100;
  };

  // Get serving label (e.g., "1 large egg (50g)")
  const getServingLabel = () => {
    const weight = getServingWeight();
    if (food?.serving_description) {
      return `${food.serving_description} (${weight}g)`;
    }
    return `1 serving (${weight}g)`;
  };

  // Get unit options with dynamic serving size
  const unitConversions = getUnitOptions(getServingWeight(), getServingLabel());

  // Calculate grams from portion amount and unit
  const getGrams = () => {
    return unitToGrams(portionAmount, portionUnit, getServingWeight());
  };

  // Get multiplier for nutrition calculation
  const getMultiplier = () => {
    return getGrams() / 100;
  };

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

  // Handle log food
  const handleLogFood = async () => {
    if (!food) return;
    
    setLogging(true);
    try {
      // Convert portion to grams for backend
      const gramsAmount = getGrams();
      
      // Use simplified quick log endpoint
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/logs/quick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          food_id: fdcId,
          amount: gramsAmount,
          meal: mealType
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to log food');
      }
      
      // Show success toast
      toast.success(data.message || `Added to ${mealType}`);
      
      // Close modal
      setLogModalOpen(false);
      
      // Redirect to food log page
      navigate('/log');
    } catch (err) {
      console.error('Failed to log food:', err);
      toast.error(err.message || 'Failed to log food');
    } finally {
      setLogging(false);
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

        {/* Fixed Log Food Button */}
        <div className={cn(
          "fixed bottom-0 left-0 right-0 p-4 border-t",
          theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-gray-200'
        )}>
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setLogModalOpen(true)}
              data-testid="log-food-btn"
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-xl transition-colors text-lg"
            >
              <Plus className="w-5 h-5" />
              Log Food
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
            
            <div className="space-y-6 pt-4">
              {/* Portion Size with Unit Selection */}
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                )}>
                  Serving Size
                </label>
                
                {/* Amount input with unit dropdown - cleaner layout */}
                <div className="flex items-center gap-2 mb-3">
                  <Input
                    type="number"
                    value={portionAmount}
                    onChange={(e) => setPortionAmount(parseFloat(e.target.value) || 0)}
                    min={0.1}
                    step={portionUnit === 'g' ? 10 : 0.25}
                    data-testid="portion-amount-input"
                    className={cn(
                      "h-12 text-lg font-medium w-24",
                      theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-200'
                    )}
                  />
                  <select
                    value={portionUnit}
                    onChange={(e) => {
                      const newUnit = e.target.value;
                      setPortionUnit(newUnit);
                      // Set sensible defaults
                      if (newUnit === 'g') setPortionAmount(100);
                      else if (newUnit === 'serving') setPortionAmount(1);
                      else if (newUnit === 'oz') setPortionAmount(3);
                      else if (newUnit === 'cup') setPortionAmount(1);
                      else if (newUnit === 'tbsp') setPortionAmount(2);
                      else if (newUnit === 'tsp') setPortionAmount(1);
                      else if (newUnit === 'slice') setPortionAmount(1);
                      else if (newUnit === 'piece') setPortionAmount(1);
                      else setPortionAmount(1);
                    }}
                    data-testid="unit-selector"
                    className={cn(
                      "h-12 px-3 rounded-lg text-base font-medium border appearance-none cursor-pointer",
                      theme === 'dark' 
                        ? 'bg-zinc-800 border-zinc-700 text-white' 
                        : 'bg-gray-50 border-gray-200 text-gray-900'
                    )}
                  >
                    {Object.entries(unitConversions).map(([key, unit]) => (
                      <option key={key} value={key}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Quick amount buttons - universal [½] [1] [2] */}
                <div className="flex gap-2 mb-3">
                  <span className={cn(
                    "text-xs self-center mr-1",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                  )}>Quick:</span>
                  {[0.5, 1, 2, 3].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setPortionAmount(amt)}
                      data-testid={`quick-${amt}`}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors min-w-[40px]",
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
                
                {/* Gram conversion display */}
                <div className={cn(
                  "p-3 rounded-lg",
                  theme === 'dark' ? 'bg-zinc-800/50' : 'bg-gray-100'
                )}>
                  <p className={cn(
                    "text-sm font-medium",
                    theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                  )}>
                    {portionAmount} {unitConversions[portionUnit]?.label} = <span className="text-emerald-500 font-bold">{getGrams().toFixed(1)}g</span>
                  </p>
                  {portionUnit === 'serving' && (
                    <p className={cn(
                      "text-xs mt-1",
                      theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                    )}>
                      {getServingLabel()}
                    </p>
                  )}
                </div>
              </div>

              {/* Meal Type */}
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                )}>
                  Meal
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['breakfast', 'lunch', 'dinner', 'snack'].map(meal => (
                    <button
                      key={meal}
                      onClick={() => setMealType(meal)}
                      data-testid={`meal-${meal}`}
                      className={cn(
                        "px-4 py-3 rounded-lg text-sm font-medium capitalize transition-colors",
                        mealType === meal
                          ? 'bg-emerald-500 text-black'
                          : theme === 'dark'
                            ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      {meal}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calculated Nutrition */}
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-50'
              )}>
                <p className={cn(
                  "text-xs font-medium uppercase tracking-wider mb-3",
                  theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                )}>
                  Nutrition for {portionAmount} {unitConversions[portionUnit].label} ({getGrams().toFixed(0)}g)
                </p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-orange-500">
                      {Math.round(calculateValue(food.calories))}
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                    )}>cal</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-500">
                      {calculateValue(food.protein).toFixed(1)}g
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                    )}>protein</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-yellow-500">
                      {calculateValue(food.fat).toFixed(1)}g
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                    )}>fat</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-blue-500">
                      {calculateValue(food.carbs).toFixed(1)}g
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
