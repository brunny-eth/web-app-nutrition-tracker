/**
 * Meal parser accuracy harness.
 *
 *   npm run eval
 *   npm run eval -- --model=claude-opus-5
 *   npm run eval -- --runs=3            # average over repeats; estimates vary run to run
 *
 * Prints per-case error against the reference values in meal-eval-cases.ts plus a
 * mean-absolute-error summary. Always exits 0 — this is a measurement, not a gate.
 * The pass/fail gate is `known-meals.test.ts`.
 */
import { config } from 'dotenv';
import {
  MEAL_EVAL_CASES,
  relativeError,
  sumMetric,
  type MealEvalCase,
  type MealMetric,
} from '../src/lib/meal-eval-cases';

config({ path: '.env.local' });

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

const modelOverride = flag('model');
const thinkingOverride = flag('thinking'); // "adaptive" to turn thinking on
const runs = Math.max(1, Number(flag('runs') ?? 1));
const concurrency = Math.max(1, Number(flag('concurrency') ?? 4));

// Must be set before importing the parser — both are read at module load.
if (modelOverride) process.env.MEAL_PARSER_MODEL = modelOverride;
if (thinkingOverride) process.env.MEAL_PARSER_THINKING = thinkingOverride;

const { parseMealDescription, MEAL_MODEL } = await import('../src/lib/openai');

const TODAY = '2026-01-29';

interface CaseResult {
  case: MealEvalCase;
  /** Signed relative error per metric, averaged across runs. */
  errors: Partial<Record<MealMetric, number>>;
  itemCount: number;
  seconds: number;
  failure?: string;
}

async function runCase(c: MealEvalCase): Promise<CaseResult> {
  const started = Date.now();
  const perRun: Array<Partial<Record<MealMetric, number>>> = [];
  let itemCount = 0;

  for (let i = 0; i < runs; i++) {
    try {
      const parsed = await parseMealDescription(c.input, TODAY);
      itemCount = parsed.items.length;
      const errors: Partial<Record<MealMetric, number>> = {};
      for (const [metric, expected] of Object.entries(c.expected) as Array<[MealMetric, number]>) {
        errors[metric] = relativeError(sumMetric(parsed.items, metric), expected);
      }
      perRun.push(errors);
    } catch (err) {
      return {
        case: c,
        errors: {},
        itemCount: 0,
        seconds: (Date.now() - started) / 1000,
        failure: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const averaged: Partial<Record<MealMetric, number>> = {};
  for (const metric of Object.keys(c.expected) as MealMetric[]) {
    const vals = perRun.map((r) => r[metric]!).filter((v) => Number.isFinite(v));
    averaged[metric] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  return { case: c, errors: averaged, itemCount, seconds: (Date.now() - started) / 1000 };
}

/** Bounded-concurrency map — the API is fine with parallelism, wall-clock isn't. */
async function pooled<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)}%`;

function formatRow(r: CaseResult): string {
  const name = r.case.name.padEnd(30);
  if (r.failure) return `  ${name} FAILED — ${r.failure}`;

  const cells = (Object.entries(r.errors) as Array<[MealMetric, number]>)
    .map(([metric, err]) => {
      const label = metric.replace('_g', '');
      const over = Math.abs(err) > r.case.tolerance ? ' !' : '  ';
      return `${label} ${pct(err).padStart(5)}${over}`;
    })
    .join('  ');

  return `  ${name} ${cells.padEnd(28)} ${r.itemCount} item(s)  ${r.seconds.toFixed(1)}s`;
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not set (looked in .env.local). Nothing to run.');
  process.exit(1);
}

console.log(
  `\nMeal parser eval — model: ${MEAL_MODEL}, thinking: ${thinkingOverride ?? 'disabled'}`
);
console.log(`${MEAL_EVAL_CASES.length} cases, ${runs} run(s) each, concurrency ${concurrency}`);
console.log('  "!" marks a case outside its own tolerance.\n');

const started = Date.now();
const results = await pooled(MEAL_EVAL_CASES, concurrency, runCase);

for (const r of results) console.log(formatRow(r));

const allErrors = results.flatMap((r) => Object.values(r.errors)).filter((v) => Number.isFinite(v));
const failures = results.filter((r) => r.failure);
const outOfTolerance = results.filter(
  (r) => !r.failure && Object.values(r.errors).some((e) => Math.abs(e) > r.case.tolerance)
);

const meanAbs = allErrors.reduce((a, b) => a + Math.abs(b), 0) / (allErrors.length || 1);
const meanSigned = allErrors.reduce((a, b) => a + b, 0) / (allErrors.length || 1);

console.log(`\n  mean absolute error: ${(meanAbs * 100).toFixed(1)}%`);
console.log(
  `  mean signed error:   ${pct(meanSigned)}  ` +
    `(${meanSigned > 0 ? 'over' : 'under'}-estimating on average)`
);
console.log(`  outside tolerance:   ${outOfTolerance.length}/${results.length}`);
if (failures.length) console.log(`  hard failures:       ${failures.length}`);
console.log(`  wall clock:          ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
