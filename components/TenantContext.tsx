'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import type { TenantCurrencyConfig } from '@/lib/currency';
import { DEFAULT_TENANT_CURRENCIES } from '@/lib/currency';
import { tenantCurrencyService } from '@/lib/services/tenantCurrencyService';

export type TenantContextValue = {
  tenantId: string;
  slug: string;
  name: string;
  currencies: TenantCurrencyConfig;
  setCurrencies: (next: TenantCurrencyConfig) => void;
  refreshCurrencies: () => Promise<TenantCurrencyConfig>;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({
  value,
  children,
}: {
  value: Omit<TenantContextValue, 'setCurrencies' | 'refreshCurrencies'> & {
    currencies?: TenantCurrencyConfig;
  };
  children: React.ReactNode;
}) {
  const [currencies, setCurrencies] = useState<TenantCurrencyConfig>(
    value.currencies ?? DEFAULT_TENANT_CURRENCIES
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
        currencies,
        setCurrencies,
        refreshCurrencies,
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
