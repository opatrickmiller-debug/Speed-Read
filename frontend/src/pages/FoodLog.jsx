import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '../components/GlassCard';
import { ProteinProgress } from '../components/ProteinProgress';
import { logsApi, statsApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { 
  CalendarDays, 
  Trash2, 
  Loader2,
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed
} from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export const FoodLog = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    setLoading(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    try {
      const [logsRes, statsRes] = await Promise.all([
        logsApi.getAll(dateStr),
        statsApi.getDaily(dateStr)
      ]);
      setLogs(logsRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async (logId) => {
    try {
      await logsApi.delete(logId);
      toast.success('Food removed from log');
      loadData();
    } catch (err) {
      toast.error('Failed to remove food');
    }
  };

  const goToPreviousDay = () => setSelectedDate(subDays(selectedDate, 1));
  const goToNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const goToToday = () => setSelectedDate(new Date());

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  // Group logs by meal type
  const groupedLogs = logs.reduce((acc, log) => {
    const type = log.meal_type || 'snack';
    if (!acc[type]) acc[type] = [];
    acc[type].push(log);
    return acc;
  }, {});

  const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack'];

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className={cn(
              "font-heading text-3xl md:text-4xl font-bold",
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Food Log
            </h1>
            <p className={theme === 'dark' ? 'text-zinc-500' : 'text-gray-600'}>
              Track your daily protein and amino acid intake
            </p>
          </div>
          
          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousDay}
              className={cn(
                "p-2.5 rounded-xl transition-all",
                theme === 'dark'
                  ? 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900'
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  data-testid="date-picker-btn"
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all",
                    theme === 'dark'
                      ? 'bg-white/5 hover:bg-white/10 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  )}
                >
                  <CalendarDays className="w-4 h-4 text-emerald-500" />
                  <span className="font-medium">
                    {isToday ? 'Today' : format(selectedDate, 'MMM d, yyyy')}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className={cn(
                "w-auto p-0 border",
                theme === 'dark' ? 'bg-zinc-900 border-white/10' : 'bg-white border-gray-200'
              )} align="center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setCalendarOpen(false);
                    }
                  }}
                  className="rounded-xl"
                />
              </PopoverContent>
            </Popover>
            
            <button
              onClick={goToNextDay}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            
            {!isToday && (
              <button
                onClick={goToToday}
                className="px-3 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-all"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Daily Progress */}
            <GlassCard data-testid="daily-progress-card">
              <GlassCardContent className="p-6 md:p-8">
                <ProteinProgress
                  current={stats?.total_protein || 0}
                  goal={stats?.protein_goal || user?.protein_goal || 150}
                />
              </GlassCardContent>
            </GlassCard>

            {/* Food Logs by Meal */}
            {logs.length > 0 ? (
              mealOrder.map((mealType) => {
                const mealLogs = groupedLogs[mealType];
                if (!mealLogs || mealLogs.length === 0) return null;
                
                const mealProtein = mealLogs.reduce((sum, log) => 
                  sum + (log.protein * log.servings), 0
                );
                
                return (
                  <GlassCard key={mealType} data-testid={`${mealType}-logs-card`}>
                    <GlassCardHeader className="flex flex-row items-center justify-between pb-2">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center',
                          mealType === 'breakfast' && 'bg-amber-500/20',
                          mealType === 'lunch' && 'bg-cyan-500/20',
                          mealType === 'dinner' && 'bg-violet-500/20',
                          mealType === 'snack' && 'bg-emerald-500/20'
                        )}>
                          <UtensilsCrossed className={cn(
                            'w-5 h-5',
                            mealType === 'breakfast' && 'text-amber-400',
                            mealType === 'lunch' && 'text-cyan-400',
                            mealType === 'dinner' && 'text-violet-400',
                            mealType === 'snack' && 'text-emerald-400'
                          )} />
                        </div>
                        <GlassCardTitle className="capitalize">{mealType}</GlassCardTitle>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-400 font-semibold">{mealProtein.toFixed(1)}g</p>
                        <p className="text-xs text-zinc-500">protein</p>
                      </div>
                    </GlassCardHeader>
                    <GlassCardContent className="pt-2">
                      <div className="space-y-2">
                        {mealLogs.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-center justify-between p-4 rounded-xl bg-black/30 border border-white/5 group"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium truncate">{log.description}</p>
                              <p className="text-xs text-zinc-500 mt-1">
                                {log.servings} × {log.serving_size}{log.serving_unit}
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-emerald-400 font-semibold">
                                  {(log.protein * log.servings).toFixed(1)}g
                                </p>
                                <p className="text-xs text-zinc-500">
                                  {(log.calories * log.servings).toFixed(0)} cal
                                </p>
                              </div>
                              <button
                                onClick={() => handleDeleteLog(log.id)}
                                data-testid={`delete-log-${log.id}`}
                                className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </GlassCardContent>
                  </GlassCard>
                );
              })
            ) : (
              <GlassCard>
                <GlassCardContent className="py-16 text-center">
                  <UtensilsCrossed className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                  <p className="text-zinc-500">No foods logged for this day</p>
                  <p className="text-sm text-zinc-600 mt-2">
                    Search for foods and add them to your log
                  </p>
                </GlassCardContent>
              </GlassCard>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};
