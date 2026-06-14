import { NextResponse } from 'next/server';
import { getPasswordResetRedirectUrl } from '@/lib/auth';
import { requireStaffApi } from '@/lib/require-staff-api';
import { sendPasswordResetEmail } from '@/lib/email/passwordResetEmail';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { Language } from '@/lib/translations';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const messageLanguage: Language =
      body.language === 'es' || body.language === 'en' ? body.language : 'en';

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const tenantId = staffAuth.profile.tenant_id as string | null;
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context.' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, tenant_id')
      .eq('id', id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (profile.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (profile.role !== 'member') {
      return NextResponse.json(
        { error: 'Only members can receive password reset emails.' },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(id);

    if (authError) throw authError;

    const email = authData.user?.email?.trim().toLowerCase();
    const fullName =
      profile.full_name?.trim() || authData.user?.user_metadata?.full_name || '';

    if (!email) {
      return NextResponse.json({ error: 'User has no email address.' }, { status: 400 });
    }

    if (!authData.user.email_confirmed_at) {
      return NextResponse.json(
        { error: 'Member has not completed registration. Use resend welcome invite instead.' },
        { status: 400 }
      );
    }

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: getPasswordResetRedirectUrl(request),
        },
      });

    if (linkError) throw linkError;

    const resetLink = linkData.properties?.action_link;
    if (!resetLink) {
      throw new Error('Failed to generate password reset link');
    }

    try {
      await sendPasswordResetEmail({
        to: email,
        fullName,
        resetLink,
        language: messageLanguage,
      });
    } catch (emailError) {
      console.error('Password reset email failed:', emailError);
      return NextResponse.json(
        {
          error:
            'Password reset email could not be sent. Check SMTP_USER, SMTP_PASSWORD, and AUTH_FROM_EMAIL.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, resetSent: true });
  } catch (error: unknown) {
    console.error('Send Password Reset Error:', error);
    let errorMessage =
      error instanceof Error ? error.message : 'Internal Server Error';

    if (errorMessage.toLowerCase().includes('password reset email')) {
      errorMessage =
        'Password reset email could not be sent. Check SMTP_USER, SMTP_PASSWORD, and AUTH_FROM_EMAIL.';
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
