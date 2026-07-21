import { useState, useEffect, useCallback, useMemo } from 'react';
import { financialService } from '@/lib/services/financialService';
import { incomeService } from '@/lib/services/incomeService';
import { 
  CurrencyType, 
  PaymentRecord, 
  PaymentMethod, 
  FinancialStats, 
  CurrencyStats,
  IncomeRecord,
} from '@/lib/types/gym';
import { useToast } from '@/components/Toast';
import { useTenant } from '@/components/TenantContext';
import { isLocalCurrency } from '@/lib/currency';

function isCashMethod(methodRef: string | undefined, methods: PaymentMethod[]): boolean {
  if (!methodRef) return false;
  const methodObj = methods.find(
    (m) => m.id === methodRef || m.label.toLowerCase() === methodRef.toLowerCase()
  );
  const label = (methodObj?.label || methodRef).toLowerCase();
  return label.includes('cash') || label.includes('efectivo');
}

export function useFinancials(period: string, customRange?: { start: Date; end: Date }) {
  const { toast } = useToast();
  const { currencies } = useTenant();
  
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [activeCurrency, setActiveCurrency] = useState<CurrencyType>(currencies.reference);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [runningExpiry, setRunningExpiry] = useState(false);

  const [stats, setStats] = useState<FinancialStats>({
    reference: { totalRevenue: 0, pendingAmount: 0, pendingCount: 0, cashAmount: 0, methodCounts: {} },
    local: { totalRevenue: 0, pendingAmount: 0, pendingCount: 0, cashAmount: 0, methodCounts: {} },
    activeMembers: 0,
    inactiveMembers: 0,
    projectedRevenueEUR: 0,
    projectedRevenueVES: 0,
    overdueAmountEUR: 0,
    solvencyRate: 0
  });

  useEffect(() => {
    setActiveCurrency((prev) =>
      prev === currencies.reference || prev === currencies.local
        ? prev
        : currencies.reference
    );
  }, [currencies.reference, currencies.local]);

  const fetchFinancials = useCallback(async () => {
    setLoading(true);
    try {
      let startDate: string;
      let endDate: string;

      const now = new Date();
      if (period === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        startDate = start.toISOString();
        endDate = end.toISOString();
      } else if (period === 'week') {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        startDate = start.toISOString();
        endDate = now.toISOString();
      } else if (period === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        startDate = start.toISOString();
        endDate = now.toISOString();
      } else if (period === 'custom' && customRange) {
        startDate = customRange.start.toISOString();
        endDate = customRange.end.toISOString();
      } else {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        startDate = start.toISOString();
        endDate = now.toISOString();
      }

      const incomeStart = startDate.slice(0, 10);
      const incomeEnd = endDate.slice(0, 10);

      const [paymentsData, incomesData, methodsData, memberStats, rate] = await Promise.all([
        financialService.getPayments(startDate, endDate),
        incomeService.getIncomes(incomeStart, incomeEnd),
        financialService.getPaymentMethods(),
        financialService.getMemberStats(),
        financialService.getOfficialExchangeRate(currencies.reference)
      ]);

      setPayments(paymentsData);
      setIncomes(incomesData);
      setPaymentMethods(methodsData);
      setExchangeRate(rate);

      const referenceStats: CurrencyStats = { totalRevenue: 0, pendingAmount: 0, pendingCount: 0, cashAmount: 0, methodCounts: {} };
      const localStats: CurrencyStats = { totalRevenue: 0, pendingAmount: 0, pendingCount: 0, cashAmount: 0, methodCounts: {} };

      paymentsData.forEach(p => {
        const methodObj = methodsData.find(m => m.id === p.method || m.label.toLowerCase() === String(p.method || '').toLowerCase());
        const code = methodObj?.currency || p.currency || p.currency_type || currencies.reference;
        const targetStats = isLocalCurrency(code, currencies) ? localStats : referenceStats;

        if (p.status === 'approved') {
          targetStats.totalRevenue += p.amount;
          if (p.method && String(p.method) !== 'null') {
            targetStats.methodCounts[p.method] = (targetStats.methodCounts[p.method] || 0) + p.amount;
          }
          if (p.method?.toLowerCase().includes('cash') || p.method?.toLowerCase().includes('efectivo')) {
             targetStats.cashAmount += p.amount;
          }
        } else if (p.status === 'pending') {
          targetStats.pendingAmount += p.amount;
          targetStats.pendingCount++;
        }
      });

      incomesData
        .filter((inc) => inc.status === 'confirmed')
        .forEach((inc) => {
          const targetStats = isLocalCurrency(inc.currency, currencies) ? localStats : referenceStats;
          targetStats.totalRevenue += inc.amount;
          if (inc.payment_method) {
            targetStats.methodCounts[inc.payment_method] =
              (targetStats.methodCounts[inc.payment_method] || 0) + inc.amount;
          }
          if (isCashMethod(inc.payment_method, methodsData)) {
            targetStats.cashAmount += inc.amount;
          }
        });

      const totalMembers = memberStats.active + memberStats.inactive;

      setStats({
        reference: referenceStats,
        local: localStats,
        activeMembers: memberStats.active,
        inactiveMembers: memberStats.inactive,
        projectedRevenueEUR: memberStats.projectedEUR,
        projectedRevenueVES: 0,
        overdueAmountEUR: memberStats.overdueEUR,
        solvencyRate: totalMembers > 0 ? Math.round((memberStats.active / totalMembers) * 100) : 0
      });

    } catch (error) {
      console.error('Error fetching financials:', error);
      toast('Sync failed across matrix sector lines.', 'error');
    } finally {
      setLoading(false);
    }
  }, [period, customRange, toast, currencies]);

  useEffect(() => {
    fetchFinancials();
  }, [fetchFinancials]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const methodObj = paymentMethods.find(m => m.id === p.method || m.label.toLowerCase() === String(p.method || '').toLowerCase());
      const code = methodObj?.currency || p.currency || p.currency_type || currencies.reference;
      const isLocal = isLocalCurrency(code, currencies);
      
      const matchesCurrency = activeCurrency === currencies.local ? isLocal : !isLocal;
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesSearch = searchTerm === '' || p.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesCurrency && matchesStatus && matchesSearch;
    });
  }, [payments, activeCurrency, statusFilter, searchTerm, paymentMethods, currencies]);

  const approve = async (paymentId: string, userId: string) => {
    try {
      await financialService.approvePayment(paymentId, userId);
      toast('Payment cleared. Solvent status synced.', 'success');
      await fetchFinancials();
    } catch {
      toast('Approval sequence failed.', 'error');
    }
  };

  const reject = async (paymentId: string) => {
    try {
      await financialService.rejectPayment(paymentId);
      toast('Payment rejected. Ledger updated.', 'warning');
      await fetchFinancials();
    } catch {
      toast('Rejection failed.', 'error');
    }
  };

  const runExpiry = async () => {
    setRunningExpiry(true);
    try {
      const res = await financialService.runExpiryCheck();
      toast(res.message, 'info');
      await fetchFinancials();
    } catch {
      toast('Expiry sync error.', 'error');
    } finally {
      setRunningExpiry(false);
    }
  };

  return {
    loading,
    payments,
    incomes,
    paymentMethods,
    stats,
    exchangeRate,
    setExchangeRate,
    activeCurrency,
    setActiveCurrency,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    filteredPayments,
    currentPage,
    setCurrentPage,
    runningExpiry,
    approve,
    reject,
    runExpiry,
    refresh: fetchFinancials,
    currencies,
  };
}
