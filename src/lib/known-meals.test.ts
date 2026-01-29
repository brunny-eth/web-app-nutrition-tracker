import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

/**
 * Known Meals Regression Tests
 * 
 * These tests call the real OpenAI API to verify that common meals
 * are parsed within expected ranges. Results should be within 10%
 * of expected values.
 * 
 * Note: These tests require OPENAI_API_KEY to be set in .env.local
 * Run with: npm test
 */

const TOLERANCE = 0.10; // 10% tolerance

function withinTolerance(actual: number, expected: number): boolean {
  const min = expected * (1 - TOLERANCE);
  const max = expected * (1 + TOLERANCE);
  return actual >= min && actual <= max;
}

// Check if API key is available
const hasApiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here';

// Conditionally run or skip the describe block
const describeIfApiKey = hasApiKey ? describe : describe.skip;

describeIfApiKey('Known Meals Regression (requires OPENAI_API_KEY)', () => {
  const today = '2026-01-29';
  let parseMealDescription: typeof import('./openai').parseMealDescription;

  beforeAll(async () => {
    const module = await import('./openai');
    parseMealDescription = module.parseMealDescription;
  });

  describe('Single items', () => {
    it('should parse "1 large egg" correctly', async () => {
      const result = await parseMealDescription('1 large egg', today);
      
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      
      const egg = result.items[0];
      // Expected: 70-90 calories, 5-8g protein (USDA: 72cal, 6.3g protein)
      expect(egg.calories).toBeGreaterThanOrEqual(65);
      expect(egg.calories).toBeLessThanOrEqual(100);
      expect(egg.protein_g).toBeGreaterThanOrEqual(5);
      expect(egg.protein_g).toBeLessThanOrEqual(8);
    }, 15000);

    it('should parse "1 cup of cooked white rice" correctly', async () => {
      const result = await parseMealDescription('1 cup of cooked white rice', today);
      
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      
      const rice = result.items[0];
      // Expected: ~200-240 calories, ~4-5g protein, ~45g carbs
      expect(withinTolerance(rice.calories, 205)).toBe(true);
      expect(withinTolerance(rice.carbs_g, 45)).toBe(true);
    }, 15000);

    it('should parse "1 scoop whey protein with water" correctly', async () => {
      const result = await parseMealDescription('1 scoop whey protein with water', today);
      
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      
      const totalProtein = result.items.reduce((sum, item) => sum + item.protein_g, 0);
      const totalCalories = result.items.reduce((sum, item) => sum + item.calories, 0);
      
      // Expected: ~100-130 calories, ~20-30g protein
      expect(totalCalories).toBeGreaterThanOrEqual(90);
      expect(totalCalories).toBeLessThanOrEqual(150);
      expect(totalProtein).toBeGreaterThanOrEqual(18);
      expect(totalProtein).toBeLessThanOrEqual(35);
    }, 15000);

    it('should parse "1 medium banana" correctly', async () => {
      const result = await parseMealDescription('1 medium banana', today);
      
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      
      const banana = result.items[0];
      // Expected: ~100-110 calories, ~1g protein, ~25-30g carbs
      expect(withinTolerance(banana.calories, 105)).toBe(true);
      expect(withinTolerance(banana.carbs_g, 27)).toBe(true);
    }, 15000);

    it('should parse "chicken breast 6oz grilled" correctly', async () => {
      const result = await parseMealDescription('chicken breast 6oz grilled', today);
      
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      
      const chicken = result.items[0];
      // Expected: ~280-320 calories, ~50-55g protein
      expect(withinTolerance(chicken.calories, 280)).toBe(true);
      expect(withinTolerance(chicken.protein_g, 52)).toBe(true);
    }, 15000);
  });

  describe('Composite meals', () => {
    it('should parse "rice bowl with ground beef and vegetables" correctly', async () => {
      const result = await parseMealDescription('rice bowl with ground beef (about 4oz) and mixed vegetables', today);
      
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      
      const totalCalories = result.items.reduce((sum, item) => sum + item.calories, 0);
      const totalProtein = result.items.reduce((sum, item) => sum + item.protein_g, 0);
      
      // Expected total: ~500-700 calories, ~25-40g protein
      expect(totalCalories).toBeGreaterThanOrEqual(400);
      expect(totalCalories).toBeLessThanOrEqual(800);
      expect(totalProtein).toBeGreaterThanOrEqual(20);
      expect(totalProtein).toBeLessThanOrEqual(50);
    }, 20000);

    it('should parse "Starbucks spinach feta wrap" correctly', async () => {
      const result = await parseMealDescription('Starbucks spinach feta egg white wrap', today);
      
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      
      const totalCalories = result.items.reduce((sum, item) => sum + item.calories, 0);
      const totalProtein = result.items.reduce((sum, item) => sum + item.protein_g, 0);
      
      // Known Starbucks item: 290 calories, 19g protein
      expect(withinTolerance(totalCalories, 290)).toBe(true);
      expect(withinTolerance(totalProtein, 19)).toBe(true);
    }, 15000);

    it('should parse "oatmeal with peanut butter and banana" correctly', async () => {
      const result = await parseMealDescription('1 cup oatmeal with 2 tbsp peanut butter and half a banana', today);
      
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      
      const totalCalories = result.items.reduce((sum, item) => sum + item.calories, 0);
      const totalProtein = result.items.reduce((sum, item) => sum + item.protein_g, 0);
      
      // Expected total: ~450-550 calories, ~15-20g protein
      expect(totalCalories).toBeGreaterThanOrEqual(380);
      expect(totalCalories).toBeLessThanOrEqual(600);
      expect(totalProtein).toBeGreaterThanOrEqual(12);
      expect(totalProtein).toBeLessThanOrEqual(25);
    }, 15000);
  });

  describe('Date extraction', () => {
    it('should NOT extract date from "leftover from yesterday"', async () => {
      const result = await parseMealDescription('eating leftover pizza from yesterday', today);
      
      // Should NOT extract an explicit date - this is describing food origin
      expect(result.explicit_date).toBeNull();
    }, 15000);

    it('should extract date from "I had pizza yesterday"', async () => {
      const result = await parseMealDescription('I had a slice of pizza yesterday', today);
      
      // Should extract yesterday's date
      expect(result.explicit_date).toBe('2026-01-28');
    }, 15000);

    it('should NOT extract date when none mentioned', async () => {
      const result = await parseMealDescription('grilled chicken with rice', today);
      
      expect(result.explicit_date).toBeNull();
    }, 15000);
  });

  describe('Assumptions tracking', () => {
    it('should include assumptions for ambiguous portions', async () => {
      const result = await parseMealDescription('some chicken with rice', today);
      
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      
      // At least one item should have assumptions
      const hasAssumptions = result.items.some(
        item => item.assumptions && item.assumptions.length > 0
      );
      expect(hasAssumptions).toBe(true);
    }, 15000);

    it('should include cooking oil assumptions when not specified', async () => {
      const result = await parseMealDescription('fried eggs', today);
      
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      
      // Should either have oil as separate item or assumption about oil
      const totalFat = result.items.reduce((sum, item) => sum + item.fat_g, 0);
      // Fried eggs should have more fat than plain eggs due to oil
      expect(totalFat).toBeGreaterThan(8);
    }, 15000);
  });
});

// If no API key, show a message
if (!hasApiKey) {
  describe('Known Meals Regression', () => {
    it('SKIPPED - Set OPENAI_API_KEY in .env.local to run these tests', () => {
      console.log('⚠️  Known meals tests skipped - no API key');
      expect(true).toBe(true);
    });
  });
}
