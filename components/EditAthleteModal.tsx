import React, { useState, useEffect } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import { useToast } from './Toast';
import { AthletePlan, InscriptionPlan } from '../lib/types/gym';

interface EditAthleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string | null;
}

export default function EditAthleteModal({ isOpen, onClose, onSuccess, userId }: EditAthleteModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
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
      // Reset form when modal closes
      setFormData({ full_name: '', email: '', phone: '', password: '', role: 'member', plan: 'unlimited', inscription_plan: 'standard', inscription_paid: false, discount: '', is_solvent: true });
    }
  }, [isOpen, userId]);

  // Automatically set plan to 'unlimited' when role is 'coach' or 'manager'
  useEffect(() => {
    if (formData.role === 'coach' || formData.role === 'manager' || formData.role === 'admin') {
      setFormData(prev => ({ ...prev, plan: 'unlimited' }));
    }
  }, [formData.role]);

  const fetchUserData = async () => {
    if (!userId) return;
    
    setFetching(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch user data');
      }

      setFormData({
        full_name: data.full_name || '',
        email: data.email || '',
        phone: data.phone || '',
        password: '', // Don't pre-fill password
        role: data.role || 'member',
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
    setLoading(true);

    try {
      // Ensure plan is always set: 'unlimited' for coaches/managers/admins, or selected plan for members
      const submitData = {
        ...formData,
        plan: formData.role === 'coach' || formData.role === 'manager' || formData.role === 'admin'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-black text-lg text-pits-text uppercase italic tracking-tighter">
            Edit Athlete
          </h3>
          <button 
            onClick={onClose} 
            disabled={loading || fetching}
            className="p-2 hover:bg-gray-200 rounded-full text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto overflow-x-hidden p-6">
        {fetching ? (
          <div className="p-12 text-center">
            <Loader2 size={32} className="animate-spin mx-auto text-pits-red mb-4" />
            <p className="text-sm text-gray-500 font-medium">Loading user data...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Personal Info */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-pits-text border-b pb-2 mb-4">Personal Information</h4>
                <div>
              <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                Full Name
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-pits-red outline-none"
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
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-pits-red outline-none"
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
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-pits-red outline-none"
                placeholder="+1 234 567 8900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                New Password <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-pits-red outline-none font-mono"
                placeholder="Leave blank to keep current password"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Only fill this if you want to change the password. Leave blank to keep the current one.
              </p>
            </div>

              </div>

              {/* Right Column: Gym Status */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-pits-text border-b pb-2 mb-4">Membership Details</h4>
                <div>
              <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                Role
              </label>
              <select
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value as 'member' | 'coach' | 'manager' | 'admin'})}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-pits-red outline-none"
              >
                <option value="member">Member</option>
                <option value="coach">Coach</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
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
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-pits-red outline-none"
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
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-pits-red outline-none"
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
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-pits-red outline-none"
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
                      className="w-5 h-5 text-pits-red border-gray-300 rounded focus:ring-pits-red focus:ring-2"
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
            {(formData.role === 'coach' || formData.role === 'manager' || formData.role === 'admin') && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">
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
                  className="w-5 h-5 text-pits-red border-gray-300 rounded focus:ring-pits-red focus:ring-2"
                />
                <div>
                  <div className="text-xs font-bold text-pits-dim uppercase tracking-wider">
                    Active Status (Solvent)
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    Active members have full access to the gym
                  </div>
                </div>
              </label>
            </div>
            </div>
            </div>

            <div className="pt-6 mt-2 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 rounded-lg font-bold text-sm text-gray-500 hover:bg-gray-100 mr-4"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || fetching}
                className={`px-8 py-3 rounded-lg flex items-center justify-center text-white font-black uppercase tracking-widest text-sm shadow-lg
                  ${loading || fetching ? 'bg-gray-400 cursor-not-allowed' : 'bg-pits-red hover:bg-pits-red-dark shadow-red-200'}
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

