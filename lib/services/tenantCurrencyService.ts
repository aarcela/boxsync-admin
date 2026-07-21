import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import {
  DEFAULT_TENANT_CURRENCIES,
  parseTenantCurrencyConfig,
  type TenantCurrencyConfig,
  type CurrencyType,
} from '../currency';

export const tenantCurrencyService = {
  async getForTenant(
    tenantId: string,
    client: SupabaseClient = supabase
  ): Promise<TenantCurrencyConfig> {
    const { data, error } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();

    if (error) throw error;
    return parseTenantCurrencyConfig(data?.settings);
  },

  async updateForTenant(
    tenantId: string,
    config: TenantCurrencyConfig,
    client: SupabaseClient = supabase
  ): Promise<TenantCurrencyConfig> {
    if (config.reference === config.local) {
      throw new Error('Reference and local currencies must be different.');
    }

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
      currencies: {
        reference: config.reference,
        local: config.local,
      },
    };

    const { data, error } = await client
      .from('tenants')
      .update({ settings: nextSettings })
      .eq('id', tenantId)
      .select('settings')
      .single();

    if (error) throw error;
    return parseTenantCurrencyConfig(data?.settings);
  },

  defaults(): TenantCurrencyConfig {
    return { ...DEFAULT_TENANT_CURRENCIES };
  },

  pairLabel(config: TenantCurrencyConfig): string {
    return `${config.reference} / ${config.local}`;
  },

  resolveRole(
    code: CurrencyType | string,
    config: TenantCurrencyConfig
  ): 'reference' | 'local' {
    return code === config.local ? 'local' : 'reference';
  },
};
