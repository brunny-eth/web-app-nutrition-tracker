'use client';

import { useState } from 'react';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

interface FoodEntryFormProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onEntryCreated: () => void;
  today: string;
  yesterday: string;
}

export function FoodEntryForm({ 
  selectedDate, 
  onDateChange, 
  onEntryCreated,
  today,
  yesterday,
}: FoodEntryFormProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_text: text.trim(),
          client_timestamp: new Date().toISOString(),
          override_date: selectedDate !== today ? selectedDate : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to log food');
      }

      setText('');
      onEntryCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log food');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add food you ate here, and be as descriptive as possible for the best results. You can do 1 message a day or multiple throughout the day. E.g., '3 scrambled eggs, cooked with 1 pat butter, 2 slices Dave's Killer Bread toast'"          rows={5}
          className="block w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        disabled={loading || !text.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <LoadingSpinner />
            Parsing...
          </>
        ) : (
          'Log Food'
        )}
      </button>

      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">Log for:</span>
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <button
            type="button"
            onClick={() => onDateChange(today)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedDate === today
                ? 'bg-blue-600 text-white'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onDateChange(yesterday)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedDate === yesterday
                ? 'bg-blue-600 text-white'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            Yesterday
          </button>
          <label
            className={`relative px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
              selectedDate !== today && selectedDate !== yesterday
                ? 'bg-blue-600 text-white'
                : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            {selectedDate !== today && selectedDate !== yesterday
              ? formatDate(selectedDate)
              : 'Pick date'}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              max={today}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </form>
  );
}

function LoadingSpinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
