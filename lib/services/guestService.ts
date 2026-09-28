import { BookingStatus } from '@/lib/types/gym';

export interface GuestAthleteOption {
  id: string;
  full_name: string;
  whatsapp: string | null;
  instagram: string | null;
  created_at?: string;
}

export interface GuestBooking {
  id: string;
  status: BookingStatus;
  guest_athlete_id: string;
  full_name: string;
  whatsapp: string | null;
  instagram: string | null;
}

export const guestService = {
  async listForClass(classId: string): Promise<GuestBooking[]> {
    const response = await fetch(
      `/api/admin/guest-bookings?classId=${encodeURIComponent(classId)}`,
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load guests');
    }
    return (data.guests ?? []) as GuestBooking[];
  },

  async listRecent(): Promise<GuestAthleteOption[]> {
    const response = await fetch('/api/admin/guest-bookings?recent=1');
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load recent guests');
    }
    return (data.guests ?? []) as GuestAthleteOption[];
  },

  async addToClass(input: {
    classId: string;
    fullName?: string;
    whatsapp?: string;
    instagram?: string;
    guestAthleteId?: string;
  }): Promise<GuestBooking> {
    const response = await fetch('/api/admin/guest-bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to add guest');
    }
    return data.guest as GuestBooking;
  },

  async updateStatus(guestBookingId: string, status: BookingStatus): Promise<void> {
    const response = await fetch('/api/admin/guest-bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestBookingId, status }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update guest status');
    }
  },

  async remove(guestBookingId: string): Promise<void> {
    const response = await fetch('/api/admin/guest-bookings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestBookingId }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to remove guest');
    }
  },
};
