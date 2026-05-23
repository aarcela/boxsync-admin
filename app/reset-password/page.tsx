'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../components/LanguageContext';
import { AuthLanguageToggle } from '../../components/AuthLanguageToggle';
import {
  isStaffRole,
  MIN_RESET_PASSWORD_LENGTH,
  resolvePasswordResetError,
} from '../../lib/auth';

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session) {
        router.replace('/forgot-password?error=link_expired');
        return;
      }

      setCheckingSession(false);
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('session_missing');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || !isStaffRole(profile?.role)) {
        await supabase.auth.signOut();
        throw new Error(t('Unauthorized: Staff access only.'));
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      setError(resolvePasswordResetError(err, t));
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-pits-red" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
      <AuthLanguageToggle />

      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gray-900 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg p-3">
            <Image
              src="/assets/logo.png"
              alt="Pits CrossFit"
              width={48}
              height={48}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">
            {t('Set new password')}
          </h1>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">
            {t('Command Center')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
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
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none disabled:opacity-60"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
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
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none disabled:opacity-60"
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
            className={`w-full py-4 rounded-lg flex items-center justify-center text-white font-bold uppercase tracking-widest text-sm shadow-lg transition-all
              ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-pits-red hover:bg-pits-red-dark shadow-red-200'}
            `}
          >
            {loading && <Loader2 size={18} className="animate-spin mr-2" />}
            {loading ? t('Updating...') : t('Update password')}
          </button>

          <p className="text-center">
            <Link
              href="/forgot-password"
              className="text-xs font-bold text-gray-500 uppercase tracking-wider hover:text-pits-red transition-colors"
            >
              {t('Request a new link')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
