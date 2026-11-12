'use client';

import { useEffect, useState } from 'react';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { financialService } from '@/lib/services/financialService';
import {
  CheckCircle, RefreshCw,
  AlertTriangle, ShieldAlert,
  TrendingUp, Zap, ChevronRight,
  Calendar, Clock, Sparkles
} from 'lucide-react';
import DashboardDetailModal from './components/DashboardDetailModal';
import type { DashboardProfile, DashboardClass, DashboardPayment } from '@/lib/services/dashboardService';

type DashboardModalItem = DashboardProfile | DashboardClass | DashboardPayment;
import { useToast } from '@/components/Toast';
import PaymentReviewPanel from '@/components/PaymentReviewPanel';
import { formatDate, formatDateLong, formatDateShort, formatTime } from '@/lib/utils/format-date';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import { currencySymbol } from '@/lib/currency';
import Link from 'next/link';

export default function DashboardPage() {
  const { stats, loading, loaded, error, refresh, removePaymentLocally } = useDashboardData();
  const show = (value: number | string) => (loaded ? value : '—');
  /** Status tone only when there is something to act on; zero / loading stays neutral. */
  type Tone = 'danger' | 'warning' | 'info';
  const STRIPE: Record<Tone, string> = {
    danger: 'border-b-pits-danger',
    warning: 'border-b-pits-warning',
    info: 'border-b-pits-info',
  };
  const CHIP: Record<Tone, string> = {
    danger: 'bg-pits-danger-soft text-pits-danger border-pits-danger-edge',
    warning: 'bg-pits-warning-soft text-pits-warning border-pits-warning-edge',
    info: 'bg-pits-info-soft text-pits-info border-pits-info-edge',
  };
  const active = (count: number) => loaded && count > 0;
  const stripe = (count: number, tone: Tone) => (active(count) ? STRIPE[tone] : 'border-b-pits-edge');
  const chip = (count: number, tone: Tone) =>
    active(count) ? CHIP[tone] : 'bg-pits-surface-muted text-pits-dim border-pits-edge';
  const { toast } = useToast();
  const { t, lang } = useLanguage();
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

  /** Proof + AI + accept/reject in one panel; walks the whole queue. */
  const [reviewId, setReviewId] = useState<string | null>(null);

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

  const handleApprove = async (payment: DashboardPayment) => {
    try {
      const { activated } = await financialService.approvePayment(payment.id, payment.user_id);
      removePaymentLocally(payment.id);
      toast(
        t(
          activated
            ? 'Payment approved successfully'
            : 'Partial payment recorded. Membership still unpaid.',
        ),
        'success',
      );
      return true;
    } catch {
      toast(t('Error approving payment. Please try again.'), 'error');
      return false;
    }
  };

  const handleReject = async (payment: DashboardPayment, reason: string) => {
    try {
      await financialService.rejectPayment(payment.id, payment.user_id, reason || undefined);
      removePaymentLocally(payment.id);
      toast(t('Payment rejected'), 'warning');
      return true;
    } catch {
      toast(t('Error rejecting payment. Please try again.'), 'error');
      return false;
    }
  };

  const closeReview = () => {
    setReviewId(null);
    void refresh();
  };

  // Format currency for display
  const formatCurrency = (amount: number) => {
    return `${currencySymbol(currencies.reference)}${amount.toLocaleString()}`;
  };

  const renderPaymentActions = (payment: DashboardPayment, compact = false) => (
    <div className={`flex items-center ${compact ? 'w-full' : 'justify-end'}`}>
      <button
        type="button"
        onClick={() => setReviewId(payment.id)}
        title={t('Review')}
        className={`inline-flex items-center justify-center rounded-xl bg-pits-primary text-pits-dark-text hover:bg-pits-primary-soft font-black text-[10px] tracking-[0.05em] transition-all shadow-sm active:scale-95 ${
          compact ? 'h-9 w-full px-3' : 'h-9 px-3'
        }`}
      >
        <Sparkles size={14} className="mr-1.5 shrink-0 opacity-80" aria-hidden />
        <span className="truncate">{t('Review')}</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6 pb-6 min-w-0">
      {/* HEADER */}
      <div className="flex justify-between items-center gap-3">
        <div className="min-w-0">
          <h1 className="page-title truncate">
            {t('Today')}
          </h1>
          <p className="text-pits-dim font-bold text-[10px] sm:text-xs mt-1.5 sm:mt-2 uppercase tracking-wide">
            {formatDateLong(new Date(), lang)}
            {lastSynced && (
              <span className="ml-3 text-[10px] text-gray-400 font-normal normal-case">
                <Clock size={10} className="inline mr-1 -mt-0.5" />
                {t('Updated {{time}}', { time: formatTime(lastSynced, lang) })}
              </span>
            )}
          </p>
        </div>
        
        <div className="flex gap-3 shrink-0">
          <div className="hidden lg:flex flex-col items-end mr-4 border-r pr-4">
             <span className="text-[10px] font-black text-pits-dim uppercase">{t('Box Load')}</span>
             <span className="text-xl font-black text-pits-text leading-none">{loaded ? `${stats.dailyUsagePercent}%` : '—'}</span>
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
        className="block bg-pits-surface-elevated rounded-2xl border shadow-sm p-4 sm:p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all"
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-pits-dim">
            {t('Daily Attendance')}
          </p>
          <span className="text-[10px] font-black uppercase tracking-wider text-pits-dim flex items-center gap-1">
            {t('Today')}
            <ChevronRight size={12} />
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <div>
            <p className="text-2xl sm:text-3xl font-black text-pits-text leading-none">
              {show(stats.todayAttendance.classes)}
            </p>
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-pits-dim mt-1.5">
              {t('Classes')}
            </p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-pits-text leading-none">
              {show(stats.todayAttendance.booked)}
            </p>
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-pits-dim mt-1.5">
              {t('booked')}
            </p>
          </div>
          <div>
            <p className={`text-2xl sm:text-3xl font-black ${active(stats.todayAttendance.attended) ? 'text-pits-positive' : loaded ? 'text-pits-text' : 'text-pits-dim'} leading-none`}>
              {show(stats.todayAttendance.attended)}
            </p>
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-pits-dim mt-1.5">
              {t('attended')}
            </p>
          </div>
          <div>
            <p className={`text-2xl sm:text-3xl font-black ${active(stats.todayAttendance.noShow) ? 'text-pits-danger' : loaded ? 'text-pits-text' : 'text-pits-dim'} leading-none`}>
              {show(stats.todayAttendance.noShow)}
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
          className={`group bg-pits-surface-elevated p-3 sm:p-4 rounded-2xl border shadow-sm flex flex-col justify-between border-b-4 transition-all hover:shadow-lg hover:-translate-y-0.5 text-left min-h-[108px] sm:min-h-[132px] ${stripe(stats.pendingPayments.length, 'warning')}`}
        >
          <div className="flex justify-between items-start mb-2 sm:mb-3">
            <p className="text-pits-dim font-black text-[9px] sm:text-[10px] uppercase tracking-widest bg-gray-50 px-1.5 py-0.5 rounded">{t('Payments')}</p>
            <div className={`p-1.5 sm:p-2 rounded-xl border transition-colors ${chip(stats.pendingPayments.length, 'warning')}`}>
              {!loaded ? <Clock size={16} /> : stats.pendingPayments.length > 0 ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-pits-text leading-none">{show(stats.pendingPayments.length)}</p>
            <div className="flex items-center justify-between mt-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-pits-dim group-hover:text-pits-text">
               <span className="truncate pr-1">{t('Awaiting Review')}</span>
               <ChevronRight size={12} className="shrink-0 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" />
            </div>
          </div>
        </button>

        {/* Signal 2: Overdue today */}
        <button 
          onClick={() => openModal(t('Overdue today'), 'athletes', stats.overdueMembers, 'overdue')}
          className={`group bg-pits-surface-elevated p-3 sm:p-4 rounded-2xl border shadow-sm flex flex-col justify-between border-b-4 transition-all hover:shadow-lg hover:-translate-y-0.5 text-left min-h-[108px] sm:min-h-[132px] ${stripe(stats.overdueMembers.length, 'danger')}`}
        >
          <div className="flex justify-between items-start mb-2 sm:mb-3">
            <p className="text-pits-dim font-black text-[9px] sm:text-[10px] uppercase tracking-widest bg-gray-50 px-1.5 py-0.5 rounded">{t('Overdue today')}</p>
            <div className={`p-1.5 sm:p-2 rounded-xl border transition-colors ${chip(stats.overdueMembers.length, 'danger')}`}>
              <ShieldAlert size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-pits-text leading-none">{show(stats.overdueMembers.length)}</p>
            <div className="flex items-center justify-between mt-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-pits-dim group-hover:text-pits-text">
               <span className="truncate pr-1">{t('Overdue today help')}</span>
               <ChevronRight size={12} className="shrink-0 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all" />
            </div>
          </div>
        </button>

        {/* Signal 3: Retention Risk (Inactive) */}
        <button 
          onClick={() => openModal(t('Retention Risk'), 'athletes', stats.inactiveAthletes)}
          className={`group bg-pits-surface-elevated p-3 sm:p-4 rounded-2xl border shadow-sm flex flex-col justify-between border-b-4 transition-all hover:shadow-lg hover:-translate-y-0.5 text-left min-h-[108px] sm:min-h-[132px] ${stripe(stats.inactiveAthletes.length, 'warning')}`}
        >
          <div className="flex justify-between items-start mb-2 sm:mb-3">
            <p className="text-pits-dim font-black text-[9px] sm:text-[10px] uppercase tracking-widest bg-gray-50 px-1.5 py-0.5 rounded">{t('Retention')}</p>
            <div className={`p-1.5 sm:p-2 rounded-xl border transition-colors ${chip(stats.inactiveAthletes.length, 'warning')}`}>
              <Zap size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-pits-text leading-none">{show(stats.inactiveAthletes.length)}</p>
            <div className="flex items-center justify-between mt-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-pits-dim group-hover:text-pits-text">
               <span className="truncate pr-1">{t('Out of box 10+ days')}</span>
               <ChevronRight size={12} className="shrink-0 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all" />
            </div>
          </div>
        </button>

        {/* Signal 4: Growth Gaps (Low occupancy) */}
        <button 
          onClick={() => openModal(t('Low-occupancy classes'), 'classes', stats.lowOccupancyClasses)}
          className={`group bg-pits-surface-elevated p-3 sm:p-4 rounded-2xl border shadow-sm flex flex-col justify-between border-b-4 transition-all hover:shadow-lg hover:-translate-y-0.5 text-left min-h-[108px] sm:min-h-[132px] ${stripe(stats.lowOccupancyClasses.length, 'info')}`}
        >
          <div className="flex justify-between items-start mb-2 sm:mb-3">
            <p className="text-pits-dim font-black text-[9px] sm:text-[10px] uppercase tracking-widest bg-gray-50 px-1.5 py-0.5 rounded">{t('Occupancy')}</p>
            <div className={`p-1.5 sm:p-2 rounded-xl border transition-colors ${chip(stats.lowOccupancyClasses.length, 'info')}`}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-pits-text leading-none">{show(stats.lowOccupancyClasses.length)}</p>
            <div className="flex items-center justify-between mt-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-pits-dim group-hover:text-pits-text">
               <span className="truncate pr-1">{t('Low occupancy today')}</span>
               <ChevronRight size={12} className="shrink-0 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all" />
            </div>
          </div>
        </button>

        {/* Signal 5: Active Roster */}
        <button 
           onClick={() => openModal(t('Active Roster'), 'athletes', stats.totalMembers.filter(m => m.is_solvent))}
           className="bg-pits-surface-elevated p-3 sm:p-4 rounded-2xl border shadow-sm flex flex-col justify-between border-b-4 border-b-pits-edge group transition-all hover:shadow-lg hover:-translate-y-0.5 text-left min-h-[108px] sm:min-h-[132px] col-span-2 lg:col-span-1"
        >
          <div className="flex justify-between items-start mb-2 sm:mb-3">
            <p className="text-pits-dim font-black text-[9px] sm:text-[10px] uppercase tracking-widest bg-gray-50 px-1.5 py-0.5 rounded">{t('Roster')}</p>
            <div className="p-1.5 sm:p-2 rounded-xl border bg-pits-surface-muted text-pits-dim border-pits-edge">
              <CheckCircle size={16} />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-pits-text leading-none">{show(stats.totalMembers.filter(m => m.is_solvent).length)}</p>
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
              <Zap size={18} className="mr-2 sm:mr-3 text-pits-dim shrink-0" />
              <span className="truncate">{t('Payments to review')}</span>
            </h3>
            <p className="hidden sm:block text-[10px] text-pits-dim font-bold uppercase tracking-widest mt-2">{t('Approve or reject each payment proof.')}</p>
          </div>
          {loaded ? (
            <span className={`shrink-0 border text-[10px] sm:text-xs font-black px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full uppercase tracking-tighter ${chip(stats.pendingPayments.length, 'warning')}`}>
              {t('{{count}} pending', { count: stats.pendingPayments.length })}
            </span>
          ) : null}
        </div>

        {!loaded && error ? (
          <div className="p-8 sm:p-12 text-center flex flex-col items-center gap-3">
            <p className="text-sm font-semibold text-pits-text">{t("Couldn't load today's data.")}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="px-4 py-2 rounded-lg bg-pits-black text-white text-xs font-semibold"
            >
              {t('Try again')}
            </button>
          </div>
        ) : !loaded ? (
          <div className="divide-y divide-pits-edge" aria-busy="true" aria-label={t('Loading...')}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 sm:px-6 py-4 animate-pulse">
                <div className="h-3 w-20 rounded bg-pits-surface-muted" />
                <div className="h-3 flex-1 max-w-[180px] rounded bg-pits-surface-muted" />
                <div className="hidden md:block h-3 w-16 rounded bg-pits-surface-muted" />
                <div className="ml-auto h-8 w-28 rounded-xl bg-pits-surface-muted" />
              </div>
            ))}
          </div>
        ) : stats.pendingPayments.length === 0 ? (
          <div className="p-8 sm:p-16 text-center text-pits-dim flex flex-col items-center">
             <div className="w-14 h-14 sm:w-20 sm:h-20 bg-pits-positive-soft rounded-full flex items-center justify-center mb-4 sm:mb-6">
                <CheckCircle className="w-7 h-7 sm:w-10 sm:h-10 text-pits-positive" />
             </div>
             <p className="font-black uppercase text-sm tracking-tight text-pits-text">{t('No payments to review.')}</p>
             <p className="text-xs text-gray-400 mt-2 font-medium">{t('New payment proofs will show up here.')}</p>
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
                          {formatDateShort(payment.created_at, lang)}
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
                    <th className="px-4 lg:px-6 py-3.5 border-b border-gray-50">{t('Date')}</th>
                    <th className="px-4 lg:px-6 py-3.5 border-b border-gray-50">{t('Athlete')}</th>
                    <th className="px-4 lg:px-6 py-3.5 border-b border-gray-50">{t('Method')}</th>
                    <th className="px-4 lg:px-6 py-3.5 border-b border-gray-50">{t('Amount')}</th>
                    <th className="px-4 lg:px-6 py-3.5 border-b border-gray-50 text-right">{t('Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.pendingPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50/60 transition-all group">
                      <td className="px-4 lg:px-6 py-4 font-bold text-pits-dim whitespace-nowrap">
                         <div className="flex items-center">
                           <Calendar size={14} className="mr-2 opacity-40 shrink-0" />
                           {formatDate(payment.created_at, lang)}
                         </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4 min-w-0">
                        <div className="font-black text-pits-text uppercase tracking-tighter text-sm truncate max-w-[180px] lg:max-w-none">
                          {payment.profiles?.full_name || t('Unknown Athlete')}
                        </div>
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
        formatAmount={formatCurrency}
        onReviewPayment={(id) => {
          setModalConfig((prev) => ({ ...prev, isOpen: false }));
          setReviewId(id);
        }}
      />

      {reviewId ? (
        <PaymentReviewPanel
          payments={stats.pendingPayments}
          initialId={reviewId}
          formatAmount={(p) => formatCurrency(p.amount)}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={closeReview}
        />
      ) : null}
    </div>
  );
}