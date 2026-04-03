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
    icon: 'bg-red-50 text-red-600',
    button: 'bg-red-600 hover:bg-red-700 text-white shadow-red-200',
  },
  warning: {
    icon: 'bg-orange-50 text-orange-600',
    button: 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200',
  },
  default: {
    icon: 'bg-gray-100 text-gray-600',
    button: 'bg-pits-text hover:bg-black text-white shadow-gray-200',
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
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
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
        <div className="flex gap-3 p-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-pits-text font-bold text-xs uppercase tracking-widest hover:bg-gray-100 transition-all"
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
