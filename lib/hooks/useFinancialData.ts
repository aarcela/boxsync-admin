import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  financialService, 
  PaymentRecord, 
  FinancialStats, 
  PaymentMethod,
  CurrencyType,
  CurrencyStats
} from '../services/financialService';

export function useFinancialData(month: number, year: number) {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [officialRate, setOfficialRate] = useState<number>(545.9483);
  const [stats, setStats] = useState<FinancialStats>({
    EUR: { totalRevenue: 0, pendingAmount: 0, pendingCount: 0, cashAmount: 0, methodCounts: {} },
    VES: { totalRevenue: 0, pendingAmount: 0, pendingCount: 0, cashAmount: 0, methodCounts: {} },
    activeMembers: 0,
    inactiveMembers: 0,
    projectedRevenueEUR: 0,
    projectedRevenueVES: 0,
    overdueAmountEUR: 0,
    solvencyRate: 0
  });

  const fetchFinancials = useCallback(async () => {
    setLoading(true);
    try {
      const [paymentsData, methodsData, memberStats, rate] = await Promise.all([
        financialService.getPayments(month, year),
        financialService.getPaymentMethods(),
        financialService.getMemberStats(),
        financialService.getOfficialExchangeRate()
      ]);

      setPayments(paymentsData);
      setPaymentMethods(methodsData);
      setOfficialRate(rate);

      const EURStats: CurrencyStats = { totalRevenue: 0, pendingAmount: 0, pendingCount: 0, cashAmount: 0, methodCounts: {} };
      const VESStats: CurrencyStats = { totalRevenue: 0, pendingAmount: 0, pendingCount: 0, cashAmount: 0, methodCounts: {} };

      paymentsData.forEach(p => {
        const methodObj = methodsData.find(m => m.id === p.method || m.label.toLowerCase() === String(p.method || '').toLowerCase());
        const isVes = methodObj ? methodObj.currency === CurrencyType.VES : p.currency_type === 'VES';
        const targetStats = isVes ? VESStats : EURStats;

        if (p.status === 'approved') {
          targetStats.totalRevenue += p.amount;
          if (p.method && String(p.method) !== 'null') {
            targetStats.methodCounts[p.method] = (targetStats.methodCounts[p.method] || 0) + p.amount;
          }
          // Assuming method label contains "Cash" or "EFECTIVO" for reconciliation
          // This should be more robust in a real scenario
          if (p.method?.toLowerCase().includes('cash') || p.method?.toLowerCase().includes('efectivo')) {
             targetStats.cashAmount += p.amount;
          }
        } else if (p.status === 'pending') {
          targetStats.pendingAmount += p.amount;
          targetStats.pendingCount++;
        }
      });

      const totalMembers = memberStats.active + memberStats.inactive;

      setStats({
        EUR: EURStats,
        VES: VESStats,
        activeMembers: memberStats.active,
        inactiveMembers: memberStats.inactive,
        projectedRevenueEUR: memberStats.projectedEUR,
        projectedRevenueVES: 0, // Separate pricing required for VES projection
        overdueAmountEUR: memberStats.overdueEUR,
        solvencyRate: totalMembers > 0 ? Math.round((memberStats.active / totalMembers) * 100) : 0
      });

    } catch (error) {
      console.error('Error fetching financials:', error);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchFinancials();
  }, [fetchFinancials]);

  return {
    payments,
    paymentMethods,
    stats,
    officialRate,
    loading,
    refresh: fetchFinancials
  };
}
