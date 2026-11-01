import { NextResponse } from 'next/server';
import { getRawTenantTerms } from '@/lib/tenant-terms';
import { requireStaffApi } from '@/lib/require-staff-api';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  detectSetupSteps,
  parseSetupSteps,
  SETUP_STEPS,
  type SetupStepId,
} from '@/lib/setup-progress';
import { trackProductEvent } from '@/lib/product-events';
import { parsePlatformPlanId, isTrialExpired } from '@/lib/platform-plans';

function isSetupStep(value: string): value is SetupStepId {
  return (SETUP_STEPS as readonly string[]).includes(value);
}

async function loadFacts(tenantId: string, settings: unknown) {
  const [
    { count: paymentMethodCount },
    { count: classCount },
    { count: memberCount },
  ] = await Promise.all([
    supabaseAdmin
      .from('payment_methods')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    supabaseAdmin
      .from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('role', 'member'),
  ]);

  const bag = settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {};
  return {
    paletteCustomized: typeof bag.paletteId === 'string' && bag.paletteId !== 'default',
    termsCustomized: getRawTenantTerms(settings) != null,
    paymentMethodCount: paymentMethodCount ?? 0,
    classCount: classCount ?? 0,
    memberCount: memberCount ?? 0,
  };
}

export async function GET() {
  const auth = await requireStaffApi();
  if ('error' in auth) return auth.error;
  const tenantId = auth.profile.tenant_id as string | null;
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant context.' }, { status: 400 });
  }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select(
      'id, slug, name, signup_source, platform_plan, trial_ends_at, settings, activated_at'
    )
    .eq('id', tenantId)
    .single();
  if (!tenant) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let { data: progress } = await supabaseAdmin
    .from('tenant_setup_progress')
    .select('steps, dismissed_at, updated_at')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!progress && tenant.signup_source === 'self_serve') {
    await supabaseAdmin.from('tenant_setup_progress').insert({ tenant_id: tenantId, steps: {} });
    progress = { steps: {}, dismissed_at: null, updated_at: new Date().toISOString() };
  }

  const facts = await loadFacts(tenantId, tenant.settings);
  const stored = parseSetupSteps(progress?.steps);
  const steps = detectSetupSteps(facts, stored);

  if (JSON.stringify(steps) !== JSON.stringify(stored)) {
    await supabaseAdmin
      .from('tenant_setup_progress')
      .upsert({ tenant_id: tenantId, steps, updated_at: new Date().toISOString() });
  }

  await supabaseAdmin.rpc('maybe_activate_tenant', { p_tenant_id: tenantId });

  return NextResponse.json({
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      signupSource: tenant.signup_source,
      platformPlan: parsePlatformPlanId(tenant.platform_plan),
      trialEndsAt: tenant.trial_ends_at,
      activatedAt: tenant.activated_at,
      emailConfirmed: Boolean(auth.user.email_confirmed_at),
      staffReadOnly: isTrialExpired(
        parsePlatformPlanId(tenant.platform_plan),
        tenant.trial_ends_at
      ),
    },
    steps,
    dismissedAt: progress?.dismissed_at ?? null,
    facts,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireStaffApi();
  if ('error' in auth) return auth.error;
  const tenantId = auth.profile.tenant_id as string | null;
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant context.' }, { status: 400 });
  }

  const body = (await request.json()) as {
    action?: string;
    step?: string;
  };

  const { data: progress } = await supabaseAdmin
    .from('tenant_setup_progress')
    .select('steps, dismissed_at')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const steps = parseSetupSteps(progress?.steps);

  if (body.action === 'trial_banner') {
    await trackProductEvent('trial_banner_shown', {}, { tenantId, userId: auth.user.id });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'dismiss') {
    await supabaseAdmin.from('tenant_setup_progress').upsert({
      tenant_id: tenantId,
      steps,
      dismissed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, steps, dismissedAt: new Date().toISOString() });
  }

  if ((body.action === 'skip' || body.action === 'complete') && body.step && isSetupStep(body.step)) {
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();
    const facts = await loadFacts(tenantId, tenant?.settings);
    const next = detectSetupSteps(facts, {
      ...steps,
      [body.step]: body.action === 'skip' ? 'skipped' : 'done',
    });
    await supabaseAdmin.from('tenant_setup_progress').upsert({
      tenant_id: tenantId,
      steps: next,
      updated_at: new Date().toISOString(),
    });
    await trackProductEvent(
      body.action === 'skip' ? 'setup_step_skipped' : 'setup_step_completed',
      { step: body.step },
      { tenantId, userId: auth.user.id }
    );
    return NextResponse.json({ ok: true, steps: next });
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}
