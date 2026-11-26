import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isPlausibleE164, normalizeToE164 } from '@/lib/phone';
import { enforceAuthPostRateLimit } from '@/lib/rate-limit';
import { findProfileIdByLoginPhone } from '@/lib/sync-auth-phone';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Athlete phone + password login (HQ).
 * Looks up account by phone, verifies password, returns session tokens.
 * Never reveals whether the phone exists or what email is linked.
 *
 * POST /api/auth/login-phone
 * Body: { phone, password }
 * 200: { access_token, refresh_token, expires_in, expires_at?, token_type, user: { id } }
 * 401: { error: 'invalid_credentials' }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phoneRaw = typeof body?.phone === 'string' ? body.phone.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    const e164 = normalizeToE164(phoneRaw);
    const rateLimited = await enforceAuthPostRateLimit(
      'login-phone',
      request,
      e164 ?? phoneRaw
    );
    if (rateLimited) return rateLimited;

    if (!password || !e164 || !isPlausibleE164(e164)) {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }

    const profileId = await findProfileIdByLoginPhone(e164);
    if (!profileId) {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(profileId);
    const email = authData.user?.email?.trim().toLowerCase();
    if (authError || !email) {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      return NextResponse.json({ error: 'unavailable' }, { status: 500 });
    }

    const anonClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: signedIn, error: signError } =
      await anonClient.auth.signInWithPassword({ email, password });

    if (signError || !signedIn.session) {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }

    const session = signedIn.session;
    return NextResponse.json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      token_type: session.token_type ?? 'bearer',
      user: { id: session.user.id },
    });
  } catch (error) {
    console.error('login-phone error:', error);
    return NextResponse.json({ error: 'unavailable' }, { status: 500 });
  }
}
