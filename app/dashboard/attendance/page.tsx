'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Calendar, Clock, User, CheckCircle, XCircle, MinusCircle, Users, ChevronLeft, ChevronRight } from 'lucide-react';

interface ClassSession {
  id: string;
  start_time: string;
  class_type: string;
  max_capacity: number;
  coach: { full_name: string } | null;
  bookings: { count: number }[];
}

type BookingStatus = 'booked' | 'attended' | 'no_show';

interface Booking {
  id: string;
  status: BookingStatus;
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export default function AttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [roster, setRoster] = useState<Booking[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(false);

  // 1. Fetch Classes for selected Date
  useEffect(() => {
    const fetchClasses = async () => {
      setLoadingClasses(true);
      setSelectedClassId(null);
      setRoster([]);
      
      const start = new Date(date);
      start.setUTCHours(0,0,0,0);
      const end = new Date(date);
      end.setUTCHours(23,59,59,999);

      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          coach:profiles(full_name),
          bookings:bookings(count)
        `)
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time', { ascending: true });

      if (!error && data) {
        setClasses(data as ClassSession[]);
      }
      setLoadingClasses(false);
    };

    fetchClasses();
  }, [date]);

  // 2. Fetch Roster when a class is selected
  useEffect(() => {
    if (!selectedClassId) return;

    const fetchRoster = async () => {
      setLoadingRoster(true);
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, status,
          profiles:user_id (id, full_name, avatar_url)
        `)
        .eq('class_id', selectedClassId);

      if (!error && data) {
        // Transform Supabase response to match Booking interface
        const bookings: Booking[] = data.map((item: unknown) => {
          const d = item as { id: string; status: BookingStatus; profiles: { id: string; full_name: string; avatar_url: string | null } };
          return {
            id: d.id,
            status: d.status as BookingStatus,
            profiles: d.profiles
          };
        });
        setRoster(bookings);
      }
      setLoadingRoster(false);
    };

    fetchRoster();
  }, [selectedClassId]);

  // 3. Update Status
  const updateStatus = async (bookingId: string, newStatus: BookingStatus) => {
    // Optimistic Update
    setRoster(prev => prev.map(b => 
      b.id === bookingId ? { ...b, status: newStatus } : b
    ));

    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', bookingId);

    if (error) {
      alert('Failed to update status');
      // Revert logic would go here in a full production app
    }
  };

  return (
    <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
      
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-pits-text uppercase italic tracking-tighter">
            Daily Attendance
          </h2>
          <p className="text-pits-dim font-medium text-sm">
            Check-in athletes and manage roster.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const currentDate = new Date(date);
              currentDate.setDate(currentDate.getDate() - 1);
              setDate(currentDate.toISOString().split('T')[0]);
            }}
            className="p-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
            title="Previous day"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg font-bold text-gray-700 focus:border-pits-red outline-none shadow-sm"
            />
          </div>
          <button
            onClick={() => {
              const currentDate = new Date(date);
              currentDate.setDate(currentDate.getDate() + 1);
              setDate(currentDate.toISOString().split('T')[0]);
            }}
            className="p-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
            title="Next day"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
        
        {/* LEFT: CLASSES LIST */}
        <div className="w-full md:w-1/3 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <h3 className="font-bold text-pits-dim text-xs uppercase tracking-wider">
              Classes ({classes.length})
            </h3>
          </div>
          
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {loadingClasses ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
            ) : classes.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No classes scheduled.</div>
            ) : (
              classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all hover:shadow-md
                    ${selectedClassId === cls.id 
                      ? 'bg-red-50 border-red-200 ring-1 ring-pits-red' 
                      : 'bg-white border-gray-100 hover:border-gray-300'}
                  `}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white
                      ${cls.class_type === 'CrossFit' ? 'bg-pits-red' : 'bg-blue-600'}
                    `}>
                      {cls.class_type}
                    </span>
                    <span className="flex items-center text-xs font-bold text-gray-500">
                      <Users size={12} className="mr-1" />
                      {cls.bookings[0]?.count || 0} / {cls.max_capacity}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-black text-pits-text italic">
                      {new Date(cls.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <div className="flex items-center text-xs font-medium text-gray-400 mt-1">
                    <User size={12} className="mr-1" />
                    Coach {cls.coach?.full_name || 'Staff'}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: ROSTER */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-bold text-pits-dim text-xs uppercase tracking-wider">
              Class Roster
            </h3>
            {selectedClassId && (
              <span className="text-xs font-bold text-pits-text bg-white px-2 py-1 rounded border border-gray-200">
                {roster.filter(b => b.status === 'attended').length} Checked In
              </span>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {!selectedClassId ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-300">
                <Users size={48} className="mb-4 opacity-20" />
                <p>Select a class to view athletes.</p>
              </div>
            ) : loadingRoster ? (
              <div className="p-12 text-center text-gray-400">Loading roster...</div>
            ) : roster.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No bookings for this class yet.</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 uppercase bg-gray-50/50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 font-bold">Athlete</th>
                    <th className="px-6 py-3 font-bold text-center">Status</th>
                    <th className="px-6 py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {roster.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
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
                          {booking.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button 
                            onClick={() => updateStatus(booking.id, 'attended')}
                            className={`p-2 rounded-lg transition-colors ${booking.status === 'attended' ? 'bg-green-100 text-green-700' : 'text-gray-300 hover:bg-green-50 hover:text-green-600'}`}
                            title="Mark Attended"
                          >
                            <CheckCircle size={18} />
                          </button>
                          <button 
                            onClick={() => updateStatus(booking.id, 'booked')}
                            className={`p-2 rounded-lg transition-colors ${booking.status === 'booked' ? 'bg-blue-100 text-blue-700' : 'text-gray-300 hover:bg-blue-50 hover:text-blue-600'}`}
                            title="Reset to Booked"
                          >
                            <MinusCircle size={18} />
                          </button>
                          <button 
                            onClick={() => updateStatus(booking.id, 'no_show')}
                            className={`p-2 rounded-lg transition-colors ${booking.status === 'no_show' ? 'bg-red-100 text-red-700' : 'text-gray-300 hover:bg-red-50 hover:text-red-600'}`}
                            title="Mark No-Show"
                          >
                            <XCircle size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}