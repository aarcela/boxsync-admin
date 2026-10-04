import { getPasswordResetRedirectUrl } from '@/lib/auth';
import { buildHqUrl } from '@/lib/tenant-host';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * HTTPS staff password-reset link for emails.
 * Prefer hashed_token → HQ /auth/callback so marketing Site URL never swallows the flow.
 */
export async function createStaffPasswordResetLink(email: string): Promise<string> {
  const redirectTo = getPasswordResetRedirectUrl(new Request('http://localhost'));
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  });

  if (error) throw error;

  const tokenHash = data.properties?.hashed_token?.trim();
  if (tokenHash) {
    const params = new URLSearchParams({
      token_hash: tokenHash,
      type: 'recovery',
      next: '/reset-password',
    });
    return `${buildHqUrl('/auth/callback')}?${params.toString()}`;
  }

  const actionLink = data.properties?.action_link?.trim();
  if (!actionLink) {
    throw new Error('Failed to generate password reset link');
  }

  try {
    const url = new URL(actionLink);
    url.searchParams.set('redirect_to', redirectTo);
    return url.toString();
  } catch {
    return actionLink;
  }
}
