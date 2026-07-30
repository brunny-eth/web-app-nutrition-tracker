/**
 * Saturated fat is judged as a share of calories rather than an absolute amount,
 * so the limit moves with the day's calorie goal.
 */
export const DEFAULT_SATURATED_FAT_PERCENT = 10;

const CALORIES_PER_FAT_GRAM = 9;

/**
 * Grams of saturated fat allowed at a given calorie level — the actionable daily
 * budget. Uses the day's calorie *goal*: a limit based on what you've eaten so far
 * can't be known until the day is over, and would grow every time you overate.
 */
export function saturatedFatLimitGrams(
  calories: number,
  percent: number = DEFAULT_SATURATED_FAT_PERCENT
): number {
  return Math.round((calories * (percent / 100)) / CALORIES_PER_FAT_GRAM);
}

/**
 * Share of consumed calories that came from saturated fat. Scores a finished day,
 * where the denominator is settled. Null when nothing was logged.
 */
export function saturatedFatPercentOfCalories(
  saturatedFatG: number,
  calories: number
): number | null {
  if (calories <= 0) return null;
  return ((saturatedFatG * CALORIES_PER_FAT_GRAM) / calories) * 100;
}
