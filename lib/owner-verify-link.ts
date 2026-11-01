import { sendGymSignupVerifyEmail } from '@/lib/email/gymSignupVerifyEmail';
import { isSmtpConfigured } from '@/lib/email/smtp';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildTenantDashboardUrl } from '@/lib/tenant-host';
import type { Language } from '@/lib/translations';

export function ownerVerifyRedirectTo(slug: string): string {
  return `${buildTenantDashboardUrl(slug, '/auth/callback')}?next=${encodeURIComponent('/dashboard/setup')}`;
}

export async function sendOwnerVerificationEmail(params: {
  email: string;
  ownerName: string;
  gymName: string;
  slug: string;
  language?: Language;
}): Promise<void> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: params.email,
    options: { redirectTo: ownerVerifyRedirectTo(params.slug) },
  });
  if (error) throw error;

  const properties = data.properties as {
    hashed_token?: string;
    action_link?: string;
    verification_type?: string;
  } | null;
  const hashed = properties?.hashed_token;
  const type = properties?.verification_type || 'magiclink';
  const verifyLink = hashed
    ? `${buildTenantDashboardUrl(params.slug, '/auth/callback')}?token_hash=${encodeURIComponent(hashed)}&type=${encodeURIComponent(type)}&next=${encodeURIComponent('/dashboard/setup')}`
    : properties?.action_link;
  if (!verifyLink) throw new Error('Could not generate verification link.');

  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email is not configured.');
    }
    console.warn(`[gym-signup] SMTP unset; verification link for ${params.email}: ${verifyLink}`);
    return;
  }

  await sendGymSignupVerifyEmail({
    to: params.email,
    ownerName: params.ownerName,
    gymName: params.gymName,
    verifyLink,
    language: params.language,
  });
}
