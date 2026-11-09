import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export type TenantCheckinCode = {
  code: string;
  accept_legacy_qr: boolean;
  rotated_at: string;
};

export const checkinCodeService = {
  async get(client: SupabaseClient = supabase): Promise<TenantCheckinCode | null> {
    const { data, error } = await client
      .from('tenant_checkin_codes')
      .select('code, accept_legacy_qr, rotated_at')
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return data as TenantCheckinCode;
  },

  async rotate(client: SupabaseClient = supabase): Promise<string> {
    const { data, error } = await client.rpc('rotate_checkin_code');
    if (error) throw error;
    if (typeof data !== 'string' || !data) {
      throw new Error('rotate_checkin_code_empty');
    }
    return data;
  },

  async setAcceptLegacy(
    value: boolean,
    client: SupabaseClient = supabase
  ): Promise<void> {
    const { error } = await client.rpc('set_accept_legacy_qr', {
      p_value: value,
    });
    if (error) throw error;
  },
};
