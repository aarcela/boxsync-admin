/** Owner overdue access policy in tenants.settings.overdue. */

export type OverdueMode = 'allow' | 'warn' | 'block';

export type OverdueSettings = {
  graceDays: number;
  checkinMode: OverdueMode;
  bookingMode: OverdueMode;
};

export const DEFAULT_OVERDUE_SETTINGS: OverdueSettings = {
  graceDays: 3,
  checkinMode: 'warn',
  bookingMode: 'warn',
};

export const OVERDUE_GRACE_MIN = 0;
export const OVERDUE_GRACE_MAX = 15;
export const OVERDUE_MODES: OverdueMode[] = ['allow', 'warn', 'block'];

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function graceDaysFlag(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(OVERDUE_GRACE_MAX, Math.max(OVERDUE_GRACE_MIN, Math.floor(value)));
}

function modeFlag(value: unknown, fallback: OverdueMode): OverdueMode {
  if (value === 'allow' || value === 'warn' || value === 'block') return value;
  return fallback;
}

export function parseOverdueSettings(settings: unknown): OverdueSettings {
  const bag = asObject(asObject(settings)?.overdue);
  return {
    graceDays: graceDaysFlag(bag?.graceDays, DEFAULT_OVERDUE_SETTINGS.graceDays),
    checkinMode: modeFlag(bag?.checkinMode, DEFAULT_OVERDUE_SETTINGS.checkinMode),
    bookingMode: modeFlag(bag?.bookingMode, DEFAULT_OVERDUE_SETTINGS.bookingMode),
  };
}

export function patchOverdueSettings(
  settings: unknown,
  patch: Partial<OverdueSettings>
): Record<string, unknown> {
  const current = asObject(settings) ?? {};
  const bag = { ...(asObject(current.overdue) ?? {}) };
  if (typeof patch.graceDays === 'number') {
    bag.graceDays = graceDaysFlag(patch.graceDays, DEFAULT_OVERDUE_SETTINGS.graceDays);
  }
  if (patch.checkinMode) {
    bag.checkinMode = modeFlag(patch.checkinMode, DEFAULT_OVERDUE_SETTINGS.checkinMode);
  }
  if (patch.bookingMode) {
    bag.bookingMode = modeFlag(patch.bookingMode, DEFAULT_OVERDUE_SETTINGS.bookingMode);
  }
  return { ...current, overdue: bag };
}
