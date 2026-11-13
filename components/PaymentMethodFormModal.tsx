'use client';

import { useState, useTransition } from 'react';
import { Zap } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import type { PaymentMethod, PaymentMethodFields, PaymentMethodType } from '@/lib/types/gym';
import {
  PAYMENT_METHOD_FIELD_DEFS,
  PAYMENT_METHOD_TYPE_LABELS,
  PAYMENT_METHOD_TYPES,
} from '@/lib/payment-method-fields';
import { currencySymbol, defaultCurrencyForMethodType } from '@/lib/currency';
import {
  createPaymentMethodAction,
  updatePaymentMethodAction,
} from '@/app/(tenants)/[slug]/dashboard/payment_methods/actions';

type FormState = {
  label: string;
  currency: string;
  method_type: PaymentMethodType;
  fields: PaymentMethodFields;
  details: string;
  is_active: boolean;
};

/**
 * Add / edit a payment method. Shared by Settings → How they pay and the setup assistant.
 * Render it only while open, so the form starts from `method` (or blank) every time.
 */
export default function PaymentMethodFormModal({
  method,
  effectiveRate,
  onClose,
  onSaved,
}: {
  method?: PaymentMethod | null;
  effectiveRate?: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { currencies } = useTenant();
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState<FormState>(() =>
    method
      ? {
          label: method.label,
          currency:
            method.currency === currencies.local || method.currency === currencies.reference
              ? method.currency
              : defaultCurrencyForMethodType(method.method_type || 'otro', currencies),
          method_type: method.method_type || 'otro',
          fields: method.fields || {},
          details: method.details || '',
          is_active: method.is_active,
        }
      : {
          label: '',
          currency: currencies.local,
          method_type: 'pago_movil',
          fields: {},
          details: '',
          is_active: true,
        },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.label) return;

    startTransition(async () => {
      try {
        const form = new FormData();
        form.append('label', formData.label);
        form.append('currency', formData.currency);
        form.append('method_type', formData.method_type);
        form.append('details', formData.details);
        form.append('is_active', String(formData.is_active));
        if (formData.method_type !== 'otro') {
          for (const def of PAYMENT_METHOD_FIELD_DEFS[formData.method_type]) {
            form.append(`field_${def.key}`, formData.fields[def.key] || '');
          }
        }

        if (method) {
          await updatePaymentMethodAction(method.id, form);
          toast(t('Payment method updated'), 'success');
        } else {
          await createPaymentMethodAction(form);
          toast(t('Payment method created'), 'success');
        }
        onSaved();
        onClose();
      } catch {
        toast(t('Action failed'), 'error');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-pits-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-pits-surface-elevated rounded-[40px] w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-pits-edge animate-in fade-in zoom-in duration-200">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-black text-pits-text tracking-tighter uppercase">
                {method ? t('Edit Method') : t('Add Method')}
              </h2>
              <p className="text-[11px] font-bold text-pits-dim uppercase tracking-widest mt-1">
                {t('Payment Channel Configuration')}
              </p>
            </div>
            <div className="p-3 bg-pits-primary-soft text-pits-red rounded-2xl"><Zap size={20} fill="currentColor"/></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
               <label className="text-[11px] font-black text-pits-dim uppercase ml-1">{t('Method Name / Label')}</label>
               <input
                 type="text"
                 placeholder={t('e.g. Bank Transfer Zelle')}
                 required
                 autoFocus
                 value={formData.label}
                 onChange={(e) => setFormData({...formData, label: e.target.value})}
                 className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-red focus:bg-pits-surface-elevated transition-all placeholder:text-pits-dim"
               />
            </div>

            <div className="space-y-2">
               <label className="text-[11px] font-black text-pits-dim uppercase ml-1">{t('Method Type')}</label>
               <select
                 value={formData.method_type}
                 onChange={(e) => {
                   const method_type = e.target.value as PaymentMethodType;
                   setFormData((prev) => ({
                     ...prev,
                     method_type,
                     fields: {},
                     currency: defaultCurrencyForMethodType(method_type, currencies),
                   }));
                 }}
                 className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
               >
                 {PAYMENT_METHOD_TYPES.map((type) => (
                   <option key={type} value={type}>{t(PAYMENT_METHOD_TYPE_LABELS[type])}</option>
                 ))}
               </select>
            </div>

            <div className="space-y-2">
               <label className="text-[11px] font-black text-pits-dim uppercase ml-1">{t('Athletes pay in')}</label>
               <div className="grid grid-cols-2 gap-2">
                 <button
                   type="button"
                   onClick={() => setFormData({ ...formData, currency: currencies.local })}
                   className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                     formData.currency === currencies.local
                       ? 'border-pits-red bg-pits-primary-soft'
                       : 'border-pits-edge bg-pits-surface-muted'
                   }`}
                 >
                   <div className="text-[11px] font-black uppercase text-pits-dim">{t('Local')}</div>
                   <div className="text-xs font-black text-pits-text mt-0.5">
                     {currencies.local} ({currencySymbol(currencies.local)})
                   </div>
                 </button>
                 <button
                   type="button"
                   onClick={() => setFormData({ ...formData, currency: currencies.reference })}
                   className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                     formData.currency === currencies.reference
                       ? 'border-pits-red bg-pits-primary-soft'
                       : 'border-pits-edge bg-pits-surface-muted'
                   }`}
                 >
                   <div className="text-[11px] font-black uppercase text-pits-dim">{t('Reference')}</div>
                   <div className="text-xs font-black text-pits-text mt-0.5">
                     {currencies.reference} ({currencySymbol(currencies.reference)})
                   </div>
                 </button>
               </div>
               <p className="text-[11px] text-pits-dim font-medium">
                 {formData.currency === currencies.local
                   ? (effectiveRate
                       ? t('Local method converts the plan. Example: {{plan}} {{ref}} → {{localAmount}} {{local}}', {
                           plan: '30',
                           ref: currencies.reference,
                           localAmount: (30 * effectiveRate).toLocaleString(undefined, { maximumFractionDigits: 2 }),
                           local: currencies.local,
                         })
                       : t('Local methods convert the plan price using the box exchange rate.'))
                   : t('Reference methods charge the same amount as the plan (no conversion).')}
               </p>
            </div>

            <div className="space-y-2">
                  <label className="text-[11px] font-black text-pits-dim uppercase ml-1">{t('Status')}</label>
                  <select
                    value={String(formData.is_active)}
                    onChange={(e) => setFormData({...formData, is_active: e.target.value === 'true'})}
                    className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
                  >
                    <option value="true">{t('Active')}</option>
                    <option value="false">{t('Inactive')}</option>
                  </select>
            </div>

            {formData.method_type === 'otro' ? (
              <div className="space-y-2">
                 <label className="text-[11px] font-black text-pits-dim uppercase ml-1">{t('Details / Instructions')}</label>
                 <textarea
                   rows={3}
                   placeholder={t('Account number, bank name, etc.')}
                   value={formData.details}
                   onChange={(e) => setFormData({...formData, details: e.target.value})}
                   className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-red focus:bg-pits-surface-elevated transition-all placeholder:text-pits-dim resize-none"
                 />
              </div>
            ) : (
              PAYMENT_METHOD_FIELD_DEFS[formData.method_type].map((def) => (
                <div key={def.key} className="space-y-2">
                   <label className="text-[11px] font-black text-pits-dim uppercase ml-1">{t(def.label)}</label>
                   <input
                     type="text"
                     value={formData.fields[def.key] || ''}
                     onChange={(e) =>
                       setFormData((prev) => ({
                         ...prev,
                         fields: { ...prev.fields, [def.key]: e.target.value },
                       }))
                     }
                     className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-red focus:bg-pits-surface-elevated transition-all placeholder:text-pits-dim"
                   />
                </div>
              ))
            )}

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-4 bg-pits-surface-muted text-pits-dim rounded-2xl text-[11px] font-black uppercase hover:bg-pits-surface-muted transition-all border border-pits-edge/50"
              >
                {t('Cancel')}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-[2] py-4 bg-pits-primary text-pits-dark-text rounded-2xl text-[11px] font-black uppercase shadow-xl shadow-pits-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
              >
                {isPending ? t('Processing...') : method ? t('Save Changes') : t('Confirm Method')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
