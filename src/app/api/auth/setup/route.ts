import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { hashPassword, createSessionToken, setSessionCookie } from '@/lib/auth';

/**
 * Setup endpoint - creates a new user account
 */
export async function POST(request: NextRequest) {
  try {
    const { email, name, password, weight_kg, height_cm, age_years, sex, calorie_deficit } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!password || password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
    }

    const supabase = createServerClient();
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check if email already exists
    const { data: existing } = await supabase
      .from('user_settings')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    // Hash password and create user
    const password_hash = await hashPassword(password);

    const { data: newUser, error } = await supabase
      .from('user_settings')
      .insert({
        email: normalizedEmail,
        password_hash,
        name: name.trim(),
        weight_kg: weight_kg || null,
        height_cm: height_cm || null,
        age_years: age_years || null,
        sex: sex || null,
        calorie_deficit: calorie_deficit || 500,
        timezone: 'America/New_York',
      })
      .select('id')
      .single();

    if (error || !newUser) {
      console.error('Setup error:', error);
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }

    // Auto-login after setup
    const token = createSessionToken(newUser.id);
    await setSessionCookie(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 });
  }
}
