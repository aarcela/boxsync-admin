'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Trash2,
  PieChart,
  Plus,
  Calendar,
  ArrowDownLeft,
  TrendingUp,
  Search,
  RefreshCw,
  Wallet,
  Info,
} from 'lucide-react';
import { useToast } from '../../../components/Toast';
import { useLanguage } from '../../../components/LanguageContext';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import { incomeService } from '@/lib/services/incomeService';
import { financialService } from '@/lib/services/financialService';
import {
  IncomeRecord,
  IncomeCategory,
  IncomeStatus,
  CurrencyType,
  PaymentMethod,
} from '@/lib/types/gym';
import type { TranslationKey } from '@/lib/translations';

const CATEGORIES: IncomeCategory[] = [
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

export default function IncomePage() {
  const { toast } = useToast();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [exchangeRate, setExchangeRate] = useState(545.9483);
  const [selectedPeriod, setSelectedPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewCurrency, setViewCurrency] = useState<CurrencyType>(CurrencyType.EUR);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; description: string } | null>(null);

  const [newIncome, setNewIncome] = useState({
    description: '',
    category: 'other_income' as IncomeCategory,
    amount: '',
    currency: CurrencyType.EUR,
    income_date: new Date().toISOString().split('T')[0],
    status: 'confirmed' as IncomeStatus,
    payment_method: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const rate = await financialService.getOfficialExchangeRate();
      setExchangeRate(rate);

      const year = parseInt(selectedPeriod.split('-')[0]);
      const month = parseInt(selectedPeriod.split('-')[1]);
      const start = `${selectedPeriod}-01`;
      const end = new Date(year, month, 0).toISOString().split('T')[0];

      const [methods, data] = await Promise.all([
        financialService.getPaymentMethods(),
        incomeService.getIncomes(start, end),
      ]);
      setPaymentMethods(methods);
      setIncomes(data);
    } catch (error) {
      console.error(error);
      toast('Failed to sync income data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncome.description || !newIncome.amount) return;

    try {
      const amountNum = parseFloat(newIncome.amount);
      if (amountNum <= 0) return;

      const { data: { user } } = await supabase.auth.getUser();

      await incomeService.addIncome({
        description: newIncome.description,
        category: newIncome.category,
        amount: amountNum,
        currency: newIncome.currency,
        exchange_rate_at_time: exchangeRate,
        income_date: newIncome.income_date,
        created_by: user?.id,
        status: newIncome.status,
        payment_method: newIncome.payment_method || undefined,
      });

      toast('Operational income recorded', 'success');
      setIsFormOpen(false);
      setNewIncome({
        description: '',
        category: 'other_income',
        amount: '',
        currency: CurrencyType.EUR,
        income_date: new Date().toISOString().split('T')[0],
        status: 'confirmed',
        payment_method: '',
      });
      fetchData();
    } catch {
      toast('Authorization failed: Could not record income', 'error');
    }
  };

  const handleDeleteIncome = async () => {
    if (!deleteConfirm) return;
    try {
      await incomeService.deleteIncome(deleteConfirm.id);
      toast('Record purged from ledger', 'success');
      fetchData();
    } catch {
      toast('Purge sequence failed', 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const stats = useMemo(() => {
    let totalEUR = 0;
    const categoryTotals: Record<string, number> = {};

    incomes
      .filter((inc) => inc.status === 'confirmed')
      .forEach((inc) => {
        const val =
          inc.currency === CurrencyType.EUR
            ? inc.amount
            : inc.amount / inc.exchange_rate_at_time;

        totalEUR += val;
        categoryTotals[inc.category] = (categoryTotals[inc.category] || 0) + val;
      });

    const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);

    return {
      totalEUR,
      topCategory: sortedCategories[0]?.[0] || 'N/A',
      categoryBreakdown: sortedCategories,
    };
  }, [incomes]);

  const filteredIncomes = incomes.filter(
    (inc) =>
      inc.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusStyles: Record<IncomeStatus, string> = {
    confirmed: 'bg-emerald-100 text-emerald-600 border-emerald-200',
    pending: 'bg-amber-100 text-amber-600 border-amber-200',
    cancelled: 'bg-red-100 text-red-600 border-red-200',
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-0">

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">
              {t('Income Command')}
            </h1>
            <div className="bg-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold text-emerald-700 border border-emerald-200 tracking-widest uppercase shadow-sm">
              {t('Revenue Ledger')}
            </div>
          </div>
          <p className="text-slate-400 text-xs font-semibold mt-1 tracking-wide uppercase">
            {t('Strategic revenue monitoring and inflow tracking')}
          </p>
        </div>

        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="flex items-center bg-pits-surface-elevated border border-slate-200 rounded-2xl px-4 py-2 shadow-sm transition-all hover:border-pits-red group">
            <Calendar size={16} className="text-slate-400 group-hover:text-pits-red mr-2" />
            <input
              type="month"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-transparent border-none text-[12px] font-black uppercase text-slate-700 outline-none cursor-pointer"
            />
          </div>
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus size={18} />
            {t('Add Income')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatBlock
          label={t('Total Monthly Revenue')}
          value={stats.totalEUR}
          symbol="€"
          info={t('Confirmed income EUR base')}
          color="emerald"
          icon={<ArrowDownLeft size={20} />}
        />
        <StatBlock
          label={t('Top Revenue Source')}
          value={stats.topCategory !== 'N/A' ? t(stats.topCategory as TranslationKey) : 'N/A'}
          symbol=""
          info={t('Highest income category')}
          color="slate"
          icon={<PieChart size={20} />}
        />
        <StatBlock
          label={t('Exchange Buffer')}
          value={exchangeRate}
          symbol="Bs."
          info={t('Live Reference Rate')}
          color="emerald"
          icon={<RefreshCw size={18} className={loading ? 'animate-spin' : ''} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        <div className="lg:col-span-8 space-y-6">
          <div className="bg-pits-surface-elevated rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                  type="text"
                  placeholder={t('Filter records...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold uppercase outline-none focus:ring-2 focus:ring-pits-red transition-all"
                />
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setViewCurrency(CurrencyType.EUR)}
                  className={`px-4 py-1.5 text-[9px] font-black rounded-lg transition-all ${viewCurrency === CurrencyType.EUR ? 'bg-pits-surface-elevated text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                >
                  {t('EUR DISPLAY')}
                </button>
                <button
                  onClick={() => setViewCurrency(CurrencyType.VES)}
                  className={`px-4 py-1.5 text-[9px] font-black rounded-lg transition-all ${viewCurrency === CurrencyType.VES ? 'bg-pits-surface-elevated text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                >
                  {t('VES DISPLAY')}
                </button>
              </div>
            </div>

            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">{t('Registry')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">{t('Context / Description')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">{t('Sector')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">{t('Method')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">{t('Status')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">{t('Amount')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">{t('Control')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-slate-400 font-bold uppercase animate-pulse">
                      {t('Scanning Archive...')}
                    </td>
                  </tr>
                ) : (
                  filteredIncomes.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="text-[11px] font-black text-slate-900">
                          {new Date(inc.income_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-black text-slate-900 uppercase">{inc.description}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase border border-slate-200">
                          {t(inc.category as TranslationKey)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-slate-600">
                          {paymentMethods.find((m) => m.id === inc.payment_method)?.label ||
                            inc.payment_method ||
                            '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded text-[9px] font-black uppercase border ${statusStyles[inc.status]}`}
                        >
                          {t(inc.status as TranslationKey)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-slate-900 tracking-tighter">
                            {viewCurrency === CurrencyType.EUR ? '€' : 'Bs.'}
                            {(viewCurrency === CurrencyType.EUR
                              ? inc.currency === CurrencyType.EUR
                                ? inc.amount
                                : inc.amount / inc.exchange_rate_at_time
                              : inc.currency === CurrencyType.VES
                                ? inc.amount
                                : inc.amount * inc.exchange_rate_at_time
                            ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[8px] text-slate-400 font-bold uppercase">
                            ({inc.amount.toLocaleString()} {inc.currency})
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setDeleteConfirm({ id: inc.id, description: inc.description })}
                          className="p-2 text-slate-300 hover:text-pits-red transition-colors active:scale-90"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                {!loading && filteredIncomes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-slate-300 font-bold uppercase">
                      {t('Zero income in this sector.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-pits-background rounded-3xl p-6 shadow-xl border border-pits-border relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <TrendingUp size={80} className="text-pits-primary" />
            </div>
            <div className="relative z-10">
              <h3 className="text-sm font-black text-pits-primary uppercase tracking-tighter mb-6 flex items-center gap-2">
                <Wallet size={18} className="text-pits-primary" /> {t('Revenue Distribution')}
              </h3>
              <div className="space-y-4">
                {stats.categoryBreakdown.map(([cat, total]) => (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex justify-between items-end">
                      <p className="text-[9px] font-black text-slate-400 uppercase">{t(cat as TranslationKey)}</p>
                      <span className="text-[10px] font-black text-pits-primary">
                        €{total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-pits-background rounded-full overflow-hidden border border-pits-border">
                      <div
                        className="h-full rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-1000"
                        style={{ width: `${stats.totalEUR > 0 ? (total / stats.totalEUR) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
                {stats.categoryBreakdown.length === 0 && (
                  <p className="text-center py-6 text-pits-primary text-[10px] font-black uppercase border border-dashed border-pits-border rounded-2xl">
                    Awaiting data...
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-pits-surface-elevated rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-xs font-black text-slate-900 uppercase flex items-center gap-2">
              <Info size={14} className="text-pits-primary" /> {t('Revenue Insights')}
            </h3>
            <div className="space-y-3">
              <InsightRow
                label={t('Revenue Health')}
                text={
                  stats.totalEUR > 0
                    ? t('Active operational revenue stream.')
                    : t('No confirmed income this period.')
                }
                variant={stats.totalEUR > 0 ? 'pits-success' : 'pits-info'}
               />
              <InsightRow
                label={t('Top Source')}
                text={
                  stats.topCategory !== 'N/A'
                    ? `${t(stats.topCategory as TranslationKey)} ${t('is the primary revenue driver.')}`
                    : t('Awaiting first income entry.')
                }
                variant="pits-info"
              />
            </div>
          </div>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-pits-background backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <div className="relative bg-pits-background rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl border border-pits-border">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-pits-primary tracking-tighter uppercase">{t('Record Income')}</h2>
                  <p className="text-[10px] font-bold text-pits-primary uppercase tracking-widest mt-1">
                    {t('Operational Revenue Registry')}
                  </p>
                </div>
                <div className="p-3 bg-pits-primary text-pits-dark-text rounded-2xl">
                  <DollarSign size={20} />
                </div>
              </div>

              <form onSubmit={handleAddIncome} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">{t('Context / Description')}</label>
                  <input
                    type="text"
                    placeholder={t('e.g. Merch sale - March')}
                    required
                    value={newIncome.description}
                    onChange={(e) => setNewIncome({ ...newIncome, description: e.target.value })}
                    className="w-full bg-pits-background border border-pits-border rounded-2xl px-5 py-3.5 text-xs font-bold text-pits-primary outline-none focus:ring-2 focus:ring-pits-primary focus:bg-pits-surface-elevated transition-all placeholder:text-pits-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-pits-primary uppercase ml-1">{t('Sector')}</label>
                    <select
                      value={newIncome.category}
                      onChange={(e) => setNewIncome({ ...newIncome, category: e.target.value as IncomeCategory })}
                      className="w-full bg-pits-background border border-pits-border rounded-2xl px-5 py-3.5 text-xs font-black text-pits-primary outline-none focus:ring-2 focus:ring-pits-primary"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {t(c as TranslationKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-pits-primary uppercase ml-1">{t('Currency')}</label>
                    <select
                      value={newIncome.currency}
                      onChange={(e) => setNewIncome({ ...newIncome, currency: e.target.value as CurrencyType })}
                      className="w-full bg-pits-background border border-pits-border rounded-2xl px-5 py-3.5 text-xs font-black text-pits-primary outline-none focus:ring-2 focus:ring-pits-primary"
                    >
                      <option value={CurrencyType.EUR}>EUR (€)</option>
                      <option value={CurrencyType.VES}>VES (Bs.)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-pits-primary uppercase ml-1">{t('Amount')}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      required
                      value={newIncome.amount}
                      onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })}
                      className="w-full bg-pits-background border border-pits-border rounded-2xl px-5 py-3.5 text-xs font-bold text-pits-primary outline-none focus:ring-2 focus:ring-pits-primary focus:bg-pits-surface-elevated transition-all"
                    />
                  </div>
                  <div className="space-y-2 relative">
                    <label className="text-[9px] font-black text-pits-primary uppercase ml-1">{t('Official Rate')}</label>
                    <div className="w-full bg-pits-background border border-pits-border rounded-2xl px-5 py-3.5 text-xs font-black text-pits-primary cursor-not-allowed flex items-center justify-between">
                      <span>{exchangeRate.toFixed(4)}</span>
                      <span className="text-[8px] opacity-70">VES/EUR</span>
                    </div>
                    <div className="absolute -bottom-4 right-2 text-[7px] font-black text-emerald-500 uppercase tracking-widest">
                      {t('Live Reference')}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-5">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">{t('Registry Date')}</label>
                    <input
                      type="date"
                      value={newIncome.income_date}
                      onChange={(e) => setNewIncome({ ...newIncome, income_date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">{t('Status')}</label>
                    <select
                      value={newIncome.status}
                      onChange={(e) => setNewIncome({ ...newIncome, status: e.target.value as IncomeStatus })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="confirmed">{t('confirmed' as TranslationKey)}</option>
                      <option value="pending">{t('pending' as TranslationKey)}</option>
                      <option value="cancelled">{t('cancelled' as TranslationKey)}</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">{t('Method')}</label>
                  <select
                    value={newIncome.payment_method}
                    onChange={(e) => setNewIncome({ ...newIncome, payment_method: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">— {t('Select method')} —</option>
                    {paymentMethods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} ({m.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[11px] font-black uppercase hover:bg-slate-100 transition-all border border-slate-200/50"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    {t('Authorize Income Entry')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title={t('Delete Income?')}
        message={
          deleteConfirm
            ? t('Delete income confirm message').replace('{description}', deleteConfirm.description)
            : ''
        }
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        variant="danger"
        onConfirm={handleDeleteIncome}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

function StatBlock({ label, value, symbol, info, color, icon }: {
  label: string;
  value: number | string;
  symbol: string;
  info: string;
  color: string;
  icon: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    red: 'text-pits-red bg-red-50 border-red-100',
    slate: 'text-slate-600 bg-slate-50 border-slate-100',
    emerald: 'text-emerald-500 bg-emerald-50 border-emerald-100',
  };

  return (
    <div className="bg-pits-surface-elevated p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-sm font-black text-slate-400">{symbol}</span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
              {typeof value === 'number'
                ? value.toLocaleString(undefined, { maximumFractionDigits: value > 1000 ? 0 : 2 })
                : value}
            </h2>
          </div>
        </div>
        <div className={`p-3 rounded-2xl border ${colors[color]} shadow-sm`}>{icon}</div>
      </div>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1">
        <Info size={10} /> {info}
      </p>
    </div>
  );
}

function InsightRow({ label, text, variant }: { label: string; text: string; variant: string }) {
  const styles: Record<string, string> = {
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    info: 'bg-blue-50 text-blue-700 border-blue-100',
  };

  return (
    <div className={`p-3 rounded-2xl border ${styles[variant]}`}>
      <p className="text-[8px] font-black uppercase mb-0.5 opacity-60">{label}</p>
      <p className="text-[10px] font-bold uppercase">{text}</p>
    </div>
  );
}
