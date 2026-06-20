import { useState, useEffect, useCallback } from 'react';
import { getCaracasDate } from '@/lib/utils/date';
import { classService } from '@/lib/services/classService';
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
    
    try {
      const data = await classService.getClassesByDate(selectedDate);
      setClasses(data);
      
      // Auto-select class closest to now if looking at today
      const todayStr = getCaracasDate();
      if (selectedDate === todayStr && data.length > 0) {
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
      const bookings = await classService.getRoster(classId);
      setRoster(bookings);
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
      // #region agent log
      fetch('http://127.0.0.1:7729/ingest/aa08aa43-142a-4241-a147-9baa0dcd0e11',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'be8fa1'},body:JSON.stringify({sessionId:'be8fa1',location:'useAttendance.ts:addAthlete',message:'calling createBooking',data:{selectedClassId,userId},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      const booking = await classService.createBooking(selectedClassId, userId);
      // #region agent log
      fetch('http://127.0.0.1:7729/ingest/aa08aa43-142a-4241-a147-9baa0dcd0e11',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'be8fa1'},body:JSON.stringify({sessionId:'be8fa1',location:'useAttendance.ts:addAthlete:success',message:'createBooking succeeded',data:{bookingId:booking.id},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
      // #endregion
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

  const markAll = async (newStatus: BookingStatus) => {
    const toUpdate = roster.filter(b => b.status !== newStatus);
    if (toUpdate.length === 0) {
      toast(t('All athletes are already marked as {{status}}', { status: t(newStatus as 'attended' | 'no_show' | 'booked') }), 'info');
      return;
    }

    const previousRoster = [...roster];
    setRoster((prev: Booking[]) => prev.map((b: Booking) => ({ ...b, status: newStatus })));

    try {
      await classService.bulkUpdateStatus(toUpdate.map(b => b.id), newStatus);
      toast(t('{{count}} athletes marked as {{status}}', {
        count: toUpdate.length,
        status: t(newStatus as 'attended' | 'no_show' | 'booked'),
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

  // Filtered Roster
  const filteredRoster = roster.filter(b => 
    b.profiles.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return {
    date,
    setDate,
    classes,
    loadingClasses,
    selectedClassId,
    setSelectedClassId,
    roster,
    loadingRoster,
    searchTerm,
    setSearchTerm,
    filteredRoster,
    updateStatus,
    addAthlete,
    removeAthlete,
    markAll,
    nextDay,
    prevDay
  };
}
