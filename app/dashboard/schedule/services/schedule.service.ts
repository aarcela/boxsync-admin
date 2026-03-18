import { supabase } from '@/lib/supabase';
import { Booking, ClassSession, BookingStatus } from '../types';

export const scheduleService = {
  fetchSchedule: async (): Promise<ClassSession[]> => {
    // Get start of today in Caracas
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const ye = parts.find((p) => p.type === 'year')?.value;
    const mo = parts.find((p) => p.type === 'month')?.value;
    const da = parts.find((p) => p.type === 'day')?.value;
    const startOfTodayUtc = new Date(`${ye}-${mo}-${da}T00:00:00-04:00`).toISOString();
    
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        coach:profiles(full_name),
        bookings:bookings(count)
      `)
      .gte('start_time', startOfTodayUtc) // From start of today in Caracas
      .order('start_time', { ascending: true });

    if (error) throw error;
    return data as ClassSession[];
  },

  fetchRoster: async (classId: string): Promise<Booking[]> => {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, status,
        profiles:user_id (id, full_name, avatar_url)
      `)
      .eq('class_id', classId);

    if (error) throw error;
    
    const bookings: Booking[] = data.map((item: unknown) => {
      const d = item as { id: string; status: BookingStatus; profiles: { id: string; full_name: string; avatar_url: string | null } };
      return {
        id: d.id,
        status: d.status as BookingStatus,
        profiles: d.profiles
      };
    });
    return bookings;
  },

  deleteClass: async (id: string): Promise<void> => {
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) throw error;
  }
};
