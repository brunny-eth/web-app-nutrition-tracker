import { describe, it, expect } from 'vitest';
import { validateNutritionUpdate } from './validation';

describe('Validation', () => {
  describe('Calories validation', () => {
    it('should reject negative calories', () => {
      const result = validateNutritionUpdate({ calories: -50 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('negative');
    });

    it('should reject zero calories', () => {
      const result = validateNutritionUpdate({ calories: 0 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 5');
    });

    it('should reject calories below 5', () => {
      const result = validateNutritionUpdate({ calories: 3 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 5');
    });

    it('should accept calories of 5', () => {
      const result = validateNutritionUpdate({ calories: 5 });
      expect(result.valid).toBe(true);
    });

    it('should accept normal calories', () => {
      const result = validateNutritionUpdate({ calories: 250 });
      expect(result.valid).toBe(true);
    });
  });

  describe('Protein validation', () => {
    it('should reject negative protein', () => {
      const result = validateNutritionUpdate({ protein_g: -10 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Protein');
    });

    it('should accept zero protein', () => {
      const result = validateNutritionUpdate({ protein_g: 0 });
      expect(result.valid).toBe(true);
    });

    it('should accept normal protein', () => {
      const result = validateNutritionUpdate({ protein_g: 25 });
      expect(result.valid).toBe(true);
    });
  });

  describe('Carbs validation', () => {
    it('should reject negative carbs', () => {
      const result = validateNutritionUpdate({ carbs_g: -5 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Carbs');
    });

    it('should accept zero carbs', () => {
      const result = validateNutritionUpdate({ carbs_g: 0 });
      expect(result.valid).toBe(true);
    });
  });

  describe('Fat validation', () => {
    it('should reject negative fat', () => {
      const result = validateNutritionUpdate({ fat_g: -2 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Fat');
    });

    it('should accept zero fat', () => {
      const result = validateNutritionUpdate({ fat_g: 0 });
      expect(result.valid).toBe(true);
    });
  });

  describe('Grams validation', () => {
    it('should reject negative grams', () => {
      const result = validateNutritionUpdate({ grams: -100 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Grams');
    });

    it('should accept null grams', () => {
      const result = validateNutritionUpdate({ grams: null });
      expect(result.valid).toBe(true);
    });

    it('should accept zero grams', () => {
      const result = validateNutritionUpdate({ grams: 0 });
      expect(result.valid).toBe(true);
    });
  });

  describe('Combined validation', () => {
    it('should accept valid complete update', () => {
      const result = validateNutritionUpdate({
        calories: 300,
        protein_g: 25,
        carbs_g: 30,
        fat_g: 10,
        grams: 200,
      });
      expect(result.valid).toBe(true);
    });

    it('should reject if any field is invalid', () => {
      const result = validateNutritionUpdate({
        calories: 300,
        protein_g: -5, // Invalid
        carbs_g: 30,
        fat_g: 10,
      });
      expect(result.valid).toBe(false);
    });

    it('should accept partial updates with valid values', () => {
      const result = validateNutritionUpdate({
        calories: 150,
      });
      expect(result.valid).toBe(true);
    });
  });
});

describe('Nutrients the edit route actually passes', () => {
  // The cases above cover grams, which the PATCH route never sends, while the five
  // fields it does send were untested.
  const fields = [
    ['saturated_fat_g', 'Saturated fat'],
    ['fiber_g', 'Fiber'],
    ['added_sugar_g', 'Sugar'],
    ['sodium_mg', 'Sodium'],
    ['potassium_mg', 'Potassium'],
  ] as const;

  for (const [field, label] of fields) {
    it(`rejects negative ${field}`, () => {
      const result = validateNutritionUpdate({ [field]: -1 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe(`${label} cannot be negative`);
    });

    it(`accepts zero ${field}`, () => {
      expect(validateNutritionUpdate({ [field]: 0 }).valid).toBe(true);
    });
  }
});
