import { Progress } from './ui/progress';
import { cn } from '../lib/utils';

export const ProteinProgress = ({ 
  current = 0, 
  goal = 150, 
  size = 'default',
  showLabel = true,
  className = '' 
}) => {
  const percentage = Math.min((current / goal) * 100, 100);
  const isComplete = percentage >= 100;

  return (
    <div className={cn('space-y-3', className)}>
      {showLabel && (
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Protein Today
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={cn(
                'text-5xl font-light tracking-tighter',
                isComplete ? 'text-emerald-400' : 'text-white'
              )}>
                {current.toFixed(0)}
              </span>
              <span className="text-zinc-500 text-lg">/ {goal}g</span>
            </div>
          </div>
          <div className={cn(
            'text-4xl font-bold',
            isComplete ? 'text-emerald-400 text-glow' : 'text-zinc-600'
          )}>
            {percentage.toFixed(0)}%
          </div>
        </div>
      )}
      
      <div className="relative">
        <div className={cn(
          'h-3 bg-zinc-800 rounded-full overflow-hidden',
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
  const colorClasses = {
    zinc: 'text-zinc-400 border-zinc-700',
    emerald: 'text-emerald-400 border-emerald-700/50',
    cyan: 'text-cyan-400 border-cyan-700/50',
    orange: 'text-orange-400 border-orange-700/50',
    violet: 'text-violet-400 border-violet-700/50',
  };

  return (
    <div className={cn(
      'p-4 rounded-xl border bg-zinc-900/30',
      colorClasses[color]
    )}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn('text-2xl font-semibold', colorClasses[color].split(' ')[0])}>
          {typeof value === 'number' ? value.toFixed(0) : value}
        </span>
        <span className="text-sm text-zinc-600">{unit}</span>
      </div>
    </div>
  );
};
