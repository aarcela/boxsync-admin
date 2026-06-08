'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  Banknote,
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
import { CLASS_TYPES } from '@/lib/constants/classTypes';
import { coachSalaryService } from '@/lib/services/coachSalaryService';
import { CoachSalaryTier, CoachWithSalaryTier } from '@/lib/types/gym';
import {
  createSalaryTierAction,
  updateSalaryTierAction,
  deleteSalaryTierAction,
  toggleSalaryTierStatusAction,
  assignCoachSalaryTierAction,
} from './actions';

function emptyRates(): Record<string, string> {
  return CLASS_TYPES.reduce(
    (acc, type) => {
      acc[type] = '0';
      return acc;
    },
    {} as Record<string, string>
  );
}

export default function SalaryPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<CoachSalaryTier[]>([]);
  const [coaches, setCoaches] = useState<CoachWithSalaryTier[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<CoachSalaryTier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierToDelete, setTierToDelete] = useState<string | null>(null);

  const isAdmin = callerRole === 'admin';

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    rates: emptyRates(),
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

  const reloadData = async () => {
    if (!tenantId || !isAdmin) return;
    setLoading(true);
    try {
      const [tierData, coachData] = await Promise.all([
        coachSalaryService.getTiersWithRates(tenantId),
        coachSalaryService.getCoachesWithTiers(tenantId),
      ]);
      setTiers(tierData);
      setCoaches(coachData);
    } catch (err) {
      console.error(err);
      toast(t('Failed to load salary configuration'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!tenantId) {
      if (callerRole !== null) setLoading(false);
      return;
    }

    if (!isAdmin) {
      setLoading(false);
      return;
    }

    reloadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, callerRole, isAdmin]);

  const handleOpenForm = (tier?: CoachSalaryTier) => {
    if (!isAdmin) return;

    if (tier) {
      setEditingTier(tier);
      const rates = emptyRates();
      tier.rates?.forEach((r) => {
        rates[r.class_type] = String(r.rate_usd);
      });
      setFormData({
        name: tier.name,
        description: tier.description || '',
        is_active: tier.is_active,
        rates,
      });
    } else {
      setEditingTier(null);
      setFormData({
        name: '',
        description: '',
        is_active: true,
        rates: emptyRates(),
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
        form.append('description', formData.description);
        form.append('is_active', String(formData.is_active));
        CLASS_TYPES.forEach((classType) => {
          form.append(`rate_${classType}`, formData.rates[classType] || '0');
        });

        if (editingTier) {
          await updateSalaryTierAction(editingTier.id, form);
          toast(t('Pay tier updated'), 'success');
        } else {
          await createSalaryTierAction(form);
          toast(t('Pay tier created'), 'success');
        }

        setIsFormOpen(false);
        reloadData();
      } catch (error) {
        const message =
          error instanceof Error && error.message === 'Only admins can manage coach salaries.'
            ? t('Only admins can manage coach salaries.')
            : t('Action failed');
        toast(message, 'error');
      }
    });
  };

  const handleDelete = async () => {
    if (!tierToDelete || !isAdmin) return;

    startTransition(async () => {
      try {
        await deleteSalaryTierAction(tierToDelete);
        toast(t('Pay tier deleted'), 'success');
        setTierToDelete(null);
        reloadData();
      } catch (error) {
        const message =
          error instanceof Error &&
          error.message === 'Cannot delete tier with assigned coaches.'
            ? t('Cannot delete tier with assigned coaches.')
            : t('Delete failed');
        toast(message, 'error');
      }
    });
  };

  const handleToggleStatus = async (tier: CoachSalaryTier) => {
    if (!isAdmin) return;

    startTransition(async () => {
      try {
        await toggleSalaryTierStatusAction(tier.id, !tier.is_active);
        toast(t('Status updated'), 'success');
        reloadData();
      } catch {
        toast(t('Toggle failed'), 'error');
      }
    });
  };

  const handleAssignTier = async (coachId: string, tierId: string) => {
    if (!isAdmin) return;

    startTransition(async () => {
      try {
        await assignCoachSalaryTierAction(coachId, tierId || null);
        toast(t('Coach tier assigned'), 'success');
        reloadData();
      } catch {
        toast(t('Action failed'), 'error');
      }
    });
  };

  const filteredTiers = tiers.filter(
    (tier) =>
      tier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tier.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeTiers = tiers.filter((tier) => tier.is_active);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-0">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-pits-edge">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-pits-ink tracking-tighter uppercase">
              {t('Coach Salaries')}
            </h1>
            <div className="bg-pits-primary/50 px-2 py-0.5 rounded text-[10px] font-bold text-pits-dark-text border border-pits-primary-dark tracking-widest uppercase shadow-sm">
              {t('Admin Only')}
            </div>
          </div>
          <p className="text-pits-dim text-xs font-semibold mt-1 tracking-wide uppercase">
            {t('Manage pay tiers and coach salary assignments')}
          </p>
          {!isAdmin && callerRole && (
            <p className="text-[10px] font-bold text-pits-secondary uppercase mt-2">
              {t('Only admins can manage coach salaries.')}
            </p>
          )}
        </div>

        {isAdmin && (
          <button
            onClick={() => handleOpenForm()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-pits-primary text-pits-dark-text rounded-2xl text-[11px] font-black uppercase shadow-lg shadow-pits-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus size={18} />
            {t('Add Pay Tier')}
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm overflow-hidden min-h-[400px]">
              <div className="px-6 py-4 border-b border-pits-edge flex flex-col md:flex-row justify-between gap-4">
                <h2 className="text-sm font-black text-pits-ink uppercase tracking-tighter flex items-center gap-2">
                  <Banknote size={16} className="text-pits-red" />
                  {t('Pay Tiers')}
                </h2>
                <div className="relative flex-1 max-w-sm">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder={t('Search tiers...')}
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
                        {t('Tier Name')}
                      </th>
                      <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">
                        {t('Rates Configured')}
                      </th>
                      <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">
                        {t('Status')}
                      </th>
                      <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest text-right">
                        {t('Actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pits-edge">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-20 text-center text-pits-dim font-bold uppercase animate-pulse"
                        >
                          {t('Initializing Data Stream...')}
                        </td>
                      </tr>
                    ) : (
                      filteredTiers.map((tier) => (
                        <tr
                          key={tier.id}
                          className="hover:bg-pits-surface-muted/40 transition-colors group"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`p-2 rounded-xl ${tier.is_active ? 'bg-pits-primary text-pits-dark-text' : 'bg-pits-surface-muted text-pits-dim'}`}
                              >
                                <Banknote size={16} />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-pits-ink uppercase tracking-tight">
                                  {tier.name}
                                </div>
                                <div className="text-[10px] text-pits-dim font-medium truncate max-w-[220px]">
                                  {tier.description || t('No details provided')}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 rounded text-[9px] font-black uppercase border bg-pits-surface-muted text-pits-ink border-pits-edge">
                              {tier.rates?.length ?? 0} {t('class types')}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleToggleStatus(tier)}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-black uppercase border transition-all ${tier.is_active ? 'bg-pits-primary-soft text-pits-success border-pits-success/30' : 'bg-pits-surface-muted text-pits-dim border-pits-edge'}`}
                            >
                              {tier.is_active ? (
                                <CheckCircle2 size={10} />
                              ) : (
                                <XCircle size={10} />
                              )}
                              {tier.is_active ? t('Active') : t('Inactive')}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenForm(tier)}
                                className="p-2 text-pits-dim hover:text-pits-ink hover:bg-pits-surface-muted rounded-lg transition-all"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => setTierToDelete(tier.id)}
                                className="p-2 text-pits-dim hover:text-pits-error hover:bg-pits-primary-soft rounded-lg transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                    {!loading && filteredTiers.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
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

            <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-pits-edge">
                <h2 className="text-sm font-black text-pits-ink uppercase tracking-tighter flex items-center gap-2">
                  <Users size={16} className="text-pits-red" />
                  {t('Coach Assignments')}
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-pits-surface-muted/60">
                    <tr>
                      <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">
                        {t('Coach')}
                      </th>
                      <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">
                        {t('Role')}
                      </th>
                      <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">
                        {t('Pay Tier')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pits-edge">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="py-12 text-center text-pits-dim font-bold uppercase animate-pulse"
                        >
                          {t('Loading...')}
                        </td>
                      </tr>
                    ) : coaches.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="py-12 text-center text-pits-dim font-bold uppercase"
                        >
                          {t('No coaches found.')}
                        </td>
                      </tr>
                    ) : (
                      coaches.map((coach) => (
                        <tr
                          key={coach.id}
                          className="hover:bg-pits-surface-muted/40 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-pits-ink uppercase">
                              {coach.full_name}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 rounded text-[9px] font-black uppercase border bg-pits-surface-muted text-pits-ink border-pits-edge">
                              {coach.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={coach.salary_tier_id ?? ''}
                              onChange={(e) =>
                                handleAssignTier(coach.id, e.target.value)
                              }
                              disabled={isPending}
                              className="w-full max-w-[200px] bg-pits-surface-muted border border-pits-edge rounded-xl px-3 py-2 text-[10px] font-bold uppercase text-pits-ink outline-none focus:ring-2 focus:ring-pits-red"
                            >
                              <option value="">{t('Unassigned')}</option>
                              {activeTiers.map((tier) => (
                                <option key={tier.id} value={tier.id}>
                                  {tier.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-pits-surface-muted rounded-3xl p-6 shadow-xl border border-pits-edge relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Banknote size={80} className="text-pits-ink" />
              </div>
              <div className="relative z-10">
                <h3 className="text-sm font-black text-pits-ink uppercase tracking-tighter mb-4 flex items-center gap-2">
                  <Zap size={18} className="text-pits-red" /> {t('Strategic Overview')}
                </h3>
                <p className="text-pits-ink-muted text-[11px] font-medium leading-relaxed mb-6">
                  {t('Define per-class pay rates by tier and assign each coach to a tier.')}
                </p>

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-pits-surface-elevated rounded-2xl border border-pits-edge">
                    <span className="text-[10px] font-bold text-pits-dim uppercase">
                      {t('Total Tiers')}
                    </span>
                    <span className="text-sm font-black text-pits-ink">{tiers.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-pits-surface-elevated rounded-2xl border border-pits-edge">
                    <span className="text-[10px] font-bold text-pits-dim uppercase">
                      {t('Assigned Coaches')}
                    </span>
                    <span className="text-sm font-black text-pits-success">
                      {coaches.filter((c) => c.salary_tier_id).length}
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
                    {t('Set a USD rate for each class type within every pay tier.')}
                  </p>
                </li>
                <li className="flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-pits-red mt-1.5 shrink-0" />
                  <p className="text-[10px] font-bold text-pits-dim uppercase tracking-tight">
                    {t('Unassign a coach by selecting Unassigned in the tier dropdown.')}
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {isFormOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-pits-black/60 backdrop-blur-sm"
            onClick={() => setIsFormOpen(false)}
          />
          <div className="relative bg-pits-surface-elevated rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl border border-pits-edge animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-pits-ink tracking-tighter uppercase">
                    {editingTier ? t('Edit Pay Tier') : t('Add Pay Tier')}
                  </h2>
                  <p className="text-[10px] font-bold text-pits-dim uppercase tracking-widest mt-1">
                    {t('Tier Configuration')}
                  </p>
                </div>
                <div className="p-3 bg-pits-primary-soft text-pits-red rounded-2xl">
                  <Banknote size={20} />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-pits-dim uppercase ml-1">
                    {t('Tier Name')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('e.g. Senior Coach')}
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-bold text-pits-ink outline-none focus:ring-2 focus:ring-pits-red focus:bg-pits-surface-elevated transition-all placeholder:text-pits-dim"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-pits-dim uppercase ml-1">
                    {t('Description')}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={t('Optional tier description')}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-bold text-pits-ink outline-none focus:ring-2 focus:ring-pits-red focus:bg-pits-surface-elevated transition-all placeholder:text-pits-dim resize-none"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-black text-pits-dim uppercase ml-1">
                    {t('Rate per Class (USD)')}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {CLASS_TYPES.map((classType) => (
                      <div key={classType} className="space-y-1">
                        <label className="text-[8px] font-black text-pits-dim uppercase ml-1">
                          {classType}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={formData.rates[classType]}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              rates: { ...formData.rates, [classType]: e.target.value },
                            })
                          }
                          className="w-full bg-pits-surface-muted border border-pits-edge rounded-xl px-4 py-2.5 text-xs font-black text-pits-ink outline-none focus:ring-2 focus:ring-pits-red"
                        />
                      </div>
                    ))}
                  </div>
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
                      : editingTier
                        ? t('Save Changes')
                        : t('Confirm Tier')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!tierToDelete}
        title={t('Delete Pay Tier')}
        message={t(
          'Are you sure you want to permanently delete this pay tier? Coaches must be unassigned first.'
        )}
        confirmLabel={t('Yes, Delete')}
        cancelLabel={t('Cancel')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setTierToDelete(null)}
      />
    </div>
  );
}
