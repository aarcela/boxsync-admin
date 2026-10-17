import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Daily cron to check for birthday and membership anniversary milestones.
 * Runs at midnight America/Caracas (04:00 UTC).
 * Idempotent: won't duplicate achievements for the same user/year.
 */
async function checkDailyMilestones(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('check_daily_milestones');

    if (error) throw error;

    const results = (data || []) as Array<{
      milestone_type: string;
      user_id: string;
      tenant_id: string;
      milestone_value: string;
      inserted: boolean;
    }>;

    const inserted = results.filter((r) => r.inserted).length;
    const skipped = results.filter((r) => !r.inserted).length;

    return NextResponse.json({
      message: `Daily milestones checked: ${inserted} new, ${skipped} already achieved`,
      inserted,
      skipped,
      results,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Daily milestone check failed:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return checkDailyMilestones(request);
}

export async function POST(request: Request) {
  return checkDailyMilestones(request);
}
