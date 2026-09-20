'use client';

import React from 'react';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  /** Prefer `right` for sidebar items so tips do not cover the label. */
  side?: 'top' | 'right' | 'bottom';
  /** Wider bubble for multi-sentence policy hints. */
  wide?: boolean;
  className?: string;
}

export default function Tooltip({
  children,
  content,
  side = 'top',
  wide = false,
  className = '',
}: TooltipProps) {
  if (!content) {
    return <>{children}</>;
  }

  const positionClass =
    side === 'right'
      ? 'left-full top-1/2 -translate-y-1/2 ml-2 translate-x-1 group-hover/tooltip:translate-x-0'
      : side === 'bottom'
        ? 'top-full left-0 mt-2 -translate-y-1 group-hover/tooltip:translate-y-0'
        : 'bottom-full left-1/2 -translate-x-1/2 mb-2 translate-y-1 group-hover/tooltip:translate-y-0';

  const arrowClass =
    side === 'right'
      ? 'right-full top-1/2 -translate-y-1/2 border-y-[5px] border-y-transparent border-r-[5px] border-r-pits-ink'
      : side === 'bottom'
        ? 'bottom-full left-3 border-x-[5px] border-x-transparent border-b-[5px] border-b-pits-ink'
        : 'top-full left-1/2 -translate-x-1/2 border-x-[5px] border-x-transparent border-t-[5px] border-t-pits-ink';

  return (
    <div className={`relative group/tooltip flex items-center ${className}`}>
      {children}
      <div
        className={`absolute ${positionClass} px-2.5 py-1.5 bg-pits-ink text-pits-shell-ink text-[10px] font-bold tracking-wide rounded opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-[60] pointer-events-none w-max ${wide ? 'max-w-[280px]' : 'max-w-[220px]'} whitespace-normal leading-snug`}
      >
        {content}
        <div className={`absolute ${arrowClass}`} />
      </div>
    </div>
  );
}
