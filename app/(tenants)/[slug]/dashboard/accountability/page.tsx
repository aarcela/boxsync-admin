'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Minus } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import { useToast } from '@/components/Toast';
import { useMoneyCurrency } from '@/lib/hooks/useMoneyCurrency';
import { currencySymbol } from '@/lib/currency';
import { getGymDate } from '@/lib/utils/date';
import { capitalizeFirst, formatMonthYear } from '@/lib/utils/format-date';
import type { TranslationKey } from '@/lib/translations';
import { loadMoneyMonth, monthTotals, shiftMonth, type MoneyMonth } from '@/lib/money/movements';

/** Money → This month: income − expenses for the month, compared with the month before. */
export default function ThisMonthPage() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const { tenantId, timezone } = useTenant();
  const { code: displayCode, currencies } = useMoneyCurrency();

  const [month, setMonth] = useState(() => getGymDate(new Date(), timezone).slice(0, 7));
  const [result, setResult] = useState<{
    key: string;
    current: MoneyMonth | null;
    previous: MoneyMonth | null;
  } | null>(null);

  const requestKey = `${month}|${tenantId}|${currencies.reference}|${timezone}`;
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadMoneyMonth(month, tenantId, currencies.reference, timezone),
      loadMoneyMonth(shiftMonth(month, -1), tenantId, currencies.reference, timezone),
    ])
      .then(([cur, prev]) => {
        if (!cancelled) setResult({ key: requestKey, current: cur, previous: prev });
      })
      .catch(() => {
        if (cancelled) return;
        toast(t('Failed to sync financial data'), 'error');
        setResult({ key: requestKey, current: null, previous: null });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const current = result?.current ?? null;
  const previous = result?.previous ?? null;
  const loading = result?.key !== requestKey;

  const rate = current?.rate ?? 0;
  const now = useMemo(
    () => monthTotals(current?.movements ?? [], displayCode, currencies, rate),
    [current, displayCode, currencies, rate],
  );
  const before = useMemo(
    () => monthTotals(previous?.movements ?? [], displayCode, currencies, previous?.rate ?? rate),
    [previous, displayCode, currencies, rate],
  );

  const symbol = currencySymbol(displayCode);
  const money = (value: number) =>
    `${value < 0 ? '−' : ''}${symbol}${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const ready = !!current && !loading;
  const prevLabel = formatMonthYear(`${shiftMonth(month, -1)}-01`, lang);

  /** "+€12 (8%) vs October" style change; `goodWhenUp` flips colours for expenses. */
  const change = (value: number, base: number, goodWhenUp: boolean) => {
    if (!ready || !previous) return null;
    const diff = value - base;
    if (Math.abs(diff) < 0.5) {
      return (
        <p className="mt-1 text-xs text-pits-dim inline-flex items-center gap-1">
          <Minus size={12} /> {t('Same as {{month}}', { month: prevLabel })}
        </p>
      );
    }
    const up = diff > 0;
    const good = up === goodWhenUp;
    const pct = base !== 0 ? Math.round((Math.abs(diff) / Math.abs(base)) * 100) : null;
    return (
      <p className={`mt-1 text-xs font-semibold inline-flex items-center gap-1 ${good ? 'text-pits-positive' : 'text-pits-danger'}`}>
        {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {up ? '+' : '−'}
        {money(Math.abs(diff))}
        {pct != null ? ` (${pct}%)` : ''} {t('vs {{month}}', { month: prevLabel })}
      </p>
    );
  };

  const breakdown = (title: string, rows: { category: string; amount: number }[], total: number, bar: string) => (
    <section className="rounded-2xl border border-pits-edge bg-pits-surface-elevated p-4">
      <h2 className="text-base font-bold text-pits-text mb-3">{title}</h2>
      {!ready ? (
        <div className="space-y-3 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-3 rounded bg-pits-surface-muted" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-pits-dim">{t('Nothing recorded for this month.')}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.category}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-pits-text truncate">{t(row.category as TranslationKey)}</span>
                <span className="font-semibold text-pits-text tabular-nums">{money(row.amount)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-pits-surface-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${bar}`}
                  style={{ width: `${total > 0 ? Math.max(2, (row.amount / total) * 100) : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{t('This month')}</h1>
          <p className="page-subtitle">{t('Income minus expenses for the month.')}</p>
        </div>
        <div className="flex items-center rounded-xl border border-pits-edge bg-pits-surface-elevated self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label={t('Previous month')}
            className="p-2.5 text-pits-dim hover:text-pits-text"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="px-1 text-sm font-semibold text-pits-text min-w-[8.5rem] text-center whitespace-nowrap">
            {capitalizeFirst(formatMonthYear(`${month}-01`, lang))}
          </span>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label={t('Next month')}
            className="p-2.5 text-pits-dim hover:text-pits-text"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-pits-edge bg-pits-surface-elevated p-5">
        <p className="text-sm font-semibold text-pits-dim">{t('Result')}</p>
        <p
          className={`mt-1 text-4xl font-bold tabular-nums ${
            !ready ? 'text-pits-dim' : now.result >= 0 ? 'text-pits-positive' : 'text-pits-danger'
          }`}
        >
          {ready ? money(now.result) : '—'}
        </p>
        {change(now.result, before.result, true)}
        <p className="mt-3 text-sm text-pits-dim">
          {ready
            ? now.result >= 0
              ? t('Operational stability secured. Aiming for efficiency.')
              : t('Warning: Operational burn exceeding revenue. Immediate review required.')
            : ''}
        </p>
      </section>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-pits-edge bg-pits-surface-elevated p-4">
          <p className="text-xs font-semibold text-pits-dim">{t('Money in')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-pits-text">{ready ? money(now.income) : '—'}</p>
          {change(now.income, before.income, true)}
        </div>
        <div className="rounded-2xl border border-pits-edge bg-pits-surface-elevated p-4">
          <p className="text-xs font-semibold text-pits-dim">{t('Money out')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-pits-text">{ready ? money(now.expenses) : '—'}</p>
          {change(now.expenses, before.expenses, false)}
          {ready && now.unpaidExpenses > 0 ? (
            <p className="mt-1 text-xs text-pits-warning">
              {t('{{amount}} still to pay', { amount: money(now.unpaidExpenses) })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        {breakdown(t('Revenue Distribution'), now.incomeByCategory, now.income, 'bg-pits-positive')}
        {breakdown(t('Resource Distribution'), now.expensesByCategory, now.expenses, 'bg-pits-danger')}
      </div>

      <p className="text-xs text-pits-dim">
        {currencies.local !== currencies.reference
          ? `${t('Amounts in {{currency}}. Other currencies use the rate saved with each entry.', { currency: displayCode })} `
          : null}
        <Link href="/dashboard/movements" className="font-semibold text-pits-info hover:underline">
          {t('See every movement')}
        </Link>
      </p>
    </div>
  );
}
