'use client';

import { useState, useEffect } from 'react';
import type { Supplement } from '@/types/database';
import { CollapsibleCard } from './CollapsibleCard';
import { lbsToKg, roundLbs } from '@/lib/units';

export interface ChecklistData {
  supplements_taken: string[];
  alcohol: boolean;
  weight_kg: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
}

interface DailyChecklistProps {
  supplements: Supplement[];
  date: string;
  checklist: ChecklistData;
  onChange: (checklist: ChecklistData) => void;
}

const weightKgToInput = (kg: number | null) => (kg === null ? '' : roundLbs(kg).toString());

export function DailyChecklist({ supplements, date, checklist, onChange }: DailyChecklistProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local inputs so typing doesn't hit the API on every keystroke; synced when the day changes.
  const [sysInput, setSysInput] = useState(checklist.bp_systolic?.toString() ?? '');
  const [diaInput, setDiaInput] = useState(checklist.bp_diastolic?.toString() ?? '');
  const [weightInput, setWeightInput] = useState(weightKgToInput(checklist.weight_kg));
  useEffect(() => {
    setSysInput(checklist.bp_systolic?.toString() ?? '');
    setDiaInput(checklist.bp_diastolic?.toString() ?? '');
    setWeightInput(weightKgToInput(checklist.weight_kg));
  }, [checklist.bp_systolic, checklist.bp_diastolic, checklist.weight_kg, date]);

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

  const commitBp = () => {
    const sysStr = sysInput.trim();
    const diaStr = diaInput.trim();

    // Both blank → clear the reading.
    if (sysStr === '' && diaStr === '') {
      if (checklist.bp_systolic === null && checklist.bp_diastolic === null) return;
      persist({ ...checklist, bp_systolic: null, bp_diastolic: null });
      return;
    }

    // Partial (one filled) → incomplete pair, wait until both are entered.
    if (sysStr === '' || diaStr === '') return;

    const sys = Math.round(Number(sysStr));
    const dia = Math.round(Number(diaStr));
    if (!Number.isFinite(sys) || !Number.isFinite(dia) || sys <= 0 || dia <= 0) return;

    if (sys === checklist.bp_systolic && dia === checklist.bp_diastolic) return; // no change
    persist({ ...checklist, bp_systolic: sys, bp_diastolic: dia });
  };

  const commitWeight = () => {
    const str = weightInput.trim();

    // Blank → clear the reading.
    if (str === '') {
      if (checklist.weight_kg === null) return;
      persist({ ...checklist, weight_kg: null });
      return;
    }

    const lbs = Number(str);
    if (!Number.isFinite(lbs) || lbs <= 0) return;

    // No change if the entered lbs round-trips to what's already stored.
    if (str === weightKgToInput(checklist.weight_kg)) return;
    persist({ ...checklist, weight_kg: lbsToKg(lbs) });
  };

  const takenCount = checklist.supplements_taken.filter((id) =>
    supplements.some((s) => s.id === id)
  ).length;

  // Surfaced in the collapsed header so the card can stay shut without hiding
  // whether anything's been logged today.
  const summaryParts: string[] = [];
  if (supplements.length > 0) summaryParts.push(`${takenCount}/${supplements.length} taken`);
  if (checklist.weight_kg !== null) summaryParts.push(`${weightKgToInput(checklist.weight_kg)} lbs`);
  if (checklist.alcohol) summaryParts.push('alcohol');

  return (
    <CollapsibleCard
      title="Daily tracking"
      summary={saving ? 'Saving…' : summaryParts.join(' · ')}
    >
      <div className="mb-3">
        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Supplements &amp; Alcohol
        </h4>
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
          Drank alcohol
        </button>
      </div>

      {/* Metrics (optional numbers, logged occasionally) */}
      <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Metrics
        </h3>

        {/* Weight */}
        <div className="flex items-center gap-2">
          <label htmlFor="weight" className="text-sm text-zinc-500 dark:text-zinc-400">
            Weight
          </label>
          <input
            id="weight"
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            onBlur={commitWeight}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            placeholder="lbs"
            aria-label="Weight"
            className="w-20 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <span className="text-xs text-zinc-400">lbs</span>
        </div>
      </div>

      {/* Blood pressure (optional, logged occasionally) */}
      <div className="mt-3 flex items-center gap-2 pt-1">
        <label htmlFor="bp-sys" className="text-sm text-zinc-500 dark:text-zinc-400">
          Blood Pressure
        </label>
        <input
          id="bp-sys"
          type="number"
          inputMode="numeric"
          value={sysInput}
          onChange={(e) => setSysInput(e.target.value)}
          onBlur={commitBp}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          placeholder="sys"
          aria-label="Systolic"
          className="w-16 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <span className="text-zinc-400">/</span>
        <input
          id="bp-dia"
          type="number"
          inputMode="numeric"
          value={diaInput}
          onChange={(e) => setDiaInput(e.target.value)}
          onBlur={commitBp}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          placeholder="dia"
          aria-label="Diastolic"
          className="w-16 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <span className="text-xs text-zinc-400">mmHg</span>
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </CollapsibleCard>
  );
}
