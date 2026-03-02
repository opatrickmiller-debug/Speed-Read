import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Droplets } from 'lucide-react';

const ESSENTIAL_FATTY_ACIDS = [
  { name: 'ALA', fullName: 'Alpha-linolenic acid (ALA)', omega: 3 },
  { name: 'EPA', fullName: 'EPA', omega: 3 },
  { name: 'DHA', fullName: 'DHA', omega: 3 },
  { name: 'LA', fullName: 'Linoleic acid (LA)', omega: 6 },
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
        <p className="text-white font-medium text-sm">{data.fullName}</p>
        <p className={`text-sm mt-1 ${data.omega === 3 ? 'text-cyan-400' : 'text-amber-400'}`}>
          {data.value.toFixed(3)}g
        </p>
        <p className="text-zinc-500 text-xs mt-1">
          Omega-{data.omega} fatty acid
        </p>
      </div>
    );
  }
  return null;
};

export const FattyAcidChart = ({ fattyAcids = [], className = '' }) => {
  const chartData = ESSENTIAL_FATTY_ACIDS.map((fa) => {
    const found = fattyAcids.find(
      (f) => f.name?.toLowerCase().includes(fa.name.toLowerCase()) || 
             f.name?.toLowerCase().includes(fa.fullName.toLowerCase())
    );
    return {
      name: fa.name,
      fullName: fa.fullName,
      value: found?.value || 0,
      omega: fa.omega,
    };
  });

  const maxValue = Math.max(...chartData.map((d) => d.value), 0.1);

  return (
    <div className={`w-full h-full min-h-[200px] ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
          <XAxis 
            dataKey="name" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#A1A1AA', fontSize: 11 }}
          />
          <YAxis 
            domain={[0, maxValue * 1.2]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#71717A', fontSize: 10 }}
            tickFormatter={(v) => `${v.toFixed(1)}g`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.omega === 3 ? '#22D3EE' : '#FBBF24'} 
                fillOpacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const FattyAcidList = ({ fattyAcids = [], showAll = false }) => {
  const essentialFAs = fattyAcids.filter((fa) => fa.is_essential);
  const nonEssentialFAs = fattyAcids.filter((fa) => !fa.is_essential);
  
  const displayFAs = showAll ? fattyAcids : essentialFAs;

  if (displayFAs.length === 0) {
    return (
      <div className="text-center py-4 text-zinc-500 text-sm">
        No fatty acid data available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayFAs.map((fa, idx) => (
        <div
          key={fa.name || idx}
          className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                fa.omega_type === 3 ? 'bg-cyan-400' : fa.omega_type === 6 ? 'bg-amber-400' : 'bg-zinc-400'
              }`}
            />
            <span className="text-sm text-zinc-300">{fa.name}</span>
            {fa.omega_type && (
              <span className={`text-[10px] uppercase tracking-wider font-bold ${
                fa.omega_type === 3 ? 'text-cyan-400/70' : 'text-amber-400/70'
              }`}>
                Omega-{fa.omega_type}
              </span>
            )}
          </div>
          <span className="text-sm font-mono text-white">
            {fa.value?.toFixed(3) || '0.000'}g
          </span>
        </div>
      ))}
      {!showAll && nonEssentialFAs.length > 0 && (
        <p className="text-xs text-zinc-600 pt-2">
          +{nonEssentialFAs.length} other fatty acids
        </p>
      )}
    </div>
  );
};

export const OmegaSummary = ({ omega3Total = 0, omega6Total = 0, omegaRatio }) => {
  const hasData = omega3Total > 0 || omega6Total > 0;
  
  // Calculate ratio value for display
  let ratioDisplay = omegaRatio || 'N/A';
  let ratioStatus = 'neutral';
  
  if (omega3Total > 0 && omega6Total > 0) {
    const ratio = omega6Total / omega3Total;
    if (ratio <= 4) {
      ratioStatus = 'good';
    } else if (ratio <= 10) {
      ratioStatus = 'moderate';
    } else {
      ratioStatus = 'poor';
    }
  }

  return (
    <div className={`p-4 rounded-xl ${
      !hasData ? 'bg-zinc-800/50 border border-zinc-700/50' :
      ratioStatus === 'good' ? 'bg-cyan-500/10 border border-cyan-500/20' :
      ratioStatus === 'moderate' ? 'bg-amber-500/10 border border-amber-500/20' :
      'bg-red-500/10 border border-red-500/20'
    }`}>
      <div className="flex items-center gap-3 mb-3">
        <Droplets className={`w-5 h-5 ${
          !hasData ? 'text-zinc-500' :
          ratioStatus === 'good' ? 'text-cyan-400' :
          ratioStatus === 'moderate' ? 'text-amber-400' : 'text-red-400'
        }`} />
        <span className="text-white font-semibold">Essential Fatty Acids</span>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-zinc-500 mb-1">Omega-3</p>
          <p className="text-lg font-semibold text-cyan-400">{omega3Total.toFixed(2)}g</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-1">Omega-6</p>
          <p className="text-lg font-semibold text-amber-400">{omega6Total.toFixed(2)}g</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-1">Ratio (ω3:ω6)</p>
          <p className={`text-lg font-semibold ${
            !hasData ? 'text-zinc-500' :
            ratioStatus === 'good' ? 'text-cyan-400' :
            ratioStatus === 'moderate' ? 'text-amber-400' : 'text-red-400'
          }`}>
            {ratioDisplay}
          </p>
        </div>
      </div>
      
      {hasData && (
        <p className={`text-xs mt-3 ${
          ratioStatus === 'good' ? 'text-cyan-400/70' :
          ratioStatus === 'moderate' ? 'text-amber-400/70' : 'text-red-400/70'
        }`}>
          {ratioStatus === 'good' ? 'Excellent omega balance! (ideal: 1:4 or lower)' :
           ratioStatus === 'moderate' ? 'Moderate ratio - consider more omega-3' :
           'High omega-6 ratio - add more fatty fish or flax'}
        </p>
      )}
    </div>
  );
};
