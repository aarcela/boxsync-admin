import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Profile, AthletePlan } from '@/lib/types/gym';
import { athleteService } from '@/lib/services/athleteService';
import { useToast } from '@/components/Toast';

export type SortKey = 'full_name' | 'is_solvent' | 'created_at' | 'plan' | 'last_payment_date';
export type SortDir = 'asc' | 'desc';

export function useAthletes() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  
  // Sorting state
  const [sortKey, setSortKey] = useState<SortKey>('full_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Debounce refs for plan changes
  const planTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await athleteService.getProfiles();
      setProfiles(data);
    } catch (error) {
      console.error('Error fetching athletes:', error);
      toast('Failed to load athlete data', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Actions
  const toggleSolvency = async (id: string, currentStatus: boolean) => {
    try {
      // Optimistic Update
      setProfiles(prev => prev.map(p => 
        p.id === id ? { ...p, is_solvent: !currentStatus } : p
      ));
      
      await athleteService.updateSolvency(id, !currentStatus);
      toast(
        !currentStatus ? 'Athlete access restored' : 'Athlete access revoked', 
        !currentStatus ? 'success' : 'warning'
      );
    } catch {
      toast('Failed to update status', 'error');
      fetchProfiles(); // Revert
    }
  };

  const changePlan = (id: string, newPlan: string) => {
    // Optimistic Update immediately
    setProfiles(prev => prev.map(p => 
      p.id === id ? { ...p, plan: newPlan as AthletePlan } : p
    ));

    // Clear previous timer for this profile
    if (planTimerRef.current[id]) {
      clearTimeout(planTimerRef.current[id]);
    }

    // Set new debounce timer
    planTimerRef.current[id] = setTimeout(async () => {
      try {
        await athleteService.updatePlan(id, newPlan);
        toast('Plan updated', 'success');
      } catch {
        toast('Failed to update plan', 'error');
        fetchProfiles();
      }
      delete planTimerRef.current[id];
    }, 1500);
  };

  const toggleInscription = async (id: string, currentStatus: boolean) => {
    try {
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, inscription_paid: !currentStatus } : p));
      await athleteService.updateInscriptionStatus(id, !currentStatus);
      toast(
        !currentStatus ? 'Inscription marked as paid' : 'Inscription marked as unpaid',
        !currentStatus ? 'success' : 'info'
      );
    } catch {
      toast('Failed to update status', 'error');
      fetchProfiles();
    }
  };

  // UI Derived state
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filteredProfiles = useMemo(() => {
    return profiles
      .filter(profile => {
        const matchesSearch = (profile.full_name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || profile.role === roleFilter;
        return matchesSearch && matchesRole;
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        switch (sortKey) {
          case 'full_name':
            return dir * (a.full_name || '').localeCompare(b.full_name || '');
          case 'is_solvent':
            return dir * (Number(b.is_solvent) - Number(a.is_solvent));
          case 'created_at':
            return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          case 'plan':
            return dir * (a.plan || '').localeCompare(b.plan || '');
          case 'last_payment_date':
            return dir * (new Date(a.last_payment_date || 0).getTime() - new Date(b.last_payment_date || 0).getTime());
          default:
            return 0;
        }
      });
  }, [profiles, searchTerm, roleFilter, sortDir, sortKey]);

  return {
    profiles,
    loading,
    searchTerm,
    setSearchTerm,
    roleFilter,
    setRoleFilter,
    sortKey,
    sortDir,
    handleSort,
    filteredProfiles,
    toggleSolvency,
    changePlan,
    toggleInscription,
    refresh: fetchProfiles
  };
}
