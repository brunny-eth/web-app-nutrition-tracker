import type { Supplement } from '@/types/database';

// Psyllium husk is the one supplement that contributes meaningful fiber
// (~5g per rounded tsp). Ticking it in the daily checklist folds that into
// the day's fiber total, so the toggle doubles as fiber logging. All other
// supplements stay pure binary toggles with no effect on macro totals.
export const PSYLLIUM_FIBER_G = 5;

/**
 * Extra fiber (grams) contributed by ticked supplements for a single day.
 * Currently only psyllium husk qualifies; matched by name so it survives
 * renames/recreates as long as "psyllium" appears in the name.
 */
export function supplementFiberBonus(
  supplements: Supplement[] | undefined,
  supplementsTaken: string[] | undefined | null
): number {
  const psyllium = (supplements ?? []).find((s) => /psyllium/i.test(s.name));
  if (!psyllium) return 0;
  return (supplementsTaken ?? []).includes(psyllium.id) ? PSYLLIUM_FIBER_G : 0;
}
