import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserId } from '@/lib/auth';
import { parseRecipeBatch, MealRejectedError } from '@/lib/nutrition-ai';
import { repairParsedMeal } from '@/lib/meal-repair';

// Parsing a full recipe with images takes well over Vercel's default function
// timeout — a 10-ingredient batch measured ~37s locally. Without this the request
// is killed mid-parse and the user just sees a failure.
export const maxDuration = 60;

/**
 * GET /api/batches - active batches with how much is left
 *
 * "Remaining" is derived by summing the portions logged against each batch rather
 * than stored as a counter, so deleting a logged portion returns it to the batch
 * automatically and the two can never disagree.
 */
export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    const { data: batches, error } = await supabase
      .from('batches')
      .select('*, batch_items (*)')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Batches fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 });
    }

    const ids = (batches ?? []).map((b) => b.id);
    const consumedByBatch: Record<string, number> = {};

    if (ids.length > 0) {
      const { data: portions } = await supabase
        .from('entries')
        .select('batch_id, batch_amount')
        .eq('user_id', userId)
        .in('batch_id', ids);

      for (const p of portions ?? []) {
        if (!p.batch_id) continue;
        consumedByBatch[p.batch_id] = (consumedByBatch[p.batch_id] ?? 0) + Number(p.batch_amount ?? 0);
      }
    }

    const withRemaining = (batches ?? []).map((b) => {
      const total = Number(b.total_amount);
      const consumed = consumedByBatch[b.id] ?? 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = b.batch_items ?? [];
      const totalCalories = items.reduce((sum, i) => sum + Number(i.calories || 0), 0);

      return {
        ...b,
        total_amount: total,
        consumed_amount: Math.round(consumed * 100) / 100,
        // Can go slightly negative if you eat more than you measured — shown as-is
        // rather than clamped, since that's a signal the total was off.
        remaining_amount: Math.round((total - consumed) * 100) / 100,
        total_calories: Math.round(totalCalories),
        calories_per_unit: total > 0 ? Math.round(totalCalories / total) : 0,
      };
    });

    return NextResponse.json({ batches: withRemaining });
  } catch (error) {
    console.error('Batches fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 });
  }
}

/**
 * POST /api/batches - parse a recipe and store it as a batch
 *
 * Creates no entry and adds nothing to today's totals: a batch is a source you log
 * portions from, not food you've eaten.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { description, images, total_amount, unit, name } = await request.json();

    const desc: string = (description ?? '').trim();
    const imageList: string[] = Array.isArray(images) ? images.filter(Boolean) : [];

    if (!desc && imageList.length === 0) {
      return NextResponse.json(
        { error: 'Add a recipe description or at least one recipe image' },
        { status: 400 }
      );
    }

    const total = Number(total_amount);
    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json(
        { error: 'How much did this make? Enter a total amount.' },
        { status: 400 }
      );
    }

    const parsed = await parseRecipeBatch(desc, imageList);

    // Same clamping the meal path gets — impossible ranges would otherwise be
    // multiplied into every portion logged from this batch.
    const { meal: repaired, repairs } = repairParsedMeal({
      items: parsed.items,
      explicit_date: null,
      rejection_reason: null,
    });
    if (repairs.length > 0) {
      console.warn('Repaired parsed recipe:', repairs);
    }

    const supabase = createServerClient();

    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .insert({
        user_id: userId,
        name: (name ?? '').trim() || parsed.name,
        raw_text: desc || null,
        total_amount: total,
        unit: (unit ?? '').trim() || 'cups',
      })
      .select()
      .single();

    if (batchError || !batch) {
      console.error('Batch creation error:', batchError);
      return NextResponse.json({ error: 'Failed to create batch' }, { status: 500 });
    }

    const batchItems = repaired.items.map((item) => ({
      batch_id: batch.id,
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
    }));

    const { error: itemsError } = await supabase.from('batch_items').insert(batchItems);

    if (itemsError) {
      console.error('Batch items creation error:', itemsError);
      // Roll back rather than leave a batch with no ingredients, which would log
      // zero-calorie portions forever.
      await supabase.from('batches').delete().eq('id', batch.id);
      return NextResponse.json({ error: 'Failed to save recipe ingredients' }, { status: 500 });
    }

    return NextResponse.json({ batch, items: repaired.items }, { status: 201 });
  } catch (error) {
    if (error instanceof MealRejectedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Batch creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create batch' },
      { status: 500 }
    );
  }
}
