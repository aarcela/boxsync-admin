import { NextResponse } from 'next/server';
import { purgeDemo } from '@/lib/demo-factory/cleanup';
import { DEMO_MAX_DAYS } from '@/lib/demo-factory/parse';
import { DemoNotFoundError, rollWeek } from '@/lib/demo-factory/refresh';
import { requirePlatformAdminApi } from '@/lib/require-platform-admin-api';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

const DAY_MS = 24 * 60 * 60 * 1000;
const EXTEND_DAYS = 7;

/** Non-demo ids get 404 (not 403) so this route never confirms a real tenant exists. */
const notFound = () => NextResponse.json({ error: 'not_found' }, { status: 404 });

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requirePlatformAdminApi();
  if ('error' in auth) return auth.error;
  const { id } = await context.params;

  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  try {
    if (body.action === 'extend') {
      const { data: tenant, error } = await supabaseAdmin
        .from('tenants')
        .select('id, demo_expires_at, created_at')
        .eq('id', id)
        .eq('is_demo', true)
        .maybeSingle();
      if (error) throw error;
      if (!tenant) return notFound();

      const createdAt = new Date(tenant.created_at as string).getTime();
      const maxExpiry = createdAt + DEMO_MAX_DAYS * DAY_MS;
      const base = Math.max(Date.now(), new Date(tenant.demo_expires_at as string).getTime());
      const next = Math.min(base + EXTEND_DAYS * DAY_MS, maxExpiry);
      if (next <= new Date(tenant.demo_expires_at as string).getTime()) {
        return NextResponse.json(
          { error: 'max_reached', message: `Demos last at most ${DEMO_MAX_DAYS} days.` },
          { status: 409 }
        );
      }
      const expiresAt = new Date(next).toISOString();
      const { error: updateError } = await supabaseAdmin
        .from('tenants')
        .update({
          demo_expires_at: expiresAt,
          trial_ends_at: expiresAt,
          is_active: true,
          deactivated_at: null,
          deactivation_reason: null,
        })
        .eq('id', id)
        .eq('is_demo', true);
      if (updateError) throw updateError;
      return NextResponse.json({ ok: true, expiresAt });
    }

    if (body.action === 'roll_week') {
      const result = await rollWeek(id);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: 'action must be extend or roll_week.' }, { status: 400 });
  } catch (error: unknown) {
    if (error instanceof DemoNotFoundError) return notFound();
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requirePlatformAdminApi();
  if ('error' in auth) return auth.error;
  const { id } = await context.params;

  try {
    const result = await purgeDemo(id);
    if (!result) return notFound();
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
