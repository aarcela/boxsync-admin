import { useState, useEffect, useCallback } from 'react';
import { dashboardService, DashboardStats, DashboardPayment, DashboardProfile, DashboardClass } from '../services/dashboardService';

export function useDashboardData() {
  const [stats, setStats] = useState<DashboardStats>({
    pendingPayments: [],
    inactiveAthletes: [],
    unpaidMembers: [],
    totalMembers: [],
    lowOccupancyClasses: [],
    dailyUsagePercent: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getAllDashboardData();
      setStats(data);
    } catch (err) {
      setError(err as Error);
      console.error('Error in useDashboardData:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  /**
   * Optimistically removes a payment from the local list after manual approval/rejection.
   */
  const removePaymentLocally = (paymentId: string) => {
    setStats(prev => ({
      ...prev,
      pendingPayments: prev.pendingPayments.filter(p => p.id !== paymentId)
    }));
  };

  return {
    stats,
    loading,
    error,
    refresh: fetchStats,
    removePaymentLocally
  };
}
