import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SATURATED_FAT_PERCENT,
  saturatedFatLimitGrams,
  saturatedFatPercentOfCalories,
} from './targets';

describe('saturatedFatLimitGrams', () => {
  it('scales with the calorie goal at 10%', () => {
    // Handy shortcut: at 10%, grams ≈ calories / 90.
    expect(saturatedFatLimitGrams(1800, 10)).toBe(20);
    expect(saturatedFatLimitGrams(2700, 10)).toBe(30);
  });

  it('honors a stricter percentage', () => {
    expect(saturatedFatLimitGrams(2000, 6)).toBe(13);
  });

  it('defaults to the shared percentage', () => {
    expect(saturatedFatLimitGrams(1800)).toBe(
      saturatedFatLimitGrams(1800, DEFAULT_SATURATED_FAT_PERCENT)
    );
  });
});

describe('saturatedFatPercentOfCalories', () => {
  it('reports saturated fat as a share of consumed calories', () => {
    expect(saturatedFatPercentOfCalories(20, 1800)).toBeCloseTo(10, 5);
    expect(saturatedFatPercentOfCalories(20, 2200)).toBeCloseTo(8.18, 2);
  });

  it('returns null when nothing was logged, rather than dividing by zero', () => {
    expect(saturatedFatPercentOfCalories(0, 0)).toBeNull();
    expect(saturatedFatPercentOfCalories(5, 0)).toBeNull();
  });

  it('dilutes as total calories rise for the same saturated fat', () => {
    // Dropped a `f(x) === f(x)` assertion that used to sit here — it was a
    // tautology dressed up as a test of goal-independence.
    const light = saturatedFatPercentOfCalories(18, 1600)!;
    const heavy = saturatedFatPercentOfCalories(18, 2600)!;

    expect(light).toBeCloseTo(10.13, 1);
    expect(heavy).toBeCloseTo(6.23, 1);
    expect(heavy).toBeLessThan(light);
  });
});
