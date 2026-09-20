/** Box modules in tenants.settings.features. Keep in sync with app/constants/tenantFeatures.ts */

export const TENANT_FEATURE_IDS = [
  'wod',
  'personalRecords',
  'community',
  'attendance',
] as const;
export type TenantFeatureId = (typeof TENANT_FEATURE_IDS)[number];

export type TenantFeatures = Record<TenantFeatureId, boolean>;

/** Missing keys stay on so existing boxes keep current modules. */
export const DEFAULT_TENANT_FEATURES: TenantFeatures = {
  wod: true,
  personalRecords: true,
  community: true,
  attendance: true,
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function boolFlag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function parseTenantFeatures(settings: unknown): TenantFeatures {
  const bag = asObject(asObject(settings)?.features);
  return {
    wod: boolFlag(bag?.wod, DEFAULT_TENANT_FEATURES.wod),
    personalRecords: boolFlag(bag?.personalRecords, DEFAULT_TENANT_FEATURES.personalRecords),
    community: boolFlag(bag?.community, DEFAULT_TENANT_FEATURES.community),
    attendance: boolFlag(bag?.attendance, DEFAULT_TENANT_FEATURES.attendance),
  };
}

export function patchTenantFeaturesSettings(
  settings: unknown,
  patch: Partial<TenantFeatures>
): Record<string, unknown> {
  const current = asObject(settings) ?? {};
  const bag = { ...(asObject(current.features) ?? {}) };
  for (const id of TENANT_FEATURE_IDS) {
    const value = patch[id];
    if (typeof value === 'boolean') bag[id] = value;
  }
  return { ...current, features: bag };
}
