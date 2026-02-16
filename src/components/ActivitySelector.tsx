'use client';

import { useState, useRef } from 'react';

export interface ActivityData {
  multiplier: number;
  multiplier_low: number;
  multiplier_high: number;
  summary?: string;
  description?: string;
}

interface ActivitySelectorProps {
  currentActivity: ActivityData | null;
  date: string;
  onSelect: (activity: ActivityData) => void;
}

const PRESETS = [
  { label: 'Rest', description: 'Sedentary day, no exercise, mostly sitting' },
  { label: 'Light', description: 'Light exercise or walking, mostly desk work' },
  { label: 'Moderate', description: 'Moderate exercise for 30-60 minutes, mix of sitting and moving' },
  { label: 'Active', description: 'Hard exercise for 60+ minutes, physically active day' },
  { label: 'V. Active', description: 'Very hard exercise or physical labor, intense training' },
];

export function ActivitySelector({ currentActivity, date, onSelect }: ActivitySelectorProps) {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submitDescription = async (description: string) => {
    if (loading || !description.trim()) return;
    setLoading(true);
    setError(null);

    try {
      // Step 1: Get LLM estimate
      const estimateRes = await fetch('/api/activity-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() }),
      });

      if (!estimateRes.ok) {
        throw new Error('Failed to estimate activity');
      }

      const { estimate } = await estimateRes.json();

      // Step 2: Save to database
      const saveRes = await fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          multiplier: estimate.multiplier,
          multiplier_low: estimate.multiplier_low,
          multiplier_high: estimate.multiplier_high,
          summary: estimate.summary,
          description: description.trim(),
        }),
      });

      if (!saveRes.ok) {
        throw new Error('Failed to save activity');
      }

      // Step 3: Update parent
      onSelect({
        multiplier: estimate.multiplier,
        multiplier_low: estimate.multiplier_low,
        multiplier_high: estimate.multiplier_high,
        summary: estimate.summary,
        description: description.trim(),
      });

      setInputValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitDescription(inputValue);
  };

  const handlePresetClick = (preset: typeof PRESETS[number]) => {
    setInputValue(preset.description);
    submitDescription(preset.description);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Activity Level Today
      </h3>

      {/* Text input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Describe today's activity..."
          disabled={loading}
          className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
        <button
          type="submit"
          disabled={loading || !inputValue.trim()}
          className="flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          )}
        </button>
      </form>

      {/* Preset chips */}
      <div className="mt-2 flex gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handlePresetClick(preset)}
            disabled={loading}
            className="flex-1 rounded-lg bg-zinc-100 px-1.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="mt-2 text-xs text-red-500">{error}</p>
      )}

      {/* Current activity display */}
      {currentActivity && (
        <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-950/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Multiplier: {currentActivity.multiplier.toFixed(2)}
            </p>
            <p className="text-xs text-blue-500 dark:text-blue-400">
              {currentActivity.multiplier_low.toFixed(2)}–{currentActivity.multiplier_high.toFixed(2)} range
            </p>
          </div>
          {currentActivity.summary && (
            <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
              {currentActivity.summary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
