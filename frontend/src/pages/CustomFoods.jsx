import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { customFoodsApi } from '../lib/api';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  Search,
  Loader2,
  UtensilsCrossed
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

const emptyFood = {
  name: '',
  brand: '',
  serving_size: 100,
  serving_unit: 'g',
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  fiber: 0,
  sugar: '',
  sodium: '',
  notes: ''
};

export const CustomFoods = () => {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFood, setEditingFood] = useState(null);
  const [formData, setFormData] = useState(emptyFood);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    loadFoods();
  }, []);

  const loadFoods = async () => {
    try {
      const res = await customFoodsApi.getAll();
      setFoods(res.data || []);
    } catch (err) {
      toast.error('Failed to load custom foods');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingFood(null);
    setFormData(emptyFood);
    setDialogOpen(true);
  };

  const handleOpenEdit = (food) => {
    setEditingFood(food);
    setFormData({
      name: food.name || '',
      brand: food.brand || '',
      serving_size: food.serving_size || 100,
      serving_unit: food.serving_unit || 'g',
      calories: food.calories || 0,
      protein: food.protein || 0,
      fat: food.fat || 0,
      carbs: food.carbs || 0,
      fiber: food.fiber || 0,
      sugar: food.sugar ?? '',
      sodium: food.sodium ?? '',
      notes: food.notes || ''
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Food name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        brand: formData.brand?.trim() || null,
        serving_size: parseFloat(formData.serving_size) || 100,
        serving_unit: formData.serving_unit || 'g',
        calories: parseFloat(formData.calories) || 0,
        protein: parseFloat(formData.protein) || 0,
        fat: parseFloat(formData.fat) || 0,
        carbs: parseFloat(formData.carbs) || 0,
        fiber: parseFloat(formData.fiber) || 0,
        sugar: formData.sugar !== '' ? parseFloat(formData.sugar) : null,
        sodium: formData.sodium !== '' ? parseFloat(formData.sodium) : null,
        notes: formData.notes?.trim() || null
      };

      if (editingFood) {
        await customFoodsApi.update(editingFood.id, payload);
        toast.success('Food updated successfully');
      } else {
        await customFoodsApi.create(payload);
        toast.success('Food created successfully');
      }

      setDialogOpen(false);
      loadFoods();
    } catch (err) {
      toast.error(editingFood ? 'Failed to update food' : 'Failed to create food');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (foodId) => {
    setDeleting(foodId);
    try {
      await customFoodsApi.delete(foodId);
      toast.success('Food deleted');
      setFoods(foods.filter(f => f.id !== foodId));
    } catch (err) {
      toast.error('Failed to delete food');
    } finally {
      setDeleting(null);
    }
  };

  const filteredFoods = foods.filter(food => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      food.name?.toLowerCase().includes(q) ||
      food.brand?.toLowerCase().includes(q)
    );
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-white">
              Custom Foods
            </h1>
            <p className="text-zinc-500 mt-2">
              Create and manage your own food entries
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            data-testid="create-custom-food-btn"
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-5 py-2.5 rounded-xl transition-all"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">New Food</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your custom foods..."
            data-testid="custom-foods-search"
            className="pl-12 bg-black/50 border-white/10 text-white placeholder:text-zinc-600 h-12"
          />
        </div>

        {/* Foods List */}
        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-zinc-900/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredFoods.length === 0 ? (
          <GlassCard className="py-16">
            <div className="text-center">
              <UtensilsCrossed className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-400 text-lg font-medium">
                {searchQuery ? 'No foods match your search' : 'No custom foods yet'}
              </p>
              <p className="text-zinc-600 text-sm mt-2">
                {searchQuery ? 'Try a different search term' : 'Create your first custom food to get started'}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleOpenCreate}
                  className="mt-6 inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-lg hover:bg-emerald-500/30 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Create Food
                </button>
              )}
            </div>
          </GlassCard>
        ) : (
          <div className="grid gap-3">
            {filteredFoods.map((food) => (
              <div
                key={food.id}
                data-testid={`custom-food-${food.id}`}
                className="p-4 rounded-xl bg-zinc-900/40 border border-white/5 hover:border-white/10 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium truncate">{food.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium">
                        Custom
                      </span>
                    </div>
                    {food.brand && (
                      <p className="text-xs text-zinc-500 mt-0.5">{food.brand}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-zinc-400">
                      <span>{food.calories} cal</span>
                      <span className="text-emerald-400">{food.protein}g protein</span>
                      <span>{food.fat}g fat</span>
                      <span>{food.carbs}g carbs</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleOpenEdit(food)}
                      data-testid={`edit-food-${food.id}`}
                      className="p-2 rounded-lg bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(food.id)}
                      disabled={deleting === food.id}
                      data-testid={`delete-food-${food.id}`}
                      className="p-2 rounded-lg bg-white/5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                    >
                      {deleting === food.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Total count */}
        {!loading && filteredFoods.length > 0 && (
          <p className="text-center text-zinc-600 text-sm mt-6">
            {filteredFoods.length} {filteredFoods.length === 1 ? 'food' : 'foods'}
            {searchQuery && foods.length !== filteredFoods.length && ` (of ${foods.length} total)`}
          </p>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingFood ? 'Edit Custom Food' : 'Create Custom Food'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Name & Brand */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-zinc-400 text-sm">Food Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="e.g., Homemade Protein Bar"
                  data-testid="food-name-input"
                  className="mt-1 bg-black/50 border-white/10 text-white h-11"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-zinc-400 text-sm">Brand (optional)</Label>
                <Input
                  value={formData.brand}
                  onChange={(e) => handleInputChange('brand', e.target.value)}
                  placeholder="e.g., Homemade"
                  data-testid="food-brand-input"
                  className="mt-1 bg-black/50 border-white/10 text-white h-11"
                />
              </div>
            </div>

            {/* Serving Size */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-zinc-400 text-sm">Serving Size</Label>
                <Input
                  type="number"
                  value={formData.serving_size}
                  onChange={(e) => handleInputChange('serving_size', e.target.value)}
                  data-testid="food-serving-size-input"
                  className="mt-1 bg-black/50 border-white/10 text-white h-11"
                />
              </div>
              <div>
                <Label className="text-zinc-400 text-sm">Unit</Label>
                <Input
                  value={formData.serving_unit}
                  onChange={(e) => handleInputChange('serving_unit', e.target.value)}
                  placeholder="g, oz, ml..."
                  data-testid="food-serving-unit-input"
                  className="mt-1 bg-black/50 border-white/10 text-white h-11"
                />
              </div>
            </div>

            {/* Macros */}
            <div className="pt-2">
              <p className="text-sm font-medium text-zinc-300 mb-3">Macronutrients</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-zinc-400 text-sm">Calories</Label>
                  <Input
                    type="number"
                    value={formData.calories}
                    onChange={(e) => handleInputChange('calories', e.target.value)}
                    data-testid="food-calories-input"
                    className="mt-1 bg-black/50 border-white/10 text-white h-11"
                  />
                </div>
                <div>
                  <Label className="text-zinc-400 text-sm">Protein (g)</Label>
                  <Input
                    type="number"
                    value={formData.protein}
                    onChange={(e) => handleInputChange('protein', e.target.value)}
                    data-testid="food-protein-input"
                    className="mt-1 bg-black/50 border-white/10 text-white h-11"
                  />
                </div>
                <div>
                  <Label className="text-zinc-400 text-sm">Fat (g)</Label>
                  <Input
                    type="number"
                    value={formData.fat}
                    onChange={(e) => handleInputChange('fat', e.target.value)}
                    data-testid="food-fat-input"
                    className="mt-1 bg-black/50 border-white/10 text-white h-11"
                  />
                </div>
                <div>
                  <Label className="text-zinc-400 text-sm">Carbs (g)</Label>
                  <Input
                    type="number"
                    value={formData.carbs}
                    onChange={(e) => handleInputChange('carbs', e.target.value)}
                    data-testid="food-carbs-input"
                    className="mt-1 bg-black/50 border-white/10 text-white h-11"
                  />
                </div>
                <div>
                  <Label className="text-zinc-400 text-sm">Fiber (g)</Label>
                  <Input
                    type="number"
                    value={formData.fiber}
                    onChange={(e) => handleInputChange('fiber', e.target.value)}
                    data-testid="food-fiber-input"
                    className="mt-1 bg-black/50 border-white/10 text-white h-11"
                  />
                </div>
                <div>
                  <Label className="text-zinc-400 text-sm">Sugar (g)</Label>
                  <Input
                    type="number"
                    value={formData.sugar}
                    onChange={(e) => handleInputChange('sugar', e.target.value)}
                    placeholder="optional"
                    data-testid="food-sugar-input"
                    className="mt-1 bg-black/50 border-white/10 text-white h-11"
                  />
                </div>
              </div>
            </div>

            {/* Optional fields */}
            <div className="pt-2">
              <Label className="text-zinc-400 text-sm">Sodium (mg)</Label>
              <Input
                type="number"
                value={formData.sodium}
                onChange={(e) => handleInputChange('sodium', e.target.value)}
                placeholder="optional"
                data-testid="food-sodium-input"
                className="mt-1 bg-black/50 border-white/10 text-white h-11"
              />
            </div>

            <div>
              <Label className="text-zinc-400 text-sm">Notes</Label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Any additional notes about this food..."
                data-testid="food-notes-input"
                className="mt-1 w-full bg-black/50 border border-white/10 text-white rounded-md p-3 h-20 resize-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setDialogOpen(false)}
                className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name.trim()}
                data-testid="save-custom-food-btn"
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingFood ? 'Update Food' : 'Create Food'
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};
