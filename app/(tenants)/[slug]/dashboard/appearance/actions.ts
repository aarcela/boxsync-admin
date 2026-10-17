'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminTenantId } from '@/lib/require-admin-tenant';
import { resolvePaletteId } from '@/lib/constants/appPalettes';
import { tenantFeaturesService } from '@/lib/services/tenantFeaturesService';
import { tenantPaletteService } from '@/lib/services/tenantPaletteService';
import { milestoneService } from '@/lib/services/milestoneService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { TenantFeatures } from '@/lib/tenant-features';
import type { MilestoneSettings } from '@/lib/types/milestone';

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

export async function saveTenantFeaturesAction(patch: Partial<TenantFeatures>) {
  const tenantId = await requireAdminTenantId();
  const saved = await tenantFeaturesService.updateForTenant(
    tenantId,
    patch,
    supabaseAdmin
  );
  revalidatePath('/dashboard/appearance');
  revalidatePath('/dashboard');
  return saved;
}

export async function saveMilestoneSettingsAction(patch: Partial<MilestoneSettings>) {
  const tenantId = await requireAdminTenantId();
  await milestoneService.updateTenantMilestoneSettings(tenantId, patch);
  const saved = await milestoneService.getTenantMilestoneSettings(tenantId);
  revalidatePath('/dashboard/appearance');
  return saved;
}

export async function getMilestoneSettingsAction() {
  const tenantId = await requireAdminTenantId();
  return await milestoneService.getTenantMilestoneSettings(tenantId);
}
