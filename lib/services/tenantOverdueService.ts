import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import {
  parseOverdueSettings,
  patchOverdueSettings,
  type OverdueSettings,
} from '../overdue-settings';

export const tenantOverdueService = {
  async getForTenant(
    tenantId: string,
    client: SupabaseClient = supabase
  ): Promise<OverdueSettings> {
    const { data, error } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();

    if (error) throw error;
    return parseOverdueSettings(data?.settings);
  },

  async updateForTenant(
    tenantId: string,
    patch: Partial<OverdueSettings>,
    client: SupabaseClient = supabase
  ): Promise<OverdueSettings> {
    const { data: existing, error: readError } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();

    if (readError) throw readError;

    const { data, error } = await client
      .from('tenants')
      .update({ settings: patchOverdueSettings(existing?.settings, patch) })
      .eq('id', tenantId)
      .select('settings')
      .single();

    if (error) throw error;
    return parseOverdueSettings(data?.settings);
  },
};
