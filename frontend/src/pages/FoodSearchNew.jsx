import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Input } from '../components/ui/input';
import { foodsApi, logsApi, popularityApi } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import { 
  Search as SearchIcon, 
  Loader2, 
  ChevronRight,
  X,
  Plus,
  Clock,
  Star,
  Barcode,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Flame,
  Beef,
  Droplets,
  Wheat
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Meal type icons and labels
const MEAL_OPTIONS = [
  { id: 'breakfast', label: 'Breakfast', icon: Coffee },
  { id: 'lunch', label: 'Lunch', icon: Sun },
  { id: 'dinner', label: 'Dinner', icon: Moon },
  { id: 'snack', label: 'Snack', icon: Cookie }
];

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}

export const FoodSearch = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedMeal, setSelectedMeal] = useState(searchParams.get('meal') || 'snack');
  const inputRef = useRef(null);
  
  // Get initial query from URL params (for back navigation)
  const initialQuery = searchParams.get('q') || '';
  
  // Update URL when meal changes (preserve query)
  const handleMealChange = (meal) => {
    setSelectedMeal(meal);
    const newParams = { meal };
    if (query) newParams.q = query;
    setSearchParams(newParams);
  };
  
  // Search state - initialize from URL
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Tabs: recent, frequent, all
  const [activeTab, setActiveTab] = useState(initialQuery ? 'all' : 'recent');
  const [recentFoods, setRecentFoods] = useState([]);
  const [frequentFoods, setFrequentFoods] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Quick Add dialog
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddData, setQuickAddData] = useState({ calories: '', protein: '', carbs: '', fat: '' });
  
  const debouncedQuery = useDebounce(query, 300);
  const getToken = () => localStorage.getItem('token');

  // Load recent and frequent foods
  useEffect(() => {
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const token = getToken();
        const headers = { 'Authorization': `Bearer ${token}` };
        
        // Get recent food logs
        const logsRes = await fetch(`${API_URL}/api/logs?limit=50`, { headers });
        if (logsRes.ok) {
          const logs = await logsRes.json();
          
          // Get unique recent foods (last 20)
          const seen = new Set();
          const recent = [];
          for (const log of logs) {
            const key = log.fdc_id || log.description;
            if (!seen.has(key)) {
              seen.add(key);
              recent.push({
                fdc_id: log.fdc_id,
                description: log.description,
                calories: log.calories,
                protein: log.protein,
                carbs: log.carbs,
                fat: log.fat,
                serving_size: log.serving_size,
                serving_unit: log.serving_unit
              });
              if (recent.length >= 20) break;
            }
          }
          setRecentFoods(recent);
          
          // Calculate frequent foods (most logged)
          const frequency = {};
          for (const log of logs) {
            const key = log.fdc_id || log.description;
            if (!frequency[key]) {
              frequency[key] = { count: 0, food: {
                fdc_id: log.fdc_id,
                description: log.description,
                calories: log.calories,
                protein: log.protein,
                carbs: log.carbs,
                fat: log.fat,
                serving_size: log.serving_size,
                serving_unit: log.serving_unit
              }};
            }
            frequency[key].count++;
          }
          
          const frequent = Object.values(frequency)
            .sort((a, b) => b.count - a.count)
            .slice(0, 20)
            .map(f => ({ ...f.food, logCount: f.count }));
          setFrequentFoods(frequent);
        }
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    
    loadHistory();
  }, []);

  // Auto-search when query changes and update URL
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      performSearch(debouncedQuery);
      // Update URL with search query (preserve meal)
      setSearchParams({ meal: selectedMeal, q: debouncedQuery });
      setActiveTab('all');
    } else {
      setResults([]);
      // Clear query from URL when empty
      if (searchParams.get('q')) {
        setSearchParams({ meal: selectedMeal });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const performSearch = async (searchQuery) => {
    setLoading(true);
    try {
      const res = await foodsApi.search(searchQuery, false);
      setResults(res.data.foods || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFood = useCallback((food) => {
    const fdcId = food.fdc_id || food.id;
    
    // Track food selection for popularity ranking (fire and forget)
    popularityApi.trackSelection(fdcId, food.description, food.source || 'usda').catch(() => {});
    
    // Include search query in URL so we can return to it
    const returnQuery = query ? `&q=${encodeURIComponent(query)}` : '';
    navigate(`/food/${encodeURIComponent(fdcId)}?meal=${selectedMeal}${returnQuery}`, { 
      state: { from: '/search', searchQuery: query } 
    });
  }, [navigate, selectedMeal, query]);

  const handleQuickLog = async (food) => {
    try {
      // Use simplified quick log endpoint
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/logs/quick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          food_id: food.fdc_id,
          amount: 100, // Default 100g serving
          meal: selectedMeal
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to log food');
      }
      
      toast.success(data.message || `Added ${food.description.split(',')[0]} to ${selectedMeal}`);
    } catch (err) {
      console.error('Quick log failed:', err);
      toast.error(err.message || 'Failed to log food');
    }
  };

  const handleQuickAdd = async () => {
    const { calories, protein, carbs, fat } = quickAddData;
    if (!calories && !protein && !carbs && !fat) {
      toast.error('Please enter at least one value');
      return;
    }
    
    try {
      await logsApi.create({
        fdc_id: `quick_${Date.now()}`,
        description: 'Quick Add',
        serving_size: 1,
        serving_unit: 'serving',
        servings: 1,
        calories: parseFloat(calories) || 0,
        protein: parseFloat(protein) || 0,
        fat: parseFloat(fat) || 0,
        carbs: parseFloat(carbs) || 0,
        fiber: 0,
        amino_acids: [],
        fatty_acids: [],
        meal_type: selectedMeal
      });
      toast.success('Quick Add logged!');
      setQuickAddOpen(false);
      setQuickAddData({ calories: '', protein: '', carbs: '', fat: '' });
    } catch (err) {
      toast.error('Failed to log');
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  // Loading skeleton for search results
  const FoodItemSkeleton = () => (
    <div className={cn(
      "p-4 border-b last:border-0 animate-pulse",
      theme === 'dark' ? 'border-white/5' : 'border-gray-100'
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className={cn(
            "h-4 w-3/4 rounded mb-2",
            theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-200'
          )} />
          <div className={cn(
            "h-3 w-1/2 rounded mb-3",
            theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-200'
          )} />
          <div className="flex gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className={cn(
                "h-10 w-16 rounded-lg",
                theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-200'
              )} />
            ))}
          </div>
        </div>
        <div className={cn(
          "w-5 h-5 rounded",
          theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-200'
        )} />
      </div>
    </div>
  );

  // Render food item card with macro summary
  const FoodItem = ({ food, showQuickLog = false }) => {
    // Handle both old format (calories_per_100g) and new format (calories)
    const calories = food.calories ?? food.calories_per_100g ?? 0;
    const protein = food.protein ?? food.protein_per_100g ?? 0;
    const fat = food.fat ?? food.fat_per_100g ?? 0;
    const carbs = food.carbs ?? food.carbs_per_100g ?? 0;
    
    return (
      <div
        onClick={() => handleSelectFood(food)}
        data-testid={`food-item-${food.fdc_id}`}
        className={cn(
          "p-4 border-b last:border-0 transition-colors cursor-pointer",
          theme === 'dark' ? 'border-white/5 active:bg-white/5' : 'border-gray-100 active:bg-gray-50'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Food Description */}
            <div className="flex items-center gap-2 mb-1">
              <p className={cn(
                "font-medium",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {food.description?.length > 50 
                  ? food.description.substring(0, 50) + '...'
                  : food.description}
              </p>
            </div>
            
            {/* Tier Label Badge */}
            {food.tier_label && (
              <span className={cn(
                "inline-block text-[10px] px-2 py-0.5 rounded-full font-medium mb-3",
                food.tier_label === 'Best Match' || food.tier_label === 'Your Food'
                  ? 'bg-emerald-500/20 text-emerald-500'
                  : food.tier_label === 'Verified'
                    ? 'bg-blue-500/20 text-blue-500'
                    : theme === 'dark'
                      ? 'bg-zinc-700 text-zinc-400'
                      : 'bg-gray-200 text-gray-600'
              )}>
                {food.tier_label}
              </span>
            )}
            
            {/* Macro Cards Row */}
            <div className="flex gap-2 flex-wrap">
              {/* Calories */}
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs",
                theme === 'dark' ? 'bg-orange-500/10' : 'bg-orange-50'
              )}>
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span className={cn(
                  "font-semibold",
                  theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
                )}>
                  {Math.round(calories)}
                </span>
                <span className={theme === 'dark' ? 'text-orange-400/70' : 'text-orange-500/70'}>cal</span>
              </div>
              
              {/* Protein */}
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs",
                theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'
              )}>
                <Beef className="w-3.5 h-3.5 text-red-500" />
                <span className={cn(
                  "font-semibold",
                  theme === 'dark' ? 'text-red-400' : 'text-red-600'
                )}>
                  {protein.toFixed(1)}g
                </span>
                <span className={theme === 'dark' ? 'text-red-400/70' : 'text-red-500/70'}>P</span>
              </div>
              
              {/* Fat */}
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs",
                theme === 'dark' ? 'bg-yellow-500/10' : 'bg-yellow-50'
              )}>
                <Droplets className="w-3.5 h-3.5 text-yellow-500" />
                <span className={cn(
                  "font-semibold",
                  theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
                )}>
                  {fat.toFixed(1)}g
                </span>
                <span className={theme === 'dark' ? 'text-yellow-400/70' : 'text-yellow-500/70'}>F</span>
              </div>
              
              {/* Carbs */}
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs",
                theme === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50'
              )}>
                <Wheat className="w-3.5 h-3.5 text-blue-500" />
                <span className={cn(
                  "font-semibold",
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                )}>
                  {carbs.toFixed(1)}g
                </span>
                <span className={theme === 'dark' ? 'text-blue-400/70' : 'text-blue-500/70'}>C</span>
              </div>
            </div>
          </div>
          
          {/* Quick Log Button */}
          {showQuickLog && (
            <button
              onClick={(e) => { e.stopPropagation(); handleQuickLog(food); }}
              data-testid={`quick-log-${food.fdc_id}`}
              className={cn(
                "p-2 rounded-full transition-colors flex-shrink-0",
                theme === 'dark' 
                  ? 'bg-emerald-500/20 text-emerald-400 active:bg-emerald-500/30' 
                  : 'bg-emerald-100 text-emerald-600 active:bg-emerald-200'
              )}
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
          
          <ChevronRight className={cn(
            "w-5 h-5 flex-shrink-0 mt-1",
            theme === 'dark' ? 'text-zinc-600' : 'text-gray-400'
          )} />
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="px-4 pt-4 pb-24">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate(-1)}
              data-testid="close-search-btn"
              className={cn(
                "p-2 -ml-2 rounded-full",
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
              )}
            >
              <X className="w-6 h-6" />
            </button>
            <h1 className={cn(
              "text-lg font-semibold flex-1",
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Add Food
            </h1>
          </div>
          
          {/* Meal Type Selector */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1 -mx-4 px-4">
            {MEAL_OPTIONS.map((meal) => {
              const Icon = meal.icon;
              const isSelected = selectedMeal === meal.id;
              return (
                <button
                  key={meal.id}
                  onClick={() => handleMealChange(meal.id)}
                  data-testid={`meal-select-${meal.id}`}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                    isSelected
                      ? 'bg-emerald-500 text-black'
                      : theme === 'dark'
                        ? 'bg-zinc-800 text-zinc-300'
                        : 'bg-white text-gray-700 border border-gray-200'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {meal.label}
                </button>
              );
            })}
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <SearchIcon className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5",
              theme === 'dark' ? 'text-zinc-500' : 'text-gray-400'
            )} />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search foods..."
              className={cn(
                "pl-10 pr-10 h-12 rounded-xl",
                theme === 'dark' 
                  ? 'bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600'
                  : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'
              )}
            />
            {query && (
              <button
                onClick={clearSearch}
                className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full",
                  theme === 'dark' ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-gray-600'
                )}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-4 px-4">
            <button
              onClick={() => navigate('/barcode')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap",
                theme === 'dark' 
                  ? 'bg-zinc-800 text-zinc-300' 
                  : 'bg-white text-gray-700 border border-gray-200'
              )}
            >
              <Barcode className="w-4 h-4" />
              Scan
            </button>
            <button
              onClick={() => setQuickAddOpen(true)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap",
                theme === 'dark' 
                  ? 'bg-zinc-800 text-zinc-300' 
                  : 'bg-white text-gray-700 border border-gray-200'
              )}
            >
              <Plus className="w-4 h-4" />
              Quick Add
            </button>
            <button
              onClick={() => navigate('/custom-foods')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap",
                theme === 'dark' 
                  ? 'bg-zinc-800 text-zinc-300' 
                  : 'bg-white text-gray-700 border border-gray-200'
              )}
            >
              <Star className="w-4 h-4" />
              My Foods
            </button>
          </div>
        </div>

        {/* Content - Search Results or Tabs */}
        {query.length >= 2 ? (
          <div className={cn(
            "rounded-xl overflow-hidden",
            theme === 'dark' ? 'bg-zinc-900/50' : 'bg-white'
          )}>
            {loading ? (
              /* Loading Skeletons */
              <div>
                <div className={cn(
                  "px-3 py-2 text-xs font-semibold uppercase tracking-wider",
                  theme === 'dark' ? 'text-zinc-500 bg-black/30' : 'text-gray-500 bg-gray-50'
                )}>
                  Searching...
                </div>
                {[1, 2, 3, 4, 5].map((i) => (
                  <FoodItemSkeleton key={i} />
                ))}
              </div>
            ) : results.length > 0 ? (
              <div>
                <div className={cn(
                  "px-3 py-2 text-xs font-semibold uppercase tracking-wider flex justify-between items-center",
                  theme === 'dark' ? 'text-zinc-500 bg-black/30' : 'text-gray-500 bg-gray-50'
                )}>
                  <span>Search Results</span>
                  <span className={theme === 'dark' ? 'text-zinc-600' : 'text-gray-400'}>
                    {results.length} found
                  </span>
                </div>
                {results.slice(0, 25).map((food, idx) => (
                  <FoodItem key={food.fdc_id || idx} food={food} />
                ))}
              </div>
            ) : (
              /* No Results State */
              <div className="py-12 text-center">
                <SearchIcon className={cn(
                  "w-12 h-12 mx-auto mb-3",
                  theme === 'dark' ? 'text-zinc-700' : 'text-gray-300'
                )} />
                <p className={cn(
                  "font-medium mb-1",
                  theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                )}>
                  No results found
                </p>
                <p className={cn(
                  "text-sm mb-4",
                  theme === 'dark' ? 'text-zinc-600' : 'text-gray-400'
                )}>
                  No foods match "{query}"
                </p>
                <button
                  onClick={() => navigate('/custom-foods')}
                  className="text-emerald-500 text-sm font-medium hover:underline"
                >
                  Create custom food
                </button>
              </div>
              )}
            </div>
          ) : (
            /* Show tabs when not searching */
            <>
              {/* Tabs */}
              <div className={cn(
                "flex border-b mt-2",
                theme === 'dark' ? 'border-white/10' : 'border-gray-200'
              )}>
                {[
                  { id: 'recent', label: 'Recent', icon: Clock },
                  { id: 'frequent', label: 'Frequent', icon: Star }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors",
                      activeTab === tab.id
                        ? 'border-emerald-500 text-emerald-500'
                        : theme === 'dark'
                          ? 'border-transparent text-zinc-500'
                          : 'border-transparent text-gray-500'
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className={cn(
                "rounded-xl overflow-hidden mt-3",
                theme === 'dark' ? 'bg-zinc-900/50' : 'bg-white'
              )}>
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  </div>
                ) : activeTab === 'recent' ? (
                  recentFoods.length > 0 ? (
                    recentFoods.map((food, idx) => (
                      <FoodItem key={food.fdc_id || idx} food={food} showQuickLog />
                    ))
                  ) : (
                    <div className="py-12 text-center">
                      <Clock className={cn(
                        "w-10 h-10 mx-auto mb-3",
                        theme === 'dark' ? 'text-zinc-700' : 'text-gray-300'
                      )} />
                      <p className={theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'}>
                        No recent foods yet
                      </p>
                      <p className={cn(
                        "text-sm mt-1",
                        theme === 'dark' ? 'text-zinc-600' : 'text-gray-400'
                      )}>
                        Search to add your first food
                      </p>
                    </div>
                  )
                ) : (
                  frequentFoods.length > 0 ? (
                    frequentFoods.map((food, idx) => (
                      <FoodItem key={food.fdc_id || idx} food={food} showQuickLog />
                    ))
                  ) : (
                    <div className="py-12 text-center">
                      <Star className={cn(
                        "w-10 h-10 mx-auto mb-3",
                        theme === 'dark' ? 'text-zinc-700' : 'text-gray-300'
                      )} />
                      <p className={theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'}>
                        No frequent foods yet
                      </p>
                      <p className={cn(
                        "text-sm mt-1",
                        theme === 'dark' ? 'text-zinc-600' : 'text-gray-400'
                      )}>
                        Foods you log often will appear here
                      </p>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>
      

      {/* Quick Add Dialog */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className={cn(
          "border",
          theme === 'dark' 
            ? 'bg-zinc-900 border-white/10 text-white' 
            : 'bg-white border-gray-200 text-gray-900'
        )}>
          <DialogHeader>
            <DialogTitle>Quick Add</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className={cn(
              "text-sm",
              theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
            )}>
              Quickly log calories and macros without searching
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'}>Calories</Label>
                <Input
                  type="number"
                  value={quickAddData.calories}
                  onChange={(e) => setQuickAddData(d => ({ ...d, calories: e.target.value }))}
                  placeholder="0"
                  className={cn(
                    "mt-1",
                    theme === 'dark' 
                      ? 'bg-black/50 border-white/10 text-white' 
                      : 'bg-gray-50 border-gray-200'
                  )}
                />
              </div>
              <div>
                <Label className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'}>Protein (g)</Label>
                <Input
                  type="number"
                  value={quickAddData.protein}
                  onChange={(e) => setQuickAddData(d => ({ ...d, protein: e.target.value }))}
                  placeholder="0"
                  className={cn(
                    "mt-1",
                    theme === 'dark' 
                      ? 'bg-black/50 border-white/10 text-white' 
                      : 'bg-gray-50 border-gray-200'
                  )}
                />
              </div>
              <div>
                <Label className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'}>Carbs (g)</Label>
                <Input
                  type="number"
                  value={quickAddData.carbs}
                  onChange={(e) => setQuickAddData(d => ({ ...d, carbs: e.target.value }))}
                  placeholder="0"
                  className={cn(
                    "mt-1",
                    theme === 'dark' 
                      ? 'bg-black/50 border-white/10 text-white' 
                      : 'bg-gray-50 border-gray-200'
                  )}
                />
              </div>
              <div>
                <Label className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'}>Fat (g)</Label>
                <Input
                  type="number"
                  value={quickAddData.fat}
                  onChange={(e) => setQuickAddData(d => ({ ...d, fat: e.target.value }))}
                  placeholder="0"
                  className={cn(
                    "mt-1",
                    theme === 'dark' 
                      ? 'bg-black/50 border-white/10 text-white' 
                      : 'bg-gray-50 border-gray-200'
                  )}
                />
              </div>
            </div>

            <button
              onClick={handleQuickAdd}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-3 rounded-xl transition-colors"
            >
              Add to {MEAL_OPTIONS.find(m => m.id === selectedMeal)?.label || 'Log'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};
