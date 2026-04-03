'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Calendar, Clock, User, CheckCircle, XCircle, MinusCircle, Users, ChevronLeft, ChevronRight, X, CheckCheck, Ban, Search } from 'lucide-react';
import Tooltip from '@/components/Tooltip';
import { useToast } from '../../../components/Toast';

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

const getCaracasDate = () => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(new Date());
  const ye = parts.find((p) => p.type === 'year')?.value;
  const mo = parts.find((p) => p.type === 'month')?.value;
  const da = parts.find((p) => p.type === 'day')?.value;
  return `${ye}-${mo}-${da}`;
};

export default function AttendancePage() {
  const { toast } = useToast();
  const [date, setDate] = useState('');

  useEffect(() => {
    // Only run on client mount to avoid hydration mismatch
    setDate(getCaracasDate());
  }, []);
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [roster, setRoster] = useState<Booking[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch Classes for selected Date
  useEffect(() => {
    if (!date) return; // Wait for date to be set on mount

    const fetchClasses = async () => {
      setLoadingClasses(true);
      setSelectedClassId(null);
      setRoster([]);
      
      // Calculate start and end in Caracas time (UTC-4)
      const startUtc = new Date(`${date}T00:00:00-04:00`).toISOString();
      const endUtc = new Date(`${date}T23:59:59-04:00`).toISOString();

      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          coach:profiles(full_name),
          bookings:bookings(count)
        `)
        .gte('start_time', startUtc)
        .lte('start_time', endUtc)
        .order('start_time', { ascending: true });

      if (!error && data) {
        const fetchedClasses = data as ClassSession[];
        setClasses(fetchedClasses);
        
        // Auto-select class closest to now if looking at today
        const todayStr = getCaracasDate();
        if (date === todayStr && fetchedClasses.length > 0) {
          const now = new Date();
          let closestId = fetchedClasses[0].id;
          let minDiff = Infinity;
          
          fetchedClasses.forEach(cls => {
            const diff = Math.abs(new Date(cls.start_time).getTime() - now.getTime());
            if (diff < minDiff) {
              minDiff = diff;
              closestId = cls.id;
            }
          });
          setSelectedClassId(closestId);
        }
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

  // Filter roster for search
  const filteredRoster = roster.filter(b => 
    b.profiles.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 3. Update Status
  const updateStatus = async (bookingId: string, newStatus: BookingStatus) => {
    // Optimistic Update
    setRoster(prev => prev.map(b => 
      b.id === bookingId ? { ...b, status: newStatus } : b
    ));

    try {
      const response = await fetch('/api/admin/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      console.error(error);
      toast('Failed to update status', 'error');
    }
  };

  // Bulk Update All
  const markAll = async (newStatus: BookingStatus) => {
    const toUpdate = roster.filter(b => b.status !== newStatus);
    if (toUpdate.length === 0) {
      toast(`All athletes are already marked as ${newStatus}`, 'info');
      return;
    }

    // Optimistic update all
    setRoster(prev => prev.map(b => ({ ...b, status: newStatus })));

    try {
      const promises = toUpdate.map(b => 
        fetch('/api/admin/bookings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: b.id, status: newStatus }),
        })
      );
      await Promise.all(promises);
      toast(`${toUpdate.length} athletes marked as ${newStatus.replace('_', ' ')}`, 'success');
    } catch (error) {
      console.error(error);
      toast('Some updates may have failed', 'error');
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
          <Tooltip content="Previous day">
            <button
              onClick={() => {
                const currentDate = new Date(`${date}T12:00:00Z`);
                currentDate.setUTCDate(currentDate.getUTCDate() - 1);
                setDate(currentDate.toISOString().split('T')[0]);
              }}
              className="p-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
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
              className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg font-bold text-gray-700 focus:border-pits-red outline-none shadow-sm"
            />
          </div>
          <Tooltip content="Next day">
            <button
              onClick={() => {
                const currentDate = new Date(`${date}T12:00:00Z`);
                currentDate.setUTCDate(currentDate.getUTCDate() + 1);
                setDate(currentDate.toISOString().split('T')[0]);
              }}
              className="p-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </Tooltip>
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
              <div className="p-8 text-center text-gray-400 text-sm">Loading ...</div>
            ) : classes.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No classes scheduled.</div>
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
                        ? 'bg-red-50 border-red-200 ring-1 ring-pits-red' 
                        : 'bg-white border-gray-100 hover:border-gray-200'}
                    `}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white
                        ${cls.class_type === 'CrossFit' ? 'bg-pits-red' : 'bg-blue-600'}
                      `}>
                        {cls.class_type}
                      </span>
                      <div className="flex flex-col items-end">
                        <span className={`flex items-center text-[10px] font-black tracking-tighter
                          ${isFull ? 'text-pits-red' : isVeryFull ? 'text-orange-500' : 'text-gray-400'}
                        `}>
                          <Users size={10} className="mr-1" />
                          {count} / {cls.max_capacity}
                        </span>
                        {/* Occupancy Bar */}
                        <div className="w-12 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${isFull ? 'bg-pits-red' : isVeryFull ? 'bg-orange-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(occupancy, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-pits-text italic">
                        {new Date(cls.start_time).toLocaleTimeString('en-US', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                        <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center mr-1.5 text-gray-500">
                          {cls.coach?.full_name?.charAt(0) || 'S'}
                        </div>
                        {cls.coach?.full_name || 'Staff'}
                      </div>
                      <ChevronRight size={14} className={`transition-transform ${selectedClassId === cls.id ? 'text-pits-red translate-x-1' : 'text-gray-200 group-hover:translate-x-1'}`} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: ROSTER */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-black text-pits-text text-sm uppercase italic tracking-tighter">
                  {selectedClassId ? (
                    classes.find(c => c.id === selectedClassId)?.class_type + " @ " + 
                    new Date(classes.find(c => c.id === selectedClassId)?.start_time || "").toLocaleTimeString('en-US', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' })
                  ) : "Class Roster"}
                </h3>
                {selectedClassId && (
                  <p className="text-[10px] font-bold text-gray-400 uppercase">
                    Coach: <span className="text-pits-dim">{classes.find(c => c.id === selectedClassId)?.coach?.full_name || 'Staff'}</span>
                  </p>
                )}
              </div>
              
              {selectedClassId && roster.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="relative mr-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                      type="text"
                      placeholder="Search athlete..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 pr-4 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:border-pits-red outline-none w-48 transition-all"
                    />
                  </div>
                  <Tooltip content="Mark all as attended">
                    <button
                      onClick={() => markAll('attended')}
                      className="flex items-center px-3 py-1.5 bg-green-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-green-700 transition-all shadow-sm active:scale-95"
                    >
                      <CheckCheck size={14} className="mr-1.5" />
                      All Check-in
                    </button>
                  </Tooltip>
                  <Tooltip content="Mark all as no-show">
                    <button
                      onClick={() => markAll('no_show')}
                      className="flex items-center px-3 py-1.5 bg-white border border-gray-200 text-gray-400 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                    >
                      <Ban size={14} className="mr-1.5" />
                      All Missed
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>
            {/* Attendance Summary Bar */}
            {selectedClassId && roster.length > 0 && (
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <CheckCircle size={14} className="text-green-600" />
                  <span className="text-green-700">{roster.filter(b => b.status === 'attended').length}</span>
                  <span className="text-gray-400">Present</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <XCircle size={14} className="text-red-500" />
                  <span className="text-red-600">{roster.filter(b => b.status === 'no_show').length}</span>
                  <span className="text-gray-400">Missed</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Clock size={14} className="text-blue-500" />
                  <span className="text-blue-600">{roster.filter(b => b.status === 'booked').length}</span>
                  <span className="text-gray-400">Pending</span>
                </div>
              </div>
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
                          {booking.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Tooltip content="Check-in">
                            <button 
                              onClick={() => updateStatus(booking.id, 'attended')}
                              className={`p-2 rounded-lg transition-all ${booking.status === 'attended' ? 'bg-green-600 text-white shadow-md' : 'text-gray-300 hover:bg-green-50 hover:text-green-600'}`}
                            >
                              <CheckCircle size={18} />
                            </button>
                          </Tooltip>

                          <Tooltip content="Reset to Booked">
                            <button 
                              onClick={() => updateStatus(booking.id, 'booked')}
                              className={`p-2 rounded-lg transition-colors ${booking.status === 'booked' ? 'bg-blue-100 text-blue-700' : 'text-gray-300 hover:bg-blue-50 hover:text-blue-600'}`}
                            >
                              <MinusCircle size={18} />
                            </button>
                          </Tooltip>

                          <Tooltip content="Mark as Missed">
                            <button 
                              onClick={() => updateStatus(booking.id, 'no_show')}
                              className={`p-2 rounded-lg transition-colors ${booking.status === 'no_show' ? 'bg-red-600 text-white shadow-md' : 'text-gray-300 hover:bg-red-50 hover:text-red-600'}`}
                            >
                              <XCircle size={18} />
                            </button>
                          </Tooltip>
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