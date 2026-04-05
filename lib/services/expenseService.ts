import { supabase } from '../supabase';
import { 
  CurrencyType, 
  ExpenseCategory, 
  ExpenseRecord 
} from '@/lib/types/gym';

export const expenseService = {
  async getExpenses(startDate: string, endDate: string): Promise<ExpenseRecord[]> {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)
      .order('expense_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async addExpense(expense: Omit<ExpenseRecord, 'id' | 'created_at'>): Promise<ExpenseRecord> {
    const { data, error } = await supabase
      .from('expenses')
      .insert([expense])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteExpense(id: string): Promise<void> {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
