import { supabase } from '../supabase';
import { translations } from '@/lib/translations';
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type ExpenseRecord,
} from '@/lib/types/gym';

const CATEGORY_BY_LABEL: Record<string, ExpenseCategory> = {};
for (const category of EXPENSE_CATEGORIES) {
  CATEGORY_BY_LABEL[category] = category;
  for (const dict of Object.values(translations)) {
    const label = dict[category];
    if (typeof label === 'string' && label.length > 0) {
      CATEGORY_BY_LABEL[label] = category;
    }
  }
}

export function parseExpenseCategory(input: string): ExpenseCategory | null {
  return CATEGORY_BY_LABEL[input.trim()] ?? null;
}

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
    const category = parseExpenseCategory(expense.category);
    if (!category) {
      throw new Error(`Invalid expense category: ${expense.category}`);
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert([{ ...expense, category }])
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
  },

  async updateExpenseStatus(id: string, status: 'pending' | 'paid' | 'due'): Promise<void> {
    const { error } = await supabase
      .from('expenses')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
  }
};
