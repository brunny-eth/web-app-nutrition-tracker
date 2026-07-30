/**
 * Daily nutrient totals from a day's food items.
 *
 * Lives here rather than inline in the dashboard so `aggregation.test.ts` can
 * exercise the real summation — it previously tested a copy defined inside the
 * test file, described as "mirrors what the frontend does", which meant the
 * frontend could drift without failing a test.
 */

export interface NutrientTotal {
  value: number;
  low: number;
  high: number;
}

export interface DailyTotals {
  calories: NutrientTotal;
  protein: NutrientTotal;
  carbs: NutrientTotal;
  fat: NutrientTotal;
  saturatedFat: NutrientTotal;
  fiber: NutrientTotal;
  addedSugar: NutrientTotal;
  sodium: NutrientTotal;
  potassium: NutrientTotal;
}

/**
 * An `entry_items` row. Macros are required; the rest are optional because older
 * rows predate those columns.
 */
export interface AggregatableItem {
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
  saturated_fat_g?: number | null;
  saturated_fat_low?: number | null;
  saturated_fat_high?: number | null;
  fiber_g?: number | null;
  fiber_low?: number | null;
  fiber_high?: number | null;
  added_sugar_g?: number | null;
  added_sugar_low?: number | null;
  added_sugar_high?: number | null;
  sodium_mg?: number | null;
  sodium_low?: number | null;
  sodium_high?: number | null;
  potassium_mg?: number | null;
  potassium_low?: number | null;
  potassium_high?: number | null;
}

const zero = (): NutrientTotal => ({ value: 0, low: 0, high: 0 });

/**
 * Bounds are summed directly rather than combined in quadrature. That overstates
 * the daily range — independent errors partly cancel — but it's the conservative
 * reading and matches how each item's range is presented.
 */
export function aggregateItems(items: AggregatableItem[]): DailyTotals {
  const totals: DailyTotals = {
    calories: zero(),
    protein: zero(),
    carbs: zero(),
    fat: zero(),
    saturatedFat: zero(),
    fiber: zero(),
    addedSugar: zero(),
    sodium: zero(),
    potassium: zero(),
  };

  for (const item of items) {
    add(totals.calories, item.calories, item.calories_low, item.calories_high);
    add(totals.protein, item.protein_g, item.protein_low, item.protein_high);
    add(totals.carbs, item.carbs_g, item.carbs_low, item.carbs_high);
    add(totals.fat, item.fat_g, item.fat_low, item.fat_high);
    add(totals.saturatedFat, item.saturated_fat_g, item.saturated_fat_low, item.saturated_fat_high);
    add(totals.fiber, item.fiber_g, item.fiber_low, item.fiber_high);
    add(totals.addedSugar, item.added_sugar_g, item.added_sugar_low, item.added_sugar_high);
    add(totals.sodium, item.sodium_mg, item.sodium_low, item.sodium_high);
    add(totals.potassium, item.potassium_mg, item.potassium_low, item.potassium_high);
  }

  return totals;
}

function add(
  target: NutrientTotal,
  value?: number | null,
  low?: number | null,
  high?: number | null
): void {
  target.value += value ?? 0;
  target.low += low ?? 0;
  target.high += high ?? 0;
}
