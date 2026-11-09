import { supabase } from '../supabase';
import { IncomeRecord } from '@/lib/types/gym';

type PaymentLedgerRow = {
  id: string;
  amount: number;
  method: string | null;
  payment_method_id?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  currency: string | null;
  currency_type?: string | null;
  exchange_rate_at_time?: number | null;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

function profileFullName(
  profiles: PaymentLedgerRow['profiles']
): string {
  const row = Array.isArray(profiles) ? profiles[0] : profiles;
  return row?.full_name?.trim() || '—';
}

function paymentStatusToIncome(status: PaymentLedgerRow['status']): IncomeRecord['status'] {
  if (status === 'approved') return 'confirmed';
  if (status === 'pending') return 'pending';
  return 'cancelled';
}

function paymentToIncomeRow(
  payment: PaymentLedgerRow,
  exchangeRateFallback: number
): IncomeRecord {
  const rate =
    Number(payment.exchange_rate_at_time) > 0
      ? Number(payment.exchange_rate_at_time)
      : exchangeRateFallback;
  return {
    id: `payment:${payment.id}`,
    description: profileFullName(payment.profiles),
    category: 'membership_payments',
    amount: Number(payment.amount) || 0,
    currency: payment.currency || payment.currency_type || 'USD',
    exchange_rate_at_time: rate,
    income_date: payment.created_at.slice(0, 10),
    // Prefer method id so the Income page can resolve the staff label.
    payment_method: payment.payment_method_id || payment.method || undefined,
    status: paymentStatusToIncome(payment.status),
    created_at: payment.created_at,
    source: 'membership_payment',
  };
}

export const incomeService = {
  async getIncomes(startDate: string, endDate: string): Promise<IncomeRecord[]> {
    const { data, error } = await supabase
      .from('incomes')
      .select('*')
      .gte('income_date', startDate)
      .lte('income_date', endDate)
      .order('income_date', { ascending: false });

    if (error) throw error;
    return (data || []).map((row) => ({ ...row, source: 'manual' as const }));
  },

  /** Manual incomes + membership payments for the same date window. */
  async getLedgerIncomes(
    startDate: string,
    endDate: string,
    exchangeRateFallback: number
  ): Promise<IncomeRecord[]> {
    const startIso = `${startDate}T00:00:00.000Z`;
    const endIso = `${endDate}T23:59:59.999Z`;
    const [manual, paymentsRes] = await Promise.all([
      this.getIncomes(startDate, endDate),
      supabase
        .from('payments')
        .select(
          'id, amount, method, payment_method_id, status, created_at, currency, currency_type, exchange_rate_at_time, profiles ( full_name )'
        )
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .in('status', ['approved', 'pending'])
        .order('created_at', { ascending: false }),
    ]);
    if (paymentsRes.error) throw paymentsRes.error;
    const fromPayments = ((paymentsRes.data || []) as unknown as PaymentLedgerRow[]).map((p) =>
      paymentToIncomeRow(p, exchangeRateFallback)
    );
    return [...manual, ...fromPayments].sort((a, b) => {
      if (a.income_date !== b.income_date) return b.income_date.localeCompare(a.income_date);
      return b.created_at.localeCompare(a.created_at);
    });
  },

  async addIncome(income: Omit<IncomeRecord, 'id' | 'created_at'>): Promise<IncomeRecord> {
    const { source: _source, ...row } = income;
    const { data, error } = await supabase
      .from('incomes')
      .insert([row])
      .select()
      .single();

    if (error) throw error;
    return { ...data, source: 'manual' as const };
  },

  async deleteIncome(id: string): Promise<void> {
    if (id.startsWith('payment:')) {
      throw new Error('membership_payment_rows_are_read_only');
    }
    const { error } = await supabase
      .from('incomes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
