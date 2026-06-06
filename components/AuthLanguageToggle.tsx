'use client';

import { useLanguage } from './LanguageContext';

export function AuthLanguageToggle() {
  const { lang, setLanguage } = useLanguage();

  return (
    <div className="absolute top-6 right-6 flex items-center bg-pits-surface-elevated border border-gray-100 rounded-full p-1 shadow-sm">
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${
          lang === 'en' ? 'bg-pits-primary text-pits-dark-text shadow-sm' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage('es')}
        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${
          lang === 'es' ? 'bg-pits-primary text-pits-dark-text shadow-sm' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        ES
      </button>
    </div>
  );
}
