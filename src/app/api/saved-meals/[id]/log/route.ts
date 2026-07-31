import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserId } from '@/lib/auth';
import { getTodayInTimezone } from '@/lib/date-resolution';
import { scaleServings } from '@/lib/saved-meal-scaling';

/**
 * POST /api/saved-meals/[id]/log - log servings of a saved meal
 *
 * No model call: the stored serving is multiplied by the number eaten, which is what
 * makes the same meal produce identical nutrition every time.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { servings, override_date } = await request.json();

    const count = Number(servings);
    if (!Number.isFinite(count) || count <= 0) {
      return NextResponse.json({ error: 'Enter how many servings you ate' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Ownership is enforced by matching user_id in the same query, so an id from
    // another account simply isn't found.
    const { data: meal } = await supabase
      .from('saved_meals')
      .select('*, saved_meal_items (*)')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!meal) {
      return NextResponse.json({ error: 'Saved meal not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = meal.saved_meal_items ?? [];
    if (items.length === 0) {
      return NextResponse.json({ error: 'This saved meal has no ingredients' }, { status: 400 });
    }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('timezone')
      .eq('id', userId)
      .single();

    const timezone = settings?.timezone || 'America/New_York';
    const resolvedDate = override_date || getTodayInTimezone(timezone);

    const servingLabel = count === 1 ? 'serving' : 'servings';

    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .insert({
        user_id: userId,
        raw_text: `${count} ${servingLabel} of ${meal.name}`,
        resolved_date: resolvedDate,
        explicit_date_in_text: false,
        saved_meal_id: meal.id,
        servings: count,
      })
      .select()
      .single();

    if (entryError || !entry) {
      console.error('Saved meal log entry error:', entryError);
      return NextResponse.json({ error: 'Failed to log meal' }, { status: 500 });
    }

    const entryItems = scaleServings(items, count, entry.id);

    const { error: itemsError } = await supabase.from('entry_items').insert(entryItems);

    if (itemsError) {
      console.error('Saved meal log items error:', itemsError);
      await supabase.from('entries').delete().eq('id', entry.id);
      return NextResponse.json({ error: 'Failed to log meal' }, { status: 500 });
    }

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error('Saved meal log error:', error);
    return NextResponse.json({ error: 'Failed to log meal' }, { status: 500 });
  }
}
