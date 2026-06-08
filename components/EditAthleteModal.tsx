import React, { useState, useEffect } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import { useToast } from './Toast';
import { AthletePlan, InscriptionPlan } from '../lib/types/gym';
import { supabase } from '@/lib/supabase';
import { canAssignProfileRole, isStaffProfileRole } from '@/lib/auth';
import { useLanguage } from './LanguageContext';

const inputClass =
  'w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm font-medium text-pits-ink placeholder:text-pits-ink-muted/60 focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary transition-all outline-none disabled:opacity-50';
const inputDisabledClass =
  'w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm font-bold text-pits-dim cursor-not-allowed opacity-60';

interface EditAthleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string | null;
}

export default function EditAthleteModal({ isOpen, onClose, onSuccess, userId }: EditAthleteModalProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [loadedUserRole, setLoadedUserRole] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '', // Optional - only update if provided
    role: 'member' as 'member' | 'coach' | 'manager' | 'admin',
    plan: 'unlimited' as AthletePlan,
    inscription_plan: 'standard' as InscriptionPlan,
    inscription_paid: false,
    discount: '',
    is_solvent: true
  });

  // Fetch user data when modal opens
  useEffect(() => {
    if (isOpen && userId) {
      fetchUserData();
    } else if (!isOpen) {
      setFormData({ full_name: '', email: '', phone: '', password: '', role: 'member', plan: 'unlimited', inscription_plan: 'standard', inscription_paid: false, discount: '', is_solvent: true });
      setLoadedUserRole(null);
      setCallerRole(null);
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isOpen) return;
    const loadCallerRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      setCallerRole(profile?.role ?? null);
    };
    loadCallerRole();
  }, [isOpen]);

  useEffect(() => {
    if (isStaffProfileRole(formData.role)) {
      setFormData(prev => ({ ...prev, plan: 'unlimited' }));
    }
  }, [formData.role]);

  useEffect(() => {
    if (callerRole !== 'admin' && formData.role === 'admin' && loadedUserRole !== 'admin') {
      setFormData(prev => ({ ...prev, role: 'member' }));
    }
  }, [callerRole, formData.role, loadedUserRole]);

  const fetchUserData = async () => {
    if (!userId) return;
    
    setFetching(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch user data');
      }

      const userRole = data.role || 'member';
      setLoadedUserRole(userRole);
      setFormData({
        full_name: data.full_name || '',
        email: data.email || '',
        phone: data.phone || '',
        password: '', // Don't pre-fill password
        role: userRole,
        plan: data.plan || 'unlimited',
        inscription_plan: data.inscription_plan || 'standard',
        inscription_paid: data.inscription_paid ?? false,
        discount: data.discount !== null ? String(data.discount) : '',
        is_solvent: data.is_solvent ?? true
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load user data';
      toast(errorMessage, 'error');
      onClose();
    } finally {
      setFetching(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canAssignProfileRole(callerRole, formData.role, loadedUserRole)) {
      toast(t('Only admins can assign the admin role.'), 'error');
      return;
    }

    setLoading(true);

    try {
      const submitData = {
        ...formData,
        plan: isStaffProfileRole(formData.role)
          ? 'unlimited'
          : formData.plan
      };

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      toast(`User ${formData.full_name} updated successfully!`, 'success');
      onSuccess(); // Refresh list
      onClose();   // Close modal

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update user';
      toast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pits-background/50 backdrop-blur-sm">
      <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-pits-edge flex justify-between items-center">
          <h3 className="font-black text-lg text-pits-text uppercase italic tracking-tighter">
            Edit Athlete
          </h3>
          <button 
            onClick={onClose} 
            disabled={loading || fetching}
            className="p-2 hover:bg-pits-surface-muted rounded-full text-pits-dim hover:text-pits-ink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto overflow-x-hidden p-6">
        {fetching ? (
          <div className="p-12 text-center">
            <Loader2 size={32} className="animate-spin mx-auto text-pits-red mb-4" />
            <p className="text-sm text-pits-dim font-medium">Loading user data...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Personal Info */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-pits-text border-b border-pits-edge pb-2 mb-4">Personal Information</h4>
                <div>
              <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
                className={inputClass}
                placeholder="e.g. Mat Fraser"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                disabled
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className={inputClass}
                placeholder="athlete@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className={inputClass}
                placeholder="+1 234 567 8900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                New Password <span className="text-pits-ink-muted font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                className={`${inputClass} font-mono`}
                placeholder="Leave blank to keep current password"
              />
              <p className="text-[10px] text-pits-ink-muted mt-1">
                Only fill this if you want to change the password. Leave blank to keep the current one.
              </p>
            </div>

              </div>

              {/* Right Column: Gym Status */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-pits-text border-b border-pits-edge pb-2 mb-4">Membership Details</h4>
                <div>
              <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                Role
              </label>
              {callerRole !== 'admin' && loadedUserRole === 'admin' ? (
                <input
                  type="text"
                  disabled
                  value="Admin"
                  className={inputDisabledClass}
                />
              ) : (
                <select
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as 'member' | 'coach' | 'manager' | 'admin'})}
                  className={inputClass}
                >
                  <option value="member">Member</option>
                  <option value="coach">Coach</option>
                  <option value="manager">Manager</option>
                  {callerRole === 'admin' && <option value="admin">Admin</option>}
                </select>
              )}
            </div>

            {/* Plan selector - only show for members (athletes) */}
            {formData.role === 'member' && (
              <div>
                <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                  Plan
                </label>
                <select
                  value={formData.plan}
                  onChange={e => setFormData({...formData, plan: e.target.value as AthletePlan})}
                  className={inputClass}
                >
                  <option value="unlimited">Unlimited</option>
                  <option value="3x_week">3x / Week</option>
                  <option value="4x_week">4x / Week</option>
                  <option value="5x_week">5x / Week</option>
                  <option value="open_box">Open Box</option>
                  <option value="crossfit_kids">CrossFit Kids</option>
                </select>
              </div>
            )}


              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                    Inscription Plan
                  </label>
                  <select
                    value={formData.inscription_plan}
                    onChange={e => setFormData({...formData, inscription_plan: e.target.value as InscriptionPlan})}
                    className={inputClass}
                  >
                    <option value="standard">Standard</option>
                    <option value="promo">Promo</option>
                    <option value="re-entry">Re-Entry</option>
                    <option value="founder">Founder</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                    Discount (%) / Optional
                  </label>
                  <input 
                    type="number"
                    value={formData.discount} 
                    onChange={e => setFormData({...formData, discount: e.target.value})} 
                    placeholder="e.g. 10"
                    className={inputClass}
                    min="0"
                    max="100"
                  />
                </div>

                <div className="flex items-center mt-6 col-span-2">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.inscription_paid}
                      onChange={e => setFormData({...formData, inscription_paid: e.target.checked})}
                      className="w-5 h-5 text-pits-red border-pits-edge rounded focus:ring-pits-red focus:ring-2"
                    />
                    <div>
                      <div className="text-xs font-bold text-pits-dim uppercase tracking-wider">
                        Inscription Fee Paid
                      </div>
                    </div>
                  </label>
                </div>
              </div>

            {/* Show plan info for coaches/managers/admins */}
            {isStaffProfileRole(formData.role) && (
              <div className="p-3 bg-blue-950/40 border border-blue-900/50 rounded-lg">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-wide">
                  Plan: Unlimited (Auto-assigned for {formData.role}s)
                </p>
              </div>
            )}

            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_solvent}
                  onChange={e => setFormData({...formData, is_solvent: e.target.checked})}
                  className="w-5 h-5 text-pits-red border-pits-edge rounded focus:ring-pits-red focus:ring-2"
                />
                <div>
                  <div className="text-xs font-bold text-pits-dim uppercase tracking-wider">
                    Active Status (Solvent)
                  </div>
                  <div className="text-[10px] text-pits-ink-muted mt-0.5">
                    Active members have full access to the gym
                  </div>
                </div>
              </label>
            </div>
            </div>
            </div>

            <div className="pt-6 mt-2 border-t border-pits-edge flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 rounded-lg font-bold text-sm text-pits-dim hover:bg-pits-surface-muted mr-4 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || fetching}
                className={`px-8 py-3 rounded-lg flex items-center justify-center text-pits-dark-text font-black uppercase tracking-widest text-sm shadow-lg
                  ${loading || fetching ? 'bg-pits-gunmetal cursor-not-allowed' : 'bg-pits-primary hover:bg-pits-primary-dark shadow-pits-primary/20'}
                `}
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin mr-2" />
                ) : (
                  <Save size={18} className="mr-2" />
                )}
                {loading ? 'Updating...' : 'Update Account'}
              </button>
            </div>

          </form>
        )}
        </div>
      </div>
    </div>
  );
}

