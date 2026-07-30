/**
 * Scaling a stored batch into a logged portion.
 *
 * This is the whole point of batches: the numbers are parsed once and every portion
 * afterwards is arithmetic, so eating the same 2 cups on Monday and Thursday gives
 * byte-identical nutrition. No model call, no drift.
 */

/** Every numeric nutrition column on batch_items / entry_items, value and bounds. */
const SCALED_FIELDS = [
  'grams', 'grams_low', 'grams_high',
  'calories', 'calories_low', 'calories_high',
  'protein_g', 'protein_low', 'protein_high',
  'carbs_g', 'carbs_low', 'carbs_high',
  'fat_g', 'fat_low', 'fat_high',
  'saturated_fat_g', 'saturated_fat_low', 'saturated_fat_high',
  'fiber_g', 'fiber_low', 'fiber_high',
  'sodium_mg', 'sodium_low', 'sodium_high',
  'added_sugar_g', 'added_sugar_low', 'added_sugar_high',
  'potassium_mg', 'potassium_low', 'potassium_high',
] as const;

export type BatchItemRow = Record<string, unknown> & {
  food_name: string;
  assumptions?: unknown;
};

/**
 * Turn batch items into entry_items rows for `entryId`, scaled by `fraction`.
 *
 * Supabase returns DECIMAL columns as strings in some driver versions, so every
 * value goes through Number() rather than being trusted as numeric.
 */
export function scaleBatchItems(
  items: BatchItemRow[],
  fraction: number,
  entryId: string
): Array<Record<string, unknown>> {
  return items.map((item) => {
    const row: Record<string, unknown> = {
      entry_id: entryId,
      food_name: item.food_name,
      assumptions: item.assumptions ?? [],
    };

    for (const field of SCALED_FIELDS) {
      const raw = item[field];
      if (raw === null || raw === undefined) {
        // grams is the only nullable one; keep it null rather than turning it into 0.
        row[field] = null;
        continue;
      }
      row[field] = round2(Number(raw) * fraction);
    }

    // Derived on write, same as the meal path — the columns are NOT NULL.
    const fat = Number(row.fat_g) || 0;
    const sat = Number(row.saturated_fat_g) || 0;
    const fatLow = Number(row.fat_low) || 0;
    const fatHigh = Number(row.fat_high) || 0;
    const satLow = Number(row.saturated_fat_low) || 0;
    const satHigh = Number(row.saturated_fat_high) || 0;
    row.unsaturated_fat_g = round2(Math.max(0, fat - sat));
    row.unsaturated_fat_low = round2(Math.max(0, fatLow - satHigh));
    row.unsaturated_fat_high = round2(Math.max(0, fatHigh - satLow));

    return row;
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
