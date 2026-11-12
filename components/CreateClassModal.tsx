import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Loader2, Repeat } from 'lucide-react';
import { useToast } from './Toast';
import { useLanguage } from './LanguageContext';
import { classTypeService } from '@/lib/services/classTypeService';
import { classService } from '@/lib/services/classService';
import { ClassTypeRow } from '@/lib/types/gym';
import { classTypeDurationMap } from '@/lib/utils/classTypeStyles';
import {
  addDaysToDateStr,
  getGymDate,
  getGymDateFromIso,
  getGymTimeLabel,
  gymDateTimeToUtc,
  weekdayIndex,
} from '@/lib/utils/date';
import { capitalizeFirst, formatDate, formatWeekdayShort } from '@/lib/utils/format-date';
import { useTenant } from '@/components/TenantContext';

export type ClassModalMode = 'create' | 'edit' | 'duplicate';

export type ClassFormPrefill = {
  id?: string;
  start_time: string;
  end_time: string;
  class_type: string;
  max_capacity: number;
  coach_id?: string | null;
};

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
  initialTime?: string;
  mode?: ClassModalMode;
  prefill?: ClassFormPrefill | null;
}

interface Coach {
  id: string;
  full_name: string;
}

const inputClass =
  'w-full min-h-11 px-3 bg-pits-surface-muted border border-pits-edge rounded-xl text-sm font-medium text-pits-text focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none';
const labelClass = 'block text-xs font-semibold text-pits-dim mb-1.5';

/** Monday-first week; values match `weekdayIndex` (0 = Sunday). 2026-11-09 is a Monday. */
const WEEK = [1, 2, 3, 4, 5, 6, 0].map((value, i) => ({ value, sample: addDaysToDateStr('2026-11-09', i) }));
const DEFAULT_REPEAT_WEEKS = 4;

function defaultDuration(classType: string, durationByName: Record<string, number>): number {
  return durationByName[classType] ?? (classType === 'Open Box' ? 120 : 60);
}

/**
 * Schedule, edit or duplicate a class. One date + start time + duration (prefilled from the
 * class type); "Repeat" adds weekdays and an end date and shows how many classes it will create.
 */
export default function CreateClassModal({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
  initialTime,
  mode = 'create',
  prefill = null,
}: CreateClassModalProps) {
  const { toast } = useToast();
  const { t, lang } = useLanguage();
  const { tenantId, timezone: tz } = useTenant();
  const [loading, setLoading] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [classTypes, setClassTypes] = useState<ClassTypeRow[]>([]);

  const [date, setDate] = useState(() => getGymDate(new Date(), tz));
  const [time, setTime] = useState('07:00');
  const [duration, setDuration] = useState('60');
  const [coachId, setCoachId] = useState('');
  const [type, setType] = useState('');
  const [capacity, setCapacity] = useState('12');

  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [untilDate, setUntilDate] = useState(() => addDaysToDateStr(getGymDate(new Date(), tz), 7 * DEFAULT_REPEAT_WEEKS));

  const isEdit = mode === 'edit';
  const durationByName = classTypeDurationMap(classTypes);

  // Reset the form each time it opens.
  useEffect(() => {
    if (!isOpen) return;
    setIsRecurring(false);
    if (prefill) {
      const startDate = getGymDateFromIso(prefill.start_time, tz);
      const minutes = Math.round(
        (new Date(prefill.end_time).getTime() - new Date(prefill.start_time).getTime()) / 60000,
      );
      setDate(startDate);
      setTime(getGymTimeLabel(prefill.start_time, tz));
      setDuration(String(minutes > 0 ? minutes : 60));
      setType(prefill.class_type || '');
      setCapacity(String(prefill.max_capacity || 12));
      setCoachId(prefill.coach_id || '');
      setSelectedDays([weekdayIndex(startDate)]);
      setUntilDate(addDaysToDateStr(startDate, 7 * DEFAULT_REPEAT_WEEKS));
      return;
    }
    const startDate = initialDate || getGymDate(new Date(), tz);
    setDate(startDate);
    setTime(initialTime || '07:00');
    setType('');
    setDuration('60');
    setCapacity('12');
    setCoachId('');
    setSelectedDays([weekdayIndex(startDate)]);
    setUntilDate(addDaysToDateStr(startDate, 7 * DEFAULT_REPEAT_WEEKS));
  }, [isOpen, initialDate, initialTime, prefill, mode, tz]);

  // Coaches and class types for this gym.
  useEffect(() => {
    if (!isOpen || !tenantId) return;
    let cancelled = false;
    void (async () => {
      const [{ data: staff }, types] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('tenant_id', tenantId)
          .in('role', ['coach', 'manager', 'admin'])
          .order('full_name'),
        classTypeService.getClassTypes(tenantId, true).catch((err) => {
          console.error(err);
          return [] as ClassTypeRow[];
        }),
      ]);
      if (cancelled) return;
      setCoaches((staff as Coach[] | null) ?? []);
      setClassTypes(types);
      // New class: start from the first type and its usual length.
      setType((current) => {
        if (current && types.some((row) => row.name === current)) return current;
        const first = types[0]?.name ?? current;
        if (!prefill && first) setDuration(String(defaultDuration(first, classTypeDurationMap(types))));
        return first;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, tenantId, prefill]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const minutes = parseInt(duration, 10);
  const start = gymDateTimeToUtc(date, time, tz);
  const validStart = !Number.isNaN(start.getTime());
  const endLabel =
    validStart && minutes > 0 ? getGymTimeLabel(new Date(start.getTime() + minutes * 60000).toISOString(), tz) : '';

  /** Gym-local calendar days in the repeat range, so weekday and wall-clock time survive DST. */
  const occurrenceDays = (() => {
    if (!isRecurring) return [date];
    const days: string[] = [];
    for (let day = date; day <= untilDate && days.length < 400; day = addDaysToDateStr(day, 1)) {
      if (selectedDays.includes(weekdayIndex(day))) days.push(day);
    }
    return days;
  })();

  const toggleDay = (value: number) =>
    setSelectedDays((prev) => (prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return toast(t('Action failed'), 'error');
    if (!validStart) return toast(t('Pick a valid date and time.'), 'error');
    if (!(minutes > 0)) return toast(t('Duration must be at least 1 minute.'), 'error');
    const maxCapacity = parseInt(capacity, 10);
    if (!Number.isFinite(maxCapacity) || maxCapacity < 1) return toast(t('Max athletes must be at least 1.'), 'error');
    if (occurrenceDays.length === 0) return toast(t('No days match. Pick weekdays or a later end date.'), 'error');

    const durationMs = minutes * 60000;
    setLoading(true);
    try {
      if (isEdit) {
        if (!prefill?.id) throw new Error('missing class id');
        await classService.updateClass(prefill.id, {
          start_time: start.toISOString(),
          end_time: new Date(start.getTime() + durationMs).toISOString(),
          coach_id: coachId || null,
          class_type: type,
          max_capacity: maxCapacity,
        });
        toast(t('Class updated'), 'success');
      } else {
        const rows = occurrenceDays.map((day) => {
          const occurrence = gymDateTimeToUtc(day, time, tz);
          return {
            tenant_id: tenantId,
            start_time: occurrence.toISOString(),
            end_time: new Date(occurrence.getTime() + durationMs).toISOString(),
            coach_id: coachId || null,
            class_type: type,
            max_capacity: maxCapacity,
          };
        });
        const { error } = await supabase.from('classes').insert(rows);
        if (error) throw error;
        toast(
          rows.length === 1 ? t('Class scheduled') : t('{{count}} classes scheduled', { count: rows.length }),
          'success',
        );
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast(t('Could not save the class. Try again.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const title = isEdit ? t('Edit Class') : mode === 'duplicate' ? t('Duplicate Class') : t('Schedule Class');
  const submitLabel = isEdit
    ? t('Save Changes')
    : occurrenceDays.length > 1
      ? t('Schedule {{count}} classes', { count: occurrenceDays.length })
      : t('Schedule Class');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-pits-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-form-title"
        className="bg-pits-surface-elevated border border-pits-edge rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-pits-edge flex justify-between items-center shrink-0">
          <h3 id="class-form-title" className="text-lg font-bold text-pits-text">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-pits-dim hover:text-pits-text hover:bg-pits-surface-muted"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="p-5 space-y-4 overflow-y-auto overscroll-contain">
            <div>
              <label htmlFor="class-type" className={labelClass}>{t('Class type')}</label>
              <select
                id="class-type"
                required
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setDuration(String(defaultDuration(e.target.value, durationByName)));
                }}
                className={inputClass}
              >
                {type && !classTypes.some((row) => row.name === type) ? <option value={type}>{type}</option> : null}
                {classTypes.map((row) => (
                  <option key={row.id} value={row.name}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="class-date" className={labelClass}>
                  {isRecurring ? t('Starts on') : t('Date')}
                </label>
                <input
                  id="class-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    if (!isRecurring && e.target.value) setSelectedDays([weekdayIndex(e.target.value)]);
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="class-time" className={labelClass}>{t('Start time')}</label>
                <input
                  id="class-time"
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="class-duration" className={labelClass}>{t('Duration (min)')}</label>
                <input
                  id="class-duration"
                  type="number"
                  inputMode="numeric"
                  required
                  min={5}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            {endLabel ? (
              <p className="-mt-2 text-xs text-pits-dim">{t('Ends at {{time}}', { time: endLabel })}</p>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="class-coach" className={labelClass}>{t('Coach')}</label>
                <select
                  id="class-coach"
                  required
                  value={coachId}
                  onChange={(e) => setCoachId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{t('Choose…')}</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="class-capacity" className={labelClass}>{t('Spots')}</label>
                <input
                  id="class-capacity"
                  type="number"
                  inputMode="numeric"
                  required
                  min={1}
                  step={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {!isEdit && (
              <div className={`rounded-xl border p-3 ${isRecurring ? 'border-pits-primary/40 bg-pits-primary-soft' : 'border-pits-edge'}`}>
                <label className="flex items-center gap-3 min-h-9 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-4 h-4 rounded border-pits-edge text-pits-primary focus:ring-pits-primary/40"
                  />
                  <Repeat size={14} className="text-pits-dim" aria-hidden />
                  <span className="text-sm font-semibold text-pits-text">{t('Repeat every week')}</span>
                </label>

                {isRecurring && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={t('Repeat on')}>
                      {WEEK.map((day) => {
                        const on = selectedDays.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleDay(day.value)}
                            className={`h-10 rounded-lg text-xs font-semibold border ${
                              on
                                ? 'bg-pits-primary border-pits-primary text-pits-dark-text'
                                : 'bg-pits-surface-elevated border-pits-edge text-pits-dim'
                            }`}
                          >
                            {capitalizeFirst(formatWeekdayShort(day.sample, lang)).slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor="class-until" className="text-xs font-semibold text-pits-dim">
                        {t('Until')}
                      </label>
                      <input
                        id="class-until"
                        type="date"
                        min={date}
                        value={untilDate}
                        onChange={(e) => setUntilDate(e.target.value)}
                        className={`${inputClass} w-auto flex-1`}
                      />
                    </div>
                    <p className="text-xs text-pits-dim">
                      {occurrenceDays.length === 0
                        ? t('No days match. Pick weekdays or a later end date.')
                        : t('{{count}} classes, {{first}} to {{last}}', {
                            count: occurrenceDays.length,
                            first: formatDate(occurrenceDays[0], lang),
                            last: formatDate(occurrenceDays[occurrenceDays.length - 1], lang),
                          })}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 p-4 border-t border-pits-edge shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 px-4 rounded-xl border border-pits-edge text-sm font-semibold text-pits-text hover:bg-pits-surface-muted"
            >
              {t('Cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !type || occurrenceDays.length === 0}
              className="flex-1 min-h-11 rounded-xl inline-flex items-center justify-center gap-2 bg-pits-primary text-pits-dark-text text-sm font-semibold hover:bg-pits-primary-dark disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
