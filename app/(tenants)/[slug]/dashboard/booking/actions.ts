'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminTenantId } from '@/lib/require-admin-tenant';
import { tenantBookingService } from '@/lib/services/tenantBookingService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { BookingSettings } from '@/lib/booking-settings';

export async function saveBookingSettingsAction(patch: BookingSettings | Partial<BookingSettings>) {
  const tenantId = await requireAdminTenantId();
  const saved = await tenantBookingService.updateForTenant(
    tenantId,
    patch,
    supabaseAdmin
  );
  revalidatePath('/dashboard/booking');
  return saved;
}
