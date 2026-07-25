import { NextResponse } from 'next/server';
import { buildPlanChangeFields } from '@/lib/plan-period';
import { tenantService } from '@/lib/services/tenantService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { Language } from '@/lib/translations';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public athlete self-registration into a tenant (mobile).
 * POST /api/auth/register
 *
 * Body: { tenant_slug, email, password, full_name, phone?, language, client: "mobile" }
 * Success 201: { user_id, email }
 *
 * Lives on HQ (hq.getwodus.com) — not on each tenant admin host.
 * Tenant membership is set via trusted app_metadata.tenant_id (see handle_new_user).
 */

async function resolveDefaultPlanId(tenantId: string): Promise<string | null> {
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
  if (legacyUnlimited?.id) return legacyUnlimited.id;

  const { data: anyPlan, error: anyError } = await supabaseAdmin
    .from('membership_plans')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (anyError) throw anyError;
  return anyPlan?.id ?? null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const tenantSlug =
      typeof body?.tenant_slug === 'string'
        ? body.tenant_slug.trim().toLowerCase()
        : '';
    const email =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const fullName =
      typeof body?.full_name === 'string' ? body.full_name.trim() : '';
    const phone =
      typeof body?.phone === 'string' ? body.phone.trim() : '';
    const language: Language =
      body?.language === 'es' || body?.language === 'en' ? body.language : 'en';

    if (!tenantSlug || !SLUG_RE.test(tenantSlug)) {
      return NextResponse.json({ error: 'invalid_slug' }, { status: 400 });
    }

    if (!email || !email.includes('@') || !fullName || !password) {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }

    const tenant = await tenantService.getTenantBySlug(
      tenantSlug,
      supabaseAdmin
    );
    if (!tenant) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (!UUID_RE.test(tenant.id)) {
      return NextResponse.json({ error: 'unavailable' }, { status: 500 });
    }

    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          tenant_id: tenant.id,
          language,
        },
        app_metadata: {
          tenant_id: tenant.id,
        },
      });

    if (createError) {
      const message = createError.message.toLowerCase();
      if (message.includes('already been registered') || message.includes('already exists')) {
        return NextResponse.json({ error: 'email_exists' }, { status: 409 });
      }
      throw createError;
    }

    const user = created.user;
    if (!user) {
      return NextResponse.json({ error: 'unavailable' }, { status: 500 });
    }

    const profileUpdate: {
      full_name: string;
      tenant_id: string;
      role: string;
      is_solvent: boolean;
      phone?: string;
      plan?: string;
      plan_period_start?: string;
    } = {
      full_name: fullName,
      tenant_id: tenant.id,
      role: 'member',
      // Self-registered athletes start unpaid until staff confirms membership.
      is_solvent: false,
    };

    if (phone) {
      profileUpdate.phone = phone;
    }

    const planId = await resolveDefaultPlanId(tenant.id);
    if (planId) {
      profileUpdate.plan = planId;
      const planFields = await buildPlanChangeFields(
        supabaseAdmin,
        planId,
        tenant.id
      );
      if (planFields.plan_period_start) {
        profileUpdate.plan_period_start = planFields.plan_period_start;
      }
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', user.id)
      .select('id, tenant_id')
      .single();

    if (profileError) throw profileError;
    if (profile.tenant_id !== tenant.id) {
      throw new Error('Profile tenant_id was not set correctly.');
    }

    return NextResponse.json(
      {
        user_id: user.id,
        email: user.email ?? email,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Athlete self-register error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal Server Error';
    if (message.toLowerCase().includes('already been registered')) {
      return NextResponse.json({ error: 'email_exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'unavailable' }, { status: 500 });
  }
}
