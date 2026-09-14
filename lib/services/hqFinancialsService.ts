import type { SupabaseClient } from '@supabase/supabase-js';
import { getPlatformPlan, parsePlatformPlanId } from '../platform-plans';
import type {
  HqCategoryMix,
  HqFinancialOverview,
  HqFinancialPeriod,
  HqFinancialSeriesPoint,
  HqFinancialsPayload,
  HqLedgerExpense,
  HqLedgerIncome,
  HqLedgerPayment,
  HqMethodMix,
  HqTenantFinancialDetail,
  HqTenantFinancialRow,
  HqTenantPayStatus,
} from '../types/gym';
import { tenantService } from './tenantService';

const PAGE = 1000;

export type HqPeriodRange = {
  period: HqFinancialPeriod;
  startYmd: string;
  endYmd: string;
  seriesStartYmd: string;
};

type PaymentRow = {
  id: string;
  tenant_id: string;
  amount: number | string;
  currency: string | null;
  status: 'pending' | 'approved' | 'rejected';
  method: string | null;
  period_start: string;
  notes: string | null;
  created_at: string;
};

type IncomeRow = {
  id: string;
  description: string;
  category: string;
  amount: number | string;
  currency: string | null;
  income_date: string;
  status: string;
  notes: string | null;
};

type ExpenseRow = {
  id: string;
  description: string;
  category: string;
  amount: number | string;
  currency: string | null;
  expense_date: string;
  status: string;
  notes: string | null;
};

function caracasYmd(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function startOfWeekMonday(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = dt.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt.toISOString().slice(0, 10);
}

function startOfMonth(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

function shiftMonths(ymd: string, delta: number): string {
  const [y, m] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return dt.toISOString().slice(0, 7);
}

function num(value: number | string | null | undefined): number {
  return Number(value) || 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function inRange(ymd: string, start: string, end: string): boolean {
  return ymd >= start && ymd <= end;
}

function emptySeries(startYmd: string, endYmd: string): HqFinancialSeriesPoint[] {
  const points: HqFinancialSeriesPoint[] = [];
  let cursor = startYmd.slice(0, 7);
  const last = endYmd.slice(0, 7);
  while (cursor <= last) {
    points.push({
      month: cursor,
      collectedUsd: 0,
      otherIncomeUsd: 0,
      incomeUsd: 0,
      expensesUsd: 0,
      netUsd: 0,
    });
    cursor = shiftMonths(`${cursor}-01`, 1);
  }
  return points;
}

async function fetchPaged<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

export function resolveHqPeriodRange(opts: {
  period?: string | null;
  start?: string | null;
  end?: string | null;
}): HqPeriodRange {
  const today = caracasYmd();
  const period: HqFinancialPeriod =
    opts.period === 'today' || opts.period === 'week' || opts.period === 'custom' || opts.period === 'month'
      ? opts.period
      : 'month';

  let startYmd = startOfMonth(today);
  let endYmd = today;

  if (period === 'today') {
    startYmd = today;
    endYmd = today;
  } else if (period === 'week') {
    startYmd = startOfWeekMonday(today);
    endYmd = today;
  } else if (period === 'custom' && opts.start && opts.end) {
    startYmd = opts.start.slice(0, 10);
    endYmd = opts.end.slice(0, 10);
    if (startYmd > endYmd) {
      const swap = startYmd;
      startYmd = endYmd;
      endYmd = swap;
    }
  }

  return {
    period,
    startYmd,
    endYmd,
    seriesStartYmd: `${shiftMonths(endYmd, -5)}-01`,
  };
}

function mapPayment(row: PaymentRow, tenantName: string): HqLedgerPayment {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    tenant_name: tenantName,
    amount: round2(num(row.amount)),
    currency: row.currency || 'USD',
    status: row.status,
    method: row.method || '—',
    period_start: row.period_start,
    notes: row.notes,
    created_at: row.created_at,
  };
}

export const hqFinancialsService = {
  async getOverview(client: SupabaseClient, range: HqPeriodRange): Promise<HqFinancialsPayload> {
    const tenants = await tenantService.listTenants(client);
    const names = new Map(tenants.map((row) => [row.id, row.name]));

    const [payments, incomes, expenses] = await Promise.all([
      fetchPaged<PaymentRow>((from, to) =>
        client
          .from('platform_payments')
          .select('id, tenant_id, amount, currency, status, method, period_start, notes, created_at')
          .gte('period_start', range.seriesStartYmd)
          .lte('period_start', range.endYmd)
          .order('period_start', { ascending: false })
          .range(from, to)
      ),
      fetchPaged<IncomeRow>((from, to) =>
        client
          .from('platform_incomes')
          .select('id, description, category, amount, currency, income_date, status, notes')
          .gte('income_date', range.seriesStartYmd)
          .lte('income_date', range.endYmd)
          .order('income_date', { ascending: false })
          .range(from, to)
      ),
      fetchPaged<ExpenseRow>((from, to) =>
        client
          .from('platform_expenses')
          .select('id, description, category, amount, currency, expense_date, status, notes')
          .gte('expense_date', range.seriesStartYmd)
          .lte('expense_date', range.endYmd)
          .order('expense_date', { ascending: false })
          .range(from, to)
      ),
    ]);

    const series = emptySeries(range.seriesStartYmd, range.endYmd);
    const seriesByMonth = new Map(series.map((point) => [point.month, point]));
    const methodMix = new Map<string, HqMethodMix>();
    const expenseMix = new Map<string, HqCategoryMix>();
    const collectedByTenant = new Map<string, number>();
    const pendingByTenant = new Map<string, number>();
    const lastPaidAt = new Map<string, string>();
    const paymentCount = new Map<string, number>();

    let collectedUsd = 0;
    let otherIncomeUsd = 0;
    let expensesUsd = 0;
    let pendingCount = 0;

    const periodPayments: HqLedgerPayment[] = [];
    const periodIncomes: HqLedgerIncome[] = [];
    const periodExpenses: HqLedgerExpense[] = [];

    for (const row of payments) {
      const amount = num(row.amount);
      const month = row.period_start.slice(0, 7);
      const point = seriesByMonth.get(month);
      const inPeriod = inRange(row.period_start, range.startYmd, range.endYmd);

      if (row.status === 'approved') {
        if (point) {
          point.collectedUsd += amount;
          point.incomeUsd += amount;
        }
        if (inPeriod) {
          collectedUsd += amount;
          collectedByTenant.set(row.tenant_id, (collectedByTenant.get(row.tenant_id) ?? 0) + amount);
          const label = row.method?.trim() || '—';
          const mix = methodMix.get(label) ?? { label, usd: 0, count: 0 };
          mix.usd += amount;
          mix.count += 1;
          methodMix.set(label, mix);
        }
        const prev = lastPaidAt.get(row.tenant_id);
        if (!prev || row.created_at > prev) lastPaidAt.set(row.tenant_id, row.created_at);
      } else if (row.status === 'pending' && inPeriod) {
        pendingCount += 1;
        pendingByTenant.set(row.tenant_id, (pendingByTenant.get(row.tenant_id) ?? 0) + 1);
      }

      if (inPeriod) {
        paymentCount.set(row.tenant_id, (paymentCount.get(row.tenant_id) ?? 0) + 1);
        periodPayments.push(mapPayment(row, names.get(row.tenant_id) ?? '—'));
      }
    }

    for (const row of incomes) {
      if (row.status !== 'confirmed') continue;
      const amount = num(row.amount);
      const month = row.income_date.slice(0, 7);
      const point = seriesByMonth.get(month);
      if (point) {
        point.otherIncomeUsd += amount;
        point.incomeUsd += amount;
      }
      if (inRange(row.income_date, range.startYmd, range.endYmd)) {
        otherIncomeUsd += amount;
        periodIncomes.push({
          id: row.id,
          description: row.description,
          category: row.category,
          amount: round2(amount),
          currency: row.currency || 'USD',
          income_date: row.income_date,
          status: row.status,
          notes: row.notes,
        });
      }
    }

    for (const row of expenses) {
      const amount = num(row.amount);
      const month = row.expense_date.slice(0, 7);
      const point = seriesByMonth.get(month);
      if (point) point.expensesUsd += amount;
      if (inRange(row.expense_date, range.startYmd, range.endYmd)) {
        expensesUsd += amount;
        const cat = row.category || 'Other';
        const mix = expenseMix.get(cat) ?? { category: cat, usd: 0, count: 0 };
        mix.usd += amount;
        mix.count += 1;
        expenseMix.set(cat, mix);
        periodExpenses.push({
          id: row.id,
          description: row.description,
          category: row.category,
          amount: round2(amount),
          currency: row.currency || 'USD',
          expense_date: row.expense_date,
          status: row.status,
          notes: row.notes,
        });
      }
    }

    for (const point of series) {
      point.collectedUsd = round2(point.collectedUsd);
      point.otherIncomeUsd = round2(point.otherIncomeUsd);
      point.incomeUsd = round2(point.incomeUsd);
      point.expensesUsd = round2(point.expensesUsd);
      point.netUsd = round2(point.incomeUsd - point.expensesUsd);
    }

    let expectedMrrUsd = 0;
    let unpaidCount = 0;
    let unpaidUsd = 0;
    let trialCount = 0;
    let paidBoxCount = 0;

    const tenantRows: HqTenantFinancialRow[] = tenants.map((tenant) => {
      const plan = parsePlatformPlanId(tenant.platform_plan);
      const monthlyFeeUsd = getPlatformPlan(plan).priceUsd;
      const collected = collectedByTenant.get(tenant.id) ?? 0;
      const pending = pendingByTenant.get(tenant.id) ?? 0;
      let payStatus: HqTenantPayStatus = 'unpaid';
      if (plan === 'trial' || monthlyFeeUsd === 0) {
        payStatus = 'trial';
        trialCount += 1;
      } else if (collected >= monthlyFeeUsd) {
        payStatus = 'paid';
        paidBoxCount += 1;
      } else if (pending > 0) {
        payStatus = 'pending';
      } else {
        unpaidCount += 1;
        unpaidUsd += monthlyFeeUsd;
      }
      if (tenant.is_active !== false) expectedMrrUsd += monthlyFeeUsd;

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        platform_plan: plan,
        isActive: tenant.is_active !== false,
        monthlyFeeUsd,
        collectedUsd: round2(collected),
        payStatus,
        lastPaidAt: lastPaidAt.get(tenant.id) ?? null,
        paymentCount: paymentCount.get(tenant.id) ?? 0,
      };
    });

    tenantRows.sort((a, b) => b.monthlyFeeUsd - a.monthlyFeeUsd || a.name.localeCompare(b.name));

    const incomeUsd = collectedUsd + otherIncomeUsd;
    const netUsd = incomeUsd - expensesUsd;
    const overview: HqFinancialOverview = {
      expectedMrrUsd: round2(expectedMrrUsd),
      collectedUsd: round2(collectedUsd),
      otherIncomeUsd: round2(otherIncomeUsd),
      incomeUsd: round2(incomeUsd),
      expensesUsd: round2(expensesUsd),
      netUsd: round2(netUsd),
      marginPct: incomeUsd > 0 ? Math.round((netUsd / incomeUsd) * 100) : 0,
      unpaidCount,
      unpaidUsd: round2(unpaidUsd),
      pendingCount,
      trialCount,
      paidBoxCount,
      boxCount: tenants.length,
    };

    return {
      period: range.period,
      start: range.startYmd,
      end: range.endYmd,
      overview,
      series,
      methodMix: [...methodMix.values()].map((row) => ({ ...row, usd: round2(row.usd) })).sort((a, b) => b.usd - a.usd),
      expenseMix: [...expenseMix.values()].map((row) => ({ ...row, usd: round2(row.usd) })).sort((a, b) => b.usd - a.usd),
      tenants: tenantRows,
      payments: periodPayments,
      incomes: periodIncomes,
      expenses: periodExpenses,
    };
  },

  async getTenantDetail(
    client: SupabaseClient,
    tenantId: string,
    range: HqPeriodRange
  ): Promise<HqTenantFinancialDetail | null> {
    const tenant = await tenantService.getTenantById(tenantId, client);
    if (!tenant) return null;
    const plan = parsePlatformPlanId(tenant.platform_plan);
    const monthlyFeeUsd = getPlatformPlan(plan).priceUsd;

    const payments = await fetchPaged<PaymentRow>((from, to) =>
      client
        .from('platform_payments')
        .select('id, tenant_id, amount, currency, status, method, period_start, notes, created_at')
        .eq('tenant_id', tenantId)
        .gte('period_start', range.seriesStartYmd)
        .lte('period_start', range.endYmd)
        .order('period_start', { ascending: false })
        .range(from, to)
    );

    const series = emptySeries(range.seriesStartYmd, range.endYmd);
    const seriesByMonth = new Map(series.map((point) => [point.month, point]));
    let collectedUsd = 0;
    let pending = 0;
    let lastPaidAt: string | null = null;
    const periodPayments: HqLedgerPayment[] = [];

    for (const row of payments) {
      const amount = num(row.amount);
      const point = seriesByMonth.get(row.period_start.slice(0, 7));
      if (row.status === 'approved') {
        if (point) {
          point.collectedUsd += amount;
          point.incomeUsd += amount;
          point.netUsd = point.incomeUsd;
        }
        if (!lastPaidAt || row.created_at > lastPaidAt) lastPaidAt = row.created_at;
        if (inRange(row.period_start, range.startYmd, range.endYmd)) collectedUsd += amount;
      } else if (row.status === 'pending' && inRange(row.period_start, range.startYmd, range.endYmd)) {
        pending += 1;
      }
      if (inRange(row.period_start, range.startYmd, range.endYmd)) {
        periodPayments.push(mapPayment(row, tenant.name));
      }
    }

    for (const point of series) {
      point.collectedUsd = round2(point.collectedUsd);
      point.incomeUsd = round2(point.incomeUsd);
      point.netUsd = round2(point.netUsd);
    }

    let payStatus: HqTenantPayStatus = 'unpaid';
    if (plan === 'trial' || monthlyFeeUsd === 0) payStatus = 'trial';
    else if (collectedUsd >= monthlyFeeUsd) payStatus = 'paid';
    else if (pending > 0) payStatus = 'pending';

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        platform_plan: plan,
        isActive: tenant.is_active !== false,
        monthlyFeeUsd,
      },
      period: range.period,
      start: range.startYmd,
      end: range.endYmd,
      collectedUsd: round2(collectedUsd),
      payStatus,
      lastPaidAt,
      series,
      payments: periodPayments,
    };
  },

  async createTenantPayment(
    client: SupabaseClient,
    input: {
      tenant_id: string;
      amount: number;
      method?: string;
      period_start: string;
      status?: 'pending' | 'approved' | 'rejected';
      notes?: string;
      created_by?: string;
    }
  ): Promise<HqLedgerPayment> {
    const tenant = await tenantService.getTenantById(input.tenant_id, client);
    if (!tenant) throw new Error('Tenant not found.');
    const { data, error } = await client
      .from('platform_payments')
      .insert([
        {
          tenant_id: input.tenant_id,
          amount: input.amount,
          currency: 'USD',
          status: input.status ?? 'approved',
          method: input.method?.trim() || null,
          period_start: input.period_start,
          notes: input.notes?.trim() || null,
          created_by: input.created_by ?? null,
        },
      ])
      .select('id, tenant_id, amount, currency, status, method, period_start, notes, created_at')
      .single();
    if (error) throw new Error(error.message);
    return mapPayment(data as PaymentRow, tenant.name);
  },

  async createIncome(
    client: SupabaseClient,
    input: {
      description: string;
      category: string;
      amount: number;
      income_date: string;
      status?: string;
      notes?: string;
      created_by?: string;
    }
  ): Promise<HqLedgerIncome> {
    const { data, error } = await client
      .from('platform_incomes')
      .insert([
        {
          description: input.description.trim(),
          category: input.category,
          amount: input.amount,
          currency: 'USD',
          income_date: input.income_date,
          status: input.status ?? 'confirmed',
          notes: input.notes?.trim() || null,
          created_by: input.created_by ?? null,
        },
      ])
      .select('id, description, category, amount, currency, income_date, status, notes')
      .single();
    if (error) throw new Error(error.message);
    const row = data as IncomeRow;
    return {
      id: row.id,
      description: row.description,
      category: row.category,
      amount: num(row.amount),
      currency: row.currency || 'USD',
      income_date: row.income_date,
      status: row.status,
      notes: row.notes,
    };
  },

  async createExpense(
    client: SupabaseClient,
    input: {
      description: string;
      category: string;
      amount: number;
      expense_date: string;
      status?: string;
      notes?: string;
      created_by?: string;
    }
  ): Promise<HqLedgerExpense> {
    const { data, error } = await client
      .from('platform_expenses')
      .insert([
        {
          description: input.description.trim(),
          category: input.category,
          amount: input.amount,
          currency: 'USD',
          expense_date: input.expense_date,
          status: input.status ?? 'paid',
          notes: input.notes?.trim() || null,
          created_by: input.created_by ?? null,
        },
      ])
      .select('id, description, category, amount, currency, expense_date, status, notes')
      .single();
    if (error) throw new Error(error.message);
    const row = data as ExpenseRow;
    return {
      id: row.id,
      description: row.description,
      category: row.category,
      amount: num(row.amount),
      currency: row.currency || 'USD',
      expense_date: row.expense_date,
      status: row.status,
      notes: row.notes,
    };
  },

  async deleteEntry(
    client: SupabaseClient,
    kind: 'payment' | 'income' | 'expense',
    id: string
  ): Promise<void> {
    const table =
      kind === 'payment' ? 'platform_payments' : kind === 'income' ? 'platform_incomes' : 'platform_expenses';
    const { error } = await client.from(table).delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
