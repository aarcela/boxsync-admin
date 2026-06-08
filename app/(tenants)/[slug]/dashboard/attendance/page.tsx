'use client';

import { useState } from 'react';
import { 
  Calendar, Clock, CheckCircle, XCircle, MinusCircle, 
  Users, ChevronLeft, ChevronRight, CheckCheck, Ban, Search, UserPlus, UserMinus
} from 'lucide-react';
import { useAttendance } from './hooks/useAttendance';
import Tooltip from '@/components/Tooltip';
import AddToClassModal from '@/components/AddToClassModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/components/LanguageContext';
import { TranslationKey } from '@/lib/translations';
import { BookingStatus } from '@/lib/types/gym';

const bookingStatusKey = (status: BookingStatus): TranslationKey =>
  status as TranslationKey;

export default function AttendancePage() {
  const { t } = useLanguage();
  const {
    date,
    setDate,
    classes,
    loadingClasses,
    selectedClassId,
    setSelectedClassId,
    roster,
    loadingRoster,
    searchTerm,
    setSearchTerm,
    filteredRoster,
    updateStatus,
    addAthlete,
    removeAthlete,
    markAll,
    nextDay,
    prevDay
  } = useAttendance();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addingAthlete, setAddingAthlete] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<{ id: string; name: string } | null>(null);

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const bookingCount = selectedClass?.bookings[0]?.count ?? roster.length;
  const isClassFull = selectedClass ? bookingCount >= selectedClass.max_capacity : false;
  const rosterUserIds = roster.map(b => b.profiles.id);

  const handleAddAthlete = async (userId: string) => {
    setAddingAthlete(true);
    try {
      await addAthlete(userId);
      setIsAddModalOpen(false);
    } catch {
      // Error toast handled in hook
    } finally {
      setAddingAthlete(false);
    }
  };

  const handleRemoveConfirm = async () => {
    if (!removeConfirm) return;
    const { id } = removeConfirm;
    setRemoveConfirm(null);
    await removeAthlete(id);
  };
  return (
    <div className="space-y-6 lg:h-[calc(100vh-140px)] flex flex-col">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-pits-surface-elevated p-4 rounded-xl border   shadow-sm gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-pits-text uppercase italic tracking-tighter leading-tight">
            {t('Daily Attendance')}
          </h2>
          <p className="text-pits-dim font-medium text-xs md:text-sm">
            {t('Check-in athletes and manage roster.')}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2">
            <Tooltip content={t('Previous day')}>
              <button
                onClick={prevDay}
                className="p-2 bg-gray-50 border   rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            </Tooltip>
            
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-50 border   rounded-lg font-bold text-gray-700 focus:border-pits-red outline-none shadow-sm text-sm"
              />
            </div>

            <Tooltip content={t('Next day')}>
              <button
                onClick={nextDay}
                className="p-2 bg-gray-50 border   rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:h-full min-h-0">
        
        {/* LEFT: CLASSES LIST */}
        <div className="w-full lg:w-1/3 bg-pits-surface-elevated rounded-xl border   shadow-sm overflow-hidden flex flex-col max-h-[400px] lg:max-h-none">
          <div className="p-4  border-b  ">
            <h3 className="font-bold text-pits-dim text-xs uppercase tracking-wider">
              {t('Classes ({{count}})', { count: classes.length })}
            </h3>
          </div>
          
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {loadingClasses ? (
              <div className="p-8 text-center text-gray-600 text-sm">{t('Loading...')}</div>
            ) : classes.length === 0 ? (
              <div className="p-8 text-center text-gray-600 text-sm">{t('No classes scheduled.')}</div>
            ) : (
              classes.map(cls => {
                const count = cls.bookings[0]?.count || 0;
                const occupancy = (count / cls.max_capacity) * 100;
                const isFull = count >= cls.max_capacity;
                const isVeryFull = occupancy > 80;

                return (
                  <div
                    key={cls.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedClassId(cls.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedClassId(cls.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all hover:shadow-md cursor-pointer group
                      ${selectedClassId === cls.id 
                        ? 'bg-pits-primary-dark/80 ring-1 ring-pits-red' 
                        : 'bg-gray-50 border-gray-100 hover:bg-white'}
                    `}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-pits-dark-text
                        ${cls.class_type === 'CrossFit' ? 'bg-pits-red' : 'bg-blue-600'}
                      `}>
                        {cls.class_type}
                      </span>
                      <div className="flex flex-col items-end">
                        <span className={`flex items-center text-[10px] font-black tracking-tighter
                          ${isFull ? 'text-pits-red' : isVeryFull ? 'text-orange-600' : 'text-gray-700'}
                        `}>
                          <Users size={10} className="mr-1" />
                          {count} / {cls.max_capacity}
                        </span>
                        {/* Occupancy Bar */}
                        <div className="w-12 h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${isFull ? 'bg-pits-red' : isVeryFull ? 'bg-orange-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(occupancy, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-gray-900 italic">
                        {new Date(cls.start_time).toLocaleTimeString('en-US', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center text-[10px] font-bold text-gray-600 uppercase tracking-tight">
                        <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center mr-1.5 text-gray-700">
                          {cls.coach?.full_name?.charAt(0) || 'S'}
                        </div>
                        {cls.coach?.full_name || t('Staff')}
                      </div>
                      <ChevronRight size={14} className={`transition-transform ${selectedClassId === cls.id ? 'text-pits-red translate-x-1' : 'text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1'}`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: ROSTER */}
        <div className="flex-1 bg-pits-surface-elevated rounded-xl border   shadow-sm overflow-hidden flex flex-col">
          <div className="p-4  border-b  ">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
              <div>
                <h3 className="font-black text-pits-text text-sm md:text-base uppercase italic tracking-tighter">
                  {selectedClassId ? (
                    classes.find(c => c.id === selectedClassId)?.class_type + " @ " + 
                    new Date(classes.find(c => c.id === selectedClassId)?.start_time || "").toLocaleTimeString('en-US', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' })
                  ) : t('Class Roster')}
                </h3>
                {selectedClassId && (
                  <p className="text-[10px] font-bold text-gray-400 uppercase">
                    {t('Coach')}: <span className="text-pits-dim">{classes.find(c => c.id === selectedClassId)?.coach?.full_name || t('Staff')}</span>
                  </p>
                )}
              </div>
              
              {selectedClassId && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Tooltip content={isClassFull ? t('Class is at full capacity') : t('Add athlete to class')}>
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      disabled={isClassFull}
                      className="flex items-center justify-center px-3 py-2 bg-pits-primary text-pits-dark-text rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-pits-primary-dark transition-all shadow-sm active:scale-95 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <UserPlus size={14} className="mr-1.5" />
                      {t('Add Athlete')}
                    </button>
                  </Tooltip>

                  {roster.length > 0 && (
                    <>
                  <div className="relative flex-1 sm:w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                      type="text"
                      placeholder={t('Search athlete...')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-4 py-2 bg-pits-surface-elevated border   rounded-lg text-xs font-medium focus:border-pits-red outline-none transition-all"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Tooltip content={t('Mark all as attended')}>
                      <button
                        onClick={() => markAll('attended')}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-green-700 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                      >
                        <CheckCheck size={14} className="mr-1.5" />
                        {t('Check-in All')}
                      </button>
                    </Tooltip>
                    <Tooltip content={t('Mark all as no-show')}>
                      <button
                        onClick={() => markAll('no_show')}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-pits-surface-elevated border   text-gray-400 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all whitespace-nowrap"
                      >
                        <Ban size={14} className="mr-1.5" />
                        {t('Missed All')}
                      </button>
                    </Tooltip>
                  </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {/* Attendance Summary Bar */}
            {selectedClassId && roster.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 pt-3 border-t  ">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <CheckCircle size={14} className="text-green-600" />
                  <span className="text-green-700">{roster.filter(b => b.status === 'attended').length}</span>
                  <span className="text-gray-400">{t('Present')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <XCircle size={14} className="text-red-500" />
                  <span className="text-red-600">{roster.filter(b => b.status === 'no_show').length}</span>
                  <span className="text-gray-400">{t('Missed')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Clock size={14} className="text-blue-500" />
                  <span className="text-blue-600">{roster.filter(b => b.status === 'booked').length}</span>
                  <span className="text-gray-400">{t('pending')}</span>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {!selectedClassId ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-300">
                <Users size={48} className="mb-4 opacity-20" />
                <p>{t('Select a class to view athletes.')}</p>
              </div>
            ) : loadingRoster ? (
              <div className="p-12 text-center text-gray-400">{t('Loading roster...')}</div>
            ) : roster.length === 0 ? (
              <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-4">
                <p>{t('No bookings for this class yet.')}</p>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  disabled={isClassFull}
                  className="flex items-center px-4 py-2 bg-pits-primary text-pits-dark-text rounded-lg text-xs font-black uppercase tracking-wider hover:bg-pits-primary-dark transition-all disabled:opacity-50"
                >
                  <UserPlus size={16} className="mr-2" />
                  {t('Add Athlete')}
                </button>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-400 uppercase bg-gray-50/50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 font-bold">{t('Athlete')}</th>
                        <th className="px-6 py-3 font-bold text-center">{t('Status')}</th>
                        <th className="px-6 py-3 font-bold text-right">{t('Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredRoster.map((booking) => (
                        <tr key={booking.id} className={`transition-colors group ${booking.status === 'attended' ? 'bg-green-50/30' : booking.status === 'no_show' ? 'opacity-60' : 'hover:bg-gray-50'}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-gray-200 mr-3 flex items-center justify-center text-xs font-bold text-gray-500 overflow-hidden">
                                {booking.profiles.avatar_url ? (
                                  <img src={booking.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  booking.profiles.full_name?.charAt(0)
                                )}
                              </div>
                              <span className="font-bold text-pits-text">{booking.profiles.full_name}</span>
                            </div>
                          </td>
                          
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border
                              ${booking.status === 'attended' ? 'bg-green-50 text-green-700 border-green-200' : 
                                booking.status === 'no_show' ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-blue-50 text-blue-700 border-blue-200'}
                            `}>
                              {booking.status === 'attended' && <CheckCircle size={12} className="mr-1" />}
                              {booking.status === 'no_show' && <XCircle size={12} className="mr-1" />}
                              {booking.status === 'booked' && <Clock size={12} className="mr-1" />}
                              {t(bookingStatusKey(booking.status))}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <Tooltip content={t('Check-in')}>
                                <button 
                                  onClick={() => updateStatus(booking.id, 'attended')}
                                  className={`p-2 rounded-lg transition-all ${booking.status === 'attended' ? 'bg-green-600 text-white shadow-md' : 'text-gray-300 hover:bg-green-50 hover:text-green-600'}`}
                                >
                                  <CheckCircle size={18} />
                                </button>
                              </Tooltip>

                              <Tooltip content={t('Reset to Booked')}>
                                <button 
                                  onClick={() => updateStatus(booking.id, 'booked')}
                                  className={`p-2 rounded-lg transition-colors ${booking.status === 'booked' ? 'bg-blue-100 text-blue-700' : 'text-gray-300 hover:bg-blue-50 hover:text-blue-600'}`}
                                >
                                  <MinusCircle size={18} />
                                </button>
                              </Tooltip>

                              <Tooltip content={t('Mark as Missed')}>
                                <button 
                                  onClick={() => updateStatus(booking.id, 'no_show')}
                                  className={`p-2 rounded-lg transition-colors ${booking.status === 'no_show' ? 'bg-red-600 text-white shadow-md' : 'text-gray-300 hover:bg-red-50 hover:text-red-600'}`}
                                >
                                  <XCircle size={18} />
                                </button>
                              </Tooltip>

                              <Tooltip content={t('Remove from class')}>
                                <button 
                                  onClick={() => setRemoveConfirm({ id: booking.id, name: booking.profiles.full_name })}
                                  className="p-2 rounded-lg text-gray-300 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                                >
                                  <UserMinus size={18} />
                                </button>
                              </Tooltip>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-gray-100">
                  {filteredRoster.map((booking) => (
                    <div key={booking.id} className={`p-4 transition-colors ${booking.status === 'attended' ? 'bg-green-50/30' : booking.status === 'no_show' ? 'opacity-60' : 'active:bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-gray-200 mr-3 flex items-center justify-center text-sm font-bold text-gray-500 overflow-hidden shadow-sm">
                            {booking.profiles.avatar_url ? (
                              <img src={booking.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              booking.profiles.full_name?.charAt(0)
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-pits-text">{booking.profiles.full_name}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border mt-1
                              ${booking.status === 'attended' ? 'bg-green-50 text-green-700 border-green-200' : 
                                booking.status === 'no_show' ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-blue-50 text-blue-700 border-blue-200'}
                            `}>
                              {t(bookingStatusKey(booking.status))}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => updateStatus(booking.id, 'attended')}
                            className={`p-2.5 rounded-xl transition-all ${booking.status === 'attended' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-50 text-gray-300 border border-gray-100'}`}
                          >
                            <CheckCircle size={20} />
                          </button>
                          <button 
                            onClick={() => updateStatus(booking.id, 'no_show')}
                            className={`p-2.5 rounded-xl transition-all ${booking.status === 'no_show' ? 'bg-red-600 text-white shadow-md' : 'bg-gray-50 text-gray-300 border border-gray-100'}`}
                          >
                            <XCircle size={20} />
                          </button>
                        </div>
                      </div>
                      
                      {booking.status !== 'booked' && (
                        <button 
                          onClick={() => updateStatus(booking.id, 'booked')}
                          className="w-full py-2 bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-gray-100 flex items-center justify-center gap-2"
                        >
                          <MinusCircle size={14} />
                          {t('Reset Status')}
                        </button>
                      )}

                      <button 
                        onClick={() => setRemoveConfirm({ id: booking.id, name: booking.profiles.full_name })}
                        className="w-full mt-2 py-2 bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-orange-100 flex items-center justify-center gap-2"
                      >
                        <UserMinus size={14} />
                        {t('Remove from Class')}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      <AddToClassModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSelect={handleAddAthlete}
        excludedUserIds={rosterUserIds}
        adding={addingAthlete}
      />

      <ConfirmDialog
        isOpen={!!removeConfirm}
        title={t('Remove Athlete')}
        message={t('Remove {{name}} from the class? Their booking will be deleted.', {
          name: removeConfirm?.name ?? t('this athlete'),
        })}
        confirmLabel={t('Remove')}
        variant="danger"
        onConfirm={handleRemoveConfirm}
        onCancel={() => setRemoveConfirm(null)}
      />
    </div>
  );
}