'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '../../components/LanguageContext';
import { AuthLanguageToggle } from '../../components/AuthLanguageToggle';

function ForgotPasswordForm() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (searchParams.get('error') === 'link_expired') {
      setError(t('Reset link expired or invalid. Please request a new one.'));
    }
  }, [searchParams, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSubmitted(false);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (!res.ok) {
        throw new Error('request_failed');
      }

      setSubmitted(true);
    } catch {
      setError(t('Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          {t('Staff Email')}
        </label>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading || submitted}
          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none disabled:opacity-60"
          placeholder="coach@pitscrossfit.com"
        />
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm font-bold p-3 rounded-lg text-center">
          {error}
        </div>
      )}

      {submitted && (
        <div className="bg-green-50 text-green-700 text-sm font-bold p-3 rounded-lg text-center">
          {t('If an account exists for this email, we sent reset instructions.')}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || submitted}
        className={`w-full py-4 rounded-lg flex items-center justify-center text-white font-bold uppercase tracking-widest text-sm shadow-lg transition-all
          ${loading || submitted ? 'bg-gray-400 cursor-not-allowed' : 'bg-pits-red hover:bg-pits-red-dark shadow-red-200'}
        `}
      >
        {loading && <Loader2 size={18} className="animate-spin mr-2" />}
        {loading ? t('Sending...') : t('Send reset link')}
      </button>

      <p className="text-center">
        <Link
          href="/"
          className="text-xs font-bold text-gray-500 uppercase tracking-wider hover:text-pits-red transition-colors"
        >
          {t('Back to login')}
        </Link>
      </p>
    </form>
  );
}

export default function ForgotPasswordPage() {
  const { t } = useLanguage();

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
            {t('Reset password')}
          </h1>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">
            {t('Command Center')}
          </p>
        </div>

        <Suspense fallback={null}>
          <ForgotPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
