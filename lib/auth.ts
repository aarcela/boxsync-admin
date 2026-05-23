import type { TranslationKey } from './translations';

export const STAFF_ROLES = ['admin', 'manager'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const MIN_RESET_PASSWORD_LENGTH = 8;

export function getPasswordResetRedirectUrl(request: Request): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  const origin = siteUrl || new URL(request.url).origin;
  // Default Supabase emails append tokens in the URL hash; only a client page can read those.
  return `${origin}/reset-password`;
}

export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return role === 'admin' || role === 'manager';
}

/** Maps errors to safe, user-facing login messages (avoids leaking auth internals). */
export function resolveLoginError(
  err: unknown,
  t: (key: TranslationKey) => string
): string {
  if (!(err instanceof Error)) {
    return t('Something went wrong. Please try again.');
  }

  const staffOnly = t('Unauthorized: Staff access only.');
  if (err.message === staffOnly) {
    return staffOnly;
  }

  const msg = err.message.toLowerCase();

  if (msg.includes('too many') || msg.includes('rate limit')) {
    return t('Too many login attempts. Please try again later.');
  }

  // Auth failures and unexpected errors — same generic message
  return t('Invalid email or password.');
}

/** Maps errors to safe, user-facing password-reset messages. */
export function resolvePasswordResetError(
  err: unknown,
  t: (key: TranslationKey) => string
): string {
  if (!(err instanceof Error)) {
    return t('Something went wrong. Please try again.');
  }

  const msg = err.message.toLowerCase();

  if (msg.includes('too many') || msg.includes('rate limit')) {
    return t('Too many login attempts. Please try again later.');
  }

  if (
    msg.includes('session') ||
    msg.includes('jwt') ||
    msg.includes('expired') ||
    msg.includes('invalid')
  ) {
    return t('Reset link expired or invalid. Please request a new one.');
  }

  return t('Could not update password. Request a new link.');
}
