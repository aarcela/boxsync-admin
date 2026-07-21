export enum CurrencyType {
  EUR = 'EUR',
  USD = 'USD',
  VES = 'VES',
}

export type TenantCurrencyConfig = {
  reference: CurrencyType;
  local: CurrencyType;
};

export const DEFAULT_TENANT_CURRENCIES: TenantCurrencyConfig = {
  reference: CurrencyType.EUR,
  local: CurrencyType.VES,
};

export const CURRENCY_SYMBOLS: Record<CurrencyType, string> = {
  [CurrencyType.EUR]: '€',
  [CurrencyType.USD]: '$',
  [CurrencyType.VES]: 'Bs.',
};

export const REFERENCE_CURRENCY_OPTIONS: CurrencyType[] = [
  CurrencyType.EUR,
  CurrencyType.USD,
];

export const LOCAL_CURRENCY_OPTIONS: CurrencyType[] = [
  CurrencyType.VES,
  CurrencyType.USD,
  CurrencyType.EUR,
];

export function isCurrencyType(value: unknown): value is CurrencyType {
  return (
    value === CurrencyType.EUR ||
    value === CurrencyType.USD ||
    value === CurrencyType.VES
  );
}

export function parseTenantCurrencyConfig(
  settings: unknown
): TenantCurrencyConfig {
  const raw =
    settings && typeof settings === 'object'
      ? (settings as Record<string, unknown>).currencies
      : null;

  const currencies =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;

  const reference = isCurrencyType(currencies?.reference)
    ? currencies.reference
    : DEFAULT_TENANT_CURRENCIES.reference;
  let local = isCurrencyType(currencies?.local)
    ? currencies.local
    : DEFAULT_TENANT_CURRENCIES.local;

  if (local === reference) {
    local =
      reference === CurrencyType.VES
        ? CurrencyType.EUR
        : DEFAULT_TENANT_CURRENCIES.local;
    if (local === reference) {
      local = CurrencyType.USD;
    }
  }

  return { reference, local };
}

export function currencySymbol(code: CurrencyType | string): string {
  if (isCurrencyType(code)) return CURRENCY_SYMBOLS[code];
  return code;
}

export function currencyOptionLabel(
  code: CurrencyType,
  role: 'reference' | 'local'
): string {
  const symbol = CURRENCY_SYMBOLS[code];
  if (role === 'reference') return `REF (${code} ${symbol})`;
  return `${code} (${symbol})`;
}

export function isLocalCurrency(
  code: string | null | undefined,
  config: TenantCurrencyConfig
): boolean {
  return code === config.local;
}

export function exchangeRateEndpoint(reference: CurrencyType): string {
  if (reference === CurrencyType.USD) {
    return 'https://ve.dolarapi.com/v1/dolares/oficial';
  }
  return 'https://ve.dolarapi.com/v1/euros/oficial';
}
