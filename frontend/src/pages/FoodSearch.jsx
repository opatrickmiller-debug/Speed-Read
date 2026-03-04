import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { SearchResultsSkeleton } from '../components/Skeletons';
import { Input } from '../components/ui/input';
import { foodsApi } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import { 
  Search as SearchIcon, 
  Loader2, 
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
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  
  // States for categories and suggestions
  const [categories, setCategories] = useState([]);
  const [timeSuggestions, setTimeSuggestions] = useState(null);
  const [recentFoods, setRecentFoods] = useState([]);
  const [activeView, setActiveView] = useState('search'); // 'search', 'category', 'suggestions'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryFoods, setCategoryFoods] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  
  // Autocomplete state
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);

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

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-autocomplete-container]')) {
        setShowAutocomplete(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Autocomplete search with debounce
  useEffect(() => {
    // Don't show autocomplete if we already have search results or if currently searching
    if (results.length > 0 || loading) {
      setShowAutocomplete(false);
      return;
    }
    
    if (query.length < 2) {
      setAutocompleteResults([]);
      setShowAutocomplete(false);
      return;
    }
    
    const debounceTimer = setTimeout(async () => {
      setAutocompleteLoading(true);
      try {
        const token = getToken();
        // Quick search - just get top 5 results
        const res = await fetch(`${API_URL}/api/foods/search?query=${encodeURIComponent(query)}&page_size=5`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setAutocompleteResults(data.foods?.slice(0, 5) || []);
          setShowAutocomplete(true);
        }
      } catch (err) {
        console.error('Autocomplete error:', err);
      } finally {
        setAutocompleteLoading(false);
      }
    }, 300); // 300ms debounce
    
    return () => clearTimeout(debounceTimer);
  }, [query]);

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

  // Quick select a food from suggestions/recent - navigate to details page
  const quickSelectFood = useCallback((food) => {
    const fdcId = food.fdc_id || food.id;
    if (fdcId) {
      navigate(`/food/${encodeURIComponent(fdcId)}`, { state: { from: '/search' } });
    }
  }, [navigate]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    
    // Close autocomplete when searching
    setShowAutocomplete(false);
    setAutocompleteResults([]);
    
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
    
    // Simulate progress during API call
    const progressInterval = setInterval(() => {
      setSearchProgress(prev => prev >= 90 ? prev : prev + Math.random() * 15);
    }, 1000);
    
    try {
      const res = await foodsApi.search(query);
      setSearchProgress(100);
      const foods = res.data.foods || [];
      setResults(foods);
      setShowAutocomplete(false); // Close autocomplete when results arrive
      setAutocompleteResults([]); // Clear autocomplete results
      
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

  // Navigate to food details page
  const handleSelectFood = useCallback((food) => {
    const fdcId = food.fdc_id || food.id;
    navigate(`/food/${encodeURIComponent(fdcId)}`, { state: { from: '/search' } });
  }, [navigate]);

  return (
    <Layout>
      <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
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
          <div className="relative flex-1" data-autocomplete-container>
            <SearchIcon className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5",
              theme === 'dark' ? 'text-zinc-500' : 'text-gray-400'
            )} />
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveView('search'); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setShowAutocomplete(false);
                  handleSearch();
                }
                if (e.key === 'Escape') {
                  setShowAutocomplete(false);
                }
              }}
              onFocus={() => query.length >= 2 && autocompleteResults.length > 0 && results.length === 0 && setShowAutocomplete(true)}
              placeholder="Search for chicken, eggs, salmon..."
              data-testid="food-search-input"
              className={cn(
                "pl-12 h-14 text-lg focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50",
                theme === 'dark' 
                  ? 'bg-black/50 border-white/10 text-white placeholder:text-zinc-600'
                  : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400'
              )}
            />
            
            {/* Autocomplete Dropdown - only show if no results and not loading */}
            {showAutocomplete && !loading && results.length === 0 && (autocompleteResults.length > 0 || autocompleteLoading) && (
              <div className={cn(
                "absolute z-50 w-full mt-1 rounded-xl border shadow-xl overflow-hidden",
                theme === 'dark' 
                  ? 'bg-zinc-900 border-white/10' 
                  : 'bg-white border-gray-200'
              )}>
                {autocompleteLoading && (
                  <div className="p-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    <span className={theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}>Searching...</span>
                  </div>
                )}
                {!autocompleteLoading && autocompleteResults.map((food, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setShowAutocomplete(false);
                      quickSelectFood(food);
                    }}
                    className={cn(
                      "w-full p-3 text-left flex items-center justify-between transition-colors",
                      theme === 'dark' 
                        ? 'hover:bg-white/5 border-b border-white/5 last:border-0' 
                        : 'hover:bg-gray-50 border-b border-gray-100 last:border-0'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium truncate",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{food.description}</p>
                      <p className={cn(
                        "text-xs",
                        theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                      )}>{food.source === 'custom' ? 'Custom Food' : food.source?.toUpperCase()}</p>
                    </div>
                    <span className="text-emerald-500 text-sm font-semibold ml-2">
                      {food.protein_per_100g?.toFixed(0) || food.protein?.toFixed(0) || 0}g
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => { setShowAutocomplete(false); handleSearch(); }}
            disabled={loading || !query.trim()}
            data-testid="food-search-btn"
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-8 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
          </button>
        </div>

        {/* Time-Based Suggestions */}
        {timeSuggestions && timeSuggestions.suggestions?.length > 0 && activeView === 'search' && !results.length && (
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
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
              {timeSuggestions.suggestions.map((food, idx) => (
                <button
                  key={idx}
                  onClick={() => quickSelectFood(food)}
                  className={cn(
                    "flex-shrink-0 px-4 py-2 rounded-xl border transition-all active:scale-95",
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
        {recentFoods.length > 0 && activeView === 'search' && !results.length && (
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
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
              {recentFoods.map((food, idx) => (
                <button
                  key={idx}
                  onClick={() => quickSelectFood(food)}
                  className={cn(
                    "flex-shrink-0 px-4 py-2 rounded-xl border transition-all active:scale-95",
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
        {categories.length > 0 && activeView === 'search' && !results.length && (
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {categories.map((cat) => {
                const IconComponent = categoryIcons[cat.id] || Leaf;
                const color = categoryColors[cat.id] || 'emerald';
                return (
                  <button
                    key={cat.id}
                    onClick={() => loadCategoryFoods(cat.id)}
                    className={cn(
                      "p-4 rounded-xl border text-left transition-all active:scale-95",
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
                      "text-xs mt-0.5 line-clamp-2",
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

        {/* Search Results */}
        <div className="space-y-3">
          {loading ? (
            <SearchResultsSkeleton />
          ) : results.length > 0 ? (
            results.map((food, idx) => (
              <button
                key={food.fdc_id || food.id}
                onClick={() => handleSelectFood(food)}
                data-testid={`food-result-${idx}`}
                className={cn(
                  "w-full text-left p-4 rounded-xl border transition-all animate-fade-in active:scale-[0.98]",
                  theme === 'dark'
                    ? 'bg-zinc-900/40 border-white/5 hover:border-white/10'
                    : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
                )}
                style={{ animationDelay: `${idx * 0.03}s` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-medium line-clamp-2",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{food.description}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
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
                          "text-xs truncate max-w-[150px]",
                          theme === 'dark' ? 'text-zinc-500' : 'text-gray-600'
                        )}>{food.brand_owner}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-emerald-600 font-semibold">
                        {food.protein_per_100g?.toFixed(1) || 0}g
                      </p>
                      <p className={cn(
                        "text-[10px]",
                        theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                      )}>per 100g</p>
                    </div>
                    <ChevronRight className={cn(
                      "w-5 h-5",
                      theme === 'dark' ? 'text-zinc-600' : 'text-gray-400'
                    )} />
                  </div>
                </div>
              </button>
            ))
          ) : null}
          
          {/* Empty state when no results and no search in progress */}
          {!loading && results.length === 0 && query && (
            <div className="py-12 text-center">
              <SearchIcon className={cn(
                "w-12 h-12 mx-auto mb-4",
                theme === 'dark' ? 'text-zinc-700' : 'text-gray-400'
              )} />
              <p className={theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'}>
                No results found for "{query}"
              </p>
              <a 
                href="/custom-foods" 
                className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-500 hover:text-emerald-400 transition-colors"
              >
                Create a custom food
              </a>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};
