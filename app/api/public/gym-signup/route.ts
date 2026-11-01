import { NextResponse } from 'next/server';
import { isGymSignupEmailConfigured } from '@/lib/email/gymSignupVerifyEmail';
import { sendOwnerVerificationEmail } from '@/lib/owner-verify-link';
import { parseGymSignupBody, verifyTurnstileToken } from '@/lib/gym-signup';
import { notifyFounder } from '@/lib/notify-founder';
import { trackProductEvent } from '@/lib/product-events';
import { ProvisionTenantError, provisionTenant } from '@/lib/provision-tenant';
import { publicCorsHeaders } from '@/lib/public-cors';
import {
  enforceAuthPostRateLimit,
  getClientIp,
  hashIdentifier,
} from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { suggestSlug } from '@/lib/reserved-slugs';
import type { Language } from '@/lib/translations';

function signupLanguage(raw: unknown): Language {
  return (raw as { language?: string })?.language === 'en' ? 'en' : 'es';
}

function cors(request: Request) {
  return publicCorsHeaders(request.headers.get('origin'), 'POST, OPTIONS');
}

function json(request: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: cors(request) });
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: cors(request) });
}

async function emailExists(email: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('auth_email_exists', {
    p_email: email,
  });
  if (error) {
    console.error('auth_email_exists', error.message);
    return false;
  }
  return data === true;
}

async function resolveUnlimitedPlanId(tenantId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('membership_plans')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .or('limit_type.eq.none,limit_type.is.null')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function rollback(tenantId?: string, userId?: string) {
  if (tenantId) {
    const { error } = await supabaseAdmin.rpc('hq_delete_tenant', {
      p_tenant_id: tenantId,
    });
    if (error) console.error('gym-signup rollback tenant', error.message);
    return;
  }
  if (userId) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) console.error('gym-signup rollback user', error.message);
  }
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent')?.slice(0, 300) ?? '';

  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    return json(request, { error: 'invalid_json' }, 400);
  }

  const parsed = parseGymSignupBody(raw);
  const emailForLimit =
    parsed.input?.email ??
    (typeof (raw as { email?: string }).email === 'string'
      ? (raw as { email: string }).email
      : undefined);

  const rateLimited = await enforceAuthPostRateLimit(
    'gym-signup',
    request,
    emailForLimit
  );
  if (rateLimited) {
    Object.entries(cors(request)).forEach(([k, v]) =>
      rateLimited.headers.set(k, String(v))
    );
    await trackProductEvent('signup_failed', { reason: 'rate_limited' });
    return rateLimited;
  }

  if (!parsed.input) {
    await trackProductEvent('signup_failed', { reason: 'validation' });
    return json(request, { error: 'validation', fields: parsed.errors }, 400);
  }

  const input = parsed.input;
  const language = signupLanguage(raw);
  if (!isGymSignupEmailConfigured() && process.env.NODE_ENV === 'production') {
    await trackProductEvent('signup_failed', { reason: 'email_unconfigured' });
    return json(request, { error: 'unavailable' }, 503);
  }

  const captchaOk = await verifyTurnstileToken(input.turnstileToken, ip);
  if (!captchaOk) {
    await trackProductEvent('signup_failed', { reason: 'captcha' });
    return json(
      request,
      {
        error: 'validation',
        fields: [{ field: 'turnstileToken', message: 'Completa el captcha.' }],
      },
      400
    );
  }

  if (await emailExists(input.email)) {
    await trackProductEvent('signup_failed', { reason: 'email_exists' });
    return json(request, { error: 'email_exists' }, 409);
  }

  const [{ count: phoneDup }, { count: igDup }] = await Promise.all([
    supabaseAdmin
      .from('tenant_signups')
      .select('id', { count: 'exact', head: true })
      .eq('phone_e164', input.phoneE164),
    supabaseAdmin
      .from('tenant_signups')
      .select('id', { count: 'exact', head: true })
      .ilike('instagram', input.instagramHandle),
  ]);
  const possibleDuplicate = (phoneDup ?? 0) > 0 || (igDup ?? 0) > 0;

  let tenantId: string | undefined;
  let userId: string | undefined;

  try {
    const { tenant, membershipPlan } = await provisionTenant(
      {
        slug: input.slug,
        name: input.gymName,
        platform_plan: 'trial',
        signup_source: 'self_serve',
      },
      supabaseAdmin
    );
    tenantId = tenant.id;
    const planId =
      (membershipPlan as { id?: string } | null)?.id ??
      (await resolveUnlimitedPlanId(tenant.id));

    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: false,
        user_metadata: {
          full_name: input.ownerName,
          tenant_id: tenant.id,
          language,
        },
        app_metadata: { tenant_id: tenant.id },
      });

    if (createError) {
      const message = createError.message.toLowerCase();
      if (
        message.includes('already been registered') ||
        message.includes('already exists')
      ) {
        await rollback(tenantId);
        await trackProductEvent('signup_failed', { reason: 'email_exists' });
        return json(request, { error: 'email_exists' }, 409);
      }
      throw createError;
    }
    if (!created.user) throw new Error('Failed to create user');
    userId = created.user.id;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: input.ownerName,
        role: 'admin',
        is_solvent: true,
        tenant_id: tenant.id,
        phone: input.phoneE164,
        instagram: input.instagramHandle,
        ...(planId ? { plan: planId } : {}),
        inscription_plan: 'standard',
        inscription_cost: 0,
        inscription_paid: false,
      })
      .eq('id', userId)
      .select('id, role, tenant_id')
      .single();

    if (profileError) throw profileError;
    if (profile.tenant_id !== tenant.id || profile.role !== 'admin') {
      throw new Error('Profile was not set as tenant admin correctly.');
    }

    await supabaseAdmin
      .from('tenants')
      .update({ owner_user_id: userId })
      .eq('id', tenant.id);

    const { error: signupError } = await supabaseAdmin.from('tenant_signups').insert({
      tenant_id: tenant.id,
      owner_user_id: userId,
      owner_name: input.ownerName,
      email: input.email,
      phone_e164: input.phoneE164,
      instagram: input.instagramHandle,
      city: input.city,
      ip_hash: hashIdentifier(ip),
      user_agent: userAgent,
      captcha_ok: true,
      possible_duplicate: possibleDuplicate,
    });
    if (signupError) throw signupError;

    await supabaseAdmin.from('tenant_setup_progress').insert({
      tenant_id: tenant.id,
      steps: {},
    });

    await sendOwnerVerificationEmail({
      email: input.email,
      ownerName: input.ownerName,
      gymName: input.gymName,
      slug: tenant.slug,
      language,
    });

    await notifyFounder('signup', {
      gymName: input.gymName,
      slug: tenant.slug,
      tenantId: tenant.id,
      ownerName: input.ownerName,
      email: input.email,
      phoneE164: input.phoneE164,
      instagram: input.instagramHandle,
      city: input.city,
    }).catch((error) => console.error('notifyFounder signup', error));

    await trackProductEvent('signup_created', { slug: tenant.slug }, {
      tenantId: tenant.id,
      userId,
    });

    return json(
      request,
      { ok: true, slug: tenant.slug, possible_duplicate: possibleDuplicate },
      201
    );
  } catch (error: unknown) {
    await rollback(tenantId, userId);
    if (error instanceof ProvisionTenantError) {
      await trackProductEvent('signup_failed', { reason: error.code });
      return json(
        request,
        {
          error: error.code,
          message: error.message,
          suggestions: error.suggestions ?? suggestSlug(input.slug, input.city),
        },
        error.status
      );
    }
    console.error('gym-signup failed', error);
    await trackProductEvent('signup_failed', { reason: 'server' });
    return json(request, { error: 'unavailable' }, 500);
  }
}
