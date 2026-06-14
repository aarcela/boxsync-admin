import { NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/require-staff-api';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  try {
    const body = await request.json();
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ emails: {} });
    }

    const { data: profiles, error: profilesError } = await staffAuth.supabase
      .from('profiles')
      .select('id')
      .in('id', ids);

    if (profilesError) throw profilesError;

    const allowedIds = (profiles ?? []).map((p) => p.id);
    const emails: Record<string, string> = {};
    const invitePending: Record<string, boolean> = {};

    await Promise.all(
      allowedIds.map(async (id) => {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
        if (error) {
          console.error(`Failed to load email for profile ${id}:`, error);
          return;
        }
        if (data.user?.email) {
          emails[id] = data.user.email;
        }
        invitePending[id] = !data.user?.email_confirmed_at;
      })
    );

    return NextResponse.json({ emails, invitePending });
  } catch (error: unknown) {
    console.error('Profile emails error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
