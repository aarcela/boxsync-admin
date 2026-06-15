import type { TranslationKey } from './translations';

export const STAFF_ROLES = ['admin', 'manager'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const MIN_RESET_PASSWORD_LENGTH = 8;

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'getwodus.com';

/** Public site origin for auth links in emails — never use request origin (localhost in dev). */
function getPublicSiteOrigin(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (siteUrl) return siteUrl;
  return `https://hq.${ROOT_DOMAIN}`;
}

const AUTH_CALLBACK_NEXT_PATHS = ['/reset-password', '/welcome'] as const;
type AuthCallbackNextPath = (typeof AUTH_CALLBACK_NEXT_PATHS)[number];

function getAuthCallbackRedirectUrl(nextPath: AuthCallbackNextPath): string {
  const next = encodeURIComponent(nextPath);
  return `${getPublicSiteOrigin()}/auth/callback?next=${next}`;
}

export function getPasswordResetRedirectUrl(_request: Request): string {
  return getAuthCallbackRedirectUrl('/reset-password');
}

export function getMemberInviteRedirectUrl(_request: Request): string {
  return getAuthCallbackRedirectUrl('/welcome');
}

export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return role === 'admin' || role === 'manager';
}

export const PROFILE_ROLES = ['member', 'coach', 'manager', 'admin'] as const;
export type ProfileRole = (typeof PROFILE_ROLES)[number];

export const ADMIN_ROLE_ASSIGN_FORBIDDEN =
  'Only admins can assign the admin role.' as const;

/**
 * Whether caller may set a profile to targetRole (server + UI guard).
 * When existingRole is provided (updates), non-admins may keep an existing admin unchanged.
 */
export function canAssignProfileRole(
  callerRole: string | null | undefined,
  targetRole: string | null | undefined,
  existingRole?: string | null | undefined
): boolean {
  const role = targetRole || 'member';
  if (!PROFILE_ROLES.includes(role as ProfileRole)) return false;
  if (role === 'admin') {
    if (callerRole === 'admin') return true;
    return existingRole === 'admin';
  }
  return true;
}

export function isStaffProfileRole(role: string): boolean {
  return role === 'coach' || role === 'manager' || role === 'admin';
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

  const missingTenant = t('Missing tenant context.');
  if (err.message === missingTenant) {
    return missingTenant;
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

  const missingTenant = t('Missing tenant context.');
  if (err.message === missingTenant) {
    return missingTenant;
  }

  return t('Could not update password. Request a new link.');
}
