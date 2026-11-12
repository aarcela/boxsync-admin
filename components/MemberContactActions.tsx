'use client';

import { useState } from 'react';
import { CheckCircle, MessageCircle, Send } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useToast } from '@/components/Toast';
import Tooltip from '@/components/Tooltip';

export const contactActionBtn =
  'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50';

export function whatsAppHref(phone?: string | null): string | null {
  const digits = phone?.replace(/\D/g, '') ?? '';
  return digits ? `https://wa.me/${digits}` : null;
}

/** "Send reminder" (WhatsApp expiry reminder via the staff API) + "WhatsApp" chat link. */
export default function MemberContactActions({
  member,
  showReminder,
}: {
  member: { id: string; full_name: string | null; phone?: string | null };
  showReminder: boolean;
}) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const wa = whatsAppHref(member.phone);

  const sendReminder = async () => {
    setSending(true);
    try {
      const response = await fetch(`/api/admin/users/${member.id}/send-expiry-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      });
      if (!response.ok) throw new Error('reminder failed');
      setSent(true);
      toast(t('Reminder sent to {{name}}', { name: member.full_name ?? '' }), 'success');
    } catch {
      toast(t("Couldn't send the reminder. Try again."), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {showReminder ? (
        member.phone ? (
          <button
            type="button"
            disabled={sending || sent}
            onClick={() => void sendReminder()}
            className={`${contactActionBtn} ${
              sent
                ? 'bg-pits-positive-soft text-pits-positive border-pits-positive-edge'
                : 'bg-pits-surface-elevated text-pits-text border-pits-edge hover:bg-pits-surface-muted'
            }`}
          >
            {sent ? <CheckCircle size={14} /> : <Send size={14} />}
            {sent ? t('Reminder sent') : t('Send reminder')}
          </button>
        ) : (
          <span className="text-xs text-pits-dim">{t('No phone on file')}</span>
        )
      ) : null}
      {wa ? (
        <Tooltip content={t('Open WhatsApp chat')}>
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('Open WhatsApp chat')}
            className={`${contactActionBtn} bg-pits-surface-elevated text-pits-text border-pits-edge hover:bg-pits-surface-muted`}
          >
            <MessageCircle size={14} />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
        </Tooltip>
      ) : null}
    </div>
  );
}
