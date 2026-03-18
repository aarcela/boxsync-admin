export type BookingStatus = 'booked' | 'attended' | 'no_show';

export interface Booking {
  id: string;
  status: BookingStatus;
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface ClassSession {
  id: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  class_type: string;
  is_cancelled: boolean;
  coach: { full_name: string } | null;
  bookings: { count: number }[];
}
