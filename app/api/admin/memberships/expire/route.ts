import { NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/require-staff-api';
import { supabaseAdmin } from '@/lib/supabase-admin';

type ExpireRpcResult = {
  status?: string;
  dry_run?: boolean;
  message?: string;
  count?: number;
  user_ids?: string[];
};

async function expireForStaffTenant(dryRun: boolean) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  const tenantId = staffAuth.profile.tenant_id as string | null;
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant context.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('expire_monthly_memberships', {
    p_tenant_id: tenantId,
    p_dry_run: dryRun,
  });

  if (error) throw error;

  const result = (data ?? {}) as ExpireRpcResult;
  return NextResponse.json({
    status: result.status ?? 'success',
    dry_run: dryRun,
    count: Number(result.count) || 0,
    message: result.message ?? '',
    user_ids: result.user_ids ?? [],
  });
}

export async function GET() {
  try {
    return await expireForStaffTenant(true);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST() {
  try {
    return await expireForStaffTenant(false);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
