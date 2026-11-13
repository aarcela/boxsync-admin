/**
 * Display-only date formatting for the staff dashboard, so every screen shows dates the
 * same way and follows the dashboard language (not the browser locale).
 *
 *   formatDate(d, 'en')      → "Oct 2, 2026"    formatDate(d, 'es')      → "2 oct 2026"
 *   formatDateShort(d, 'en') → "Oct 2"          formatTime(d, 'en')      → "14:05"
 *   formatDateLong(d, 'en')  → "Thursday, November 12"
 */
import type { Language } from '@/lib/translations';

type DateInput = Date | string | number;

const LOCALE: Record<Language, string> = { en: 'en-US', es: 'es' };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Plain calendar dates (`YYYY-MM-DD`, e.g. income_date, birth_date) are formatted as that
 * day, never shifted by the viewer's timezone (which showed "Nov 12" as Nov 11 in Venezuela).
 */
function format(value: DateInput, lang: Language, options: Intl.DateTimeFormatOptions): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  const calendarDay = typeof value === 'string' && DATE_ONLY.test(value);
  return new Intl.DateTimeFormat(LOCALE[lang] ?? LOCALE.en, {
    ...options,
    ...(calendarDay ? { timeZone: 'UTC' } : {}),
  })
    .format(date)
    .replace('.', '');
}

export const formatDate = (value: DateInput, lang: Language) =>
  format(value, lang, { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateShort = (value: DateInput, lang: Language) =>
  format(value, lang, { day: 'numeric', month: 'short' });

export const formatDateLong = (value: DateInput, lang: Language) =>
  format(value, lang, { weekday: 'long', day: 'numeric', month: 'long' });

export const formatTime = (value: DateInput, lang: Language) =>
  format(value, lang, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export const formatMonthYear = (value: DateInput, lang: Language) =>
  format(value, lang, { month: 'long', year: 'numeric' });

export const formatWeekdayShort = (value: DateInput, lang: Language) =>
  format(value, lang, { weekday: 'short' });

export const formatDateTime = (value: DateInput, lang: Language) =>
  `${formatDate(value, lang)} · ${formatTime(value, lang)}`;

/** "3 days ago" / "hace 3 días" (and future: "in 2 days" / "dentro de 2 días"). */
export function formatRelative(value: DateInput, lang: Language, now: Date = new Date()): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat(LOCALE[lang] ?? LOCALE.en, { numeric: 'auto' });
  if (abs < 60) return rtf.format(seconds, 'second');
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(seconds / (86400 * 30)), 'month');
  return rtf.format(Math.round(seconds / (86400 * 365)), 'year');
}

/** "noviembre de 2026" → "Noviembre de 2026" (CSS `capitalize` would also turn "de" into "De"). */
export const capitalizeFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
