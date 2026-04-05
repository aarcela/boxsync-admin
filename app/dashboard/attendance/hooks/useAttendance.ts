import { useState, useEffect, useCallback } from 'react';
import { getCaracasDate } from '@/lib/utils/date';
import { classService } from '@/lib/services/classService';
import { Booking, ClassSession, BookingStatus } from '@/lib/types/gym';
import { useToast } from '@/components/Toast';

export function useAttendance() {
  const { toast } = useToast();
  
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
      toast('Failed to load classes', 'error');
    } finally {
      setLoadingClasses(false);
    }
  }, [toast]);

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
      toast('Failed to load roster', 'error');
    } finally {
      setLoadingRoster(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedClassId) {
      fetchRoster(selectedClassId);
    }
  }, [selectedClassId, fetchRoster]);

  // Actions
  const updateStatus = async (bookingId: string, newStatus: BookingStatus) => {
    // Optimistic Update
    const previousRoster = [...roster];
    setRoster((prev: Booking[]) => prev.map((b: Booking) => 
      b.id === bookingId ? { ...b, status: newStatus } : b
    ));

    try {
      await classService.updateBookingStatus(bookingId, newStatus);
    } catch (error) {
      console.error(error);
      setRoster(previousRoster); // Rollback
      toast('Failed to update status', 'error');
    }
  };

  const markAll = async (newStatus: BookingStatus) => {
    const toUpdate = roster.filter(b => b.status !== newStatus);
    if (toUpdate.length === 0) {
      toast(`All athletes are already marked as ${newStatus}`, 'info');
      return;
    }

    const previousRoster = [...roster];
    setRoster((prev: Booking[]) => prev.map((b: Booking) => ({ ...b, status: newStatus })));

    try {
      await classService.bulkUpdateStatus(toUpdate.map(b => b.id), newStatus);
      toast(`${toUpdate.length} athletes marked as ${newStatus.replace('_', ' ')}`, 'success');
    } catch (error) {
      console.error(error);
      setRoster(previousRoster); // Rollback
      toast('Some updates may have failed', 'error');
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
    markAll,
    nextDay,
    prevDay
  };
}
