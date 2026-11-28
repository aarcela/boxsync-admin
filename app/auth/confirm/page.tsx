'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/components/LanguageContext';
import { AuthPageLoading, AuthPageShell } from '@/components/AuthPageShell';
import { AuthAlert, StoreButtons, authPrimaryButtonClass } from '@/components/auth-ui';
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

  if (!tokenHash || !appLink) {
    return (
      <AuthPageShell ready title={t('Link expired')} subtitle="WODUS">
        <AuthAlert>
          <p>{t('Invalid or missing reset link.')}</p>
        </AuthAlert>
        <p className="mt-4 text-sm text-pits-shell-ink-muted text-center">
          {t('Request a new reset from the WODUS app.')}
        </p>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell ready title={t('Reset your password')} subtitle={t('Account security')}>
      <div className="space-y-6">
        <p className="text-base text-pits-shell-ink-muted leading-relaxed">
          {t('Tap the button to open the WODUS app and choose a new password.')}
        </p>
        <a href={appLink} className={authPrimaryButtonClass}>
          {t('Open WODUS to reset password')}
        </a>
        <div className="pt-6 border-t border-pits-shell-edge space-y-3">
          <p className="text-sm font-bold text-pits-shell-ink">{t("Don't have the app yet?")}</p>
          <p className="text-sm text-pits-shell-ink-muted">
            {t('Install WODUS, then come back to this email and tap the link again.')}
          </p>
          <StoreButtons highlight={false} />
        </div>
      </div>
    </AuthPageShell>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={<AuthPageLoading />}
    >
      <AuthConfirmContent />
    </Suspense>
  );
}
