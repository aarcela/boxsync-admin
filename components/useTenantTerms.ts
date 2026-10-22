'use client';

import { useMemo, useSyncExternalStore } from 'react';
import {
  getPublishedTenantSettings,
  getTenantTermsVersion,
  parseTenantTerms,
  subscribeTenantTerms,
  type TenantTerms,
} from '@/lib/tenant-terms';
import { useLanguage } from './LanguageContext';

export function useTenantTerms(): TenantTerms {
  const { lang } = useLanguage();
  const version = useSyncExternalStore(
    subscribeTenantTerms,
    getTenantTermsVersion,
    getTenantTermsVersion
  );

  return useMemo(
    () => parseTenantTerms(getPublishedTenantSettings(), lang),
    [lang, version]
  );
}
