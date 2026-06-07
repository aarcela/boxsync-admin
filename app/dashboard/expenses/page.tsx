'use client';

import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { 
  PieChart, 
  Plus, 
  Calendar, 
  ArrowUpRight, 
  Search,
  RefreshCw,
  Wallet,
  Zap,
  Info,
  Trash2,
} from 'lucide-react';
import { useToast } from '../../../components/Toast';
import { useLanguage } from '../../../components/LanguageContext';
import ConfirmDialog from '../../../components/ConfirmDialog';
import type { TranslationKey } from '@/lib/translations';
import { supabase } from '@/lib/supabase';
import { expenseService } from '@/lib/services/expenseService';
import { financialService } from '@/lib/services/financialService';
import { ExpenseRecord, ExpenseCategory, CurrencyType, PaymentMethod } from '@/lib/types/gym';


const CATEGORIES: ExpenseCategory[] = [
  'Staff', 'Rent', 'Utilities', 'Maintenance', 'Services', 'Marketing', 'Taxes', 'Other'
];

const expenseStatusKey = (status?: string): TranslationKey => {
  if (status === 'paid' || status === 'due') return status;
  return 'pending';
};

export default function ExpensesPage() {
  const { toast } = useToast();
  const { t } = useLanguage();

  // State
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [exchangeRate, setExchangeRate] = useState(545.9483);
  const [selectedPeriod, setSelectedPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewCurrency, setViewCurrency] = useState<CurrencyType>(CurrencyType.EUR);
  const [statusConfirm, setStatusConfirm] = useState<{ id: string; nextStatus: 'pending' | 'paid' | 'due' } | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Form State
  const [newExpense, setNewExpense] = useState({
    description: '',
    category: 'Other' as ExpenseCategory,
    amount: '',
    currency: CurrencyType.EUR,
    expense_date: new Date().toISOString().split('T')[0],
    status: 'pending' as 'pending' | 'paid' | 'due',
    payment_method: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const rate = await financialService.getOfficialExchangeRate();
      setExchangeRate(rate);

      // Current month range
      const year = parseInt(selectedPeriod.split('-')[0]);
      const month = parseInt(selectedPeriod.split('-')[1]);
      const start = `${selectedPeriod}-01`;
      const end = new Date(year, month, 0).toISOString().split('T')[0];

      const [methods, data] = await Promise.all([
        financialService.getPaymentMethods(),
        expenseService.getExpenses(start, end)
      ]);
      setPaymentMethods(methods);
      setExpenses(data);
    } catch (err) {
      console.error(err);
      toast(t('Failed to sync financial data'), 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.description || !newExpense.amount) return;

    try {
      const amountNum = parseFloat(newExpense.amount);
      const { data: { user } } = await supabase.auth.getUser();

      await expenseService.addExpense({
        description: newExpense.description,
        category: newExpense.category,
        amount: amountNum,
        currency: newExpense.currency,
        exchange_rate_at_time: exchangeRate,
        expense_date: newExpense.expense_date,
        created_by: user?.id,
        status: newExpense.status,
        payment_method: newExpense.payment_method
      });

      toast(t('Operational cost recorded'), 'success');
      setIsFormOpen(false);
      setNewExpense({
        description: '',
        category: 'Other' as ExpenseCategory,
        amount: '',
        currency: CurrencyType.EUR,
        expense_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        payment_method: ''
      });
      fetchData();
    } catch {
      toast(t('Authorization failed: Could not record expense'), 'error');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await expenseService.deleteExpense(id);
      toast(t('Record purged from ledger'), 'success');
      fetchData();
    } catch {
      toast(t('Purge sequence failed'), 'error');
    }
  };

  const handleUpdateStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'pending' ? 'paid' : currentStatus === 'paid' ? 'due' : 'pending';
    setStatusConfirm({ id, nextStatus: nextStatus as 'pending' | 'paid' | 'due' });
  };

  const confirmStatusChange = async () => {
    if (!statusConfirm) return;
    try {
      await expenseService.updateExpenseStatus(statusConfirm.id, statusConfirm.nextStatus);
      toast(t('Status updated'), 'success');
      fetchData();
    } catch {
      toast(t('Failed to update status'), 'error');
    } finally {
      setStatusConfirm(null);
    }
  };

  // Calculations
  const stats = useMemo(() => {
    let totalEUR = 0;
    const categoryTotals: Record<string, number> = {};

    expenses.forEach(ex => {
      const val = ex.currency === CurrencyType.EUR 
        ? ex.amount 
        : ex.amount / ex.exchange_rate_at_time;
      
      totalEUR += val;
      categoryTotals[ex.category] = (categoryTotals[ex.category] || 0) + val;
    });

    const sortedCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a);

    return {
      totalEUR,
      topCategory: sortedCategories[0]?.[0] || 'N/A',
      categoryBreakdown: sortedCategories
    };
  }, [expenses]);

  const filteredExpenses = expenses.filter(ex => 
    ex.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ex.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-0">
      
      {/* 1. COMMAND HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-pits-edge">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-pits-text tracking-tighter uppercase">
              {t('Cost Command')}
            </h1>
            <div className="bg-pits-primary-soft px-2 py-0.5 rounded text-[10px] font-bold text-pits-red border border-pits-edge tracking-widest uppercase shadow-sm">
              {t('Expenditure Ledger')}
            </div>
          </div>
          <p className="text-pits-dim text-xs font-semibold mt-1 tracking-wide uppercase">
            {t('Strategic resource monitoring and burn-rate tracking')}
          </p>
        </div>

        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="flex items-center bg-pits-surface-elevated border border-pits-edge rounded-2xl px-4 py-2 shadow-sm transition-all hover:border-pits-red group">
            <Calendar size={16} className="text-pits-dim group-hover:text-pits-red mr-2" />
            <input 
              type="month" 
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-transparent border-none text-[12px] font-black uppercase text-pits-text outline-none cursor-pointer"
            />
          </div>
          <button 
            onClick={() => setIsFormOpen(true)}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-pits-primary text-pits-dark-text rounded-2xl text-[11px] font-black uppercase shadow-lg shadow-pits-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus size={18} />
            {t('Add Expense')}
          </button>
        </div>
      </div>

      {/* 2. OPERATIONAL VITALS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatBlock 
          label={t('Total Monthly Burn')} 
          value={stats.totalEUR} 
          symbol="€" 
          info={t('Consolidated EUR base')} 
          color="primary"
          icon={<ArrowUpRight size={20}/>}
        />
        <StatBlock 
          label={t('Top Expenditure')} 
          value={stats.topCategory} 
          symbol="" 
          info={t('Highest cost category')} 
          color="muted"
          icon={<PieChart size={20}/>}
        />
        <StatBlock 
          label={t('Exchange Buffer')} 
          value={exchangeRate} 
          symbol="Bs." 
          info={t('Live Reference Rate')} 
          color="success"
          icon={<RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: THE LEDGER (8 COLS) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm overflow-hidden min-h-[400px]">
            <div className="px-6 py-4 border-b border-pits-edge bg-pits-surface-elevated flex flex-col md:flex-row justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim" size={16} />
                <input 
                  type="text" 
                  placeholder={t('Filter records...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-pits-surface-muted border border-pits-edge rounded-xl text-[10px] font-bold text-pits-text placeholder:text-pits-dim uppercase outline-none focus:ring-2 focus:ring-pits-red transition-all"
                />
              </div>
              <div className="flex bg-pits-surface-muted p-1 rounded-xl">
                 <button 
                   onClick={() => setViewCurrency(CurrencyType.EUR)}
                   className={`px-4 py-1.5 text-[9px] font-black rounded-lg transition-all ${viewCurrency === CurrencyType.EUR ? 'bg-pits-surface-elevated text-pits-primary shadow-sm' : 'text-pits-dim'}`}
                 >{t('EUR DISPLAY')}</button>
                 <button 
                   onClick={() => setViewCurrency(CurrencyType.VES)}
                   className={`px-4 py-1.5 text-[9px] font-black rounded-lg transition-all ${viewCurrency === CurrencyType.VES ? 'bg-pits-surface-elevated text-pits-primary shadow-sm' : 'text-pits-dim'}`}
                 >{t('VES DISPLAY')}</button>
              </div>
            </div>

            <table className="w-full text-left">
              <thead className="bg-pits-surface-elevated border-b border-pits-edge">
                <tr>
                  <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">Expense Date</th>
                  <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">{t('Registry')}</th>
                  <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">{t('Category')}</th>
                  <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">{t('Payment Method')}</th>
                  <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">{t('Status')}</th>
                  <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">{t('Value')}</th>
                  <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest text-right">{t('Action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pits-edge">
                {loading ? (
                  <tr><td colSpan={7} className="py-20 text-center text-pits-dim font-bold uppercase animate-pulse">Scanning Archive...</td></tr>
                ) : filteredExpenses.map(ex => (
                  <tr key={ex.id} className="hover:bg-pits-surface-muted/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="text-[11px] font-black text-pits-text">{new Date(ex.expense_date).toLocaleDateString()}</div>
                      <div className="text-[9px] font-bold text-pits-dim mt-0.5">{ex.expense_date}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-pits-text uppercase">{ex.description}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-pits-surface-muted text-pits-dim rounded text-[9px] font-black uppercase border border-pits-edge">
                        {ex.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold text-pits-text">
                        {paymentMethods.find(m => m.id === ex.payment_method)?.label || ex.payment_method || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleUpdateStatus(ex.id, ex.status || 'pending')}
                        className={`px-2 py-1 rounded text-[9px] font-black uppercase border transition-all hover:scale-105 active:scale-95 ${ex.status === 'paid' ? 'bg-pits-primary-soft text-pits-success border-pits-edge' : ex.status === 'due' ? 'bg-pits-primary-soft text-pits-error border-pits-edge' : 'bg-pits-primary-soft text-pits-primary border-pits-edge'}`}
                      >
                        {t(expenseStatusKey(ex.status))}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-pits-text tracking-tighter">
                          {viewCurrency === CurrencyType.EUR ? '€' : 'Bs.'}
                          {(viewCurrency === CurrencyType.EUR 
                            ? (ex.currency === CurrencyType.EUR ? ex.amount : ex.amount / ex.exchange_rate_at_time)
                            : (ex.currency === CurrencyType.VES ? ex.amount : ex.amount * ex.exchange_rate_at_time)
                          ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[8px] text-pits-dim font-bold uppercase">
                          ({ex.amount.toLocaleString()} {ex.currency})
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteExpense(ex.id)}
                        className="p-2 text-pits-dim hover:text-pits-error transition-colors active:scale-90"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && filteredExpenses.length === 0 && (
                  <tr><td colSpan={7} className="py-20 text-center text-pits-dim font-bold uppercase">Zero costs in this sector.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: BREAKDOWN & TOOLS (4 COLS) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-pits-surface-elevated rounded-3xl p-6 shadow-sm border border-pits-edge relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity text-pits-text">
              <Zap size={80} />
            </div>
            <div className="relative z-10">
              <h3 className="text-sm font-black text-pits-text uppercase tracking-tighter mb-6 flex items-center gap-2">
                <Wallet size={18} className="text-pits-red" /> {t('Resource Distribution')}
              </h3>
              <div className="space-y-4">
                {stats.categoryBreakdown.map(([cat, total]) => (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex justify-between items-end">
                      <p className="text-[9px] font-black text-pits-dim uppercase">{cat}</p>
                      <span className="text-[10px] font-black text-pits-text">€{total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="h-1.5 w-full bg-pits-surface-muted rounded-full overflow-hidden border border-pits-edge">
                      <div 
                        className="h-full rounded-full bg-pits-primary transition-all duration-1000" 
                        style={{ width: `${stats.totalEUR > 0 ? (total / stats.totalEUR) * 100 : 0}%` }} 
                      />
                    </div>
                  </div>
                ))}
                {stats.categoryBreakdown.length === 0 && (
                  <p className="text-center py-6 text-pits-dim text-[10px] font-black uppercase border border-dashed border-pits-edge rounded-2xl">Awaiting data...</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-pits-surface-elevated rounded-3xl p-6 border border-pits-edge shadow-sm space-y-6">
            <h3 className="text-xs font-black text-pits-text uppercase flex items-center gap-2">
              <Info size={14} className="text-pits-red" /> {t('Expenditure Insights')}
            </h3>
            <div className="space-y-3">
              <InsightRow 
                label={t('Efficiency Warning')} 
                text={stats.totalEUR > 5000 ? t('Burn rate trending above average.') : t('Stable operational overhead.')}
                variant={stats.totalEUR > 5000 ? 'warning' : 'success'}
              />
              <InsightRow 
                label={t('Top Risk')} 
                text={`${stats.topCategory} ${t('is the primary cost driver.')}`}
                variant="info"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. DRAWERS / MODALS */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-pits-black/60 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <div className="relative bg-pits-surface-elevated rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl border border-pits-edge">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-pits-text tracking-tighter uppercase">{t('Record Cost')}</h2>
                  <p className="text-[10px] font-bold text-pits-dim uppercase tracking-widest mt-1">{t('Operational Expenditure Registry')}</p>
                </div>
                <div className="p-3 bg-pits-primary-soft text-pits-red rounded-2xl"><Zap size={20} fill="currentColor"/></div>
              </div>

              <form onSubmit={handleAddExpense} className="space-y-5">
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Context / Description')}</label>
                   <input 
                     type="text" 
                     placeholder={t('e.g. Electricity Bill - April')}
                     required
                     value={newExpense.description}
                     onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                     className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-red transition-all placeholder:text-pits-dim"
                   />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Sector')}</label>
                      <select 
                        value={newExpense.category}
                        onChange={(e) => setNewExpense({...newExpense, category: e.target.value as ExpenseCategory})}
                        className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
                      >
                        {CATEGORIES.map(c => <option key={c} value={t(c)}>{t(c)}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Currency')}</label>
                      <select 
                        value={newExpense.currency}
                        onChange={(e) => setNewExpense({...newExpense, currency: e.target.value as CurrencyType})}
                        className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
                      >
                        <option value={CurrencyType.EUR}>EUR (€)</option>
                        <option value={CurrencyType.VES}>VES (Bs.)</option>
                      </select>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Amount')}</label>
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00"
                        required
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                        className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-red transition-all placeholder:text-pits-dim"
                      />
                   </div>
                   <div className="space-y-2 relative">
                      <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Official Rate')}</label>
                      <div className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-dim cursor-not-allowed flex items-center justify-between">
                         <span>{exchangeRate.toFixed(4)}</span>
                         <span className="text-[8px] opacity-70">VES/EUR</span>
                      </div>
                      <div className="absolute -bottom-4 right-2 text-[7px] font-black text-pits-success uppercase tracking-widest">{t('Live Reference')}</div>
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-5">
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Registry Date')}</label>
                      <input 
                        type="date" 
                        value={newExpense.expense_date}
                        onChange={(e) => setNewExpense({...newExpense, expense_date: e.target.value})}
                        className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Status')}</label>
                      <select 
                        value={newExpense.status}
                        onChange={(e) => setNewExpense({...newExpense, status: e.target.value as 'pending' | 'paid' | 'due'})}
                        className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
                      >
                        <option value="pending">{t('pending')}</option>
                        <option value="paid">{t('paid')}</option>
                        <option value="due">{t('due')}</option>
                      </select>
                   </div>
                </div>

                <div className="space-y-2 mt-4">
                   <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Payment Method')}</label>
                   <select 
                     value={newExpense.payment_method}
                     onChange={(e) => setNewExpense({...newExpense, payment_method: e.target.value})}
                     className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
                   >
                     <option value="">— Select method —</option>
                     {paymentMethods.map(m => (
                       <option key={m.id} value={m.id}>{m.label} ({m.currency})</option>
                     ))}
                   </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsFormOpen(false)}
                    className="flex-1 py-4 bg-pits-surface-muted text-pits-dim rounded-2xl text-[11px] font-black uppercase hover:bg-pits-edge transition-all border border-pits-edge"
                  >
                    {t('Cancel')}
                  </button>
                  <button 
                    type="submit"
                    className="flex-2 py-4 bg-pits-primary text-pits-dark-text rounded-2xl text-[11px] font-black uppercase shadow-xl shadow-pits-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    {t('Authorize Cost Entry')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!statusConfirm}
        title={t('Change Status')}
        message={statusConfirm ? t('Change status confirm', { status: statusConfirm.nextStatus.toUpperCase() }) : ''}
        confirmLabel={t('Yes, Update')}
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={confirmStatusChange}
        onCancel={() => setStatusConfirm(null)}
      />

    </div>
  );
}

// --- CORE UI COMPONENTS ---

function StatBlock({ label, value, symbol, info, color, icon }: {
  label: string;
  value: number | string;
  symbol: string;
  info: string;
  color: string;
  icon: ReactNode;
}) {
  const accents: Record<string, string> = {
    primary: 'text-pits-primary bg-pits-primary-soft border-pits-edge',
    muted: 'text-pits-dim bg-pits-surface-muted border-pits-edge',
    success: 'text-pits-success bg-pits-primary-soft border-pits-edge',
  };

  return (
    <div className="bg-pits-surface-elevated p-6 rounded-[32px] border border-pits-edge shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-[10px] font-black text-pits-dim uppercase tracking-widest">{label}</p>
          <div className="flex items-baseline gap-1 mt-1">
             <span className="text-sm font-black text-pits-dim">{symbol}</span>
             <h2 className="text-3xl font-black text-pits-text tracking-tighter">
               {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: value > 1000 ? 0 : 2 }) : value}
             </h2>
          </div>
        </div>
        <div className={`p-3 rounded-2xl border ${accents[color] ?? accents.muted} shadow-sm`}>
           {icon}
        </div>
      </div>
      <p className="text-[9px] font-bold text-pits-dim uppercase tracking-tighter flex items-center gap-1">
        <Info size={10} /> {info}
      </p>
    </div>
  );
}

function InsightRow({ label, text, variant }: { label: string; text: string; variant: string }) {
  const styles: Record<string, string> = {
    warning: 'bg-pits-primary-soft text-pits-primary border-pits-edge',
    success: 'bg-pits-primary-soft text-pits-success border-pits-edge',
    info: 'bg-pits-surface-muted text-pits-text border-pits-edge',
  };

  return (
    <div className={`p-3 rounded-2xl border ${styles[variant]}`}>
       <p className="text-[8px] font-black uppercase mb-0.5 text-pits-dim">{label}</p>
       <p className="text-[10px] font-bold uppercase">{text}</p>
    </div>
  );
}
