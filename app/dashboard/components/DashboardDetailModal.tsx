'use client';

import { X, Calendar, User, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { DashboardProfile, DashboardClass, DashboardPayment } from '../../../lib/services/dashboardService';

interface DashboardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'athletes' | 'classes' | 'payments';
  data: any[];
}

export default function DashboardDetailModal({ isOpen, onClose, title, type, data }: DashboardDetailModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-pits-surface-elevated rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/30">
          <div>
            <h3 className="text-xl font-black text-pits-text uppercase italic tracking-tight">{title}</h3>
            <p className="text-pits-dim text-[10px] font-bold uppercase tracking-widest mt-1">
              {data.length} items identified
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg bg-pits-surface-elevated border border-gray-100 text-gray-400 hover:text-pits-red hover:border-red-100 transition-all shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6">
          {data.length === 0 ? (
            <div className="py-12 text-center text-gray-300">
               <CheckCircle size={48} className="mx-auto mb-4 opacity-10" />
               <p className="font-bold uppercase text-xs">No records found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {type === 'athletes' && (data as DashboardProfile[]).map((athlete) => (
                <div key={athlete.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-50 bg-pits-surface-elevated hover:border-gray-200 hover:shadow-sm transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold overflow-hidden border border-gray-100">
                      {athlete.avatar_url ? (
                        <img src={athlete.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        athlete.full_name?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-pits-text text-sm group-hover:text-pits-red transition-colors">{athlete.full_name}</p>
                      <p className="text-[10px] text-pits-dim font-bold uppercase">{athlete.plan || 'No Plan'}</p>
                    </div>
                  </div>
                  <div className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${athlete.is_solvent ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    {athlete.is_solvent ? 'Solvent' : 'Unpaid'}
                  </div>
                </div>
              ))}

              {type === 'classes' && (data as DashboardClass[]).map((cls) => (
                <div key={cls.id} className="p-4 rounded-xl border border-gray-100 bg-pits-surface-elevated hover:border-blue-100 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                       <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter text-pits-dark-text ${cls.class_type === 'CrossFit' ? 'bg-pits-primary' : 'bg-blue-600 text-white'}`}>
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
                  <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                     <div 
                       className={`h-full rounded-full ${((cls.bookings?.[0]?.count || 0) / cls.max_capacity) < 0.3 ? 'bg-orange-400' : 'bg-blue-500'}`} 
                       style={{ width: `${Math.min(100, ((cls.bookings?.[0]?.count || 0) / cls.max_capacity) * 100)}%` }}
                     />
                  </div>
                </div>
              ))}

              {type === 'payments' && (data as DashboardPayment[]).map((payment) => (
                <div key={payment.id} className="p-4 rounded-xl border border-gray-100 bg-pits-surface-elevated hover:border-pits-red/20 transition-all flex justify-between items-center">
                  <div className="flex flex-col">
                    <p className="text-sm font-bold text-pits-text">{payment.profiles?.full_name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-pits-dim font-bold mt-1">
                       <span className="bg-gray-100 px-1.5 py-0.5 rounded uppercase">{payment.method}</span>
                       <span className="flex items-center"><Clock size={10} className="mr-1"/> {new Date(payment.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-pits-text">€{payment.amount}</p>
                    <a 
                      href={payment.proof_image_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[9px] font-black text-blue-600 uppercase hover:underline"
                    >
                      View Proof
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-gray-50 bg-gray-50/30 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-pits-surface-elevated border border-gray-200 text-pits-text font-black text-xs uppercase tracking-widest rounded-xl hover:bg-gray-50 transition-all shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
