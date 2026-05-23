import { createServerClient } from '@supabase/auth-helpers-nextjs';
import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function createSupabaseWithCookies(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = searchParams.get('next') ?? '/reset-password';
  const redirectPath = next.startsWith('/') ? next : '/reset-password';

  const failUrl = new URL('/forgot-password', origin);
  failUrl.searchParams.set('error', 'link_expired');

  const successUrl = new URL(redirectPath, origin);
  let response = NextResponse.redirect(successUrl);
  const supabase = createSupabaseWithCookies(request, response);

  // PKCE email template: ?token_hash=...&type=recovery
  const token_hash = searchParams.get('token_hash') ?? searchParams.get('token');
  const type = searchParams.get('type') as EmailOtpType | null;

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return response;
    }
    return NextResponse.redirect(failUrl);
  }

  // PKCE code flow (only works if the reset was started in the same browser)
  const code = searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
    return NextResponse.redirect(failUrl);
  }

  // No query params — implicit/hash flow lands on /reset-password directly (see reset-password page)
  return NextResponse.redirect(failUrl);
}
