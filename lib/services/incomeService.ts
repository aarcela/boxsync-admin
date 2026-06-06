import { supabase } from '../supabase';
import { IncomeRecord } from '@/lib/types/gym';

export const incomeService = {
  async getIncomes(startDate: string, endDate: string): Promise<IncomeRecord[]> {
    const { data, error } = await supabase
      .from('incomes')
      .select('*')
      .gte('income_date', startDate)
      .lte('income_date', endDate)
      .order('income_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async addIncome(income: Omit<IncomeRecord, 'id' | 'created_at'>): Promise<IncomeRecord> {
    const { data, error } = await supabase
      .from('incomes')
      .insert([income])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteIncome(id: string): Promise<void> {
    const { error } = await supabase
      .from('incomes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
