'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminTenantId } from '@/lib/require-admin-tenant';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { membershipPlanService } from '@/lib/services/membershipPlanService';

function parsePlanForm(formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const description = ((formData.get('description') as string) || '').trim() || null;
  const priceRaw = formData.get('price_usd') as string;
  const weeklyLimitRaw = (formData.get('weekly_limit') as string)?.trim();
  const is_active = formData.get('is_active') === 'true';

  const price_usd = Number(priceRaw);
  if (!name || Number.isNaN(price_usd) || price_usd < 0) {
    throw new Error('Invalid plan data');
  }

  const weekly_limit =
    weeklyLimitRaw === '' ? null : Number(weeklyLimitRaw);
  if (weekly_limit !== null && (Number.isNaN(weekly_limit) || weekly_limit < 0)) {
    throw new Error('Invalid weekly limit');
  }

  return { name, description, price_usd, weekly_limit, is_active };
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
  await membershipPlanService.deleteMembershipPlan(supabaseAdmin, tenantId, id);
  revalidatePath('/dashboard/plans');
}
