import { getCaracasDate, getCaracasDateFromIso, getCaracasDayRange } from '@/lib/utils/date';

/**
 * Display / input value for renew date (YYYY-MM-DD in America/Caracas).
 * Prefers stored plan_period_start; else last_payment_date day shifted by month
 * based on solvency (keeps day-of-month, e.g. 27 — not the 1st).
 */
export function getRenewDateInputValue(profile: {
  plan_period_start?: string | null;
  last_payment_date?: string | null;
  is_solvent?: boolean;
}): string {
  if (profile.plan_period_start) {
    return getCaracasDateFromIso(profile.plan_period_start);
  }

  const anchor = profile.last_payment_date
    ? getCaracasDateFromIso(profile.last_payment_date)
    : getCaracasDate();

  const [yearStr, monthStr, dayStr] = anchor.split('-');
  let year = Number(yearStr);
  let month = Number(monthStr);
  const day = Number(dayStr);

  if (!profile.last_payment_date) {
    month += profile.is_solvent ? 1 : -1;
  } else if (profile.is_solvent) {
    // Paid: renew one month after last payment, same day
    month += 1;
  }
  // Unpaid with last payment: keep that calendar day as the renew/due date

  if (month > 12) {
    month = 1;
    year += 1;
  } else if (month < 1) {
    month = 12;
    year -= 1;
  }

  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.min(day, lastDayOfMonth);

  return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

/** Persist a calendar day as Caracas midnight (avoids UTC day shift). */
export function renewDateToIso(dateStr: string): string {
  return getCaracasDayRange(dateStr.slice(0, 10)).startUtc;
}

function addCalendarMonths(dateStr: string, months: number): string {
  const [yearStr, monthStr, dayStr] = dateStr.slice(0, 10).split('-');
  let year = Number(yearStr);
  let month = Number(monthStr) + months;
  const day = Number(dayStr);

  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }

  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.min(day, lastDayOfMonth);
  return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

/** Next monthly renew day (YYYY-MM-DD Caracas). Keeps billing day; always in the future. */
export function nextMonthlyRenewDate(currentIso?: string | null): string {
  const today = getCaracasDate();
  if (!currentIso) return addCalendarMonths(today, 1);

  let cursor = getCaracasDateFromIso(currentIso);
  if (cursor > today) return cursor;
  while (cursor <= today) {
    cursor = addCalendarMonths(cursor, 1);
  }
  return cursor;
}
