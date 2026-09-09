import type { SupabaseClient } from '@supabase/supabase-js';
import { nextMonthlyRenewDate, renewDateToIso } from './renew-date';
import type { PlanLimitType } from './types/gym';

export async function getPlanLimitType(
  supabase: SupabaseClient,
  planId: string,
  tenantId?: string
): Promise<PlanLimitType | null> {
  let query = supabase.from('membership_plans').select('limit_type, weekly_limit').eq('id', planId);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  const limitType = data?.limit_type as PlanLimitType | undefined;
  if (limitType) return limitType;
  if (data?.weekly_limit != null && data.weekly_limit > 0) return 'weekly';
  return 'none';
}

export interface PeriodBalance {
  due: number;
  paid: number;
  remaining: number;
}

/**
 * Sums approved payments' reference-currency-equivalent amount for the member's
 * currently open period (identified by the `plan_period_start` snapshot each
 * payment recorded at submission time), so partial payments ("abonos") in
 * different currencies can be combined toward the plan's price.
 */
export async function getMemberPeriodBalance(
  supabase: SupabaseClient,
  userId: string,
  planPriceRef: number,
  periodStart: string | null
): Promise<PeriodBalance> {
  let query = supabase
    .from('payments')
    .select('reference_currency_amount')
    .eq('user_id', userId)
    .eq('status', 'approved');
  query = periodStart ? query.eq('plan_period_start', periodStart) : query.is('plan_period_start', null);

  const { data: payments, error } = await query;
  if (error) throw error;
  const paid = (payments || []).reduce((sum, p) => sum + (p.reference_currency_amount || 0), 0);

  const remaining = Math.max(0, planPriceRef - paid);
  return { due: planPriceRef, paid, remaining };
}

/**
 * Called after a payment is approved. Only flips solvency / resets the period
 * once the sum of approved payments for the member's open period meets the
 * plan's price — a single partial payment no longer fully unlocks the period.
 */
export async function buildPaymentApprovedProfileUpdate(
  supabase: SupabaseClient,
  userId: string,
  tenantId?: string
): Promise<{ is_solvent: boolean; plan_period_start?: string } | null> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan, tenant_id, plan_period_start')
    .eq('id', userId)
    .single();

  if (profileError) throw profileError;
  if (!profile?.plan) {
    return buildMembershipActivationFields(supabase, userId, tenantId);
  }

  const resolvedTenantId = tenantId ?? profile?.tenant_id ?? undefined;
  const { data: plan, error: planError } = await supabase
    .from('membership_plans')
    .select('price_usd')
    .eq('id', profile.plan)
    .maybeSingle();
  if (planError) throw planError;

  const planPriceRef = Number(plan?.price_usd) || 0;
  const balance = await getMemberPeriodBalance(
    supabase,
    userId,
    planPriceRef,
    profile.plan_period_start ?? null
  );

  // Not enough paid yet for this period — leave solvency/period untouched;
  // the caller should surface "Parcial: debe $X" instead of marking solvent.
  if (balance.remaining > 0) {
    return null;
  }

  return buildMembershipActivationFields(supabase, userId, resolvedTenantId);
}

/**
 * Marks the member solvent and starts a new membership window.
 * Booking access is is_solvent; the renew date is what auto-expiry uses.
 */
export async function buildMembershipActivationFields(
  supabase: SupabaseClient,
  userId: string,
  tenantId?: string
): Promise<{ is_solvent: true; plan_period_start: string }> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan, tenant_id, plan_period_start')
    .eq('id', userId)
    .single();

  if (profileError) throw profileError;

  const resolvedTenantId = tenantId ?? profile?.tenant_id ?? undefined;
  const limitType = profile?.plan
    ? await getPlanLimitType(supabase, profile.plan, resolvedTenantId)
    : 'none';

  if (limitType === 'period') {
    return { is_solvent: true, plan_period_start: new Date().toISOString() };
  }

  return {
    is_solvent: true,
    plan_period_start: renewDateToIso(nextMonthlyRenewDate(profile?.plan_period_start)),
  };
}

export async function buildPlanChangeFields(
  supabase: SupabaseClient,
  newPlanId: string,
  tenantId?: string
): Promise<{ plan: string; plan_period_start?: string }> {
  const fields: { plan: string; plan_period_start?: string } = { plan: newPlanId };
  const limitType = await getPlanLimitType(supabase, newPlanId, tenantId);
  if (limitType === 'period') {
    fields.plan_period_start = new Date().toISOString();
  }
  return fields;
}
