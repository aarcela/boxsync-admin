'use client';

import { useState, useTransition } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import { useToast } from '@/components/Toast';
import { GYM_TIMEZONE_OPTIONS } from '@/lib/gym-timezone';
import { formatTime } from '@/lib/utils/format-date';

export default function GymTimezoneCard({
  onSave,
}: {
  onSave: (timezone: string) => Promise<unknown>;
}) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const { timezone, setSettings } = useTenant();
  const [value, setValue] = useState(timezone);
  const [isPending, startTransition] = useTransition();

  const options = GYM_TIMEZONE_OPTIONS.some((o) => o.value === timezone)
    ? GYM_TIMEZONE_OPTIONS
    : [{ value: timezone, label: timezone }, ...GYM_TIMEZONE_OPTIONS];

  const localNow = new Intl.DateTimeFormat(lang === 'es' ? 'es' : 'en-US', {
    timeZone: value,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());

  const save = () => {
    startTransition(async () => {
      try {
        const next = await onSave(value);
        setSettings(next);
        toast(t('Gym timezone saved'), 'success');
      } catch {
        toast(t("Couldn't save the timezone. Try again."), 'error');
      }
    });
  };

  return (
    <div className="rounded-2xl bg-pits-card border border-pits-edge p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-pits-surface p-2 border border-pits-edge">
          <Globe size={16} className="text-pits-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-black text-pits-ink">{t('Gym timezone')}</h2>
          <p className="mt-0.5 text-xs font-bold text-pits-ink-muted leading-relaxed">
            {t('Gym timezone help')}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <select
          value={value}
          disabled={isPending}
          onChange={(e) => setValue(e.target.value)}
          aria-label={t('Gym timezone')}
          className="w-full sm:flex-1 min-h-10 px-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={isPending || value === timezone}
          className="inline-flex items-center justify-center gap-2 min-h-10 px-4 rounded-lg bg-pits-primary text-pits-dark-text text-sm font-semibold disabled:opacity-50"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : null}
          {t('Save')}
        </button>
      </div>

      <p className="text-xs text-pits-dim">
        {t('Local time there now: {{time}}', { time: localNow })}
        {' · '}
        {t('Your device: {{time}}', { time: formatTime(new Date(), lang) })}
      </p>
    </div>
  );
}
