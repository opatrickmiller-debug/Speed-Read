import { cn } from '../lib/utils';

// Base skeleton with bioluminescent theme styling
const SkeletonBase = ({ className, ...props }) => (
  <div
    className={cn(
      "animate-pulse rounded-xl bg-zinc-800/50",
      className
    )}
    {...props}
  />
);

// Card skeleton for glass cards
export const CardSkeleton = ({ className }) => (
  <div className={cn("rounded-2xl bg-zinc-900/50 border border-white/5 p-6", className)}>
    <div className="flex items-center gap-3 mb-6">
      <SkeletonBase className="w-10 h-10 rounded-xl" />
      <SkeletonBase className="h-5 w-32" />
    </div>
    <div className="space-y-4">
      <SkeletonBase className="h-4 w-full" />
      <SkeletonBase className="h-4 w-3/4" />
      <SkeletonBase className="h-4 w-1/2" />
    </div>
  </div>
);

// Stats card skeleton
export const StatsCardSkeleton = () => (
  <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-6">
    <div className="flex items-center justify-between mb-4">
      <SkeletonBase className="h-4 w-24" />
      <SkeletonBase className="h-8 w-16" />
    </div>
    <SkeletonBase className="h-4 w-full rounded-full mb-4" />
    <div className="flex justify-between">
      <div>
        <SkeletonBase className="h-8 w-16 mb-1" />
        <SkeletonBase className="h-3 w-12" />
      </div>
      <div>
        <SkeletonBase className="h-8 w-16 mb-1" />
        <SkeletonBase className="h-3 w-12" />
      </div>
    </div>
  </div>
);

// Macro card skeleton (small stat cards)
export const MacroCardSkeleton = () => (
  <div className="rounded-xl bg-black/30 border border-white/5 p-4">
    <div className="flex items-center gap-2 mb-2">
      <SkeletonBase className="w-8 h-8 rounded-lg" />
      <SkeletonBase className="h-3 w-16" />
    </div>
    <SkeletonBase className="h-6 w-12" />
  </div>
);

// Food list item skeleton
export const FoodItemSkeleton = () => (
  <div className="flex items-center gap-4 p-4 rounded-xl bg-black/30 border border-white/5">
    <SkeletonBase className="w-12 h-12 rounded-xl flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <SkeletonBase className="h-4 w-3/4 mb-2" />
      <SkeletonBase className="h-3 w-1/2" />
    </div>
    <SkeletonBase className="h-6 w-16 flex-shrink-0" />
  </div>
);

// Radar chart skeleton
export const RadarChartSkeleton = () => (
  <div className="flex items-center justify-center p-8">
    <SkeletonBase className="w-48 h-48 rounded-full" />
  </div>
);

// Dashboard skeleton
export const DashboardSkeleton = () => (
  <div className="p-6 md:p-8 space-y-6">
    {/* Header */}
    <div className="mb-8">
      <SkeletonBase className="h-10 w-48 mb-2" />
      <SkeletonBase className="h-4 w-64" />
    </div>

    {/* Stats Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-10 gap-6">
      {/* Protein Progress */}
      <div className="lg:col-span-5">
        <StatsCardSkeleton />
      </div>
      
      {/* Macro Cards */}
      <div className="lg:col-span-5 grid grid-cols-2 gap-3">
        <MacroCardSkeleton />
        <MacroCardSkeleton />
        <MacroCardSkeleton />
        <MacroCardSkeleton />
      </div>

      {/* Keto Score */}
      <div className="lg:col-span-5">
        <StatsCardSkeleton />
      </div>

      {/* Nutrition Score */}
      <div className="lg:col-span-5">
        <StatsCardSkeleton />
      </div>

      {/* Amino Acid Chart */}
      <div className="lg:col-span-5">
        <CardSkeleton className="h-64" />
      </div>

      {/* Recent Foods */}
      <div className="lg:col-span-5">
        <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-6">
          <div className="flex items-center gap-3 mb-6">
            <SkeletonBase className="w-10 h-10 rounded-xl" />
            <SkeletonBase className="h-5 w-32" />
          </div>
          <div className="space-y-3">
            <FoodItemSkeleton />
            <FoodItemSkeleton />
            <FoodItemSkeleton />
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Search results skeleton
export const SearchResultsSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4, 5].map((i) => (
      <FoodItemSkeleton key={i} />
    ))}
  </div>
);

// Food detail skeleton
export const FoodDetailSkeleton = () => (
  <div className="p-6 space-y-6">
    {/* Header */}
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <SkeletonBase className="h-6 w-3/4 mb-2" />
        <SkeletonBase className="h-4 w-1/2" />
      </div>
      <SkeletonBase className="w-10 h-10 rounded-full" />
    </div>

    {/* Macros */}
    <div className="grid grid-cols-4 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <MacroCardSkeleton key={i} />
      ))}
    </div>

    {/* Chart */}
    <RadarChartSkeleton />

    {/* Amino acids */}
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex justify-between py-2 border-b border-white/5">
          <SkeletonBase className="h-4 w-24" />
          <SkeletonBase className="h-4 w-12" />
        </div>
      ))}
    </div>
  </div>
);

// Suggestions skeleton
export const SuggestionsSkeleton = () => (
  <div className="p-6 md:p-8 space-y-6">
    {/* Header */}
    <div className="mb-8">
      <SkeletonBase className="h-10 w-64 mb-2" />
      <SkeletonBase className="h-4 w-96" />
    </div>

    {/* Tabs */}
    <div className="flex gap-2 mb-6">
      <SkeletonBase className="h-10 w-32 rounded-lg" />
      <SkeletonBase className="h-10 w-32 rounded-lg" />
    </div>

    {/* Status Card */}
    <StatsCardSkeleton />

    {/* Suggestion items */}
    <div className="space-y-4 mt-6">
      {[1, 2, 3].map((i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  </div>
);

// Table skeleton
export const TableSkeleton = ({ rows = 5, columns = 4 }) => (
  <div className="rounded-xl border border-white/5 overflow-hidden">
    {/* Header */}
    <div className="bg-zinc-900/50 p-4 border-b border-white/5">
      <div className="flex gap-4">
        {Array(columns).fill(0).map((_, i) => (
          <SkeletonBase key={i} className="h-4 flex-1" />
        ))}
      </div>
    </div>
    {/* Rows */}
    {Array(rows).fill(0).map((_, i) => (
      <div key={i} className="p-4 border-b border-white/5 last:border-0">
        <div className="flex gap-4">
          {Array(columns).fill(0).map((_, j) => (
            <SkeletonBase key={j} className="h-4 flex-1" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

// Generic page skeleton
export const PageSkeleton = ({ title = true, subtitle = true, children }) => (
  <div className="p-6 md:p-8">
    {title && (
      <div className="mb-8">
        <SkeletonBase className="h-10 w-48 mb-2" />
        {subtitle && <SkeletonBase className="h-4 w-64" />}
      </div>
    )}
    {children}
  </div>
);
