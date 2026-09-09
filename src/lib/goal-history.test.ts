import { describe, it, expect } from 'vitest';
import {
  GoalSnapshot,
  goalsChanged,
  resolveGoalsAsOf,
  resolveWeightAsOf,
} from './goal-history';

const snapshot = (effectiveFrom: string, calorieDeficit: number, proteinGPerKg: number): GoalSnapshot => ({
  effectiveFrom,
  calorieDeficit,
  proteinGPerKg,
  proteinFloorG: 150,
  saturatedFatPercent: 10,
});

// The change that prompted all of this: 300 kcal / 1.6 g/kg until the switch on
// 2026-09-05, 500 kcal / 2.0 g/kg after it.
const history = [snapshot('2026-06-01', 300, 1.6), snapshot('2026-09-05', 500, 2.0)];

describe('resolveGoalsAsOf', () => {
  it('scores a day against the goals in force that day, not the current ones', () => {
    expect(resolveGoalsAsOf(history, '2026-07-14')?.proteinGPerKg).toBe(1.6);
    expect(resolveGoalsAsOf(history, '2026-07-14')?.calorieDeficit).toBe(300);
  });

  it('applies a change from its effective date onward', () => {
    expect(resolveGoalsAsOf(history, '2026-09-04')?.proteinGPerKg).toBe(1.6);
    expect(resolveGoalsAsOf(history, '2026-09-05')?.proteinGPerKg).toBe(2.0);
    expect(resolveGoalsAsOf(history, '2026-09-09')?.proteinGPerKg).toBe(2.0);
  });

  it('falls back to the oldest snapshot for a day that predates all of them', () => {
    // Not today's goals: the oldest on record are nearer the truth for that day.
    expect(resolveGoalsAsOf(history, '2026-05-01')?.calorieDeficit).toBe(300);
  });

  it('does not depend on the rows arriving in order', () => {
    const reversed = [...history].reverse();
    expect(resolveGoalsAsOf(reversed, '2026-07-14')?.calorieDeficit).toBe(300);
    expect(resolveGoalsAsOf(reversed, '2026-09-09')?.calorieDeficit).toBe(500);
  });

  it('returns null when there is no history at all', () => {
    expect(resolveGoalsAsOf([], '2026-07-14')).toBeNull();
  });
});

describe('resolveWeightAsOf', () => {
  const weighIns = [
    { date: '2026-06-01', weightKg: 95 },
    { date: '2026-07-01', weightKg: 92 },
    { date: '2026-09-08', weightKg: 90 },
  ];

  it('uses the weight recorded that day', () => {
    expect(resolveWeightAsOf(weighIns, '2026-07-01')).toBe(92);
  });

  it('carries the last weigh-in forward across skipped days', () => {
    expect(resolveWeightAsOf(weighIns, '2026-07-20')).toBe(92);
  });

  it('does not let a later weigh-in leak backwards onto an earlier day', () => {
    // The whole point of C: a July day must not be scored at September's weight.
    expect(resolveWeightAsOf(weighIns, '2026-06-15')).toBe(95);
  });

  it('carries the earliest weigh-in back to days before it', () => {
    expect(resolveWeightAsOf(weighIns, '2026-05-01')).toBe(95);
  });

  it('returns null when nothing has been weighed', () => {
    expect(resolveWeightAsOf([], '2026-07-01')).toBeNull();
  });
});

describe('goalsChanged', () => {
  const current = {
    calorie_deficit: 500,
    protein_g_per_kg: 2.0,
    protein_floor_g: 150,
    saturated_fat_percent: 10,
  };

  it('detects a changed goal', () => {
    expect(goalsChanged(current, { calorie_deficit: 300 })).toBe(true);
    expect(goalsChanged(current, { protein_g_per_kg: 1.6 })).toBe(true);
  });

  it('ignores a save that leaves the goals alone', () => {
    expect(goalsChanged(current, { calorie_deficit: 500, name: 'Bruno' })).toBe(false);
  });

  it('ignores non-goal fields', () => {
    expect(goalsChanged(current, { weight_kg: 90, timezone: 'UTC' })).toBe(false);
  });

  it('does not treat a string round-trip as a change', () => {
    // The settings form posts numbers parsed from text inputs; Postgres hands back
    // DECIMAL columns as strings. Comparing those strictly appended a snapshot on
    // every save, however little changed.
    expect(goalsChanged({ ...current, protein_g_per_kg: '2.0' }, { protein_g_per_kg: 2.0 })).toBe(false);
  });
});
