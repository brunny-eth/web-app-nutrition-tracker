/**
 * Reference meals for measuring parser accuracy.
 *
 * Shared by the regression test (`known-meals.test.ts`, a pass/fail gate) and the
 * eval harness (`npm run eval`, a scored report) so the two can't drift apart.
 *
 * Reference values are USDA figures or published restaurant numbers where those
 * exist, and a considered midpoint where they don't. A case being off doesn't
 * automatically mean the parser is wrong — an ambiguous description has a wide
 * legitimate range — which is why the harness reports error magnitude rather
 * than just pass/fail.
 */

export type MealMetric = 'calories' | 'protein_g' | 'carbs_g' | 'fat_g';

export interface MealEvalCase {
  name: string;
  input: string;
  expected: Partial<Record<MealMetric, number>>;
  /** Fractional tolerance for the regression gate. Wider for vaguer descriptions. */
  tolerance: number;
  /** Where the reference numbers come from, and any known ambiguity. */
  note?: string;
}

export const MEAL_EVAL_CASES: MealEvalCase[] = [
  {
    name: '1 large egg',
    input: '1 large egg',
    expected: { calories: 72, protein_g: 6.3 },
    tolerance: 0.25,
    note: 'USDA large egg.',
  },
  {
    name: '1 cup cooked white rice',
    input: '1 cup of cooked white rice',
    expected: { calories: 205, carbs_g: 45 },
    tolerance: 0.15,
    note: 'USDA. Unambiguous measure, so a tight gate is fair.',
  },
  {
    name: '1 scoop whey protein',
    input: '1 scoop whey protein with water',
    expected: { calories: 120, protein_g: 25 },
    tolerance: 0.3,
    note: 'Scoop size varies by brand — wide tolerance is intentional.',
  },
  {
    name: '1 medium banana',
    input: '1 medium banana',
    expected: { calories: 105, carbs_g: 27 },
    tolerance: 0.15,
    note: 'USDA medium (118g).',
  },
  {
    name: '6oz grilled chicken breast',
    input: 'chicken breast 6oz grilled',
    expected: { calories: 280, protein_g: 52 },
    tolerance: 0.15,
    note: 'USDA cooked boneless skinless. Weight given, so a tight gate is fair.',
  },
  {
    name: 'rice bowl with ground beef',
    input: 'rice bowl with ground beef (about 4oz) and mixed vegetables',
    expected: { calories: 600, protein_g: 35 },
    tolerance: 0.35,
    note: 'Rice quantity unspecified — genuinely wide range.',
  },
  {
    name: 'Starbucks spinach feta wrap',
    input: 'Starbucks spinach feta egg white wrap',
    expected: { calories: 290, protein_g: 19 },
    tolerance: 0.15,
    note: 'Published Starbucks figures — tests recall of a known menu item.',
  },
  {
    name: 'oatmeal with PB and banana',
    input: '1 cup oatmeal with 2 tbsp peanut butter and half a banana',
    expected: { calories: 490, protein_g: 18 },
    tolerance: 0.3,
    note: '"1 cup oatmeal" is ambiguous: dry (~300 cal) vs cooked (~150 cal). '
      + 'Reference assumes cooked. This is the flakiest case for that reason.',
  },
];

/** Sum a metric across all parsed items — meals may be split into several. */
export function sumMetric(
  items: Array<Record<string, unknown>>,
  metric: MealMetric
): number {
  return items.reduce((sum, item) => sum + (Number(item[metric]) || 0), 0);
}

/** Signed relative error, e.g. -0.12 means the parse came in 12% under reference. */
export function relativeError(actual: number, expected: number): number {
  if (expected === 0) return actual === 0 ? 0 : Infinity;
  return (actual - expected) / expected;
}
