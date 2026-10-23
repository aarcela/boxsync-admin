import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import {
  parseTenantTerms,
  patchTenantTermsSettings,
  type TenantTerms,
} from '../tenant-terms';

export const tenantTermsService = {
  async getForTenant(
    tenantId: string,
    client: SupabaseClient = supabase
  ): Promise<TenantTerms> {
    const { data, error } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();

    if (error) throw error;
    return parseTenantTerms(data?.settings);
  },

  async updateForTenant(
    tenantId: string,
    patch: Partial<TenantTerms>,
    client: SupabaseClient = supabase
  ): Promise<TenantTerms> {
    const { data: existing, error: readError } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();

    if (readError) throw readError;

    const nextSettings = patchTenantTermsSettings(existing?.settings, patch);

    const { data, error } = await client
      .from('tenants')
      .update({ settings: nextSettings })
      .eq('id', tenantId)
      .select('settings')
      .single();

    if (error) throw error;
    return parseTenantTerms(data?.settings);
  },
};
