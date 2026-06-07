'use client';

import { useState } from 'react';
import { useDashboardData } from '../../lib/hooks/useDashboardData';
import { supabase } from '../../lib/supabase';
import { 
  CheckCircle, XCircle, ExternalLink, RefreshCw, 
  AlertTriangle, ShieldAlert,
  TrendingUp, Zap, ChevronRight,
  Calendar, Clock
} from 'lucide-react';
import DashboardDetailModal from './components/DashboardDetailModal';
import type { DashboardProfile, DashboardClass, DashboardPayment } from '@/lib/services/dashboardService';

type DashboardModalItem = DashboardProfile | DashboardClass | DashboardPayment;
import { useToast } from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useLanguage } from '../../components/LanguageContext';

export default function DashboardPage() {
  const { stats, loading, refresh, removePaymentLocally } = useDashboardData();
  const { toast } = useToast();
  const { t } = useLanguage();
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
      const { error: payError } = await supabase
        .from('payments')
        .update({ status: 'approved' })
        .eq('id', id);
      
      if (payError) throw payError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_solvent: true })
        .eq('id', userId);

      if (profileError) throw profileError;

      removePaymentLocally(id);
      refresh();
      toast(t('Payment approved successfully'), 'success');

    } catch {
      toast(t('Error approving payment. Please try again.'), 'error');
    }
  };

  // ACTION: REJECT PAYMENT
  const handleReject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;

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
      await handleReject(paymentId);
    }
  };

  // Format currency for display
  const formatCurrency = (amount: number) => {
    // Default to EUR for overview display
    return `€${amount.toLocaleString()}`;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* COMMAND CENTER HEADER */}
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-pits-dim">{t('System Live')}</span>
          </div>
          <h2 className="text-4xl font-black text-pits-text uppercase italic tracking-tighter leading-none">
            {t('Command Center')}
          </h2>
          <p className="text-pits-dim font-bold text-xs mt-2 uppercase tracking-wide">
            {t("Today's Operational Pulse")}
            {lastSynced && (
              <span className="ml-3 text-[10px] text-gray-400 font-normal normal-case">
                <Clock size={10} className="inline mr-1 -mt-0.5" />
                {t('Updated {{time}}', { time: lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
              </span>
            )}
          </p>
        </div>
        
        <div className="flex gap-3">
          <div className="hidden lg:flex flex-col items-end mr-4 border-r  pr-4">
             <span className="text-[10px] font-black text-pits-dim uppercase italic">{t('Box Load')}</span>
             <span className="text-xl font-black text-pits-text italic leading-none">{stats.dailyUsagePercent}%</span>
          </div>
          <button 
            onClick={handleRefresh}
            className="p-4 bg-pits-surface-elevated border   rounded-2xl hover:bg-pits-surface-elevated/50 text-pits-text transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* OPERATIONAL SIGNAL GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Signal 1: Awaiting Review */}
        <button 
          onClick={() => openModal(t('Awaiting Review'), 'payments', stats.pendingPayments)}
          className={`group bg-pits-surface-elevated p-5 rounded-3xl border  shadow-sm flex flex-col justify-between border-b-4 transition-all hover:shadow-xl hover:-translate-y-1 text-left ${stats.pendingPayments.length > 0 ? 'border-b-pits-red' : 'border-b-green-500'}`}
        >
          <div className="flex justify-between items-start mb-6">
            <p className="text-pits-dim font-black text-[10px] uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded">{t('Verification')}</p>
            <div className={`p-2.5 rounded-2xl border transition-colors ${stats.pendingPayments.length > 0 ? 'bg-red-50 text-pits-red border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
              {stats.pendingPayments.length > 0 ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
            </div>
          </div>
          <div>
            <p className="text-4xl font-black text-pits-text italic leading-none">{stats.pendingPayments.length}</p>
            <div className="flex items-center justify-between mt-2 text-[10px] font-black uppercase tracking-wider text-pits-dim group-hover:text-pits-red">
               <span>{t('Awaiting Review')}</span>
               <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" />
            </div>
          </div>
        </button>

        {/* Signal 2: Access Blocked (Unpaid) */}
        <button 
          onClick={() => openModal(t('Access Blocked'), 'athletes', stats.unpaidMembers)}
          className={`group bg-pits-surface-elevated p-5 rounded-3xl border  shadow-sm flex flex-col justify-between border-b-4 transition-all hover:shadow-xl hover:-translate-y-1 text-left ${stats.unpaidMembers.length > 0 ? 'border-b-red-600' : 'border-b-green-500'}`}
        >
          <div className="flex justify-between items-start mb-6">
            <p className="text-pits-dim font-black text-[10px] uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded">{t('Blocked')}</p>
            <div className={`p-2.5 rounded-2xl border transition-colors ${stats.unpaidMembers.length > 0 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
              <ShieldAlert size={20} />
            </div>
          </div>
          <div>
            <p className="text-4xl font-black text-pits-text italic leading-none">{stats.unpaidMembers.length}</p>
            <div className="flex items-center justify-between mt-2 text-[10px] font-black uppercase tracking-wider text-pits-dim group-hover:text-red-700">
               <span>{t('Action required')}</span>
               <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all" />
            </div>
          </div>
        </button>

        {/* Signal 3: Retention Risk (Inactive) */}
        <button 
          onClick={() => openModal(t('Retention Risk'), 'athletes', stats.inactiveAthletes)}
          className={`group bg-pits-surface-elevated p-5 rounded-3xl border  shadow-sm flex flex-col justify-between border-b-4 transition-all hover:shadow-xl hover:-translate-y-1 text-left ${stats.inactiveAthletes.length > 0 ? 'border-b-orange-500' : 'border-b-green-500'}`}
        >
          <div className="flex justify-between items-start mb-6">
            <p className="text-pits-dim font-black text-[10px] uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded">{t('Retention')}</p>
            <div className={`p-2.5 rounded-2xl border transition-colors ${stats.inactiveAthletes.length > 0 ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
              <Zap size={20} />
            </div>
          </div>
          <div>
            <p className="text-4xl font-black text-pits-text italic leading-none">{stats.inactiveAthletes.length}</p>
            <div className="flex items-center justify-between mt-2 text-[10px] font-black uppercase tracking-wider text-pits-dim group-hover:text-orange-600">
               <span>{t('Out of box 10+ days')}</span>
               <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all" />
            </div>
          </div>
        </button>

        {/* Signal 4: Growth Gaps (Low occupancy) */}
        <button 
          onClick={() => openModal(t('Growth Gaps'), 'classes', stats.lowOccupancyClasses)}
          className={`group bg-pits-surface-elevated p-5 rounded-3xl border  shadow-sm flex flex-col justify-between border-b-4 transition-all hover:shadow-xl hover:-translate-y-1 text-left ${stats.lowOccupancyClasses.length > 0 ? 'border-b-orange-400' : 'border-b-blue-500'}`}
        >
          <div className="flex justify-between items-start mb-6">
            <p className="text-pits-dim font-black text-[10px] uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded">{t('Efficiency')}</p>
            <div className={`p-2.5 rounded-2xl border transition-colors ${stats.lowOccupancyClasses.length > 0 ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div>
            <p className="text-4xl font-black text-pits-text italic leading-none">{stats.lowOccupancyClasses.length}</p>
            <div className="flex items-center justify-between mt-2 text-[10px] font-black uppercase tracking-wider text-pits-dim group-hover:text-orange-600">
               <span>{t('Capacity Gaps Today')}</span>
               <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all" />
            </div>
          </div>
        </button>

        {/* Signal 5: Active Roster */}
        <button 
           onClick={() => openModal(t('Active Roster'), 'athletes', stats.totalMembers.filter(m => m.is_solvent))}
           className="bg-pits-panel p-6 rounded-3xl shadow-2xl shadow-pits-red/20 flex flex-col justify-between border-b-4 border-b-pits-red group transition-all hover:shadow-pits-red/40"
        >
          <div className="flex justify-between items-start mb-6">
            <p className="text-white/60 font-black text-[10px] uppercase tracking-widest bg-pits-ink/10 px-2 py-0.5 rounded">{t('Roster')}</p>
            <div className="p-2.5 bg-pits-ink/10 rounded-2xl text-pits-red">
              <CheckCircle size={20} />
            </div>
          </div>
          <div>
            <p className="text-4xl font-black text-white italic leading-none">{stats.totalMembers.filter(m => m.is_solvent).length}</p>
            <p className="text-[10px] text-white/50 font-black uppercase tracking-widest mt-2 italic flex items-center justify-between group-hover:text-white transition-colors">
              {t('Active Athletes')}
              <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" />
            </p>
          </div>
        </button>
      </div>

      {/* PRIORITY ACTION QUEUE */}
      <div className="bg-pits-surface-elevated rounded-[2rem] border  shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/10">
          <div>
            <h3 className="text-xl font-black text-pits-text uppercase italic tracking-tighter flex items-center leading-none">
              <Zap size={24} className="mr-3 text-pits-red" />
              {t('Priority Action Queue')}
            </h3>
            <p className="text-[10px] text-pits-dim font-bold uppercase tracking-widest mt-2">{t('Critical issues waiting for your decision')}</p>
          </div>
          <div className="flex flex-col items-end">
            <span className="bg-pits-red/10 text-pits-red text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-tighter italic">
              {t('{{count}} HIGH STAKE', { count: stats.pendingPayments.length })}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-pits-dim font-black uppercase text-xs tracking-[0.3em] animate-pulse italic">{t('Verifying Ledger Persistence...')}</div>
        ) : stats.pendingPayments.length === 0 ? (
          <div className="p-16 text-center text-pits-dim flex flex-col items-center">
             <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
                <CheckCircle size={40} className="text-green-500 opacity-40 shadow-sm" />
             </div>
             <p className="font-black uppercase text-sm tracking-tight italic text-pits-text">{t('All operational frictions resolved.')}</p>
             <p className="text-xs text-gray-400 mt-2 font-medium">{t('Your queue is empty. Focus on coaching.')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-separate border-spacing-0">
              <thead className="text-[10px] text-pits-dim uppercase bg-gray-50/30 font-black tracking-[0.15em]">
                <tr>
                  <th className="px-8 py-6 border-b border-gray-50">{t('Transaction Date')}</th>
                  <th className="px-8 py-6 border-b border-gray-50">{t('Athlete Identity')}</th>
                  <th className="px-8 py-6 border-b border-gray-50">{t('Method')}</th>
                  <th className="px-8 py-6 border-b border-gray-50">{t('Amount')}</th>  
                  <th className="px-8 py-6 border-b border-gray-50 text-right">{t('Verification')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.pendingPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50/60 transition-all group">
                    <td className="px-8 py-6 font-bold text-pits-dim">
                       <div className="flex items-center">
                         <Calendar size={14} className="mr-3 opacity-40" />
                         {new Date(payment.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                       </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-black text-pits-text uppercase tracking-tighter italic text-base">
                        {payment.profiles?.full_name || t('Unknown Athlete')}
                      </div>
                      <div className="text-[10px] font-bold text-pits-dim uppercase italic mt-0.5">{t('Verification Pending')}</div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-pits-surface-elevated border   text-pits-dim shadow-sm group-hover:border-pits-text group-hover:text-pits-text transition-all">
                        {payment.method || t('Direct Transfer')}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-2xl font-black text-pits-text italic tracking-tighter">
                        {formatCurrency(payment.amount)}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right space-x-3">
                      <a 
                        href={payment.proof_image_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 font-black text-[10px] uppercase tracking-tighter transition-all hover:translate-y-px"
                      >
                        <ExternalLink size={14} className="mr-1.5" />
                        {t('Audit Proof')}
                      </a>
                      <button 
                        onClick={() => setConfirmConfig({
                          isOpen: true,
                          paymentId: payment.id,
                          action: 'reject',
                          userId: payment.user_id,
                          athleteName: payment.profiles?.full_name || t('Unknown Athlete')
                        })}
                        className="inline-flex items-center justify-center p-3 rounded-2xl text-pits-error hover:bg-red-50 transition-all border  hover:border-red-200 shadow-sm"
                        title={t('Dismiss Payment')}
                      >
                        <XCircle size={20} />
                      </button>
                      <button 
                        onClick={() => handleApprove(payment.id, payment.user_id)}
                        className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-pits-panel text-white hover:bg-black font-black text-[10px] tracking-[0.05em] transition-all shadow-lg hover:shadow-black/10 active:scale-95"
                      >
                        <CheckCircle size={16} className="mr-2 text-green-400" />
                        {t('VERIFY & UNLOCK')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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