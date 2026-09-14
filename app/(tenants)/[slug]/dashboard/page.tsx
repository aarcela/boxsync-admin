'use client';

import { useState } from 'react';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { financialService } from '@/lib/services/financialService';
import {
  CheckCircle, XCircle, ExternalLink, RefreshCw,
  AlertTriangle, ShieldAlert,
  TrendingUp, Zap, ChevronRight,
  Calendar, Clock
} from 'lucide-react';
import DashboardDetailModal from './components/DashboardDetailModal';
import type { DashboardProfile, DashboardClass, DashboardPayment } from '@/lib/services/dashboardService';

type DashboardModalItem = DashboardProfile | DashboardClass | DashboardPayment;
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import { currencySymbol } from '@/lib/currency';

export default function DashboardPage() {
  const { stats, loading, refresh, removePaymentLocally } = useDashboardData();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { currencies } = useTenant();
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    paymentId: string;
    action: 'approve' | 'reject';
    userId: string;
    athleteName: string;
  }>({ isOpen: false, paymentId: '', action: 'approve', userId: '', athleteName: '' });

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    type: 'athletes' | 'classes' | 'payments';
    data: DashboardModalItem[];
  }>({
    isOpen: false,
    title: '',
    type: 'athletes',
    data: []
  });

  const openModal = (title: string, type: 'athletes' | 'classes' | 'payments', data: DashboardModalItem[]) => {
    setModalConfig({ isOpen: true, title, type, data });
  };

  const handleRefresh = async () => {
    await refresh();
    setLastSynced(new Date());
    toast(t('Dashboard synced'), 'success');
  };

  // ACTION: APPROVE PAYMENT
  const handleApprove = async (id: string, userId: string) => {
    try {
      await financialService.approvePayment(id, userId);
      removePaymentLocally(id);
      refresh();
      toast(t('Payment approved successfully'), 'success');
    } catch {
      toast(t('Error approving payment. Please try again.'), 'error');
    }
  };

  // ACTION: REJECT PAYMENT
  const handleReject = async (id: string, userId: string) => {
    try {
      await financialService.rejectPayment(id, userId);
      removePaymentLocally(id);
      refresh();
      toast(t('Payment rejected'), 'warning');
    } catch {
      toast(t('Error rejecting payment. Please try again.'), 'error');
    }
  };

  const handleConfirmAction = async () => {
    const { action, paymentId, userId } = confirmConfig;
    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    if (action === 'approve') {
      await handleApprove(paymentId, userId);
    } else {
      await handleReject(paymentId, userId);
    }
  };

  // Format currency for display
  const formatCurrency = (amount: number) => {
    return `${currencySymbol(currencies.reference)}${amount.toLocaleString()}`;
  };

  const requestReject = (payment: DashboardPayment) => {
    setConfirmConfig({
      isOpen: true,
      paymentId: payment.id,
      action: 'reject',
      userId: payment.user_id,
      athleteName: payment.profiles?.full_name || t('Unknown Athlete')
    });
  };

  const renderPaymentActions = (payment: DashboardPayment, compact = false) => (
    <div className={`flex items-center ${compact ? 'gap-1.5 w-full' : 'flex-wrap justify-end gap-2'}`}>
      {payment.proof_image_url ? (
        <a
          href={payment.proof_image_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center shrink-0 font-black uppercase tracking-tighter text-blue-600 hover:text-pits-dark-text transition-all ${
            compact ? 'h-9 w-9 rounded-xl border bg-pits-surface-elevated' : 'text-[10px] hover:translate-y-px'
          }`}
          title={t('Audit Proof')}
        >
          <ExternalLink size={14} className={compact ? '' : 'mr-1.5'} />
          {!compact && t('Audit Proof')}
        </a>
      ) : (
        !compact && <span className="text-[10px] font-black uppercase text-pits-dim">—</span>
      )}
      <button
        onClick={() => requestReject(payment)}
        className="inline-flex items-center justify-center shrink-0 h-9 w-9 rounded-xl text-pits-error hover:bg-red-50 hover:text-pits-dark-text transition-all border hover:border-red-200 shadow-sm"
        title={t('Dismiss Payment')}
      >
        <XCircle size={16} />
      </button>
      <button
        onClick={() => handleApprove(payment.id, payment.user_id)}
        className={`inline-flex items-center justify-center rounded-xl bg-pits-primary text-pits-dark-text hover:bg-pits-primary-soft font-black text-[10px] tracking-[0.05em] transition-all shadow-sm active:scale-95 ${
          compact ? 'h-9 flex-1 px-3' : 'h-9 px-3'
        }`}
      >
        <CheckCircle size={14} className="mr-1.5 text-pits-success shrink-0" />
        <span className="truncate">{t('VERIFY & UNLOCK')}</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6 pb-6 min-w-0">
      {/* COMMAND CENTER HEADER */}
      <div className="flex justify-between items-center gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-pits-dim">{t('System Live')}</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-pits-text uppercase italic tracking-tighter leading-none truncate">
            {t('Command Center')}
          </h2>
          <p className="text-pits-dim font-bold text-[10px] sm:text-xs mt-1.5 sm:mt-2 uppercase tracking-wide">
            {t("Today's Operational Pulse")}
            {lastSynced && (
              <span className="ml-3 text-[10px] text-gray-400 font-normal normal-case">
                <Clock size={10} className="inline mr-1 -mt-0.5" />
                {t('Updated {{time}}', { time: lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
              </span>
            )}
          </p>
        </div>
        
        <div className="flex gap-3 shrink-0">
          <div className="hidden lg:flex flex-col items-end mr-4 border-r pr-4">
             <span className="text-[10px] font-black text-pits-dim uppercase italic">{t('Box Load')}</span>
             <span className="text-xl font-black text-pits-text italic leading-none">{stats.dailyUsagePercent}%</span>
          </div>
          <button 
            onClick={handleRefresh}
            className="p-2.5 sm:p-3 bg-pits-surface-elevated border rounded-xl hover:bg-pits-surface-elevated/50 text-pits-text transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* OPERATIONAL SIGNAL GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {/* Signal 1: Awaiting Review */}
        <button 
          onClick={() => openModal(t('Awaiting Review'), 'payments', stats.pendingPayments)}
          className={`group bg-pits-surface-elevated p-3 sm:p-4 rounded-2xl border shadow-sm flex flex-col justify-between border-b-4 transition-all hover:shadow-lg hover:-translate-y-0.5 text-left min-h-[108px] sm:min-h-[132px] ${stats.pendingPayments.length > 0 ? 'border-b-pits-red' : 'border-b-green-500'}`}
        >
          <div className="flex justify-between items-start mb-2 sm:mb-3">
            <p className="text-pits-dim font-black text-[9px] sm:text-[10px] uppercase tracking-widest bg-gray-50 px-1.5 py-0.5 rounded">{t('Verification')}</p>
            <div className={`p-1.5 sm:p-2 rounded-xl border transition-colors ${stats.pendingPayments.length > 0 ? 'bg-red-50 text-pits-red border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
              {stats.pendingPayments.length > 0 ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-pits-text italic leading-none">{stats.pendingPayments.length}</p>
            <div className="flex items-center justify-between mt-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-pits-dim group-hover:text-pits-red">
               <span className="truncate pr-1">{t('Awaiting Review')}</span>
               <ChevronRight size={12} className="shrink-0 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" />
            </div>
          </div>
        </button>

        {/* Signal 2: Access Blocked (Unpaid) */}
        <button 
          onClick={() => openModal(t('Access Blocked'), 'athletes', stats.unpaidMembers)}
          className={`group bg-pits-surface-elevated p-3 sm:p-4 rounded-2xl border shadow-sm flex flex-col justify-between border-b-4 transition-all hover:shadow-lg hover:-translate-y-0.5 text-left min-h-[108px] sm:min-h-[132px] ${stats.unpaidMembers.length > 0 ? 'border-b-red-600' : 'border-b-green-500'}`}
        >
          <div className="flex justify-between items-start mb-2 sm:mb-3">
            <p className="text-pits-dim font-black text-[9px] sm:text-[10px] uppercase tracking-widest bg-gray-50 px-1.5 py-0.5 rounded">{t('Blocked')}</p>
            <div className={`p-1.5 sm:p-2 rounded-xl border transition-colors ${stats.unpaidMembers.length > 0 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
              <ShieldAlert size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-pits-text italic leading-none">{stats.unpaidMembers.length}</p>
            <div className="flex items-center justify-between mt-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-pits-dim group-hover:text-red-700">
               <span className="truncate pr-1">{t('Action required')}</span>
               <ChevronRight size={12} className="shrink-0 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all" />
            </div>
          </div>
        </button>

        {/* Signal 3: Retention Risk (Inactive) */}
        <button 
          onClick={() => openModal(t('Retention Risk'), 'athletes', stats.inactiveAthletes)}
          className={`group bg-pits-surface-elevated p-3 sm:p-4 rounded-2xl border shadow-sm flex flex-col justify-between border-b-4 transition-all hover:shadow-lg hover:-translate-y-0.5 text-left min-h-[108px] sm:min-h-[132px] ${stats.inactiveAthletes.length > 0 ? 'border-b-orange-500' : 'border-b-green-500'}`}
        >
          <div className="flex justify-between items-start mb-2 sm:mb-3">
            <p className="text-pits-dim font-black text-[9px] sm:text-[10px] uppercase tracking-widest bg-gray-50 px-1.5 py-0.5 rounded">{t('Retention')}</p>
            <div className={`p-1.5 sm:p-2 rounded-xl border transition-colors ${stats.inactiveAthletes.length > 0 ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
              <Zap size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-pits-text italic leading-none">{stats.inactiveAthletes.length}</p>
            <div className="flex items-center justify-between mt-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-pits-dim group-hover:text-orange-600">
               <span className="truncate pr-1">{t('Out of box 10+ days')}</span>
               <ChevronRight size={12} className="shrink-0 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all" />
            </div>
          </div>
        </button>

        {/* Signal 4: Growth Gaps (Low occupancy) */}
        <button 
          onClick={() => openModal(t('Growth Gaps'), 'classes', stats.lowOccupancyClasses)}
          className={`group bg-pits-surface-elevated p-3 sm:p-4 rounded-2xl border shadow-sm flex flex-col justify-between border-b-4 transition-all hover:shadow-lg hover:-translate-y-0.5 text-left min-h-[108px] sm:min-h-[132px] ${stats.lowOccupancyClasses.length > 0 ? 'border-b-orange-400' : 'border-b-blue-500'}`}
        >
          <div className="flex justify-between items-start mb-2 sm:mb-3">
            <p className="text-pits-dim font-black text-[9px] sm:text-[10px] uppercase tracking-widest bg-gray-50 px-1.5 py-0.5 rounded">{t('Efficiency')}</p>
            <div className={`p-1.5 sm:p-2 rounded-xl border transition-colors ${stats.lowOccupancyClasses.length > 0 ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-pits-text italic leading-none">{stats.lowOccupancyClasses.length}</p>
            <div className="flex items-center justify-between mt-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-pits-dim group-hover:text-orange-600">
               <span className="truncate pr-1">{t('Capacity Gaps Today')}</span>
               <ChevronRight size={12} className="shrink-0 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all" />
            </div>
          </div>
        </button>

        {/* Signal 5: Active Roster */}
        <button 
           onClick={() => openModal(t('Active Roster'), 'athletes', stats.totalMembers.filter(m => m.is_solvent))}
           className="bg-pits-panel p-3 sm:p-4 rounded-2xl shadow-lg shadow-pits-red/20 flex flex-col justify-between border-b-4 border-b-pits-red group transition-all hover:shadow-pits-red/40 text-left min-h-[108px] sm:min-h-[132px] col-span-2 lg:col-span-1"
        >
          <div className="flex justify-between items-start mb-2 sm:mb-3">
            <p className="text-pits-dim font-black text-[9px] sm:text-[10px] uppercase tracking-widest bg-pits-ink/10 px-1.5 py-0.5 rounded">{t('Roster')}</p>
            <div className="p-1.5 sm:p-2 bg-pits-ink/10 rounded-xl text-pits-red">
              <CheckCircle size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-pits-text italic leading-none">{stats.totalMembers.filter(m => m.is_solvent).length}</p>
            <p className="text-[9px] sm:text-[10px] text-pits-dim font-black uppercase tracking-widest mt-1.5 italic flex items-center justify-between group-hover:text-pits-text transition-colors">
              <span className="truncate pr-1">{t('Active Athletes')}</span>
              <ChevronRight size={12} className="shrink-0 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" />
            </p>
          </div>
        </button>
      </div>

      {/* PRIORITY ACTION QUEUE */}
      <div className="bg-pits-surface-elevated rounded-2xl sm:rounded-3xl border shadow-sm overflow-hidden min-w-0">
        <div className="px-4 py-3.5 sm:px-6 sm:py-5 border-b border-gray-50 flex justify-between items-center gap-3 bg-gray-50/10">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-xl font-black text-pits-text uppercase italic tracking-tighter flex items-center leading-none">
              <Zap size={18} className="mr-2 sm:mr-3 text-pits-red shrink-0" />
              <span className="truncate">{t('Priority Action Queue')}</span>
            </h3>
            <p className="hidden sm:block text-[10px] text-pits-dim font-bold uppercase tracking-widest mt-2">{t('Critical issues waiting for your decision')}</p>
          </div>
          <span className="shrink-0 bg-pits-red/10 text-pits-red text-[10px] sm:text-xs font-black px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full uppercase tracking-tighter italic">
            {t('{{count}} HIGH STAKE', { count: stats.pendingPayments.length })}
          </span>
        </div>

        {loading ? (
          <div className="p-8 sm:p-16 text-center text-pits-dim font-black uppercase text-xs tracking-[0.3em] animate-pulse italic">{t('Verifying Ledger Persistence...')}</div>
        ) : stats.pendingPayments.length === 0 ? (
          <div className="p-8 sm:p-16 text-center text-pits-dim flex flex-col items-center">
             <div className="w-14 h-14 sm:w-20 sm:h-20 bg-green-50 rounded-full flex items-center justify-center mb-4 sm:mb-6">
                <CheckCircle className="w-7 h-7 sm:w-10 sm:h-10 text-green-500 opacity-40 shadow-sm" />
             </div>
             <p className="font-black uppercase text-sm tracking-tight italic text-pits-text">{t('All operational frictions resolved.')}</p>
             <p className="text-xs text-gray-400 mt-2 font-medium">{t('Your queue is empty. Focus on coaching.')}</p>
          </div>
        ) : (
          <>
            {/* Mobile stacked rows — no nested horizontal scroll */}
            <div className="md:hidden divide-y divide-gray-100">
              {stats.pendingPayments.map((payment) => (
                <div key={payment.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-pits-text uppercase tracking-tighter italic text-sm truncate">
                        {payment.profiles?.full_name || t('Unknown Athlete')}
                      </p>
                      <p className="text-[10px] font-bold text-pits-dim uppercase italic mt-0.5 flex items-center gap-1.5">
                        <Calendar size={11} className="opacity-40 shrink-0" />
                        <span className="truncate">
                          {new Date(payment.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                          {' · '}
                          {payment.method || t('Direct Transfer')}
                        </span>
                      </p>
                    </div>
                    <span className="text-lg font-black text-pits-text italic tracking-tighter shrink-0">
                      {formatCurrency(payment.amount)}
                    </span>
                  </div>
                  {renderPaymentActions(payment, true)}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left border-separate border-spacing-0">
                <thead className="text-[10px] text-pits-dim uppercase bg-gray-50/30 font-black tracking-[0.15em]">
                  <tr>
                    <th className="px-4 lg:px-6 py-3.5 border-b border-gray-50">{t('Transaction Date')}</th>
                    <th className="px-4 lg:px-6 py-3.5 border-b border-gray-50">{t('Athlete Identity')}</th>
                    <th className="px-4 lg:px-6 py-3.5 border-b border-gray-50">{t('Method')}</th>
                    <th className="px-4 lg:px-6 py-3.5 border-b border-gray-50">{t('Amount')}</th>
                    <th className="px-4 lg:px-6 py-3.5 border-b border-gray-50 text-right">{t('Verification')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.pendingPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50/60 transition-all group">
                      <td className="px-4 lg:px-6 py-4 font-bold text-pits-dim whitespace-nowrap">
                         <div className="flex items-center">
                           <Calendar size={14} className="mr-2 opacity-40 shrink-0" />
                           {new Date(payment.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                         </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4 min-w-0">
                        <div className="font-black text-pits-text uppercase tracking-tighter italic text-sm truncate max-w-[180px] lg:max-w-none">
                          {payment.profiles?.full_name || t('Unknown Athlete')}
                        </div>
                        <div className="text-[10px] font-bold text-pits-dim uppercase italic mt-0.5">{t('Verification Pending')}</div>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-pits-surface-elevated border text-pits-dim shadow-sm group-hover:border-pits-text group-hover:text-pits-text transition-all whitespace-nowrap">
                          {payment.method || t('Direct Transfer')}
                        </span>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <span className="text-lg font-black text-pits-text italic tracking-tighter whitespace-nowrap">
                          {formatCurrency(payment.amount)}
                        </span>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        {renderPaymentActions(payment)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <DashboardDetailModal 
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        title={modalConfig.title}
        type={modalConfig.type}
        data={modalConfig.data}
      />

      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={t('Reject Payment')}
        message={t("This will block the athlete's access immediately. Are you sure you want to reject the payment from {{name}}?", { name: confirmConfig.athleteName })}
        confirmLabel={t('Confirm Rejection')}
        cancelLabel={t('Discard')}
        variant="danger"
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}