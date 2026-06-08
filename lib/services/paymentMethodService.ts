import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureRowTenantId } from '../ensure-row-tenant-id';
import { supabase } from '../supabase';
import { PaymentMethod } from '../types/gym';

export const paymentMethodService = {
  async getPaymentMethods(tenantId?: string): Promise<PaymentMethod[]> {
    let query = supabase.from('payment_methods').select('*').order('label', { ascending: true });
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    const { data, error } = await query;

    if (error) throw error;
    return data as PaymentMethod[];
  },

  async createPaymentMethod(
    client: SupabaseClient,
    tenantId: string,
    paymentMethod: Omit<PaymentMethod, 'id' | 'created_at' | 'tenant_id'>
  ): Promise<PaymentMethod> {
    const { data, error } = await client
      .from('payment_methods')
      .insert([{ ...paymentMethod, tenant_id: tenantId }])
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Insert returned no row');

    const saved = await ensureRowTenantId(client, 'payment_methods', data, tenantId);
    return saved as PaymentMethod;
  },

  async updatePaymentMethod(
    client: SupabaseClient,
    tenantId: string,
    id: string,
    updates: Partial<Omit<PaymentMethod, 'id' | 'created_at' | 'tenant_id'>>
  ): Promise<PaymentMethod> {
    const { data, error } = await client
      .from('payment_methods')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error) throw error;
    return data as PaymentMethod;
  },

  async deletePaymentMethod(client: SupabaseClient, tenantId: string, id: string): Promise<void> {
    const { error } = await client
      .from('payment_methods')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  },
};
