'use client';

import { useState } from 'react';
import type { Supplement } from '@/types/database';

export interface ChecklistData {
  supplements_taken: string[];
  alcohol: boolean;
}

interface DailyChecklistProps {
  supplements: Supplement[];
  date: string;
  checklist: ChecklistData;
  onChange: (checklist: ChecklistData) => void;
}

export function DailyChecklist({ supplements, date, checklist, onChange }: DailyChecklistProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = async (next: ChecklistData) => {
    // Optimistic update — reflect the toggle immediately, roll back on failure.
    const prev = checklist;
    onChange(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, ...next }),
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch (err) {
      onChange(prev);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const toggleSupplement = (id: string) => {
    const taken = new Set(checklist.supplements_taken);
    if (taken.has(id)) taken.delete(id);
    else taken.add(id);
    persist({ ...checklist, supplements_taken: [...taken] });
  };

  const toggleAlcohol = () => {
    persist({ ...checklist, alcohol: !checklist.alcohol });
  };

  const takenCount = checklist.supplements_taken.filter((id) =>
    supplements.some((s) => s.id === id)
  ).length;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Supplements &amp; Alcohol
        </h3>
        <span className="text-xs text-zinc-400">
          {saving ? 'Saving…' : supplements.length > 0 ? `${takenCount}/${supplements.length} taken` : ''}
        </span>
      </div>

      {supplements.length === 0 ? (
        <p className="text-xs text-zinc-400">
          No supplements configured. Add them in Settings.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {supplements.map((s) => {
            const active = checklist.supplements_taken.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSupplement(s.id)}
                title={s.detail}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-green-500 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-950/40 dark:text-green-300'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
                    active
                      ? 'border-green-500 bg-green-500 text-white dark:border-green-600 dark:bg-green-600'
                      : 'border-zinc-300 dark:border-zinc-600'
                  }`}
                >
                  {active ? '✓' : ''}
                </span>
                {s.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Alcohol toggle */}
      <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={toggleAlcohol}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            checklist.alcohol
              ? 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300'
              : 'border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
          }`}
        >
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
              checklist.alcohol
                ? 'border-amber-500 bg-amber-500 text-white dark:border-amber-600 dark:bg-amber-600'
                : 'border-zinc-300 dark:border-zinc-600'
            }`}
          >
            {checklist.alcohol ? '✓' : ''}
          </span>
          {checklist.alcohol ? 'Had alcohol today' : 'Alcohol-free day'}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
