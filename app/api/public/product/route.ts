import { NextResponse } from 'next/server';
import { publicCorsHeaders } from '@/lib/public-cors';
import { getPublicProductPayload } from '@/lib/public-product';

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: publicCorsHeaders(request.headers.get('origin')),
  });
}

/** Unauthenticated product facts for the marketing site. */
export async function GET(request: Request) {
  return NextResponse.json(getPublicProductPayload(), {
    headers: publicCorsHeaders(request.headers.get('origin')),
  });
}
