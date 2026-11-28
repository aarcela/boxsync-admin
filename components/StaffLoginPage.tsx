'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/components/LanguageContext';
import { AuthLanguageToggle } from '@/components/AuthLanguageToggle';
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
import {
  APP_STORE_URL,
  GOOGLE_PLAY_URL,
  buildGymSignupUrl,
} from '@/lib/constants/app-links';

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

const inputClass =
  'w-full h-14 px-4 bg-pits-black border border-pits-shell-edge rounded-xl text-base text-pits-shell-ink font-medium placeholder:text-pits-shell-ink-muted/50 focus:border-pits-shell-accent focus:ring-2 focus:ring-pits-shell-accent/30 transition-all outline-none disabled:opacity-60';

const labelClass =
  'block text-xs font-bold text-pits-shell-ink-muted uppercase tracking-wider mb-2';

export default function StaffLoginPage() {
  const { t, lang } = useLanguage();
  const tenant = useOptionalTenant();
  const onHq = useIsHqHost();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-dvh bg-pits-black flex items-start sm:items-center justify-center px-5 pt-24 pb-10 sm:p-6 relative">
      <AuthLanguageToggle variant="dark" />

      <div className="w-full max-w-md sm:bg-pits-shell sm:border sm:border-pits-shell-edge sm:rounded-3xl sm:overflow-hidden">
        <div className="hidden sm:block h-1 bg-pits-shell-accent" />
        <div className="sm:p-10">
          <div className="mb-8">
            <div className="w-14 h-14 bg-pits-black rounded-2xl flex items-center justify-center mb-6 p-2.5 ring-1 ring-pits-shell-edge">
              <Image
                src="/assets/logo.png"
                alt="WODUS"
                width={48}
                height={48}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-pits-shell-accent mb-2">
              {t('Command Center')}
            </p>
            <h1 className="text-3xl font-black text-pits-shell-ink uppercase italic tracking-tight leading-tight break-words">
              {gymName ? t('Sign in to {{gym}}', { gym: gymName }) : t('Sign in to WODUS')}
            </h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="login-email" className={labelClass}>
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
                className={inputClass}
                placeholder="you@yourgym.com"
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label htmlFor="login-password" className={`${labelClass} mb-0`}>
                  {t('Password')}
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-bold text-pits-shell-ink-muted hover:text-pits-shell-accent transition-colors"
                >
                  {t('Forgot password?')}
                </Link>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className={`${inputClass} pr-14`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('Hide password') : t('Show password')}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 w-14 flex items-center justify-center text-pits-shell-ink-muted hover:text-pits-shell-ink transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
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
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={APP_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-11 rounded-lg border border-pits-shell-edge flex items-center justify-center text-xs font-bold text-pits-shell-ink hover:border-pits-shell-accent transition-colors text-center px-2"
                  >
                    {t('Get on the App Store')}
                  </a>
                  <a
                    href={GOOGLE_PLAY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-11 rounded-lg border border-pits-shell-edge flex items-center justify-center text-xs font-bold text-pits-shell-ink hover:border-pits-shell-accent transition-colors text-center px-2"
                  >
                    {t('Get on Google Play')}
                  </a>
                </div>
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="rounded-xl border border-pits-danger/40 bg-pits-danger/10 text-red-300 text-sm font-semibold p-3 text-center space-y-2"
              >
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
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-xl flex items-center justify-center font-extrabold uppercase tracking-widest text-sm bg-pits-shell-accent text-pits-dark-text hover:brightness-95 active:brightness-90 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
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
        </div>
      </div>
    </div>
  );
}
