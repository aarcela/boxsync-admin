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
  Users,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import { currencySymbol } from '@/lib/currency';
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
  const { currencies } = useTenant();
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

  const priceLabel = (value: number) =>
    `${currencySymbol(currencies.reference)}${Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{t('Membership Plans')}</h1>
          <p className="page-subtitle">{t('Manage membership plans and pricing for your box')}</p>
          {!isAdmin && callerRole && (
            <p className="mt-1 text-xs font-semibold text-pits-warning">{t('Only admins can manage membership plans.')}</p>
          )}
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => handleOpenForm()}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-pits-primary text-pits-dark-text text-sm font-semibold shadow-sm hover:bg-pits-primary-dark"
          >
            <Plus size={16} />
            {t('Add Plan')}
          </button>
        )}
      </div>

      {plans.length > 6 ? (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim" size={16} aria-hidden />
          <input
            type="search"
            placeholder={t('Search plans...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-h-10 pl-9 pr-3 bg-pits-surface-elevated border border-pits-edge rounded-xl text-sm text-pits-text outline-none focus:ring-2 focus:ring-pits-primary/40"
          />
        </div>
      ) : null}

      <div className="rounded-2xl border border-pits-edge bg-pits-surface-elevated overflow-hidden">
        {loading ? (
          <div className="divide-y divide-pits-edge" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-4 animate-pulse">
                <div className="h-3 w-40 rounded bg-pits-surface-muted" />
                <div className="ml-auto h-3 w-16 rounded bg-pits-surface-muted" />
              </div>
            ))}
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-pits-dim">{t('No records found.')}</p>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => handleOpenForm()}
                className="mt-3 text-sm font-semibold text-pits-info hover:underline"
              >
                {t('Add Plan')}
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-pits-edge">
            {filteredPlans.map((plan) => (
              <li key={plan.id} className={`flex items-center gap-3 pl-4 pr-2 py-3 ${plan.is_active ? '' : 'opacity-60'}`}>
                <button
                  type="button"
                  onClick={() => handleOpenForm(plan)}
                  disabled={!isAdmin}
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                >
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-semibold text-pits-text">{plan.name}</span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-pits-text">{priceLabel(plan.price_usd)}</span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-pits-dim">
                    <span>{formatBookingLimit(plan)}</span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} aria-hidden />
                      {t('{{count}} members', { count: plan.member_count })}
                    </span>
                    {plan.description ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="truncate max-w-[16rem]">{plan.description}</span>
                      </>
                    ) : null}
                  </span>
                </button>
                {isAdmin ? (
                  <>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={plan.is_active}
                      onClick={() => handleToggleStatus(plan)}
                      disabled={isPending}
                      className={`inline-flex items-center gap-1.5 min-h-9 px-2.5 rounded-lg text-xs font-semibold border ${
                        plan.is_active
                          ? 'bg-pits-positive-soft text-pits-positive border-pits-positive-edge'
                          : 'bg-pits-surface-muted text-pits-dim border-pits-edge'
                      }`}
                    >
                      {plan.is_active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      {plan.is_active ? t('Active') : t('Inactive')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenForm(plan)}
                      aria-label={t('Edit Plan')}
                      className="hidden sm:flex items-center justify-center w-9 h-9 rounded-lg text-pits-dim hover:text-pits-text hover:bg-pits-surface-muted"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanToDelete(plan)}
                      aria-label={t('Delete')}
                      className="flex items-center justify-center w-9 h-9 rounded-lg text-pits-dim hover:text-pits-danger hover:bg-pits-danger-soft"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                ) : (
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                      plan.is_active ? 'bg-pits-positive-soft text-pits-positive' : 'bg-pits-surface-muted text-pits-dim'
                    }`}
                  >
                    {plan.is_active ? t('Active') : t('Inactive')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ul className="space-y-1 text-xs text-pits-dim">
        <li>{t('Prices are in {{currency}}. Local payment methods convert them with your exchange rate.', { currency: currencies.reference })}</li>
        <li>{t('Choose Unlimited, Weekly, or Session pack for booking limits.')}</li>
        <li>{t('Inactive plans stay hidden from new athlete sign-ups.')}</li>
      </ul>

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
                  <p className="text-[11px] font-bold text-pits-dim uppercase tracking-widest mt-1">
                    {t('Plan Configuration')}
                  </p>
                </div>
                <div className="p-3 bg-pits-primary-soft text-pits-red rounded-2xl">
                  <Tags size={20} />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-pits-dim uppercase ml-1">
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
                    <label className="text-[11px] font-black text-pits-dim uppercase ml-1">
                      {t('Price ({{currency}})', { currency: currencies.reference })}
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
                    <label className="text-[11px] font-black text-pits-dim uppercase ml-1">
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
                    <label className="text-[11px] font-black text-pits-dim uppercase ml-1">
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
                      <label className="text-[11px] font-black text-pits-dim uppercase ml-1">
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
                      <label className="text-[11px] font-black text-pits-dim uppercase ml-1">
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
                  <label className="text-[11px] font-black text-pits-dim uppercase ml-1">
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
                  <label className="text-[11px] font-black text-pits-dim uppercase ml-1">
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

                <p className="text-[11px] font-bold text-pits-dim uppercase">
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
