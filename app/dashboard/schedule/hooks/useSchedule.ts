import { useState, useEffect, useCallback } from 'react';
import { scheduleService } from '../services/schedule.service';
import { ClassSession, Booking } from '../types';

export function useSchedule() {
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [roster, setRoster] = useState<Booking[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const data = await scheduleService.fetchSchedule();
      setClasses(data);
    } catch (error) {
      console.error('Error fetching schedule:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const fetchRoster = useCallback(async (classId: string) => {
    setLoadingRoster(true);
    try {
      const bookings = await scheduleService.fetchRoster(classId);
      setRoster(bookings);
    } catch (error) {
      console.error('Error fetching roster:', error);
    } finally {
      setLoadingRoster(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchRoster(selectedClassId);
    } else {
      setRoster([]);
    }
  }, [selectedClassId, fetchRoster]);

  const deleteClass = async (id: string) => {
    if (!confirm('Are you sure you want to cancel and delete this class? This will remove all bookings.')) return;
    
    try {
      await scheduleService.deleteClass(id);
      await fetchSchedule();
    } catch (error) {
      alert('Could not delete class.');
    }
  };

  return {
    classes,
    loading,
    selectedClassId,
    setSelectedClassId,
    roster,
    loadingRoster,
    fetchSchedule,
    deleteClass
  };
}
