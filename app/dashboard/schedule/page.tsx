'use client';

import { useState } from 'react';
import { Plus, Trash2, Calendar, Clock, User, X } from 'lucide-react';
import CreateClassModal from '@/components/CreateClassModal';
import { useSchedule } from './hooks/useSchedule';

export default function SchedulePage() {
  const {
    classes,
    loading,
    selectedClassId,
    setSelectedClassId,
    roster,
    loadingRoster,
    fetchSchedule,
    deleteClass
  } = useSchedule();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

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
          className="flex items-center justify-center px-4 py-3 bg-pits-red text-white rounded-lg font-bold uppercase text-xs tracking-widest shadow-lg shadow-red-200 hover:bg-pits-red-dark transition-all"
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
              
              const startDateStr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(startDate);
              const todayStr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
              const isToday = startDateStr === todayStr;

              const dayStr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', weekday: 'short' }).format(startDate);
              const dateNumStr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', day: 'numeric' }).format(startDate);
              const timeStr = startDate.toLocaleTimeString('en-US', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' });

              return (
                <div key={session.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  
                  {/* Left: Date & Time */}
                  <div className="flex items-start gap-4">
                    <div className={`
                      flex flex-col items-center justify-center w-16 h-16 rounded-lg border
                      ${isToday ? 'bg-red-50 border-red-200 text-pits-red' : 'bg-gray-50 border-gray-200 text-gray-500'}
                    `}>
                      <span className="text-xs font-bold uppercase">{dayStr}</span>
                      <span className="text-xl font-black">{dateNumStr}</span>
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
                            {timeStr}
                          </span>
                       </div>
                       <h4 className="text-lg font-black text-pits-text uppercase italic">
                         {session.class_type}
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
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setSelectedClassId(session.id);
                          setIsDetailsModalOpen(true);
                        }}
                        className="p-3 text-pits-red hover:bg-red-50 shadow-sm rounded-lg transition-colors font-bold text-xs"
                      >
                        DETAILS
                      </button>
                      <button 
                        onClick={() => deleteClass(session.id)}
                        className="p-3 text-gray-400 hover:text-pits-red hover:bg-red-50 rounded-lg transition-colors"
                        title="Cancel Class"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
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

      {/* DETAILS MODAL */}
      {isDetailsModalOpen && selectedClassId && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setIsDetailsModalOpen(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h3 className="text-xl font-black text-pits-text uppercase italic">Class Details</h3>
              <button 
                onClick={() => setIsDetailsModalOpen(false)}
                className="p-1 rounded bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {(() => {
                const cls = classes.find(c => c.id === selectedClassId);
                if (!cls) return null;
                return (
                  <div className="space-y-6">
                    {/* Class Info */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Type</p>
                        <p className="font-bold text-pits-text text-sm">{cls.class_type}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Time</p>
                        <p className="font-bold text-pits-text text-sm">
                          {new Date(cls.start_time).toLocaleTimeString('en-US', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Coach</p>
                        <p className="font-bold text-pits-text text-sm">{cls.coach?.full_name || 'Staff'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Capacity</p>
                        <p className="font-bold text-pits-text text-sm">{cls.bookings[0]?.count || 0} / {cls.max_capacity}</p>
                      </div>
                    </div>

                    {/* Roster */}
                    <div>
                      <h4 className="text-xs font-black text-pits-dim uppercase tracking-wider mb-3">Athletes</h4>
                      {loadingRoster ? (
                        <p className="text-gray-400 text-sm p-4 bg-gray-50 rounded-lg text-center font-medium">Loading roster...</p>
                      ) : roster.length === 0 ? (
                        <p className="text-gray-400 text-sm p-4 bg-gray-50 rounded-lg text-center font-medium">No bookings yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {roster.map(booking => (
                            <div key={booking.id} className="flex justify-between items-center p-3 rounded-lg border border-gray-100 bg-white shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 overflow-hidden">
                                  {booking.profiles.avatar_url ? (
                                    <img src={booking.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    booking.profiles.full_name?.charAt(0)
                                  )}
                                </div>
                                <span className="font-bold text-pits-text text-sm">{booking.profiles.full_name}</span>
                              </div>
                              <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wide
                                ${booking.status === 'attended' ? 'bg-green-100 text-green-700' : 
                                  booking.status === 'no_show' ? 'bg-red-100 text-red-700' :
                                  'bg-blue-100 text-blue-700'}
                              `}>
                                {booking.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-6 py-2 bg-white border border-gray-200 text-pits-text font-bold text-sm rounded-lg hover:bg-gray-100 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}