'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  Loader2,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useToast } from '@/components/Toast';
import { useTenant } from '@/components/TenantContext';
import {
  BOOKING_CLOSE_PRESETS_MINUTES,
  DEFAULT_BOOKING_SETTINGS,
  isBookingWindowsValid,
  type BookingSettings,
} from '@/lib/booking-settings';
import { tenantBookingService } from '@/lib/services/tenantBookingService';
import { saveBookingSettingsAction } from './actions';

const CUSTOM_SENTINEL = -1;
const MAX_CUSTOM_MINUTES = 7 * 24 * 60;

function isPresetMinutes(minutes: number): boolean {
  return (BOOKING_CLOSE_PRESETS_MINUTES as readonly number[]).includes(minutes);
}

function minutesToParts(total: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.floor(total));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

function partsToMinutes(hours: number, minutes: number): number {
  const h = Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0;
  const m = Number.isFinite(minutes) ? Math.min(59, Math.max(0, Math.floor(minutes))) : 0;
  return Math.min(MAX_CUSTOM_MINUTES, h * 60 + m);
}

function shortPresetLabel(minutes: number, t: (key: any, params?: Record<string, string | number>) => string) {
  if (minutes === 0) return t('Booking chip start');
  if (minutes < 60) return t('Booking chip minutes', { minutes });
  const hours = minutes / 60;
  if (Number.isInteger(hours)) {
    return hours === 1 ? t('Booking chip 1 hour') : t('Booking chip hours', { hours });
  }
  const parts = minutesToParts(minutes);
  return t('Booking chip hours minutes', { hours: parts.hours, minutes: parts.minutes });
}

function fullWindowLabel(minutes: number, t: (key: any, params?: Record<string, string | number>) => string) {
  if (minutes === 0) return t('Booking preset until start');
  if (minutes < 60) return t('Booking preset minutes', { minutes });
  const hours = minutes / 60;
  if (hours === 1) return t('Booking preset 1 hour');
  if (Number.isInteger(hours)) return t('Booking preset hours', { hours });
  const parts = minutesToParts(minutes);
  return t('Booking preset hours minutes', { hours: parts.hours, minutes: parts.minutes });
}

function CloseWindowEditor({
  icon: Icon,
  title,
  help,
  value,
  disabled,
  customActive,
  onCustomActiveChange,
  onChange,
  t,
}: {
  icon: typeof CalendarPlus;
  title: string;
  help: string;
  value: number;
  disabled: boolean;
  customActive: boolean;
  onCustomActiveChange: (active: boolean) => void;
  onChange: (minutes: number) => void;
  t: (key: any, params?: Record<string, string | number>) => string;
}) {
  const parts = minutesToParts(value);
  const selectedPreset = !customActive && isPresetMinutes(value) ? value : CUSTOM_SENTINEL;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-pits-surface p-2 border border-pits-edge">
          <Icon size={16} className="text-pits-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-black text-pits-ink">{title}</h2>
          <p className="mt-0.5 text-xs font-bold text-pits-ink-muted leading-relaxed">{help}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {BOOKING_CLOSE_PRESETS_MINUTES.map((m) => {
          const active = selectedPreset === m;
          return (
            <button
              key={m}
              type="button"
              disabled={disabled}
              onClick={() => {
                onCustomActiveChange(false);
                onChange(m);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-black tracking-wide transition-colors disabled:opacity-50 ${
                active
                  ? 'bg-pits-primary text-pits-dark-text'
                  : 'bg-pits-surface border border-pits-edge text-pits-ink hover:border-pits-primary/50'
              }`}
            >
              {shortPresetLabel(m, t)}
            </button>
          );
        })}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onCustomActiveChange(true)}
          className={`rounded-full px-3 py-1.5 text-xs font-black tracking-wide transition-colors disabled:opacity-50 ${
            customActive
              ? 'bg-pits-primary text-pits-dark-text'
              : 'bg-pits-surface border border-pits-edge text-pits-ink hover:border-pits-primary/50'
          }`}
        >
          {t('Booking custom time')}
        </button>
      </div>

      {customActive ? (
        <div className="rounded-xl border border-pits-edge bg-pits-surface px-3 py-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="block text-[10px] font-black uppercase tracking-widest text-pits-ink-muted">
                {t('Booking custom hours')}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={Math.floor(MAX_CUSTOM_MINUTES / 60)}
                  step={1}
                  disabled={disabled}
                  value={parts.hours}
                  onChange={(e) =>
                    onChange(partsToMinutes(Number(e.target.value), parts.minutes))
                  }
                  className="w-20 rounded-lg border border-pits-edge bg-pits-card px-3 py-2 text-sm font-black text-pits-ink tabular-nums"
                />
                <span className="text-xs font-bold text-pits-ink-muted">h</span>
              </div>
            </label>
            <label className="space-y-1">
              <span className="block text-[10px] font-black uppercase tracking-widest text-pits-ink-muted">
                {t('Booking custom minutes')}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={1}
                  disabled={disabled}
                  value={parts.minutes}
                  onChange={(e) =>
                    onChange(partsToMinutes(parts.hours, Number(e.target.value)))
                  }
                  className="w-20 rounded-lg border border-pits-edge bg-pits-card px-3 py-2 text-sm font-black text-pits-ink tabular-nums"
                />
                <span className="text-xs font-bold text-pits-ink-muted">m</span>
              </div>
            </label>
            <p className="pb-2 text-xs font-bold text-pits-ink-muted">
              {value === 0
                ? t('Booking closes until start')
                : t('Booking closes summary', { time: fullWindowLabel(value, t) })}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs font-bold text-pits-ink-muted">
          {value === 0
            ? t('Booking closes until start')
            : t('Booking closes summary', { time: fullWindowLabel(value, t) })}
        </p>
      )}
    </div>
  );
}

export default function BookingSettingsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS);
  const [draft, setDraft] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS);
  const [bookCustom, setBookCustom] = useState(false);
  const [cancelCustom, setCancelCustom] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const next = await tenantBookingService.getForTenant(tenantId);
        if (!cancelled) {
          setSaved(next);
          setDraft(next);
          setBookCustom(!isPresetMinutes(next.bookClosesMinutesBefore));
          setCancelCustom(!isPresetMinutes(next.cancelClosesMinutesBefore));
        }
      } catch {
        if (!cancelled) toast(t('Failed to load booking settings'), 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [tenantId, t, toast]);

  const windowsValid = isBookingWindowsValid(draft);
  const dirty = useMemo(
    () =>
      draft.bookClosesMinutesBefore !== saved.bookClosesMinutesBefore ||
      draft.cancelClosesMinutesBefore !== saved.cancelClosesMinutesBefore,
    [draft, saved]
  );

  const handleDiscard = () => {
    setDraft(saved);
    setBookCustom(!isPresetMinutes(saved.bookClosesMinutesBefore));
    setCancelCustom(!isPresetMinutes(saved.cancelClosesMinutesBefore));
  };

  const handleSave = () => {
    if (!isBookingWindowsValid(draft)) {
      toast(t('Booking windows overlap error'), 'error');
      return;
    }
    startTransition(async () => {
      try {
        const next = await saveBookingSettingsAction(draft);
        setSaved(next);
        setDraft(next);
        setBookCustom(!isPresetMinutes(next.bookClosesMinutesBefore));
        setCancelCustom(!isPresetMinutes(next.cancelClosesMinutesBefore));
        toast(t('Booking settings saved'), 'success');
      } catch (err) {
        const message =
          err instanceof Error && err.message === 'BOOKING_WINDOWS_OVERLAP'
            ? t('Booking windows overlap error')
            : t('Failed to save booking settings');
        toast(message, 'error');
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-xl bg-pits-card p-2 border border-pits-edge">
          <CalendarClock size={20} className="text-pits-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-pits-ink">{t('Booking')}</h1>
          <p className="mt-1 text-sm font-bold text-pits-ink-muted">
            {t('Booking settings help')}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-pits-card border border-pits-edge p-10 flex justify-center">
          <Loader2 size={20} className="animate-spin text-pits-primary" />
        </div>
      ) : (
        <div className="rounded-2xl bg-pits-card border border-pits-edge overflow-hidden">
          {!windowsValid ? (
            <div className="flex items-start gap-2 border-b border-amber-600/40 bg-amber-100 px-5 py-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-800" />
              <p className="text-sm font-bold text-amber-950">
                {t('Booking windows overlap warning')}
              </p>
            </div>
          ) : null}

          <div className="p-5 sm:p-6 space-y-6">
            <CloseWindowEditor
              icon={CalendarPlus}
              title={t('Book closes before class')}
              help={t('Book closes before class help')}
              value={draft.bookClosesMinutesBefore}
              disabled={isPending}
              customActive={bookCustom}
              onCustomActiveChange={setBookCustom}
              onChange={(minutes) =>
                setDraft((prev) => ({ ...prev, bookClosesMinutesBefore: minutes }))
              }
              t={t}
            />

            <div className="border-t border-pits-edge" />

            <CloseWindowEditor
              icon={CalendarX2}
              title={t('Cancel closes before class')}
              help={t('Cancel closes before class help')}
              value={draft.cancelClosesMinutesBefore}
              disabled={isPending}
              customActive={cancelCustom}
              onCustomActiveChange={setCancelCustom}
              onChange={(minutes) =>
                setDraft((prev) => ({ ...prev, cancelClosesMinutesBefore: minutes }))
              }
              t={t}
            />
          </div>

          <div className="border-t border-pits-edge bg-pits-surface/70 px-5 py-4 sm:px-6 space-y-3">
            <p className="text-xs font-bold text-pits-ink-muted">
              {t('Booking pair summary', {
                book: fullWindowLabel(draft.bookClosesMinutesBefore, t),
                cancel: fullWindowLabel(draft.cancelClosesMinutesBefore, t),
              })}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-pits-ink-muted">
                {dirty ? t('Booking unsaved changes') : t('Booking all saved')}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isPending || !dirty}
                  onClick={handleDiscard}
                  className="rounded-xl border border-pits-edge bg-pits-card px-4 py-2.5 text-xs font-black uppercase tracking-wide text-pits-ink disabled:opacity-40"
                >
                  {t('Discard changes')}
                </button>
                <button
                  type="button"
                  disabled={isPending || !dirty || !windowsValid}
                  onClick={handleSave}
                  className="rounded-xl bg-pits-primary px-4 py-2.5 text-xs font-black uppercase tracking-wide text-pits-dark-text disabled:opacity-40 inline-flex items-center justify-center gap-2 min-w-28"
                >
                  {isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {t('Saving...')}
                    </>
                  ) : (
                    t('Save booking settings')
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
