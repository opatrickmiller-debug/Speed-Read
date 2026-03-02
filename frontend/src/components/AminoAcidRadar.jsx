import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

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
            stroke="#27272A" 
            strokeWidth={1}
            gridType="polygon"
          />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fill: '#A1A1AA', fontSize: 11, fontWeight: 500 }}
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
              stroke: '#050505',
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
  const essentialAAs = aminoAcids.filter((aa) => aa.is_essential);
  const nonEssentialAAs = aminoAcids.filter((aa) => !aa.is_essential);
  
  const displayAAs = showAll ? aminoAcids : essentialAAs;

  return (
    <div className="space-y-2">
      {displayAAs.map((aa, idx) => (
        <div
          key={aa.name || idx}
          className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                aa.is_essential ? 'bg-cyan-400' : 'bg-violet-400'
              }`}
            />
            <span className="text-sm text-zinc-300">{aa.name}</span>
            {aa.is_essential && (
              <span className="text-[10px] uppercase tracking-wider text-cyan-400/70 font-bold">
                Essential
              </span>
            )}
          </div>
          <span className="text-sm font-mono text-white">
            {aa.value?.toFixed(2) || '0.00'}g
          </span>
        </div>
      ))}
      {!showAll && nonEssentialAAs.length > 0 && (
        <p className="text-xs text-zinc-600 pt-2">
          +{nonEssentialAAs.length} non-essential amino acids
        </p>
      )}
    </div>
  );
};
