import { useState, useEffect, useCallback } from 'react';
import { getCaracasDate } from '@/lib/utils/date';
import { classService } from '@/lib/services/classService';
import { guestService, GuestBooking } from '@/lib/services/guestService';
import { Booking, ClassSession, BookingStatus } from '@/lib/types/gym';
import { useToast } from '@/components/Toast';
import { useLanguage } from '@/components/LanguageContext';

export function useAttendance() {
  const { toast } = useToast();
  const { t } = useLanguage();
  
  // State
  const [date, setDate] = useState('');
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [roster, setRoster] = useState<Booking[]>([]);
  const [guestRoster, setGuestRoster] = useState<GuestBooking[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Initial date setup
  useEffect(() => {
    setDate(getCaracasDate());
  }, []);

  // 1. Fetch Classes for selected Date
  const fetchClasses = useCallback(async (selectedDate: string) => {
    if (!selectedDate) return;
    
    setLoadingClasses(true);
    setSelectedClassId(null);
    setRoster([]);
    setGuestRoster([]);
    
    try {
      const data = await classService.getClassesByDate(selectedDate);
      setClasses(data);

      if (data.length === 0) return;

      // Today: closest class to now. Other days: first class, so roster is ready.
      const todayStr = getCaracasDate();
      if (selectedDate === todayStr) {
        const now = new Date();
        let closestId = data[0].id;
        let minDiff = Infinity;

        data.forEach(cls => {
          const diff = Math.abs(new Date(cls.start_time).getTime() - now.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestId = cls.id;
          }
        });
        setSelectedClassId(closestId);
      } else {
        setSelectedClassId(data[0].id);
      }
    } catch (error) {
      console.error('Fetch classes error:', error);
      toast(t('Failed to load classes'), 'error');
    } finally {
      setLoadingClasses(false);
    }
  }, [toast, t]);

  useEffect(() => {
    fetchClasses(date);
  }, [date, fetchClasses]);

  // 2. Fetch Roster when a class is selected
  const fetchRoster = useCallback(async (classId: string) => {
    setLoadingRoster(true);
    try {
      const [bookings, guests] = await Promise.all([
        classService.getRoster(classId),
        guestService.listForClass(classId),
      ]);
      setRoster(bookings);
      setGuestRoster(guests);
    } catch (error) {
      console.error('Fetch roster error:', error);
      toast(t('Failed to load roster'), 'error');
    } finally {
      setLoadingRoster(false);
    }
  }, [toast, t]);

  useEffect(() => {
    if (selectedClassId) {
      fetchRoster(selectedClassId);
    }
  }, [selectedClassId, fetchRoster]);

  const updateClassBookingCount = (classId: string, delta: number) => {
    setClasses(prev => prev.map(c => {
      if (c.id !== classId) return c;
      const current = c.bookings[0]?.count || 0;
      return { ...c, bookings: [{ count: Math.max(0, current + delta) }] };
    }));
  };

  const updateStatus = async (bookingId: string, newStatus: BookingStatus) => {
    const previousRoster = [...roster];
    setRoster((prev: Booking[]) => prev.map((b: Booking) => 
      b.id === bookingId ? { ...b, status: newStatus } : b
    ));

    try {
      await classService.updateBookingStatus(bookingId, newStatus);
    } catch (error) {
      console.error(error);
      setRoster(previousRoster);
      toast(t('Failed to update status'), 'error');
    }
  };

  const addAthlete = async (userId: string) => {
    if (!selectedClassId) return;

    const selectedClass = classes.find(c => c.id === selectedClassId);
    const count = selectedClass?.bookings[0]?.count ?? roster.length;
    if (selectedClass && count >= selectedClass.max_capacity) {
      toast(t('Class is at full capacity'), 'error');
      return;
    }

    try {
      const booking = await classService.createBooking(selectedClassId, userId);
      setRoster(prev => [...prev, booking]);
      updateClassBookingCount(selectedClassId, 1);
      toast(t('Athlete added to class'), 'success');
    } catch (error) {
      console.error(error);
      toast(error instanceof Error ? error.message : t('Failed to add athlete'), 'error');
      throw error;
    }
  };

  const removeAthlete = async (bookingId: string) => {
    if (!selectedClassId) return;

    const previousRoster = [...roster];
    setRoster(prev => prev.filter(b => b.id !== bookingId));

    try {
      await classService.deleteBooking(bookingId);
      updateClassBookingCount(selectedClassId, -1);
      toast(t('Athlete removed from class'), 'success');
    } catch (error) {
      console.error(error);
      setRoster(previousRoster);
      toast(t('Failed to remove athlete'), 'error');
    }
  };

  const markRemaining = async (newStatus: Extract<BookingStatus, 'attended' | 'no_show'>) => {
    const toUpdate = roster.filter(b => b.status === 'booked');
    if (toUpdate.length === 0) {
      toast(t('All athletes are already marked as {{status}}', { status: t(newStatus) }), 'info');
      return;
    }

    const previousRoster = [...roster];
    setRoster((prev: Booking[]) => prev.map((b: Booking) =>
      b.status === 'booked' ? { ...b, status: newStatus } : b
    ));

    try {
      await classService.bulkUpdateStatus(toUpdate.map(b => b.id), newStatus);
      toast(t('{{count}} athletes marked as {{status}}', {
        count: toUpdate.length,
        status: t(newStatus),
      }), 'success');
    } catch (error) {
      console.error(error);
      setRoster(previousRoster); // Rollback
      toast(t('Some updates may have failed'), 'error');
    }
  };

  const nextDay = () => {
    const currentDate = new Date(`${date}T12:00:00Z`);
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    setDate(currentDate.toISOString().split('T')[0]);
  };

  const prevDay = () => {
    const currentDate = new Date(`${date}T12:00:00Z`);
    currentDate.setUTCDate(currentDate.getUTCDate() - 1);
    setDate(currentDate.toISOString().split('T')[0]);
  };

  const updateGuestStatus = async (guestBookingId: string, newStatus: BookingStatus) => {
    const previous = [...guestRoster];
    const previousStatus = guestRoster.find((g) => g.id === guestBookingId)?.status;
    setGuestRoster((prev) =>
      prev.map((g) => (g.id === guestBookingId ? { ...g, status: newStatus } : g)),
    );

    // Capacity: booked/attended occupy; transitioning into/out of occupying statuses adjusts count.
    const wasOccupying = previousStatus === 'booked' || previousStatus === 'attended';
    const nowOccupying = newStatus === 'booked' || newStatus === 'attended';
    if (selectedClassId && wasOccupying !== nowOccupying) {
      updateClassBookingCount(selectedClassId, nowOccupying ? 1 : -1);
    }

    try {
      await guestService.updateStatus(guestBookingId, newStatus);
    } catch (error) {
      console.error(error);
      setGuestRoster(previous);
      if (selectedClassId && wasOccupying !== nowOccupying) {
        updateClassBookingCount(selectedClassId, wasOccupying ? 1 : -1);
      }
      toast(t('Failed to update status'), 'error');
    }
  };

  const addGuest = async (input: {
    fullName?: string;
    whatsapp?: string;
    instagram?: string;
    guestAthleteId?: string;
  }) => {
    if (!selectedClassId) return;
    const selectedClass = classes.find((c) => c.id === selectedClassId);
    const count = selectedClass?.bookings[0]?.count ?? roster.length + guestRoster.filter((g) => g.status === 'booked' || g.status === 'attended').length;
    if (selectedClass && count >= selectedClass.max_capacity) {
      toast(t('Class is at full capacity'), 'error');
      return;
    }
    try {
      const guest = await guestService.addToClass({ classId: selectedClassId, ...input });
      setGuestRoster((prev) => [...prev, guest]);
      updateClassBookingCount(selectedClassId, 1);
      toast(t('Guest added to class'), 'success');
    } catch (error) {
      console.error(error);
      toast(error instanceof Error ? error.message : t('Failed to add guest'), 'error');
      throw error;
    }
  };

  const removeGuest = async (guestBookingId: string) => {
    if (!selectedClassId) return;
    const previous = [...guestRoster];
    const removed = guestRoster.find((g) => g.id === guestBookingId);
    setGuestRoster((prev) => prev.filter((g) => g.id !== guestBookingId));
    try {
      await guestService.remove(guestBookingId);
      if (removed && (removed.status === 'booked' || removed.status === 'attended')) {
        updateClassBookingCount(selectedClassId, -1);
      }
      toast(t('Guest removed from class'), 'success');
    } catch (error) {
      console.error(error);
      setGuestRoster(previous);
      toast(t('Failed to remove guest'), 'error');
    }
  };

  // Filtered Roster
  const term = searchTerm.toLowerCase();
  const filteredRoster = roster.filter(b => 
    b.profiles.full_name.toLowerCase().includes(term)
  );
  const filteredGuestRoster = guestRoster.filter((g) =>
    g.full_name.toLowerCase().includes(term)
  );

  return {
    date,
    setDate,
    classes,
    loadingClasses,
    selectedClassId,
    setSelectedClassId,
    roster,
    guestRoster,
    loadingRoster,
    searchTerm,
    setSearchTerm,
    filteredRoster,
    filteredGuestRoster,
    updateStatus,
    updateGuestStatus,
    addAthlete,
    addGuest,
    removeAthlete,
    removeGuest,
    markRemaining,
    nextDay,
    prevDay
  };
}
