import type { SupabaseClient } from '@supabase/supabase-js';
import { parseTenantCurrencyConfig } from '@/lib/currency';
import type { Tenant } from '@/lib/types/gym';
import {
  getCaracasDate,
  getCaracasDayRange,
  getCaracasMonthRange,
  getCaracasTimeLabel,
} from '@/lib/utils/date';

const MAX_CLASSES = 24;
const MAX_NAMES = 12;

type StatusRow = { status?: string | null };
type CoachRow = { full_name?: string | null } | { full_name?: string | null }[] | null;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function statusCounts(rows: StatusRow[] | null | undefined) {
  const counts = { booked: 0, attended: 0, no_show: 0 };
  for (const row of rows ?? []) {
    if (row.status === 'booked') counts.booked += 1;
    else if (row.status === 'attended') counts.attended += 1;
    else if (row.status === 'no_show') counts.no_show += 1;
  }
  return counts;
}

function coachName(coach: CoachRow): string | null {
  if (!coach) return null;
  const row = Array.isArray(coach) ? coach[0] : coach;
  const name = row?.full_name?.trim();
  return name || null;
}

function uniqueNames(values: Array<string | null | undefined>, cap = MAX_NAMES): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const value of values) {
    const name = value?.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
    if (names.length >= cap) break;
  }
  return names;
}

function toReferenceAmount(
  amount: number,
  currency: string | null | undefined,
  rate: number | null | undefined,
  reference: string
): number {
  if (!Number.isFinite(amount)) return 0;
  if (!currency || currency === reference) return amount;
  if (rate && rate > 0) return amount / rate;
  return 0;
}

export async function buildAskAiTenantSnapshot(
  tenantId: string,
  tenant: Tenant,
  client: SupabaseClient
): Promise<string> {
  const currencies = parseTenantCurrencyConfig(tenant.settings);
  const today = getCaracasDate();
  const yearMonth = today.slice(0, 7);
  const { startUtc: dayStart, endUtc: dayEnd } = getCaracasDayRange(today);
  const { startUtc: monthStart, endUtc: monthEnd, startDate, endDate } = getCaracasMonthRange(yearMonth);

  const [classesRes, membersRes, pendingRes, pendingCountRes, paymentsRes, incomesRes, expensesRes] =
    await Promise.all([
    client
      .from('classes')
      .select(
        'id, class_type, start_time, max_capacity, coach:profiles(full_name), bookings:bookings(status), guest_bookings:guest_bookings(status)'
      )
      .eq('tenant_id', tenantId)
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .order('start_time', { ascending: true }),
    client
      .from('profiles')
      .select('full_name, is_solvent')
      .eq('tenant_id', tenantId)
      .eq('role', 'member'),
    client
      .from('payments')
      .select('id, profiles(full_name)')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(MAX_NAMES),
    client
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),
    client
      .from('payments')
      .select('amount, currency, status, reference_currency_amount, exchange_rate_at_time')
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd),
    client
      .from('incomes')
      .select('amount, currency, status, exchange_rate_at_time')
      .eq('tenant_id', tenantId)
      .gte('income_date', startDate)
      .lte('income_date', endDate),
    client
      .from('expenses')
      .select('amount, currency, status, exchange_rate_at_time')
      .eq('tenant_id', tenantId)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate),
  ]);

  const failed = [
    classesRes.error,
    membersRes.error,
    pendingRes.error,
    pendingCountRes.error,
    paymentsRes.error,
    incomesRes.error,
    expensesRes.error,
  ].filter(Boolean);
  if (
    failed.length &&
    classesRes.error &&
    membersRes.error &&
    paymentsRes.error
  ) {
    throw new Error(failed[0]?.message || 'Could not load gym snapshot.');
  }

  const classes = (classesRes.data ?? []).slice(0, MAX_CLASSES).map((row) => {
    const members = statusCounts(row.bookings as StatusRow[] | undefined);
    const guests = statusCounts(row.guest_bookings as StatusRow[] | undefined);
    const occupancy = members.booked + members.attended + guests.booked + guests.attended;
    const capacity = Number(row.max_capacity) || 0;
    return {
      time: row.start_time ? getCaracasTimeLabel(row.start_time) : null,
      class_type: row.class_type,
      coach: coachName(row.coach as CoachRow),
      capacity,
      occupancy,
      fill_pct: capacity > 0 ? Math.round((occupancy / capacity) * 100) : 0,
      members_attended: members.attended,
      members_booked_not_checked_in: members.booked,
      members_no_show: members.no_show,
      guests_attended: guests.attended,
      guests_booked: guests.booked,
      guests_no_show: guests.no_show,
    };
  });

  const attendance = classes.reduce(
    (acc, cls) => {
      acc.members_attended += cls.members_attended;
      acc.guests_attended += cls.guests_attended;
      acc.members_booked_not_checked_in += cls.members_booked_not_checked_in;
      acc.members_no_show += cls.members_no_show;
      acc.guests_booked += cls.guests_booked;
      acc.guests_no_show += cls.guests_no_show;
      acc.capacity += cls.capacity;
      acc.occupancy += cls.occupancy;
      return acc;
    },
    {
      members_attended: 0,
      guests_attended: 0,
      members_booked_not_checked_in: 0,
      members_no_show: 0,
      guests_booked: 0,
      guests_no_show: 0,
      capacity: 0,
      occupancy: 0,
    }
  );

  const members = membersRes.data ?? [];
  const solvent = members.filter((row) => row.is_solvent).length;
  const notSolvent = members.length - solvent;
  const notSolventNames = uniqueNames(
    members.filter((row) => !row.is_solvent).map((row) => row.full_name)
  );

  let memberPaymentsApproved = 0;
  for (const payment of paymentsRes.data ?? []) {
    if (payment.status !== 'approved') continue;
    const refAmount =
      typeof payment.reference_currency_amount === 'number' &&
      Number.isFinite(payment.reference_currency_amount)
        ? payment.reference_currency_amount
        : toReferenceAmount(
            Number(payment.amount) || 0,
            payment.currency,
            payment.exchange_rate_at_time,
            currencies.reference
          );
    memberPaymentsApproved += refAmount;
  }

  let otherIncome = 0;
  for (const income of incomesRes.data ?? []) {
    if (income.status !== 'confirmed') continue;
    otherIncome += toReferenceAmount(
      Number(income.amount) || 0,
      income.currency,
      income.exchange_rate_at_time,
      currencies.reference
    );
  }

  let expenses = 0;
  for (const expense of expensesRes.data ?? []) {
    if (expense.status === 'pending') continue;
    expenses += toReferenceAmount(
      Number(expense.amount) || 0,
      expense.currency,
      expense.exchange_rate_at_time,
      currencies.reference
    );
  }

  const pendingNames = uniqueNames(
    (pendingRes.data ?? []).map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return profile?.full_name ?? null;
    })
  );

  const snapshot = {
    gym: tenant.name,
    timezone: 'America/Caracas',
    today,
    month: yearMonth,
    today_attendance: {
      classes: classes.length,
      people_attended: attendance.members_attended + attendance.guests_attended,
      members_attended: attendance.members_attended,
      guests_attended: attendance.guests_attended,
      members_booked_not_checked_in: attendance.members_booked_not_checked_in,
      members_no_show: attendance.members_no_show,
      guests_booked: attendance.guests_booked,
      guests_no_show: attendance.guests_no_show,
      avg_fill_pct:
        attendance.capacity > 0 ? Math.round((attendance.occupancy / attendance.capacity) * 100) : 0,
    },
    today_classes: classes,
    members: {
      total: members.length,
      solvent,
      not_solvent: notSolvent,
      not_solvent_names: notSolventNames,
      not_solvent_names_omitted: Math.max(0, notSolvent - notSolventNames.length),
    },
    pending_payment_proofs: {
      count: pendingCountRes.count ?? pendingNames.length,
      names: pendingNames,
    },
    month_money: {
      currency: currencies.reference,
      member_payments_approved: roundMoney(memberPaymentsApproved),
      other_income_confirmed: roundMoney(otherIncome),
      expenses: roundMoney(expenses),
      net: roundMoney(memberPaymentsApproved + otherIncome - expenses),
    },
  };

  return JSON.stringify(snapshot);
}
