import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserId } from '@/lib/auth';
import { parseMealDescription, MealRejectedError } from '@/lib/nutrition-ai';
import { repairParsedMeal } from '@/lib/meal-repair';
import { resolveDate, getTodayInTimezone } from '@/lib/date-resolution';
import { IMAGE_ONLY_TEXT } from '@/types/nutrition';

/**
 * POST /api/entries - Create a new food entry
 */
export async function POST(request: NextRequest) {
  try {
    // Check auth
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { raw_text, image, client_timestamp, override_date } = await request.json();

    // Need either text or image
    if ((!raw_text || raw_text.trim().length === 0) && !image) {
      return NextResponse.json({ error: 'Food description or image required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Get user's timezone
    const { data: settings } = await supabase
      .from('user_settings')
      .select('timezone')
      .eq('id', userId)
      .single();

    const timezone = settings?.timezone || 'America/New_York';
    const today = getTodayInTimezone(timezone);

    // One value for both the parse and the stored row — the stored one used to be
    // `raw_text.trim()`, which threw on an image-only request that omitted the field.
    const mealText: string = raw_text?.trim() || IMAGE_ONLY_TEXT;

    const parsed = await parseMealDescription(mealText, today, image || undefined);

    // Clamp impossible ranges before they reach the database.
    const { meal: parsedMeal, repairs } = repairParsedMeal(parsed);
    if (repairs.length > 0) {
      console.warn('Repaired parsed meal:', repairs);
    }

    // Resolve the date
    // Priority: override_date > explicit_date from LLM > client_timestamp
    let finalDate: string;
    let explicitDateInText = false;

    if (override_date) {
      finalDate = override_date;
      explicitDateInText = false; // User picked from date picker
    } else {
      const resolved = resolveDate(
        parsedMeal.explicit_date,
        client_timestamp || new Date().toISOString(),
        timezone
      );
      finalDate = resolved.resolved_date;
      explicitDateInText = resolved.explicit_date_in_text;
    }

    // Create the entry with user_id
    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .insert({
        user_id: userId,
        raw_text: mealText,
        resolved_date: finalDate,
        explicit_date_in_text: explicitDateInText,
      })
      .select()
      .single();

    if (entryError || !entry) {
      console.error('Entry creation error:', entryError);
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
    }

    // Create entry items
    const entryItems = parsedMeal.items.map(item => ({
      entry_id: entry.id,
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
      // Derived rather than estimated: it's just the remainder of total fat, and
      // asking the model for it separately produced a third number that could
      // contradict the other two. The columns are NOT NULL, so still written.
      unsaturated_fat_g: Math.max(0, item.fat_g - item.saturated_fat_g),
      unsaturated_fat_low: Math.max(0, item.fat_low - item.saturated_fat_high),
      unsaturated_fat_high: Math.max(0, item.fat_high - item.saturated_fat_low),
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
    }));

    const { error: itemsError } = await supabase
      .from('entry_items')
      .insert(entryItems);

    if (itemsError) {
      console.error('Entry items creation error:', itemsError);
      // Roll the entry back rather than leaving one with no items behind — an
      // itemless entry still counts as a tracked day in trends and drags the
      // averages toward zero.
      await supabase.from('entries').delete().eq('id', entry.id);
      return NextResponse.json({ error: 'Failed to save food items' }, { status: 500 });
    }

    return NextResponse.json({
      entry,
      items: parsedMeal.items,
    }, { status: 201 });

  } catch (error) {
    // The input can't be parsed — the user's to fix, so don't report it as a server fault.
    if (error instanceof MealRejectedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Entry creation error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to create entry'
    }, { status: 500 });
  }
}

/**
 * GET /api/entries - Get entries for a date range
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // Single date YYYY-MM-DD
    const from = searchParams.get('from'); // Range start
    const to = searchParams.get('to'); // Range end

    const supabase = createServerClient();

    let query = supabase
      .from('entries')
      .select(`
        *,
        entry_items (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (date) {
      query = query.eq('resolved_date', date);
    } else if (from && to) {
      query = query.gte('resolved_date', from).lte('resolved_date', to);
    }

    const { data: entries, error } = await query;

    if (error) {
      console.error('Entries fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
    }

    return NextResponse.json({ entries });

  } catch (error) {
    console.error('Entries fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }
}
