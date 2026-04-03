'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { Search, UserPlus, Filter, Check, X, Edit2, Award, ArrowUpDown, ChevronUp, ChevronDown, MessageCircle, Calendar } from 'lucide-react';
import AddAthleteModal from '@/components/AddAthleteModal';
import EditAthleteModal from '@/components/EditAthleteModal';
import { useToast } from '../../../components/Toast';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { formatDistanceToNow, format } from 'date-fns';
import { financialService } from '@/lib/services/financialService';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string; // Added phone for WhatsApp
  role: 'member' | 'coach' | 'manager' | 'admin';
  is_solvent: boolean;
  plan: 'unlimited' | '3x_week' | '4x_week' | '5x_week' | 'open_box' | 'crossfit_kids';
  inscription_plan: 'standard' | 'promo' | 're-entry' | 'founder';
  inscription_paid: boolean;
  created_at: string;
  avatar_url: string | null;
  bookings?: { status: string; created_at: string }[];
  last_payment_date?: string;
}

type SortKey = 'full_name' | 'is_solvent' | 'created_at' | 'plan' | 'last_payment_date';
type SortDir = 'asc' | 'desc';

export default function AthletesPage() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Sorting state
  const [sortKey, setSortKey] = useState<SortKey>('full_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Confirm dialog for solvency toggle
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    profileId: string;
    profileName: string;
    currentSolvency: boolean;
  }>({ isOpen: false, profileId: '', profileName: '', currentSolvency: false });

  // Debounce refs for plan changes
  const planTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

  // FETCH USERS — limit bookings to last 30 days
  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('profiles')
        .select(`*, bookings!left(status, created_at)`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const profilesData = data as Profile[];
      
      // Fetch last payment dates for all athletes
      const userIds = profilesData.map(p => p.id);
      const lastPaymentDates = await financialService.getLastPaymentDates(userIds);
      
      const profilesWithPayments = profilesData.map(p => ({
        ...p,
        last_payment_date: lastPaymentDates[p.id]
      }));

      setProfiles(profilesWithPayments);
    } catch (error) {
      console.error('Error fetching athletes:', error);
      toast('Failed to load athlete data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  // TOGGLE SOLVENCY — with confirmation
  const executeSolvencyToggle = async () => {
    const { profileId: id, currentSolvency: currentStatus } = confirmConfig;
    setConfirmConfig(prev => ({ ...prev, isOpen: false }));

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
      toast(
        !currentStatus ? 'Athlete access restored' : 'Athlete access revoked', 
        !currentStatus ? 'success' : 'warning'
      );

    } catch {
      toast('Failed to update status', 'error');
      fetchProfiles(); // Revert on error
    }
  };

  // CHANGE PLAN — debounced (waits 1.5s after last change)
  const changePlan = (id: string, newPlan: string) => {
    // Optimistic Update immediately
    setProfiles(prev => prev.map(p => 
      p.id === id ? { ...p, plan: newPlan as Profile['plan'] } : p
    ));

    // Clear previous timer for this profile
    if (planTimerRef.current[id]) {
      clearTimeout(planTimerRef.current[id]);
    }

    // Set new debounce timer
    planTimerRef.current[id] = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ plan: newPlan })
          .eq('id', id);

        if (error) throw error;
        toast('Plan updated', 'success');
      } catch {
        toast('Failed to update plan', 'error');
        fetchProfiles();
      }
      delete planTimerRef.current[id];
    }, 1500);
  };

  const toggleInscription = async (id: string, currentStatus: boolean) => {
   try {
     setProfiles(prev => prev.map(p => p.id === id ? { ...p, inscription_paid: !currentStatus } : p));
     const { error } = await supabase.from('profiles').update({ inscription_paid: !currentStatus }).eq('id', id);
     if (error) throw error;
     toast(
       !currentStatus ? 'Inscription marked as paid' : 'Inscription marked as unpaid',
       !currentStatus ? 'success' : 'info'
     );
   } catch {
     toast('Failed to update inscription status', 'error');
     fetchProfiles();
   }
 };

  // SORT HANDLER
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown size={12} className="ml-1 opacity-30" />;
    return sortDir === 'asc' 
      ? <ChevronUp size={12} className="ml-1 text-pits-red" /> 
      : <ChevronDown size={12} className="ml-1 text-pits-red" />;
  };

  // FILTER + SORT LOGIC
  const filteredProfiles = profiles
    .filter(profile => {
      const matchesSearch = (profile.full_name || 'Unknown').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || profile.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'full_name':
          return dir * (a.full_name || '').localeCompare(b.full_name || '');
        case 'is_solvent':
          return dir * (Number(b.is_solvent) - Number(a.is_solvent));
        case 'created_at':
          return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case 'plan':
          return dir * (a.plan || '').localeCompare(b.plan || '');
        case 'last_payment_date':
          return dir * (new Date(a.last_payment_date || 0).getTime() - new Date(b.last_payment_date || 0).getTime());
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-pits-text uppercase italic tracking-tighter">
            Roster <span className="text-gray-300">/ Atletas</span>
          </h2>
          <p className="text-pits-dim font-medium text-sm">
            Retention & Revenue Command Center.
            <span className="ml-2 text-xs text-pits-red font-bold animate-pulse">
              ● {profiles.filter(p => p.role === 'member' && !p.is_solvent).length} Unpaid
            </span>
          </p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center px-4 py-3 bg-black text-white rounded-xl font-bold uppercase text-xs tracking-widest shadow-xl hover:bg-gray-900 transition-all active:scale-95">
          <UserPlus size={18} className="mr-2" />
          Add Athlete
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
                  <th className="px-6 py-4">
                    <button onClick={() => handleSort('full_name')} className="flex items-center hover:text-pits-red transition-colors">
                      Athlete / <MessageCircle size={10} className="ml-1" /> <SortIcon column="full_name" />
                    </button>
                  </th>
                  <th className="px-6 py-4">
                     <button onClick={() => handleSort('plan')} className="flex items-center hover:text-pits-red transition-colors">
                      Plan <SortIcon column="plan" />
                    </button>
                  </th>
                  <th className="px-6 py-4">
                    <button onClick={() => handleSort('is_solvent')} className="flex items-center hover:text-pits-red transition-colors">
                      Status <SortIcon column="is_solvent" />
                    </button>
                  </th>
                  <th className="px-6 py-4 whitespace-nowrap">
                    <button onClick={() => handleSort('created_at')} className="flex items-center hover:text-pits-red transition-colors">
                      Registered <SortIcon column="created_at" />
                    </button>
                  </th>
                  <th className="px-6 py-4 whitespace-nowrap">
                    <button onClick={() => handleSort('last_payment_date')} className="flex items-center hover:text-pits-red transition-colors">
                      Last Payment <SortIcon column="last_payment_date" />
                    </button>
                  </th>
                  <th className="px-6 py-4">Utilization</th>
                  <th className="px-6 py-4">Last Visit</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProfiles.map((profile) => (
                  <tr key={profile.id} className={`transition-colors border-l-4 ${!profile.is_solvent ? 'border-l-pits-red bg-red-50/30' : 'border-l-transparent hover:bg-gray-50'}`}>
                    
                    {/* NAME + CONTACT */}
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-sm mr-3 overflow-hidden border border-gray-100">
                             {profile.avatar_url ? (
                               <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                             ) : (
                               <span>{profile.full_name?.charAt(0) || 'U'}</span>
                             )}
                          </div>
                          {profile.role !== 'member' && (
                             <div className="absolute -top-1 -right-1 w-4 h-4 bg-black border-2 border-white rounded-full flex items-center justify-center">
                               <div className="w-1.5 h-1.5 bg-white rounded-full" />
                             </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900">{profile.full_name || 'Unnamed'}</span>
                            <a 
                              href={`https://wa.me/${profile.phone?.replace(/[^0-9]/g, '')}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="p-1 text-green-500 hover:bg-green-50 rounded-md transition-colors"
                              title="Text on WhatsApp"
                            >
                              <MessageCircle size={14} />
                            </a>
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono tracking-tighter uppercase whitespace-nowrap">
                            {profile.role} • ID: {profile.id.slice(0, 5)}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* PLAN */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <select
                          value={profile.plan || 'unlimited'}
                          onChange={(e) => changePlan(profile.id, e.target.value)}
                          className="bg-transparent border-none text-gray-700 text-xs font-black p-0 focus:ring-0 uppercase cursor-pointer hover:text-pits-red transition-colors"
                        >
                          <option value="unlimited">Unlimited</option>
                          <option value="3x_week">3x / Week</option>
                          <option value="4x_week">4x / Week</option>
                          <option value="5x_week">5x / Week</option>
                          <option value="open_box">Open Box</option>
                          <option value="crossfit_kids">Kids</option>
                        </select>
                        <div className="flex items-center gap-1">
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                            profile.inscription_paid ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-orange-50 text-orange-600 border-orange-100'
                          }`}>
                            {profile.inscription_plan || 'standard'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* STATUS (Solvency) */}
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => setConfirmConfig({
                          isOpen: true,
                          profileId: profile.id,
                          profileName: profile.full_name || 'this athlete',
                          currentSolvency: profile.is_solvent
                        })}
                        className={`group relative flex items-center justify-center w-full max-w-[100px] px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all border-2 ${
                          profile.is_solvent 
                            ? 'bg-white border-green-500 text-green-600 hover:bg-green-500 hover:text-white' 
                            : 'bg-pits-red border-pits-red text-white hover:bg-black hover:border-black'
                        }`}
                      >
                        {profile.is_solvent ? 'Solvent / Paid' : 'Debt / Unpaid'}
                      </button>
                    </td>

                    {/* REGISTERED */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-700">
                          {profile.created_at ? format(new Date(profile.created_at), 'dd/MM/yyyy') : '-'}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {profile.created_at ? formatDistanceToNow(new Date(profile.created_at), { addSuffix: true }) : ''}
                        </span>
                      </div>
                    </td>

                    {/* LAST PAYMENT */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {profile.last_payment_date ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-gray-900">
                              {format(new Date(profile.last_payment_date), 'dd/MM/yyyy')}
                            </span>
                            <span className="text-[10px] text-gray-400 capitalize">
                              {formatDistanceToNow(new Date(profile.last_payment_date), { addSuffix: true })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No payments</span>
                        )}
                      </div>
                    </td>

                    {/* UTILIZATION / ATTENDANCE */}
                    <td className="px-6 py-4">
                      {(() => {
                        const attended = profile.bookings?.filter(b => b.status === 'attended').length || 0;
                        const noShow = profile.bookings?.filter(b => b.status === 'no_show').length || 0;
                        const isRisk = attended === 0 && (profile.bookings?.length || 0) > 0;
                        
                        return (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4].map(idx => (
                                <div 
                                  key={idx} 
                                  className={`w-2.5 h-2.5 rounded-full ${
                                    idx <= attended ? 'bg-green-500' : 
                                    (idx <= (attended + noShow) ? 'bg-red-500' : 'bg-gray-100')
                                  }`} 
                                />
                              ))}
                            </div>
                            <span className={`text-[10px] font-bold ${isRisk ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                              {attended} Visits (30d)
                            </span>
                          </div>
                        );
                      })()}
                    </td>

                    {/* LAST VISIT */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const lastVisit = profile.bookings
                          ?.filter(b => b.status === 'attended')
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                        
                        if (!lastVisit) return <span className="text-gray-400 text-xs italic">Never</span>;
                        
                        const date = new Date(lastVisit.created_at);
                        const days = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 3600 * 24));
                        
                        return (
                          <div className="flex items-center text-xs font-bold text-gray-700">
                             <Calendar size={12} className="mr-1.5 text-gray-400" />
                             {formatDistanceToNow(date, { addSuffix: true })}
                             {days > 10 && <span className="ml-2 w-2 h-2 bg-red-500 rounded-full" title="Inactive > 10 days" />}
                          </div>
                        );
                      })()}
                    </td>

                    {/* ACTIONS */}
                    <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => {
                            setSelectedUserId(profile.id);
                            setIsEditModalOpen(true);
                          }}
                          className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit athlete"
                        >
                          <Edit2 size={18} />
                        </button>
                      </div>
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
        onSuccess={fetchProfiles}
      />

      <EditAthleteModal 
        isOpen={isEditModalOpen} 
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUserId(null);
        }}
        onSuccess={fetchProfiles}
        userId={selectedUserId}
      />

      {/* SOLVENCY CONFIRMATION */}
      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.currentSolvency ? 'Revoke Access' : 'Restore Access'}
        message={
          confirmConfig.currentSolvency
            ? `Lock out ${confirmConfig.profileName}? They will immediately lose booking access until reactivated.`
            : `Restore access for ${confirmConfig.profileName}? They will be able to book classes again.`
        }
        confirmLabel={confirmConfig.currentSolvency ? 'Lock Out' : 'Restore'}
        variant={confirmConfig.currentSolvency ? 'danger' : 'default'}
        onConfirm={executeSolvencyToggle}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
}