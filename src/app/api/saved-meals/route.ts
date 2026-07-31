import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserId } from '@/lib/auth';
import { parseSavedMeal, MealRejectedError } from '@/lib/nutrition-ai';
import { repairParsedMeal } from '@/lib/meal-repair';

// Parsing a recipe with images takes well over Vercel's default function timeout —
// a 10-ingredient recipe measured ~37s locally. Without this the request is killed
// mid-parse and the user just sees a failure.
export const maxDuration = 60;

/**
 * GET /api/saved-meals - meals saved for repeat logging
 *
 * Stored items are one serving, so per-serving calories is just their sum. There's
 * no yield or remaining balance to track — logging doesn't consume anything.
 */
export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    const { data: meals, error } = await supabase
      .from('saved_meals')
      .select('*, saved_meal_items (*)')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Saved meals fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch saved meals' }, { status: 500 });
    }

    const saved_meals = (meals ?? []).map((m) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = m.saved_meal_items ?? [];
      return {
        id: m.id,
        name: m.name,
        serving_description: m.serving_description,
        calories_per_serving: Math.round(
          items.reduce((sum, i) => sum + Number(i.calories || 0), 0)
        ),
        protein_per_serving: Math.round(
          items.reduce((sum, i) => sum + Number(i.protein_g || 0), 0)
        ),
      };
    });

    return NextResponse.json({ saved_meals });
  } catch (error) {
    console.error('Saved meals fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch saved meals' }, { status: 500 });
  }
}

/**
 * POST /api/saved-meals - parse a meal into one serving and store it
 *
 * Creates no entry and adds nothing to today's totals: a saved meal is something you
 * log servings from, not food you've eaten.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { description, images, name } = await request.json();

    const desc: string = (description ?? '').trim();
    const imageList: string[] = Array.isArray(images) ? images.filter(Boolean) : [];

    if (!desc && imageList.length === 0) {
      return NextResponse.json(
        { error: 'Describe the meal or attach at least one photo of the recipe' },
        { status: 400 }
      );
    }

    const parsed = await parseSavedMeal(desc, imageList);

    // Same clamping the meal path gets — impossible ranges would otherwise be
    // multiplied into every serving logged from this meal.
    const { meal: repaired, repairs } = repairParsedMeal({
      items: parsed.items,
      explicit_date: null,
      rejection_reason: null,
    });
    if (repairs.length > 0) {
      console.warn('Repaired parsed saved meal:', repairs);
    }

    const supabase = createServerClient();

    const { data: meal, error: mealError } = await supabase
      .from('saved_meals')
      .insert({
        user_id: userId,
        name: (name ?? '').trim() || parsed.name,
        serving_description: parsed.serving_description,
        raw_text: desc || null,
      })
      .select()
      .single();

    if (mealError || !meal) {
      console.error('Saved meal creation error:', mealError);
      return NextResponse.json({ error: 'Failed to save meal' }, { status: 500 });
    }

    const mealItems = repaired.items.map((item) => ({
      saved_meal_id: meal.id,
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

    const { error: itemsError } = await supabase.from('saved_meal_items').insert(mealItems);

    if (itemsError) {
      console.error('Saved meal items creation error:', itemsError);
      // Roll back rather than leave a meal with no ingredients, which would log
      // zero-calorie servings forever.
      await supabase.from('saved_meals').delete().eq('id', meal.id);
      return NextResponse.json({ error: 'Failed to save ingredients' }, { status: 500 });
    }

    return NextResponse.json({ saved_meal: meal, items: repaired.items }, { status: 201 });
  } catch (error) {
    if (error instanceof MealRejectedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Saved meal creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save meal' },
      { status: 500 }
    );
  }
}
