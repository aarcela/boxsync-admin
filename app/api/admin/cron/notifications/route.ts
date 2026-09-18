import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendWaitlistPromotedPush } from '@/lib/push';

/**
 * Drains `notification_outbox` — currently only populated by the
 * `tr_waitlist_promotion_notify` trigger, since waitlist promotion itself
 * happens inside a DB function not tracked in this repo and we can't hook it
 * directly.
 *
 * Hobby Vercel only allows a daily catch-up (`15 6 * * *`). Immediate drains
 * come from `tr_notification_outbox_drain` (pg_net POST with `{ id }`).
 */
async function drain(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const onlyId = await readOptionalId(request);

    let query = supabaseAdmin
      .from('notification_outbox')
      .select('id, user_id, kind, payload')
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(200);

    if (onlyId) {
      query = query.eq('id', onlyId);
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    let sent = 0;
    for (const row of rows || []) {
      const { data: claimed, error: claimError } = await supabaseAdmin
        .from('notification_outbox')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', row.id)
        .is('processed_at', null)
        .select('id')
        .maybeSingle();

      if (claimError) throw claimError;
      if (!claimed) continue;

      if (row.kind === 'waitlist_promoted') {
        const classId = (row.payload as { class_id?: string })?.class_id || '';
        await sendWaitlistPromotedPush(row.user_id, classId);
        sent++;
      }
    }

    return NextResponse.json({ message: `Notifications sent: ${sent}`, sent });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

async function readOptionalId(request: Request): Promise<string | undefined> {
  if (request.method === 'GET') return undefined;
  const text = await request.text();
  if (!text) return undefined;
  try {
    const body = JSON.parse(text) as { id?: unknown };
    return typeof body.id === 'string' ? body.id : undefined;
  } catch {
    return undefined;
  }
}

export async function GET(request: Request) {
  return drain(request);
}

export async function POST(request: Request) {
  return drain(request);
}
