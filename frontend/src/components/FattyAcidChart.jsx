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
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';

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

export const FattyAcidChart = ({ fattyAcids = [], data = null, className = '' }) => {
  const { theme } = useTheme();
  
  // Support both array format (from food details) and dict format (from calculator)
  let processedFattyAcids = fattyAcids;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    // Convert dict format to array format
    processedFattyAcids = Object.entries(data).map(([name, value]) => ({
      name,
      value,
      omega_type: name.toLowerCase().includes('omega3') || name.toLowerCase().includes('ala') || 
                  name.toLowerCase().includes('epa') || name.toLowerCase().includes('dha') ? 3 : 
                  name.toLowerCase().includes('omega6') || name.toLowerCase().includes('linoleic') ? 6 : null
    }));
  }
  
  const chartData = ESSENTIAL_FATTY_ACIDS.map((fa) => {
    const found = processedFattyAcids.find(
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
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke={theme === 'dark' ? '#27272A' : '#E5E7EB'} 
            vertical={false} 
          />
          <XAxis 
            dataKey="name" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: theme === 'dark' ? '#A1A1AA' : '#4B5563', fontSize: 11 }}
          />
          <YAxis 
            domain={[0, maxValue * 1.2]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: theme === 'dark' ? '#71717A' : '#6B7280', fontSize: 10 }}
            tickFormatter={(v) => `${v.toFixed(1)}g`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
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
  const { theme } = useTheme();
  const essentialFAs = fattyAcids.filter((fa) => fa.is_essential);
  const nonEssentialFAs = fattyAcids.filter((fa) => !fa.is_essential);
  
  const displayFAs = showAll ? fattyAcids : essentialFAs;

  if (displayFAs.length === 0) {
    return (
      <div className={cn(
        "text-center py-4 text-sm",
        theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
      )}>
        No fatty acid data available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayFAs.map((fa, idx) => (
        <div
          key={fa.name || idx}
          className={cn(
            "flex items-center justify-between py-2 border-b last:border-0",
            theme === 'dark' ? 'border-white/5' : 'border-gray-200'
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                fa.omega_type === 3 ? 'bg-cyan-500' : fa.omega_type === 6 ? 'bg-amber-500' : 'bg-gray-400'
              }`}
            />
            <span className={cn(
              "text-sm font-medium",
              theme === 'dark' ? 'text-zinc-200' : 'text-gray-800'
            )}>
              {fa.name}
            </span>
            {fa.omega_type && (
              <span className={cn(
                "text-[10px] uppercase tracking-wider font-bold",
                fa.omega_type === 3 
                  ? (theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600')
                  : (theme === 'dark' ? 'text-amber-400' : 'text-amber-600')
              )}>
                Omega-{fa.omega_type}
              </span>
            )}
          </div>
          <span className={cn(
            "text-sm font-mono font-semibold",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            {fa.value?.toFixed(3) || '0.000'}g
          </span>
        </div>
      ))}
      {!showAll && nonEssentialFAs.length > 0 && (
        <p className={cn(
          "text-xs pt-2",
          theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
        )}>
          +{nonEssentialFAs.length} other fatty acids
        </p>
      )}
    </div>
  );
};

export const OmegaSummary = ({ omega3Total = 0, omega6Total = 0, omegaRatio }) => {
  const { theme } = useTheme();
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

  const getBackgroundClass = () => {
    if (!hasData) {
      return theme === 'dark' 
        ? 'bg-zinc-800/50 border border-zinc-700/50' 
        : 'bg-gray-100 border border-gray-200';
    }
    if (ratioStatus === 'good') {
      return theme === 'dark'
        ? 'bg-cyan-500/10 border border-cyan-500/20'
        : 'bg-cyan-50 border border-cyan-200';
    }
    if (ratioStatus === 'moderate') {
      return theme === 'dark'
        ? 'bg-amber-500/10 border border-amber-500/20'
        : 'bg-amber-50 border border-amber-200';
    }
    return theme === 'dark'
      ? 'bg-red-500/10 border border-red-500/20'
      : 'bg-red-50 border border-red-200';
  };

  return (
    <div className={`p-4 rounded-xl ${getBackgroundClass()}`}>
      <div className="flex items-center gap-3 mb-3">
        <Droplets className={`w-5 h-5 ${
          !hasData ? (theme === 'dark' ? 'text-zinc-500' : 'text-gray-400') :
          ratioStatus === 'good' ? 'text-cyan-500' :
          ratioStatus === 'moderate' ? 'text-amber-500' : 'text-red-500'
        }`} />
        <span className={cn(
          "font-semibold",
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          Essential Fatty Acids
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className={cn(
            "text-xs mb-1",
            theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
          )}>Omega-3</p>
          <p className="text-lg font-semibold text-cyan-500">{omega3Total.toFixed(2)}g</p>
        </div>
        <div>
          <p className={cn(
            "text-xs mb-1",
            theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
          )}>Omega-6</p>
          <p className="text-lg font-semibold text-amber-500">{omega6Total.toFixed(2)}g</p>
        </div>
        <div>
          <p className={cn(
            "text-xs mb-1",
            theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
          )}>Ratio (ω3:ω6)</p>
          <p className={`text-lg font-semibold ${
            !hasData ? (theme === 'dark' ? 'text-zinc-500' : 'text-gray-400') :
            ratioStatus === 'good' ? 'text-cyan-500' :
            ratioStatus === 'moderate' ? 'text-amber-500' : 'text-red-500'
          }`}>
            {ratioDisplay}
          </p>
        </div>
      </div>
      
      {hasData && (
        <p className={`text-xs mt-3 ${
          ratioStatus === 'good' ? 'text-cyan-600' :
          ratioStatus === 'moderate' ? 'text-amber-600' : 'text-red-600'
        }`}>
          {ratioStatus === 'good' ? 'Excellent omega balance! (ideal: 1:4 or lower)' :
           ratioStatus === 'moderate' ? 'Moderate ratio - consider more omega-3' :
           'High omega-6 ratio - add more fatty fish or flax'}
        </p>
      )}
    </div>
  );
};
