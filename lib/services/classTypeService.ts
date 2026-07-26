import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_CLASS_TYPE_SEEDS } from '../constants/classTypes';
import { ensureRowTenantId } from '../ensure-row-tenant-id';
import { supabase } from '../supabase';
import { ClassTypeInput, ClassTypeRow } from '../types/gym';

export const classTypeService = {
  async getClassTypes(tenantId?: string, activeOnly = false): Promise<ClassTypeRow[]> {
    let query = supabase
      .from('class_types')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as ClassTypeRow[];
  },

  async seedDefaultsForTenant(client: SupabaseClient, tenantId: string): Promise<void> {
    const { error } = await client.from('class_types').upsert(
      DEFAULT_CLASS_TYPE_SEEDS.map((seed) => ({
        ...seed,
        tenant_id: tenantId,
      })),
      { onConflict: 'tenant_id,name', ignoreDuplicates: true }
    );
    if (error) throw error;
  },

  async createClassType(
    client: SupabaseClient,
    tenantId: string,
    input: ClassTypeInput
  ): Promise<ClassTypeRow> {
    const { data, error } = await client
      .from('class_types')
      .insert([{ ...input, tenant_id: tenantId }])
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Insert returned no row');

    const saved = await ensureRowTenantId(client, 'class_types', data, tenantId);

    // Keep salary rate matrix complete for existing tiers
    const { data: tiers } = await client
      .from('coach_salary_tiers')
      .select('id')
      .eq('tenant_id', tenantId);

    if (tiers?.length) {
      await client.from('coach_salary_tier_rates').upsert(
        tiers.map((tier) => ({
          tenant_id: tenantId,
          tier_id: tier.id,
          class_type: input.name,
          rate_usd: 0,
        })),
        { onConflict: 'tier_id,class_type', ignoreDuplicates: true }
      );
    }

    return saved as ClassTypeRow;
  },

  async updateClassType(
    client: SupabaseClient,
    tenantId: string,
    id: string,
    updates: Partial<ClassTypeInput>,
    previousName?: string
  ): Promise<ClassTypeRow> {
    const { data, error } = await client
      .from('class_types')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error) throw error;

    const newName = updates.name?.trim();
    if (previousName && newName && newName !== previousName) {
      const { error: classesError } = await client
        .from('classes')
        .update({ class_type: newName })
        .eq('tenant_id', tenantId)
        .eq('class_type', previousName);
      if (classesError) throw classesError;

      const { error: ratesError } = await client
        .from('coach_salary_tier_rates')
        .update({ class_type: newName })
        .eq('tenant_id', tenantId)
        .eq('class_type', previousName);
      if (ratesError) throw ratesError;
    }

    return data as ClassTypeRow;
  },

  async deleteClassType(client: SupabaseClient, tenantId: string, id: string): Promise<void> {
    const { data: row, error: fetchError } = await client
      .from('class_types')
      .select('name')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError) throw fetchError;

    const { count, error: countError } = await client
      .from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('class_type', row.name);

    if (countError) throw countError;
    if ((count ?? 0) > 0) {
      throw new Error('Cannot delete a class type that is used by existing classes. Deactivate it instead.');
    }

    const { error: ratesError } = await client
      .from('coach_salary_tier_rates')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('class_type', row.name);
    if (ratesError) throw ratesError;

    const { error } = await client
      .from('class_types')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  },
};
