'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
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
import { athleteService } from '@/lib/services/athleteService';
import { membershipPlanService } from '@/lib/services/membershipPlanService';
import { MembershipPlan, Profile } from '@/lib/types/gym';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/components/Toast';
import { useLanguage } from '@/components/LanguageContext';
import { getRenewDateInputValue, renewDateToIso } from '@/lib/renew-date';
import { supabase } from '@/lib/supabase';
import EditAthleteModal from '@/components/EditAthleteModal';
import ConfirmDialog from '@/components/ConfirmDialog';

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
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<string>('');
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);

  const isAdmin = callerRole === 'admin';
  const athleteId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';

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
  }, [athleteId]);

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
    } catch {
      setProfile({ ...profile, plan_period_start: previous });
      toast(t('Failed to update renew date'), 'error');
    } finally {
      setSavingRenewDate(false);
    }
  };

  const executeSolvencyToggle = async () => {
    if (!profile) return;
    setConfirmKind(null);
    const next = !profile.is_solvent;
    setProfile({ ...profile, is_solvent: next });
    try {
      await athleteService.updateSolvency(profile.id, next);
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

  const actionBtn =
    'inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pits-primary/50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-12">
      {/* NAV */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push('/dashboard/athletes')}
          className="group inline-flex items-center text-pits-dim hover:text-pits-text transition-colors font-bold uppercase text-xs tracking-widest min-h-11"
        >
          <ArrowLeft
            size={16}
            className="mr-2 group-hover:-translate-x-1 transition-transform duration-200"
          />
          {t('Back to Roster')}
        </button>
        <span className="text-[10px] text-pits-dim font-mono truncate max-w-[200px]">
          ID: {profile.id.slice(0, 8)}…
        </span>
      </div>

      {/* HERO */}
      <section className="bg-pits-surface-elevated rounded-2xl border border-pits-edge shadow-sm overflow-hidden">
        <div className="h-28 bg-linear-to-br from-pits-card via-gray-800 to-pits-red/80" />
        <div className="px-5 sm:px-8 pb-6 -mt-14">
          <div className="flex flex-col lg:flex-row lg:items-end gap-5">
            <div className="relative shrink-0">
              <div className="w-28 h-28 rounded-2xl bg-pits-surface-elevated p-1 shadow-lg border border-pits-edge">
                <div className="relative w-full h-full rounded-xl bg-pits-surface-muted flex items-center justify-center text-pits-dim overflow-hidden">
                  {profile.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt={profile.full_name || t('Unnamed')}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <User size={40} aria-hidden />
                  )}
                </div>
              </div>
              <div
                className={`absolute -bottom-2 -right-2 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-md border ${
                  profile.is_solvent
                    ? 'bg-pits-success text-white border-pits-success'
                    : 'bg-pits-primary text-pits-dark-text border-pits-primary'
                }`}
              >
                {profile.is_solvent ? t('Solvent / Paid') : t('Debt / Unpaid')}
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl sm:text-4xl font-black text-pits-text uppercase italic tracking-tighter truncate">
                  {profile.full_name || t('Unnamed')}
                </h1>
                <span className="px-2.5 py-1 bg-pits-surface-muted text-pits-dim rounded-lg text-[10px] font-black uppercase tracking-widest">
                  {profile.role}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-pits-dim">
                {profile.email && (
                  <a
                    href={`mailto:${profile.email}`}
                    className="inline-flex items-center hover:text-pits-red transition-colors min-h-10"
                  >
                    <Mail size={15} className="mr-1.5 text-pits-red shrink-0" aria-hidden />
                    <span className="truncate max-w-[220px]">{profile.email}</span>
                  </a>
                )}
                {profile.phone && (
                  <a
                    href={`tel:${profile.phone}`}
                    className="inline-flex items-center hover:text-pits-red transition-colors min-h-10"
                  >
                    <Phone size={15} className="mr-1.5 text-pits-red shrink-0" aria-hidden />
                    {profile.phone}
                  </a>
                )}
                <span className="inline-flex items-center italic">
                  <History size={15} className="mr-1.5 text-pits-red shrink-0" aria-hidden />
                  {t('Since')} {format(new Date(profile.created_at), 'MMMM yyyy')}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {profile.qr_code && (
                <div
                  className="p-3 min-h-11 min-w-11 bg-pits-surface-muted text-pits-dim rounded-xl border border-pits-edge"
                  title={`QR: ${profile.qr_code}`}
                >
                  <QrCode size={20} aria-hidden />
                  <span className="sr-only">QR code</span>
                </div>
              )}
              {profile.instagram && (
                <a
                  href={`https://instagram.com/${profile.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="p-3 min-h-11 min-w-11 bg-pink-50 text-pink-600 rounded-xl hover:bg-pink-600 hover:text-white transition-all duration-200 border border-pink-100"
                >
                  <Instagram size={20} />
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ACTIONS */}
      <section
        aria-label={t('Actions')}
        className="bg-pits-surface-elevated rounded-2xl border border-pits-edge p-4 sm:p-5 shadow-sm"
      >
        <h2 className="text-[10px] font-black text-pits-dim uppercase tracking-[0.2em] mb-3">
          {t('Quick actions')}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className={`${actionBtn} bg-pits-text text-white hover:bg-black`}
          >
            <Edit2 size={14} aria-hidden />
            {t('Edit athlete')}
          </button>

          <button
            type="button"
            onClick={() => setConfirmKind('solvency')}
            className={`${actionBtn} border-2 ${
              profile.is_solvent
                ? 'border-pits-success text-pits-success hover:bg-pits-success hover:text-white'
                : 'border-pits-primary bg-pits-primary text-pits-dark-text hover:bg-pits-primary-dark'
            }`}
          >
            {profile.is_solvent ? t('Revoke Access') : t('Restore Access')}
          </button>

          {phoneDigits && (
            <a
              href={`https://wa.me/${phoneDigits}`}
              target="_blank"
              rel="noreferrer"
              className={`${actionBtn} bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white`}
            >
              <MessageCircle size={14} aria-hidden />
              {t('Open WhatsApp')}
              <ExternalLink size={12} className="opacity-60" aria-hidden />
            </a>
          )}

          {profile.email && (
            <a
              href={`mailto:${profile.email}`}
              className={`${actionBtn} bg-pits-surface-muted text-pits-text border border-pits-edge hover:border-pits-red hover:text-pits-red`}
            >
              <Mail size={14} aria-hidden />
              {t('Send email')}
            </a>
          )}

          {profile.role === 'member' && profile.invite_pending && (
            <button
              type="button"
              disabled={actionLoading === 'invite'}
              onClick={() => setConfirmKind('invite')}
              className={`${actionBtn} bg-pits-surface-muted text-pits-text border border-pits-edge hover:bg-pits-primary-soft`}
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
              className={`${actionBtn} bg-pits-surface-muted text-pits-text border border-pits-edge hover:bg-pits-primary-soft`}
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
              className={`${actionBtn} bg-pits-surface-muted text-pits-text border border-pits-edge hover:bg-pits-primary-soft`}
            >
              {actionLoading === 'reminder' ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Clock size={14} aria-hidden />
              )}
              {t('Send expiry reminder')}
            </button>
          )}

          {isAdmin && profile.id !== currentUserId && (
            <button
              type="button"
              disabled={actionLoading === 'delete'}
              onClick={() => setConfirmKind('delete')}
              className={`${actionBtn} bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white`}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* MEMBERSHIP */}
        <div className="md:col-span-1 space-y-6">
          <section className="bg-pits-surface-elevated p-5 sm:p-6 rounded-2xl border border-pits-edge shadow-sm space-y-5">
            <h3 className="text-xs font-black text-pits-dim uppercase tracking-[0.2em] border-b border-pits-edge pb-3 flex items-center">
              <Shield size={14} className="mr-2 text-pits-red" aria-hidden />{' '}
              {t('Membership')}
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="athlete-plan"
                  className="block text-[10px] text-pits-dim font-bold uppercase tracking-wider mb-2"
                >
                  {t('Plan')}
                </label>
                <div className="flex items-center gap-2">
                  <Award size={18} className="text-pits-red shrink-0" aria-hidden />
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
                    className="w-full min-h-11 bg-pits-surface-muted border border-pits-edge rounded-xl px-3 text-sm font-black uppercase text-pits-text focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-50"
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

              <div className="flex justify-between items-center gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                    <CreditCard size={18} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-pits-dim font-bold uppercase tracking-wider">
                      {t('Inscription')} ({profile.inscription_plan || 'Standard'})
                    </p>
                    <p className="text-sm font-black text-pits-text uppercase truncate">
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

              <div className="flex items-center justify-between p-3.5 bg-pits-surface-muted rounded-xl">
                <div>
                  <p className="text-[10px] text-pits-dim font-bold uppercase tracking-wider">
                    {t('Last Payment')}
                  </p>
                  <p className="text-xs font-bold text-pits-text">
                    {profile.last_payment_date
                      ? format(new Date(profile.last_payment_date), 'dd MMM yyyy')
                      : t('No payments')}
                  </p>
                </div>
                {profile.last_payment_date && (
                  <span className="text-[10px] text-pits-dim font-medium capitalize">
                    {formatDistanceToNow(new Date(profile.last_payment_date), {
                      addSuffix: true,
                    })}
                  </span>
                )}
              </div>

              {profile.role === 'member' && (
                <div className="p-3.5 bg-pits-surface-muted rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="renew-date"
                      className="text-[10px] text-pits-dim font-bold uppercase tracking-wider"
                    >
                      {t('Renew date')}
                    </label>
                    {savingRenewDate && (
                      <Loader2
                        size={14}
                        className="animate-spin text-pits-red"
                        aria-hidden
                      />
                    )}
                  </div>
                  <input
                    id="renew-date"
                    type="date"
                    value={getRenewDateInputValue(profile)}
                    onChange={(e) => void handleRenewDateChange(e.target.value)}
                    disabled={savingRenewDate}
                    className="w-full min-h-11 bg-pits-surface-elevated border border-pits-edge rounded-xl px-3 text-sm font-bold text-pits-text focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-50"
                  />
                </div>
              )}

              {profile.admin_note && (
                <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl">
                  <p className="text-[10px] text-amber-700 font-black uppercase tracking-wider mb-1">
                    {t('Coach Notes')}
                  </p>
                  <p className="text-xs text-amber-900 leading-relaxed font-medium">
                    &quot;{profile.admin_note}&quot;
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="bg-pits-card text-white p-5 sm:p-6 rounded-2xl shadow-sm space-y-5">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] border-b border-white/10 pb-3 flex items-center">
              <AlertSquare size={14} className="mr-2 text-pits-red" aria-hidden />{' '}
              {t('In Case of Emergency')}
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  {t('Contact Person')}
                </p>
                <p className="text-sm font-black text-white uppercase italic">
                  {profile.emergency_contact_name || t('Not Specified')}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  {t('Contact Phone')}
                </p>
                <p className="text-sm font-black text-white italic">
                  {profile.emergency_contact_phone || t('None')}
                </p>
              </div>
            </div>
          </section>

          <section className="bg-pits-surface-elevated p-5 sm:p-6 rounded-2xl border border-pits-edge shadow-sm space-y-5">
            <h3 className="text-xs font-black text-pits-dim uppercase tracking-[0.2em] border-b border-pits-edge pb-3 flex items-center">
              <FileCheck size={14} className="mr-2" aria-hidden />{' '}
              {t('Legal & Onboarding')}
            </h3>
            <div className="space-y-3 font-mono">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-pits-dim uppercase">{t('Affid. Version')}</span>
                <span className="font-bold">v{profile.onboarding_affidavit_version || 1}</span>
              </div>
              {(
                [
                  ['Truthfulness', profile.onboarding_affidavit_truth],
                  ['Physical Fit', profile.onboarding_affidavit_fit],
                  ['Rights Release', profile.onboarding_affidavit_release],
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
              <div className="pt-3 border-t border-pits-edge">
                <p className="text-[10px] text-pits-dim font-bold uppercase tracking-wider">
                  {t('Accepted At')}
                </p>
                <p className="text-xs font-medium text-pits-text italic">
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

        {/* PHYSICAL + HEALTH */}
        <div className="md:col-span-1 space-y-6">
          <section className="bg-pits-surface-elevated p-5 sm:p-6 rounded-2xl border border-pits-edge shadow-sm space-y-5">
            <h3 className="text-xs font-black text-pits-dim uppercase tracking-[0.2em] border-b border-pits-edge pb-3 flex items-center">
              <Ruler size={14} className="mr-2 text-pits-red" aria-hidden />{' '}
              {t('Physical Profile')}
            </h3>
            <div className="grid grid-cols-2 gap-5">
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
                <div key={label} className="space-y-1">
                  <p className="text-[10px] text-pits-dim font-bold uppercase tracking-wider">
                    {label}
                  </p>
                  <p className="text-sm font-black text-pits-text uppercase">{value}</p>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-pits-edge">
              <p className="text-[10px] text-pits-dim font-bold uppercase tracking-wider">
                {t('Home Box')}
              </p>
              <p className="text-sm font-black text-pits-text uppercase italic">
                {profile.home_box || 'WODUS'}
              </p>
            </div>
          </section>

          <section className="bg-red-50/80 p-5 sm:p-6 rounded-2xl border border-red-100 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-red-500 uppercase tracking-[0.2em] border-b border-red-100 pb-3 flex items-center">
              <Activity size={14} className="mr-2" aria-hidden /> {t('Health & Safety')}
            </h3>
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
              <div key={label} className="p-3 bg-pits-surface-elevated rounded-xl">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[10px] text-pits-dim font-bold uppercase tracking-wider">
                    {label}
                  </p>
                  {flagged ? (
                    <XCircle size={14} className="text-red-500" aria-hidden />
                  ) : (
                    <CheckCircle2 size={14} className="text-pits-success" aria-hidden />
                  )}
                </div>
                <p className="text-xs font-bold text-pits-text">{text}</p>
              </div>
            ))}
          </section>
        </div>

        {/* STATS + ACTIVITY */}
        <div className="md:col-span-1 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-pits-card text-white p-5 rounded-2xl shadow-sm">
              <TrendingUp className="text-pits-red mb-3" size={22} aria-hidden />
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                {t('Attendance')}
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black italic">{attended}</p>
                <span className="text-gray-500 text-xs font-bold">{t('Visits')}</span>
              </div>
            </div>
            <div className="bg-pits-surface-elevated p-5 rounded-2xl shadow-sm border border-pits-edge">
              <Clock className="text-pits-red mb-3" size={22} aria-hidden />
              <p className="text-[10px] text-pits-dim font-bold uppercase tracking-widest">
                {t('No Shows')}
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black italic text-pits-text">{noShows}</p>
                <span className="text-pits-dim text-xs font-bold">{t('Missed')}</span>
              </div>
            </div>
          </div>

          <section className="bg-pits-surface-elevated rounded-2xl border border-pits-edge shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-pits-surface-muted border-b border-pits-edge flex items-center">
              <h3 className="text-xs font-black text-pits-text uppercase tracking-widest flex items-center">
                <Calendar size={14} className="mr-2 text-pits-red" aria-hidden />
                {t('Recent History')}
              </h3>
            </div>
            <div className="divide-y divide-pits-edge max-h-[500px] overflow-y-auto">
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
                      className="px-5 py-3.5 flex items-center justify-between hover:bg-pits-surface-muted/60 transition-colors duration-150"
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
                          <p className="text-sm font-bold text-pits-text capitalize leading-none mb-1 truncate">
                            {booking.classes?.class_type || 'WOD'}
                          </p>
                          <p className="text-[10px] text-pits-dim font-medium">
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
                        className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${
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
                <div className="px-5 py-12 text-center">
                  <p className="text-pits-dim text-sm italic font-medium">
                    {t('No activity recorded yet.')}
                  </p>
                </div>
              )}
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
