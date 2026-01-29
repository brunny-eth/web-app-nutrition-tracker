'use client';

import { useState } from 'react';

interface ActivityLevel {
  id: number;
  label: string;
  description: string;
  multiplier: number;
}

interface ActivitySelectorProps {
  currentLevel: number;
  date: string;
  onSelect: (levelId: number) => void;
}

const ACTIVITY_LEVELS: ActivityLevel[] = [
  { id: 1, label: 'Rest', description: 'Sedentary', multiplier: 1.2 },
  { id: 2, label: 'Light', description: 'Light exercise', multiplier: 1.375 },
  { id: 3, label: 'Moderate', description: 'Moderate exercise', multiplier: 1.55 },
  { id: 4, label: 'Active', description: 'Hard exercise', multiplier: 1.725 },
  { id: 5, label: 'V. Active', description: 'Intense exercise', multiplier: 1.9 },
];

export function ActivitySelector({ currentLevel, date, onSelect }: ActivitySelectorProps) {
  const [loading, setLoading] = useState<number | null>(null);

  const handleSelect = async (levelId: number) => {
    if (loading) return;
    setLoading(levelId);

    try {
      const res = await fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, activity_level_id: levelId }),
      });

      if (res.ok) {
        onSelect(levelId);
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Activity Level Today
      </h3>
      <div className="flex gap-1.5">
        {ACTIVITY_LEVELS.map((level) => (
          <button
            key={level.id}
            onClick={() => handleSelect(level.id)}
            disabled={loading !== null}
            className={`flex-1 rounded-lg px-1.5 py-2 text-xs font-medium transition-all ${
              currentLevel === level.id
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            } ${loading === level.id ? 'opacity-50' : ''}`}
            title={level.description}
          >
            {level.label}
          </button>
        ))}
      </div>
    </div>
  );
}
