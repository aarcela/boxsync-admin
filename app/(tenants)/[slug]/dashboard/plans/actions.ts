'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminTenantId } from '@/lib/require-admin-tenant';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { membershipPlanService } from '@/lib/services/membershipPlanService';
import type { PlanLimitType } from '@/lib/types/gym';

function parseOptionalInt(raw: FormDataEntryValue | null): number | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error('Invalid number');
  }
  return parsed;
}

function parseLimitType(raw: FormDataEntryValue | null): PlanLimitType {
  const value = String(raw ?? 'none');
  if (value === 'weekly' || value === 'period' || value === 'none') {
    return value;
  }
  throw new Error('Invalid limit type');
}

function parsePlanForm(formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const description = ((formData.get('description') as string) || '').trim() || null;
  const priceRaw = formData.get('price_usd') as string;
  const is_active = formData.get('is_active') === 'true';
  const limit_type = parseLimitType(formData.get('limit_type'));

  let weekly_limit: number | null = null;
  let session_limit: number | null = null;
  let validity_days: number | null = null;

  if (limit_type === 'weekly') {
    weekly_limit = parseOptionalInt(formData.get('weekly_limit'));
    if (weekly_limit == null) {
      throw new Error('Weekly limit required');
    }
  } else if (limit_type === 'period') {
    session_limit = parseOptionalInt(formData.get('session_limit'));
    validity_days = parseOptionalInt(formData.get('validity_days'));
    if (session_limit == null || validity_days == null) {
      throw new Error('Session limit and validity days required');
    }
  }

  const price_usd = Number(priceRaw);
  if (!name || Number.isNaN(price_usd) || price_usd < 0) {
    throw new Error('Invalid plan data');
  }

  return {
    name,
    description,
    price_usd,
    is_active,
    limit_type,
    weekly_limit,
    session_limit,
    validity_days,
  };
}

async function getMemberCountForPlan(tenantId: string, planId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('plan', planId);

  if (error) throw error;
  return count ?? 0;
}

export async function createMembershipPlanAction(formData: FormData) {
  const tenantId = await requireAdminTenantId();
  const plan = parsePlanForm(formData);

  await membershipPlanService.createMembershipPlan(supabaseAdmin, tenantId, plan);
  revalidatePath('/dashboard/plans');
}

export async function updateMembershipPlanAction(id: string, formData: FormData) {
  const tenantId = await requireAdminTenantId();
  const plan = parsePlanForm(formData);

  await membershipPlanService.updateMembershipPlan(supabaseAdmin, tenantId, id, plan);
  revalidatePath('/dashboard/plans');
}

export async function toggleMembershipPlanStatusAction(id: string, is_active: boolean) {
  const tenantId = await requireAdminTenantId();
  await membershipPlanService.updateMembershipPlan(supabaseAdmin, tenantId, id, { is_active });
  revalidatePath('/dashboard/plans');
}

export async function deleteMembershipPlanAction(id: string) {
  const tenantId = await requireAdminTenantId();

  const memberCount = await getMemberCountForPlan(tenantId, id);
  if (memberCount > 0) {
    throw new Error('Plan in use by athletes');
  }

  await membershipPlanService.deleteMembershipPlan(supabaseAdmin, tenantId, id);
  revalidatePath('/dashboard/plans');
}
