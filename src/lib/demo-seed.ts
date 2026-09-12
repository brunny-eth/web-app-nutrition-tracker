import type { SupabaseClient } from '@supabase/supabase-js';
import { fromZonedTime } from 'date-fns-tz';
import { addDaysToDateString, getTodayInTimezone } from '@/lib/date-resolution';
import {
  DEMO_EMAIL,
  DEMO_SUPPLEMENTS,
  demoDayPlan,
  demoWeightKg,
  type DemoItem,
} from '@/lib/demo-data';

/**
 * Keeping the demo account populated.
 *
 * The obvious design is a cron job that repopulates the account at midnight, but
 * a cron is one more thing that can silently stop, it can only fire at a single
 * fixed hour (which is the wrong hour for at least one timezone), and it does
 * work on every one of the ~364 days nobody looks at the demo.
 *
 * Instead the account is topped up lazily: whenever the demo user's session is
 * checked, any day in the trailing window that has no data gets filled in. Days
 * are generated from the date alone, so a day filled in late is identical to one
 * filled in on time, and the account is correct the instant someone looks at it
 * no matter how long it sat idle.
 *
 * A day counts as seeded if it has a `daily_checklist` row. That row is written
 * last, so a half-finished seed is retried rather than left short, and nothing in
 * the UI deletes it — a visitor who clears out the food log gets it back the next
 * day rather than watching it reappear underneath them.
 */

/** How far back the demo history runs. Covers the longest trends window (90d). */
const DEMO_WINDOW_DAYS = 90;

/**
 * Ceiling on how many days one request will backfill. The initial history comes
 * from `npm run seed:demo`; in normal operation this fills a handful of days at
 * most, and the cap stops a long-idle account from stalling a page load.
 */
const MAX_DAYS_PER_PASS = 10;

export function isDemoEmail(email: string | null | undefined): boolean {
  return (email ?? '').toLowerCase() === DEMO_EMAIL;
}

function itemRow(item: DemoItem, entryId: string) {
  return {
    entry_id: entryId,
    food_name: item.food_name,
    grams: item.grams,
    grams_low: item.grams_low,
    grams_high: item.grams_high,
    calories: item.calories,
    calories_low: item.calories_low,
    calories_high: item.calories_high,
    protein_g: item.protein_g,
    protein_low: item.protein_low,
    protein_high: item.protein_high,
    carbs_g: item.carbs_g,
    carbs_low: item.carbs_low,
    carbs_high: item.carbs_high,
    fat_g: item.fat_g,
    fat_low: item.fat_low,
    fat_high: item.fat_high,
    saturated_fat_g: item.saturated_fat_g,
    saturated_fat_low: item.saturated_fat_low,
    saturated_fat_high: item.saturated_fat_high,
    // Derived the same way the live parse route derives it: the remainder of total fat.
    unsaturated_fat_g: Math.max(0, Math.round((item.fat_g - item.saturated_fat_g) * 10) / 10),
    unsaturated_fat_low: Math.max(0, Math.round((item.fat_low - item.saturated_fat_high) * 10) / 10),
    unsaturated_fat_high: Math.max(0, Math.round((item.fat_high - item.saturated_fat_low) * 10) / 10),
    fiber_g: item.fiber_g,
    fiber_low: item.fiber_low,
    fiber_high: item.fiber_high,
    sodium_mg: item.sodium_mg,
    sodium_low: item.sodium_low,
    sodium_high: item.sodium_high,
    added_sugar_g: item.added_sugar_g,
    added_sugar_low: item.added_sugar_low,
    added_sugar_high: item.added_sugar_high,
    potassium_mg: item.potassium_mg,
    potassium_low: item.potassium_low,
    potassium_high: item.potassium_high,
    assumptions: item.assumptions,
  };
}

/**
 * Write one day of canned history.
 *
 * Entries are timestamped at the hour the meal would have been eaten rather than
 * at seed time, so the day reads as a day: breakfast at 7, dinner at 7. Today's
 * evening meals therefore carry a timestamp that may still be in the future —
 * deliberate, because a visitor arriving at 9am should see a complete day rather
 * than a single bowl of cereal.
 */
export async function seedDemoDay(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  timezone: string
): Promise<void> {
  const plan = demoDayPlan(date);

  // Re-running a day must not double it up. Cheap because a day is ~5 entries.
  await supabase.from('entries').delete().eq('user_id', userId).eq('resolved_date', date);

  for (const entry of plan.entries) {
    const createdAt = fromZonedTime(
      `${date} ${String(entry.hour).padStart(2, '0')}:${String((entry.hour * 17) % 60).padStart(2, '0')}:00`,
      timezone
    ).toISOString();

    const { data: row, error } = await supabase
      .from('entries')
      .insert({
        user_id: userId,
        raw_text: entry.raw_text,
        resolved_date: date,
        explicit_date_in_text: false,
        created_at: createdAt,
      })
      .select('id')
      .single();

    if (error || !row) throw error ?? new Error('Failed to insert demo entry');

    const { error: itemsError } = await supabase
      .from('entry_items')
      .insert(entry.items.map((item) => itemRow(item, row.id)));

    if (itemsError) {
      await supabase.from('entries').delete().eq('id', row.id);
      throw itemsError;
    }
  }

  await supabase.from('daily_activity').delete().eq('user_id', userId).eq('resolved_date', date);
  await supabase.from('daily_activity').insert({
    user_id: userId,
    resolved_date: date,
    multiplier: plan.activity.multiplier,
    multiplier_low: plan.activity.multiplier_low,
    multiplier_high: plan.activity.multiplier_high,
    description: plan.activity.description,
    summary: plan.activity.summary,
  });

  // Written last: this row is the marker that says the day is done.
  await supabase.from('daily_checklist').upsert(
    {
      user_id: userId,
      resolved_date: date,
      ...plan.checklist,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,resolved_date' }
  );
}

/**
 * Fill in any unseeded day in the trailing window, newest first, and keep the
 * settings weight in step with the weigh-in history (the daily dashboard reads
 * BMR off `user_settings`, not off the checklist rows).
 *
 * Returns the dates written. Never throws: a demo that can't top itself up should
 * degrade to slightly stale data, not a broken sign-in.
 */
export async function backfillDemoUser(
  supabase: SupabaseClient,
  userId: string,
  timezone: string,
  maxDays: number = MAX_DAYS_PER_PASS
): Promise<string[]> {
  try {
    const today = getTodayInTimezone(timezone);
    const start = addDaysToDateString(today, -(DEMO_WINDOW_DAYS - 1));

    const { data: seeded } = await supabase
      .from('daily_checklist')
      .select('resolved_date')
      .eq('user_id', userId)
      .gte('resolved_date', start)
      .lte('resolved_date', today);

    const done = new Set((seeded ?? []).map((row) => row.resolved_date as string));

    const missing: string[] = [];
    for (let i = 0; i < DEMO_WINDOW_DAYS && missing.length < maxDays; i++) {
      const date = addDaysToDateString(today, -i);
      if (!done.has(date)) missing.push(date);
    }

    if (missing.length === 0) return [];

    for (const date of missing) {
      await seedDemoDay(supabase, userId, date, timezone);
    }

    await supabase
      .from('user_settings')
      .update({ weight_kg: demoWeightKg(today), updated_at: new Date().toISOString() })
      .eq('id', userId);

    return missing;
  } catch (error) {
    console.error('Demo backfill failed:', error);
    return [];
  }
}

/**
 * Top up the demo account if this is it. Safe to call on any user — it returns
 * immediately for everyone else.
 *
 * Reports whether anything was written, because seeding a new day also moves the
 * account's weight, and a caller that read `user_settings` first is now holding a
 * stale copy of it.
 */
export async function ensureDemoSeeded(
  supabase: SupabaseClient,
  user: { id: string; email: string; timezone: string | null } | null
): Promise<boolean> {
  if (!user || !isDemoEmail(user.email)) return false;
  const seeded = await backfillDemoUser(supabase, user.id, user.timezone ?? 'America/New_York');
  return seeded.length > 0;
}

export { DEMO_WINDOW_DAYS, DEMO_SUPPLEMENTS };
