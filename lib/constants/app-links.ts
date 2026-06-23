export const GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.aaamdev.boxwave&pcampaignid=web_share';

/** Mobile app password-reset deep link (Supabase recovery redirect_to). */
export const MOBILE_RESET_PASSWORD_DEEP_LINK = 'boxwaveapp://reset-password';

/** Opens the app straight to reset-password (no web confirm page). */
export function buildMobilePasswordResetLink(tokenHash: string): string {
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: 'recovery',
  });
  return `${MOBILE_RESET_PASSWORD_DEEP_LINK}?${params.toString()}`;
}

/** Legacy iOS listing — not public yet. */
export const APP_STORE_URL =
  'https://apps.apple.com/ve/app/pits-crossfit/id6758683997';

export const IOS_APP_COMING_SOON = true;
