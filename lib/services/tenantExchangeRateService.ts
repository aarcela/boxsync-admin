import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import {
  DEFAULT_EXCHANGE_RATE_CONFIG,
  parseTenantExchangeRateConfig,
  type TenantExchangeRateConfig,
} from '../currency';

export const tenantExchangeRateService = {
  async getForTenant(
    tenantId: string,
    client: SupabaseClient = supabase
  ): Promise<TenantExchangeRateConfig> {
    const { data, error } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();

    if (error) throw error;
    return parseTenantExchangeRateConfig(data?.settings);
  },

  async updateForTenant(
    tenantId: string,
    config: TenantExchangeRateConfig,
    client: SupabaseClient = supabase
  ): Promise<TenantExchangeRateConfig> {
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
      exchangeRate: {
        baseSource: config.baseSource,
        marginPercent: config.marginPercent,
        customRate: config.baseSource === 'custom' ? config.customRate : null,
      },
    };

    const { data, error } = await client
      .from('tenants')
      .update({ settings: nextSettings })
      .eq('id', tenantId)
      .select('settings')
      .single();

    if (error) throw error;
    return parseTenantExchangeRateConfig(data?.settings);
  },

  defaults(): TenantExchangeRateConfig {
    return { ...DEFAULT_EXCHANGE_RATE_CONFIG };
  },
};
