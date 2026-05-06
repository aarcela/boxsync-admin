'use server';

import { revalidatePath } from 'next/cache';
import { paymentMethodService } from '@/lib/services/paymentMethodService';
import { CurrencyType } from '@/lib/types/gym';

export async function createPaymentMethodAction(formData: FormData) {
  const label = formData.get('label') as string;
  const currency = formData.get('currency') as CurrencyType;
  const details = formData.get('details') as string;
  const is_active = formData.get('is_active') === 'true';

  await paymentMethodService.createPaymentMethod({
    label,
    currency,
    details,
    is_active
  });

  revalidatePath('/dashboard/payment_methods');
}

export async function updatePaymentMethodAction(id: string, formData: FormData) {
  const label = formData.get('label') as string;
  const currency = formData.get('currency') as CurrencyType;
  const details = formData.get('details') as string;
  const is_active = formData.get('is_active') === 'true';

  await paymentMethodService.updatePaymentMethod(id, {
    label,
    currency,
    details,
    is_active
  });

  revalidatePath('/dashboard/payment_methods');
}

export async function togglePaymentMethodStatusAction(id: string, is_active: boolean) {
  await paymentMethodService.updatePaymentMethod(id, { is_active });
  revalidatePath('/dashboard/payment_methods');
}

export async function deletePaymentMethodAction(id: string) {
  await paymentMethodService.deletePaymentMethod(id);
  revalidatePath('/dashboard/payment_methods');
}
