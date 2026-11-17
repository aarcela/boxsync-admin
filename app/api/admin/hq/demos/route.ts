import { NextResponse } from 'next/server';
import { createDemoTenant } from '@/lib/demo-factory/build';
import { parseDemoInput } from '@/lib/demo-factory/parse';
import { ProvisionTenantError } from '@/lib/provision-tenant';
import { requirePlatformAdminApi } from '@/lib/require-platform-admin-api';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildTenantDashboardUrl } from '@/lib/tenant-host';

export const maxDuration = 60;

/** Garbage control: at most this many active demos at once. */
const MAX_ACTIVE_DEMOS = 20;

export async function GET() {
  const auth = await requirePlatformAdminApi();
  if ('error' in auth) return auth.error;

  try {
    const { data: tenants, error } = await supabaseAdmin
      .from('tenants')
      .select('id, slug, name, demo_label, demo_source, demo_expires_at, is_active, created_at')
      .eq('is_demo', true)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const ids = (tenants ?? []).map((t) => t.id as string);
    const counts = new Map<string, { classes: number; members: number }>();
    if (ids.length) {
      const [{ data: classes, error: classesError }, { data: members, error: membersError }] =
        await Promise.all([
          supabaseAdmin.from('classes').select('tenant_id').in('tenant_id', ids),
          supabaseAdmin.from('profiles').select('tenant_id').in('tenant_id', ids).eq('role', 'member'),
        ]);
      if (classesError) throw classesError;
      if (membersError) throw membersError;
      for (const id of ids) counts.set(id, { classes: 0, members: 0 });
      for (const row of classes ?? []) counts.get(row.tenant_id as string)!.classes += 1;
      for (const row of members ?? []) counts.get(row.tenant_id as string)!.members += 1;
    }

    return NextResponse.json({
      demos: (tenants ?? []).map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        label: t.demo_label,
        source: t.demo_source,
        url: buildTenantDashboardUrl(t.slug as string),
        expiresAt: t.demo_expires_at,
        createdAt: t.created_at,
        isActive: t.is_active !== false,
        classes: counts.get(t.id as string)?.classes ?? 0,
        members: counts.get(t.id as string)?.members ?? 0,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdminApi();
  if ('error' in auth) return auth.error;

  let body: { text?: unknown; dryRun?: unknown; label?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (typeof body.text !== 'string' || !body.text.trim()) {
    return NextResponse.json({ error: 'text is required.' }, { status: 400 });
  }
  if (body.text.length > 20000) {
    return NextResponse.json({ error: 'text is too long.' }, { status: 400 });
  }

  const parsed = parseDemoInput(body.text);
  if (body.dryRun === true || !parsed.input) {
    return NextResponse.json(
      { parsed: parsed.input ?? null, errors: parsed.errors, warnings: parsed.warnings },
      { status: parsed.input || body.dryRun === true ? 200 : 400 }
    );
  }

  const { count, error: countError } = await supabaseAdmin
    .from('tenants')
    .select('id', { count: 'exact', head: true })
    .eq('is_demo', true)
    .eq('is_active', true);
  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }
  if ((count ?? 0) >= MAX_ACTIVE_DEMOS) {
    return NextResponse.json(
      { error: 'too_many_demos', message: `Max ${MAX_ACTIVE_DEMOS} active demos. Delete old ones first.` },
      { status: 409 }
    );
  }

  try {
    const result = await createDemoTenant(parsed.input, {
      label: typeof body.label === 'string' ? body.label : undefined,
    });
    return NextResponse.json(
      { ...result, warnings: [...parsed.warnings, ...result.warnings] },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    if (error instanceof ProvisionTenantError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    console.error('demo create failed', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: 'create_failed', message }, { status: 500 });
  }
}
