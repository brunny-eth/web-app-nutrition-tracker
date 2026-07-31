'use client';

import { useState } from 'react';

export interface SavedMeal {
  id: string;
  name: string;
  /** Exactly what one serving is, so it can be reproduced with a measuring cup. */
  serving_description: string;
  calories_per_serving: number;
  protein_per_serving: number;
}

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
  // Collapsed by default: these are a reference you open when you want them, not
  // something to scroll past on the way to logging.
  const [open, setOpen] = useState(false);
  // Keyed by id so two meals don't share one input.
  const [servings, setServings] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (savedMeals.length === 0) return null;

  const log = async (meal: SavedMeal) => {
    const raw = (servings[meal.id] ?? '').trim();
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
      setServings((prev) => ({ ...prev, [meal.id]: '' }));
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
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      >
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Saved meals
          <span className="ml-1.5 text-xs font-normal text-zinc-400">{savedMeals.length}</span>
        </span>
        <svg
          className={`h-4 w-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
          <ul className="space-y-3">
            {savedMeals.map((meal) => {
              const busy = busyId === meal.id;

              return (
                <li
                  key={meal.id}
                  className="rounded-xl border border-zinc-100 p-3 dark:border-zinc-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {meal.name}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {meal.serving_description}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                        {meal.calories_per_serving} cal · {meal.protein_per_serving}g protein per
                        serving
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(meal)}
                      disabled={busy}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.25"
                      min="0"
                      value={servings[meal.id] ?? ''}
                      onChange={(e) =>
                        setServings((prev) => ({ ...prev, [meal.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') log(meal);
                      }}
                      placeholder="1"
                      aria-label={`Servings of ${meal.name} eaten`}
                      className="w-20 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">servings</span>
                    <button
                      type="button"
                      onClick={() => log(meal)}
                      disabled={busy}
                      className="ml-auto rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? 'Logging…' : 'Log'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}
