import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Profile, AthletePlan } from '@/lib/types/gym';
import { athleteService } from '@/lib/services/athleteService';
import { useToast } from '@/components/Toast';
import { useLanguage } from '@/components/LanguageContext';

export type SortKey = 'full_name' | 'is_solvent' | 'created_at' | 'plan' | 'last_payment_date';
export type SortDir = 'asc' | 'desc';

export function useAthletes() {
  const { toast } = useToast();
  const { t, lang } = useLanguage();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [sendingResetId, setSendingResetId] = useState<string | null>(null);
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
      let profilesWithEmails = data;

      try {
        const emailResponse = await fetch('/api/admin/profiles/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: data.map((p) => p.id) }),
        });

        if (emailResponse.ok) {
          const { emails, invitePending } = await emailResponse.json();
          profilesWithEmails = data.map((p) => ({
            ...p,
            email: emails[p.id] ?? '',
            invite_pending: invitePending?.[p.id] ?? false,
          }));
        }
      } catch (emailError) {
        console.error('Error fetching profile emails:', emailError);
      }

      setProfiles(profilesWithEmails);
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
    resendWelcomeInvite,
    resendingInviteId,
    sendPasswordReset,
    sendingResetId,
    refresh: fetchProfiles
  };
}
