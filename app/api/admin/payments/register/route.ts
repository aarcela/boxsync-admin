import { NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/require-staff-api';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildPaymentApprovedProfileUpdate } from '@/lib/plan-period';
import { sendPaymentApprovedPush } from '@/lib/push';

/**
 * Staff records a payment taken at the desk (cash, transfer seen in person…).
 * It is stored already APPROVED — there is no proof to review — and then the
 * membership is renewed exactly like approving an athlete-uploaded proof
 * (partial payments leave the period open until the plan price is covered).
 *
 * Service role is used for the insert/update because payments RLS is written
 * for athletes inserting their own rows; tenant ownership is verified first.
 */
export async function POST(request: Request) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  try {
    const body = (await request.json()) as {
      userId?: string;
      amount?: number;
      currency?: string;
      referenceAmount?: number | null;
      exchangeRate?: number | null;
      paymentMethodId?: string | null;
      method?: string;
    };

    const staffTenantId = staffAuth.profile.tenant_id as string | null;
    const amount = Number(body.amount);
    const referenceAmount =
      body.referenceAmount == null ? null : Number(body.referenceAmount);

    if (!staffTenantId) {
      return NextResponse.json({ error: 'Missing tenant context.' }, { status: 400 });
    }
    if (!body.userId || !body.currency || !body.method || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (referenceAmount != null && (!Number.isFinite(referenceAmount) || referenceAmount < 0)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const { data: member, error: memberError } = await supabaseAdmin
      .from('profiles')
      .select('id, tenant_id, plan_period_start')
      .eq('id', body.userId)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member || member.tenant_id !== staffTenantId) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    if (body.paymentMethodId) {
      const { data: method } = await supabaseAdmin
        .from('payment_methods')
        .select('id')
        .eq('id', body.paymentMethodId)
        .eq('tenant_id', staffTenantId)
        .maybeSingle();
      if (!method) {
        return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
      }
    }

    const row = {
      user_id: member.id,
      tenant_id: staffTenantId,
      amount,
      currency: body.currency,
      status: 'approved' as const,
      method: body.method,
      payment_method_id: body.paymentMethodId ?? null,
      exchange_rate_at_time: body.exchangeRate ?? null,
      reference_currency_amount: referenceAmount,
      plan_period_start: member.plan_period_start ?? null,
      proof_image_url: null as string | null,
    };

    let { data: payment, error: insertError } = await supabaseAdmin
      .from('payments')
      .insert(row)
      .select('id')
      .single();
    // Older schemas keep proof_image_url NOT NULL — store an empty path instead.
    if (insertError?.code === '23502') {
      ({ data: payment, error: insertError } = await supabaseAdmin
        .from('payments')
        .insert({ ...row, proof_image_url: '' })
        .select('id')
        .single());
    }
    if (insertError) throw insertError;

    const profileUpdate = await buildPaymentApprovedProfileUpdate(supabaseAdmin, member.id, staffTenantId);
    if (profileUpdate) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdate)
        .eq('id', member.id)
        .eq('tenant_id', staffTenantId);
      if (profileError) throw profileError;
    }

    try {
      await sendPaymentApprovedPush(member.id);
    } catch (pushError) {
      console.error('Register payment push failed:', pushError);
    }

    return NextResponse.json({ id: payment?.id, activated: Boolean(profileUpdate) });
  } catch (error: unknown) {
    console.error('Register payment error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
