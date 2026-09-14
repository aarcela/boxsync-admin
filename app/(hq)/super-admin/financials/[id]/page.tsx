'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/components/LanguageContext';
import { useToast } from '@/components/Toast';
import { getPlatformPlan } from '@/lib/platform-plans';
import { buildTenantDashboardUrl } from '@/lib/tenant-host';
import type { TranslationKey } from '@/lib/translations';
import type { HqFinancialPeriod, HqTenantFinancialDetail, HqTenantPayStatus } from '@/lib/types/gym';
import {
  IncomeExpenseChart,
  KpiCard,
  PeriodFilters,
  formatUsd,
  ledgerLabel,
  toDateInputValue,
} from '../hq-financial-ui';

function monthStartToday() {
  return `${toDateInputValue(new Date()).slice(0, 7)}-01`;
}

export default function HqTenantFinancialsPage() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const params = useParams();
  const tenantId = typeof params.id === 'string' ? params.id : '';

  const [period, setPeriod] = useState<HqFinancialPeriod>('month');
  const [customStart, setCustomStart] = useState(() =>
    toDateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [customEnd, setCustomEnd] = useState(() => toDateInputValue(new Date()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<HqTenantFinancialDetail | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [periodStart, setPeriodStart] = useState(monthStartToday);
  const [status, setStatus] = useState<'approved' | 'pending'>('approved');
  const [notes, setNotes] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({ period });
      if (period === 'custom') {
        query.set('start', customStart);
        query.set('end', customEnd);
      }
      const res = await fetch(`/api/admin/hq/financials/${tenantId}?${query}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'load_failed');
      const next = json as HqTenantFinancialDetail;
      setData(next);
      if (next.tenant.monthlyFeeUsd > 0) setAmount(String(next.tenant.monthlyFeeUsd));
    } catch {
      toast(t('Could not load financials.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, period, customStart, customEnd, t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePayment = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/hq/financials', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'tenant_payment',
          tenant_id: tenantId,
          amount: Number(amount),
          method,
          period_start: periodStart,
          status,
          notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'save_failed');
      toast(t('Entry recorded.'), 'success');
      setNotes('');
      await load();
    } catch {
      toast(t('Could not save entry.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch('/api/admin/hq/financials', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'payment', id: deleteId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'delete_failed');
      setDeleteId(null);
      await load();
    } catch {
      toast(t('Could not delete entry.'), 'error');
    }
  };

  const payStatusLabel = (value: HqTenantPayStatus): TranslationKey => {
    if (value === 'trial') return 'Trial';
    if (value === 'paid') return 'Paid this period';
    if (value === 'pending') return 'pending';
    return 'Unpaid';
  };

  const plan = data ? getPlatformPlan(data.tenant.platform_plan) : null;
  const fieldClass =
    'w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 outline-none';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/super-admin/financials"
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-pits-ink-muted hover:text-pits-primary mb-3"
          >
            <ArrowLeft size={14} />
            {t('Back to financials')}
          </Link>
          <h1 className="text-2xl font-black text-pits-ink uppercase italic tracking-tighter">
            {data?.tenant.name ?? '…'}
          </h1>
          {data && plan && (
            <p className="text-sm text-pits-ink-muted font-mono mt-1">
              {data.tenant.slug} · {t(plan.nameKey)} · {formatUsd(data.tenant.monthlyFeeUsd)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodFilters
            period={period}
            setPeriod={setPeriod}
            customStart={customStart}
            customEnd={customEnd}
            setCustomStart={setCustomStart}
            setCustomEnd={setCustomEnd}
            labels={{
              today: t('Today'),
              week: t('This Week'),
              month: t('This Month'),
              custom: t('Custom Range'),
              from: t('From'),
              to: t('To'),
            }}
          />
          <button
            type="button"
            onClick={load}
            className="p-2.5 bg-pits-primary text-pits-dark-text border border-pits-primary-dark rounded-xl"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {data && (
            <a
              href={buildTenantDashboardUrl(data.tenant.slug)}
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

      {loading && !data ? (
        <div className="p-12 flex justify-center">
          <Loader2 className="animate-spin text-pits-ink-muted" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label={t('Expected MRR')} value={formatUsd(data.tenant.monthlyFeeUsd)} />
            <KpiCard label={t('Collected')} value={formatUsd(data.collectedUsd)} tone="success" />
            <KpiCard
              label={t('Status')}
              value={t(payStatusLabel(data.payStatus))}
              warn={data.payStatus === 'unpaid'}
            />
            <KpiCard
              label={t('Last payment')}
              value={data.lastPaidAt ? new Date(data.lastPaidAt).toLocaleDateString() : '—'}
            />
          </div>

          <IncomeExpenseChart
            series={data.series}
            lang={lang}
            incomeLabel={t('Collected')}
            expenseLabel={t('Outcomes')}
          />

          <form
            onSubmit={handlePayment}
            className="bg-pits-surface-elevated border border-pits-edge rounded-2xl p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <h2 className="sm:col-span-2 lg:col-span-3 text-sm font-bold uppercase tracking-widest text-pits-ink-muted">
              {t('Record tenant payment')}
            </h2>
            <div>
              <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">{t('Amount')}</label>
              <input required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">{t('Billing period')}</label>
              <input required type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">{t('Method')}</label>
              <input value={method} onChange={(e) => setMethod(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">{t('Status')}</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as 'approved' | 'pending')} className={fieldClass}>
                <option value="approved">{t('Approved')}</option>
                <option value="pending">{t('pending')}</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">{t('Notes')}</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldClass} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <button
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-pits-primary text-pits-dark-text font-bold uppercase tracking-widest text-sm disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                {t('Record tenant payment')}
              </button>
            </div>
          </form>

          <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-pits-edge">
              <h2 className="text-sm font-bold uppercase tracking-widest text-pits-ink-muted">{t('Payments')}</h2>
            </div>
            {data.payments.length === 0 ? (
              <p className="p-8 text-center text-sm text-pits-ink-muted">{t('No payments')}</p>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-pits-surface-muted text-xs font-bold uppercase tracking-wider text-pits-ink-muted">
                  <tr>
                    <th className="px-4 py-3">{t('Billing period')}</th>
                    <th className="px-4 py-3">{t('Method')}</th>
                    <th className="px-4 py-3">{t('Amount')}</th>
                    <th className="px-4 py-3">{t('Status')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((row) => (
                    <tr key={row.id} className="border-t border-pits-edge">
                      <td className="px-4 py-3 text-sm text-pits-ink">{row.period_start}</td>
                      <td className="px-4 py-3 text-sm text-pits-ink">{row.method}</td>
                      <td className="px-4 py-3 text-sm font-bold text-pits-ink">{formatUsd(row.amount)}</td>
                      <td className="px-4 py-3 text-sm text-pits-ink">{ledgerLabel(row.status, t)}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setDeleteId(row.id)} className="text-pits-ink-muted hover:text-red-700">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}

      <ConfirmDialog
        isOpen={!!deleteId}
        title={t('Delete entry')}
        message={t('Delete entry confirmation')}
        confirmLabel={t('Delete entry')}
        cancelLabel={t('Cancel')}
        variant="danger"
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
