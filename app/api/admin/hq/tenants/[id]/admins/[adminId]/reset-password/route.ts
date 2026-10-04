import { NextResponse } from 'next/server';
import { MIN_RESET_PASSWORD_LENGTH } from '@/lib/auth';
import {
  isPasswordResetEmailConfigured,
  sendPasswordResetEmail,
} from '@/lib/email/passwordResetEmail';
import { requirePlatformAdminApi } from '@/lib/require-platform-admin-api';
import { createStaffPasswordResetLink } from '@/lib/staff-password-reset';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { tenantService } from '@/lib/services/tenantService';
import type { Language } from '@/lib/translations';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string; adminId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requirePlatformAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const { id: tenantId, adminId } = await context.params;
    if (!UUID_RE.test(tenantId) || !UUID_RE.test(adminId)) {
      return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });
    }

    const tenant = await tenantService.getTenantById(tenantId, supabaseAdmin);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const mode = body.mode === 'set' ? 'set' : body.mode === 'email' ? 'email' : null;
    if (!mode) {
      return NextResponse.json(
        { error: 'mode must be "email" or "set".' },
        { status: 400 }
      );
    }

    const messageLanguage: Language =
      body.language === 'es' || body.language === 'en' ? body.language : 'en';

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, tenant_id')
      .eq('id', adminId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Admin not found.' }, { status: 404 });
    }

    if (profile.tenant_id !== tenantId || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(adminId);

    if (authError) throw authError;

    const email = authData.user?.email?.trim().toLowerCase();
    const fullName =
      profile.full_name?.trim() || authData.user?.user_metadata?.full_name || '';

    if (!email) {
      return NextResponse.json(
        { error: 'Admin has no email address.' },
        { status: 400 }
      );
    }

    if (mode === 'set') {
      const password = typeof body.password === 'string' ? body.password : '';
      if (password.length < MIN_RESET_PASSWORD_LENGTH) {
        return NextResponse.json(
          {
            error: `Password must be at least ${MIN_RESET_PASSWORD_LENGTH} characters.`,
          },
          { status: 400 }
        );
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        adminId,
        { password }
      );
      if (updateError) throw updateError;

      return NextResponse.json({ success: true, mode: 'set' });
    }

    if (!isPasswordResetEmailConfigured()) {
      return NextResponse.json(
        {
          error:
            'Password reset email could not be sent. Check SMTP_USER, SMTP_PASSWORD, and AUTH_FROM_EMAIL.',
        },
        { status: 500 }
      );
    }

    const resetLink = await createStaffPasswordResetLink(email);

    try {
      await sendPasswordResetEmail({
        to: email,
        fullName,
        resetLink,
        language: messageLanguage,
        audience: 'staff',
      });
    } catch (emailError) {
      console.error('HQ admin password reset email failed:', emailError);
      return NextResponse.json(
        {
          error:
            'Password reset email could not be sent. Check SMTP_USER, SMTP_PASSWORD, and AUTH_FROM_EMAIL.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, mode: 'email', resetSent: true });
  } catch (error: unknown) {
    console.error('HQ admin password reset error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
