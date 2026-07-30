/**
 * Validation rules for manual nutrition overrides.
 *
 * Lives here rather than inline in the PATCH route so `validation.test.ts` can
 * exercise the real rules — it previously tested a copy defined inside the test
 * file, which meant a change to the route's own checks couldn't fail a test.
 */

export interface NutritionUpdate {
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  saturated_fat_g?: number;
  fiber_g?: number;
  added_sugar_g?: number;
  sodium_mg?: number;
  potassium_mg?: number;
  grams?: number | null;
}

/** Human-facing label per field, used in the error message. */
const NON_NEGATIVE_FIELDS: Array<[keyof NutritionUpdate, string]> = [
  ['protein_g', 'Protein'],
  ['carbs_g', 'Carbs'],
  ['fat_g', 'Fat'],
  ['saturated_fat_g', 'Saturated fat'],
  ['fiber_g', 'Fiber'],
  ['added_sugar_g', 'Sugar'],
  ['sodium_mg', 'Sodium'],
  ['potassium_mg', 'Potassium'],
  ['grams', 'Grams'],
];

export function validateNutritionUpdate(
  values: NutritionUpdate
): { valid: boolean; error?: string } {
  if (values.calories !== undefined) {
    if (values.calories < 0) {
      return { valid: false, error: 'Calories cannot be negative' };
    }
    // Guards against an accidental 0 wiping an item out. A genuinely zero-calorie
    // item (black coffee, diet soda) can't be represented — delete it instead.
    if (values.calories < 5) {
      return { valid: false, error: 'Calories must be at least 5' };
    }
  }

  for (const [field, label] of NON_NEGATIVE_FIELDS) {
    const value = values[field];
    if (value !== undefined && value !== null && value < 0) {
      return { valid: false, error: `${label} cannot be negative` };
    }
  }

  return { valid: true };
}
