'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Plus, Trash2, Clock, User, X, Edit3, Copy, AlertCircle, Users } from 'lucide-react';
import CreateClassModal from '@/components/CreateClassModal';
import { useSchedule } from './hooks/useSchedule';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/components/LanguageContext';

export default function SchedulePage() {
  const { t, lang } = useLanguage();
  const {
    classes,
    loading,
    selectedClassId,
    setSelectedClassId,
    roster,
    loadingRoster,
    fetchSchedule,
    deleteClass
  } = useSchedule();

  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    classId: string;
    classType: string;
    bookingCount: number;
  }>({ isOpen: false, classId: '', classType: '', bookingCount: 0 });

  const handleDeleteConfirm = async () => {
    const { classId } = deleteConfirm;
    setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
    try {
      await deleteClass(classId);
      toast(t('Class deleted successfully'), 'success');
    } catch {
      toast(t('Could not delete class'), 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-pits-text uppercase italic tracking-tighter">
            {t('Class Schedule')}
          </h2>
          <p className="text-pits-dim font-medium text-sm">
            {t('Manage upcoming classes and coach assignments.')}
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center px-6 py-3 bg-pits-primary text-pits-dark-text rounded-lg font-black uppercase text-xs tracking-widest shadow-lg shadow-pits-primary/50 hover:bg-pits-primary-dark transition-all"
        >
          <Plus size={18} className="mr-2" />
          {t('Schedule Class')}
        </button>
      </div>

      {/* List */}
      <div className="bg-pits-surface-elevated rounded-xl border border-pits-edge shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-pits-primary font-bold italic uppercase tracking-widest text-xs">{t('Loading schedule...')}</div>
        ) : classes.length === 0 ? (
          <div className="p-12 text-center text-pits-primary font-bold italic uppercase tracking-widest text-xs">
            {t('No upcoming classes found. Schedule one above.')}
          </div>
        ) : (
          <div className="divide-y divide-pits-edge">
            {classes.map((session) => {
              const startDate = new Date(session.start_time);
              
              const startDateStr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(startDate);
              const todayStr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
              const isToday = startDateStr === todayStr;

              const dayStr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', weekday: 'short' }).format(startDate);
              const dateNumStr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', day: 'numeric' }).format(startDate);
              const timeStr = startDate.toLocaleTimeString('en-US', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' });

              const bookingCount = session.bookings[0]?.count || 0;
              const occupancyRate = (bookingCount / session.max_capacity) * 100;
              const isHighOccupancy = occupancyRate > 80;

              return (
                <div key={session.id} className="p-5 hover:bg-pits-surface-muted/40 transition-colors flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-pits-edge last:border-0">
                  
                  {/* Left: Date & Time */}
                  <div className="flex items-center gap-5 min-w-[280px]">
                    <div className={`
                      flex flex-col items-center justify-center w-16 h-16 rounded-xl border-2 shrink-0
                      ${isToday ? 'bg-pits-card border-pits-red/20 text-pits-red animate-pulse-subtle' : 'bg-pits-background border-pits-border text-pits-primary'}
                    `}>
                      <span className="text-[10px] font-black uppercase tracking-widest">{dayStr}</span>
                      <span className="text-2xl font-black">{dateNumStr}</span>
                    </div>

                    <div className="space-y-1.5">
                       <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest text-pits-dark-text shadow-sm
                            ${session.class_type === 'CrossFit' ? 'bg-pits-red' : 
                              session.class_type === 'Halterofilia' ? 'bg-blue-600' :
                              session.class_type === 'Gymnastic' ? 'bg-purple-600' :
                              session.class_type === 'Open Box' ? 'bg-gray-600' : 'bg-orange-500'}
                          `}>
                            {session.class_type}
                          </span>
                          <span className="text-xs font-black text-pits-text flex items-center bg-pits-surface-muted border border-pits-edge px-2 py-0.5 rounded italic">
                            <Clock size={12} className="mr-1 text-pits-primary" />
                            {timeStr}
                          </span>
                       </div>
                       <div className={`flex items-center text-xs font-bold transition-colors ${!session.coach?.full_name ? 'text-orange-400 bg-orange-950/40 px-2 py-1 rounded-lg border border-orange-900/50' : 'text-pits-dim'}`}>
                         <User size={12} className={`mr-1.5 ${!session.coach?.full_name ? 'text-orange-400' : 'text-pits-dim'}`} />
                         {session.coach?.full_name ? session.coach.full_name.toUpperCase() : t('Staff')}
                         {!session.coach?.full_name && <AlertCircle size={12} className="ml-1.5" />}
                       </div>
                    </div>
                  </div>

                  {/* Center: Occupancy Visualization */}
                  <div className="flex-1 max-w-md w-full">
                    <div className="flex justify-between items-end mb-2">
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-pits-dim" />
                        <span className="text-[10px] font-black text-pits-dim uppercase tracking-widest">{t('Bookings')}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-black italic ${
                          bookingCount >= session.max_capacity ? 'text-pits-red' : 
                          isHighOccupancy ? 'text-orange-500' : 'text-pits-text'
                        }`}>
                          {bookingCount}
                        </span>
                        <span className="text-pits-dim font-bold ml-1 text-sm">/ {session.max_capacity}</span>
                      </div>
                    </div>
                    
                    {/* Progress Bar Container */}
                    <div className="h-2 w-full bg-pits-surface-muted rounded-full overflow-hidden border border-pits-edge">
                      <div 
                        className={`h-full transition-all duration-500 rounded-full ${
                          bookingCount >= session.max_capacity ? 'bg-pits-red' :
                          isHighOccupancy ? 'bg-orange-500' :
                          bookingCount > 0 ? 'bg-green-500' : 'bg-pits-edge'
                        }`}
                        style={{ width: `${Math.min(100, occupancyRate)}%` }}
                      />
                    </div>
                    
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] font-bold text-pits-dim uppercase tracking-tighter">
                        {occupancyRate.toFixed(0)}% {t('Capacity')}
                      </span>
                      {bookingCount >= session.max_capacity ? (
                        <span className="text-[9px] font-black text-pits-red uppercase italic animate-pulse">{t('Full')}</span>
                      ) : (
                        <span className="text-[9px] font-bold text-pits-dim uppercase italic">
                          {session.max_capacity - bookingCount} {t('Spots')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end xl:self-center">
                    <button 
                      onClick={() => {
                        setSelectedClassId(session.id);
                        setIsDetailsModalOpen(true);
                      }}
                      className="flex items-center gap-1 px-3 py-2 text-pits-text hover:bg-pits-surface-muted border border-transparent hover:border-pits-edge rounded-lg transition-all font-black text-[10px] uppercase tracking-widest italic"
                      title={t('DETAILS')}
                    >
                      {t('DETAILS')}
                    </button>
                    
                    {/* Placeholder for Edit/Duplicate Actions */}
                    <div className="flex items-center border-l border-pits-edge ml-2 pl-2 gap-1">
                      <button className="p-2 text-pits-dim hover:text-pits-ink hover:bg-pits-surface-muted rounded-lg transition-colors" title="Edit (Coming Soon)">
                        <Edit3 size={16} />
                      </button>
                      <button className="p-2 text-pits-dim hover:text-pits-ink hover:bg-pits-surface-muted rounded-lg transition-colors" title="Duplicate (Coming Soon)">
                        <Copy size={16} />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm({
                          isOpen: true,
                          classId: session.id,
                          classType: session.class_type,
                          bookingCount: bookingCount
                        })}
                        className="p-2 text-pits-dim hover:text-pits-error hover:bg-pits-primary-soft rounded-lg transition-colors"
                        title={t('Cancel Class')}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreateClassModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchSchedule}
      />

      {isDetailsModalOpen && selectedClassId && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-pits-background/50 p-4 backdrop-blur-sm"
          onClick={() => setIsDetailsModalOpen(false)}
        >
          <div 
            className="bg-pits-background rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[95vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-pits-border">
              <h3 className="text-xl font-black text-pits-text uppercase italic">{t('Class Details')}</h3>
              <button 
                onClick={() => setIsDetailsModalOpen(false)}
                className="p-1 rounded bg-pits-background text-pits-primary hover:text-pits-primary-dark transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {(() => {
                const cls = classes.find(c => c.id === selectedClassId);
                if (!cls) return null;
                return (
                  <div className="space-y-6">
                    <div className="bg-pits-background p-4 rounded-xl border border-pits-border grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] text-pits-primary uppercase font-black tracking-wider">{t('Type')}</p>
                        <p className="font-bold text-pits-text text-sm uppercase italic tracking-tighter">{cls.class_type}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-pits-primary uppercase font-black tracking-wider">{t('Class Time')}</p>
                        <p className="font-bold text-pits-text text-sm italic">
                          {new Date(cls.start_time).toLocaleTimeString('en-US', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-pits-primary uppercase font-black tracking-wider">{t('Coach')}</p>
                        <p className="font-bold text-pits-text text-sm uppercase italic tracking-tighter">{cls.coach?.full_name || t('Staff')}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-pits-primary uppercase font-black tracking-wider">{t('Capacity')}</p>
                        <p className="font-bold text-pits-text text-sm italic">{cls.bookings[0]?.count || 0} / {cls.max_capacity}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-black text-pits-dim uppercase tracking-wider mb-3 italic">{t('Athletes')}</h4>
                      {loadingRoster ? (
                        <p className="text-pits-primary text-sm p-4 bg-pits-background rounded-lg text-center font-bold uppercase italic tracking-widest">{t('Loading schedule...')}</p>
                      ) : roster.length === 0 ? (
                        <p className="text-pits-primary text-sm p-4 bg-pits-background rounded-lg text-center font-bold uppercase italic tracking-widest">{t('No bookings yet.')}</p>
                      ) : (
                        <div className="space-y-2">
                          {roster.map(booking => (
                            <div key={booking.id} className="flex justify-between items-center p-3 rounded-lg border border-pits-border bg-pits-background shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className="relative w-8 h-8 rounded-full bg-pits-background flex items-center justify-center text-xs font-bold text-pits-primary overflow-hidden">
                                  {booking.profiles.avatar_url ? (
                                    <Image
                                      src={booking.profiles.avatar_url}
                                      alt={booking.profiles.full_name || ''}
                                      fill
                                      className="object-cover"
                                    />
                                  ) : (
                                    booking.profiles.full_name?.charAt(0)
                                  )}
                                </div>
                                <span className="font-bold text-pits-text text-sm">{booking.profiles.full_name}</span>
                              </div>
                              <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wide
                                ${booking.status === 'attended' ? 'bg-green-100 text-green-700' : 
                                  booking.status === 'no_show' ? 'bg-red-100 text-red-700' :
                                  'bg-blue-100 text-blue-700'}
                              `}>
                                {booking.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="p-4 border-t border-pits-edge flex justify-end bg-pits-surface-muted rounded-b-xl">
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-6 py-2 bg-pits-surface-elevated border border-pits-edge text-pits-text font-black uppercase italic tracking-widest text-xs rounded-lg hover:bg-pits-edge transition-colors shadow-sm"
              >
                {t('Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={t('Cancel Class')}
        message={`${t('Delete this class?')} ${deleteConfirm.bookingCount > 0 ? `${deleteConfirm.bookingCount} ${t('athlete(s) have booked this class and their bookings will be removed.')}` : t('No athletes have booked yet.')}`}
        confirmLabel={t('Delete Class')}
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
}