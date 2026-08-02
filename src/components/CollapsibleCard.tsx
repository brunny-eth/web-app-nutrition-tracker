'use client';

import { useState, type ReactNode } from 'react';

interface CollapsibleCardProps {
  title: string;
  /**
   * Shown next to the title, and the reason collapsing is safe: it carries the
   * state you'd otherwise have to expand to check — "3/4 taken", "Moderate 1.55".
   * Without it, a collapsed card is just a hidden card.
   */
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleCard({
  title,
  summary,
  defaultOpen = false,
  children,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {title}
          </span>
          {summary !== undefined && summary !== null && (
            <span className="truncate text-xs text-zinc-400 dark:text-zinc-500">{summary}</span>
          )}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">{children}</div>
      )}
    </div>
  );
}
