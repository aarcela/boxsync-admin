'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { AuthPageShell } from '@/components/AuthPageShell';
import { MOBILE_RESET_PASSWORD_DEEP_LINK } from '@/lib/constants/app-links';

function AuthConfirmContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();

  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') ?? 'recovery';
  const redirectTo = searchParams.get('redirect_to') ?? MOBILE_RESET_PASSWORD_DEEP_LINK;

  const appLink = useMemo(() => {
    if (!tokenHash) return null;
    const params = new URLSearchParams({ token_hash: tokenHash, type });
    return `${redirectTo}?${params.toString()}`;
  }, [tokenHash, type, redirectTo]);

  if (!tokenHash) {
    return (
      <AuthPageShell ready title={t('Reset your password')} subtitle="WODUS">
        <p className="text-sm font-medium text-pits-ink text-center">
          {t('Invalid or missing reset link.')}
        </p>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell ready title={t('Reset your password')} subtitle="WODUS">
      <div className="space-y-4 text-center">
        <p className="text-sm font-medium text-pits-ink">{t('Open the WODUS app to continue.')}</p>
        {appLink ? (
          <a
            href={appLink}
            className="block w-full py-4 rounded-lg font-bold uppercase tracking-widest text-sm shadow-lg bg-pits-primary text-pits-dark-text hover:brightness-95 shadow-pits-primary/20 transition-all text-center no-underline"
          >
            {t('Open WODUS to reset password')}
          </a>
        ) : null}
      </div>
    </AuthPageShell>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-pits-surface flex items-center justify-center">
          <Loader2 className="animate-spin text-pits-primary" size={32} />
        </div>
      }
    >
      <AuthConfirmContent />
    </Suspense>
  );
}
