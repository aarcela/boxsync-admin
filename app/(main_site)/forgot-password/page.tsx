'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { AuthPageShell } from '@/components/AuthPageShell';
import {
  AuthAlert,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authPrimaryButtonClass,
} from '@/components/auth-ui';

function ForgotPasswordForm() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const linkExpired = searchParams.get('error') === 'link_expired';
  const shownError =
    error ||
    (linkExpired && !submitted ? t('Reset link expired or invalid. Please request a new one.') : '');

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
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-base text-pits-shell-ink-muted leading-relaxed">
        {t("Enter your email and we'll send you a link to choose a new password.")}
      </p>
      <div>
        <label htmlFor="forgot-email" className={authLabelClass}>
          {t('Email')}
        </label>
        <input
          id="forgot-email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading || submitted}
          className={authInputClass}
          placeholder="you@yourgym.com"
        />
      </div>

      {shownError && (
        <AuthAlert>
          <p>{shownError}</p>
        </AuthAlert>
      )}

      {submitted && (
        <AuthAlert tone="success">
          <p>{t('If an account exists for this email, we sent reset instructions.')}</p>
        </AuthAlert>
      )}

      <button type="submit" disabled={loading || submitted} className={authPrimaryButtonClass}>
        {loading && <Loader2 size={18} className="animate-spin mr-2" />}
        {loading ? t('Sending...') : t('Send reset link')}
      </button>

      <p className="text-center">
        <Link href="/" className={authLinkClass}>
          ← {t('Back to login')}
        </Link>
      </p>
    </form>
  );
}

export default function ForgotPasswordPage() {
  const { t } = useLanguage();

  return (
    <AuthPageShell ready title={t('Reset password')} subtitle={t('Command Center')}>
      <Suspense fallback={null}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthPageShell>
  );
}
