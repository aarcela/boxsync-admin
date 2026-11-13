'use client';

import { useTenant } from '@/components/TenantContext';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MessageCircle,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  XCircle,
  CreditCard,
  User,
  Clock,
  Shield,
  Award,
  History,
  Instagram,
  AlertTriangle as AlertSquare,
  FileCheck,
  Ruler,
  Activity,
  Loader2,
  Edit2,
  KeyRound,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import { athleteService, PlanSessionUsage } from '@/lib/services/athleteService';
import { membershipPlanService } from '@/lib/services/membershipPlanService';
import { MembershipPlan, PaymentRecord, Profile } from '@/lib/types/gym';
import { financialService } from '@/lib/services/financialService';
import PaymentReviewPanel from '@/components/PaymentReviewPanel';
import { currencySymbol } from '@/lib/currency';
import type { TranslationKey } from '@/lib/translations';
import { useToast } from '@/components/Toast';
import { formatDate, formatDateTime, formatMonthYear, formatWeekdayShort } from '@/lib/utils/format-date';
import { useLanguage } from '@/components/LanguageContext';
import { getRenewDateInputValue, renewDateToIso } from '@/lib/renew-date';
import { supabase } from '@/lib/supabase';
import EditAthleteModal from '@/components/EditAthleteModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import ProfileAvatar from '@/components/ProfileAvatar';
import { PageLoader } from '@/components/LoadingStates';

type MemberPayStatus = {
  status: 'ok' | 'in_grace' | 'overdue' | 'pending_review' | 'no_plan';
  reason: string;
  days_overdue: number;
  expires_at: string | null;
  has_pending_proof: boolean;
};

type ConfirmKind =
  | 'markPaid'
  | 'solvency'
  | 'plan'
  | 'invite'
  | 'reset'
  | 'reminder'
  | 'delete'
  | null;

export default function AthleteDetailPage() {
  const { timezone, tenantId, currencies } = useTenant();
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { t, lang } = useLanguage();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [planDisplayName, setPlanDisplayName] = useState<string>('None');
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRenewDate, setSavingRenewDate] = useState(false);
  const [planUsage, setPlanUsage] = useState<PlanSessionUsage | null>(null);
  const [sessionsUsedInput, setSessionsUsedInput] = useState('');
  const [savingPlanUsage, setSavingPlanUsage] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<string>('');
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [payStatus, setPayStatus] = useState<MemberPayStatus | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [statusVersion, setStatusVersion] = useState(0);
  const bumpStatus = () => setStatusVersion((v) => v + 1);


  const isAdmin = callerRole === 'admin';
  const athleteId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';

  // Same status the rest of the app uses (grace, overdue, proof in review, no plan).
  useEffect(() => {
    if (!athleteId || !tenantId) return;
    let cancelled = false;
    Promise.all([
      supabase.rpc('member_payment_status', { p_tenant: tenantId, p_member: athleteId }),
      financialService.getMemberPayments(athleteId),
    ])
      .then(([statusRes, list]) => {
        if (cancelled) return;
        setPayStatus(statusRes.error ? null : (statusRes.data as MemberPayStatus));
        setPayments(list);
      })
      .catch(() => {
        if (!cancelled) setPayments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [athleteId, tenantId, statusVersion]);

  const refreshPlanUsage = useCallback(async () => {
    if (!athleteId) return;
    try {
      const usage = await athleteService.getPlanSessionUsage(athleteId);
      setPlanUsage(usage);
      setSessionsUsedInput(usage ? String(usage.used) : '');
    } catch {
      setPlanUsage(null);
      setSessionsUsedInput('');
    }
  }, [athleteId]);

  const refreshAthlete = useCallback(async () => {
    if (!athleteId) return;
    const data = await athleteService.getProfileById(athleteId);
    let email = data.email;
    let invitePending = data.invite_pending;

    try {
      const userRes = await fetch(`/api/admin/users/${athleteId}`);
      if (userRes.ok) {
        const userData = await userRes.json();
        email = userData.email || email;
        invitePending = userData.invite_pending ?? invitePending;
      }
    } catch {
      // Profile data alone is enough to render; enrichment is best-effort.
    }

    setProfile({
      ...data,
      email,
      invite_pending: invitePending,
    });
    const profileWithTenant = data as Profile & { tenant_id?: string };
    const name = await membershipPlanService.resolvePlanDisplayName(
      profileWithTenant.plan,
      profileWithTenant.tenant_id
    );
    setPlanDisplayName(name ?? 'None');
    await refreshPlanUsage();
  }, [athleteId, refreshPlanUsage]);

  useEffect(() => {
    async function load() {
      if (!athleteId) return;
      try {
        await refreshAthlete();

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
          const { data: staffProfile } = await supabase
            .from('profiles')
            .select('role, tenant_id')
            .eq('id', user.id)
            .single();
          setCallerRole(staffProfile?.role ?? null);
          if (staffProfile?.tenant_id) {
            const plans = await membershipPlanService.getActiveMembershipPlans(
              staffProfile.tenant_id
            );
            setMembershipPlans(plans);
          }
        }
      } catch (error) {
        console.error('Error fetching athlete:', error);
        toast(t('Failed to load athlete details'), 'error');
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [athleteId, refreshAthlete, t, toast]);

  const planLabel = (planId: string) =>
    membershipPlans.find((p) => p.id === planId)?.name ??
    planDisplayName ??
    planId.replace(/_/g, ' ');

  const handleRenewDateChange = async (value: string) => {
    if (!profile) return;
    const previous = profile.plan_period_start ?? null;
    const nextIso = value ? renewDateToIso(value, timezone) : null;

    setProfile({ ...profile, plan_period_start: nextIso });
    setSavingRenewDate(true);
    try {
      await athleteService.updatePlanPeriodStart(profile.id, value || null, timezone);
      toast(t('Renew date updated'), 'success');
      await refreshPlanUsage();
    } catch {
      setProfile({ ...profile, plan_period_start: previous });
      toast(t('Failed to update renew date'), 'error');
    } finally {
      setSavingRenewDate(false);
    }
  };

  const handleSavePlanUsage = async () => {
    if (!profile || !planUsage) return;
    const parsed = Number(sessionsUsedInput);
    if (!Number.isFinite(parsed)) {
      toast(t('Failed to update plan usage'), 'error');
      return;
    }
    setSavingPlanUsage(true);
    try {
      const updated = await athleteService.updatePlanSessionsUsed(profile.id, parsed);
      setPlanUsage(updated);
      setSessionsUsedInput(String(updated.used));
      toast(t('Plan usage updated'), 'success');
    } catch {
      toast(t('Failed to update plan usage'), 'error');
      await refreshPlanUsage();
    } finally {
      setSavingPlanUsage(false);
    }
  };

  const executeSolvencyToggle = async () => {
    if (!profile) return;
    setConfirmKind(null);
    const next = !profile.is_solvent;
    setProfile({ ...profile, is_solvent: next });
    try {
      const updated = await athleteService.updateSolvency(profile.id, next);
      setProfile((current) =>
        current
          ? {
              ...current,
              is_solvent: updated.is_solvent,
              plan_period_start: updated.plan_period_start ?? current.plan_period_start,
            }
          : current
      );
      await refreshPlanUsage();
      toast(
        next ? t('Athlete access restored') : t('Athlete access revoked'),
        next ? 'success' : 'warning'
      );
    } catch {
      setProfile({ ...profile, is_solvent: !next });
      toast(t('Failed to update status'), 'error');
    }
  };

  const executePlanChange = async () => {
    if (!profile || !pendingPlanId || pendingPlanId === profile.plan) {
      setConfirmKind(null);
      return;
    }
    setConfirmKind(null);
    const previous = profile.plan;
    setProfile({ ...profile, plan: pendingPlanId });
    try {
      await athleteService.updatePlan(profile.id, pendingPlanId);
      const name = await membershipPlanService.resolvePlanDisplayName(
        pendingPlanId,
        (profile as Profile & { tenant_id?: string }).tenant_id
      );
      setPlanDisplayName(name ?? planLabel(pendingPlanId));
      await refreshPlanUsage();
      toast(t('Plan updated'), 'success');
    } catch {
      setProfile({ ...profile, plan: previous });
      toast(t('Failed to update plan'), 'error');
    }
  };

  const executeResendInvite = async () => {
    if (!profile) return;
    setConfirmKind(null);
    setActionLoading('invite');
    try {
      const response = await fetch(`/api/admin/users/${profile.id}/resend-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error === 'Member has already completed registration.'
            ? t('Member has already completed registration.')
            : data.error || t('Failed to resend welcome invite')
        );
      }
      if (data.emailWarning) toast(data.emailWarning, 'warning');
      if (data.whatsappWarning) toast(data.whatsappWarning, 'warning');
      if (data.inviteSent) {
        toast(
          t('Welcome invite resent to {{name}}', {
            name: profile.full_name || t('Unnamed'),
          }),
          'success'
        );
      }
    } catch (error) {
      toast(
        error instanceof Error ? error.message : t('Failed to resend welcome invite'),
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const executePasswordReset = async () => {
    if (!profile) return;
    setConfirmKind(null);
    setActionLoading('reset');
    try {
      const response = await fetch(`/api/admin/users/${profile.id}/send-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error === 'User has no email address.'
            ? t('User has no email address.')
            : data.error ===
                'Member has not completed registration. Use resend welcome invite instead.'
              ? t('Member has not completed registration. Use resend welcome invite instead.')
              : data.error || t('Failed to send password reset')
        );
      }
      toast(
        t('Password reset sent to {{name}}', {
          name: profile.full_name || t('Unnamed'),
        }),
        'success'
      );
    } catch (error) {
      toast(
        error instanceof Error ? error.message : t('Failed to send password reset'),
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const executeExpiryReminder = async () => {
    if (!profile) return;
    setConfirmKind(null);
    setActionLoading('reminder');
    try {
      const response = await fetch(
        `/api/admin/users/${profile.id}/send-expiry-reminder`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: lang }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error === 'Member has no phone number on file.'
            ? t('Member has no phone number on file.')
            : data.error || t('Failed to send expiry reminder')
        );
      }
      if (data.whatsappWarning) toast(data.whatsappWarning, 'warning');
      toast(
        t('Expiry reminder sent to {{name}}', {
          name: profile.full_name || t('Unnamed'),
        }),
        'success'
      );
    } catch (error) {
      toast(
        error instanceof Error ? error.message : t('Failed to send expiry reminder'),
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const executeDelete = async () => {
    if (!profile) return;
    setConfirmKind(null);
    setActionLoading('delete');
    try {
      const response = await fetch(`/api/admin/users/${profile.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t('Failed to delete athlete'));
      }
      toast(
        t('Athlete deleted successfully', {
          name: profile.full_name || t('Unnamed'),
        }),
        'success'
      );
      router.push('/dashboard/athletes');
    } catch (error) {
      toast(
        error instanceof Error ? error.message : t('Failed to delete athlete'),
        'error'
      );
      setActionLoading(null);
    }
  };

  /** Starts a new membership period (same as approving a payment). */
  const executeMarkPaid = async () => {
    if (!profile) return;
    setConfirmKind(null);
    setActionLoading('markPaid');
    try {
      const updated = await athleteService.updateSolvency(profile.id, true);
      setProfile((current) =>
        current
          ? { ...current, is_solvent: true, plan_period_start: updated.plan_period_start ?? current.plan_period_start }
          : current,
      );
      await refreshPlanUsage();
      bumpStatus();
      toast(t('Marked as paid. A new period started.'), 'success');
    } catch {
      toast(t('Failed to update status'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const approvePayment = async (payment: PaymentRecord) => {
    try {
      const { activated } = await financialService.approvePayment(payment.id, payment.user_id);
      toast(
        t(activated ? 'Payment approved successfully' : 'Partial payment recorded. Membership still unpaid.'),
        'success',
      );
      return true;
    } catch {
      toast(t('Error approving payment. Please try again.'), 'error');
      return false;
    }
  };

  const rejectPayment = async (payment: PaymentRecord, reason: string) => {
    try {
      await financialService.rejectPayment(payment.id, payment.user_id, reason || undefined);
      toast(t('Payment rejected'), 'warning');
      return true;
    } catch {
      toast(t('Error rejecting payment. Please try again.'), 'error');
      return false;
    }
  };

  const confirmHandlers: Record<Exclude<ConfirmKind, null>, () => void> = {
    markPaid: () => void executeMarkPaid(),
    solvency: () => void executeSolvencyToggle(),
    plan: () => void executePlanChange(),
    invite: () => void executeResendInvite(),
    reset: () => void executePasswordReset(),
    reminder: () => void executeExpiryReminder(),
    delete: () => void executeDelete(),
  };

  if (loading) {
    return (
      <PageLoader label={t('Loading athlete details...')} />
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-black text-pits-dim">{t('Athlete Not Found')}</h2>
        <button
          type="button"
          onClick={() => router.push('/dashboard/athletes')}
          className="mt-4 text-pits-red font-bold inline-flex items-center justify-center mx-auto hover:underline min-h-11 px-4"
        >
          <ArrowLeft size={18} className="mr-2" /> {t('Back to Roster')}
        </button>
      </div>
    );
  }

  const phoneDigits = profile.phone?.replace(/[^0-9]/g, '') || '';
  const attended = profile.bookings?.filter((b) => b.status === 'attended').length || 0;
  const noShows = profile.bookings?.filter((b) => b.status === 'no_show').length || 0;
  const renewDateValue = getRenewDateInputValue(profile, timezone);
  const isMember = profile.role === 'member';
  const pendingPayments = (payments ?? []).filter((p) => p.status === 'pending');
  const healthFlags = [
    profile.has_allergies ? `${t('Allergies')}: ${profile.allergies_text || t('Yes')}` : null,
    profile.has_medical_condition ? `${t('Medical Conditions')}: ${profile.medical_condition_text || t('Yes')}` : null,
    profile.has_injury ? `${t('Current Injuries')}: ${profile.injury_text || t('Yes')}` : null,
  ].filter(Boolean) as string[];

  // Status line, same rules as Home and Payments.
  const status = payStatus?.status ?? (profile.is_solvent ? 'ok' : 'overdue');
  const statusView = (() => {
    const days = payStatus?.days_overdue ?? 0;
    switch (status) {
      case 'ok':
        return {
          tone: 'positive',
          label: t('Up to date'),
          detail: isMember && renewDateValue ? t('Renews on {{date}}', { date: formatDate(renewDateValue, lang) }) : '',
        };
      case 'in_grace':
        return { tone: 'warning', label: t('In grace period'), detail: t('Days overdue', { days }) };
      case 'pending_review':
        return { tone: 'info', label: t('Proof in review'), detail: t('A payment is waiting for review.') };
      case 'no_plan':
        return { tone: 'danger', label: t('No plan'), detail: t('Assign a plan to let them book.') };
      default:
        return {
          tone: 'danger',
          label: payStatus?.reason === 'revoked' ? t('Access revoked') : t('Overdue'),
          detail: days > 0 ? t('Days overdue', { days }) : '',
        };
    }
  })();
  const TONE: Record<string, string> = {
    positive: 'bg-pits-positive-soft text-pits-positive border-pits-positive-edge',
    warning: 'bg-pits-warning-soft text-pits-warning border-pits-warning-edge',
    info: 'bg-pits-info-soft text-pits-info border-pits-info-edge',
    danger: 'bg-pits-danger-soft text-pits-danger border-pits-danger-edge',
  };
  const PAY_TONE: Record<string, string> = {
    approved: TONE.positive,
    pending: TONE.warning,
    rejected: TONE.danger,
  };

  const btnBase =
    'inline-flex items-center justify-center gap-2 min-h-10 px-3.5 rounded-lg text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pits-primary/40 disabled:opacity-50 disabled:cursor-not-allowed';
  const btnPrimary = `${btnBase} bg-pits-primary text-pits-dark-text hover:bg-pits-primary-dark`;
  const btnSecondary = `${btnBase} bg-pits-surface-elevated text-pits-text border border-pits-edge hover:bg-pits-surface-muted`;
  const menuItem =
    'w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-pits-text hover:bg-pits-surface-muted disabled:opacity-50';
  const sectionCard = 'bg-pits-surface-elevated rounded-xl border border-pits-edge p-5 space-y-4';
  const sectionTitle = 'text-base font-bold text-pits-text flex items-center gap-2';
  const fieldLabel = 'text-xs font-medium text-pits-dim';
  const fieldValue = 'text-sm font-semibold text-pits-text';
  const inputClass =
    'w-full min-h-11 bg-pits-surface-muted border border-pits-edge rounded-lg px-3 text-sm font-semibold text-pits-text focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-50';
  const notSet = t('Not Specified');

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-in fade-in duration-200 pb-12">
      <button
        type="button"
        onClick={() => router.push('/dashboard/athletes')}
        className="group inline-flex items-center text-sm font-semibold text-pits-dim hover:text-pits-text min-h-10"
      >
        <ArrowLeft size={16} className="mr-1.5 group-hover:-translate-x-0.5 transition-transform" />
        {t('Users')}
      </button>

      {/* Summary: who, status, what to do */}
      <section className="bg-pits-surface-elevated rounded-xl border border-pits-edge p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-pits-surface-muted border border-pits-edge overflow-hidden shrink-0 flex items-center justify-center text-pits-dim">
            <ProfileAvatar url={profile.avatar_url} name={profile.full_name} fallback={<User size={32} aria-hidden />} />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="page-title truncate">{profile.full_name || t('Unnamed')}</h1>
              {!isMember ? (
                <span className="px-2 py-0.5 rounded-md text-xs font-semibold border bg-pits-surface-muted text-pits-dim border-pits-edge">
                  {t(profile.role as TranslationKey)}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-pits-dim">
              {profile.phone ? (
                <a href={`tel:${profile.phone}`} className="inline-flex items-center gap-1.5 hover:text-pits-text">
                  <Phone size={14} aria-hidden /> {profile.phone}
                </a>
              ) : null}
              {profile.email ? (
                <a href={`mailto:${profile.email}`} className="inline-flex items-center gap-1.5 hover:text-pits-text">
                  <Mail size={14} aria-hidden /> <span className="truncate max-w-[240px]">{profile.email}</span>
                </a>
              ) : null}
              {profile.instagram ? (
                <a
                  href={`https://instagram.com/${profile.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-pits-text"
                >
                  <Instagram size={14} aria-hidden /> @{profile.instagram.replace('@', '')}
                </a>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <History size={14} aria-hidden /> {t('Since')} {formatMonthYear(profile.created_at, lang)}
              </span>
            </div>
          </div>
        </div>

        {isMember ? (
          <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2.5 ${TONE[statusView.tone]}`}>
            <span className="text-sm font-bold">{statusView.label}</span>
            {statusView.detail ? <span className="text-sm">{statusView.detail}</span> : null}
            <span className="text-sm opacity-80">· {planDisplayName === 'None' ? t('No plan') : planDisplayName}</span>
          </div>
        ) : null}

        {healthFlags.length > 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-pits-danger-edge bg-pits-danger-soft px-3 py-2.5 text-sm text-pits-danger">
            <Activity size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{healthFlags.join(' · ')}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {isMember && pendingPayments.length > 0 ? (
            <button type="button" onClick={() => setReviewId(pendingPayments[0].id)} className={btnPrimary}>
              <CreditCard size={16} aria-hidden /> {t('Review proof')}
            </button>
          ) : isMember && status !== 'ok' ? (
            <button
              type="button"
              onClick={() => setConfirmKind('markPaid')}
              disabled={actionLoading === 'markPaid' || !profile.plan}
              className={btnPrimary}
            >
              {actionLoading === 'markPaid' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} aria-hidden />}
              {t('Mark as paid')}
            </button>
          ) : null}
          {phoneDigits ? (
            <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" className={btnSecondary}>
              <MessageCircle size={16} aria-hidden /> WhatsApp
            </a>
          ) : null}
          {isMember ? (
            <button
              type="button"
              disabled={actionLoading === 'reminder' || !phoneDigits}
              onClick={() => setConfirmKind('reminder')}
              className={btnSecondary}
            >
              {actionLoading === 'reminder' ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} aria-hidden />}
              {t('Send reminder')}
            </button>
          ) : null}
          <button type="button" onClick={() => setIsEditOpen(true)} className={btnSecondary}>
            <Edit2 size={16} aria-hidden /> {t('Edit')}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              aria-label={t('More actions')}
              className={btnSecondary}
            >
              <MoreHorizontal size={16} aria-hidden />
            </button>
            {moreOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} aria-hidden />
                <div role="menu" className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-60 z-50 rounded-xl border border-pits-edge bg-pits-surface-elevated shadow-2xl py-1">
                  {profile.email ? (
                    <a role="menuitem" href={`mailto:${profile.email}`} className={menuItem} onClick={() => setMoreOpen(false)}>
                      <Mail size={16} className="text-pits-dim" /> {t('Send email')}
                    </a>
                  ) : null}
                  {isMember && profile.invite_pending ? (
                    <button role="menuitem" type="button" className={menuItem} onClick={() => { setMoreOpen(false); setConfirmKind('invite'); }}>
                      <Mail size={16} className="text-pits-dim" /> {t('Resend welcome invite')}
                    </button>
                  ) : null}
                  {isMember && !profile.invite_pending && profile.email ? (
                    <button role="menuitem" type="button" className={menuItem} onClick={() => { setMoreOpen(false); setConfirmKind('reset'); }}>
                      <KeyRound size={16} className="text-pits-dim" /> {t('Send password reset')}
                    </button>
                  ) : null}
                  {isMember && profile.is_solvent ? (
                    <button role="menuitem" type="button" className={menuItem} onClick={() => { setMoreOpen(false); setConfirmKind('solvency'); }}>
                      <Shield size={16} className="text-pits-dim" /> {t('Revoke Access')}
                    </button>
                  ) : null}
                  {isAdmin && profile.id !== currentUserId ? (
                    <>
                      <div className="my-1 border-t border-pits-edge" />
                      <button
                        role="menuitem"
                        type="button"
                        disabled={actionLoading === 'delete'}
                        className={`${menuItem} text-pits-danger hover:bg-pits-danger-soft`}
                        onClick={() => { setMoreOpen(false); setConfirmKind('delete'); }}
                      >
                        <Trash2 size={16} /> {t('Delete athlete')}
                      </button>
                    </>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-5">
          {isMember ? (
            <section className={sectionCard}>
              <h2 className={sectionTitle}>
                <Award size={16} className="text-pits-dim" aria-hidden /> {t('Membership')}
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="athlete-plan" className={fieldLabel}>{t('Plan')}</label>
                  <select
                    id="athlete-plan"
                    value={profile.plan || ''}
                    disabled={membershipPlans.length === 0}
                    onChange={(e) => {
                      const newPlanId = e.target.value;
                      if (!newPlanId || newPlanId === profile.plan) return;
                      setPendingPlanId(newPlanId);
                      setConfirmKind('plan');
                    }}
                    className={inputClass}
                  >
                    {!profile.plan ? <option value="">{t('No plan')}</option> : null}
                    {profile.plan && !membershipPlans.some((p) => p.id === profile.plan) ? (
                      <option value={profile.plan}>{planDisplayName}</option>
                    ) : null}
                    {membershipPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>{plan.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="renew-date" className={fieldLabel}>{t('Renew date')}</label>
                    {savingRenewDate ? <Loader2 size={14} className="animate-spin text-pits-dim" aria-hidden /> : null}
                  </div>
                  <input
                    id="renew-date"
                    type="date"
                    value={renewDateValue}
                    onChange={(e) => void handleRenewDateChange(e.target.value)}
                    disabled={savingRenewDate}
                    className={inputClass}
                  />
                </div>
              </div>

              {planUsage ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1.5 flex-1 min-w-[10rem]">
                    <label htmlFor="sessions-used" className={fieldLabel}>
                      {t('Sessions used')} · {t('Remaining sessions')}: {planUsage.remaining}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="sessions-used"
                        type="number"
                        min={0}
                        max={planUsage.limit}
                        step={1}
                        value={sessionsUsedInput}
                        onChange={(e) => setSessionsUsedInput(e.target.value)}
                        disabled={savingPlanUsage}
                        className={inputClass}
                      />
                      <span className="shrink-0 text-sm text-pits-dim whitespace-nowrap">
                        {t('of {{limit}}', { limit: planUsage.limit })}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSavePlanUsage()}
                    disabled={savingPlanUsage || sessionsUsedInput === String(planUsage.used)}
                    className={btnSecondary}
                  >
                    {savingPlanUsage ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
                    {t('Save changes')}
                  </button>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <span className="text-pits-dim">
                  {t('Inscription')}:{' '}
                  <span className="font-semibold text-pits-text">
                    {profile.inscription_cost
                      ? `${currencySymbol(currencies.reference)}${profile.inscription_cost}`
                      : t('Fee N/A')}
                    {' · '}
                    {profile.inscription_paid ? t('Paid') : t('Unpaid')}
                  </span>
                </span>
              </div>

              {profile.admin_note ? (
                <div className="p-3 bg-pits-warning-soft border border-pits-warning-edge rounded-lg">
                  <p className="text-xs font-semibold text-pits-warning mb-1">{t('Coach Notes')}</p>
                  <p className="text-sm text-pits-warning leading-relaxed">{profile.admin_note}</p>
                </div>
              ) : null}
            </section>
          ) : null}

          {isMember ? (
            <section className="bg-pits-surface-elevated rounded-xl border border-pits-edge overflow-hidden">
              <div className="px-5 py-3.5 border-b border-pits-edge">
                <h2 className={sectionTitle}>
                  <CreditCard size={16} className="text-pits-dim" aria-hidden /> {t('Payments')}
                </h2>
              </div>
              {payments === null ? (
                <p className="px-5 py-6 text-sm text-pits-dim animate-pulse">{t('Loading...')}</p>
              ) : payments.length === 0 ? (
                <p className="px-5 py-6 text-sm text-pits-dim">{t('No payments')}</p>
              ) : (
                <ul className="divide-y divide-pits-edge">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-pits-text tabular-nums">
                          {currencySymbol(p.currency || currencies.reference)}
                          {Number(p.amount).toLocaleString()}
                        </p>
                        <p className="text-xs text-pits-dim truncate">
                          {formatDate(p.created_at, lang)}
                          {p.method ? ` · ${p.method}` : ''}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${PAY_TONE[p.status] ?? TONE.info}`}>
                        {t(p.status === 'approved' ? 'Approved' : p.status === 'rejected' ? 'Rejected' : 'To review')}
                      </span>
                      {p.status === 'pending' ? (
                        <button type="button" onClick={() => setReviewId(p.id)} className="text-sm font-semibold text-pits-info hover:underline">
                          {t('Review')}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <section className="bg-pits-surface-elevated rounded-xl border border-pits-edge overflow-hidden">
            <div className="px-5 py-3.5 border-b border-pits-edge flex items-center justify-between gap-3">
              <h2 className={sectionTitle}>
                <Calendar size={16} className="text-pits-dim" aria-hidden /> {t('Attendance')}
              </h2>
              <span className="text-sm text-pits-dim">
                {attended} {t('Visits')} · {noShows} {t('Missed')}
              </span>
            </div>
            <div className="divide-y divide-pits-edge max-h-[420px] overflow-y-auto">
              {profile.bookings && profile.bookings.length > 0 ? (
                [...profile.bookings]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 20)
                  .map((booking) => (
                    <div key={booking.id || `${booking.created_at}-${booking.status}`} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-pits-text truncate">{booking.classes?.class_type || t('Class')}</p>
                        <p className="text-xs text-pits-dim">
                          {booking.classes?.start_time
                            ? `${formatWeekdayShort(booking.classes.start_time, lang)}, ${formatDateTime(booking.classes.start_time, lang)}`
                            : formatDate(booking.created_at, lang)}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-md border shrink-0 ${
                          booking.status === 'attended' ? TONE.positive : booking.status === 'no_show' ? TONE.danger : TONE.info
                        }`}
                      >
                        {t(booking.status as TranslationKey)}
                      </span>
                    </div>
                  ))
              ) : (
                <p className="px-5 py-10 text-center text-sm text-pits-dim">{t('No activity recorded yet.')}</p>
              )}
            </div>
          </section>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <section className={sectionCard}>
            <h2 className={sectionTitle}>
              <AlertSquare size={16} className="text-pits-dim" aria-hidden /> {t('In Case of Emergency')}
            </h2>
            <div className="space-y-1">
              <p className={fieldValue}>{profile.emergency_contact_name || notSet}</p>
              {profile.emergency_contact_phone ? (
                <a href={`tel:${profile.emergency_contact_phone}`} className="text-sm font-semibold text-pits-info hover:underline">
                  {profile.emergency_contact_phone}
                </a>
              ) : (
                <p className="text-sm text-pits-dim">{notSet}</p>
              )}
            </div>
          </section>

          <section className={sectionCard}>
            <h2 className={sectionTitle}>
              <Activity size={16} className="text-pits-dim" aria-hidden /> {t('Health & Safety')}
            </h2>
            <dl className="space-y-3">
              {(
                [
                  [t('Allergies'), profile.has_allergies, profile.allergies_text || t('No known allergies')],
                  [t('Medical Conditions'), profile.has_medical_condition, profile.medical_condition_text || t('No known conditions')],
                  [t('Current Injuries'), profile.has_injury, profile.injury_text || t('No injuries reported')],
                ] as const
              ).map(([label, flagged, text]) => (
                <div key={label}>
                  <dt className={`${fieldLabel} flex items-center gap-1.5`}>
                    {flagged ? <XCircle size={14} className="text-pits-danger" aria-hidden /> : <CheckCircle2 size={14} className="text-pits-positive" aria-hidden />}
                    {label}
                  </dt>
                  <dd className={`text-sm mt-0.5 ${flagged ? 'font-semibold text-pits-danger' : 'text-pits-text'}`}>{text}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={sectionCard}>
            <h2 className={sectionTitle}>
              <Ruler size={16} className="text-pits-dim" aria-hidden /> {t('Personal details')}
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {(
                [
                  [t('Sex'), profile.sex ? t(profile.sex as TranslationKey) : notSet],
                  [t('Birth Date'), profile.birth_date ? formatDate(profile.birth_date.slice(0, 10), lang) : notSet],
                  [t('Height'), profile.height_cm ? `${profile.height_cm} cm` : notSet],
                  [t('Weight'), profile.weight_kg ? `${profile.weight_kg} kg` : notSet],
                  [t('Level'), profile.level ? t(profile.level as TranslationKey) : notSet],
                  [t('Years training'), profile.crossfit_years ? String(profile.crossfit_years) : notSet],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className={fieldLabel}>{label}</dt>
                  <dd className={`${fieldValue} mt-0.5`}>{value}</dd>
                </div>
              ))}
            </dl>
            {profile.home_box ? (
              <div className="pt-3 border-t border-pits-edge">
                <p className={fieldLabel}>{t('Home Box')}</p>
                <p className={`${fieldValue} mt-0.5`}>{profile.home_box}</p>
              </div>
            ) : null}
          </section>

          <details className={`${sectionCard} group`}>
            <summary className={`${sectionTitle} cursor-pointer list-none`}>
              <FileCheck size={16} className="text-pits-dim" aria-hidden /> {t('Legal & Onboarding')}
              <span className="ml-auto text-xs font-medium text-pits-dim">
                {profile.onboarding_affidavit_accepted_at
                  ? formatDate(profile.onboarding_affidavit_accepted_at, lang)
                  : t('Pending acceptance')}
              </span>
            </summary>
            <div className="space-y-2.5 pt-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-pits-dim">{t('Affid. Version')}</span>
                <span className="font-semibold text-pits-text">v{profile.onboarding_affidavit_version || 1}</span>
              </div>
              {(
                [
                  ['Truthfulness', profile.onboarding_affidavit_truth],
                  ['Physical Fit', profile.onboarding_affidavit_fit],
                  ['Rights Release', profile.onboarding_affidavit_release],
                  ['Terms acceptance', profile.onboarding_affidavit_terms],
                ] as const
              ).map(([label, ok]) => (
                <div key={label} className="flex justify-between items-center text-sm">
                  <span className="text-pits-dim">{t(label)}</span>
                  {ok ? (
                    <CheckCircle2 size={16} className="text-pits-positive" aria-label={t('Yes')} />
                  ) : (
                    <XCircle size={16} className="text-pits-dim" aria-label={t('No')} />
                  )}
                </div>
              ))}
              {profile.onboarding_affidavit_accepted_at ? (
                <p className="text-xs text-pits-dim pt-1">
                  {t('Accepted At')}: {formatDateTime(profile.onboarding_affidavit_accepted_at, lang)}
                </p>
              ) : null}
            </div>
          </details>
        </div>
      </div>

      <EditAthleteModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => void refreshAthlete()}
        userId={profile.id}
      />

      <ConfirmDialog
        isOpen={confirmKind === 'markPaid'}
        title={t('Mark as paid')}
        message={t('Mark as paid confirm message', { name: profile.full_name || t('Unnamed') })}
        confirmLabel={t('Mark as paid')}
        onConfirm={confirmHandlers.markPaid}
        onCancel={() => setConfirmKind(null)}
      />

      {reviewId && pendingPayments.length > 0 ? (
        <PaymentReviewPanel
          payments={pendingPayments}
          initialId={reviewId}
          formatAmount={(p) => `${currencySymbol(p.currency || currencies.reference)}${Number(p.amount).toLocaleString()}`}
          onApprove={approvePayment}
          onReject={rejectPayment}
          onClose={() => {
            setReviewId(null);
            void refreshAthlete();
            bumpStatus();
          }}
        />
      ) : null}

      <ConfirmDialog
        isOpen={confirmKind === 'solvency'}
        title={profile.is_solvent ? t('Revoke Access') : t('Restore Access')}
        message={
          profile.is_solvent
            ? t('Lock out confirm message', {
                name: profile.full_name || t('Unnamed'),
              })
            : t('Restore access confirm message', {
                name: profile.full_name || t('Unnamed'),
              })
        }
        confirmLabel={profile.is_solvent ? t('Lock Out') : t('Restore')}
        variant={profile.is_solvent ? 'danger' : 'default'}
        onConfirm={confirmHandlers.solvency}
        onCancel={() => setConfirmKind(null)}
      />

      <ConfirmDialog
        isOpen={confirmKind === 'plan'}
        title={t('Change plan')}
        message={t('Change plan confirm message', {
          name: profile.full_name || t('Unnamed'),
          from: planLabel(profile.plan || ''),
          to: planLabel(pendingPlanId),
        })}
        confirmLabel={t('Change plan')}
        onConfirm={confirmHandlers.plan}
        onCancel={() => {
          setConfirmKind(null);
          setPendingPlanId('');
        }}
      />

      <ConfirmDialog
        isOpen={confirmKind === 'invite'}
        title={t('Resend welcome invite')}
        message={t('Resend welcome invite confirm message', {
          name: profile.full_name || t('Unnamed'),
        })}
        confirmLabel={t('Resend')}
        onConfirm={confirmHandlers.invite}
        onCancel={() => setConfirmKind(null)}
      />

      <ConfirmDialog
        isOpen={confirmKind === 'reset'}
        title={t('Send password reset')}
        message={t('Send password reset confirm message', {
          name: profile.full_name || t('Unnamed'),
        })}
        confirmLabel={t('Send reset link')}
        onConfirm={confirmHandlers.reset}
        onCancel={() => setConfirmKind(null)}
      />

      <ConfirmDialog
        isOpen={confirmKind === 'reminder'}
        title={t('Send expiry reminder')}
        message={t('Send expiry reminder confirm message', {
          name: profile.full_name || t('Unnamed'),
        })}
        confirmLabel={t('Send Reminder')}
        onConfirm={confirmHandlers.reminder}
        onCancel={() => setConfirmKind(null)}
      />

      <ConfirmDialog
        isOpen={confirmKind === 'delete'}
        title={t('Delete athlete')}
        message={t('Delete athlete confirm message', {
          name: profile.full_name || t('Unnamed'),
        })}
        confirmLabel={t('Delete')}
        variant="danger"
        onConfirm={confirmHandlers.delete}
        onCancel={() => setConfirmKind(null)}
      />
    </div>
  );
}
