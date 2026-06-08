import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Loader2, Send, Megaphone } from 'lucide-react';
import { useToast } from './Toast';

interface CreateNewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TAGS = ['INFO', 'ALERT', 'EVENT'];

const inputClass =
  'w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm font-medium text-pits-ink placeholder:text-pits-ink-muted/60 focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary transition-all outline-none';

export default function CreateNewsModal({ isOpen, onClose, onSuccess }: CreateNewsModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState('INFO');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('news').insert({
        title,
        tag,
        is_active: true
      });

      if (error) throw error;

      toast('News posted successfully', 'success');
      onSuccess();
      onClose();
      setTitle('');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create news';
      toast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const tagButtonClass = (t: string) => {
    if (tag !== t) {
      return 'bg-pits-surface-elevated border-pits-edge text-pits-dim';
    }
    if (t === 'ALERT') return 'bg-red-950/40 border-red-500 text-red-400';
    if (t === 'EVENT') return 'bg-blue-950/40 border-blue-500 text-blue-400';
    return 'bg-pits-primary-soft border-pits-primary text-pits-primary';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pits-background/50 backdrop-blur-sm">
      <div className="bg-pits-surface-elevated border border-pits-edge rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        
        <div className="px-6 py-4 border-b border-pits-edge flex justify-between items-center">
          <h3 className="font-black text-lg text-pits-text uppercase italic tracking-tighter flex items-center">
            <Megaphone size={18} className="mr-2 text-pits-red" />
            Broadcast News
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-pits-surface-muted rounded-full text-pits-dim hover:text-pits-ink transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div>
            <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
              Headline
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={inputClass}
              placeholder="e.g. Gym Closed on Sunday"
              maxLength={60}
            />
            <p className="text-[10px] text-pits-ink-muted mt-1 text-right">
              {title.length}/60 chars
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-pits-dim uppercase tracking-wider mb-2">
              Type
            </label>
            <div className="flex gap-2">
              {TAGS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(t)}
                  className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider border transition-all ${tagButtonClass(t)}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-lg flex items-center justify-center text-pits-dark-text font-black uppercase tracking-widest text-sm shadow-lg transition-all
                ${loading ? 'bg-pits-gunmetal cursor-not-allowed' : 'bg-pits-primary hover:bg-pits-primary-dark shadow-pits-primary/20'}
              `}
            >
              {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : <Send size={18} className="mr-2" />}
              Post Update
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
