'use client';

import { useState } from 'react';
import { 
  DollarSign, Search, CheckCircle, XCircle, 
  ExternalLink, RefreshCw, Clock, 
  TrendingUp, AlertTriangle, CreditCard,
  Download, BarChart3, ChevronLeft, ChevronRight,
  Zap, Info, Wallet, Calendar
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import Tooltip from '@/components/Tooltip';
import { useFinancials } from './hooks/useFinancials';
import { CurrencyStats, CurrencyType } from '@/lib/types/gym';
import { TranslationKey } from '@/lib/translations';
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
  const { t } = useLanguage();
  
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
    setExchangeRate,
    activeCurrency,
    setActiveCurrency,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    filteredPayments,
    currentPage,
    setCurrentPage,
    incomes,
    paymentMethods,
    runningExpiry,
    approve,
    reject,
    runExpiry,
    refresh
  } = useFinancials(period, period === 'custom' ? customRange : undefined);

  // Daily EUR Cash Reconciliation state
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

  const todayEURCashReceived =
    filteredPayments
      .filter(
        (p) =>
          p.status === 'approved' &&
          p.currency_type === 'EUR' &&
          (p.method?.toLowerCase().includes('cash') || p.method?.toLowerCase().includes('efectivo'))
      )
      .reduce((sum, p) => sum + p.amount, 0) +
    incomes
      .filter(
        (inc) =>
          inc.status === 'confirmed' &&
          inc.currency === 'EUR' &&
          inc.income_date === todayStr &&
          isCashRef(inc.payment_method)
      )
      .reduce((sum, inc) => sum + inc.amount, 0);

  const expectedClosingCash = (Number(reconState.opening) + todayEURCashReceived) - Number(reconState.withdrawals);
  const reconDifference = Number(reconState.actual || 0) - expectedClosingCash;

  const handleAudit = () => {
    if (reconDifference === 0) {
      toast(t('Vault reconciled perfectly.'), 'success');
    } else {
      const msg = `${reconDifference > 0 ? '+' : ''}${reconDifference.toFixed(2)} EUR`;
      toast(t('Reconciliation mismatch: {{amount}}', { amount: msg }), reconDifference < 0 ? 'error' : 'warning');
    }
  };

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    action: 'approve' | 'reject' | 'expiry';
    paymentId: string;
    userId: string;
    athleteName: string;
  }>({ isOpen: false, action: 'approve', paymentId: '', userId: '', athleteName: '' });

  // Paged state (local to UI)
  const paginatedPayments = filteredPayments.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredPayments.length / ITEMS_PER_PAGE);

  // Business calculations
  const combinedTotalEUR = stats.EUR.totalRevenue + (stats.VES.totalRevenue / exchangeRate);
  const efficiencyRate = stats.projectedRevenueEUR > 0 ? Math.round((combinedTotalEUR / stats.projectedRevenueEUR) * 100) : 0;

  const handleConfirmAction = async () => {
    const { action, paymentId, userId } = confirmConfig;
    setConfirmConfig(prev => ({ ...prev, isOpen: false }));

    if (action === 'approve') await approve(paymentId, userId);
    else if (action === 'reject') await reject(paymentId);
    else if (action === 'expiry') await runExpiry();
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Athlete', 'Method', 'Amount', 'Currency', 'Status'];
    const csvContent = [
      headers.join(','),
      ...filteredPayments.map(p => [
        new Date(p.created_at).toLocaleDateString(),
        p.profiles?.full_name || 'Anonymous',
        p.method || 'N/A',
        p.amount,
        p.currency_type || 'EUR',
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
            <h1 className="text-3xl font-black text-pits-text tracking-tighter uppercase">
              {t('Financial Command')}
            </h1>
            <div className="bg-pits-surface-muted px-2 py-0.5 rounded text-[10px] font-bold text-pits-dim border border-pits-edge">v2.0 REFACTOR</div>
          </div>
          <p className="text-pits-dim text-xs font-semibold mt-1 tracking-wide uppercase">
            {t('Strategic performance and reconciliation cockpit')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Exchange Rate Master */}
          <div className="flex items-center bg-pits-surface-elevated border border-pits-edge rounded-xl px-3 py-1.5 shadow-sm group hover:border-pits-red transition-all">
             <div className="text-[10px] font-black text-pits-dim uppercase mr-3 group-hover:text-pits-red flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-pits-success animate-pulse"></div>
                {t('Official Rate')}
             </div>
             <div className="flex items-center gap-1.5 font-bold text-sm">
                <span className="text-pits-dim">€1 = </span>
                <input 
                  type="number" 
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Number(e.target.value))}
                  className="w-20 bg-transparent text-pits-text focus:outline-none focus:text-pits-red font-black"
                />
                <span className="text-pits-dim">VES</span>
             </div>
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
          <span className="text-[10px] font-black uppercase tracking-widest text-pits-text">{t('Filters')}</span>
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
              className={`px-3 py-1.5 text-[10px] font-black rounded-lg uppercase transition-all ${
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
              <span className="text-[10px] font-black text-pits-dim uppercase">{t('From')}</span>
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
              <span className="text-[10px] font-black text-pits-dim uppercase">{t('To')}</span>
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
        <StatCard label={t('Collected (EUR)')} value={stats.EUR.totalRevenue} symbol="€" trend="positive" color="success" />
        <StatCard label={t('Collected (VES)')} value={stats.VES.totalRevenue} symbol="Bs." trend="positive" color="primary" />
        <StatCard label={t('Consolidated')} value={combinedTotalEUR} symbol="€" trend="neutral" color="muted" info={t('Consolidated EUR base')} />
        <StatCard label={t('Pending Liquidity')} value={stats.EUR.pendingAmount + (stats.VES.pendingAmount / exchangeRate)} symbol="€" trend="warning" color="warning" />
        <StatCard label={t('Overdue leakage')} value={stats.overdueAmountEUR} symbol="€" trend="danger" color="danger" />
        <StatCard label={t('Efficiency')} value={efficiencyRate} symbol="%" trend={efficiencyRate > 80 ? 'positive' : 'warning'} color="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">
        
        {/* MAIN SECTION (LEFT 8 COLS) */}
        <div className="lg:col-span-9 space-y-6 min-w-0">
          
          {/* CURRENCY HUB / COMPARISON */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <CurrencyPanel 
               title={t('EURO OPERATIONS')} 
               stats={stats.EUR} 
               symbol="€" 
               color="success" 
               active={activeCurrency === CurrencyType.EUR}
               onClick={() => setActiveCurrency(CurrencyType.EUR)}
               pendingLabel={t('Pending Liquidity')}
             />
             <CurrencyPanel 
               title={t('VES BOLIVARES')} 
               stats={stats.VES} 
               symbol="Bs." 
               color="primary" 
               active={activeCurrency === CurrencyType.VES}
               onClick={() => setActiveCurrency(CurrencyType.VES)}
               pendingLabel={t('Pending Liquidity')}
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
                  className="bg-pits-surface-muted border border-pits-edge rounded-xl px-4 py-2.5 text-[10px] font-black text-pits-text uppercase outline-none flex-1 md:w-40"
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
                     onClick={() => setActiveCurrency(CurrencyType.EUR)}
                     className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${activeCurrency === CurrencyType.EUR ? 'bg-pits-surface-elevated shadow-sm text-pits-primary' : 'text-pits-dim'}`}
                   >EUR</button>
                   <button 
                     onClick={() => setActiveCurrency(CurrencyType.VES)}
                     className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${activeCurrency === CurrencyType.VES ? 'bg-pits-surface-elevated shadow-sm text-pits-primary' : 'text-pits-dim'}`}
                   >VES</button>
                </div>
             </div>
          </div>

          {/* THE LEDGER TABLE */}
          <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm overflow-hidden min-h-[400px] min-w-0">
             <div className="overflow-x-auto">
             <table className="w-full min-w-[720px] text-left border-collapse">
                <thead className="bg-pits-surface-elevated border-b border-pits-edge">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-pits-dim uppercase">{t('Timeline')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-pits-dim uppercase">{t('Subject')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-pits-dim uppercase">{t('Method')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-pits-dim uppercase">{t('Value')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-pits-dim uppercase">{t('Evidence')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-pits-dim uppercase text-right">{t('Control')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pits-edge">
                  {loading ? (
                    <tr><td colSpan={6} className="py-20 text-center text-pits-dim font-bold uppercase animate-pulse">{t('Syncing Matrix...')}</td></tr>
                  ) : paginatedPayments.map(p => (
                    <tr key={p.id} className="hover:bg-pits-surface-muted/40 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="text-[11px] font-black text-pits-text">{new Date(p.created_at).toLocaleDateString()}</div>
                        <div className="text-[9px] text-pits-dim font-bold">{new Date(p.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-black text-pits-text uppercase">{p.profiles?.full_name || t('Anonymous Object')}</div>
                        <div className="text-[8px] text-pits-dim font-bold tracking-widest">ID_{p.id.slice(0,6)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className="p-1 bg-pits-surface-muted rounded text-pits-dim"><CreditCard size={10}/></div>
                          <span className="text-[10px] font-black text-pits-text uppercase">{p.method || t('Unknown Channel')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-1">
                            <span className="text-xs font-black text-pits-text">
                               {activeCurrency === CurrencyType.EUR ? '€' : 'Bs.'}
                               {p.amount.toLocaleString()}
                            </span>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         <a 
                           href={p.proof_image_url} 
                           target="_blank" 
                           rel="noreferrer"
                           className="inline-flex items-center px-2 py-1 bg-pits-surface-muted text-pits-primary rounded-lg text-[9px] font-black uppercase hover:bg-pits-primary-soft transition-colors"
                         >
                            {t('Check Proof')} <ExternalLink size={10} className="ml-1" />
                         </a>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex justify-end items-center gap-2">
                            {p.status === 'pending' ? (
                              <>
                                <button 
                                  onClick={() => setConfirmConfig({ isOpen: true, action: 'reject', paymentId: p.id, userId: p.user_id, athleteName: p.profiles?.full_name || t('Unknown') })}
                                  className="p-2 text-pits-dim hover:text-pits-error transition-colors"
                                ><XCircle size={18}/></button>
                                <button 
                                  onClick={() => setConfirmConfig({ isOpen: true, action: 'approve', paymentId: p.id, userId: p.user_id, athleteName: p.profiles?.full_name || t('Unknown') })}
                                  className="bg-pits-success text-pits-dark-text px-3 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-sm hover:opacity-90 active:scale-95 transition-all"
                                >{t('Approve')}</button>
                              </>
                            ) : (
                              <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${p.status === 'approved' ? 'bg-pits-primary-soft text-pits-success border-pits-edge' : 'bg-pits-primary-soft text-pits-error border-pits-edge'}`}>
                                {p.status}
                              </div>
                            )}
                         </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPayments.length === 0 && !loading && (
                    <tr><td colSpan={6} className="py-20 text-center text-pits-dim font-bold uppercase">{t('Void results in this sector.')}</td></tr>
                  )}
                </tbody>
             </table>
             </div>

             {/* PAGINATION */}
             {totalPages > 1 && (
               <div className="px-6 py-4 bg-pits-surface-elevated border-t border-pits-edge flex justify-between items-center">
                  <p className="text-[10px] font-black text-pits-dim uppercase">{t('Sector Coverage')}: {filteredPayments.length} Units</p>
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
                   <h3 className="text-sm font-black text-pits-text uppercase tracking-tighter">{t('Vault Reconciler')}</h3>
                </div>

                 <div className="space-y-5">
                    <ReconInput 
                      label={t('Opening Cash')} 
                      symbol="€" 
                      value={reconState.opening} 
                      onChange={(val) => setReconState(prev => ({ ...prev, opening: Number(val) }))} 
                      systemValue={0} 
                      hideExpected={true}
                      t={t} 
                    />
                    <ReconInput 
                      label={t('Today\'s Inflow')} 
                      symbol="€" 
                      value={todayEURCashReceived} 
                      isReadOnly={true}
                      systemValue={todayEURCashReceived} 
                      t={t} 
                    />
                    <ReconInput 
                      label={t('Withdrawals')} 
                      symbol="€" 
                      value={reconState.withdrawals} 
                      onChange={(val) => setReconState(prev => ({ ...prev, withdrawals: Number(val) }))} 
                      systemValue={0} 
                      hideExpected={true}
                      t={t} 
                    />
                    <ReconInput 
                      label={t('Physical Count')} 
                      symbol="€" 
                      value={reconState.actual} 
                      onChange={(val) => setReconState(prev => ({ ...prev, actual: Number(val) }))} 
                      systemValue={expectedClosingCash} 
                      t={t} 
                    />
                 </div>

                <div className="mt-8 pt-6 border-t border-pits-edge">
                   <div className="flex justify-between items-end">
                      <div>
                         <p className="text-[10px] font-black text-pits-dim uppercase mb-1">{t('Status Report')}</p>
                         <p className={`text-xs font-bold flex items-center gap-1 ${(reconDifference === 0) ? 'text-pits-success' : 'text-pits-primary'}`}>
                            {(reconDifference === 0) ? <CheckCircle size={12}/> : <AlertTriangle size={12}/>}
                            {(reconDifference === 0) ? t('Verified Sync') : t('Mismatch Found')}
                         </p>
                      </div>
                      <button 
                        onClick={handleAudit}
                        className="bg-pits-primary text-pits-dark-text px-4 py-2 font-black rounded-xl text-[10px] uppercase shadow-lg active:scale-95 transition-all"
                      >
                         {t('Audit Now')}
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
                   <MetricRow label={t('Growth Velocity')} value="+4.2%" color="success" progress={75} tooltip={t('Growth Velocity Tip')} />
                   <MetricRow label={t('Churn Risk')} value={t('Low')} color="muted" progress={20} tooltip={t('Churn Risk Tip')} />
                </div>
             </div>

             <div className="pt-6 border-t border-pits-edge space-y-3">
                <button 
                  onClick={() => setConfirmConfig({ isOpen: true, action: 'expiry', paymentId: '', userId: '', athleteName: '' })}
                  disabled={runningExpiry}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-pits-surface-muted hover:bg-pits-edge text-pits-text rounded-2xl text-[11px] font-black uppercase transition-all border border-pits-edge"
                >
                   <Clock size={16} className={runningExpiry ? 'animate-spin' : ''} />
                   {t('Run Expiry Sync')}
                </button>
                <div className="flex items-start gap-2 p-3 bg-pits-primary-soft rounded-2xl border border-pits-edge">
                   <Info size={14} className="text-pits-primary mt-0.5 shrink-0" />
                   <p className="text-[9px] font-bold text-pits-text leading-relaxed uppercase">
                      {t('Sync solvency expiry tip')}
                   </p>
                </div>
             </div>
          </div>

        </div>

      </div>

      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.action === 'expiry' ? t('Operational Halt?') : confirmConfig.action === 'reject' ? t('Protocol: Reject') : t('Protocol: Verify')}
        message={
          confirmConfig.action === 'expiry' 
            ? t('Expiry warning message')
            : t('Confirm status update message', { name: confirmConfig.athleteName })
        }
        confirmLabel={confirmConfig.action === 'expiry' ? t('EXECUTE') : confirmConfig.action === 'reject' ? t('REJECT') : t('VERIFY')}
        variant={confirmConfig.action === 'expiry' ? 'warning' : confirmConfig.action === 'reject' ? 'danger' : 'default'}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
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
    success: 'text-pits-success bg-pits-primary-soft border-pits-edge',
    primary: 'text-pits-primary bg-pits-primary-soft border-pits-edge',
    muted: 'text-pits-dim bg-pits-surface-muted border-pits-edge',
    warning: 'text-pits-primary bg-pits-primary-soft border-pits-edge',
    danger: 'text-pits-error bg-pits-primary-soft border-pits-edge',
  };

  return (
    <div className="bg-pits-surface-elevated p-4 rounded-3xl border border-pits-edge shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
      <div className="flex justify-between items-start mb-4">
        <p className="text-[9px] font-black text-pits-dim uppercase tracking-widest leading-tight">{label}</p>
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
      {info && <p className="text-[8px] font-bold text-pits-dim uppercase mt-1 tracking-tighter">{info}</p>}
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
  const barColors: Record<string, string> = {
    success: 'bg-pits-success',
    primary: 'bg-pits-primary',
  };

  return (
    <div 
      onClick={onClick}
      className={`relative p-6 rounded-3xl border-2 cursor-pointer transition-all duration-300 group overflow-hidden bg-pits-surface-elevated shadow-sm ${active ? 'border-pits-primary' : 'border-pits-edge hover:border-pits-grey'}`}
    >
      <div className="flex justify-between items-start relative z-10">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest mb-1 text-pits-dim">{title}</h3>
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
           <p className="text-[9px] font-black text-pits-dim uppercase">{pendingLabel}</p>
           <p className="text-xs font-black text-pits-primary">
             {symbol}{stats.pendingAmount.toLocaleString()} <span className="opacity-50 text-[10px] text-pits-dim">({stats.pendingCount} units)</span>
           </p>
        </div>
        <div className="h-1.5 w-24 rounded-full overflow-hidden bg-pits-surface-muted">
           <div className={`h-full rounded-full ${barColors[color] ?? 'bg-pits-dim'} transition-all duration-1000`} style={{ width: '65%' }} />
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
        <label className="text-[9px] font-black text-pits-dim uppercase">{label}</label>
        {!hideExpected && !isReadOnly && (
          <span className={`text-[9px] font-black uppercase ${diff === 0 ? 'text-pits-dim' : diff < 0 ? 'text-pits-error' : 'text-pits-success'}`}>
             {diff === 0 ? t('In Sync') : diff < 0 ? `${symbol}${Math.abs(diff)} Gap` : `${symbol}${diff} Surplus`}
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
          <p className="mt-1.5 text-[8px] font-black text-pits-dim uppercase text-right truncate">
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
           <p className="text-[9px] font-black text-pits-dim uppercase">{label}</p>
           {tooltip && (
             <Tooltip content={tooltip}>
                <Info size={10} className="text-pits-dim cursor-help" />
             </Tooltip>
           )}
        </div>
        <span className="text-[10px] font-black text-pits-text">{value}</span>
      </div>
      <div className="h-1 w-full bg-pits-surface-muted rounded-full overflow-hidden border border-pits-edge">
        <div className={`h-full rounded-full ${barColors[color] ?? barColors.muted} transition-all duration-1000`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
