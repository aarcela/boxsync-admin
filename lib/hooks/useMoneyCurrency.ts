'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useTenant } from '@/components/TenantContext';

/**
 * Which currency the Money pages show: the gym's reference or local currency.
 * One remembered choice for every Money tab (switch lives in the Money tab bar).
 */
type MoneyCurrencyMode = 'reference' | 'local';

const STORAGE_KEY = 'wodus-money-currency';
let listeners: Array<() => void> = [];

function subscribe(callback: () => void) {
  listeners.push(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
    window.removeEventListener('storage', onStorage);
  };
}

function readMode(): MoneyCurrencyMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'local' ? 'local' : 'reference';
  } catch {
    return 'reference';
  }
}

export function useMoneyCurrency() {
  const { currencies } = useTenant();
  const mode = useSyncExternalStore(subscribe, readMode, () => 'reference' as const);
  const hasTwo = currencies.local !== currencies.reference;
  const effective: MoneyCurrencyMode = hasTwo ? mode : 'reference';

  const setMode = useCallback((next: MoneyCurrencyMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // private mode: keep working for this session only
    }
    for (const l of listeners) l();
  }, []);

  const code = effective === 'local' ? currencies.local : currencies.reference;
  const setCode = useCallback(
    (next: string) => setMode(next === currencies.local && hasTwo ? 'local' : 'reference'),
    [currencies.local, hasTwo, setMode],
  );

  return { mode: effective, setMode, code, setCode, hasTwo, currencies };
}
