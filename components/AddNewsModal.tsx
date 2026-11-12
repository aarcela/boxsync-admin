import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Loader2, Send, Bell } from 'lucide-react';
import { useToast } from './Toast';
import { useLanguage } from './LanguageContext';
import { useTenant } from './TenantContext';
import type { TranslationKey } from '@/lib/translations';

interface CreateNewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TAGS = ['INFO', 'ALERT', 'EVENT'] as const;
const TITLE_MAX = 60;

const inputClass =
  'w-full min-h-11 px-3 bg-pits-surface-muted border border-pits-edge rounded-xl text-sm font-medium text-pits-text placeholder:text-pits-dim focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none';

/**
 * Post an announcement to the athlete app's home feed and, by default, push it to every
 * member who has the app — one action instead of two separate screens.
 */
export default function CreateNewsModal({ isOpen, onClose, onSuccess }: CreateNewsModalProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { name: gymName } = useTenant();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState<(typeof TAGS)[number]>('INFO');
  const [sendPush, setSendPush] = useState(true);
  const [withApp, setWithApp] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/admin/notifications/custom')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setWithApp(Number(data.withAppCount) || 0);
      })
      .catch(() => undefined);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const pushAvailable = withApp !== 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const headline = title.trim();
    if (!headline) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('news').insert({ title: headline, tag, is_active: true });
      if (error) throw error;

      let pushed = false;
      if (sendPush && pushAvailable) {
        try {
          const res = await fetch('/api/admin/notifications/custom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: gymName || t(tag), body: headline, all: true }),
          });
          pushed = res.ok;
        } catch {
          pushed = false;
        }
        if (!pushed) toast(t('Announcement posted, but the notification could not be sent.'), 'error');
      }
      if (!sendPush || !pushAvailable || pushed) {
        toast(pushed ? t('Announcement posted and sent to phones') : t('Announcement posted'), 'success');
      }
      setTitle('');
      setTag('INFO');
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast(t('Could not post the announcement. Try again.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const tagButtonClass = (value: string) => {
    if (tag !== value) return 'bg-pits-surface-elevated border-pits-edge text-pits-dim';
    if (value === 'ALERT') return 'bg-pits-danger-soft border-pits-danger text-pits-danger';
    if (value === 'EVENT') return 'bg-pits-info-soft border-pits-info text-pits-info';
    return 'bg-pits-primary-soft border-pits-primary text-pits-text';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-pits-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="news-form-title"
        className="bg-pits-surface-elevated border border-pits-edge rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-pits-edge flex justify-between items-center">
          <h3 id="news-form-title" className="text-lg font-bold text-pits-text">
            {t('New announcement')}
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label htmlFor="news-title" className="block text-xs font-semibold text-pits-dim mb-1.5">
              {t('What do members need to know?')}
            </label>
            <input
              id="news-title"
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder={t('e.g. Closed on Sunday for maintenance')}
              maxLength={TITLE_MAX}
            />
            <p className="text-[11px] text-pits-dim mt-1 text-right tabular-nums">
              {title.length}/{TITLE_MAX}
            </p>
          </div>

          <div>
            <p className="block text-xs font-semibold text-pits-dim mb-1.5">{t('Type')}</p>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('Type')}>
              {TAGS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={tag === value}
                  onClick={() => setTag(value)}
                  className={`min-h-10 rounded-xl text-sm font-semibold border ${tagButtonClass(value)}`}
                >
                  {capitalize(t(value as TranslationKey))}
                </button>
              ))}
            </div>
          </div>

          <label
            className={`flex items-start gap-3 rounded-xl border p-3 ${
              pushAvailable ? 'cursor-pointer border-pits-edge' : 'border-pits-edge opacity-60'
            }`}
          >
            <input
              type="checkbox"
              checked={sendPush && pushAvailable}
              disabled={!pushAvailable}
              onChange={(e) => setSendPush(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-pits-edge text-pits-primary focus:ring-pits-primary/40"
            />
            <span className="text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-pits-text">
                <Bell size={14} aria-hidden />
                {t('Also send as a notification')}
              </span>
              <span className="block text-xs text-pits-dim mt-0.5">
                {withApp == null
                  ? t('To everyone who has the app.')
                  : withApp === 0
                    ? t('No members have the app yet.')
                    : t('Reaches {{count}} members with the app.', { count: withApp })}
              </span>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="w-full min-h-11 rounded-xl inline-flex items-center justify-center gap-2 bg-pits-primary text-pits-dark-text text-sm font-semibold hover:bg-pits-primary-dark disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sendPush && pushAvailable ? t('Post and notify') : t('Post Update')}
          </button>
        </form>
      </div>
    </div>
  );
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value;
}
