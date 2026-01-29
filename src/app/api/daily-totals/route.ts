import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

/**
 * GET /api/daily-totals?date=YYYY-MM-DD or ?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Get daily nutrition totals
 */
export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const supabase = createServerClient();

    let query = supabase
      .from('daily_totals')
      .select('*')
      .order('resolved_date', { ascending: false });

    if (date) {
      query = query.eq('resolved_date', date);
    } else if (from && to) {
      query = query.gte('resolved_date', from).lte('resolved_date', to);
    }

    const { data: totals, error } = await query;

    if (error) {
      console.error('Daily totals fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch totals' }, { status: 500 });
    }

    return NextResponse.json({ totals });
  } catch (error) {
    console.error('Daily totals fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch totals' }, { status: 500 });
  }
}
