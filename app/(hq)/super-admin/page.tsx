'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useToast } from '@/components/Toast';
import {
  DEFAULT_PLATFORM_PLAN,
  PLATFORM_PLAN_IDS,
  getPlatformPlan,
  type PlatformPlanId,
} from '@/lib/platform-plans';
import type { PlatformHqOverview, TenantWithHqStats } from '@/lib/types/gym';

const PLAN_HINT: Record<PlatformPlanId, 'Founding trial (30 days)' | '$59 · up to 60 members' | '$89 · up to 150 members' | '$129 · unlimited members'> = {
  trial: 'Founding trial (30 days)',
  starter: '$59 · up to 60 members',
  growth: '$89 · up to 150 members',
  pro: '$129 · unlimited members',
};

function planBadgeClass(plan: PlatformPlanId, expired: boolean) {
  if (expired) return 'bg-red-50 text-red-700 border-red-200';
  if (plan === 'pro') return 'bg-pits-black text-white border-pits-black';
  if (plan === 'growth') return 'bg-pits-primary-soft text-pits-ink border-pits-primary/40';
  if (plan === 'starter') return 'bg-pits-surface-muted text-pits-ink border-pits-edge';
  return 'bg-orange-50 text-orange-700 border-orange-200';
}

export default function SuperAdminTenantsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<TenantWithHqStats[]>([]);
  const [overview, setOverview] = useState<PlatformHqOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [platformPlan, setPlatformPlan] = useState<PlatformPlanId>(DEFAULT_PLATFORM_PLAN);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/hq/tenants', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'load_failed');
      setTenants(data.tenants ?? []);
      setOverview(data.overview ?? null);
    } catch {
      toast(t('Could not load tenants.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/admin/hq/tenants', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          platform_plan: platformPlan,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'create_failed');
      toast(t('Tenant created.'), 'success');
      setName('');
      setSlug('');
      setPlatformPlan(DEFAULT_PLATFORM_PLAN);
      await loadTenants();
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message && !err.message.includes('create_failed')
          ? err.message
          : t('Could not create tenant.');
      toast(message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const paidBoxes = overview
    ? overview.boxCount - overview.trialCount
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-pits-ink uppercase italic tracking-tighter">
          {t('Platform HQ')}
        </h1>
        <p className="text-xs font-bold uppercase tracking-widest text-pits-ink-muted mt-1">
          {t('Platform overview')}
        </p>
      </div>

      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <OverviewCard label={t('Boxes')} value={overview.boxCount} hint={`${paidBoxes} ${t('Paid boxes')}`} />
          <OverviewCard
            label={t('Users')}
            value={overview.userCount}
            hint={`${overview.activeMemberCount} ${t('Active members')}`}
          />
          <OverviewCard
            label={t('MRR')}
            value={`$${overview.mrrUsd}`}
            hint={`${overview.planCounts.starter}S · ${overview.planCounts.growth}G · ${overview.planCounts.pro}P`}
          />
          <OverviewCard
            label={t('Solvency')}
            value={`${overview.solvencyRate}%`}
            hint={`${overview.pendingPaymentCount} ${t('Pending payments')}`}
            warn={overview.pendingPaymentCount > 0}
          />
          <OverviewCard
            label={t('Over member cap')}
            value={overview.overCapCount}
            warn={overview.overCapCount > 0}
          />
          <OverviewCard
            label={t('Expired trials')}
            value={overview.expiredTrialCount}
            warn={overview.expiredTrialCount > 0}
            hint={`${overview.trialCount} ${t('Trial')}`}
          />
          <OverviewCard label={t('Athletes')} value={overview.memberCount} />
          <OverviewCard label={t('Staff')} value={overview.staffCount} />
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="bg-pits-surface-elevated border border-pits-edge rounded-2xl p-6 space-y-4"
      >
        <h2 className="text-sm font-bold uppercase tracking-widest text-pits-ink-muted">
          {t('Create tenant')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
              {t('Tenant name')}
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={creating}
              className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
              {t('Slug')}
            </label>
            <input
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              disabled={creating}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              title={t('lowercase-hyphen-slug')}
              className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-60"
              placeholder="madrid"
            />
            <p className="mt-1 text-[11px] text-pits-ink-muted">{t('lowercase-hyphen-slug')}</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
              {t('Platform plan')}
            </label>
            <select
              value={platformPlan}
              onChange={(e) => setPlatformPlan(e.target.value as PlatformPlanId)}
              disabled={creating}
              className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-60"
            >
              {PLATFORM_PLAN_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(getPlatformPlan(id).nameKey)} — {t(PLAN_HINT[id])}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-pits-primary text-pits-dark-text font-bold uppercase tracking-widest text-sm disabled:opacity-60"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {creating ? t('Creating...') : t('Create tenant')}
        </button>
      </form>

      <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="animate-spin text-pits-ink-muted" />
          </div>
        ) : tenants.length === 0 ? (
          <p className="p-8 text-center text-sm text-pits-ink-muted">{t('No tenants yet.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[860px]">
              <thead className="bg-pits-surface-muted text-xs font-bold uppercase tracking-wider text-pits-ink-muted">
                <tr>
                  <th className="px-4 py-3">{t('Tenant name')}</th>
                <th className="px-4 py-3">{t('Status')}</th>
                  <th className="px-4 py-3">{t('Platform plan')}</th>
                  <th className="px-4 py-3">{t('Users')}</th>
                  <th className="px-4 py-3">{t('Active members')}</th>
                  <th className="px-4 py-3">{t('Pending payments')}</th>
                  <th className="px-4 py-3">{t('Ask AI quota')}</th>
                  <th className="px-4 py-3">{t('Created')}</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => {
                  const plan = getPlatformPlan(tenant.platform_plan);
                  const cap = plan.maxActiveMembers;
                  const capLabel =
                    cap === null
                      ? `${tenant.stats.activeMemberCount} · ${t('Unlimited')}`
                      : t('{{active}} of {{cap}}', {
                          active: String(tenant.stats.activeMemberCount),
                          cap: String(cap),
                        });
                  return (
                    <tr
                      key={tenant.id}
                      className="border-t border-pits-edge hover:bg-pits-surface-muted/50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/super-admin/tenants/${tenant.id}`}
                          className="font-bold text-pits-ink hover:text-pits-primary"
                        >
                          {tenant.name}
                        </Link>
                        <p className="text-xs text-pits-ink-muted font-mono mt-0.5">
                          {tenant.slug}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            tenant.stats.isActive
                              ? 'bg-pits-primary-soft text-pits-success border-pits-primary/30'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${tenant.stats.isActive ? 'bg-pits-success' : 'bg-red-600'}`} />
                          {tenant.stats.isActive ? t('Active') : t('Inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${planBadgeClass(
                            tenant.platform_plan,
                            tenant.stats.trialExpired
                          )}`}
                        >
                          {t(plan.nameKey)}
                        </span>
                        {tenant.stats.trialExpired && (
                          <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mt-1">
                            {t('Needs paid plan')}
                          </p>
                        )}
                        {tenant.stats.trialEndsSoon && !tenant.stats.trialExpired && (
                          <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mt-1">
                            {t('Trial ending soon')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-pits-ink">
                        <span className="font-bold">{tenant.stats.userCount}</span>
                        <span className="text-pits-ink-muted">
                          {' '}
                          · {tenant.stats.staffCount} {t('Staff')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`font-bold ${
                            tenant.stats.overMemberCap ? 'text-red-700' : 'text-pits-ink'
                          }`}
                        >
                          {capLabel}
                        </span>
                        {tenant.stats.overMemberCap && (
                          <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mt-1">
                            {t('Over member cap')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-pits-ink">
                        {tenant.stats.pendingPaymentCount}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`font-bold ${
                            tenant.stats.aiQuestionLimit > 0 &&
                            tenant.stats.aiQuestionsUsed >= tenant.stats.aiQuestionLimit
                              ? 'text-red-700'
                              : 'text-pits-ink'
                          }`}
                        >
                          {tenant.stats.aiQuestionLimit <= 0
                            ? t('Disabled')
                            : t('{{used}} of {{limit}} questions this month', {
                                used: String(tenant.stats.aiQuestionsUsed),
                                limit: String(tenant.stats.aiQuestionLimit),
                              })}
                        </span>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-pits-ink-muted mt-1">
                          {tenant.stats.aiCustomLimit ? t('Custom limit') : t('Plan default')}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-pits-ink-muted">
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewCard({
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
        className={`text-2xl font-black italic tracking-tighter mt-1 ${
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
