'use client';

import { useEffect, useState } from 'react';
import { Loader2, UserPlus, X } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import {
  guestService,
  GuestAthleteOption,
} from '@/lib/services/guestService';

interface AddGuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: {
    fullName?: string;
    whatsapp?: string;
    instagram?: string;
    guestAthleteId?: string;
  }) => Promise<void>;
  adding?: boolean;
  excludedGuestIds?: string[];
}

export default function AddGuestModal({
  isOpen,
  onClose,
  onSubmit,
  adding = false,
  excludedGuestIds = [],
}: AddGuestModalProps) {
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [recent, setRecent] = useState<GuestAthleteOption[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setFullName('');
      setWhatsapp('');
      setInstagram('');
      setError(null);
      return;
    }

    const load = async () => {
      setLoadingRecent(true);
      try {
        const guests = await guestService.listRecent();
        setRecent(guests);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingRecent(false);
      }
    };
    void load();
  }, [isOpen]);

  if (!isOpen) return null;

  const excluded = new Set(excludedGuestIds);
  const reusable = recent.filter((g) => !excluded.has(g.id));
  const hasContact = Boolean(whatsapp.trim() || instagram.trim());

  const handleCreate = async () => {
    const name = fullName.trim();
    if (!name) {
      setError(t('Guest name is required'));
      return;
    }
    setError(null);
    await onSubmit({
      fullName: name,
      whatsapp: whatsapp.trim() || undefined,
      instagram: instagram.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-pits-background/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-pits-surface-elevated border border-pits-edge rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-pits-edge flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-pits-text uppercase italic tracking-tight">
              {t('Add Guest')}
            </h3>
            <p className="text-xs text-pits-dim font-medium mt-0.5">
              {t('Add a trial or invited guest to this class.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-pits-surface-muted text-pits-dim hover:text-pits-ink transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-pits-dim mb-1.5">
              {t('Name')} *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('Guest full name')}
              autoFocus
              className="w-full px-3 py-2.5 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm font-medium text-pits-ink placeholder:text-pits-ink-muted/60 focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-pits-dim mb-1.5">
                WhatsApp
              </label>
              <input
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+58..."
                className="w-full px-3 py-2.5 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm font-medium text-pits-ink placeholder:text-pits-ink-muted/60 focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-pits-dim mb-1.5">
                Instagram
              </label>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@handle"
                className="w-full px-3 py-2.5 bg-pits-surface-muted border border-pits-edge rounded-lg text-sm font-medium text-pits-ink placeholder:text-pits-ink-muted/60 focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary outline-none"
              />
            </div>
          </div>

          {!hasContact ? (
            <p className="text-[11px] text-pits-dim font-medium">
              {t('Add WhatsApp or Instagram so staff can reach this guest.')}
            </p>
          ) : null}

          {error ? (
            <p className="text-xs text-red-600 font-semibold">{error}</p>
          ) : null}

          <button
            type="button"
            disabled={adding}
            onClick={() => void handleCreate()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-pits-red text-white text-xs font-black uppercase tracking-wider disabled:opacity-60"
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            {t('Add to class')}
          </button>

          <div className="pt-2 border-t border-pits-edge">
            <p className="text-[10px] font-black uppercase tracking-wider text-pits-dim mb-2">
              {t('Recent guests')}
            </p>
            {loadingRecent ? (
              <p className="text-xs text-pits-dim">{t('Loading...')}</p>
            ) : reusable.length === 0 ? (
              <p className="text-xs text-pits-dim">{t('No recent guests yet.')}</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {reusable.map((guest) => (
                  <button
                    key={guest.id}
                    type="button"
                    disabled={adding}
                    onClick={() =>
                      void onSubmit({ guestAthleteId: guest.id })
                    }
                    className="w-full text-left px-3 py-2 rounded-lg border border-pits-edge hover:bg-pits-surface-muted transition-colors disabled:opacity-60"
                  >
                    <p className="text-sm font-bold text-pits-text">{guest.full_name}</p>
                    <p className="text-[10px] text-pits-dim mt-0.5 truncate">
                      {[guest.whatsapp, guest.instagram].filter(Boolean).join(' · ') ||
                        t('No contact saved')}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
