import { NextResponse } from 'next/server';
import { trackProductEvent } from '@/lib/product-events';
import { requireStaffApi } from '@/lib/require-staff-api';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST() {
  const auth = await requireStaffApi();
  if ('error' in auth) return auth.error;
  if (!auth.user.email_confirmed_at) {
    return NextResponse.json({ error: 'email_unverified' }, { status: 403 });
  }

  const tenantId = auth.profile.tenant_id as string | null;
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant context.' }, { status: 400 });
  }

  await supabaseAdmin
    .from('tenant_signups')
    .update({ email_verified_at: auth.user.email_confirmed_at })
    .eq('tenant_id', tenantId)
    .eq('owner_user_id', auth.user.id)
    .is('email_verified_at', null);

  await trackProductEvent('email_verified', {}, { tenantId, userId: auth.user.id });
  return NextResponse.json({ ok: true });
}
