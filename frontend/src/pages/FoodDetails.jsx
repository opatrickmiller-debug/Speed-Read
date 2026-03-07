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
  AlertTriangle,
  Check,
  ChevronRight,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

// Circular Macro Display Component (MyFitnessPal style)
const MacroCircle = ({ calories, carbs, fat, protein, theme }) => {
  const totalMacroCalories = (carbs * 4) + (fat * 9) + (protein * 4);
  const carbPercent = totalMacroCalories > 0 ? Math.round((carbs * 4 / totalMacroCalories) * 100) : 0;
  const fatPercent = totalMacroCalories > 0 ? Math.round((fat * 9 / totalMacroCalories) * 100) : 0;
  const proteinPercent = totalMacroCalories > 0 ? Math.round((protein * 4 / totalMacroCalories) * 100) : 0;
  
  // SVG circle calculations
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate stroke lengths for each segment
  const carbStroke = (carbPercent / 100) * circumference;
  const fatStroke = (fatPercent / 100) * circumference;
  const proteinStroke = (proteinPercent / 100) * circumference;
  
  // Offsets to position segments sequentially
  const carbOffset = circumference * 0.25; // Start at 12 o'clock
  const fatOffset = carbOffset - carbStroke;
  const proteinOffset = fatOffset - fatStroke;

  return (
    <div className="flex items-center justify-center gap-6 py-4">
      {/* Circular Chart */}
      <div className="relative w-28 h-28">
        <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={theme === 'dark' ? '#27272a' : '#e5e7eb'}
            strokeWidth="12"
          />
          {/* Carbs segment - cyan */}
          {carbPercent > 0 && (
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="12"
              strokeDasharray={`${carbStroke} ${circumference}`}
              strokeDashoffset={carbOffset}
            />
          )}
          {/* Fat segment - fuchsia */}
          {fatPercent > 0 && (
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#d946ef"
              strokeWidth="12"
              strokeDasharray={`${fatStroke} ${circumference}`}
              strokeDashoffset={fatOffset}
            />
          )}
          {/* Protein segment - amber */}
          {proteinPercent > 0 && (
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="12"
              strokeDasharray={`${proteinStroke} ${circumference}`}
              strokeDashoffset={proteinOffset}
            />
          )}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn(
            "text-2xl font-bold",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>{Math.round(calories)}</span>
          <span className={cn(
            "text-xs",
            theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
          )}>Cal</span>
        </div>
      </div>
      
      {/* Macro breakdown */}
      <div className="flex gap-5">
        <div className="text-center">
          <p className="text-cyan-400 text-sm font-medium">{carbPercent}%</p>
          <p className={cn(
            "text-lg font-bold",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>{carbs.toFixed(1)}g</p>
          <p className={cn(
            "text-xs",
            theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
          )}>Carbs</p>
        </div>
        <div className="text-center">
          <p className="text-fuchsia-400 text-sm font-medium">{fatPercent}%</p>
          <p className={cn(
            "text-lg font-bold",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>{fat.toFixed(1)}g</p>
          <p className={cn(
            "text-xs",
            theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
          )}>Fat</p>
        </div>
        <div className="text-center">
          <p className="text-amber-400 text-sm font-medium">{proteinPercent}%</p>
          <p className={cn(
            "text-lg font-bold",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>{protein.toFixed(1)}g</p>
          <p className={cn(
            "text-xs",
            theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
          )}>Protein</p>
        </div>
      </div>
    </div>
  );
};

// Row component for settings-like interface
const SettingsRow = ({ label, value, onClick, theme, showChevron = true, valueClassName = '' }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center justify-between py-4 px-1 border-b transition-colors",
      theme === 'dark' 
        ? 'border-zinc-800 hover:bg-zinc-900/50' 
        : 'border-gray-100 hover:bg-gray-50'
    )}
  >
    <span className={cn(
      "text-base",
      theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
    )}>{label}</span>
    <div className="flex items-center gap-2">
      <span className={cn(
        "text-base font-medium text-emerald-500",
        valueClassName
      )}>{value}</span>
      {showChevron && (
        <ChevronRight className={cn(
          "w-5 h-5",
          theme === 'dark' ? 'text-zinc-600' : 'text-gray-400'
        )} />
      )}
    </div>
  </button>
);

export const FoodDetails = () => {
  const { fdcId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  
  const [foodDetails, setFoodDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState(null);
  
  // Portion state
  const [portionAmount, setPortionAmount] = useState(1);
  const [selectedPortion, setSelectedPortion] = useState(null);
  
  // Modal states
  const [portionModalOpen, setPortionModalOpen] = useState(false);
  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [showNutritionDetails, setShowNutritionDetails] = useState(false);
  
  // Temp states for modals
  const [tempPortionAmount, setTempPortionAmount] = useState(1);
  const [tempSelectedPortion, setTempSelectedPortion] = useState(null);
  
  // Get meal type from URL params
  const urlParams = new URLSearchParams(location.search);
  const [mealType, setMealType] = useState(urlParams.get('meal') || 'snack');

  const [notFoundError, setNotFoundError] = useState(false);

  // Build available portion options from food data (like MyFitnessPal)
  const portionOptions = useMemo(() => {
    const options = [];
    
    // Add the default serving size if available
    if (foodDetails?.serving_size && foodDetails?.serving_unit) {
      const servingLabel = foodDetails.serving_unit === 'g' 
        ? `${foodDetails.serving_size}g serving`
        : `1.0 ${foodDetails.serving_unit || 'serving'} (${foodDetails.serving_size}g)`;
      options.push({
        id: 'serving',
        label: servingLabel,
        grams: foodDetails.serving_size,
        isDefault: true
      });
    }
    
    // Standard weight options
    options.push({ id: 'gram', label: '1.0 gram', grams: 1 });
    options.push({ id: 'ounce', label: '1.0 ounce', grams: 28.35 });
    options.push({ id: 'pound', label: '1.0 pound', grams: 453.59 });
    options.push({ id: 'kilogram', label: '1.0 kilogram', grams: 1000 });
    
    // Volume options
    options.push({ id: 'teaspoon', label: '1.0 teaspoon', grams: 5 });
    options.push({ id: 'tablespoon', label: '1.0 tablespoon', grams: 15 });
    options.push({ id: 'cup', label: '1.0 cup', grams: 240 });
    
    return options;
  }, [foodDetails]);

  // Set default portion when food loads
  useEffect(() => {
    if (foodDetails && portionOptions.length > 0 && !selectedPortion) {
      const defaultOption = portionOptions.find(p => p.isDefault) || portionOptions.find(p => p.id === 'gram');
      if (defaultOption) {
        setSelectedPortion(defaultOption);
        setTempSelectedPortion(defaultOption);
        // Default to 100g if gram is selected
        if (defaultOption.id === 'gram') {
          setPortionAmount(100);
          setTempPortionAmount(100);
        }
      }
    }
  }, [foodDetails, portionOptions, selectedPortion]);

  // Calculate grams from current portion selection
  const getGramsFromPortion = () => {
    if (!selectedPortion) return 100;
    return portionAmount * selectedPortion.grams;
  };

  // Calculate nutrition values based on portion
  const calculateNutrition = (value) => {
    if (!value) return 0;
    const grams = getGramsFromPortion();
    return (value * grams / 100);
  };

  const totalProtein = calculateNutrition(foodDetails?.protein);
  const totalCalories = calculateNutrition(foodDetails?.calories);
  const totalFat = calculateNutrition(foodDetails?.fat);
  const totalCarbs = calculateNutrition(foodDetails?.carbs);

  // Get display label for current serving size
  const getServingSizeLabel = () => {
    if (!selectedPortion) return '1.0 serving';
    const amountStr = portionAmount % 1 === 0 ? portionAmount.toString() : portionAmount.toFixed(1);
    // Extract the unit name from the label
    const unitName = selectedPortion.label.replace(/^[\d.]+\s*/, '');
    return `${amountStr} ${unitName}`;
  };

  // Get meal type display name
  const getMealDisplayName = () => {
    const names = {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
      snack: 'Snack'
    };
    return names[mealType] || 'Select a Meal';
  };

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
      // Navigate back to search or dashboard
      handleBack();
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

  // Open portion modal with current values
  const openPortionModal = () => {
    setTempPortionAmount(portionAmount);
    setTempSelectedPortion(selectedPortion);
    setPortionModalOpen(true);
  };

  // Save portion changes
  const savePortionChanges = () => {
    setPortionAmount(tempPortionAmount);
    setSelectedPortion(tempSelectedPortion);
    setPortionModalOpen(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto">
          <GlassCard className="min-h-[500px]">
            <FoodDetailSkeleton />
          </GlassCard>
        </div>
      </Layout>
    );
  }

  if (notFoundError || !foodDetails) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto p-4">
          <GlassCard className="min-h-[300px] flex items-center justify-center">
            <div className="text-center px-6">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
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
                This item may have been removed from the database.
              </p>
              <button
                onClick={handleBack}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                Search Again
              </button>
            </div>
          </GlassCard>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={cn(
        "min-h-screen",
        theme === 'dark' ? 'bg-zinc-950' : 'bg-gray-50'
      )}>
        {/* Header - MyFitnessPal style */}
        <div className={cn(
          "sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b",
          theme === 'dark' 
            ? 'bg-zinc-950 border-zinc-800' 
            : 'bg-white border-gray-200'
        )}>
          <button
            onClick={handleBack}
            data-testid="back-to-search-btn"
            className={cn(
              "p-2 -ml-2 rounded-lg transition-colors",
              theme === 'dark' 
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            )}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <h1 className={cn(
            "text-lg font-semibold",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>Add Food</h1>
          
          <button
            onClick={handleAddToLog}
            data-testid="confirm-add-log-btn"
            className="p-2 -mr-2 text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            <Check className="w-6 h-6" strokeWidth={3} />
          </button>
        </div>

        {/* Main Content */}
        <div className="max-w-lg mx-auto px-4 py-4">
          {/* Food Title with Favorite */}
          <div className="flex items-start justify-between gap-3 mb-6">
            <div className="flex-1">
              <h2 className={cn(
                "text-xl font-bold leading-tight",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {foodDetails.description}
              </h2>
              {/* Source badge */}
              <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded font-medium ${
                foodDetails.source === 'usda' ? 'bg-cyan-500/20 text-cyan-600' :
                foodDetails.source === 'off' ? 'bg-orange-500/20 text-orange-600' :
                foodDetails.source === 'custom' ? 'bg-purple-500/20 text-purple-600' :
                theme === 'dark' ? 'bg-zinc-700/50 text-zinc-400' : 'bg-gray-200 text-gray-600'
              }`}>
                {foodDetails.source === 'usda' ? 'USDA' :
                 foodDetails.source === 'off' ? 'Open Food Facts' :
                 foodDetails.source === 'custom' ? 'Custom' : 'Database'}
              </span>
            </div>
            <button
              onClick={toggleFavorite}
              data-testid="favorite-btn"
              className={cn(
                "p-2 rounded-full transition-all shrink-0",
                isFavorite 
                  ? 'bg-emerald-500 text-white' 
                  : theme === 'dark'
                    ? 'bg-zinc-800 text-zinc-400 hover:text-white'
                    : 'bg-gray-100 text-gray-500 hover:text-gray-700'
              )}
            >
              {isFavorite ? <Check className="w-5 h-5" /> : <Heart className="w-5 h-5" />}
            </button>
          </div>

          {/* Settings-style rows */}
          <div className={cn(
            "rounded-xl overflow-hidden mb-6",
            theme === 'dark' ? 'bg-zinc-900/50' : 'bg-white'
          )}>
            <div className="px-4">
              <SettingsRow 
                label="Meal" 
                value={getMealDisplayName()} 
                onClick={() => setMealModalOpen(true)}
                theme={theme}
              />
              <SettingsRow 
                label="Number of Servings" 
                value={portionAmount}
                onClick={openPortionModal}
                theme={theme}
              />
              <SettingsRow 
                label="Serving Size" 
                value={getServingSizeLabel()}
                onClick={openPortionModal}
                theme={theme}
              />
              <SettingsRow 
                label="Nutrition Details" 
                value=""
                onClick={() => setShowNutritionDetails(true)}
                theme={theme}
                valueClassName="text-zinc-400"
              />
            </div>
          </div>

          {/* Macro Circle Display */}
          <div className={cn(
            "rounded-xl p-4 mb-6",
            theme === 'dark' ? 'bg-zinc-900/50' : 'bg-white'
          )}>
            <MacroCircle 
              calories={totalCalories}
              carbs={totalCarbs}
              fat={totalFat}
              protein={totalProtein}
              theme={theme}
            />
          </div>

          {/* Quick Add Button */}
          <button
            onClick={handleAddToLog}
            data-testid="add-to-log-btn"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-xl transition-all text-lg"
          >
            Add to {getMealDisplayName()}
          </button>
        </div>
      </div>

      {/* "How Much?" Portion Modal */}
      <Dialog open={portionModalOpen} onOpenChange={setPortionModalOpen}>
        <DialogContent className={cn(
          "border max-w-md p-0 overflow-hidden",
          theme === 'dark' 
            ? 'bg-zinc-900 border-zinc-700 text-white' 
            : 'bg-white border-gray-200 text-gray-900'
        )}>
          <DialogHeader className={cn(
            "px-6 pt-6 pb-4 border-b",
            theme === 'dark' ? 'border-zinc-700' : 'border-gray-200'
          )}>
            <DialogTitle className="text-xl font-bold">How Much?</DialogTitle>
          </DialogHeader>
          
          <div className="px-6 py-4">
            {/* Amount input with unit selector */}
            <div className="flex items-center gap-3 mb-4">
              <Input
                type="number"
                value={tempPortionAmount}
                onChange={(e) => setTempPortionAmount(parseFloat(e.target.value) || 0)}
                min={0}
                step={0.5}
                data-testid="portion-amount-input"
                className={cn(
                  "h-14 text-lg font-medium w-24 text-center",
                  theme === 'dark' 
                    ? 'bg-zinc-800 border-zinc-600 text-white' 
                    : 'bg-gray-50 border-gray-200 text-gray-900'
                )}
              />
              <span className={cn(
                "text-base",
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
              )}>Serving(s) of</span>
            </div>
            
            {/* Current selection with dropdown arrow */}
            <div className={cn(
              "flex items-center justify-between p-3 rounded-lg mb-4 cursor-pointer",
              theme === 'dark' 
                ? 'bg-zinc-800 hover:bg-zinc-700' 
                : 'bg-gray-100 hover:bg-gray-200'
            )}>
              <span className={cn(
                "font-medium",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {tempSelectedPortion?.label || 'Select portion'}
              </span>
              <ChevronRight className={cn(
                "w-5 h-5 rotate-90",
                theme === 'dark' ? 'text-zinc-500' : 'text-gray-400'
              )} />
            </div>
            
            {/* Portion options list */}
            <div className={cn(
              "max-h-64 overflow-y-auto rounded-lg",
              theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-50'
            )}>
              {portionOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setTempSelectedPortion(option)}
                  data-testid={`portion-option-${option.id}`}
                  className={cn(
                    "w-full text-left px-4 py-3 transition-colors border-b last:border-b-0",
                    theme === 'dark' 
                      ? 'border-zinc-700 hover:bg-zinc-700' 
                      : 'border-gray-200 hover:bg-gray-100',
                    tempSelectedPortion?.id === option.id && (
                      theme === 'dark' ? 'bg-zinc-700' : 'bg-emerald-50'
                    )
                  )}
                >
                  <span className={cn(
                    "block",
                    tempSelectedPortion?.id === option.id 
                      ? 'text-emerald-500 font-medium' 
                      : theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {option.label}
                  </span>
                  {option.isDefault && (
                    <span className="text-xs text-emerald-500">Default serving</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          {/* Footer buttons */}
          <div className={cn(
            "flex gap-3 px-6 py-4 border-t",
            theme === 'dark' ? 'border-zinc-700' : 'border-gray-200'
          )}>
            <button
              onClick={() => setPortionModalOpen(false)}
              className={cn(
                "flex-1 py-3 rounded-lg font-medium transition-colors",
                theme === 'dark' 
                  ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              Cancel
            </button>
            <button
              onClick={savePortionChanges}
              className="flex-1 py-3 rounded-lg font-medium bg-emerald-500 text-black hover:bg-emerald-400 transition-colors"
            >
              Save
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Meal Selection Modal */}
      <Dialog open={mealModalOpen} onOpenChange={setMealModalOpen}>
        <DialogContent className={cn(
          "border max-w-md p-0 overflow-hidden",
          theme === 'dark' 
            ? 'bg-zinc-900 border-zinc-700 text-white' 
            : 'bg-white border-gray-200 text-gray-900'
        )}>
          <DialogHeader className={cn(
            "px-6 pt-6 pb-4 border-b",
            theme === 'dark' ? 'border-zinc-700' : 'border-gray-200'
          )}>
            <DialogTitle className="text-xl font-bold">Select Meal</DialogTitle>
          </DialogHeader>
          
          <div className="p-2">
            {['breakfast', 'lunch', 'dinner', 'snack'].map((meal) => (
              <button
                key={meal}
                onClick={() => {
                  setMealType(meal);
                  setMealModalOpen(false);
                }}
                data-testid={`meal-option-${meal}`}
                className={cn(
                  "w-full text-left px-4 py-4 rounded-lg transition-colors flex items-center justify-between",
                  theme === 'dark' 
                    ? 'hover:bg-zinc-800' 
                    : 'hover:bg-gray-100',
                  mealType === meal && (
                    theme === 'dark' ? 'bg-zinc-800' : 'bg-emerald-50'
                  )
                )}
              >
                <span className={cn(
                  "text-base font-medium capitalize",
                  mealType === meal 
                    ? 'text-emerald-500' 
                    : theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {meal}
                </span>
                {mealType === meal && (
                  <Check className="w-5 h-5 text-emerald-500" />
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Nutrition Details Modal */}
      <Dialog open={showNutritionDetails} onOpenChange={setShowNutritionDetails}>
        <DialogContent className={cn(
          "border max-w-2xl max-h-[90vh] overflow-y-auto",
          theme === 'dark' 
            ? 'bg-zinc-900 border-zinc-700 text-white' 
            : 'bg-white border-gray-200 text-gray-900'
        )}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Nutrition Details</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 pt-4">
            {/* Basic Macros */}
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
                <Info className={cn(
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
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};
