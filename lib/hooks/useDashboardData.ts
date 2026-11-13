import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/components/TenantContext';
import {
  dashboardService,
  DashboardStats,
  EMPTY_TODAY_ATTENDANCE,
} from '../services/dashboardService';

export function useDashboardData() {
  const { tenantId, timezone } = useTenant();
  const [stats, setStats] = useState<DashboardStats>({
    pendingPayments: [],
    inactiveAthletes: [],
    unpaidMembers: [],
    expiringMembers: [],
    overdueMembers: [],
    totalMembers: [],
    lowOccupancyClasses: [],
    dailyUsagePercent: 0,
    todayAttendance: EMPTY_TODAY_ATTENDANCE,
    todayWodPublished: true,
  });
  const [loading, setLoading] = useState(true);
  /** True once real data has arrived; until then the UI must not imply "all clear". */
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getAllDashboardData(tenantId, timezone);
      setStats(data);
      setLoaded(true);
    } catch (err) {
      setError(err as Error);
      console.error('Error in useDashboardData:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, timezone]);

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
    loaded,
    error,
    refresh: fetchStats,
    removePaymentLocally
  };
}
