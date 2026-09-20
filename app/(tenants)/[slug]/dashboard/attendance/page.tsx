'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calendar, Clock, CheckCircle, XCircle,
  Users, ChevronLeft, ChevronRight, CheckCheck, Search, UserPlus, UserMinus, Info
} from 'lucide-react';
import { useAttendance } from './hooks/useAttendance';
import Tooltip from '@/components/Tooltip';
import AddToClassModal from '@/components/AddToClassModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import { getCaracasDate } from '@/lib/utils/date';
import { TranslationKey } from '@/lib/translations';
import { classTypeService } from '@/lib/services/classTypeService';
import { Booking, BookingStatus, ClassTypeRow } from '@/lib/types/gym';
import { classTypeBadgeStyle, classTypeColorMap } from '@/lib/utils/classTypeStyles';

const bookingStatusKey = (status: BookingStatus): TranslationKey =>
  status as TranslationKey;

const classTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/Caracas',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function AttendancePage() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
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
    markRemaining,
    nextDay,
    prevDay
  } = useAttendance();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addingAthlete, setAddingAthlete] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<{ id: string; name: string } | null>(null);
  const [classTypes, setClassTypes] = useState<ClassTypeRow[]>([]);
  const colorByName = useMemo(() => classTypeColorMap(classTypes), [classTypes]);

  useEffect(() => {
    if (!tenantId) return;
    void classTypeService
      .getClassTypes(tenantId, true)
      .then(setClassTypes)
      .catch((err) => console.error(err));
  }, [tenantId]);

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const bookingCount = selectedClass?.bookings[0]?.count ?? roster.length;
  const isClassFull = selectedClass ? bookingCount >= selectedClass.max_capacity : false;
  const rosterUserIds = roster.map(b => b.profiles.id);
  const isToday = date === getCaracasDate();
  const presentCount = roster.filter(b => b.status === 'attended').length;
  const missedCount = roster.filter(b => b.status === 'no_show').length;
  const pendingCount = roster.filter(b => b.status === 'booked').length;
  const showSearch = roster.length > 6;

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

  const toggleAttendance = (booking: Booking) => {
    updateStatus(booking.id, booking.status === 'attended' ? 'booked' : 'attended');
  };

  const toggleMissed = (booking: Booking) => {
    updateStatus(booking.id, booking.status === 'no_show' ? 'booked' : 'no_show');
  };

  return (
    <div className="space-y-6 lg:h-[calc(100vh-140px)] flex flex-col">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-pits-surface-elevated p-4 rounded-xl border   shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-black text-pits-text uppercase italic tracking-tighter leading-tight">
              {t('Daily Attendance')}
            </h2>
            <Tooltip content={t('Athlete booking window tip')} wide side="bottom">
              <Info size={16} className="text-pits-dim cursor-help" />
            </Tooltip>
          </div>
          <p className="text-pits-dim font-medium text-xs md:text-sm">
            {t('Tap an athlete to check in.')}
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

            {!isToday && (
              <button
                onClick={() => setDate(getCaracasDate())}
                className="px-3 py-2 bg-pits-primary text-pits-dark-text rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-pits-primary-dark transition-all"
              >
                {t('Today')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:h-full min-h-0">
        
        {/* LEFT: CLASSES LIST (desktop) */}
        <div className="hidden lg:flex w-full lg:w-1/3 bg-pits-surface-elevated rounded-xl border   shadow-sm overflow-hidden flex-col max-h-[400px] lg:max-h-none">
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
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white"
                        style={classTypeBadgeStyle(colorByName[cls.class_type])}
                      >
                        {cls.class_type}
                      </span>
                      <div className="flex flex-col items-end">
                        <span className={`flex items-center text-[10px] font-black tracking-tighter
                          ${isFull ? 'text-pits-red' : isVeryFull ? 'text-orange-600' : 'text-gray-700'}
                        `}>
                          <Users size={10} className="mr-1" />
                          {count} / {cls.max_capacity}
                        </span>
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
                        {classTime(cls.start_time)}
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
          <div className="p-4  border-b  space-y-3">
            {/* Mobile class strip — pick a class without scrolling a tall list */}
            <div className="lg:hidden">
              {loadingClasses ? (
                <p className="text-xs text-gray-400">{t('Loading...')}</p>
              ) : classes.length === 0 ? (
                <p className="text-xs text-gray-400">{t('No classes scheduled.')}</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {classes.map(cls => {
                    const count = cls.bookings[0]?.count || 0;
                    const selected = selectedClassId === cls.id;
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => setSelectedClassId(cls.id)}
                        className={`shrink-0 px-3 py-2 rounded-lg border text-left transition-all ${
                          selected
                            ? 'bg-pits-primary-dark/80 ring-1 ring-pits-red border-transparent'
                            : 'bg-gray-50 border-gray-100'
                        }`}
                      >
                        <div className="text-sm font-black italic text-gray-900 leading-none">
                          {classTime(cls.start_time)}
                        </div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          {cls.class_type} · {count}/{cls.max_capacity}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-black text-pits-text text-sm md:text-base uppercase italic tracking-tighter truncate">
                  {selectedClass
                    ? `${selectedClass.class_type} @ ${classTime(selectedClass.start_time)}`
                    : t('Class Roster')}
                </h3>
                {selectedClass && (
                  <p className="text-[10px] font-bold text-gray-400 uppercase">
                    {t('Coach')}: <span className="text-pits-dim">{selectedClass.coach?.full_name || t('Staff')}</span>
                  </p>
                )}
              </div>
              
              {selectedClassId && roster.length > 0 && (
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {showSearch && (
                    <div className="relative w-36 sm:w-48 hidden sm:block">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                      <input 
                        type="text"
                        placeholder={t('Search athlete...')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-pits-surface-elevated border   rounded-lg text-xs font-medium focus:border-pits-red outline-none transition-all"
                      />
                    </div>
                  )}
                  {!isClassFull && (
                    <Tooltip content={t('Add athlete to class')}>
                      <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="p-2 bg-pits-primary text-pits-dark-text rounded-lg hover:bg-pits-primary-dark transition-all shadow-sm active:scale-95"
                      >
                        <UserPlus size={16} />
                      </button>
                    </Tooltip>
                  )}
                  {pendingCount > 0 && (
                    <button
                      onClick={() => markRemaining('attended')}
                      className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-green-700 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                    >
                      <CheckCheck size={14} className="mr-1.5" />
                      {t('Check in {{count}} remaining', { count: pendingCount })}
                    </button>
                  )}
                </div>
              )}
            </div>

            {selectedClassId && roster.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t  ">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <CheckCircle size={14} className="text-green-600" />
                  <span className="text-green-700">{presentCount}</span>
                  <span className="text-gray-400">{t('Present')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <XCircle size={14} className="text-red-500" />
                  <span className="text-red-600">{missedCount}</span>
                  <span className="text-gray-400">{t('Missed')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Clock size={14} className="text-blue-500" />
                  <span className="text-blue-600">{pendingCount}</span>
                  <span className="text-gray-400">{t('pending')}</span>
                </div>
                {pendingCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markRemaining('no_show')}
                    className="ml-auto text-[10px] font-black uppercase tracking-wider text-gray-400 hover:text-red-600 transition-colors"
                  >
                    {t('Mark remaining missed')}
                  </button>
                )}
              </div>
            )}

            {showSearch && (
              <div className="relative sm:hidden">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input 
                  type="text"
                  placeholder={t('Search athlete...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-pits-surface-elevated border   rounded-lg text-xs font-medium focus:border-pits-red outline-none"
                />
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
              <div className="divide-y divide-gray-100">
                {filteredRoster.map((booking) => {
                  const attended = booking.status === 'attended';
                  const missed = booking.status === 'no_show';
                  return (
                    <div
                      key={booking.id}
                      className={`group flex items-center gap-1 pr-2 sm:pr-3 transition-colors ${
                        attended ? 'bg-green-50/50' : missed ? 'opacity-60' : 'hover:bg-gray-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleAttendance(booking)}
                        className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 overflow-hidden shrink-0">
                          {booking.profiles.avatar_url ? (
                            <img src={booking.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            booking.profiles.full_name?.charAt(0)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-pits-text truncate">{booking.profiles.full_name}</p>
                          <p className={`text-[10px] font-black uppercase tracking-wide ${
                            attended ? 'text-green-700' : missed ? 'text-red-600' : 'text-blue-600'
                          }`}>
                            {t(bookingStatusKey(booking.status))}
                          </p>
                        </div>
                        <CheckCircle
                          size={22}
                          className={attended ? 'text-green-600 shrink-0' : 'text-gray-200 shrink-0'}
                        />
                      </button>

                      <Tooltip content={missed ? t('Reset to Booked') : t('Mark as Missed')}>
                        <button
                          type="button"
                          onClick={() => toggleMissed(booking)}
                          className={`p-2 rounded-lg transition-colors ${
                            missed ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-red-50 hover:text-red-600'
                          }`}
                        >
                          <XCircle size={18} />
                        </button>
                      </Tooltip>

                      <Tooltip content={t('Remove from class')}>
                        <button
                          type="button"
                          onClick={() => setRemoveConfirm({ id: booking.id, name: booking.profiles.full_name })}
                          className="p-2 rounded-lg text-gray-300 hover:bg-orange-50 hover:text-orange-600 transition-colors md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                        >
                          <UserMinus size={18} />
                        </button>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
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
