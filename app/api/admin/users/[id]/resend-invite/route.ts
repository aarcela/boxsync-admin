import { NextResponse } from 'next/server';
import { getMemberInviteRedirectUrl } from '@/lib/auth';
import { requireStaffApi } from '@/lib/require-staff-api';
import { sendMemberInviteEmail } from '@/lib/email/memberInviteEmail';
import { sendWelcomeWhatsApp } from '@/lib/whatsapp';
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
      .select('id, full_name, phone, role, tenant_id')
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
        { error: 'Only members can receive welcome invites.' },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(id);

    if (authError) throw authError;

    const email = authData.user?.email?.trim().toLowerCase();
    const fullName = profile.full_name?.trim() || authData.user?.user_metadata?.full_name || '';

    if (!email) {
      return NextResponse.json({ error: 'User has no email address.' }, { status: 400 });
    }

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email,
        options: {
          redirectTo: getMemberInviteRedirectUrl(request),
          data: { full_name: fullName, tenant_id: tenantId },
        },
      });

    if (linkError) throw linkError;

    const inviteLink = linkData.properties?.action_link;
    if (!inviteLink) {
      throw new Error('Failed to generate invite link');
    }

    let emailWarning: string | undefined;
    let whatsappWarning: string | undefined;

    try {
      await sendMemberInviteEmail({
        to: email,
        fullName,
        inviteLink,
        language: messageLanguage,
      });
    } catch (emailError) {
      console.error('Resend invite email failed:', emailError);
      emailWarning =
        'Invite email could not be sent. Check SMTP_USER, SMTP_PASSWORD, and AUTH_FROM_EMAIL.';
    }

    if (profile.phone?.trim()) {
      try {
        await sendWelcomeWhatsApp({
          phone: profile.phone.trim(),
          fullName,
          email,
          language: messageLanguage,
        });
      } catch (whatsappError) {
        console.error('Resend welcome WhatsApp failed:', whatsappError);
        whatsappWarning = 'Welcome WhatsApp message could not be sent.';
      }
    }

    if (emailWarning && whatsappWarning) {
      return NextResponse.json(
        { error: `${emailWarning} ${whatsappWarning}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      inviteSent: !emailWarning,
      ...(emailWarning ? { emailWarning } : {}),
      ...(whatsappWarning ? { whatsappWarning } : {}),
    });
  } catch (error: unknown) {
    console.error('Resend Invite Error:', error);
    let errorMessage =
      error instanceof Error ? error.message : 'Internal Server Error';

    if (errorMessage.toLowerCase().includes('invite email')) {
      errorMessage =
        'Could not send invite email. Check SMTP_USER, SMTP_PASSWORD, and AUTH_FROM_EMAIL.';
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
