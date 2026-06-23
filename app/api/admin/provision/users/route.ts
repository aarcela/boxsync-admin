import { NextResponse } from 'next/server';
import { PROFILE_ROLES } from '@/lib/auth';
import { tenantService } from '@/lib/services/tenantService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendWelcomeWhatsApp } from '@/lib/whatsapp';
import type { Language } from '@/lib/translations';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function authorizeProvisioning(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Server misconfigured: CRON_SECRET is not set.' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

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

async function resolveTenantId(
  tenantId: string | undefined,
  tenantSlug: string | undefined
): Promise<string | null> {
  if (tenantId) {
    if (!UUID_RE.test(tenantId)) return null;
    const slug = await tenantService.getTenantSlugById(tenantId, supabaseAdmin);
    return slug ? tenantId : null;
  }

  if (tenantSlug) {
    const tenant = await tenantService.getTenantBySlug(tenantSlug, supabaseAdmin);
    return tenant?.id ?? null;
  }

  return null;
}

export async function POST(request: Request) {
  const authError = authorizeProvisioning(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const tenantIdInput =
      typeof body.tenant_id === 'string' ? body.tenant_id.trim() : undefined;
    const tenantSlugInput =
      typeof body.tenant_slug === 'string'
        ? body.tenant_slug.trim().toLowerCase()
        : undefined;
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const full_name =
      typeof body.full_name === 'string' ? body.full_name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone : undefined;
    const language = body.language;
    const role = typeof body.role === 'string' ? body.role : 'member';
    const plan = typeof body.plan === 'string' ? body.plan : undefined;
    const inscription_plan = body.inscription_plan;
    const inscription_cost = body.inscription_cost;
    const inscription_paid = body.inscription_paid;
    const discount = body.discount;

    const messageLanguage: Language =
      language === 'es' || language === 'en' ? language : 'en';

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: 'email, password, and full_name are required.' },
        { status: 400 }
      );
    }

    if (!tenantIdInput && !tenantSlugInput) {
      return NextResponse.json(
        { error: 'tenant_id or tenant_slug is required.' },
        { status: 400 }
      );
    }

    if (!PROFILE_ROLES.includes(role as (typeof PROFILE_ROLES)[number])) {
      return NextResponse.json(
        { error: `Invalid role. Use one of: ${PROFILE_ROLES.join(', ')}.` },
        { status: 400 }
      );
    }

    const tenantId = await resolveTenantId(tenantIdInput, tenantSlugInput);
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant not found.' },
        { status: 404 }
      );
    }

    const planId = await resolvePlanIdForTenant(tenantId, plan, role);
    if (!planId) {
      return NextResponse.json(
        { error: 'Invalid membership plan for this tenant.' },
        { status: 400 }
      );
    }

    const { data: user, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, tenant_id: tenantId },
        app_metadata: { tenant_id: tenantId },
      });

    if (createError) throw createError;
    if (!user.user) throw new Error('Failed to create user object');

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
      role,
      is_solvent: true,
      tenant_id: tenantId,
      inscription_paid: inscription_paid || false,
      inscription_plan: inscription_plan || 'standard',
      inscription_cost: inscription_cost ? parseFloat(inscription_cost) : 0,
    };

    if (discount !== undefined) {
      profileUpdate.discount = discount === '' ? null : parseFloat(discount);
    }

    if (phone?.trim()) {
      profileUpdate.phone = phone.trim();
    }

    profileUpdate.plan = planId;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ full_name, ...profileUpdate })
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

    return NextResponse.json(
      {
        success: true,
        user: user.user,
        profile,
        ...(whatsappWarning ? { whatsappWarning } : {}),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Provision User Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
