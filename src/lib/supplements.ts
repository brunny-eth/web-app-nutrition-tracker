import type { Supplement } from '@/types/database';

/**
 * Extra fiber (grams) contributed by ticked supplements for a single day.
 *
 * The amount is configured per supplement rather than hardcoded for psyllium at
 * 5g and matched by name, which meant the dose couldn't be changed without a
 * deploy — and changing it rewrote the fiber total of every day already logged.
 * Pass the supplement definitions that were in force on the day being totalled,
 * not the current ones.
 */
export function supplementFiberBonus(
  supplements: Supplement[] | undefined,
  supplementsTaken: string[] | undefined | null
): number {
  const taken = new Set(supplementsTaken ?? []);

  return (supplements ?? [])
    .filter((s) => taken.has(s.id))
    .reduce((total, s) => total + (Number(s.fiber_g) || 0), 0);
}
