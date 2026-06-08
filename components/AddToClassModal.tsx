'use client';

import { useEffect, useState } from 'react';
import { X, Search, Loader2, UserPlus } from 'lucide-react';
import { athleteService } from '@/lib/services/athleteService';

interface AthleteOption {
  id: string;
  full_name: string;
  avatar_url: string | null;
  is_solvent: boolean;
}

interface AddToClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (userId: string) => void;
  excludedUserIds: string[];
  adding?: boolean;
}

export default function AddToClassModal({
  isOpen,
  onClose,
  onSelect,
  excludedUserIds,
  adding = false,
}: AddToClassModalProps) {
  const [members, setMembers] = useState<AthleteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      return;
    }

    const fetchMembers = async () => {
      setLoading(true);
      try {
        const data = await athleteService.getBookableMembers();
        setMembers(data);
      } catch (error) {
        console.error('Fetch members error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [isOpen]);

  if (!isOpen) return null;

  const excluded = new Set(excludedUserIds);
  const available = members.filter(m => !excluded.has(m.id));
  const filtered = available.filter(m =>
    m.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-pits-background/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-pits-surface-elevated border border-pits-edge rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-pits-edge flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-pits-text uppercase italic tracking-tight">
              Add Athlete
            </h3>
            <p className="text-xs text-pits-dim font-medium mt-0.5">
              Select a member to book into this class.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-pits-surface-muted text-pits-dim hover:text-pits-ink transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-pits-edge">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim" size={16} />
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm font-medium text-pits-ink placeholder:text-pits-ink-muted/60 focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none transition-all"
              autoFocus
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {loading ? (
            <div className="p-8 flex flex-col items-center text-pits-dim">
              <Loader2 size={24} className="animate-spin mb-2" />
              <span className="text-sm">Loading members...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-pits-dim text-sm">
              {available.length === 0
                ? 'All members are already booked for this class.'
                : 'No members match your search.'}
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((member) => (
                <button
                  key={member.id}
                  onClick={() => onSelect(member.id)}
                  disabled={adding}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-pits-surface-muted border border-transparent hover:border-pits-edge transition-all text-left disabled:opacity-50"
                >
                  <div className="w-9 h-9 rounded-full bg-pits-surface-muted border border-pits-edge flex items-center justify-center text-xs font-bold text-pits-dim overflow-hidden shrink-0">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      member.full_name?.charAt(0)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-pits-text text-sm truncate">{member.full_name}</p>
                    {!member.is_solvent && (
                      <span className="text-[10px] font-bold uppercase text-orange-400 tracking-wide">
                        Unpaid
                      </span>
                    )}
                  </div>
                  <UserPlus size={16} className="text-pits-red shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
