'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Trash2, Calendar, Clock, User } from 'lucide-react';
import CreateClassModal from '@/components/CreateClassModal';

interface ClassSession {
  id: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  class_type: string;
  is_cancelled: boolean;
  coach: { full_name: string } | null;
  bookings: { count: number }[];
}

export default function SchedulePage() {
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch logic
  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          coach:profiles(full_name),
          bookings:bookings(count)
        `)
        .gte('start_time', today) // Only future classes
        .order('start_time', { ascending: true });

      if (error) throw error;
      setClasses(data as ClassSession[]);

    } catch (error) {
      console.error('Error fetching schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  // CANCEL CLASS
  const deleteClass = async (id: string) => {
    if (!confirm('Are you sure you want to cancel and delete this class? This will remove all bookings.')) return;
    
    try {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;
      fetchSchedule(); // Refresh
    } catch (error) {
      alert('Could not delete class.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-pits-text uppercase italic tracking-tighter">
            Class Schedule
          </h2>
          <p className="text-pits-dim font-medium text-sm">
            Manage upcoming classes and coach assignments.
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center px-4 py-3 bg-pits-red text-white rounded-lg font-bold uppercase text-xs tracking-widest shadow-lg shadow-red-200 hover:bg-red-700 transition-all"
        >
          <Plus size={18} className="mr-2" />
          Schedule Class
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading schedule...</div>
        ) : classes.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            No upcoming classes found. Schedule one above.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {classes.map((session) => {
              const startDate = new Date(session.start_time);
              const isToday = startDate.getDate() === new Date().getDate();

              return (
                <div key={session.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  
                  {/* Left: Date & Time */}
                  <div className="flex items-start gap-4">
                    <div className={`
                      flex flex-col items-center justify-center w-16 h-16 rounded-lg border
                      ${isToday ? 'bg-red-50 border-red-200 text-pits-red' : 'bg-gray-50 border-gray-200 text-gray-500'}
                    `}>
                      <span className="text-xs font-bold uppercase">{startDate.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                      <span className="text-xl font-black">{startDate.getDate()}</span>
                    </div>

                    <div>
                       <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white
                            ${session.class_type === 'CrossFit' ? 'bg-pits-red' : 'bg-blue-600'}
                          `}>
                            {session.class_type}
                          </span>
                          <span className="text-xs font-bold text-gray-400 flex items-center">
                            <Clock size={12} className="mr-1" />
                            {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                       </div>
                       <h4 className="text-lg font-black text-pits-text uppercase italic">
                         {session.class_type} WOD
                       </h4>
                       <div className="flex items-center text-xs font-bold text-gray-500 mt-1">
                         <User size={12} className="mr-1" />
                         Coach {session.coach?.full_name || 'Staff'}
                       </div>
                    </div>
                  </div>

                  {/* Right: Stats & Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                    <div className="text-right">
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Bookings</div>
                      <div className="text-xl font-black text-pits-text">
                        {session.bookings[0]?.count || 0} <span className="text-gray-300 text-sm">/ {session.max_capacity}</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => deleteClass(session.id)}
                      className="p-3 text-gray-400 hover:text-pits-red hover:bg-red-50 rounded-lg transition-colors"
                      title="Cancel Class"
                    >
                      <Trash2 size={20} />
                    </button>
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

    </div>
  );
}