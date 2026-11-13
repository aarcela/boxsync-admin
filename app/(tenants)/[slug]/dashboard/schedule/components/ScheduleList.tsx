'use client';

import { useMemo, useState } from 'react';
import { Copy, Edit3, Trash2, UserX } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import type { ClassSession } from '@/lib/types/gym';
import { getGymDate, getGymTimeLabel } from '@/lib/utils/date';
import { capitalizeFirst, formatDateLong } from '@/lib/utils/format-date';

const PAGE_DAYS = 7;

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function classBookingCounts(session: ClassSession) {
  const booked = session.bookings[0]?.count || 0;
  const waiting = session.waitlist?.[0]?.count || 0;
  const full = booked >= session.max_capacity;
  const busy = !full && booked / Math.max(1, session.max_capacity) > 0.8;
  return { booked, waiting, full, busy };
}

/**
 * Upcoming classes grouped by gym day, one compact row each. A week at a time so a long
 * recurring schedule doesn't turn into an endless scroll. Tap a row for roster and actions.
 */
export default function ScheduleList({
  classes,
  timezone,
  colorByName,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  classes: ClassSession[];
  timezone: string;
  colorByName: Record<string, string>;
  onOpen: (session: ClassSession) => void;
  onEdit: (session: ClassSession) => void;
  onDuplicate: (session: ClassSession) => void;
  onDelete: (session: ClassSession) => void;
}) {
  const { t, lang } = useLanguage();
  const [days, setDays] = useState(PAGE_DAYS);
  const today = getGymDate(new Date(), timezone);
  const tomorrow = addDays(today, 1);
  const until = addDays(today, days);

  const groups = useMemo(() => {
    const map = new Map<string, ClassSession[]>();
    for (const session of classes) {
      const day = getGymDate(new Date(session.start_time), timezone);
      if (day >= until) continue;
      const list = map.get(day) ?? [];
      list.push(session);
      map.set(day, list);
    }
    return Array.from(map);
  }, [classes, timezone, until]);

  const remaining = classes.filter((s) => getGymDate(new Date(s.start_time), timezone) >= until).length;

  const dayLabel = (day: string) => {
    const long = capitalizeFirst(formatDateLong(day, lang));
    if (day === today) return `${t('Today')} · ${long}`;
    if (day === tomorrow) return `${t('Tomorrow')} · ${long}`;
    return long;
  };

  const iconButton =
    'flex items-center justify-center w-9 h-9 rounded-lg text-pits-dim hover:text-pits-text hover:bg-pits-surface-muted';

  return (
    <div className="space-y-4">
      {groups.length === 0 ? (
        <p className="rounded-xl border border-pits-edge bg-pits-surface-elevated p-8 text-center text-sm text-pits-dim">
          {t('No classes in the next {{days}} days.', { days })}
        </p>
      ) : (
        groups.map(([day, sessions]) => (
          <section key={day}>
            <h2 className={`mb-2 text-sm font-semibold ${day === today ? 'text-pits-text' : 'text-pits-dim'}`}>
              {dayLabel(day)}
            </h2>
            <ul className="rounded-xl border border-pits-edge bg-pits-surface-elevated divide-y divide-pits-edge overflow-hidden">
              {sessions.map((session) => {
                const { booked, waiting, full, busy } = classBookingCounts(session);
                const pct = Math.min(100, (booked / Math.max(1, session.max_capacity)) * 100);
                const coach = session.coach?.full_name;
                return (
                  <li key={session.id} className="flex items-center gap-2 pr-2 hover:bg-pits-surface-muted/50">
                    <button
                      type="button"
                      onClick={() => onOpen(session)}
                      className="flex flex-1 min-w-0 items-center gap-3 py-3 pl-4 text-left"
                    >
                      <span className="w-12 shrink-0 text-sm font-bold tabular-nums text-pits-text">
                        {getGymTimeLabel(session.start_time, timezone)}
                      </span>
                      <span
                        className="h-8 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: colorByName[session.class_type] || 'var(--color-pits-edge)' }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-pits-text">{session.class_type}</span>
                        {coach ? (
                          <span className="block truncate text-xs text-pits-dim">{coach}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-pits-warning">
                            <UserX size={12} aria-hidden />
                            {t('No coach assigned')}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className={`block text-sm font-semibold tabular-nums ${
                            full ? 'text-pits-danger' : busy ? 'text-pits-warning' : 'text-pits-text'
                          }`}
                        >
                          {booked}/{session.max_capacity}
                          {full ? ` · ${t('Full')}` : ''}
                        </span>
                        <span className="mt-1 ml-auto block h-1.5 w-20 rounded-full bg-pits-surface-muted overflow-hidden">
                          <span
                            className={`block h-full rounded-full ${
                              full ? 'bg-pits-danger' : busy ? 'bg-pits-warning' : 'bg-pits-positive'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        {waiting > 0 ? (
                          <span className="mt-0.5 block text-[11px] text-pits-dim">
                            {t('{{count}} waiting', { count: waiting })}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <div className="hidden sm:flex items-center gap-0.5 border-l border-pits-edge pl-2">
                      <button type="button" onClick={() => onEdit(session)} className={iconButton} aria-label={t('Edit Class')} title={t('Edit Class')}>
                        <Edit3 size={16} />
                      </button>
                      <button type="button" onClick={() => onDuplicate(session)} className={iconButton} aria-label={t('Duplicate Class')} title={t('Duplicate Class')}>
                        <Copy size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(session)}
                        className={`${iconButton} hover:!text-pits-danger hover:!bg-pits-danger-soft`}
                        aria-label={t('Cancel Class')}
                        title={t('Cancel Class')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      {remaining > 0 ? (
        <button
          type="button"
          onClick={() => setDays((d) => d + PAGE_DAYS)}
          className="w-full min-h-10 rounded-xl border border-pits-edge bg-pits-surface-elevated text-sm font-semibold text-pits-text hover:bg-pits-surface-muted"
        >
          {t('Show the next 7 days')}
        </button>
      ) : null}
    </div>
  );
}
