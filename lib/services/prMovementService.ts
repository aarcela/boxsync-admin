import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { PrMovement } from '../types/pr';

type PrMovementInput = Omit<PrMovement, 'created_at' | 'tenant_id'>;

export const prMovementService = {
  async getPrMovements(tenantId: string): Promise<PrMovement[]> {
    const { data, error } = await supabase
      .from('pr_movements')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return data as PrMovement[];
  },

  async createPrMovement(
    client: SupabaseClient,
    tenantId: string,
    movement: PrMovementInput
  ): Promise<PrMovement> {
    const { data, error } = await client
      .from('pr_movements')
      .insert([{ ...movement, tenant_id: tenantId }])
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Insert returned no row');
    return data as PrMovement;
  },

  async updatePrMovement(
    client: SupabaseClient,
    tenantId: string,
    slug: string,
    updates: Partial<Omit<PrMovementInput, 'slug'>>
  ): Promise<PrMovement> {
    const { data, error } = await client
      .from('pr_movements')
      .update(updates)
      .eq('slug', slug)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error) throw error;
    return data as PrMovement;
  },

  async deletePrMovement(
    client: SupabaseClient,
    tenantId: string,
    slug: string
  ): Promise<void> {
    const { error } = await client
      .from('pr_movements')
      .delete()
      .eq('slug', slug)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  },
};
