import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isPlausibleE164, normalizeToE164 } from '@/lib/phone';
import { findUserIdByPhone, syncAuthPhone } from '@/lib/sync-auth-phone';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Authenticated athlete: normalize + store phone on profile and auth.
 * POST /api/auth/sync-phone
 * Authorization: Bearer <access_token>
 * Body: { phone: string }
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : '';
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      return NextResponse.json({ error: 'unavailable' }, { status: 500 });
    }

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const raw = typeof body?.phone === 'string' ? body.phone.trim() : '';
    if (!raw) {
      await supabaseAdmin
        .from('profiles')
        .update({ phone: null })
        .eq('id', userData.user.id);
      await syncAuthPhone(userData.user.id, null);
      return NextResponse.json({ phone: null });
    }

    const e164 = normalizeToE164(raw);
    if (!e164 || !isPlausibleE164(e164)) {
      return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
    }

    const taken = await findUserIdByPhone(e164, userData.user.id);
    if (taken) {
      return NextResponse.json({ error: 'phone_exists' }, { status: 409 });
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ phone: e164 })
      .eq('id', userData.user.id);
    if (profileError) throw profileError;

    await syncAuthPhone(userData.user.id, e164);
    return NextResponse.json({ phone: e164 });
  } catch (error) {
    console.error('sync-phone error:', error);
    return NextResponse.json({ error: 'unavailable' }, { status: 500 });
  }
}
