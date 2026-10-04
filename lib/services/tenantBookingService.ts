import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import {
  isBookingWindowsValid,
  parseBookingSettings,
  patchBookingSettings,
  type BookingSettings,
} from '../booking-settings';

export const tenantBookingService = {
  async getForTenant(
    tenantId: string,
    client: SupabaseClient = supabase
  ): Promise<BookingSettings> {
    const { data, error } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();

    if (error) throw error;
    return parseBookingSettings(data?.settings);
  },

  async updateForTenant(
    tenantId: string,
    patch: Partial<BookingSettings>,
    client: SupabaseClient = supabase
  ): Promise<BookingSettings> {
    const { data: existing, error: readError } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();

    if (readError) throw readError;

    const merged = {
      ...parseBookingSettings(existing?.settings),
      ...patch,
    };
    if (!isBookingWindowsValid(merged)) {
      throw new Error('BOOKING_WINDOWS_OVERLAP');
    }

    const { data, error } = await client
      .from('tenants')
      .update({ settings: patchBookingSettings(existing?.settings, patch) })
      .eq('id', tenantId)
      .select('settings')
      .single();

    if (error) throw error;
    return parseBookingSettings(data?.settings);
  },
};
