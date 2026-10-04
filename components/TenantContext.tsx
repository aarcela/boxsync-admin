'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import type { TenantCurrencyConfig } from '@/lib/currency';
import { DEFAULT_TENANT_CURRENCIES } from '@/lib/currency';
import {
  DEFAULT_PLATFORM_PLAN,
  parsePlatformPlanId,
  type PlatformPlanId,
} from '@/lib/platform-plans';
import { tenantCurrencyService } from '@/lib/services/tenantCurrencyService';
import {
  DEFAULT_TENANT_FEATURES,
  type TenantFeatures,
} from '@/lib/tenant-features';

export type TenantContextValue = {
  tenantId: string;
  slug: string;
  name: string;
  platformPlan: PlatformPlanId;
  trialEndsAt: string | null;
  currencies: TenantCurrencyConfig;
  setCurrencies: (next: TenantCurrencyConfig) => void;
  refreshCurrencies: () => Promise<TenantCurrencyConfig>;
  features: TenantFeatures;
  setFeatures: (next: TenantFeatures) => void;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({
  value,
  children,
}: {
  value: Omit<TenantContextValue, 'setCurrencies' | 'refreshCurrencies' | 'setFeatures'> & {
    currencies?: TenantCurrencyConfig;
    features?: TenantFeatures;
    platformPlan?: PlatformPlanId;
    trialEndsAt?: string | null;
  };
  children: React.ReactNode;
}) {
  const [currencies, setCurrencies] = useState<TenantCurrencyConfig>(
    value.currencies ?? DEFAULT_TENANT_CURRENCIES
  );
  const [features, setFeatures] = useState<TenantFeatures>(
    value.features ?? DEFAULT_TENANT_FEATURES
  );

  const refreshCurrencies = useCallback(async () => {
    const next = await tenantCurrencyService.getForTenant(value.tenantId);
    setCurrencies(next);
    return next;
  }, [value.tenantId]);

  return (
    <TenantContext.Provider
      value={{
        tenantId: value.tenantId,
        slug: value.slug,
        name: value.name,
        platformPlan: parsePlatformPlanId(value.platformPlan ?? DEFAULT_PLATFORM_PLAN),
        trialEndsAt: value.trialEndsAt ?? null,
        currencies,
        setCurrencies,
        refreshCurrencies,
        features,
        setFeatures,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useOptionalTenant(): TenantContextValue | null {
  return useContext(TenantContext);
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return ctx;
}
