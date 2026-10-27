'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { X, User, Clock, CheckCircle } from 'lucide-react';
import { DashboardProfile, DashboardClass, DashboardPayment } from '@/lib/services/dashboardService';
import { useLanguage } from '@/components/LanguageContext';

type DashboardModalItem = DashboardProfile | DashboardClass | DashboardPayment;

interface DashboardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'athletes' | 'classes' | 'payments';
  data: DashboardModalItem[];
  variant?: 'overdue' | null;
}

export default function DashboardDetailModal({
  isOpen,
  onClose,
  title,
  type,
  data,
  variant,
}: DashboardDetailModalProps) {
  const { t } = useLanguage();
  const [reservedOnly, setReservedOnly] = useState(false);

  useEffect(() => {
    if (isOpen) setReservedOnly(false);
  }, [isOpen]);

  const athletes = data as DashboardProfile[];
  const overdueRows = useMemo(() => {
    if (variant !== 'overdue') return athletes;
    if (!reservedOnly) return athletes;
    return athletes.filter((athlete) => athlete.has_booking_today);
  }, [athletes, reservedOnly, variant]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-pits-background/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-pits-surface-elevated border border-pits-edge rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex justify-between items-center p-6 border-b border-pits-edge">
          <div>
            <h3 className="text-xl font-black text-pits-text uppercase italic tracking-tight">{title}</h3>
            <p className="text-pits-dim text-[10px] font-bold uppercase tracking-widest mt-1">
              {variant === 'overdue' ? overdueRows.length : data.length} items identified
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg bg-pits-surface-muted border border-pits-edge text-pits-dim hover:text-pits-primary hover:border-pits-primary/40 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {variant === 'overdue' ? (
          <div className="px-6 pt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setReservedOnly(false)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                !reservedOnly
                  ? 'bg-pits-primary text-pits-dark-text border-pits-primary'
                  : 'bg-pits-surface-muted text-pits-dim border-pits-edge'
              }`}
            >
              {t('All overdue')}
            </button>
            <button
              type="button"
              onClick={() => setReservedOnly(true)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                reservedOnly
                  ? 'bg-pits-primary text-pits-dark-text border-pits-primary'
                  : 'bg-pits-surface-muted text-pits-dim border-pits-edge'
              }`}
            >
              {t('Reserved today')}
            </button>
          </div>
        ) : null}

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6">
          {(variant === 'overdue' ? overdueRows : data).length === 0 ? (
            <div className="py-12 text-center text-pits-dim">
               <CheckCircle size={48} className="mx-auto mb-4 opacity-10" />
               <p className="font-bold uppercase text-xs">No records found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {type === 'athletes' && (variant === 'overdue' ? overdueRows : athletes).map((athlete) => (
                <div key={athlete.id} className="flex items-center justify-between p-3 rounded-xl border border-pits-edge bg-pits-surface-muted/30 hover:border-pits-primary/30 hover:bg-pits-surface-muted/60 transition-all group gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-pits-surface-muted flex items-center justify-center text-pits-dim font-bold overflow-hidden border border-pits-edge shrink-0">
                      {athlete.avatar_url ? (
                        <img src={athlete.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        athlete.full_name?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-pits-text text-sm group-hover:text-pits-primary transition-colors truncate">{athlete.full_name}</p>
                      <p className="text-[10px] text-pits-dim font-bold uppercase truncate">
                        {athlete.plan || t('No plan')}
                        {variant === 'overdue' && athlete.days_overdue != null
                          ? ` · ${t('Days overdue', { days: athlete.days_overdue })}`
                          : ''}
                      </p>
                    </div>
                  </div>
                  {variant === 'overdue' ? (
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {athlete.has_booking_today ? (
                        <span className="px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-sky-50 text-sky-700">
                          {t('Reserved today')}
                        </span>
                      ) : null}
                      {athlete.has_pending_proof ? (
                        <span className="px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-sky-50 text-sky-700">
                          {t('Proof in review')}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider bg-red-50 text-red-600">
                          {athlete.payment_status === 'no_plan' ? t('No plan') : t('Payment pending')}
                        </span>
                      )}
                      <Link
                        href={`/dashboard/athletes/${athlete.id}`}
                        className="text-[9px] font-black uppercase tracking-widest text-pits-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t('Open member')}
                      </Link>
                    </div>
                  ) : (
                    <div className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${athlete.is_solvent ? 'bg-green-950/40 text-green-400' : 'bg-red-950/40 text-red-400'}`}>
                      {athlete.is_solvent ? 'Solvent' : 'Unpaid'}
                    </div>
                  )}
                </div>
              ))}

              {type === 'classes' && (data as DashboardClass[]).map((cls) => (
                <div key={cls.id} className="p-4 rounded-xl border border-pits-edge bg-pits-surface-muted/30 hover:border-blue-500/30 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                       <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter text-white bg-pits-primary">
                         {cls.class_type}
                       </span>
                       <p className="text-sm font-black text-pits-text italic">
                         {new Date(cls.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </p>
                    </div>
                    <div className="flex items-center text-[10px] font-bold text-pits-dim">
                      <User size={12} className="mr-1" />
                      {cls.bookings?.[0]?.count || 0} / {cls.max_capacity}
                    </div>
                  </div>
                  <div className="w-full bg-pits-surface-muted h-1.5 rounded-full overflow-hidden border border-pits-edge">
                     <div 
                       className={`h-full rounded-full ${((cls.bookings?.[0]?.count || 0) / cls.max_capacity) < 0.3 ? 'bg-orange-400' : 'bg-blue-500'}`} 
                       style={{ width: `${Math.min(100, ((cls.bookings?.[0]?.count || 0) / cls.max_capacity) * 100)}%` }}
                     />
                  </div>
                </div>
              ))}

              {type === 'payments' && (data as DashboardPayment[]).map((payment) => (
                <div key={payment.id} className="p-4 rounded-xl border border-pits-edge bg-pits-surface-muted/30 hover:border-pits-primary/30 transition-all flex justify-between items-center">
                  <div className="flex flex-col">
                    <p className="text-sm font-bold text-pits-text">{payment.profiles?.full_name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-pits-dim font-bold mt-1">
                       <span className="bg-pits-surface-muted border border-pits-edge px-1.5 py-0.5 rounded uppercase">{payment.method}</span>
                       <span className="flex items-center"><Clock size={10} className="mr-1"/> {new Date(payment.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-pits-text">€{payment.amount}</p>
                    {payment.proof_image_url ? (
                      <a
                        href={payment.proof_image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] font-black text-blue-400 uppercase hover:underline"
                      >
                        View Proof
                      </a>
                    ) : (
                      <span className="text-[9px] font-black text-pits-dim uppercase">Proof unavailable</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-pits-edge bg-pits-surface-muted flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-pits-surface-elevated border border-pits-edge text-pits-text font-black text-xs uppercase tracking-widest rounded-xl hover:bg-pits-edge transition-all shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
