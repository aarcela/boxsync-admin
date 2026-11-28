'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/components/LanguageContext';
import { AuthPageShell } from '@/components/AuthPageShell';
import { useOptionalTenant } from '@/components/TenantContext';
import {
  isEmailNotConfirmedError,
  isPlatformAdmin,
  isStaffRole,
  resolveLoginError,
} from '@/lib/auth';
import { resolvePostLoginTenantSlug } from '@/lib/resolve-post-login-tenant';
import {
  buildHqUrl,
  buildTenantDashboardUrl,
  isHqHost,
} from '@/lib/tenant-host';
import { buildGymSignupUrl } from '@/lib/constants/app-links';
import {
  AuthAlert,
  PasswordInput,
  StoreButtons,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authPrimaryButtonClass,
} from '@/components/auth-ui';

type LoginError =
  | { kind: 'unconfirmed' }
  | { kind: 'member' }
  | { kind: 'staff_only' }
  | { kind: 'platform_only' }
  | { kind: 'missing_tenant' }
  | { kind: 'other'; cause: unknown };

class LoginFlowError extends Error {
  constructor(readonly loginError: LoginError) {
    super(loginError.kind);
  }
}

const noopSubscribe = () => () => {};

function useIsHqHost(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => isHqHost(window.location.host),
    () => false
  );
}

export default function StaffLoginPage() {
  const { t, lang } = useLanguage();
  const tenant = useOptionalTenant();
  const onHq = useIsHqHost();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResendState('idle');

    const trimmedEmail = email.trim().toLowerCase();

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (authError) {
        throw new LoginFlowError(
          isEmailNotConfirmedError(authError)
            ? { kind: 'unconfirmed' }
            : { kind: 'other', cause: authError }
        );
      }
      if (!user) throw new Error('auth_failed');

      if (isPlatformAdmin(user)) {
        if (onHq || !tenant) {
          window.location.href = onHq ? '/super-admin' : buildHqUrl('/super-admin');
          return;
        }
        await supabase.auth.signOut();
        throw new LoginFlowError({ kind: 'platform_only' });
      }

      if (onHq) {
        await supabase.auth.signOut();
        throw new LoginFlowError({ kind: 'platform_only' });
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, tenant_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw new Error('auth_failed');

      if (!isStaffRole(profile?.role)) {
        await supabase.auth.signOut();
        throw new LoginFlowError(
          profile?.role === 'member' ? { kind: 'member' } : { kind: 'staff_only' }
        );
      }

      const tenantSlug = await resolvePostLoginTenantSlug();
      if (!tenantSlug) {
        await supabase.auth.signOut();
        throw new LoginFlowError({ kind: 'missing_tenant' });
      }

      window.location.href = buildTenantDashboardUrl(tenantSlug);
    } catch (err: unknown) {
      setError(err instanceof LoginFlowError ? err.loginError : { kind: 'other', cause: err });
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    setResendState('sending');
    try {
      await fetch(buildHqUrl('/api/public/gym-signup/resend'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setResendState('sent');
    } catch {
      setResendState('idle');
    }
  };

  const errorMessage = (() => {
    if (!error) return null;
    switch (error.kind) {
      case 'unconfirmed':
        return t('Check your email to activate your account.');
      case 'staff_only':
        return t('Unauthorized: Staff access only.');
      case 'platform_only':
        return t('Unauthorized: Platform admin access only.');
      case 'missing_tenant':
        return t('Missing tenant context.');
      case 'member':
        return null;
      case 'other':
        return resolveLoginError(error.cause, t);
    }
  })();

  const gymName = tenant?.name?.trim() || null;
  const showSignupLink = !tenant && !onHq;

  return (
    <AuthPageShell
      ready
      title={gymName ? t('Sign in to {{gym}}', { gym: gymName }) : t('Sign in to WODUS')}
      subtitle={t('Command Center')}
    >
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="login-email" className={authLabelClass}>
                {t('Email')}
              </label>
              <input
                id="login-email"
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className={authInputClass}
                placeholder="you@yourgym.com"
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label htmlFor="login-password" className={`${authLabelClass} mb-0`}>
                  {t('Password')}
                </label>
                <Link
                  href="/forgot-password"
                  className={authLinkClass}
                >
                  {t('Forgot password?')}
                </Link>
              </div>
              <PasswordInput
                id="login-password"
                name="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="••••••••"
              />
            </div>

            {error?.kind === 'member' && (
              <div
                role="alert"
                className="rounded-xl border border-pits-shell-edge bg-pits-black p-4 space-y-3"
              >
                <p className="text-sm font-bold text-pits-shell-ink">
                  {t('This login is for gym staff.')}
                </p>
                <p className="text-sm text-pits-shell-ink-muted">
                  {t('Members book classes and pay from the WODUS app.')}
                </p>
                <StoreButtons highlight={false} />
              </div>
            )}

            {errorMessage && (
              <AuthAlert>
                <p>{errorMessage}</p>
                {error?.kind === 'unconfirmed' && (
                  <button
                    type="button"
                    disabled={resendState !== 'idle' || !email.trim()}
                    onClick={resendVerification}
                    className="underline text-xs uppercase tracking-wider text-pits-shell-ink disabled:opacity-60"
                  >
                    {resendState === 'sent' ? t('Verification email sent.') : t('Resend email')}
                  </button>
                )}
              </AuthAlert>
            )}

            <button type="submit" disabled={loading} className={authPrimaryButtonClass}>
              {loading && <Loader2 size={18} className="animate-spin mr-2" />}
              {loading ? t('Signing in...') : t('Sign in')}
            </button>
          </form>

          {showSignupLink && (
            <p className="mt-8 text-center text-sm text-pits-shell-ink-muted">
              {t('Own a gym?')}{' '}
              <a
                href={buildGymSignupUrl(lang)}
                className="font-bold text-pits-shell-accent hover:underline"
              >
                {t('Start your 30-day free trial')}
              </a>
            </p>
          )}
    </AuthPageShell>
  );
}
