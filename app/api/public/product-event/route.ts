import { NextResponse } from 'next/server';
import { publicCorsHeaders } from '@/lib/public-cors';
import { trackProductEvent, type ProductEventName } from '@/lib/product-events';
import { enforcePublicGetRateLimit } from '@/lib/rate-limit';

const PUBLIC_EVENTS = new Set<ProductEventName>(['signup_viewed', 'signup_failed']);

function cors(request: Request) {
  return publicCorsHeaders(request.headers.get('origin'), 'POST, OPTIONS');
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: cors(request) });
}

export async function POST(request: Request) {
  const rateLimited = await enforcePublicGetRateLimit(request);
  if (rateLimited) return rateLimited;

  const headers = cors(request);
  let body: { name?: string; reason?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers });
  }

  const name = body.name as ProductEventName;
  if (!PUBLIC_EVENTS.has(name)) {
    return NextResponse.json({ error: 'invalid_event' }, { status: 400, headers });
  }

  const props: Record<string, unknown> = {};
  if (name === 'signup_failed' && typeof body.reason === 'string') {
    props.reason = body.reason.slice(0, 40);
  }
  await trackProductEvent(name, props);
  return NextResponse.json({ ok: true }, { headers });
}
