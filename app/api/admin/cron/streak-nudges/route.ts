import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Weekly Racha nudge (Thursday 22:00 UTC = 18:00 Caracas).
 * `enqueue_streak_nudges` picks members on a 2+ week streak who still need classes
 * this week and have not booked them, and writes `streak_at_risk` rows to
 * `notification_outbox` (one per member per week). The outbox drain sends the pushes.
 */
async function enqueueStreakNudges(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('enqueue_streak_nudges');
    if (error) throw error;

    const enqueued = typeof data === 'number' ? data : 0;
    return NextResponse.json({ message: `Streak nudges enqueued: ${enqueued}`, enqueued });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Streak nudge enqueue failed:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return enqueueStreakNudges(request);
}

export async function POST(request: Request) {
  return enqueueStreakNudges(request);
}
