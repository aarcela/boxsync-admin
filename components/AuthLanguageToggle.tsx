'use client';

import { useLanguage } from './LanguageContext';

export function AuthLanguageToggle({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { lang, setLanguage } = useLanguage();
  const isDark = variant === 'dark';
  const shell = isDark
    ? 'bg-pits-shell border border-pits-shell-edge'
    : 'bg-pits-surface-elevated border border-gray-100 shadow-sm';
  const active = isDark
    ? 'bg-pits-shell-accent text-pits-dark-text'
    : 'bg-pits-primary text-pits-dark-text shadow-sm';
  const idle = isDark
    ? 'text-pits-shell-ink-muted hover:text-pits-shell-ink'
    : 'text-gray-400 hover:text-gray-600';

  return (
    <div className={`absolute top-6 right-6 flex items-center rounded-full p-1 ${shell}`}>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        aria-pressed={lang === 'en'}
        className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-tighter transition-all ${
          lang === 'en' ? active : idle
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage('es')}
        aria-pressed={lang === 'es'}
        className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-tighter transition-all ${
          lang === 'es' ? active : idle
        }`}
      >
        ES
      </button>
    </div>
  );
}
