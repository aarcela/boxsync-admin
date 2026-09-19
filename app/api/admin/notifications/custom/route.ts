import { NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/require-staff-api';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendCustomPushes } from '@/lib/push';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TITLE_MAX = 80;
const BODY_MAX = 240;

function staffTenantId(
  profile: { tenant_id?: string | null }
): string | null {
  return profile.tenant_id || null;
}

export async function GET() {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  const tenantId = staffTenantId(staffAuth.profile);
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant' }, { status: 403 });
  }

  try {
    const [{ data: profiles, error: profileError }, { data: tokens, error: tokenError }] =
      await Promise.all([
        supabaseAdmin
          .from('profiles')
          .select('id, full_name, role')
          .eq('tenant_id', tenantId)
          .order('full_name', { ascending: true }),
        supabaseAdmin
          .from('push_tokens')
          .select('user_id')
          .eq('tenant_id', tenantId),
      ]);

    if (profileError) throw profileError;
    if (tokenError) throw tokenError;

    const withApp = new Set((tokens || []).map((row) => row.user_id));
    const recipients = (profiles || []).map((profile) => ({
      id: profile.id,
      full_name: profile.full_name,
      role: profile.role,
      has_token: withApp.has(profile.id),
    }));

    return NextResponse.json({
      recipients,
      withAppCount: withApp.size,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  const tenantId = staffTenantId(staffAuth.profile);
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const message = typeof body.body === 'string' ? body.body.trim() : '';
    const all = body.all === true;
    const rawIds = Array.isArray(body.userIds) ? body.userIds : [];

    if (!title || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (title.length > TITLE_MAX || message.length > BODY_MAX) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 });
    }

    const userIds = rawIds.filter(
      (id: unknown): id is string => typeof id === 'string' && UUID_RE.test(id)
    );

    if (!all && userIds.length === 0) {
      return NextResponse.json({ error: 'No recipients' }, { status: 400 });
    }

    const result = await sendCustomPushes({
      tenantId,
      userIds: all ? 'all' : userIds,
      title,
      body: message,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error('Custom push notification failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
