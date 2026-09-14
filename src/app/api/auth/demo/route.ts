import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { createSessionToken, setSessionCookie } from '@/lib/auth';
import { DEMO_EMAIL } from '@/lib/demo-data';

/**
 * POST /api/auth/demo - Sign in to the shared demo account.
 *
 * The demo password is public by design, but it lives here rather than in the
 * sign-in page so the browser bundle doesn't have to carry the demo module (and
 * its three months of canned food) just to render one link.
 */
export async function POST() {
  try {
    const supabase = createServerClient();

    const { data: user, error } = await supabase
      .from('user_settings')
      .select('id')
      .eq('email', DEMO_EMAIL)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'The demo account is not available right now' }, { status: 404 });
    }

    const token = createSessionToken(user.id);
    await setSessionCookie(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Demo login error:', error);
    return NextResponse.json({ error: 'Could not open the demo' }, { status: 500 });
  }
}
