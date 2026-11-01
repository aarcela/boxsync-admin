import { NextResponse } from 'next/server';
import { isValidSlugFormat, suggestSlug } from '@/lib/reserved-slugs';
import { publicCorsHeaders } from '@/lib/public-cors';
import { enforcePublicGetRateLimit } from '@/lib/rate-limit';
import { tenantService } from '@/lib/services/tenantService';
import { supabaseAdmin } from '@/lib/supabase-admin';

function cors(request: Request) {
  return publicCorsHeaders(request.headers.get('origin'), 'GET, OPTIONS');
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: cors(request) });
}

export async function GET(request: Request) {
  const rateLimited = await enforcePublicGetRateLimit(request);
  if (rateLimited) return rateLimited;

  const headers = cors(request);
  const url = new URL(request.url);
  const slug = (url.searchParams.get('slug') ?? '').trim().toLowerCase();
  const city = url.searchParams.get('city') ?? undefined;

  if (!slug) {
    return NextResponse.json({ available: false, error: 'invalid_slug' }, { status: 400, headers });
  }
  if (!isValidSlugFormat(slug)) {
    return NextResponse.json(
      { available: false, error: 'reserved_or_invalid', suggestions: suggestSlug(slug, city) },
      { headers }
    );
  }

  const existing = await tenantService.getTenantBySlug(slug, supabaseAdmin);
  if (existing) {
    return NextResponse.json(
      { available: false, error: 'taken', suggestions: suggestSlug(slug, city) },
      { headers }
    );
  }

  return NextResponse.json({ available: true, slug }, { headers });
}
