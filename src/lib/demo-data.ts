/**
 * The demo account's canned history.
 *
 * A prospective user should land on a filled-in dashboard, not an empty one, so
 * the demo account carries a plausible three months of logging. Everything here
 * is a pure function of the calendar date: seeding is therefore idempotent, any
 * missing day can be backfilled later and still come out the same, and no
 * Anthropic call is spent recreating food that was already parsed once.
 *
 * The numbers are deliberately mixed rather than flattering. Calories, protein
 * and saturated fat sit close to goal; sodium, added sugar, fiber and the
 * potassium:sodium ratio miss it consistently. A demo where every card is green
 * shows nothing about what the app is for.
 */

export const DEMO_EMAIL = 'demo@demo.com';
export const DEMO_PASSWORD = 'demo';
export const DEMO_NAME = 'Alex';
export const DEMO_TIMEZONE = 'America/New_York';

export const DEMO_PROFILE = {
  height_cm: 180,
  age_years: 34,
  sex: 'male' as const,
  calorie_deficit: 500,
  protein_g_per_kg: 1.6,
  protein_floor_g: 130,
  saturated_fat_percent: 10,
};

export const DEMO_SUPPLEMENTS = [
  { id: 'creatine', name: 'Creatine', detail: '5 g monohydrate' },
  { id: 'vitamin-d', name: 'Vitamin D3', detail: '2000 IU with breakfast' },
  { id: 'omega-3', name: 'Omega-3', detail: '1 g EPA/DHA' },
  { id: 'psyllium', name: 'Psyllium husk', detail: '1 tbsp in water', fiber_g: 5 },
];

/**
 * How often each supplement actually gets ticked. Uneven on purpose: psyllium is
 * both the one they skip and the only one carrying fiber, which is what makes the
 * fiber shortfall in the trends read as a story rather than noise.
 */
const SUPPLEMENT_ADHERENCE: Record<string, number> = {
  creatine: 0.92,
  'vitamin-d': 0.86,
  'omega-3': 0.64,
  psyllium: 0.42,
};

/**
 * Weight is anchored to a fixed date rather than to "today" because past days are
 * written once and never revisited — a curve defined relative to today would
 * flatten into a straight line as those rows aged. It decays toward a floor so an
 * account left running for a year plateaus at a sane weight instead of vanishing.
 */
const WEIGHT_ANCHOR_DATE = '2026-06-14';
const WEIGHT_ANCHOR_KG = 86.6;
const WEIGHT_LOSS_KG_PER_DAY = 0.045;
const WEIGHT_FLOOR_KG = 78;

// ============================================================================
// Meal library
// ============================================================================

/** name, grams, kcal, protein, carbs, fat, sat fat, fiber, sodium, added sugar, potassium, assumptions */
type ItemTuple = [
  string,
  number | null,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  string[]?,
];

interface MealDef {
  /** What the user would have typed into the box. */
  text: string;
  /** Hour of the day in the user's timezone, used for the entry timestamp. */
  hour: number;
  items: ItemTuple[];
}

const MEALS: Record<string, MealDef> = {
  'b-eggs-toast': {
    text: 'three scrambled eggs with spinach, two slices of sourdough with butter, black coffee',
    hour: 7,
    items: [
      ['Scrambled eggs', 150, 215, 19, 1.5, 15, 4.6, 0, 200, 0, 190, ['3 large eggs', 'cooked in a nonstick pan with no added fat']],
      ['Sautéed spinach', 60, 25, 2.5, 2, 0.4, 0.1, 1.6, 45, 0, 330],
      ['Sourdough bread', 100, 260, 10, 50, 1.8, 0.4, 2.4, 520, 0, 105, ['2 standard bakery slices']],
      ['Butter', 7, 50, 0, 0, 5.7, 3.6, 0, 41, 0, 2, ['about 1.5 tsp spread across both slices']],
      ['Black coffee', 240, 2, 0.3, 0, 0, 0, 0, 5, 0, 116],
    ],
  },
  'b-yogurt-granola': {
    text: 'greek yogurt with granola, blueberries and a drizzle of honey',
    hour: 8,
    items: [
      ['Greek yogurt, 2%', 250, 183, 25, 10, 5, 3.3, 0, 88, 0, 350],
      ['Granola', 55, 250, 5.5, 36, 9.5, 1.5, 4, 45, 11, 180, ['assumed a store-bought oat and honey granola']],
      ['Blueberries', 80, 46, 0.6, 11.6, 0.3, 0, 1.9, 1, 0, 61],
      ['Honey', 21, 64, 0.1, 17.3, 0, 0, 0, 1, 17.3, 11, ['about 1 tbsp']],
    ],
  },
  'b-shake-oats': {
    text: 'protein shake with a banana and peanut butter, plus a bowl of oatmeal',
    hour: 7,
    items: [
      ['Whey protein powder', 32, 120, 24, 3, 1.5, 0.8, 0.5, 120, 1, 180, ['1 scoop']],
      ['Banana', 118, 105, 1.3, 27, 0.4, 0.1, 3.1, 1, 0, 422, ['medium, about 7 inches']],
      ['Peanut butter', 32, 190, 7, 7, 16, 3.3, 1.9, 140, 1.5, 208, ['2 tbsp']],
      ['Oats, dry', 40, 150, 5, 27, 3, 0.5, 4, 0, 0, 150],
      ['2% milk', 240, 122, 8, 12, 4.6, 2.9, 0, 105, 0, 322],
    ],
  },
  'b-bec-bagel': {
    text: 'bacon egg and cheese on a bagel from the deli, small orange juice',
    hour: 8,
    items: [
      ['Bagel', 105, 289, 11, 56, 1.7, 0.3, 2.4, 530, 4, 105, ['plain deli bagel']],
      ['Fried eggs', 100, 180, 12.6, 1, 13.6, 3.8, 0, 180, 0, 130, ['2 large, cooked on a griddle with oil']],
      ['Bacon', 16, 87, 6, 0.2, 6.7, 2.2, 0, 370, 0, 90, ['2 slices']],
      ['American cheese', 21, 79, 4, 2, 6.5, 4, 0, 340, 1, 40, ['1 slice']],
      ['Orange juice', 240, 112, 1.7, 26, 0.5, 0.1, 0.5, 2, 0, 496],
    ],
  },
  'b-avo-toast': {
    text: 'avocado toast on wholegrain with three poached eggs, coffee with milk',
    hour: 8,
    items: [
      ['Wholegrain toast', 80, 200, 8, 34, 2.8, 0.6, 5.6, 340, 2, 180, ['2 slices']],
      ['Avocado', 100, 160, 2, 8.5, 14.7, 2.1, 6.7, 7, 0, 485, ['half a medium avocado']],
      ['Poached eggs', 150, 214, 18.9, 1, 14.3, 4.7, 0, 213, 0, 207, ['3 large']],
      ['Coffee with milk', 270, 35, 2, 3, 1.5, 0.9, 0, 30, 0, 180, ['assumed a splash of whole milk']],
    ],
  },
  'b-burrito-freezer': {
    text: 'frozen breakfast burrito with hot sauce, a cup of greek yogurt, black coffee',
    hour: 7,
    items: [
      ['Frozen breakfast burrito', 170, 420, 17, 44, 19, 7, 3, 980, 3, 330],
      ['Hot sauce', 10, 3, 0, 0.5, 0, 0, 0.1, 180, 0, 10],
      ['Greek yogurt, 0%', 200, 120, 20, 7, 0.7, 0.4, 0, 70, 0, 280],
      ['Black coffee', 240, 2, 0.3, 0, 0, 0, 0, 5, 0, 116],
    ],
  },
  'b-cereal': {
    text: 'two bowls of honey nut cereal with milk and a scoop of protein powder stirred in',
    hour: 7,
    items: [
      ['Honey nut cereal', 80, 300, 6, 66, 3, 0.5, 4.5, 370, 24, 150, ['about two standard bowls']],
      ['2% milk', 300, 150, 10, 15, 5.7, 3.6, 0, 131, 0, 403],
      ['Whey protein powder', 32, 120, 24, 3, 1.5, 0.8, 0.5, 120, 1, 180, ['1 scoop']],
    ],
  },

  'l-turkey-rye': {
    text: 'turkey sandwich on rye with swiss, lettuce and mustard, small bag of chips',
    hour: 12,
    items: [
      ['Rye bread', 64, 166, 5.4, 31, 2.1, 0.4, 3.8, 420, 1, 110, ['2 slices']],
      ['Deli turkey breast', 120, 141, 24, 2.8, 3.5, 1, 0, 1073, 1.4, 353, ['about 4 oz, assumed standard cured deli meat']],
      ['Swiss cheese', 21, 83, 6, 1.1, 6.4, 3.9, 0, 40, 0, 17],
      ['Lettuce and tomato', 50, 10, 0.5, 2, 0.1, 0, 0.6, 4, 0, 120],
      ['Yellow mustard', 10, 6, 0.4, 0.5, 0.3, 0, 0.3, 110, 0, 8],
      ['Potato chips', 28, 152, 2, 15, 10, 1.4, 1.2, 170, 0, 360, ['1 oz single-serve bag']],
    ],
  },
  'l-burrito-bowl': {
    text: 'chicken burrito bowl with white rice, black beans, salsa, cheese and guac',
    hour: 13,
    items: [
      ['Grilled chicken', 140, 230, 43, 0, 5, 1.4, 0, 520, 0, 420, ['assumed a standard chain double portion is not included']],
      ['White rice', 180, 234, 4.8, 51, 0.5, 0.1, 0.7, 5, 0, 95],
      ['Black beans', 130, 145, 9, 26, 0.6, 0.2, 9.5, 330, 0, 490],
      ['Fresh salsa', 60, 18, 0.9, 4, 0.1, 0, 1.1, 280, 0, 180],
      ['Shredded cheese', 30, 120, 7.5, 1, 9.8, 6, 0, 210, 0, 30],
      ['Guacamole', 60, 110, 1.4, 6, 10, 1.5, 4.5, 200, 0, 300],
    ],
  },
  'l-poke': {
    text: 'salmon poke bowl with brown rice, edamame, seaweed salad and avocado',
    hour: 13,
    items: [
      ['Raw salmon', 150, 310, 31, 0, 19.5, 4.4, 0, 90, 0, 550],
      ['Brown rice', 185, 216, 5, 45, 1.8, 0.4, 3.5, 10, 0, 154],
      ['Edamame', 75, 90, 8.5, 7, 4, 0.5, 4, 180, 0, 330, ['shelled and lightly salted']],
      ['Seaweed salad', 50, 70, 1, 8, 3.5, 0.5, 1, 480, 5, 30],
      ['Ponzu sauce', 18, 11, 1.1, 1.5, 0, 0, 0.1, 760, 1, 35],
      ['Avocado', 50, 80, 1, 4.3, 7.3, 1.1, 3.4, 4, 0, 243],
    ],
  },
  'l-pizza-slices': {
    text: 'two slices of pepperoni pizza and a diet coke',
    hour: 13,
    items: [
      ['Pepperoni pizza', 220, 587, 23.8, 64, 25.7, 11, 3.7, 1357, 5.5, 367, ['2 large NY-style slices']],
      ['Diet cola', 355, 0, 0, 0, 0, 0, 0, 40, 0, 0],
    ],
  },
  'l-big-salad': {
    text: 'big salad with grilled chicken, chickpeas, feta, tomato, cucumber and vinaigrette',
    hour: 12,
    items: [
      ['Mixed greens', 120, 25, 2.2, 4.5, 0.3, 0, 2.6, 30, 0, 400],
      ['Grilled chicken', 130, 214, 40, 0, 4.6, 1.3, 0, 420, 0, 390],
      ['Chickpeas', 120, 190, 10, 32, 3, 0.3, 9.5, 300, 0, 350, ['canned, drained']],
      ['Feta', 30, 80, 4.3, 1.2, 6.4, 4.5, 0, 315, 0, 19],
      ['Tomato and cucumber', 100, 20, 1, 4, 0.2, 0, 1.2, 6, 0, 250],
      ['Vinaigrette', 30, 135, 0.1, 2, 14, 2.1, 0, 210, 2, 10, ['about 2 tbsp']],
    ],
  },
  'l-padthai': {
    text: 'leftover chicken pad thai',
    hour: 13,
    items: [
      ['Chicken pad thai', 400, 800, 42, 96, 26, 5, 4.5, 1850, 18, 600, ['assumed a full restaurant portion']],
    ],
  },
  'l-caesar-wrap': {
    text: 'chicken caesar wrap and a coke',
    hour: 12,
    items: [
      ['Chicken caesar wrap', 280, 620, 38, 52, 28, 8, 3.5, 1520, 3, 480, ['flour tortilla, grilled chicken, romaine, parmesan and caesar dressing']],
      ['Coca-Cola', 355, 140, 0, 39, 0, 0, 0, 45, 39, 0, ['1 can']],
    ],
  },

  'd-chicken-rice-stirfry': {
    text: 'chicken thighs with jasmine rice and stir-fried vegetables',
    hour: 19,
    items: [
      ['Chicken thighs', 200, 375, 44, 0, 22, 6, 0, 440, 0, 480, ['boneless skinless, trimmed, pan seared']],
      ['Jasmine rice', 200, 260, 5.3, 56, 0.6, 0.2, 0.8, 5, 0, 105],
      ['Stir-fried vegetables', 180, 130, 4, 16, 6, 1, 5, 420, 4, 520, ['broccoli, pepper and snap peas with soy and sesame oil']],
    ],
  },
  'd-spaghetti': {
    text: 'spaghetti bolognese with parmesan and a side salad',
    hour: 19,
    items: [
      ['Spaghetti', 220, 350, 12, 68, 2, 0.4, 4, 5, 0, 130, ['cooked weight']],
      ['Bolognese sauce', 250, 326, 28, 16, 18, 6, 3, 890, 7, 660, ['made with 93% lean ground beef and jarred sauce']],
      ['Parmesan', 20, 84, 7.6, 0.8, 5.6, 3.6, 0, 320, 0, 24],
      ['Side salad with dressing', 110, 110, 1.3, 5, 9.5, 1.5, 1.8, 180, 1.5, 270],
    ],
  },
  'd-steak-mash': {
    text: 'ribeye with mashed potatoes and green beans, glass of red wine',
    hour: 20,
    items: [
      ['Ribeye steak', 170, 493, 42.5, 0, 35.7, 14.5, 0, 281, 0, 544, ['cooked weight, trimmed']],
      ['Mashed potatoes', 200, 225, 4, 34, 8.5, 4.5, 2.6, 560, 0, 640, ['made with butter and milk']],
      ['Green beans', 120, 55, 2, 8, 2, 0.3, 3.2, 180, 0, 250],
      ['Red wine', 150, 125, 0.1, 4, 0, 0, 0, 6, 0, 190, ['one 5 oz glass']],
    ],
  },
  'd-tikka': {
    text: 'takeout chicken tikka masala with naan and basmati rice',
    hour: 20,
    items: [
      ['Chicken tikka masala', 300, 531, 36, 19, 34.3, 14.6, 2.6, 1243, 6.9, 669, ['restaurant portion, cream-based sauce']],
      ['Naan', 90, 280, 8, 48, 6, 1.5, 2, 480, 3, 120, ['1 piece']],
      ['Basmati rice', 150, 195, 4, 42, 0.5, 0.1, 0.6, 5, 0, 80],
    ],
  },
  'd-chili-cornbread': {
    text: 'turkey chili with cornbread and a spoon of sour cream',
    hour: 19,
    items: [
      ['Turkey chili', 400, 480, 38, 42, 17, 4.5, 11, 1120, 2, 1150, ['with kidney beans and tomato']],
      ['Cornbread', 80, 250, 5, 36, 9, 2.5, 1.8, 440, 10, 90, ['1 square']],
      ['Sour cream', 30, 60, 1, 1.5, 5.5, 3.5, 0, 15, 0, 40],
    ],
  },
  'd-shrimp-tacos': {
    text: 'shrimp tacos on corn tortillas with cabbage slaw, black beans and lime crema',
    hour: 19,
    items: [
      ['Shrimp', 170, 165, 32, 1, 2.5, 0.5, 0, 620, 0, 360, ['assumed previously frozen, which carries added salt']],
      ['Corn tortillas', 75, 160, 4, 33, 2, 0.3, 4.5, 30, 0, 150, ['3 small']],
      ['Cabbage slaw', 100, 90, 1.2, 7, 6.5, 1, 2.5, 210, 3, 230],
      ['Black beans', 120, 134, 8.3, 24, 0.5, 0.1, 8.8, 300, 0, 450],
      ['Lime crema', 25, 65, 0.5, 1.5, 6.5, 2, 0, 90, 1, 25],
    ],
  },
  'd-salmon-sweetpotato': {
    text: 'grilled salmon with roasted sweet potato and broccoli',
    hour: 19,
    items: [
      ['Grilled salmon', 170, 350, 37, 0, 21, 4.5, 0, 120, 0, 620, ['skin-on fillet']],
      ['Roasted sweet potato', 200, 180, 4, 41, 0.3, 0.1, 6.6, 140, 0, 950],
      ['Roasted broccoli', 150, 90, 4.2, 10, 4.5, 0.7, 4.8, 180, 0, 470],
      ['Olive oil', 7, 62, 0, 0, 7, 1, 0, 0, 0, 0, ['used across both trays']],
    ],
  },
  'd-sausage-sheetpan': {
    text: 'sheet pan chicken sausage with peppers, onion and baby potatoes',
    hour: 19,
    items: [
      ['Chicken sausage', 255, 420, 36, 6, 27, 7.5, 0, 1770, 3, 510, ['3 links']],
      ['Roasted peppers and onion', 200, 90, 2, 14, 3.5, 0.5, 4, 10, 0, 420],
      ['Roasted baby potatoes', 250, 235, 5.5, 50, 2.5, 0.4, 5.5, 20, 0, 1050],
    ],
  },

  's-apple-pb': {
    text: 'apple with peanut butter',
    hour: 16,
    items: [
      ['Apple', 180, 94, 0.5, 25, 0.3, 0.1, 4.3, 2, 0, 195, ['medium']],
      ['Peanut butter', 32, 190, 7, 7, 16, 3.3, 1.9, 140, 1.5, 208, ['2 tbsp']],
    ],
  },
  's-protein-bar': {
    text: 'protein bar in the afternoon',
    hour: 16,
    items: [['Protein bar', 60, 220, 20, 24, 7, 3, 6, 200, 8, 180]],
  },
  's-almonds': {
    text: 'handful of almonds',
    hour: 15,
    items: [['Almonds', 35, 202, 7.4, 7.5, 17.5, 1.3, 4.4, 0, 0, 259, ['assumed about a quarter cup']]],
  },
  's-cookies': {
    text: 'two chocolate chip cookies from the office kitchen',
    hour: 15,
    items: [['Chocolate chip cookies', 60, 293, 3, 39, 14, 6, 1.2, 215, 23, 87, ['large bakery style']]],
  },
  's-yogurt-honey': {
    text: 'greek yogurt with honey before bed',
    hour: 21,
    items: [
      ['Greek yogurt, 2%', 170, 124, 17, 7, 3.4, 2.2, 0, 60, 0, 240],
      ['Honey', 14, 43, 0.1, 11.5, 0, 0, 0, 1, 11.5, 7, ['about 2 tsp']],
    ],
  },
  's-carrots-hummus': {
    text: 'baby carrots and hummus',
    hour: 16,
    items: [
      ['Baby carrots', 100, 41, 0.9, 10, 0.2, 0, 2.8, 69, 0, 320],
      ['Hummus', 60, 100, 4, 9, 6, 0.9, 3, 230, 0, 130],
    ],
  },
  's-pretzels-sports': {
    text: 'bag of pretzels and a sports drink after the run',
    hour: 17,
    items: [
      ['Pretzels', 60, 230, 6, 48, 2, 0.4, 2, 1050, 2, 90],
      ['Sports drink', 500, 140, 0, 36, 0, 0, 0, 270, 36, 75, ['one 500 ml bottle']],
    ],
  },
  's-icecream': {
    text: 'a bowl of ice cream',
    hour: 21,
    items: [['Ice cream', 100, 260, 4, 30, 14, 8.7, 1, 80, 27, 200]],
  },
  's-beers': {
    text: 'two beers',
    hour: 20,
    items: [['Beer', 710, 310, 2.4, 22, 0, 0, 0, 28, 0, 190, ['two 12 oz bottles, assumed standard lager']]],
  },
  's-chips-salsa': {
    text: 'tortilla chips and salsa while cooking',
    hour: 18,
    items: [
      ['Tortilla chips', 55, 280, 4, 35, 14, 2, 2.5, 330, 0, 120],
      ['Salsa', 60, 18, 0.9, 4, 0.1, 0, 1.1, 280, 0, 180],
    ],
  },
};

// ============================================================================
// Activity library
// ============================================================================

interface ActivityDef {
  multiplier: number;
  multiplier_low: number;
  multiplier_high: number;
  description: string;
  summary: string;
}

const ACTIVITIES: Record<string, ActivityDef> = {
  rest: {
    multiplier: 1.32,
    multiplier_low: 1.25,
    multiplier_high: 1.4,
    description: 'Desk all day, no workout, maybe 4,000 steps',
    summary: 'Sedentary day',
  },
  walk: {
    multiplier: 1.45,
    multiplier_low: 1.38,
    multiplier_high: 1.53,
    description: 'No gym, but walked about 9,000 steps over the day',
    summary: 'Light — walking only',
  },
  lift: {
    multiplier: 1.62,
    multiplier_low: 1.54,
    multiplier_high: 1.71,
    description: '60 minutes of upper body lifting plus about 8,000 steps',
    summary: 'Strength training',
  },
  liftHard: {
    multiplier: 1.7,
    multiplier_low: 1.61,
    multiplier_high: 1.8,
    description: 'Leg day, 75 minutes, then a 20 minute incline walk',
    summary: 'Heavy strength session',
  },
  run: {
    multiplier: 1.72,
    multiplier_low: 1.63,
    multiplier_high: 1.82,
    description: '5 mile run at an easy pace plus normal walking around',
    summary: 'Cardio — 5 mile run',
  },
  longRun: {
    multiplier: 1.85,
    multiplier_low: 1.75,
    multiplier_high: 1.96,
    description: '10 mile long run, about 90 minutes, then mostly on the couch',
    summary: 'Long run',
  },
  soccer: {
    multiplier: 1.78,
    multiplier_low: 1.68,
    multiplier_high: 1.89,
    description: '90 minutes of 7-a-side plus the warmup',
    summary: 'Team sport — soccer',
  },
  hike: {
    multiplier: 1.66,
    multiplier_low: 1.57,
    multiplier_high: 1.76,
    description: 'Three hour hike with about 1,200 ft of elevation',
    summary: 'Hiking',
  },
};

// ============================================================================
// Two-week rotation
// ============================================================================

/**
 * Fourteen days, not seven: a one-week loop is obvious in a 30-day chart. The
 * cycle length is a multiple of 7 so each slot keeps a fixed weekday — index 0 is
 * always a Thursday — which is what lets the weekend look like a weekend.
 */
interface DayTemplate {
  meals: string[];
  activity: keyof typeof ACTIVITIES;
  alcohol?: boolean;
}

const DAY_TEMPLATES: DayTemplate[] = [
  // Thu
  { meals: ['b-eggs-toast', 'l-turkey-rye', 'd-chicken-rice-stirfry', 's-protein-bar'], activity: 'lift' },
  // Fri
  { meals: ['b-bec-bagel', 'l-pizza-slices', 'd-spaghetti', 's-beers'], activity: 'rest', alcohol: true },
  // Sat
  { meals: ['b-avo-toast', 'l-poke', 'd-steak-mash', 's-icecream'], activity: 'hike', alcohol: true },
  // Sun
  { meals: ['b-shake-oats', 'l-big-salad', 'd-salmon-sweetpotato', 's-almonds'], activity: 'longRun' },
  // Mon
  { meals: ['b-yogurt-granola', 'l-burrito-bowl', 'd-shrimp-tacos', 's-apple-pb'], activity: 'lift' },
  // Tue
  { meals: ['b-cereal', 'l-caesar-wrap', 'd-sausage-sheetpan', 's-cookies'], activity: 'run' },
  // Wed
  { meals: ['b-burrito-freezer', 'l-padthai', 'd-chili-cornbread', 's-yogurt-honey'], activity: 'liftHard' },
  // Thu
  { meals: ['b-eggs-toast', 'l-big-salad', 'd-tikka', 's-almonds'], activity: 'walk' },
  // Fri
  { meals: ['b-yogurt-granola', 'l-turkey-rye', 'd-spaghetti', 's-beers'], activity: 'lift', alcohol: true },
  // Sat
  { meals: ['b-bec-bagel', 'l-pizza-slices', 'd-chicken-rice-stirfry', 's-beers'], activity: 'soccer', alcohol: true },
  // Sun
  { meals: ['b-avo-toast', 'l-poke', 'd-salmon-sweetpotato', 's-carrots-hummus'], activity: 'hike' },
  // Mon
  { meals: ['b-shake-oats', 'l-caesar-wrap', 'd-shrimp-tacos', 's-yogurt-honey'], activity: 'lift' },
  // Tue
  { meals: ['b-cereal', 'l-burrito-bowl', 'd-sausage-sheetpan', 's-pretzels-sports'], activity: 'run' },
  // Wed
  { meals: ['b-eggs-toast', 'l-padthai', 'd-chili-cornbread', 's-protein-bar'], activity: 'liftHard' },
];

/** Occasional extras, so two same-numbered days in the cycle aren't identical. */
const BONUS_SNACKS = ['s-chips-salsa', 's-almonds', 's-cookies', 's-carrots-hummus'];

// ============================================================================
// Deterministic helpers
// ============================================================================

/** FNV-1a. Only needs to be stable and well spread, not cryptographic. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A stable number in [0, 1) for a (date, purpose) pair. */
function unit(date: string, salt: string): number {
  return hash(`${date}|${salt}`) / 0x100000000;
}

function daysSinceEpoch(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / 86400000);
}

export function demoWeightKg(date: string): number {
  const elapsed = daysSinceEpoch(date) - daysSinceEpoch(WEIGHT_ANCHOR_DATE);
  const trend = WEIGHT_ANCHOR_KG - elapsed * WEIGHT_LOSS_KG_PER_DAY;
  // Day-to-day water weight swings; a perfectly smooth line reads as fake.
  const noise = (unit(date, 'weight') - 0.5) * 1.1;
  return Math.round(Math.max(WEIGHT_FLOOR_KG, trend + noise) * 10) / 10;
}

// ============================================================================
// Day plan
// ============================================================================

export interface DemoItem {
  food_name: string;
  grams: number | null;
  grams_low: number | null;
  grams_high: number | null;
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
  saturated_fat_g: number;
  saturated_fat_low: number;
  saturated_fat_high: number;
  fiber_g: number;
  fiber_low: number;
  fiber_high: number;
  sodium_mg: number;
  sodium_low: number;
  sodium_high: number;
  added_sugar_g: number;
  added_sugar_low: number;
  added_sugar_high: number;
  potassium_mg: number;
  potassium_low: number;
  potassium_high: number;
  assumptions: string[];
}

export interface DemoEntry {
  raw_text: string;
  hour: number;
  items: DemoItem[];
}

export interface DemoDayPlan {
  date: string;
  entries: DemoEntry[];
  activity: ActivityDef;
  checklist: {
    supplements_taken: string[];
    alcohol: boolean;
    weight_kg: number | null;
    bp_systolic: number | null;
    bp_diastolic: number | null;
  };
}

/**
 * How wide the estimate range is for each nutrient, as a fraction either side of
 * the point estimate. Roughly mirrors how confident the parser actually is:
 * a weighed portion of chicken is tighter than the sodium in a restaurant curry.
 */
const SPREAD = {
  grams: 0.15,
  calories: 0.12,
  protein: 0.1,
  carbs: 0.12,
  fat: 0.14,
  saturated_fat: 0.18,
  fiber: 0.2,
  sodium: 0.22,
  added_sugar: 0.25,
  potassium: 0.2,
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function expandItem(tuple: ItemTuple, scale: number): DemoItem {
  const [name, grams, kcal, protein, carbs, fat, satFat, fiber, sodium, addedSugar, potassium, assumptions] = tuple;

  const band = (value: number, spread: number, whole = false) => {
    const v = value * scale;
    const lo = v * (1 - spread);
    const hi = v * (1 + spread);
    return whole
      ? [Math.round(v), Math.round(lo), Math.round(hi)]
      : [round1(v), round1(lo), round1(hi)];
  };

  const [g, gLow, gHigh] = grams === null ? [null, null, null] : band(grams, SPREAD.grams, true);
  const [cal, calLow, calHigh] = band(kcal, SPREAD.calories, true);
  const [pro, proLow, proHigh] = band(protein, SPREAD.protein);
  const [carb, carbLow, carbHigh] = band(carbs, SPREAD.carbs);
  const [f, fLow, fHigh] = band(fat, SPREAD.fat);
  const [sf, sfLow, sfHigh] = band(satFat, SPREAD.saturated_fat);
  const [fib, fibLow, fibHigh] = band(fiber, SPREAD.fiber);
  const [na, naLow, naHigh] = band(sodium, SPREAD.sodium, true);
  const [sug, sugLow, sugHigh] = band(addedSugar, SPREAD.added_sugar);
  const [k, kLow, kHigh] = band(potassium, SPREAD.potassium, true);

  return {
    food_name: name,
    grams: g,
    grams_low: gLow,
    grams_high: gHigh,
    calories: cal,
    calories_low: calLow,
    calories_high: calHigh,
    protein_g: pro,
    protein_low: proLow,
    protein_high: proHigh,
    carbs_g: carb,
    carbs_low: carbLow,
    carbs_high: carbHigh,
    fat_g: f,
    fat_low: fLow,
    fat_high: fHigh,
    saturated_fat_g: sf,
    saturated_fat_low: sfLow,
    saturated_fat_high: sfHigh,
    fiber_g: fib,
    fiber_low: fibLow,
    fiber_high: fibHigh,
    sodium_mg: na,
    sodium_low: naLow,
    sodium_high: naHigh,
    added_sugar_g: sug,
    added_sugar_low: sugLow,
    added_sugar_high: sugHigh,
    potassium_mg: k,
    potassium_low: kLow,
    potassium_high: kHigh,
    assumptions: assumptions ?? [],
  };
}

/**
 * Everything the demo account should contain for one calendar date. Pure, and
 * keyed only on the date string, so re-running a seed produces the same day.
 */
export function demoDayPlan(date: string): DemoDayPlan {
  const template = DAY_TEMPLATES[((daysSinceEpoch(date) % DAY_TEMPLATES.length) + DAY_TEMPLATES.length) % DAY_TEMPLATES.length];

  const mealIds = [...template.meals];
  // An extra snack on roughly a third of days, which also keeps the two halves of
  // the fortnight from landing on identical totals.
  if (unit(date, 'bonus') < 0.35) {
    mealIds.push(BONUS_SNACKS[Math.floor(unit(date, 'bonus-pick') * BONUS_SNACKS.length)]);
  }

  const entries: DemoEntry[] = mealIds.map((id) => {
    const meal = MEALS[id];
    // Portions wobble ±12% day to day, which is both realistic and enough to stop
    // the fortnightly rotation from showing up as a sawtooth in the charts.
    const scale = 0.88 + unit(date, `scale|${id}`) * 0.24;
    return {
      raw_text: meal.text,
      hour: meal.hour,
      items: meal.items.map((item) => expandItem(item, scale)),
    };
  });

  const supplements_taken = DEMO_SUPPLEMENTS.filter(
    (s) => unit(date, `supp|${s.id}`) < (SUPPLEMENT_ADHERENCE[s.id] ?? 0.5)
  ).map((s) => s.id);

  // Weighs in most mornings but not every one; blood pressure roughly twice a week.
  const weighedIn = unit(date, 'weigh') > 0.25;
  const tookBp = unit(date, 'bp') > 0.72;

  return {
    date,
    entries,
    activity: ACTIVITIES[template.activity],
    checklist: {
      supplements_taken,
      alcohol: template.alcohol ?? false,
      weight_kg: weighedIn ? demoWeightKg(date) : null,
      bp_systolic: tookBp ? 120 + Math.round(unit(date, 'sys') * 14) : null,
      bp_diastolic: tookBp ? 76 + Math.round(unit(date, 'dia') * 10) : null,
    },
  };
}

// ============================================================================
// Saved meals
// ============================================================================

/**
 * Pre-saved meals so a visitor can log something in one tap without waiting on a
 * parse — the fastest way to see a number on the dashboard move.
 */
export const DEMO_SAVED_MEALS: {
  name: string;
  serving_description: string;
  raw_text: string;
  items: ItemTuple[];
}[] = [
  {
    name: 'Morning protein shake',
    serving_description: '1 shake (about 500 ml)',
    raw_text: 'whey protein, banana, peanut butter and whole milk blended',
    items: [
      ['Whey protein powder', 32, 120, 24, 3, 1.5, 0.8, 0.5, 120, 1, 180, ['1 scoop']],
      ['Banana', 118, 105, 1.3, 27, 0.4, 0.1, 3.1, 1, 0, 422],
      ['Peanut butter', 32, 190, 7, 7, 16, 3.3, 1.9, 140, 1.5, 208, ['2 tbsp']],
      ['Whole milk', 240, 149, 8, 12, 8, 4.6, 0, 105, 0, 322],
    ],
  },
  {
    name: 'Chicken burrito bowl',
    serving_description: '1 bowl',
    raw_text: 'chicken burrito bowl with white rice, black beans, salsa, cheese and guac',
    items: MEALS['l-burrito-bowl'].items,
  },
  {
    name: 'Turkey chili',
    serving_description: '1 bowl (about 400 g)',
    raw_text: 'turkey chili with kidney beans and tomato',
    items: [['Turkey chili', 400, 480, 38, 42, 17, 4.5, 11, 1120, 2, 1150]],
  },
];

export function expandSavedMealItems(items: ItemTuple[]): DemoItem[] {
  return items.map((item) => expandItem(item, 1));
}
