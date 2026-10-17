'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Eye, Loader2, Sparkles } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import PaymentProofPreviewModal from '@/components/PaymentProofPreviewModal';
import type {
  AmountMatch,
  PaymentProofExtraction,
  PlanPriceComparison,
} from '@/lib/ai/payment-proof-extract';

type Comparison = {
  claimedAmount: number;
  claimedCurrency: string;
  amountMatch: AmountMatch;
  periodRemaining: number | null;
};

type DuplicatePayment = {
  id: string;
  created_at: string;
  user_id: string;
};

export type PaymentProofReadResult = {
  extraction: PaymentProofExtraction;
  comparison: Comparison;
  planComparison?: PlanPriceComparison | null;
  duplicatePayment?: DuplicatePayment | null;
  proofUrl: string;
};

type ApiResponse = Partial<PaymentProofReadResult> & {
  error?: string;
  unavailable?: boolean;
  proofUrl?: string;
  comparison?: Comparison;
};

const sessionCache = new Map<string, ApiResponse>();

function matchBadgeClass(match: AmountMatch): string {
  if (match === 'match') return 'bg-green-50 text-green-700 border-green-200';
  if (match === 'mismatch') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-amber-50 text-amber-800 border-amber-200';
}

function Field({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: { text: string; className: string };
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-pits-dim">{label}</p>
        <p className="text-xs font-bold text-pits-text truncate">{value}</p>
      </div>
      {badge ? (
        <span
          className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${badge.className}`}
        >
          {badge.text}
        </span>
      ) : null}
    </div>
  );
}

export default function PaymentProofReader({
  paymentId,
  proofHref,
}: {
  paymentId: string;
  proofHref?: string | null;
}) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const cached = sessionCache.get(paymentId);
      if (cached) {
        if (!cancelled) {
          setResult(cached);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const response = await fetch('/api/admin/payments/read-proof', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId }),
        });
        const data = (await response.json().catch(() => ({}))) as ApiResponse;
        sessionCache.set(paymentId, data);
        if (!cancelled) setResult(data);
      } catch {
        const fallback: ApiResponse = {
          error: 'Proof reader is unavailable.',
          unavailable: true,
        };
        sessionCache.set(paymentId, fallback);
        if (!cancelled) setResult(fallback);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  const proofUrl = result?.proofUrl || proofHref || '';
  const extraction = result?.extraction;
  const comparison = result?.comparison;
  const amountMatch = comparison?.amountMatch ?? 'unknown';

  const amountBadge =
    amountMatch === 'match'
      ? { text: t('Amount matches'), className: matchBadgeClass('match') }
      : amountMatch === 'mismatch'
        ? { text: t('Amount mismatch'), className: matchBadgeClass('mismatch') }
        : { text: t('Amount unclear'), className: matchBadgeClass('unknown') };

  return (
    <div className="rounded-xl border border-pits-edge bg-pits-surface-muted/50 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-pits-dim">
          <Sparkles size={12} className="text-pits-primary" />
          {t('Proof reader')}
        </div>
        {proofUrl ? (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-blue-500 hover:underline"
          >
            {t('Check Proof')} <Eye size={10} />
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-pits-dim font-medium">
          <Loader2 size={14} className="animate-spin" />
          {t('Reading proof…')}
        </div>
      ) : result?.unavailable || !extraction ? (
        <p className="text-xs text-pits-dim font-medium leading-relaxed">
          {typeof result?.error === 'string' && result.error
            ? result.error
            : t('Proof reader unavailable. Review the image manually.')}
        </p>
      ) : (
        <div className="space-y-2.5">
          {result?.duplicatePayment ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2">
              <AlertTriangle size={14} className="shrink-0 text-red-600 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase text-red-800">
                  {t('Duplicate reference detected')}
                </p>
                <p className="text-[9px] text-red-700 mt-0.5">
                  {t('This reference was already used in another payment.')}
                </p>
              </div>
            </div>
          ) : null}
          <Field
            label={t('Extracted amount')}
            value={
              extraction.amount != null
                ? `${extraction.amount.toLocaleString()}${extraction.currency ? ` ${extraction.currency}` : ''}`
                : t('Not found')
            }
            badge={amountBadge}
          />
          {result?.planComparison && result.planComparison.expectedAmount > 0 ? (
            <div className="rounded-lg border border-pits-edge bg-pits-surface/50 p-2 space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-pits-dim">
                {t('Plan price comparison')}
              </p>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] text-pits-dim font-medium">{t('Expected')}:</span>
                <span className="text-xs font-bold text-pits-text">
                  {result.planComparison.expectedAmount.toLocaleString()}{' '}
                  {result.planComparison.expectedCurrency}
                </span>
              </div>
              {result.planComparison.conversionApplied && result.planComparison.conversionRate ? (
                <p className="text-[9px] text-pits-dim italic">
                  {t('BCV rate')}: {result.planComparison.conversionRate.toFixed(2)}
                </p>
              ) : null}
              {result.planComparison.match === 'mismatch' ? (
                <p className="text-[10px] font-bold text-amber-700">
                  {t('Amount differs from expected plan price')}
                </p>
              ) : null}
            </div>
          ) : null}
          <Field
            label={t('Payment date')}
            value={extraction.paid_at || t('Not found')}
          />
          <Field
            label={t('Reference')}
            value={extraction.reference || t('Not found')}
          />
          {extraction.bank ? (
            <Field label={t('Bank')} value={extraction.bank} />
          ) : null}
          {comparison ? (
            <p className="text-[10px] text-pits-dim font-medium leading-relaxed">
              {t('Claimed')}: {comparison.claimedAmount.toLocaleString()}
              {comparison.claimedCurrency ? ` ${comparison.claimedCurrency}` : ''}
              {comparison.periodRemaining != null
                ? ` · ${t('Period remaining')}: ${comparison.periodRemaining.toLocaleString()}`
                : ''}
            </p>
          ) : null}
          {extraction.confidence === 'low' || amountMatch === 'mismatch' ? (
            <p className="text-[10px] font-bold text-amber-700">
              {t('AI assist only — confirm before approving.')}
            </p>
          ) : (
            <p className="text-[10px] font-medium text-pits-dim">
              {t('AI assist only — confirm before approving.')}
            </p>
          )}
          {extraction.raw_notes ? (
            <p className="text-[10px] text-pits-dim italic">{extraction.raw_notes}</p>
          ) : null}
        </div>
      )}

      {previewOpen ? (
        <PaymentProofPreviewModal
          url={proofUrl}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}
