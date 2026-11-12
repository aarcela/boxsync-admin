'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import { useToast } from '@/components/Toast';
import { incomeService } from '@/lib/services/incomeService';
import { expenseService } from '@/lib/services/expenseService';
import { getGymDate } from '@/lib/utils/date';
import type { TranslationKey } from '@/lib/translations';
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type IncomeCategory,
  type IncomeStatus,
  type PaymentMethod,
} from '@/lib/types/gym';
import type { MovementKind } from '@/lib/money/movements';

/** Manual income categories (membership payments come from the payments flow). */
export const MANUAL_INCOME_CATEGORIES: IncomeCategory[] = [
  'merchandise_sales',
  'supplement_sales',
  'food_beverage_sales',
  'workshops_seminars',
  'events_competitions',
  'space_rental',
  'sponsorships',
  'income_adjustments',
  'other_income',
];

const FIELD =
  'w-full bg-pits-surface-muted border border-pits-edge rounded-xl px-4 py-3 text-sm font-semibold text-pits-text outline-none focus:ring-2 focus:ring-pits-primary/40';
const LABEL = 'text-xs font-semibold text-pits-dim';

export default function MovementForm({
  initialKind,
  exchangeRate,
  paymentMethods,
  onClose,
  onSaved,
}: {
  initialKind: MovementKind;
  exchangeRate: number;
  paymentMethods: PaymentMethod[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { currencies, timezone } = useTenant();
  const [kind, setKind] = useState<MovementKind>(initialKind);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(currencies.reference);
  const [category, setCategory] = useState<string>(initialKind === 'in' ? 'other_income' : 'Other');
  const [date, setDate] = useState(() => getGymDate(new Date(), timezone));
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<string>(initialKind === 'in' ? 'confirmed' : 'paid');
  const [paymentMethod, setPaymentMethod] = useState('');

  const switchKind = (next: MovementKind) => {
    setKind(next);
    setCategory(next === 'in' ? 'other_income' : 'Other');
    setStatus(next === 'in' ? 'confirmed' : 'paid');
  };

  const categoryLabel = (value: string) => t(value as TranslationKey);
  const twoCurrencies = currencies.local !== currencies.reference;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!(value > 0) || !paymentMethod || saving) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const common = {
        description: description.trim() || categoryLabel(category),
        amount: value,
        currency,
        exchange_rate_at_time: exchangeRate,
        created_by: user?.id,
      };
      if (kind === 'in') {
        await incomeService.addIncome({
          ...common,
          category: category as IncomeCategory,
          income_date: date,
          status: status as IncomeStatus,
          payment_method: paymentMethod || undefined,
        });
        toast(t('Operational income recorded'), 'success');
      } else {
        await expenseService.addExpense({
          ...common,
          category: category as ExpenseCategory,
          expense_date: date,
          status: status as 'pending' | 'paid' | 'due',
          payment_method: paymentMethod,
        });
        toast(t('Operational cost recorded'), 'success');
      }
      onSaved();
      onClose();
    } catch {
      toast(
        kind === 'in'
          ? t('Authorization failed: Could not record income')
          : t('Authorization failed: Could not record expense'),
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-pits-background/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('Record')}
        className="w-full max-w-md rounded-2xl border border-pits-edge bg-pits-surface-elevated p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex rounded-lg border border-pits-edge bg-pits-surface-muted p-0.5" role="group">
            {(['in', 'out'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => switchKind(k)}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold ${
                  kind === k
                    ? k === 'in'
                      ? 'bg-pits-positive text-white'
                      : 'bg-pits-danger text-white'
                    : 'text-pits-dim hover:text-pits-text'
                }`}
              >
                {k === 'in' ? t('Money in') : t('Money out')}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="p-2 rounded-lg border border-pits-edge text-pits-dim hover:text-pits-text"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label className={LABEL}>{t('Amount')}</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                required
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`min-w-0 flex-1 ${FIELD.replace('w-full ', '')} text-base`}
              />
              {twoCurrencies ? (
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  aria-label={t('Currency')}
                  className={`w-28 shrink-0 ${FIELD.replace('w-full ', '')}`}
                >
                  <option value={currencies.reference}>{currencies.reference}</option>
                  <option value={currencies.local}>{currencies.local}</option>
                </select>
              ) : null}
            </div>
            {twoCurrencies && currency === currencies.local && exchangeRate > 0 && Number(amount) > 0 ? (
              <p className="text-xs text-pits-dim">
                {t('Counts as {{amount}} {{currency}}', {
                  amount: (Number(amount) / exchangeRate).toFixed(2),
                  currency: currencies.reference,
                })}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className={LABEL} htmlFor="movement-method">
              {t('Payment Method')}
            </label>
            {paymentMethods.length > 0 ? (
              <select
                id="movement-method"
                required
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                  const method = paymentMethods.find((m) => m.id === e.target.value);
                  if (method?.currency) setCurrency(method.currency);
                }}
                className={`${FIELD} ${paymentMethod ? '' : 'text-pits-dim'}`}
              >
                <option value="" disabled>
                  {t('Select method')}
                </option>
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.currency})
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-xl border border-pits-warning-edge bg-pits-warning-soft px-3 py-2.5 text-sm text-pits-warning">
                {t('Add a payment method first.')}{' '}
                <Link href="/dashboard/payment_methods" className="font-semibold underline">
                  {t('How they pay')}
                </Link>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={LABEL}>{t('Category')}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={FIELD}>
                {(kind === 'in' ? MANUAL_INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={LABEL}>{t('Date')}</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className={LABEL}>{t('Status')}</span>
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-pits-edge bg-pits-surface-muted p-1" role="group" aria-label={t('Status')}>
              {(kind === 'in' ? ['confirmed', 'pending', 'cancelled'] : ['paid', 'pending', 'due']).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={status === s}
                  onClick={() => setStatus(s)}
                  className={`h-9 rounded-lg text-sm font-semibold ${
                    status === s ? 'bg-pits-surface-elevated text-pits-text shadow-sm' : 'text-pits-dim hover:text-pits-text'
                  }`}
                >
                  {t(s as TranslationKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={LABEL}>{t('Description (optional)')}</label>
            <input
              type="text"
              placeholder={kind === 'in' ? t('e.g. Merch sale - March') : t('e.g. Electricity Bill - April')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${FIELD} placeholder:text-pits-dim`}
            />
          </div>


          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-4 rounded-xl border border-pits-edge text-sm font-semibold text-pits-text"
            >
              {t('Cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !paymentMethod}
              className="h-11 flex-1 rounded-xl bg-pits-primary text-pits-dark-text text-sm font-semibold disabled:opacity-50"
            >
              {kind === 'in' ? t('Save income') : t('Save expense')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
