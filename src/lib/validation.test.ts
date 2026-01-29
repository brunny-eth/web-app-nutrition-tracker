import { describe, it, expect } from 'vitest';

/**
 * Validation rules for nutrition values
 */
function validateNutritionUpdate(values: {
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  grams?: number | null;
}): { valid: boolean; error?: string } {
  if (values.calories !== undefined) {
    if (values.calories < 0) {
      return { valid: false, error: 'Calories cannot be negative' };
    }
    if (values.calories < 5) {
      return { valid: false, error: 'Calories must be at least 5' };
    }
  }

  if (values.protein_g !== undefined && values.protein_g < 0) {
    return { valid: false, error: 'Protein cannot be negative' };
  }

  if (values.carbs_g !== undefined && values.carbs_g < 0) {
    return { valid: false, error: 'Carbs cannot be negative' };
  }

  if (values.fat_g !== undefined && values.fat_g < 0) {
    return { valid: false, error: 'Fat cannot be negative' };
  }

  if (values.grams !== undefined && values.grams !== null && values.grams < 0) {
    return { valid: false, error: 'Grams cannot be negative' };
  }

  return { valid: true };
}

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
