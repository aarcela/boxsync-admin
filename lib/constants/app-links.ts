export const GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.aaamdev.boxwave&pcampaignid=web_share';

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'getwodus.com';

function getPublicSiteOrigin(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (siteUrl) return siteUrl;
  return `https://${ROOT_DOMAIN}`;
}

/** Mobile app password-reset deep link (used after the web confirm page). */
export const MOBILE_RESET_PASSWORD_DEEP_LINK = 'boxwaveapp://reset-password';

/** Mobile athlete join deep link — scan in the app Join screen. */
export function buildMobileJoinDeepLink(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  return `boxwaveapp://join?slug=${encodeURIComponent(normalized)}`;
}

/**
 * Public HTTPS join URL (optional landing / universal link target).
 * The mobile app also parses this payload from a QR scan.
 */
export function buildPublicJoinUrl(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  return `${getPublicSiteOrigin()}/join/${encodeURIComponent(normalized)}`;
}

/**
 * HTTPS link for emails. Custom schemes (boxwaveapp://) are stripped by Gmail/Outlook.
 * Opens getwodus.com/auth/confirm, then the user taps once to open the app.
 */
export function buildMobilePasswordResetEmailLink(tokenHash: string): string {
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: 'recovery',
    redirect_to: MOBILE_RESET_PASSWORD_DEEP_LINK,
  });
  return `${getPublicSiteOrigin()}/auth/confirm?${params.toString()}`;
}

/**
 * iOS App Store listing.
 * NOTE: this URL slug ("pits-crossfit") predates the app's generic WODUS/BoxWave
 * branding (bundle id com.aaamdev.wodus) — confirm in App Store Connect that this
 * listing is the correct one before relying on it in new links.
 */
export const APP_STORE_URL =
  'https://apps.apple.com/ve/app/pits-crossfit/id6758683997';

export const IOS_APP_COMING_SOON = false;
