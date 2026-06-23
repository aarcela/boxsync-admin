import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import {
  getPasswordResetRedirectUrl,
  isStaffRole,
} from '@/lib/auth';
import {
  isPasswordResetEmailConfigured,
  sendPasswordResetEmail,
} from '@/lib/email/passwordResetEmail';
import { createMobilePasswordResetLink } from '@/lib/mobile-password-reset';
import { MOBILE_RESET_PASSWORD_DEEP_LINK } from '@/lib/constants/app-links';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { Language } from '@/lib/translations';

const SUCCESS_MESSAGE =
  'If an account exists for this email, we sent reset instructions.';

async function findUserByEmail(email: string): Promise<User | null> {
  const admin = supabaseAdmin.auth.admin as {
    getUserByEmail?: (
      email: string
    ) => Promise<{ data: { user: User | null }; error: Error | null }>;
    listUsers: (params: {
      page: number;
      perPage: number;
    }) => Promise<{ data: { users: User[] } | null; error: Error | null }>;
  };

  if (typeof admin.getUserByEmail === 'function') {
    const { data, error } = await admin.getUserByEmail(email);
    if (error || !data.user) return null;
    return data.user;
  }

  let page = 1;
  for (;;) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) return null;

    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match;

    if (data.users.length < 1000) return null;
    page += 1;
  }
}

async function sendMobilePasswordReset(params: {
  email: string;
  fullName: string;
  language: Language;
}): Promise<void> {
  if (isPasswordResetEmailConfigured()) {
    const resetLink = await createMobilePasswordResetLink(params.email);

    await sendPasswordResetEmail({
      to: params.email,
      fullName: params.fullName,
      resetLink,
      language: params.language,
    });
    return;
  }

  const { error } = await supabaseAdmin.auth.resetPasswordForEmail(params.email, {
    redirectTo: MOBILE_RESET_PASSWORD_DEEP_LINK,
  });
  if (error) throw error;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawEmail = typeof body?.email === 'string' ? body.email : '';
    const email = rawEmail.trim().toLowerCase();
    const isMobileClient = body?.client === 'mobile';
    const language: Language =
      body?.language === 'es' || body?.language === 'en' ? body.language : 'en';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ message: SUCCESS_MESSAGE });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ message: SUCCESS_MESSAGE });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (isMobileClient) {
      if (!user.email_confirmed_at) {
        return NextResponse.json({ message: SUCCESS_MESSAGE });
      }

      const fullName =
        profile?.full_name?.trim() || user.user_metadata?.full_name || '';

      await sendMobilePasswordReset({ email, fullName, language });
    } else if (isStaffRole(profile?.role)) {
      await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordResetRedirectUrl(request),
      });
    }

    return NextResponse.json({ message: SUCCESS_MESSAGE });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ message: SUCCESS_MESSAGE });
  }
}
