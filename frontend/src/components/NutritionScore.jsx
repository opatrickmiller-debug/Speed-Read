import { useState, useEffect } from 'react';
import { nutritionApi } from '../lib/api';
import { 
  Award, 
  Loader2, 
  TrendingUp, 
  Droplets, 
  Beef, 
  ChevronDown,
  ChevronUp,
  Lightbulb
} from 'lucide-react';
import { cn } from '../lib/utils';

const GradeCircle = ({ grade, color, score }) => {
  const colorClasses = {
    emerald: 'from-emerald-500 to-emerald-400 shadow-emerald-500/30',
    cyan: 'from-cyan-500 to-cyan-400 shadow-cyan-500/30',
    amber: 'from-amber-500 to-amber-400 shadow-amber-500/30',
    orange: 'from-orange-500 to-orange-400 shadow-orange-500/30',
    red: 'from-red-500 to-red-400 shadow-red-500/30',
  };

  return (
    <div className="relative">
      <div className={cn(
        'w-24 h-24 rounded-full bg-gradient-to-br flex items-center justify-center shadow-lg',
        colorClasses[color] || colorClasses.emerald
      )}>
        <span className="text-3xl font-bold text-black">{grade}</span>
      </div>
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-zinc-900 px-3 py-1 rounded-full border border-white/10">
        <span className="text-sm font-semibold text-white">{score}</span>
      </div>
    </div>
  );
};

const ScoreBar = ({ label, score, icon, color = 'emerald' }) => {
  const colorClasses = {
    emerald: 'bg-emerald-500',
    cyan: 'bg-cyan-500',
    amber: 'bg-amber-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
  };

  const barColor = score >= 80 ? 'emerald' : score >= 60 ? 'cyan' : score >= 40 ? 'amber' : 'red';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm text-zinc-400">{label}</span>
        </div>
        <span className="text-sm font-semibold text-white">{score}%</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div 
          className={cn('h-full rounded-full transition-all duration-500', colorClasses[barColor])}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
    </div>
  );
};

export const NutritionScoreCard = ({ className = '' }) => {
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadScore();
  }, []);

  const loadScore = async () => {
    try {
      const res = await nutritionApi.getScore();
      setScore(res.data);
    } catch (err) {
      console.error('Failed to load nutrition score:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={cn('p-6 rounded-2xl bg-zinc-900/50 border border-white/5', className)}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (!score) {
    return (
      <div className={cn('p-6 rounded-2xl bg-zinc-900/50 border border-white/5', className)}>
        <div className="text-center py-8 text-zinc-500">
          <p>Unable to load nutrition score</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl bg-zinc-900/50 border border-white/5 overflow-hidden', className)}>
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <Award className={cn(
            'w-5 h-5',
            score.color === 'emerald' && 'text-emerald-400',
            score.color === 'cyan' && 'text-cyan-400',
            score.color === 'amber' && 'text-amber-400',
            score.color === 'orange' && 'text-orange-400',
            score.color === 'red' && 'text-red-400'
          )} />
          <h3 className="text-lg font-semibold text-white">Nutrition Score</h3>
        </div>

        {/* Main Score Display */}
        <div className="flex items-center gap-6">
          <GradeCircle grade={score.grade} color={score.color} score={score.total_score} />
          <div className="flex-1">
            <p className={cn(
              'text-sm font-medium mb-2',
              score.color === 'emerald' && 'text-emerald-400',
              score.color === 'cyan' && 'text-cyan-400',
              score.color === 'amber' && 'text-amber-400',
              score.color === 'orange' && 'text-orange-400',
              score.color === 'red' && 'text-red-400'
            )}>
              {score.message}
            </p>
            
            {/* Quick Stats */}
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1">
                <Beef className="w-3 h-3 text-emerald-400" />
                <span className="text-zinc-400">{score.amino_acid_score}% amino</span>
              </div>
              <div className="flex items-center gap-1">
                <Droplets className="w-3 h-3 text-cyan-400" />
                <span className="text-zinc-400">{score.omega_score}% omega</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-violet-400" />
                <span className="text-zinc-400">{score.protein_percentage.toFixed(0)}% protein</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expand/Collapse Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-3 flex items-center justify-center gap-2 bg-black/20 hover:bg-black/30 transition-colors text-zinc-400 hover:text-white text-sm"
      >
        {expanded ? (
          <>
            <ChevronUp className="w-4 h-4" />
            Hide Details
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            View Breakdown
          </>
        )}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="p-6 pt-4 border-t border-white/5 space-y-6">
          {/* Score Breakdown */}
          <div className="space-y-4">
            <ScoreBar 
              label="Amino Acid Completeness" 
              score={score.amino_acid_score}
              icon={<Beef className="w-4 h-4 text-emerald-400" />}
            />
            <ScoreBar 
              label="Omega Balance" 
              score={score.omega_score}
              icon={<Droplets className="w-4 h-4 text-cyan-400" />}
            />
            <ScoreBar 
              label="Protein Goal" 
              score={score.protein_score}
              icon={<TrendingUp className="w-4 h-4 text-violet-400" />}
            />
          </div>

          {/* Omega Ratio */}
          <div className="p-3 rounded-xl bg-black/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-500">Omega-6:Omega-3 Ratio</span>
              <span className={cn(
                'text-sm font-semibold',
                score.omega_status === 'optimal' && 'text-emerald-400',
                score.omega_status === 'good' && 'text-cyan-400',
                score.omega_status === 'moderate' && 'text-amber-400',
                score.omega_status === 'poor' && 'text-red-400',
                score.omega_status === 'no_data' && 'text-zinc-500'
              )}>
                {score.omega_ratio === 999 ? '∞' : score.omega_ratio === 0 ? 'Perfect' : `${score.omega_ratio}:1`}
              </span>
            </div>
            <p className="text-xs text-zinc-600">Ideal ratio is 4:1 or lower</p>
          </div>

          {/* Tips */}
          {score.tips && score.tips.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wider font-bold">
                <Lightbulb className="w-3 h-3" />
                Tips to Improve
              </div>
              {score.tips.map((tip, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-amber-400">•</span>
                  <p className="text-sm text-amber-400">{tip}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const NutritionScoreBadge = ({ className = '' }) => {
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScore();
  }, []);

  const loadScore = async () => {
    try {
      const res = await nutritionApi.getScore();
      setScore(res.data);
    } catch (err) {
      console.error('Failed to load nutrition score:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !score) return null;

  const colorClasses = {
    emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border',
      colorClasses[score.color] || colorClasses.emerald,
      className
    )}>
      <Award className="w-4 h-4" />
      <span className="font-bold">{score.grade}</span>
      <span className="text-xs opacity-70">{score.total_score}</span>
    </div>
  );
};
