import { useState, useEffect, useCallback } from 'react';
import { classService } from '@/lib/services/classService';
import { coachBriefService, CoachBrief } from '@/lib/services/coachBriefService';
import { ClassSession, Booking, CapacityInsight, WaitlistEntry } from '@/lib/types/gym';

export function useSchedule() {
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [roster, setRoster] = useState<Booking[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [capacityInsights, setCapacityInsights] = useState<CapacityInsight[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [coachBrief, setCoachBrief] = useState<CoachBrief | null>(null);
  const [coachBriefError, setCoachBriefError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const [classData, insightData] = await Promise.all([
        classService.getUpcomingClasses(),
        classService.getCapacityInsights(),
      ]);
      setClasses(classData);
      setCapacityInsights(insightData);
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
    setCoachBriefError(null);
    try {
      const [bookingsResult, waitlistResult, briefResult] = await Promise.allSettled([
        classService.getRoster(classId),
        classService.getWaitlist(classId),
        coachBriefService.getForClass(classId),
      ]);
      if (bookingsResult.status === 'rejected') throw bookingsResult.reason;
      setRoster(bookingsResult.value);
      if (waitlistResult.status === 'fulfilled') {
        setWaitlist(waitlistResult.value);
      } else {
        console.error('Error fetching waitlist:', waitlistResult.reason);
        setWaitlist([]);
      }
      if (briefResult.status === 'fulfilled') {
        setCoachBrief(briefResult.value);
      } else {
        console.error('Error fetching coach brief:', briefResult.reason);
        setCoachBrief(null);
        setCoachBriefError(
          briefResult.reason instanceof Error
            ? briefResult.reason.message
            : 'Could not load private coach brief.',
        );
      }
    } catch (error) {
      console.error('Error fetching roster:', error);
      setCoachBrief(null);
      setCoachBriefError(error instanceof Error ? error.message : 'Could not load private coach brief.');
    } finally {
      setLoadingRoster(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchRoster(selectedClassId);
    } else {
      setRoster([]);
      setWaitlist([]);
      setCoachBrief(null);
      setCoachBriefError(null);
    }
  }, [selectedClassId, fetchRoster]);

  const deleteClass = async (id: string) => {
    try {
      await classService.deleteClass(id);
      await fetchSchedule();
      return true;
    } catch {
      throw new Error('Could not delete class.');
    }
  };

  return {
    classes,
    loading,
    selectedClassId,
    setSelectedClassId,
    roster,
    waitlist,
    capacityInsights,
    loadingRoster,
    coachBrief,
    coachBriefError,
    fetchSchedule,
    deleteClass
  };
}
