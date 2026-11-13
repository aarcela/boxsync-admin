'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminTenantId } from '@/lib/require-admin-tenant';
import { tenantBookingService } from '@/lib/services/tenantBookingService';
import { tenantOverdueService } from '@/lib/services/tenantOverdueService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { BookingSettings } from '@/lib/booking-settings';
import type { OverdueSettings } from '@/lib/overdue-settings';
import { isValidTimezone, patchGymTimezone } from '@/lib/gym-timezone';

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

export async function saveOverdueSettingsAction(patch: Partial<OverdueSettings>) {
  const tenantId = await requireAdminTenantId();
  const saved = await tenantOverdueService.updateForTenant(
    tenantId,
    patch,
    supabaseAdmin
  );
  revalidatePath('/dashboard/booking');
  return saved;
}

/** Saves the gym's local timezone (settings.timezone) and returns the full new settings. */
export async function saveGymTimezoneAction(timezone: string) {
  const tenantId = await requireAdminTenantId();
  if (!isValidTimezone(timezone)) throw new Error('INVALID_TIMEZONE');

  const { data: existing, error: readError } = await supabaseAdmin
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .single();
  if (readError) throw readError;

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .update({ settings: patchGymTimezone(existing?.settings, timezone) })
    .eq('id', tenantId)
    .select('settings')
    .single();
  if (error) throw error;

  revalidatePath('/dashboard', 'layout');
  return data?.settings ?? null;
}
