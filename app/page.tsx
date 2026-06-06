'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '../components/LanguageContext';
import { AuthLanguageToggle } from '../components/AuthLanguageToggle';
import { isStaffRole, resolveLoginError } from '../lib/auth';

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const trimmedEmail = email.trim().toLowerCase();

    try {
      // 1. Authenticate
      const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (authError) throw authError;
      if (!user) throw new Error('auth_failed');

      // 2. Authorization Check (RBAC)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) throw new Error('auth_failed');

      if (!isStaffRole(profile?.role)) {
        await supabase.auth.signOut();
        throw new Error(t('Unauthorized: Staff access only.'));
      }

      // 3. Redirect to Dashboard
      router.push('/dashboard');
      router.refresh();

    } catch (err: unknown) {
      setError(resolveLoginError(err, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-pits-surface flex items-center justify-center p-4 relative">
      <AuthLanguageToggle />

      <div className="max-w-md w-full bg-pits-surface-elevated rounded-2xl shadow-xl p-8 border border-pits-edge">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-pits-black rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg p-3 ring-1 ring-pits-edge">
            <Image
              src="/assets/logo.webp"
              alt="Pits CrossFit"
              width={48}
              height={48}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-black text-pits-ink uppercase italic tracking-tighter">
            Pits CrossFit
          </h1>
          <p className="text-pits-ink-muted text-xs font-bold uppercase tracking-widest mt-1">
            {t('Command Center')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
              {t('Staff Email')}
            </label>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary transition-all outline-none disabled:opacity-60"
              placeholder="coach@pitscrossfit.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
              {t('Password')}
            </label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary transition-all outline-none disabled:opacity-60"
              placeholder="••••••••"
            />
          </div>

          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-xs font-bold text-pits-ink-muted uppercase tracking-wider hover:text-pits-primary transition-colors"
            >
              {t('Forgot password?')}
            </Link>
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
            {loading ? t('Verifying...') : t('Access Dashboard')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-pits-ink-muted/70">
            {t('Authorized personnel only.')}
          </p>
        </div>
      </div>
    </div>
  );
}