import { NextResponse } from 'next/server';
import { ADMIN_ROLE_ASSIGN_FORBIDDEN, canAssignProfileRole } from '@/lib/auth';
import { requireStaffApi } from '@/lib/require-staff-api';
import { supabaseAdmin } from '@/lib/supabase-admin';
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
    .is('weekly_limit', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (unlimitedError) throw unlimitedError;
  return unlimitedPlan?.id ?? null;
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

    // 1. Validation
    if (!email || !password || !full_name) {
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
    const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, tenant_id: tenantId },
      app_metadata: { tenant_id: tenantId },
    });

    if (createError) throw createError;
    if (!user.user) throw new Error('Failed to create user object');

    // 3. Update Profile Role, Solvency & Plan
    // The trigger created the profile, but defaults to 'member' / 'insolvent'.
    // We update it immediately to match what the admin selected.
    const profileUpdate: {
      role: string;
      is_solvent: boolean;
      tenant_id: string;
      plan?: string;
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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', user.user.id)
      .select('id, tenant_id, role, plan')
      .single();

    if (profileError) throw profileError;
    if (profile.tenant_id !== tenantId) {
      throw new Error('Profile tenant_id was not set correctly.');
    }

    let whatsappWarning: string | undefined;
    if (phone?.trim()) {
      try {
        await sendWelcomeWhatsApp({
          phone: phone.trim(),
          fullName: full_name,
          email,
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
      user: user.user,
      ...(whatsappWarning ? { whatsappWarning } : {}),
    });

  } catch (error: unknown) {
    console.error('Create User Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}