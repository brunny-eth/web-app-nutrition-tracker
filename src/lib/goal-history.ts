import type { Supplement } from '@/types/database';

/**
 * Point-in-time goals.
 *
 * Goals used to be read straight off `user_settings`, which is a single mutable
 * row. Raising the protein target from 1.6 to 2.0 g/kg therefore re-scored every
 * past day against the new number, so three months of days you actually hit
 * silently dropped to 80%. A day should be judged against the goals that were in
 * force on that day, so goal changes are appended to `goal_history` and resolved
 * per date instead.
 *
 * Body weight has the same problem from a different direction: BMR was computed
 * once from the current weight and reused for every day in the chart, so each
 * pound lost shrank the deficit you had already earned. Weigh-ins are already
 * recorded per day, so that history just needed to be read.
 *
 * The supplement list rides along in the same snapshot. It is scoring config too:
 * it sets how much fiber a ticked supplement adds, and which supplements a day
 * could possibly have been adherent to. Doubling a psyllium dose otherwise
 * restates months of fiber totals, and adding a supplement scores every day
 * before it existed as a miss.
 */

/** One row of `goal_history` — a complete snapshot, not a delta. */
export interface GoalSnapshot {
  effectiveFrom: string;
  calorieDeficit: number;
  proteinGPerKg: number;
  proteinFloorG: number;
  saturatedFatPercent: number;
  supplements: Supplement[];
}

export interface WeighIn {
  date: string;
  weightKg: number;
}

/**
 * The goals in force on `date`: the most recent snapshot that had taken effect by
 * then.
 *
 * A date older than every snapshot resolves to the earliest one rather than to
 * nothing. The seed row is backdated to account creation so that shouldn't arise,
 * but if it does, the oldest goals on record are a far better description of that
 * day than today's are — falling through to current settings would reintroduce
 * exactly the bug this module exists to fix.
 *
 * `history` need not be sorted.
 */
export function resolveGoalsAsOf(
  history: GoalSnapshot[],
  date: string
): GoalSnapshot | null {
  if (history.length === 0) return null;

  const sorted = [...history].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  let match = sorted[0];

  for (const snapshot of sorted) {
    if (snapshot.effectiveFrom > date) break;
    match = snapshot;
  }

  return match;
}

/**
 * Body weight on `date`, carried forward from the most recent weigh-in at or
 * before it — you don't weigh in every day, and the last known weight is the best
 * estimate for a gap.
 *
 * Days before the first weigh-in carry the earliest one *backwards* for the same
 * reason the goal lookup does: it is nearer in time, and therefore nearer in
 * truth, than today's weight.
 *
 * Null only when there are no weigh-ins at all; the caller then has nothing to
 * fall back on but `user_settings`.
 */
export function resolveWeightAsOf(weighIns: WeighIn[], date: string): number | null {
  if (weighIns.length === 0) return null;

  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date));
  let match = sorted[0];

  for (const weighIn of sorted) {
    if (weighIn.date > date) break;
    match = weighIn;
  }

  return match.weightKg;
}

/** The numeric goals tracked in `goal_history`, as named on `user_settings`. */
export const GOAL_FIELDS = [
  'calorie_deficit',
  'protein_g_per_kg',
  'protein_floor_g',
  'saturated_fat_percent',
] as const;

export type GoalField = (typeof GOAL_FIELDS)[number];

/**
 * Whether a settings update changes anything that affects how a day is scored,
 * and so needs a new snapshot. Renaming yourself or switching timezone does not.
 *
 * Numbers are compared numerically: the settings form round-trips them through
 * text inputs and Postgres returns DECIMAL columns as strings, so an untouched
 * value arrives as `500` against a stored `"500"`. A strict comparison would
 * append a snapshot on every save.
 */
export function scoredConfigChanged(
  current: Record<string, unknown>,
  updates: Record<string, unknown>
): boolean {
  const goalMoved = GOAL_FIELDS.some((field) => {
    if (updates[field] === undefined) return false;
    return Number(updates[field]) !== Number(current[field]);
  });

  if (goalMoved) return true;
  if (updates.supplements === undefined) return false;

  return !sameSupplements(
    current.supplements as Supplement[] | null,
    updates.supplements as Supplement[] | null
  );
}

/**
 * Compares the fields that affect scoring — id, name and fiber — ignoring order
 * and ignoring `detail`, which is a free-text note the user can reword without
 * changing what any day was measured against.
 */
function sameSupplements(a: Supplement[] | null, b: Supplement[] | null): boolean {
  const normalize = (list: Supplement[] | null) =>
    (list ?? [])
      .map((s) => `${s.id}:${s.name}:${Number(s.fiber_g) || 0}`)
      .sort()
      .join('|');

  return normalize(a) === normalize(b);
}
