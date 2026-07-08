import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserId } from '@/lib/auth';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface DailyChecklist {
  id: string;
  user_id: string;
  resolved_date: string;
  supplements_taken: string[];
  alcohol: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/checklist?date=YYYY-MM-DD - Get the supplement/alcohol checklist for a date
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
    const { data: checklist } = await supabase
      .from('daily_checklist')
      .select('*')
      .eq('user_id', userId)
      .eq('resolved_date', date)
      .maybeSingle();

    return NextResponse.json({ checklist: checklist as DailyChecklist | null });
  } catch (error) {
    console.error('Checklist fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch checklist' }, { status: 500 });
  }
}

/**
 * POST /api/checklist - Upsert the checklist for a date
 * Body: { date, supplements_taken?: string[], alcohol?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const date = body.date as string;
    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Merge with any existing row so a partial update (e.g. only alcohol) preserves the rest.
    const { data: existing } = await supabase
      .from('daily_checklist')
      .select('*')
      .eq('user_id', userId)
      .eq('resolved_date', date)
      .maybeSingle();

    const supplements_taken = Array.isArray(body.supplements_taken)
      ? (body.supplements_taken as string[])
      : (existing?.supplements_taken ?? []);
    const alcohol = typeof body.alcohol === 'boolean'
      ? (body.alcohol as boolean)
      : (existing?.alcohol ?? false);

    const { data, error } = await supabase
      .from('daily_checklist')
      .upsert(
        {
          user_id: userId,
          resolved_date: date,
          supplements_taken,
          alcohol,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,resolved_date' }
      )
      .select('*')
      .single();

    if (error) {
      console.error('Checklist upsert error:', error);
      return NextResponse.json({ error: 'Failed to save checklist' }, { status: 500 });
    }

    return NextResponse.json({ checklist: data as DailyChecklist });
  } catch (error) {
    console.error('Checklist update error:', error);
    return NextResponse.json({ error: 'Failed to update checklist' }, { status: 500 });
  }
}
