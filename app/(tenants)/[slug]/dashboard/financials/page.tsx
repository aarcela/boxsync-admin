'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { 
  DollarSign, Search, CheckCircle, 
  ExternalLink, RefreshCw, Clock, 
  TrendingUp, AlertTriangle, CreditCard,
  Download, BarChart3, ChevronLeft, ChevronRight,
  Zap, Info, Wallet, Calendar
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import PaymentReviewPanel from '@/components/PaymentReviewPanel';
import Tooltip from '@/components/Tooltip';
import { useFinancials } from './hooks/useFinancials';
import { CurrencyStats, CurrencyType } from '@/lib/types/gym';
import { currencySymbol } from '@/lib/currency';
import { TranslationKey } from '@/lib/translations';
import { formatDate, formatTime } from '@/lib/utils/format-date';
import { useLanguage } from '@/components/LanguageContext';

type TranslateFn = (key: TranslationKey, params?: Record<string, string | number>) => string;

const ITEMS_PER_PAGE = 12;

type Period = 'today' | 'week' | 'month' | 'custom';

function toDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseRangeDate(value: string, endOfDay: boolean) {
  const [y, m, d] = value.split('-').map(Number);
  return endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
}

function formatExportRange(period: Period, customRange: { start: Date; end: Date }) {
  if (period === 'custom') {
    return `${toDateInputValue(customRange.start)}_${toDateInputValue(customRange.end)}`;
  }
  return period;
}

export default function FinancialsPage() {
  const { toast } = useToast();
  const { t, lang } = useLanguage();
  
  const [period, setPeriod] = useState<Period>('month');
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    end: new Date()
  });
  
  // Orchestrated Financial Logic
  const {
    loading,
    stats,
    exchangeRate,
    activeCurrency,
    setActiveCurrency,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    payments,
    filteredPayments,
    currentPage,
    setCurrentPage,
    incomes,
    paymentMethods,
    runningExpiry,
    dueCount,
    approve,
    reject,
    runExpiry,
    refresh,
    currencies,
  } = useFinancials(period, period === 'custom' ? customRange : undefined);

  // Daily REF (reference currency) Cash Reconciliation state
  const [reconState, setReconState] = useState({
    opening: 0,
    received: 0,
    withdrawals: 0,
    actual: 0
  });

  const todayStr = toDateInputValue(new Date());

  const isCashRef = (methodRef: string | undefined) => {
    if (!methodRef) return false;
    const methodObj = paymentMethods.find(
      (m) => m.id === methodRef || m.label.toLowerCase() === methodRef.toLowerCase()
    );
    const label = (methodObj?.label || methodRef).toLowerCase();
    return label.includes('cash') || label.includes('efectivo');
  };

  const todayRefCashReceived =
    payments
      .filter(
        (p) =>
          p.status === 'approved' &&
          (p.currency || p.currency_type) === currencies.reference &&
          toDateInputValue(new Date(p.created_at)) === todayStr &&
          isCashRef(p.method)
      )
      .reduce((sum, p) => sum + p.amount, 0) +
    incomes
      .filter(
        (inc) =>
          inc.status === 'confirmed' &&
          inc.currency === currencies.reference &&
          inc.income_date === todayStr &&
          isCashRef(inc.payment_method)
      )
      .reduce((sum, inc) => sum + inc.amount, 0);

  const expectedClosingCash = (Number(reconState.opening) + todayRefCashReceived) - Number(reconState.withdrawals);
  const reconDifference = Number(reconState.actual || 0) - expectedClosingCash;

  const handleAudit = () => {
    if (reconDifference === 0) {
      toast(t('Cash count matches.'), 'success');
    } else {
      const msg = `${reconDifference > 0 ? '+' : ''}${reconDifference.toFixed(2)} ${currencies.reference}`;
      toast(t('Reconciliation mismatch: {{amount}}', { amount: msg }), reconDifference < 0 ? 'error' : 'warning');
    }
  };

  const [expiryConfirmOpen, setExpiryConfirmOpen] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const pendingQueue = filteredPayments.filter((p) => p.status === 'pending');
  const closeReview = useCallback(() => setReviewId(null), []);

  // Paged state (local to UI)
  const paginatedPayments = filteredPayments.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredPayments.length / ITEMS_PER_PAGE);

  // Business calculations
  const refSymbol = currencySymbol(currencies.reference);
  const localSymbol = currencySymbol(currencies.local);
  const combinedTotalRef =
    stats.reference.totalRevenue +
    (exchangeRate > 0 ? stats.local.totalRevenue / exchangeRate : 0);

  const paymentSymbol = (p: { currency?: string | null; currency_type?: string | null }) =>
    currencySymbol(p.currency || p.currency_type || currencies.reference);

  const handleExportCSV = () => {
    const headers = ['Date', 'Athlete', 'Method', 'Amount', 'Currency', 'Status'];
    const csvContent = [
      headers.join(','),
      ...filteredPayments.map(p => [
        new Date(p.created_at).toLocaleDateString(),
        p.profiles?.full_name || 'Anonymous',
        p.method || 'N/A',
        p.amount,
        p.currency || p.currency_type || currencies.reference,
        p.status
      ].map(f => `"${f}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ledger-${formatExportRange(period, customRange)}.csv`;
    link.click();
    toast(t('Financial ledger exported.'), 'success');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto min-w-0 w-full px-1 sm:px-0">
      
      {/* 1. COMMAND HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-pits-edge">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">
              {t('Money overview')}
            </h1>
          </div>
          <p className="text-pits-dim text-xs font-semibold mt-1 tracking-wide uppercase">
            {t('Payments, income and cash for the selected period.')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Exchange rate: read-only here; the gym's rate is saved in Settings → How they pay */}
          <div className="flex items-center gap-3 bg-pits-surface-elevated border border-pits-edge rounded-xl px-3 py-1.5 shadow-sm">
            <span className="text-xs font-semibold text-pits-dim">{t('Official Rate')}</span>
            <span className="text-sm font-bold text-pits-text tabular-nums">
              {refSymbol}1 = {exchangeRate > 0 ? exchangeRate.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'} {currencies.local}
            </span>
            <Link href="/dashboard/payment_methods" className="text-xs font-semibold text-pits-info hover:underline">
              {t('Change')}
            </Link>
          </div>

          <div className="flex items-center gap-2 ml-auto lg:ml-0">
             <button onClick={handleExportCSV} className="p-2.5 bg-pits-surface-elevated border border-pits-edge rounded-xl hover:bg-pits-surface-muted text-pits-text shadow-sm transition-all active:scale-95">
                <Download size={18} />
             </button>
             <button onClick={refresh} className="p-2.5 bg-pits-primary text-pits-dark-text border border-pits-primary-dark rounded-xl hover:bg-pits-primary-dark shadow-sm transition-all active:scale-95">
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
             </button>
          </div>
        </div>
      </div>

      {/* DATE RANGE FILTER */}
      <div className="bg-pits-surface-elevated p-3 rounded-2xl border border-pits-edge shadow-sm flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
        <div className="flex items-center gap-2 text-pits-dim shrink-0">
          <Calendar size={16} className="text-pits-red" />
          <span className="text-[11px] font-black uppercase tracking-widest text-pits-text">{t('Filters')}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 bg-pits-surface-muted p-1 rounded-xl">
          {([
            { id: 'today' as const, label: t('Today') },
            { id: 'week' as const, label: t('This Week') },
            { id: 'month' as const, label: t('This Month') },
            { id: 'custom' as const, label: t('Custom Range') },
          ]).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setPeriod(id);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 text-[11px] font-black rounded-lg uppercase transition-all ${
                period === id ? 'bg-pits-surface-elevated shadow-sm text-pits-primary' : 'text-pits-dim hover:text-pits-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <label className="flex items-center gap-2">
              <span className="text-[11px] font-black text-pits-dim uppercase">{t('From')}</span>
              <input
                type="date"
                value={toDateInputValue(customRange.start)}
                max={toDateInputValue(customRange.end)}
                onChange={(e) => {
                  const start = parseRangeDate(e.target.value, false);
                  setCustomRange(prev => ({
                    start,
                    end: start > prev.end ? start : prev.end,
                  }));
                  setCurrentPage(1);
                }}
                className="bg-pits-surface-muted border border-pits-edge rounded-xl px-3 py-2 text-xs font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-[11px] font-black text-pits-dim uppercase">{t('To')}</span>
              <input
                type="date"
                value={toDateInputValue(customRange.end)}
                min={toDateInputValue(customRange.start)}
                max={toDateInputValue(new Date())}
                onChange={(e) => {
                  setCustomRange(prev => ({
                    ...prev,
                    end: parseRangeDate(e.target.value, true),
                  }));
                  setCurrentPage(1);
                }}
                className="bg-pits-surface-muted border border-pits-edge rounded-xl px-3 py-2 text-xs font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
              />
            </label>
          </div>
        )}
      </div>

      {/* 2. VITALS BAR (KPIs) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label={t('Collected (REF)')} value={stats.reference.totalRevenue} symbol={refSymbol} trend="positive" color="success" />
        <StatCard label={t('Collected (Local)')} value={stats.local.totalRevenue} symbol={localSymbol} trend="positive" color="primary" />
        <StatCard label={t('Consolidated')} value={combinedTotalRef} symbol={refSymbol} trend="neutral" color="muted" info={t('Consolidated REF base')} />
        <StatCard label={t('Pending')} value={stats.reference.pendingAmount + (exchangeRate > 0 ? stats.local.pendingAmount / exchangeRate : 0)} symbol={refSymbol} trend="warning" color="warning" />
        <StatCard label={t('Overdue')} value={stats.overdueAmountREF} symbol={refSymbol} trend="danger" color="danger" />
        <StatCard label={t('Active Athletes')} value={stats.activeMembers} symbol="" trend="neutral" color="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">
        
        {/* MAIN SECTION (LEFT 8 COLS) */}
        <div className="lg:col-span-9 space-y-6 min-w-0">
          
          {/* CURRENCY HUB / COMPARISON */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <CurrencyPanel 
               title={t('REF OPERATIONS')} 
               stats={stats.reference} 
               symbol={refSymbol} 
               color="success" 
               active={activeCurrency === currencies.reference}
               onClick={() => setActiveCurrency(currencies.reference)}
               pendingLabel={t('Pending')}
             />
             <CurrencyPanel 
               title={t('LOCAL OPERATIONS')} 
               stats={stats.local} 
               symbol={localSymbol} 
               color="primary" 
               active={activeCurrency === currencies.local}
               onClick={() => setActiveCurrency(currencies.local)}
               pendingLabel={t('Pending')}
             />
          </div>

          {/* TABLE FILTERS */}
          <div className="bg-pits-surface-elevated p-3 rounded-2xl border border-pits-edge shadow-sm flex flex-col md:flex-row gap-3 items-center">
             <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim" size={16} />
                <input 
                  type="text" 
                  placeholder={t('Search athlete or transaction...')} 
                  className="w-full pl-10 pr-4 py-2.5 bg-pits-surface-muted border border-pits-edge rounded-xl text-xs font-bold text-pits-text placeholder:text-pits-dim focus:ring-2 focus:ring-pits-red outline-none transition-all uppercase"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             <div className="flex gap-2 w-full md:w-auto">
                <select 
                  className="bg-pits-surface-muted border border-pits-edge rounded-xl px-4 py-2.5 text-[11px] font-black text-pits-text uppercase outline-none flex-1 md:w-40"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">{t('Processed & Pending')}</option>
                  <option value="pending">{t('Review Required')}</option>
                  <option value="approved">{t('Verified Only')}</option>
                  <option value="rejected">{t('Rejected Only')}</option>
                </select>
                <div className="flex bg-pits-surface-muted p-1 rounded-xl">
                   <button 
                     onClick={() => setActiveCurrency(currencies.reference)}
                     className={`px-3 py-1.5 text-[11px] font-black rounded-lg transition-all ${activeCurrency === currencies.reference ? 'bg-pits-surface-elevated shadow-sm text-pits-primary' : 'text-pits-dim'}`}
                   >REF</button>
                   <button 
                     onClick={() => setActiveCurrency(currencies.local)}
                     className={`px-3 py-1.5 text-[11px] font-black rounded-lg transition-all ${activeCurrency === currencies.local ? 'bg-pits-surface-elevated shadow-sm text-pits-primary' : 'text-pits-dim'}`}
                   >{currencies.local}</button>
                </div>
             </div>
          </div>

          {/* THE LEDGER TABLE */}
          <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm overflow-hidden min-h-[400px] min-w-0">
             <div className="overflow-x-auto">
             <table className="w-full min-w-[720px] text-left border-collapse">
                <thead className="bg-pits-surface-elevated border-b border-pits-edge">
                  <tr>
                    <th className="px-6 py-4 text-[11px] font-black text-pits-dim uppercase">{t('Date')}</th>
                    <th className="px-6 py-4 text-[11px] font-black text-pits-dim uppercase">{t('Athlete')}</th>
                    <th className="px-6 py-4 text-[11px] font-black text-pits-dim uppercase">{t('Method')}</th>
                    <th className="px-6 py-4 text-[11px] font-black text-pits-dim uppercase">{t('Amount')}</th>
                    <th className="px-6 py-4 text-[11px] font-black text-pits-dim uppercase">{t('Proof')}</th>
                    <th className="px-6 py-4 text-[11px] font-black text-pits-dim uppercase text-right">{t('Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pits-edge">
                  {loading ? (
                    <tr><td colSpan={6} className="py-20 text-center text-pits-dim font-bold uppercase animate-pulse">{t('Loading...')}</td></tr>
                  ) : paginatedPayments.map(p => (
                    <tr key={p.id} className="hover:bg-pits-surface-muted/40 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="text-[11px] font-black text-pits-text">{formatDate(p.created_at, lang)}</div>
                        <div className="text-[11px] text-pits-dim font-bold">{formatTime(p.created_at, lang)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-black text-pits-text uppercase">{p.profiles?.full_name || t('Unknown Athlete')}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className="p-1 bg-pits-surface-muted rounded text-pits-dim"><CreditCard size={10}/></div>
                          <span className="text-[11px] font-black text-pits-text uppercase">{p.method || t('Unknown')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-1">
                            <span className="text-xs font-black text-pits-text">
                               {currencySymbol(activeCurrency)}
                               {p.amount.toLocaleString()}
                            </span>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         {p.proof_image_url ? (
                           <a
                             href={p.proof_image_url}
                             target="_blank"
                             rel="noreferrer"
                             className="inline-flex items-center px-2 py-1 bg-pits-surface-muted text-pits-primary rounded-lg text-[11px] font-black uppercase hover:bg-pits-primary-soft transition-colors"
                           >
                              {t('Check Proof')} <ExternalLink size={10} className="ml-1" />
                           </a>
                         ) : (
                           <span className="text-[11px] font-black uppercase text-pits-dim">—</span>
                         )}
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex justify-end items-center gap-2">
                            {p.status === 'pending' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setReviewId(p.id)}
                                  className="inline-flex items-center gap-1.5 bg-pits-primary text-pits-dark-text px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm hover:bg-pits-primary-dark active:scale-95 transition-all"
                                >
                                  {t('Review')}
                                </button>
                              </>
                            ) : (
                              <div className={`px-2 py-0.5 rounded text-[11px] font-black uppercase border ${p.status === 'approved' ? 'bg-pits-positive-soft text-pits-positive border-pits-positive-edge' : 'bg-pits-danger-soft text-pits-danger border-pits-danger-edge'}`}>
                                {p.status}
                              </div>
                            )}
                         </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPayments.length === 0 && !loading && (
                    <tr><td colSpan={6} className="py-20 text-center text-pits-dim font-bold uppercase">{t('No payments in this period.')}</td></tr>
                  )}
                </tbody>
             </table>
             </div>

             {/* PAGINATION */}
             {totalPages > 1 && (
               <div className="px-6 py-4 bg-pits-surface-elevated border-t border-pits-edge flex justify-between items-center">
                  <p className="text-[11px] font-black text-pits-dim uppercase">{t('{{count}} payments', { count: filteredPayments.length })}</p>
                  <nav className="flex gap-1.5">
                     <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="p-1.5 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-dim disabled:opacity-30"><ChevronLeft size={16}/></button>
                     <div className="flex bg-pits-surface-muted border border-pits-edge rounded-lg p-0.5 px-3 items-center text-[11px] font-black text-pits-text">
                        {currentPage} <span className="mx-2 text-pits-dim">/</span> {totalPages}
                     </div>
                     <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} className="p-1.5 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-dim disabled:opacity-30"><ChevronRight size={16}/></button>
                  </nav>
               </div>
             )}
          </div>
        </div>

        {/* SIDEBAR (RIGHT 3 COLS) */}
        <div className="lg:col-span-3 space-y-6 min-w-0">
          
          {/* CASH RECONCILIATION MOD */}
          <div className="bg-pits-surface-elevated rounded-3xl p-6 shadow-sm border border-pits-edge relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity text-pits-text">
                <Wallet size={20} />
             </div>
             
             <div className="relative z-10">
                <div className="flex items-center gap-2 mb-6">
                   <div className="p-2 bg-pits-primary-soft text-pits-red rounded-lg"><Zap size={18} fill="currentColor"/></div>
                   <h3 className="text-sm font-black text-pits-text uppercase tracking-tighter">{t('Cash count')}</h3>
                </div>

                 <div className="space-y-5">
                    <ReconInput 
                      label={t('Opening Cash')} 
                      symbol={refSymbol} 
                      value={reconState.opening} 
                      onChange={(val) => setReconState(prev => ({ ...prev, opening: Number(val) }))} 
                      systemValue={0} 
                      hideExpected={true}
                      t={t} 
                    />
                    <ReconInput 
                      label={t('Today\'s Inflow')} 
                      symbol={refSymbol} 
                      value={todayRefCashReceived}
                      isReadOnly={true}
                      systemValue={todayRefCashReceived}
                      t={t} 
                    />
                    <ReconInput 
                      label={t('Withdrawals')} 
                      symbol={refSymbol} 
                      value={reconState.withdrawals} 
                      onChange={(val) => setReconState(prev => ({ ...prev, withdrawals: Number(val) }))} 
                      systemValue={0} 
                      hideExpected={true}
                      t={t} 
                    />
                    <ReconInput 
                      label={t('Physical Count')} 
                      symbol={refSymbol} 
                      value={reconState.actual} 
                      onChange={(val) => setReconState(prev => ({ ...prev, actual: Number(val) }))} 
                      systemValue={expectedClosingCash} 
                      t={t} 
                    />
                 </div>

                <div className="mt-8 pt-6 border-t border-pits-edge">
                   <div className="flex justify-between items-end">
                      <div>
                         <p className="text-[11px] font-black text-pits-dim uppercase mb-1">{t('Result')}</p>
                         <p className={`text-xs font-bold flex items-center gap-1 ${(reconDifference === 0) ? 'text-pits-positive' : 'text-pits-danger'}`}>
                            {(reconDifference === 0) ? <CheckCircle size={12}/> : <AlertTriangle size={12}/>}
                            {(reconDifference === 0) ? t('Balanced') : t("Doesn't match")}
                         </p>
                      </div>
                      <button 
                        onClick={handleAudit}
                        className="bg-pits-primary text-pits-dark-text px-4 py-2 font-black rounded-xl text-[11px] uppercase shadow-lg active:scale-95 transition-all"
                      >
                         {t('Check')}
                      </button>
                   </div>
                </div>
             </div>
          </div>

          {/* INSIGHTS & ACTIONS */}
          <div className="bg-pits-surface-elevated rounded-3xl p-6 border border-pits-edge shadow-sm space-y-6">
             <div>
                <h3 className="text-xs font-black text-pits-text uppercase mb-4 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                       <BarChart3 size={14} className="text-pits-red" /> {t('Operational Health')}
                   </div>
                   <Tooltip content={t('Operational Health Info')}>
                      <Info size={14} className="text-pits-dim cursor-help" />
                   </Tooltip>
                </h3>
                <div className="space-y-4">
                   <MetricRow 
                      label={t('Contract Health')} value={`${stats.solvencyRate}%`} color="primary" progress={stats.solvencyRate} tooltip={t('Contract Health Tip')} />
                </div>
             </div>

             <div className="pt-6 border-t border-pits-edge space-y-3">
                <button 
                  onClick={() => setExpiryConfirmOpen(true)}
                  disabled={runningExpiry}
                  className={`relative w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[11px] font-black uppercase transition-all border ${
                    dueCount > 0
                      ? 'bg-pits-warning-soft hover:bg-pits-warning-edge text-pits-warning border-pits-warning-edge'
                      : 'bg-pits-surface-muted hover:bg-pits-edge text-pits-text border-pits-edge'
                  }`}
                >
                   <Clock size={16} className={runningExpiry ? 'animate-spin' : ''} />
                   {t('Lock expired memberships')}
                   {dueCount > 0 && (
                     <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-pits-danger text-white text-[11px] font-black leading-none flex items-center justify-center">
                       {dueCount > 99 ? '99+' : dueCount}
                     </span>
                   )}
                </button>
                <div className="flex items-start gap-2 p-3 bg-pits-primary-soft rounded-2xl border border-pits-edge">
                   <Info size={14} className="text-pits-primary mt-0.5 shrink-0" />
                   <p className="text-[11px] font-bold text-pits-text leading-relaxed uppercase">
                      {t('Sync solvency expiry tip')}
                   </p>
                </div>
             </div>
          </div>

        </div>

      </div>

      <ConfirmDialog
        isOpen={expiryConfirmOpen}
        title={t('Lock expired memberships?')}
        message={
          dueCount > 0
            ? t('Expiry lock confirm', { count: dueCount })
            : t('No members due to expire.')
        }
        confirmLabel={t('Lock access')}
        variant="warning"
        onConfirm={async () => {
          setExpiryConfirmOpen(false);
          await runExpiry();
        }}
        onCancel={() => setExpiryConfirmOpen(false)}
      />

      {reviewId ? (
        <PaymentReviewPanel
          payments={pendingQueue}
          initialId={reviewId}
          formatAmount={(p) => `${paymentSymbol(p)}${p.amount.toLocaleString()}`}
          onApprove={(p) => approve(p.id, p.user_id)}
          onReject={(p, reason) => reject(p.id, p.user_id, reason || undefined)}
          onClose={closeReview}
        />
      ) : null}
    </div>
  );
}

// --- SUBCOMPONENTS ---

type StatCardProps = {
  label: string;
  value: number;
  symbol: string;
  trend: 'positive' | 'neutral' | 'warning' | 'danger';
  color: 'success' | 'primary' | 'muted' | 'warning' | 'danger';
  info?: string;
};

function StatCard({ label, value, symbol, trend, color, info }: StatCardProps) {
  const accents: Record<string, string> = {
    success: 'text-pits-positive bg-pits-positive-soft border-pits-positive-edge',
    primary: 'text-pits-primary bg-pits-primary-soft border-pits-edge',
    muted: 'text-pits-dim bg-pits-surface-muted border-pits-edge',
    warning: 'text-pits-warning bg-pits-warning-soft border-pits-warning-edge',
    danger: 'text-pits-danger bg-pits-danger-soft border-pits-danger-edge',
  };

  return (
    <div className="bg-pits-surface-elevated p-4 rounded-3xl border border-pits-edge shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
      <div className="flex justify-between items-start mb-4">
        <p className="text-[11px] font-black text-pits-dim uppercase tracking-widest leading-tight">{label}</p>
        <div className={`p-1.5 rounded-lg border ${accents[color] ?? accents.muted}`}>
          {trend === 'positive' && <TrendingUp size={14} />}
          {trend === 'neutral' && <DollarSign size={14} />}
          {trend === 'warning' && <AlertTriangle size={14} />}
          {trend === 'danger' && <Zap size={14} />}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-black text-pits-dim mb-1">{symbol}</span>
        <span className="text-xl font-black text-pits-text tracking-tighter">{value.toLocaleString()}</span>
      </div>
      {info && <p className="text-[11px] font-bold text-pits-dim uppercase mt-1 tracking-tighter">{info}</p>}
    </div>
  );
}

type CurrencyPanelProps = {
  title: string;
  stats: CurrencyStats;
  symbol: string;
  color: 'success' | 'primary';
  active: boolean;
  onClick: () => void;
  pendingLabel: string;
};

function CurrencyPanel({ title, stats, symbol, color, active, onClick, pendingLabel }: CurrencyPanelProps) {
  const { t } = useLanguage();
  const barColors: Record<string, string> = {
    success: 'bg-pits-success',
    primary: 'bg-pits-primary',
  };
  const trackedAmount = stats.totalRevenue + stats.pendingAmount;
  const collectionRate = trackedAmount > 0 ? Math.round((stats.totalRevenue / trackedAmount) * 100) : 0;

  return (
    <div 
      onClick={onClick}
      className={`relative p-6 rounded-3xl border-2 cursor-pointer transition-all duration-300 group overflow-hidden bg-pits-surface-elevated shadow-sm ${active ? 'border-pits-primary' : 'border-pits-edge hover:border-pits-grey'}`}
    >
      <div className="flex justify-between items-start relative z-10">
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-widest mb-1 text-pits-dim">{title}</h3>
          <p className="text-2xl font-black tracking-tighter text-pits-text">
            {symbol}{stats.totalRevenue.toLocaleString()}
          </p>
        </div>
        <button type="button" className="p-2 rounded-xl border bg-pits-surface-muted border-pits-edge text-pits-dim">
          <BarChart3 size={16} />
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between relative z-10">
        <div className="space-y-0.5">
           <p className="text-[11px] font-black text-pits-dim uppercase">{pendingLabel}</p>
           <p className="text-xs font-black text-pits-primary">
             {symbol}{stats.pendingAmount.toLocaleString()} <span className="opacity-50 text-[11px] text-pits-dim">({t('{{count}} payments', { count: stats.pendingCount })})</span>
           </p>
        </div>
        <div className="h-1.5 w-24 rounded-full overflow-hidden bg-pits-surface-muted">
           <div className={`h-full rounded-full ${barColors[color] ?? 'bg-pits-dim'} transition-all duration-1000`} style={{ width: `${collectionRate}%` }} />
        </div>
      </div>
    </div>
  );
}

type ReconInputProps = {
  label: string;
  symbol: string;
  value: number;
  onChange?: (val: string) => void;
  systemValue: number;
  isReadOnly?: boolean;
  hideExpected?: boolean;
  t: TranslateFn;
};

function ReconInput({ label, symbol, value, onChange, systemValue, isReadOnly, hideExpected, t }: ReconInputProps) {
  const diff = Number(value || 0) - systemValue;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center px-1">
        <label className="text-[11px] font-black text-pits-dim uppercase">{label}</label>
        {!hideExpected && !isReadOnly && (
          <span className={`text-[11px] font-black uppercase ${diff === 0 ? 'text-pits-dim' : diff < 0 ? 'text-pits-danger' : 'text-pits-warning'}`}>
             {diff === 0 ? t('Balanced') : diff < 0 ? t('{{amount}} short', { amount: `${symbol}${Math.abs(diff)}` }) : t('{{amount}} over', { amount: `${symbol}${diff}` })}
          </span>
        )}
      </div>
      <div className="relative min-w-0">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-pits-dim text-xs font-black pointer-events-none">{symbol}</span>
        <input 
          type="number" 
          placeholder="0.00"
          value={value}
          readOnly={isReadOnly}
          onChange={(e) => onChange && onChange(e.target.value)}
          className={`w-full max-w-full border rounded-2xl pl-10 pr-4 py-3 text-sm font-black transition-all placeholder:text-pits-dim focus:outline-none ${isReadOnly ? 'bg-pits-surface-muted border-pits-edge text-pits-dim cursor-not-allowed' : 'bg-pits-surface-muted border-pits-edge text-pits-text focus:border-pits-red'}`}
        />
        {!hideExpected && (
          <p className="mt-1.5 text-[11px] font-black text-pits-dim uppercase text-right truncate">
            {t('Expected')}: {systemValue.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

type MetricRowProps = {
  label: string;
  value: string;
  color: 'primary' | 'success' | 'muted';
  progress: number;
  tooltip?: string;
};

function MetricRow({ label, value, color, progress, tooltip }: MetricRowProps) {
  const barColors: Record<string, string> = {
    primary: 'bg-pits-primary',
    success: 'bg-pits-success',
    muted: 'bg-pits-dim',
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end">
        <div className="flex items-center gap-1.5">
           <p className="text-[11px] font-black text-pits-dim uppercase">{label}</p>
           {tooltip && (
             <Tooltip content={tooltip}>
                <Info size={10} className="text-pits-dim cursor-help" />
             </Tooltip>
           )}
        </div>
        <span className="text-[11px] font-black text-pits-text">{value}</span>
      </div>
      <div className="h-1 w-full bg-pits-surface-muted rounded-full overflow-hidden border border-pits-edge">
        <div className={`h-full rounded-full ${barColors[color] ?? barColors.muted} transition-all duration-1000`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
