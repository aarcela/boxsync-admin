import { supabase } from '@/lib/supabase';

/** Reads Supabase tokens from the URL hash (email links) and restores the session. */
export async function establishAuthSessionFromUrl(): Promise<boolean> {
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
      window.history.replaceState(null, '', window.location.pathname);
      if (!error) return true;
    }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return !!session;
}
