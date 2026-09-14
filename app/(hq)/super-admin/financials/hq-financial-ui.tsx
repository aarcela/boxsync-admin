'use client';

import type { HqCategoryMix, HqFinancialPeriod, HqFinancialSeriesPoint, HqMethodMix } from '@/lib/types/gym';
import type { TranslationKey } from '@/lib/translations';

export function formatUsd(n: number) {
  const abs = Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  return `${n < 0 ? '-' : ''}$${abs}`;
}

export function monthLabel(ym: string, lang: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(lang === 'es' ? 'es' : 'en', {
    month: 'short',
  });
}

export function toDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function KpiCard({
  label,
  value,
  hint,
  warn,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
  tone?: 'success' | 'danger' | 'muted';
}) {
  const valueClass =
    warn || tone === 'danger'
      ? 'text-red-700'
      : tone === 'success'
        ? 'text-pits-success'
        : 'text-pits-ink';
  return (
    <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-pits-ink-muted">{label}</p>
      <p className={`text-2xl font-black italic tracking-tighter mt-1 ${valueClass}`}>{value}</p>
      {hint && (
        <p className="text-[10px] font-bold uppercase tracking-wider text-pits-ink-muted mt-1">
          {hint}
        </p>
      )}
    </div>
  );
}

export function PeriodFilters({
  period,
  setPeriod,
  customStart,
  customEnd,
  setCustomStart,
  setCustomEnd,
  labels,
}: {
  period: HqFinancialPeriod;
  setPeriod: (p: HqFinancialPeriod) => void;
  customStart: string;
  customEnd: string;
  setCustomStart: (v: string) => void;
  setCustomEnd: (v: string) => void;
  labels: { today: string; week: string; month: string; custom: string; from: string; to: string };
}) {
  const options: { id: HqFinancialPeriod; label: string }[] = [
    { id: 'today', label: labels.today },
    { id: 'week', label: labels.week },
    { id: 'month', label: labels.month },
    { id: 'custom', label: labels.custom },
  ];
  return (
    <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
      <div className="flex flex-wrap gap-1.5 bg-pits-surface-muted p-1 rounded-xl">
        {options.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPeriod(id)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
              period === id
                ? 'bg-pits-primary text-pits-dark-text'
                : 'text-pits-ink-muted hover:text-pits-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-black uppercase text-pits-ink-muted">{labels.from}</label>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="p-2 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm text-pits-ink"
          />
          <label className="text-[10px] font-black uppercase text-pits-ink-muted">{labels.to}</label>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="p-2 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm text-pits-ink"
          />
        </div>
      )}
    </div>
  );
}

export function IncomeExpenseChart({
  series,
  lang,
  incomeLabel,
  expenseLabel,
}: {
  series: HqFinancialSeriesPoint[];
  lang: string;
  incomeLabel: string;
  expenseLabel: string;
}) {
  const max = Math.max(1, ...series.map((p) => Math.max(p.incomeUsd, p.expensesUsd)));
  return (
    <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-pits-ink">
          {incomeLabel} / {expenseLabel}
        </h3>
        <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-wider text-pits-ink-muted">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-pits-success" /> {incomeLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> {expenseLabel}
          </span>
        </div>
      </div>
      <div className="flex items-end gap-2 h-40">
        {series.map((point) => (
          <div key={point.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="w-full flex items-end justify-center gap-0.5 h-32">
              <div
                className="flex-1 max-w-4 rounded-t bg-pits-success/80"
                style={{ height: `${Math.max(4, (point.incomeUsd / max) * 100)}%` }}
                title={formatUsd(point.incomeUsd)}
              />
              <div
                className="flex-1 max-w-4 rounded-t bg-red-500/80"
                style={{ height: `${Math.max(4, (point.expensesUsd / max) * 100)}%` }}
                title={formatUsd(point.expensesUsd)}
              />
            </div>
            <span className="text-[9px] font-bold uppercase text-pits-ink-muted truncate w-full text-center">
              {monthLabel(point.month, lang)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MixBars({
  title,
  items,
  empty,
  labelOf,
}: {
  title: string;
  items: { key: string; usd: number }[];
  empty: string;
  labelOf?: (key: string) => string;
}) {
  const max = Math.max(1, ...items.map((item) => item.usd));
  return (
    <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl p-5">
      <h3 className="text-xs font-black uppercase tracking-widest text-pits-ink mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-pits-ink-muted">{empty}</p>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 8).map((item) => (
            <div key={item.key} className="space-y-1">
              <div className="flex justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wide text-pits-ink truncate">
                  {labelOf ? labelOf(item.key) : item.key}
                </span>
                <span className="text-[10px] font-black text-pits-ink">{formatUsd(item.usd)}</span>
              </div>
              <div className="h-1.5 w-full bg-pits-surface-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-pits-primary"
                  style={{ width: `${(item.usd / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function methodMixItems(rows: HqMethodMix[]) {
  return rows.map((row) => ({ key: row.label, usd: row.usd }));
}

export function categoryMixItems(rows: HqCategoryMix[]) {
  return rows.map((row) => ({ key: row.category, usd: row.usd }));
}

const INCOME_KEYS = new Set([
  'merchandise_sales',
  'supplement_sales',
  'food_beverage_sales',
  'workshops_seminars',
  'events_competitions',
  'space_rental',
  'sponsorships',
  'income_adjustments',
  'other_income',
  'services',
]);

const EXPENSE_KEYS = new Set([
  'Staff',
  'Rent',
  'Utilities',
  'Maintenance',
  'Services',
  'Marketing',
  'Taxes',
  'Other',
  'Hosting',
  'Tools',
  'Legal',
  'Travel',
]);

const STATUS_KEYS = new Set(['pending', 'paid', 'due', 'confirmed', 'cancelled']);

export function ledgerLabel(
  value: string,
  t: (key: TranslationKey) => string
): string {
  if (value === 'approved') return t('Approved');
  if (value === 'rejected') return t('Rejected');
  if (INCOME_KEYS.has(value) || EXPENSE_KEYS.has(value) || STATUS_KEYS.has(value)) {
    return t(value as TranslationKey);
  }
  return value;
}
