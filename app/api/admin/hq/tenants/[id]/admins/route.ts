import { NextResponse } from 'next/server';
import { requirePlatformAdminApi } from '@/lib/require-platform-admin-api';
import { tenantService } from '@/lib/services/tenantService';
import { supabaseAdmin } from '@/lib/supabase-admin';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

async function resolveUnlimitedPlanId(tenantId: string): Promise<string | null> {
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

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requirePlatformAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const { id: tenantId } = await context.params;
    if (!UUID_RE.test(tenantId)) {
      return NextResponse.json({ error: 'Invalid tenant id.' }, { status: 400 });
    }

    const tenant = await tenantService.getTenantById(tenantId, supabaseAdmin);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
    }

    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, created_at, phone')
      .eq('tenant_id', tenantId)
      .eq('role', 'admin')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const admins = await Promise.all(
      (profiles ?? []).map(async (profile) => {
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(
          profile.id
        );
        return {
          ...profile,
          email: authData.user?.email ?? null,
        };
      })
    );

    return NextResponse.json({ tenant, admins });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requirePlatformAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const { id: tenantId } = await context.params;
    if (!UUID_RE.test(tenantId)) {
      return NextResponse.json({ error: 'Invalid tenant id.' }, { status: 400 });
    }

    const tenant = await tenantService.getTenantById(tenantId, supabaseAdmin);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
    }

    const body = await request.json();
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const full_name =
      typeof body.full_name === 'string' ? body.full_name.trim() : '';

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: 'email, password, and full_name are required.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    const planId = await resolveUnlimitedPlanId(tenantId);
    if (!planId) {
      return NextResponse.json(
        { error: 'No membership plan found for this tenant.' },
        { status: 400 }
      );
    }

    // Tenant admins: role=admin + tenant_id only — never app_metadata.is_admin
    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, tenant_id: tenantId },
        app_metadata: { tenant_id: tenantId },
      });

    if (createError) throw createError;
    if (!created.user) throw new Error('Failed to create user object');

    // Same privilege grant as the manual SQL bootstrap:
    // role=admin (web panel), is_solvent=true, full_name, tenant_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name,
        role: 'admin',
        is_solvent: true,
        tenant_id: tenantId,
        plan: planId,
        inscription_plan: 'standard',
        inscription_cost: 0,
        inscription_paid: false,
      })
      .eq('id', created.user.id)
      .select('id, full_name, role, tenant_id, is_solvent, created_at')
      .single();

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw profileError;
    }

    if (
      profile.tenant_id !== tenantId ||
      profile.role !== 'admin' ||
      profile.is_solvent !== true
    ) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(
        'Profile was not set as tenant admin correctly (role/is_solvent/tenant_id).'
      );
    }

    return NextResponse.json(
      {
        admin: {
          ...profile,
          email,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
