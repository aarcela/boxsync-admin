import { NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/require-staff-api';
import { tenantService } from '@/lib/services/tenantService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveTenantSlug } from '@/lib/tenant-host';

export async function GET(request: Request) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  const { profile } = staffAuth;
  const host = request.headers.get('host') ?? '';
  const hostSlug = resolveTenantSlug(host);
  const tenantId = profile.tenant_id as string | null | undefined;

  if (tenantId) {
    const slugFromProfile = await tenantService.getTenantSlugById(
      tenantId,
      supabaseAdmin
    );
    if (slugFromProfile) {
      if (hostSlug && hostSlug !== slugFromProfile) {
        return NextResponse.json({ error: 'tenant_mismatch' }, { status: 403 });
      }
      return NextResponse.json({ slug: slugFromProfile });
    }
  }

  if (hostSlug) {
    const tenant = await tenantService.getTenantBySlug(hostSlug, supabaseAdmin);
    if (tenant) return NextResponse.json({ slug: tenant.slug });
  }

  const { data, error } = await supabaseAdmin.from('tenants').select('slug').limit(2);
  if (!error && data?.length === 1) {
    return NextResponse.json({ slug: data[0].slug });
  }

  return NextResponse.json({ error: 'missing_tenant' }, { status: 404 });
}
