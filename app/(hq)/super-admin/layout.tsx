'use client';

import { useState } from 'react';
import Image from 'next/image';
import { LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/components/LanguageContext';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t, lang, setLanguage } = useLanguage();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-pits-surface">
      <header className="border-b border-pits-edge bg-pits-surface-elevated">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pits-black rounded-xl flex items-center justify-center p-2 ring-1 ring-pits-edge">
              <Image
                src="/assets/logo.png"
                alt="WODUS"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-black text-pits-ink uppercase italic tracking-tighter">
                {t('Platform HQ')}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-pits-ink-muted">
                {t('Platform command center')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-pits-surface-muted border border-pits-edge rounded-full p-1">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${
                  lang === 'en'
                    ? 'bg-pits-primary text-pits-dark-text shadow-sm'
                    : 'text-pits-ink-muted hover:text-pits-ink'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('es')}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${
                  lang === 'es'
                    ? 'bg-pits-primary text-pits-dark-text shadow-sm'
                    : 'text-pits-ink-muted hover:text-pits-ink'
                }`}
              >
                ES
              </button>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pits-ink-muted hover:text-pits-primary transition-colors disabled:opacity-50"
            >
              <LogOut size={14} />
              {t('Log Out')}
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
