'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, Loader2, Search, Smartphone } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/components/LanguageContext';
import { useToast } from '@/components/Toast';

type Recipient = {
  id: string;
  full_name: string | null;
  role: string | null;
  has_token: boolean;
};

const TITLE_MAX = 80;
const BODY_MAX = 240;

export default function NotificationsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [withAppCount, setWithAppCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'selected'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/admin/notifications/custom');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t('Failed to load recipients'));
        setRecipients(data.recipients || []);
        setWithAppCount(data.withAppCount || 0);
      } catch (error) {
        console.error(error);
        toast(t('Failed to load recipients'), 'error');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [t, toast]);

  const hasDraft = title.trim().length > 0 || body.trim().length > 0;

  // Don't lose a half-written message to an accidental reload or tab close.
  useEffect(() => {
    if (!hasDraft || sending) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasDraft, sending]);

  // People with the app first: they are the only ones who can receive it.
  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return recipients
      .filter((row) => !q || (row.full_name || '').toLowerCase().includes(q))
      .sort((a, b) => Number(b.has_token) - Number(a.has_token));
  }, [recipients, searchTerm]);

  const selectedCount = recipients.filter((row) => selected.has(row.id) && row.has_token).length;
  const recipientCount = audience === 'all' ? withAppCount : selectedCount;
  const withoutAppCount = recipients.length - recipients.filter((r) => r.has_token).length;
  const shownWithApp = filtered.filter((row) => row.has_token);
  const allShownSelected = shownWithApp.length > 0 && shownWithApp.every((row) => selected.has(row.id));

  const missingText = !title.trim() || !body.trim();
  const blockedReason = loading
    ? null
    : missingText
      ? t('Write a title and a message.')
      : withAppCount === 0
        ? t('No one has the app installed yet.')
        : audience === 'selected' && selectedCount === 0
          ? t('Pick at least one person.')
          : null;
  const canSend = !loading && !blockedReason;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllShown = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const row of shownWithApp) {
        if (allShownSelected) next.delete(row.id);
        else next.add(row.id);
      }
      return next;
    });
  };

  const send = async () => {
    setSending(true);
    try {
      const response = await fetch('/api/admin/notifications/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          all: audience === 'all',
          userIds: audience === 'selected' ? [...selected] : [],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('Failed to send notification'));
      const count = data.sent ?? 0;
      if (data.error) {
        toast(t('Sent to {{count}} phones. Some could not be reached.', { count }), 'warning');
      } else {
        toast(t('Sent to {{count}} phones.', { count }), 'success');
      }
      setTitle('');
      setBody('');
      setSelected(new Set());
    } catch (error) {
      console.error(error);
      toast(error instanceof Error ? error.message : t('Failed to send notification'), 'error');
    } finally {
      setSending(false);
      setConfirmOpen(false);
    }
  };

  const segmentClass = (active: boolean) =>
    `flex-1 min-h-11 px-3 rounded-lg text-sm font-semibold transition-colors ${
      active ? 'bg-pits-surface-elevated text-pits-text shadow-sm' : 'text-pits-dim hover:text-pits-text'
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t('Push notifications')}</h1>
        <p className="text-pits-dim text-sm">{t('Send a custom alert to members who have the app installed.')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="bg-pits-surface-elevated rounded-xl border border-pits-edge shadow-sm p-4 sm:p-5 space-y-5">
          <label className="block">
            <span className="flex items-baseline justify-between text-sm font-semibold text-pits-text">
              {t('Notification title')}
              <span className={`text-xs font-normal tabular-nums ${title.length >= TITLE_MAX ? 'text-pits-warning' : 'text-pits-dim'}`}>
                {title.length}/{TITLE_MAX}
              </span>
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
              maxLength={TITLE_MAX}
              className="mt-1.5 w-full h-11 rounded-lg border border-pits-edge bg-pits-surface px-3 text-sm text-pits-text outline-none focus:border-pits-primary focus:ring-2 focus:ring-pits-primary/30"
              placeholder={t('Notification title placeholder')}
            />
          </label>
          <label className="block">
            <span className="flex items-baseline justify-between text-sm font-semibold text-pits-text">
              {t('Notification message')}
              <span className={`text-xs font-normal tabular-nums ${body.length >= BODY_MAX ? 'text-pits-warning' : 'text-pits-dim'}`}>
                {body.length}/{BODY_MAX}
              </span>
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
              maxLength={BODY_MAX}
              rows={4}
              className="mt-1.5 w-full rounded-lg border border-pits-edge bg-pits-surface px-3 py-2.5 text-sm text-pits-text outline-none focus:border-pits-primary focus:ring-2 focus:ring-pits-primary/30 resize-none"
              placeholder={t('Notification message placeholder')}
            />
          </label>

          <div>
            <p className="text-sm font-semibold text-pits-text">{t('Send to')}</p>
            <div role="radiogroup" className="mt-1.5 flex gap-1 rounded-xl bg-pits-surface-muted p-1">
              <button
                type="button"
                role="radio"
                aria-checked={audience === 'all'}
                onClick={() => setAudience('all')}
                className={segmentClass(audience === 'all')}
              >
                {t('Everyone with the app ({{count}})', { count: withAppCount })}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={audience === 'selected'}
                onClick={() => setAudience('selected')}
                className={segmentClass(audience === 'selected')}
              >
                {t('Choose people')}
              </button>
            </div>
            {!loading && withoutAppCount > 0 ? (
              <p className="mt-2 text-xs text-pits-dim">
                {t("{{count}} people don't have the app yet and won't get it.", { count: withoutAppCount })}
              </p>
            ) : null}
          </div>

          <div>
            <p className="text-sm font-semibold text-pits-text">{t('Preview')}</p>
            <div className="mt-1.5 rounded-2xl bg-pits-surface-muted p-3 sm:p-4">
              <div className="rounded-xl bg-pits-surface-elevated border border-pits-edge p-3 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-pits-dim">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-black text-[10px] font-black text-[#D7FF00]">
                    W
                  </span>
                  <span className="font-semibold uppercase tracking-wide">WODUS</span>
                  <span className="ml-auto">{t('now')}</span>
                </div>
                <p className={`mt-1.5 text-sm font-semibold break-words ${title.trim() ? 'text-pits-text' : 'text-pits-dim'}`}>
                  {title.trim() || t('Notification title placeholder')}
                </p>
                <p className={`text-sm break-words line-clamp-4 ${body.trim() ? 'text-pits-text' : 'text-pits-dim'}`}>
                  {body.trim() || t('Notification message placeholder')}
                </p>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-pits-dim">
                <Smartphone size={13} aria-hidden />
                {t('Arrives as a WODUS notification on their phone.')}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              disabled={!canSend || sending}
              onClick={() => setConfirmOpen(true)}
              className="w-full min-h-11 flex items-center justify-center gap-2 px-4 py-3 bg-pits-primary text-pits-dark-text rounded-lg font-bold text-sm shadow-lg shadow-pits-primary/20 hover:bg-pits-primary-dark transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
              {sending
                ? t('Sending...')
                : recipientCount > 0
                  ? t('Send to {{count}} people', { count: recipientCount })
                  : t('Send notification')}
            </button>
            {blockedReason ? <p className="text-center text-xs text-pits-dim">{blockedReason}</p> : null}
          </div>
        </div>

        {audience === 'selected' ? (
          <div className="bg-pits-surface-elevated rounded-xl border border-pits-edge shadow-sm overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-pits-edge space-y-2">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label={t('Search members')}
                  className="w-full h-11 rounded-lg border border-pits-edge bg-pits-surface pl-9 pr-3 text-sm text-pits-text outline-none focus:border-pits-primary"
                  placeholder={t('Search members')}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-pits-dim">
                  {t('{{count}} selected', { count: selectedCount })}
                </p>
                <div className="flex gap-1">
                  {selectedCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setSelected(new Set())}
                      className="min-h-9 px-2.5 rounded-lg text-xs font-semibold text-pits-dim hover:text-pits-text hover:bg-pits-surface-muted"
                    >
                      {t('Clear')}
                    </button>
                  ) : null}
                  {shownWithApp.length > 0 ? (
                    <button
                      type="button"
                      onClick={toggleAllShown}
                      className="min-h-9 px-2.5 rounded-lg text-xs font-semibold text-pits-primary hover:bg-pits-surface-muted"
                    >
                      {allShownSelected ? t('Deselect shown') : t('Select all shown ({{count}})', { count: shownWithApp.length })}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            {loading ? (
              <div className="p-12 flex flex-col items-center text-pits-dim">
                <Loader2 size={22} className="animate-spin mb-2" />
                <span className="text-sm">{t('Loading members...')}</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-sm text-pits-dim">{t('No members found.')}</div>
            ) : (
              <ul className="max-h-[32rem] overflow-y-auto divide-y divide-pits-edge">
                {filtered.map((row) => {
                  const checked = selected.has(row.id);
                  const isStaff = row.role && row.role !== 'member';
                  return (
                    <li key={row.id}>
                      <label
                        className={`flex min-h-12 items-center gap-3 px-3 py-2 ${
                          row.has_token ? 'hover:bg-pits-surface-muted cursor-pointer' : 'opacity-60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={!row.has_token}
                          checked={row.has_token && checked}
                          onChange={() => toggle(row.id)}
                          className="h-4 w-4 rounded border-pits-edge text-pits-primary focus:ring-pits-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-pits-text truncate">
                            {row.full_name || t('Unnamed member')}
                          </p>
                          {isStaff ? (
                            <p className="text-xs text-pits-dim">{row.role === 'coach' ? t('Coach') : t('Staff')}</p>
                          ) : null}
                        </div>
                        {!row.has_token ? (
                          <span className="shrink-0 text-xs text-pits-dim">{t('No app')}</span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title={t('Send notification')}
        message={t('Send this notification to {{count}} people? It can’t be undone.', { count: recipientCount })}
        confirmLabel={t('Send notification')}
        cancelLabel={t('Cancel')}
        onConfirm={send}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
