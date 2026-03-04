import { Progress } from './ui/progress';
import { cn } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';

export const ProteinProgress = ({ 
  current = 0, 
  goal = 150, 
  size = 'default',
  showLabel = true,
  className = '' 
}) => {
  const { theme } = useTheme();
  const percentage = Math.min((current / goal) * 100, 100);
  const isComplete = percentage >= 100;

  return (
    <div className={cn('space-y-3', className)}>
      {showLabel && (
        <div className="flex items-end justify-between">
          <div>
            <p className={cn(
              "text-xs font-bold uppercase tracking-[0.2em]",
              theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
            )}>
              Protein Today
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={cn(
                'text-5xl font-light tracking-tighter',
                isComplete ? 'text-emerald-400' : theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {current.toFixed(0)}
              </span>
              <span className={theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'}>/ {goal}g</span>
            </div>
          </div>
          <div className={cn(
            'text-4xl font-bold',
            isComplete ? 'text-emerald-400 text-glow' : theme === 'dark' ? 'text-zinc-600' : 'text-gray-400'
          )}>
            {percentage.toFixed(0)}%
          </div>
        </div>
      )}
      
      <div className="relative">
        <div className={cn(
          'h-3 rounded-full overflow-hidden',
          theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-200',
          size === 'large' && 'h-4',
          size === 'small' && 'h-2'
        )}>
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700 ease-out',
              isComplete 
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 animate-pulse-glow' 
                : 'bg-gradient-to-r from-emerald-600 to-emerald-500'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {isComplete && (
          <div className="absolute inset-0 bg-emerald-400/20 rounded-full blur-xl" />
        )}
      </div>
    </div>
  );
};

export const MacroCard = ({ label, value, unit = 'g', color = 'zinc', icon }) => {
  const { theme } = useTheme();
  
  const colorClasses = {
    zinc: 'text-zinc-400 border-zinc-700',
    emerald: 'text-emerald-400 border-emerald-700/50',
    cyan: 'text-cyan-400 border-cyan-700/50',
    orange: 'text-orange-400 border-orange-700/50',
    violet: 'text-violet-400 border-violet-700/50',
  };
  
  const lightColorClasses = {
    zinc: 'text-gray-600 border-gray-300',
    emerald: 'text-emerald-600 border-emerald-200',
    cyan: 'text-cyan-600 border-cyan-200',
    orange: 'text-orange-600 border-orange-200',
    violet: 'text-violet-600 border-violet-200',
  };

  return (
    <div className={cn(
      'p-4 rounded-xl border',
      theme === 'dark' 
        ? `bg-zinc-900/30 ${colorClasses[color]}`
        : `bg-gray-50 ${lightColorClasses[color]}`
    )}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className={cn(
          "text-xs font-bold uppercase tracking-[0.15em]",
          theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
        )}>
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn(
          'text-2xl font-semibold',
          theme === 'dark' ? colorClasses[color].split(' ')[0] : lightColorClasses[color].split(' ')[0]
        )}>
          {typeof value === 'number' ? value.toFixed(0) : value}
        </span>
        <span className={theme === 'dark' ? 'text-sm text-zinc-600' : 'text-sm text-gray-500'}>{unit}</span>
      </div>
    </div>
  );
};
