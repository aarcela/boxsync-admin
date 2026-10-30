'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import type { TenantCurrencyConfig } from '@/lib/currency';
import { DEFAULT_TENANT_CURRENCIES } from '@/lib/currency';
import {
  DEFAULT_PLATFORM_PLAN,
  isTrialExpired,
  parsePlatformPlanId,
  type PlatformPlanId,
} from '@/lib/platform-plans';
import type { SignupSource } from '@/lib/types/gym';
import { tenantCurrencyService } from '@/lib/services/tenantCurrencyService';
import {
  DEFAULT_TENANT_FEATURES,
  type TenantFeatures,
} from '@/lib/tenant-features';
import { publishTenantSettings } from '@/lib/tenant-terms';

export type TenantContextValue = {
  tenantId: string;
  slug: string;
  name: string;
  platformPlan: PlatformPlanId;
  trialEndsAt: string | null;
  staffReadOnly: boolean;
  signupSource: SignupSource;
  currencies: TenantCurrencyConfig;
  setCurrencies: (next: TenantCurrencyConfig) => void;
  refreshCurrencies: () => Promise<TenantCurrencyConfig>;
  features: TenantFeatures;
  setFeatures: (next: TenantFeatures) => void;
  settings: unknown;
  setSettings: (next: unknown) => void;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({
  value,
  children,
}: {
  value: Omit<
    TenantContextValue,
    | 'setCurrencies'
    | 'refreshCurrencies'
    | 'setFeatures'
    | 'setSettings'
    | 'staffReadOnly'
  > & {
    currencies?: TenantCurrencyConfig;
    features?: TenantFeatures;
    platformPlan?: PlatformPlanId;
    trialEndsAt?: string | null;
    signupSource?: SignupSource;
    settings?: unknown;
  };
  children: ReactNode;
}) {
  const [currencies, setCurrencies] = useState<TenantCurrencyConfig>(
    value.currencies ?? DEFAULT_TENANT_CURRENCIES
  );
  const [features, setFeatures] = useState<TenantFeatures>(
    value.features ?? DEFAULT_TENANT_FEATURES
  );
  const [settings, setSettings] = useState<unknown>(value.settings ?? null);

  useLayoutEffect(() => {
    publishTenantSettings(settings);
  }, [settings]);

  useEffect(() => {
    return () => {
      publishTenantSettings(null);
    };
  }, []);

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
        staffReadOnly: isTrialExpired(
          parsePlatformPlanId(value.platformPlan ?? DEFAULT_PLATFORM_PLAN),
          value.trialEndsAt ?? null
        ),
        signupSource: value.signupSource === 'self_serve' ? 'self_serve' : 'hq',
        currencies,
        setCurrencies,
        refreshCurrencies,
        features,
        setFeatures,
        settings,
        setSettings,
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
