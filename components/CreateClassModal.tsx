import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Loader2, Save, Calendar, Clock } from 'lucide-react';

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Coach {
  id: string;
  full_name: string;
}

const CLASS_TYPES = ['CrossFit', 'Halterofilia', 'Gymnastic', 'Open Box', 'Endurance'];

export default function CreateClassModal({ isOpen, onClose, onSuccess }: CreateClassModalProps) {
  const [loading, setLoading] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  
  // Form State
  const [date, setDate] = useState('');
  const [time, setTime] = useState('07:00');
  const [duration, setDuration] = useState('60'); // minutes
  const [coachId, setCoachId] = useState('');
  const [type, setType] = useState('CrossFit');
  const [capacity, setCapacity] = useState('12');

  // Fetch Coaches on mount
  useEffect(() => {
    const fetchCoaches = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['coach', 'manager', 'admin']); // Allow admins to coach too
      
      if (data) setCoaches(data);
    };
    if (isOpen) fetchCoaches();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Construct ISO Timestamps
      const startDateTime = new Date(`${date}T${time}`);
      const endDateTime = new Date(startDateTime.getTime() + parseInt(duration) * 60000);

      // 2. Insert into Supabase
      const { error } = await supabase.from('classes').insert({
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        coach_id: coachId || null,
        class_type: type,
        max_capacity: parseInt(capacity),
      });

      if (error) throw error;

      alert('Class scheduled successfully!');
      onSuccess();
      onClose();
      // Don't clear date/type to allow rapid entry of multiple classes
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to schedule class';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-black text-lg text-pits-text uppercase italic tracking-tighter">
            Schedule New Class
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Date & Time Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:border-pits-red"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                Start Time
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="time"
                  required
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:border-pits-red"
                />
              </div>
            </div>
          </div>

          {/* Type & Duration Row */}
          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                Class Type
              </label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:border-pits-red"
              >
                {CLASS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                Duration (Min)
              </label>
              <input
                type="number"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:border-pits-red"
              />
            </div>
          </div>

          {/* Coach & Capacity Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                Coach
              </label>
              <select
                value={coachId}
                onChange={e => setCoachId(e.target.value)}
                required
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:border-pits-red"
              >
                <option value="">Select Coach</option>
                {coaches.map(c => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                Capacity
              </label>
              <input
                type="number"
                value={capacity}
                onChange={e => setCapacity(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:border-pits-red"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-lg flex items-center justify-center text-white font-black uppercase tracking-widest text-sm shadow-lg
                ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-pits-red hover:bg-red-700 shadow-red-200'}
              `}
            >
              {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
              Publish Class
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}