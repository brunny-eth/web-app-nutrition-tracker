import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { estimateActivityMultiplier } from '@/lib/openai';

/**
 * POST /api/activity-estimate - Estimate activity multiplier from natural language description
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { description } = body;

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    const estimate = await estimateActivityMultiplier(description.trim());

    return NextResponse.json({ estimate });
  } catch (error) {
    console.error('Activity estimate error:', error);
    return NextResponse.json({ error: 'Failed to estimate activity' }, { status: 500 });
  }
}
