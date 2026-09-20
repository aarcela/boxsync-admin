import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import {
  parseOnboardingRequired,
  patchOnboardingRequiredSettings,
  type OnboardingRequired,
} from '../onboarding-required';

export const tenantOnboardingService = {
  async getForTenant(
    tenantId: string,
    client: SupabaseClient = supabase
  ): Promise<OnboardingRequired> {
    const { data, error } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();

    if (error) throw error;
    return parseOnboardingRequired(data?.settings);
  },

  async updateForTenant(
    tenantId: string,
    patch: Partial<OnboardingRequired>,
    client: SupabaseClient = supabase
  ): Promise<OnboardingRequired> {
    const { data: existing, error: readError } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();

    if (readError) throw readError;

    const { data, error } = await client
      .from('tenants')
      .update({ settings: patchOnboardingRequiredSettings(existing?.settings, patch) })
      .eq('id', tenantId)
      .select('settings')
      .single();

    if (error) throw error;
    return parseOnboardingRequired(data?.settings);
  },
};
