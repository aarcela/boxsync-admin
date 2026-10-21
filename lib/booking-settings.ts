/** Athlete booking windows in tenants.settings.booking.
 * book/cancel minutes stay in sync with app/constants/bookingSettings.ts.
 * reminderMinutesBefore is admin-only (server push). */

export type BookingSettings = {
  bookClosesMinutesBefore: number;
  cancelClosesMinutesBefore: number;
  reminderMinutesBefore: number;
};

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  bookClosesMinutesBefore: 0,
  cancelClosesMinutesBefore: 60,
  reminderMinutesBefore: 15,
};

/** Common presets shown in the admin UI (minutes). */
export const BOOKING_CLOSE_PRESETS_MINUTES = [
  0, 15, 30, 60, 120, 180, 360, 720, 1440,
] as const;

/** Class reminder lead time. 0 = off. Capped at 2 hours. */
export const CLASS_REMINDER_PRESETS_MINUTES = [0, 5, 10, 15, 20, 30] as const;
export const MAX_REMINDER_MINUTES = 120;

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function minutesFlag(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function reminderMinutesFlag(value: unknown, fallback: number): number {
  return Math.min(MAX_REMINDER_MINUTES, minutesFlag(value, fallback));
}

export function parseBookingSettings(settings: unknown): BookingSettings {
  const bag = asObject(asObject(settings)?.booking);
  return {
    bookClosesMinutesBefore: minutesFlag(
      bag?.bookClosesMinutesBefore,
      DEFAULT_BOOKING_SETTINGS.bookClosesMinutesBefore
    ),
    cancelClosesMinutesBefore: minutesFlag(
      bag?.cancelClosesMinutesBefore,
      DEFAULT_BOOKING_SETTINGS.cancelClosesMinutesBefore
    ),
    reminderMinutesBefore: reminderMinutesFlag(
      bag?.reminderMinutesBefore,
      DEFAULT_BOOKING_SETTINGS.reminderMinutesBefore
    ),
  };
}

/** Booking must close at or before cancel closes (no book-without-cancel gap). */
export function isBookingWindowsValid(settings: BookingSettings): boolean {
  return settings.bookClosesMinutesBefore >= settings.cancelClosesMinutesBefore;
}

export function patchBookingSettings(
  settings: unknown,
  patch: Partial<BookingSettings>
): Record<string, unknown> {
  const current = asObject(settings) ?? {};
  const bag = { ...(asObject(current.booking) ?? {}) };
  if (typeof patch.bookClosesMinutesBefore === 'number') {
    bag.bookClosesMinutesBefore = minutesFlag(
      patch.bookClosesMinutesBefore,
      DEFAULT_BOOKING_SETTINGS.bookClosesMinutesBefore
    );
  }
  if (typeof patch.cancelClosesMinutesBefore === 'number') {
    bag.cancelClosesMinutesBefore = minutesFlag(
      patch.cancelClosesMinutesBefore,
      DEFAULT_BOOKING_SETTINGS.cancelClosesMinutesBefore
    );
  }
  if (typeof patch.reminderMinutesBefore === 'number') {
    bag.reminderMinutesBefore = reminderMinutesFlag(
      patch.reminderMinutesBefore,
      DEFAULT_BOOKING_SETTINGS.reminderMinutesBefore
    );
  }
  const next = parseBookingSettings({ ...current, booking: bag });
  if (!isBookingWindowsValid(next)) {
    throw new Error('BOOKING_WINDOWS_OVERLAP');
  }
  return { ...current, booking: bag };
}
