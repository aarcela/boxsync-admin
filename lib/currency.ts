export enum CurrencyType {
  EUR = 'EUR',
  USD = 'USD',
  GBP = 'GBP',
  VES = 'VES',
  COP = 'COP',
  MXN = 'MXN',
  ARS = 'ARS',
  CLP = 'CLP',
  PEN = 'PEN',
  BRL = 'BRL',
}

export type TenantCurrencyConfig = {
  reference: string;
  local: string;
};

export const DEFAULT_TENANT_CURRENCIES: TenantCurrencyConfig = {
  reference: CurrencyType.USD,
  local: CurrencyType.VES,
};

export type ExchangeRateSource = 'oficial' | 'paralelo' | 'custom';

export type TenantExchangeRateConfig = {
  baseSource: ExchangeRateSource;
  marginPercent: number;
  customRate: number | null;
};

export const DEFAULT_EXCHANGE_RATE_CONFIG: TenantExchangeRateConfig = {
  baseSource: 'oficial',
  marginPercent: 0,
  customRate: null,
};

export const CUSTOM_CURRENCY_VALUE = '__custom__';

export const CURRENCY_SYMBOLS: Record<CurrencyType, string> = {
  [CurrencyType.EUR]: '€',
  [CurrencyType.USD]: '$',
  [CurrencyType.GBP]: '£',
  [CurrencyType.VES]: 'Bs.',
  [CurrencyType.COP]: '$',
  [CurrencyType.MXN]: '$',
  [CurrencyType.ARS]: '$',
  [CurrencyType.CLP]: '$',
  [CurrencyType.PEN]: 'S/',
  [CurrencyType.BRL]: 'R$',
};

export const CURRENCY_NAMES: Record<CurrencyType, string> = {
  [CurrencyType.USD]: 'US Dollar',
  [CurrencyType.EUR]: 'Euro',
  [CurrencyType.GBP]: 'Pound (Libra)',
  [CurrencyType.VES]: 'Bolívar',
  [CurrencyType.COP]: 'Colombian peso',
  [CurrencyType.MXN]: 'Mexican peso',
  [CurrencyType.ARS]: 'Argentine peso',
  [CurrencyType.CLP]: 'Chilean peso',
  [CurrencyType.PEN]: 'Peruvian sol',
  [CurrencyType.BRL]: 'Brazilian real',
};

export const REFERENCE_CURRENCY_OPTIONS: string[] = [
  CurrencyType.USD,
  CurrencyType.EUR,
];

export const LOCAL_CURRENCY_OPTIONS: string[] = [
  CurrencyType.VES,
  CurrencyType.COP,
  CurrencyType.MXN,
  CurrencyType.ARS,
  CurrencyType.CLP,
  CurrencyType.PEN,
  CurrencyType.BRL,
  CurrencyType.GBP,
];

export function isCurrencyType(value: unknown): value is CurrencyType {
  return (
    typeof value === 'string' &&
    (Object.values(CurrencyType) as string[]).includes(value)
  );
}

export function isCurrencyCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value);
}

export function normalizeCurrencyCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  return isCurrencyCode(code) ? code : null;
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

  const reference = isCurrencyCode(currencies?.reference)
    ? currencies.reference
    : DEFAULT_TENANT_CURRENCIES.reference;
  let local = isCurrencyCode(currencies?.local)
    ? currencies.local
    : DEFAULT_TENANT_CURRENCIES.local;

  if (local === reference) {
    local =
      reference === CurrencyType.VES
        ? CurrencyType.USD
        : DEFAULT_TENANT_CURRENCIES.local;
    if (local === reference) {
      local = CurrencyType.EUR;
    }
  }

  return { reference, local };
}

export function currencySymbol(code: CurrencyType | string): string {
  if (isCurrencyType(code)) return CURRENCY_SYMBOLS[code];
  return code;
}

export function currencyOptionLabel(
  code: string,
  role: 'reference' | 'local'
): string {
  const symbol = currencySymbol(code);
  const name = isCurrencyType(code) ? CURRENCY_NAMES[code] : code;
  if (role === 'reference') return `${name} (${code} ${symbol})`;
  return `${name} (${code} ${symbol})`;
}

export function isLocalCurrency(
  code: string | null | undefined,
  config: TenantCurrencyConfig
): boolean {
  return code === config.local;
}

export function supportsLiveFx(config: TenantCurrencyConfig): boolean {
  return (
    config.local === CurrencyType.VES &&
    (config.reference === CurrencyType.USD || config.reference === CurrencyType.EUR)
  );
}

export function exchangeRateEndpoint(
  reference: string,
  source: Exclude<ExchangeRateSource, 'custom'> | 'bcv' = 'oficial'
): string {
  const currencySegment = reference === CurrencyType.USD ? 'dolares' : 'euros';
  const sourceSegment = source === 'paralelo' ? 'paralelo' : 'oficial';
  return `https://ve.dolarapi.com/v1/${currencySegment}/${sourceSegment}`;
}

export function parseExchangeRateSource(value: unknown): ExchangeRateSource {
  if (value === 'paralelo') return 'paralelo';
  if (value === 'custom') return 'custom';
  return 'oficial';
}

export function parseTenantExchangeRateConfig(settings: unknown): TenantExchangeRateConfig {
  const raw =
    settings && typeof settings === 'object'
      ? (settings as Record<string, unknown>).exchangeRate
      : null;

  const config = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  const baseSource = parseExchangeRateSource(config?.baseSource);
  const marginPercent =
    typeof config?.marginPercent === 'number' ? config.marginPercent : DEFAULT_EXCHANGE_RATE_CONFIG.marginPercent;
  const customRate =
    typeof config?.customRate === 'number' && Number.isFinite(config.customRate) && config.customRate > 0
      ? config.customRate
      : null;

  return { baseSource, marginPercent, customRate };
}

export function applyRateMargin(baseRate: number, marginPercent: number): number {
  return baseRate * (1 + (Number.isFinite(marginPercent) ? marginPercent : 0) / 100);
}

export function computeEffectiveRate(
  config: TenantExchangeRateConfig,
  fetchedPromedio: number | null | undefined
): number | null {
  if (config.baseSource === 'custom') {
    return config.customRate && config.customRate > 0 ? config.customRate : null;
  }
  if (fetchedPromedio == null || !Number.isFinite(fetchedPromedio) || fetchedPromedio <= 0) {
    return null;
  }
  return applyRateMargin(fetchedPromedio, config.marginPercent);
}

export function defaultCurrencyForMethodType(
  methodType: string,
  currencies: TenantCurrencyConfig
): string {
  if (methodType === 'pago_movil' || methodType === 'efectivo') return currencies.local;
  if (methodType === 'zelle' || methodType === 'binance') return currencies.reference;
  return currencies.reference;
}
