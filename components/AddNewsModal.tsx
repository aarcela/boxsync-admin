import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Loader2, Send, Megaphone } from 'lucide-react';

interface CreateNewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TAGS = ['INFO', 'ALERT', 'EVENT'];

export default function CreateNewsModal({ isOpen, onClose, onSuccess }: CreateNewsModalProps) {
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

      onSuccess();
      onClose();
      setTitle(''); // Reset form
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create news';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-black text-lg text-pits-text uppercase italic tracking-tighter flex items-center">
            <Megaphone size={18} className="mr-2 text-pits-red" />
            Broadcast News
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
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
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-pits-red outline-none"
              placeholder="e.g. Gym Closed on Sunday"
              maxLength={60}
            />
            <p className="text-[10px] text-gray-400 mt-1 text-right">
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
                  className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider border
                    ${tag === t 
                      ? t === 'ALERT' ? 'bg-red-100 border-red-500 text-red-700' 
                      : t === 'EVENT' ? 'bg-blue-100 border-blue-500 text-blue-700'
                      : 'bg-gray-200 border-gray-400 text-gray-700'
                      : 'bg-white border-gray-200 text-gray-400'
                    }
                  `}
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
              className={`w-full py-4 rounded-lg flex items-center justify-center text-white font-black uppercase tracking-widest text-sm shadow-lg
                ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-pits-text hover:bg-black shadow-gray-300'}
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