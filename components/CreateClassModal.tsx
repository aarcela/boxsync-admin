import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Loader2, Save, Repeat } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { useToast } from './Toast';
import { classTypeService } from '@/lib/services/classTypeService';
import { classService } from '@/lib/services/classService';
import { ClassTypeRow } from '@/lib/types/gym';
import { classTypeDurationMap } from '@/lib/utils/classTypeStyles';
import { getCaracasDateFromIso } from '@/lib/utils/date';

export type ClassModalMode = 'create' | 'edit' | 'duplicate';

export type ClassFormPrefill = {
  id?: string;
  start_time: string;
  end_time: string;
  class_type: string;
  max_capacity: number;
  coach_id?: string | null;
};

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
  initialTime?: string;
  mode?: ClassModalMode;
  prefill?: ClassFormPrefill | null;
}

interface Coach {
  id: string;
  full_name: string;
}

const inputClass =
  'w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm font-medium text-pits-ink focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary transition-all outline-none';

const DAYS_OF_WEEK = [
  { label: 'M', value: 1 },
  { label: 'T', value: 2 },
  { label: 'W', value: 3 },
  { label: 'T', value: 4 },
  { label: 'F', value: 5 },
  { label: 'S', value: 6 },
  { label: 'S', value: 0 },
];

function defaultDurationMinutes(classType: string, durationByName: Record<string, number>): number {
  return durationByName[classType] ?? (classType === 'Open Box' ? 120 : 60);
}

function toCaracasTimeInput(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date(iso));
  let hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  if (hour === 24) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseCaracasDateTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00-04:00`);
}

function computeEndFromStart(
  startDate: string,
  startTime: string,
  durationMin: number
): { endDate: string; endTime: string } {
  const start = parseCaracasDateTime(startDate, startTime);
  const end = new Date(start.getTime() + durationMin * 60000);
  return {
    endDate: getCaracasDateFromIso(end.toISOString()),
    endTime: toCaracasTimeInput(end.toISOString()),
  };
}

export default function CreateClassModal({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
  initialTime,
  mode = 'create',
  prefill = null,
}: CreateClassModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  
  // Basic Form State
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('07:00');
  const [endDate, setEndDate] = useState(() =>
    computeEndFromStart(format(new Date(), 'yyyy-MM-dd'), '07:00', 60).endDate
  );
  const [endTime, setEndTime] = useState(() =>
    computeEndFromStart(format(new Date(), 'yyyy-MM-dd'), '07:00', 60).endTime
  );
  const [coachId, setCoachId] = useState('');
  const [type, setType] = useState('CrossFit');
  const [capacity, setCapacity] = useState('12');
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [classTypes, setClassTypes] = useState<ClassTypeRow[]>([]);

  // Recurring State
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [untilDate, setUntilDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));

  const isEdit = mode === 'edit';
  const durationByName = classTypeDurationMap(classTypes);

  const syncEndFromStart = (startDate: string, startTime: string, classType: string) => {
    const next = computeEndFromStart(
      startDate,
      startTime,
      defaultDurationMinutes(classType, durationByName)
    );
    setEndDate(next.endDate);
    setEndTime(next.endTime);
  };

  const shiftEndWithStart = (
    prevDate: string,
    prevTime: string,
    nextDate: string,
    nextTime: string
  ) => {
    const prevStart = parseCaracasDateTime(prevDate, prevTime);
    const prevEnd = parseCaracasDateTime(endDate, endTime);
    const durationMs = Math.max(prevEnd.getTime() - prevStart.getTime(), 30 * 60000);
    const nextStart = parseCaracasDateTime(nextDate, nextTime);
    if (Number.isNaN(nextStart.getTime())) return;
    const nextEnd = new Date(nextStart.getTime() + durationMs);
    setEndDate(getCaracasDateFromIso(nextEnd.toISOString()));
    setEndTime(toCaracasTimeInput(nextEnd.toISOString()));
  };

  useEffect(() => {
    if (!isOpen) return;

    setIsRecurring(false);
    setSelectedDays([]);
    setUntilDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));

    if (prefill) {
      const nextDate = getCaracasDateFromIso(prefill.start_time);
      const nextTime = toCaracasTimeInput(prefill.start_time);
      setDate(nextDate);
      setTime(nextTime);
      setEndDate(getCaracasDateFromIso(prefill.end_time));
      setEndTime(toCaracasTimeInput(prefill.end_time));
      setType(prefill.class_type || 'CrossFit');
      setCapacity(String(prefill.max_capacity || 12));
      setCoachId(prefill.coach_id || '');
      return;
    }

    const nextDate = initialDate || format(new Date(), 'yyyy-MM-dd');
    const nextTime = initialTime || '07:00';
    const nextType = 'CrossFit';
    setDate(nextDate);
    setTime(nextTime);
    setType(nextType);
    setCapacity('12');
    setCoachId('');
    syncEndFromStart(nextDate, nextTime, nextType);
  }, [isOpen, initialDate, initialTime, prefill, mode]);

  useEffect(() => {
    const fetchCoaches = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      const activeTenantId = profile?.tenant_id ?? null;
      setTenantId(activeTenantId);

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['coach', 'manager', 'admin']);
      if (data) setCoaches(data);

      if (activeTenantId) {
        try {
          const types = await classTypeService.getClassTypes(activeTenantId, true);
          setClassTypes(types);
          if (types.length > 0 && !types.some((row) => row.name === type)) {
            setType(types[0].name);
          }
        } catch (err) {
          console.error(err);
        }
      }
    };
    if (isOpen) fetchCoaches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const toggleDay = (dayValue: number) => {
    setSelectedDays(prev => 
      prev.includes(dayValue) ? prev.filter(d => d !== dayValue) : [...prev, dayValue]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!tenantId) {
        throw new Error('Missing tenant context. Sign out and sign in again.');
      }

      const start = parseCaracasDateTime(date, time);
      const end = parseCaracasDateTime(endDate, endTime);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error('Invalid start or end date/time.');
      }
      if (end <= start) {
        throw new Error('End must be after start.');
      }

      const maxCapacity = parseInt(capacity, 10);
      if (!Number.isFinite(maxCapacity) || maxCapacity < 1) {
        throw new Error('Max athletes must be at least 1.');
      }

      if (isEdit) {
        if (!prefill?.id) throw new Error('Missing class to update.');
        await classService.updateClass(prefill.id, {
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          coach_id: coachId || null,
          class_type: type,
          max_capacity: maxCapacity,
        });
        toast('Class updated successfully.', 'success');
        onSuccess();
        onClose();
        return;
      }

      const classesToInsert = [];
      const durationMs = end.getTime() - start.getTime();

      if (!isRecurring) {
        classesToInsert.push({
          tenant_id: tenantId,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          coach_id: coachId || null,
          class_type: type,
          max_capacity: maxCapacity,
        });
      } else {
        if (selectedDays.length === 0) throw new Error('Select at least one day for recurrence.');
        
        let currentIterDate = parseCaracasDateTime(date, time);
        const endLimit = new Date(`${untilDate}T23:59:59-04:00`);

        while (currentIterDate <= endLimit) {
          if (selectedDays.includes(currentIterDate.getDay())) {
            classesToInsert.push({
              tenant_id: tenantId,
              start_time: currentIterDate.toISOString(),
              end_time: new Date(currentIterDate.getTime() + durationMs).toISOString(),
              coach_id: coachId || null,
              class_type: type,
              max_capacity: maxCapacity,
            });
          }
          currentIterDate = addDays(currentIterDate, 1);
        }
      }

      if (classesToInsert.length === 0) throw new Error('No valid dates found in range.');

      const { error } = await supabase.from('classes').insert(classesToInsert);
      if (error) throw error;

      toast(`Successfully scheduled ${classesToInsert.length} class${classesToInsert.length > 1 ? 'es' : ''}.`, 'success');
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to schedule class';
      toast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const title =
    mode === 'edit' ? 'Edit Class' : mode === 'duplicate' ? 'Duplicate Class' : 'Schedule Classes';
  const submitLabel = isEdit
    ? 'Save Changes'
    : isRecurring
      ? 'Bulk Schedule'
      : mode === 'duplicate'
        ? 'Schedule Duplicate'
        : 'Schedule Single Class';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pits-background/50 backdrop-blur-sm">
      <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-pits-edge flex justify-between items-center">
          <h3 className="font-black text-lg text-pits-text uppercase italic tracking-tighter">
            {title}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-pits-surface-muted rounded-full text-pits-dim hover:text-pits-ink transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase mb-2">Start Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={e => {
                  const nextDate = e.target.value;
                  shiftEndWithStart(date, time, nextDate, time);
                  setDate(nextDate);
                }}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase mb-2">Start Time</label>
              <input
                type="time"
                required
                value={time}
                onChange={e => {
                  const nextTime = e.target.value;
                  shiftEndWithStart(date, time, date, nextTime);
                  setTime(nextTime);
                }}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase mb-2">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                min={date}
                onChange={e => setEndDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase mb-2">End Time</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase mb-2">Type</label>
              <select 
                value={type} 
                onChange={e => {
                  const newType = e.target.value;
                  setType(newType);
                  syncEndFromStart(date, time, newType);
                }} 
                className={inputClass}
              >
                {classTypes.map((row) => (
                  <option key={row.id} value={row.name}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase mb-2">Coach</label>
              <select value={coachId} onChange={e => setCoachId(e.target.value)} required className={inputClass}>
                <option value="">Select Coach</option>
                {coaches.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-pits-dim uppercase mb-2">
              Max athletes
            </label>
            <input
              type="number"
              required
              min={1}
              step={1}
              value={capacity}
              onChange={e => setCapacity(e.target.value)}
              className={inputClass}
            />
          </div>

          {!isEdit && (
            <div className={`p-4 rounded-xl border-2 transition-all ${isRecurring ? 'bg-pits-card border-pits-red/20' : 'bg-pits-surface-muted border-pits-edge'}`}>
              <label className="flex items-center cursor-pointer mb-3">
                <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="w-4 h-4 text-pits-red rounded border-pits-edge focus:ring-pits-red" />
                <span className="ml-3 text-sm font-black text-pits-text uppercase italic tracking-tight flex items-center">
                  <Repeat size={14} className="mr-2" />
                  Repeat this class
                </span>
              </label>

              {isRecurring && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div>
                    <label className="block text-[10px] font-bold text-pits-dim uppercase mb-2">Repeat on</label>
                    <div className="flex justify-between">
                      {DAYS_OF_WEEK.map(day => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDay(day.value)}
                          className={`w-9 h-9 rounded-full font-bold text-xs border-2 transition-all ${selectedDays.includes(day.value) ? 'bg-pits-primary border-pits-primary text-pits-dark-text' : 'bg-pits-surface-elevated border-pits-edge text-pits-dim'}`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-pits-dim uppercase mb-2">Until Date</label>
                    <input type="date" value={untilDate} onChange={e => setUntilDate(e.target.value)} className={inputClass} />
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-lg flex items-center justify-center text-pits-dark-text font-black uppercase tracking-widest text-sm shadow-lg transition-all ${loading ? 'bg-pits-gunmetal cursor-not-allowed' : 'bg-pits-primary hover:bg-pits-primary-dark shadow-pits-primary/20'}`}
          >
            {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
            {submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
