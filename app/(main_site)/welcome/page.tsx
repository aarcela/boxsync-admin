'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/components/LanguageContext';
import { AuthPageShell } from '@/components/AuthPageShell';
import { useAuthHashSession } from '@/hooks/useAuthHashSession';
import { MIN_RESET_PASSWORD_LENGTH, resolvePasswordResetError } from '@/lib/auth';
import { GOOGLE_PLAY_URL } from '@/lib/constants/app-links';

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

  const title = completed ? t('Account ready') : t('Set your password');

  return (
    <AuthPageShell
      ready={!checkingSession}
      title={title}
      subtitle="WODUS"
    >
      {!hasSession ? (
        <div className="bg-red-50 text-red-600 text-sm font-bold p-3 rounded-lg text-center">
          {t('Invite link expired or invalid. Contact your box to request a new one.')}
        </div>
      ) : completed ? (
        <div className="space-y-4 text-center">
          <p className="text-sm font-medium text-pits-ink">
            {t('Your password is set. Download the app to get started.')}
          </p>
          <a
            href={GOOGLE_PLAY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full py-4 rounded-lg items-center justify-center font-bold uppercase tracking-widest text-sm shadow-lg bg-pits-primary text-pits-dark-text hover:brightness-95 shadow-pits-primary/20 transition-all"
          >
            {t('Get on Google Play')}
          </a>
          <p className="text-xs font-bold text-pits-ink-muted uppercase tracking-wider">
            {t('iOS app coming soon.')}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
              {t('New password')}
            </label>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={MIN_RESET_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary transition-all outline-none disabled:opacity-60"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
              {t('Confirm password')}
            </label>
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              required
              minLength={MIN_RESET_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary transition-all outline-none disabled:opacity-60"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm font-bold p-3 rounded-lg text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-lg flex items-center justify-center font-bold uppercase tracking-widest text-sm shadow-lg transition-all
              ${loading ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-pits-primary text-pits-dark-text hover:brightness-95 shadow-pits-primary/20'}
            `}
          >
            {loading && <Loader2 size={18} className="animate-spin mr-2" />}
            {loading ? t('Updating...') : t('Set your password')}
          </button>
        </form>
      )}
    </AuthPageShell>
  );
}
