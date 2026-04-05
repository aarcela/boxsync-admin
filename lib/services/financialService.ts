import { supabase } from '../supabase';
import { 
  CurrencyType, 
  PaymentMethod, 
  PaymentRecord, 
  CurrencyStats, 
  FinancialStats 
} from '@/lib/types/gym';

const PLAN_PRICES_EUR: Record<string, number> = { 
  unlimited: 80, 
  '5x_week': 70, 
  '4x_week': 60, 
  '3x_week': 50, 
  'open_box': 40 
};

export const financialService = {
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const { data, error } = await supabase.from('payment_methods').select('*');
    if (error) throw error;
    return data || [];
  },

  async getPayments(startDate: string, endDate: string): Promise<PaymentRecord[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*, profiles ( full_name )')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getMemberStats(): Promise<{ active: number; inactive: number; projectedEUR: number; overdueEUR: number }> {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('is_solvent, plan')
      .eq('role', 'member');

    if (error) throw error;

    let active = 0;
    let inactive = 0;
    let projectedEUR = 0;
    let overdueEUR = 0;

    profiles?.forEach(p => {
      const price = PLAN_PRICES_EUR[p.plan] || 0;
      projectedEUR += price;
      if (p.is_solvent) {
        active++;
      } else {
        inactive++;
        overdueEUR += price;
      }
    });

    return { active, inactive, projectedEUR, overdueEUR };
  },

  async approvePayment(paymentId: string, userId: string): Promise<void> {
    const { error: payError } = await supabase
      .from('payments')
      .update({ status: 'approved' })
      .eq('id', paymentId);
    
    if (payError) throw payError;

    const { error: profError } = await supabase
      .from('profiles')
      .update({ is_solvent: true })
      .eq('id', userId);

    if (profError) throw profError;
  },

  async rejectPayment(paymentId: string): Promise<void> {
    const { error } = await supabase
      .from('payments')
      .update({ status: 'rejected' })
      .eq('id', paymentId);
    
    if (error) throw error;
  },

  async runExpiryCheck(): Promise<{ message: string }> {
    const response = await fetch('/api/admin/cron/expire', { method: 'POST' });
    return response.json();
  },

  async getOfficialExchangeRate(): Promise<number> {
    try {
      const response = await fetch('https://ve.dolarapi.com/v1/euros/oficial');
      const data = await response.json();
      return Number(data.promedio);
    } catch (error) {
      console.error('Failed to fetch official rate:', error);
      return 545.9483; // Final fallback based on user prompt
    }
  },

  async getLastPaymentDates(userIds: string[]): Promise<Record<string, string>> {
    const { data, error } = await supabase
      .from('payments')
      .select('user_id, created_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const lastPayments: Record<string, string> = {};
    data?.forEach(p => {
      if (!lastPayments[p.user_id]) {
        lastPayments[p.user_id] = p.created_at;
      }
    });
    return lastPayments;
  }
};
