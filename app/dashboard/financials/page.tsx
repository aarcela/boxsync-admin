'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  DollarSign, Filter, Search, CheckCircle, XCircle, 
  ExternalLink, RefreshCw, Clock, 
  TrendingUp, Users, AlertTriangle, CreditCard,
  Download, BarChart3, ChevronLeft, ChevronRight,
  Zap, Info, Wallet
} from 'lucide-react';
import { useToast } from '../../../components/Toast';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { useFinancialData } from '../../../lib/hooks/useFinancialData';
import { financialService, CurrencyType } from '../../../lib/services/financialService';
import { useLanguage } from '../../../components/LanguageContext';

const ITEMS_PER_PAGE = 12;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function FinancialsPage() {
  const { toast } = useToast();
  const { lang, t } = useLanguage();
  
  // Date State
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Logic State
  const { payments, paymentMethods, stats, officialRate, loading, refresh } = useFinancialData(selectedMonth, selectedYear);
  const [exchangeRate, setExchangeRate] = useState(545.9483); // Customizable system rate, synced with API
  const [activeCurrency, setActiveCurrency] = useState<CurrencyType>(CurrencyType.EUR);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [runningExpiry, setRunningExpiry] = useState(false);

  // Cash Reconciliation state
  const [physicalCashEUR, setPhysicalCashEUR] = useState<string>('');

  // Sync with API when rate data arrives
  useEffect(() => {
    if (officialRate) setExchangeRate(Number(officialRate.toFixed(4)));
  }, [officialRate]);

  const handleAudit = () => {
    const diffEUR = Number(physicalCashEUR || 0) - stats.EUR.cashAmount;

    if (diffEUR === 0) {
      toast('Vault reconciled successfully. Synchronized.', 'success');
    } else {
      let msg = `EUR ${diffEUR > 0 ? '+' : ''}${diffEUR.toFixed(2)}`;
      toast(`Reconciliation mismatch: ${msg}`, diffEUR < 0 ? 'error' : 'warning');
    }
  };

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    action: 'approve' | 'reject' | 'expiry';
    paymentId: string;
    userId: string;
    athleteName: string;
  }>({ isOpen: false, action: 'approve', paymentId: '', userId: '', athleteName: '' });

  // Combined Business Health Logic
  const combinedTotalEUR = stats.EUR.totalRevenue + (stats.VES.totalRevenue / exchangeRate);
  const efficiencyRate = stats.projectedRevenueEUR > 0 
    ? Math.round((combinedTotalEUR / stats.projectedRevenueEUR) * 100) 
    : 0;

  // Filtering Logic
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const methodObj = paymentMethods.find(m => m.id === p.method || m.label.toLowerCase() === String(p.method || '').toLowerCase());
      const isVes = methodObj ? methodObj.currency === CurrencyType.VES : p.currency_type === 'VES';
      
      const matchesCurrency = activeCurrency === CurrencyType.VES ? isVes : !isVes;
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesSearch = searchTerm === '' || (p.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return matchesCurrency && matchesStatus && matchesSearch;
    });
  }, [payments, activeCurrency, statusFilter, searchTerm, paymentMethods]);

  const paginatedPayments = filteredPayments.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredPayments.length / ITEMS_PER_PAGE);

  // Actions
  const handleConfirmAction = async () => {
    const { action, paymentId, userId } = confirmConfig;
    setConfirmConfig(prev => ({ ...prev, isOpen: false }));

    try {
      if (action === 'approve') {
        await financialService.approvePayment(paymentId, userId);
        toast('Payment approved successfully', 'success');
      } else if (action === 'reject') {
        await financialService.rejectPayment(paymentId);
        toast('Payment rejected', 'warning');
      } else if (action === 'expiry') {
        setRunningExpiry(true);
        const res = await financialService.runExpiryCheck();
        toast(res.message, 'info');
      }
      refresh();
    } catch (e) {
      toast('Operation failed', 'error');
    } finally {
      if (action === 'expiry') setRunningExpiry(false);
    }
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
    link.download = `PITS-Ledger-${MONTHS[selectedMonth]}-${selectedYear}.csv`;
    link.click();
    toast('Financial ledger exported', 'success');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-0">
      
      {/* 1. COMMAND HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">
              {t('Financial Command')}
            </h1>
            <div className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 border border-slate-200">v2.0 REFACTOR</div>
          </div>
          <p className="text-slate-400 text-xs font-semibold mt-1 tracking-wide uppercase italic">
            {t('Strategic performance and reconciliation cockpit')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Exchange Rate Master */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm group hover:border-pits-red transition-all">
             <div className="text-[10px] font-black text-slate-400 uppercase mr-3 italic group-hover:text-pits-red flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                {t('Official Rate')}
             </div>
             <div className="flex items-center gap-1.5 font-bold text-sm">
                <span className="text-slate-400">€1 = </span>
                <input 
                  type="number" 
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Number(e.target.value))}
                  className="w-20 bg-transparent text-slate-900 focus:outline-none focus:text-pits-red font-black"
                />
                <span className="text-slate-400">VES</span>
             </div>
          </div>

          <div className="flex items-center gap-2 ml-auto lg:ml-0">
             <select 
               value={selectedMonth} 
               onChange={(e) => setSelectedMonth(Number(e.target.value))}
               className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black text-slate-700 uppercase cursor-pointer hover:border-slate-400 transition-all shadow-sm focus:ring-2 focus:ring-pits-red outline-none"
             >
               {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
             </select>
             <button onClick={handleExportCSV} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 shadow-sm transition-all active:scale-95">
                <Download size={18} />
             </button>
             <button onClick={refresh} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl hover:bg-black text-white shadow-md transition-all active:scale-95">
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
             </button>
          </div>
        </div>
      </div>

      {/* 2. VITALS BAR (KPIs) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label={t('Collected (EUR)')} value={stats.EUR.totalRevenue} symbol="€" trend="positive" color="emerald" t={t} />
        <StatCard label={t('Collected (VES)')} value={stats.VES.totalRevenue} symbol="Bs." trend="positive" color="blue" t={t} />
        <StatCard label={t('Consolidated')} value={combinedTotalEUR} symbol="€" trend="neutral" color="slate" info="VES converted to EUR" t={t} />
        <StatCard label={t('Pending Liquidity')} value={stats.EUR.pendingAmount + (stats.VES.pendingAmount / exchangeRate)} symbol="€" trend="warning" color="amber" t={t} />
        <StatCard label={t('Overdue leakage')} value={stats.overdueAmountEUR} symbol="€" trend="danger" color="red" t={t} />
        <StatCard label={t('Efficiency')} value={efficiencyRate} symbol="%" trend={efficiencyRate > 80 ? 'positive' : 'warning'} color="purple" t={t} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* MAIN SECTION (LEFT 8 COLS) */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* CURRENCY HUB / COMPARISON */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <CurrencyPanel 
               title={t('EURO OPERATIONS')} 
               stats={stats.EUR} 
               symbol="€" 
               color="emerald" 
               active={activeCurrency === CurrencyType.EUR}
               onClick={() => setActiveCurrency(CurrencyType.EUR)}
               t={t}
             />
             <CurrencyPanel 
               title={t('VES BOLIVARES')} 
               stats={stats.VES} 
               symbol="Bs." 
               color="blue" 
               active={activeCurrency === CurrencyType.VES}
               onClick={() => setActiveCurrency(CurrencyType.VES)}
               t={t}
             />
          </div>

          {/* TABLE FILTERS */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center">
             <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder={t('Search athlete or transaction...')} 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-pits-red outline-none transition-all uppercase"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             <div className="flex gap-2 w-full md:w-auto">
                <select 
                  className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-[10px] font-black text-slate-700 uppercase outline-none flex-1 md:w-40"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">{t('Processed & Pending')}</option>
                  <option value="pending">{t('Review Required')}</option>
                  <option value="approved">{t('Verified Only')}</option>
                  <option value="rejected">{t('Rejected Only')}</option>
                </select>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                   <button 
                     onClick={() => setActiveCurrency(CurrencyType.EUR)}
                     className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${activeCurrency === CurrencyType.EUR ? 'bg-white shadow-sm text-pits-red' : 'text-slate-400'}`}
                   >EUR</button>
                   <button 
                     onClick={() => setActiveCurrency(CurrencyType.VES)}
                     className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${activeCurrency === CurrencyType.VES ? 'bg-white shadow-sm text-pits-red' : 'text-slate-400'}`}
                   >VES</button>
                </div>
             </div>
          </div>

          {/* THE LEDGER TABLE */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
             <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase italic">{t('Timeline')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase italic">{t('Subject')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase italic">{t('Method')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase italic">{t('Value')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase italic">{t('Evidence')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase italic text-right">{t('Control')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={6} className="py-20 text-center text-slate-400 font-bold uppercase italic animate-pulse">Syncing Matrix...</td></tr>
                  ) : paginatedPayments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="text-[11px] font-black text-slate-900 italic">{new Date(p.created_at).toLocaleDateString()}</div>
                        <div className="text-[9px] text-slate-400 font-bold">{new Date(p.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-black text-slate-900 uppercase italic">{p.profiles?.full_name || 'Anonymous Object'}</div>
                        <div className="text-[8px] text-slate-400 font-bold tracking-widest">ID_{p.id.slice(0,6)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className="p-1 bg-slate-100 rounded text-slate-500"><CreditCard size={10}/></div>
                          <span className="text-[10px] font-black text-slate-600 uppercase italic">{p.method || 'Unknown Channel'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-1">
                            <span className="text-xs font-black text-slate-900 italic">
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
                           className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase italic hover:bg-blue-100 transition-colors"
                         >
                            Check Proof <ExternalLink size={10} className="ml-1" />
                         </a>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex justify-end items-center gap-2">
                            {p.status === 'pending' ? (
                              <>
                                <button 
                                  onClick={() => setConfirmConfig({ isOpen: true, action: 'reject', paymentId: p.id, userId: p.user_id, athleteName: p.profiles?.full_name || 'Unknown' })}
                                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                ><XCircle size={18}/></button>
                                <button 
                                  onClick={() => setConfirmConfig({ isOpen: true, action: 'approve', paymentId: p.id, userId: p.user_id, athleteName: p.profiles?.full_name || 'Unknown' })}
                                  className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase italic shadow-sm hover:bg-emerald-600 active:scale-95 transition-all"
                                >Approve</button>
                              </>
                            ) : (
                              <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase italic border ${p.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                {p.status}
                              </div>
                            )}
                         </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPayments.length === 0 && !loading && (
                    <tr><td colSpan={6} className="py-20 text-center text-slate-300 font-bold italic uppercase">Void results in this sector.</td></tr>
                  )}
                </tbody>
             </table>

             {/* PAGINATION */}
             {totalPages > 1 && (
               <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase italic">{t('Sector Coverage')}: {filteredPayments.length} Units</p>
                  <nav className="flex gap-1.5">
                     <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 disabled:opacity-30"><ChevronLeft size={16}/></button>
                     <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 px-3 items-center text-[11px] font-black italic">
                        {currentPage} <span className="mx-2 text-slate-300">/</span> {totalPages}
                     </div>
                     <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 disabled:opacity-30"><ChevronRight size={16}/></button>
                  </nav>
               </div>
             )}
          </div>
        </div>

        {/* SIDEBAR (RIGHT 3 COLS) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* CASH RECONCILIATION MOD */}
          <div className="bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-800 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Wallet size={80} className="text-white" />
             </div>
             
             <div className="relative z-10">
                <div className="flex items-center gap-2 mb-6">
                   <div className="p-2 bg-red-500/20 text-pits-red rounded-lg"><Zap size={18} fill="currentColor"/></div>
                   <h3 className="text-sm font-black text-white italic uppercase tracking-tighter">{t('Vault Reconciler')}</h3>
                </div>

                <div className="space-y-5">
                   <ReconInput label={t('Physical EUR')} symbol="€" value={physicalCashEUR} onChange={setPhysicalCashEUR} systemValue={stats.EUR.cashAmount} t={t} />
                </div>

                <div className="mt-8 pt-6 border-t border-slate-800">
                   <div className="flex justify-between items-end">
                      <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase italic mb-1">{t('Status Report')}</p>
                         <p className={`text-xs font-bold flex items-center gap-1 ${((Number(physicalCashEUR || 0) - stats.EUR.cashAmount) === 0) ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {((Number(physicalCashEUR || 0) - stats.EUR.cashAmount) === 0) ? <CheckCircle size={12}/> : <AlertTriangle size={12}/>}
                            {((Number(physicalCashEUR || 0) - stats.EUR.cashAmount) === 0) ? t('Verified Sync') : t('Mismatch Found')}
                         </p>
                      </div>
                      <button 
                        onClick={handleAudit}
                        className="bg-pits-red text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase italic shadow-lg active:scale-95 transition-all"
                      >
                         {t('Audit Now')}
                      </button>
                   </div>
                </div>
             </div>
          </div>

          {/* INSIGHTS & ACTIONS */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
             <div>
                <h3 className="text-xs font-black text-slate-900 italic uppercase mb-4 flex items-center gap-2">
                   <BarChart3 size={14} className="text-pits-red" /> {t('Operational Health')}
                </h3>
                <div className="space-y-4">
                   <MetricRow 
                      label={t('Contract Health')} value={`${stats.solvencyRate}%`} color="purple" progress={stats.solvencyRate} t={t} />
                   <MetricRow label={t('Growth Velocity')} value="+4.2%" color="emerald" progress={75} t={t} />
                   <MetricRow label={t('Churn Risk')} value={t('Low')} color="slate" progress={20} t={t} />
                </div>
             </div>

             <div className="pt-6 border-t border-slate-100 space-y-3">
                <button 
                  onClick={() => setConfirmConfig({ isOpen: true, action: 'expiry', paymentId: '', userId: '', athleteName: '' })}
                  disabled={runningExpiry}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 text-slate-900 rounded-2xl text-[11px] font-black uppercase italic transition-all border border-slate-200/50"
                >
                   <Clock size={16} className={runningExpiry ? 'animate-spin' : ''} />
                   {t('Run Expiry Sync')}
                </button>
                <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-2xl border border-blue-100">
                   <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                   <p className="text-[9px] font-bold text-blue-700 leading-relaxed uppercase">
                      Sync solvency to lock accounts whose payment period has reached 100% depletion.
                   </p>
                </div>
             </div>
          </div>

        </div>

      </div>

      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.action === 'expiry' ? 'Operational Halt?' : confirmConfig.action === 'reject' ? 'Protocol: Reject' : 'Protocol: Verify'}
        message={
          confirmConfig.action === 'expiry' 
            ? 'Execution will lock stagnant accounts. Members with expired cycles will lose grid access immediately.' 
            : `Confirming final status update for ${confirmConfig.athleteName}. This action is recorded in the ledger.`
        }
        confirmLabel={confirmConfig.action === 'expiry' ? 'EXECUTE' : confirmConfig.action === 'reject' ? 'REJECT' : 'VERIFY'}
        variant={confirmConfig.action === 'expiry' ? 'warning' : confirmConfig.action === 'reject' ? 'danger' : 'default'}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

// --- SUBCOMPONENTS ---

function StatCard({ label, value, symbol, trend, color, info, t }: any) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-500 bg-emerald-50 border-emerald-100',
    blue: 'text-blue-500 bg-blue-50 border-blue-100',
    slate: 'text-slate-600 bg-slate-50 border-slate-100',
    amber: 'text-amber-500 bg-amber-50 border-amber-100',
    red: 'text-red-500 bg-red-50 border-red-100',
    purple: 'text-purple-500 bg-purple-50 border-purple-100'
  };

  return (
    <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
      <div className="flex justify-between items-start mb-4">
        <p className="text-[9px] font-black text-slate-400 uppercase italic tracking-widest leading-tight">{label}</p>
        <div className={`p-1.5 rounded-lg border ${colors[color]}`}>
          {trend === 'positive' && <TrendingUp size={14} />}
          {trend === 'neutral' && <DollarSign size={14} />}
          {trend === 'warning' && <AlertTriangle size={14} />}
          {trend === 'danger' && <Zap size={14} />}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-black text-slate-400 italic mb-1">{symbol}</span>
        <span className="text-xl font-black text-slate-900 tracking-tighter italic">{value.toLocaleString()}</span>
      </div>
      {info && <p className="text-[8px] font-bold text-slate-300 uppercase mt-1 italic tracking-tighter">{t ? t(info) : info}</p>}
    </div>
  );
}

function CurrencyPanel({ title, stats, symbol, color, active, onClick, t }: any) {
  const colors: Record<string, string> = {
    emerald: 'from-emerald-500 to-emerald-600',
    blue: 'from-blue-500 to-blue-600'
  };

  return (
    <div 
      onClick={onClick}
      className={`relative p-6 rounded-3xl border cursor-pointer transition-all duration-500 group overflow-hidden ${active ? 'bg-slate-900 border-slate-800 shadow-2xl ring-2 ring-pits-red ring-offset-2' : 'bg-white border-slate-200 shadow-sm hover:border-slate-400'}`}
    >
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-slate-100/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
      
      <div className="flex justify-between items-start relative z-10">
        <div>
          <h3 className={`text-[10px] font-black uppercase italic tracking-widest mb-1 ${active ? 'text-slate-400' : 'text-slate-500'}`}>{title}</h3>
          <p className={`text-2xl font-black italic tracking-tighter ${active ? 'text-white' : 'text-slate-900'}`}>
            {symbol}{stats.totalRevenue.toLocaleString()}
          </p>
        </div>
        <button className={`p-2 rounded-xl border ${active ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
          <BarChart3 size={16} />
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between relative z-10">
        <div className="space-y-0.5">
           <p className="text-[9px] font-black text-slate-500 uppercase italic">{t('Pending Flow')}</p>
           <p className={`text-xs font-black italic ${active ? 'text-amber-400' : 'text-amber-600'}`}>
             {symbol}{stats.pendingAmount.toLocaleString()} <span className="opacity-50 text-[10px]">({stats.pendingCount} units)</span>
           </p>
        </div>
        <div className={`h-1.5 w-24 rounded-full overflow-hidden ${active ? 'bg-slate-800' : 'bg-slate-100'}`}>
           <div className={`h-full rounded-full bg-gradient-to-r ${colors[color]} transition-all duration-1000`} style={{ width: '65%' }} />
        </div>
      </div>
    </div>
  );
}

function ReconInput({ label, symbol, value, onChange, systemValue, t }: any) {
  const diff = Number(value || 0) - systemValue;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center px-1">
        <label className="text-[9px] font-black text-slate-500 uppercase italic">{label}</label>
        <span className={`text-[9px] font-black uppercase italic ${diff === 0 ? 'text-slate-600' : diff < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
           {diff === 0 ? t('In Sync') : diff < 0 ? `${symbol}${Math.abs(diff)} Gap` : `${symbol}${diff} Surplus`}
        </span>
      </div>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-black">{symbol}</span>
        <input 
          type="number" 
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl pl-10 pr-4 py-3 text-sm font-black text-white focus:outline-none focus:border-pits-red transition-all italic placeholder:text-slate-700"
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-500 uppercase italic">{t('Expected')}: {systemValue.toLocaleString()}</div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, color, progress, t }: any) {
  const colors: Record<string, string> = {
    purple: 'bg-purple-500',
    emerald: 'bg-emerald-500',
    slate: 'bg-slate-400'
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end">
        <p className="text-[9px] font-black text-slate-400 uppercase italic">{label}</p>
        <span className="text-[10px] font-black text-slate-900 italic">{value}</span>
      </div>
      <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
        <div className={`h-full rounded-full ${colors[color]} transition-all duration-1000`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}