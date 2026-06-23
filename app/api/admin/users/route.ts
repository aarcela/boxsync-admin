import { NextResponse } from 'next/server';
import {
  ADMIN_ROLE_ASSIGN_FORBIDDEN,
  canAssignProfileRole,
  getMemberInviteRedirectUrl,
} from '@/lib/auth';
import { requireStaffApi } from '@/lib/require-staff-api';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildPlanChangeFields } from '@/lib/plan-period';
import { sendMemberInviteEmail } from '@/lib/email/memberInviteEmail';
import { sendWelcomeWhatsApp } from '@/lib/whatsapp';
import type { Language } from '@/lib/translations';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolvePlanIdForTenant(
  tenantId: string,
  plan: string | undefined,
  role: string
): Promise<string | null> {
  const isStaffRole =
    role === 'coach' || role === 'manager' || role === 'admin';

  if (plan && UUID_RE.test(plan)) {
    const { data, error } = await supabaseAdmin
      .from('membership_plans')
      .select('id')
      .eq('id', plan)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data.id;
    if (!isStaffRole) return null;
  }

  const { data: unlimitedPlan, error: unlimitedError } = await supabaseAdmin
    .from('membership_plans')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .or('limit_type.eq.none,limit_type.is.null')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (unlimitedError) throw unlimitedError;
  if (unlimitedPlan?.id) return unlimitedPlan.id;

  const { data: legacyUnlimited, error: legacyError } = await supabaseAdmin
    .from('membership_plans')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('weekly_limit', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (legacyError) throw legacyError;
  return legacyUnlimited?.id ?? null;
}

export async function POST(request: Request) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  try {
    const body = await request.json();
    const {
      email,
      password,
      full_name,
      phone,
      language,
      role,
      plan,
      inscription_plan,
      inscription_cost,
      inscription_paid,
      discount,
    } = body;

    const messageLanguage: Language =
      language === 'es' || language === 'en' ? language : 'en';

    const normalizedEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedFullName =
      typeof full_name === 'string' ? full_name.trim() : '';
    const profileRole = role || 'member';
    const usesInvite = profileRole === 'member';

    // 1. Validation
    if (!normalizedEmail || !normalizedFullName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!usesInvite && !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!canAssignProfileRole(staffAuth.profile.role, role)) {
      return NextResponse.json(
        { error: ADMIN_ROLE_ASSIGN_FORBIDDEN },
        { status: 403 }
      );
    }

    const tenantId = staffAuth.profile.tenant_id as string | null;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenant context.' },
        { status: 400 }
      );
    }

    // 2. Create Auth User
    let authUserId: string;
    let memberInviteLink: string | undefined;

    if (usesInvite) {
      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: 'invite',
          email: normalizedEmail,
          options: {
            redirectTo: getMemberInviteRedirectUrl(request),
            data: { full_name: normalizedFullName, tenant_id: tenantId },
          },
        });

      if (linkError) throw linkError;
      if (!linkData.user) throw new Error('Failed to create user object');

      memberInviteLink = linkData.properties?.action_link;
      if (!memberInviteLink) throw new Error('Failed to generate invite link');

      authUserId = linkData.user.id;

      const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(
        authUserId,
        {
          app_metadata: { tenant_id: tenantId },
        }
      );

      if (metadataError) throw metadataError;
    } else {
      const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: normalizedFullName, tenant_id: tenantId },
        app_metadata: { tenant_id: tenantId },
      });

      if (createError) throw createError;
      if (!user.user) throw new Error('Failed to create user object');

      authUserId = user.user.id;
    }

    // 3. Update Profile Role, Solvency & Plan
    // The trigger created the profile, but defaults to 'member' / 'insolvent'.
    // We update it immediately to match what the admin selected.
    const profileUpdate: {
      role: string;
      is_solvent: boolean;
      tenant_id: string;
      plan?: string;
      plan_period_start?: string;
      inscription_plan: string;
      inscription_cost: number;
      inscription_paid: boolean;
      discount?: number | null;
      phone?: string;
    } = {
      role: role || 'member',
      is_solvent: true,
      tenant_id: tenantId,
      inscription_paid: inscription_paid || false,
      inscription_plan: inscription_plan || 'standard',
      inscription_cost: inscription_cost ? parseFloat(inscription_cost) : 0
    };

    if (discount !== undefined) {
      profileUpdate.discount = discount === '' ? null : parseFloat(discount);
    }

    if (phone?.trim()) {
      profileUpdate.phone = phone.trim();
    }

    const planId = await resolvePlanIdForTenant(
      tenantId,
      plan,
      role || 'member'
    );

    if (!planId) {
      return NextResponse.json(
        { error: 'Invalid membership plan for this tenant.' },
        { status: 400 }
      );
    }

    profileUpdate.plan = planId;

    const planFields = await buildPlanChangeFields(supabaseAdmin, planId, tenantId);
    if (planFields.plan_period_start) {
      profileUpdate.plan_period_start = planFields.plan_period_start;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', authUserId)
      .select('id, tenant_id, role, plan')
      .single();

    if (profileError) throw profileError;
    if (profile.tenant_id !== tenantId) {
      throw new Error('Profile tenant_id was not set correctly.');
    }

    let whatsappWarning: string | undefined;
    let emailWarning: string | undefined;

    if (usesInvite && memberInviteLink) {
      try {
        await sendMemberInviteEmail({
          to: normalizedEmail,
          fullName: normalizedFullName,
          inviteLink: memberInviteLink,
          language: messageLanguage,
        });
      } catch (emailError) {
        console.error('Member invite email failed:', emailError);
        emailWarning =
          'User created, but the invite email could not be sent. Check SMTP_USER, SMTP_PASSWORD, and AUTH_FROM_EMAIL.';
      }
    }

    if (phone?.trim()) {
      try {
        await sendWelcomeWhatsApp({
          phone: phone.trim(),
          fullName: normalizedFullName,
          email: normalizedEmail,
          language: messageLanguage,
        });
      } catch (whatsappError) {
        console.error('Welcome WhatsApp failed:', whatsappError);
        whatsappWarning =
          'User created, but the welcome WhatsApp message could not be sent.';
      }
    }

    return NextResponse.json({
      success: true,
      userId: authUserId,
      inviteSent: usesInvite && !emailWarning,
      ...(emailWarning ? { emailWarning } : {}),
      ...(whatsappWarning ? { whatsappWarning } : {}),
    });

  } catch (error: unknown) {
    console.error('Create User Error:', error);
    let errorMessage =
      error instanceof Error ? error.message : 'Internal Server Error';

    if (errorMessage.toLowerCase().includes('already been registered')) {
      errorMessage = 'A user with this email already exists.';
    } else if (errorMessage.toLowerCase().includes('invite email')) {
      errorMessage =
        'Could not send invite email. Check SMTP_USER, SMTP_PASSWORD, and AUTH_FROM_EMAIL.';
    } else if (errorMessage.toLowerCase().includes('email is not configured')) {
      errorMessage =
        'Invite email is not configured. Set SMTP_USER, SMTP_PASSWORD, and AUTH_FROM_EMAIL.';
    }

    const status = errorMessage.includes('already exists') ? 400 : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}