import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendExpiryReminderPush } from '@/lib/push';

const MONTHLY_VALIDITY_DAYS = 31;
const REMINDER_DAYS_BEFORE = 3;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000);
}

/**
 * Notifies solvent members whose membership expires in REMINDER_DAYS_BEFORE
 * days. Runs one pass per member (this product's tenants run 80-300 members,
 * per its own marketing copy — not built to scale past that without batching
 * the plan/payment lookups).
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
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id, plan, plan_period_start, created_at, last_expiry_reminder_sent_at')
      .eq('role', 'member')
      .eq('is_solvent', true);

    if (error) throw error;

    const today = new Date();
    let sent = 0;

    for (const profile of profiles || []) {
      let expiryDate: Date | null = null;

      if (profile.plan) {
        const { data: plan } = await supabaseAdmin
          .from('membership_plans')
          .select('limit_type, validity_days')
          .eq('id', profile.plan)
          .maybeSingle();

        if (
          plan?.limit_type === 'period' &&
          profile.plan_period_start &&
          plan.validity_days != null &&
          plan.validity_days > 0
        ) {
          expiryDate = addDays(new Date(profile.plan_period_start), plan.validity_days);
        }
      }

      if (!expiryDate && profile.plan_period_start) {
        expiryDate = new Date(profile.plan_period_start);
      }

      if (!expiryDate && profile.created_at) {
        expiryDate = addDays(new Date(profile.created_at), MONTHLY_VALIDITY_DAYS);
      }

      if (!expiryDate) continue;

      const daysLeft = daysBetween(expiryDate, today);
      if (daysLeft !== REMINDER_DAYS_BEFORE) continue;

      const alreadySentForThisCycle =
        profile.last_expiry_reminder_sent_at &&
        daysBetween(new Date(profile.last_expiry_reminder_sent_at), today) < 1;
      if (alreadySentForThisCycle) continue;

      await sendExpiryReminderPush(profile.id, daysLeft);
      await supabaseAdmin
        .from('profiles')
        .update({ last_expiry_reminder_sent_at: today.toISOString() })
        .eq('id', profile.id);
      sent++;
    }

    return NextResponse.json({ message: `Expiry reminders sent: ${sent}`, sent });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
