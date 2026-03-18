'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Search, UserPlus, Filter, Check, X, Edit2, Award } from 'lucide-react';
import AddAthleteModal from '@/components/AddAthleteModal';
import EditAthleteModal from '@/components/EditAthleteModal';

interface Profile {
  id: string;
  full_name: string;
  email: string; // Note: We might need to join auth.users to get email properly, but for now we rely on what's in profiles or fetch differently. 
  // *Correction*: Supabase profiles table usually doesn't have email unless we synced it. 
  // For this view, we'll assume we might need to fetch it or just show names.
  // To keep it simple and robust based on your schema, we'll focus on full_name and role.
  role: 'member' | 'coach' | 'manager' | 'admin';
  is_solvent: boolean;
  plan: 'unlimited' | '3x_week' | '4x_week' | '5x_week' | 'open_box' | 'crossfit_kids';
  inscription_plan: 'standard' | 'promo' | 're-entry' | 'founder';
  inscription_paid: boolean;
  created_at: string;
  avatar_url: string | null;
  bookings?: { status: string }[];
}

export default function AthletesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // FETCH USERS
  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`*, bookings(status)`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles(data as Profile[]);
    } catch (error) {
      console.error('Error fetching athletes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  // TOGGLE SOLVENCY
  const toggleSolvency = async (id: string, currentStatus: boolean) => {
    try {
      // Optimistic Update
      setProfiles(prev => prev.map(p => 
        p.id === id ? { ...p, is_solvent: !currentStatus } : p
      ));

      const { error } = await supabase
        .from('profiles')
        .update({ is_solvent: !currentStatus })
        .eq('id', id);

      if (error) throw error;

    } catch {
      alert('Failed to update status');
      fetchProfiles(); // Revert on error
    }
  };

  // CHANGE PLAN
  const changePlan = async (id: string, newPlan: string) => {
    try {
      // Optimistic Update
      setProfiles(prev => prev.map(p => 
        p.id === id ? { ...p, plan: newPlan as Profile['plan'] } : p
      ));

      const { error } = await supabase
        .from('profiles')
        .update({ plan: newPlan })
        .eq('id', id);

      if (error) throw error;
    } catch {
      alert('Failed to update plan');
      fetchProfiles(); // Revert on error
    }
  };

  const toggleInscription = async (id: string, currentStatus: boolean) => {
   try {
     setProfiles(prev => prev.map(p => p.id === id ? { ...p, inscription_paid: !currentStatus } : p));
     const { error } = await supabase.from('profiles').update({ inscription_paid: !currentStatus }).eq('id', id);
     if (error) throw error;
   } catch (error) {
     alert('Failed to update inscription status');
     fetchProfiles();
   }
 };

  // FILTER LOGIC
  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = (profile.full_name || 'Unknown').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || profile.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-pits-text uppercase italic tracking-tighter">
            Athletes
          </h2>
          <p className="text-pits-dim font-medium text-sm">
            Manage members, plans, and access permissions.
          </p>
        </div>
        <button 
         onClick={() => setIsAddModalOpen(true)}
        className="flex items-center justify-center px-4 py-3 bg-pits-red text-white rounded-lg font-bold uppercase text-xs tracking-widest shadow-lg shadow-red-200 hover:bg-pits-red-dark transition-all">
          <UserPlus size={18} className="mr-2" />
          Add New Athlete
        </button>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search by name..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-pits-red focus:border-transparent outline-none transition-all"
          />
        </div>
        
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter size={20} className="text-gray-400" />
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="flex-1 md:w-48 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-pits-red"
          >
            <option value="all">All Roles</option>
            <option value="member">Members</option>
            <option value="coach">Coaches</option>
            <option value="manager">Managers</option>
            <option value="admin">Admins</option>
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading roster...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 font-bold tracking-wider border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Athlete</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Plan</th>
                  <th className="px-6 py-4">Inscription</th>
                  <th className="px-6 py-4">
                    Attendance
                    <div className="text-[10px] text-gray-500 font-medium normal-case mt-0.5 tracking-normal">
                      <span className="text-green-600 font-bold">A</span> / <span className="text-blue-600 font-bold">R</span> / <span className="text-red-600 font-bold">N</span>
                    </div>
                  </th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProfiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-gray-50 transition-colors">
                    
                    {/* NAME */}
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-sm mr-3 overflow-hidden border border-gray-100">
                           {profile.avatar_url ? (
                             <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                           ) : (
                             <span>{profile.full_name?.charAt(0) || 'U'}</span>
                           )}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{profile.full_name || 'Unnamed Athlete'}</div>
                          <div className="text-xs text-gray-400 font-mono">{profile.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>

                    {/* ROLE */}
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider border ${
                        profile.role === 'admin' ? 'bg-black text-white border-black' :
                        profile.role === 'coach' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        profile.role === 'manager' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                        'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        {profile.role}
                      </span>
                    </td>

                    {/* PLAN SELECTOR */}
                    <td className="px-6 py-4">
                      <select
                        value={profile.plan || 'unlimited'}
                        onChange={(e) => changePlan(profile.id, e.target.value)}
                        className="bg-white border border-gray-300 text-gray-700 text-xs rounded-lg focus:ring-pits-red focus:border-pits-red block w-full p-2 font-bold uppercase"
                      >
                        <option value="unlimited">Unlimited</option>
                        <option value="3x_week">3x / Week</option>
                        <option value="4x_week">4x / Week</option>
                        <option value="5x_week">5x / Week</option>
                        <option value="open_box">Open Box</option>
                        <option value="crossfit_kids">CrossFit Kids</option>
                      </select>
                    </td>

                    {/* Inscription Plan & Payment Status */}
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleInscription(profile.id, profile.inscription_paid)}
                        className={`group flex flex-col items-start px-3 py-2 rounded-lg border transition-all w-32 ${
                          profile.inscription_paid 
                            ? 'bg-blue-50 border-blue-200 text-blue-700' 
                            : 'bg-orange-50 border-orange-200 text-orange-700'
                        }`}
                      >
                        <div className="flex items-center w-full justify-between">
                          <span className="text-[9px] font-black uppercase tracking-tighter opacity-70">
                            {profile.inscription_plan || 'standard'}
                          </span>
                          <Award size={10} />
                        </div>
                        <span className="text-[10px] font-black uppercase">
                          {profile.inscription_paid ? 'Paid' : 'Unpaid'}
                        </span>
                      </button>
                    </td>

                    {/* ATTENDANCE */}
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1.5 font-bold text-sm bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg w-fit shadow-sm">
                        <span className="text-green-600" title="Assisted">{profile.bookings?.filter(b => b.status === 'attended').length || 0}</span>
                        <span className="text-gray-300 font-light">/</span>
                        <span className="text-blue-600" title="Reserved">{profile.bookings?.filter(b => b.status === 'booked').length || 0}</span>
                        <span className="text-gray-300 font-light">/</span>
                        <span className="text-red-600" title="No Show">{profile.bookings?.filter(b => b.status === 'no_show').length || 0}</span>
                      </div>
                    </td>

                    {/* SOLVENCY TOGGLE */}
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => toggleSolvency(profile.id, profile.is_solvent)}
                        className={`flex items-center px-3 py-1.5 rounded-full border transition-all ${
                          profile.is_solvent 
                            ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                            : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                        }`}
                      >
                        {profile.is_solvent ? (
                          <>
                            <Check size={14} className="mr-1.5" />
                            <span className="text-xs font-bold uppercase tracking-wide">Active</span>
                          </>
                        ) : (
                          <>
                            <X size={14} className="mr-1.5" />
                            <span className="text-xs font-bold uppercase tracking-wide">Inactive</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* DATE */}
                    <td className="px-6 py-4 text-gray-500 font-medium">
                      {new Date(profile.created_at).toLocaleDateString()}
                    </td>

                    {/* ACTIONS */}
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => {
                          setSelectedUserId(profile.id);
                          setIsEditModalOpen(true);
                        }}
                        className="p-2 text-gray-400 hover:text-pits-red hover:bg-red-50 rounded-lg transition-colors"
                        title="Edit athlete"
                      >
                        <Edit2 size={18} />
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddAthleteModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchProfiles} // Refresh list on success
      />

      <EditAthleteModal 
        isOpen={isEditModalOpen} 
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUserId(null);
        }}
        onSuccess={fetchProfiles} // Refresh list on success
        userId={selectedUserId}
      />

    </div>
  );
}