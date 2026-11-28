'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/components/LanguageContext';
import { AuthPageShell } from '@/components/AuthPageShell';
import { useAuthHashSession } from '@/hooks/useAuthHashSession';
import {
  MIN_RESET_PASSWORD_LENGTH,
  resolvePasswordResetError,
} from '@/lib/auth';
import { buildTenantDashboardUrl } from '@/lib/tenant-host';
import {
  AppDownloadStep,
  AuthAlert,
  PasswordInput,
  SuccessBadge,
  authLabelClass,
  authLinkClass,
  authPrimaryButtonClass,
} from '@/components/auth-ui';

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { checkingSession, hasSession } = useAuthHashSession();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!checkingSession && !hasSession) {
      router.replace('/forgot-password?error=link_expired');
    }
  }, [checkingSession, hasSession, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < MIN_RESET_PASSWORD_LENGTH) {
      setError(t('Password must be at least 8 characters.'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('Passwords do not match.'));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        code?: string | null;
        isStaff?: boolean;
        tenantSlug?: string | null;
      };

      if (!response.ok) {
        if (response.status === 401) {
          const { error: updateError } = await supabase.auth.updateUser({ password });
          if (updateError) throw updateError;
          await supabase.auth.signOut();
          setCompleted(true);
          return;
        }
        if (body.error === 'session_missing') {
          throw new Error('session_missing');
        }
        if (body.code === 'same_password') {
          throw new Error('same_password');
        }
        if (body.code === 'weak_password') {
          throw new Error('weak_password');
        }
        throw new Error(body.error ?? 'update_failed');
      }

      if (body.isStaff && body.tenantSlug) {
        window.location.href = buildTenantDashboardUrl(body.tenantSlug);
        return;
      }

      await supabase.auth.signOut();
      setCompleted(true);
    } catch (err: unknown) {
      setError(resolvePasswordResetError(err, t));
    } finally {
      setLoading(false);
    }
  };

  const title = completed ? t('Account ready') : t('Set new password');
  const subtitle = completed ? 'WODUS' : t('Command Center');

  return (
    <AuthPageShell
      ready={!checkingSession && hasSession}
      title={title}
      subtitle={subtitle}
      badge={completed ? <SuccessBadge /> : undefined}
    >
      {completed ? (
        <AppDownloadStep />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="reset-password" className={authLabelClass}>
              {t('New password')}
            </label>
            <PasswordInput
              id="reset-password"
              name="password"
              autoComplete="new-password"
              required
              minLength={MIN_RESET_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="••••••••"
              aria-describedby="reset-password-hint"
            />
            <p id="reset-password-hint" className="mt-2 text-xs text-pits-shell-ink-muted">
              {t('At least 8 characters')}
            </p>
          </div>

          <div>
            <label htmlFor="reset-confirm" className={authLabelClass}>
              {t('Confirm password')}
            </label>
            <PasswordInput
              id="reset-confirm"
              name="confirmPassword"
              autoComplete="new-password"
              required
              minLength={MIN_RESET_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <AuthAlert>
              <p>{error}</p>
            </AuthAlert>
          )}

          <button type="submit" disabled={loading} className={authPrimaryButtonClass}>
            {loading && <Loader2 size={18} className="animate-spin mr-2" />}
            {loading ? t('Updating...') : t('Update password')}
          </button>

          <p className="text-center">
            <Link href="/forgot-password" className={authLinkClass}>
              {t('Request a new link')}
            </Link>
          </p>
        </form>
      )}
    </AuthPageShell>
  );
}
