import {
  buildMobilePasswordResetEmailLink,
  MOBILE_RESET_PASSWORD_DEEP_LINK,
} from '@/lib/constants/app-links';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function createMobilePasswordResetLink(email: string): Promise<string> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: MOBILE_RESET_PASSWORD_DEEP_LINK },
  });

  if (error) throw error;

  const tokenHash = data.properties?.hashed_token;
  if (tokenHash) {
    return buildMobilePasswordResetEmailLink(tokenHash);
  }

  const actionLink = data.properties?.action_link;
  if (!actionLink) {
    throw new Error('Failed to generate password reset link');
  }

  return actionLink;
}
