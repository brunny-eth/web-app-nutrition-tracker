import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserId, hashPassword, verifyPassword } from '@/lib/auth';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/settings - Get user settings
 */
export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabase();

    const { data: settings, error } = await supabase
      .from('user_settings')
      .select('id, email, name, weight_kg, height_cm, age_years, sex, calorie_deficit, timezone, created_at')
      .eq('id', userId)
      .single();

    if (error || !settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Settings fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

/**
 * PATCH /api/settings - Update user settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      weight_kg,
      height_cm,
      age_years,
      sex,
      calorie_deficit,
      timezone,
      current_password,
      new_password,
    } = body;

    const supabase = getSupabase();

    // Get current settings for this user
    const { data: current, error: fetchError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name;
    if (weight_kg !== undefined) updates.weight_kg = weight_kg || null;
    if (height_cm !== undefined) updates.height_cm = height_cm || null;
    if (age_years !== undefined) updates.age_years = age_years || null;
    if (sex !== undefined) updates.sex = sex || null;
    if (calorie_deficit !== undefined) updates.calorie_deficit = calorie_deficit;
    if (timezone !== undefined) updates.timezone = timezone;

    // Handle password change
    if (new_password) {
      if (!current_password) {
        return NextResponse.json({ error: 'Current password required' }, { status: 400 });
      }
      
      const valid = await verifyPassword(current_password, current.password_hash);
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
      }

      if (new_password.length < 4) {
        return NextResponse.json({ error: 'New password must be at least 4 characters' }, { status: 400 });
      }

      updates.password_hash = await hashPassword(new_password);
    }

    // Update settings
    const { data: updated, error: updateError } = await supabase
      .from('user_settings')
      .update(updates)
      .eq('id', userId)
      .select('id, email, name, weight_kg, height_cm, age_years, sex, calorie_deficit, timezone')
      .single();

    if (updateError) {
      console.error('Settings update error:', updateError);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json({ settings: updated });
  } catch (error) {
    console.error('Settings update error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
