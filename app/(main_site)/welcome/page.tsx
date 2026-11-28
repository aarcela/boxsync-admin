'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/components/LanguageContext';
import { AuthPageShell } from '@/components/AuthPageShell';
import {
  AppDownloadStep,
  AuthAlert,
  PasswordInput,
  SuccessBadge,
  authLabelClass,
  authPrimaryButtonClass,
} from '@/components/auth-ui';
import { useAuthHashSession } from '@/hooks/useAuthHashSession';
import { MIN_RESET_PASSWORD_LENGTH, resolvePasswordResetError } from '@/lib/auth';

export default function WelcomePage() {
  const { t } = useLanguage();
  const { checkingSession, hasSession } = useAuthHashSession();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');

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
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      await supabase.auth.signOut();
      setCompleted(true);
    } catch (err: unknown) {
      setError(resolvePasswordResetError(err, t));
    } finally {
      setLoading(false);
    }
  };

  if (!checkingSession && !hasSession) {
    return (
      <AuthPageShell ready title={t('Link expired')} subtitle="WODUS">
        <AuthAlert>
          <p>{t('Invite link expired or invalid. Contact your box to request a new one.')}</p>
        </AuthAlert>
      </AuthPageShell>
    );
  }

  if (completed) {
    return (
      <AuthPageShell ready title={t('Account ready')} subtitle="WODUS" badge={<SuccessBadge />}>
        <AppDownloadStep />
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell ready={!checkingSession} title={t('Create your password')} subtitle={t('Welcome to WODUS')}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="welcome-password" className={authLabelClass}>
            {t('New password')}
          </label>
          <PasswordInput
            id="welcome-password"
            name="password"
            autoComplete="new-password"
            required
            minLength={MIN_RESET_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="••••••••"
            aria-describedby="welcome-password-hint"
          />
          <p id="welcome-password-hint" className="mt-2 text-xs text-pits-shell-ink-muted">
            {t('At least 8 characters')}
          </p>
        </div>

        <div>
          <label htmlFor="welcome-confirm" className={authLabelClass}>
            {t('Confirm password')}
          </label>
          <PasswordInput
            id="welcome-confirm"
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
          {loading ? t('Updating...') : t('Create password')}
        </button>
      </form>
    </AuthPageShell>
  );
}
