'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Loader2,
  Mail,
  Phone,
  Shield,
  User,
  Calendar,
  Download,
  QrCode,
  Copy,
  Check,
} from 'lucide-react';
import { format } from 'date-fns';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/components/LanguageContext';
import { useToast } from '@/components/Toast';
import { useTenant } from '@/components/TenantContext';
import {
  isStaffRole,
  MIN_RESET_PASSWORD_LENGTH,
  resolvePasswordResetError,
} from '@/lib/auth';
import { buildMobileJoinDeepLink } from '@/lib/constants/app-links';
import type { TranslationKey } from '@/lib/translations';

const APP_ACCESS_QR_PATH = '/assets/qr-access.png';
const APP_ACCESS_QR_DOWNLOAD_NAME = 'boxsync-app-access-qr.png';

type StaffProfile = {
  full_name: string | null;
  phone: string | null;
  role: string;
  created_at: string;
};

function getInitials(name: string | null | undefined): string {
  if (!name?.trim()) return 'AD';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function roleLabel(role: string, t: (key: TranslationKey) => string): string {
  if (role === 'admin') return t('Admin');
  if (role === 'manager') return t('Manager');
  return role;
}

export default function ProfilePage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { slug, name: tenantName } = useTenant();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [downloadingJoinQr, setDownloadingJoinQr] = useState(false);
  const [downloadingAppAccessQr, setDownloadingAppAccessQr] = useState(false);
  const [joinQrDataUrl, setJoinQrDataUrl] = useState<string | null>(null);
  const [qrGenerating, setQrGenerating] = useState(true);
  const [copiedField, setCopiedField] = useState<'slug' | 'link' | null>(null);

  const joinLink = useMemo(() => buildMobileJoinDeepLink(slug), [slug]);

  useEffect(() => {
    let cancelled = false;

    const generateQr = async () => {
      setQrGenerating(true);
      try {
        const dataUrl = await QRCode.toDataURL(joinLink, {
          width: 480,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#111111',
            light: '#ffffff',
          },
        });
        if (!cancelled) setJoinQrDataUrl(dataUrl);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setJoinQrDataUrl(null);
          toast(t('Failed to generate QR code'), 'error');
        }
      } finally {
        if (!cancelled) setQrGenerating(false);
      }
    };

    void generateQr();
    return () => {
      cancelled = true;
    };
  }, [joinLink, t, toast]);

  const handleDownloadJoinQr = async () => {
    if (!joinQrDataUrl) {
      toast(t('Failed to download QR code'), 'error');
      return;
    }

    setDownloadingJoinQr(true);
    try {
      const link = document.createElement('a');
      link.href = joinQrDataUrl;
      link.download = `wodus-join-${slug}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error(error);
      toast(t('Failed to download QR code'), 'error');
    } finally {
      setDownloadingJoinQr(false);
    }
  };

  const handleDownloadAppAccessQr = async () => {
    setDownloadingAppAccessQr(true);
    try {
      const response = await fetch(APP_ACCESS_QR_PATH);
      if (!response.ok) throw new Error('download_failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = APP_ACCESS_QR_DOWNLOAD_NAME;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast(t('Failed to download QR code'), 'error');
    } finally {
      setDownloadingAppAccessQr(false);
    }
  };

  const copyText = async (value: string, field: 'slug' | 'link') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast(
        field === 'slug' ? t('Gym code copied') : t('Join link copied'),
        'success'
      );
      window.setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('session_missing');

        setEmail(user.email ?? '');

        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, phone, role, created_at')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        if (!isStaffRole(data?.role)) throw new Error('staff_only');

        setProfile(data as StaffProfile);
      } catch (error) {
        console.error(error);
        toast(t('Failed to load profile'), 'error');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [t, toast]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < MIN_RESET_PASSWORD_LENGTH) {
      setPasswordError(t('Password must be at least 8 characters.'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('Passwords do not match.'));
      return;
    }

    setPasswordLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInError) throw new Error('current_password_invalid');

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast(t('Password updated successfully.'), 'success');
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'current_password_invalid') {
        setPasswordError(t('Current password is incorrect.'));
      } else {
        setPasswordError(resolvePasswordResetError(err, t));
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="animate-spin text-pits-primary" size={32} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 text-pits-ink-muted font-medium">
        {t('Failed to load profile')}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-pits-ink uppercase tracking-tight">
          {t('My Profile')}
        </h1>
        <p className="text-sm text-pits-ink-muted mt-1">
          {t('Manage your account settings')}
        </p>
      </div>

      <div className="bg-pits-surface rounded-2xl border border-pits-edge shadow-sm overflow-hidden">
        <div className="p-6 flex items-center gap-5 border-b border-pits-edge bg-pits-surface-muted/40">
          <div className="w-16 h-16 bg-pits-primary rounded-full flex items-center justify-center text-pits-dark-text font-black text-xl shrink-0">
            {getInitials(profile.full_name)}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-black text-pits-ink truncate">
              {profile.full_name || t('Admin')}
            </h2>
            <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-pits-primary/15 text-pits-primary text-[10px] font-black uppercase tracking-wider">
              <Shield size={12} />
              {roleLabel(profile.role, t)}
            </span>
          </div>
        </div>

        <dl className="p-6 grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-pits-surface-muted/50 border border-pits-edge">
            <Mail size={18} className="text-pits-ink-muted mt-0.5 shrink-0" />
            <div className="min-w-0">
              <dt className="text-[10px] font-black uppercase tracking-wider text-pits-ink-muted">
                {t('Email')}
              </dt>
              <dd className="text-sm font-bold text-pits-ink truncate mt-0.5">
                {email || '—'}
              </dd>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-pits-surface-muted/50 border border-pits-edge">
            <Phone size={18} className="text-pits-ink-muted mt-0.5 shrink-0" />
            <div className="min-w-0">
              <dt className="text-[10px] font-black uppercase tracking-wider text-pits-ink-muted">
                {t('Phone')}
              </dt>
              <dd className="text-sm font-bold text-pits-ink mt-0.5">
                {profile.phone || '—'}
              </dd>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-pits-surface-muted/50 border border-pits-edge">
            <User size={18} className="text-pits-ink-muted mt-0.5 shrink-0" />
            <div className="min-w-0">
              <dt className="text-[10px] font-black uppercase tracking-wider text-pits-ink-muted">
                {t('Full name')}
              </dt>
              <dd className="text-sm font-bold text-pits-ink mt-0.5">
                {profile.full_name || '—'}
              </dd>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-pits-surface-muted/50 border border-pits-edge">
            <Calendar size={18} className="text-pits-ink-muted mt-0.5 shrink-0" />
            <div className="min-w-0">
              <dt className="text-[10px] font-black uppercase tracking-wider text-pits-ink-muted">
                {t('Member since')}
              </dt>
              <dd className="text-sm font-bold text-pits-ink mt-0.5">
                {profile.created_at
                  ? format(new Date(profile.created_at), 'MMMM d, yyyy')
                  : '—'}
              </dd>
            </div>
          </div>
        </dl>
      </div>

      <div className="bg-pits-surface rounded-2xl border border-pits-edge shadow-sm p-6">
        <div className="flex items-start gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-pits-primary/15 text-pits-primary shrink-0">
            <QrCode size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-pits-ink uppercase tracking-tight">
              {t('Athlete join QR')}
            </h3>
            <p className="text-sm text-pits-ink-muted mt-1">
              {t('Athletes scan this QR in the WODUS app to register at your gym.')}
            </p>
            <p className="text-sm font-bold text-pits-ink mt-2">{tenantName}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="p-4 bg-white rounded-2xl border border-pits-edge shadow-sm shrink-0 flex items-center justify-center w-[232px] h-[232px]">
            {qrGenerating ? (
              <Loader2 className="animate-spin text-pits-primary" size={28} />
            ) : joinQrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={joinQrDataUrl}
                alt={t('Athlete join QR')}
                width={200}
                height={200}
                className="w-48 h-48 object-contain"
              />
            ) : (
              <span className="text-sm text-pits-ink-muted text-center px-4">
                {t('Failed to generate QR code')}
              </span>
            )}
          </div>

          <div className="flex-1 w-full space-y-3">
            <div className="rounded-xl border border-pits-edge bg-pits-surface-muted/50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-pits-ink-muted">
                {t('Gym code')}
              </p>
              <p className="text-lg font-black text-pits-primary tracking-wide mt-1">
                {slug}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void copyText(slug, 'slug')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-pits-edge bg-pits-surface text-pits-ink text-sm font-bold uppercase tracking-widest hover:bg-pits-surface-muted transition-colors"
              >
                {copiedField === 'slug' ? <Check size={16} /> : <Copy size={16} />}
                {t('Copy gym code')}
              </button>

              <button
                type="button"
                onClick={() => void copyText(joinLink, 'link')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-pits-edge bg-pits-surface text-pits-ink text-sm font-bold uppercase tracking-widest hover:bg-pits-surface-muted transition-colors"
              >
                {copiedField === 'link' ? <Check size={16} /> : <Copy size={16} />}
                {t('Copy join link')}
              </button>

              <button
                type="button"
                onClick={() => void handleDownloadJoinQr()}
                disabled={downloadingJoinQr || !joinQrDataUrl}
                className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold uppercase tracking-widest text-sm shadow-lg transition-all
                  ${
                    downloadingJoinQr || !joinQrDataUrl
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-pits-primary text-pits-dark-text hover:brightness-95 shadow-pits-primary/20'
                  }
                `}
              >
                {downloadingJoinQr ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Download size={18} />
                )}
                {downloadingJoinQr ? t('Downloading...') : t('Download QR code')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-pits-surface rounded-2xl border border-pits-edge shadow-sm p-6">
        <div className="flex items-start gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-pits-primary/15 text-pits-primary shrink-0">
            <QrCode size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-pits-ink uppercase tracking-tight">
              {t('App access QR')}
            </h3>
            <p className="text-sm text-pits-ink-muted mt-1">
              {t(
                'Scan or share this QR code so athletes can download and access the app.'
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="p-4 bg-white rounded-2xl border border-pits-edge shadow-sm shrink-0">
            <Image
              src={APP_ACCESS_QR_PATH}
              alt={t('App access QR')}
              width={200}
              height={200}
              className="w-48 h-48 object-contain"
              priority
            />
          </div>

          <button
            type="button"
            onClick={() => void handleDownloadAppAccessQr()}
            disabled={downloadingAppAccessQr}
            className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold uppercase tracking-widest text-sm shadow-lg transition-all
              ${
                downloadingAppAccessQr
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-pits-primary text-pits-dark-text hover:brightness-95 shadow-pits-primary/20'
              }
            `}
          >
            {downloadingAppAccessQr ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Download size={18} />
            )}
            {downloadingAppAccessQr
              ? t('Downloading...')
              : t('Download QR code')}
          </button>
        </div>
      </div>

      <div className="bg-pits-surface rounded-2xl border border-pits-edge shadow-sm p-6">
        <h3 className="text-lg font-black text-pits-ink uppercase tracking-tight">
          {t('Change password')}
        </h3>
        <p className="text-sm text-pits-ink-muted mt-1 mb-6">
          {t('Enter your current password to set a new one.')}
        </p>

        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
              {t('Current password')}
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={passwordLoading}
              className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary transition-all outline-none disabled:opacity-60"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-pits-ink-muted uppercase tracking-wider mb-2">
              {t('New password')}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_RESET_PASSWORD_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={passwordLoading}
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
              autoComplete="new-password"
              required
              minLength={MIN_RESET_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={passwordLoading}
              className="w-full p-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary transition-all outline-none disabled:opacity-60"
              placeholder="••••••••"
            />
          </div>

          {passwordError && (
            <div className="bg-red-50 text-red-600 text-sm font-bold p-3 rounded-lg">
              {passwordError}
            </div>
          )}

          <button
            type="submit"
            disabled={passwordLoading}
            className={`px-6 py-3 rounded-lg flex items-center justify-center font-bold uppercase tracking-widest text-sm shadow-lg transition-all
              ${passwordLoading ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-pits-primary text-pits-dark-text hover:brightness-95 shadow-pits-primary/20'}
            `}
          >
            {passwordLoading && (
              <Loader2 size={18} className="animate-spin mr-2" />
            )}
            {passwordLoading ? t('Updating...') : t('Update password')}
          </button>
        </form>
      </div>
    </div>
  );
}
