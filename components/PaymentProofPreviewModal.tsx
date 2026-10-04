'use client';

import { X } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';

export default function PaymentProofPreviewModal({
  url,
  athleteName,
  onClose,
}: {
  url: string | null;
  athleteName?: string | null;
  onClose: () => void;
}) {
  const { t } = useLanguage();

  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-pits-background/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-pits-surface-elevated border border-pits-edge rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center gap-3 p-4 sm:p-5 border-b border-pits-edge">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-black text-pits-text uppercase italic tracking-tight truncate">
              {t('Check Proof')}
            </h3>
            {athleteName ? (
              <p className="text-pits-dim text-[10px] font-bold uppercase tracking-widest mt-1 truncate">
                {athleteName}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-pits-surface-muted border border-pits-edge text-pits-dim hover:text-pits-primary hover:border-pits-primary/40 transition-all shrink-0"
            aria-label={t('Close')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-pits-surface-muted/40 flex items-center justify-center min-h-[240px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={t('Check Proof')}
            className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm"
          />
        </div>

        <div className="p-4 border-t border-pits-edge bg-pits-surface-muted flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-pits-surface-elevated border border-pits-edge text-pits-text font-black text-xs uppercase tracking-widest rounded-xl hover:bg-pits-edge transition-all shadow-sm"
          >
            {t('Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
