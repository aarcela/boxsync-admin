import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Loader2, Save, Calendar, Clock, Repeat } from 'lucide-react';
import { addDays, format, isSameDay, parseISO } from 'date-fns';
import { useToast } from './Toast';
import { CLASS_TYPES } from '@/lib/constants/classTypes';

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Coach {
  id: string;
  full_name: string;
}

const DAYS_OF_WEEK = [
  { label: 'M', value: 1 },
  { label: 'T', value: 2 },
  { label: 'W', value: 3 },
  { label: 'T', value: 4 },
  { label: 'F', value: 5 },
  { label: 'S', value: 6 },
  { label: 'S', value: 0 },
];

export default function CreateClassModal({ isOpen, onClose, onSuccess }: CreateClassModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  
  // Basic Form State
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('07:00');
  const [duration, setDuration] = useState('60');
  const [coachId, setCoachId] = useState('');
  const [type, setType] = useState('CrossFit');
  const [capacity, setCapacity] = useState('12');

  // Recurring State
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [untilDate, setUntilDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));

  useEffect(() => {
    const fetchCoaches = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['coach', 'manager', 'admin']);
      if (data) setCoaches(data);
    };
    if (isOpen) fetchCoaches();
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
      const classesToInsert = [];
      const durationMs = parseInt(duration) * 60000;

      if (!isRecurring) {
        // Single Class Logic
        const start = new Date(`${date}T${time}`);
        classesToInsert.push({
          start_time: start.toISOString(),
          end_time: new Date(start.getTime() + durationMs).toISOString(),
          coach_id: coachId || null,
          class_type: type,
          max_capacity: parseInt(capacity),
        });
      } else {
        // Recurring Logic
        if (selectedDays.length === 0) throw new Error('Select at least one day for recurrence.');
        
        let currentIterDate = new Date(`${date}T${time}`);
        const endLimit = new Date(`${untilDate}T23:59:59`);

        while (currentIterDate <= endLimit) {
          if (selectedDays.includes(currentIterDate.getDay())) {
            classesToInsert.push({
              start_time: currentIterDate.toISOString(),
              end_time: new Date(currentIterDate.getTime() + durationMs).toISOString(),
              coach_id: coachId || null,
              class_type: type,
              max_capacity: parseInt(capacity),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pits-background/50 backdrop-blur-sm">
      <div className="bg-pits-background rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="bg-pits-background px-6 py-4 border-b border-pits-border flex justify-between items-center">
          <h3 className="font-black text-lg text-pits-text uppercase italic tracking-tighter">
            Schedule Classes
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-pits-background rounded-full text-pits-primary">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase mb-2">Start Date</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:border-pits-red" />
            </div>
            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase mb-2">Time</label>
              <input type="time" required value={time} onChange={e => setTime(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:border-pits-red" />
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
                  if (newType === 'Open Box') {
                    setDuration('120');
                  } else {
                    setDuration('60');
                  }
                }} 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:border-pits-red"
              >
                {CLASS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase mb-2">Coach</label>
              <select value={coachId} onChange={e => setCoachId(e.target.value)} required className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:border-pits-red">
                <option value="">Select Coach</option>
                {coaches.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
          </div>

          {/* RECURRING SECTION */}
          <div className={`p-4 rounded-xl border-2 transition-all ${isRecurring ? 'bg-pits-card border-pits-red/20' : 'bg-gray-50 border-transparent'}`}>
            <label className="flex items-center cursor-pointer mb-3">
              <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="w-4 h-4 text-pits-red rounded border-gray-300 focus:ring-pits-red" />
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
                        className={`w-9 h-9 rounded-full font-bold text-xs border-2 transition-all ${selectedDays.includes(day.value) ? 'bg-pits-primary border-pits-primary text-pits-dark-text' : 'bg-pits-surface-elevated border-gray-200 text-gray-400'}`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-pits-dim uppercase mb-2">Until Date</label>
                  <input type="date" value={untilDate} onChange={e => setUntilDate(e.target.value)} className="w-full p-2 bg-pits-background border border-pits-border rounded-lg text-sm font-bold outline-none focus:border-pits-red" />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-lg flex items-center justify-center text-pits-dark-text font-black uppercase tracking-widest text-sm shadow-lg ${loading ? 'bg-gray-400' : 'bg-pits-primary hover:bg-pits-primary-dark '}`}
          >
            {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
            {isRecurring ? 'Bulk Schedule' : 'Schedule Single Class'}
          </button>
        </form>
      </div>
    </div>
  );
}