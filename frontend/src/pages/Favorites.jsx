import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { favoritesApi, foodsApi } from '../lib/api';
import { 
  Heart, 
  Trash2, 
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Search,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

export const Favorites = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const res = await favoritesApi.getAll();
      setFavorites(res.data);
    } catch (err) {
      console.error('Failed to load favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (favId) => {
    try {
      await favoritesApi.delete(favId);
      toast.success('Removed from favorites');
      loadFavorites();
    } catch (err) {
      toast.error('Failed to remove favorite');
    }
  };

  const handleViewDetails = (fdcId) => {
    navigate(`/search?food=${fdcId}`);
  };

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-white">
            Favorites
          </h1>
          <p className="text-zinc-500 mt-2">
            Your saved protein-rich foods for quick access
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : favorites.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((fav, idx) => (
              <GlassCard 
                key={fav.id} 
                className="group animate-fade-in"
                style={{ animationDelay: `${idx * 0.05}s` }}
                data-testid={`favorite-${fav.id}`}
              >
                <GlassCardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{fav.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {fav.is_complete_protein ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Complete
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            Incomplete
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveFavorite(fav.id)}
                      data-testid={`remove-fav-${fav.id}`}
                      className="p-2 rounded-lg text-pink-400 hover:bg-pink-500/10 transition-all"
                    >
                      <Heart className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div>
                      <p className="text-2xl font-semibold text-emerald-400">
                        {fav.protein_per_100g?.toFixed(1) || 0}g
                      </p>
                      <p className="text-xs text-zinc-500">protein per 100g</p>
                    </div>
                    <button
                      onClick={() => handleViewDetails(fav.fdc_id)}
                      className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors"
                    >
                      View
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </GlassCardContent>
              </GlassCard>
            ))}
          </div>
        ) : (
          <GlassCard>
            <GlassCardContent className="py-16 text-center">
              <Heart className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500">No favorites yet</p>
              <p className="text-sm text-zinc-600 mt-2">
                Search for foods and save your favorites for quick access
              </p>
              <button
                onClick={() => navigate('/search')}
                className="inline-flex items-center gap-2 mt-6 text-emerald-400 hover:text-emerald-300 font-medium"
              >
                <Search className="w-4 h-4" />
                Search Foods
              </button>
            </GlassCardContent>
          </GlassCard>
        )}
      </div>
    </Layout>
  );
};
