'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  Trash2, 
  PieChart, 
  Plus, 
  Calendar, 
  ArrowUpRight, 
  TrendingDown, 
  Search,
  Filter,
  RefreshCw,
  Wallet,
  Zap,
  Info
} from 'lucide-react';
import { useToast } from '../../../components/Toast';
import { useLanguage } from '../../../components/LanguageContext';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import { expenseService } from '@/lib/services/expenseService';
import { financialService } from '@/lib/services/financialService';
import { ExpenseRecord, ExpenseCategory, CurrencyType, PaymentMethod } from '@/lib/types/gym';


const CATEGORIES: ExpenseCategory[] = [
  'Staff', 'Rent', 'Utilities', 'Maintenance', 'Services', 'Marketing', 'Taxes', 'Other'
];

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

  const fetchData = async () => {
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
    } catch (error) {
      console.error(error);
      toast('Failed to sync financial data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

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

      toast('Operational cost recorded', 'success');
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
    } catch (error) {
      toast('Authorization failed: Could not record expense', 'error');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await expenseService.deleteExpense(id);
      toast('Record purged from ledger', 'success');
      fetchData();
    } catch (error) {
      toast('Purge sequence failed', 'error');
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
      toast('Status updated', 'success');
      fetchData();
    } catch (error) {
      toast('Failed to update status', 'error');
    } finally {
      setStatusConfirm(null);
    }
  };

  // Calculations
  const stats = useMemo(() => {
    let totalEUR = 0;
    let categoryTotals: Record<string, number> = {};

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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">
              {t('Cost Command')}
            </h1>
            <div className="bg-red-100 px-2 py-0.5 rounded text-[10px] font-bold text-pits-red border border-red-200 tracking-widest uppercase shadow-sm">
              {t('Expenditure Ledger')}
            </div>
          </div>
          <p className="text-slate-400 text-xs font-semibold mt-1 tracking-wide uppercase">
            {t('Strategic resource monitoring and burn-rate tracking')}
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
          color="red"
          icon={<ArrowUpRight size={20}/>}
        />
        <StatBlock 
          label={t('Top Expenditure')} 
          value={stats.topCategory} 
          symbol="" 
          info={t('Highest cost category')} 
          color="slate"
          icon={<PieChart size={20}/>}
        />
        <StatBlock 
          label={t('Exchange Buffer')} 
          value={exchangeRate} 
          symbol="Bs." 
          info={t('Live Reference Rate')} 
          color="emerald"
          icon={<RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: THE LEDGER (8 COLS) */}
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
                   className={`px-4 py-1.5 text-[9px] font-black rounded-lg transition-all ${viewCurrency === CurrencyType.EUR ? 'bg-pits-surface-elevated text-pits-red shadow-sm' : 'text-slate-400'}`}
                 >{t('EUR DISPLAY')}</button>
                 <button 
                   onClick={() => setViewCurrency(CurrencyType.VES)}
                   className={`px-4 py-1.5 text-[9px] font-black rounded-lg transition-all ${viewCurrency === CurrencyType.VES ? 'bg-pits-surface-elevated text-pits-red shadow-sm' : 'text-slate-400'}`}
                 >{t('VES DISPLAY')}</button>
              </div>
            </div>

            <table className="w-full text-left">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Expense Date</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('Registry')}</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('Category')}</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Payment Method</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('Status' as any)}</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('Value')}</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">{t('Action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={7} className="py-20 text-center text-slate-300 font-bold uppercase animate-pulse">Scanning Archive...</td></tr>
                ) : filteredExpenses.map(ex => (
                  <tr key={ex.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="text-[11px] font-black text-slate-900">{new Date(ex.expense_date).toLocaleDateString()}</div>
                      <div className="text-[9px] font-bold text-slate-400 mt-0.5">{ex.expense_date}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-slate-900 uppercase">{ex.description}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase border border-slate-200">
                        {ex.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold text-slate-600">
                        {paymentMethods.find(m => m.id === ex.payment_method)?.label || ex.payment_method || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleUpdateStatus(ex.id, ex.status || 'pending')}
                        className={`px-2 py-1 rounded text-[9px] font-black uppercase border transition-all hover:scale-105 active:scale-95 ${ex.status === 'paid' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : ex.status === 'due' ? 'bg-red-100 text-red-600 border-red-200' : 'bg-amber-100 text-amber-600 border-amber-200'}`}
                      >
                        {t((ex.status || 'pending') as any)}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-slate-900 tracking-tighter">
                          {viewCurrency === CurrencyType.EUR ? '€' : 'Bs.'}
                          {(viewCurrency === CurrencyType.EUR 
                            ? (ex.currency === CurrencyType.EUR ? ex.amount : ex.amount / ex.exchange_rate_at_time)
                            : (ex.currency === CurrencyType.VES ? ex.amount : ex.amount * ex.exchange_rate_at_time)
                          ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[8px] text-slate-400 font-bold uppercase">
                          ({ex.amount.toLocaleString()} {ex.currency})
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteExpense(ex.id)}
                        className="p-2 text-slate-300 hover:text-pits-red transition-colors active:scale-90"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && filteredExpenses.length === 0 && (
                  <tr><td colSpan={7} className="py-20 text-center text-slate-300 font-bold uppercase">Zero costs in this sector.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: BREAKDOWN & TOOLS (4 COLS) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Zap size={80} className="text-white" />
            </div>
            <div className="relative z-10">
              <h3 className="text-sm font-black text-white uppercase tracking-tighter mb-6 flex items-center gap-2">
                <Wallet size={18} className="text-pits-red" /> {t('Resource Distribution')}
              </h3>
              <div className="space-y-4">
                {stats.categoryBreakdown.map(([cat, total]) => (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex justify-between items-end">
                      <p className="text-[9px] font-black text-slate-400 uppercase">{cat}</p>
                      <span className="text-[10px] font-black text-white">€{total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                      <div 
                        className="h-full rounded-full bg-pits-red shadow-[0_0_8px_rgba(225,29,72,0.5)] transition-all duration-1000" 
                        style={{ width: `${(total / stats.totalEUR) * 100}%` }} 
                      />
                    </div>
                  </div>
                ))}
                {stats.categoryBreakdown.length === 0 && (
                  <p className="text-center py-6 text-slate-500 text-[10px] font-black uppercase border border-dashed border-slate-800 rounded-2xl">Awaiting data...</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-pits-surface-elevated rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-xs font-black text-slate-900 uppercase flex items-center gap-2">
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
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <div className="relative bg-pits-surface-elevated rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{t('Record Cost')}</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t('Operational Expenditure Registry')}</p>
                </div>
                <div className="p-3 bg-red-50 text-pits-red rounded-2xl"><Zap size={20} fill="currentColor"/></div>
              </div>

              <form onSubmit={handleAddExpense} className="space-y-5">
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase ml-1">{t('Context / Description')}</label>
                   <input 
                     type="text" 
                     placeholder={t('e.g. Electricity Bill - April')}
                     required
                     value={newExpense.description}
                     onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                     className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-pits-red focus:bg-pits-surface-elevated transition-all placeholder:text-slate-300"
                   />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">{t('Sector')}</label>
                      <select 
                        value={newExpense.category}
                        onChange={(e) => setNewExpense({...newExpense, category: e.target.value as ExpenseCategory})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-pits-red"
                      >
                        {CATEGORIES.map(c => <option key={c} value={t(c)}>{t(c)}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">{t('Currency')}</label>
                      <select 
                        value={newExpense.currency}
                        onChange={(e) => setNewExpense({...newExpense, currency: e.target.value as CurrencyType})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-pits-red"
                      >
                        <option value={CurrencyType.EUR}>EUR (€)</option>
                        <option value={CurrencyType.VES}>VES (Bs.)</option>
                      </select>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">{t('Amount')}</label>
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00"
                        required
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-pits-red focus:bg-pits-surface-elevated transition-all"
                      />
                   </div>
                   <div className="space-y-2 relative">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">{t('Official Rate')}</label>
                      <div className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-500 cursor-not-allowed flex items-center justify-between">
                         <span>{exchangeRate.toFixed(4)}</span>
                         <span className="text-[8px] opacity-70">VES/EUR</span>
                      </div>
                      <div className="absolute -bottom-4 right-2 text-[7px] font-black text-emerald-500 uppercase tracking-widest">{t('Live Reference')}</div>
                   </div>
                </div>                <div className="grid grid-cols-2 gap-4 mt-5">
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">{t('Registry Date')}</label>
                      <input 
                        type="date" 
                        value={newExpense.expense_date}
                        onChange={(e) => setNewExpense({...newExpense, expense_date: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-pits-red"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-1">{t('Status' as any)}</label>
                      <select 
                        value={newExpense.status}
                        onChange={(e) => setNewExpense({...newExpense, status: e.target.value as 'pending' | 'paid' | 'due'})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-pits-red"
                      >
                        <option value="pending">{t('Pending' as any)}</option>
                        <option value="paid">{t('Paid' as any)}</option>
                        <option value="due">{t('Due' as any)}</option>
                      </select>
                   </div>
                </div>

                <div className="space-y-2 mt-4">
                   <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Payment Method</label>
                   <select 
                     value={newExpense.payment_method}
                     onChange={(e) => setNewExpense({...newExpense, payment_method: e.target.value})}
                     className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-pits-red"
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
                    className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[11px] font-black uppercase hover:bg-slate-100 transition-all border border-slate-200/50"
                  >
                    {t('Cancel')}
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-pits-primary text-pits-dark-text rounded-2xl text-[11px] font-black uppercase shadow-xl shadow-pits-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
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
        title="Change Status"
        message={statusConfirm ? `Change status to "${statusConfirm.nextStatus.toUpperCase()}"? This will update the record immediately.` : ''}
        confirmLabel="Yes, Update"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={confirmStatusChange}
        onCancel={() => setStatusConfirm(null)}
      />

    </div>
  );
}

// --- CORE UI COMPONENTS ---

function StatBlock({ label, value, symbol, info, color, icon }: any) {
  const colors: Record<string, string> = {
    red: 'text-pits-red bg-red-50 border-red-100',
    slate: 'text-slate-600 bg-slate-50 border-slate-100',
    emerald: 'text-emerald-500 bg-emerald-50 border-emerald-100'
  };

  return (
    <div className="bg-pits-surface-elevated p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
          <div className="flex items-baseline gap-1 mt-1">
             <span className="text-sm font-black text-slate-400">{symbol}</span>
             <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
               {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: value > 1000 ? 0 : 2 }) : value}
             </h2>
          </div>
        </div>
        <div className={`p-3 rounded-2xl border ${colors[color]} shadow-sm`}>
           {icon}
        </div>
      </div>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1">
        <Info size={10} /> {info}
      </p>
    </div>
  );
}

function InsightRow({ label, text, variant }: any) {
  const styles: Record<string, string> = {
    warning: 'bg-amber-50 text-amber-700 border-amber-100',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    info: 'bg-blue-50 text-blue-700 border-blue-100'
  };

  return (
    <div className={`p-3 rounded-2xl border ${styles[variant]}`}>
       <p className="text-[8px] font-black uppercase mb-0.5 opacity-60">{label}</p>
       <p className="text-[10px] font-bold uppercase">{text}</p>
    </div>
  );
}
