import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyPassword, createSessionToken, setSessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 });
    }

    const supabase = createServerClient();
    
    // Get user settings (single user)
    const { data: settings, error } = await supabase
      .from('user_settings')
      .select('password_hash')
      .limit(1)
      .single();

    if (error || !settings) {
      return NextResponse.json({ error: 'Not set up yet' }, { status: 404 });
    }

    // Verify password
    const valid = await verifyPassword(password, settings.password_hash);
    
    if (!valid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Create session
    const token = createSessionToken();
    await setSessionCookie(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
