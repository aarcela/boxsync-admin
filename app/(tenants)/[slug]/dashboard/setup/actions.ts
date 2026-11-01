'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminTenantId } from '@/lib/require-admin-tenant';
import { tenantService } from '@/lib/services/tenantService';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function saveGymNameAction(name: string) {
  const tenantId = await requireAdminTenantId();
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) {
    throw new Error('Invalid gym name.');
  }
  const tenant = await tenantService.updateTenant(tenantId, { name: trimmed }, supabaseAdmin);
  revalidatePath('/dashboard/setup');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/appearance');
  return tenant.name;
}
