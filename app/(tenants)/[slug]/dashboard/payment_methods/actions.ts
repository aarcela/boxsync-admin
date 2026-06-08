'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminTenantId } from '@/lib/require-admin-tenant';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { paymentMethodService } from '@/lib/services/paymentMethodService';
import { CurrencyType } from '@/lib/types/gym';

export async function createPaymentMethodAction(formData: FormData) {
  const tenantId = await requireAdminTenantId();
  const label = formData.get('label') as string;
  const currency = formData.get('currency') as CurrencyType;
  const details = formData.get('details') as string;
  const is_active = formData.get('is_active') === 'true';

  await paymentMethodService.createPaymentMethod(supabaseAdmin, tenantId, {
    label,
    currency,
    details,
    is_active,
  });

  revalidatePath('/dashboard/payment_methods');
}

export async function updatePaymentMethodAction(id: string, formData: FormData) {
  const tenantId = await requireAdminTenantId();
  const label = formData.get('label') as string;
  const currency = formData.get('currency') as CurrencyType;
  const details = formData.get('details') as string;
  const is_active = formData.get('is_active') === 'true';

  await paymentMethodService.updatePaymentMethod(supabaseAdmin, tenantId, id, {
    label,
    currency,
    details,
    is_active,
  });

  revalidatePath('/dashboard/payment_methods');
}

export async function togglePaymentMethodStatusAction(id: string, is_active: boolean) {
  const tenantId = await requireAdminTenantId();
  await paymentMethodService.updatePaymentMethod(supabaseAdmin, tenantId, id, { is_active });
  revalidatePath('/dashboard/payment_methods');
}

export async function deletePaymentMethodAction(id: string) {
  const tenantId = await requireAdminTenantId();
  await paymentMethodService.deletePaymentMethod(supabaseAdmin, tenantId, id);
  revalidatePath('/dashboard/payment_methods');
}
