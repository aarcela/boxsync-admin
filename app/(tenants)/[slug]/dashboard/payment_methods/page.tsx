'use client';

import { useState, useEffect, useTransition } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Wallet, 
  CheckCircle2, 
  XCircle,
  MoreVertical,
  Search,
  Zap,
  Info,
  CreditCard
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useLanguage } from '@/components/LanguageContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import { paymentMethodService } from '@/lib/services/paymentMethodService';
import { PaymentMethod, CurrencyType } from '@/lib/types/gym';
import { 
  createPaymentMethodAction, 
  updatePaymentMethodAction, 
  deletePaymentMethodAction,
  togglePaymentMethodStatusAction 
} from './actions';

export default function PaymentMethodsPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();

  // State
  const [loading, setLoading] = useState(true);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodToDelete, setMethodToDelete] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    label: '',
    currency: CurrencyType.EUR,
    details: '',
    is_active: true
  });

  const fetchMethods = async (activeTenantId: string) => {
    setLoading(true);
    try {
      const data = await paymentMethodService.getPaymentMethods(activeTenantId);
      setMethods(data);
    } catch (error) {
      console.error(error);
      toast(t('Failed to load payment methods'), 'error');
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
      if (id) await fetchMethods(id);
      else setLoading(false);
    };

    loadContext();
  }, []);

  const handleOpenForm = (method?: PaymentMethod) => {
    if (method) {
      setEditingMethod(method);
      setFormData({
        label: method.label,
        currency: method.currency,
        details: method.details || '',
        is_active: method.is_active
      });
    } else {
      setEditingMethod(null);
      setFormData({
        label: '',
        currency: CurrencyType.EUR,
        details: '',
        is_active: true
      });
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.label) return;

    startTransition(async () => {
      try {
        const form = new FormData();
        form.append('label', formData.label);
        form.append('currency', formData.currency);
        form.append('details', formData.details);
        form.append('is_active', String(formData.is_active));

        if (editingMethod) {
          await updatePaymentMethodAction(editingMethod.id, form);
          toast(t('Payment method updated'), 'success');
        } else {
          await createPaymentMethodAction(form);
          toast(t('Payment method created'), 'success');
        }
        
        setIsFormOpen(false);
        if (tenantId) fetchMethods(tenantId);
      } catch (error) {
        toast(t('Action failed'), 'error');
      }
    });
  };

  const handleDelete = async () => {
    if (!methodToDelete) return;
    
    startTransition(async () => {
      try {
        await deletePaymentMethodAction(methodToDelete);
        toast(t('Payment method deleted'), 'success');
        setMethodToDelete(null);
        if (tenantId) fetchMethods(tenantId);
      } catch (error) {
        toast(t('Delete failed'), 'error');
      }
    });
  };

  const handleToggleStatus = async (method: PaymentMethod) => {
    startTransition(async () => {
      try {
        await togglePaymentMethodStatusAction(method.id, !method.is_active);
        toast(t('Status updated'), 'success');
        if (tenantId) fetchMethods(tenantId);
      } catch (error) {
        toast(t('Toggle failed'), 'error');
      }
    });
  };

  const filteredMethods = methods.filter(m => 
    m.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.details?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-0">
      
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-pits-edge">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black text-pits-text tracking-tighter uppercase">
              {t('Payment Methods')}
            </h1>
            <div className="bg-pits-primary-soft px-2 py-0.5 rounded text-[10px] font-bold text-pits-red border border-pits-edge tracking-widest uppercase shadow-sm">
              {t('System Config')}
            </div>
          </div>
          <p className="text-pits-dim text-xs font-semibold mt-1 tracking-wide uppercase">
            {t('Manage accepted payment channels and configurations')}
          </p>
        </div>

        <button 
          onClick={() => handleOpenForm()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-pits-primary text-pits-dark-text rounded-2xl text-[11px] font-black uppercase shadow-lg shadow-pits-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Plus size={18} />
          {t('Add Method')}
        </button>
      </div>

      {/* CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LIST */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-pits-surface-elevated rounded-3xl border border-pits-edge shadow-sm overflow-hidden min-h-[400px]">
            <div className="px-6 py-4 border-b border-pits-edge flex flex-col md:flex-row justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim" size={16} />
                <input 
                  type="text" 
                  placeholder={t('Search methods...')}
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
                    <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">{t('Method')}</th>
                    <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">{t('Currency')}</th>
                    <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest">{t('Status')}</th>
                    <th className="px-6 py-4 text-[9px] font-black text-pits-dim uppercase tracking-widest text-right">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pits-edge">
                  {loading ? (
                    <tr><td colSpan={4} className="py-20 text-center text-pits-dim font-bold uppercase animate-pulse">{t('Initializing Data Stream...')}</td></tr>
                  ) : filteredMethods.map(method => (
                    <tr key={method.id} className="hover:bg-pits-surface-elevated transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${method.is_active ? 'bg-pits-surface-muted text-pits-text' : 'bg-pits-surface-muted text-pits-dim'}`}>
                            <CreditCard size={16} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-pits-text uppercase tracking-tight">{method.label}</div>
                            <div className="text-[10px] text-pits-dim font-medium truncate max-w-[200px]">{method.details || t('No details provided')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase border ${method.currency === CurrencyType.EUR ? 'bg-pits-surface-muted text-pits-primary border-pits-edge' : 'bg-pits-primary-soft text-pits-success border-pits-edge'}`}>
                          {method.currency}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => handleToggleStatus(method)}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-black uppercase border transition-all ${method.is_active ? 'bg-pits-primary-soft text-pits-success border-pits-edge' : 'bg-pits-surface-muted text-pits-dim border-pits-edge'}`}
                        >
                          {method.is_active ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                          {method.is_active ? t('Active') : t('Inactive')}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => handleOpenForm(method)}
                            className="p-2 text-pits-dim hover:text-pits-text hover:bg-pits-surface-muted rounded-lg transition-all"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => setMethodToDelete(method.id)}
                            className="p-2 text-pits-dim hover:text-pits-red hover:bg-pits-primary-soft rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && filteredMethods.length === 0 && (
                    <tr><td colSpan={4} className="py-20 text-center text-pits-dim font-bold uppercase">{t('No records found.')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* INFO PANEL */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-pits-surface-elevated rounded-3xl p-6 shadow-xl border border-pits-edge relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
              <Wallet size={80} className="text-pits-text" />
            </div>
            <div className="relative z-10">
              <h3 className="text-sm font-black text-pits-text uppercase tracking-tighter mb-4 flex items-center gap-2">
                <Zap size={18} className="text-pits-red" /> {t('Strategic Overview')}
              </h3>
              <p className="text-pits-dim text-[11px] font-medium leading-relaxed mb-6">
                {t('Configure how your box receives payments. These methods will be available for athletes during check-out and for administrative manual registry.')}
              </p>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-pits-ink/5 rounded-2xl border border-pits-edge">
                  <span className="text-[10px] font-bold text-pits-dim uppercase">{t('Total Methods')}</span>
                  <span className="text-sm font-black text-pits-text">{methods.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-pits-ink/5 rounded-2xl border border-pits-edge">
                  <span className="text-[10px] font-bold text-pits-dim uppercase">{t('Active Channels')}</span>
                  <span className="text-sm font-black text-pits-success">{methods.filter(m => m.is_active).length}</span>
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
                <p className="text-[10px] font-bold text-pits-dim uppercase tracking-tight">{t('Keep at least one EUR and one VES method active for operational flexibility.')}</p>
              </li>
              <li className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-pits-red mt-1.5 shrink-0" />
                <p className="text-[10px] font-bold text-pits-dim uppercase tracking-tight">{t('Details appear on athlete invoices. Provide clear instructions for bank transfers.')}</p>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* MODAL FORM */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-pits-black/60 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <div className="relative bg-pits-surface-elevated rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl border border-pits-edge animate-in fade-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-pits-text tracking-tighter uppercase">
                    {editingMethod ? t('Edit Method') : t('Add Method')}
                  </h2>
                  <p className="text-[10px] font-bold text-pits-dim uppercase tracking-widest mt-1">
                    {t('Payment Channel Configuration')}
                  </p>
                </div>
                <div className="p-3 bg-pits-primary-soft text-pits-red rounded-2xl"><Zap size={20} fill="currentColor"/></div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Method Name / Label')}</label>
                   <input 
                     type="text" 
                     placeholder={t('e.g. Bank Transfer Zelle')}
                     required
                     value={formData.label}
                     onChange={(e) => setFormData({...formData, label: e.target.value})}
                     className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-red focus:bg-pits-surface-elevated transition-all placeholder:text-pits-dim"
                   />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Currency')}</label>
                      <select 
                        value={formData.currency}
                        onChange={(e) => setFormData({...formData, currency: e.target.value as CurrencyType})}
                        className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
                      >
                        <option value={CurrencyType.EUR}>EUR (€)</option>
                        <option value={CurrencyType.VES}>VES (Bs.)</option>
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Status')}</label>
                      <select 
                        value={String(formData.is_active)}
                        onChange={(e) => setFormData({...formData, is_active: e.target.value === 'true'})}
                        className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-black text-pits-text outline-none focus:ring-2 focus:ring-pits-red"
                      >
                        <option value="true">{t('Active')}</option>
                        <option value="false">{t('Inactive')}</option>
                      </select>
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[9px] font-black text-pits-dim uppercase ml-1">{t('Details / Instructions')}</label>
                   <textarea 
                     rows={3}
                     placeholder={t('Account number, bank name, etc.')}
                     value={formData.details}
                     onChange={(e) => setFormData({...formData, details: e.target.value})}
                     className="w-full bg-pits-surface-muted border border-pits-edge rounded-2xl px-5 py-3.5 text-xs font-bold text-pits-text outline-none focus:ring-2 focus:ring-pits-red focus:bg-pits-surface-elevated transition-all placeholder:text-pits-dim resize-none"
                   />
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
                    {isPending ? t('Processing...') : editingMethod ? t('Save Changes') : t('Confirm Method')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!methodToDelete}
        title={t('Delete Method')}
        message={t('Are you sure you want to permanently delete this payment method? This action cannot be undone.')}
        confirmLabel={t('Yes, Delete')}
        cancelLabel={t('Cancel')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setMethodToDelete(null)}
      />

    </div>
  );
}
