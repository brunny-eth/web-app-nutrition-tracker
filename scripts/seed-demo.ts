/**
 * Create (or reset) the shared demo account.
 *
 *   npm run seed:demo            # create the account and backfill 90 days
 *   npm run seed:demo -- --reset # wipe everything it has logged first
 *
 * Only needs running once. After that the account tops itself up on sign-in — see
 * the note at the top of src/lib/demo-seed.ts. Re-run `--reset` to clear out
 * whatever visitors have added.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

config({ path: '.env.local' });

import {
  DEMO_EMAIL,
  DEMO_NAME,
  DEMO_PASSWORD,
  DEMO_PROFILE,
  DEMO_SAVED_MEALS,
  DEMO_SUPPLEMENTS,
  DEMO_TIMEZONE,
  demoWeightKg,
  expandSavedMealItems,
} from '../src/lib/demo-data';
import { DEMO_WINDOW_DAYS, backfillDemoUser } from '../src/lib/demo-seed';
import { addDaysToDateString, getTodayInTimezone } from '../src/lib/date-resolution';

const reset = process.argv.includes('--reset');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const today = getTodayInTimezone(DEMO_TIMEZONE);
  const historyStart = addDaysToDateString(today, -(DEMO_WINDOW_DAYS - 1));

  const profile = {
    email: DEMO_EMAIL,
    password_hash: await bcrypt.hash(DEMO_PASSWORD, 10),
    name: DEMO_NAME,
    weight_kg: demoWeightKg(today),
    timezone: DEMO_TIMEZONE,
    supplements: DEMO_SUPPLEMENTS,
    ...DEMO_PROFILE,
  };

  const { data: existing } = await supabase
    .from('user_settings')
    .select('id')
    .eq('email', DEMO_EMAIL)
    .maybeSingle();

  let userId: string;

  if (existing) {
    userId = existing.id;
    await supabase.from('user_settings').update(profile).eq('id', userId);
    console.log(`Demo account already existed (${userId}), settings refreshed.`);
  } else {
    const { data, error } = await supabase
      .from('user_settings')
      .insert(profile)
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('Failed to create demo user');
    userId = data.id;
    console.log(`Created demo account ${userId}.`);
  }

  if (reset) {
    // Clears whatever visitors logged, along with the day markers, so the whole
    // window regenerates below.
    await supabase.from('entries').delete().eq('user_id', userId);
    await supabase.from('daily_activity').delete().eq('user_id', userId);
    await supabase.from('daily_checklist').delete().eq('user_id', userId);
    await supabase.from('saved_meals').delete().eq('user_id', userId);
    console.log('Cleared existing demo data.');
  }

  // One snapshot, backdated to the start of the history, so every day in the
  // window is scored against goals that were already in force — otherwise the
  // trends page falls back to current settings for all of them.
  await supabase.from('goal_history').delete().eq('user_id', userId);
  await supabase.from('goal_history').insert({
    user_id: userId,
    effective_from: historyStart,
    calorie_deficit: DEMO_PROFILE.calorie_deficit,
    protein_g_per_kg: DEMO_PROFILE.protein_g_per_kg,
    protein_floor_g: DEMO_PROFILE.protein_floor_g,
    saturated_fat_percent: DEMO_PROFILE.saturated_fat_percent,
    supplements: DEMO_SUPPLEMENTS,
  });

  const { count: savedCount } = await supabase
    .from('saved_meals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (!savedCount) {
    for (const meal of DEMO_SAVED_MEALS) {
      const { data: row, error } = await supabase
        .from('saved_meals')
        .insert({
          user_id: userId,
          name: meal.name,
          serving_description: meal.serving_description,
          raw_text: meal.raw_text,
        })
        .select('id')
        .single();
      if (error || !row) throw error ?? new Error('Failed to create saved meal');

      await supabase.from('saved_meal_items').insert(
        expandSavedMealItems(meal.items).map((item) => ({
          saved_meal_id: row.id,
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
        }))
      );
    }
    console.log(`Seeded ${DEMO_SAVED_MEALS.length} saved meals.`);
  }

  // The whole window in one pass, rather than the handful of days the sign-in
  // path is allowed to do.
  const seeded = await backfillDemoUser(supabase, userId, DEMO_TIMEZONE, DEMO_WINDOW_DAYS);
  console.log(`Seeded ${seeded.length} days (${historyStart} .. ${today}).`);
  console.log(`\nSign in with  ${DEMO_EMAIL}  /  ${DEMO_PASSWORD}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
