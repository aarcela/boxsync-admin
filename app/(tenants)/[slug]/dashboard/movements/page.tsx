'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Plus, Search, Trash2 } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import MovementForm from '@/components/MovementForm';
import { useMoneyCurrency } from '@/lib/hooks/useMoneyCurrency';
import { currencySymbol } from '@/lib/currency';
import { incomeService } from '@/lib/services/incomeService';
import { expenseService } from '@/lib/services/expenseService';
import { getGymDate } from '@/lib/utils/date';
import { capitalizeFirst, formatDate, formatMonthYear } from '@/lib/utils/format-date';
import type { TranslationKey } from '@/lib/translations';
import {
  inDisplayCurrency,
  loadMoneyMonth,
  monthTotals,
  shiftMonth,
  type Movement,
  type MovementKind,
  type MoneyMonth,
} from '@/lib/money/movements';

type Filter = 'all' | MovementKind;

const STATUS_TONE: Record<string, string> = {
  confirmed: 'bg-pits-positive-soft text-pits-positive border-pits-positive-edge',
  paid: 'bg-pits-positive-soft text-pits-positive border-pits-positive-edge',
  pending: 'bg-pits-warning-soft text-pits-warning border-pits-warning-edge',
  due: 'bg-pits-danger-soft text-pits-danger border-pits-danger-edge',
  cancelled: 'bg-pits-surface-muted text-pits-dim border-pits-edge',
};

export default function MovementsPage() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const { tenantId, timezone } = useTenant();
  const { code: displayCode, currencies } = useMoneyCurrency();
  const searchParams = useSearchParams();

  const [month, setMonth] = useState(() => getGymDate(new Date(), timezone).slice(0, 7));
  const [filter, setFilter] = useState<Filter>(() => {
    const type = searchParams.get('type');
    return type === 'in' || type === 'out' ? type : 'all';
  });
  const [query, setQuery] = useState('');
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ key: string; data: MoneyMonth | null } | null>(null);
  const [formKind, setFormKind] = useState<MovementKind | null>(null);
  const [toDelete, setToDelete] = useState<Movement | null>(null);

  const requestKey = `${month}|${version}|${tenantId}|${currencies.reference}|${timezone}`;
  useEffect(() => {
    let cancelled = false;
    loadMoneyMonth(month, tenantId, currencies.reference, timezone)
      .then((next) => {
        if (!cancelled) setResult({ key: requestKey, data: next });
      })
      .catch(() => {
        if (cancelled) return;
        toast(t('Failed to sync financial data'), 'error');
        setResult({ key: requestKey, data: null });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const data = result?.data ?? null;
  const loading = result?.key !== requestKey;
  const load = () => setVersion((v) => v + 1);

  const rate = data?.rate ?? 0;
  const symbol = currencySymbol(displayCode);
  const money = (value: number) =>
    `${value < 0 ? '−' : ''}${symbol}${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const methodLabel = (id?: string) => {
    if (!id) return '';
    return data?.methods.find((m) => m.id === id)?.label ?? id;
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.movements ?? []).filter((m) => {
      if (filter !== 'all' && m.kind !== filter) return false;
      if (!q) return true;
      return (
        m.description.toLowerCase().includes(q) ||
        t(m.category as TranslationKey).toLowerCase().includes(q) ||
        methodLabel(m.paymentMethod).toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filter, query, t]);

  const totals = useMemo(
    () => monthTotals(data?.movements ?? [], displayCode, currencies, rate),
    [data, displayCode, currencies, rate],
  );

  const changeExpenseStatus = async (m: Movement, status: 'pending' | 'paid' | 'due') => {
    try {
      await expenseService.updateExpenseStatus(m.id, status);
      toast(t('Status updated'), 'success');
      void load();
    } catch {
      toast(t('Failed to update status'), 'error');
    }
  };

  const confirmDelete = async () => {
    const m = toDelete;
    setToDelete(null);
    if (!m) return;
    try {
      if (m.source === 'expense') await expenseService.deleteExpense(m.id);
      else await incomeService.deleteIncome(m.id);
      toast(t('Record purged from ledger'), 'success');
      void load();
    } catch {
      toast(t('Purge sequence failed'), 'error');
    }
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{t('Movements')}</h1>
          <p className="page-subtitle">{t('Everything that came in and went out this month.')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 sm:flex-none items-center justify-between rounded-xl border border-pits-edge bg-pits-surface-elevated">
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
          <button
            type="button"
            onClick={() => setFormKind(filter === 'out' ? 'out' : 'in')}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-pits-primary text-pits-dark-text text-sm font-semibold shadow-sm hover:bg-pits-primary-dark"
          >
            <Plus size={16} />
            {t('Record')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('Money in'), value: totals.income, tone: 'text-pits-positive' },
          { label: t('Money out'), value: totals.expenses, tone: 'text-pits-danger' },
          {
            label: t('Result'),
            value: totals.result,
            tone: totals.result >= 0 ? 'text-pits-text' : 'text-pits-danger',
          },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-pits-edge bg-pits-surface-elevated p-4">
            <p className="text-xs font-semibold text-pits-dim">{card.label}</p>
            <p className={`mt-1 text-xl sm:text-2xl font-bold tabular-nums ${card.tone}`}>
              {loading && !data ? '—' : money(card.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="flex gap-1.5" role="group" aria-label={t('Filters')}>
          {([
            { value: 'all', label: t('All') },
            { value: 'in', label: t('Money in') },
            { value: 'out', label: t('Money out') },
          ] as const).map((chip) => (
            <button
              key={chip.value}
              type="button"
              aria-pressed={filter === chip.value}
              onClick={() => setFilter(chip.value)}
              className={`px-3 min-h-9 rounded-lg text-xs font-semibold border transition-colors ${
                filter === chip.value
                  ? 'bg-pits-text text-white border-pits-text'
                  : 'bg-pits-surface-elevated text-pits-text border-pits-edge hover:bg-pits-surface-muted'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Search by name, category or method…')}
            className="w-full min-h-9 pl-9 pr-3 bg-pits-surface-elevated border border-pits-edge rounded-lg text-sm text-pits-text outline-none focus:ring-2 focus:ring-pits-primary/40"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-pits-edge bg-pits-surface-elevated overflow-hidden">
        {loading && !data ? (
          <div className="divide-y divide-pits-edge" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-pits-surface-muted" />
                <div className="h-3 flex-1 max-w-[220px] rounded bg-pits-surface-muted" />
                <div className="ml-auto h-3 w-20 rounded bg-pits-surface-muted" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-medium text-pits-text">{t('Nothing recorded for this month.')}</p>
            <button
              type="button"
              onClick={() => setFormKind(filter === 'out' ? 'out' : 'in')}
              className="mt-3 text-sm font-semibold text-pits-info hover:underline"
            >
              {t('Record the first one')}
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-pits-edge">
            {visible.map((m) => {
              const value = inDisplayCurrency(m, displayCode, currencies, rate);
              const original = m.currency !== displayCode ? `${currencySymbol(m.currency)}${m.amount.toLocaleString()}` : '';
              const detail = [t(m.category as TranslationKey), methodLabel(m.paymentMethod)].filter(Boolean).join(' · ');
              return (
                <li key={`${m.source}-${m.id}`} className="flex items-start sm:items-center gap-3 px-4 py-3">
                  <span
                    className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${
                      m.kind === 'in' ? 'bg-pits-positive-soft text-pits-positive' : 'bg-pits-danger-soft text-pits-danger'
                    }`}
                    aria-hidden
                  >
                    {m.kind === 'in' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </span>
                  {/* Phone: description + amount, then status + actions. Wider: one row. */}
                  <div className="min-w-0 flex-1 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 sm:flex sm:items-center">
                    <div className="min-w-0 sm:flex-1 sm:order-1">
                      <p className="text-sm font-semibold text-pits-text line-clamp-2 sm:truncate">{m.description}</p>
                      <p className="text-xs text-pits-dim truncate">
                        {formatDate(m.date, lang)}
                        {detail ? ` · ${detail}` : ''}
                      </p>
                    </div>
                    <div className="text-right sm:w-28 shrink-0 sm:order-3">
                      <p className={`text-sm font-bold tabular-nums ${m.kind === 'in' ? 'text-pits-positive' : 'text-pits-text'}`}>
                        {m.kind === 'in' ? '+' : '−'}
                        {money(value)}
                      </p>
                      {original ? <p className="text-[11px] text-pits-dim tabular-nums">{original}</p> : null}
                    </div>
                    <div className="col-span-2 flex items-center justify-between gap-2 sm:contents">
                      {/* Expenses change status in place, so the dropdown is their badge. */}
                      {m.source === 'expense' ? (
                        <span className="sm:order-2" />
                      ) : (
                        <span
                          className={`sm:order-2 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                            STATUS_TONE[m.status] ?? STATUS_TONE.cancelled
                          }`}
                        >
                          {t(m.status as TranslationKey)}
                        </span>
                      )}
                      <div className="sm:order-4 flex items-center gap-1 shrink-0 sm:w-36 justify-end">
                        {m.source === 'membership' ? (
                          <Link href="/dashboard/financials" className="py-2 text-xs font-semibold text-pits-info hover:underline">
                            {t('Open in Payments')}
                          </Link>
                        ) : (
                          <>
                            {m.source === 'expense' ? (
                              <select
                                value={m.status}
                                onChange={(e) => void changeExpenseStatus(m, e.target.value as 'pending' | 'paid' | 'due')}
                                aria-label={t('Change Status')}
                                className="h-9 rounded-lg border border-pits-edge bg-pits-surface-muted px-2 text-xs font-semibold text-pits-text"
                              >
                                {(['paid', 'pending', 'due'] as const).map((s) => (
                                  <option key={s} value={s}>
                                    {t(s)}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setToDelete(m)}
                              aria-label={t('Delete')}
                              className="p-2.5 rounded-lg text-pits-dim hover:text-pits-danger hover:bg-pits-danger-soft"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {formKind ? (
        <MovementForm
          initialKind={formKind}
          exchangeRate={rate}
          paymentMethods={data?.methods ?? []}
          onClose={() => setFormKind(null)}
          onSaved={() => void load()}
        />
      ) : null}

      <ConfirmDialog
        isOpen={!!toDelete}
        title={t('Delete this movement?')}
        message={t('Delete "{{name}}"? This cannot be undone.', { name: toDelete?.description ?? '' })}
        confirmLabel={t('Delete')}
        variant="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
