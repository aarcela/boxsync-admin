'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  Tags,
  CheckCircle2,
  XCircle,
  Zap,
  Info,
  Users,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useLanguage } from '@/components/LanguageContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import { membershipPlanService } from '@/lib/services/membershipPlanService';
import { MembershipPlanWithUsage, PlanLimitType } from '@/lib/types/gym';
import {
  createMembershipPlanAction,
  updateMembershipPlanAction,
  deleteMembershipPlanAction,
  toggleMembershipPlanStatusAction,
} from './actions';

export default function MembershipPlansPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<MembershipPlanWithUsage[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlanWithUsage | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [planToDelete, setPlanToDelete] = useState<MembershipPlanWithUsage | null>(null);

  const isAdmin = callerRole === 'admin';

  const [formData, setFormData] = useState({
    name: '',
    price_usd: '',
    description: '',
    limit_type: 'none' as PlanLimitType,
    weekly_limit: '',
    session_limit: '',
    validity_days: '',
    is_active: true,
  });

  useEffect(() => {
    const loadContext = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, tenant_id')
        .eq('id', user.id)
        .single();

      setCallerRole(profile?.role ?? null);
      setTenantId(profile?.tenant_id ?? null);
    };

    loadContext();
  }, []);

  useEffect(() => {
    if (!tenantId) {
      if (callerRole !== null) setLoading(false);
      return;
    }

    let cancelled = false;

    const loadPlans = async () => {
      setLoading(true);
      try {
        const data = await membershipPlanService.getMembershipPlansWithUsage(tenantId);
        if (!cancelled) setPlans(data);
      } catch (err) {
        console.error(err);
        if (!cancelled) toast(t('Failed to load membership plans'), 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPlans();

    return () => {
      cancelled = true;
    };
  }, [tenantId, callerRole, toast, t]);

  const reloadPlans = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await membershipPlanService.getMembershipPlansWithUsage(tenantId);
      setPlans(data);
    } catch (err) {
      console.error(err);
      toast(t('Failed to load membership plans'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (plan?: MembershipPlanWithUsage) => {
    if (!isAdmin) return;

    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        price_usd: String(plan.price_usd),
        description: plan.description || '',
        limit_type: plan.limit_type ?? (plan.weekly_limit != null ? 'weekly' : 'none'),
        weekly_limit: plan.weekly_limit === null ? '' : String(plan.weekly_limit),
        session_limit: plan.session_limit != null ? String(plan.session_limit) : '',
        validity_days: plan.validity_days != null ? String(plan.validity_days) : '',
        is_active: plan.is_active,
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: '',
        price_usd: '',
        description: '',
        limit_type: 'none',
        weekly_limit: '',
        session_limit: '',
        validity_days: '',
        is_active: true,
      });
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !formData.name) return;

    startTransition(async () => {
      try {
        const form = new FormData();
        form.append('name', formData.name);
        form.append('price_usd', formData.price_usd);
        form.append('description', formData.description);
        form.append('limit_type', formData.limit_type);
        form.append('weekly_limit', formData.weekly_limit);
        form.append('session_limit', formData.session_limit);
        form.append('validity_days', formData.validity_days);
        form.append('is_active', String(formData.is_active));
        if (editingPlan) {
           await updateMembershipPlanAction(editingPlan.id, form);
           toast(t('Membership plan updated'), 'success');
         } else {
          await createMembershipPlanAction(form);
          toast(t('Membership plan created'), 'success');
        }

        setIsFormOpen(false);
        reloadPlans();
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'Plan in use by athletes') {
          toast(t('Cannot delete plan assigned to athletes'), 'error');
        } else if (message === 'Weekly limit required' || message === 'Session limit and validity days required') {
          toast(t('Invalid plan limits'), 'error');
        } else if (message === 'Only admins can manage membership plans.') {
          toast(t('Only admins can manage membership plans.'), 'error');
        } else {
          toast(t('Action failed'), 'error');
        }
      }
    });
  };

  const handleDelete = async () => {
    if (!planToDelete || !isAdmin) return;
    if (planToDelete.member_count > 0) {
      toast(t('Cannot delete plan assigned to athletes'), 'error');
      setPlanToDelete(null);
      return;
    }

    startTransition(async () => {
      try {
        await deleteMembershipPlanAction(planToDelete.id);
        toast(t('Membership plan deleted'), 'success');
        setPlanToDelete(null);
        reloadPlans();
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message === 'Plan in use by athletes') {
          toast(t('Cannot delete plan assigned to athletes'), 'error');
        } else {
          toast(t('Delete failed'), 'error');
        }
        setPlanToDelete(null);
      }
    });
  };

  const handleToggleStatus = async (plan: MembershipPlanWithUsage) => {
    if (!isAdmin) return;

    startTransition(async () => {
      try {
        await toggleMembershipPlanStatusAction(plan.id, !plan.is_active);
        toast(t('Status updated'), 'success');
        reloadPlans();
      } catch {
        toast(t('Toggle failed'), 'error');
      }
    });
  };

  const filteredPlans = plans.filter(
    (plan) =>
      plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatBookingLimit = (plan: MembershipPlanWithUsage) => {
    const limitType = plan.limit_type ?? (plan.weekly_limit != null ? 'weekly' : 'none');
    if (limitType === 'weekly' && plan.weekly_limit != null) {
      return `${plan.weekly_limit}x / ${t('Week')}`;
    }
    if (limitType === 'period' && plan.session_limit != null && plan.validity_days != null) {
      return `${plan.session_limit} ${t('sessions')} / ${plan.validity_days} ${t('days')}`;
    }
    return t('Unlimited');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-0">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-pits-edge">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-pits-ink tracking-tighter uppercase">
              {t('Membership Plans')}
            </h1>
            <div className="bg-pits-primary/50 px-2 py-0.5 rounded text-[10px] font-bold text-pits-dark-text border border-pits-primary-dark tracking-widest uppercase shadow-sm">
              {t('System Config')}
            </div>
          </div>
          <p className="text-pits-dim text-xs font-semibold mt-1 tracking-wide uppercase">
            {t('Manage membership plans and pricing for your box')}
          </p>
          {!isAdmin && callerRole && (
            <p className="text-[10px] font-bold text-pits-secondary uppercase mt-2">
              {t('Only admins can manage membership plans.')}
            </p>
          )}
        </div>

        {isAdmin && (
          <button
            onClick={() => handleOpenForm()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-pits-primary text-pits-dark-text rounded-2xl text-[11px] font-black uppercase shadow-lg shadow-pits-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus size={18} />
            {t('Add Plan')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm overflow-hidden min-h-[400px]">
            <div className="px-6 py-4 border-b border-pits-edge flex flex-col md:flex-row justify-between gap-4">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim"
                  size={16}
                />
                <input
                  type="text"
                  placeholder={t('Search plans...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-pits-surface-muted border border-pits-edge rounded-xl text-[10px] font-bold uppercase text-pits-ink placeholder:text-pits-dim outline-none focus:ring-2 focus:ring-pits-red transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-pits-surface-muted/60">
                  <tr>
                    <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">
                      {t('Plan Name')}
                    </th>
                    <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">
                      {t('Price (USD)')}
                    </th>
                    <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">
                      {t('Booking Limit')}
                    </th>
                    <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">
                      {t('Athletes')}
                    </th>
                    <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">
                      {t('Status')}
                    </th>
                    {isAdmin && (
                      <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest text-right">
                        {t('Actions')}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-pits-edge">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={isAdmin ? 6 : 5}
                        className="py-20 text-center text-pits-dim font-bold uppercase animate-pulse"
                      >
                        {t('Initializing Data Stream...')}
                      </td>
                    </tr>
                  ) : (
                    filteredPlans.map((plan) => (
                      <tr
                        key={plan.id}
                        className="hover:bg-pits-surface-muted/40 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-xl ${plan.is_active ? 'bg-pits-primary text-pits-dark-text' : 'bg-pits-surface-muted text-pits-dim'}`}
                            >
                              <Tags size={16} />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-pits-ink uppercase tracking-tight">
                                {plan.name}
                              </div>
                              <div className="text-[10px] text-pits-dim font-medium truncate max-w-[220px]">
                                {plan.description || t('No details provided')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-black text-pits-ink">
                            ${plan.price_usd.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded text-[9px] font-black uppercase border bg-pits-surface-muted text-pits-ink border-pits-edge">
                            {formatBookingLimit(plan)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-pits-dim uppercase">
                            <Users size={12} />
                            {plan.member_count}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {isAdmin ? (
                            <button
                              onClick={() => handleToggleStatus(plan)}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-black uppercase border transition-all ${plan.is_active ? 'bg-pits-primary-soft text-pits-success border-pits-success/30' : 'bg-pits-surface-muted text-pits-dim border-pits-edge'}`}
                            >
                              {plan.is_active ? (
                                <CheckCircle2 size={10} />
                              ) : (
                                <XCircle size={10} />
                              )}
                              {plan.is_active ? t('Active') : t('Inactive')}
                            </button>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-black uppercase border ${plan.is_active ? 'bg-pits-primary-soft text-pits-success border-pits-success/30' : 'bg-pits-surface-muted text-pits-dim border-pits-edge'}`}
                            >
                              {plan.is_active ? t('Active') : t('Inactive')}
                            </span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenForm(plan)}
                                className="p-2 text-pits-dim hover:text-pits-ink hover:bg-pits-surface-muted rounded-lg transition-all"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => setPlanToDelete(plan)}
                                className="p-2 text-pits-dim hover:text-pits-error hover:bg-pits-primary-soft rounded-lg transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                  {!loading && filteredPlans.length === 0 && (
                    <tr>
                      <td
                        colSpan={isAdmin ? 6 : 5}
                        className="py-20 text-center text-pits-dim font-bold uppercase"
                      >
                        {t('No records found.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-pits-surface-muted rounded-3xl p-6 shadow-xl border border-pits-edge relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Tags size={80} className="text-pits-ink" />
            </div>
            <div className="relative z-10">
              <h3 className="text-sm font-black text-pits-ink uppercase tracking-tighter mb-4 flex items-center gap-2">
                <Zap size={18} className="text-pits-red" /> {t('Strategic Overview')}
              </h3>
              <p className="text-pits-ink-muted text-[11px] font-medium leading-relaxed mb-6">
                {t('Define plan pricing, weekly class limits, and availability for athlete subscriptions.')}
              </p>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-pits-surface-elevated rounded-2xl border border-pits-edge">
                  <span className="text-[10px] font-bold text-pits-dim uppercase">
                    {t('Total Plans')}
                  </span>
                  <span className="text-sm font-black text-pits-ink">{plans.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-pits-surface-elevated rounded-2xl border border-pits-edge">
                  <span className="text-[10px] font-bold text-pits-dim uppercase">
                    {t('Active Plans')}
                  </span>
                  <span className="text-sm font-black text-pits-success">
                    {plans.filter((plan) => plan.is_active).length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-pits-surface-elevated rounded-3xl p-6 border border-pits-edge shadow-sm space-y-4">
            <h3 className="text-xs font-black text-pits-ink uppercase flex items-center gap-2">
              <Info size={14} className="text-pits-red" /> {t('System Tips')}
            </h3>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-pits-red mt-1.5 shrink-0" />
                <p className="text-[10px] font-bold text-pits-dim uppercase tracking-tight">
                  {t('Choose Unlimited, Weekly, or Session pack for booking limits.')}
                </p>
              </li>
              <li className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-pits-red mt-1.5 shrink-0" />
                <p className="text-[10px] font-bold text-pits-dim uppercase tracking-tight">
                  {t('Inactive plans stay hidden from new athlete sign-ups.')}
                </p>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {isFormOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-pits-black/60 backdrop-blur-sm"
            onClick={() => setIsFormOpen(false)}
          />
          <div className="relative bg-pits-surface-elevated rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl border border-pits-edge animate-in fade-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-pits-ink tracking-tighter uppercase">
                    {editingPlan ? t('Edit Plan') : t('Add Plan')}
                  </h2>
                  <p className="text-[10px] font-bold text-pits-dim uppercase tracking-widest mt-1">
                    {t('Plan Configuration')}
                  </p>
                </div>
                <div className="p-3 bg-pits-primary-soft text-pits-red rounded-2xl">
                  <Tags size={20} />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-pits-dim uppercase ml-1">
                    {t('Plan Name')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('e.g. Unlimited Monthly')}
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-bold text-pits-ink outline-none focus:ring-2 focus:ring-pits-red focus:bg-pits-surface-elevated transition-all placeholder:text-pits-dim"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-pits-dim uppercase ml-1">
                      {t('Price (USD)')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={formData.price_usd}
                      onChange={(e) =>
                        setFormData({ ...formData, price_usd: e.target.value })
                      }
                      className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-ink outline-none focus:ring-2 focus:ring-pits-red"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-pits-dim uppercase ml-1">
                      {t('Limit Type')}
                    </label>
                    <select
                      value={formData.limit_type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          limit_type: e.target.value as PlanLimitType,
                          weekly_limit: '',
                          session_limit: '',
                          validity_days: '',
                        })
                      }
                      className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-ink outline-none focus:ring-2 focus:ring-pits-red"
                    >
                      <option value="none">{t('Unlimited')}</option>
                      <option value="weekly">{t('Weekly')}</option>
                      <option value="period">{t('Session pack')}</option>
                    </select>
                  </div>
                </div>

                {formData.limit_type === 'weekly' && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-pits-dim uppercase ml-1">
                      {t('Weekly Limit')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={formData.weekly_limit}
                      onChange={(e) =>
                        setFormData({ ...formData, weekly_limit: e.target.value })
                      }
                      className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-ink outline-none focus:ring-2 focus:ring-pits-red"
                    />
                  </div>
                )}

                {formData.limit_type === 'period' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-pits-dim uppercase ml-1">
                        {t('Session limit')}
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={formData.session_limit}
                        onChange={(e) =>
                          setFormData({ ...formData, session_limit: e.target.value })
                        }
                        className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-ink outline-none focus:ring-2 focus:ring-pits-red"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-pits-dim uppercase ml-1">
                        {t('Validity (days)')}
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={formData.validity_days}
                        onChange={(e) =>
                          setFormData({ ...formData, validity_days: e.target.value })
                        }
                        className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-ink outline-none focus:ring-2 focus:ring-pits-red"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-pits-dim uppercase ml-1">
                    {t('Description')}
                  </label>
                  <textarea
                    rows={3}
                    placeholder={t('Optional plan description')}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-bold text-pits-ink outline-none focus:ring-2 focus:ring-pits-red focus:bg-pits-surface-elevated transition-all placeholder:text-pits-dim resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-pits-dim uppercase ml-1">
                    {t('Status')}
                  </label>
                  <select
                    value={String(formData.is_active)}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.value === 'true' })
                    }
                    className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-ink outline-none focus:ring-2 focus:ring-pits-red"
                  >
                    <option value="true">{t('Active')}</option>
                    <option value="false">{t('Inactive')}</option>
                  </select>
                </div>

                <p className="text-[9px] font-bold text-pits-dim uppercase">
                  {t('Session packs reset when payment is approved or the athlete is assigned this plan.')}
                </p>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="flex-1 py-4 bg-pits-surface-muted text-pits-dim rounded-2xl text-[11px] font-black uppercase hover:bg-pits-edge transition-all border border-pits-edge"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-2 py-4 bg-pits-primary text-pits-dark-text rounded-2xl text-[11px] font-black uppercase shadow-xl shadow-pits-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                  >
                    {isPending
                      ? t('Processing...')
                      : editingPlan
                        ? t('Save Changes')
                        : t('Confirm Plan')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!planToDelete}
        title={t('Delete Plan')}
        message={
          planToDelete && planToDelete.member_count > 0
            ? t('Cannot delete plan assigned to athletes')
            : t(
                'Are you sure you want to permanently delete this membership plan? This action cannot be undone.'
              )
        }
        confirmLabel={t('Yes, Delete')}
        cancelLabel={t('Cancel')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setPlanToDelete(null)}
      />
    </div>
  );
}
