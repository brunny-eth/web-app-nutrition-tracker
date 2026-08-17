'use client';

import { useRef, useState } from 'react';
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
  /** Refetch the list — a meal was renamed or removed. */
  onChanged: () => void;
}

export function SavedMealList({
  savedMeals,
  selectedDate,
  today,
  onLogged,
  onChanged,
}: SavedMealListProps) {
  // Keyed by id so two meals don't share one input. Absent means one serving —
  // logging the usual amount shouldn't require typing anything.
  const [servings, setServings] = useState<Record<string, string>>({});
  // Which meal has its details panel open. One at a time; the description is long
  // enough that stacking several would bury the rows below.
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Which meal is being renamed, and the in-progress name. Held here rather than in
  // the row so an abandoned edit doesn't survive the list refetching.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  // Set on the Cancel button's mousedown, which fires before the input's blur —
  // otherwise blur-to-commit would save the edit the user just asked to discard.
  const cancellingRef = useRef(false);
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

  const startRename = (meal: SavedMeal) => {
    setError('');
    setRenamingId(meal.id);
    setNameDraft(meal.name);
  };

  const cancelRename = () => {
    cancellingRef.current = false;
    setRenamingId(null);
    setNameDraft('');
  };

  const saveRename = async (meal: SavedMeal) => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setError('Name cannot be empty');
      return;
    }
    // Nothing to save, so skip the round trip and just close the field.
    if (trimmed === meal.name) {
      cancelRename();
      return;
    }

    setError('');
    setBusyId(meal.id);
    try {
      const res = await fetch(`/api/saved-meals/${meal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to rename');
      }
      cancelRename();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename');
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
      onChanged();
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
          const renaming = renamingId === meal.id;
          return (
            <li
              key={meal.id}
              className="rounded-xl border border-zinc-100 p-3 dark:border-zinc-800"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {renaming ? (
                    <input
                      autoFocus
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(meal);
                        if (e.key === 'Escape') cancelRename();
                      }}
                      // Blur commits rather than discards: tapping away from a field
                      // you just typed into shouldn't throw the edit out.
                      onBlur={() => {
                        if (cancellingRef.current) cancelRename();
                        else saveRename(meal);
                      }}
                      maxLength={80}
                      aria-label={`Name for ${meal.name}`}
                      className="w-full rounded-lg border border-blue-500 bg-white px-2 py-1 text-sm font-medium text-zinc-900 outline-none focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  ) : (
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {meal.name}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                    {meal.calories_per_serving} cal · {meal.protein_per_serving}g protein per
                    serving
                  </p>
                </div>
                {/* Opens the serving description and the rename field. */}
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
                    onMouseDown={() => {
                      cancellingRef.current = renaming;
                    }}
                    onClick={() => (renaming ? cancelRename() : startRename(meal))}
                    className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {renaming ? 'Cancel rename' : 'Rename this meal'}
                  </button>
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <label
                  htmlFor={`servings-${meal.id}`}
                  className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400"
                >
                  servings:
                </label>
                <input
                  id={`servings-${meal.id}`}
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
                  className="w-14 shrink-0 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-center text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                {/* Sized to the action rather than stretched across the row — full
                    width made it the loudest thing on the card. Remove sits at the
                    far end, deliberately out of reach of the Log tap. */}
                <button
                  type="button"
                  onClick={() => log(meal)}
                  disabled={busy}
                  className="w-24 shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? 'Logging…' : 'Log'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(meal)}
                  disabled={busy}
                  className="ml-auto shrink-0 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-200 hover:bg-red-50 disabled:opacity-50 dark:border-zinc-700 dark:text-red-400 dark:hover:border-red-900 dark:hover:bg-red-950/30"
                >
                  <span className="sm:hidden">Remove</span>
                  <span className="hidden sm:inline">Remove this meal</span>
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
