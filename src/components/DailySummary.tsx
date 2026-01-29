'use client';

interface NutrientValue {
  value: number;
  low: number;
  high: number;
}

interface DailySummaryProps {
  calories: NutrientValue;
  protein: NutrientValue;
  saturatedFat: NutrientValue;
  fiber: NutrientValue;
  addedSugar: NutrientValue;
  sodium: NutrientValue;
  targetCalories?: number;
  targetProtein?: number;
  sex?: 'male' | 'female' | null;
}

// Recommended daily values based on nutrition guidelines
function getRecommendations(targetCalories?: number, sex?: 'male' | 'female' | null) {
  const cals = targetCalories || 2000;
  const isMale = sex === 'male';
  
  return {
    // Saturated fat: <10% of daily calories (9 cal/g of fat)
    saturatedFat: {
      limit: Math.round((cals * 0.10) / 9),
      type: 'limit' as const,
      tip: '<10% of calories',
    },
    // Sodium: <2300mg general, <1500mg ideal
    sodium: {
      limit: 2300,
      warning: 1500,
      type: 'limit' as const,
      tip: '<2300mg (ideal <1500mg)',
    },
    // Added sugar: 25g women, 36g men (AHA)
    addedSugar: {
      limit: isMale ? 36 : 25,
      type: 'limit' as const,
      tip: isMale ? '<36g added sugar' : '<25g added sugar',
    },
    // Fiber: 38g men, 25g women
    fiber: {
      target: isMale ? 38 : 25,
      type: 'target' as const,
      tip: isMale ? '38g daily goal' : '25g daily goal',
    },
  };
}

export function DailySummary({
  calories,
  protein,
  saturatedFat,
  fiber,
  addedSugar,
  sodium,
  targetCalories,
  targetProtein,
  sex,
}: DailySummaryProps) {
  const recs = getRecommendations(targetCalories, sex);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Daily Totals
      </h3>
      
      {/* Primary metrics - Calories and Protein */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <PrimaryCard
          label="Calories"
          value={calories.value}
          low={calories.low}
          high={calories.high}
          target={targetCalories}
          unit="kcal"
          color="blue"
        />
        <PrimaryCard
          label="Protein"
          value={protein.value}
          low={protein.low}
          high={protein.high}
          target={targetProtein}
          unit="g"
          color="green"
        />
      </div>

      {/* Secondary metrics - limits and targets */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SecondaryCard
          label="Sat. Fat"
          value={saturatedFat.value}
          low={saturatedFat.low}
          high={saturatedFat.high}
          unit="g"
          color="red"
          recommendation={recs.saturatedFat}
        />
        <SecondaryCard
          label="Added Sugar"
          value={addedSugar.value}
          low={addedSugar.low}
          high={addedSugar.high}
          unit="g"
          color="pink"
          recommendation={recs.addedSugar}
        />
        <SecondaryCard
          label="Sodium"
          value={sodium.value}
          low={sodium.low}
          high={sodium.high}
          unit="mg"
          color="purple"
          recommendation={recs.sodium}
        />
        <SecondaryCard
          label="Fiber"
          value={fiber.value}
          low={fiber.low}
          high={fiber.high}
          unit="g"
          color="emerald"
          recommendation={recs.fiber}
        />
      </div>
    </div>
  );
}

interface PrimaryCardProps {
  label: string;
  value: number;
  low: number;
  high: number;
  target?: number;
  unit: string;
  color: 'blue' | 'green';
}

function PrimaryCard({ label, value, low, high, target, unit, color }: PrimaryCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
  };

  const bgClasses = {
    blue: 'bg-blue-50 dark:bg-blue-950/30',
    green: 'bg-green-50 dark:bg-green-950/30',
  };

  const barColors = {
    blue: '#3b82f6',
    green: '#22c55e',
  };

  const progress = target ? Math.min((value / target) * 100, 100) : 0;
  const isOverTarget = target && value > target;

  return (
    <div className={`rounded-xl p-4 ${bgClasses[color]}`}>
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${colorClasses[color]}`}>
        {Math.round(value)}
        <span className="text-base font-normal text-zinc-400 ml-1">{unit}</span>
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
        {Math.round(low)}–{Math.round(high)} range
      </p>
      
      {target && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-full rounded-full transition-all"
              style={{ 
                width: `${progress}%`, 
                backgroundColor: isOverTarget ? '#ef4444' : barColors[color]
              }}
            />
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">
            {Math.round(value)} / {target} {unit}
            {isOverTarget && <span className="text-red-500 ml-1">(+{Math.round(value - target)})</span>}
          </p>
        </div>
      )}
    </div>
  );
}

type Recommendation = 
  | { type: 'limit'; limit: number; warning?: number; tip: string }
  | { type: 'target'; target: number; tip: string }
  | { type: 'range'; min: number; max: number; tip: string };

interface SecondaryCardProps {
  label: string;
  value: number;
  low: number;
  high: number;
  unit: string;
  color: 'amber' | 'orange' | 'red' | 'emerald' | 'pink' | 'purple';
  recommendation?: Recommendation;
}

function SecondaryCard({ label, value, low, high, unit, color, recommendation }: SecondaryCardProps) {
  const colorClasses: Record<string, string> = {
    amber: 'text-amber-600 dark:text-amber-400',
    orange: 'text-orange-600 dark:text-orange-400',
    red: 'text-red-600 dark:text-red-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    pink: 'text-pink-600 dark:text-pink-400',
    purple: 'text-purple-600 dark:text-purple-400',
  };

  const bgClasses: Record<string, string> = {
    amber: 'bg-amber-50 dark:bg-amber-950/30',
    orange: 'bg-orange-50 dark:bg-orange-950/30',
    red: 'bg-red-50 dark:bg-red-950/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30',
    pink: 'bg-pink-50 dark:bg-pink-950/30',
    purple: 'bg-purple-50 dark:bg-purple-950/30',
  };

  // Determine status based on recommendation type
  let status: 'good' | 'warning' | 'bad' | 'neutral' = 'neutral';
  let statusText = '';
  let progressPercent = 0;
  let showProgress = false;

  if (recommendation) {
    if (recommendation.type === 'limit') {
      showProgress = true;
      progressPercent = Math.min((value / recommendation.limit) * 100, 100);
      if (value > recommendation.limit) {
        status = 'bad';
        statusText = `+${Math.round(value - recommendation.limit)} over`;
      } else if (recommendation.warning && value > recommendation.warning) {
        status = 'warning';
        statusText = `${Math.round(recommendation.limit - value)} left`;
      } else {
        status = 'good';
        statusText = `${Math.round(recommendation.limit - value)} left`;
      }
    } else if (recommendation.type === 'target') {
      showProgress = true;
      progressPercent = Math.min((value / recommendation.target) * 100, 100);
      if (value >= recommendation.target) {
        status = 'good';
        statusText = 'Goal reached!';
      } else {
        status = 'warning';
        statusText = `${Math.round(recommendation.target - value)} to go`;
      }
    } else if (recommendation.type === 'range') {
      if (value < recommendation.min) {
        status = 'warning';
        statusText = `${Math.round(recommendation.min - value)} below min`;
      } else if (value > recommendation.max) {
        status = 'warning';
        statusText = `${Math.round(value - recommendation.max)} above max`;
      } else {
        status = 'good';
        statusText = 'In range';
      }
    }
  }

  const statusColors = {
    good: 'text-green-600 dark:text-green-400',
    warning: 'text-amber-600 dark:text-amber-400',
    bad: 'text-red-600 dark:text-red-400',
    neutral: 'text-zinc-500 dark:text-zinc-400',
  };

  const progressBarColor = {
    good: '#22c55e',
    warning: '#f59e0b',
    bad: '#ef4444',
    neutral: '#71717a',
  };

  return (
    <div className={`rounded-lg p-3 ${bgClasses[color]}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
        {recommendation && (
          <span className="text-[10px] text-zinc-400" title={recommendation.tip}>
            {recommendation.type === 'limit' && `<${recommendation.limit}`}
            {recommendation.type === 'target' && `>${recommendation.target}`}
            {recommendation.type === 'range' && `${recommendation.min}-${recommendation.max}`}
          </span>
        )}
      </div>
      <p className={`mt-0.5 text-lg font-semibold ${colorClasses[color]}`}>
        {Math.round(value)}
        <span className="text-xs font-normal text-zinc-400 ml-0.5">{unit}</span>
      </p>
      
      {showProgress && (
        <div className="mt-1.5">
          <div className="h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-full rounded-full transition-all"
              style={{ 
                width: `${progressPercent}%`,
                backgroundColor: progressBarColor[status]
              }}
            />
          </div>
        </div>
      )}
      
      {recommendation && (
        <p className={`mt-1 text-[10px] ${statusColors[status]}`}>
          {statusText}
        </p>
      )}
      
      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
        {Math.round(low)}–{Math.round(high)} range
      </p>
    </div>
  );
}
