import { NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/require-staff-api';
import { sendExpiryReminderWhatsApp } from '@/lib/whatsapp';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { Language } from '@/lib/translations';

const MONTHLY_VALIDITY_DAYS = 31;

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const messageLanguage: Language =
      body.language === 'es' || body.language === 'en' ? body.language : 'en';

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const tenantId = staffAuth.profile.tenant_id as string | null;
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context.' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, role, tenant_id, plan, plan_period_start, is_solvent')
      .eq('id', id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (profile.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (profile.role !== 'member') {
      return NextResponse.json(
        { error: 'Only members can receive expiry reminders.' },
        { status: 400 }
      );
    }

    const phone = profile.phone?.trim();
    if (!phone) {
      return NextResponse.json(
        { error: 'Member has no phone number on file.' },
        { status: 400 }
      );
    }

    const fullName = profile.full_name?.trim() || 'Member';
    let planName: string | undefined;
    let expiryDate: Date | null = null;

    if (profile.plan) {
      const { data: planData } = await supabaseAdmin
        .from('membership_plans')
        .select('name, limit_type, validity_days')
        .eq('id', profile.plan)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      planName = planData?.name ?? undefined;

      if (
        planData?.limit_type === 'period' &&
        profile.plan_period_start &&
        planData.validity_days != null &&
        planData.validity_days > 0
      ) {
        expiryDate = addDays(new Date(profile.plan_period_start), planData.validity_days);
      }
    }

    if (!expiryDate) {
      const { data: lastPayment } = await supabaseAdmin
        .from('payments')
        .select('created_at')
        .eq('user_id', id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastPayment?.created_at) {
        expiryDate = addDays(new Date(lastPayment.created_at), MONTHLY_VALIDITY_DAYS);
      }
    }

    const today = startOfDay(new Date());
    const isExpired = Boolean(
      !profile.is_solvent ||
        (expiryDate && startOfDay(expiryDate) < today)
    );

    let whatsappWarning: string | undefined;

    try {
      await sendExpiryReminderWhatsApp({
        phone,
        fullName,
        language: messageLanguage,
        expiryDate,
        planName,
        isExpired,
      });
    } catch (whatsappError) {
      console.error('Expiry reminder WhatsApp failed:', whatsappError);
      whatsappWarning = 'Expiry reminder WhatsApp message could not be sent.';
    }

    if (whatsappWarning) {
      return NextResponse.json({ error: whatsappWarning }, { status: 500 });
    }

    return NextResponse.json({ success: true, reminderSent: true });
  } catch (error: unknown) {
    console.error('Send Expiry Reminder Error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
