import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendWaitlistPromotedPush } from '@/lib/push';

/**
 * Drains `notification_outbox` — currently only populated by the
 * `tr_waitlist_promotion_notify` trigger, since waitlist promotion itself
 * happens inside a DB function not tracked in this repo and we can't hook it
 * directly.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('notification_outbox')
      .select('id, user_id, kind, payload')
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) throw error;

    let sent = 0;
    for (const row of rows || []) {
      if (row.kind === 'waitlist_promoted') {
        const classId = (row.payload as { class_id?: string })?.class_id || '';
        await sendWaitlistPromotedPush(row.user_id, classId);
        sent++;
      }

      await supabaseAdmin
        .from('notification_outbox')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', row.id);
    }

    return NextResponse.json({ message: `Notifications sent: ${sent}`, sent });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
