import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Award } from 'lucide-react';
import { useToast } from './Toast';
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
  'block text-sm font-semibold text-pits-ink mb-1.5';
const inputClass =
  'w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm font-medium text-pits-ink placeholder:text-pits-ink-muted/60 focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary transition-all outline-none disabled:opacity-50';
const hintClass = 'text-xs text-pits-ink-muted mt-1';

export default function AddAthleteModal({ isOpen, onClose, onSuccess }: AddAthleteModalProps) {
  const { toast } = useToast();
  const { lang, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
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
    if (!isOpen) return;
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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void createAthlete();
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
        throw new Error(data.error || t('Failed to create user'));
      }

      if (data.emailWarning) {
        toast(data.emailWarning, 'warning');
      }

      if (data.whatsappWarning) {
        toast(data.whatsappWarning, 'warning');
      }

      const successKey =
        data.inviteSent === false && data.emailWarning
          ? 'User {{name}} created successfully!'
          : data.inviteSent
            ? 'User {{name}} created successfully! Invite email sent.'
            : 'User {{name}} created successfully!';
      toast(t(successKey, { name: formData.full_name }), 'success');
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
      const errorMessage = error instanceof Error ? error.message : t('Failed to create user');
      toast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-pits-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto">

        {/* Header */}
        <div className="px-6 py-4 border-b border-pits-edge flex justify-between items-center shrink-0">
          <h3 className="font-bold text-lg text-pits-ink">
            {t('Add Athlete')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="p-2 hover:bg-pits-surface-muted rounded-full text-pits-ink-muted hover:text-pits-ink transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="overflow-y-auto overflow-x-hidden p-6 flex-1 min-h-0">
        <form onSubmit={handleSubmit}>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <div>
              <label className={labelClass}>{t('Full name')}</label>
              <input
                type="text"
                required
                autoFocus
                value={formData.full_name}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>{t('Email')}</label>
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
              <label className={labelClass}>{t('Phone')}</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className={inputClass}
                placeholder="+58 412 123 4567"
              />
              <p className={hintClass}>
                {formData.role === 'member'
                  ? t('Include country code for a welcome WhatsApp when provided.')
                  : t('Include country code. A welcome WhatsApp is sent when provided.')}
              </p>
            </div>

            <div>
              <label className={labelClass}>{t('Role')}</label>
              <select
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
                className={inputClass}
              >
                <option value="member">{t('Member')}</option>
                <option value="coach">{t('Coach')}</option>
                <option value="manager">{t('Manager')}</option>
                {callerRole === 'admin' && <option value="admin">{t('Admin')}</option>}
              </select>
            </div>

            {formData.role === 'member' && (
              <div className="md:col-span-2">
                <label className={labelClass}>{t('Plan')}</label>
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
                <p className={hintClass}>{t('An invite email will be sent so they can set their password.')}</p>
              </div>
            )}

            {isStaffProfileRole(formData.role) && (
              <div>
                <label className={labelClass}>{t('Temporary password')}</label>
                <input
                  type="text"
                  required
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className={`${inputClass} font-mono`}
                />
                <p className={hintClass}>{t('Share this with the staff member.')}</p>
              </div>
            )}
          </div>

          <details className="mb-6 rounded-xl border border-pits-edge bg-pits-surface-muted/40 group">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-pits-ink list-none flex items-center justify-between">
              {t('More details')}
              <span className="text-xs font-medium text-pits-ink-muted">
                {formData.role === 'member' ? t('Inscription, discount, note') : t('Note')}
              </span>
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 px-4 pb-4 pt-1">
              {formData.role === 'member' && (
                <>
                  <div>
                    <label className={labelClass}>{t('Inscription type')}</label>
                    <select
                      value={formData.inscription_plan}
                      onChange={e => setFormData({...formData, inscription_plan: e.target.value})}
                      className={inputClass}
                    >
                      <option value="standard">{t('Standard')}</option>
                      <option value="promo">{t('Promo')}</option>
                      <option value="re-entry">{t('Re-entry')}</option>
                      <option value="founder">{t('No cost')}</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>{t('Inscription price (USD)')}</label>
                    <input
                      type="number"
                      value={formData.inscription_cost}
                      onChange={e => setFormData({...formData, inscription_cost: e.target.value})}
                      className={inputClass}
                      min="0"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>{t('Discount (%)')}</label>
                    <input
                      type="number"
                      value={formData.discount}
                      onChange={e => setFormData({...formData, discount: e.target.value})}
                      className={inputClass}
                      min="0"
                      max="100"
                    />
                  </div>

                  <label htmlFor="ins_paid" className="flex items-center gap-3 self-end p-3 rounded-lg border border-pits-edge bg-pits-surface-elevated cursor-pointer">
                    <input
                      type="checkbox"
                      id="ins_paid"
                      checked={formData.inscription_paid}
                      onChange={e => setFormData({...formData, inscription_paid: e.target.checked})}
                      className="w-4 h-4 text-pits-primary rounded border-pits-edge focus:ring-pits-primary"
                    />
                    <span className="text-sm font-medium text-pits-ink flex items-center">
                      <Award size={16} className="mr-2" />
                      {t('Inscription paid')}
                    </span>
                  </label>
                </>
              )}

              <div className="md:col-span-2">
                <label className={`${labelClass} flex justify-between`}>
                  {t('Internal note')}
                  <span className="text-pits-ink-muted font-normal">{formData.admin_note.length}/150</span>
                </label>
                <textarea
                  value={formData.admin_note}
                  onChange={e => setFormData({...formData, admin_note: e.target.value.slice(0, 150)})}
                  className={`${inputClass} resize-none h-20`}
                  maxLength={150}
                />
              </div>
            </div>
          </details>

          <button
            type="submit"
            disabled={loading || (formData.role === 'member' && !formData.plan)}
            className={`w-full py-3.5 rounded-lg flex items-center justify-center text-pits-dark-text font-bold text-sm shadow-lg transition-colors
              ${loading ? 'bg-pits-gunmetal cursor-not-allowed' : 'bg-pits-primary hover:bg-pits-primary-dark shadow-pits-primary/20'}
            `}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin mr-2" />
            ) : (
              <Save size={18} className="mr-2" />
            )}
            {loading ? t('Creating...') : t('Add Athlete')}
          </button>

        </form>
        </div>
      </div>
    </div>
  );
}
