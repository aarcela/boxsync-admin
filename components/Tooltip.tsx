'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  /** Prefer `right` for sidebar items so tips do not cover the label. */
  side?: 'top' | 'right' | 'bottom';
  /** Wider bubble for multi-sentence policy hints. */
  wide?: boolean;
  className?: string;
}

const bubbleClass =
  'px-2.5 py-1.5 bg-pits-ink text-pits-shell-ink text-[10px] font-bold tracking-wide rounded pointer-events-none w-max whitespace-normal leading-snug';

export default function Tooltip({
  children,
  content,
  side = 'top',
  wide = false,
  className = '',
}: TooltipProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open || side !== 'right') return;
    const hide = () => setOpen(false);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [open, side]);

  if (!content) {
    return <>{children}</>;
  }

  const maxWidth = wide ? 'max-w-[280px]' : 'max-w-[220px]';

  const showRight = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({ top: rect.top + rect.height / 2, left: rect.right + 8 });
    setOpen(true);
  };

  if (side === 'right') {
    return (
      <div
        ref={triggerRef}
        className={`flex items-center min-w-0 ${className}`}
        onMouseEnter={showRight}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
        {open && coords && typeof document !== 'undefined'
          ? createPortal(
              <div
                className={`fixed z-[80] ${bubbleClass} ${maxWidth}`}
                style={{ top: coords.top, left: coords.left, transform: 'translateY(-50%)' }}
              >
                {content}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-y-[5px] border-y-transparent border-r-[5px] border-r-pits-ink" />
              </div>,
              document.body
            )
          : null}
      </div>
    );
  }

  const positionClass =
    side === 'bottom'
      ? 'top-full left-0 mt-2 -translate-y-1 group-hover/tooltip:translate-y-0'
      : 'bottom-full left-1/2 -translate-x-1/2 mb-2 translate-y-1 group-hover/tooltip:translate-y-0';

  const arrowClass =
    side === 'bottom'
      ? 'bottom-full left-3 border-x-[5px] border-x-transparent border-b-[5px] border-b-pits-ink'
      : 'top-full left-1/2 -translate-x-1/2 border-x-[5px] border-x-transparent border-t-[5px] border-t-pits-ink';

  return (
    <div className={`relative group/tooltip flex items-center ${className}`}>
      {children}
      <div
        className={`absolute ${positionClass} ${bubbleClass} opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-[60] ${maxWidth}`}
      >
        {content}
        <div className={`absolute ${arrowClass}`} />
      </div>
    </div>
  );
}
