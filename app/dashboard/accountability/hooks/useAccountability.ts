import { useState, useEffect, useCallback, useMemo } from 'react';
import { financialService } from '@/lib/services/financialService';
import { expenseService } from '@/lib/services/expenseService';
import { 
  CurrencyType, 
  PaymentRecord, 
  ExpenseRecord,
  ProfitabilityStats
} from '@/lib/types/gym';
import { useToast } from '@/components/Toast';

export function useAccountability(selectedMonth: string) { // Format: YYYY-MM
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(545.9483);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const year = parseInt(selectedMonth.split('-')[0]);
      const month = parseInt(selectedMonth.split('-')[1]);
      
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

      const [paymentsData, expensesData, rate, methodsData] = await Promise.all([
        financialService.getPayments(startDate, endDate),
        expenseService.getExpenses(startDate.split('T')[0], endDate.split('T')[0]),
        financialService.getOfficialExchangeRate(),
        financialService.getPaymentMethods()
      ]);

      setPayments(paymentsData);
      setExpenses(expensesData);
      setExchangeRate(rate);
      setPaymentMethods(methodsData);

    } catch (error) {
      console.error('Error fetching accountability data:', error);
      toast('Failed to sync accountability ledger.', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    let incomeEUR = 0;
    let incomeVES = 0;
    let outcomeEUR = 0;
    let outcomeVES = 0;

    // Process Incomes (Approved Only)
    payments.filter(p => p.status === 'approved').forEach(p => {
      const methodObj = paymentMethods.find(m => m.id === p.method || m.label.toLowerCase() === String(p.method || '').toLowerCase());
      const isVes = methodObj ? methodObj.currency === CurrencyType.VES : p.currency_type === 'VES';

      if (isVes) {
        incomeVES += p.amount;
      } else {
        incomeEUR += p.amount;
      }
    });

    // Process Outcomes
    expenses.forEach(e => {
      if (e.currency === CurrencyType.VES) {
        outcomeVES += e.amount;
      } else {
        outcomeEUR += e.amount;
      }
    });

    const netEUR = incomeEUR - outcomeEUR;
    const netVES = incomeVES - outcomeVES;

    return {
      EUR: {
        income: incomeEUR,
        outcome: outcomeEUR,
        net: netEUR,
        margin: incomeEUR > 0 ? (netEUR / incomeEUR) * 100 : 0
      },
      VES: {
        income: incomeVES,
        outcome: outcomeVES,
        net: netVES,
        margin: incomeVES > 0 ? (netVES / incomeVES) * 100 : 0
      },
      exchangeRate
    };
  }, [payments, expenses, exchangeRate]);

  return {
    loading,
    stats,
    payments,
    expenses,
    refresh: fetchData
  };
}
