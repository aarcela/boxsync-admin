import { NextResponse } from 'next/server';
import { tenantService } from '@/lib/services/tenantService';
import { supabaseAdmin } from '@/lib/supabase-admin';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Public tenant lookup for mobile athlete self-registration.
 * GET /api/auth/tenant-by-slug?slug={slug}
 *
 * Served from HQ (hq.getwodus.com). Same boxsync-admin app also hosts
 * tenant dashboards on {slug}.getwodus.com, but mobile should call HQ.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get('slug') ?? '';
    const slug = raw.trim().toLowerCase();

    if (!slug || !SLUG_RE.test(slug) || slug.length < 2 || slug.length > 64) {
      return NextResponse.json({ error: 'invalid_slug' }, { status: 400 });
    }

    const tenant = await tenantService.getTenantBySlug(slug, supabaseAdmin);
    if (!tenant) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
    });
  } catch (error) {
    console.error('tenant-by-slug error:', error);
    return NextResponse.json({ error: 'unavailable' }, { status: 500 });
  }
}
