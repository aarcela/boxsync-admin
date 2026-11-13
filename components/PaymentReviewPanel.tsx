'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import PaymentProofReader from '@/components/PaymentProofReader';
import { formatDate } from '@/lib/utils/format-date';

export type ReviewPayment = {
  id: string;
  user_id: string;
  amount: number;
  method?: string | null;
  created_at: string;
  proof_image_url?: string | null;
  profiles?: { full_name?: string | null } | null;
};

type Props<P extends ReviewPayment> = {
  payments: P[];
  initialId: string;
  formatAmount: (payment: P) => string;
  onApprove: (payment: P) => Promise<boolean>;
  onReject: (payment: P, reason: string) => Promise<boolean>;
  onClose: () => void;
};

export default function PaymentReviewPanel<P extends ReviewPayment>({
  payments,
  initialId,
  formatAmount,
  onApprove,
  onReject,
  onClose,
}: Props<P>) {
  const { t } = useLanguage();
  const [decided, setDecided] = useState<Set<string>>(new Set());
  const [currentId, setCurrentId] = useState(initialId);

  const queue = useMemo(() => payments.filter((p) => !decided.has(p.id)), [payments, decided]);
  const index = Math.max(0, queue.findIndex((p) => p.id === currentId));
  const payment = queue[index];

  useEffect(() => {
    if (!payment) onClose();
  }, [payment, onClose]);

  const goTo = useCallback(
    (offset: number) => {
      if (queue.length < 2) return;
      const next = queue[(index + offset + queue.length) % queue.length];
      setCurrentId(next.id);
    },
    [queue, index],
  );

  const finish = (id: string) => {
    const remaining = queue.filter((p) => p.id !== id);
    if (remaining.length === 0) {
      onClose();
      return;
    }
    setCurrentId(remaining[Math.min(index, remaining.length - 1)].id);
    setDecided((prev) => new Set(prev).add(id));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key === 'ArrowRight') goTo(1);
      if (e.key === 'ArrowLeft') goTo(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, onClose]);

  if (!payment) return null;

  const name = payment.profiles?.full_name || t('Unknown Athlete');

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-pits-background/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('Review payment')}
        className="bg-pits-surface-elevated border border-pits-edge rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-pits-edge">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-pits-dim">
              {t('Review payment')}
              {queue.length > 1
                ? ` · ${t('{{current}} of {{total}}', { current: index + 1, total: queue.length })}`
                : ''}
            </p>
            <h3 className="text-lg font-bold text-pits-text truncate">{name}</h3>
          </div>
          {queue.length > 1 ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => goTo(-1)}
                aria-label={t('Previous')}
                className="p-2 rounded-lg border border-pits-edge text-pits-dim hover:text-pits-text"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => goTo(1)}
                aria-label={t('Next')}
                className="p-2 rounded-lg border border-pits-edge text-pits-dim hover:text-pits-text"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="p-2 rounded-lg border border-pits-edge text-pits-dim hover:text-pits-text shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <ReviewBody
          key={payment.id}
          payment={payment}
          formatAmount={formatAmount}
          onApprove={onApprove}
          onReject={onReject}
          onDone={finish}
        />
      </div>
    </div>
  );
}

function ReviewBody<P extends ReviewPayment>({
  payment,
  formatAmount,
  onApprove,
  onReject,
  onDone,
}: {
  payment: P;
  formatAmount: (payment: P) => string;
  onApprove: (payment: P) => Promise<boolean>;
  onReject: (payment: P, reason: string) => Promise<boolean>;
  onDone: (id: string) => void;
}) {
  const { t, lang } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [confirmNoProof, setConfirmNoProof] = useState(false);

  const hasProof = Boolean(payment.proof_image_url) && !imageFailed;
  const submitted = formatDate(payment.created_at, lang);

  const approve = async () => {
    if (busy) return;
    if (!hasProof && !confirmNoProof) {
      setConfirmNoProof(true);
      return;
    }
    setBusy(true);
    const ok = await onApprove(payment);
    setBusy(false);
    if (ok) onDone(payment.id);
  };

  const reject = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await onReject(payment, reason.trim());
    setBusy(false);
    if (ok) onDone(payment.id);
  };

  return (
    <>
        <div className="flex-1 overflow-auto p-4 space-y-3">
          <dl className="grid grid-cols-3 gap-3 rounded-xl bg-pits-surface-muted/60 p-3">
            <div className="min-w-0">
              <dt className="text-xs font-medium text-pits-dim">{t('Amount')}</dt>
              <dd className="text-lg font-bold text-pits-text tabular-nums truncate">
                {formatAmount(payment)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-pits-dim">{t('Method')}</dt>
              <dd className="text-sm font-semibold text-pits-text truncate mt-1">
                {payment.method || '—'}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium text-pits-dim">{t('Submitted')}</dt>
              <dd className="text-sm font-semibold text-pits-text truncate mt-1">{submitted}</dd>
            </div>
          </dl>

          {hasProof ? (
            <a
              href={payment.proof_image_url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block rounded-lg bg-pits-surface-muted overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={payment.proof_image_url ?? undefined}
                alt={t('Check Proof')}
                onError={() => setImageFailed(true)}
                className="w-full max-h-72 object-contain"
              />
              <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-pits-black/70 px-2 py-1 text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                {t('Open full size')} <ExternalLink size={12} />
              </span>
            </a>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-pits-warning-edge bg-pits-warning-soft p-3">
              <AlertTriangle size={16} className="shrink-0 text-pits-warning mt-0.5" />
              <p className="text-sm font-medium text-pits-warning">
                {payment.proof_image_url
                  ? t('The proof image could not be loaded.')
                  : t('No proof attached to this payment.')}
              </p>
            </div>
          )}

          {payment.proof_image_url ? (
            <PaymentProofReader
              paymentId={payment.id}
              proofHref={payment.proof_image_url}
              showProofLink={false}
            />
          ) : null}

          {rejecting ? (
            <div className="space-y-1.5">
              <label htmlFor="reject-reason" className="text-xs font-medium text-pits-dim">
                {t('Reason (optional, shown to the athlete)')}
              </label>
              <textarea
                id="reject-reason"
                autoFocus
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setRejecting(false);
                  }
                }}
                className="w-full bg-pits-surface-muted border border-pits-edge rounded-xl px-3 py-2 text-sm text-pits-text outline-none focus:ring-2 focus:ring-pits-primary/40 resize-none"
              />
            </div>
          ) : null}
        </div>

        <div className="p-4 border-t border-pits-edge flex gap-2">
          {rejecting ? (
            <>
              <button
                type="button"
                onClick={() => setRejecting(false)}
                disabled={busy}
                className="h-10 px-4 rounded-xl border border-pits-edge text-pits-text text-sm font-semibold disabled:opacity-50"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={() => void reject()}
                disabled={busy}
                className="h-10 flex-1 px-4 rounded-xl bg-pits-danger text-white text-sm font-semibold disabled:opacity-50"
              >
                {t('Confirm rejection')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setRejecting(true)}
                disabled={busy}
                className="h-10 px-4 rounded-xl border border-pits-danger-edge text-pits-danger text-sm font-semibold disabled:opacity-50"
              >
                {t('Reject')}
              </button>
              <button
                type="button"
                onClick={() => void approve()}
                disabled={busy}
                className={`h-10 flex-1 px-4 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                  confirmNoProof
                    ? 'bg-pits-warning text-white'
                    : 'bg-pits-primary text-pits-dark-text hover:bg-pits-primary-dark'
                }`}
              >
                {confirmNoProof ? (
                  t('Approve without proof?')
                ) : (
                  <>
                    <CheckCircle size={16} />
                    {t('Approve')}
                  </>
                )}
              </button>
            </>
          )}
        </div>
    </>
  );
}
