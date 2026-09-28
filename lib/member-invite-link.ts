import { getMemberInviteRedirectUrl } from '@/lib/auth';
import { buildHqUrl } from '@/lib/tenant-host';

type GenerateLinkProperties = {
  hashed_token?: string | null;
  action_link?: string | null;
};

/**
 * Build the HTTPS invite URL put in member emails.
 *
 * Prefer `hashed_token` → hq `/auth/callback` (same pattern as mobile password
 * reset). That avoids depending on Supabase's redirect allowlist rewriting the
 * link to the marketing Site URL (getwodus.com), which has no callback page.
 */
export function buildMemberInviteEmailLink(
  properties: GenerateLinkProperties | null | undefined,
  request?: Request
): string {
  const hashedToken = properties?.hashed_token?.trim();
  if (hashedToken) {
    const params = new URLSearchParams({
      token_hash: hashedToken,
      type: 'invite',
      next: '/welcome',
    });
    return `${buildHqUrl('/auth/callback')}?${params.toString()}`;
  }

  const actionLink = properties?.action_link?.trim();
  if (actionLink) {
    // Ensure redirect_to in the Supabase verify URL points at HQ callback.
    try {
      const url = new URL(actionLink);
      url.searchParams.set(
        'redirect_to',
        getMemberInviteRedirectUrl(request ?? new Request('http://localhost'))
      );
      return url.toString();
    } catch {
      return actionLink;
    }
  }

  throw new Error('Failed to generate invite link');
}
