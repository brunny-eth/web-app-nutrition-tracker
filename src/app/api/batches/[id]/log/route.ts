import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserId } from '@/lib/auth';
import { getTodayInTimezone } from '@/lib/date-resolution';
import { scaleBatchItems } from '@/lib/batch-scaling';

/**
 * POST /api/batches/[id]/log - log a portion of a batch as food eaten
 *
 * No model call: the batch's numbers are scaled arithmetically, which is what makes
 * the same portion size produce identical nutrition every time.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { amount, override_date } = await request.json();

    const eaten = Number(amount);
    if (!Number.isFinite(eaten) || eaten <= 0) {
      return NextResponse.json({ error: 'Enter how much you ate' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Ownership is enforced by matching user_id in the same query rather than a
    // separate check, so a batch id from another account simply isn't found.
    const { data: batch } = await supabase
      .from('batches')
      .select('*, batch_items (*)')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const total = Number(batch.total_amount);
    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json({ error: 'This batch has no valid total' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batchItems: any[] = batch.batch_items ?? [];
    if (batchItems.length === 0) {
      return NextResponse.json({ error: 'This batch has no ingredients' }, { status: 400 });
    }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('timezone')
      .eq('id', userId)
      .single();

    const timezone = settings?.timezone || 'America/New_York';
    const resolvedDate = override_date || getTodayInTimezone(timezone);

    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .insert({
        user_id: userId,
        raw_text: `${eaten} ${batch.unit} of ${batch.name}`,
        resolved_date: resolvedDate,
        explicit_date_in_text: false,
        batch_id: batch.id,
        batch_amount: eaten,
      })
      .select()
      .single();

    if (entryError || !entry) {
      console.error('Batch portion entry error:', entryError);
      return NextResponse.json({ error: 'Failed to log portion' }, { status: 500 });
    }

    const fraction = eaten / total;
    const entryItems = scaleBatchItems(batchItems, fraction, entry.id);

    const { error: itemsError } = await supabase.from('entry_items').insert(entryItems);

    if (itemsError) {
      console.error('Batch portion items error:', itemsError);
      await supabase.from('entries').delete().eq('id', entry.id);
      return NextResponse.json({ error: 'Failed to log portion' }, { status: 500 });
    }

    return NextResponse.json({ entry, fraction }, { status: 201 });
  } catch (error) {
    console.error('Batch portion error:', error);
    return NextResponse.json({ error: 'Failed to log portion' }, { status: 500 });
  }
}
