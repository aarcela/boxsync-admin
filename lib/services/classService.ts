import { supabase } from '../supabase';
import { ClassSession, Booking, BookingStatus, CapacityInsight, WaitlistEntry } from '../types/gym';
import { getCaracasDayRange, getCaracasDate } from '../utils/date';

export type ClassUpdateFields = {
  coach_id?: string | null;
  class_type?: string;
  max_capacity?: number;
  start_time?: string;
  end_time?: string;
};

const classSelect = `
  *,
  coach:profiles(full_name),
  bookings:bookings(count),
  waitlist:class_waitlist(count)
`;

export const classService = {
  /**
   * Fetches classes for a specific date (YYYY-MM-DD)
   */
  async getClassesByDate(dateStr: string): Promise<ClassSession[]> {
    const { startUtc, endUtc } = getCaracasDayRange(dateStr);
    
    const { data, error } = await supabase
      .from('classes')
      .select(classSelect)
      .gte('start_time', startUtc)
      .lte('start_time', endUtc)
      .order('start_time', { ascending: true });

    if (error) throw error;
    return data as ClassSession[];
  },

  /**
   * Fetches upcoming classes (from start of today in Caracas onwards)
   */
  async getUpcomingClasses(): Promise<ClassSession[]> {
    const today = getCaracasDate();
    const { startUtc } = getCaracasDayRange(today);
    
    const { data, error } = await supabase
      .from('classes')
      .select(classSelect)
      .gte('start_time', startUtc)
      .order('start_time', { ascending: true });

    if (error) throw error;
    return data as ClassSession[];
  },

  async getClassesByRange(startUtc: string, endUtc: string): Promise<ClassSession[]> {
    const { data, error } = await supabase
      .from('classes')
      .select(classSelect)
      .gte('start_time', startUtc)
      .lte('start_time', endUtc)
      .order('start_time', { ascending: true });

    if (error) throw error;
    return data as ClassSession[];
  },

  async updateClass(id: string, updates: ClassUpdateFields): Promise<void> {
    const { error } = await supabase.from('classes').update(updates).eq('id', id);
    if (error) throw error;
  },

  async bulkUpdateClasses(ids: string[], updates: ClassUpdateFields): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await supabase.from('classes').update(updates).in('id', ids);
    if (error) throw error;
  },

  /**
   * Fetches the roster (bookings) for a specific class
   */
  async getRoster(classId: string): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, status,
        profiles:user_id (id, full_name, avatar_url)
      `)
      .eq('class_id', classId);

    if (error) throw error;
    
    return (data || []).map((item) => ({
      id: item.id,
      status: item.status as BookingStatus,
      profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
    }));
  },

  async getWaitlist(classId: string): Promise<WaitlistEntry[]> {
    const { data, error } = await supabase
      .from('class_waitlist')
      .select(`
        id, joined_at, status,
        profiles:user_id (id, full_name, avatar_url)
      `)
      .eq('class_id', classId)
      .eq('status', 'active')
      .order('joined_at', { ascending: true });

    if (error) throw error;
    return (data || []).map((item) => ({
      id: item.id,
      joined_at: item.joined_at,
      status: item.status,
      profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
    }));
  },

  async getCapacityInsights(): Promise<CapacityInsight[]> {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [classesResult, profilesResult, plansResult, ratesResult] =
      await Promise.all([
        supabase
          .from('classes')
          .select(
            'id, start_time, class_type, max_capacity, coach_id, bookings:bookings(status, user_id)'
          )
          .gte('start_time', start.toISOString())
          .lt('start_time', now.toISOString())
          .eq('is_cancelled', false),
        supabase
          .from('profiles')
          .select('id, plan, salary_tier_id'),
        supabase
          .from('membership_plans')
          .select('id, price_usd'),
        supabase
          .from('coach_salary_tier_rates')
          .select('tier_id, class_type, rate_usd'),
      ]);

    const firstError =
      classesResult.error ||
      profilesResult.error ||
      plansResult.error ||
      ratesResult.error;
    if (firstError) throw firstError;

    const data = classesResult.data || [];
    const profiles = new Map(
      (profilesResult.data || []).map((profile) => [profile.id, profile])
    );
    const planPrices = new Map(
      (plansResult.data || []).map((plan) => [
        plan.id,
        Number(plan.price_usd || 0),
      ])
    );
    const coachRates = new Map(
      (ratesResult.data || []).map((rate) => [
        `${rate.tier_id}:${rate.class_type}`,
        Number(rate.rate_usd || 0),
      ])
    );
    const attendedVisits = new Map<string, number>();
    for (const cls of data) {
      for (const booking of cls.bookings || []) {
        if (booking.status === 'attended') {
          attendedVisits.set(
            booking.user_id,
            (attendedVisits.get(booking.user_id) || 0) + 1
          );
        }
      }
    }

    const slots = new Map<
      string,
      {
        booked: number;
        capacity: number;
        classes: number;
        attributedRevenue: number;
        coachCost: number;
      }
    >();
    const types = new Map<string, { noShows: number; bookings: number }>();

    for (const cls of data) {
      const slot = new Date(cls.start_time).toLocaleTimeString('en-US', {
        timeZone: 'America/Caracas',
        hour: '2-digit',
        minute: '2-digit',
      });
      const bookings = cls.bookings || [];
      const slotData = slots.get(slot) || {
        booked: 0,
        capacity: 0,
        classes: 0,
        attributedRevenue: 0,
        coachCost: 0,
      };
      slotData.booked += bookings.length;
      slotData.capacity += cls.max_capacity || 0;
      slotData.classes += 1;
      for (const booking of bookings) {
        if (booking.status !== 'attended') continue;
        const member = profiles.get(booking.user_id);
        const monthlyPrice = member?.plan
          ? planPrices.get(member.plan) || 0
          : 0;
        slotData.attributedRevenue +=
          monthlyPrice / Math.max(attendedVisits.get(booking.user_id) || 1, 1);
      }
      const coach = cls.coach_id ? profiles.get(cls.coach_id) : null;
      if (coach?.salary_tier_id) {
        slotData.coachCost +=
          coachRates.get(`${coach.salary_tier_id}:${cls.class_type}`) || 0;
      }
      slots.set(slot, slotData);

      const typeData = types.get(cls.class_type) || { noShows: 0, bookings: 0 };
      typeData.bookings += bookings.length;
      typeData.noShows += bookings.filter((booking) => booking.status === 'no_show').length;
      types.set(cls.class_type, typeData);
    }

    const lowOccupancy = Array.from(slots.entries())
      .map(([slot, value]) => ({
        slot,
        ...value,
        rate: value.capacity > 0 ? value.booked / value.capacity : 0,
        contribution: value.attributedRevenue - value.coachCost,
      }))
      .filter((value) => value.classes >= 2 && value.rate < 0.4)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 3)
      .map<CapacityInsight>((value) => ({
        id: `occupancy-${value.slot}`,
        kind: 'low_occupancy',
        title: `${value.slot} averages ${Math.round(value.rate * 100)}% occupancy`,
        detail: `Based on ${value.classes} completed classes (${value.booked}/${value.capacity} spots), estimated member-value contribution after coach pay is $${value.contribution.toFixed(0)}. Consider consolidating, moving, or promoting this slot.`,
        sampleSize: value.classes,
      }));

    const highDemand = Array.from(slots.entries())
      .map(([slot, value]) => ({
        slot,
        ...value,
        rate: value.capacity > 0 ? value.booked / value.capacity : 0,
        contribution: value.attributedRevenue - value.coachCost,
      }))
      .filter(
        (value) =>
          value.classes >= 2 && value.rate >= 0.85 && value.contribution > 0
      )
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 2)
      .map<CapacityInsight>((value) => ({
        id: `demand-${value.slot}`,
        kind: 'high_demand',
        title: `${value.slot} is running at ${Math.round(value.rate * 100)}% occupancy`,
        detail: `Across ${value.classes} classes, estimated member-value contribution after coach pay is $${value.contribution.toFixed(0)}. Test added capacity or an adjacent time slot.`,
        sampleSize: value.classes,
      }));

    const noShows = Array.from(types.entries())
      .map(([classType, value]) => ({
        classType,
        ...value,
        rate: value.bookings > 0 ? value.noShows / value.bookings : 0,
      }))
      .filter((value) => value.bookings >= 5 && value.noShows > 0 && value.rate >= 0.15)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 2)
      .map<CapacityInsight>((value) => ({
        id: `no-show-${value.classType}`,
        kind: 'no_show',
        title: `${value.classType}: ${Math.round(value.rate * 100)}% no-show rate`,
        detail: `${value.noShows} no-shows across ${value.bookings} bookings in the last 30 days. Review reminders or cancellation policy.`,
        sampleSize: value.bookings,
      }));

    return [...highDemand, ...lowOccupancy, ...noShows];
  },

  /**
   * Updates the status of a single booking via the Admin API
   * (Bypasses RLS using service role in API)
   */
  async updateBookingStatus(bookingId: string, status: BookingStatus): Promise<void> {
    const response = await fetch('/api/admin/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, status }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update status');
    }
  },

  /**
   * Bulk updates statuses for multiple bookings
   */
  async bulkUpdateStatus(bookingIds: string[], status: BookingStatus): Promise<void> {
    // Current API route only handles single updates.
    // For Phase 1, we still do multiple calls, but we prepare the central logic.
    // Future Phase 3 can update the API route to handle an array of IDs.
    const promises = bookingIds.map(id => this.updateBookingStatus(id, status));
    await Promise.all(promises);
  },

  async createBooking(classId: string, userId: string): Promise<Booking> {
    const response = await fetch('/api/admin/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, userId }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to add athlete');
    }

    return data.booking as Booking;
  },

  async deleteBooking(bookingId: string): Promise<void> {
    const response = await fetch('/api/admin/bookings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to remove athlete');
    }
  },

  /**
   * Deletes a class (if needed by other views)
   */
  async deleteClass(id: string): Promise<void> {
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) throw error;
  }
};
