'use client';

import { useState, useSyncExternalStore } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import {
  APP_STORE_URL,
  GOOGLE_PLAY_URL,
  MOBILE_APP_OPEN_DEEP_LINK,
} from '@/lib/constants/app-links';

export const authInputClass =
  'w-full h-14 px-4 bg-pits-black border border-pits-shell-edge rounded-xl text-base text-pits-shell-ink font-medium placeholder:text-pits-shell-ink-muted/50 focus:border-pits-shell-accent focus:ring-2 focus:ring-pits-shell-accent/30 transition-all outline-none disabled:opacity-60';

export const authLabelClass =
  'block text-xs font-bold text-pits-shell-ink-muted uppercase tracking-wider mb-2';

export const authPrimaryButtonClass =
  'w-full h-14 rounded-xl flex items-center justify-center font-extrabold uppercase tracking-widest text-sm bg-pits-shell-accent text-pits-dark-text hover:brightness-95 active:brightness-90 transition-all disabled:opacity-70 disabled:cursor-not-allowed text-center px-4';

export const authSecondaryButtonClass =
  'w-full h-14 rounded-xl flex items-center justify-center font-bold text-sm border border-pits-shell-edge text-pits-shell-ink hover:border-pits-shell-accent transition-colors text-center px-4';

export const authLinkClass =
  'text-xs font-bold text-pits-shell-ink-muted hover:text-pits-shell-accent transition-colors';

export function AuthAlert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success';
  children: React.ReactNode;
}) {
  const toneClass =
    tone === 'success'
      ? 'border-pits-shell-accent/40 bg-pits-shell-accent/10 text-pits-shell-ink'
      : 'border-pits-danger/40 bg-pits-danger/10 text-red-300';
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border text-sm font-semibold p-3 text-center space-y-2 ${toneClass}`}
    >
      {children}
    </div>
  );
}

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & {
  id: string;
};

export function PasswordInput(props: PasswordInputProps) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`${authInputClass} pr-14`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('Hide password') : t('Show password')}
        aria-pressed={visible}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 w-14 flex items-center justify-center text-pits-shell-ink-muted hover:text-pits-shell-ink transition-colors"
      >
        {visible ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
}

type MobilePlatform = 'ios' | 'android' | 'other';

const noopSubscribe = () => () => {};

function detectPlatform(): MobilePlatform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

export function useMobilePlatform(): MobilePlatform {
  return useSyncExternalStore(noopSubscribe, detectPlatform, () => 'other');
}

function AppleGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 384 512" className="w-5 h-5 mr-2 fill-current shrink-0">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 512 512" className="w-5 h-5 mr-2 fill-current shrink-0">
      <path d="M325.3 234.3 104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
    </svg>
  );
}

/**
 * App Store + Google Play buttons; the store for the visitor's phone comes first.
 * `highlight` makes that store the lime primary action (off when another button is primary).
 */
export function StoreButtons({ highlight = true }: { highlight?: boolean }) {
  const { t } = useLanguage();
  const platform = useMobilePlatform();

  const ios = (primary: boolean) => (
    <a
      key="ios"
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={primary ? authPrimaryButtonClass : authSecondaryButtonClass}
    >
      <AppleGlyph />
      {t('Get on the App Store')}
    </a>
  );
  const android = (primary: boolean) => (
    <a
      key="android"
      href={GOOGLE_PLAY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={primary ? authPrimaryButtonClass : authSecondaryButtonClass}
    >
      <PlayGlyph />
      {t('Get on Google Play')}
    </a>
  );

  const buttons =
    platform === 'android'
      ? [android(highlight), ios(false)]
      : platform === 'ios'
        ? [ios(highlight), android(false)]
        : [ios(false), android(false)];

  return <div className="space-y-3">{buttons}</div>;
}

export function SuccessBadge() {
  return (
    <div className="w-14 h-14 rounded-full bg-pits-shell-accent flex items-center justify-center mb-6">
      <Check size={28} strokeWidth={3} className="text-pits-dark-text" />
    </div>
  );
}

/** Shown after a member sets or resets their password: get the app, then sign in there. */
export function AppDownloadStep() {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <p className="text-base text-pits-shell-ink-muted leading-relaxed">
        {t('Your password is set. Download the app to get started.')}{' '}
        {t('Sign in with your email and the password you just created.')}
      </p>
      <StoreButtons />
      <p className="text-center text-sm text-pits-shell-ink-muted">
        {t('Already have the app?')}{' '}
        <a href={MOBILE_APP_OPEN_DEEP_LINK} className="font-bold text-pits-shell-accent hover:underline">
          {t('Open WODUS')}
        </a>
      </p>
    </div>
  );
}
