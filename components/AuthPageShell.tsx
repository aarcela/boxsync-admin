'use client';

import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { AuthLanguageToggle } from '@/components/AuthLanguageToggle';

interface AuthPageShellProps {
  ready: boolean;
  title: string;
  /** Small lime label above the title. */
  subtitle?: string;
  /** Optional element shown above the eyebrow (e.g. a success badge). */
  badge?: React.ReactNode;
  children: React.ReactNode;
}

export function AuthPageLoading() {
  return (
    <div className="min-h-dvh bg-pits-black flex items-center justify-center">
      <Loader2 className="animate-spin text-pits-shell-accent" size={32} />
    </div>
  );
}

/** Dark lime-on-black auth layout: full-screen on phones, card on sm+. */
export function AuthPageShell({ ready, title, subtitle, badge, children }: AuthPageShellProps) {
  if (!ready) return <AuthPageLoading />;

  return (
    <div className="min-h-dvh bg-pits-black flex items-start sm:items-center justify-center px-5 pt-24 pb-10 sm:p-6 relative">
      <AuthLanguageToggle variant="dark" />

      <div className="w-full max-w-md sm:bg-pits-shell sm:border sm:border-pits-shell-edge sm:rounded-3xl sm:overflow-hidden">
        <div className="hidden sm:block h-1 bg-pits-shell-accent" />
        <div className="sm:p-10">
          <div className="mb-8">
            {badge ?? (
              <div className="w-14 h-14 bg-pits-black rounded-2xl flex items-center justify-center mb-6 p-2.5 ring-1 ring-pits-shell-edge">
                <Image
                  src="/assets/logo.png"
                  alt="WODUS"
                  width={48}
                  height={48}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
            )}
            {subtitle ? (
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-pits-shell-accent mb-2">
                {subtitle}
              </p>
            ) : null}
            <h1 className="text-3xl font-black text-pits-shell-ink uppercase italic tracking-tight leading-tight break-words">
              {title}
            </h1>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
