'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calendar, Clock, CheckCircle, XCircle,
  Users, ChevronLeft, ChevronRight, CheckCheck, Search, UserPlus, UserMinus, Info
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useAttendance } from './hooks/useAttendance';
import Tooltip from '@/components/Tooltip';
import AddToClassModal from '@/components/AddToClassModal';
import AddGuestModal from '@/components/AddGuestModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import { getGymDate, getGymTimeLabel } from '@/lib/utils/date';
import { TranslationKey } from '@/lib/translations';
import { classTypeService } from '@/lib/services/classTypeService';
import { Booking, BookingStatus, ClassTypeRow, MemberPaymentStatus } from '@/lib/types/gym';
import { classTypeBadgeStyle, classTypeColorMap } from '@/lib/utils/classTypeStyles';
import { capitalizeFirst, formatDateLong } from '@/lib/utils/format-date';

const bookingStatusKey = (status: BookingStatus): TranslationKey =>
  status as TranslationKey;

/** Where a class is relative to now, so coaches can spot the one on the floor. */
function classPhase(cls: { start_time: string; end_time: string }, now: number): 'upcoming' | 'live' | 'over' {
  const start = new Date(cls.start_time).getTime();
  const end = new Date(cls.end_time).getTime();
  if (now < start) return 'upcoming';
  return now < end ? 'live' : 'over';
}

export default function AttendancePage() {
  const { t, lang } = useLanguage();
  const { tenantId, timezone } = useTenant();
  const classTime = (iso: string) => getGymTimeLabel(iso, timezone);
  const searchParams = useSearchParams();
  const {
    date,
    setDate,
    classes,
    loadingClasses,
    selectedClassId,
    setSelectedClassId,
    roster,
    guestRoster,
    loadingRoster,
    searchTerm,
    setSearchTerm,
    filteredRoster,
    filteredGuestRoster,
    updateStatus,
    updateGuestStatus,
    addAthlete,
    addGuest,
    removeAthlete,
    removeGuest,
    markRemaining,
    nextDay,
    prevDay
  } = useAttendance({ date: searchParams.get('date'), classId: searchParams.get('class') });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(false);
  const [addingAthlete, setAddingAthlete] = useState(false);
  const [addingGuest, setAddingGuest] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<{ id: string; name: string; kind: 'member' | 'guest' } | null>(null);
  const [overdueConfirm, setOverdueConfirm] = useState<Booking | null>(null);
  const [classTypes, setClassTypes] = useState<ClassTypeRow[]>([]);
  const colorByName = useMemo(() => classTypeColorMap(classTypes), [classTypes]);
  // Ticks once a minute so "Now" and "Mark remaining missed" follow the clock.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    void classTypeService
      .getClassTypes(tenantId, true)
      .then(setClassTypes)
      .catch((err) => console.error(err));
  }, [tenantId]);

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const bookingCount = selectedClass?.bookings[0]?.count ?? (
    roster.filter(b => b.status === 'booked' || b.status === 'attended').length
    + guestRoster.filter(g => g.status === 'booked' || g.status === 'attended').length
  );
  const isClassFull = selectedClass ? bookingCount >= selectedClass.max_capacity : false;
  const rosterUserIds = roster.map(b => b.profiles.id);
  const rosterGuestIds = guestRoster.map(g => g.guest_athlete_id);
  const isToday = date === getGymDate(new Date(), timezone);
  const presentCount = roster.filter(b => b.status === 'attended').length
    + guestRoster.filter(g => g.status === 'attended').length;
  const missedCount = roster.filter(b => b.status === 'no_show').length
    + guestRoster.filter(g => g.status === 'no_show').length;
  const pendingCount = roster.filter(b => b.status === 'booked').length
    + guestRoster.filter(g => g.status === 'booked').length;
  const totalRosterCount = roster.length + guestRoster.length;
  const showSearch = totalRosterCount > 6;
  // Marking people absent only makes sense once the class has begun.
  const classStarted = selectedClass ? classPhase(selectedClass, now) !== 'upcoming' : false;
  const dayLabel = date ? capitalizeFirst(formatDateLong(date, lang)) : '';

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

  const handleAddGuest = async (input: {
    fullName?: string;
    whatsapp?: string;
    instagram?: string;
    guestAthleteId?: string;
  }) => {
    setAddingGuest(true);
    try {
      await addGuest(input);
      setIsAddGuestOpen(false);
    } catch {
      // Error toast handled in hook
    } finally {
      setAddingGuest(false);
    }
  };

  const handleRemoveConfirm = async () => {
    if (!removeConfirm) return;
    const { id, kind } = removeConfirm;
    setRemoveConfirm(null);
    if (kind === 'guest') await removeGuest(id);
    else await removeAthlete(id);
  };

  const paymentBadge = (payment?: MemberPaymentStatus | null) => {
    if (!payment) return null;
    if (payment.has_pending_proof || payment.status === 'pending_review') {
      return (
        <span className="text-[11px] font-bold uppercase tracking-wide text-pits-info">
          {t('Proof in review')}
        </span>
      );
    }
    if (payment.status === 'in_grace') {
      return (
        <span className="text-[11px] font-bold uppercase tracking-wide text-pits-warning">
          {t('Plan in grace', { days: payment.days_overdue })}
        </span>
      );
    }
    if (payment.status === 'no_plan') {
      return (
        <span className="text-[11px] font-bold uppercase tracking-wide text-pits-danger">
          {t('No plan')}
        </span>
      );
    }
    if (payment.status === 'overdue') {
      return (
        <span className="text-[11px] font-bold uppercase tracking-wide text-pits-danger">
          {payment.reason === 'unpaid' || payment.reason === 'revoked'
            ? t('Payment pending')
            : t('Plan expired days', { days: payment.days_overdue })}
        </span>
      );
    }
    return null;
  };

  const toggleAttendance = (booking: Booking) => {
    const next = booking.status === 'attended' ? 'booked' : 'attended';
    if (next === 'attended' && booking.payment?.checkin_blocked) {
      setOverdueConfirm(booking);
      return;
    }
    void updateStatus(booking.id, next);
  };

  const handleOverdueConfirm = async () => {
    if (!overdueConfirm) return;
    const booking = overdueConfirm;
    setOverdueConfirm(null);
    try {
      await updateStatus(booking.id, 'attended', { override: true });
    } catch {
      // toast handled in hook unless blocked again
    }
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
            <h1 className="page-title">
              {t('Daily Attendance')}
            </h1>
            <Tooltip content={t('Athlete booking window tip')} wide side="bottom">
              <Info size={16} className="text-pits-dim cursor-help" />
            </Tooltip>
          </div>
          <p className="text-pits-dim font-medium text-xs md:text-sm">
            {dayLabel}
            {isToday ? <span className="font-semibold text-pits-positive"> · {t('Today')}</span> : null}
            <span className="hidden sm:inline"> · {t('Tap an athlete to check in.')}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Tooltip content={t('Previous day')}>
            <button
              type="button"
              onClick={prevDay}
              aria-label={t('Previous day')}
              className="h-11 w-11 sm:h-9 sm:w-9 inline-flex items-center justify-center bg-pits-surface-muted border border-pits-edge rounded-lg hover:bg-pits-surface-elevated text-pits-text transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
          </Tooltip>

          <div className="relative flex-1 min-w-0 sm:flex-none">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim" size={16} />
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label={t('Date')}
              className="w-full min-w-0 h-11 sm:h-9 pl-9 pr-2 bg-pits-surface-muted border border-pits-edge rounded-lg font-semibold text-pits-text focus:border-pits-primary outline-none text-sm"
            />
          </div>

          <Tooltip content={t('Next day')}>
            <button
              type="button"
              onClick={nextDay}
              aria-label={t('Next day')}
              className="h-11 w-11 sm:h-9 sm:w-9 inline-flex items-center justify-center bg-pits-surface-muted border border-pits-edge rounded-lg hover:bg-pits-surface-elevated text-pits-text transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </Tooltip>

          {!isToday && (
            <button
              type="button"
              onClick={() => setDate(getGymDate(new Date(), timezone))}
              className="shrink-0 h-11 sm:h-9 px-3 bg-pits-primary text-pits-dark-text rounded-lg text-xs font-bold hover:bg-pits-primary-dark transition-all"
            >
              {t('Today')}
            </button>
          )}
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
                        ? 'bg-pits-primary-soft border-pits-primary ring-1 ring-pits-primary' 
                        : 'bg-gray-50 border-gray-100 hover:bg-white'}
                    `}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span
                        className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider text-white"
                        style={classTypeBadgeStyle(colorByName[cls.class_type])}
                      >
                        {cls.class_type}
                      </span>
                      <div className="flex flex-col items-end">
                        <span className={`flex items-center text-[11px] font-black tracking-tighter
                          ${isFull ? 'text-pits-red' : isVeryFull ? 'text-pits-warning' : 'text-gray-700'}
                        `}>
                          <Users size={10} className="mr-1" />
                          {count} / {cls.max_capacity}
                        </span>
                        <div className="w-12 h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${isFull ? 'bg-pits-red' : isVeryFull ? 'bg-pits-warning' : 'bg-pits-positive'}`}
                            style={{ width: `${Math.min(occupancy, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-xl font-black italic ${classPhase(cls, now) === 'over' ? 'text-pits-dim' : 'text-pits-text'}`}>
                        {classTime(cls.start_time)}
                      </span>
                      {classPhase(cls, now) === 'live' ? (
                        <span className="rounded-full bg-pits-positive px-2 py-0.5 text-[11px] font-bold text-white">{t('Now')}</span>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className={`flex items-center text-xs font-semibold ${cls.coach?.full_name ? 'text-pits-dim' : 'text-pits-warning'}`}>
                        {cls.coach?.full_name || t('No coach assigned')}
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
                    const phase = classPhase(cls, now);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => setSelectedClassId(cls.id)}
                        aria-pressed={selected}
                        className={`shrink-0 min-h-11 px-3 py-2 rounded-lg border text-left transition-all ${
                          selected
                            ? 'bg-pits-primary-soft border-pits-primary ring-1 ring-pits-primary'
                            : 'bg-pits-surface-muted border-pits-edge'
                        }`}
                      >
                        <div className={`flex items-center gap-1.5 text-sm font-black italic leading-none ${phase === 'over' ? 'text-pits-dim' : 'text-pits-text'}`}>
                          {classTime(cls.start_time)}
                          {phase === 'live' ? (
                            <span className="not-italic rounded-full bg-pits-positive px-1.5 py-0.5 text-[10px] font-bold text-white">{t('Now')}</span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                          {cls.class_type} · {count}/{cls.max_capacity}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-black text-pits-text text-sm md:text-base uppercase italic tracking-tighter truncate">
                  {selectedClass
                    ? `${selectedClass.class_type} · ${classTime(selectedClass.start_time)}`
                    : t('Class Roster')}
                </h3>
                {selectedClass && (
                  <p className="text-xs text-pits-dim">
                    {selectedClass.coach?.full_name
                      ? <>{t('Coach')}: <span className="font-semibold text-pits-text">{selectedClass.coach.full_name}</span></>
                      : <span className="font-semibold text-pits-warning">{t('No coach assigned')}</span>}
                    {' · '}
                    <span className={isClassFull ? 'font-semibold text-pits-danger' : ''}>
                      {bookingCount}/{selectedClass.max_capacity}{isClassFull ? ` · ${t('Full')}` : ''}
                    </span>
                  </p>
                )}
              </div>
              
              {selectedClassId && (
                <div className="flex items-center gap-2 shrink-0 flex-wrap sm:justify-end">
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
                  {totalRosterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(true)}
                      disabled={isClassFull}
                      title={isClassFull ? t('Class is at full capacity') : undefined}
                      className="inline-flex min-h-9 items-center gap-1.5 px-2.5 bg-pits-primary text-pits-dark-text rounded-lg hover:bg-pits-primary-dark transition-all shadow-sm active:scale-95 text-xs font-semibold disabled:opacity-40 disabled:active:scale-100"
                    >
                      <UserPlus size={14} />
                      {t('Add Athlete')}
                    </button>
                  )}
                  {totalRosterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsAddGuestOpen(true)}
                      disabled={isClassFull}
                      title={isClassFull ? t('Class is at full capacity') : undefined}
                      className="min-h-9 px-2.5 bg-pits-surface-muted border border-pits-edge text-pits-text rounded-lg hover:bg-pits-surface-elevated transition-all shadow-sm active:scale-95 text-xs font-semibold disabled:opacity-40 disabled:active:scale-100"
                    >
                      {t('Add Guest')}
                    </button>
                  )}
                  {pendingCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markRemaining('attended')}
                      className="hidden sm:flex min-h-9 items-center px-3 bg-pits-positive text-white rounded-lg text-xs font-bold hover:bg-pits-positive/90 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                    >
                      <CheckCheck size={14} className="mr-1.5" />
                      {t('Check in {{count}} remaining', { count: pendingCount })}
                    </button>
                  )}
                </div>
              )}
            </div>

            {selectedClassId && totalRosterCount > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t  ">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <CheckCircle size={14} className="text-pits-positive" />
                  <span className="text-pits-positive">{presentCount}</span>
                  <span className="text-gray-400">{t('Present')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <XCircle size={14} className="text-pits-danger" />
                  <span className="text-pits-danger">{missedCount}</span>
                  <span className="text-gray-400">{t('Missed')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Clock size={14} className="text-pits-info" />
                  <span className="text-pits-info">{pendingCount}</span>
                  <span className="text-gray-400">{t('pending')}</span>
                </div>
                {pendingCount > 0 && classStarted && (
                  <button
                    type="button"
                    onClick={() => markRemaining('no_show')}
                    className="ml-auto min-h-9 text-xs font-semibold text-pits-dim hover:text-pits-danger transition-colors"
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
            ) : totalRosterCount === 0 ? (
              <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-4">
                <p>{t('No bookings for this class yet.')}</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    disabled={isClassFull}
                    className="flex items-center px-4 py-2 bg-pits-primary text-pits-dark-text rounded-lg text-xs font-black uppercase tracking-wider hover:bg-pits-primary-dark transition-all disabled:opacity-50"
                  >
                    <UserPlus size={16} className="mr-2" />
                    {t('Add Athlete')}
                  </button>
                  <button
                    onClick={() => setIsAddGuestOpen(true)}
                    disabled={isClassFull}
                    className="flex items-center px-4 py-2 border border-pits-edge bg-pits-surface-muted text-pits-text rounded-lg text-xs font-black uppercase tracking-wider hover:bg-pits-surface-elevated transition-all disabled:opacity-50"
                  >
                    {t('Add Guest')}
                  </button>
                </div>
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
                        attended ? 'bg-pits-positive-soft' : missed ? 'opacity-60' : 'hover:bg-gray-50'
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
                          <p className={`text-[11px] font-black uppercase tracking-wide ${
                            attended ? 'text-pits-positive' : missed ? 'text-pits-danger' : 'text-pits-info'
                          }`}>
                            {t(bookingStatusKey(booking.status))}
                          </p>
                          {paymentBadge(booking.payment)}
                        </div>
                        <CheckCircle
                          size={22}
                          className={attended ? 'text-pits-positive shrink-0' : 'text-gray-200 shrink-0'}
                        />
                      </button>

                      <Tooltip content={missed ? t('Reset to Booked') : t('Mark as Missed')}>
                        <button
                          type="button"
                          onClick={() => toggleMissed(booking)}
                          aria-label={missed ? t('Reset to Booked') : t('Mark as Missed')}
                          className={`h-11 w-11 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg transition-colors ${
                            missed ? 'bg-pits-danger text-white' : 'text-gray-300 hover:bg-pits-danger-soft hover:text-pits-danger'
                          }`}
                        >
                          <XCircle size={18} />
                        </button>
                      </Tooltip>

                      <Tooltip content={t('Remove from class')}>
                        <button
                          type="button"
                          onClick={() => setRemoveConfirm({ id: booking.id, name: booking.profiles.full_name, kind: 'member' })}
                          aria-label={t('Remove from class')}
                          className="h-11 w-11 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg text-gray-300 hover:bg-pits-warning-soft hover:text-pits-warning transition-colors md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                        >
                          <UserMinus size={18} />
                        </button>
                      </Tooltip>
                    </div>
                  );
                })}
                {filteredGuestRoster.map((guest) => {
                  const attended = guest.status === 'attended';
                  const missed = guest.status === 'no_show';
                  const contact = [guest.whatsapp, guest.instagram].filter(Boolean).join(' · ');
                  return (
                    <div
                      key={`guest-${guest.id}`}
                      className={`group flex items-center gap-1 pr-2 sm:pr-3 transition-colors ${
                        attended ? 'bg-pits-positive-soft' : missed ? 'opacity-60' : 'hover:bg-gray-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => updateGuestStatus(guest.id, attended ? 'booked' : 'attended')}
                        className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-pits-warning-soft flex items-center justify-center text-xs font-bold text-pits-warning shrink-0">
                          {guest.full_name?.charAt(0) || 'G'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="font-bold text-pits-text truncate">{guest.full_name}</p>
                            <span className="shrink-0 text-[11px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-pits-warning-soft text-pits-warning">
                              {t('Guest')}
                            </span>
                          </div>
                          <p className={`text-[11px] font-black uppercase tracking-wide ${
                            attended ? 'text-pits-positive' : missed ? 'text-pits-danger' : 'text-pits-info'
                          }`}>
                            {t(bookingStatusKey(guest.status))}
                            {contact ? <span className="normal-case tracking-normal font-semibold text-gray-400"> · {contact}</span> : null}
                          </p>
                        </div>
                        <CheckCircle
                          size={22}
                          className={attended ? 'text-pits-positive shrink-0' : 'text-gray-200 shrink-0'}
                        />
                      </button>

                      <Tooltip content={missed ? t('Reset to Booked') : t('Mark as Missed')}>
                        <button
                          type="button"
                          onClick={() => updateGuestStatus(guest.id, missed ? 'booked' : 'no_show')}
                          aria-label={missed ? t('Reset to Booked') : t('Mark as Missed')}
                          className={`h-11 w-11 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg transition-colors ${
                            missed ? 'bg-pits-danger text-white' : 'text-gray-300 hover:bg-pits-danger-soft hover:text-pits-danger'
                          }`}
                        >
                          <XCircle size={18} />
                        </button>
                      </Tooltip>

                      <Tooltip content={t('Remove from class')}>
                        <button
                          type="button"
                          onClick={() => setRemoveConfirm({ id: guest.id, name: guest.full_name, kind: 'guest' })}
                          aria-label={t('Remove from class')}
                          className="h-11 w-11 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg text-gray-300 hover:bg-pits-warning-soft hover:text-pits-warning transition-colors md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
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

      {selectedClassId && pendingCount > 0 && (
        <div className="sm:hidden sticky bottom-0 z-20 -mx-4 border-t border-pits-edge bg-pits-surface-elevated/95 px-4 py-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => markRemaining('attended')}
            className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-pits-positive text-sm font-bold text-white active:scale-[0.98]"
          >
            <CheckCheck size={18} />
            {t('Check in {{count}} remaining', { count: pendingCount })}
          </button>
        </div>
      )}

      <AddToClassModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSelect={handleAddAthlete}
        excludedUserIds={rosterUserIds}
        adding={addingAthlete}
      />

      <AddGuestModal
        isOpen={isAddGuestOpen}
        onClose={() => setIsAddGuestOpen(false)}
        onSubmit={handleAddGuest}
        adding={addingGuest}
        excludedGuestIds={rosterGuestIds}
      />

      <ConfirmDialog
        isOpen={!!overdueConfirm}
        title={t('Overdue check-in title')}
        message={t('Overdue check-in message', {
          name: overdueConfirm?.profiles.full_name ?? t('this athlete'),
        })}
        confirmLabel={t('Allow anyway')}
        variant="warning"
        onConfirm={() => {
          void handleOverdueConfirm();
        }}
        onCancel={() => setOverdueConfirm(null)}
      />

      <ConfirmDialog
        isOpen={!!removeConfirm}
        title={removeConfirm?.kind === 'guest' ? t('Remove Guest') : t('Remove Athlete')}
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
