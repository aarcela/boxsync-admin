import { NextResponse } from 'next/server';
import { requirePlatformAdminApi } from '@/lib/require-platform-admin-api';
import { classTypeService } from '@/lib/services/classTypeService';
import { membershipPlanService } from '@/lib/services/membershipPlanService';
import { tenantService } from '@/lib/services/tenantService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { DEFAULT_UNLIMITED_MEMBERSHIP_PLAN } from '@/lib/types/gym';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET() {
  const auth = await requirePlatformAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const tenants = await tenantService.listTenants(supabaseAdmin);
    return NextResponse.json({ tenants });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!slug || !name) {
      return NextResponse.json(
        { error: 'slug and name are required.' },
        { status: 400 }
      );
    }

    if (!SLUG_RE.test(slug)) {
      return NextResponse.json(
        {
          error:
            'Invalid slug. Use lowercase letters, numbers, and hyphens (e.g. madrid, pits-madrid).',
        },
        { status: 400 }
      );
    }

    const existing = await tenantService.getTenantBySlug(slug, supabaseAdmin);
    if (existing) {
      return NextResponse.json(
        { error: `Tenant slug "${slug}" already exists.` },
        { status: 409 }
      );
    }

    const tenant = await tenantService.createTenant({ slug, name }, supabaseAdmin);

    let membershipPlan;
    try {
      membershipPlan = await membershipPlanService.createMembershipPlan(
        supabaseAdmin,
        tenant.id,
        DEFAULT_UNLIMITED_MEMBERSHIP_PLAN
      );
      await classTypeService.seedDefaultsForTenant(supabaseAdmin, tenant.id);
    } catch (planError) {
      await supabaseAdmin.from('tenants').delete().eq('id', tenant.id);
      throw planError;
    }

    return NextResponse.json({ tenant, membershipPlan }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
