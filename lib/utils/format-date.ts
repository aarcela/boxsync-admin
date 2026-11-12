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

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

function format(value: DateInput, lang: Language, options: Intl.DateTimeFormatOptions): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE[lang] ?? LOCALE.en, options).format(date).replace('.', '');
}

export const formatDate = (value: DateInput, lang: Language) =>
  format(value, lang, { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateShort = (value: DateInput, lang: Language) =>
  format(value, lang, { day: 'numeric', month: 'short' });

export const formatDateLong = (value: DateInput, lang: Language) =>
  format(value, lang, { weekday: 'long', day: 'numeric', month: 'long' });

export const formatTime = (value: DateInput, lang: Language) =>
  format(value, lang, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
