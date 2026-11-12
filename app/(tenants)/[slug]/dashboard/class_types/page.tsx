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
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{t('Class Types')}</h1>
          <p className="page-subtitle">{t('Manage class categories used in schedule, booking and payroll')}</p>
        </div>
        <button
          type="button"
          onClick={() => handleOpenForm()}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-pits-primary text-pits-dark-text text-sm font-semibold shadow-sm hover:bg-pits-primary-dark"
        >
          <Plus size={16} />
          {t('Add Class Type')}
        </button>
      </div>

      {types.length > 6 ? (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim" size={16} aria-hidden />
          <input
            type="search"
            placeholder={t('Search class types...')}
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
                <div className="h-4 w-4 rounded-full bg-pits-surface-muted" />
                <div className="h-3 w-40 rounded bg-pits-surface-muted" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-pits-dim">{t('No class types found')}</p>
            <button
              type="button"
              onClick={() => handleOpenForm()}
              className="mt-3 text-sm font-semibold text-pits-info hover:underline"
            >
              {t('Add Class Type')}
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-pits-edge">
            {filtered.map((row) => (
              <li key={row.id} className={`flex items-center gap-3 pl-4 pr-2 py-2.5 ${row.is_active ? '' : 'opacity-60'}`}>
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: row.color_hex }}
                  aria-hidden
                />
                <button type="button" onClick={() => handleOpenForm(row)} className="min-w-0 flex-1 text-left py-1">
                  <span className="block truncate text-sm font-semibold text-pits-text">{row.name}</span>
                  <span className="block text-xs text-pits-dim">
                    {row.default_duration_min} {t('min')}
                    {row.is_open_box ? ` · ${t('Open Box plan type')}` : ''}
                  </span>
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={row.is_active}
                  onClick={() => handleToggleStatus(row)}
                  disabled={isPending}
                  className={`inline-flex items-center gap-1.5 min-h-9 px-2.5 rounded-lg text-xs font-semibold border ${
                    row.is_active
                      ? 'bg-pits-positive-soft text-pits-positive border-pits-positive-edge'
                      : 'bg-pits-surface-muted text-pits-dim border-pits-edge'
                  }`}
                  title={row.is_active ? t('Inactive') : t('Active')}
                >
                  {row.is_active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  {row.is_active ? t('Active') : t('Inactive')}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenForm(row)}
                  aria-label={t('Edit')}
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-pits-dim hover:text-pits-text hover:bg-pits-surface-muted"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setTypeToDelete(row.id)}
                  aria-label={t('Delete')}
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-pits-dim hover:text-pits-danger hover:bg-pits-danger-soft"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ul className="space-y-1 text-xs text-pits-dim">
        <li>{t('Active types appear when creating classes and on the schedule.')}</li>
        <li>{t('Open Box types are used for open-box-only membership plans.')}</li>
        <li>{t('Renaming a type updates existing classes and salary rates.')}</li>
      </ul>

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
                <label className="text-[11px] font-black text-pits-dim uppercase ml-1">{t('Name')}</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
                  placeholder="CrossFit"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-pits-dim uppercase ml-1">{t('Color')}</label>
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
                  <label className="text-[11px] font-black text-pits-dim uppercase ml-1">
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
                  <label className="text-[11px] font-black text-pits-dim uppercase ml-1">{t('Sort order')}</label>
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
                  <span className="text-[11px] font-black uppercase text-pits-text">
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
                  <span className="text-[11px] font-black uppercase text-pits-text">{t('Active')}</span>
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
