import { describe, it, expect } from 'vitest';

/**
 * Aggregation helper - mirrors what the frontend does
 */
function aggregateItems(items: Array<{
  calories: number;
  calories_low: number;
  calories_high: number;
  protein_g: number;
  protein_low: number;
  protein_high: number;
  carbs_g: number;
  carbs_low: number;
  carbs_high: number;
  fat_g: number;
  fat_low: number;
  fat_high: number;
}>) {
  return items.reduce(
    (acc, item) => {
      acc.calories.value += item.calories;
      acc.calories.low += item.calories_low;
      acc.calories.high += item.calories_high;
      acc.protein.value += item.protein_g;
      acc.protein.low += item.protein_low;
      acc.protein.high += item.protein_high;
      acc.carbs.value += item.carbs_g;
      acc.carbs.low += item.carbs_low;
      acc.carbs.high += item.carbs_high;
      acc.fat.value += item.fat_g;
      acc.fat.low += item.fat_low;
      acc.fat.high += item.fat_high;
      return acc;
    },
    {
      calories: { value: 0, low: 0, high: 0 },
      protein: { value: 0, low: 0, high: 0 },
      carbs: { value: 0, low: 0, high: 0 },
      fat: { value: 0, low: 0, high: 0 },
    }
  );
}

describe('Aggregation Math', () => {
  describe('Basic summation', () => {
    it('should correctly sum calories across multiple items', () => {
      const items = [
        { calories: 100, calories_low: 90, calories_high: 110, protein_g: 10, protein_low: 9, protein_high: 11, carbs_g: 5, carbs_low: 4, carbs_high: 6, fat_g: 3, fat_low: 2, fat_high: 4 },
        { calories: 200, calories_low: 180, calories_high: 220, protein_g: 20, protein_low: 18, protein_high: 22, carbs_g: 25, carbs_low: 22, carbs_high: 28, fat_g: 8, fat_low: 7, fat_high: 9 },
        { calories: 150, calories_low: 135, calories_high: 165, protein_g: 15, protein_low: 13, protein_high: 17, carbs_g: 10, carbs_low: 9, carbs_high: 11, fat_g: 5, fat_low: 4, fat_high: 6 },
      ];

      const totals = aggregateItems(items);

      expect(totals.calories.value).toBe(450);
      expect(totals.calories.low).toBe(405);  // 90 + 180 + 135
      expect(totals.calories.high).toBe(495); // 110 + 220 + 165
    });

    it('should correctly sum protein', () => {
      const items = [
        { calories: 100, calories_low: 90, calories_high: 110, protein_g: 25, protein_low: 22, protein_high: 28, carbs_g: 5, carbs_low: 4, carbs_high: 6, fat_g: 3, fat_low: 2, fat_high: 4 },
        { calories: 200, calories_low: 180, calories_high: 220, protein_g: 30, protein_low: 27, protein_high: 33, carbs_g: 25, carbs_low: 22, carbs_high: 28, fat_g: 8, fat_low: 7, fat_high: 9 },
      ];

      const totals = aggregateItems(items);

      expect(totals.protein.value).toBe(55);
      expect(totals.protein.low).toBe(49);  // 22 + 27
      expect(totals.protein.high).toBe(61); // 28 + 33
    });

    it('should correctly sum all macros', () => {
      const items = [
        { calories: 300, calories_low: 270, calories_high: 330, protein_g: 20, protein_low: 18, protein_high: 22, carbs_g: 30, carbs_low: 27, carbs_high: 33, fat_g: 10, fat_low: 9, fat_high: 11 },
      ];

      const totals = aggregateItems(items);

      expect(totals.calories.value).toBe(300);
      expect(totals.protein.value).toBe(20);
      expect(totals.carbs.value).toBe(30);
      expect(totals.fat.value).toBe(10);
    });
  });

  describe('Edge cases', () => {
    it('should return zeros for empty array', () => {
      const totals = aggregateItems([]);

      expect(totals.calories.value).toBe(0);
      expect(totals.calories.low).toBe(0);
      expect(totals.calories.high).toBe(0);
      expect(totals.protein.value).toBe(0);
      expect(totals.carbs.value).toBe(0);
      expect(totals.fat.value).toBe(0);
    });

    it('should handle single item', () => {
      const items = [
        { calories: 250, calories_low: 225, calories_high: 275, protein_g: 15, protein_low: 13, protein_high: 17, carbs_g: 20, carbs_low: 18, carbs_high: 22, fat_g: 12, fat_low: 10, fat_high: 14 },
      ];

      const totals = aggregateItems(items);

      expect(totals.calories.value).toBe(250);
      expect(totals.calories.low).toBe(225);
      expect(totals.calories.high).toBe(275);
    });

    it('should handle items with zero values', () => {
      const items = [
        { calories: 100, calories_low: 90, calories_high: 110, protein_g: 0, protein_low: 0, protein_high: 0, carbs_g: 25, carbs_low: 22, carbs_high: 28, fat_g: 0, fat_low: 0, fat_high: 0 },
        { calories: 50, calories_low: 45, calories_high: 55, protein_g: 0, protein_low: 0, protein_high: 0, carbs_g: 12, carbs_low: 10, carbs_high: 14, fat_g: 0, fat_low: 0, fat_high: 0 },
      ];

      const totals = aggregateItems(items);

      expect(totals.calories.value).toBe(150);
      expect(totals.protein.value).toBe(0);
      expect(totals.carbs.value).toBe(37);
      expect(totals.fat.value).toBe(0);
    });

    it('should handle decimal values', () => {
      const items = [
        { calories: 100.5, calories_low: 90.5, calories_high: 110.5, protein_g: 10.2, protein_low: 9.1, protein_high: 11.3, carbs_g: 5.7, carbs_low: 5.1, carbs_high: 6.3, fat_g: 3.3, fat_low: 2.9, fat_high: 3.7 },
        { calories: 200.3, calories_low: 180.2, calories_high: 220.4, protein_g: 20.1, protein_low: 18.0, protein_high: 22.2, carbs_g: 25.5, carbs_low: 23.0, carbs_high: 28.0, fat_g: 8.8, fat_low: 7.9, fat_high: 9.7 },
      ];

      const totals = aggregateItems(items);

      expect(totals.calories.value).toBeCloseTo(300.8, 1);
      expect(totals.protein.value).toBeCloseTo(30.3, 1);
    });
  });

  describe('Range independence', () => {
    it('should sum low bounds independently', () => {
      // Ranges are summed directly, not compounded
      const items = [
        { calories: 100, calories_low: 80, calories_high: 120, protein_g: 10, protein_low: 8, protein_high: 12, carbs_g: 10, carbs_low: 8, carbs_high: 12, fat_g: 5, fat_low: 4, fat_high: 6 },
        { calories: 100, calories_low: 80, calories_high: 120, protein_g: 10, protein_low: 8, protein_high: 12, carbs_g: 10, carbs_low: 8, carbs_high: 12, fat_g: 5, fat_low: 4, fat_high: 6 },
      ];

      const totals = aggregateItems(items);

      // Low bounds: 80 + 80 = 160 (not some compound uncertainty)
      expect(totals.calories.low).toBe(160);
      // High bounds: 120 + 120 = 240
      expect(totals.calories.high).toBe(240);
    });
  });

  describe('Realistic meal scenarios', () => {
    it('should calculate a typical breakfast correctly', () => {
      const breakfast = [
        // 2 eggs
        { calories: 140, calories_low: 126, calories_high: 154, protein_g: 12, protein_low: 10.8, protein_high: 13.2, carbs_g: 1, carbs_low: 0.9, carbs_high: 1.1, fat_g: 10, fat_low: 9, fat_high: 11 },
        // 2 slices toast
        { calories: 150, calories_low: 135, calories_high: 165, protein_g: 5, protein_low: 4.5, protein_high: 5.5, carbs_g: 28, carbs_low: 25.2, carbs_high: 30.8, fat_g: 2, fat_low: 1.8, fat_high: 2.2 },
        // Coffee with milk
        { calories: 30, calories_low: 27, calories_high: 33, protein_g: 1, protein_low: 0.9, protein_high: 1.1, carbs_g: 2, carbs_low: 1.8, carbs_high: 2.2, fat_g: 1.5, fat_low: 1.35, fat_high: 1.65 },
      ];

      const totals = aggregateItems(breakfast);

      expect(totals.calories.value).toBe(320);
      expect(totals.protein.value).toBe(18);
      expect(totals.carbs.value).toBe(31);
      expect(totals.fat.value).toBe(13.5);
    });
  });
});
