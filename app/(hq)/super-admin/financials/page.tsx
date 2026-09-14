'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/components/LanguageContext';
import { useToast } from '@/components/Toast';
import { getPlatformPlan } from '@/lib/platform-plans';
import type { TranslationKey } from '@/lib/translations';
import {
  HQ_EXPENSE_CATEGORIES,
  HQ_INCOME_CATEGORIES,
  type HqFinancialPeriod,
  type HqFinancialsPayload,
  type HqTenantPayStatus,
} from '@/lib/types/gym';
import {
  IncomeExpenseChart,
  KpiCard,
  MixBars,
  PeriodFilters,
  categoryMixItems,
  formatUsd,
  ledgerLabel,
  methodMixItems,
  toDateInputValue,
} from './hq-financial-ui';

function monthStartToday() {
  return `${toDateInputValue(new Date()).slice(0, 7)}-01`;
}

export default function HqFinancialsPage() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [period, setPeriod] = useState<HqFinancialPeriod>('month');
  const [customStart, setCustomStart] = useState(() =>
    toDateInputValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [customEnd, setCustomEnd] = useState(() => toDateInputValue(new Date()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<HqFinancialsPayload | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<'payment' | 'income' | 'expense' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'payment' | 'income' | 'expense'; id: string } | null>(null);

  const [payTenant, setPayTenant] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('');
  const [payPeriod, setPayPeriod] = useState(monthStartToday);
  const [payStatus, setPayStatus] = useState<'approved' | 'pending'>('approved');
  const [payNotes, setPayNotes] = useState('');

  const [incDesc, setIncDesc] = useState('');
  const [incCat, setIncCat] = useState<(typeof HQ_INCOME_CATEGORIES)[number]>('other_income');
  const [incAmount, setIncAmount] = useState('');
  const [incDate, setIncDate] = useState(toDateInputValue(new Date()));

  const [expDesc, setExpDesc] = useState('');
  const [expCat, setExpCat] = useState<(typeof HQ_EXPENSE_CATEGORIES)[number]>('Other');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(toDateInputValue(new Date()));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (period === 'custom') {
        params.set('start', customStart);
        params.set('end', customEnd);
      }
      const res = await fetch(`/api/admin/hq/financials?${params}`, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'load_failed');
      setData(json as HqFinancialsPayload);
    } catch {
      toast(t('Could not load financials.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd, t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const tenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!data) return [];
    if (!q) return data.tenants;
    return data.tenants.filter(
      (row) => row.name.toLowerCase().includes(q) || row.slug.toLowerCase().includes(q)
    );
  }, [data, search]);

  const selectTenant = (id: string) => {
    setPayTenant(id);
    const row = data?.tenants.find((item) => item.id === id);
    if (row && row.monthlyFeeUsd > 0) setPayAmount(String(row.monthlyFeeUsd));
  };

  const postEntry = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/hq/financials', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'save_failed');
      toast(t('Entry recorded.'), 'success');
      setForm(null);
      await load();
    } catch {
      toast(t('Could not save entry.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePayment = (e: FormEvent) => {
    e.preventDefault();
    postEntry({
      kind: 'tenant_payment',
      tenant_id: payTenant,
      amount: Number(payAmount),
      method: payMethod,
      period_start: payPeriod,
      status: payStatus,
      notes: payNotes,
    });
  };

  const handleIncome = (e: FormEvent) => {
    e.preventDefault();
    postEntry({
      kind: 'income',
      description: incDesc,
      category: incCat,
      amount: Number(incAmount),
      income_date: incDate,
    });
  };

  const handleExpense = (e: FormEvent) => {
    e.preventDefault();
    postEntry({
      kind: 'expense',
      description: expDesc,
      category: expCat,
      amount: Number(expAmount),
      expense_date: expDate,
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch('/api/admin/hq/financials', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deleteTarget),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'delete_failed');
      setDeleteTarget(null);
      await load();
    } catch {
      toast(t('Could not delete entry.'), 'error');
    }
  };

  const payStatusLabel = (status: HqTenantPayStatus): TranslationKey => {
    if (status === 'trial') return 'Trial';
    if (status === 'paid') return 'Paid this period';
    if (status === 'pending') return 'pending';
    return 'Unpaid';
  };

  const overview = data?.overview;
  const fieldClass =
    'w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 outline-none';

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-pits-ink uppercase italic tracking-tighter">
            {t('Financial Center')}
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest text-pits-ink-muted mt-1">
            {t('Platform box ledger')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
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
        </div>
      </div>

      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label={t('Expected MRR')}
            value={formatUsd(overview.expectedMrrUsd)}
            hint={`${overview.paidBoxCount} ${t('Paid this period')}`}
          />
          <KpiCard label={t('Collected')} value={formatUsd(overview.collectedUsd)} tone="success" />
          <KpiCard label={t('HQ incomes')} value={formatUsd(overview.otherIncomeUsd)} />
          <KpiCard
            label={t('HQ outcomes')}
            value={formatUsd(overview.expensesUsd)}
            tone="danger"
          />
          <KpiCard
            label={t('Net Balance')}
            value={formatUsd(overview.netUsd)}
            hint={`${overview.marginPct}% ${t('Profit Margin')}`}
            tone={overview.netUsd >= 0 ? 'success' : 'danger'}
            warn={overview.netUsd < 0}
          />
          <KpiCard
            label={t('Unpaid')}
            value={String(overview.unpaidCount)}
            hint={formatUsd(overview.unpaidUsd)}
            warn={overview.unpaidCount > 0}
          />
          <KpiCard label={t('pending')} value={String(overview.pendingCount)} warn={overview.pendingCount > 0} />
          <KpiCard
            label={t('Boxes')}
            value={String(overview.boxCount)}
            hint={`${overview.trialCount} ${t('Trial')}`}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(['payment', 'income', 'expense'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setForm(form === id ? null : id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest ${
              form === id
                ? 'bg-pits-primary text-pits-dark-text'
                : 'border border-pits-edge text-pits-ink hover:text-pits-primary'
            }`}
          >
            <Plus size={14} />
            {t(
              id === 'payment'
                ? 'Record tenant payment'
                : id === 'income'
                  ? 'Record HQ income'
                  : 'Record HQ expense'
            )}
          </button>
        ))}
      </div>

      {form === 'payment' && (
        <form onSubmit={handlePayment} className="bg-pits-surface-elevated border border-pits-edge rounded-2xl p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('Tenant name')}>
            <select required value={payTenant} onChange={(e) => selectTenant(e.target.value)} className={fieldClass}>
              <option value="">{t('Select tenant')}</option>
              {(data?.tenants ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · {t(getPlatformPlan(row.platform_plan).nameKey)} · {formatUsd(row.monthlyFeeUsd)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('Amount')}>
            <input required type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className={fieldClass} />
          </Field>
          <Field label={t('Billing period')}>
            <input required type="date" value={payPeriod} onChange={(e) => setPayPeriod(e.target.value)} className={fieldClass} />
          </Field>
          <Field label={t('Method')}>
            <input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={fieldClass} placeholder="Zelle / Pago Móvil" />
          </Field>
          <Field label={t('Status')}>
            <select value={payStatus} onChange={(e) => setPayStatus(e.target.value as 'approved' | 'pending')} className={fieldClass}>
              <option value="approved">{t('Approved')}</option>
              <option value="pending">{t('pending')}</option>
            </select>
          </Field>
          <Field label={t('Notes')}>
            <input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className={fieldClass} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <button disabled={saving} className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-pits-primary text-pits-dark-text font-bold uppercase tracking-widest text-sm disabled:opacity-60">
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {t('Record tenant payment')}
            </button>
          </div>
        </form>
      )}

      {form === 'income' && (
        <form onSubmit={handleIncome} className="bg-pits-surface-elevated border border-pits-edge rounded-2xl p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t('Description')}>
            <input required value={incDesc} onChange={(e) => setIncDesc(e.target.value)} className={fieldClass} />
          </Field>
          <Field label={t('Category')}>
            <select value={incCat} onChange={(e) => setIncCat(e.target.value as typeof incCat)} className={fieldClass}>
              {HQ_INCOME_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{ledgerLabel(cat, t)}</option>
              ))}
            </select>
          </Field>
          <Field label={t('Amount')}>
            <input required type="number" min="0" step="0.01" value={incAmount} onChange={(e) => setIncAmount(e.target.value)} className={fieldClass} />
          </Field>
          <Field label={t('Created')}>
            <input required type="date" value={incDate} onChange={(e) => setIncDate(e.target.value)} className={fieldClass} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <button disabled={saving} className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-pits-primary text-pits-dark-text font-bold uppercase tracking-widest text-sm disabled:opacity-60">
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {t('Record HQ income')}
            </button>
          </div>
        </form>
      )}

      {form === 'expense' && (
        <form onSubmit={handleExpense} className="bg-pits-surface-elevated border border-pits-edge rounded-2xl p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t('Description')}>
            <input required value={expDesc} onChange={(e) => setExpDesc(e.target.value)} className={fieldClass} />
          </Field>
          <Field label={t('Category')}>
            <select value={expCat} onChange={(e) => setExpCat(e.target.value as typeof expCat)} className={fieldClass}>
              {HQ_EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{ledgerLabel(cat, t)}</option>
              ))}
            </select>
          </Field>
          <Field label={t('Amount')}>
            <input required type="number" min="0" step="0.01" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} className={fieldClass} />
          </Field>
          <Field label={t('Created')}>
            <input required type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} className={fieldClass} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <button disabled={saving} className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-pits-primary text-pits-dark-text font-bold uppercase tracking-widest text-sm disabled:opacity-60">
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {t('Record HQ expense')}
            </button>
          </div>
        </form>
      )}

      {loading && !data ? (
        <div className="p-12 flex justify-center">
          <Loader2 className="animate-spin text-pits-ink-muted" />
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <IncomeExpenseChart
              series={data.series}
              lang={lang}
              incomeLabel={t('Incomes')}
              expenseLabel={t('Outcomes')}
            />
            <MixBars
              title={t('Payment mix')}
              items={methodMixItems(data.methodMix)}
              empty={t('No financial data yet.')}
            />
          </div>
          <MixBars
            title={t('Expense by Category')}
            items={categoryMixItems(data.expenseMix)}
            empty={t('No financial data yet.')}
            labelOf={(key) => ledgerLabel(key, t)}
          />

          <Ledger
            title={t('Tenant ledger')}
            empty={t('No tenants yet.')}
            search={search}
            onSearch={setSearch}
            searchPlaceholder={t('Search tenants')}
            headers={[t('Tenant name'), t('Platform plan'), t('Collected'), t('Status'), t('Last payment')]}
            rows={tenants.map((tenant) => ({
              key: tenant.id,
              href: `/super-admin/financials/${tenant.id}`,
              cells: [
                `${tenant.name}\n${tenant.slug}`,
                `${t(getPlatformPlan(tenant.platform_plan).nameKey)} · ${formatUsd(tenant.monthlyFeeUsd)}`,
                formatUsd(tenant.collectedUsd),
                t(payStatusLabel(tenant.payStatus)),
                tenant.lastPaidAt ? new Date(tenant.lastPaidAt).toLocaleDateString() : '—',
              ],
            }))}
          />

          <Ledger
            title={t('HQ incomes')}
            empty={t('No financial data yet.')}
            headers={[t('Created'), t('Description'), t('Category'), t('Amount'), '']}
            rows={data.incomes.map((row) => ({
              key: row.id,
              cells: [
                row.income_date,
                row.description,
                ledgerLabel(row.category, t),
                formatUsd(row.amount),
                'delete',
              ],
              onDelete: () => setDeleteTarget({ kind: 'income', id: row.id }),
            }))}
          />

          <Ledger
            title={t('HQ outcomes')}
            empty={t('No financial data yet.')}
            headers={[t('Created'), t('Description'), t('Category'), t('Amount'), '']}
            rows={data.expenses.map((row) => ({
              key: row.id,
              cells: [
                row.expense_date,
                row.description,
                ledgerLabel(row.category, t),
                formatUsd(row.amount),
                'delete',
              ],
              onDelete: () => setDeleteTarget({ kind: 'expense', id: row.id }),
            }))}
          />

          <Ledger
            title={t('Payments')}
            empty={t('No payments')}
            headers={[t('Tenant name'), t('Billing period'), t('Method'), t('Amount'), t('Status'), '']}
            rows={data.payments.map((row) => ({
              key: row.id,
              cells: [
                row.tenant_name,
                row.period_start,
                row.method,
                formatUsd(row.amount),
                ledgerLabel(row.status, t),
                'delete',
              ],
              onDelete: () => setDeleteTarget({ kind: 'payment', id: row.id }),
            }))}
          />
        </>
      ) : null}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('Delete entry')}
        message={t('Delete entry confirmation')}
        confirmLabel={t('Delete entry')}
        cancelLabel={t('Cancel')}
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">{label}</label>
      {children}
    </div>
  );
}

function Ledger({
  title,
  empty,
  headers,
  rows,
  search,
  onSearch,
  searchPlaceholder,
}: {
  title: string;
  empty: string;
  headers: string[];
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  rows: {
    key: string;
    href?: string;
    cells: string[];
    onDelete?: () => void;
  }[];
}) {
  return (
    <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-pits-edge flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-pits-ink-muted">{title}</h2>
        {onSearch && (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pits-ink-muted" />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-8 pr-3 py-2 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm text-pits-ink w-56"
            />
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="p-8 text-center text-sm text-pits-ink-muted">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[720px]">
            <thead className="bg-pits-surface-muted text-xs font-bold uppercase tracking-wider text-pits-ink-muted">
              <tr>
                {headers.map((header, i) => (
                  <th key={`${header}-${i}`} className="px-4 py-3">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-pits-edge hover:bg-pits-surface-muted/50">
                  {row.cells.map((cell, i) => (
                    <td key={i} className="px-4 py-3 text-sm text-pits-ink whitespace-pre-line">
                      {cell === 'delete' && row.onDelete ? (
                        <button type="button" onClick={row.onDelete} className="text-pits-ink-muted hover:text-red-700">
                          <Trash2 size={14} />
                        </button>
                      ) : i === 0 && row.href ? (
                        <Link href={row.href} className="font-bold hover:text-pits-primary">{cell}</Link>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
