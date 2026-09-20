'use client';

import { useState, useEffect, useTransition } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Wallet, 
  CheckCircle2, 
  XCircle,
  MoreVertical,
  Search,
  Zap,
  Info,
  CreditCard
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { paymentMethodService } from '@/lib/services/paymentMethodService';
import { tenantCurrencyService } from '@/lib/services/tenantCurrencyService';
import { tenantExchangeRateService } from '@/lib/services/tenantExchangeRateService';
import { tenantSupportService } from '@/lib/services/tenantSupportService';
import { PaymentMethod, PaymentMethodType, PaymentMethodFields } from '@/lib/types/gym';
import {
  PAYMENT_METHOD_FIELD_DEFS,
  PAYMENT_METHOD_TYPE_LABELS,
  PAYMENT_METHOD_TYPES,
} from '@/lib/payment-method-fields';
import { financialService } from '@/lib/services/financialService';
import {
  CUSTOM_CURRENCY_VALUE,
  DEFAULT_EXCHANGE_RATE_CONFIG,
  LOCAL_CURRENCY_OPTIONS,
  REFERENCE_CURRENCY_OPTIONS,
  computeEffectiveRate,
  currencyOptionLabel,
  currencySymbol,
  defaultCurrencyForMethodType,
  normalizeCurrencyCode,
  supportsLiveFx,
  type ExchangeRateSource,
  type TenantExchangeRateConfig,
} from '@/lib/currency';
import { 
  createPaymentMethodAction, 
  updatePaymentMethodAction, 
  deletePaymentMethodAction,
  togglePaymentMethodStatusAction 
} from './actions';

function currencySelectValue(code: string, options: string[]) {
  return options.includes(code) ? code : CUSTOM_CURRENCY_VALUE;
}

export default function PaymentMethodsPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { tenantId: contextTenantId, currencies, setCurrencies } = useTenant();
  const [isPending, startTransition] = useTransition();

  // State
  const [loading, setLoading] = useState(true);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodToDelete, setMethodToDelete] = useState<string | null>(null);
  const [savingMoney, setSavingMoney] = useState(false);
  const [draftCurrencies, setDraftCurrencies] = useState(currencies);
  const [rateConfig, setRateConfig] = useState<TenantExchangeRateConfig>(DEFAULT_EXCHANGE_RATE_CONFIG);
  const [supportWhatsApp, setSupportWhatsApp] = useState('');
  const [savingSupport, setSavingSupport] = useState(false);
  const [livePromedio, setLivePromedio] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    label: string;
    currency: string;
    method_type: PaymentMethodType;
    fields: PaymentMethodFields;
    details: string;
    is_active: boolean;
  }>({
    label: '',
    currency: currencies.local,
    method_type: 'pago_movil',
    fields: {},
    details: '',
    is_active: true
  });

  useEffect(() => {
    setDraftCurrencies(currencies);
  }, [currencies]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      currency:
        prev.currency === currencies.reference || prev.currency === currencies.local
          ? prev.currency
          : currencies.reference,
    }));
  }, [currencies.reference, currencies.local]);

  useEffect(() => {
    if (!supportsLiveFx(draftCurrencies) && rateConfig.baseSource !== 'custom') {
      setRateConfig((prev) => ({ ...prev, baseSource: 'custom' }));
    }
  }, [draftCurrencies.reference, draftCurrencies.local, rateConfig.baseSource]);

  const fetchMethods = async (activeTenantId: string) => {
    setLoading(true);
    try {
      const data = await paymentMethodService.getPaymentMethods(activeTenantId);
      setMethods(data);
    } catch (error) {
      console.error(error);
      toast(t('Failed to load payment methods'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadContext = async () => {
      const id = contextTenantId;
      setTenantId(id);
      if (id) {
        await fetchMethods(id);
        try {
          const [rate, support] = await Promise.all([
            tenantExchangeRateService.getForTenant(id),
            tenantSupportService.getForTenant(id),
          ]);
          setRateConfig(rate);
          setSupportWhatsApp(support);
        } catch (error) {
          console.error(error);
        }
      } else {
        setLoading(false);
      }
    };

    loadContext();
  }, [contextTenantId]);

  useEffect(() => {
    if (rateConfig.baseSource === 'custom') {
      setLivePromedio(null);
      return;
    }
    if (!supportsLiveFx(draftCurrencies)) {
      setLivePromedio(null);
      return;
    }
    let cancelled = false;
    financialService
      .getReferenceExchangeRate(
        draftCurrencies.reference,
        rateConfig.baseSource === 'paralelo' ? 'paralelo' : 'oficial'
      )
      .then((promedio) => {
        if (!cancelled) setLivePromedio(promedio > 0 ? promedio : null);
      })
      .catch(() => {
        if (!cancelled) setLivePromedio(null);
      });
    return () => {
      cancelled = true;
    };
  }, [draftCurrencies.reference, draftCurrencies.local, rateConfig.baseSource]);

  const effectiveRate = computeEffectiveRate(rateConfig, livePromedio);

  const handleSaveMoneySettings = async () => {
    if (!tenantId) return;
    const reference = normalizeCurrencyCode(draftCurrencies.reference);
    const local = normalizeCurrencyCode(draftCurrencies.local);
    if (!reference || !local) {
      toast(t('Enter a valid 3-letter currency code'), 'error');
      return;
    }
    if (reference === local) {
      toast(t('Reference and local currencies must differ'), 'error');
      return;
    }
    if (rateConfig.baseSource === 'custom' && !(rateConfig.customRate && rateConfig.customRate > 0)) {
      toast(t('Enter a custom exchange rate greater than zero'), 'error');
      return;
    }
    if (rateConfig.baseSource !== 'custom' && !supportsLiveFx({ reference, local })) {
      toast(t('Official and parallel rates are only available for USD/EUR vs VES. Use a custom rate.'), 'error');
      return;
    }
    setSavingMoney(true);
    try {
      const [savedCurrencies, savedRate] = await Promise.all([
        tenantCurrencyService.updateForTenant(tenantId, { reference, local }),
        tenantExchangeRateService.updateForTenant(tenantId, {
          ...rateConfig,
          customRate: rateConfig.baseSource === 'custom' ? rateConfig.customRate : null,
        }),
      ]);
      setCurrencies(savedCurrencies);
      setDraftCurrencies(savedCurrencies);
      setRateConfig(savedRate);
      toast(t('Money settings saved'), 'success');
    } catch (error) {
      console.error(error);
      toast(t('Failed to save money settings'), 'error');
    } finally {
      setSavingMoney(false);
    }
  };

  const handleSaveSupport = async () => {
    if (!tenantId) return;
    setSavingSupport(true);
    try {
      const saved = await tenantSupportService.updateForTenant(tenantId, supportWhatsApp);
      setSupportWhatsApp(saved);
      toast(t('Support WhatsApp saved'), 'success');
    } catch (error) {
      console.error(error);
      toast(t('Failed to save support WhatsApp'), 'error');
    } finally {
      setSavingSupport(false);
    }
  };

  const handleOpenForm = (method?: PaymentMethod) => {
    if (method) {
      setEditingMethod(method);
      setFormData({
        label: method.label,
        currency:
          method.currency === currencies.local || method.currency === currencies.reference
            ? method.currency
            : defaultCurrencyForMethodType(method.method_type || 'otro', currencies),
        method_type: method.method_type || 'otro',
        fields: method.fields || {},
        details: method.details || '',
        is_active: method.is_active
      });
    } else {
      setEditingMethod(null);
      setFormData({
        label: '',
        currency: currencies.local,
        method_type: 'pago_movil',
        fields: {},
        details: '',
        is_active: true
      });
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

        if (editingMethod) {
          await updatePaymentMethodAction(editingMethod.id, form);
          toast(t('Payment method updated'), 'success');
        } else {
          await createPaymentMethodAction(form);
          toast(t('Payment method created'), 'success');
        }
        
        setIsFormOpen(false);
        if (tenantId) fetchMethods(tenantId);
      } catch (error) {
        toast(t('Action failed'), 'error');
      }
    });
  };

  const handleDelete = async () => {
    if (!methodToDelete) return;
    
    startTransition(async () => {
      try {
        await deletePaymentMethodAction(methodToDelete);
        toast(t('Payment method deleted'), 'success');
        setMethodToDelete(null);
        if (tenantId) fetchMethods(tenantId);
      } catch (error) {
        toast(t('Delete failed'), 'error');
      }
    });
  };

  const handleToggleStatus = async (method: PaymentMethod) => {
    startTransition(async () => {
      try {
        await togglePaymentMethodStatusAction(method.id, !method.is_active);
        toast(t('Status updated'), 'success');
        if (tenantId) fetchMethods(tenantId);
      } catch (error) {
        toast(t('Toggle failed'), 'error');
      }
    });
  };

  const filteredMethods = methods.filter(m => {
    const term = searchTerm.toLowerCase();
    return (
      m.label.toLowerCase().includes(term) ||
      m.details?.toLowerCase().includes(term) ||
      Object.values(m.fields || {}).some((v) => v.toLowerCase().includes(term))
    );
  });

  function methodSummary(method: PaymentMethod): string {
    if (method.method_type && method.method_type !== 'otro') {
      const defs = PAYMENT_METHOD_FIELD_DEFS[method.method_type];
      const parts = defs
        .map((def) => method.fields?.[def.key])
        .filter((v): v is string => !!v);
      return parts.length ? parts.join(' · ') : t('No details provided');
    }
    return method.details || t('No details provided');
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-0">
      
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-pits-edge">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-pits-text tracking-tighter uppercase">
              {t('Payment Methods')}
            </h1>
            <div className="bg-pits-primary-soft px-2 py-0.5 rounded text-[10px] font-bold text-pits-red border border-pits-edge tracking-widest uppercase shadow-sm">
              {t('System Config')}
            </div>
          </div>
          <p className="text-pits-dim text-xs font-semibold mt-1 tracking-wide uppercase">
            {t('Manage accepted payment channels and configurations')}
          </p>
        </div>

        <button 
          onClick={() => handleOpenForm()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-pits-primary text-pits-dark-text rounded-2xl text-[11px] font-black uppercase shadow-lg shadow-pits-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Plus size={18} />
          {t('Add Method')}
        </button>
      </div>

      {/* BOX MONEY */}
      <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight text-pits-text">
              {t('Box money')}
            </h2>
            <p className="text-[11px] text-pits-dim font-semibold mt-1 uppercase tracking-wide">
              {t('Plans are priced in the reference. Local methods convert at your rate.')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveMoneySettings}
            disabled={savingMoney}
            className="px-5 py-2.5 bg-pits-primary text-pits-dark-text rounded-xl text-[10px] font-black uppercase shadow-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {savingMoney ? t('Processing...') : t('Save money settings')}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Reference currency')}</label>
            <select
              value={currencySelectValue(draftCurrencies.reference, REFERENCE_CURRENCY_OPTIONS)}
              onChange={(e) => {
                const value = e.target.value;
                setDraftCurrencies((prev) => ({
                  ...prev,
                  reference: value === CUSTOM_CURRENCY_VALUE ? (REFERENCE_CURRENCY_OPTIONS.includes(prev.reference) ? '' : prev.reference) : value,
                }));
              }}
              className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
            >
              {REFERENCE_CURRENCY_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {currencyOptionLabel(code, 'reference')}
                </option>
              ))}
              <option value={CUSTOM_CURRENCY_VALUE}>{t('Custom')}</option>
            </select>
            {currencySelectValue(draftCurrencies.reference, REFERENCE_CURRENCY_OPTIONS) === CUSTOM_CURRENCY_VALUE && (
              <input
                type="text"
                maxLength={3}
                placeholder="USD"
                value={draftCurrencies.reference}
                onChange={(e) =>
                  setDraftCurrencies((prev) => ({
                    ...prev,
                    reference: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3),
                  }))
                }
                className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red uppercase"
              />
            )}
            <p className="text-[10px] text-pits-dim font-medium">{t('What membership plans are priced in (Zelle, Binance).')}</p>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Local currency')}</label>
            <select
              value={currencySelectValue(draftCurrencies.local, LOCAL_CURRENCY_OPTIONS)}
              onChange={(e) => {
                const value = e.target.value;
                setDraftCurrencies((prev) => ({
                  ...prev,
                  local: value === CUSTOM_CURRENCY_VALUE ? (LOCAL_CURRENCY_OPTIONS.includes(prev.local) ? '' : prev.local) : value,
                }));
              }}
              className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
            >
              {LOCAL_CURRENCY_OPTIONS.filter((code) => code !== draftCurrencies.reference).map(
                (code) => (
                  <option key={code} value={code}>
                    {currencyOptionLabel(code, 'local')}
                  </option>
                )
              )}
              <option value={CUSTOM_CURRENCY_VALUE}>{t('Custom')}</option>
            </select>
            {currencySelectValue(draftCurrencies.local, LOCAL_CURRENCY_OPTIONS) === CUSTOM_CURRENCY_VALUE && (
              <input
                type="text"
                maxLength={3}
                placeholder="VES"
                value={draftCurrencies.local}
                onChange={(e) =>
                  setDraftCurrencies((prev) => ({
                    ...prev,
                    local: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3),
                  }))
                }
                className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red uppercase"
              />
            )}
            <p className="text-[10px] text-pits-dim font-medium">{t('What athletes pay locally (Pago Móvil, cash).')}</p>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Exchange rate')}</label>
            <select
              value={rateConfig.baseSource}
              onChange={(e) =>
                setRateConfig((prev) => ({
                  ...prev,
                  baseSource: e.target.value as ExchangeRateSource,
                }))
              }
              className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
            >
              <option value="oficial" disabled={!supportsLiveFx(draftCurrencies)}>
                {t('Official')}
              </option>
              <option value="paralelo" disabled={!supportsLiveFx(draftCurrencies)}>
                {t('Parallel')}
              </option>
              <option value="custom">{t('Custom')}</option>
            </select>
            {rateConfig.baseSource === 'custom' ? (
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="1"
                value={rateConfig.customRate ?? ''}
                onChange={(e) =>
                  setRateConfig((prev) => ({
                    ...prev,
                    customRate: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
                className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
              />
            ) : (
              <input
                type="number"
                step="0.1"
                placeholder={t('Margin %')}
                value={rateConfig.marginPercent}
                onChange={(e) =>
                  setRateConfig((prev) => ({ ...prev, marginPercent: Number(e.target.value) || 0 }))
                }
                className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
              />
            )}
            <p className="text-[10px] text-pits-dim font-medium">
              {rateConfig.baseSource === 'custom'
                ? `${t('Custom rate')}: 1 ${draftCurrencies.reference || 'REF'} = ${rateConfig.customRate || '—'} ${draftCurrencies.local || 'LOC'}`
                : `${t('Margin %')} · ${t('Official and parallel use Venezuela live rates.')}`}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-pits-edge bg-pits-surface-muted px-4 py-3">
          <p className="text-[10px] font-black uppercase text-pits-dim mb-1">{t('Athlete checkout preview')}</p>
          {effectiveRate ? (
            <p className="text-xs font-bold text-pits-text">
              {t('Local method example')}: 30 {draftCurrencies.reference} → {(30 * effectiveRate).toLocaleString(undefined, { maximumFractionDigits: 2 })} {draftCurrencies.local}
              {'  ·  '}
              {t('Reference method example')}: 30 {draftCurrencies.reference} → 30 {draftCurrencies.reference}
            </p>
          ) : (
            <p className="text-xs font-bold text-pits-dim">
              {rateConfig.baseSource === 'custom'
                ? t('Enter a custom rate to preview conversion.')
                : t('Live rate unavailable. Switch to custom or check the pair.')}
            </p>
          )}
        </div>
      </div>

      {/* SUPPORT WHATSAPP */}
      <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight text-pits-text">
              {t('Support WhatsApp')}
            </h2>
            <p className="text-[11px] text-pits-dim font-semibold mt-1 uppercase tracking-wide">
              {t('Shown to athletes in the app as your box support contact')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveSupport}
            disabled={savingSupport}
            className="px-5 py-2.5 bg-pits-primary text-pits-dark-text rounded-xl text-[10px] font-black uppercase shadow-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {savingSupport ? t('Processing...') : t('Save WhatsApp')}
          </button>
        </div>
        <input
          type="text"
          placeholder="https://wa.me/58XXXXXXXXXX"
          value={supportWhatsApp}
          onChange={(e) => setSupportWhatsApp(e.target.value)}
          className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
        />
      </div>

      {/* CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LIST */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm overflow-hidden min-h-[400px]">
            <div className="px-6 py-4 border-b border-pits-edge flex flex-col md:flex-row justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim" size={16} />
                <input 
                  type="text" 
                  placeholder={t('Search methods...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-pits-surface-muted border border-pits-edge rounded-xl text-[10px] font-bold uppercase outline-none focus:ring-2 focus:ring-pits-red transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-pits-surface-elevated">
                  <tr>
                    <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">{t('Method')}</th>
                    <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">{t('Currency')}</th>
                    <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">{t('Status')}</th>
                    <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest text-right">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pits-edge">
                  {loading ? (
                    <tr><td colSpan={4} className="py-20 text-center text-pits-dim font-bold uppercase animate-pulse">{t('Initializing Data Stream...')}</td></tr>
                  ) : filteredMethods.map(method => (
                    <tr key={method.id} className="hover:bg-pits-surface-elevated transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${method.is_active ? 'bg-pits-surface-muted text-pits-text' : 'bg-pits-surface-muted text-pits-dim'}`}>
                            <CreditCard size={16} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-pits-text uppercase tracking-tight">{method.label}</span>
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-pits-surface-muted text-pits-dim border border-pits-edge">
                                {t(PAYMENT_METHOD_TYPE_LABELS[method.method_type || 'otro'])}
                              </span>
                            </div>
                            <div className="text-[10px] text-pits-dim font-medium truncate max-w-[200px]">{methodSummary(method)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase border ${method.currency === currencies.reference ? 'bg-pits-surface-muted text-pits-primary border-pits-edge' : 'bg-pits-primary-soft text-pits-success border-pits-edge'}`}>
                          {method.currency === currencies.reference
                            ? `${t('Reference')} · ${method.currency}`
                            : `${t('Local')} · ${method.currency}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => handleToggleStatus(method)}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-black uppercase border transition-all ${method.is_active ? 'bg-pits-primary-soft text-pits-success border-pits-edge' : 'bg-pits-surface-muted text-pits-dim border-pits-edge'}`}
                        >
                          {method.is_active ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                          {method.is_active ? t('Active') : t('Inactive')}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => handleOpenForm(method)}
                            className="p-2 text-pits-dim hover:text-pits-text hover:bg-pits-surface-muted rounded-lg transition-all"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => setMethodToDelete(method.id)}
                            className="p-2 text-pits-dim hover:text-pits-red hover:bg-pits-primary-soft rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && filteredMethods.length === 0 && (
                    <tr><td colSpan={4} className="py-20 text-center text-pits-dim font-bold uppercase">{t('No records found.')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* INFO PANEL */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-pits-surface-elevated rounded-3xl p-6 shadow-xl border border-pits-edge relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Wallet size={80} className="text-pits-text" />
            </div>
            <div className="relative z-10">
              <h3 className="text-sm font-black text-pits-text uppercase tracking-tighter mb-4 flex items-center gap-2">
                <Zap size={18} className="text-pits-red" /> {t('Strategic Overview')}
              </h3>
              <p className="text-pits-dim text-[11px] font-medium leading-relaxed mb-6">
                {t('Configure how your box receives payments. These methods will be available for athletes during check-out and for administrative manual registry.')}
              </p>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-pits-ink/5 rounded-2xl border border-pits-edge">
                  <span className="text-[10px] font-bold text-pits-dim uppercase">{t('Total Methods')}</span>
                  <span className="text-sm font-black text-pits-text">{methods.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-pits-ink/5 rounded-2xl border border-pits-edge">
                  <span className="text-[10px] font-bold text-pits-dim uppercase">{t('Active Channels')}</span>
                  <span className="text-sm font-black text-pits-success">{methods.filter(m => m.is_active).length}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-pits-surface-elevated rounded-3xl p-6 border border-pits-edge shadow-sm space-y-4">
            <h3 className="text-xs font-black text-pits-text uppercase flex items-center gap-2">
              <Info size={14} className="text-pits-red" /> {t('System Tips')}
            </h3>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-pits-red mt-1.5 shrink-0" />
                <p className="text-[10px] font-bold text-pits-dim uppercase tracking-tight">{t('Keep at least one REF and one local method active for operational flexibility.')}</p>
              </li>
              <li className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-pits-red mt-1.5 shrink-0" />
                <p className="text-[10px] font-bold text-pits-dim uppercase tracking-tight">{t('Details appear on athlete invoices. Provide clear instructions for bank transfers.')}</p>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* MODAL FORM */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-pits-black/60 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <div className="relative bg-pits-surface-elevated rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl border border-pits-edge animate-in fade-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-pits-text tracking-tighter uppercase">
                    {editingMethod ? t('Edit Method') : t('Add Method')}
                  </h2>
                  <p className="text-[10px] font-bold text-pits-dim uppercase tracking-widest mt-1">
                    {t('Payment Channel Configuration')}
                  </p>
                </div>
                <div className="p-3 bg-pits-primary-soft text-pits-red rounded-2xl"><Zap size={20} fill="currentColor"/></div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Method Name / Label')}</label>
                   <input 
                     type="text" 
                     placeholder={t('e.g. Bank Transfer Zelle')}
                     required
                     value={formData.label}
                     onChange={(e) => setFormData({...formData, label: e.target.value})}
                     className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-red focus:bg-pits-surface-elevated transition-all placeholder:text-pits-dim"
                   />
                </div>

                <div className="space-y-2">
                   <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Method Type')}</label>
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
                   <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Athletes pay in')}</label>
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
                       <div className="text-[9px] font-black uppercase text-pits-dim">{t('Local')}</div>
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
                       <div className="text-[9px] font-black uppercase text-pits-dim">{t('Reference')}</div>
                       <div className="text-xs font-black text-pits-text mt-0.5">
                         {currencies.reference} ({currencySymbol(currencies.reference)})
                       </div>
                     </button>
                   </div>
                   <p className="text-[10px] text-pits-dim font-medium">
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
                      <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Status')}</label>
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
                     <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Details / Instructions')}</label>
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
                       <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t(def.label)}</label>
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
                    onClick={() => setIsFormOpen(false)}
                    className="flex-1 py-4 bg-pits-surface-muted text-pits-dim rounded-2xl text-[11px] font-black uppercase hover:bg-pits-surface-muted transition-all border border-pits-edge/50"
                  >
                    {t('Cancel')}
                  </button>
                  <button 
                    type="submit"
                    disabled={isPending}
                    className="flex-[2] py-4 bg-pits-primary text-pits-dark-text rounded-2xl text-[11px] font-black uppercase shadow-xl shadow-pits-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                  >
                    {isPending ? t('Processing...') : editingMethod ? t('Save Changes') : t('Confirm Method')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!methodToDelete}
        title={t('Delete Method')}
        message={t('Are you sure you want to permanently delete this payment method? This action cannot be undone.')}
        confirmLabel={t('Yes, Delete')}
        cancelLabel={t('Cancel')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setMethodToDelete(null)}
      />

    </div>
  );
}
