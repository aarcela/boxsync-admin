'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { translations, Language, TranslationKey } from '../lib/translations';

interface LanguageContextType {
  lang: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'language';

let languageListeners: Array<() => void> = [];

function subscribeToLanguage(callback: () => void) {
  languageListeners.push(callback);
  return () => {
    languageListeners = languageListeners.filter((listener) => listener !== callback);
  };
}

function emitLanguageChange() {
  for (const listener of languageListeners) {
    listener();
  }
}

function readStoredLanguage(): Language {
  const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
  if (savedLang === 'en' || savedLang === 'es') {
    return savedLang;
  }

  const browserLang = navigator.language.split('-')[0];
  return browserLang === 'es' ? 'es' : 'en';
}

function getServerLanguageSnapshot(): Language {
  return 'en';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const lang = useSyncExternalStore(
    subscribeToLanguage,
    readStoredLanguage,
    getServerLanguageSnapshot
  );

  const setLanguage = useCallback((newLang: Language) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
    emitLanguageChange();
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      let text = translations[lang][key] || translations.en[key] || key;

      if (params) {
        Object.entries(params).forEach(([param, value]) => {
          text = text.replace(`{{${param}}}`, String(value));
        });
      }

      return text;
    },
    [lang]
  );

  const value = useMemo(
    () => ({
      lang,
      setLanguage,
      t,
    }),
    [lang, setLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
