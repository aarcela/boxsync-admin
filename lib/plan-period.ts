import type { SupabaseClient } from '@supabase/supabase-js';
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

export async function buildPaymentApprovedProfileUpdate(
  supabase: SupabaseClient,
  userId: string,
  tenantId?: string
): Promise<{ is_solvent: boolean; plan_period_start?: string }> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan, tenant_id')
    .eq('id', userId)
    .single();

  if (profileError) throw profileError;

  const update: { is_solvent: boolean; plan_period_start?: string } = { is_solvent: true };
  const resolvedTenantId = tenantId ?? profile?.tenant_id ?? undefined;

  if (profile?.plan) {
    const limitType = await getPlanLimitType(supabase, profile.plan, resolvedTenantId);
    if (limitType === 'period') {
      update.plan_period_start = new Date().toISOString();
    }
  }

  return update;
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
