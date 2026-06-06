import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Award } from 'lucide-react';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import { useLanguage } from './LanguageContext';
import { supabase } from '@/lib/supabase';
import { canAssignProfileRole, isStaffProfileRole } from '@/lib/auth';
import { membershipPlanService } from '@/lib/services/membershipPlanService';
import { MembershipPlan } from '@/lib/types/gym';

interface AddAthleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}


export default function AddAthleteModal({ isOpen, onClose, onSuccess }: AddAthleteModalProps) {
  const { toast } = useToast();
  const { lang, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'member',
    plan: '',
    inscription_plan: 'standard',
    inscription_cost: '50',
    inscription_paid: false,
    discount: '',
    admin_note: ''
  });

  useEffect(() => {
    if (isStaffProfileRole(formData.role)) {
      setFormData(prev =>
        prev.plan === 'unlimited' ? prev : { ...prev, plan: 'unlimited' }
      );
      return;
    }
    if (membershipPlans.length === 0) return;
    setFormData(prev => {
      if (membershipPlans.some((p) => p.id === prev.plan)) return prev;
      return { ...prev, plan: membershipPlans[0].id };
    });
  }, [formData.role, membershipPlans]);

  useEffect(() => {
    if (!isOpen) {
      setShowConfirm(false);
      return;
    }
    const loadContext = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, tenant_id')
        .eq('id', user.id)
        .single();
      setCallerRole(profile?.role ?? null);

      if (!profile?.tenant_id) return;

      setPlansLoading(true);
      try {
        const plans = await membershipPlanService.getActiveMembershipPlans(profile.tenant_id);
        setMembershipPlans(plans);
        if (plans.length > 0) {
          setFormData(prev => ({
            ...prev,
            plan: plans.some((p) => p.id === prev.plan) ? prev.plan : plans[0].id,
          }));
        }
      } catch (error) {
        console.error(error);
        toast(t('Failed to load membership plans'), 'error');
      } finally {
        setPlansLoading(false);
      }
    };
    loadContext();
  }, [isOpen, toast, t]);

  useEffect(() => {
    if (callerRole !== 'admin' && formData.role === 'admin') {
      setFormData(prev => ({ ...prev, role: 'member' }));
    }
  }, [callerRole, formData.role]);

  useEffect(() => {
    if (!isOpen) setShowConfirm(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const createAthlete = async () => {
    if (!canAssignProfileRole(callerRole, formData.role)) {
      toast(t('Only admins can assign the admin role.'), 'error');
      return;
    }

    if (formData.role === 'member' && !formData.plan) {
      toast(t('Failed to load membership plans'), 'error');
      return;
    }

    setShowConfirm(false);
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        language: lang,
        plan: isStaffProfileRole(formData.role)
          ? 'unlimited'
          : formData.plan,
      };

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      if (data.whatsappWarning) {
        toast(data.whatsappWarning, 'warning');
      }

      toast(`User ${formData.full_name} created successfully!`, 'success');
      onSuccess();
      onClose();
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        password: '',
        role: 'member',
        plan: membershipPlans[0]?.id ?? '',
        inscription_plan: 'standard',
        inscription_cost: '50',
        inscription_paid: false,
        discount: '',
        admin_note: '',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create user';
      toast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = membershipPlans.find((p) => p.id === formData.plan);
  const planLabel = isStaffProfileRole(formData.role)
    ? 'Unlimited'
    : selectedPlan?.name ?? formData.plan;

  const confirmMessage =
    formData.role === 'member'
      ? `Create account for ${formData.full_name} (${formData.email}) as a Member with ${planLabel} plan?`
      : `Create account for ${formData.full_name} (${formData.email}) as a ${formData.role.charAt(0).toUpperCase() + formData.role.slice(1)}?`;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-pits-surface-elevated rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto">
        
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
          <h3 className="font-black text-lg text-pits-text uppercase italic tracking-tighter">
            Register New Athlete
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto overflow-x-hidden p-6 sm:p-8 flex-1 min-h-0">
        <form onSubmit={handleSubmit}>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
                placeholder="+58 412 123 4567"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Include country code. A welcome WhatsApp is sent when provided.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                Temporary Password
              </label>
              <input
                type="text"
                required
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-pits-red outline-none font-mono"
                placeholder="e.g. Pits2024!"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Share this with the athlete. They cannot change it in the app yet.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                Role
              </label>
              <select
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-pits-red outline-none"
              >
                <option value="member">Member</option>
                <option value="coach">Coach</option>
                <option value="manager">Manager</option>
                {callerRole === 'admin' && <option value="admin">Admin</option>}
              </select>
            </div>

            {/* Plan selector - only show for members (athletes) */}
            {formData.role === 'member' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                    Plan
                  </label>
                  <select
                    value={formData.plan}
                    onChange={e => setFormData({...formData, plan: e.target.value})}
                    disabled={plansLoading || membershipPlans.length === 0}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-pits-red outline-none disabled:opacity-50"
                  >
                    {plansLoading ? (
                      <option value="">{t('Loading...')}</option>
                    ) : membershipPlans.length === 0 ? (
                      <option value="">{t('No records found.')}</option>
                    ) : (
                      membershipPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                          {plan.weekly_limit === null
                            ? ` (${t('Unlimited')})`
                            : ` (${plan.weekly_limit}x / ${t('Week')})`}
                          {` — $${plan.price_usd.toFixed(2)}`}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                    Inscription Plan
                  </label>
                  <select 
                    value={formData.inscription_plan} 
                    onChange={e => setFormData({...formData, inscription_plan: e.target.value})} 
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-pits-red outline-none"
                  >
                    <option value="standard">Standard</option>
                    <option value="promo">Promo</option>
                    <option value="re-entry">Re-Entry</option>
                    <option value="founder">No-Cost</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
                    Inscription Price (€)
                  </label>
                  <input 
                    type="number"
                    value={formData.inscription_cost} 
                    onChange={e => setFormData({...formData, inscription_cost: e.target.value})} 
                    placeholder="e.g. 50"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-pits-red outline-none"
                    min="0"
                  />
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

                <div className="col-span-2 flex items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <input 
                    type="checkbox" 
                    id="ins_paid"
                    checked={formData.inscription_paid} 
                    onChange={e => setFormData({...formData, inscription_paid: e.target.checked})}
                    className="w-4 h-4 text-pits-red rounded border-gray-300 focus:ring-pits-red"
                  />
                  <label htmlFor="ins_paid" className="ml-3 text-sm font-bold text-blue-800 uppercase tracking-tight flex items-center">
                    <Award size={16} className="mr-2" />
                    Mark Inscription as Paid
                  </label>
                </div>
              </>
            )}

            {/* Show plan info for coaches/managers */}
            {isStaffProfileRole(formData.role) && (
              <div className="col-span-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                  Plan: Unlimited (Auto-assigned for {formData.role}s)
                </p>
              </div>
            )}

            <div className="col-span-2">
              <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2 flex justify-between">
                Admin Note
                <span className="text-gray-400 font-normal">{formData.admin_note.length}/150</span>
              </label>
              <textarea
                value={formData.admin_note}
                onChange={e => setFormData({...formData, admin_note: e.target.value.slice(0, 150)})}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-pits-red outline-none resize-none h-20"
                placeholder="Internal notes for this athlete..."
                maxLength={150}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || (formData.role === 'member' && !formData.plan)}
            className={`w-full py-4 rounded-lg flex items-center justify-center text-pits-dark-text font-black uppercase tracking-widest text-sm shadow-lg
              ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-pits-primary hover:bg-pits-primary-dark shadow-pits-primary/20'}
            `}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin mr-2" />
            ) : (
              <Save size={18} className="mr-2" />
            )}
            {loading ? 'Creating...' : 'Create Account'}
          </button>

        </form>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        title="Create Athlete?"
        message={confirmMessage}
        confirmLabel="Create Account"
        onConfirm={createAthlete}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}