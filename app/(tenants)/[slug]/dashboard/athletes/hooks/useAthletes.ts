import { useState, useEffect, useRef, useCallback } from 'react';
import { Profile, AthletePlan } from '@/lib/types/gym';
import { athleteService } from '@/lib/services/athleteService';
import { useToast } from '@/components/Toast';
import { useLanguage } from '@/components/LanguageContext';

export type SortKey = 'full_name' | 'is_solvent' | 'created_at' | 'plan' | 'last_payment_date';
export type SortDir = 'asc' | 'desc';

const ITEMS_PER_PAGE = 20;

export function useAthletes() {
  const { toast } = useToast();
  const { t, lang } = useLanguage();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [sendingResetId, setSendingResetId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const [sortKey, setSortKey] = useState<SortKey>('full_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const planTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [debouncedSearch, roleFilter, sortKey, sortDir]);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(ITEMS_PER_PAGE),
        search: debouncedSearch,
        role: roleFilter,
        sortKey,
        sortDir,
      });

      const response = await fetch(`/api/admin/profiles?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load athlete data');
      }

      setProfiles(data.profiles);
      setTotalCount(data.totalCount);
      setUnpaidCount(data.unpaidCount);
    } catch (error) {
      console.error('Error fetching athletes:', error);
      toast('Failed to load athlete data', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, roleFilter, sortKey, sortDir, toast]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const toggleSolvency = async (id: string, currentStatus: boolean) => {
    try {
      setProfiles(prev => prev.map(p =>
        p.id === id ? { ...p, is_solvent: !currentStatus } : p
      ));

      if (currentStatus) {
        setUnpaidCount(prev => prev + 1);
      } else {
        setUnpaidCount(prev => Math.max(0, prev - 1));
      }

      await athleteService.updateSolvency(id, !currentStatus);
      toast(
        !currentStatus ? 'Athlete access restored' : 'Athlete access revoked',
        !currentStatus ? 'success' : 'warning'
      );
    } catch {
      toast('Failed to update status', 'error');
      fetchProfiles();
    }
  };

  const changePlan = (id: string, newPlan: string) => {
    setProfiles(prev => prev.map(p =>
      p.id === id ? { ...p, plan: newPlan as AthletePlan } : p
    ));

    if (planTimerRef.current[id]) {
      clearTimeout(planTimerRef.current[id]);
    }

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

  const resendWelcomeInvite = async (profile: Profile) => {
    if (profile.role !== 'member') {
      toast(t('Only members can receive welcome invites.'), 'warning');
      return;
    }

    setResendingInviteId(profile.id);
    try {
      const response = await fetch(`/api/admin/users/${profile.id}/resend-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      });

      const data = await response.json();

      if (!response.ok) {
        const apiError =
          data.error === 'Member has already completed registration.'
            ? t('Member has already completed registration.')
            : data.error;
        throw new Error(apiError || t('Failed to resend welcome invite'));
      }

      if (data.emailWarning) {
        toast(data.emailWarning, 'warning');
      }

      if (data.whatsappWarning) {
        toast(data.whatsappWarning, 'warning');
      }

      if (data.inviteSent) {
        toast(
          t('Welcome invite resent to {{name}}', { name: profile.full_name || t('Unnamed') }),
          'success'
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Failed to resend welcome invite');
      toast(message, 'error');
    } finally {
      setResendingInviteId(null);
    }
  };

  const sendPasswordReset = async (profile: Profile) => {
    if (profile.role !== 'member') {
      toast(t('Only members can receive password reset emails.'), 'warning');
      return;
    }

    if (!profile.email) {
      toast(t('User has no email address.'), 'error');
      return;
    }

    setSendingResetId(profile.id);
    try {
      const response = await fetch(`/api/admin/users/${profile.id}/send-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      });

      const data = await response.json();

      if (!response.ok) {
        const apiError =
          data.error === 'Member has not completed registration. Use resend welcome invite instead.'
            ? t('Member has not completed registration. Use resend welcome invite instead.')
            : data.error === 'User has no email address.'
              ? t('User has no email address.')
              : data.error;
        throw new Error(apiError || t('Failed to send password reset'));
      }

      if (data.resetSent) {
        toast(
          t('Password reset sent to {{name}}', { name: profile.full_name || t('Unnamed') }),
          'success'
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Failed to send password reset');
      toast(message, 'error');
    } finally {
      setSendingResetId(null);
    }
  };

  const deleteAthlete = async (profile: Profile) => {
    setDeletingId(profile.id);
    try {
      const response = await fetch(`/api/admin/users/${profile.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        const apiError =
          data.error === 'Only admins can delete athletes.'
            ? t('Only admins can delete athletes.')
            : data.error === 'You cannot delete your own account.'
              ? t('You cannot delete your own account.')
              : data.error;
        throw new Error(apiError || t('Failed to delete athlete'));
      }

      setTotalCount((prev) => Math.max(0, prev - 1));
      if (profile.role === 'member' && !profile.is_solvent) {
        setUnpaidCount((prev) => Math.max(0, prev - 1));
      }

      if (profiles.length === 1 && currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      } else {
        await fetchProfiles();
      }

      toast(
        t('Athlete deleted successfully', { name: profile.full_name || t('Unnamed') }),
        'success'
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Failed to delete athlete');
      toast(message, 'error');
    } finally {
      setDeletingId(null);
    }
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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

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
    currentPage,
    setCurrentPage,
    totalCount,
    totalPages,
    unpaidCount,
    toggleSolvency,
    changePlan,
    toggleInscription,
    resendWelcomeInvite,
    resendingInviteId,
    sendPasswordReset,
    sendingResetId,
    deleteAthlete,
    deletingId,
    refresh: fetchProfiles
  };
}
