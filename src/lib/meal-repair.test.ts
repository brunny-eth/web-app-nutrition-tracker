import { describe, it, expect } from 'vitest';
import { repairParsedMeal } from './meal-repair';
import type { FoodItem, ParsedMeal } from '@/types/nutrition';

/** A plausible item; override just the fields a case is about. */
function item(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    food_name: 'test food',
    grams: 100,
    grams_low: 90,
    grams_high: 110,
    calories: 200,
    calories_low: 180,
    calories_high: 220,
    protein_g: 10,
    protein_low: 9,
    protein_high: 11,
    carbs_g: 20,
    carbs_low: 18,
    carbs_high: 22,
    fat_g: 8,
    fat_low: 7,
    fat_high: 9,
    saturated_fat_g: 2,
    saturated_fat_low: 1.8,
    saturated_fat_high: 2.2,
    fiber_g: 3,
    fiber_low: 2.7,
    fiber_high: 3.3,
    sodium_mg: 150,
    sodium_low: 135,
    sodium_high: 165,
    added_sugar_g: 0,
    added_sugar_low: 0,
    added_sugar_high: 0,
    potassium_mg: 300,
    potassium_low: 270,
    potassium_high: 330,
    assumptions: [],
    ...overrides,
  };
}

const meal = (items: FoodItem[]): ParsedMeal => ({
  items,
  explicit_date: null,
  rejection_reason: null,
});

describe('repairParsedMeal', () => {
  it('leaves a well-formed meal untouched', () => {
    const { meal: repaired, repairs } = repairParsedMeal(meal([item()]));
    expect(repairs).toEqual([]);
    expect(repaired.items[0]).toEqual(item());
  });

  it('pulls a low bound above the estimate down to it', () => {
    // The bug this prevents: the UI rendering "5g fiber (18–22)".
    const { meal: repaired, repairs } = repairParsedMeal(
      meal([item({ fiber_g: 5, fiber_low: 18, fiber_high: 22 })])
    );
    expect(repaired.items[0].fiber_low).toBe(5);
    expect(repairs.some((r) => r.includes('fiber_low'))).toBe(true);
  });

  it('pushes a high bound below the estimate up to it', () => {
    const { meal: repaired } = repairParsedMeal(
      meal([item({ calories: 500, calories_low: 400, calories_high: 450 })])
    );
    expect(repaired.items[0].calories_high).toBe(500);
  });

  it('clamps negative values to zero', () => {
    const { meal: repaired, repairs } = repairParsedMeal(
      meal([item({ sodium_mg: -50, sodium_low: -60, sodium_high: -40 })])
    );
    expect(repaired.items[0].sodium_mg).toBe(0);
    expect(repaired.items[0].sodium_low).toBe(0);
    expect(repaired.items[0].sodium_high).toBe(0);
    expect(repairs.length).toBeGreaterThan(0);
  });

  it('caps saturated fat at total fat', () => {
    const { meal: repaired, repairs } = repairParsedMeal(
      meal([item({ fat_g: 5, saturated_fat_g: 9 })])
    );
    expect(repaired.items[0].saturated_fat_g).toBe(5);
    expect(repairs.some((r) => r.includes('saturated fat'))).toBe(true);
  });

  it('does not mutate the input', () => {
    const original = item({ fiber_g: 5, fiber_low: 18 });
    repairParsedMeal(meal([original]));
    expect(original.fiber_low).toBe(18);
  });

  it('handles an empty item list', () => {
    const { meal: repaired, repairs } = repairParsedMeal(meal([]));
    expect(repaired.items).toEqual([]);
    expect(repairs).toEqual([]);
  });
});
