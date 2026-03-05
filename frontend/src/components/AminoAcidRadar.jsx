import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';

const ESSENTIAL_AMINO_ACIDS = [
  'Histidine',
  'Isoleucine',
  'Leucine',
  'Lysine',
  'Methionine',
  'Phenylalanine',
  'Threonine',
  'Tryptophan',
  'Valine',
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
        <p className="text-white font-medium text-sm">{data.name}</p>
        <p className="text-emerald-400 text-sm mt-1">
          {data.value.toFixed(2)}g
        </p>
        <p className="text-zinc-500 text-xs mt-1">
          {data.isEssential ? 'Essential' : 'Non-essential'}
        </p>
      </div>
    );
  }
  return null;
};

export const AminoAcidRadar = ({ aminoAcids = [], className = '' }) => {
  const { theme } = useTheme();
  
  // Process amino acids data for radar chart
  const radarData = ESSENTIAL_AMINO_ACIDS.map((name) => {
    const aa = aminoAcids.find(
      (a) => a.name?.toLowerCase() === name.toLowerCase()
    );
    return {
      name: name.substring(0, 3),
      fullName: name,
      value: aa?.value || 0,
      isEssential: true,
    };
  });

  // Calculate max value for scale
  const maxValue = Math.max(...radarData.map((d) => d.value), 1);

  return (
    <div className={`w-full h-full min-h-[280px] ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <PolarGrid 
            stroke={theme === 'dark' ? '#27272A' : '#E5E7EB'} 
            strokeWidth={1}
            gridType="polygon"
          />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fill: theme === 'dark' ? '#A1A1AA' : '#4B5563', fontSize: 11, fontWeight: 500 }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, maxValue]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Amino Acids"
            dataKey="value"
            stroke="#10B981"
            fill="#10B981"
            fillOpacity={0.3}
            strokeWidth={2}
            dot={{
              r: 4,
              fill: '#10B981',
              stroke: theme === 'dark' ? '#050505' : '#FFFFFF',
              strokeWidth: 2,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const AminoAcidList = ({ aminoAcids = [], showAll = false }) => {
  const { theme } = useTheme();
  const essentialAAs = aminoAcids.filter((aa) => aa.is_essential);
  const nonEssentialAAs = aminoAcids.filter((aa) => !aa.is_essential);
  
  const displayAAs = showAll ? aminoAcids : essentialAAs;

  return (
    <div className="space-y-2">
      {displayAAs.map((aa, idx) => (
        <div
          key={aa.name || idx}
          className={cn(
            "flex items-center justify-between py-2 border-b last:border-0",
            theme === 'dark' ? 'border-white/5' : 'border-gray-200'
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                aa.is_essential ? 'bg-cyan-500' : 'bg-violet-500'
              }`}
            />
            <span className={cn(
              "text-sm font-medium",
              theme === 'dark' ? 'text-zinc-200' : 'text-gray-800'
            )}>
              {aa.name}
            </span>
            {aa.is_essential && (
              <span className={cn(
                "text-[10px] uppercase tracking-wider font-bold",
                theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
              )}>
                Essential
              </span>
            )}
          </div>
          <span className={cn(
            "text-sm font-mono font-semibold",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            {aa.value?.toFixed(2) || '0.00'}g
          </span>
        </div>
      ))}
      {!showAll && nonEssentialAAs.length > 0 && (
        <p className={cn(
          "text-xs pt-2",
          theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
        )}>
          +{nonEssentialAAs.length} non-essential amino acids
        </p>
      )}
    </div>
  );
};
