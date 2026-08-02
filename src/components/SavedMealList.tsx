'use client';

import { useState } from 'react';
import { CollapsibleCard } from './CollapsibleCard';

export interface SavedMeal {
  id: string;
  name: string;
  /** Exactly what one serving is, so it can be reproduced with a measuring cup. */
  serving_description: string;
  calories_per_serving: number;
  protein_per_serving: number;
}

/** One serving is the overwhelmingly common case, so it's prefilled. */
const DEFAULT_SERVINGS = '1';

interface SavedMealListProps {
  savedMeals: SavedMeal[];
  /** Date to log against, YYYY-MM-DD. */
  selectedDate: string;
  today: string;
  onLogged: () => void;
  onRemoved: () => void;
}

export function SavedMealList({
  savedMeals,
  selectedDate,
  today,
  onLogged,
  onRemoved,
}: SavedMealListProps) {
  // Keyed by id so two meals don't share one input. Absent means one serving —
  // logging the usual amount shouldn't require typing anything.
  const [servings, setServings] = useState<Record<string, string>>({});
  // Which meal has its details panel open. One at a time; the description is long
  // enough that stacking several would bury the rows below.
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (savedMeals.length === 0) return null;

  const servingsFor = (id: string) => servings[id] ?? DEFAULT_SERVINGS;

  const log = async (meal: SavedMeal) => {
    const raw = servingsFor(meal.id).trim();
    const count = Number(raw);
    if (!Number.isFinite(count) || count <= 0) {
      setError(`Enter how many servings of ${meal.name} you ate`);
      return;
    }

    setError('');
    setBusyId(meal.id);
    try {
      const res = await fetch(`/api/saved-meals/${meal.id}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servings: count,
          override_date: selectedDate !== today ? selectedDate : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to log meal');
      }
      // Back to one rather than blank, so the next log is a single tap again.
      setServings((prev) => ({ ...prev, [meal.id]: DEFAULT_SERVINGS }));
      onLogged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log meal');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (meal: SavedMeal) => {
    if (!confirm(`Remove "${meal.name}"? Meals you already logged from it stay put.`)) return;

    setBusyId(meal.id);
    try {
      const res = await fetch(`/api/saved-meals/${meal.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove');
      onRemoved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setBusyId(null);
    }
  };

  return (
    // Collapsed by default: a reference you open when you want it, not something to
    // scroll past on the way to logging.
    <CollapsibleCard title="Saved meals" summary={String(savedMeals.length)}>
      <ul className="space-y-3">
        {savedMeals.map((meal) => {
          const busy = busyId === meal.id;
          const detailsOpen = detailsId === meal.id;
          return (
            <li
              key={meal.id}
              className="rounded-xl border border-zinc-100 p-3 dark:border-zinc-800"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {meal.name}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                    {meal.calories_per_serving} cal · {meal.protein_per_serving}g protein per
                    serving
                  </p>
                </div>
                {/* Holds the serving description and Remove. Keeping Remove out of
                    the title row stops a destructive action sitting under your
                    thumb next to the meal name. */}
                <button
                  type="button"
                  onClick={() => setDetailsId((prev) => (prev === meal.id ? null : meal.id))}
                  aria-expanded={detailsOpen}
                  aria-label={`Details for ${meal.name}`}
                  className={`-mr-1 shrink-0 rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 ${
                    detailsOpen ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800' : ''
                  }`}
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6 10a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM11.5 10a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM17 10a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  </svg>
                </button>
              </div>
              {detailsOpen && (
                <div className="mt-2 space-y-2 rounded-lg bg-zinc-50 p-2.5 dark:bg-zinc-800/50">
                  <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {meal.serving_description}
                  </p>
                  <button
                    type="button"
                    onClick={() => remove(meal)}
                    disabled={busy}
                    className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                  >
                    Remove this meal
                  </button>
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.25"
                  min="0"
                  value={servingsFor(meal.id)}
                  onChange={(e) =>
                    setServings((prev) => ({ ...prev, [meal.id]: e.target.value }))
                  }
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') log(meal);
                  }}
                  aria-label={`Servings of ${meal.name} eaten`}
                  className="w-14 shrink-0 rounded-lg border border-zinc-200 bg-white px-2 py-2 text-center text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  servings
                </span>
                {/* Fills the remaining width rather than floating right, which left
                    an awkward gap on a narrow screen — and makes a bigger target. */}
                <button
                  type="button"
                  onClick={() => log(meal)}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? 'Logging…' : 'Log'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </CollapsibleCard>
  );
}
