'use client';

import { useState } from 'react';

export interface Batch {
  id: string;
  name: string;
  unit: string;
  total_amount: number;
  consumed_amount: number;
  remaining_amount: number;
  total_calories: number;
  calories_per_unit: number;
}

interface BatchListProps {
  batches: Batch[];
  /** Date to log the portion against, YYYY-MM-DD. */
  selectedDate: string;
  today: string;
  /** Refresh entries and batches — a logged portion changes both. */
  onPortionLogged: () => void;
  onBatchArchived: () => void;
}

export function BatchList({
  batches,
  selectedDate,
  today,
  onPortionLogged,
  onBatchArchived,
}: BatchListProps) {
  // Keyed by batch id so two batches don't share one input.
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (batches.length === 0) return null;

  const logPortion = async (batch: Batch) => {
    const raw = (amounts[batch.id] ?? '').trim();
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(`Enter how many ${batch.unit} of ${batch.name} you ate`);
      return;
    }

    setError('');
    setBusyId(batch.id);
    try {
      const res = await fetch(`/api/batches/${batch.id}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          override_date: selectedDate !== today ? selectedDate : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to log portion');
      }
      setAmounts((prev) => ({ ...prev, [batch.id]: '' }));
      onPortionLogged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log portion');
    } finally {
      setBusyId(null);
    }
  };

  const archive = async (batch: Batch) => {
    if (!confirm(`Remove "${batch.name}"? Portions you already logged stay put.`)) return;

    setBusyId(batch.id);
    try {
      const res = await fetch(`/api/batches/${batch.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove batch');
      onBatchArchived();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove batch');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Batches</h3>

      <ul className="space-y-3">
        {batches.map((batch) => {
          const busy = busyId === batch.id;
          // Negative means you've logged more than the recorded yield — surfaced
          // rather than hidden, since it means the total was off.
          const overdrawn = batch.remaining_amount < 0;

          return (
            <li
              key={batch.id}
              className="rounded-xl border border-zinc-100 p-3 dark:border-zinc-800"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {batch.name}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    <span className={overdrawn ? 'text-amber-600 dark:text-amber-400' : ''}>
                      {batch.remaining_amount} of {batch.total_amount} {batch.unit} left
                    </span>
                    {' · '}
                    {batch.calories_per_unit} cal/{singular(batch.unit)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => archive(batch)}
                  disabled={busy}
                  title="Remove this batch"
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
                  value={amounts[batch.id] ?? ''}
                  onChange={(e) => setAmounts((prev) => ({ ...prev, [batch.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') logPortion(batch);
                  }}
                  placeholder="0"
                  aria-label={`${batch.unit} of ${batch.name} eaten`}
                  className="w-20 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-center text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{batch.unit}</span>
                <button
                  type="button"
                  onClick={() => logPortion(batch)}
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
  );
}

/** "cups" → "cup", for the per-unit calorie label. */
function singular(unit: string): string {
  return unit.endsWith('s') ? unit.slice(0, -1) : unit;
}
