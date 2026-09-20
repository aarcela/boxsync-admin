import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import {
  parseTenantFeatures,
  patchTenantFeaturesSettings,
  type TenantFeatures,
} from '../tenant-features';

export const tenantFeaturesService = {
  async getForTenant(
    tenantId: string,
    client: SupabaseClient = supabase
  ): Promise<TenantFeatures> {
    const { data, error } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();

    if (error) throw error;
    return parseTenantFeatures(data?.settings);
  },

  async updateForTenant(
    tenantId: string,
    patch: Partial<TenantFeatures>,
    client: SupabaseClient = supabase
  ): Promise<TenantFeatures> {
    const { data: existing, error: readError } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();

    if (readError) throw readError;

    const { data, error } = await client
      .from('tenants')
      .update({ settings: patchTenantFeaturesSettings(existing?.settings, patch) })
      .eq('id', tenantId)
      .select('settings')
      .single();

    if (error) throw error;
    return parseTenantFeatures(data?.settings);
  },
};
