import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserId } from '@/lib/auth';

/**
 * DELETE /api/batches/[id] - archive a batch (finished, or parsed wrong)
 *
 * Archived rather than deleted so portions already logged from it keep their
 * provenance. The nutrition of those portions lives on the entries themselves, so
 * they're unaffected either way.
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
      .from('batches')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Batch archive error:', error);
    return NextResponse.json({ error: 'Failed to archive batch' }, { status: 500 });
  }
}
