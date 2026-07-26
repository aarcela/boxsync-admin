'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  XCircle,
  Tags,
  Info,
  Zap,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { classTypeService } from '@/lib/services/classTypeService';
import { ClassTypeRow } from '@/lib/types/gym';
import { FALLBACK_CLASS_TYPE_COLOR } from '@/lib/constants/classTypes';
import {
  createClassTypeAction,
  updateClassTypeAction,
  deleteClassTypeAction,
  toggleClassTypeStatusAction,
} from './actions';

export default function ClassTypesPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { tenantId: contextTenantId } = useTenant();
  const [isPending, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<ClassTypeRow[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingType, setEditingType] = useState<ClassTypeRow | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeToDelete, setTypeToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    color_hex: FALLBACK_CLASS_TYPE_COLOR,
    default_duration_min: 60,
    is_open_box: false,
    is_active: true,
    sort_order: 0,
  });

  const fetchTypes = async (activeTenantId: string) => {
    setLoading(true);
    try {
      const data = await classTypeService.getClassTypes(activeTenantId);
      setTypes(data);
    } catch (error) {
      console.error(error);
      toast(t('Failed to load class types'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = contextTenantId;
    setTenantId(id);
    if (id) void fetchTypes(id);
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextTenantId]);

  const handleOpenForm = (row?: ClassTypeRow) => {
    if (row) {
      setEditingType(row);
      setFormData({
        name: row.name,
        color_hex: row.color_hex || FALLBACK_CLASS_TYPE_COLOR,
        default_duration_min: row.default_duration_min,
        is_open_box: row.is_open_box,
        is_active: row.is_active,
        sort_order: row.sort_order,
      });
    } else {
      setEditingType(null);
      setFormData({
        name: '',
        color_hex: FALLBACK_CLASS_TYPE_COLOR,
        default_duration_min: 60,
        is_open_box: false,
        is_active: true,
        sort_order: types.length,
      });
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    startTransition(async () => {
      try {
        const form = new FormData();
        form.append('name', formData.name.trim());
        form.append('color_hex', formData.color_hex);
        form.append('default_duration_min', String(formData.default_duration_min));
        form.append('is_open_box', String(formData.is_open_box));
        form.append('is_active', String(formData.is_active));
        form.append('sort_order', String(formData.sort_order));

        if (editingType) {
          form.append('previous_name', editingType.name);
          await updateClassTypeAction(editingType.id, form);
          toast(t('Class type updated'), 'success');
        } else {
          await createClassTypeAction(form);
          toast(t('Class type created'), 'success');
        }

        setIsFormOpen(false);
        if (tenantId) await fetchTypes(tenantId);
      } catch (error) {
        console.error(error);
        toast(t('Action failed'), 'error');
      }
    });
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;

    startTransition(async () => {
      try {
        await deleteClassTypeAction(typeToDelete);
        toast(t('Class type deleted'), 'success');
        setTypeToDelete(null);
        if (tenantId) await fetchTypes(tenantId);
      } catch (error) {
        console.error(error);
        const message =
          error instanceof Error ? error.message : t('Delete failed');
        toast(message, 'error');
      }
    });
  };

  const handleToggleStatus = async (row: ClassTypeRow) => {
    startTransition(async () => {
      try {
        await toggleClassTypeStatusAction(row.id, !row.is_active);
        toast(t('Status updated'), 'success');
        if (tenantId) await fetchTypes(tenantId);
      } catch (error) {
        console.error(error);
        toast(t('Toggle failed'), 'error');
      }
    });
  };

  const filtered = types.filter((row) =>
    row.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-0">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-pits-edge">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-pits-text tracking-tighter uppercase">
              {t('Class Types')}
            </h1>
            <div className="bg-pits-primary-soft px-2 py-0.5 rounded text-[10px] font-bold text-pits-red border border-pits-edge tracking-widest uppercase shadow-sm">
              {t('System Config')}
            </div>
          </div>
          <p className="text-pits-dim text-xs font-semibold mt-1 tracking-wide uppercase">
            {t('Manage class categories used in schedule, booking and payroll')}
          </p>
        </div>

        <button
          onClick={() => handleOpenForm()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-pits-primary text-pits-dark-text rounded-2xl text-[11px] font-black uppercase shadow-lg shadow-pits-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Plus size={18} />
          {t('Add Class Type')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm overflow-hidden min-h-[400px]">
            <div className="px-6 py-4 border-b border-pits-edge">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim" size={16} />
                <input
                  type="text"
                  placeholder={t('Search class types...')}
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
                      {t('Type')}
                    </th>
                    <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">
                      {t('Duration')}
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
                      <td colSpan={4} className="py-20 text-center text-pits-dim font-bold uppercase animate-pulse">
                        {t('Initializing Data Stream...')}
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-20 text-center text-pits-dim font-bold uppercase">
                        {t('No class types found')}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row) => (
                      <tr key={row.id} className="hover:bg-pits-surface-elevated transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-xl border border-pits-edge shadow-sm"
                              style={{ backgroundColor: row.color_hex }}
                            />
                            <div>
                              <div className="text-xs font-bold text-pits-text uppercase tracking-tight">
                                {row.name}
                              </div>
                              <div className="text-[10px] text-pits-dim font-medium">
                                {row.is_open_box ? t('Open Box plan type') : t('Standard class type')}
                                {' · '}
                                {t('Order')}: {row.sort_order}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black uppercase text-pits-text">
                            {row.default_duration_min} {t('min')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleStatus(row)}
                            disabled={isPending}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-black uppercase border transition-all ${
                              row.is_active
                                ? 'bg-pits-primary-soft text-pits-success border-pits-edge'
                                : 'bg-pits-surface-muted text-pits-dim border-pits-edge'
                            }`}
                          >
                            {row.is_active ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                            {row.is_active ? t('Active') : t('Inactive')}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenForm(row)}
                              className="p-2 text-pits-dim hover:text-pits-text hover:bg-pits-surface-muted rounded-lg transition-all"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => setTypeToDelete(row.id)}
                              className="p-2 text-pits-dim hover:text-pits-red hover:bg-pits-primary-soft rounded-lg transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-pits-primary" />
              <h3 className="text-xs font-black uppercase tracking-widest text-pits-text">
                {t('How it works')}
              </h3>
            </div>
            <ul className="space-y-2 text-[11px] text-pits-dim font-medium leading-relaxed">
              <li className="flex gap-2">
                <Info size={12} className="mt-0.5 shrink-0 text-pits-primary" />
                {t('Active types appear when creating classes and on the schedule.')}
              </li>
              <li className="flex gap-2">
                <Info size={12} className="mt-0.5 shrink-0 text-pits-primary" />
                {t('Open Box types are used for open-box-only membership plans.')}
              </li>
              <li className="flex gap-2">
                <Info size={12} className="mt-0.5 shrink-0 text-pits-primary" />
                {t('Renaming a type updates existing classes and salary rates.')}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-pits-edge flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tags size={16} className="text-pits-primary" />
                <h2 className="text-sm font-black uppercase tracking-tight text-pits-text">
                  {editingType ? t('Edit Class Type') : t('Add Class Type')}
                </h2>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-pits-dim hover:text-pits-text text-xs font-bold uppercase"
              >
                {t('Close')}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Name')}</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
                  placeholder="CrossFit"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Color')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.color_hex}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, color_hex: e.target.value }))
                    }
                    className="w-12 h-12 rounded-xl bg-transparent cursor-pointer"
                  />
                  <input
                    value={formData.color_hex}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, color_hex: e.target.value }))
                    }
                    className="flex-1 bg-pits-surface-muted border border-pits-edge rounded-2xl px-4 py-3 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-pits-dim uppercase ml-1">
                    {t('Duration (min)')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={480}
                    value={formData.default_duration_min}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        default_duration_min: Number(e.target.value) || 60,
                      }))
                    }
                    className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Sort order')}</label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        sort_order: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_open_box}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, is_open_box: e.target.checked }))
                    }
                    className="rounded border-pits-edge"
                  />
                  <span className="text-[10px] font-black uppercase text-pits-text">
                    {t('Open Box type (plan restriction)')}
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, is_active: e.target.checked }))
                    }
                    className="rounded border-pits-edge"
                  />
                  <span className="text-[10px] font-black uppercase text-pits-text">{t('Active')}</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full mt-2 py-3.5 bg-pits-primary text-pits-dark-text rounded-2xl text-[11px] font-black uppercase shadow-lg shadow-pits-primary/20 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
              >
                {isPending ? t('Processing...') : editingType ? t('Save Changes') : t('Create')}
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!typeToDelete}
        title={t('Delete Class Type')}
        message={t('Delete this class type? Types used by classes cannot be deleted.')}
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setTypeToDelete(null)}
      />
    </div>
  );
}
