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

const labelClass =
  'block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2';
const inputClass =
  'w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm font-medium text-pits-ink placeholder:text-pits-ink-muted/60 focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary transition-all outline-none disabled:opacity-50';
const hintClass = 'text-[10px] text-pits-ink-muted mt-1';

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
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-pits-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-pits-edge flex justify-between items-center shrink-0">
          <h3 className="font-black text-lg text-pits-ink uppercase italic tracking-tighter">
            Register New Athlete
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-pits-surface-muted rounded-full text-pits-ink-muted hover:text-pits-ink transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto overflow-x-hidden p-6 sm:p-8 flex-1 min-h-0">
        <form onSubmit={handleSubmit}>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>Full Name</label>
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
              <label className={labelClass}>Email Address</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className={inputClass}
                placeholder="athlete@example.com"
              />
            </div>

            <div>
              <label className={labelClass}>Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className={inputClass}
                placeholder="+58 412 123 4567"
              />
              <p className={hintClass}>
                Include country code. A welcome WhatsApp is sent when provided.
              </p>
            </div>

            <div>
              <label className={labelClass}>Temporary Password</label>
              <input
                type="text"
                required
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                className={`${inputClass} font-mono`}
                placeholder="e.g. Pits2024!"
              />
              <p className={hintClass}>
                Share this with the athlete. They cannot change it in the app yet.
              </p>
            </div>

            <div>
              <label className={labelClass}>Role</label>
              <select
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
                className={inputClass}
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
                  <label className={labelClass}>Plan</label>
                  <select
                    value={formData.plan}
                    onChange={e => setFormData({...formData, plan: e.target.value})}
                    disabled={plansLoading || membershipPlans.length === 0}
                    className={inputClass}
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
                  <label className={labelClass}>Inscription Plan</label>
                  <select 
                    value={formData.inscription_plan} 
                    onChange={e => setFormData({...formData, inscription_plan: e.target.value})} 
                    className={inputClass}
                  >
                    <option value="standard">Standard</option>
                    <option value="promo">Promo</option>
                    <option value="re-entry">Re-Entry</option>
                    <option value="founder">No-Cost</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Inscription Price (€)</label>
                  <input 
                    type="number"
                    value={formData.inscription_cost} 
                    onChange={e => setFormData({...formData, inscription_cost: e.target.value})} 
                    placeholder="e.g. 50"
                    className={inputClass}
                    min="0"
                  />
                </div>

                <div>
                  <label className={labelClass}>Discount (%) / Optional</label>
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

                <div className="col-span-2 flex items-center p-3 bg-pits-primary-soft rounded-lg border border-pits-edge">
                  <input 
                    type="checkbox" 
                    id="ins_paid"
                    checked={formData.inscription_paid} 
                    onChange={e => setFormData({...formData, inscription_paid: e.target.checked})}
                    className="w-4 h-4 text-pits-primary rounded border-pits-edge focus:ring-pits-primary"
                  />
                  <label htmlFor="ins_paid" className="ml-3 text-sm font-bold text-pits-ink uppercase tracking-tight flex items-center">
                    <Award size={16} className="mr-2" />
                    Mark Inscription as Paid
                  </label>
                </div>
              </>
            )}

            {/* Show plan info for coaches/managers */}
            {isStaffProfileRole(formData.role) && (
              <div className="col-span-2 p-3 bg-pits-primary-soft border border-pits-edge rounded-lg">
                <p className="text-xs font-bold text-pits-primary uppercase tracking-wide">
                  Plan: Unlimited (Auto-assigned for {formData.role}s)
                </p>
              </div>
            )}

            <div className="col-span-2">
              <label className={`${labelClass} flex justify-between`}>
                Admin Note
                <span className="text-pits-ink-muted font-normal">{formData.admin_note.length}/150</span>
              </label>
              <textarea
                value={formData.admin_note}
                onChange={e => setFormData({...formData, admin_note: e.target.value.slice(0, 150)})}
                className={`${inputClass} resize-none h-20`}
                placeholder="Internal notes for this athlete..."
                maxLength={150}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || (formData.role === 'member' && !formData.plan)}
            className={`w-full py-4 rounded-lg flex items-center justify-center text-pits-dark-text font-black uppercase tracking-widest text-sm shadow-lg transition-colors
              ${loading ? 'bg-pits-gunmetal cursor-not-allowed' : 'bg-pits-primary hover:bg-pits-primary-dark shadow-pits-primary/20'}
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