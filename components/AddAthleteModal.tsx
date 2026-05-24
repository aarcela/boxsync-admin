import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Award } from 'lucide-react';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import { useLanguage } from './LanguageContext';

const PLAN_LABELS: Record<string, string> = {
  unlimited: 'Unlimited',
  '3x_week': '3x / Week',
  '4x_week': '4x / Week',
  '5x_week': '5x / Week',
  open_box: 'Open Box',
  crossfit_kids: 'CrossFit Kids',
};

interface AddAthleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}


export default function AddAthleteModal({ isOpen, onClose, onSuccess }: AddAthleteModalProps) {
  const { toast } = useToast();
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'member',
    plan: 'unlimited' as 'unlimited' | '3x_week' | '4x_week' | '5x_week' | 'open_box' | 'crossfit_kids',
    inscription_plan: 'standard',
    inscription_cost: '50',
    inscription_paid: false,
    discount: '',
    admin_note: ''
  });

  useEffect(() => {
    if (formData.role === 'coach' || formData.role === 'manager') {
      setFormData(prev => ({ ...prev, plan: 'unlimited' }));
    }
  }, [formData.role]);

  useEffect(() => {
    if (!isOpen) setShowConfirm(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirm(true);
  };

  const createAthlete = async () => {
    setShowConfirm(false);
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        language: lang,
        plan: formData.role === 'coach' || formData.role === 'manager'
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
        plan: 'unlimited',
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

  const planLabel =
    formData.role === 'coach' || formData.role === 'manager'
      ? 'Unlimited'
      : PLAN_LABELS[formData.plan] ?? formData.plan;

  const confirmMessage =
    formData.role === 'member'
      ? `Create account for ${formData.full_name} (${formData.email}) as a Member with ${planLabel} plan?`
      : `Create account for ${formData.full_name} (${formData.email}) as a ${formData.role.charAt(0).toUpperCase() + formData.role.slice(1)}?`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hiddem">
        
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-black text-lg text-pits-text uppercase italic tracking-tighter">
            Register New Athlete
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8">
          
          <div className="grid grid-cols-2 gap-6 mb-6">
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
                    onChange={e => setFormData({...formData, plan: e.target.value as typeof formData.plan})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-pits-red outline-none"
                  >
                    <option value="unlimited">Unlimited</option>
                    <option value="3x_week">3x / Week</option>
                    <option value="4x_week">4x / Week</option>
                    <option value="5x_week">5x / Week</option>
                    <option value="open_box">Open Box</option>
                    <option value="crossfit_kids">CrossFit Kids</option>
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
            {(formData.role === 'coach' || formData.role === 'manager') && (
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
            disabled={loading}
            className={`w-full py-4 rounded-lg flex items-center justify-center text-white font-black uppercase tracking-widest text-sm shadow-lg
              ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-pits-red hover:bg-pits-red-dark shadow-red-200'}
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