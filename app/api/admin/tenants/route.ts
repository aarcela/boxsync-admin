import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { tenantService } from '@/lib/services/tenantService';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function authorizeProvisioning(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Server misconfigured: CRON_SECRET is not set.' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export async function POST(request: Request) {
  const authError = authorizeProvisioning(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const id = typeof body.id === 'string' ? body.id.trim() : undefined;

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

    if (id && !UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid id UUID.' }, { status: 400 });
    }

    const existing = await tenantService.getTenantBySlug(slug, supabaseAdmin);
    if (existing) {
      return NextResponse.json(
        { error: `Tenant slug "${slug}" already exists.` },
        { status: 409 }
      );
    }

    const tenant = await tenantService.createTenant(
      { slug, name, ...(id ? { id } : {}) },
      supabaseAdmin
    );

    return NextResponse.json({ tenant }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
