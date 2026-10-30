import { NextResponse } from 'next/server';
import { sendOwnerVerificationEmail } from '@/lib/owner-verify-link';
import { publicCorsHeaders } from '@/lib/public-cors';
import { enforceAuthPostRateLimit, hashIdentifier } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase-admin';

function cors(request: Request) {
  return publicCorsHeaders(request.headers.get('origin'), 'POST, OPTIONS');
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: cors(request) });
}

export async function POST(request: Request) {
  const headers = cors(request);
  let body: { email?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const rateLimited = await enforceAuthPostRateLimit('gym-signup', request, email || hashIdentifier('resend'));
  if (rateLimited) {
    const limited = rateLimited;
    Object.entries(headers).forEach(([k, v]) => limited.headers.set(k, String(v)));
    return limited;
  }

  if (!email || !email.includes('@')) {
    return NextResponse.json({ ok: true }, { headers });
  }

  const { data: signup } = await supabaseAdmin
    .from('tenant_signups')
    .select('owner_name, email, tenant_id, email_verified_at, tenants!inner(name, slug)')
    .eq('email', email)
    .maybeSingle();

  const row = signup as
    | {
        owner_name: string;
        email: string;
        email_verified_at: string | null;
        tenants: { name: string; slug: string } | { name: string; slug: string }[];
      }
    | null;

  if (row && !row.email_verified_at) {
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    if (tenant) {
      try {
        await sendOwnerVerificationEmail({
          email: row.email,
          ownerName: row.owner_name,
          gymName: tenant.name,
          slug: tenant.slug,
        });
      } catch (error) {
        console.error('resend verification failed', error);
      }
    }
  }

  return NextResponse.json({ ok: true }, { headers });
}
