'use client';

import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_STYLES = {
  danger: {
    icon: 'bg-red-950/40 text-red-400',
    button: 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/30',
  },
  warning: {
    icon: 'bg-orange-950/40 text-orange-400',
    button: 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-900/30',
  },
  default: {
    icon: 'bg-pits-surface-muted text-pits-dim',
    button: 'bg-pits-primary hover:bg-pits-primary-dark text-pits-dark-text shadow-pits-primary/20',
  },
};

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-pits-background/50 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-pits-surface-elevated border border-pits-edge rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 text-center">
          <div className={`w-14 h-14 rounded-full ${styles.icon} flex items-center justify-center mx-auto mb-4`}>
            <AlertTriangle size={28} />
          </div>
          <h3 className="text-lg font-black text-pits-text uppercase italic tracking-tight mb-2">
            {title}
          </h3>
          <p className="text-sm text-pits-dim font-medium leading-relaxed">
            {message}
          </p>
        </div>
        <div className="flex gap-3 p-4 bg-pits-surface-muted border-t border-pits-edge">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-pits-surface-elevated border border-pits-edge text-pits-text font-bold text-xs uppercase tracking-widest hover:bg-pits-edge transition-all"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 ${styles.button}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
