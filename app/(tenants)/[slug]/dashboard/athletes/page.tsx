'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserPlus, Filter, Edit2, ArrowUpDown, ChevronUp, ChevronDown, MessageCircle, Calendar, Mail, Loader2, KeyRound } from 'lucide-react';
import AddAthleteModal from '@/components/AddAthleteModal';
import EditAthleteModal from '@/components/EditAthleteModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/components/LanguageContext';
import { formatDistanceToNow, format } from 'date-fns';
import { useAthletes, SortKey, SortDir } from './hooks/useAthletes';
import { Profile } from '@/lib/types/gym';

function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== column) return <ArrowUpDown size={12} className="ml-1 opacity-30" />;
  return sortDir === 'asc'
    ? <ChevronUp size={12} className="ml-1 text-pits-red" />
    : <ChevronDown size={12} className="ml-1 text-pits-red" />;
}

export default function AthletesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const {
    profiles,
    loading,
    searchTerm,
    setSearchTerm,
    roleFilter,
    setRoleFilter,
    sortKey,
    sortDir,
    handleSort,
    filteredProfiles,
    toggleSolvency,
    changePlan,
    resendWelcomeInvite,
    resendingInviteId,
    sendPasswordReset,
    sendingResetId,
    refresh
  } = useAthletes();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Confirm dialog for solvency toggle
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    profileId: string;
    profileName: string;
    currentSolvency: boolean;
  }>({ isOpen: false, profileId: '', profileName: '', currentSolvency: false });

  const [inviteConfirm, setInviteConfirm] = useState<{
    isOpen: boolean;
    profile: Profile | null;
  }>({ isOpen: false, profile: null });

  const [resetConfirm, setResetConfirm] = useState<{
    isOpen: boolean;
    profile: Profile | null;
  }>({ isOpen: false, profile: null });

  // TOGGLE SOLVENCY — with confirmation
  const executeSolvencyToggle = async () => {
    const { profileId: id, currentSolvency: currentStatus } = confirmConfig;
    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
    await toggleSolvency(id, currentStatus);
  };

  const executeResendInvite = async () => {
    const profile = inviteConfirm.profile;
    setInviteConfirm({ isOpen: false, profile: null });
    if (profile) await resendWelcomeInvite(profile);
  };

  const executeSendPasswordReset = async () => {
    const profile = resetConfirm.profile;
    setResetConfirm({ isOpen: false, profile: null });
    if (profile) await sendPasswordReset(profile);
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-pits-text uppercase italic tracking-tighter">
            {t('Roster')} <span className="text-pits-dim">/ {t('Athletes')}</span>
          </h2>
          <p className="text-pits-dim font-medium text-sm">
            {t('Retention & Revenue Command Center.')}
            <span className="ml-2 text-xs text-pits-red font-bold animate-pulse">
              ● {t('{{count}} Unpaid', { count: profiles.filter(p => p.role === 'member' && !p.is_solvent).length })}
            </span>
          </p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center px-4 py-3 bg-pits-primary text-pits-dark-text rounded-xl font-bold uppercase text-xs tracking-widest shadow-xl hover:bg-pits-primary-dark transition-all active:scale-95">
          <UserPlus size={18} className="mr-2" />
          {t('Add Athlete')}
        </button>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="bg-pits-surface-elevated p-4 rounded-xl border border-pits-edge shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pits-dim" size={20} />
          <input 
            type="text" 
            placeholder={t('Search by name...')} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm font-medium focus:ring-2 focus:ring-pits-red focus:border-transparent outline-none transition-all"
          />
        </div>
        
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter size={20} className="text-pits-dim" />
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="flex-1 md:w-48 p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm font-bold text-pits-text outline-none focus:border-pits-red"
          >
            <option value="all">{t('All Roles')}</option>
            <option value="member">{t('Members')}</option>
            <option value="coach">{t('Coaches')}</option>
            <option value="manager">{t('Managers')}</option>
            <option value="admin">{t('Admins')}</option>
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-pits-surface-elevated rounded-xl border border-pits-edge shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-pits-dim">{t('Loading roster page...')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-pits-dim uppercase bg-pits-surface-elevated font-bold tracking-wider border-b border-pits-edge">
                <tr>
                  <th className="px-6 py-4">
                    <button onClick={() => handleSort('full_name')} className="flex items-center hover:text-pits-red transition-colors">
                      {t('Athlete / Contact')} <MessageCircle size={10} className="ml-1" /> <SortIcon column="full_name" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-6 py-4">
                     <button onClick={() => handleSort('plan')} className="flex items-center hover:text-pits-red transition-colors">
                      {t('Plan')} <SortIcon column="plan" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-6 py-4">
                    <button onClick={() => handleSort('is_solvent')} className="flex items-center hover:text-pits-red transition-colors">
                      {t('Status')} <SortIcon column="is_solvent" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-6 py-4 whitespace-nowrap">
                    <button onClick={() => handleSort('created_at')} className="flex items-center hover:text-pits-red transition-colors">
                      {t('Registered')} <SortIcon column="created_at" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-6 py-4 whitespace-nowrap">
                    <button onClick={() => handleSort('last_payment_date')} className="flex items-center hover:text-pits-red transition-colors">
                      {t('Last Payment')} <SortIcon column="last_payment_date" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className="px-6 py-4">{t('Utilization')}</th>
                  <th className="px-6 py-4">{t('Last Visit')}</th>
                  <th className="px-6 py-4 text-right">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pits-edge">
                {filteredProfiles.map((profile) => (
                  <tr 
                    key={profile.id} 
                    onClick={() => router.push(`/dashboard/athletes/${profile.id}`)}
                    className={`transition-colors border-l-4 cursor-pointer ${!profile.is_solvent ? 'border-l-pits-red bg-pits-primary-soft/30 font-medium' : 'border-l-transparent hover:bg-pits-surface-muted'}`}
                  >
                    
                    {/* NAME + CONTACT */}
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-pits-surface-muted flex items-center justify-center text-pits-dim font-bold text-sm mr-3 overflow-hidden border border-pits-edge">
                             {profile.avatar_url ? (
                               <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                             ) : (
                               <span>{profile.full_name?.charAt(0) || 'U'}</span>
                             )}
                          </div>
                          {profile.role !== 'member' && (
                             <div className="absolute -top-1 -right-1 w-4 h-4 bg-black border-2 border-white rounded-full flex items-center justify-center">
                               <div className="w-1.5 h-1.5 bg-pits-surface-elevated rounded-full" />
                             </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-pits-text">{profile.full_name || t('Unnamed')}</span>
                            <a 
                              href={`https://wa.me/${profile.phone?.replace(/[^0-9]/g, '')}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="p-1 text-pits-success hover:bg-pits-primary-soft rounded-md transition-colors"
                              title={t('Text on WhatsApp')}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageCircle size={14} />
                            </a>
                          </div>
                          {profile.email ? (
                            <div className="text-[10px] text-pits-dim truncate max-w-[220px]">
                              {profile.email}
                            </div>
                          ) : null}
                          <div className="text-[10px] text-pits-dim font-mono tracking-tighter uppercase whitespace-nowrap">
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
                          onClick={(e) => e.stopPropagation()}
                          className="bg-transparent border-none text-pits-text text-xs font-black p-0 focus:ring-0 uppercase cursor-pointer hover:text-pits-red transition-colors"
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
                            profile.inscription_paid ? 'bg-pits-surface-muted text-pits-primary border-pits-edge' : 'bg-pits-primary-soft text-pits-primary border-pits-edge'
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
                          profileName: profile.full_name || t('this athlete'),
                          currentSolvency: profile.is_solvent
                        })}
                        className={`group relative flex items-center justify-center w-full max-w-[100px] px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all border-2 ${
                          profile.is_solvent 
                            ? 'bg-pits-surface-elevated border-pits-success text-pits-success hover:bg-pits-success hover:text-pits-text' 
                            : 'bg-pits-primary border-pits-primary text-pits-dark-text hover:bg-pits-primary-dark hover:border-pits-primary-dark'
                        }`}
                      >
                        {profile.is_solvent ? t('Solvent / Paid') : t('Debt / Unpaid')}
                      </button>
                    </td>

                    {/* REGISTERED */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-pits-text">
                          {profile.created_at ? format(new Date(profile.created_at), 'dd/MM/yyyy') : '-'}
                        </span>
                        <span className="text-[10px] text-pits-dim">
                          {profile.created_at ? formatDistanceToNow(new Date(profile.created_at), { addSuffix: true }) : ''}
                        </span>
                      </div>
                    </td>

                    {/* LAST PAYMENT */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {profile.last_payment_date ? (
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-pits-text">
                              {format(new Date(profile.last_payment_date), 'dd/MM/yyyy')}
                            </span>
                            <span className="text-[10px] text-pits-dim capitalize">
                              {formatDistanceToNow(new Date(profile.last_payment_date), { addSuffix: true })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-pits-dim italic">{t('No payments')}</span>
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
                                    idx <= attended ? 'bg-pits-success' : 
                                    (idx <= (attended + noShow) ? 'bg-pits-error' : 'bg-pits-surface-muted')
                                  }`} 
                                />
                              ))}
                            </div>
                            <span className={`text-[10px] font-bold ${isRisk ? 'text-pits-error animate-pulse' : 'text-pits-dim'}`}>
                              {t('{{count}} Visits (30d)', { count: attended })}
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
                        
                        if (!lastVisit) return <span className="text-pits-dim text-xs italic">{t('Never')}</span>;
                        
                        const date = new Date(lastVisit.created_at);
                        const days = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 3600 * 24));
                        
                        return (
                          <div className="flex items-center text-xs font-bold text-pits-text">
                             <Calendar size={12} className="mr-1.5 text-pits-dim" />
                             {formatDistanceToNow(date, { addSuffix: true })}
                             {days > 10 && <span className="ml-2 w-2 h-2 bg-pits-error rounded-full" title={t('Inactive > 10 days')} />}
                          </div>
                        );
                      })()}
                    </td>

                    {/* ACTIONS */}
                    <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-1">
                        {profile.role === 'member' && profile.invite_pending && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setInviteConfirm({ isOpen: true, profile });
                            }}
                            disabled={resendingInviteId === profile.id}
                            className="p-2 text-pits-dim hover:text-pits-primary hover:bg-pits-primary-soft rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={t('Resend welcome invite')}
                          >
                            {resendingInviteId === profile.id ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <Mail size={18} />
                            )}
                          </button>
                        )}
                        {profile.role === 'member' && !profile.invite_pending && profile.email && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setResetConfirm({ isOpen: true, profile });
                            }}
                            disabled={sendingResetId === profile.id}
                            className="p-2 text-pits-dim hover:text-pits-primary hover:bg-pits-primary-soft rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={t('Send password reset')}
                          >
                            {sendingResetId === profile.id ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <KeyRound size={18} />
                            )}
                          </button>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUserId(profile.id);
                            setIsEditModalOpen(true);
                          }}
                          className="p-2 text-pits-dim hover:text-pits-text hover:bg-pits-surface-muted rounded-lg transition-colors"
                          title={t('Edit athlete')}
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
        onSuccess={refresh}
      />

      <EditAthleteModal 
        isOpen={isEditModalOpen} 
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUserId(null);
        }}
        onSuccess={refresh}
        userId={selectedUserId}
      />

      {/* SOLVENCY CONFIRMATION */}
      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.currentSolvency ? t('Revoke Access') : t('Restore Access')}
        message={
          confirmConfig.currentSolvency
            ? t('Lock out confirm message', { name: confirmConfig.profileName })
            : t('Restore access confirm message', { name: confirmConfig.profileName })
        }
        confirmLabel={confirmConfig.currentSolvency ? t('Lock Out') : t('Restore')}
        variant={confirmConfig.currentSolvency ? 'danger' : 'default'}
        onConfirm={executeSolvencyToggle}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      <ConfirmDialog
        isOpen={inviteConfirm.isOpen}
        title={t('Resend welcome invite')}
        message={t('Resend welcome invite confirm message', {
          name: inviteConfirm.profile?.full_name || t('Unnamed'),
        })}
        confirmLabel={t('Resend')}
        onConfirm={executeResendInvite}
        onCancel={() => setInviteConfirm({ isOpen: false, profile: null })}
      />

      <ConfirmDialog
        isOpen={resetConfirm.isOpen}
        title={t('Send password reset')}
        message={t('Send password reset confirm message', {
          name: resetConfirm.profile?.full_name || t('Unnamed'),
        })}
        confirmLabel={t('Send reset link')}
        onConfirm={executeSendPasswordReset}
        onCancel={() => setResetConfirm({ isOpen: false, profile: null })}
      />

    </div>
  );
}