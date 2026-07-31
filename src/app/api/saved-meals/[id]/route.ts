import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserId } from '@/lib/auth';

/**
 * DELETE /api/saved-meals/[id] - archive a saved meal (no longer eaten, or parsed wrong)
 *
 * Archived rather than deleted so meals already logged from it keep their provenance.
 * The nutrition of those entries lives on the entries themselves, so they're
 * unaffected either way.
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
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('saved_meals')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Saved meal not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Saved meal archive error:', error);
    return NextResponse.json({ error: 'Failed to archive saved meal' }, { status: 500 });
  }
}
