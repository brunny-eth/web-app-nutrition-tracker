import type { ParsedMeal, FoodItem } from '@/types/nutrition';

/** Each nutrient's value field paired with its low/high bounds. */
const RANGE_FIELDS = [
  ['calories', 'calories_low', 'calories_high'],
  ['protein_g', 'protein_low', 'protein_high'],
  ['carbs_g', 'carbs_low', 'carbs_high'],
  ['fat_g', 'fat_low', 'fat_high'],
  ['saturated_fat_g', 'saturated_fat_low', 'saturated_fat_high'],
  ['fiber_g', 'fiber_low', 'fiber_high'],
  ['sodium_mg', 'sodium_low', 'sodium_high'],
  ['added_sugar_g', 'added_sugar_low', 'added_sugar_high'],
  ['potassium_mg', 'potassium_low', 'potassium_high'],
] as const satisfies ReadonlyArray<readonly [keyof FoodItem, keyof FoodItem, keyof FoodItem]>;

/**
 * Clamp negatives to zero and force low <= value <= high.
 *
 * The schema can't express these (strict mode rejects numeric constraints), so a
 * model slip would otherwise render as "5g fiber (18–22)" in the UI. This replaces
 * an earlier validator that only collected warnings — which were logged and
 * returned but never read by anything, so bad ranges reached the database intact.
 */
export function repairParsedMeal(meal: ParsedMeal): { meal: ParsedMeal; repairs: string[] } {
  const repairs: string[] = [];

  const items = meal.items.map((item) => {
    const fixed = { ...item } as FoodItem & Record<string, number>;

    for (const [valueKey, lowKey, highKey] of RANGE_FIELDS) {
      for (const key of [valueKey, lowKey, highKey]) {
        if (fixed[key] < 0) {
          repairs.push(`${item.food_name}: ${key} was negative (${fixed[key]})`);
          fixed[key] = 0;
        }
      }
      if (fixed[lowKey] > fixed[valueKey]) {
        repairs.push(`${item.food_name}: ${lowKey} above the estimate`);
        fixed[lowKey] = fixed[valueKey];
      }
      if (fixed[highKey] < fixed[valueKey]) {
        repairs.push(`${item.food_name}: ${highKey} below the estimate`);
        fixed[highKey] = fixed[valueKey];
      }
    }

    if (fixed.saturated_fat_g > fixed.fat_g) {
      repairs.push(`${item.food_name}: saturated fat exceeded total fat`);
      fixed.saturated_fat_g = fixed.fat_g;
    }

    return fixed as FoodItem;
  });

  return { meal: { ...meal, items }, repairs };
}

