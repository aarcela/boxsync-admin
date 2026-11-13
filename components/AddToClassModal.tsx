'use client';

import { useEffect, useState } from 'react';
import { X, Search, Loader2, UserPlus } from 'lucide-react';
import { athleteService } from '@/lib/services/athleteService';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';

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
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const [members, setMembers] = useState<AthleteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setPickedId(null);
      return;
    }
    if (!tenantId) return;

    const fetchMembers = async () => {
      setLoading(true);
      try {
        setMembers(await athleteService.getBookableMembers(tenantId));
      } catch (error) {
        console.error('Fetch members error:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchMembers();
  }, [isOpen, tenantId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !adding) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, adding, onClose]);

  if (!isOpen) return null;

  const excluded = new Set(excludedUserIds);
  const available = members.filter((m) => !excluded.has(m.id));
  const term = searchTerm.trim().toLowerCase();
  const filtered = term ? available.filter((m) => m.full_name.toLowerCase().includes(term)) : available;

  const pick = (id: string) => {
    if (adding) return;
    setPickedId(id);
    onSelect(id);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-pits-background/50 sm:p-4 backdrop-blur-sm"
      onClick={() => !adding && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-athlete-title"
        className="bg-pits-surface-elevated border border-pits-edge rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-pits-edge flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 id="add-athlete-title" className="text-lg font-bold text-pits-text">
              {t('Add Athlete')}
            </h3>
            <p className="text-xs text-pits-dim mt-0.5">{t('Pick who to book into this class.')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={adding}
            aria-label={t('Close')}
            className="h-11 w-11 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-lg hover:bg-pits-surface-muted text-pits-dim hover:text-pits-text transition-colors disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-3 sm:p-4 border-b border-pits-edge">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pits-dim" size={16} />
            <input
              type="search"
              placeholder={t('Search by name...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label={t('Search by name...')}
              className="w-full h-11 pl-9 pr-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm text-pits-text placeholder:text-pits-dim focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none transition-all"
              autoFocus
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {loading ? (
            <div className="p-8 flex flex-col items-center text-pits-dim">
              <Loader2 size={24} className="animate-spin mb-2" />
              <span className="text-sm">{t('Loading members...')}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-pits-dim text-sm">
              {available.length === 0
                ? t('Everyone is already in this class.')
                : t('No one matches "{{term}}".', { term: searchTerm.trim() })}
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((member) => {
                const busy = adding && pickedId === member.id;
                return (
                  <li key={member.id}>
                    <button
                      type="button"
                      onClick={() => pick(member.id)}
                      disabled={adding}
                      className="w-full min-h-12 flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-pits-surface-muted border border-transparent hover:border-pits-edge transition-all text-left disabled:opacity-50"
                    >
                      <div className="w-9 h-9 rounded-full bg-pits-surface-muted border border-pits-edge flex items-center justify-center text-xs font-bold text-pits-dim overflow-hidden shrink-0">
                        {member.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          member.full_name?.charAt(0)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-pits-text text-sm truncate">{member.full_name}</p>
                        {!member.is_solvent && (
                          <span className="text-xs font-semibold text-pits-warning">{t('Payment pending')}</span>
                        )}
                      </div>
                      {busy ? (
                        <Loader2 size={16} className="animate-spin text-pits-dim shrink-0" />
                      ) : (
                        <UserPlus size={16} className="text-pits-primary shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
