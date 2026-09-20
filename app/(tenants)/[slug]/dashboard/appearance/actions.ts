'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminTenantId } from '@/lib/require-admin-tenant';
import { resolvePaletteId } from '@/lib/constants/appPalettes';
import { tenantPaletteService } from '@/lib/services/tenantPaletteService';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function saveTenantPaletteAction(paletteId: string) {
  const tenantId = await requireAdminTenantId();
  const saved = await tenantPaletteService.updateForTenant(
    tenantId,
    resolvePaletteId(paletteId),
    supabaseAdmin
  );
  revalidatePath('/dashboard/appearance');
  return saved;
}
