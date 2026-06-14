'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminTenantId } from '@/lib/require-admin-tenant';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { prMovementService } from '@/lib/services/prMovementService';
import type { PrCategory, PrRecordType } from '@/lib/types/pr';

function parseMovementForm(formData: FormData) {
  const slug = (formData.get('slug') as string)?.trim().toLowerCase();
  const name = (formData.get('name') as string)?.trim();
  const category = formData.get('category') as PrCategory;
  const record_type = formData.get('record_type') as PrRecordType;
  const sort_order = parseInt(formData.get('sort_order') as string, 10) || 0;
  const is_active = formData.get('is_active') === 'true';

  return { slug, name, category, record_type, sort_order, is_active };
}

export async function createPrMovementAction(formData: FormData) {
  const tenantId = await requireAdminTenantId();
  const { slug, name, category, record_type, sort_order, is_active } =
    parseMovementForm(formData);

  if (!slug || !name || !category || !record_type) {
    throw new Error('Missing required fields');
  }

  await prMovementService.createPrMovement(supabaseAdmin, tenantId, {
    slug,
    name,
    category,
    record_type,
    sort_order,
    is_active,
  });

  revalidatePath('/dashboard/personal_records');
}

export async function updatePrMovementAction(slug: string, formData: FormData) {
  const tenantId = await requireAdminTenantId();
  const { name, category, record_type, sort_order, is_active } =
    parseMovementForm(formData);

  if (!name || !category || !record_type) {
    throw new Error('Missing required fields');
  }

  await prMovementService.updatePrMovement(supabaseAdmin, tenantId, slug, {
    name,
    category,
    record_type,
    sort_order,
    is_active,
  });

  revalidatePath('/dashboard/personal_records');
}

export async function togglePrMovementStatusAction(
  slug: string,
  is_active: boolean
) {
  const tenantId = await requireAdminTenantId();
  await prMovementService.updatePrMovement(supabaseAdmin, tenantId, slug, {
    is_active,
  });
  revalidatePath('/dashboard/personal_records');
}

export async function deletePrMovementAction(slug: string) {
  const tenantId = await requireAdminTenantId();
  await prMovementService.deletePrMovement(supabaseAdmin, tenantId, slug);
  revalidatePath('/dashboard/personal_records');
}
