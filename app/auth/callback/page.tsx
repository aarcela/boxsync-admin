'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  establishSessionFromAuthCallbackUrl,
  resolveAuthCallbackFailPath,
  resolveAuthCallbackNext,
} from '@/lib/auth-callback';

function AuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      const next = resolveAuthCallbackNext(searchParams.get('next'));
      const sessionOk = await establishSessionFromAuthCallbackUrl();

      if (cancelled) return;

      router.replace(sessionOk ? next : resolveAuthCallbackFailPath(next));
    }

    handleCallback();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-pits-surface flex items-center justify-center">
      <Loader2 className="animate-spin text-pits-primary" size={32} />
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-pits-surface flex items-center justify-center">
          <Loader2 className="animate-spin text-pits-primary" size={32} />
        </div>
      }
    >
      <AuthCallbackHandler />
    </Suspense>
  );
}
