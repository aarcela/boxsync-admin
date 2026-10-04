'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Search, UserPlus, Filter, Edit2, Trash2, ArrowUpDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, MessageCircle, Calendar, Mail, Loader2, KeyRound, MoreVertical, Clock } from 'lucide-react';
import AddAthleteModal from '@/components/AddAthleteModal';
import EditAthleteModal from '@/components/EditAthleteModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/components/LanguageContext';
import { formatDistanceToNow } from 'date-fns';
import { useAthletes, SortKey, SortDir } from './hooks/useAthletes';
import { Profile, MembershipPlan } from '@/lib/types/gym';
import { membershipPlanService } from '@/lib/services/membershipPlanService';
import { supabase } from '@/lib/supabase';
import { getRenewDateInputValue } from '@/lib/renew-date';
import ProfileAvatar from '@/components/ProfileAvatar';

function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== column) return <ArrowUpDown size={12} className="ml-1 opacity-30" />;
  return sortDir === 'asc'
    ? <ChevronUp size={12} className="ml-1 text-pits-red" />
    : <ChevronDown size={12} className="ml-1 text-pits-red" />;
}

const ACTION_MENU_WIDTH = 220;
const ACTION_MENU_ITEM_HEIGHT = 40;

export default function AthletesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const {
    profiles,
    loading,
    searchTerm,
    setSearchTerm,
    roleFilter,
    setRoleFilter,
    solvencyFilter,
    setSolvencyFilter,
    planFilter,
    setPlanFilter,
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
    updateRenewDate,
    resendWelcomeInvite,
    resendingInviteId,
    sendPasswordReset,
    sendingResetId,
    sendExpiryReminder,
    sendingReminderId,
    deleteAthlete,
    deletingId,
    bulkBusy,
    bulkChangePlan,
    bulkUpdateRenewDate,
    bulkResendInvites,
    bulkSendPasswordResets,
    bulkSendExpiryReminders,
    refresh
  } = useAthletes();

  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const isAdmin = callerRole === 'admin';
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPlanId, setBulkPlanId] = useState('');
  const [bulkRenewDate, setBulkRenewDate] = useState('');

  useEffect(() => {
    const loadContext = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, tenant_id')
        .eq('id', user.id)
        .single();

      setCallerRole(profile?.role ?? null);

      if (profile?.tenant_id) {
        try {
          const plans = await membershipPlanService.getActiveMembershipPlans(profile.tenant_id);
          setMembershipPlans(plans);
        } catch (error) {
          console.error(error);
        }
      }
    };

    loadContext();
  }, []);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Confirm dialog for solvency toggle
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    profileId: string;
    profileName: string;
    currentSolvency: boolean;
  }>({ isOpen: false, profileId: '', profileName: '', currentSolvency: false });

  const [inviteConfirm, setInviteConfirm] = useState<{
    isOpen: boolean;
    profile: Profile | null;
  }>({ isOpen: false, profile: null });

  const [resetConfirm, setResetConfirm] = useState<{
    isOpen: boolean;
    profile: Profile | null;
  }>({ isOpen: false, profile: null });

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    profile: Profile | null;
  }>({ isOpen: false, profile: null });

  const [reminderConfirm, setReminderConfirm] = useState<{
    isOpen: boolean;
    profile: Profile | null;
  }>({ isOpen: false, profile: null });

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const openMenuProfile = openMenuId
    ? profiles.find((profile) => profile.id === openMenuId) ?? null
    : null;

  const getActionMenuItemCount = useCallback((profile: Profile) => {
    let count = 1;
    if (profile.role === 'member') {
      count += 1;
      if (profile.invite_pending || profile.email) count += 1;
    }
    if (isAdmin && profile.id !== currentUserId) count += 1;
    return count;
  }, [isAdmin, currentUserId]);

  const updateMenuPosition = useCallback((profileId: string) => {
    const button = menuButtonRefs.current[profileId];
    const profile = profiles.find((item) => item.id === profileId);
    if (!button || !profile) return;

    const rect = button.getBoundingClientRect();
    const menuHeight = getActionMenuItemCount(profile) * ACTION_MENU_ITEM_HEIGHT + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < menuHeight + 8 && spaceAbove > spaceBelow;
    const top = openUp ? rect.top - menuHeight - 4 : rect.bottom + 4;
    const left = Math.max(
      8,
      Math.min(rect.right - ACTION_MENU_WIDTH, window.innerWidth - ACTION_MENU_WIDTH - 8)
    );

    setMenuPosition({ top, left });
  }, [profiles, getActionMenuItemCount]);

  const closeMenu = () => {
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  const toggleMenu = (profileId: string) => {
    if (openMenuId === profileId) {
      closeMenu();
      return;
    }
    setOpenMenuId(profileId);
  };

  useEffect(() => {
    if (!openMenuId) return;
    updateMenuPosition(openMenuId);
  }, [openMenuId, updateMenuPosition]);

  useEffect(() => {
    if (!openMenuId) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (menuButtonRefs.current[openMenuId]?.contains(target)) return;
      closeMenu();
    };

    const handleReposition = () => updateMenuPosition(openMenuId);

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [openMenuId, updateMenuPosition]);

  const [planConfirm, setPlanConfirm] = useState<{
    isOpen: boolean;
    profileId: string;
    profileName: string;
    currentPlanId: string;
    newPlanId: string;
  }>({ isOpen: false, profileId: '', profileName: '', currentPlanId: '', newPlanId: '' });

  const [bulkConfirm, setBulkConfirm] = useState<{
    isOpen: boolean;
    action: 'plan' | 'renew' | 'invite' | 'reset' | 'reminder' | null;
  }>({ isOpen: false, action: null });

  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage, searchTerm, roleFilter, solvencyFilter, planFilter, sortKey, sortDir]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = profiles.length > 0 && selectedIds.size === profiles.length;
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(profiles.map((p) => p.id)));
  };

  const selectedProfiles = profiles.filter((p) => selectedIds.has(p.id));
  const selectedMemberCount = selectedProfiles.filter((p) => p.role === 'member').length;
  const selectedInviteCount = selectedProfiles.filter(
    (p) => p.role === 'member' && p.invite_pending
  ).length;
  const selectedResetCount = selectedProfiles.filter(
    (p) => p.role === 'member' && !p.invite_pending && !!p.email
  ).length;
  const selectedReminderCount = selectedProfiles.filter(
    (p) => p.role === 'member' && !!p.phone?.trim()
  ).length;

  const planLabel = (planId: string) =>
    membershipPlans.find((p) => p.id === planId)?.name ?? planId.replace(/_/g, ' ');

  const bulkConfirmCopy = () => {
    const count = selectedIds.size;
    switch (bulkConfirm.action) {
      case 'plan':
        return {
          title: t('Apply plan to selected'),
          message: t('Apply plan {{plan}} to {{count}} selected athletes? Non-members are skipped.', {
            plan: planLabel(bulkPlanId),
            count,
          }),
          confirmLabel: t('Apply plan'),
        };
      case 'renew':
        return {
          title: t('Set renew date for selected'),
          message: t('Set renew date {{date}} for {{count}} selected athletes? Non-members are skipped.', {
            date: bulkRenewDate,
            count,
          }),
          confirmLabel: t('Set renew date'),
        };
      case 'invite':
        return {
          title: t('Resend welcome invite'),
          message: t('Resend welcome invites to {{eligible}} of {{count}} selected? Others are skipped.', {
            eligible: selectedInviteCount,
            count,
          }),
          confirmLabel: t('Resend'),
        };
      case 'reset':
        return {
          title: t('Send password reset'),
          message: t('Send password resets to {{eligible}} of {{count}} selected? Others are skipped.', {
            eligible: selectedResetCount,
            count,
          }),
          confirmLabel: t('Send reset link'),
        };
      case 'reminder':
        return {
          title: t('Send expiry reminder'),
          message: t('Send expiry reminders to {{eligible}} of {{count}} selected? Others are skipped.', {
            eligible: selectedReminderCount,
            count,
          }),
          confirmLabel: t('Send Reminder'),
        };
      default:
        return { title: '', message: '', confirmLabel: t('Confirm') };
    }
  };

  // TOGGLE SOLVENCY — with confirmation
  const executeSolvencyToggle = async () => {
    const { profileId: id, currentSolvency: currentStatus } = confirmConfig;
    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    await toggleSolvency(id, currentStatus);
  };

  const executeResendInvite = async () => {
    const profile = inviteConfirm.profile;
    setInviteConfirm({ isOpen: false, profile: null });
    if (profile) await resendWelcomeInvite(profile);
  };

  const executeSendPasswordReset = async () => {
    const profile = resetConfirm.profile;
    setResetConfirm({ isOpen: false, profile: null });
    if (profile) await sendPasswordReset(profile);
  };

  const executeDeleteAthlete = async () => {
    const profile = deleteConfirm.profile;
    setDeleteConfirm({ isOpen: false, profile: null });
    if (profile) await deleteAthlete(profile);
  };

  const executeSendExpiryReminder = async () => {
    const profile = reminderConfirm.profile;
    setReminderConfirm({ isOpen: false, profile: null });
    if (profile) await sendExpiryReminder(profile);
  };

  const executePlanChange = async () => {
    const { profileId, newPlanId, currentPlanId } = planConfirm;
    setPlanConfirm((prev) => ({ ...prev, isOpen: false }));
    if (profileId && newPlanId && newPlanId !== currentPlanId) {
      await changePlan(profileId, newPlanId);
    }
  };

  const executeBulkAction = async () => {
    const action = bulkConfirm.action;
    const ids = Array.from(selectedIds);
    setBulkConfirm({ isOpen: false, action: null });
    if (!action || ids.length === 0) return;

    if (action === 'plan') {
      if (!bulkPlanId) return;
      await bulkChangePlan(ids, bulkPlanId);
    } else if (action === 'renew') {
      if (!bulkRenewDate) return;
      await bulkUpdateRenewDate(ids, bulkRenewDate);
    } else if (action === 'invite') {
      await bulkResendInvites(ids);
    } else if (action === 'reset') {
      await bulkSendPasswordResets(ids);
    } else if (action === 'reminder') {
      await bulkSendExpiryReminders(ids);
    }

    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-black text-pits-text tracking-tight">
            {t('Roster')}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-pits-dim">
            <span>
              {t('Showing {{count}} of {{total}} entries', {
                count: loading ? '…' : profiles.length,
                total: totalCount,
              })}
            </span>
            {unpaidCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  setSolvencyFilter((prev) => (prev === 'unpaid' ? 'all' : 'unpaid'))
                }
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border transition-colors ${
                  solvencyFilter === 'unpaid'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
              >
                {t('{{count}} Unpaid', { count: unpaidCount })}
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 min-h-10 px-4 rounded-lg bg-pits-text text-white text-xs font-bold hover:bg-black transition-colors"
        >
          <UserPlus size={16} aria-hidden />
          {t('Add Athlete')}
        </button>
      </div>

      <div className="bg-pits-surface-elevated p-3 sm:p-4 rounded-xl border border-pits-edge space-y-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim pointer-events-none"
            size={16}
            aria-hidden
          />
          <input
            type="search"
            placeholder={t('Search by name...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-h-10 pl-9 pr-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm font-medium text-pits-text focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="hidden sm:flex items-center text-pits-dim shrink-0 px-1">
            <Filter size={16} aria-hidden />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label={t('All Roles')}
            className="w-full sm:flex-1 min-h-10 px-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary"
          >
            <option value="all">{t('All Roles')}</option>
            <option value="member">{t('Members')}</option>
            <option value="coach">{t('Coaches')}</option>
            <option value="manager">{t('Managers')}</option>
            <option value="admin">{t('Admins')}</option>
          </select>
          <select
            value={solvencyFilter}
            onChange={(e) =>
              setSolvencyFilter(e.target.value as 'all' | 'solvent' | 'unpaid')
            }
            aria-label={t('All statuses')}
            className="w-full sm:flex-1 min-h-10 px-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary"
          >
            <option value="all">{t('All statuses')}</option>
            <option value="solvent">{t('Solvent / Paid')}</option>
            <option value="unpaid">{t('Debt / Unpaid')}</option>
          </select>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            aria-label={t('All plans')}
            className="w-full sm:flex-1 min-h-10 px-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary"
          >
            <option value="all">{t('All plans')}</option>
            {membershipPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {someSelected && (
        <div className="flex flex-col gap-3 bg-pits-surface-elevated p-3 sm:p-4 rounded-xl border border-pits-primary/30 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black text-pits-dim uppercase tracking-wider">
              {t('{{count}} selected', { count: selectedIds.size })}
              {selectedMemberCount < selectedIds.size
                ? ` · ${t('{{count}} members', { count: selectedMemberCount })}`
                : ''}
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkBusy}
              className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase text-pits-dim border border-pits-edge hover:bg-pits-surface-muted disabled:opacity-50"
            >
              {t('Clear selection')}
            </button>
          </div>
          <div className="flex flex-col lg:flex-row flex-wrap gap-2 lg:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkPlanId}
                onChange={(e) => setBulkPlanId(e.target.value)}
                disabled={bulkBusy || membershipPlans.length === 0}
                aria-label={t('Apply plan')}
                className="min-h-9 px-2 bg-pits-surface-muted border border-pits-edge rounded-lg text-xs font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-primary/40 disabled:opacity-50"
              >
                <option value="">{t('Select plan')}</option>
                {membershipPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={bulkBusy || !bulkPlanId || selectedMemberCount === 0}
                onClick={() => setBulkConfirm({ isOpen: true, action: 'plan' })}
                className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border bg-pits-primary-soft text-pits-success border-pits-success/30 hover:opacity-90 disabled:opacity-50"
              >
                {t('Apply plan')}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={bulkRenewDate}
                onChange={(e) => setBulkRenewDate(e.target.value)}
                disabled={bulkBusy}
                aria-label={t('Renew date')}
                className="min-h-9 px-2 bg-pits-surface-muted border border-pits-edge rounded-lg text-xs font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-primary/40 disabled:opacity-50 max-w-[148px]"
              />
              <button
                type="button"
                disabled={bulkBusy || !bulkRenewDate || selectedMemberCount === 0}
                onClick={() => setBulkConfirm({ isOpen: true, action: 'renew' })}
                className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border bg-pits-surface-muted text-pits-text border-pits-edge hover:bg-pits-surface-muted/80 disabled:opacity-50"
              >
                {t('Set renew date')}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={bulkBusy || selectedInviteCount === 0}
                onClick={() => setBulkConfirm({ isOpen: true, action: 'invite' })}
                className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border bg-pits-surface-muted text-pits-text border-pits-edge hover:bg-pits-surface-muted/80 disabled:opacity-50"
              >
                {t('Resend invites')} ({selectedInviteCount})
              </button>
              <button
                type="button"
                disabled={bulkBusy || selectedResetCount === 0}
                onClick={() => setBulkConfirm({ isOpen: true, action: 'reset' })}
                className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border bg-pits-surface-muted text-pits-text border-pits-edge hover:bg-pits-surface-muted/80 disabled:opacity-50"
              >
                {t('Send password resets')} ({selectedResetCount})
              </button>
              <button
                type="button"
                disabled={bulkBusy || selectedReminderCount === 0}
                onClick={() => setBulkConfirm({ isOpen: true, action: 'reminder' })}
                className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border bg-orange-100 text-orange-700 border-orange-300 hover:opacity-90 disabled:opacity-50"
              >
                {t('Send expiry reminders')} ({selectedReminderCount})
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-pits-surface-elevated rounded-xl border border-pits-edge overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-pits-dim">
            <Loader2 size={28} className="animate-spin text-pits-red" aria-hidden />
            <p className="text-xs font-bold uppercase tracking-widest">
              {t('Loading roster page...')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-pits-dim uppercase tracking-[0.14em] font-black border-b border-pits-edge bg-pits-surface-muted/60">
                <tr>
                  <th className="px-3 sm:px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={toggleSelectAll}
                      aria-label={t('Select all')}
                      className="rounded border-pits-edge text-pits-primary focus:ring-pits-primary/40"
                    />
                  </th>
                  <th className="px-4 sm:px-5 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('full_name')}
                      className="inline-flex items-center hover:text-pits-text transition-colors"
                    >
                      {t('Athlete / Contact')}
                      <SortIcon column="full_name" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-4 sm:px-5 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('plan')}
                      className="inline-flex items-center hover:text-pits-text transition-colors"
                    >
                      {t('Plan')}
                      <SortIcon column="plan" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-4 sm:px-5 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('is_solvent')}
                      className="inline-flex items-center hover:text-pits-text transition-colors"
                    >
                      {t('Status')}
                      <SortIcon column="is_solvent" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-4 sm:px-5 py-3 whitespace-nowrap">{t('Renew date')}</th>
                  <th className="px-4 sm:px-5 py-3 whitespace-nowrap">{t('Activity')}</th>
                  <th className="px-4 sm:px-5 py-3 text-right">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pits-edge">
                {profiles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-pits-dim">
                      {t('No records found.')}
                    </td>
                  </tr>
                ) : (
                  profiles.map((profile) => {
                    const phoneDigits = profile.phone?.replace(/[^0-9]/g, '') || '';
                    const attended =
                      profile.bookings?.filter((b) => b.status === 'attended').length || 0;
                    const lastVisit = profile.bookings
                      ?.filter((b) => b.status === 'attended')
                      .sort(
                        (a, b) =>
                          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                      )[0];
                    const lastVisitDate = lastVisit ? new Date(lastVisit.created_at) : null;
                    const inactiveDays = lastVisitDate
                      ? Math.floor(
                          (Date.now() - lastVisitDate.getTime()) / (1000 * 3600 * 24)
                        )
                      : null;
                    const isSelected = selectedIds.has(profile.id);

                    return (
                      <tr
                        key={profile.id}
                        onClick={() => router.push(`/dashboard/athletes/${profile.id}`)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'ring-1 ring-inset ring-pits-primary ' : ''
                        }${
                          profile.is_solvent
                            ? 'hover:bg-pits-surface-muted/70'
                            : 'bg-amber-50/40 hover:bg-amber-50/70'
                        }`}
                      >
                        <td
                          className="px-3 sm:px-4 py-3.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelected(profile.id)}
                            aria-label={t('Select athlete')}
                            className="rounded border-pits-edge text-pits-primary focus:ring-pits-primary/40"
                          />
                        </td>
                        <td className="px-4 sm:px-5 py-3.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-pits-surface-muted border border-pits-edge overflow-hidden shrink-0 flex items-center justify-center">
                              <ProfileAvatar
                                url={profile.avatar_url}
                                name={profile.full_name}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-bold text-pits-text truncate">
                                  {profile.full_name || t('Unnamed')}
                                </span>
                                {phoneDigits && (
                                  <a
                                    href={`https://wa.me/${phoneDigits}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors shrink-0"
                                    title={t('Text on WhatsApp')}
                                    aria-label={t('Text on WhatsApp')}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MessageCircle size={14} />
                                  </a>
                                )}
                              </div>
                              {profile.email && (
                                <p className="text-[11px] text-pits-dim truncate max-w-[220px]">
                                  {profile.email}
                                </p>
                              )}
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-pits-surface-muted text-pits-dim border border-pits-edge">
                                  {profile.role}
                                </span>
                                {profile.created_at && (
                                  <span className="text-[10px] text-pits-dim">
                                    {formatDistanceToNow(new Date(profile.created_at), {
                                      addSuffix: true,
                                    })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 sm:px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-1.5 min-w-[140px]">
                            <select
                              value={profile.plan || ''}
                              disabled={
                                membershipPlans.length === 0 || profile.role !== 'member'
                              }
                              onChange={(e) => {
                                const newPlanId = e.target.value;
                                if (!newPlanId || newPlanId === profile.plan) return;
                                setPlanConfirm({
                                  isOpen: true,
                                  profileId: profile.id,
                                  profileName: profile.full_name || t('Unnamed'),
                                  currentPlanId: profile.plan || '',
                                  newPlanId,
                                });
                              }}
                              className="w-full min-h-9 bg-pits-surface-muted border border-pits-edge rounded-lg px-2 text-xs font-bold text-pits-text focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-50"
                            >
                              {profile.plan &&
                                !membershipPlans.some((p) => p.id === profile.plan) && (
                                  <option value={profile.plan}>
                                    {planLabel(profile.plan)}
                                  </option>
                                )}
                              {membershipPlans.map((plan) => (
                                <option key={plan.id} value={plan.id}>
                                  {plan.name}
                                </option>
                              ))}
                            </select>
                            <span
                              className={`inline-flex text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                profile.inscription_paid
                                  ? 'bg-pits-surface-muted text-pits-dim border-pits-edge'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {profile.inscription_plan || 'standard'}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 sm:px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmConfig({
                                  isOpen: true,
                                  profileId: profile.id,
                                  profileName: profile.full_name || t('this athlete'),
                                  currentSolvency: profile.is_solvent,
                                })
                              }
                              className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border transition-colors ${
                                profile.is_solvent
                                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                              }`}
                            >
                              {profile.is_solvent ? t('Solvent / Paid') : t('Debt / Unpaid')}
                            </button>
                            <p className="text-[10px] text-pits-dim">
                              {profile.last_payment_date
                                ? formatDistanceToNow(new Date(profile.last_payment_date), {
                                    addSuffix: true,
                                  })
                                : t('No payments')}
                            </p>
                          </div>
                        </td>

                        <td
                          className="px-4 sm:px-5 py-3.5 whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {profile.role === 'member' ? (
                            <input
                              type="date"
                              value={getRenewDateInputValue(profile)}
                              onChange={(e) => {
                                const value = e.target.value || null;
                                void updateRenewDate(profile.id, value);
                              }}
                              className="min-h-9 bg-pits-surface-muted border border-pits-edge rounded-lg px-2 text-xs font-bold text-pits-text focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none max-w-[148px]"
                              title={t('Renew date')}
                            />
                          ) : (
                            <span className="text-xs text-pits-dim">—</span>
                          )}
                        </td>

                        <td className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-pits-text">
                              {t('{{count}} Visits (30d)', { count: attended })}
                            </p>
                            <p
                              className={`inline-flex items-center gap-1 text-[11px] ${
                                inactiveDays != null && inactiveDays > 10
                                  ? 'text-red-600 font-bold'
                                  : 'text-pits-dim'
                              }`}
                            >
                              <Calendar size={12} aria-hidden />
                              {lastVisitDate
                                ? formatDistanceToNow(lastVisitDate, { addSuffix: true })
                                : t('Never')}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 sm:px-5 py-3.5 text-right">
                          <div
                            className="inline-flex items-center justify-end gap-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUserId(profile.id);
                                setIsEditModalOpen(true);
                              }}
                              className="p-2 min-h-9 min-w-9 text-pits-dim hover:text-pits-text hover:bg-pits-surface-muted rounded-lg transition-colors"
                              title={t('Edit athlete')}
                              aria-label={t('Edit athlete')}
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              type="button"
                              ref={(element) => {
                                menuButtonRefs.current[profile.id] = element;
                              }}
                              onClick={() => toggleMenu(profile.id)}
                              className="p-2 min-h-9 min-w-9 text-pits-dim hover:text-pits-text hover:bg-pits-surface-muted rounded-lg transition-colors"
                              title={t('More actions')}
                              aria-label={t('More actions')}
                              aria-expanded={openMenuId === profile.id}
                            >
                              <MoreVertical size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalCount > 0 && (
          <div className="px-4 sm:px-5 py-3.5 bg-pits-surface-muted/50 border-t border-pits-edge flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] font-bold text-pits-dim">
              {t('Showing {{count}} of {{total}} entries', {
                count: profiles.length,
                total: totalCount,
              })}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || loading}
                className="p-2 min-h-9 min-w-9 inline-flex items-center justify-center bg-pits-surface-elevated border border-pits-edge rounded-lg hover:bg-pits-surface-muted text-pits-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={t('Previous')}
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum =
                    currentPage <= 3
                      ? i + 1
                      : currentPage >= totalPages - 2
                        ? totalPages - 4 + i
                        : currentPage - 2 + i;
                  if (pageNum <= 0 || pageNum > totalPages) return null;
                  return (
                    <button
                      type="button"
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-9 h-9 rounded-lg text-xs font-bold transition-colors ${
                        currentPage === pageNum
                          ? 'bg-pits-text text-white'
                          : 'bg-pits-surface-elevated border border-pits-edge text-pits-dim hover:text-pits-text'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || loading}
                className="p-2 min-h-9 min-w-9 inline-flex items-center justify-center bg-pits-surface-elevated border border-pits-edge rounded-lg hover:bg-pits-surface-muted text-pits-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={t('Next')}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <AddAthleteModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={refresh}
      />

      <EditAthleteModal 
        isOpen={isEditModalOpen} 
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUserId(null);
        }}
        onSuccess={refresh}
        userId={selectedUserId}
      />

      {/* SOLVENCY CONFIRMATION */}
      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.currentSolvency ? t('Revoke Access') : t('Restore Access')}
        message={
          confirmConfig.currentSolvency
            ? t('Lock out confirm message', { name: confirmConfig.profileName })
            : t('Restore access confirm message', { name: confirmConfig.profileName })
        }
        confirmLabel={confirmConfig.currentSolvency ? t('Lock Out') : t('Restore')}
        variant={confirmConfig.currentSolvency ? 'danger' : 'default'}
        onConfirm={executeSolvencyToggle}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      <ConfirmDialog
        isOpen={inviteConfirm.isOpen}
        title={t('Resend welcome invite')}
        message={t('Resend welcome invite confirm message', {
          name: inviteConfirm.profile?.full_name || t('Unnamed'),
        })}
        confirmLabel={t('Resend')}
        onConfirm={executeResendInvite}
        onCancel={() => setInviteConfirm({ isOpen: false, profile: null })}
      />

      <ConfirmDialog
        isOpen={resetConfirm.isOpen}
        title={t('Send password reset')}
        message={t('Send password reset confirm message', {
          name: resetConfirm.profile?.full_name || t('Unnamed'),
        })}
        confirmLabel={t('Send reset link')}
        onConfirm={executeSendPasswordReset}
        onCancel={() => setResetConfirm({ isOpen: false, profile: null })}
      />

      <ConfirmDialog
        isOpen={reminderConfirm.isOpen}
        title={t('Send expiry reminder')}
        message={t('Send expiry reminder confirm message', {
          name: reminderConfirm.profile?.full_name || t('Unnamed'),
        })}
        confirmLabel={t('Send Reminder')}
        onConfirm={executeSendExpiryReminder}
        onCancel={() => setReminderConfirm({ isOpen: false, profile: null })}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={t('Delete athlete')}
        message={t('Delete athlete confirm message', {
          name: deleteConfirm.profile?.full_name || t('Unnamed'),
        })}
        confirmLabel={t('Delete')}
        variant="danger"
        onConfirm={executeDeleteAthlete}
        onCancel={() => setDeleteConfirm({ isOpen: false, profile: null })}
      />

      <ConfirmDialog
        isOpen={planConfirm.isOpen}
        title={t('Change plan')}
        message={t('Change plan confirm message', {
          name: planConfirm.profileName,
          from: planLabel(planConfirm.currentPlanId),
          to: planLabel(planConfirm.newPlanId),
        })}
        confirmLabel={t('Change plan')}
        onConfirm={executePlanChange}
        onCancel={() => setPlanConfirm((prev) => ({ ...prev, isOpen: false }))}
      />

      {(() => {
        const bulkCopy = bulkConfirmCopy();
        return (
          <ConfirmDialog
            isOpen={bulkConfirm.isOpen}
            title={bulkCopy.title}
            message={bulkCopy.message}
            confirmLabel={bulkCopy.confirmLabel}
            onConfirm={executeBulkAction}
            onCancel={() => setBulkConfirm({ isOpen: false, action: null })}
          />
        );
      })()}

      {openMenuProfile && menuPosition && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{ top: menuPosition.top, left: menuPosition.left, width: ACTION_MENU_WIDTH }}
          className="fixed z-200 rounded-xl border border-pits-edge bg-pits-surface-elevated shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-150"
        >
          {openMenuProfile.role === 'member' && openMenuProfile.invite_pending && (
            <button
              onClick={() => {
                closeMenu();
                setInviteConfirm({ isOpen: true, profile: openMenuProfile });
              }}
              disabled={resendingInviteId === openMenuProfile.id}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-bold text-pits-text hover:bg-pits-surface-muted transition-colors disabled:opacity-50"
            >
              {resendingInviteId === openMenuProfile.id ? (
                <Loader2 size={14} className="animate-spin shrink-0" />
              ) : (
                <Mail size={14} className="shrink-0 text-pits-dim" />
              )}
              {t('Resend welcome invite')}
            </button>
          )}
          {openMenuProfile.role === 'member' && !openMenuProfile.invite_pending && openMenuProfile.email && (
            <button
              onClick={() => {
                closeMenu();
                setResetConfirm({ isOpen: true, profile: openMenuProfile });
              }}
              disabled={sendingResetId === openMenuProfile.id}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-bold text-pits-text hover:bg-pits-surface-muted transition-colors disabled:opacity-50"
            >
              {sendingResetId === openMenuProfile.id ? (
                <Loader2 size={14} className="animate-spin shrink-0" />
              ) : (
                <KeyRound size={14} className="shrink-0 text-pits-dim" />
              )}
              {t('Send password reset')}
            </button>
          )}
          {openMenuProfile.role === 'member' && (
            <button
              onClick={() => {
                closeMenu();
                setReminderConfirm({ isOpen: true, profile: openMenuProfile });
              }}
              disabled={sendingReminderId === openMenuProfile.id || !openMenuProfile.phone?.trim()}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-bold text-pits-text hover:bg-pits-surface-muted transition-colors disabled:opacity-50"
            >
              {sendingReminderId === openMenuProfile.id ? (
                <Loader2 size={14} className="animate-spin shrink-0" />
              ) : (
                <Clock size={14} className="shrink-0 text-pits-dim" />
              )}
              {t('Send expiry reminder')}
            </button>
          )}
          <button
            onClick={() => {
              closeMenu();
              setSelectedUserId(openMenuProfile.id);
              setIsEditModalOpen(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-bold text-pits-text hover:bg-pits-surface-muted transition-colors"
          >
            <Edit2 size={14} className="shrink-0 text-pits-dim" />
            {t('Edit athlete')}
          </button>
          {isAdmin && openMenuProfile.id !== currentUserId && (
            <button
              onClick={() => {
                closeMenu();
                setDeleteConfirm({ isOpen: true, profile: openMenuProfile });
              }}
              disabled={deletingId === openMenuProfile.id}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-bold text-pits-error hover:bg-pits-primary-soft transition-colors disabled:opacity-50"
            >
              {deletingId === openMenuProfile.id ? (
                <Loader2 size={14} className="animate-spin shrink-0" />
              ) : (
                <Trash2 size={14} className="shrink-0" />
              )}
              {t('Delete athlete')}
            </button>
          )}
        </div>,
        document.body
      )}

    </div>
  );
}