import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { ParsedMealSchema, type ParsedMeal, ActivityEstimateSchema, type ActivityEstimate } from '@/types/nutrition';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Overridable so the eval harness can sweep models without editing source.
 * Sonnet 5 is the same price tier as the Sonnet 4.6 this replaced.
 */
export const MEAL_MODEL = process.env.MEAL_PARSER_MODEL ?? 'claude-sonnet-5';

/**
 * Sonnet 5 runs adaptive thinking when `thinking` is omitted, where Sonnet 4.6 ran
 * without it. Left implicit, that would spend part of max_tokens on thinking and
 * slow every food log down. Off by default to keep parsing fast; overridable so
 * `npm run eval -- --thinking=adaptive` can measure whether it buys any accuracy.
 */
const THINKING =
  process.env.MEAL_PARSER_THINKING === 'adaptive'
    ? ({ type: 'adaptive' } as const)
    : ({ type: 'disabled' } as const);

const SYSTEM_PROMPT = `You are a nutrition analysis assistant. Your job is to parse meal descriptions (text and/or images) and return structured nutritional data.

RULES:
1. NEVER ask clarifying questions. Make reasonable assumptions and list them.
2. Use your best midpoint estimate. Be confident - the user will provide specific details if possible.
3. Include reasonable amounts of oils, sauces, and cooking fats as appropriate to the meal unless explicitly excluded or mentioned in the description.
4. Provide tight confidence intervals: for example, low = estimate × 0.9, high = estimate × 1.1 (±10% bounds). Be more precise if the user provides enough details to be more confident.
5. Only widen beyond ±10% if the description is genuinely vague (e.g., "some rice" vs "1 cup rice").
6. DATE EXTRACTION - Only extract explicit_date when the user is clearly stating WHEN they ate the food:
   - Extract date: "I had pizza yesterday", "ate lunch on Monday", "breakfast Jan 15"
   - Do NOT extract date: "leftover pizza from yesterday", "using chicken from Tuesday", "food from last night"
   - The key distinction: "from [date]" describes food origin/leftovers, not when it was eaten
   - When in doubt, set explicit_date to null (let the system use submission timestamp)
7. For relative dates like "yesterday" or "2 days ago", calculate based on today's date which will be provided.

ESTIMATION GUIDELINES:
- A "serving" or "portion" without size = medium/typical restaurant portion
- "Some" = moderate amount (e.g., 1-2 tbsp for sauces)
- Homemade meals: assume reasonable home cooking amounts
- Restaurant meals: assume typical American restaurant portions
- When user provides specific amounts (oz, cups, grams, pieces), use those precisely with tight ±10% bounds
- Only use wider bounds (±15-20%) when description is vague like "a bowl of" or "some"

NUTRITIONAL DATA:
- Use standard USDA values as baseline
- Adjust for preparation method (fried adds fat, etc.)
- saturated_fat + unsaturated_fat should approximately equal total fat
- Account for cooking oils or butter as appropriate to the meal unless "no oil" or "dry cooked" is specified
- ADDED SUGAR: Only count sugars added during processing/cooking, NOT natural sugars from:
  - Whole fruits (an apple has 0g added sugar)
  - Plain dairy (milk, plain yogurt have 0g added sugar)
  - Vegetables
  Examples: A banana = 0g added sugar. Sweetened yogurt = count the added sweetener only. Soda = all sugar is added. Honey in tea = added sugar.
- POTASSIUM: Include potassium content in mg. Good sources include bananas (~400mg), potatoes (~900mg), spinach, avocados, beans.

IMAGE HANDLING:
- If an image is attached, analyze it for nutritional information
- VALID images: nutrition facts labels, menus with nutritional info, food packaging
- INVALID images: photos of actual food/meals (we cannot estimate nutrition from food photos)
- If image shows actual food (not a label), add to assumptions: "ERROR: Cannot analyze photos of food. Please photograph nutrition labels or menus instead."
- For valid images: extract the nutrition facts shown and apply any quantity mentioned in the text (e.g., "2 bags" = multiply by 2)
- Combine image data with any other foods mentioned in the text

OUTPUT FORMAT:
- Return a list of ALL food items (from both text AND image)
- Each item should be a distinct food (e.g., "grilled chicken breast", "steamed broccoli")
- Combine similar items if they're clearly one dish (e.g., "chicken stir fry with vegetables")
- List assumptions made for transparency

EXAMPLES:

Example 1 - Simple item with specific quantity (tight ±10% bounds):
Input: "2 scrambled eggs"
Output: 1 item - "scrambled eggs" (2 large eggs)
  calories: 180, protein: 12.6g, carbs: 1.2g, fat: 13.2g, sat_fat: 4.2g, fiber: 0g, sodium: 140mg, added_sugar: 0g, potassium: 140mg
  Assumptions: 2 large eggs, scrambled with minimal fat, no added cheese or milk.

Example 2 - Multi-item homemade meal (separate items, tight bounds):
Input: "Grilled chicken with rice and steamed broccoli"
Output: 3 items
  1. "grilled chicken breast" (6 oz cooked): 280 cal, 52g protein, 0g carbs, 6g fat, 1.6g sat_fat, 0g fiber, 120mg sodium, 0g added_sugar, 700mg potassium
     Assumptions: Boneless skinless breast, light seasoning, no heavy sauce.
  2. "cooked white rice" (1 cup): 205 cal, 4.3g protein, 44.5g carbs, 0.4g fat, 0.1g sat_fat, 0.6g fiber, 0mg sodium, 0g added_sugar, 55mg potassium
     Assumptions: Plain white rice, no butter/oil.
  3. "steamed broccoli" (1 cup): 55 cal, 3.7g protein, 11.2g carbs, 0.6g fat, 0.1g sat_fat, 5.1g fiber, 60mg sodium, 0g added_sugar, 460mg potassium
     Assumptions: Plain steamed, no butter/oil.

Example 3 - Vague description (wider ±20% bounds):
Input: "A bowl of pasta with meat sauce"
Output: 1 item - "pasta with meat sauce" (~2 cups pasta + 3/4 cup sauce)
  calories: 720 (576-864), protein: 32g (25.6-38.4), carbs: 95g (76-114), fat: 24g (19.2-28.8), sat_fat: 8g, fiber: 6g, sodium: 1050mg, added_sugar: 3g, potassium: 700mg
  Assumptions: Description vague - used ±20% bounds. Medium bowl = ~2 cups pasta + typical meat/tomato sauce. Beef-based with typical oil/salt. Added sugar from tomato sauce.

Example 4 - Restaurant meal (known portions, tight bounds):
Input: "Chipotle burrito bowl with chicken, rice, black beans, cheese, and salsa"
Output: 1 item - "Chipotle-style burrito bowl"
  calories: 760, protein: 48g, carbs: 82g, fat: 26g, sat_fat: 9.5g, fiber: 14g, sodium: 1650mg, added_sugar: 2g, potassium: 1100mg
  Assumptions: Standard fast-casual portions (1 scoop each). No guac, sour cream, or tortilla. High sodium from seasoned ingredients.

Example 5 - Added sugar vs natural sugar distinction:
Input: "Greek yogurt with honey and banana"
Output: 3 items
  1. "nonfat plain Greek yogurt" (1 cup): 130 cal, 23g protein, 9g carbs, 0.7g fat, 0.2g sat_fat, 0g fiber, 85mg sodium, 0g added_sugar, 300mg potassium
     Assumptions: Plain unsweetened. Lactose counted as carbs, not added sugar.
  2. "honey" (1 tbsp): 64 cal, 0g protein, 17g carbs, 0g fat, 0g sat_fat, 0g fiber, 1mg sodium, 17g added_sugar, 10mg potassium
     Assumptions: Honey is fully counted as added sugar.
  3. "banana" (1 medium): 105 cal, 1.3g protein, 27g carbs, 0.4g fat, 0.1g sat_fat, 3.1g fiber, 1mg sodium, 0g added_sugar, 420mg potassium
     Assumptions: Banana sugars are natural - added_sugar = 0.`;

export async function parseMealDescription(
  mealText: string,
  todayDate: string, // YYYY-MM-DD format, in user's timezone
  imageBase64?: string // Optional base64 image data
): Promise<ParsedMeal> {
  const userContent: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [];

  // Add image if provided
  if (imageBase64) {
    // imageBase64 arrives as a data URL: "data:image/jpeg;base64,..."
    const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: match[2],
        },
      });
    }
  }

  // Build text prompt
  let textPrompt = `Today's date is ${todayDate}.\n\n`;

  if (imageBase64 && mealText && mealText !== '1 serving') {
    textPrompt += `Parse this meal. The image shows a nutrition label/menu. The user's description is: "${mealText}"\n\nExtract nutrition from the image AND parse any other foods mentioned in the text.`;
  } else if (imageBase64) {
    textPrompt += `Extract nutritional data from this image. Assume 1 serving unless otherwise indicated.`;
  } else {
    textPrompt += `Parse the following meal description and return structured nutritional data:\n\n"${mealText}"`;
  }

  userContent.push({ type: 'text', text: textPrompt });

  const response = await client.messages.create({
    model: MEAL_MODEL,
    max_tokens: 8192,
    thinking: THINKING,
    system: [{
      type: 'text',
      text: SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{ role: 'user', content: userContent }],
    tools: [{
      name: 'parse_meal',
      description: 'Parse meal description and return structured nutritional data',
      // ParsedMealSchema already emits additionalProperties:false, every property
      // required, and no numeric constraints — so it satisfies strict mode as-is.
      strict: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input_schema: z.toJSONSchema(ParsedMealSchema) as any,
    }],
    tool_choice: { type: 'tool', name: 'parse_meal' },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  );

  if (!toolUse) {
    throw new Error('Failed to parse meal description');
  }

  const parsed = ParsedMealSchema.parse(toolUse.input);

  // Check for image validation error in assumptions
  for (const item of parsed.items) {
    if (item.assumptions?.some(a => a.includes('ERROR:'))) {
      const errorMsg = item.assumptions.find(a => a.includes('ERROR:'));
      throw new Error(errorMsg?.replace('ERROR: ', '') || 'Image validation failed');
    }
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
      'saturated_fat_g', 'unsaturated_fat_g', 'fiber_g', 'sodium_mg', 'added_sugar_g', 'potassium_mg'
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

const ACTIVITY_SYSTEM_PROMPT = `You are an activity level estimation assistant. Your job is to estimate a Harris-Benedict activity multiplier from a natural language description of someone's daily activity.

THE HARRIS-BENEDICT ACTIVITY MULTIPLIER SCALE:
- 1.2: Sedentary (desk job, no exercise, minimal movement)
- 1.375: Lightly active (light exercise 1-3 days/week, walking, light housework)
- 1.55: Moderately active (moderate exercise 3-5 days/week)
- 1.725: Very active (hard exercise 6-7 days/week, physical job)
- 1.9: Extra active (very hard exercise, physical job + training)
- Up to 2.2: Professional athlete level

RULES:
1. Return a multiplier on the 1.1–2.2 scale based on the described activities.
2. You can return any value in that range — you are NOT limited to the 5 standard levels. For example, someone who did a 30-min jog but otherwise sat at a desk might be 1.45.
3. Provide a 90% confidence interval (multiplier_low, multiplier_high). Narrow intervals for specific descriptions, wider for vague ones.
4. The summary should be 1 sentence describing the estimated activity level.
5. Consider both exercise AND baseline daily activity (desk job vs. retail worker vs. construction).
6. A single workout doesn't make someone "very active" — the whole day matters.

EXAMPLES:
- "Rest day, worked from home" → multiplier: 1.2, range: 1.15–1.25
- "30 min jog, otherwise desk work" → multiplier: 1.45, range: 1.38–1.52
- "1 hour weight training, walked to work (20 min each way)" → multiplier: 1.6, range: 1.52–1.68
- "On my feet all day at work, plus 45 min gym session" → multiplier: 1.75, range: 1.65–1.85
- "2 hour soccer game, active job" → multiplier: 1.9, range: 1.8–2.0`;

export async function estimateActivityMultiplier(description: string): Promise<ActivityEstimate> {
  const response = await client.messages.create({
    model: MEAL_MODEL,
    max_tokens: 1024,
    thinking: THINKING,
    system: ACTIVITY_SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: `Estimate the activity multiplier for this day:\n\n"${description}"` },
    ],
    tools: [{
      name: 'estimate_activity',
      description: 'Estimate Harris-Benedict activity multiplier from activity description',
      strict: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input_schema: z.toJSONSchema(ActivityEstimateSchema) as any,
    }],
    tool_choice: { type: 'tool', name: 'estimate_activity' },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  );

  if (!toolUse) {
    throw new Error('Failed to estimate activity multiplier');
  }

  return ActivityEstimateSchema.parse(toolUse.input);
}
