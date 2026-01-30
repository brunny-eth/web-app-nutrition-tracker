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
    // Sodium: <2750mg upper bound
    sodium: {
      limit: 2750,
      warning: 2300,
      type: 'limit' as const,
      tip: '<2750mg (ideal <2300mg)',
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
          type="calories"
        />
        <PrimaryCard
          label="Protein"
          value={protein.value}
          low={protein.low}
          high={protein.high}
          target={targetProtein}
          unit="g"
          type="protein"
        />
      </div>

      {/* Secondary metrics - limits and targets */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SecondaryCard
          label="Fiber"
          value={fiber.value}
          low={fiber.low}
          high={fiber.high}
          unit="g"
          recommendation={recs.fiber}
        />
        <SecondaryCard
          label="Added Sugar"
          value={addedSugar.value}
          low={addedSugar.low}
          high={addedSugar.high}
          unit="g"
          recommendation={recs.addedSugar}
        />
        <SecondaryCard
          label="Sat. Fat"
          value={saturatedFat.value}
          low={saturatedFat.low}
          high={saturatedFat.high}
          unit="g"
          recommendation={recs.saturatedFat}
        />
        <SecondaryCard
          label="Sodium"
          value={sodium.value}
          low={sodium.low}
          high={sodium.high}
          unit="mg"
          recommendation={recs.sodium}
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
  type: 'calories' | 'protein';
}

function PrimaryCard({ label, value, low, high, target, unit, type }: PrimaryCardProps) {
  // Calories: green when under target (deficit), red when over
  // Protein: green when at/above target, red when below
  const progress = target ? Math.min((value / target) * 100, 100) : 0;
  
  let isGood: boolean;
  if (type === 'calories') {
    isGood = !target || value <= target; // Under or at target = good
  } else {
    isGood = !target || value >= target; // At or above target = good
  }

  const textColor = isGood 
    ? 'text-green-600 dark:text-green-400' 
    : 'text-red-600 dark:text-red-400';
  
  const bgColor = isGood
    ? 'bg-green-50 dark:bg-green-950/30'
    : 'bg-red-50 dark:bg-red-950/30';

  const barColor = isGood ? '#22c55e' : '#ef4444';

  return (
    <div className={`rounded-xl p-4 ${bgColor}`}>
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${textColor}`}>
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
                backgroundColor: barColor
              }}
            />
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">
            {Math.round(value)} / {target} {unit}
            {type === 'calories' && value > target && (
              <span className="text-red-500 ml-1">(+{Math.round(value - target)} over)</span>
            )}
            {type === 'protein' && value < target && (
              <span className="text-red-500 ml-1">({Math.round(target - value)} to go)</span>
            )}
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
  recommendation?: Recommendation;
}

function SecondaryCard({ label, value, low, high, unit, recommendation }: SecondaryCardProps) {
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
    neutral: 'text-zinc-700 dark:text-zinc-200',
  };

  const progressBarColor = {
    good: '#22c55e',
    warning: '#f59e0b',
    bad: '#ef4444',
    neutral: '#71717a',
  };

  const bgColors = {
    good: 'bg-green-50 dark:bg-green-950/30',
    warning: 'bg-amber-50 dark:bg-amber-950/30',
    bad: 'bg-red-50 dark:bg-red-950/30',
    neutral: 'bg-zinc-100 dark:bg-zinc-800/50',
  };

  return (
    <div className={`rounded-lg p-3 ${bgColors[status]}`}>
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
      <p className={`mt-0.5 text-lg font-semibold ${statusColors[status]}`}>
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
