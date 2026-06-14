'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  Trophy,
  CheckCircle2,
  XCircle,
  Zap,
  Info,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useLanguage } from '@/components/LanguageContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import { prMovementService } from '@/lib/services/prMovementService';
import {
  PrMovement,
  PrCategory,
  PrRecordType,
  PR_CATEGORIES,
  PR_RECORD_TYPES,
} from '@/lib/types/pr';
import {
  createPrMovementAction,
  updatePrMovementAction,
  deletePrMovementAction,
  togglePrMovementStatusAction,
} from './actions';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const defaultForm = {
  slug: '',
  name: '',
  category: 'weightlifting' as PrCategory,
  record_type: 'weight' as PrRecordType,
  sort_order: 0,
  is_active: true,
};

export default function PersonalRecordsPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [movements, setMovements] = useState<PrMovement[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<PrMovement | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [slugToDelete, setSlugToDelete] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [formData, setFormData] = useState(defaultForm);

  const fetchMovements = async (activeTenantId: string) => {
    setLoading(true);
    try {
      const data = await prMovementService.getPrMovements(activeTenantId);
      setMovements(data);
    } catch (error) {
      console.error(error);
      toast(t('Failed to load PR movements'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadContext = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      const id = profile?.tenant_id ?? null;
      setTenantId(id);
      if (id) await fetchMovements(id);
      else setLoading(false);
    };

    loadContext();
  }, []);

  const handleOpenForm = (movement?: PrMovement) => {
    if (movement) {
      setEditingMovement(movement);
      setSlugManuallyEdited(true);
      setFormData({
        slug: movement.slug,
        name: movement.name,
        category: movement.category,
        record_type: movement.record_type,
        sort_order: movement.sort_order,
        is_active: movement.is_active,
      });
    } else {
      setEditingMovement(null);
      setSlugManuallyEdited(false);
      setFormData(defaultForm);
    }
    setIsFormOpen(true);
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug:
        !editingMovement && !slugManuallyEdited ? slugify(name) : prev.slug,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category || !formData.record_type) return;
    if (!editingMovement && !formData.slug) return;

    startTransition(async () => {
      try {
        const form = new FormData();
        form.append('slug', formData.slug);
        form.append('name', formData.name);
        form.append('category', formData.category);
        form.append('record_type', formData.record_type);
        form.append('sort_order', String(formData.sort_order));
        form.append('is_active', String(formData.is_active));

        if (editingMovement) {
          await updatePrMovementAction(editingMovement.slug, form);
          toast(t('PR movement updated'), 'success');
        } else {
          await createPrMovementAction(form);
          toast(t('PR movement created'), 'success');
        }

        setIsFormOpen(false);
        if (tenantId) fetchMovements(tenantId);
      } catch (error) {
        console.error(error);
        toast(t('Action failed'), 'error');
      }
    });
  };

  const handleDelete = async () => {
    if (!slugToDelete) return;

    startTransition(async () => {
      try {
        await deletePrMovementAction(slugToDelete);
        toast(t('PR movement deleted'), 'success');
        setSlugToDelete(null);
        if (tenantId) fetchMovements(tenantId);
      } catch (error) {
        console.error(error);
        toast(
          t('Delete failed — movement may be linked to athlete records'),
          'error'
        );
      }
    });
  };

  const handleToggleStatus = async (movement: PrMovement) => {
    startTransition(async () => {
      try {
        await togglePrMovementStatusAction(movement.slug, !movement.is_active);
        toast(t('Status updated'), 'success');
        if (tenantId) fetchMovements(tenantId);
      } catch (error) {
        toast(t('Toggle failed'), 'error');
      }
    });
  };

  const categoryLabel = (category: PrCategory) =>
    PR_CATEGORIES.find((c) => c.value === category)?.label ?? 'Weightlifting';

  const recordTypeLabel = (type: PrRecordType) =>
    PR_RECORD_TYPES.find((r) => r.value === type)?.label ?? 'Weight';

  const filteredMovements = movements.filter(
    (m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-0">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-pits-edge">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-pits-text tracking-tighter uppercase">
              {t('Personal Records')}
            </h1>
            <div className="bg-pits-primary-soft px-2 py-0.5 rounded text-[10px] font-bold text-pits-red border border-pits-edge tracking-widest uppercase shadow-sm">
              {t('PR Catalog')}
            </div>
          </div>
          <p className="text-pits-dim text-xs font-semibold mt-1 tracking-wide uppercase">
            {t('Manage movements athletes can track as personal records')}
          </p>
        </div>

        <button
          onClick={() => handleOpenForm()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-pits-primary text-pits-dark-text rounded-2xl text-[11px] font-black uppercase shadow-lg shadow-pits-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Plus size={18} />
          {t('Add Movement')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm overflow-hidden min-h-[400px]">
            <div className="px-6 py-4 border-b border-pits-edge">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim"
                  size={16}
                />
                <input
                  type="text"
                  placeholder={t('Search movements...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-pits-surface-muted border border-pits-edge rounded-xl text-[10px] font-bold uppercase outline-none focus:ring-2 focus:ring-pits-red transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-pits-surface-elevated">
                  <tr>
                    <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">
                      {t('Movement')}
                    </th>
                    <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">
                      {t('Category')}
                    </th>
                    <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">
                      {t('Record Type')}
                    </th>
                    <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">
                      {t('Order')}
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
                        colSpan={6}
                        className="py-20 text-center text-pits-dim font-bold uppercase animate-pulse"
                      >
                        {t('Initializing Data Stream...')}
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((movement) => (
                      <tr
                        key={movement.slug}
                        className="hover:bg-pits-surface-elevated transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-xl ${movement.is_active ? 'bg-pits-surface-muted text-pits-text' : 'bg-pits-surface-muted text-pits-dim'}`}
                            >
                              <Trophy size={16} />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-pits-text uppercase tracking-tight">
                                {movement.name}
                              </div>
                              <div className="text-[10px] text-pits-dim font-mono">
                                {movement.slug}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded text-[9px] font-black uppercase border bg-pits-surface-muted text-pits-text border-pits-edge">
                            {t(categoryLabel(movement.category))}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded text-[9px] font-black uppercase border bg-pits-surface-muted text-pits-primary border-pits-edge">
                            {t(recordTypeLabel(movement.record_type))}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-pits-dim">
                          {movement.sort_order}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleStatus(movement)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-black uppercase border transition-all ${movement.is_active ? 'bg-pits-primary-soft text-pits-success border-pits-edge' : 'bg-pits-surface-muted text-pits-dim border-pits-edge'}`}
                          >
                            {movement.is_active ? (
                              <CheckCircle2 size={10} />
                            ) : (
                              <XCircle size={10} />
                            )}
                            {movement.is_active ? t('Active') : t('Inactive')}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenForm(movement)}
                              className="p-2 text-pits-dim hover:text-pits-text hover:bg-pits-surface-muted rounded-lg transition-all"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => setSlugToDelete(movement.slug)}
                              className="p-2 text-pits-dim hover:text-pits-red hover:bg-pits-primary-soft rounded-lg transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                  {!loading && filteredMovements.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
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
          <div className="bg-pits-surface-elevated rounded-3xl p-6 shadow-xl border border-pits-edge relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Trophy size={80} className="text-pits-text" />
            </div>
            <div className="relative z-10">
              <h3 className="text-sm font-black text-pits-text uppercase tracking-tighter mb-4 flex items-center gap-2">
                <Zap size={18} className="text-pits-red" /> {t('Catalog Overview')}
              </h3>
              <p className="text-pits-dim text-[11px] font-medium leading-relaxed mb-6">
                {t(
                  'Define which lifts, skills, and benchmarks appear in the athlete PR tracker. Inactive movements stay hidden from new entries.'
                )}
              </p>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-pits-ink/5 rounded-2xl border border-pits-edge">
                  <span className="text-[10px] font-bold text-pits-dim uppercase">
                    {t('Total Movements')}
                  </span>
                  <span className="text-sm font-black text-pits-text">
                    {movements.length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-pits-ink/5 rounded-2xl border border-pits-edge">
                  <span className="text-[10px] font-bold text-pits-dim uppercase">
                    {t('Active')}
                  </span>
                  <span className="text-sm font-black text-pits-success">
                    {movements.filter((m) => m.is_active).length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-pits-surface-elevated rounded-3xl p-6 border border-pits-edge shadow-sm space-y-4">
            <h3 className="text-xs font-black text-pits-text uppercase flex items-center gap-2">
              <Info size={14} className="text-pits-red" /> {t('System Tips')}
            </h3>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-pits-red mt-1.5 shrink-0" />
                <p className="text-[10px] font-bold text-pits-dim uppercase tracking-tight">
                  {t(
                    'Slug is permanent once created — it links athlete PR data to this movement.'
                  )}
                </p>
              </li>
              <li className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-pits-red mt-1.5 shrink-0" />
                <p className="text-[10px] font-bold text-pits-dim uppercase tracking-tight">
                  {t(
                    'Record type controls how values are stored: weight (kg/lb), reps, or time (seconds).'
                  )}
                </p>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-pits-black/60 backdrop-blur-sm"
            onClick={() => setIsFormOpen(false)}
          />
          <div className="relative bg-pits-surface-elevated rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl border border-pits-edge animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-pits-text tracking-tighter uppercase">
                    {editingMovement ? t('Edit Movement') : t('Add Movement')}
                  </h2>
                  <p className="text-[10px] font-bold text-pits-dim uppercase tracking-widest mt-1">
                    {t('PR Movement Configuration')}
                  </p>
                </div>
                <div className="p-3 bg-pits-primary-soft text-pits-red rounded-2xl">
                  <Trophy size={20} />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {!editingMovement && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-pits-dim uppercase ml-1">
                      {t('Slug')}
                    </label>
                    <input
                      type="text"
                      placeholder={t('e.g. back_squat')}
                      required
                      value={formData.slug}
                      onChange={(e) => {
                        setSlugManuallyEdited(true);
                        setFormData({
                          ...formData,
                          slug: slugify(e.target.value),
                        });
                      }}
                      className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-mono text-pits-text outline-none focus:ring-2 focus:ring-pits-red focus:bg-pits-surface-elevated transition-all placeholder:text-pits-dim"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-pits-dim uppercase ml-1">
                    {t('Name')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('e.g. Back Squat')}
                    required
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-red focus:bg-pits-surface-elevated transition-all placeholder:text-pits-dim"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-pits-dim uppercase ml-1">
                      {t('Category')}
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          category: e.target.value as PrCategory,
                        })
                      }
                      className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
                    >
                      {PR_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {t(c.label)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-pits-dim uppercase ml-1">
                      {t('Record Type')}
                    </label>
                    <select
                      value={formData.record_type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          record_type: e.target.value as PrRecordType,
                        })
                      }
                      className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
                    >
                      {PR_RECORD_TYPES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {t(r.label)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-pits-dim uppercase ml-1">
                      {t('Sort Order')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.sort_order}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sort_order: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-pits-dim uppercase ml-1">
                      {t('Status')}
                    </label>
                    <select
                      value={String(formData.is_active)}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_active: e.target.value === 'true',
                        })
                      }
                      className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
                    >
                      <option value="true">{t('Active')}</option>
                      <option value="false">{t('Inactive')}</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="flex-1 py-4 bg-pits-surface-muted text-pits-dim rounded-2xl text-[11px] font-black uppercase hover:bg-pits-surface-muted transition-all border border-pits-edge/50"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-[2] py-4 bg-pits-primary text-pits-dark-text rounded-2xl text-[11px] font-black uppercase shadow-xl shadow-pits-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                  >
                    {isPending
                      ? t('Processing...')
                      : editingMovement
                        ? t('Save Changes')
                        : t('Confirm Movement')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!slugToDelete}
        title={t('Delete Movement')}
        message={t(
          'Are you sure you want to permanently delete this PR movement? Movements linked to athlete records cannot be deleted.'
        )}
        confirmLabel={t('Yes, Delete')}
        cancelLabel={t('Cancel')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setSlugToDelete(null)}
      />
    </div>
  );
}
