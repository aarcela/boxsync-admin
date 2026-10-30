import { NextResponse } from 'next/server';
import { notifyFounder } from '@/lib/notify-founder';
import { isTrialExpired, parsePlatformPlanId } from '@/lib/platform-plans';
import { trackProductEvent } from '@/lib/product-events';
import { supabaseAdmin } from '@/lib/supabase-admin';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function authorize(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return null;
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

async function hasEvent(tenantId: string, name: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('product_events')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', name)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

async function runTrialLifecycle() {
  const now = Date.now();
  const activated: string[] = [];
  const inactive: string[] = [];
  const expired: string[] = [];
  const unverified: string[] = [];

  const { data: tenants, error } = await supabaseAdmin
    .from('tenants')
    .select(
      'id, slug, name, platform_plan, trial_ends_at, activated_at, last_staff_login_at, inactive_flagged_at, created_at, owner_user_id'
    );
  if (error) throw error;

  for (const tenant of tenants ?? []) {
    await supabaseAdmin.rpc('maybe_activate_tenant', { p_tenant_id: tenant.id });
  }

  const { data: refreshed } = await supabaseAdmin
    .from('tenants')
    .select(
      'id, slug, name, platform_plan, trial_ends_at, activated_at, last_staff_login_at, inactive_flagged_at, created_at'
    );

  const { data: signups } = await supabaseAdmin
    .from('tenant_signups')
    .select('tenant_id, owner_name, email, phone_e164, instagram, city, email_verified_at, created_at');

  const signupByTenant = new Map(
    (signups ?? []).map((row) => [row.tenant_id as string, row])
  );

  for (const tenant of refreshed ?? []) {
    const signup = signupByTenant.get(tenant.id);
    const payload = {
      gymName: tenant.name,
      slug: tenant.slug,
      tenantId: tenant.id,
      ownerName: signup?.owner_name ?? undefined,
      email: signup?.email ?? undefined,
      phoneE164: signup?.phone_e164 ?? null,
      instagram: signup?.instagram ?? null,
      city: signup?.city ?? null,
    };

    if (
      tenant.activated_at &&
      now - new Date(tenant.activated_at).getTime() < DAY_MS &&
      !(await hasEvent(tenant.id, 'tenant_activated'))
    ) {
      await trackProductEvent('tenant_activated', {}, { tenantId: tenant.id });
      await notifyFounder('activated', payload);
      activated.push(tenant.slug);
    }

    const lastLogin = tenant.last_staff_login_at
      ? new Date(tenant.last_staff_login_at).getTime()
      : new Date(tenant.created_at).getTime();
    const stale = now - lastLogin >= FOURTEEN_DAYS_MS;
    if (stale && !tenant.inactive_flagged_at) {
      await supabaseAdmin
        .from('tenants')
        .update({ inactive_flagged_at: new Date().toISOString() })
        .eq('id', tenant.id);
      await trackProductEvent('tenant_inactive_flagged', {}, { tenantId: tenant.id });
      await notifyFounder('inactive', payload);
      inactive.push(tenant.slug);
    }

    const plan = parsePlatformPlanId(tenant.platform_plan);
    if (
      isTrialExpired(plan, tenant.trial_ends_at) &&
      !(await hasEvent(tenant.id, 'trial_expired'))
    ) {
      await trackProductEvent('trial_expired', {}, { tenantId: tenant.id });
      expired.push(tenant.slug);
    }

    if (
      signup &&
      !signup.email_verified_at &&
      now - new Date(signup.created_at).getTime() >= 7 * DAY_MS
    ) {
      unverified.push(tenant.slug);
    }
  }

  return { activated, inactive, expired, unverified };
}

export async function GET(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;
  try {
    const result = await runTrialLifecycle();
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
