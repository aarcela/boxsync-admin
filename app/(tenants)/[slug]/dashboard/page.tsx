'use client';

import { useEffect, useState } from 'react';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { financialService } from '@/lib/services/financialService';
import {
  CheckCircle, XCircle, RefreshCw,
  AlertTriangle, ShieldAlert,
  TrendingUp, Zap, ChevronRight,
  Calendar, Clock, Sparkles
} from 'lucide-react';
import DashboardDetailModal from './components/DashboardDetailModal';
import type { DashboardProfile, DashboardClass, DashboardPayment } from '@/lib/services/dashboardService';

type DashboardModalItem = DashboardProfile | DashboardClass | DashboardPayment;
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import PaymentProofReader from '@/components/PaymentProofReader';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import { currencySymbol } from '@/lib/currency';
import Link from 'next/link';

export default function DashboardPage() {
  const { stats, loading, refresh, removePaymentLocally } = useDashboardData();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { currencies } = useTenant();
  const [setupCard, setSetupCard] = useState<{ show: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/admin/setup', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        const pending = data?.steps
          ? Object.values(data.steps as Record<string, string | null>).some((v) => v == null)
          : false;
        setSetupCard({
          show:
            data?.tenant?.signupSource === 'self_serve' &&
            !data?.dismissedAt &&
            pending,
        });
      })
      .catch(() => setSetupCard({ show: false }));
  }, []);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [rejectConfirm, setRejectConfirm] = useState<{
    isOpen: boolean;
    paymentId: string;
    userId: string;
    athleteName: string;
  }>({ isOpen: false, paymentId: '', userId: '', athleteName: '' });

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    type: 'athletes' | 'classes' | 'payments';
    data: DashboardModalItem[];
    variant?: 'overdue' | null;
  }>({
    isOpen: false,
    title: '',
    type: 'athletes',
    data: [],
    variant: null,
  });

  /** Proof + AI + accept/reject in one panel. */
  const [proofReview, setProofReview] = useState<DashboardPayment | null>(null);

  const openModal = (
    title: string,
    type: 'athletes' | 'classes' | 'payments',
    data: DashboardModalItem[],
    variant?: 'overdue' | null,
  ) => {
    setModalConfig({ isOpen: true, title, type, data, variant: variant ?? null });
  };

  const handleRefresh = async () => {
    await refresh();
    setLastSynced(new Date());
    toast(t('Dashboard synced'), 'success');
  };

  // ACTION: APPROVE PAYMENT (1 click from table — AI assist is optional)
  const handleApprove = async (id: string, userId: string) => {
    try {
      const { activated } = await financialService.approvePayment(id, userId);
      setProofReview(null);
      removePaymentLocally(id);
      refresh();
      toast(
        t(
          activated
            ? 'Payment approved successfully'
            : 'Partial payment recorded. Membership still unpaid.',
        ),
        'success',
      );
    } catch {
      toast(t('Error approving payment. Please try again.'), 'error');
    }
  };

  // ACTION: REJECT PAYMENT
  const handleReject = async (id: string, userId: string) => {
    try {
      await financialService.rejectPayment(id, userId);
      setProofReview(null);
      setRejectConfirm({ isOpen: false, paymentId: '', userId: '', athleteName: '' });
      removePaymentLocally(id);
      refresh();
      toast(t('Payment rejected'), 'warning');
    } catch {
      toast(t('Error rejecting payment. Please try again.'), 'error');
    }
  };

  // Format currency for display
  const formatCurrency = (amount: number) => {
    return `${currencySymbol(currencies.reference)}${amount.toLocaleString()}`;
  };

  const requestReject = (payment: DashboardPayment) => {
    setRejectConfirm({
      isOpen: true,
      paymentId: payment.id,
      userId: payment.user_id,
      athleteName: payment.profiles?.full_name || t('Unknown Athlete'),
    });
  };

  const renderPaymentActions = (payment: DashboardPayment, compact = false) => (
    <div className={`flex items-center ${compact ? 'w-full' : 'justify-end'}`}>
      <button
        type="button"
        onClick={() => setProofReview(payment)}
        title={t('VERIFY & UNLOCK')}
        className={`inline-flex items-center justify-center rounded-xl bg-pits-primary text-pits-dark-text hover:bg-pits-primary-soft font-black text-[10px] tracking-[0.05em] transition-all shadow-sm active:scale-95 ${
          compact ? 'h-9 w-full px-3' : 'h-9 px-3'
        }`}
      >
        <Sparkles size={14} className="mr-1.5 shrink-0 opacity-80" aria-hidden />
        <span className="truncate">{t('VERIFY & UNLOCK')}</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6 pb-6 min-w-0">
      {/* COMMAND CENTER HEADER */}
      <div className="flex justify-between items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-4xl font-black text-pits-text uppercase tracking-tighter leading-none truncate">
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
             <span className="text-[10px] font-black text-pits-dim uppercase">{t('Box Load')}</span>
             <span className="text-xl font-black text-pits-text leading-none">{stats.dailyUsagePercent}%</span>
          </div>
          <button 
            onClick={handleRefresh}
            className="p-2.5 sm:p-3 bg-pits-surface-elevated border rounded-xl hover:bg-pits-surface-elevated/50 text-pits-text transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {setupCard?.show && (
        <div className="mb-4 rounded-2xl border border-pits-primary/40 bg-pits-primary-soft p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-black uppercase text-pits-ink">{t('Continue setup')}</p>
            <p className="text-sm text-pits-ink-muted">{t('Finish configuring your gym')}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/setup"
              className="px-4 py-2 rounded-lg bg-pits-black text-white text-xs font-black uppercase tracking-wider"
            >
              {t('Setup assistant')}
            </Link>
            <button
              type="button"
              onClick={async () => {
                await fetch('/api/admin/setup', {
                  method: 'PATCH',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'dismiss' }),
                });
                setSetupCard({ show: false });
              }}
              className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider"
            >
              {t('Dismiss')}
            </button>
          </div>
        </div>
      )}

      {/* TODAY ATTENDANCE */}
      <Link
        href="/dashboard/attendance"
        className="block bg-pits-surface-elevated rounded-2xl border shadow-sm p-4 sm:p-5 border-b-4 border-b-blue-500 hover:shadow-lg hover:-translate-y-0.5 transition-all"
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-pits-dim">
            {t('Daily Attendance')}
          </p>
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 flex items-center gap-1">
            {t('Today')}
            <ChevronRight size={12} />
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <div>
            <p className="text-2xl sm:text-3xl font-black text-pits-text leading-none">
              {stats.todayAttendance.classes}
            </p>
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-pits-dim mt-1.5">
              {t('Classes')}
            </p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-pits-text leading-none">
              {stats.todayAttendance.booked}
            </p>
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-pits-dim mt-1.5">
              {t('booked')}
            </p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-green-600 leading-none">
              {stats.todayAttendance.attended}
            </p>
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-pits-dim mt-1.5">
              {t('attended')}
            </p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-pits-error leading-none">
              {stats.todayAttendance.noShow}
            </p>
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-pits-dim mt-1.5">
              {t('no_show')}
            </p>
          </div>
        </div>
      </Link>

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
            <p className="text-2xl sm:text-3xl font-black text-pits-text leading-none">{stats.pendingPayments.length}</p>
            <div className="flex items-center justify-between mt-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-pits-dim group-hover:text-pits-red">
               <span className="truncate pr-1">{t('Awaiting Review')}</span>
               <ChevronRight size={12} className="shrink-0 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" />
            </div>
          </div>
        </button>

        {/* Signal 2: Overdue today */}
        <button 
          onClick={() => openModal(t('Overdue today'), 'athletes', stats.overdueMembers, 'overdue')}
          className={`group bg-pits-surface-elevated p-3 sm:p-4 rounded-2xl border shadow-sm flex flex-col justify-between border-b-4 transition-all hover:shadow-lg hover:-translate-y-0.5 text-left min-h-[108px] sm:min-h-[132px] ${stats.overdueMembers.length > 0 ? 'border-b-red-600' : 'border-b-green-500'}`}
        >
          <div className="flex justify-between items-start mb-2 sm:mb-3">
            <p className="text-pits-dim font-black text-[9px] sm:text-[10px] uppercase tracking-widest bg-gray-50 px-1.5 py-0.5 rounded">{t('Overdue today')}</p>
            <div className={`p-1.5 sm:p-2 rounded-xl border transition-colors ${stats.overdueMembers.length > 0 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
              <ShieldAlert size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-pits-text leading-none">{stats.overdueMembers.length}</p>
            <div className="flex items-center justify-between mt-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-pits-dim group-hover:text-red-700">
               <span className="truncate pr-1">{t('Overdue today help')}</span>
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
            <p className="text-2xl sm:text-3xl font-black text-pits-text leading-none">{stats.inactiveAthletes.length}</p>
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
            <p className="text-2xl sm:text-3xl font-black text-pits-text leading-none">{stats.lowOccupancyClasses.length}</p>
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
            <p className="text-2xl sm:text-3xl font-black text-pits-text leading-none">{stats.totalMembers.filter(m => m.is_solvent).length}</p>
            <p className="text-[9px] sm:text-[10px] text-pits-dim font-black uppercase tracking-widest mt-1.5 flex items-center justify-between group-hover:text-pits-text transition-colors">
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
            <h3 className="text-sm sm:text-xl font-black text-pits-text uppercase tracking-tighter flex items-center leading-none">
              <Zap size={18} className="mr-2 sm:mr-3 text-pits-red shrink-0" />
              <span className="truncate">{t('Priority Action Queue')}</span>
            </h3>
            <p className="hidden sm:block text-[10px] text-pits-dim font-bold uppercase tracking-widest mt-2">{t('Critical issues waiting for your decision')}</p>
          </div>
          <span className="shrink-0 bg-pits-red/10 text-pits-red text-[10px] sm:text-xs font-black px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full uppercase tracking-tighter">
            {t('{{count}} HIGH STAKE', { count: stats.pendingPayments.length })}
          </span>
        </div>

        {loading ? (
          <div className="p-8 sm:p-16 text-center text-pits-dim font-black uppercase text-xs tracking-[0.3em] animate-pulse">{t('Verifying Ledger Persistence...')}</div>
        ) : stats.pendingPayments.length === 0 ? (
          <div className="p-8 sm:p-16 text-center text-pits-dim flex flex-col items-center">
             <div className="w-14 h-14 sm:w-20 sm:h-20 bg-green-50 rounded-full flex items-center justify-center mb-4 sm:mb-6">
                <CheckCircle className="w-7 h-7 sm:w-10 sm:h-10 text-green-500 opacity-40 shadow-sm" />
             </div>
             <p className="font-black uppercase text-sm tracking-tight text-pits-text">{t('All operational frictions resolved.')}</p>
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
                      <p className="font-black text-pits-text uppercase tracking-tighter text-sm truncate">
                        {payment.profiles?.full_name || t('Unknown Athlete')}
                      </p>
                      <p className="text-[10px] font-bold text-pits-dim uppercase mt-0.5 flex items-center gap-1.5">
                        <Calendar size={11} className="opacity-40 shrink-0" />
                        <span className="truncate">
                          {new Date(payment.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                          {' · '}
                          {payment.method || t('Direct Transfer')}
                        </span>
                      </p>
                    </div>
                    <span className="text-lg font-black text-pits-text tracking-tighter shrink-0">
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
                        <div className="font-black text-pits-text uppercase tracking-tighter text-sm truncate max-w-[180px] lg:max-w-none">
                          {payment.profiles?.full_name || t('Unknown Athlete')}
                        </div>
                        <div className="text-[10px] font-bold text-pits-dim uppercase mt-0.5">{t('Verification Pending')}</div>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-pits-surface-elevated border text-pits-dim shadow-sm group-hover:border-pits-text group-hover:text-pits-text transition-all whitespace-nowrap">
                          {payment.method || t('Direct Transfer')}
                        </span>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <span className="text-lg font-black text-pits-text tracking-tighter whitespace-nowrap">
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
        variant={modalConfig.variant}
      />

      {proofReview ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-pits-background/60 p-4 backdrop-blur-sm"
          onClick={() => setProofReview(null)}
        >
          <div
            className="bg-pits-surface-elevated border border-pits-edge rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center gap-3 p-4 border-b border-pits-edge">
              <div className="min-w-0">
                <h3 className="text-base font-black text-pits-text uppercase tracking-tight truncate">
                  {t('Proof reader')}
                </h3>
                <p className="text-pits-dim text-[10px] font-bold uppercase tracking-widest mt-1 truncate">
                  {proofReview.profiles?.full_name || t('Unknown Athlete')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProofReview(null)}
                className="p-2 rounded-lg border text-pits-dim hover:text-pits-text shrink-0"
                aria-label={t('Close')}
              >
                <XCircle size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {proofReview.proof_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={proofReview.proof_image_url}
                  alt={t('Check Proof')}
                  className="w-full max-h-56 object-contain rounded-lg bg-pits-surface-muted"
                />
              ) : null}
              <PaymentProofReader
                paymentId={proofReview.id}
                proofHref={proofReview.proof_image_url}
              />
            </div>
            <div className="p-4 border-t border-pits-edge flex gap-2">
              <button
                type="button"
                onClick={() => requestReject(proofReview)}
                className="h-10 px-3 rounded-xl border text-pits-error text-[10px] font-black uppercase"
              >
                {t('Dismiss Payment')}
              </button>
              <button
                type="button"
                onClick={() => void handleApprove(proofReview.id, proofReview.user_id)}
                className="h-10 flex-1 px-3 rounded-xl bg-pits-primary text-pits-dark-text text-[10px] font-black uppercase inline-flex items-center justify-center gap-1.5"
              >
                <CheckCircle size={14} className="text-pits-success" />
                {t('VERIFY & UNLOCK')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={rejectConfirm.isOpen}
        title={t('Reject Payment')}
        message={t(
          "This will block the athlete's access immediately. Are you sure you want to reject the payment from {{name}}?",
          { name: rejectConfirm.athleteName },
        )}
        confirmLabel={t('Confirm Rejection')}
        cancelLabel={t('Discard')}
        variant="danger"
        onConfirm={() => void handleReject(rejectConfirm.paymentId, rejectConfirm.userId)}
        onCancel={() => setRejectConfirm((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}