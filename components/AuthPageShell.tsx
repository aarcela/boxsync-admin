'use client';

import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { AuthLanguageToggle } from '@/components/AuthLanguageToggle';

interface AuthPageShellProps {
  ready: boolean;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthPageShell({
  ready,
  title,
  subtitle,
  children,
}: AuthPageShellProps) {
  if (!ready) {
    return (
      <div className="min-h-screen bg-pits-surface flex items-center justify-center">
        <Loader2 className="animate-spin text-pits-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pits-surface flex items-center justify-center p-4 relative">
      <AuthLanguageToggle />

      <div className="max-w-md w-full bg-pits-surface-elevated rounded-2xl shadow-xl p-8 border border-pits-edge">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-pits-black rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg p-3 ring-1 ring-pits-edge">
            <Image
              src="/assets/logo.png"
              alt="WODUS"
              width={48}
              height={48}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-black text-pits-ink uppercase italic tracking-tighter">
            {title}
          </h1>
          <p className="text-pits-ink-muted text-xs font-bold uppercase tracking-widest mt-1">
            {subtitle}
          </p>
        </div>

        {children}
      </div>
    </div>
  );
}
