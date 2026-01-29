import { z } from 'zod';

// Schema for a single food item with 90% confidence ranges
export const FoodItemSchema = z.object({
  food_name: z.string().describe('Name of the food item'),
  grams: z.number().nullable().describe('Estimated weight in grams'),
  grams_low: z.number().nullable().describe('Low estimate (90% CI)'),
  grams_high: z.number().nullable().describe('High estimate (90% CI)'),
  calories: z.number().describe('Estimated calories'),
  calories_low: z.number().describe('Low estimate (90% CI)'),
  calories_high: z.number().describe('High estimate (90% CI)'),
  protein_g: z.number().describe('Protein in grams'),
  protein_low: z.number().describe('Low estimate (90% CI)'),
  protein_high: z.number().describe('High estimate (90% CI)'),
  carbs_g: z.number().describe('Carbohydrates in grams'),
  carbs_low: z.number().describe('Low estimate (90% CI)'),
  carbs_high: z.number().describe('High estimate (90% CI)'),
  fat_g: z.number().describe('Total fat in grams'),
  fat_low: z.number().describe('Low estimate (90% CI)'),
  fat_high: z.number().describe('High estimate (90% CI)'),
  saturated_fat_g: z.number().describe('Saturated fat in grams'),
  saturated_fat_low: z.number().describe('Low estimate (90% CI)'),
  saturated_fat_high: z.number().describe('High estimate (90% CI)'),
  unsaturated_fat_g: z.number().describe('Unsaturated fat in grams'),
  unsaturated_fat_low: z.number().describe('Low estimate (90% CI)'),
  unsaturated_fat_high: z.number().describe('High estimate (90% CI)'),
  fiber_g: z.number().describe('Fiber in grams'),
  fiber_low: z.number().describe('Low estimate (90% CI)'),
  fiber_high: z.number().describe('High estimate (90% CI)'),
  sodium_mg: z.number().describe('Sodium in milligrams'),
  sodium_low: z.number().describe('Low estimate (90% CI)'),
  sodium_high: z.number().describe('High estimate (90% CI)'),
  added_sugar_g: z.number().describe('Added sugar in grams (excludes natural sugars from whole fruits/dairy)'),
  added_sugar_low: z.number().describe('Low estimate (90% CI)'),
  added_sugar_high: z.number().describe('High estimate (90% CI)'),
  assumptions: z.array(z.string()).describe('List of assumptions made (e.g., "assumed olive oil for cooking", "medium sized portion")'),
});

export type FoodItem = z.infer<typeof FoodItemSchema>;

// Schema for the full LLM response
export const ParsedMealSchema = z.object({
  items: z.array(FoodItemSchema).describe('List of parsed food items'),
  explicit_date: z.string().nullable().describe('If user specified a date in the text, return it as YYYY-MM-DD. Otherwise null.'),
});

export type ParsedMeal = z.infer<typeof ParsedMealSchema>;

// TDEE calculation types
export interface TDEECalculation {
  bmr: number;
  bmr_low: number;
  bmr_high: number;
  tdee: number;
  tdee_low: number;
  tdee_high: number;
  target_calories: number;
  target_calories_low: number;
  target_calories_high: number;
  protein_target_g: number;
}

// Activity level for UI
export interface ActivityLevelOption {
  id: number;
  label: string;
  description: string;
  multiplier: number;
  multiplier_low: number;
  multiplier_high: number;
}

// Daily summary for UI
export interface DailySummary {
  date: string;
  activity_level: ActivityLevelOption | null;
  tdee: TDEECalculation | null;
  totals: {
    calories: { value: number; low: number; high: number };
    protein: { value: number; low: number; high: number };
    carbs: { value: number; low: number; high: number };
    fat: { value: number; low: number; high: number };
    saturated_fat: { value: number; low: number; high: number };
    unsaturated_fat: { value: number; low: number; high: number };
    fiber: { value: number; low: number; high: number };
    sodium: { value: number; low: number; high: number };
    added_sugar: { value: number; low: number; high: number };
  };
  entries: EntryWithItems[];
}

export interface EntryWithItems {
  id: string;
  raw_text: string;
  created_at: string;
  resolved_date: string;
  items: FoodItem[];
}
