import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export const tenantSupportService = {
  async getForTenant(tenantId: string, client: SupabaseClient = supabase): Promise<string> {
    const { data, error } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();

    if (error) throw error;
    const settings = data?.settings as { supportWhatsApp?: string } | null;
    return settings?.supportWhatsApp || '';
  },

  async updateForTenant(
    tenantId: string,
    supportWhatsApp: string,
    client: SupabaseClient = supabase
  ): Promise<string> {
    const { data: existing, error: readError } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();

    if (readError) throw readError;

    const currentSettings =
      existing?.settings && typeof existing.settings === 'object'
        ? (existing.settings as Record<string, unknown>)
        : {};

    const nextSettings = {
      ...currentSettings,
      supportWhatsApp,
    };

    const { data, error } = await client
      .from('tenants')
      .update({ settings: nextSettings })
      .eq('id', tenantId)
      .select('settings')
      .single();

    if (error) throw error;
    const settings = data?.settings as { supportWhatsApp?: string } | null;
    return settings?.supportWhatsApp || '';
  },
};
