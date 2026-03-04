import { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { AminoAcidRadar, AminoAcidList } from '../components/AminoAcidRadar';
import { FattyAcidChart, FattyAcidList, OmegaSummary } from '../components/FattyAcidChart';
import { SearchResultsSkeleton, FoodDetailSkeleton } from '../components/Skeletons';
import { Input } from '../components/ui/input';
import { foodsApi, logsApi, favoritesApi } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import { 
  Search as SearchIcon, 
  Loader2, 
  Heart,
  Plus,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Beef,
  Milk,
  Leaf,
  Droplet,
  Fish,
  Cookie,
  Clock,
  History,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';

// Simple search result cache - module level for persistence
const searchCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let lastCacheCleanup = Date.now();

// Clean cache periodically (max once per minute)
const cleanCache = () => {
  const now = Date.now();
  if (now - lastCacheCleanup < 60000) return; // Skip if cleaned recently
  
  for (const [key, value] of searchCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      searchCache.delete(key);
    }
  }
  lastCacheCleanup = now;
};

// Category icons mapping
const categoryIcons = {
  proteins: Beef,
  dairy: Milk,
  vegetables: Leaf,
  fats: Droplet,
  seafood: Fish,
  snacks: Cookie
};

const categoryColors = {
  proteins: 'red',
  dairy: 'blue',
  vegetables: 'green',
  fats: 'amber',
  seafood: 'cyan',
  snacks: 'purple'
};

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const FoodSearch = () => {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [selectedFood, setSelectedFood] = useState(null);
  const [foodDetails, setFoodDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [servings, setServings] = useState(1);
  const [mealType, setMealType] = useState('snack');
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState(null);
  
  // New states for categories and suggestions
  const [categories, setCategories] = useState([]);
  const [timeSuggestions, setTimeSuggestions] = useState(null);
  const [recentFoods, setRecentFoods] = useState([]);
  const [activeView, setActiveView] = useState('search'); // 'search', 'category', 'suggestions'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryFoods, setCategoryFoods] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(false);

  const getToken = () => localStorage.getItem('token');

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Load categories, time-based suggestions, and recent foods on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const token = getToken();
        const headers = { 'Authorization': `Bearer ${token}` };
        
        // Load all in parallel
        const [catRes, timeRes, recentRes] = await Promise.all([
          fetch(`${API_URL}/api/foods/categories`),
          fetch(`${API_URL}/api/foods/suggestions/time-based`, { headers }),
          fetch(`${API_URL}/api/foods/recent?limit=8`, { headers })
        ]);
        
        if (catRes.ok) {
          const data = await catRes.json();
          setCategories(data.categories || []);
        }
        
        if (timeRes.ok) {
          const data = await timeRes.json();
          setTimeSuggestions(data);
        }
        
        if (recentRes.ok) {
          const data = await recentRes.json();
          setRecentFoods(data.recent_foods || []);
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
      }
    };
    
    loadInitialData();
  }, []);

  // Load foods for a specific category
  const loadCategoryFoods = useCallback(async (categoryId) => {
    setCategoryLoading(true);
    setSelectedCategory(categoryId);
    setActiveView('category');
    
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/foods/categories/${categoryId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setCategoryFoods(data.foods || []);
      }
    } catch (err) {
      toast.error('Failed to load category foods');
    } finally {
      setCategoryLoading(false);
    }
  }, []);

  // Quick select a food from suggestions/recent
  const quickSelectFood = useCallback(async (food) => {
    setSelectedFood(food);
    setDetailsLoading(true);
    setFoodDetails(null);
    setActiveView('search');
    
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
      setSelectedFood(null);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    
    const cacheKey = query.toLowerCase().trim();
    
    // Check cache first
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setResults(cached.foods);
      toast.success(`Found ${cached.foods.length} results (cached)`);
      return;
    }
    
    setLoading(true);
    setSearchProgress(0);
    setSelectedFood(null);
    setFoodDetails(null);
    
    // Simulate progress during API call
    const progressInterval = setInterval(() => {
      setSearchProgress(prev => prev >= 90 ? prev : prev + Math.random() * 15);
    }, 1000);
    
    try {
      const res = await foodsApi.search(query);
      setSearchProgress(100);
      const foods = res.data.foods || [];
      setResults(foods);
      
      // Cache results and clean periodically
      searchCache.set(cacheKey, { foods, timestamp: Date.now() });
      cleanCache();
    } catch (err) {
      toast.error('Search failed. Please try again.');
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
      setSearchProgress(0);
    }
  }, [query]);

  const handleSelectFood = useCallback(async (food) => {
    setSelectedFood(food);
    setDetailsLoading(true);
    setFoodDetails(null);
    
    try {
      const [detailsRes, favRes] = await Promise.all([
        foodsApi.getDetails(food.fdc_id),
        favoritesApi.check(food.fdc_id)
      ]);
      setFoodDetails(detailsRes.data);
      setIsFavorite(favRes.data.is_favorite);
      setFavoriteId(favRes.data.favorite_id);
    } catch (err) {
      const source = food.source || 'unknown';
      if (err.response?.status === 404) {
        const messages = {
          usda: 'This USDA food item is no longer available. Try a different item.',
          off: 'This Open Food Facts product could not be loaded. Try a different item.',
          default: 'Food details not found. Try a different item.'
        };
        toast.error(messages[source] || messages.default);
      } else {
        toast.error('Failed to load food details. Please try again.');
      }
      setSelectedFood(null);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const handleAddToLog = useCallback(async () => {
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
  }, [foodDetails, servings, mealType]);

  const toggleFavorite = useCallback(async () => {
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
  }, [foodDetails, isFavorite, favoriteId]);

  // Memoize computed values for the log dialog
  const totalProtein = useMemo(() => 
    ((foodDetails?.protein || 0) * servings).toFixed(1)
  , [foodDetails?.protein, servings]);
  
  const totalCalories = useMemo(() => 
    ((foodDetails?.calories || 0) * servings).toFixed(0)
  , [foodDetails?.calories, servings]);

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className={cn(
            "font-heading text-3xl md:text-4xl font-bold",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Food Search
          </h1>
          <p className={theme === 'dark' ? 'text-zinc-500' : 'text-gray-600'}>
            Search or browse categories for nutritional data
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <SearchIcon className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5",
              theme === 'dark' ? 'text-zinc-500' : 'text-gray-400'
            )} />
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveView('search'); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search for chicken, eggs, salmon..."
              data-testid="food-search-input"
              className={cn(
                "pl-12 h-14 text-lg focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50",
                theme === 'dark' 
                  ? 'bg-black/50 border-white/10 text-white placeholder:text-zinc-600'
                  : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
              )}
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

        {/* Time-Based Suggestions */}
        {timeSuggestions && timeSuggestions.suggestions?.length > 0 && activeView === 'search' && !results.length && !selectedFood && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-amber-500" />
              <h3 className={cn(
                "text-sm font-semibold",
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
              )}>
                {timeSuggestions.meal_name} Ideas
              </h3>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                theme === 'dark' ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'
              )}>
                Based on time of day
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {timeSuggestions.suggestions.map((food, idx) => (
                <button
                  key={idx}
                  onClick={() => quickSelectFood(food)}
                  className={cn(
                    "flex-shrink-0 px-4 py-2 rounded-xl border transition-all hover:scale-105",
                    theme === 'dark' 
                      ? 'bg-zinc-900/50 border-white/10 hover:border-amber-500/30 text-white' 
                      : 'bg-white border-gray-200 hover:border-amber-500/50 text-gray-900 shadow-sm'
                  )}
                >
                  <span className="font-medium text-sm">{food.search_term}</span>
                  <span className={cn(
                    "ml-2 text-xs",
                    theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                  )}>{food.protein_per_100g?.toFixed(0)}g protein</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent Foods */}
        {recentFoods.length > 0 && activeView === 'search' && !results.length && !selectedFood && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-cyan-500" />
              <h3 className={cn(
                "text-sm font-semibold",
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
              )}>
                Recently Logged
              </h3>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {recentFoods.map((food, idx) => (
                <button
                  key={idx}
                  onClick={() => quickSelectFood(food)}
                  className={cn(
                    "flex-shrink-0 px-4 py-2 rounded-xl border transition-all hover:scale-105",
                    theme === 'dark' 
                      ? 'bg-zinc-900/50 border-white/10 hover:border-cyan-500/30 text-white' 
                      : 'bg-white border-gray-200 hover:border-cyan-500/50 text-gray-900 shadow-sm'
                  )}
                >
                  <span className="font-medium text-sm truncate max-w-[150px]">{food.description?.split(',')[0]}</span>
                  <span className={cn(
                    "ml-2 text-xs",
                    theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                  )}>{food.protein?.toFixed(0)}g</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category Browsing */}
        {categories.length > 0 && activeView === 'search' && !results.length && !selectedFood && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <h3 className={cn(
                "text-sm font-semibold",
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
              )}>
                Browse by Category
              </h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {categories.map((cat) => {
                const IconComponent = categoryIcons[cat.id] || Leaf;
                const color = categoryColors[cat.id] || 'emerald';
                return (
                  <button
                    key={cat.id}
                    onClick={() => loadCategoryFoods(cat.id)}
                    className={cn(
                      "p-4 rounded-xl border text-left transition-all hover:scale-105",
                      theme === 'dark' 
                        ? 'bg-zinc-900/50 border-white/10 hover:border-white/20' 
                        : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center mb-2",
                      `bg-${color}-500/20`
                    )}>
                      <IconComponent className={`w-5 h-5 text-${color}-500`} />
                    </div>
                    <p className={cn(
                      "font-semibold text-sm",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{cat.name}</p>
                    <p className={cn(
                      "text-xs mt-0.5",
                      theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                    )}>{cat.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Category Foods View */}
        {activeView === 'category' && (
          <div className="mb-6">
            <button
              onClick={() => { setActiveView('search'); setSelectedCategory(null); setCategoryFoods([]); }}
              className={cn(
                "flex items-center gap-1 text-sm mb-4",
                theme === 'dark' ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
              )}
            >
              ← Back to search
            </button>
            
            <h3 className={cn(
              "text-lg font-semibold mb-4",
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              {categories.find(c => c.id === selectedCategory)?.name || 'Category'}
            </h3>
            
            {categoryLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categoryFoods.map((food, idx) => (
                  <button
                    key={idx}
                    onClick={() => quickSelectFood(food)}
                    className={cn(
                      "p-4 rounded-xl border text-left transition-all hover:border-emerald-500/50",
                      theme === 'dark' 
                        ? 'bg-zinc-900/50 border-white/10' 
                        : 'bg-white border-gray-200 shadow-sm'
                    )}
                  >
                    <p className={cn(
                      "font-medium",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{food.description}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-emerald-500 text-sm font-semibold">
                        {food.protein_per_100g?.toFixed(0)}g protein
                      </span>
                      <span className={cn(
                        "text-xs",
                        theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                      )}>
                        {food.calories_per_100g?.toFixed(0)} cal / 100g
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search Progress Bar */}
        {loading && (
          <div className="mb-4">
            <div className={cn(
              "flex items-center justify-between text-xs mb-1",
              theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
            )}>
              <span>Searching USDA & Open Food Facts...</span>
              <span>{Math.round(searchProgress)}%</span>
            </div>
            <div className={cn(
              "h-1.5 rounded-full overflow-hidden",
              theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-200'
            )}>
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500 ease-out"
                style={{ width: `${searchProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Results Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Search Results */}
          <div className="lg:col-span-5 space-y-3">
            {loading ? (
              <SearchResultsSkeleton />
            ) : results.length > 0 ? (
              results.map((food, idx) => (
                <button
                  key={food.fdc_id || food.id}
                  onClick={() => handleSelectFood(food)}
                  data-testid={`food-result-${idx}`}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border transition-all animate-fade-in",
                    selectedFood?.fdc_id === food.fdc_id
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : theme === 'dark'
                        ? 'bg-zinc-900/40 border-white/5 hover:border-white/10'
                        : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
                  )}
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium truncate",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{food.description}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {/* Source Badge */}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          food.source === 'usda' && food.has_amino_acids 
                            ? 'bg-emerald-500/20 text-emerald-600' 
                            : food.source === 'usda' 
                            ? 'bg-cyan-500/20 text-cyan-600'
                            : food.source === 'off' 
                            ? 'bg-orange-500/20 text-orange-600'
                            : food.source === 'custom'
                            ? 'bg-purple-500/20 text-purple-600'
                            : theme === 'dark' ? 'bg-zinc-700/50 text-zinc-400' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {food.source === 'usda' ? (food.data_type || 'USDA') :
                           food.source === 'off' ? 'Open Food Facts' :
                           food.source === 'custom' ? 'Custom' : 
                           food.data_type || 'Unknown'}
                        </span>
                        {/* Amino acids indicator */}
                        {food.has_amino_acids && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
                            AA Data
                          </span>
                        )}
                        {/* Brand name */}
                        {food.brand_owner && (
                          <span className={cn(
                            "text-xs truncate",
                            theme === 'dark' ? 'text-zinc-500' : 'text-gray-600'
                          )}>{food.brand_owner}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <div className="text-right">
                        <p className="text-emerald-600 font-semibold text-sm">
                          {food.protein_per_100g?.toFixed(1) || 0}g
                        </p>
                        <p className={cn(
                          "text-[10px]",
                          theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                        )}>per 100g</p>
                      </div>
                      <ChevronRight className={cn(
                        "w-4 h-4",
                        theme === 'dark' ? 'text-zinc-600' : 'text-gray-400'
                      )} />
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="py-20 text-center">
                <SearchIcon className={cn(
                  "w-12 h-12 mx-auto mb-4",
                  theme === 'dark' ? 'text-zinc-700' : 'text-gray-400'
                )} />
                <p className={theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'}>
                  {query ? 'No results found' : 'Search for foods to see their amino acid profiles'}
                </p>
                {query && (
                  <a 
                    href="/custom-foods" 
                    className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-500 hover:text-emerald-400 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create a custom food
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Food Details */}
          <div className="lg:col-span-7">
            {detailsLoading ? (
              <GlassCard className="h-full min-h-[400px]">
                <FoodDetailSkeleton />
              </GlassCard>
            ) : foodDetails ? (
              <GlassCard data-testid="food-detail-card">
                <GlassCardHeader className="flex flex-row items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <GlassCardTitle className="text-xl">{foodDetails.description}</GlassCardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-zinc-500">
                        Per {foodDetails.serving_size}{foodDetails.serving_unit}
                      </p>
                      {/* Source badge */}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        foodDetails.source === 'usda' ? 'bg-cyan-500/20 text-cyan-400' :
                        foodDetails.source === 'off' ? 'bg-orange-500/20 text-orange-400' :
                        foodDetails.source === 'custom' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-zinc-700/50 text-zinc-400'
                      }`}>
                        {foodDetails.source === 'usda' ? 'USDA' :
                         foodDetails.source === 'off' ? 'Open Food Facts' :
                         foodDetails.source === 'custom' ? 'Custom' : 'Unknown'}
                      </span>
                    </div>
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
                  {/* Protein Status - Only show if has amino acid data */}
                  {foodDetails.has_amino_acids ? (
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
                  ) : (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                      <AlertTriangle className="w-5 h-5 text-zinc-400" />
                      <div>
                        <p className="text-zinc-400 font-medium text-sm">Basic Nutrition Data</p>
                        <p className="text-xs text-zinc-500">Amino acid profile not available for this item</p>
                      </div>
                    </div>
                  )}

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
                      <div className="h-[300px]">
                        <AminoAcidRadar aminoAcids={foodDetails.amino_acids} />
                      </div>
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

                  {/* Fatty Acid Summary */}
                  <OmegaSummary 
                    omega3Total={foodDetails.omega3_total || 0}
                    omega6Total={foodDetails.omega6_total || 0}
                    omegaRatio={foodDetails.omega_ratio}
                  />

                  {/* Fatty Acid Chart */}
                  {foodDetails.fatty_acids?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-500 mb-4">
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
                      <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-500 mb-4">
                        Fatty Acid Breakdown
                      </h3>
                      <FattyAcidList fattyAcids={foodDetails.fatty_acids} showAll />
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
              <Label className="text-zinc-400">Servings</Label>
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
                Total: {((foodDetails?.protein || 0) * servings).toFixed(1)}g protein, {((foodDetails?.calories || 0) * servings).toFixed(0)} cal
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
