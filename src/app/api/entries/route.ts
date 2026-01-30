import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserId } from '@/lib/auth';
import { parseMealDescription, validateParsedMeal } from '@/lib/openai';
import { resolveDate, getTodayInTimezone } from '@/lib/date-resolution';

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

    // Parse the meal with GPT-4o (with optional image)
    const parsedMeal = await parseMealDescription(
      raw_text?.trim() || '1 serving', 
      today, 
      image || undefined
    );

    // Validate the response
    const validation = validateParsedMeal(parsedMeal);
    if (!validation.valid) {
      console.warn('Parsed meal validation warnings:', validation.errors);
      // Continue anyway - these are warnings, not blockers
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
        raw_text: raw_text.trim(),
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
      unsaturated_fat_g: item.unsaturated_fat_g,
      unsaturated_fat_low: item.unsaturated_fat_low,
      unsaturated_fat_high: item.unsaturated_fat_high,
      fiber_g: item.fiber_g,
      fiber_low: item.fiber_low,
      fiber_high: item.fiber_high,
      sodium_mg: item.sodium_mg,
      sodium_low: item.sodium_low,
      sodium_high: item.sodium_high,
      added_sugar_g: item.added_sugar_g,
      added_sugar_low: item.added_sugar_low,
      added_sugar_high: item.added_sugar_high,
      assumptions: item.assumptions,
    }));

    const { error: itemsError } = await supabase
      .from('entry_items')
      .insert(entryItems);

    if (itemsError) {
      console.error('Entry items creation error:', itemsError);
      // Entry was created, but items failed - should we rollback?
      // For now, return partial success
      return NextResponse.json({ 
        entry,
        warning: 'Entry created but items failed to save',
      }, { status: 201 });
    }

    return NextResponse.json({ 
      entry,
      items: parsedMeal.items,
      validation_warnings: validation.errors.length > 0 ? validation.errors : undefined,
    }, { status: 201 });

  } catch (error) {
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
