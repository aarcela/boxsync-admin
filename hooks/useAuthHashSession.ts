'use client';

import { useEffect, useState } from 'react';
import { establishAuthSessionFromUrl } from '@/lib/establish-auth-session';

export function useAuthHashSession() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const sessionOk = await establishAuthSessionFromUrl();
      if (cancelled) return;
      setHasSession(sessionOk);
      setCheckingSession(false);
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  return { checkingSession, hasSession };
}
