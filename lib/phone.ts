/** Phone E.164 helpers for athlete login + WhatsApp. Default market: Venezuela. */

export type PhoneCountry = {
  iso: string;
  name: string;
  dial: string;
  flag: string;
  /** National significant number length (approx). */
  nationalLength: number;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: 'VE', name: 'Venezuela', dial: '58', flag: '🇻🇪', nationalLength: 10 },
  { iso: 'CO', name: 'Colombia', dial: '57', flag: '🇨🇴', nationalLength: 10 },
  { iso: 'MX', name: 'México', dial: '52', flag: '🇲🇽', nationalLength: 10 },
  { iso: 'US', name: 'United States', dial: '1', flag: '🇺🇸', nationalLength: 10 },
  { iso: 'ES', name: 'España', dial: '34', flag: '🇪🇸', nationalLength: 9 },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0]!;

export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Normalize to E.164 (`+58412…`).
 * Bare 10-digit / `04…` numbers default to `defaultDial` (58).
 */
export function normalizeToE164(
  raw: string,
  defaultDial: string = DEFAULT_PHONE_COUNTRY.dial
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let digits = digitsOnly(trimmed);
  if (!digits) return null;

  // Drop trunk 0 for VE-style locals: 0412… → 412…
  if (digits.startsWith('0') && digits.length === defaultDial.length + 10 + 1) {
    digits = digits.slice(1);
  } else if (
    defaultDial === '58' &&
    /^0\d{10}$/.test(digits)
  ) {
    digits = digits.slice(1);
  }

  if (trimmed.startsWith('+') || digits.startsWith(defaultDial)) {
    if (!digits.startsWith(defaultDial) && trimmed.startsWith('+')) {
      // International number as typed
      if (digits.length < 8 || digits.length > 15) return null;
      return `+${digits}`;
    }
    if (digits.startsWith(defaultDial)) {
      if (digits.length < defaultDial.length + 8 || digits.length > 15) return null;
      return `+${digits}`;
    }
  }

  // National number with default country
  if (digits.length >= 8 && digits.length <= 11) {
    const national =
      digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
    if (national.length < 8 || national.length > 11) return null;
    return `+${defaultDial}${national}`;
  }

  if (digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

/** VE WhatsApp-oriented normalize (kept for gym-signup). */
export function normalizeWhatsAppVe(raw: string): string | null {
  const digits = digitsOnly(raw);
  if (/^04\d{9}$/.test(digits)) return `+58${digits.slice(1)}`;
  if (/^4\d{9}$/.test(digits)) return `+58${digits}`;
  if (/^584\d{9}$/.test(digits)) return `+${digits}`;
  if (/^58\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

export function splitPhoneE164(e164: string | null | undefined): {
  country: PhoneCountry;
  national: string;
} {
  const digits = digitsOnly(e164 ?? '');
  if (!digits) {
    return { country: DEFAULT_PHONE_COUNTRY, national: '' };
  }

  const sorted = [...PHONE_COUNTRIES].sort(
    (a, b) => b.dial.length - a.dial.length
  );
  for (const country of sorted) {
    if (digits.startsWith(country.dial)) {
      return {
        country,
        national: digits.slice(country.dial.length),
      };
    }
  }

  return { country: DEFAULT_PHONE_COUNTRY, national: digits };
}

export function buildE164(country: PhoneCountry, nationalRaw: string): string | null {
  const national = digitsOnly(nationalRaw).replace(/^0+/, '');
  if (!national) return null;
  return normalizeToE164(`+${country.dial}${national}`, country.dial);
}

/** Reject obvious placeholders (all zeros, too short after normalize). */
export function isPlausibleE164(e164: string): boolean {
  const digits = digitsOnly(e164);
  if (digits.length < 10 || digits.length > 15) return false;
  if (/^0+$/.test(digits)) return false;
  if (/^580+$/.test(digits)) return false;
  // VE mobile: +58 + 10 digits starting with 4
  if (digits.startsWith('58') && digits.length === 12) {
    return /^584\d{9}$/.test(digits);
  }
  return true;
}
