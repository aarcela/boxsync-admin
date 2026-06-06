'use server';

import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { CLASS_TYPES } from '@/lib/constants/classTypes';
import { coachSalaryService } from '@/lib/services/coachSalaryService';

const ADMIN_ONLY = 'Only admins can manage coach salaries.';

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

function parseTierForm(formData: FormData) {
  const name = (formData.get('name') as string)?.trim();
  const description = ((formData.get('description') as string) || '').trim() || null;
  const is_active = formData.get('is_active') === 'true';

  if (!name) {
    throw new Error('Invalid tier data');
  }

  const rates = CLASS_TYPES.map((classType) => {
    const raw = formData.get(`rate_${classType}`) as string;
    const rate_usd = Number(raw);
    if (Number.isNaN(rate_usd) || rate_usd < 0) {
      throw new Error('Invalid rate data');
    }
    return { class_type: classType, rate_usd };
  });

  return { name, description, is_active, rates };
}

export async function createSalaryTierAction(formData: FormData) {
  const { supabase, tenantId } = await requireAdminTenant();
  const tier = parseTierForm(formData);

  await coachSalaryService.createTier(supabase, tenantId, tier);
  revalidatePath('/dashboard/salary');
}

export async function updateSalaryTierAction(id: string, formData: FormData) {
  const { supabase, tenantId } = await requireAdminTenant();
  const tier = parseTierForm(formData);

  await coachSalaryService.updateTier(supabase, tenantId, id, tier);
  revalidatePath('/dashboard/salary');
}

export async function deleteSalaryTierAction(id: string) {
  const { supabase, tenantId } = await requireAdminTenant();

  try {
    await coachSalaryService.deleteTier(supabase, tenantId, id);
  } catch (err) {
    if (err instanceof Error && err.message === 'TIER_HAS_ASSIGNED_COACHES') {
      throw new Error('Cannot delete tier with assigned coaches.');
    }
    throw err;
  }

  revalidatePath('/dashboard/salary');
}

export async function toggleSalaryTierStatusAction(id: string, is_active: boolean) {
  const { supabase, tenantId } = await requireAdminTenant();
  await coachSalaryService.toggleTierStatus(supabase, tenantId, id, is_active);
  revalidatePath('/dashboard/salary');
}

export async function assignCoachSalaryTierAction(
  coachId: string,
  tierId: string | null
) {
  const { supabase, tenantId } = await requireAdminTenant();
  await coachSalaryService.assignCoachTier(
    supabase,
    tenantId,
    coachId,
    tierId || null
  );
  revalidatePath('/dashboard/salary');
}
