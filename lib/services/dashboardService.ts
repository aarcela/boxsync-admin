import { supabase } from '../supabase';

export interface DashboardProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  plan?: string;
  is_solvent?: boolean;
}

export interface DashboardPayment {
  id: string;
  amount: number;
  method: string;
  proof_image_url: string;
  created_at: string;
  user_id: string;
  profiles: {
    full_name: string;
  } | null;
}

export interface DashboardClass {
  id: string;
  class_type: string;
  start_time: string;
  max_capacity: number;
  bookings: { count: number }[];
}

export interface DashboardStats {
  pendingPayments: DashboardPayment[];
  inactiveAthletes: DashboardProfile[];
  unpaidMembers: DashboardProfile[];
  totalMembers: DashboardProfile[];
  lowOccupancyClasses: DashboardClass[];
  dailyUsagePercent: number;
}

export const dashboardService = {
  /**
   * Fetches all pending payments.
   */
  async getPendingPayments(): Promise<DashboardPayment[]> {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        id, amount, method, proof_image_url, created_at, user_id,
        profiles ( full_name )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(p => ({
      ...p,
      profiles: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles
    })) as DashboardPayment[];
  },

  /**
   * Fetches all member profiles.
   */
  async getTotalMembers(): Promise<DashboardProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, plan, is_solvent')
      .eq('role', 'member')
      .order('full_name', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  /**
   * Identifies members who haven't made a booking in the last 10 days.
   */
  async getInactiveAthletes(allMembers: DashboardProfile[]): Promise<DashboardProfile[]> {
    if (allMembers.length === 0) return [];

    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    
    const { data: recentBookings, error: bookingError } = await supabase
      .from('bookings')
      .select('user_id')
      .gte('created_at', tenDaysAgo.toISOString());
    
    if (bookingError) throw bookingError;

    const activeUserIds = new Set(recentBookings?.map(b => b.user_id) || []);
    return allMembers.filter(m => !activeUserIds.has(m.id));
  },

  /**
   * Calculates occupancy and identifies low occupancy classes for today.
   */
  async getTodayUsageData(): Promise<{ lowOccupancy: DashboardClass[], usagePercent: number }> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const startOfDay = `${today}T00:00:00Z`;
    const endOfDay = `${today}T23:59:59Z`;

    const { data: classes, error } = await supabase
      .from('classes')
      .select('id, class_type, start_time, max_capacity, bookings:bookings(count)')
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay);
    
    if (error) throw error;
    if (!classes || classes.length === 0) return { lowOccupancy: [], usagePercent: 0 };

    let totalCapacity = 0;
    let totalBooked = 0;
    const LOW_OCCUPANCY_THRESHOLD = 0.3; // 30% based on user latest edit

    const lowOccupancy = classes.filter(cls => {
      const cap = cls.max_capacity || 12;
      const booked = cls.bookings?.[0]?.count || 0;
      totalCapacity += cap;
      totalBooked += booked;
      return booked / cap < LOW_OCCUPANCY_THRESHOLD;
    });

    const usagePercent = totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0;

    return {
      lowOccupancy: (lowOccupancy as unknown) as DashboardClass[],
      usagePercent
    };
  },

  /**
   * Aggregates all dashboard data.
   */
  async getAllDashboardData(): Promise<DashboardStats> {
    const [pendingPayments, allMembers, { lowOccupancy, usagePercent }] = await Promise.all([
      this.getPendingPayments(),
      this.getTotalMembers(),
      this.getTodayUsageData()
    ]);

    const inactiveAthletes = await this.getInactiveAthletes(allMembers);
    const unpaidMembers = allMembers.filter(m => !m.is_solvent);

    return {
      pendingPayments,
      inactiveAthletes,
      unpaidMembers,
      totalMembers: allMembers,
      lowOccupancyClasses: lowOccupancy,
      dailyUsagePercent: usagePercent
    };
  }
};
