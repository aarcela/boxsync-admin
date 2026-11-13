'use client';

import type { ReactNode } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';

/** Placeholder rows for a list or table body while it loads. */
export function ListSkeleton({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  const { t } = useLanguage();
  return (
    <div className={`divide-y divide-pits-edge ${className}`} aria-busy="true" role="status">
      <span className="sr-only">{t('Loading...')}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-4 animate-pulse">
          <div className="h-8 w-8 shrink-0 rounded-full bg-pits-surface-muted" />
          <div className="h-3 rounded bg-pits-surface-muted" style={{ width: `${40 - (i % 3) * 8}%` }} />
          <div className="ml-auto h-3 w-16 rounded bg-pits-surface-muted" />
        </div>
      ))}
    </div>
  );
}

/** Same placeholder rows for a <tbody>; spans every column. */
export function TableSkeleton({ rows = 3, columns }: { rows?: number; columns: number }) {
  return (
    <tr>
      <td colSpan={columns} className="p-0">
        <ListSkeleton rows={rows} />
      </td>
    </tr>
  );
}

/** One quiet spinner for a whole page or panel. */
export function PageLoader({ label, className = 'min-h-[40vh]' }: { label?: string; className?: string }) {
  const { t } = useLanguage();
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 text-pits-dim ${className}`} role="status">
      <Loader2 size={24} className="animate-spin text-pits-primary" aria-hidden />
      <p className="text-sm">{label ?? t('Loading...')}</p>
    </div>
  );
}

/** What to show when a list has nothing in it, with an optional next step. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className = '',
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void } | ReactNode;
  className?: string;
}) {
  const isButton = !!action && typeof action === 'object' && 'onClick' in (action as object);
  return (
    <div className={`flex flex-col items-center px-4 py-12 text-center ${className}`}>
      {Icon ? <Icon size={28} className="mb-3 text-pits-dim/60" aria-hidden /> : null}
      <p className="text-sm font-medium text-pits-text">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-sm text-pits-dim">{hint}</p> : null}
      {isButton ? (
        <button
          type="button"
          onClick={(action as { onClick: () => void }).onClick}
          className="mt-3 min-h-9 text-sm font-semibold text-pits-info hover:underline"
        >
          {(action as { label: string }).label}
        </button>
      ) : action ? (
        <div className="mt-3">{action as ReactNode}</div>
      ) : null}
    </div>
  );
}
