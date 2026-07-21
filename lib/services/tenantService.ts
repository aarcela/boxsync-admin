import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import type { Tenant } from '../types/gym';

export const tenantService = {
  async getTenantBySlug(
    slug: string,
    client: SupabaseClient = supabase
  ): Promise<Tenant | null> {
    const { data, error } = await client
      .from('tenants')
      .select('id, slug, name, created_at, settings')
      .eq('slug', slug.toLowerCase())
      .maybeSingle();

    if (error) throw error;
    return data as Tenant | null;
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
    input: { slug: string; name: string; id?: string },
    client: SupabaseClient
  ): Promise<Tenant> {
    const slug = input.slug.trim().toLowerCase();
    const name = input.name.trim();

    const row: { slug: string; name: string; id?: string } = { slug, name };
    if (input.id) {
      row.id = input.id;
    }

    const { data, error } = await client
      .from('tenants')
      .insert([row])
      .select('id, slug, name, created_at, settings')
      .single();

    if (error) throw error;
    return data as Tenant;
  },

  async listTenants(client: SupabaseClient = supabase): Promise<Tenant[]> {
    const { data, error } = await client
      .from('tenants')
      .select('id, slug, name, created_at, settings')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as Tenant[];
  },

  async getTenantById(
    tenantId: string,
    client: SupabaseClient = supabase
  ): Promise<Tenant | null> {
    const { data, error } = await client
      .from('tenants')
      .select('id, slug, name, created_at, settings')
      .eq('id', tenantId)
      .maybeSingle();

    if (error) throw error;
    return data as Tenant | null;
  },
};
