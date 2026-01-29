import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserId } from '@/lib/auth';

// Use untyped client for this route to avoid type issues with upsert
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface DailyActivity {
  id: string;
  user_id: string;
  resolved_date: string;
  activity_level_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/activity?date=YYYY-MM-DD - Get activity level for a date
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({ error: 'Date required' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: activity } = await supabase
      .from('daily_activity')
      .select('*')
      .eq('user_id', userId)
      .eq('resolved_date', date)
      .maybeSingle();

    return NextResponse.json({ activity: activity as DailyActivity | null });
  } catch (error) {
    console.error('Activity fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}

/**
 * POST /api/activity - Set activity level for a date
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const date = body.date as string;
    const activity_level_id = body.activity_level_id as number;

    if (!date || !activity_level_id) {
      return NextResponse.json({ error: 'Date and activity_level_id required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Delete existing for this user+date and insert new
    await supabase
      .from('daily_activity')
      .delete()
      .eq('user_id', userId)
      .eq('resolved_date', date);

    const { data, error } = await supabase
      .from('daily_activity')
      .insert({ user_id: userId, resolved_date: date, activity_level_id })
      .select('*')
      .single();

    if (error) {
      console.error('Activity insert error:', error);
      return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
    }

    return NextResponse.json({ activity: data as DailyActivity });
  } catch (error) {
    console.error('Activity update error:', error);
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
  }
}
