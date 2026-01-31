import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserId } from '@/lib/auth';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Verify item belongs to user by checking entry ownership
 */
async function verifyItemOwnership(supabase: ReturnType<typeof getSupabase>, itemId: string, userId: string): Promise<boolean> {
  const { data: item } = await supabase
    .from('entry_items')
    .select('entry_id')
    .eq('id', itemId)
    .single();

  if (!item) return false;

  const { data: entry } = await supabase
    .from('entries')
    .select('user_id')
    .eq('id', item.entry_id)
    .eq('user_id', userId)
    .single();

  return !!entry;
}

/**
 * PATCH /api/entries/items/[id] - Update a food item (manual override)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const {
      food_name,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      fiber_g,
    } = body;

    // Validation: no negatives, minimum 5 calories
    if (calories !== undefined && (calories < 5 || calories < 0)) {
      return NextResponse.json({ error: 'Calories must be at least 5' }, { status: 400 });
    }
    if (protein_g !== undefined && protein_g < 0) {
      return NextResponse.json({ error: 'Protein cannot be negative' }, { status: 400 });
    }
    if (carbs_g !== undefined && carbs_g < 0) {
      return NextResponse.json({ error: 'Carbs cannot be negative' }, { status: 400 });
    }
    if (fat_g !== undefined && fat_g < 0) {
      return NextResponse.json({ error: 'Fat cannot be negative' }, { status: 400 });
    }
    if (fiber_g !== undefined && fiber_g < 0) {
      return NextResponse.json({ error: 'Fiber cannot be negative' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Verify item belongs to this user
    const isOwner = await verifyItemOwnership(supabase, id, userId);
    if (!isOwner) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Get current item to track what's being overridden
    const { data: current, error: fetchError } = await supabase
      .from('entry_items')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Build update object and track overridden fields
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      has_override: true,
    };

    const overriddenFields: string[] = current.override_fields 
      ? (Array.isArray(current.override_fields) ? current.override_fields : [])
      : [];

    if (food_name !== undefined && food_name !== current.food_name) {
      updates.food_name = food_name;
      if (!overriddenFields.includes('food_name')) overriddenFields.push('food_name');
    }

    if (calories !== undefined && calories !== current.calories) {
      updates.calories = calories;
      // Adjust low/high proportionally or set to same value
      const ratio = current.calories > 0 ? calories / current.calories : 1;
      updates.calories_low = Math.round(current.calories_low * ratio);
      updates.calories_high = Math.round(current.calories_high * ratio);
      if (!overriddenFields.includes('calories')) overriddenFields.push('calories');
    }

    if (protein_g !== undefined && protein_g !== current.protein_g) {
      updates.protein_g = protein_g;
      const ratio = current.protein_g > 0 ? protein_g / current.protein_g : 1;
      updates.protein_low = Math.round(current.protein_low * ratio * 10) / 10;
      updates.protein_high = Math.round(current.protein_high * ratio * 10) / 10;
      if (!overriddenFields.includes('protein_g')) overriddenFields.push('protein_g');
    }

    if (carbs_g !== undefined && carbs_g !== current.carbs_g) {
      updates.carbs_g = carbs_g;
      const ratio = current.carbs_g > 0 ? carbs_g / current.carbs_g : 1;
      updates.carbs_low = Math.round(current.carbs_low * ratio * 10) / 10;
      updates.carbs_high = Math.round(current.carbs_high * ratio * 10) / 10;
      if (!overriddenFields.includes('carbs_g')) overriddenFields.push('carbs_g');
    }

    if (fat_g !== undefined && fat_g !== current.fat_g) {
      updates.fat_g = fat_g;
      const ratio = current.fat_g > 0 ? fat_g / current.fat_g : 1;
      updates.fat_low = Math.round(current.fat_low * ratio * 10) / 10;
      updates.fat_high = Math.round(current.fat_high * ratio * 10) / 10;
      // Also adjust saturated/unsaturated proportionally
      updates.saturated_fat_g = Math.round(current.saturated_fat_g * ratio * 10) / 10;
      updates.unsaturated_fat_g = Math.round(current.unsaturated_fat_g * ratio * 10) / 10;
      if (!overriddenFields.includes('fat_g')) overriddenFields.push('fat_g');
    }

    if (fiber_g !== undefined && fiber_g !== current.fiber_g) {
      updates.fiber_g = fiber_g;
      if (!overriddenFields.includes('fiber_g')) overriddenFields.push('fiber_g');
    }

    updates.override_fields = overriddenFields;

    // Update item
    const { data: updated, error: updateError } = await supabase
      .from('entry_items')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Item update error:', updateError);
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('Item update error:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

/**
 * DELETE /api/entries/items/[id] - Delete a single food item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabase();

    // Verify item belongs to this user
    const isOwner = await verifyItemOwnership(supabase, id, userId);
    if (!isOwner) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('entry_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Item deletion error:', error);
      return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Item deletion error:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
