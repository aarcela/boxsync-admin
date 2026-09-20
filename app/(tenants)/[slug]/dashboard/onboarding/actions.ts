'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminTenantId } from '@/lib/require-admin-tenant';
import { tenantOnboardingService } from '@/lib/services/tenantOnboardingService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { OnboardingRequired } from '@/lib/onboarding-required';

export async function saveOnboardingRequiredAction(patch: Partial<OnboardingRequired>) {
  const tenantId = await requireAdminTenantId();
  const saved = await tenantOnboardingService.updateForTenant(
    tenantId,
    patch,
    supabaseAdmin
  );
  revalidatePath('/dashboard/onboarding');
  return saved;
}
