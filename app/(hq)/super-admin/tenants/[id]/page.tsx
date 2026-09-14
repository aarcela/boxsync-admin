'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Ban, ExternalLink, Loader2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/components/LanguageContext';
import { useToast } from '@/components/Toast';
import {
  PLATFORM_PLAN_IDS,
  getPlatformPlan,
  type PlatformPlanId,
} from '@/lib/platform-plans';
import { buildTenantDashboardUrl } from '@/lib/tenant-host';
import type { TenantWithHqStats } from '@/lib/types/gym';

type TenantAdmin = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string | null;
};

const PLAN_HINT: Record<
  PlatformPlanId,
  | 'Founding trial (30 days)'
  | '$59 · up to 60 members'
  | '$89 · up to 150 members'
  | '$129 · unlimited members'
> = {
  trial: 'Founding trial (30 days)',
  starter: '$59 · up to 60 members',
  growth: '$89 · up to 150 members',
  pro: '$129 · unlimited members',
};

export default function SuperAdminTenantDetailPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const tenantId = typeof params.id === 'string' ? params.id : '';

  const [tenant, setTenant] = useState<TenantWithHqStats | null>(null);
  const [admins, setAdmins] = useState<TenantAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [extendingTrial, setExtendingTrial] = useState(false);
  const [deactivationReason, setDeactivationReason] = useState('');
  const [confirmAction, setConfirmAction] = useState<
    'activate' | 'deactivate' | 'extend_trial' | 'change_plan' | 'delete' | null
  >(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlatformPlanId>('trial');
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loadAdmins = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [adminsRes, tenantRes] = await Promise.all([
        fetch(`/api/admin/hq/tenants/${tenantId}/admins`, { credentials: 'include' }),
        fetch(`/api/admin/hq/tenants/${tenantId}`, { credentials: 'include' }),
      ]);
      const adminsData = await adminsRes.json();
      const tenantData = await tenantRes.json();
      if (!adminsRes.ok) throw new Error(adminsData.error || 'load_failed');
      if (!tenantRes.ok) throw new Error(tenantData.error || 'load_failed');
      setAdmins(adminsData.admins ?? []);
      const nextTenant = (tenantData.tenant ?? adminsData.tenant ?? null) as TenantWithHqStats | null;
      setTenant(nextTenant);
      if (nextTenant?.platform_plan) {
        setSelectedPlan(nextTenant.platform_plan);
      }
      if (nextTenant) {
        setTenantName(nextTenant.name);
        setTenantSlug(nextTenant.slug);
      }
    } catch {
      toast(t('Could not load admins.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, t, toast]);

  const patchTenant = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/hq/tenants/${tenantId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'update_failed');
    return data;
  };

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const commitPlanChange = async () => {
    if (!tenantId) return;
    setSavingPlan(true);
    try {
      await patchTenant({ platform_plan: selectedPlan });
      toast(t('Plan updated.'), 'success');
      setConfirmAction(null);
      await loadAdmins();
    } catch {
      toast(t('Could not update plan.'), 'error');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleSaveDetails = async (e: FormEvent) => {
    e.preventDefault();
    setSavingDetails(true);
    try {
      await patchTenant({ action: 'update_details', name: tenantName, slug: tenantSlug });
      toast(t('Tenant details updated.'), 'success');
      await loadAdmins();
    } catch {
      toast(t('Could not update tenant details.'), 'error');
    } finally {
      setSavingDetails(false);
    }
  };

  const handleSetActive = async (isActive: boolean) => {
    setSavingStatus(true);
    try {
      await patchTenant({
        action: 'set_active',
        is_active: isActive,
        deactivation_reason: isActive ? null : deactivationReason,
      });
      toast(t(isActive ? 'Tenant activated.' : 'Tenant deactivated.'), 'success');
      setDeactivationReason('');
      setConfirmAction(null);
      await loadAdmins();
    } catch {
      toast(t('Could not update tenant status.'), 'error');
    } finally {
      setSavingStatus(false);
    }
  };

  const commitExtendTrial = async () => {
    setExtendingTrial(true);
    try {
      await patchTenant({ action: 'extend_trial', days: 30 });
      toast(t('Trial extended by 30 days.'), 'success');
      setConfirmAction(null);
      await loadAdmins();
    } catch {
      toast(t('Could not extend trial.'), 'error');
    } finally {
      setExtendingTrial(false);
    }
  };

  const handleDelete = async () => {
    if (!tenant) return;
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/admin/hq/tenants/${tenantId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm_name: deleteConfirmation }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'delete_failed');
      toast(t('Tenant deleted.'), 'success');
      router.push('/super-admin');
    } catch {
      toast(t('Could not delete tenant.'), 'error');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/hq/tenants/${tenantId}/admins`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'create_failed');
      toast(t('Admin created.'), 'success');
      setFullName('');
      setEmail('');
      setPassword('');
      await loadAdmins();
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message && !err.message.includes('create_failed')
          ? err.message
          : t('Could not create admin.');
      toast(message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const plan = tenant ? getPlatformPlan(tenant.platform_plan) : null;
  const cap = plan?.maxActiveMembers ?? null;
  const capLabel =
    tenant && plan
      ? cap === null
        ? `${tenant.stats.activeMemberCount} · ${t('Unlimited')}`
        : t('{{active}} of {{cap}}', {
            active: String(tenant.stats.activeMemberCount),
            cap: String(cap),
          })
      : '—';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/super-admin"
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-pits-ink-muted hover:text-pits-primary mb-3"
          >
            <ArrowLeft size={14} />
            {t('Back to tenants')}
          </Link>
          <h1 className="text-2xl font-black text-pits-ink uppercase italic tracking-tighter">
            {tenant?.name ?? '…'}
          </h1>
          {tenant && (
            <p className="text-sm text-pits-ink-muted font-mono mt-1">{tenant.slug}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {tenant && (
            <Link
              href={`/super-admin/financials/${tenant.id}`}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pits-ink-muted hover:text-pits-primary"
            >
              {t('Financial Center')}
            </Link>
          )}
          {tenant && (
            <a
              href={buildTenantDashboardUrl(tenant.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pits-ink-muted hover:text-pits-primary"
            >
              <ExternalLink size={14} />
              {t('Open dashboard')}
            </a>
          )}
        </div>
      </div>

      {tenant && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label={t('Users')} value={tenant.stats.userCount} />
          <StatCard
            label={t('Active members')}
            value={capLabel}
            warn={tenant.stats.overMemberCap}
          />
          <StatCard label={t('Athletes')} value={tenant.stats.memberCount} />
          <StatCard
            label={t('Staff')}
            value={tenant.stats.staffCount}
            hint={`${tenant.stats.adminCount} ${t('Admins')} · ${tenant.stats.coachCount} ${t('Coaches')}`}
          />
          <StatCard
            label={t('Pending payments')}
            value={tenant.stats.pendingPaymentCount}
            warn={tenant.stats.pendingPaymentCount > 0}
          />
          <StatCard
            label={t('Platform plan')}
            value={t(plan?.nameKey ?? 'Trial')}
            warn={tenant.stats.trialExpired}
            hint={
              tenant.stats.trialExpired
                ? t('Needs paid plan')
                : tenant.trial_ends_at && tenant.platform_plan === 'trial'
                  ? t('Trial ends {{date}}', {
                      date: new Date(tenant.trial_ends_at).toLocaleDateString(),
                    })
                  : undefined
            }
          />
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <form
          onSubmit={handleSaveDetails}
          className="bg-pits-surface-elevated border border-pits-edge rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Pencil size={16} className="text-pits-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-pits-ink-muted">
              {t('Tenant details')}
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
                {t('Tenant name')}
              </label>
              <input
                required
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                disabled={savingDetails || loading}
                className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
                {t('Slug')}
              </label>
              <input
                required
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value.toLowerCase())}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                title={t('lowercase-hyphen-slug')}
                disabled={savingDetails || loading}
                className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-mono font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-60"
              />
              <p className="mt-1 text-[11px] text-pits-ink-muted">{t('Slug change warning')}</p>
            </div>
          </div>
          <button
            type="submit"
            disabled={savingDetails || !tenantId || (tenantName === tenant?.name && tenantSlug === tenant?.slug)}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-pits-primary text-pits-dark-text font-bold uppercase tracking-widest text-sm disabled:opacity-60"
          >
            {savingDetails ? <Loader2 size={16} className="animate-spin" /> : null}
            {savingDetails ? t('Saving...') : t('Save changes')}
          </button>
        </form>

        <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-pits-ink-muted">
                {t('Tenant status')}
              </h2>
              <p className={`mt-1 text-lg font-black italic ${tenant?.stats.isActive ? 'text-pits-success' : 'text-red-700'}`}>
                {tenant?.stats.isActive ? t('Active') : t('Inactive')}
              </p>
            </div>
            <span className={`w-3 h-3 rounded-full ${tenant?.stats.isActive ? 'bg-pits-success' : 'bg-red-600'}`} />
          </div>
          {tenant?.stats.isActive ? (
            <button
              type="button"
              onClick={() => setConfirmAction('deactivate')}
              disabled={savingStatus}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-red-200 text-red-700 bg-red-50 font-bold uppercase tracking-widest text-sm hover:bg-red-100 disabled:opacity-60"
            >
              <Ban size={16} />
              {t('Deactivate tenant')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmAction('activate')}
              disabled={savingStatus}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-pits-primary text-pits-dark-text font-bold uppercase tracking-widest text-sm disabled:opacity-60"
            >
              {savingStatus ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
              {t('Activate tenant')}
            </button>
          )}
          {!tenant?.stats.isActive && tenant?.deactivation_reason && (
            <p className="text-xs text-pits-ink-muted">{tenant.deactivation_reason}</p>
          )}
        </div>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setConfirmAction('change_plan');
        }}
        className="bg-pits-surface-elevated border border-pits-edge rounded-2xl p-6 space-y-4"
      >
        <h2 className="text-sm font-bold uppercase tracking-widest text-pits-ink-muted">
          {t('Platform plan')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
          <div>
            <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
              {t('Plan')}
            </label>
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value as PlatformPlanId)}
              disabled={savingPlan || loading}
              className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-60"
            >
              {PLATFORM_PLAN_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(getPlatformPlan(id).nameKey)} — {t(PLAN_HINT[id])}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={savingPlan || !tenantId || selectedPlan === tenant?.platform_plan}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-pits-primary text-pits-dark-text font-bold uppercase tracking-widest text-sm disabled:opacity-60"
          >
            {savingPlan ? <Loader2 size={16} className="animate-spin" /> : null}
            {savingPlan ? t('Saving...') : t('Save plan')}
          </button>
        </div>
      </form>

      {tenant?.platform_plan === 'trial' && (
        <div className="bg-pits-primary-soft border border-pits-primary/30 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-pits-ink">
              {t('Trial controls')}
            </h2>
            <p className="text-xs text-pits-ink-muted mt-1">
              {tenant.trial_ends_at
                ? t('Trial ends {{date}}', { date: new Date(tenant.trial_ends_at).toLocaleDateString() })
                : t('Trial end date unavailable')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmAction('extend_trial')}
            disabled={extendingTrial}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-pits-black text-white font-bold uppercase tracking-widest text-sm disabled:opacity-60"
          >
            {extendingTrial ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
            {t('Extend trial 30 days')}
          </button>
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="bg-pits-surface-elevated border border-pits-edge rounded-2xl p-6 space-y-4"
      >
        <h2 className="text-sm font-bold uppercase tracking-widest text-pits-ink-muted">
          {t('Create admin')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
              {t('Full name')}
            </label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={creating}
              className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
              {t('Email')}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={creating}
              className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
              {t('Password')}
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={creating}
              className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-60"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={creating || !tenantId}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-pits-primary text-pits-dark-text font-bold uppercase tracking-widest text-sm disabled:opacity-60"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {creating ? t('Creating...') : t('Create admin')}
        </button>
      </form>

      <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-pits-edge">
          <h2 className="text-sm font-bold uppercase tracking-widest text-pits-ink-muted">
            {t('Admins')}
          </h2>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="animate-spin text-pits-ink-muted" />
          </div>
        ) : admins.length === 0 ? (
          <p className="p-8 text-center text-sm text-pits-ink-muted">{t('No admins yet.')}</p>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-pits-surface-muted text-xs font-bold uppercase tracking-wider text-pits-ink-muted">
              <tr>
                <th className="px-4 py-3">{t('Full name')}</th>
                <th className="px-4 py-3">{t('Email')}</th>
                <th className="px-4 py-3">{t('Created')}</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="border-t border-pits-edge">
                  <td className="px-4 py-3 font-medium text-pits-ink">
                    {admin.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-pits-ink-muted">
                    {admin.email ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-pits-ink-muted">
                    {admin.created_at
                      ? new Date(admin.created_at).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <section className="border border-red-200 bg-red-50/40 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-red-700">
              {t('Danger zone')}
            </h2>
            <p className="text-xs text-pits-ink-muted mt-1">{t('Delete tenant warning')}</p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmAction('delete')}
            disabled={savingStatus}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-600 text-white font-bold uppercase tracking-widest text-sm hover:bg-red-700 disabled:opacity-60"
          >
            <Trash2 size={16} />
            {t('Delete tenant')}
          </button>
        </div>
      </section>

      <ConfirmDialog
        isOpen={confirmAction === 'change_plan'}
        title={t('Confirm plan change')}
        message={t('Plan change confirmation', { plan: t(getPlatformPlan(selectedPlan).nameKey) })}
        confirmLabel={t('Save plan')}
        cancelLabel={t('Cancel')}
        onCancel={() => setConfirmAction(null)}
        onConfirm={commitPlanChange}
      />

      <ConfirmDialog
        isOpen={confirmAction === 'extend_trial'}
        title={t('Extend trial 30 days')}
        message={t('Extend trial confirmation')}
        confirmLabel={t('Extend trial')}
        cancelLabel={t('Cancel')}
        onCancel={() => setConfirmAction(null)}
        onConfirm={commitExtendTrial}
      />

      <ConfirmDialog
        isOpen={confirmAction === 'activate'}
        title={t('Activate tenant')}
        message={t('Activate tenant confirmation')}
        confirmLabel={t('Activate tenant')}
        cancelLabel={t('Cancel')}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => handleSetActive(true)}
      />

      <ConfirmDialog
        isOpen={confirmAction === 'deactivate'}
        title={t('Deactivate tenant')}
        message={t('Deactivate tenant warning')}
        confirmLabel={t('Deactivate tenant')}
        cancelLabel={t('Cancel')}
        variant="warning"
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => handleSetActive(false)}
      >
        <label className="block text-xs font-bold uppercase tracking-wider text-pits-ink-muted mb-2">
          {t('Deactivation reason')}
        </label>
        <textarea
          required
          value={deactivationReason}
          onChange={(e) => setDeactivationReason(e.target.value)}
          maxLength={500}
          className="w-full min-h-20 p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm text-pits-ink outline-none focus:ring-2 focus:ring-pits-primary/40"
        />
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={confirmAction === 'delete'}
        title={t('Delete tenant')}
        message={t('Delete tenant confirmation')}
        confirmLabel={t('Delete tenant')}
        cancelLabel={t('Cancel')}
        variant="danger"
        onCancel={() => {
          setConfirmAction(null);
          setDeleteConfirmation('');
        }}
        onConfirm={handleDelete}
      >
        <label className="block text-xs font-bold uppercase tracking-wider text-pits-ink-muted mb-2">
          {t('Type tenant name to confirm', { name: tenant?.name ?? '' })}
        </label>
        <input
          value={deleteConfirmation}
          onChange={(e) => setDeleteConfirmation(e.target.value)}
          className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm text-pits-ink outline-none focus:ring-2 focus:ring-red-300"
        />
      </ConfirmDialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string | number;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-pits-ink-muted">
        {label}
      </p>
      <p
        className={`text-xl font-black italic tracking-tighter mt-1 ${
          warn ? 'text-red-700' : 'text-pits-ink'
        }`}
      >
        {value}
      </p>
      {hint && (
        <p className="text-[10px] font-bold uppercase tracking-wider text-pits-ink-muted mt-1">
          {hint}
        </p>
      )}
    </div>
  );
}
