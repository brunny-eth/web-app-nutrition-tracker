import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  ParsedMealSchema,
  type ParsedMeal,
  ActivityEstimateSchema,
  type ActivityEstimate,
  type FoodItem,
  ParsedSavedMealSchema,
  type ParsedSavedMeal,
  IMAGE_ONLY_TEXT,
} from '@/types/nutrition';

/**
 * The input can't be turned into nutrition data — a photo of a plate with nothing
 * written to go with it, or a description with no recognizable food. The user's
 * problem to fix, so
 * callers should surface the message and return 400 rather than 500.
 */
export class MealRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MealRejectedError';
  }
}

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
- saturated_fat must never exceed total fat
- Account for cooking oils or butter as appropriate to the meal unless "no oil" or "dry cooked" is specified
- ADDED SUGAR: Only count sugars added during processing/cooking, NOT natural sugars from:
  - Whole fruits (an apple has 0g added sugar)
  - Plain dairy (milk, plain yogurt have 0g added sugar)
  - Vegetables
  Examples: A banana = 0g added sugar. Sweetened yogurt = count the added sweetener only. Soda = all sugar is added. Honey in tea = added sugar.
- POTASSIUM: Include potassium content in mg. Good sources include bananas (~400mg), potatoes (~900mg), spinach, avocados, beans.

IMAGE HANDLING:
Every attached image is one of two kinds. Decide which before anything else.

(a) NUTRITION SOURCE - a nutrition facts label, a menu with nutrition info, food packaging, or a screenshot of nutrition stats from an app or tracker. These carry the numbers themselves, so they stand alone and need NO description from the user. Read the values off the image and apply any quantity mentioned in the text (e.g., "2 bags" = multiply by 2).

(b) FOOD PHOTO - a picture of actual food: a plate, a bowl, a takeout container, a partly eaten meal. A photo cannot be measured on its own, but it is a strong SUPPLEMENT to a written description. Use it to confirm what is on the plate, judge portion size against the plate/utensils/hands, catch ingredients or sauces the description left out, and read the preparation (fried vs grilled, dressing on the salad, visible oil).

- A FOOD PHOTO REQUIRES CONTEXT. If a food photo arrives with no description, or with a description that is only a quantity ("1 serving", "2 servings", "half portion"), return an empty items list and set rejection_reason to exactly: "For accuracy, please provide some context beyond just an image to continue processing this meal."
- Anything the user writes ABOUT THE FOOD counts as context, even if brief - "chicken burrito bowl from Chipotle", "homemade, about 2 cups", "leftover lasagna". Only an empty description or a bare quantity fails. Do not reject for thin context; reject only for absent context.
- A NUTRITION SOURCE never needs context. Never return the rejection above for a label, menu, or stats screenshot.
- When a food photo has context, the TEXT LEADS and the photo refines it. Where they disagree on quantity or ingredients, trust the text - the user knows what they ate. Note in the assumptions what the photo contributed.
- Estimates that lean on a food photo rather than stated amounts get at least ±15% bounds, even when the photo looks clear. Tighten to ±10% only where the text gives explicit amounts.
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
     Assumptions: Banana sugars are natural - added_sugar = 0.

Example 6 - Food photo used as a supplement to the description (±15% bounds):
Input: photo of a plate + "chicken thighs and roasted potatoes I made tonight"
Output: 2 items
  1. "roasted chicken thighs" (2 thighs, ~7 oz cooked): 440 cal (374-506), 44g protein, 0g carbs, 29g fat, 8g sat_fat, 0g fiber, 480mg sodium, 0g added_sugar, 520mg potassium
     Assumptions: Photo shows two bone-in, skin-on thighs, skin browned and eaten. Sized against the dinner plate. Photo-assisted so ±15%.
  2. "roasted potatoes" (~1.5 cups): 250 cal (213-288), 5g protein, 42g carbs, 8g fat, 1.2g sat_fat, 4g fiber, 300mg sodium, 0g added_sugar, 950mg potassium
     Assumptions: Photo shows visible oil sheen and herbs - counted ~2 tsp oil. Volume judged against the plate.

Example 7 - Food photo with no context:
Input: photo of a burrito, no description (or only "1 serving")
Output: 0 items, rejection_reason: "For accuracy, please provide some context beyond just an image to continue processing this meal."`;

/** Turn a `data:image/jpeg;base64,...` URL into an image block, or null if malformed. */
function toImageBlock(dataUrl: string): Anthropic.ImageBlockParam | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
      data: match[2],
    },
  };
}

export async function parseMealDescription(
  mealText: string,
  todayDate: string, // YYYY-MM-DD format, in user's timezone
  imageBase64?: string // Optional base64 image data
): Promise<ParsedMeal> {
  const userContent: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [];

  if (imageBase64) {
    const block = toImageBlock(imageBase64);
    if (block) userContent.push(block);
  }

  // Build text prompt
  let textPrompt = `Today's date is ${todayDate}.\n\n`;

  if (imageBase64 && mealText && mealText !== IMAGE_ONLY_TEXT) {
    // Deliberately doesn't claim what the image is — it may be a label, or it may be
    // a photo of the plate that only supplements the description.
    textPrompt += `Parse this meal. An image is attached. The user's description is: "${mealText}"\n\nIf the image is a nutrition label, menu, or stats screenshot, take the numbers from it. If it is a photo of the food itself, use it to refine the description — portion size, ingredients, preparation — with the text taking priority. Parse any other foods mentioned in the text too.`;
  } else if (imageBase64) {
    textPrompt += `Extract nutritional data from this image. The user gave no description of the food. If it is a nutrition label, menu, or stats screenshot, read it and assume 1 serving unless otherwise indicated. If it is a photo of actual food, reject it per the IMAGE HANDLING rules.`;
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

  if (parsed.rejection_reason) {
    throw new MealRejectedError(parsed.rejection_reason);
  }

  // An empty list used to sail through and create an entry with no items, which
  // then counted as a tracked day with zero calories.
  if (parsed.items.length === 0) {
    throw new MealRejectedError(
      "Couldn't identify any food in that. Try adding more detail."
    );
  }

  return parsed;
}

/**
 * Separate from SYSTEM_PROMPT because several of its rules are actively wrong here:
 * recipe images would be rejected as invalid input, overlapping screenshots would
 * double-count ingredients, a "nutrition per serving" panel would be trusted over
 * the ingredient list, and unlisted cooking fat would be added on top of the oil the
 * recipe already calls for.
 */
const SAVED_MEAL_SYSTEM_PROMPT = `You are a nutrition analysis assistant. The user is saving a meal they eat often so they can log it repeatedly without re-describing it. Your job is to return the nutrition of ONE SERVING, plus a description of exactly what one serving is.

WHAT ONE SERVING MEANS:
- The input arrives in one of two shapes. Work out which, and say what you decided in the assumptions.
  (a) ALREADY ONE SERVING — a shake, a bowl, a plate. "1 cup milk, 2 scoops whey, 3 tbsp greek yogurt, half a cup of berries" is one serving as written. Return it as-is. Do not scale it.
  (b) A FULL RECIPE that yields many portions — a pot of stew, a tray of something. Work out roughly what the whole recipe yields, choose a sensible single serving, and return ONE serving's nutrition. A normal adult main-course serving, not a tasting portion and not a third of the pot.
- When in doubt between the two, assume (a). A user describing a shake is not describing a batch.

THE SERVING DESCRIPTION:
- State precisely what one serving is, in amounts the user can reproduce with a measuring cup, a scoop, or a spoon. One or two sentences.
- It must stand alone. "About 2/3 cup cooked rice with 2/3 cup of the beef and lentil mix" is usable. "One sixth of the recipe" is not — the user is scooping a bowl, not dividing a pot.
- For an already-single-serving meal, restate its components: "One full shake: 1 cup whole milk, 2 scoops whey, 3 tbsp greek yogurt, 1/2 cup blueberries."
- Give proportions when a serving combines components, so it can be assembled by eye next time.

READING THE INPUT:
1. NEVER ask clarifying questions. Make reasonable assumptions and list them.
2. The user's written description OVERRIDES the recipe images wherever they disagree. If the recipe says 1 lb ground beef and the user says they used 2 lb, use 2 lb. If they say they skipped an ingredient, omit it.
3. Multiple images are usually pages, scroll positions, or crops of the SAME recipe, and they often overlap. Merge them into one ingredient list and count each ingredient EXACTLY ONCE. Never sum the same ingredient twice because it appeared in two images.
4. IGNORE any "Nutrition Facts" or "per serving" panel printed on the recipe. It describes the original recipe's serving, and the user has likely modified the quantities. Always compute from the ingredient list itself.
5. Ignore non-ingredient content: instructions, prep steps, commentary, ads, comments.
6. Use amounts as written. For a range ("1-2 tbsp"), use the midpoint. For "to taste", use a small typical amount and note it.

NUTRITIONAL DATA:
- Use standard USDA values as baseline.
- Adjust for preparation method where it is specified (frying, roasting in oil, draining fat).
- Include ONLY the fats listed or mentioned. Do NOT add cooking oil that isn't specified — a recipe already accounts for its own fat, and adding more double-counts it.
- If the recipe says to drain rendered fat, reduce the fat accordingly and note it.
- saturated_fat must never exceed total fat.
- Dry vs cooked matters: use the state specified. "1 cup dry lentils" is roughly triple "1 cup cooked lentils". State which you assumed.
- ADDED SUGAR: Only sugars added during processing/cooking, NOT natural sugars from whole fruits, plain dairy, or vegetables. Honey, syrup, and table sugar are added sugar.
- POTASSIUM: Include potassium in mg. Good sources include potatoes (~900mg each), beans and lentils, spinach, tomatoes, bananas (~400mg).

ITEMIZE PER INGREDIENT:
- Return one item per ingredient, at ONE SERVING's quantity.
- Do NOT collapse the meal into a single item. The user needs to see where the calories sit and correct one ingredient without redoing the whole thing.
- Combine only genuinely trivial items (a pinch of several spices can be one "spices" line).

CONFIDENCE RANGES:
- Tight intervals when quantities are explicit: low = estimate x 0.9, high = estimate x 1.1.
- Widen to ±20% for anything whose amount you had to guess, including the serving size itself when you had to choose it.

ASSUMPTIONS:
- List what you assumed, especially: whether you treated the input as one serving or as a recipe you divided, dry vs cooked state, unspecified quantities, and anything taken from the description over the images.

IF THERE IS NO MEAL:
- If the images and description contain no identifiable meal or ingredient list, return an empty items list and set rejection_reason explaining what you'd need.`;

export async function parseSavedMeal(
  description: string,
  imagesBase64: string[] = []
): Promise<ParsedSavedMeal> {
  const userContent: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [];

  // Images first, then the description — so the description reads as instructions
  // about the images it follows, which is the order rule 2 depends on.
  imagesBase64.forEach((dataUrl, i) => {
    const block = toImageBlock(dataUrl);
    if (!block) return;
    if (imagesBase64.length > 1) {
      userContent.push({ type: 'text', text: `Recipe image ${i + 1} of ${imagesBase64.length}:` });
    }
    userContent.push(block);
  });

  const hasImages = userContent.length > 0;
  const trimmed = description.trim();

  if (hasImages && trimmed) {
    userContent.push({
      type: 'text',
      text:
        `The images above are one meal or recipe. My notes on how I actually made it — `
        + `these take priority over the images:\n\n"${trimmed}"\n\n`
        + `Give me one serving, itemized, and tell me exactly what one serving is.`,
    });
  } else if (hasImages) {
    userContent.push({
      type: 'text',
      text:
        'The images above are one meal or recipe, made as written. Give me one serving, '
        + 'itemized, and tell me exactly what one serving is.',
    });
  } else {
    userContent.push({
      type: 'text',
      text:
        `Here is a meal I eat often. Give me one serving, itemized, and tell me exactly `
        + `what one serving is:\n\n"${trimmed}"`,
    });
  }

  const response = await client.messages.create({
    model: MEAL_MODEL,
    max_tokens: 8192,
    thinking: THINKING,
    system: [{
      type: 'text',
      text: SAVED_MEAL_SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral' },
    }],
    messages: [{ role: 'user', content: userContent }],
    tools: [{
      name: 'save_meal',
      description: 'Return one serving of a frequently eaten meal, and what a serving is',
      strict: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input_schema: z.toJSONSchema(ParsedSavedMealSchema) as any,
    }],
    tool_choice: { type: 'tool', name: 'save_meal' },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  );

  if (!toolUse) {
    throw new Error('Failed to parse meal');
  }

  const parsed = ParsedSavedMealSchema.parse(toolUse.input);

  if (parsed.rejection_reason) {
    throw new MealRejectedError(parsed.rejection_reason);
  }
  if (parsed.items.length === 0) {
    throw new MealRejectedError(
      "Couldn't find an ingredient list in that. Try adding the ingredients as text."
    );
  }

  return parsed;
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
