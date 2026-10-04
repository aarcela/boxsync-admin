'use client';

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
  TrendingUp,
  Clock,
  Shield,
  Award,
  History,
  Instagram,
  QrCode,
  AlertTriangle as AlertSquare,
  FileCheck,
  Ruler,
  Activity,
  Loader2,
  Edit2,
  KeyRound,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { athleteService, PlanSessionUsage } from '@/lib/services/athleteService';
import { membershipPlanService } from '@/lib/services/membershipPlanService';
import { MembershipPlan, Profile } from '@/lib/types/gym';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/components/Toast';
import { useLanguage } from '@/components/LanguageContext';
import { getRenewDateInputValue, renewDateToIso } from '@/lib/renew-date';
import { supabase } from '@/lib/supabase';
import EditAthleteModal from '@/components/EditAthleteModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import ProfileAvatar from '@/components/ProfileAvatar';

type ConfirmKind =
  | 'solvency'
  | 'plan'
  | 'invite'
  | 'reset'
  | 'reminder'
  | 'delete'
  | null;

export default function AthleteDetailPage() {
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

  const isAdmin = callerRole === 'admin';
  const athleteId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';

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
    const nextIso = value ? renewDateToIso(value) : null;

    setProfile({ ...profile, plan_period_start: nextIso });
    setSavingRenewDate(true);
    try {
      await athleteService.updatePlanPeriodStart(profile.id, value || null);
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

  const confirmHandlers: Record<Exclude<ConfirmKind, null>, () => void> = {
    solvency: () => void executeSolvencyToggle(),
    plan: () => void executePlanChange(),
    invite: () => void executeResendInvite(),
    reset: () => void executePasswordReset(),
    reminder: () => void executeExpiryReminder(),
    delete: () => void executeDelete(),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={36} className="animate-spin text-pits-red" />
          <p className="text-pits-dim font-bold uppercase tracking-widest text-xs">
            {t('Loading athlete details...')}
          </p>
        </div>
      </div>
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
  const attended =
    profile.bookings?.filter((b) => b.status === 'attended').length || 0;
  const noShows =
    profile.bookings?.filter((b) => b.status === 'no_show').length || 0;
  const renewDateValue = getRenewDateInputValue(profile);
  const renewDateLabel = renewDateValue
    ? format(new Date(`${renewDateValue}T12:00:00`), 'dd MMM yyyy')
    : t('Not set');

  const btnBase =
    'inline-flex items-center justify-center gap-2 min-h-10 px-3.5 rounded-lg text-xs font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pits-primary/40 disabled:opacity-50 disabled:cursor-not-allowed';
  const btnPrimary = `${btnBase} bg-pits-text text-white hover:bg-black`;
  const btnSecondary = `${btnBase} bg-pits-surface-elevated text-pits-text border border-pits-edge hover:bg-pits-surface-muted`;
  const btnGhost = `${btnBase} text-pits-dim hover:text-pits-text hover:bg-pits-surface-muted`;

  const sectionCard =
    'bg-pits-surface-elevated rounded-xl border border-pits-edge p-5 space-y-4';
  const sectionTitle =
    'text-[11px] font-black text-pits-dim uppercase tracking-[0.16em] flex items-center gap-2';
  const fieldLabel =
    'text-[10px] text-pits-dim font-bold uppercase tracking-wider';
  const fieldValue = 'text-sm font-bold text-pits-text';

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-in fade-in duration-200 pb-12">
      <button
        type="button"
        onClick={() => router.push('/dashboard/athletes')}
        className="group inline-flex items-center text-pits-dim hover:text-pits-text transition-colors font-bold uppercase text-xs tracking-widest min-h-10"
      >
        <ArrowLeft
          size={16}
          className="mr-2 group-hover:-translate-x-0.5 transition-transform duration-150"
        />
        {t('Back to Roster')}
      </button>

      {/* Identity + primary actions */}
      <section className="bg-pits-surface-elevated rounded-xl border border-pits-edge p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-5">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-pits-surface-muted border border-pits-edge overflow-hidden shrink-0 flex items-center justify-center text-pits-dim">
            <ProfileAvatar
              url={profile.avatar_url}
              name={profile.full_name}
              fallback={<User size={36} aria-hidden />}
            />
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-pits-text tracking-tight truncate">
                  {profile.full_name || t('Unnamed')}
                </h1>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                    profile.is_solvent
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {profile.is_solvent ? t('Solvent / Paid') : t('Debt / Unpaid')}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-pits-surface-muted text-pits-dim border border-pits-edge">
                  {profile.role}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-pits-dim">
                {profile.email && (
                  <a
                    href={`mailto:${profile.email}`}
                    className="inline-flex items-center gap-1.5 hover:text-pits-text min-h-9"
                  >
                    <Mail size={14} className="shrink-0" aria-hidden />
                    <span className="truncate max-w-[240px]">{profile.email}</span>
                  </a>
                )}
                {profile.phone && (
                  <a
                    href={`tel:${profile.phone}`}
                    className="inline-flex items-center gap-1.5 hover:text-pits-text min-h-9"
                  >
                    <Phone size={14} className="shrink-0" aria-hidden />
                    {profile.phone}
                  </a>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <History size={14} className="shrink-0" aria-hidden />
                  {t('Since')} {format(new Date(profile.created_at), 'MMM yyyy')}
                </span>
                {profile.instagram && (
                  <a
                    href={`https://instagram.com/${profile.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-pits-text min-h-9"
                  >
                    <Instagram size={14} className="shrink-0" aria-hidden />
                    @{profile.instagram.replace('@', '')}
                  </a>
                )}
                {profile.qr_code && (
                  <span
                    className="inline-flex items-center gap-1.5 text-pits-dim"
                    title={profile.qr_code}
                  >
                    <QrCode size={14} aria-hidden />
                    QR
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className={btnPrimary}
              >
                <Edit2 size={14} aria-hidden />
                {t('Edit athlete')}
              </button>
              {phoneDigits && (
                <a
                  href={`https://wa.me/${phoneDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`${btnBase} bg-emerald-600 text-white hover:bg-emerald-700`}
                >
                  <MessageCircle size={14} aria-hidden />
                  {t('Open WhatsApp')}
                  <ExternalLink size={12} className="opacity-70" aria-hidden />
                </a>
              )}
              {profile.email && (
                <a href={`mailto:${profile.email}`} className={btnSecondary}>
                  <Mail size={14} aria-hidden />
                  {t('Send email')}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Glanceable facts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-pits-edge bg-pits-surface-elevated p-4">
          <p className={fieldLabel}>{t('Plan')}</p>
          <p className={`${fieldValue} mt-1 truncate`}>{planDisplayName}</p>
        </div>
        <div className="rounded-xl border border-pits-edge bg-pits-surface-elevated p-4">
          <p className={fieldLabel}>{t('Renew date')}</p>
          <p className={`${fieldValue} mt-1`}>{renewDateLabel}</p>
        </div>
        <div className="rounded-xl border border-pits-edge bg-pits-surface-elevated p-4">
          <p className={fieldLabel}>{t('Attendance')}</p>
          <p className={`${fieldValue} mt-1`}>
            {attended}{' '}
            <span className="text-pits-dim font-medium text-xs">{t('Visits')}</span>
          </p>
        </div>
        <div className="rounded-xl border border-pits-edge bg-pits-surface-elevated p-4">
          <p className={fieldLabel}>{t('No Shows')}</p>
          <p className={`${fieldValue} mt-1`}>
            {noShows}{' '}
            <span className="text-pits-dim font-medium text-xs">{t('Missed')}</span>
          </p>
        </div>
      </div>

      {/* Account actions — quiet, grouped */}
      <section
        aria-label={t('Actions')}
        className="rounded-xl border border-pits-edge bg-pits-surface-elevated p-4 sm:p-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
          <p className={`${sectionTitle} lg:min-w-[7rem]`}>{t('More actions')}</p>
          <div className="flex flex-wrap gap-2 flex-1">
            <button
              type="button"
              onClick={() => setConfirmKind('solvency')}
              className={`${btnSecondary} ${
                profile.is_solvent
                  ? 'text-amber-800 border-amber-200 hover:bg-amber-50'
                  : 'text-green-700 border-green-200 hover:bg-green-50'
              }`}
            >
              {profile.is_solvent ? t('Revoke Access') : t('Restore Access')}
            </button>

            {profile.role === 'member' && profile.invite_pending && (
              <button
                type="button"
                disabled={actionLoading === 'invite'}
                onClick={() => setConfirmKind('invite')}
                className={btnSecondary}
              >
                {actionLoading === 'invite' ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <Mail size={14} aria-hidden />
                )}
                {t('Resend welcome invite')}
              </button>
            )}

            {profile.role === 'member' && !profile.invite_pending && profile.email && (
              <button
                type="button"
                disabled={actionLoading === 'reset'}
                onClick={() => setConfirmKind('reset')}
                className={btnSecondary}
              >
                {actionLoading === 'reset' ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <KeyRound size={14} aria-hidden />
                )}
                {t('Send password reset')}
              </button>
            )}

            {profile.role === 'member' && (
              <button
                type="button"
                disabled={actionLoading === 'reminder' || !phoneDigits}
                onClick={() => setConfirmKind('reminder')}
                className={btnSecondary}
              >
                {actionLoading === 'reminder' ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                ) : (
                  <Clock size={14} aria-hidden />
                )}
                {t('Send expiry reminder')}
              </button>
            )}
          </div>

          {isAdmin && profile.id !== currentUserId && (
            <button
              type="button"
              disabled={actionLoading === 'delete'}
              onClick={() => setConfirmKind('delete')}
              className={`${btnGhost} text-red-600 hover:text-red-700 hover:bg-red-50 lg:ml-auto`}
            >
              {actionLoading === 'delete' ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Trash2 size={14} aria-hidden />
              )}
              {t('Delete athlete')}
            </button>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Ops column — membership first */}
        <div className="lg:col-span-3 space-y-5">
          <section className={sectionCard}>
            <h2 className={sectionTitle}>
              <Shield size={14} className="text-pits-red" aria-hidden />
              {t('Membership')}
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="athlete-plan" className={fieldLabel}>
                  {t('Plan')}
                </label>
                <div className="flex items-center gap-2">
                  <Award size={16} className="text-pits-red shrink-0" aria-hidden />
                  <select
                    id="athlete-plan"
                    value={profile.plan || ''}
                    disabled={membershipPlans.length === 0 || profile.role !== 'member'}
                    onChange={(e) => {
                      const newPlanId = e.target.value;
                      if (!newPlanId || newPlanId === profile.plan) return;
                      setPendingPlanId(newPlanId);
                      setConfirmKind('plan');
                    }}
                    className="w-full min-h-11 bg-pits-surface-muted border border-pits-edge rounded-lg px-3 text-sm font-bold text-pits-text focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-50"
                  >
                    {profile.plan &&
                      !membershipPlans.some((p) => p.id === profile.plan) && (
                        <option value={profile.plan}>{planDisplayName}</option>
                      )}
                    {membershipPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {profile.role === 'member' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="renew-date" className={fieldLabel}>
                      {t('Renew date')}
                    </label>
                    {savingRenewDate && (
                      <Loader2 size={14} className="animate-spin text-pits-red" aria-hidden />
                    )}
                  </div>
                  <input
                    id="renew-date"
                    type="date"
                    value={renewDateValue}
                    onChange={(e) => void handleRenewDateChange(e.target.value)}
                    disabled={savingRenewDate}
                    className="w-full min-h-11 bg-pits-surface-muted border border-pits-edge rounded-lg px-3 text-sm font-bold text-pits-text focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-50"
                  />
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-pits-surface-muted">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CreditCard size={16} className="text-pits-dim shrink-0" aria-hidden />
                  <div className="min-w-0">
                    <p className={fieldLabel}>
                      {t('Inscription')} ({profile.inscription_plan || 'Standard'})
                    </p>
                    <p className={`${fieldValue} truncate`}>
                      {profile.inscription_cost
                        ? `$${profile.inscription_cost}`
                        : t('Fee N/A')}
                    </p>
                  </div>
                </div>
                {profile.inscription_paid ? (
                  <CheckCircle2
                    size={18}
                    className="text-pits-success shrink-0"
                    aria-label={t('Paid')}
                  />
                ) : (
                  <XCircle
                    size={18}
                    className="text-pits-red shrink-0"
                    aria-label={t('Unpaid')}
                  />
                )}
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-pits-surface-muted">
                <div>
                  <p className={fieldLabel}>{t('Last Payment')}</p>
                  <p className={fieldValue}>
                    {profile.last_payment_date
                      ? format(new Date(profile.last_payment_date), 'dd MMM yyyy')
                      : t('No payments')}
                  </p>
                </div>
                {profile.last_payment_date && (
                  <span className="text-[10px] text-pits-dim capitalize shrink-0">
                    {formatDistanceToNow(new Date(profile.last_payment_date), {
                      addSuffix: true,
                    })}
                  </span>
                )}
              </div>
            </div>

            {profile.role === 'member' && planUsage && (
              <div className="p-3.5 rounded-lg border border-pits-edge space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="sessions-used" className={fieldLabel}>
                    {t('Sessions used')}
                  </label>
                  <span className="text-[10px] font-bold text-pits-dim uppercase tracking-wider">
                    {t('Remaining sessions')}: {planUsage.remaining}
                  </span>
                </div>
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
                    className="w-full min-h-11 bg-pits-surface-muted border border-pits-edge rounded-lg px-3 text-sm font-bold text-pits-text focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-50"
                  />
                  <span className="shrink-0 text-xs font-bold text-pits-dim whitespace-nowrap">
                    {t('of {{limit}}', { limit: planUsage.limit })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSavePlanUsage()}
                  disabled={
                    savingPlanUsage || sessionsUsedInput === String(planUsage.used)
                  }
                  className={`${btnPrimary} w-full`}
                >
                  {savingPlanUsage ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                  ) : null}
                  {t('Save changes')}
                </button>
              </div>
            )}

            {profile.admin_note && (
              <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-lg">
                <p className="text-[10px] text-amber-700 font-black uppercase tracking-wider mb-1">
                  {t('Coach Notes')}
                </p>
                <p className="text-sm text-amber-900 leading-relaxed">
                  {profile.admin_note}
                </p>
              </div>
            )}
          </section>

          <section className="bg-pits-surface-elevated rounded-xl border border-pits-edge overflow-hidden">
            <div className="px-5 py-3.5 border-b border-pits-edge flex items-center justify-between gap-3">
              <h2 className={sectionTitle}>
                <Calendar size={14} className="text-pits-red" aria-hidden />
                {t('Recent History')}
              </h2>
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-pits-dim">
                <span className="inline-flex items-center gap-1">
                  <TrendingUp size={12} aria-hidden />
                  {attended} {t('Visits')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} aria-hidden />
                  {noShows} {t('Missed')}
                </span>
              </div>
            </div>
            <div className="divide-y divide-pits-edge max-h-[420px] overflow-y-auto">
              {profile.bookings && profile.bookings.length > 0 ? (
                [...profile.bookings]
                  .sort(
                    (a, b) =>
                      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  )
                  .slice(0, 20)
                  .map((booking) => (
                    <div
                      key={booking.id || `${booking.created_at}-${booking.status}`}
                      className="px-5 py-3 flex items-center justify-between hover:bg-pits-surface-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            booking.status === 'attended'
                              ? 'bg-pits-success'
                              : booking.status === 'no_show'
                                ? 'bg-pits-red'
                                : 'bg-blue-500'
                          }`}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-pits-text capitalize truncate">
                            {booking.classes?.class_type || 'WOD'}
                          </p>
                          <p className="text-[11px] text-pits-dim">
                            {booking.classes?.start_time
                              ? format(
                                  new Date(booking.classes.start_time),
                                  'EEE, MMM dd • HH:mm'
                                )
                              : format(new Date(booking.created_at), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md shrink-0 ${
                          booking.status === 'attended'
                            ? 'bg-green-50 text-green-700'
                            : booking.status === 'no_show'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        {booking.status}
                      </span>
                    </div>
                  ))
              ) : (
                <div className="px-5 py-10 text-center">
                  <p className="text-pits-dim text-sm">{t('No activity recorded yet.')}</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Profile / safety column */}
        <div className="lg:col-span-2 space-y-5">
          <section className={sectionCard}>
            <h2 className={sectionTitle}>
              <Ruler size={14} className="text-pits-red" aria-hidden />
              {t('Physical Profile')}
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {(
                [
                  [t('Sex'), profile.sex || 'N/A'],
                  [
                    t('Birth Date'),
                    profile.birth_date
                      ? format(new Date(profile.birth_date), 'dd/MM/yyyy')
                      : 'N/A',
                  ],
                  [t('Height'), profile.height_cm ? `${profile.height_cm} cm` : 'N/A'],
                  [t('Weight'), profile.weight_kg ? `${profile.weight_kg} kg` : 'N/A'],
                  [t('CF Level'), profile.level || 'Beginner'],
                  [
                    t('Experience'),
                    profile.crossfit_years ? `${profile.crossfit_years} Yrs` : t('New'),
                  ],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className={fieldLabel}>{label}</dt>
                  <dd className={`${fieldValue} mt-0.5`}>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="pt-3 border-t border-pits-edge">
              <p className={fieldLabel}>{t('Home Box')}</p>
              <p className={`${fieldValue} mt-0.5`}>{profile.home_box || 'WODUS'}</p>
            </div>
          </section>

          <section className="rounded-xl border border-red-100 bg-red-50/60 p-5 space-y-3">
            <h2 className="text-[11px] font-black text-red-600 uppercase tracking-[0.16em] flex items-center gap-2">
              <Activity size={14} aria-hidden />
              {t('Health & Safety')}
            </h2>
            {(
              [
                [
                  t('Allergies'),
                  profile.has_allergies,
                  profile.allergies_text || t('No known allergies'),
                ],
                [
                  t('Medical Conditions'),
                  profile.has_medical_condition,
                  profile.medical_condition_text || t('No known conditions'),
                ],
                [
                  t('Current Injuries'),
                  profile.has_injury,
                  profile.injury_text || t('No injuries reported'),
                ],
              ] as const
            ).map(([label, flagged, text]) => (
              <div
                key={label}
                className="p-3 bg-pits-surface-elevated rounded-lg border border-red-100/80"
              >
                <div className="flex justify-between items-center mb-1">
                  <p className={fieldLabel}>{label}</p>
                  {flagged ? (
                    <XCircle size={14} className="text-red-500" aria-hidden />
                  ) : (
                    <CheckCircle2 size={14} className="text-pits-success" aria-hidden />
                  )}
                </div>
                <p className="text-sm font-medium text-pits-text">{text}</p>
              </div>
            ))}
          </section>

          <section className={sectionCard}>
            <h2 className={sectionTitle}>
              <AlertSquare size={14} className="text-pits-red" aria-hidden />
              {t('In Case of Emergency')}
            </h2>
            <div className="space-y-3">
              <div>
                <p className={fieldLabel}>{t('Contact Person')}</p>
                <p className={`${fieldValue} mt-0.5`}>
                  {profile.emergency_contact_name || t('Not Specified')}
                </p>
              </div>
              <div>
                <p className={fieldLabel}>{t('Contact Phone')}</p>
                <p className={`${fieldValue} mt-0.5`}>
                  {profile.emergency_contact_phone || t('None')}
                </p>
              </div>
            </div>
          </section>

          <section className={sectionCard}>
            <h2 className={sectionTitle}>
              <FileCheck size={14} aria-hidden />
              {t('Legal & Onboarding')}
            </h2>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-pits-dim font-bold uppercase">{t('Affid. Version')}</span>
                <span className="font-bold text-pits-text">
                  v{profile.onboarding_affidavit_version || 1}
                </span>
              </div>
              {(
                [
                  ['Truthfulness', profile.onboarding_affidavit_truth],
                  ['Physical Fit', profile.onboarding_affidavit_fit],
                  ['Rights Release', profile.onboarding_affidavit_release],
                  ['Terms acceptance', profile.onboarding_affidavit_terms],
                ] as const
              ).map(([label, ok]) => (
                <div key={label} className="flex justify-between items-center text-xs">
                  <span className="text-pits-dim font-bold uppercase">{t(label)}</span>
                  {ok ? (
                    <CheckCircle2 size={16} className="text-pits-success" aria-label="Yes" />
                  ) : (
                    <XCircle size={16} className="text-pits-edge" aria-label="No" />
                  )}
                </div>
              ))}
              <div className="pt-2.5 border-t border-pits-edge">
                <p className={fieldLabel}>{t('Accepted At')}</p>
                <p className="text-xs font-medium text-pits-text mt-0.5">
                  {profile.onboarding_affidavit_accepted_at
                    ? format(
                        new Date(profile.onboarding_affidavit_accepted_at),
                        'dd/MM/yyyy HH:mm'
                      )
                    : t('Pending acceptance')}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <EditAthleteModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => void refreshAthlete()}
        userId={profile.id}
      />

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
