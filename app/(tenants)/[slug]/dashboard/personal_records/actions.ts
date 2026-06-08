'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';
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
  const { slug, name, category, record_type, sort_order, is_active } =
    parseMovementForm(formData);

  if (!slug || !name || !category || !record_type) {
    throw new Error('Missing required fields');
  }

  const { error } = await supabaseAdmin.from('pr_movements').insert({
    slug,
    name,
    category,
    record_type,
    sort_order,
    is_active,
  });

  if (error) throw error;
  revalidatePath('/dashboard/personal_records');
}

export async function updatePrMovementAction(slug: string, formData: FormData) {
  const { name, category, record_type, sort_order, is_active } =
    parseMovementForm(formData);

  if (!name || !category || !record_type) {
    throw new Error('Missing required fields');
  }

  const { error } = await supabaseAdmin
    .from('pr_movements')
    .update({ name, category, record_type, sort_order, is_active })
    .eq('slug', slug);

  if (error) throw error;
  revalidatePath('/dashboard/personal_records');
}

export async function togglePrMovementStatusAction(
  slug: string,
  is_active: boolean
) {
  const { error } = await supabaseAdmin
    .from('pr_movements')
    .update({ is_active })
    .eq('slug', slug);

  if (error) throw error;
  revalidatePath('/dashboard/personal_records');
}

export async function deletePrMovementAction(slug: string) {
  const { error } = await supabaseAdmin
    .from('pr_movements')
    .delete()
    .eq('slug', slug);

  if (error) throw error;
  revalidatePath('/dashboard/personal_records');
}
