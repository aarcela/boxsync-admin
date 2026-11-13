'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, Loader2, X } from 'lucide-react';
import { useToast } from './Toast';
import { useLanguage } from './LanguageContext';
import { useTenant } from './TenantContext';
import { financialService } from '@/lib/services/financialService';
import { currencySymbol } from '@/lib/currency';
import type { PaymentMethod } from '@/lib/types/gym';

interface RegisterPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after the payment is saved (refresh lists / profile). */
  onSaved: () => void;
  athlete: { id: string; full_name: string | null } | null;
}

const labelClass = 'block text-sm font-semibold text-pits-ink mb-1.5';
const inputClass =
  'w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-base font-medium text-pits-ink focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none disabled:opacity-50';

/**
 * Mount it only while open (parent renders it conditionally with a key) so each
 * opening starts from a clean form.
 *
 * Record a payment taken at the desk (cash, transfer seen in person). Saved as
 * approved and renews the membership once the plan price is covered.
 */
export default function RegisterPaymentModal({ isOpen, onClose, onSaved, athlete }: RegisterPaymentModalProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { tenantId, currencies } = useTenant();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodId, setMethodId] = useState<string>('');
  const [currency, setCurrency] = useState<string>(currencies.reference);
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const athleteId = athlete?.id ?? null;
  const hasLocal = Boolean(currencies.local) && currencies.local !== currencies.reference;
  const isLocal = hasLocal && currency === currencies.local;

  useEffect(() => {
    if (!isOpen || !athleteId) return;
    let cancelled = false;

    Promise.all([
      financialService.getPaymentMethods().catch(() => [] as PaymentMethod[]),
      financialService.getMemberPeriodBalance(athleteId).catch(() => null),
    ]).then(([allMethods, balance]) => {
      if (cancelled) return;
      const active = allMethods.filter((m) => m.is_active);
      setMethods(active);
      // Cash first: this screen exists mostly for the front desk.
      const cash = active.find((m) => m.method_type === 'efectivo');
      setMethodId(cash?.id ?? active[0]?.id ?? '');
      if (balance && balance.remaining > 0) {
        setRemaining(balance.remaining);
        setAmount(String(Math.round(balance.remaining * 100) / 100));
      }
    });

    if (hasLocal) {
      financialService
        .getEffectiveExchangeRate(tenantId, currencies.reference)
        .then((r) => {
          if (!cancelled) setRate(r > 0 ? r : null);
        })
        .catch(() => {
          if (!cancelled) setRate(null);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, athleteId, tenantId, currencies.reference, hasLocal]);

  const parsedAmount = Number(amount.replace(',', '.'));
  const referenceAmount = useMemo(() => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return null;
    if (!isLocal) return parsedAmount;
    return rate ? Math.round((parsedAmount / rate) * 100) / 100 : null;
  }, [parsedAmount, isLocal, rate]);

  if (!isOpen || !athlete) return null;

  const selectedMethod = methods.find((m) => m.id === methodId);
  const canSave =
    !saving && Number.isFinite(parsedAmount) && parsedAmount > 0 && (!isLocal || referenceAmount != null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/payments/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: athlete.id,
          amount: parsedAmount,
          currency,
          referenceAmount,
          exchangeRate: isLocal ? rate : null,
          paymentMethodId: selectedMethod?.id ?? null,
          method: selectedMethod?.label ?? t('Cash'),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('Could not save the payment.'));
      toast(
        data.activated
          ? t('Payment saved. Membership renewed.')
          : t('Payment saved. The plan is not fully paid yet.'),
        'success',
      );
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('Could not save the payment.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-pits-black/50 backdrop-blur-sm">
      <div className="bg-pits-surface-elevated border border-pits-edge rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-5 py-4 border-b border-pits-edge flex justify-between items-center">
          <div className="min-w-0">
            <h3 className="font-bold text-lg text-pits-ink">{t('Register payment')}</h3>
            <p className="text-sm text-pits-ink-muted truncate">{athlete.full_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="p-2 hover:bg-pits-surface-muted rounded-full text-pits-ink-muted hover:text-pits-ink"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={save} className="p-5 space-y-4">
          <div>
            <label className={labelClass}>{t('Amount')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${inputClass} flex-1`}
                placeholder="0.00"
              />
              {hasLocal ? (
                <div className="flex rounded-lg border border-pits-edge overflow-hidden shrink-0" role="group">
                  {[currencies.reference, currencies.local].map((code) => (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={currency === code}
                      onClick={() => setCurrency(code)}
                      className={`px-3 text-sm font-semibold ${
                        currency === code ? 'bg-pits-text text-white' : 'bg-pits-surface-muted text-pits-ink'
                      }`}
                    >
                      {currencySymbol(code)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <p className="text-xs text-pits-ink-muted mt-1">
              {remaining != null
                ? t('Pending this period: {{amount}}', {
                    amount: `${currencySymbol(currencies.reference)}${remaining.toFixed(2)}`,
                  })
                : null}
              {isLocal && referenceAmount != null
                ? ` ${remaining != null ? '·' : ''} ≈ ${currencySymbol(currencies.reference)}${referenceAmount.toFixed(2)}`
                : null}
              {isLocal && rate == null ? t('Exchange rate unavailable — use the reference currency.') : null}
            </p>
          </div>

          <div>
            <label className={labelClass}>{t('Method')}</label>
            {methods.length > 0 ? (
              <select value={methodId} onChange={(e) => setMethodId(e.target.value)} className={inputClass}>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-pits-ink">{t('Cash')}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSave}
            className="w-full min-h-12 rounded-lg flex items-center justify-center gap-2 bg-pits-primary text-pits-dark-text font-bold text-base hover:bg-pits-primary-dark disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Banknote size={18} />}
            {t('Save payment')}
          </button>
        </form>
      </div>
    </div>
  );
}
