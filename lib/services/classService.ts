import { supabase } from '../supabase';
import { ClassSession, Booking, BookingStatus } from '../types/gym';
import { getCaracasDayRange, getCaracasDate } from '../utils/date';

export const classService = {
  /**
   * Fetches classes for a specific date (YYYY-MM-DD)
   */
  async getClassesByDate(dateStr: string): Promise<ClassSession[]> {
    const { startUtc, endUtc } = getCaracasDayRange(dateStr);
    
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        coach:profiles(full_name),
        bookings:bookings(count)
      `)
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
      .select(`
        *,
        coach:profiles(full_name),
        bookings:bookings(count)
      `)
      .gte('start_time', startUtc)
      .order('start_time', { ascending: true });

    if (error) throw error;
    return data as ClassSession[];
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
    
    return (data || []).map((item: any) => ({
      id: item.id,
      status: item.status as BookingStatus,
      profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
    }));
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
