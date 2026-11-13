'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { X, User, Clock, CheckCircle, Bell } from 'lucide-react';
import { DashboardProfile, DashboardClass, DashboardPayment } from '@/lib/services/dashboardService';
import { useLanguage } from '@/components/LanguageContext';
import MemberContactActions, { contactActionBtn } from '@/components/MemberContactActions';
import { formatDate, formatTime } from '@/lib/utils/format-date';

type DashboardModalItem = DashboardProfile | DashboardClass | DashboardPayment;

interface DashboardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'athletes' | 'classes' | 'payments';
  data: DashboardModalItem[];
  variant?: 'overdue' | null;
  formatAmount: (amount: number) => string;
  onReviewPayment: (paymentId: string) => void;
}

export default function DashboardDetailModal(props: DashboardDetailModalProps) {
  // Mount the body only while open so its local state resets each time.
  if (!props.isOpen) return null;
  return <DetailBody {...props} />;
}


function DetailBody({
  onClose,
  title,
  type,
  data,
  variant,
  formatAmount,
  onReviewPayment,
}: DashboardDetailModalProps) {
  const { t, lang } = useLanguage();
  const [reservedOnly, setReservedOnly] = useState(false);

  const athletes = data as DashboardProfile[];
  const rows = useMemo(() => {
    if (variant !== 'overdue' || !reservedOnly) return athletes;
    return athletes.filter((athlete) => athlete.has_booking_today);
  }, [athletes, reservedOnly, variant]);
  const count = type === 'athletes' ? rows.length : data.length;
  const countLabel =
    type === 'athletes'
      ? t('{{count}} people', { count })
      : type === 'classes'
        ? t('{{count}} classes', { count })
        : t('{{count}} payments', { count });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-pits-background/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-pits-surface-elevated border border-pits-edge rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex justify-between items-center p-5 border-b border-pits-edge">
          <div>
            <h3 className="text-lg font-bold text-pits-text">{title}</h3>
            <p className="text-sm text-pits-dim mt-0.5">{countLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="p-2 rounded-lg bg-pits-surface-muted border border-pits-edge text-pits-dim hover:text-pits-text transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {variant === 'overdue' ? (
          <div className="px-5 pt-4 flex gap-2">
            {[
              { value: false, label: t('All overdue') },
              { value: true, label: t('Reserved today') },
            ].map((tab) => (
              <button
                key={String(tab.value)}
                type="button"
                onClick={() => setReservedOnly(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  reservedOnly === tab.value
                    ? 'bg-pits-primary text-pits-dark-text border-pits-primary'
                    : 'bg-pits-surface-muted text-pits-dim border-pits-edge'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-5">
          {count === 0 ? (
            <div className="py-12 text-center text-pits-dim">
              <CheckCircle size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">{t('Nothing here right now.')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {type === 'athletes' &&
                rows.map((athlete) => {
                  return (
                    <div
                      key={athlete.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-pits-edge bg-pits-surface-muted/30"
                    >
                      <Link
                        href={`/dashboard/athletes/${athlete.id}`}
                        className="flex items-center gap-3 min-w-0 flex-1 group"
                      >
                        <div className="w-10 h-10 rounded-full bg-pits-surface-muted flex items-center justify-center text-pits-dim font-bold overflow-hidden border border-pits-edge shrink-0">
                          {athlete.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={athlete.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            athlete.full_name?.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-pits-text text-sm truncate group-hover:underline">
                            {athlete.full_name}
                          </p>
                          <p className="text-xs text-pits-dim truncate">
                            {athlete.plan || t('No plan')}
                            {variant === 'overdue' && athlete.days_overdue != null
                              ? ` · ${t('Days overdue', { days: athlete.days_overdue })}`
                              : ''}
                          </p>
                          {variant === 'overdue' ? (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {athlete.has_booking_today ? (
                                <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold border bg-pits-info-soft text-pits-info border-pits-info-edge">
                                  {t('Reserved today')}
                                </span>
                              ) : null}
                              {athlete.has_pending_proof ? (
                                <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold border bg-pits-info-soft text-pits-info border-pits-info-edge">
                                  {t('Proof in review')}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold border bg-pits-danger-soft text-pits-danger border-pits-danger-edge">
                                  {athlete.payment_status === 'no_plan' ? t('No plan') : t('Payment pending')}
                                </span>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </Link>

                      <MemberContactActions
                        member={athlete}
                        showReminder={variant === 'overdue' && !athlete.has_pending_proof}
                      />
                    </div>
                  );
                })}

              {type === 'classes' &&
                (data as DashboardClass[]).map((cls) => {
                  const booked = cls.bookings?.[0]?.count || 0;
                  const ratio = cls.max_capacity > 0 ? booked / cls.max_capacity : 0;
                  return (
                    <div key={cls.id} className="p-3 rounded-xl border border-pits-edge bg-pits-surface-muted/30">
                      <div className="flex justify-between items-center gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-pits-dark-text bg-pits-primary truncate">
                            {cls.class_type}
                          </span>
                          <p className="text-sm font-bold text-pits-text">{formatTime(cls.start_time, lang)}</p>
                          <span className="flex items-center text-xs text-pits-dim">
                            <User size={12} className="mr-1" />
                            {booked} / {cls.max_capacity}
                          </span>
                        </div>
                        <Link
                          href="/dashboard/notifications"
                          className={`${contactActionBtn} bg-pits-surface-elevated text-pits-text border-pits-edge hover:bg-pits-surface-muted shrink-0`}
                        >
                          <Bell size={14} />
                          {t('Notify members')}
                        </Link>
                      </div>
                      <div className="w-full bg-pits-surface-muted h-1.5 rounded-full overflow-hidden border border-pits-edge">
                        <div
                          className={`h-full rounded-full ${ratio < 0.3 ? 'bg-pits-warning' : 'bg-pits-info'}`}
                          style={{ width: `${Math.min(100, ratio * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

              {type === 'payments' &&
                (data as DashboardPayment[]).map((payment) => (
                  <div
                    key={payment.id}
                    className="p-3 rounded-xl border border-pits-edge bg-pits-surface-muted/30 flex justify-between items-center gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-pits-text truncate">
                        {payment.profiles?.full_name || t('Unknown Athlete')}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-pits-dim mt-1">
                        <span className="bg-pits-surface-muted border border-pits-edge px-1.5 py-0.5 rounded">{payment.method}</span>
                        <span className="flex items-center">
                          <Clock size={12} className="mr-1" /> {formatDate(payment.created_at, lang)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-base font-bold text-pits-text tabular-nums">{formatAmount(payment.amount)}</p>
                      <button
                        type="button"
                        onClick={() => onReviewPayment(payment.id)}
                        className={`${contactActionBtn} bg-pits-primary text-pits-dark-text border-pits-primary hover:bg-pits-primary-dark`}
                      >
                        {t('Review')}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
