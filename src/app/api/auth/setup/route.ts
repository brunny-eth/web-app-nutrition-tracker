import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { hashPassword, createSessionToken, setSessionCookie } from '@/lib/auth';

/**
 * Initial setup endpoint - creates the first user settings with password
 * Only works if no user_settings exist yet
 */
export async function POST(request: NextRequest) {
  try {
    const { name, password, weight_kg, height_cm, age_years, sex, calorie_deficit } = await request.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!password || password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }

    const supabase = createServerClient();
    
    // Check if already set up
    const { data: existing } = await supabase
      .from('user_settings')
      .select('id')
      .limit(1)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Already set up' }, { status: 400 });
    }

    // Hash password and create settings
    const password_hash = await hashPassword(password);

    const { error } = await supabase
      .from('user_settings')
      .insert({
        password_hash,
        name: name.trim(),
        weight_kg: weight_kg || null,
        height_cm: height_cm || null,
        age_years: age_years || null,
        sex: sex || null,
        calorie_deficit: calorie_deficit || 500,
        timezone: 'America/New_York',
      });

    if (error) {
      console.error('Setup error:', error);
      return NextResponse.json({ error: 'Failed to create settings' }, { status: 500 });
    }

    // Auto-login after setup
    const token = createSessionToken();
    await setSessionCookie(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 });
  }
}
