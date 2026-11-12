/**
 * Gym-local calendar helpers. Every function takes the gym's IANA timezone (from
 * `useTenant().timezone` / `parseGymTimezone(settings)`); it defaults to Caracas so older
 * callers keep their behaviour. Offsets are computed per date, so daylight saving is handled.
 *
 * Day strings are `YYYY-MM-DD` in the gym's timezone; ranges are UTC ISO strings for Supabase.
 */
import { DEFAULT_GYM_TIMEZONE } from '@/lib/gym-timezone';

const pad = (n: number) => String(n).padStart(2, '0');

function zonedParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** Minutes the zone is ahead of UTC at `date` (e.g. Caracas → -240). */
function offsetMinutes(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Wall-clock time in the gym's zone → the real instant. */
export function gymDateTimeToUtc(
  dateStr: string,
  timeStr = '00:00',
  tz: string = DEFAULT_GYM_TIMEZONE,
): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const [hh, mm, ss] = timeStr.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0, ss || 0);
  const first = guess - offsetMinutes(new Date(guess), tz) * 60000;
  const second = guess - offsetMinutes(new Date(first), tz) * 60000;
  return new Date(second);
}

/** Today (or `date`) as YYYY-MM-DD in the gym's zone. */
export const getGymDate = (date: Date = new Date(), tz: string = DEFAULT_GYM_TIMEZONE): string => {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
};

export const getGymDateFromIso = (iso: string, tz: string = DEFAULT_GYM_TIMEZONE): string =>
  getGymDate(new Date(iso), tz);

/** UTC range covering a whole gym-local day. */
export const getGymDayRange = (dateStr: string, tz: string = DEFAULT_GYM_TIMEZONE) => {
  const start = gymDateTimeToUtc(dateStr, '00:00:00', tz);
  const nextDay = gymDateTimeToUtc(addDaysToDateStr(dateStr, 1), '00:00:00', tz);
  return {
    startUtc: start.toISOString(),
    endUtc: new Date(nextDay.getTime() - 1000).toISOString(),
  };
};

/** Pure calendar arithmetic on YYYY-MM-DD strings (no timezone involved). */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** 0 = Sunday … 6 = Saturday for a calendar day string. */
export function weekdayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Mon–Sun week containing anchorDate. */
export const getGymWeekRange = (anchorDate: string, tz: string = DEFAULT_GYM_TIMEZONE) => {
  const weekday = weekdayIndex(anchorDate);
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  const monday = addDaysToDateStr(anchorDate, -daysFromMonday);
  const sunday = addDaysToDateStr(monday, 6);
  const { startUtc } = getGymDayRange(monday, tz);
  const { endUtc } = getGymDayRange(sunday, tz);
  return { startUtc, endUtc, startDate: monday, endDate: sunday };
};

export const getGymWeekDays = (anchorDate: string): string[] => {
  const weekday = weekdayIndex(anchorDate);
  const monday = addDaysToDateStr(anchorDate, -(weekday === 0 ? 6 : weekday - 1));
  return Array.from({ length: 7 }, (_, i) => addDaysToDateStr(monday, i));
};

/** @param yearMonth YYYY-MM */
export const getGymMonthRange = (yearMonth: string, tz: string = DEFAULT_GYM_TIMEZONE) => {
  const [year, month] = yearMonth.split('-').map(Number);
  const startDate = `${yearMonth}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDate = `${yearMonth}-${pad(lastDay)}`;
  const { startUtc } = getGymDayRange(startDate, tz);
  const { endUtc } = getGymDayRange(endDate, tz);
  return { startUtc, endUtc, startDate, endDate };
};

export const getGymCustomRange = (start: string, end: string, tz: string = DEFAULT_GYM_TIMEZONE) => {
  if (start > end) throw new Error('Invalid date range');
  const { startUtc } = getGymDayRange(start, tz);
  const { endUtc } = getGymDayRange(end, tz);
  return { startUtc, endUtc, startDate: start, endDate: end };
};

/** Calendar day strings from start to end inclusive. */
export const getGymDateSpan = (start: string, end: string): string[] => {
  const days: string[] = [];
  let current = start;
  while (current <= end) {
    days.push(current);
    current = addDaysToDateStr(current, 1);
  }
  return days;
};

/** "HH:mm" (24h) in the gym's zone — also the value format for <input type="time">. */
export const getGymTimeLabel = (iso: string, tz: string = DEFAULT_GYM_TIMEZONE): string => {
  const p = zonedParts(new Date(iso), tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
};

export const getGymHourMinute = (iso: string, tz: string = DEFAULT_GYM_TIMEZONE) => {
  const p = zonedParts(new Date(iso), tz);
  return { hour: p.hour, minute: p.minute };
};

export const getGymMinutesSince = (
  iso: string,
  hourStart: number,
  tz: string = DEFAULT_GYM_TIMEZONE,
): number => {
  const { hour, minute } = getGymHourMinute(iso, tz);
  return hour * 60 + minute - hourStart * 60;
};

/** Format a gym-local calendar day (noon anchor avoids edge shifts). */
export const formatGymDay = (
  dateStr: string,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-US',
  tz: string = DEFAULT_GYM_TIMEZONE,
): string =>
  gymDateTimeToUtc(dateStr, '12:00', tz).toLocaleDateString(locale, { ...options, timeZone: tz });

/* ------------------------------------------------------------------------------------------ */
/* Caracas-named aliases: kept for server code (push, AI snapshot, payroll email, HQ) that    */
/* does not know the gym's timezone yet. New code should call the getGym* versions.          */
/* ------------------------------------------------------------------------------------------ */

/** @deprecated use getGymDate(date, tz) */
export const getCaracasDate = (date: Date = new Date()) => getGymDate(date);
/** @deprecated use getGymDayRange(dateStr, tz) */
export const getCaracasDayRange = (dateStr: string) => getGymDayRange(dateStr);
/** @deprecated use getGymWeekRange(anchorDate, tz) */
export const getCaracasWeekRange = (anchorDate: string) => getGymWeekRange(anchorDate);
/** @deprecated use getGymWeekDays(anchorDate) */
export const getCaracasWeekDays = (anchorDate: string) => getGymWeekDays(anchorDate);
/** @deprecated use getGymMonthRange(yearMonth, tz) */
export const getCaracasMonthRange = (yearMonth: string) => getGymMonthRange(yearMonth);
/** @deprecated use getGymCustomRange(start, end, tz) */
export const getCaracasCustomRange = (start: string, end: string) => getGymCustomRange(start, end);
/** @deprecated use getGymDateSpan(start, end) */
export const getCaracasDateSpan = (start: string, end: string) => getGymDateSpan(start, end);
/** @deprecated use getGymDateFromIso(iso, tz) */
export const getCaracasDateFromIso = (iso: string) => getGymDateFromIso(iso);
/** @deprecated use getGymTimeLabel(iso, tz) */
export const getCaracasTimeLabel = (iso: string) => getGymTimeLabel(iso);
/** @deprecated use getGymMinutesSince(iso, hourStart, tz) */
export const getCaracasMinutesSince = (iso: string, hourStart: number) =>
  getGymMinutesSince(iso, hourStart);
