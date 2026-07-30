import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';
import { MEAL_EVAL_CASES, relativeError, sumMetric, type MealMetric } from './meal-eval-cases';

// Must run before ./nutrition-ai is loaded — it reads ANTHROPIC_API_KEY at module scope,
// and static imports are hoisted above this call. Hence the dynamic import below.
config({ path: '.env.local' });

/**
 * Known Meals Regression
 *
 * Calls the real Anthropic API to check that common meals parse within their
 * per-case tolerance. This is a coarse gate — it catches "the parser broke", not
 * "the parser got slightly worse". For measuring accuracy, comparing models, or
 * testing prompt changes, use the scored harness instead:
 *
 *   npm run eval
 *   npm run eval -- --model=claude-opus-5
 *   npm run eval -- --thinking=adaptive
 *
 * Requires ANTHROPIC_API_KEY in .env.local; skipped entirely without it.
 */

// Generous, because these are live API calls running concurrently. The per-test
// value overrides vitest.config.ts's testTimeout — which is how every case in
// here used to cap at 15s despite the config saying 30s.
const API_TIMEOUT = 60_000;

const hasApiKey =
  process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here';

const describeIfApiKey = hasApiKey ? describe : describe.skip;

describeIfApiKey('Known Meals Regression (requires ANTHROPIC_API_KEY)', () => {
  const today = '2026-01-29';
  let parseMealDescription: typeof import('./nutrition-ai').parseMealDescription;

  beforeAll(async () => {
    ({ parseMealDescription } = await import('./nutrition-ai'));
  });

  describe.concurrent('Reference meals', () => {
    for (const c of MEAL_EVAL_CASES) {
      const pct = Math.round(c.tolerance * 100);
      it(
        `parses "${c.name}" within ${pct}%`,
        async () => {
          const result = await parseMealDescription(c.input, today);
          expect(result.items.length).toBeGreaterThanOrEqual(1);

          for (const [metric, expected] of Object.entries(c.expected) as Array<
            [MealMetric, number]
          >) {
            const actual = sumMetric(result.items, metric);
            const error = Math.abs(relativeError(actual, expected));
            // Surfaced in the failure message so a regression shows by how much.
            expect(
              error,
              `${c.name} ${metric}: got ${actual.toFixed(1)}, expected ~${expected} ` +
                `(${(error * 100).toFixed(0)}% off, tolerance ${pct}%)`
            ).toBeLessThanOrEqual(c.tolerance);
          }
        },
        API_TIMEOUT
      );
    }
  });

  describe.concurrent('Date extraction', () => {
    it(
      'does not extract a date from "leftover from yesterday" (describes origin, not when eaten)',
      async () => {
        const result = await parseMealDescription('eating leftover pizza from yesterday', today);
        expect(result.explicit_date).toBeNull();
      },
      API_TIMEOUT
    );

    it(
      'extracts the date from "I had pizza yesterday"',
      async () => {
        const result = await parseMealDescription('I had a slice of pizza yesterday', today);
        expect(result.explicit_date).toBe('2026-01-28');
      },
      API_TIMEOUT
    );

    it(
      'returns null when no date is mentioned',
      async () => {
        const result = await parseMealDescription('grilled chicken with rice', today);
        expect(result.explicit_date).toBeNull();
      },
      API_TIMEOUT
    );
  });

  describe.concurrent('Assumptions tracking', () => {
    it(
      'records assumptions for an ambiguous portion',
      async () => {
        const result = await parseMealDescription('some chicken with rice', today);
        expect(result.items.length).toBeGreaterThanOrEqual(1);
        expect(result.items.some((item) => item.assumptions && item.assumptions.length > 0)).toBe(
          true
        );
      },
      API_TIMEOUT
    );

    it(
      'accounts for cooking fat when it is not specified',
      async () => {
        const result = await parseMealDescription('fried eggs', today);
        const totalFat = sumMetric(result.items, 'fat_g');
        // Plain eggs are ~10g fat for two; frying should push this higher.
        expect(totalFat).toBeGreaterThan(8);
      },
      API_TIMEOUT
    );
  });
});

if (!hasApiKey) {
  describe('Known Meals Regression', () => {
    it('SKIPPED - set ANTHROPIC_API_KEY in .env.local to run these tests', () => {
      expect(true).toBe(true);
    });
  });
}
