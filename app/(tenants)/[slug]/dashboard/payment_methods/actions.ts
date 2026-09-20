'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminTenantId } from '@/lib/require-admin-tenant';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { paymentMethodService } from '@/lib/services/paymentMethodService';
import { PaymentMethodType, PaymentMethodFields } from '@/lib/types/gym';
import { PAYMENT_METHOD_FIELD_DEFS } from '@/lib/payment-method-fields';

function readStructuredFields(formData: FormData, methodType: PaymentMethodType): PaymentMethodFields {
  if (methodType === 'otro') return {};
  const defs = PAYMENT_METHOD_FIELD_DEFS[methodType];
  const fields: PaymentMethodFields = {};
  for (const def of defs) {
    const value = formData.get(`field_${def.key}`);
    if (typeof value === 'string' && value.trim()) {
      fields[def.key] = value.trim();
    }
  }
  return fields;
}

export async function createPaymentMethodAction(formData: FormData) {
  const tenantId = await requireAdminTenantId();
  const label = formData.get('label') as string;
  const currency = formData.get('currency') as string;
  const method_type = (formData.get('method_type') as PaymentMethodType) || 'otro';
  const details = formData.get('details') as string;
  const is_active = formData.get('is_active') === 'true';
  const fields = readStructuredFields(formData, method_type);

  await paymentMethodService.createPaymentMethod(supabaseAdmin, tenantId, {
    label,
    currency,
    method_type,
    fields,
    details: method_type === 'otro' ? (details || '') : '',
    is_active,
  });

  revalidatePath('/dashboard/payment_methods');
}

export async function updatePaymentMethodAction(id: string, formData: FormData) {
  const tenantId = await requireAdminTenantId();
  const label = formData.get('label') as string;
  const currency = formData.get('currency') as string;
  const method_type = (formData.get('method_type') as PaymentMethodType) || 'otro';
  const details = formData.get('details') as string;
  const is_active = formData.get('is_active') === 'true';
  const fields = readStructuredFields(formData, method_type);

  await paymentMethodService.updatePaymentMethod(supabaseAdmin, tenantId, id, {
    label,
    currency,
    method_type,
    fields,
    details: method_type === 'otro' ? (details || '') : '',
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
