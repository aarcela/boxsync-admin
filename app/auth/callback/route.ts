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

const ALLOWED_NEXT_PATHS = new Set(['/reset-password', '/welcome']);

function resolveNextPath(next: string | null): string {
  const path = next?.startsWith('/') ? next : '/reset-password';
  return ALLOWED_NEXT_PATHS.has(path) ? path : '/reset-password';
}

function resolveFailUrl(origin: string, redirectPath: string): URL {
  if (redirectPath === '/welcome') {
    return new URL('/welcome', origin);
  }
  const failUrl = new URL('/forgot-password', origin);
  failUrl.searchParams.set('error', 'link_expired');
  return failUrl;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const redirectPath = resolveNextPath(searchParams.get('next'));
  const failUrl = resolveFailUrl(origin, redirectPath);

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

  return NextResponse.redirect(failUrl);
}
