import { NextResponse } from 'next/server';
import { requirePlatformAdminApi } from '@/lib/require-platform-admin-api';
import { hqFinancialsService, resolveHqPeriodRange } from '@/lib/services/hqFinancialsService';
import { supabaseAdmin } from '@/lib/supabase-admin';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requirePlatformAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const { id: tenantId } = await context.params;
    if (!UUID_RE.test(tenantId)) {
      return NextResponse.json({ error: 'Invalid tenant id.' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const range = resolveHqPeriodRange({
      period: searchParams.get('period'),
      start: searchParams.get('start'),
      end: searchParams.get('end'),
    });
    const detail = await hqFinancialsService.getTenantDetail(supabaseAdmin, tenantId, range);
    if (!detail) {
      return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
