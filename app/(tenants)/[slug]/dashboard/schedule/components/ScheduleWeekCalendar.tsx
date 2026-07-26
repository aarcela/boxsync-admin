'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import { classService } from '@/lib/services/classService';
import { classTypeService } from '@/lib/services/classTypeService';
import { ClassSession, ClassTypeRow } from '@/lib/types/gym';
import { classTypeBadgeStyle, classTypeColorMap } from '@/lib/utils/classTypeStyles';
import {
  getCaracasDate,
  getCaracasTimeLabel,
  getCaracasDateFromIso,
  getCaracasWeekDays,
  getCaracasWeekRange,
} from '@/lib/utils/date';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/components/LanguageContext';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';

const START_HOUR = 5;
const END_HOUR = 21;
const SLOT_HEIGHT = 56;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

interface Coach {
  id: string;
  full_name: string;
}

interface ScheduleWeekCalendarProps {
  onCreateSlot: (date: string, time: string) => void;
  refreshKey?: number;
  onClassesChanged?: () => void;
}

function getCaracasHourMinute(iso: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date(iso));
  return {
    hour: Number(parts.find((p) => p.type === 'hour')?.value ?? 0),
    minute: Number(parts.find((p) => p.type === 'minute')?.value ?? 0),
  };
}

function getDurationMinutes(startIso: string, endIso: string): number {
  const diff = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(30, Math.round(diff / 60000));
}

export default function ScheduleWeekCalendar({
  onCreateSlot,
  refreshKey = 0,
  onClassesChanged,
}: ScheduleWeekCalendarProps) {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [anchorDate, setAnchorDate] = useState(getCaracasDate);
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [classTypes, setClassTypes] = useState<ClassTypeRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCoach, setBulkCoach] = useState('');
  const [bulkType, setBulkType] = useState('');
  const [bulkCapacity, setBulkCapacity] = useState('');
  const [bulkDate, setBulkDate] = useState('');
  const [bulkTime, setBulkTime] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [bulkEndTime, setBulkEndTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const colorByName = useMemo(() => classTypeColorMap(classTypes), [classTypes]);

  const weekDays = useMemo(() => getCaracasWeekDays(anchorDate), [anchorDate]);
  const weekRange = useMemo(() => getCaracasWeekRange(anchorDate), [anchorDate]);
  const gridHeight = HOURS.length * SLOT_HEIGHT;

  const periodLabel = useMemo(() => {
    const fmt = (d: string) =>
      new Date(`${d}T12:00:00-04:00`).toLocaleDateString('en-US', {
        timeZone: 'America/Caracas',
        month: 'short',
        day: 'numeric',
      });
    return `${t('Week of')} ${fmt(weekRange.startDate)} – ${fmt(weekRange.endDate)}`;
  }, [weekRange.startDate, weekRange.endDate, t]);

  const classesByDay = useMemo(() => {
    const map = new Map<string, ClassSession[]>();
    for (const day of weekDays) map.set(day, []);
    for (const cls of classes) {
      const day = getCaracasDateFromIso(cls.start_time);
      const list = map.get(day);
      if (list) list.push(cls);
    }
    return map;
  }, [classes, weekDays]);

  const selectedClasses = useMemo(
    () => classes.filter((c) => selectedIds.has(c.id)),
    [classes, selectedIds]
  );

  const singleSelected = selectedClasses.length === 1 ? selectedClasses[0] : null;

  useEffect(() => {
    if (singleSelected) {
      setBulkDate(getCaracasDateFromIso(singleSelected.start_time));
      setBulkTime(getCaracasTimeLabel(singleSelected.start_time));
      setBulkEndDate(getCaracasDateFromIso(singleSelected.end_time));
      setBulkEndTime(getCaracasTimeLabel(singleSelected.end_time));
    } else {
      setBulkDate('');
      setBulkTime('');
      setBulkEndDate('');
      setBulkEndTime('');
    }
  }, [singleSelected]);

  const loadWeek = useCallback(async () => {
    setLoading(true);
    try {
      const data = await classService.getClassesByRange(weekRange.startUtc, weekRange.endUtc);
      setClasses(data);
      setSelectedIds(new Set());
    } catch {
      toast(t('Failed to load schedule'), 'error');
    } finally {
      setLoading(false);
    }
  }, [weekRange.startUtc, weekRange.endUtc, toast, t]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek, refreshKey]);

  useEffect(() => {
    const loadLookups = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      const [{ data: coachRows }, types] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name')
          .in('role', ['coach', 'manager', 'admin']),
        profile?.tenant_id
          ? classTypeService.getClassTypes(profile.tenant_id, true)
          : Promise.resolve([] as ClassTypeRow[]),
      ]);

      if (coachRows) setCoaches(coachRows);
      setClassTypes(types);
    };

    void loadLookups();
  }, []);

  const shiftWeek = (weeks: number) => {
    const d = new Date(`${anchorDate}T12:00:00-04:00`);
    d.setDate(d.getDate() + weeks * 7);
    setAnchorDate(getCaracasDate(d));
  };

  const toggleSelected = (classId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  const handleEmptySlot = (day: string, hour: number) => {
    onCreateSlot(day, `${String(hour).padStart(2, '0')}:00`);
  };

  const handleApplyBulk = async () => {
    if (selectedIds.size === 0) return;
    const updates: {
      coach_id?: string | null;
      class_type?: string;
      max_capacity?: number;
      start_time?: string;
      end_time?: string;
    } = {};
    if (bulkCoach === '__none__') updates.coach_id = null;
    else if (bulkCoach) updates.coach_id = bulkCoach;
    if (bulkType) updates.class_type = bulkType;
    if (bulkCapacity) updates.max_capacity = parseInt(bulkCapacity, 10);

    if (
      selectedIds.size === 1 &&
      singleSelected &&
      bulkDate &&
      bulkTime &&
      bulkEndDate &&
      bulkEndTime
    ) {
      const originalDate = getCaracasDateFromIso(singleSelected.start_time);
      const originalTime = getCaracasTimeLabel(singleSelected.start_time);
      const originalEndDate = getCaracasDateFromIso(singleSelected.end_time);
      const originalEndTime = getCaracasTimeLabel(singleSelected.end_time);
      const startChanged = bulkDate !== originalDate || bulkTime !== originalTime;
      const endChanged = bulkEndDate !== originalEndDate || bulkEndTime !== originalEndTime;

      if (startChanged || endChanged) {
        const newStart = new Date(`${bulkDate}T${bulkTime}:00-04:00`);
        const newEnd = new Date(`${bulkEndDate}T${bulkEndTime}:00-04:00`);
        if (newEnd <= newStart) {
          toast(t('End must be after start'), 'error');
          return;
        }
        updates.start_time = newStart.toISOString();
        updates.end_time = newEnd.toISOString();
      }
    }

    if (Object.keys(updates).length === 0) {
      toast(t('No change'), 'error');
      return;
    }

    setSaving(true);
    try {
      await classService.bulkUpdateClasses(Array.from(selectedIds), updates);
      toast(t('Classes updated successfully'), 'success');
      setBulkCoach('');
      setBulkType('');
      setBulkCapacity('');
      await loadWeek();
      onClassesChanged?.();
    } catch {
      toast(t('Action failed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedBookingCount = selectedClasses.reduce(
    (sum, cls) => sum + (cls.bookings[0]?.count ?? 0),
    0
  );

  const handleDeleteConfirm = async () => {
    setDeleteConfirmOpen(false);
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => classService.deleteClass(id)));
      toast(t('Class deleted successfully'), 'success');
      await loadWeek();
      onClassesChanged?.();
    } catch {
      toast(t('Could not delete class'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkCoach('');
    setBulkType('');
    setBulkCapacity('');
    setBulkDate('');
    setBulkTime('');
    setBulkEndDate('');
    setBulkEndTime('');
  };

  const someSelected = selectedIds.size > 0;

  return (
    <div className="bg-pits-surface-elevated rounded-xl border border-pits-edge shadow-sm overflow-hidden">
      <div className="px-4 md:px-6 py-4 border-b border-pits-edge space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            className="p-2 bg-pits-surface-muted border border-pits-edge rounded-lg hover:bg-pits-edge transition-colors"
            aria-label={t('Previous week')}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim" size={16} />
            <input
              type="date"
              value={anchorDate}
              onChange={(e) => setAnchorDate(e.target.value)}
              className="pl-10 pr-4 py-2 bg-pits-surface-muted border border-pits-edge rounded-xl text-xs font-bold text-pits-ink outline-none focus:ring-2 focus:ring-pits-primary/40"
            />
          </div>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            className="p-2 bg-pits-surface-muted border border-pits-edge rounded-lg hover:bg-pits-edge transition-colors"
            aria-label={t('Next week')}
          >
            <ChevronRight size={18} />
          </button>
          <span className="text-xs font-black text-pits-dim uppercase tracking-widest">
            {periodLabel}
          </span>
        </div>

        <div
          className={`min-h-10 flex flex-wrap items-center gap-2 transition-opacity duration-150 ${
            someSelected ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden={!someSelected}
        >
          <span className="text-[10px] font-black text-pits-dim uppercase">
            {selectedIds.size} {t('selected')}
          </span>
          <select
            value={bulkCoach}
            onChange={(e) => setBulkCoach(e.target.value)}
            disabled={!someSelected}
            className="px-3 py-2 bg-pits-surface-muted border border-pits-edge rounded-lg text-[10px] font-black uppercase text-pits-ink outline-none"
          >
            <option value="">{t('Coach')}</option>
            <option value="__none__">{t('Staff')}</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
          <select
            value={bulkType}
            onChange={(e) => setBulkType(e.target.value)}
            disabled={!someSelected}
            className="px-3 py-2 bg-pits-surface-muted border border-pits-edge rounded-lg text-[10px] font-black uppercase text-pits-ink outline-none"
          >
            <option value="">{t('Type')}</option>
            {classTypes.map((row) => (
              <option key={row.id} value={row.name}>
                {row.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            placeholder={t('Capacity')}
            value={bulkCapacity}
            onChange={(e) => setBulkCapacity(e.target.value)}
            disabled={!someSelected}
            className="w-20 px-3 py-2 bg-pits-surface-muted border border-pits-edge rounded-lg text-[10px] font-bold text-pits-ink outline-none"
          />
          <input
            type="date"
            value={bulkDate}
            onChange={(e) => setBulkDate(e.target.value)}
            disabled={!singleSelected}
            className="px-3 py-2 bg-pits-surface-muted border border-pits-edge rounded-lg text-[10px] font-bold text-pits-ink outline-none disabled:opacity-40"
            aria-label={t('Start date')}
          />
          <input
            type="time"
            value={bulkTime}
            onChange={(e) => setBulkTime(e.target.value)}
            disabled={!singleSelected}
            className="px-3 py-2 bg-pits-surface-muted border border-pits-edge rounded-lg text-[10px] font-bold text-pits-ink outline-none disabled:opacity-40"
            aria-label={t('Start time')}
          />
          <input
            type="date"
            value={bulkEndDate}
            onChange={(e) => setBulkEndDate(e.target.value)}
            disabled={!singleSelected}
            min={bulkDate || undefined}
            className="px-3 py-2 bg-pits-surface-muted border border-pits-edge rounded-lg text-[10px] font-bold text-pits-ink outline-none disabled:opacity-40"
            aria-label={t('End date')}
          />
          <input
            type="time"
            value={bulkEndTime}
            onChange={(e) => setBulkEndTime(e.target.value)}
            disabled={!singleSelected}
            className="px-3 py-2 bg-pits-surface-muted border border-pits-edge rounded-lg text-[10px] font-bold text-pits-ink outline-none disabled:opacity-40"
            aria-label={t('End time')}
          />
          <button
            type="button"
            disabled={saving || !someSelected}
            onClick={handleApplyBulk}
            className="px-4 py-2 bg-pits-primary text-pits-dark-text rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-pits-primary-dark transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : t('Apply changes')}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={!someSelected}
            className="px-3 py-2 text-pits-dim hover:text-pits-ink text-[10px] font-black uppercase disabled:opacity-50"
          >
            {t('Clear')}
          </button>
          <button
            type="button"
            disabled={saving || !someSelected}
            onClick={() => setDeleteConfirmOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-pits-error hover:bg-pits-primary-soft border border-pits-error/30 rounded-lg text-[10px] font-black uppercase transition-colors disabled:opacity-50"
          >
            <Trash2 size={14} />
            {t('Delete Class')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-pits-dim font-bold uppercase animate-pulse text-xs tracking-widest">
          {t('Loading schedule...')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid border-b border-pits-edge" style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}>
              <div className="border-r border-pits-edge bg-pits-surface-muted/40" />
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="px-2 py-3 text-center border-r border-pits-edge last:border-r-0 bg-pits-surface-muted/40"
                >
                  <p className="text-[10px] font-black text-pits-dim uppercase">
                    {new Date(`${day}T12:00:00-04:00`).toLocaleDateString('en-US', {
                      timeZone: 'America/Caracas',
                      weekday: 'short',
                    })}
                  </p>
                  <p className="text-sm font-black text-pits-text">
                    {new Date(`${day}T12:00:00-04:00`).toLocaleDateString('en-US', {
                      timeZone: 'America/Caracas',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid" style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}>
              <div className="border-r border-pits-edge relative" style={{ height: gridHeight }}>
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 pr-2 text-right text-[10px] font-bold text-pits-dim -translate-y-1/2"
                    style={{ top: (hour - START_HOUR) * SLOT_HEIGHT }}
                  >
                    {String(hour).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {weekDays.map((day) => {
                const dayClasses = classesByDay.get(day) ?? [];
                return (
                  <div
                    key={day}
                    className="relative border-r border-pits-edge last:border-r-0 bg-pits-surface-muted/10"
                    style={{ height: gridHeight }}
                  >
                    {HOURS.map((hour) => (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => handleEmptySlot(day, hour)}
                        className="absolute left-0 right-0 border-b border-pits-edge/50 hover:bg-pits-primary/5 transition-colors"
                        style={{
                          top: (hour - START_HOUR) * SLOT_HEIGHT,
                          height: SLOT_HEIGHT,
                        }}
                        aria-label={`${day} ${hour}:00`}
                      />
                    ))}

                    {dayClasses.map((cls) => {
                      const { hour, minute } = getCaracasHourMinute(cls.start_time);
                      const durationMin = getDurationMinutes(cls.start_time, cls.end_time);
                      const top = (hour - START_HOUR) * SLOT_HEIGHT + (minute / 60) * SLOT_HEIGHT;
                      const height = Math.max((durationMin / 60) * SLOT_HEIGHT - 4, 28);
                      const isSelected = selectedIds.has(cls.id);
                      const bookingCount = cls.bookings[0]?.count ?? 0;
                      const waitlistCount = cls.waitlist?.[0]?.count ?? 0;

                      if (hour < START_HOUR || hour > END_HOUR) return null;

                      return (
                        <div
                          key={cls.id}
                          className={`absolute left-1 right-1 rounded-lg border px-1.5 py-1 text-left overflow-hidden shadow-sm transition-all flex items-start gap-1 text-white ${isSelected ? 'ring-2 ring-pits-primary ring-offset-1 ring-offset-pits-surface-elevated z-10' : 'z-1'}`}
                          style={{
                            ...classTypeBadgeStyle(colorByName[cls.class_type]),
                            top: top + 2,
                            height,
                          }}
                          title={`${cls.class_type} · ${getCaracasTimeLabel(cls.start_time)}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelected(cls.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 shrink-0 w-3.5 h-3.5 accent-pits-primary cursor-pointer"
                            aria-label={t('Select class')}
                          />
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className="text-[10px] font-black uppercase truncate leading-tight">
                              {cls.class_type}
                            </p>
                            <p className="text-[9px] font-bold truncate opacity-90 mt-0.5">
                              {getCaracasTimeLabel(cls.start_time)}
                            </p>
                            <p className="text-[9px] font-bold truncate opacity-80">
                              {cls.coach?.full_name || t('Staff')}
                            </p>
                            <p className="text-[9px] font-black opacity-75 mt-0.5">
                              {bookingCount}/{cls.max_capacity}
                              {waitlistCount > 0 ? ` · W${waitlistCount}` : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <p className="px-4 py-3 text-[9px] font-bold text-pits-dim uppercase border-t border-pits-edge">
        {t('Click a slot to schedule · Use checkboxes to multi-select')}
      </p>

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title={t('Cancel Class')}
        message={
          selectedIds.size > 1
            ? `${t('Delete selected classes?')} ${
                selectedBookingCount > 0
                  ? `${selectedBookingCount} ${t('athlete(s) have booked this class and their bookings will be removed.')}`
                  : t('No athletes have booked yet.')
              }`
            : `${t('Delete this class?')} ${
                selectedBookingCount > 0
                  ? `${selectedBookingCount} ${t('athlete(s) have booked this class and their bookings will be removed.')}`
                  : t('No athletes have booked yet.')
              }`
        }
        confirmLabel={t('Delete Class')}
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}
