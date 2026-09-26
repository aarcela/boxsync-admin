import { NextResponse } from 'next/server';
import { publicCorsHeaders } from '@/lib/public-cors';
import { enforcePublicGetRateLimit } from '@/lib/rate-limit';
import { tenantService } from '@/lib/services/tenantService';
import { supabaseAdmin } from '@/lib/supabase-admin';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function json(body: unknown, status: number, request: Request) {
  return NextResponse.json(body, {
    status,
    headers: publicCorsHeaders(request.headers.get('origin')),
  });
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: publicCorsHeaders(request.headers.get('origin')),
  });
}

/**
 * Public tenant lookup for mobile athlete self-registration and the marketing join page.
 * GET /api/auth/tenant-by-slug?slug={slug}
 *
 * Served from HQ (hq.getwodus.com). Same boxsync-admin app also hosts
 * tenant dashboards on {slug}.getwodus.com, but mobile/landing should call HQ.
 */
export async function GET(request: Request) {
  try {
    const rateLimited = await enforcePublicGetRateLimit(request);
    if (rateLimited) return rateLimited;

    const { searchParams } = new URL(request.url);
    const raw = searchParams.get('slug') ?? '';
    const slug = raw.trim().toLowerCase();

    if (!slug || !SLUG_RE.test(slug) || slug.length < 2 || slug.length > 64) {
      return json({ error: 'invalid_slug' }, 400, request);
    }

    const tenant = await tenantService.getTenantBySlug(slug, supabaseAdmin);
    if (!tenant || tenant.is_active === false) {
      return json({ error: 'not_found' }, 404, request);
    }

    return json(
      {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
      },
      200,
      request
    );
  } catch (error) {
    console.error('tenant-by-slug error:', error);
    return json({ error: 'unavailable' }, 500, request);
  }
}
