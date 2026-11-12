'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePaletteCommand } from '@/components/CommandPalette';
import Image from 'next/image';
import Link from 'next/link';
import { Plus, Trash2, X, Edit3, Copy, AlertCircle, Calendar, ShieldAlert, Info, List, ClipboardCheck, ChevronDown } from 'lucide-react';
import CreateClassModal, { ClassFormPrefill, ClassModalMode } from '@/components/CreateClassModal';
import { useSchedule } from './hooks/useSchedule';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { capitalizeFirst, formatDateLong, formatDateTime } from '@/lib/utils/format-date';
import type { TranslationKey } from '@/lib/translations';
import ScheduleList from './components/ScheduleList';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import ScheduleWeekCalendar from './components/ScheduleWeekCalendar';
import Tooltip from '@/components/Tooltip';
import { classTypeService } from '@/lib/services/classTypeService';
import { CapacityInsight, ClassSession, ClassTypeRow } from '@/lib/types/gym';
import { currencySymbol } from '@/lib/currency';
import { classTypeColorMap } from '@/lib/utils/classTypeStyles';
import { getGymDate, getGymTimeLabel } from '@/lib/utils/date';

type ViewTab = 'list' | 'calendar';

export default function SchedulePage() {
  const { t, lang } = useLanguage();
  const {
    classes,
    loading,
    selectedClassId,
    setSelectedClassId,
    roster,
    guestRoster,
    waitlist,
    capacityInsights,
    loadingRoster,
    coachBrief,
    coachBriefError,
    fetchSchedule,
    deleteClass
  } = useSchedule();

  const { toast } = useToast();
  const { tenantId, timezone: tz, currencies } = useTenant();
  const [classTypes, setClassTypes] = useState<ClassTypeRow[]>([]);
  const [viewTab, setViewTab] = useState<ViewTab>('list');
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(() => searchParams.get('new') === '1');
  const [modalMode, setModalMode] = useState<ClassModalMode>('create');
  const [modalPrefill, setModalPrefill] = useState<ClassFormPrefill | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState<string | undefined>();
  const [modalInitialTime, setModalInitialTime] = useState<string | undefined>();
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    classId: string;
    classType: string;
    bookingCount: number;
  }>({ isOpen: false, classId: '', classType: '', bookingCount: 0 });

  const colorByName = useMemo(() => classTypeColorMap(classTypes), [classTypes]);
  const selectedClass = selectedClassId ? classes.find((c) => c.id === selectedClassId) ?? null : null;
  const statusTone = (status: string) =>
    status === 'attended'
      ? 'bg-pits-positive-soft text-pits-positive'
      : status === 'no_show'
        ? 'bg-pits-danger-soft text-pits-danger'
        : 'bg-pits-info-soft text-pits-info';

  useEffect(() => {
    if (!tenantId) return;
    void classTypeService
      .getClassTypes(tenantId, true)
      .then(setClassTypes)
      .catch((err) => console.error(err));
  }, [tenantId]);

  useEffect(() => {
    if (!isDetailsModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDetailsModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDetailsModalOpen]);

  const handleDeleteConfirm = async () => {
    const { classId } = deleteConfirm;
    setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
    try {
      await deleteClass(classId);
      toast(t('Class deleted successfully'), 'success');
      setCalendarRefreshKey((k) => k + 1);
    } catch {
      toast(t('Could not delete class'), 'error');
    }
  };

  const askDelete = (session: ClassSession) =>
    setDeleteConfirm({
      isOpen: true,
      classId: session.id,
      classType: session.class_type,
      bookingCount: session.bookings[0]?.count || 0,
    });

  const openCreateModal = (date?: string, time?: string) => {
    setModalMode('create');
    setModalPrefill(null);
    setModalInitialDate(date);
    setModalInitialTime(time);
    setIsModalOpen(true);
  };

  const insightText = (insight: CapacityInsight) => {
    const params = {
      ...insight.params,
      amount: `${currencySymbol(currencies.reference)}${Number(insight.params.amount ?? 0).toLocaleString()}`,
    };
    if (insight.kind === 'low_occupancy') {
      return { title: t('Insight low occupancy title', params), detail: t('Insight low occupancy detail', params) };
    }
    if (insight.kind === 'high_demand') {
      return { title: t('Insight high demand title', params), detail: t('Insight high demand detail', params) };
    }
    return { title: t('Insight no-show title', params), detail: t('Insight no-show detail', params) };
  };

  usePaletteCommand('new-class', () => openCreateModal());

  const sessionToPrefill = (session: ClassSession): ClassFormPrefill => ({
    id: session.id,
    start_time: session.start_time,
    end_time: session.end_time,
    class_type: session.class_type,
    max_capacity: session.max_capacity,
    coach_id: session.coach_id ?? null,
  });

  const openEditModal = (session: ClassSession) => {
    setModalMode('edit');
    setModalPrefill(sessionToPrefill(session));
    setModalInitialDate(undefined);
    setModalInitialTime(undefined);
    setIsModalOpen(true);
  };

  const openDuplicateModal = (session: ClassSession) => {
    setModalMode('duplicate');
    setModalPrefill({
      ...sessionToPrefill(session),
      id: undefined,
    });
    setModalInitialDate(undefined);
    setModalInitialTime(undefined);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    if (searchParams.get('new')) router.replace('/dashboard/schedule');
    setModalMode('create');
    setModalPrefill(null);
    setModalInitialDate(undefined);
    setModalInitialTime(undefined);
  };

  const handleScheduleSuccess = () => {
    fetchSchedule();
    setCalendarRefreshKey((k) => k + 1);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">
              {t('Class Schedule')}
            </h1>
            <Tooltip content={t('Athlete booking window tip')} wide side="bottom">
              <Info size={16} className="text-pits-dim cursor-help" />
            </Tooltip>
          </div>
          <p className="page-subtitle">{t('Manage upcoming classes and coach assignments.')}</p>
        </div>
        <button 
          onClick={() => openCreateModal()}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-pits-primary text-pits-dark-text text-sm font-semibold shadow-sm hover:bg-pits-primary-dark"
        >
          <Plus size={16} />
          {t('Schedule Class')}
        </button>
      </div>

      {capacityInsights.length > 0 && (
        <details className="group rounded-xl border border-pits-warning-edge bg-pits-warning-soft">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm">
            <AlertCircle size={16} className="shrink-0 text-pits-warning" aria-hidden />
            <span className="font-semibold text-pits-text">
              {t('Schedule tips ({{count}})', { count: capacityInsights.length })}
            </span>
            <span className="hidden sm:inline truncate text-pits-dim">· {insightText(capacityInsights[0]).title}</span>
            <ChevronDown size={16} className="ml-auto shrink-0 text-pits-dim transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="space-y-3 border-t border-pits-warning-edge px-4 py-3">
            {capacityInsights.map((insight) => (
              <li key={insight.id} className="text-sm">
                <p
                  className={`font-semibold ${
                    insight.kind === 'no_show'
                      ? 'text-pits-danger'
                      : insight.kind === 'high_demand'
                        ? 'text-pits-positive'
                        : 'text-pits-text'
                  }`}
                >
                  {insightText(insight).title}
                </p>
                <p className="mt-0.5 text-xs text-pits-dim">{insightText(insight).detail}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="inline-flex rounded-xl border border-pits-edge bg-pits-surface-elevated p-1" role="group">
        {([
          { id: 'list' as const, label: t('View as list'), icon: List },
          { id: 'calendar' as const, label: t('View as calendar'), icon: Calendar },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={viewTab === id}
            onClick={() => setViewTab(id)}
            className={`inline-flex items-center gap-2 min-h-9 px-3 rounded-lg text-sm font-semibold transition-colors ${
              viewTab === id ? 'bg-pits-text text-white' : 'text-pits-dim hover:text-pits-text'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {viewTab === 'calendar' ? (
        <ScheduleWeekCalendar
          refreshKey={calendarRefreshKey}
          onCreateSlot={(date, time) => openCreateModal(date, time)}
          onClassesChanged={handleScheduleSuccess}
        />
      ) : loading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-pits-surface-elevated border border-pits-edge animate-pulse" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-xl border border-pits-edge bg-pits-surface-elevated p-10 text-center">
          <p className="text-sm text-pits-dim">{t('No upcoming classes found. Schedule one above.')}</p>
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="mt-3 text-sm font-semibold text-pits-info hover:underline"
          >
            {t('Schedule Class')}
          </button>
        </div>
      ) : (
        <ScheduleList
          classes={classes}
          timezone={tz}
          colorByName={colorByName}
          onOpen={(session) => {
            setSelectedClassId(session.id);
            setIsDetailsModalOpen(true);
          }}
          onEdit={openEditModal}
          onDuplicate={openDuplicateModal}
          onDelete={askDelete}
        />
      )}

      <CreateClassModal 
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleScheduleSuccess}
        initialDate={modalInitialDate}
        initialTime={modalInitialTime}
        mode={modalMode}
        prefill={modalPrefill}
      />

      {isDetailsModalOpen && selectedClass && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-pits-black/50 sm:p-4 backdrop-blur-sm"
          onClick={() => setIsDetailsModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="class-details-title"
            className="bg-pits-surface-elevated rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-4 border-b border-pits-edge shrink-0">
              <div className="min-w-0">
                <h3 id="class-details-title" className="text-lg font-bold text-pits-text truncate">
                  {selectedClass.class_type} · {getGymTimeLabel(selectedClass.start_time, tz)}
                </h3>
                <p className="text-sm text-pits-dim">
                  {capitalizeFirst(formatDateLong(getGymDate(new Date(selectedClass.start_time), tz), lang))}
                  {' · '}
                  {selectedClass.coach?.full_name || t('No coach assigned')}
                  {' · '}
                  {t('{{booked}} of {{capacity}} booked', {
                    booked: selectedClass.bookings[0]?.count || 0,
                    capacity: selectedClass.max_capacity,
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                aria-label={t('Close')}
                className="flex items-center justify-center w-9 h-9 shrink-0 rounded-lg text-pits-dim hover:text-pits-text hover:bg-pits-surface-muted"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 overscroll-contain space-y-5">
              <section>
                <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-pits-text">
                  {t('Athletes')}
                  <Tooltip content={t('Athlete booking window tip')} wide side="bottom">
                    <Info size={12} className="text-pits-dim cursor-help" />
                  </Tooltip>
                </h4>
                {loadingRoster ? (
                  <div className="space-y-2" aria-busy="true">
                    {[0, 1].map((i) => (
                      <div key={i} className="h-12 rounded-lg bg-pits-surface-muted animate-pulse" />
                    ))}
                  </div>
                ) : roster.length === 0 && guestRoster.length === 0 ? (
                  <p className="rounded-lg bg-pits-surface-muted p-4 text-center text-sm text-pits-dim">{t('No bookings yet.')}</p>
                ) : (
                  <ul className="divide-y divide-pits-edge rounded-lg border border-pits-edge">
                    {roster.map((booking) => (
                      <li key={booking.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-8 h-8 shrink-0 rounded-full bg-pits-surface-muted flex items-center justify-center text-xs font-bold text-pits-dim overflow-hidden">
                            {booking.profiles.avatar_url ? (
                              <Image src={booking.profiles.avatar_url} alt="" fill className="object-cover" />
                            ) : (
                              booking.profiles.full_name?.charAt(0)
                            )}
                          </div>
                          <span className="truncate text-sm font-medium text-pits-text">{booking.profiles.full_name}</span>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold ${statusTone(booking.status)}`}>
                          {t(booking.status as TranslationKey)}
                        </span>
                      </li>
                    ))}
                    {guestRoster.map((guest) => (
                      <li key={guest.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 shrink-0 rounded-full bg-pits-warning-soft flex items-center justify-center text-xs font-bold text-pits-warning">
                            {guest.full_name?.charAt(0) || 'G'}
                          </div>
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 text-sm font-medium text-pits-text">
                              <span className="truncate">{guest.full_name}</span>
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-pits-warning-soft text-pits-warning">
                                {t('Guest')}
                              </span>
                            </p>
                            <p className="text-[11px] text-pits-dim truncate">
                              {[guest.whatsapp, guest.instagram].filter(Boolean).join(' · ') || t('No contact saved')}
                            </p>
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold ${statusTone(guest.status)}`}>
                          {t(guest.status as TranslationKey)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {!loadingRoster && waitlist.length > 0 ? (
                <section>
                  <h4 className="mb-2 text-sm font-semibold text-pits-text">
                    {t('Waitlist ({{count}})', { count: waitlist.length })}
                  </h4>
                  <ol className="divide-y divide-pits-edge rounded-lg border border-pits-edge">
                    {waitlist.map((entry, index) => (
                      <li key={entry.id} className="flex items-center gap-3 px-3 py-2.5">
                        <span className="w-6 h-6 shrink-0 rounded-full bg-pits-surface-muted text-pits-dim flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-pits-text">{entry.profiles.full_name}</p>
                          <p className="text-[11px] text-pits-dim">
                            {t('Joined {{date}}', { date: formatDateTime(entry.joined_at, lang) })}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              <details className="group rounded-lg border border-pits-edge">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold text-pits-text">
                  <ShieldAlert size={16} className="text-pits-dim" aria-hidden />
                  {t('Private Coach Brief')}
                  <ChevronDown size={16} className="ml-auto text-pits-dim transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="border-t border-pits-edge p-3">
                  {loadingRoster ? (
                    <p className="text-pits-dim text-sm">{t('Loading schedule...')}</p>
                  ) : coachBriefError ? (
                    <p className="text-pits-danger text-sm">{coachBriefError}</p>
                  ) : coachBrief ? (
                    <div className="space-y-3">
                      <p className="text-pits-text text-xs leading-relaxed">{coachBrief.notice}</p>
                      <p className="text-sm">
                        <span className="text-pits-dim">{t("Today's WOD")}: </span>
                        <span className="font-semibold text-pits-text">{coachBrief.wodTitle || t('No WOD scheduled')}</span>
                      </p>
                      {coachBrief.athletes.map((athlete) => (
                        <div key={athlete.userId} className="rounded-lg bg-pits-surface-muted p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <p className="font-semibold text-pits-text text-sm">{athlete.name}</p>
                            <span className="text-[11px] text-pits-dim">{athlete.level || t('Level not set')}</span>
                          </div>
                          <div className="space-y-1.5 text-sm text-pits-dim">
                            {athlete.suggestedLoad && (
                              <p><strong className="text-pits-text">{t('Suggested load')}:</strong> {athlete.suggestedLoad}</p>
                            )}
                            <p><strong className="text-pits-text">{t('Scaling')}:</strong> {athlete.scalingNote}</p>
                            <p><strong className="text-pits-text">{t('Pacing target')}:</strong> {athlete.pacingTarget}</p>
                            {athlete.healthCaution && (
                              <p className="rounded-lg border border-pits-danger-edge bg-pits-danger-soft p-2.5 text-pits-text leading-relaxed">
                                <strong>{t('Health caution')}:</strong> {athlete.healthCaution}
                              </p>
                            )}
                            <details className="text-xs">
                              <summary className="cursor-pointer font-semibold text-pits-info">{t('Why this guidance')}</summary>
                              <ul className="list-disc pl-5 mt-2 space-y-1">
                                {athlete.explanation.map((reason) => <li key={reason}>{reason}</li>)}
                              </ul>
                            </details>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </details>
            </div>

            <div className="flex flex-wrap items-center gap-2 p-3 border-t border-pits-edge bg-pits-surface-muted shrink-0">
              <Link
                href={`/dashboard/attendance?date=${getGymDate(new Date(selectedClass.start_time), tz)}&class=${selectedClass.id}`}
                className="inline-flex items-center gap-2 min-h-10 px-4 rounded-xl bg-pits-primary text-pits-dark-text text-sm font-semibold hover:bg-pits-primary-dark"
              >
                <ClipboardCheck size={16} />
                {t('Take attendance')}
              </Link>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    openEditModal(selectedClass);
                  }}
                  className="flex items-center justify-center w-10 h-10 rounded-lg text-pits-dim hover:text-pits-text hover:bg-pits-surface-elevated"
                  aria-label={t('Edit Class')}
                  title={t('Edit Class')}
                >
                  <Edit3 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    openDuplicateModal(selectedClass);
                  }}
                  className="flex items-center justify-center w-10 h-10 rounded-lg text-pits-dim hover:text-pits-text hover:bg-pits-surface-elevated"
                  aria-label={t('Duplicate Class')}
                  title={t('Duplicate Class')}
                >
                  <Copy size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    askDelete(selectedClass);
                  }}
                  className="flex items-center justify-center w-10 h-10 rounded-lg text-pits-dim hover:text-pits-danger hover:bg-pits-danger-soft"
                  aria-label={t('Cancel Class')}
                  title={t('Cancel Class')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
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