import { useState, useEffect, useCallback, useMemo } from 'react';
import { financialService } from '@/lib/services/financialService';
import { expenseService } from '@/lib/services/expenseService';
import { incomeService } from '@/lib/services/incomeService';
import { 
  CurrencyType, 
  PaymentRecord, 
  ExpenseRecord,
  IncomeRecord,
} from '@/lib/types/gym';
import { useToast } from '@/components/Toast';
import { useTenant } from '@/components/TenantContext';
import { isLocalCurrency } from '@/lib/currency';

export function useAccountability(selectedMonth: string) { // Format: YYYY-MM
  const { toast } = useToast();
  const { currencies } = useTenant();
  
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
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

      const dateStart = startDate.split('T')[0];
      const dateEnd = endDate.split('T')[0];

      const [paymentsData, incomesData, expensesData, rate, methodsData] = await Promise.all([
        financialService.getPayments(startDate, endDate),
        incomeService.getIncomes(dateStart, dateEnd),
        expenseService.getExpenses(dateStart, dateEnd),
        financialService.getOfficialExchangeRate(currencies.reference),
        financialService.getPaymentMethods()
      ]);

      setPayments(paymentsData);
      setIncomes(incomesData);
      setExpenses(expensesData);
      setExchangeRate(rate);
      setPaymentMethods(methodsData);

    } catch (error) {
      console.error('Error fetching accountability data:', error);
      toast('Failed to sync accountability ledger.', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, toast, currencies.reference]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    let incomeReference = 0;
    let incomeLocal = 0;
    let outcomeReference = 0;
    let outcomeLocal = 0;

    payments.filter(p => p.status === 'approved').forEach(p => {
      const methodObj = paymentMethods.find((m: { id: string; label: string; currency: string }) => m.id === p.method || m.label.toLowerCase() === String(p.method || '').toLowerCase());
      const code = methodObj?.currency || p.currency_type || p.currency || currencies.reference;

      if (isLocalCurrency(code, currencies)) {
        incomeLocal += p.amount;
      } else {
        incomeReference += p.amount;
      }
    });

    incomes.filter(inc => inc.status === 'confirmed').forEach(inc => {
      if (isLocalCurrency(inc.currency, currencies)) {
        incomeLocal += inc.amount;
      } else {
        incomeReference += inc.amount;
      }
    });

    expenses.forEach(e => {
      if (isLocalCurrency(e.currency, currencies)) {
        outcomeLocal += e.amount;
      } else {
        outcomeReference += e.amount;
      }
    });

    const netReference = incomeReference - outcomeReference;
    const netLocal = incomeLocal - outcomeLocal;

    return {
      reference: {
        income: incomeReference,
        outcome: outcomeReference,
        net: netReference,
        margin: incomeReference > 0 ? (netReference / incomeReference) * 100 : 0
      },
      local: {
        income: incomeLocal,
        outcome: outcomeLocal,
        net: netLocal,
        margin: incomeLocal > 0 ? (netLocal / incomeLocal) * 100 : 0
      },
      exchangeRate
    };
  }, [payments, incomes, expenses, exchangeRate, paymentMethods, currencies]);

  return {
    loading,
    stats,
    payments,
    incomes,
    expenses,
    refresh: fetchData,
    currencies,
  };
}
