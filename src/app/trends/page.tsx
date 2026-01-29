'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
  Bar,
} from 'recharts';

interface ChartDataPoint {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturatedFat: number;
  fiber: number;
  addedSugar: number;
  sodium: number;
  tdee: number | null;
  targetCalories: number | null;
  targetProtein: number | null;
  deficit: number | null;
  proteinPercent: number | null;
}

interface Averages {
  avgCalories: number;
  avgProtein: number;
  avgDeficit: number | null;
  avgProteinPercent: number | null;
  avgSaturatedFat: number;
  avgAddedSugar: number;
  avgSodium: number;
  avgFiber: number;
  daysTracked: number;
}

interface TrendsData {
  chartData: ChartDataPoint[];
  averages: {
    week: Averages | null;
    month: Averages | null;
  };
  recommendations: {
    saturatedFatLimit: number;
    addedSugarLimit: number;
    sodiumLimit: number;
    fiberTarget: number;
  };
  settings: {
    targetProtein: number | null;
    calorieDeficit: number;
  } | null;
}

export default function TrendsPage() {
  const router = useRouter();
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchTrends();
  }, [days]);

  const fetchTrends = async () => {
    try {
      const res = await fetch(`/api/trends?days=${days}`);
      if (res.status === 401) {
        router.push('/');
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch trends:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatTooltipLabel = (label: any) => formatDate(String(label));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-500">Failed to load trends data</p>
      </div>
    );
  }

  const { chartData, averages, recommendations, settings } = data;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Trends
          </h1>
          <nav className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Dashboard
            </button>
            <button
              onClick={() => router.push('/settings')}
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Settings
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Show last:</span>
          <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  days === d
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Avg Daily Deficit"
            period="7 days"
            value={averages.week?.avgDeficit}
            unit="kcal"
            isGood={(v) => v !== null && v > 0}
            formatValue={(v) => (v && v > 0 ? `+${v}` : String(v))}
          />
          <StatCard
            label="Avg Daily Deficit"
            period="30 days"
            value={averages.month?.avgDeficit}
            unit="kcal"
            isGood={(v) => v !== null && v > 0}
            formatValue={(v) => (v && v > 0 ? `+${v}` : String(v))}
          />
          <StatCard
            label="Protein Goal"
            period="7 days"
            value={averages.week?.avgProteinPercent}
            unit="%"
            isGood={(v) => v !== null && v >= 100}
          />
          <StatCard
            label="Protein Goal"
            period="30 days"
            value={averages.month?.avgProteinPercent}
            unit="%"
            isGood={(v) => v !== null && v >= 100}
          />
        </div>

        {/* Main Calories Chart */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
            Calories & Deficit
          </h2>
          {chartData.length === 0 ? (
            <p className="py-12 text-center text-zinc-500">No data for this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  tick={{ fontSize: 12, fill: '#71717a' }}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#71717a' }}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                  }}
                  labelFormatter={formatTooltipLabel}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => {
                    const labels: Record<string, string> = {
                      calories: 'Consumed',
                      tdee: 'TDEE',
                      targetCalories: 'Target',
                      deficit: 'Deficit',
                    };
                    return [Math.round(value || 0) + ' kcal', labels[name] || name];
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="deficit" 
                  fill="#22c55e" 
                  opacity={0.3}
                  name="Deficit"
                />
                <Line
                  type="monotone"
                  dataKey="tdee"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  name="TDEE"
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="targetCalories"
                  stroke="#a855f7"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Target"
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="calories"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 3 }}
                  name="Consumed"
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* Protein Chart */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-lg font-medium text-zinc-900 dark:text-zinc-100">
            Protein
          </h2>
          <p className="mb-4 text-xs text-zinc-500">Target: {settings?.targetProtein ?? '—'}g/day</p>
          {chartData.length === 0 ? (
            <p className="py-12 text-center text-zinc-500">No data for this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData.map(d => ({ ...d, proteinTarget: settings?.targetProtein }))} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  tick={{ fontSize: 12, fill: '#71717a' }}
                />
                <YAxis tick={{ fontSize: 12, fill: '#71717a' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                  }}
                  labelFormatter={formatTooltipLabel}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => [Math.round(value || 0) + 'g', name]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="proteinTarget"
                  stroke="#166534"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Target"
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="protein"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ fill: '#22c55e', r: 3 }}
                  name="Consumed"
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* Limits Charts */}
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Saturated Fat */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-base font-medium text-zinc-900 dark:text-zinc-100">
              Saturated Fat
            </h2>
            <p className="mb-4 text-xs text-zinc-500">Limit: &lt;{recommendations.saturatedFatLimit}g/day</p>
            {chartData.length === 0 ? (
              <p className="py-8 text-center text-zinc-500 text-sm">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <ComposedChart data={chartData.map(d => ({ ...d, satFatLimit: recommendations.saturatedFatLimit }))} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#71717a' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#71717a' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                    labelFormatter={formatTooltipLabel}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name: any) => [Math.round(value || 0) + 'g', name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Line type="monotone" dataKey="satFatLimit" stroke="#7f1d1d" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Limit" connectNulls />
                  <Line type="monotone" dataKey="saturatedFat" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} name="Consumed" connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </section>

          {/* Added Sugar */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-base font-medium text-zinc-900 dark:text-zinc-100">
              Added Sugar
            </h2>
            <p className="mb-4 text-xs text-zinc-500">Limit: &lt;{recommendations.addedSugarLimit}g/day</p>
            {chartData.length === 0 ? (
              <p className="py-8 text-center text-zinc-500 text-sm">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <ComposedChart data={chartData.map(d => ({ ...d, sugarLimit: recommendations.addedSugarLimit }))} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#71717a' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#71717a' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                    labelFormatter={formatTooltipLabel}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name: any) => [Math.round(value || 0) + 'g', name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Line type="monotone" dataKey="sugarLimit" stroke="#831843" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Limit" connectNulls />
                  <Line type="monotone" dataKey="addedSugar" stroke="#ec4899" strokeWidth={2} dot={{ r: 2 }} name="Consumed" connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </section>

          {/* Sodium */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-base font-medium text-zinc-900 dark:text-zinc-100">
              Sodium
            </h2>
            <p className="mb-4 text-xs text-zinc-500">Limit: &lt;{recommendations.sodiumLimit}mg/day</p>
            {chartData.length === 0 ? (
              <p className="py-8 text-center text-zinc-500 text-sm">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <ComposedChart data={chartData.map(d => ({ ...d, sodiumLimit: recommendations.sodiumLimit }))} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#71717a' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#71717a' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                    labelFormatter={formatTooltipLabel}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name: any) => [Math.round(value || 0) + 'mg', name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Line type="monotone" dataKey="sodiumLimit" stroke="#581c87" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Limit" connectNulls />
                  <Line type="monotone" dataKey="sodium" stroke="#a855f7" strokeWidth={2} dot={{ r: 2 }} name="Consumed" connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </section>

          {/* Fiber */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-base font-medium text-zinc-900 dark:text-zinc-100">
              Fiber
            </h2>
            <p className="mb-4 text-xs text-zinc-500">Target: &gt;{recommendations.fiberTarget}g/day</p>
            {chartData.length === 0 ? (
              <p className="py-8 text-center text-zinc-500 text-sm">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <ComposedChart data={chartData.map(d => ({ ...d, fiberTarget: recommendations.fiberTarget }))} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#71717a' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#71717a' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                    labelFormatter={formatTooltipLabel}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name: any) => [Math.round(value || 0) + 'g', name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Line type="monotone" dataKey="fiberTarget" stroke="#065f46" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Target" connectNulls />
                  <Line type="monotone" dataKey="fiber" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} name="Consumed" connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </section>
        </div>

        {/* Detailed Averages */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
            Detailed Averages
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="py-2 text-left font-medium text-zinc-500">Metric</th>
                  <th className="py-2 text-right font-medium text-zinc-500">7-Day Avg</th>
                  <th className="py-2 text-right font-medium text-zinc-500">30-Day Avg</th>
                  <th className="py-2 text-right font-medium text-zinc-500">Target/Limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                <tr>
                  <td className="py-2 text-zinc-700 dark:text-zinc-300">Calories</td>
                  <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">{averages.week?.avgCalories ?? '—'}</td>
                  <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">{averages.month?.avgCalories ?? '—'}</td>
                  <td className="py-2 text-right text-zinc-500">—</td>
                </tr>
                <tr>
                  <td className="py-2 text-zinc-700 dark:text-zinc-300">Protein</td>
                  <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">{averages.week?.avgProtein ?? '—'}g</td>
                  <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">{averages.month?.avgProtein ?? '—'}g</td>
                  <td className="py-2 text-right text-zinc-500">{settings?.targetProtein ?? '—'}g</td>
                </tr>
                <tr>
                  <td className="py-2 text-zinc-700 dark:text-zinc-300">Caloric Deficit</td>
                  <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">
                    {averages.week && averages.week.avgDeficit !== null 
                      ? (averages.week.avgDeficit > 0 ? '+' : '') + averages.week.avgDeficit 
                      : '—'}
                  </td>
                  <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">
                    {averages.month && averages.month.avgDeficit !== null 
                      ? (averages.month.avgDeficit > 0 ? '+' : '') + averages.month.avgDeficit 
                      : '—'}
                  </td>
                  <td className="py-2 text-right text-zinc-500">{settings?.calorieDeficit ?? '—'}</td>
                </tr>
                <tr>
                  <td className="py-2 text-zinc-700 dark:text-zinc-300">Sat. Fat</td>
                  <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">{averages.week?.avgSaturatedFat ?? '—'}g</td>
                  <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">{averages.month?.avgSaturatedFat ?? '—'}g</td>
                  <td className="py-2 text-right text-zinc-500">&lt;{recommendations.saturatedFatLimit}g</td>
                </tr>
                <tr>
                  <td className="py-2 text-zinc-700 dark:text-zinc-300">Added Sugar</td>
                  <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">{averages.week?.avgAddedSugar ?? '—'}g</td>
                  <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">{averages.month?.avgAddedSugar ?? '—'}g</td>
                  <td className="py-2 text-right text-zinc-500">&lt;{recommendations.addedSugarLimit}g</td>
                </tr>
                <tr>
                  <td className="py-2 text-zinc-700 dark:text-zinc-300">Sodium</td>
                  <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">{averages.week?.avgSodium ?? '—'}mg</td>
                  <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">{averages.month?.avgSodium ?? '—'}mg</td>
                  <td className="py-2 text-right text-zinc-500">&lt;{recommendations.sodiumLimit}mg</td>
                </tr>
                <tr>
                  <td className="py-2 text-zinc-700 dark:text-zinc-300">Fiber</td>
                  <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">{averages.week?.avgFiber ?? '—'}g</td>
                  <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">{averages.month?.avgFiber ?? '—'}g</td>
                  <td className="py-2 text-right text-zinc-500">&gt;{recommendations.fiberTarget}g</td>
                </tr>
                <tr>
                  <td className="py-2 text-zinc-700 dark:text-zinc-300">Days Tracked</td>
                  <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">{averages.week?.daysTracked ?? 0}</td>
                  <td className="py-2 text-right text-zinc-900 dark:text-zinc-100">{averages.month?.daysTracked ?? 0}</td>
                  <td className="py-2 text-right text-zinc-500">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

interface StatCardProps {
  label: string;
  period: string;
  value: number | null | undefined;
  unit: string;
  isGood: (value: number | null) => boolean;
  formatValue?: (value: number) => string;
}

function StatCard({ label, period, value, unit, isGood, formatValue }: StatCardProps) {
  const good = isGood(value ?? null);
  const displayValue = value !== null && value !== undefined
    ? (formatValue ? formatValue(value) : String(value))
    : '—';

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{period}</p>
      <p className={`mt-1 text-2xl font-bold ${
        value === null || value === undefined
          ? 'text-zinc-400'
          : good
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-600 dark:text-red-400'
      }`}>
        {displayValue}
        {value !== null && value !== undefined && (
          <span className="text-sm font-normal text-zinc-400 ml-1">{unit}</span>
        )}
      </p>
    </div>
  );
}
