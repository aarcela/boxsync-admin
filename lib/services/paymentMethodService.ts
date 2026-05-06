import { supabase } from '../supabase';
import { PaymentMethod } from '../types/gym';

export const paymentMethodService = {
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .order('label', { ascending: true });

    if (error) throw error;
    return data as PaymentMethod[];
  },

  async createPaymentMethod(paymentMethod: Omit<PaymentMethod, 'id' | 'created_at'>): Promise<PaymentMethod> {
    const { data, error } = await supabase
      .from('payment_methods')
      .insert([paymentMethod])
      .select()
      .single();

    if (error) throw error;
    return data as PaymentMethod;
  },

  async updatePaymentMethod(id: string, updates: Partial<Omit<PaymentMethod, 'id' | 'created_at'>>): Promise<PaymentMethod> {
    const { data, error } = await supabase
      .from('payment_methods')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as PaymentMethod;
  },

  async deletePaymentMethod(id: string): Promise<void> {
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
