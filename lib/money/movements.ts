/**
 * One shape for every money movement in a month: membership payments, manual income and
 * expenses. Used by Money → Movements (list) and Money → This month (totals).
 */
import { financialService } from '@/lib/services/financialService';
import { incomeService } from '@/lib/services/incomeService';
import { expenseService } from '@/lib/services/expenseService';
import { isLocalCurrency, type TenantCurrencyConfig } from '@/lib/currency';
import type { ExpenseRecord, IncomeRecord, PaymentMethod } from '@/lib/types/gym';
import { getGymDateFromIso } from '@/lib/utils/date';
import { DEFAULT_GYM_TIMEZONE } from '@/lib/gym-timezone';

export type MovementKind = 'in' | 'out';
export type MovementTone = 'positive' | 'warning' | 'danger' | 'neutral';

export type Movement = {
  /** Row id in its own table (`payment:<id>` for membership payments). */
  id: string;
  kind: MovementKind;
  source: 'membership' | 'income' | 'expense';
  date: string; // YYYY-MM-DD
  createdAt: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  /** Rate stored with the row (local per reference); falls back to the current rate. */
  rate: number;
  status: string;
  /** Counts toward totals: approved/confirmed income, any non-cancelled expense. */
  counts: boolean;
  paymentMethod?: string;
};

export type MoneyMonth = {
  movements: Movement[];
  rate: number;
  methods: PaymentMethod[];
};

/** First and last calendar day of a YYYY-MM month. */
export function monthBounds(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${yearMonth}-01`, end: `${yearMonth}-${String(last).padStart(2, '0')}` };
}

export function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function fromIncome(row: IncomeRecord, fallbackRate: number, tz: string): Movement {
  const membership = row.source === 'membership_payment';
  return {
    id: row.id,
    kind: 'in',
    source: membership ? 'membership' : 'income',
    // Membership payments only have a timestamp: use the gym's calendar day, not UTC.
    date: membership ? getGymDateFromIso(row.created_at, tz) : row.income_date.slice(0, 10),
    createdAt: row.created_at,
    description: row.description,
    category: row.category,
    amount: Number(row.amount) || 0,
    currency: row.currency,
    rate: Number(row.exchange_rate_at_time) > 0 ? Number(row.exchange_rate_at_time) : fallbackRate,
    status: row.status,
    counts: row.status === 'confirmed',
    paymentMethod: row.payment_method,
  };
}

function fromExpense(row: ExpenseRecord, fallbackRate: number): Movement {
  return {
    id: row.id,
    kind: 'out',
    source: 'expense',
    date: row.expense_date.slice(0, 10),
    createdAt: row.created_at,
    description: row.description,
    category: row.category,
    amount: Number(row.amount) || 0,
    currency: row.currency,
    rate: Number(row.exchange_rate_at_time) > 0 ? Number(row.exchange_rate_at_time) : fallbackRate,
    status: row.status,
    counts: true,
    paymentMethod: row.payment_method,
  };
}

export async function loadMoneyMonth(
  yearMonth: string,
  tenantId: string | null,
  referenceCurrency: string,
  tz: string = DEFAULT_GYM_TIMEZONE,
): Promise<MoneyMonth> {
  const { start, end } = monthBounds(yearMonth);
  const [rate, methods] = await Promise.all([
    tenantId
      ? financialService.getEffectiveExchangeRate(tenantId, referenceCurrency)
      : financialService.getReferenceExchangeRate(referenceCurrency),
    financialService.getPaymentMethods(),
  ]);
  const [incomes, expenses] = await Promise.all([
    incomeService.getLedgerIncomes(start, end, rate),
    expenseService.getExpenses(start, end),
  ]);
  const movements = [
    ...incomes.map((row) => fromIncome(row, rate, tz)),
    ...expenses.map((row) => fromExpense(row, rate)),
  ].sort((a, b) => (a.date !== b.date ? b.date.localeCompare(a.date) : b.createdAt.localeCompare(a.createdAt)));
  return { movements, rate, methods };
}

/** Amount converted to the currency the Money pages are showing. */
export function inDisplayCurrency(
  m: Pick<Movement, 'amount' | 'currency' | 'rate'>,
  displayCode: string,
  currencies: TenantCurrencyConfig,
  currentRate: number,
): number {
  const rate = m.rate > 0 ? m.rate : currentRate;
  const local = isLocalCurrency(m.currency, currencies);
  const showLocal = displayCode === currencies.local && currencies.local !== currencies.reference;
  if (local === showLocal) return m.amount;
  if (!(rate > 0)) return 0;
  return showLocal ? m.amount * rate : m.amount / rate;
}

export type MonthTotals = {
  income: number;
  expenses: number;
  result: number;
  unpaidExpenses: number;
  incomeByCategory: { category: string; amount: number }[];
  expensesByCategory: { category: string; amount: number }[];
};

export function monthTotals(
  movements: Movement[],
  displayCode: string,
  currencies: TenantCurrencyConfig,
  rate: number,
): MonthTotals {
  let income = 0;
  let expenses = 0;
  let unpaidExpenses = 0;
  const inCat = new Map<string, number>();
  const outCat = new Map<string, number>();
  for (const m of movements) {
    if (!m.counts) continue;
    const value = inDisplayCurrency(m, displayCode, currencies, rate);
    if (m.kind === 'in') {
      income += value;
      inCat.set(m.category, (inCat.get(m.category) ?? 0) + value);
    } else {
      expenses += value;
      outCat.set(m.category, (outCat.get(m.category) ?? 0) + value);
      if (m.status !== 'paid') unpaidExpenses += value;
    }
  }
  const sorted = (map: Map<string, number>) =>
    Array.from(map, ([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  return {
    income,
    expenses,
    result: income - expenses,
    unpaidExpenses,
    incomeByCategory: sorted(inCat),
    expensesByCategory: sorted(outCat),
  };
}
