import { NextResponse } from 'next/server';
import { isPlatformPlanId } from '@/lib/platform-plans';
import { ProvisionTenantError, provisionTenant } from '@/lib/provision-tenant';
import { requirePlatformAdminApi } from '@/lib/require-platform-admin-api';
import { hqStatsService } from '@/lib/services/hqStatsService';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const auth = await requirePlatformAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const { tenants, overview } = await hqStatsService.getOverview(supabaseAdmin);
    return NextResponse.json({ tenants, overview });
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
    const platform_plan = isPlatformPlanId(body.platform_plan)
      ? body.platform_plan
      : undefined;

    const { tenant, membershipPlan } = await provisionTenant(
      { slug, name, ...(platform_plan ? { platform_plan } : {}), signup_source: 'hq' },
      supabaseAdmin
    );

    return NextResponse.json({ tenant, membershipPlan }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ProvisionTenantError) {
      return NextResponse.json(
        { error: error.message, code: error.code, suggestions: error.suggestions },
        { status: error.status }
      );
    }
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
