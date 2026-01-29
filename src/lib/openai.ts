import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { ParsedMealSchema, type ParsedMeal } from '@/types/nutrition';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a nutrition analysis assistant. Your job is to parse free-form meal descriptions and return structured nutritional data.

RULES:
1. NEVER ask clarifying questions. Make reasonable assumptions and list them.
2. Use midpoint estimates. If unsure, prefer widening the confidence interval over wrong precision.
3. Include oils, sauces, and cooking fats unless explicitly excluded.
4. All numeric estimates must include 90% confidence intervals (low and high bounds).
5. DATE EXTRACTION - Only extract explicit_date when the user is clearly stating WHEN they ate the food:
   - Extract date: "I had pizza yesterday", "ate lunch on Monday", "breakfast Jan 15"
   - Do NOT extract date: "leftover pizza from yesterday", "using chicken from Tuesday", "food from last night"
   - The key distinction: "from [date]" describes food origin/leftovers, not when it was eaten
   - When in doubt, set explicit_date to null (let the system use submission timestamp)
6. For relative dates like "yesterday" or "2 days ago", calculate based on today's date which will be provided.

ESTIMATION GUIDELINES:
- A "serving" or "portion" without size = medium/typical restaurant portion
- "Some" = moderate amount (e.g., 1-2 tbsp for sauces)
- Homemade meals: assume reasonable home cooking amounts
- Restaurant meals: assume typical American restaurant portions (usually larger)
- When portion is ambiguous, use the middle of the reasonable range

NUTRITIONAL DATA:
- Use standard USDA values as baseline
- Adjust for preparation method (fried adds fat, etc.)
- saturated_fat + unsaturated_fat should approximately equal total fat
- Account for cooking oils unless "no oil" or "dry cooked" is specified
- ADDED SUGAR: Only count sugars added during processing/cooking, NOT natural sugars from:
  - Whole fruits (an apple has 0g added sugar)
  - Plain dairy (milk, plain yogurt have 0g added sugar)
  - Vegetables
  Examples: A banana = 0g added sugar. Sweetened yogurt = count the added sweetener only. Soda = all sugar is added. Honey in tea = added sugar.

OUTPUT FORMAT:
- Return a list of food items with their nutritional breakdown
- Each item should be a distinct food (e.g., "grilled chicken breast", "steamed broccoli")
- Combine similar items if they're clearly one dish (e.g., "chicken stir fry with vegetables")
- List assumptions made for transparency`;

/**
 * Parse a meal description using GPT-4o with structured output
 */
export async function parseMealDescription(
  mealText: string,
  todayDate: string // YYYY-MM-DD format, in user's timezone
): Promise<ParsedMeal> {
  const userPrompt = `Today's date is ${todayDate}.

Parse the following meal description and return structured nutritional data:

"${mealText}"`;

  const response = await openai.chat.completions.parse({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: zodResponseFormat(ParsedMealSchema, 'parsed_meal'),
    temperature: 0.3, // Lower temperature for more consistent estimates
  });

  const parsed = response.choices[0].message.parsed;
  
  if (!parsed) {
    throw new Error('Failed to parse meal description');
  }

  return parsed;
}

/**
 * Validate that the response has reasonable values
 */
export function validateParsedMeal(meal: ParsedMeal): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const item of meal.items) {
    // Check that low <= value <= high for all ranges
    if (item.calories_low > item.calories || item.calories > item.calories_high) {
      errors.push(`${item.food_name}: calories range invalid`);
    }
    if (item.protein_low > item.protein_g || item.protein_g > item.protein_high) {
      errors.push(`${item.food_name}: protein range invalid`);
    }
    if (item.carbs_low > item.carbs_g || item.carbs_g > item.carbs_high) {
      errors.push(`${item.food_name}: carbs range invalid`);
    }
    if (item.fat_low > item.fat_g || item.fat_g > item.fat_high) {
      errors.push(`${item.food_name}: fat range invalid`);
    }

    // Check that saturated + unsaturated ≈ total fat (within 20% tolerance)
    const fatSum = item.saturated_fat_g + item.unsaturated_fat_g;
    const fatDiff = Math.abs(fatSum - item.fat_g);
    if (fatDiff > item.fat_g * 0.2 && item.fat_g > 1) {
      errors.push(`${item.food_name}: fat breakdown doesn't match total (${fatSum.toFixed(1)} vs ${item.fat_g.toFixed(1)})`);
    }

    // Check for negative values
    const numericFields = [
      'calories', 'protein_g', 'carbs_g', 'fat_g', 
      'saturated_fat_g', 'unsaturated_fat_g', 'fiber_g', 'sodium_mg', 'added_sugar_g'
    ] as const;
    
    for (const field of numericFields) {
      if (item[field] < 0) {
        errors.push(`${item.food_name}: ${field} is negative`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
