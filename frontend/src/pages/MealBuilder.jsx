import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Input } from '../components/ui/input';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import { 
  ChefHat, 
  Loader2, 
  Plus,
  X,
  Search,
  Flame,
  Beef,
  Droplets,
  Wheat,
  Save,
  Trash2,
  Minus
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Unit conversion factors to grams
const unitConversions = {
  g: { factor: 1, label: 'g' },
  oz: { factor: 28.35, label: 'oz' },
  lb: { factor: 453.6, label: 'lb' },
  cup: { factor: 240, label: 'cup' },
  tbsp: { factor: 15, label: 'tbsp' },
  tsp: { factor: 5, label: 'tsp' }
};

export const MealBuilder = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  // State
  const [foods, setFoods] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [mealName, setMealName] = useState('');
  const [saving, setSaving] = useState(false);

  const getToken = () => localStorage.getItem('token');

  // Search foods
  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;
    
    setSearching(true);
    try {
      const res = await fetch(
        `${API_URL}/api/foods/search?query=${encodeURIComponent(searchQuery)}&page_size=10`,
        { headers: { 'Authorization': `Bearer ${getToken()}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.foods || []);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Add food to meal
  const addFood = async (food) => {
    // Fetch full details to get accurate macros
    try {
      const res = await fetch(
        `${API_URL}/api/foods/${food.fdc_id}`,
        { headers: { 'Authorization': `Bearer ${getToken()}` } }
      );
      
      let foodDetails = food;
      if (res.ok) {
        const data = await res.json();
        foodDetails = {
          fdc_id: food.fdc_id,
          description: data.description || food.description,
          calories: data.calories || food.calories || 0,
          protein: data.protein || food.protein || 0,
          fat: data.fat || food.fat || 0,
          carbs: data.carbs || food.carbs || 0,
          portionAmount: 100,
          portionUnit: 'g'
        };
      } else {
        foodDetails = {
          ...food,
          portionAmount: 100,
          portionUnit: 'g'
        };
      }
      
      setFoods([...foods, foodDetails]);
      setSearchQuery('');
      setSearchResults([]);
      setShowSearch(false);
      toast.success(`Added ${foodDetails.description.split(',')[0]}`);
    } catch (err) {
      // Use search result data as fallback
      setFoods([...foods, { ...food, portionAmount: 100, portionUnit: 'g' }]);
      setSearchQuery('');
      setShowSearch(false);
    }
  };

  // Remove food from meal
  const removeFood = (index) => {
    setFoods(foods.filter((_, i) => i !== index));
  };

  // Update portion amount
  const updatePortionAmount = (index, newAmount) => {
    const updated = [...foods];
    updated[index].portionAmount = Math.max(0.1, parseFloat(newAmount) || 1);
    setFoods(updated);
  };

  // Update portion unit
  const updatePortionUnit = (index, newUnit) => {
    const updated = [...foods];
    updated[index].portionUnit = newUnit;
    // Set sensible default amounts per unit
    if (newUnit === 'g') updated[index].portionAmount = 100;
    else if (newUnit === 'oz') updated[index].portionAmount = 3;
    else if (newUnit === 'lb') updated[index].portionAmount = 0.5;
    else if (newUnit === 'cup') updated[index].portionAmount = 1;
    else if (newUnit === 'tbsp') updated[index].portionAmount = 2;
    else if (newUnit === 'tsp') updated[index].portionAmount = 1;
    setFoods(updated);
  };

  // Get grams from portion
  const getGrams = (food) => {
    const conversion = unitConversions[food.portionUnit] || unitConversions.g;
    return food.portionAmount * conversion.factor;
  };

  // Calculate totals
  const totals = foods.reduce((acc, food) => {
    const grams = getGrams(food);
    const multiplier = grams / 100;
    return {
      calories: acc.calories + (food.calories || 0) * multiplier,
      protein: acc.protein + (food.protein || 0) * multiplier,
      fat: acc.fat + (food.fat || 0) * multiplier,
      carbs: acc.carbs + (food.carbs || 0) * multiplier,
    };
  }, { calories: 0, protein: 0, fat: 0, carbs: 0 });

  // Save meal
  const saveMeal = async () => {
    if (!mealName.trim()) {
      toast.error('Please enter a meal name');
      return;
    }
    if (foods.length === 0) {
      toast.error('Add at least one food to the meal');
      return;
    }

    setSaving(true);
    try {
      const mealFoods = foods.map(food => {
        const grams = getGrams(food);
        const multiplier = grams / 100;
        return {
          fdc_id: food.fdc_id,
          description: food.description,
          name: food.description,
          serving_size: grams,
          servings: 1,
          calories: (food.calories || 0) * multiplier,
          protein: (food.protein || 0) * multiplier,
          fat: (food.fat || 0) * multiplier,
          carbs: (food.carbs || 0) * multiplier,
        };
      });

      const res = await fetch(`${API_URL}/api/custom-meals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          name: mealName,
          description: `${foods.length} foods, ${Math.round(totals.protein)}g protein`,
          foods: mealFoods
        })
      });

      if (!res.ok) throw new Error('Failed to save');

      toast.success('Meal saved!');
      navigate('/meals');
    } catch (err) {
      toast.error('Failed to save meal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className={cn(
        "min-h-screen pb-24",
        theme === 'dark' ? 'bg-zinc-950' : 'bg-gray-50'
      )}>
        {/* Header */}
        <div className={cn(
          "sticky top-0 z-10 px-4 py-4 border-b",
          theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-gray-200'
        )}>
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              theme === 'dark' ? 'bg-violet-500/20' : 'bg-violet-100'
            )}>
              <ChefHat className="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <h1 className={cn(
                "text-xl font-bold",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Meal Builder
              </h1>
              <p className={cn(
                "text-xs",
                theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
              )}>
                Combine foods and save as a meal
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* Meal Name Input */}
          <div className={cn(
            "rounded-xl p-4",
            theme === 'dark' ? 'bg-zinc-900' : 'bg-white'
          )}>
            <label className={cn(
              "block text-sm font-medium mb-2",
              theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
            )}>
              Meal Name
            </label>
            <Input
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              placeholder="e.g., Protein Breakfast"
              data-testid="meal-name-input"
              className={cn(
                "h-12",
                theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-200'
              )}
            />
          </div>

          {/* Total Macros Card */}
          <div className={cn(
            "rounded-xl p-4",
            theme === 'dark' ? 'bg-zinc-900' : 'bg-white'
          )}>
            <h3 className={cn(
              "text-xs font-bold uppercase tracking-wider mb-4",
              theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
            )}>
              Total Macros
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <div className={cn(
                  "w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center",
                  theme === 'dark' ? 'bg-orange-500/20' : 'bg-orange-100'
                )}>
                  <Flame className="w-5 h-5 text-orange-500" />
                </div>
                <p className={cn(
                  "text-xl font-bold",
                  theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
                )} data-testid="total-calories">
                  {Math.round(totals.calories)}
                </p>
                <p className={cn("text-xs", theme === 'dark' ? 'text-zinc-600' : 'text-gray-500')}>cal</p>
              </div>
              <div className="text-center">
                <div className={cn(
                  "w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center",
                  theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'
                )}>
                  <Beef className="w-5 h-5 text-red-500" />
                </div>
                <p className={cn(
                  "text-xl font-bold",
                  theme === 'dark' ? 'text-red-400' : 'text-red-600'
                )} data-testid="total-protein">
                  {totals.protein.toFixed(1)}
                </p>
                <p className={cn("text-xs", theme === 'dark' ? 'text-zinc-600' : 'text-gray-500')}>protein</p>
              </div>
              <div className="text-center">
                <div className={cn(
                  "w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center",
                  theme === 'dark' ? 'bg-yellow-500/20' : 'bg-yellow-100'
                )}>
                  <Droplets className="w-5 h-5 text-yellow-500" />
                </div>
                <p className={cn(
                  "text-xl font-bold",
                  theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
                )} data-testid="total-fat">
                  {totals.fat.toFixed(1)}
                </p>
                <p className={cn("text-xs", theme === 'dark' ? 'text-zinc-600' : 'text-gray-500')}>fat</p>
              </div>
              <div className="text-center">
                <div className={cn(
                  "w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center",
                  theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'
                )}>
                  <Wheat className="w-5 h-5 text-blue-500" />
                </div>
                <p className={cn(
                  "text-xl font-bold",
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                )} data-testid="total-carbs">
                  {totals.carbs.toFixed(1)}
                </p>
                <p className={cn("text-xs", theme === 'dark' ? 'text-zinc-600' : 'text-gray-500')}>carbs</p>
              </div>
            </div>
          </div>

          {/* Foods List */}
          <div className={cn(
            "rounded-xl overflow-hidden",
            theme === 'dark' ? 'bg-zinc-900' : 'bg-white'
          )}>
            <div className={cn(
              "px-4 py-3 border-b flex items-center justify-between",
              theme === 'dark' ? 'border-zinc-800' : 'border-gray-100'
            )}>
              <h3 className={cn(
                "text-sm font-bold uppercase tracking-wider",
                theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
              )}>
                Foods ({foods.length})
              </h3>
              <button
                onClick={() => setShowSearch(true)}
                data-testid="add-food-btn"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Food
              </button>
            </div>

            {foods.length === 0 ? (
              <div className="py-12 text-center">
                <ChefHat className={cn(
                  "w-12 h-12 mx-auto mb-3",
                  theme === 'dark' ? 'text-zinc-700' : 'text-gray-300'
                )} />
                <p className={cn(
                  "font-medium mb-1",
                  theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                )}>
                  No foods added yet
                </p>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-zinc-600' : 'text-gray-400'
                )}>
                  Start building your meal
                </p>
              </div>
            ) : (
              <div>
                {foods.map((food, index) => (
                  <div
                    key={`${food.fdc_id}-${index}`}
                    data-testid={`meal-food-${index}`}
                    className={cn(
                      "px-4 py-3 border-b last:border-0",
                      theme === 'dark' ? 'border-zinc-800' : 'border-gray-100'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-medium truncate mb-2",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {food.description?.length > 35 
                            ? food.description.substring(0, 35) + '...'
                            : food.description}
                        </p>
                        
                        {/* Portion Controls with Unit Selection */}
                        <div className="flex flex-col gap-2">
                          {/* Unit selector */}
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(unitConversions).map(([key, unit]) => (
                              <button
                                key={key}
                                onClick={() => updatePortionUnit(index, key)}
                                className={cn(
                                  "px-2 py-0.5 rounded text-xs font-medium transition-colors",
                                  food.portionUnit === key
                                    ? 'bg-emerald-500 text-black'
                                    : theme === 'dark'
                                      ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                )}
                              >
                                {unit.label}
                              </button>
                            ))}
                          </div>
                          
                          {/* Amount controls */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updatePortionAmount(index, food.portionAmount - (food.portionUnit === 'g' ? 25 : 0.5))}
                              className={cn(
                                "p-1 rounded-lg transition-colors",
                                theme === 'dark' 
                                  ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' 
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              )}
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={food.portionAmount}
                                onChange={(e) => updatePortionAmount(index, e.target.value)}
                                step={food.portionUnit === 'g' ? 10 : 0.25}
                                data-testid={`portion-input-${index}`}
                                className={cn(
                                  "w-16 text-center text-sm font-medium py-1 rounded-lg border",
                                  theme === 'dark' 
                                    ? 'bg-zinc-800 border-zinc-700 text-white' 
                                    : 'bg-gray-50 border-gray-200 text-gray-900'
                                )}
                              />
                              <span className={cn(
                                "text-sm min-w-[30px]",
                                theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                              )}>{unitConversions[food.portionUnit]?.label || 'g'}</span>
                            </div>
                            <button
                              onClick={() => updatePortionAmount(index, food.portionAmount + (food.portionUnit === 'g' ? 25 : 0.5))}
                              className={cn(
                                "p-1 rounded-lg transition-colors",
                                theme === 'dark' 
                                  ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' 
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              )}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Macros for this food */}
                      <div className="text-right flex-shrink-0">
                        <p className={cn(
                          "text-sm font-semibold",
                          theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                        )}>
                          {((food.protein || 0) * getGrams(food) / 100).toFixed(1)}g
                        </p>
                        <p className={cn(
                          "text-xs",
                          theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                        )}>
                          {Math.round((food.calories || 0) * getGrams(food) / 100)} cal
                        </p>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeFood(index)}
                        data-testid={`remove-food-${index}`}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          theme === 'dark' 
                            ? 'text-zinc-600 hover:text-red-400 hover:bg-red-500/10' 
                            : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fixed Save Button */}
        <div className={cn(
          "fixed bottom-0 left-0 right-0 p-4 border-t",
          theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-gray-200'
        )}>
          <div className="max-w-2xl mx-auto">
            <button
              onClick={saveMeal}
              disabled={saving || foods.length === 0 || !mealName.trim()}
              data-testid="save-meal-btn"
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-4 rounded-xl transition-colors"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Save Meal
            </button>
          </div>
        </div>

        {/* Search Modal */}
        {showSearch && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
            <div className={cn(
              "w-full max-w-lg max-h-[80vh] rounded-t-2xl sm:rounded-2xl overflow-hidden",
              theme === 'dark' ? 'bg-zinc-900' : 'bg-white'
            )}>
              {/* Search Header */}
              <div className={cn(
                "sticky top-0 p-4 border-b",
                theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'
              )}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={cn(
                    "text-lg font-bold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Add Food
                  </h3>
                  <button
                    onClick={() => setShowSearch(false)}
                    className={cn(
                      "p-2 rounded-lg",
                      theme === 'dark' ? 'text-zinc-400 hover:bg-zinc-800' : 'text-gray-500 hover:bg-gray-100'
                    )}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="relative">
                  <Search className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5",
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-400'
                  )} />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search foods..."
                    autoFocus
                    data-testid="search-food-input"
                    className={cn(
                      "pl-10 h-12",
                      theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-200'
                    )}
                  />
                </div>
              </div>

              {/* Search Results */}
              <div className="overflow-y-auto max-h-[60vh]">
                {searching ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <div>
                    {searchResults.map((food, idx) => (
                      <button
                        key={food.fdc_id || idx}
                        onClick={() => addFood(food)}
                        data-testid={`search-result-${idx}`}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-left border-b transition-colors",
                          theme === 'dark' 
                            ? 'border-zinc-800 hover:bg-zinc-800' 
                            : 'border-gray-100 hover:bg-gray-50'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-medium truncate",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {food.description}
                          </p>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                          )}>
                            {food.calories || 0} cal • {food.protein || 0}g protein
                          </p>
                        </div>
                        <Plus className="w-5 h-5 text-emerald-500" />
                      </button>
                    ))}
                  </div>
                ) : searchQuery.length >= 2 ? (
                  <div className="py-12 text-center">
                    <p className={theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'}>
                      No results for "{searchQuery}"
                    </p>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Search className={cn(
                      "w-10 h-10 mx-auto mb-2",
                      theme === 'dark' ? 'text-zinc-700' : 'text-gray-300'
                    )} />
                    <p className={theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'}>
                      Type to search foods
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
