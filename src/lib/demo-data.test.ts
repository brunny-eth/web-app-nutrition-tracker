import { describe, it, expect } from 'vitest';
import { demoDayPlan, demoWeightKg, DEMO_PROFILE } from './demo-data';

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const WINDOW = Array.from({ length: 90 }, (_, i) => addDays('2026-09-12', -i));

function dayTotals(date: string) {
  const items = demoDayPlan(date).entries.flatMap((e) => e.items);
  const sum = (pick: (i: (typeof items)[number]) => number) =>
    items.reduce((total, item) => total + pick(item), 0);

  return {
    calories: sum((i) => i.calories),
    protein: sum((i) => i.protein_g),
    saturatedFat: sum((i) => i.saturated_fat_g),
    fiber: sum((i) => i.fiber_g),
    addedSugar: sum((i) => i.added_sugar_g),
    sodium: sum((i) => i.sodium_mg),
    potassium: sum((i) => i.potassium_mg),
  };
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

describe('demoDayPlan', () => {
  it('is a pure function of the date', () => {
    // The whole seeding strategy rests on this: a day backfilled late has to come
    // out identical to the same day seeded on time.
    expect(demoDayPlan('2026-07-04')).toEqual(demoDayPlan('2026-07-04'));
    expect(demoDayPlan('2026-07-04')).not.toEqual(demoDayPlan('2026-07-05'));
  });

  it('does not repeat on a weekly cycle', () => {
    const a = dayTotals('2026-08-03');
    const b = dayTotals('2026-08-10');
    expect(a.calories).not.toBe(b.calories);
  });

  it('keeps every estimate inside its own low/high range', () => {
    for (const item of WINDOW.flatMap((d) => demoDayPlan(d).entries.flatMap((e) => e.items))) {
      expect(item.calories_low).toBeLessThanOrEqual(item.calories);
      expect(item.calories).toBeLessThanOrEqual(item.calories_high);
      expect(item.protein_low).toBeLessThanOrEqual(item.protein_g);
      expect(item.sodium_low).toBeLessThanOrEqual(item.sodium_mg);
      expect(item.saturated_fat_g).toBeLessThanOrEqual(item.fat_g);
      expect(item.fiber_g).toBeGreaterThanOrEqual(0);
    }
  });

  it('hits its calorie and protein goals on average', () => {
    // The point of the demo is a mixed picture, so these two are meant to look good.
    const totals = WINDOW.map(dayTotals);
    const proteinTarget = Math.max(
      Math.round(demoWeightKg('2026-09-12') * DEMO_PROFILE.protein_g_per_kg),
      DEMO_PROFILE.protein_floor_g
    );

    expect(mean(totals.map((t) => t.calories))).toBeGreaterThan(2200);
    expect(mean(totals.map((t) => t.calories))).toBeLessThan(2600);
    expect(mean(totals.map((t) => t.protein))).toBeGreaterThan(proteinTarget);
  });

  it('misses its fiber, sodium and potassium-to-sodium goals on average', () => {
    // And these are meant to look bad — a demo where every card is green shows
    // nothing. Guards against a meal edit quietly turning the diet healthy.
    const totals = WINDOW.map(dayTotals);

    expect(mean(totals.map((t) => t.fiber))).toBeLessThan(34);
    expect(mean(totals.map((t) => t.sodium))).toBeGreaterThan(3000);
    expect(mean(totals.map((t) => t.potassium)) / mean(totals.map((t) => t.sodium))).toBeLessThan(1.5);
  });

  it('logs weekends differently from weekdays', () => {
    // 2026-09-11 is a Friday, 2026-09-10 a Thursday.
    expect(demoDayPlan('2026-09-11').checklist.alcohol).toBe(true);
    expect(demoDayPlan('2026-09-10').checklist.alcohol).toBe(false);
  });
});

describe('demoWeightKg', () => {
  it('trends down without running away', () => {
    expect(demoWeightKg('2026-06-15')).toBeGreaterThan(demoWeightKg('2026-09-12'));
    // Ten years on it should have plateaued, not reached zero.
    expect(demoWeightKg('2036-09-12')).toBeGreaterThan(70);
  });
});
