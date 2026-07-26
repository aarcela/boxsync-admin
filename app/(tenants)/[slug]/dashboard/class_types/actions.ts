'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminTenantId } from '@/lib/require-admin-tenant';
import { classTypeService } from '@/lib/services/classTypeService';
import { supabaseAdmin } from '@/lib/supabase-admin';

function parseClassTypeForm(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const color_hex = String(formData.get('color_hex') ?? '#ef4444').trim() || '#ef4444';
  const default_duration_min = Math.max(
    1,
    Math.min(480, Number(formData.get('default_duration_min')) || 60)
  );
  const is_open_box = formData.get('is_open_box') === 'true';
  const is_active = formData.get('is_active') === 'true';
  const sort_order = Number(formData.get('sort_order')) || 0;

  if (!name) {
    throw new Error('Name is required');
  }

  return {
    name,
    color_hex,
    default_duration_min,
    is_open_box,
    is_active,
    sort_order,
  };
}

export async function createClassTypeAction(formData: FormData) {
  const tenantId = await requireAdminTenantId();
  const input = parseClassTypeForm(formData);
  await classTypeService.createClassType(supabaseAdmin, tenantId, input);
  revalidatePath('/dashboard/class_types');
}

export async function updateClassTypeAction(id: string, formData: FormData) {
  const tenantId = await requireAdminTenantId();
  const previousName = String(formData.get('previous_name') ?? '').trim();
  const input = parseClassTypeForm(formData);
  await classTypeService.updateClassType(supabaseAdmin, tenantId, id, input, previousName);
  revalidatePath('/dashboard/class_types');
}

export async function toggleClassTypeStatusAction(id: string, is_active: boolean) {
  const tenantId = await requireAdminTenantId();
  await classTypeService.updateClassType(supabaseAdmin, tenantId, id, { is_active });
  revalidatePath('/dashboard/class_types');
}

export async function deleteClassTypeAction(id: string) {
  const tenantId = await requireAdminTenantId();
  await classTypeService.deleteClassType(supabaseAdmin, tenantId, id);
  revalidatePath('/dashboard/class_types');
}
