import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export const AUTH_CALLBACK_NEXT_PATHS = ['/reset-password', '/welcome'] as const;
export type AuthCallbackNextPath = (typeof AUTH_CALLBACK_NEXT_PATHS)[number];

const ALLOWED_NEXT_PATHS = new Set<string>(AUTH_CALLBACK_NEXT_PATHS);

export function resolveAuthCallbackNext(next: string | null): AuthCallbackNextPath {
  const path = next?.startsWith('/') ? next : '/reset-password';
  return ALLOWED_NEXT_PATHS.has(path) ? (path as AuthCallbackNextPath) : '/reset-password';
}

export function resolveAuthCallbackFailPath(next: AuthCallbackNextPath): string {
  return next === '/welcome' ? '/welcome' : '/forgot-password?error=link_expired';
}

/** Exchange Supabase email-link tokens (hash, token_hash, or code) for a session. */
export async function establishSessionFromAuthCallbackUrl(): Promise<boolean> {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : '';

  if (hash) {
    const hashParams = new URLSearchParams(hash);
    const access_token = hashParams.get('access_token');
    const refresh_token = hashParams.get('refresh_token');

    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (!error) {
        await supabase.auth.getSession();
        return true;
      }
    }
  }

  const params = new URLSearchParams(window.location.search);
  const token_hash = params.get('token_hash') ?? params.get('token');
  const type = params.get('type') as EmailOtpType | null;

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return true;
  }

  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return true;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return !!session;
}
