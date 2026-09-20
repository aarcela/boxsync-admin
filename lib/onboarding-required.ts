/** Athlete onboarding required flags in tenants.settings.onboarding.required.
 * Keep in sync with app/constants/onboardingRequired.ts */

export const ONBOARDING_FIELD_IDS = [
  'fullName',
  'birthDate',
  'sex',
  'height',
  'weight',
  'phone',
  'instagram',
  'level',
  'years',
  'homeBox',
  'allergies',
  'medical',
  'injury',
  'emergencyName',
  'emergencyPhone',
] as const;

export type OnboardingFieldId = (typeof ONBOARDING_FIELD_IDS)[number];
export type OnboardingRequired = Record<OnboardingFieldId, boolean>;

export const LOCKED_ONBOARDING_FIELD_IDS = ['fullName', 'birthDate', 'sex'] as const;
export type LockedOnboardingFieldId = (typeof LOCKED_ONBOARDING_FIELD_IDS)[number];

/** Matches the current athlete app: identity + phone, training, health, emergency. */
export const DEFAULT_ONBOARDING_REQUIRED: OnboardingRequired = {
  fullName: true,
  birthDate: true,
  sex: true,
  height: false,
  weight: false,
  phone: true,
  instagram: false,
  level: true,
  years: true,
  homeBox: false,
  allergies: true,
  medical: true,
  injury: true,
  emergencyName: true,
  emergencyPhone: true,
};

export function isLockedOnboardingField(id: OnboardingFieldId): boolean {
  return (LOCKED_ONBOARDING_FIELD_IDS as readonly string[]).includes(id);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function boolFlag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function parseOnboardingRequired(settings: unknown): OnboardingRequired {
  const bag = asObject(asObject(asObject(settings)?.onboarding)?.required);
  const parsed = {} as OnboardingRequired;
  for (const id of ONBOARDING_FIELD_IDS) {
    parsed[id] = isLockedOnboardingField(id)
      ? true
      : boolFlag(bag?.[id], DEFAULT_ONBOARDING_REQUIRED[id]);
  }
  return parsed;
}

export function patchOnboardingRequiredSettings(
  settings: unknown,
  patch: Partial<OnboardingRequired>
): Record<string, unknown> {
  const current = asObject(settings) ?? {};
  const onboarding = { ...(asObject(current.onboarding) ?? {}) };
  const bag = { ...(asObject(onboarding.required) ?? {}) };
  for (const id of ONBOARDING_FIELD_IDS) {
    if (isLockedOnboardingField(id)) {
      bag[id] = true;
      continue;
    }
    const value = patch[id];
    if (typeof value === 'boolean') bag[id] = value;
  }
  return { ...current, onboarding: { ...onboarding, required: bag } };
}
