import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import type { Tenant } from '../types/gym';
import {
  DEFAULT_PLATFORM_PLAN,
  parsePlatformPlanId,
  trialEndsAtIso,
  type PlatformPlanId,
} from '../platform-plans';

export const TENANT_COLUMNS =
  'id, slug, name, created_at, settings, platform_plan, platform_plan_started_at, trial_ends_at, is_active, deactivated_at, deactivation_reason';

function normalizeTenant(row: Tenant): Tenant {
  return {
    ...row,
    platform_plan: parsePlatformPlanId(row.platform_plan),
  };
}

export const tenantService = {
  async getTenantBySlug(
    slug: string,
    client: SupabaseClient = supabase
  ): Promise<Tenant | null> {
    const { data, error } = await client
      .from('tenants')
      .select(TENANT_COLUMNS)
      .eq('slug', slug.toLowerCase())
      .maybeSingle();

    if (error) throw error;
    return data ? normalizeTenant(data as Tenant) : null;
  },

  async getTenantSlugById(
    tenantId: string,
    client: SupabaseClient = supabase
  ): Promise<string | null> {
    const { data, error } = await client
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .maybeSingle();

    if (error) throw error;
    return data?.slug ?? null;
  },

  async createTenant(
    input: { slug: string; name: string; id?: string; platform_plan?: PlatformPlanId },
    client: SupabaseClient
  ): Promise<Tenant> {
    const slug = input.slug.trim().toLowerCase();
    const name = input.name.trim();
    const platform_plan = parsePlatformPlanId(input.platform_plan ?? DEFAULT_PLATFORM_PLAN);
    const now = new Date();

    const row: Record<string, string> = {
      slug,
      name,
      platform_plan,
      platform_plan_started_at: now.toISOString(),
    };
    if (input.id) {
      row.id = input.id;
    }
    if (platform_plan === 'trial') {
      row.trial_ends_at = trialEndsAtIso(now);
    }

    const { data, error } = await client
      .from('tenants')
      .insert([row])
      .select(TENANT_COLUMNS)
      .single();

    if (error) throw error;
    return normalizeTenant(data as Tenant);
  },

  async listTenants(client: SupabaseClient = supabase): Promise<Tenant[]> {
    const { data, error } = await client
      .from('tenants')
      .select(TENANT_COLUMNS)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return ((data ?? []) as Tenant[]).map(normalizeTenant);
  },

  async getTenantById(
    tenantId: string,
    client: SupabaseClient = supabase
  ): Promise<Tenant | null> {
    const { data, error } = await client
      .from('tenants')
      .select(TENANT_COLUMNS)
      .eq('id', tenantId)
      .maybeSingle();

    if (error) throw error;
    return data ? normalizeTenant(data as Tenant) : null;
  },

  async updatePlatformPlan(
    tenantId: string,
    platform_plan: PlatformPlanId,
    client: SupabaseClient
  ): Promise<Tenant> {
    const now = new Date();
    const { data, error } = await client
      .from('tenants')
      .update({
        platform_plan,
        platform_plan_started_at: now.toISOString(),
        trial_ends_at: platform_plan === 'trial' ? trialEndsAtIso(now) : null,
      })
      .eq('id', tenantId)
      .select(TENANT_COLUMNS)
      .single();

    if (error) throw error;
    return normalizeTenant(data as Tenant);
  },

  async updateTenant(
    tenantId: string,
    input: { name?: string; slug?: string },
    client: SupabaseClient
  ): Promise<Tenant> {
    const { data, error } = await client
      .from('tenants')
      .update(input)
      .eq('id', tenantId)
      .select(TENANT_COLUMNS)
      .single();

    if (error) throw error;
    return normalizeTenant(data as Tenant);
  },

  async setActive(
    tenantId: string,
    is_active: boolean,
    deactivation_reason: string | null,
    client: SupabaseClient
  ): Promise<Tenant> {
    const { data, error } = await client
      .from('tenants')
      .update({
        is_active,
        deactivated_at: is_active ? null : new Date().toISOString(),
        deactivation_reason: is_active ? null : deactivation_reason,
      })
      .eq('id', tenantId)
      .select(TENANT_COLUMNS)
      .single();

    if (error) throw error;
    return normalizeTenant(data as Tenant);
  },

  async extendTrial(
    tenantId: string,
    days: number,
    client: SupabaseClient
  ): Promise<Tenant> {
    const { data: current, error: currentError } = await client
      .from('tenants')
      .select('trial_ends_at')
      .eq('id', tenantId)
      .single();

    if (currentError) throw currentError;
    const base = current.trial_ends_at && new Date(current.trial_ends_at) > new Date()
      ? new Date(current.trial_ends_at)
      : new Date();

    const { data, error } = await client
      .from('tenants')
      .update({ trial_ends_at: trialEndsAtIso(base, days) })
      .eq('id', tenantId)
      .select(TENANT_COLUMNS)
      .single();

    if (error) throw error;
    return normalizeTenant(data as Tenant);
  },
};
