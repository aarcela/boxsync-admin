import { NextResponse } from 'next/server';
import { publicCorsHeaders } from '@/lib/public-cors';
import { getPublicProductPayload } from '@/lib/public-product';
import { enforcePublicGetRateLimit } from '@/lib/rate-limit';

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: publicCorsHeaders(request.headers.get('origin')),
  });
}

/** Unauthenticated product facts for the marketing site. */
export async function GET(request: Request) {
  const rateLimited = await enforcePublicGetRateLimit(request);
  if (rateLimited) return rateLimited;

  return NextResponse.json(getPublicProductPayload(), {
    headers: {
      ...publicCorsHeaders(request.headers.get('origin')),
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
    },
  });
}
