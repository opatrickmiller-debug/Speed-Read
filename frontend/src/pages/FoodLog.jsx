import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { logsApi } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { 
  Trash2, 
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Coffee,
  Sun,
  Moon,
  Cookie,
  Calendar as CalendarIcon
} from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';

// Meal icons and colors
const MEAL_CONFIG = {
  breakfast: { 
    icon: Coffee, 
    label: 'Breakfast',
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-500',
    iconColor: 'text-amber-500'
  },
  lunch: { 
    icon: Sun, 
    label: 'Lunch',
    bgColor: 'bg-cyan-500/10',
    textColor: 'text-cyan-500',
    iconColor: 'text-cyan-500'
  },
  dinner: { 
    icon: Moon, 
    label: 'Dinner',
    bgColor: 'bg-violet-500/10',
    textColor: 'text-violet-500',
    iconColor: 'text-violet-500'
  },
  snack: { 
    icon: Cookie, 
    label: 'Snack',
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-500',
    iconColor: 'text-emerald-500'
  }
};

export const FoodLog = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Load logs when date changes
  useEffect(() => {
    loadLogs();
  }, [selectedDate]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const res = await logsApi.getAll(dateStr);
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to load logs:', err);
      toast.error('Failed to load food log');
    } finally {
      setLoading(false);
    }
  };

  // Delete log
  const handleDelete = async (logId) => {
    setDeleting(logId);
    try {
      await logsApi.delete(logId);
      toast.success('Food removed');
      setLogs(logs.filter(log => log.id !== logId));
    } catch (err) {
      toast.error('Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  // Group logs by meal type
  const groupedLogs = logs.reduce((acc, log) => {
    const meal = log.meal_type || 'snack';
    if (!acc[meal]) acc[meal] = [];
    acc[meal].push(log);
    return acc;
  }, {});

  // Calculate totals
  const totals = logs.reduce((acc, log) => ({
    calories: acc.calories + (log.calories || 0),
    protein: acc.protein + (log.protein || 0),
    fat: acc.fat + (log.fat || 0),
    carbs: acc.carbs + (log.carbs || 0)
  }), { calories: 0, protein: 0, fat: 0, carbs: 0 });

  // Date navigation
  const goToPreviousDay = () => setSelectedDate(subDays(selectedDate, 1));
  const goToNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

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
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between">
              <h1 className={cn(
                "text-2xl font-bold",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Food Log
              </h1>
              
              {/* Date Navigation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={goToPreviousDay}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    theme === 'dark' ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-600'
                  )}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button
                      data-testid="date-picker"
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors",
                        theme === 'dark' 
                          ? 'hover:bg-zinc-800 text-white' 
                          : 'hover:bg-gray-100 text-gray-900'
                      )}
                    >
                      <CalendarIcon className="w-4 h-4 text-emerald-500" />
                      {isToday ? 'Today' : format(selectedDate, 'MMM d')}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className={cn(
                    "w-auto p-0",
                    theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : 'bg-white'
                  )}>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDate(date);
                          setCalendarOpen(false);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
                
                <button
                  onClick={goToNextDay}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    theme === 'dark' ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-600'
                  )}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* Daily Totals */}
          <div className={cn(
            "rounded-xl p-4",
            theme === 'dark' ? 'bg-zinc-900' : 'bg-white'
          )}>
            <h3 className={cn(
              "text-xs font-bold uppercase tracking-wider mb-3",
              theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
            )}>
              Daily Totals
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <p className={cn(
                  "text-2xl font-bold",
                  theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
                )}>
                  {Math.round(totals.calories)}
                </p>
                <p className={cn(
                  "text-xs",
                  theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                )}>calories</p>
              </div>
              <div className="text-center">
                <p className={cn(
                  "text-2xl font-bold",
                  theme === 'dark' ? 'text-red-400' : 'text-red-600'
                )}>
                  {totals.protein.toFixed(1)}
                </p>
                <p className={cn(
                  "text-xs",
                  theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                )}>protein</p>
              </div>
              <div className="text-center">
                <p className={cn(
                  "text-2xl font-bold",
                  theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
                )}>
                  {totals.fat.toFixed(1)}
                </p>
                <p className={cn(
                  "text-xs",
                  theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                )}>fat</p>
              </div>
              <div className="text-center">
                <p className={cn(
                  "text-2xl font-bold",
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                )}>
                  {totals.carbs.toFixed(1)}
                </p>
                <p className={cn(
                  "text-xs",
                  theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                )}>carbs</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : logs.length === 0 ? (
            /* Empty State */
            <div className={cn(
              "rounded-xl p-12 text-center",
              theme === 'dark' ? 'bg-zinc-900' : 'bg-white'
            )}>
              <div className={cn(
                "w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center",
                theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-100'
              )}>
                <Coffee className={cn(
                  "w-8 h-8",
                  theme === 'dark' ? 'text-zinc-600' : 'text-gray-400'
                )} />
              </div>
              <h3 className={cn(
                "text-lg font-semibold mb-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                No foods logged
              </h3>
              <p className={cn(
                "mb-6",
                theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
              )}>
                Start tracking your nutrition by adding foods
              </p>
              <button
                onClick={() => navigate('/search')}
                className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Food
              </button>
            </div>
          ) : (
            /* Meal Groups */
            ['breakfast', 'lunch', 'dinner', 'snack'].map(mealType => {
              const mealLogs = groupedLogs[mealType];
              if (!mealLogs || mealLogs.length === 0) return null;
              
              const config = MEAL_CONFIG[mealType];
              const Icon = config.icon;
              
              // Calculate meal totals
              const mealTotals = mealLogs.reduce((acc, log) => ({
                calories: acc.calories + (log.calories || 0),
                protein: acc.protein + (log.protein || 0)
              }), { calories: 0, protein: 0 });
              
              return (
                <div 
                  key={mealType}
                  className={cn(
                    "rounded-xl overflow-hidden",
                    theme === 'dark' ? 'bg-zinc-900' : 'bg-white'
                  )}
                  data-testid={`meal-group-${mealType}`}
                >
                  {/* Meal Header */}
                  <div className={cn(
                    "flex items-center justify-between px-4 py-3 border-b",
                    theme === 'dark' ? 'border-zinc-800' : 'border-gray-100'
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        config.bgColor
                      )}>
                        <Icon className={cn("w-5 h-5", config.iconColor)} />
                      </div>
                      <span className={cn(
                        "font-semibold",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {config.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={cn("font-bold", config.textColor)}>
                        {mealTotals.protein.toFixed(1)}g
                      </span>
                      <span className={cn(
                        "text-xs ml-1",
                        theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                      )}>
                        protein
                      </span>
                    </div>
                  </div>
                  
                  {/* Food Items */}
                  <div>
                    {mealLogs.map(log => (
                      <div
                        key={log.id}
                        data-testid={`log-item-${log.id}`}
                        className={cn(
                          "flex items-center gap-4 px-4 py-3 border-b last:border-0 group",
                          theme === 'dark' ? 'border-zinc-800' : 'border-gray-100'
                        )}
                      >
                        {/* Food Info */}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-medium truncate",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {log.description?.length > 40 
                              ? log.description.substring(0, 40) + '...'
                              : log.description}
                          </p>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                          )}>
                            {log.serving_size}g
                          </p>
                        </div>
                        
                        {/* Nutrition */}
                        <div className="text-right flex-shrink-0">
                          <p className={cn(
                            "font-semibold",
                            theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                          )}>
                            {(log.protein || 0).toFixed(1)}g
                          </p>
                          <p className={cn(
                            "text-xs",
                            theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                          )}>
                            {Math.round(log.calories || 0)} cal
                          </p>
                        </div>
                        
                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(log.id)}
                          disabled={deleting === log.id}
                          data-testid={`delete-${log.id}`}
                          className={cn(
                            "p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100",
                            theme === 'dark' 
                              ? 'text-zinc-600 hover:text-red-400 hover:bg-red-500/10' 
                              : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                          )}
                        >
                          {deleting === log.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Fixed Add Button */}
        <div className={cn(
          "fixed bottom-0 left-0 right-0 p-4 border-t",
          theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-gray-200'
        )}>
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => navigate('/search')}
              data-testid="add-food-btn"
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-xl transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Food
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};
