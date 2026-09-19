'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, Search } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/components/LanguageContext';
import { useToast } from '@/components/Toast';

type Recipient = {
  id: string;
  full_name: string | null;
  role: string | null;
  has_token: boolean;
};

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

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return recipients.filter((row) => {
      if (!q) return true;
      return (row.full_name || '').toLowerCase().includes(q);
    });
  }, [recipients, searchTerm]);

  const selectedCount = selected.size;
  const selectedWithApp = recipients.filter((row) => selected.has(row.id) && row.has_token).length;
  const selectedWithoutApp = selectedCount - selectedWithApp;

  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (audience === 'all' ? withAppCount > 0 : selectedWithApp > 0);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
      if (data.error) {
        toast(data.error, 'warning');
      } else {
        toast(
          t('Notification sent to {{count}} users', { count: data.sent ?? 0 }),
          'success'
        );
      }
      setTitle('');
      setBody('');
      setSelected(new Set());
    } catch (error) {
      console.error(error);
      toast(
        error instanceof Error ? error.message : t('Failed to send notification'),
        'error'
      );
    } finally {
      setSending(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black text-pits-text uppercase italic tracking-tighter">
          {t('Push notifications')}
        </h2>
        <p className="text-pits-dim font-medium text-sm">
          {t('Send a custom alert to members who have the app installed.')}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-pits-surface-elevated rounded-xl border border-pits-edge shadow-sm p-5 space-y-4">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-pits-dim">
              {t('Notification title')}
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
              maxLength={80}
              className="mt-2 w-full rounded-lg border border-pits-edge bg-pits-surface px-3 py-3 text-sm font-medium text-pits-text outline-none focus:border-pits-primary"
              placeholder={t('Notification title placeholder')}
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-pits-dim">
              {t('Notification message')}
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 240))}
              maxLength={240}
              rows={5}
              className="mt-2 w-full rounded-lg border border-pits-edge bg-pits-surface px-3 py-3 text-sm font-medium text-pits-text outline-none focus:border-pits-primary resize-none"
              placeholder={t('Notification message placeholder')}
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAudience('all')}
              className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${
                audience === 'all'
                  ? 'border-pits-primary bg-pits-primary-soft text-pits-text'
                  : 'border-pits-edge text-pits-dim hover:border-pits-primary'
              }`}
            >
              {t('Everyone with the app ({{count}})', { count: withAppCount })}
            </button>
            <button
              type="button"
              onClick={() => setAudience('selected')}
              className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest border-2 transition-colors ${
                audience === 'selected'
                  ? 'border-pits-primary bg-pits-primary-soft text-pits-text'
                  : 'border-pits-edge text-pits-dim hover:border-pits-primary'
              }`}
            >
              {t('Selected members')}
            </button>
          </div>

          <button
            type="button"
            disabled={!canSend || sending}
            onClick={() => setConfirmOpen(true)}
            className="w-full flex items-center justify-center px-4 py-3 bg-pits-primary text-pits-dark-text rounded-lg font-bold uppercase text-xs tracking-widest shadow-lg shadow-pits-primary/20 hover:bg-pits-primary-dark transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            <Bell size={16} className="mr-2" />
            {sending ? t('Sending...') : t('Send notification')}
          </button>
        </div>

        <div className="bg-pits-surface-elevated rounded-xl border border-pits-edge shadow-sm overflow-hidden">
          <div className="p-4 border-b border-pits-edge">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-pits-edge bg-pits-surface pl-9 pr-3 py-2.5 text-sm font-medium text-pits-text outline-none focus:border-pits-primary"
                placeholder={t('Search members')}
              />
            </div>
            {audience === 'selected' && (
              <p className="mt-2 text-xs font-bold text-pits-dim">
                {t('{{count}} selected', { count: selectedCount })}
              </p>
            )}
          </div>
          {loading ? (
            <div className="p-12 text-center text-pits-dim">{t('Loading members...')}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-pits-dim">{t('No members found.')}</div>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto divide-y divide-pits-edge">
              {filtered.map((row) => {
                const checked = selected.has(row.id);
                const disabled = audience === 'all';
                return (
                  <label
                    key={row.id}
                    className={`flex items-center gap-3 p-3 ${disabled ? 'opacity-70' : 'hover:bg-pits-surface-muted cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={audience === 'all' ? row.has_token : checked}
                      onChange={() => toggle(row.id)}
                      className="rounded border-pits-edge text-pits-primary focus:ring-pits-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-pits-text truncate">
                        {row.full_name || t('Unnamed member')}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                        row.has_token
                          ? 'bg-pits-primary-soft text-pits-text'
                          : 'bg-pits-surface-muted text-pits-dim'
                      }`}
                    >
                      {row.has_token ? t('Has app') : t('No app')}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title={t('Send notification')}
        message={
          audience === 'all'
            ? t('Send this notification to {{count}} members with the app?', {
                count: withAppCount,
              })
            : selectedWithoutApp > 0
              ? t('Send to {{count}} members? {{skipped}} do not have the app and will be skipped.', {
                  count: selectedWithApp,
                  skipped: selectedWithoutApp,
                })
              : t('Send this notification to {{count}} members with the app?', {
                  count: selectedWithApp,
                })
        }
        confirmLabel={t('Send notification')}
        cancelLabel={t('Cancel')}
        onConfirm={send}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
