/**
 * Returns the current date in YYYY-MM-DD format based on America/Caracas timezone.
 * Useful for filtering Supabase queries by date without relying on client browser timezone.
 */
export const getCaracasDate = (date: Date = new Date()): string => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const ye = parts.find((p) => p.type === 'year')?.value;
  const mo = parts.find((p) => p.type === 'month')?.value;
  const da = parts.find((p) => p.type === 'day')?.value;
  return `${ye}-${mo}-${da}`;
};

/**
 * Returns the UTC range (ISO strings) for a full day in Caracas.
 * Useful for Supabase .gte and .lte comparisons.
 * @param dateStr Format: YYYY-MM-DD
 */
export const getCaracasDayRange = (dateStr: string) => {
  // Caracas is UTC-4. To get a full day for Caracas:
  // Start: YYYY-MM-DDT00:00:00-04:00
  // End: YYYY-MM-DDT23:59:59-04:00
  const startUtc = new Date(`${dateStr}T00:00:00-04:00`).toISOString();
  const endUtc = new Date(`${dateStr}T23:59:59-04:00`).toISOString();
  
  return { startUtc, endUtc };
};

function parseCaracasAnchor(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00-04:00`);
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const d = parseCaracasAnchor(dateStr);
  d.setDate(d.getDate() + days);
  return getCaracasDate(d);
}

function getCaracasWeekdayIndex(dateStr: string): number {
  const d = parseCaracasAnchor(dateStr);
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    weekday: 'short',
  }).format(d);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? 0;
}

/**
 * Returns UTC range for Mon–Sun week containing anchorDate (Caracas).
 */
export const getCaracasWeekRange = (anchorDate: string) => {
  const weekday = getCaracasWeekdayIndex(anchorDate);
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  const monday = addDaysToDateStr(anchorDate, -daysFromMonday);
  const sunday = addDaysToDateStr(monday, 6);
  const { startUtc } = getCaracasDayRange(monday);
  const { endUtc } = getCaracasDayRange(sunday);
  return { startUtc, endUtc, startDate: monday, endDate: sunday };
};

/** Day strings (YYYY-MM-DD) Mon–Sun for the week containing anchorDate. */
export const getCaracasWeekDays = (anchorDate: string): string[] => {
  const { startDate } = getCaracasWeekRange(anchorDate);
  return Array.from({ length: 7 }, (_, i) => addDaysToDateStr(startDate, i));
};

/**
 * Returns UTC range for a full month in Caracas.
 * @param yearMonth Format: YYYY-MM
 */
export const getCaracasMonthRange = (yearMonth: string) => {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const startDate = `${yearMonth}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
  const { startUtc } = getCaracasDayRange(startDate);
  const { endUtc } = getCaracasDayRange(endDate);
  return { startUtc, endUtc, startDate, endDate };
};

export const getCaracasCustomRange = (start: string, end: string) => {
  if (start > end) {
    throw new Error('Invalid date range');
  }
  const { startUtc } = getCaracasDayRange(start);
  const { endUtc } = getCaracasDayRange(end);
  return { startUtc, endUtc, startDate: start, endDate: end };
};

/** Calendar day strings from start to end inclusive (Caracas dates). */
export const getCaracasDateSpan = (start: string, end: string): string[] => {
  const days: string[] = [];
  let current = start;
  while (current <= end) {
    days.push(current);
    current = addDaysToDateStr(current, 1);
  }
  return days;
};

export const getCaracasDateFromIso = (iso: string): string => {
  return getCaracasDate(new Date(iso));
};

export const getCaracasTimeLabel = (iso: string): string => {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/Caracas',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

export const getCaracasMinutesSince = (iso: string, hourStart: number): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute - hourStart * 60;
};
