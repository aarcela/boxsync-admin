'use server';

import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { membershipPlanService } from '@/lib/services/membershipPlanService';

const ADMIN_ONLY = 'Only admins can manage membership plans.';

async function requireAdminTenant() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Route handlers may run without mutable cookies
          }
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    throw new Error(ADMIN_ONLY);
  }

  if (!profile.tenant_id) {
    throw new Error('Missing tenant context.');
  }

  return { supabase, tenantId: profile.tenant_id as string };
}

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
  const { supabase, tenantId } = await requireAdminTenant();
  const plan = parsePlanForm(formData);

  await membershipPlanService.createMembershipPlan(supabase, tenantId, plan);
  revalidatePath('/dashboard/plans');
}

export async function updateMembershipPlanAction(id: string, formData: FormData) {
  const { supabase, tenantId } = await requireAdminTenant();
  const plan = parsePlanForm(formData);

  await membershipPlanService.updateMembershipPlan(supabase, tenantId, id, plan);
  revalidatePath('/dashboard/plans');
}

export async function toggleMembershipPlanStatusAction(id: string, is_active: boolean) {
  const { supabase, tenantId } = await requireAdminTenant();
  await membershipPlanService.updateMembershipPlan(supabase, tenantId, id, { is_active });
  revalidatePath('/dashboard/plans');
}

export async function deleteMembershipPlanAction(id: string) {
  const { supabase, tenantId } = await requireAdminTenant();
  await membershipPlanService.deleteMembershipPlan(supabase, tenantId, id);
  revalidatePath('/dashboard/plans');
}
