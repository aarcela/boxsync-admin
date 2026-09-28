'use client';

import { useEffect, useState } from 'react';
import { establishSessionFromAuthCallbackUrl } from '@/lib/auth-callback';

export function useAuthHashSession() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const sessionOk = await establishSessionFromAuthCallbackUrl();
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
