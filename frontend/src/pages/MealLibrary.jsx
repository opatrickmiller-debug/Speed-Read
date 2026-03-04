import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import { Input } from '../components/ui/input';
import { 
  Users, 
  Search, 
  Heart, 
  Bookmark,
  BookmarkCheck,
  ChefHat,
  Leaf,
  Copy,
  Filter,
  TrendingUp,
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ketoTierColors = {
  ultra_low: { bg: 'bg-emerald-500/20', text: 'text-emerald-500', label: 'Ultra Low Carb' },
  low: { bg: 'bg-cyan-500/20', text: 'text-cyan-500', label: 'Low Carb' },
  moderate: { bg: 'bg-amber-500/20', text: 'text-amber-500', label: 'Moderate' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-500', label: 'Higher Carb' }
};

export const MealLibrary = () => {
  const { theme } = useTheme();
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [filterTier, setFilterTier] = useState('');
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const loadMeals = useCallback(async (reset = true) => {
    try {
      setLoading(true);
      const skip = reset ? 0 : meals.length;
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: '20',
        sort_by: sortBy
      });
      
      if (filterTier) params.append('keto_tier', filterTier);
      if (searchQuery) params.append('search', searchQuery);
      
      const res = await fetch(`${API_URL}/api/meals/library?${params}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (reset) {
          setMeals(data.meals);
        } else {
          setMeals(prev => [...prev, ...data.meals]);
        }
        setHasMore(data.has_more);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Failed to load meals:', err);
    } finally {
      setLoading(false);
    }
  }, [sortBy, filterTier, searchQuery, meals.length]);

  useEffect(() => {
    loadMeals(true);
  }, [sortBy, filterTier]);

  const handleSearch = () => {
    loadMeals(true);
  };

  const handleLike = async (mealId) => {
    try {
      const res = await fetch(`${API_URL}/api/meals/library/${mealId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setMeals(prev => prev.map(m => 
          m.id === mealId 
            ? { ...m, likes: m.likes + (data.liked ? 1 : -1), is_liked: data.liked }
            : m
        ));
      }
    } catch (err) {
      toast.error('Failed to update like');
    }
  };

  const handleSave = async (mealId) => {
    const meal = meals.find(m => m.id === mealId);
    if (!meal) return;
    
    try {
      if (meal.is_saved) {
        await fetch(`${API_URL}/api/meals/library/${mealId}/unsave`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        toast.success('Meal removed from saved');
      } else {
        await fetch(`${API_URL}/api/meals/library/${mealId}/save`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        toast.success('Meal saved!');
      }
      
      setMeals(prev => prev.map(m => 
        m.id === mealId ? { ...m, is_saved: !m.is_saved, saves: m.saves + (m.is_saved ? -1 : 1) } : m
      ));
    } catch (err) {
      toast.error('Failed to update saved meals');
    }
  };

  const handleCopy = async (mealId) => {
    try {
      const res = await fetch(`${API_URL}/api/meals/library/${mealId}/copy`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        toast.success('Meal copied to your collection!');
        setDetailOpen(false);
      }
    } catch (err) {
      toast.error('Failed to copy meal');
    }
  };

  const openMealDetail = (meal) => {
    setSelectedMeal(meal);
    setDetailOpen(true);
  };

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              theme === 'dark' ? 'bg-violet-500/20' : 'bg-violet-100'
            )}>
              <Users className="w-6 h-6 text-violet-500" />
            </div>
            <div>
              <h1 className={cn(
                "font-heading text-3xl md:text-4xl font-bold",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Meal Library
              </h1>
              <p className={theme === 'dark' ? 'text-zinc-500' : 'text-gray-600'}>
                Discover keto meals shared by the community
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
                theme === 'dark' ? 'text-zinc-500' : 'text-gray-400'
              )} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search meals..."
                className={cn(
                  "pl-10",
                  theme === 'dark' 
                    ? 'bg-black/50 border-white/10 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                )}
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg transition-colors"
            >
              Search
            </button>
          </div>
          
          <div className="flex gap-2">
            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={cn(
                "px-3 py-2 rounded-lg border text-sm",
                theme === 'dark' 
                  ? 'bg-zinc-900 border-white/10 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            >
              <option value="recent">Most Recent</option>
              <option value="popular">Most Popular</option>
              <option value="saves">Most Saved</option>
              <option value="protein">Highest Protein</option>
            </select>
            
            {/* Keto Tier Filter */}
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className={cn(
                "px-3 py-2 rounded-lg border text-sm",
                theme === 'dark' 
                  ? 'bg-zinc-900 border-white/10 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            >
              <option value="">All Keto Levels</option>
              <option value="ultra_low">Ultra Low Carb</option>
              <option value="low">Low Carb</option>
              <option value="moderate">Moderate</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <p className={cn(
          "text-sm mb-4",
          theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
        )}>
          {total} meals found
        </p>

        {/* Meals Grid */}
        {loading && meals.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : meals.length === 0 ? (
          <GlassCard>
            <GlassCardContent className="py-20 text-center">
              <ChefHat className={cn(
                "w-16 h-16 mx-auto mb-4",
                theme === 'dark' ? 'text-zinc-700' : 'text-gray-400'
              )} />
              <p className={theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'}>
                No meals found. Be the first to share a meal!
              </p>
            </GlassCardContent>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {meals.map(meal => {
              const tierStyle = ketoTierColors[meal.keto_tier] || ketoTierColors.moderate;
              
              return (
                <GlassCard 
                  key={meal.id} 
                  className="cursor-pointer hover:border-emerald-500/30 transition-colors"
                  onClick={() => openMealDetail(meal)}
                >
                  <GlassCardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className={cn(
                          "font-semibold truncate",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>{meal.name}</h3>
                        <p className={cn(
                          "text-xs",
                          theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                        )}>by {meal.author_name || 'Anonymous'}</p>
                      </div>
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        tierStyle.bg, tierStyle.text
                      )}>
                        {tierStyle.label}
                      </span>
                    </div>

                    {/* Macros */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <div className={cn(
                        "text-center p-2 rounded-lg",
                        theme === 'dark' ? 'bg-black/30' : 'bg-gray-50'
                      )}>
                        <p className="text-emerald-500 font-semibold">{meal.total_protein?.toFixed(0)}g</p>
                        <p className={cn(
                          "text-[10px]",
                          theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                        )}>Protein</p>
                      </div>
                      <div className={cn(
                        "text-center p-2 rounded-lg",
                        theme === 'dark' ? 'bg-black/30' : 'bg-gray-50'
                      )}>
                        <p className={theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}>{meal.total_fat?.toFixed(0)}g</p>
                        <p className={cn(
                          "text-[10px]",
                          theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                        )}>Fat</p>
                      </div>
                      <div className={cn(
                        "text-center p-2 rounded-lg",
                        theme === 'dark' ? 'bg-black/30' : 'bg-gray-50'
                      )}>
                        <p className={theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}>{meal.total_carbs?.toFixed(0)}g</p>
                        <p className={cn(
                          "text-[10px]",
                          theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                        )}>Carbs</p>
                      </div>
                      <div className={cn(
                        "text-center p-2 rounded-lg",
                        theme === 'dark' ? 'bg-black/30' : 'bg-gray-50'
                      )}>
                        <p className={theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}>{meal.total_calories?.toFixed(0)}</p>
                        <p className={cn(
                          "text-[10px]",
                          theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                        )}>Cal</p>
                      </div>
                    </div>

                    {/* Complete protein badge */}
                    {meal.is_complete_protein && (
                      <div className={cn(
                        "flex items-center gap-1.5 mb-3 p-2 rounded-lg",
                        theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-50'
                      )}>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-xs text-emerald-600 font-medium">Complete Protein</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleLike(meal.id); }}
                          className={cn(
                            "flex items-center gap-1 text-sm transition-colors",
                            meal.is_liked 
                              ? 'text-pink-500' 
                              : theme === 'dark' ? 'text-zinc-400 hover:text-pink-400' : 'text-gray-500 hover:text-pink-500'
                          )}
                        >
                          <Heart className={cn("w-4 h-4", meal.is_liked && "fill-current")} />
                          <span>{meal.likes || 0}</span>
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleSave(meal.id); }}
                          className={cn(
                            "flex items-center gap-1 text-sm transition-colors",
                            meal.is_saved 
                              ? 'text-amber-500' 
                              : theme === 'dark' ? 'text-zinc-400 hover:text-amber-400' : 'text-gray-500 hover:text-amber-500'
                          )}
                        >
                          {meal.is_saved ? (
                            <BookmarkCheck className="w-4 h-4" />
                          ) : (
                            <Bookmark className="w-4 h-4" />
                          )}
                          <span>{meal.saves || 0}</span>
                        </button>
                      </div>
                      <span className={cn(
                        "text-xs",
                        theme === 'dark' ? 'text-zinc-600' : 'text-gray-400'
                      )}>
                        {meal.foods?.length || 0} items
                      </span>
                    </div>
                  </GlassCardContent>
                </GlassCard>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={() => loadMeals(false)}
              disabled={loading}
              className={cn(
                "px-6 py-2 rounded-lg font-medium transition-colors",
                theme === 'dark' 
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              )}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load More'}
            </button>
          </div>
        )}
      </div>

      {/* Meal Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className={cn(
          "max-w-lg max-h-[80vh] overflow-y-auto",
          theme === 'dark' 
            ? 'bg-zinc-900 border-white/10 text-white' 
            : 'bg-white border-gray-200 text-gray-900'
        )}>
          {selectedMeal && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedMeal.name}</DialogTitle>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
                )}>by {selectedMeal.author_name || 'Anonymous'}</p>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                {/* Description */}
                {selectedMeal.description && (
                  <p className={theme === 'dark' ? 'text-zinc-300' : 'text-gray-600'}>
                    {selectedMeal.description}
                  </p>
                )}

                {/* Macros */}
                <div className="grid grid-cols-4 gap-2">
                  <div className={cn(
                    "text-center p-3 rounded-lg",
                    theme === 'dark' ? 'bg-black/30' : 'bg-gray-50'
                  )}>
                    <p className="text-xl font-semibold text-emerald-500">{selectedMeal.total_protein?.toFixed(0)}g</p>
                    <p className={cn("text-xs", theme === 'dark' ? 'text-zinc-500' : 'text-gray-500')}>Protein</p>
                  </div>
                  <div className={cn(
                    "text-center p-3 rounded-lg",
                    theme === 'dark' ? 'bg-black/30' : 'bg-gray-50'
                  )}>
                    <p className={cn("text-xl font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{selectedMeal.total_fat?.toFixed(0)}g</p>
                    <p className={cn("text-xs", theme === 'dark' ? 'text-zinc-500' : 'text-gray-500')}>Fat</p>
                  </div>
                  <div className={cn(
                    "text-center p-3 rounded-lg",
                    theme === 'dark' ? 'bg-black/30' : 'bg-gray-50'
                  )}>
                    <p className={cn("text-xl font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{selectedMeal.total_carbs?.toFixed(0)}g</p>
                    <p className={cn("text-xs", theme === 'dark' ? 'text-zinc-500' : 'text-gray-500')}>Carbs</p>
                  </div>
                  <div className={cn(
                    "text-center p-3 rounded-lg",
                    theme === 'dark' ? 'bg-black/30' : 'bg-gray-50'
                  )}>
                    <p className={cn("text-xl font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{selectedMeal.total_calories?.toFixed(0)}</p>
                    <p className={cn("text-xs", theme === 'dark' ? 'text-zinc-500' : 'text-gray-500')}>Calories</p>
                  </div>
                </div>

                {/* Complete protein badge */}
                {selectedMeal.is_complete_protein && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="text-emerald-600 font-medium">Complete Protein - All 9 Essential Amino Acids</span>
                  </div>
                )}

                {/* Foods list */}
                <div>
                  <h4 className={cn(
                    "text-sm font-semibold mb-2",
                    theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                  )}>Ingredients</h4>
                  <div className="space-y-2">
                    {selectedMeal.foods?.map((food, idx) => (
                      <div 
                        key={idx}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg",
                          theme === 'dark' ? 'bg-black/30' : 'bg-gray-50'
                        )}
                      >
                        <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                          {food.description || food.name}
                        </span>
                        <span className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
                        )}>
                          {food.servings || 1} serving
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => handleSave(selectedMeal.id)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-colors",
                      selectedMeal.is_saved
                        ? 'bg-amber-500/20 text-amber-500'
                        : theme === 'dark' 
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-white' 
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    )}
                  >
                    {selectedMeal.is_saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                    {selectedMeal.is_saved ? 'Saved' : 'Save'}
                  </button>
                  <button
                    onClick={() => handleCopy(selectedMeal.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium bg-emerald-500 hover:bg-emerald-400 text-black transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Copy to My Meals
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};
