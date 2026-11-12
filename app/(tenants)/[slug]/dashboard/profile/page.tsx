'use client';

import { useEffect, useMemo, useState } from 'react';
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
  Printer,
  RefreshCw,
} from 'lucide-react';
import QRCode from 'qrcode';
import ConfirmDialog from '@/components/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils/format-date';
import { useLanguage } from '@/components/LanguageContext';
import { useToast } from '@/components/Toast';
import { useTenant } from '@/components/TenantContext';
import {
  isStaffRole,
  MIN_RESET_PASSWORD_LENGTH,
  resolvePasswordResetError,
} from '@/lib/auth';
import {
  buildMobileJoinDeepLink,
  buildPublicCheckinUrl,
} from '@/lib/constants/app-links';
import { checkinCodeService } from '@/lib/services/checkinCodeService';
import { tenantSupportService } from '@/lib/services/tenantSupportService';
import { normalizeWhatsAppRecipient } from '@/lib/whatsapp';
import type { TranslationKey } from '@/lib/translations';

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

function toSupportWhatsAppUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const digits = normalizeWhatsAppRecipient(trimmed);
  return digits ? `https://wa.me/${digits}` : '';
}

function roleLabel(role: string, t: (key: TranslationKey) => string): string {
  if (role === 'admin') return t('Admin');
  if (role === 'manager') return t('Manager');
  return role;
}

export default function ProfilePage() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const { slug, name: tenantName, tenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [userId, setUserId] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [downloadingJoinQr, setDownloadingJoinQr] = useState(false);
  const [downloadingCheckinQr, setDownloadingCheckinQr] = useState(false);
  const [joinQrDataUrl, setJoinQrDataUrl] = useState<string | null>(null);
  const [checkinQrDataUrl, setCheckinQrDataUrl] = useState<string | null>(null);
  const [qrGenerating, setQrGenerating] = useState(true);
  const [checkinQrGenerating, setCheckinQrGenerating] = useState(true);
  const [checkinCode, setCheckinCode] = useState<string | null>(null);
  const [acceptLegacyQr, setAcceptLegacyQr] = useState(false);
  const [legacySaving, setLegacySaving] = useState(false);
  const [rotatingCode, setRotatingCode] = useState(false);
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<'slug' | 'link' | null>(null);
  const [emailConfirmed, setEmailConfirmed] = useState(true);

  const isAdmin = profile?.role === 'admin';
  const joinLink = useMemo(() => buildMobileJoinDeepLink(slug), [slug]);
  const checkinLink = useMemo(
    () => (checkinCode ? buildPublicCheckinUrl(checkinCode) : null),
    [checkinCode]
  );

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

  useEffect(() => {
    let cancelled = false;

    const loadCheckin = async () => {
      setCheckinQrGenerating(true);
      try {
        const row = await checkinCodeService.get();
        if (cancelled) return;
        if (!row?.code) {
          setCheckinCode(null);
          setCheckinQrDataUrl(null);
          setAcceptLegacyQr(false);
          return;
        }
        setCheckinCode(row.code);
        setAcceptLegacyQr(row.accept_legacy_qr);
        const dataUrl = await QRCode.toDataURL(buildPublicCheckinUrl(row.code), {
          width: 480,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#111111',
            light: '#ffffff',
          },
        });
        if (!cancelled) setCheckinQrDataUrl(dataUrl);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setCheckinCode(null);
          setCheckinQrDataUrl(null);
          toast(t('Failed to load check-in QR'), 'error');
        }
      } finally {
        if (!cancelled) setCheckinQrGenerating(false);
      }
    };

    void loadCheckin();
    return () => {
      cancelled = true;
    };
  }, [t, toast]);

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

  const handleDownloadCheckinQr = async () => {
    if (!checkinQrDataUrl) {
      toast(t('Failed to download QR code'), 'error');
      return;
    }

    setDownloadingCheckinQr(true);
    try {
      const link = document.createElement('a');
      link.href = checkinQrDataUrl;
      link.download = `wodus-checkin-${slug}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error(error);
      toast(t('Failed to download QR code'), 'error');
    } finally {
      setDownloadingCheckinQr(false);
    }
  };

  const handleRotateCheckinCode = async () => {
    setRotateConfirmOpen(false);
    setRotatingCode(true);
    try {
      const nextCode = await checkinCodeService.rotate();
      setCheckinCode(nextCode);
      const dataUrl = await QRCode.toDataURL(buildPublicCheckinUrl(nextCode), {
        width: 480,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#111111',
          light: '#ffffff',
        },
      });
      setCheckinQrDataUrl(dataUrl);
      toast(t('Check-in code regenerated'), 'success');
    } catch (error) {
      console.error(error);
      toast(t('Failed to regenerate check-in code'), 'error');
    } finally {
      setRotatingCode(false);
    }
  };

  const handleToggleLegacyQr = async (next: boolean) => {
    setLegacySaving(true);
    const previous = acceptLegacyQr;
    setAcceptLegacyQr(next);
    try {
      await checkinCodeService.setAcceptLegacy(next);
      toast(t('Legacy QR setting saved'), 'success');
    } catch (error) {
      console.error(error);
      setAcceptLegacyQr(previous);
      toast(t('Failed to update legacy QR setting'), 'error');
    } finally {
      setLegacySaving(false);
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
        setUserId(user.id);
        setEmailConfirmed(Boolean(user.email_confirmed_at));

        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, phone, role, created_at')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        if (!isStaffRole(data?.role)) throw new Error('staff_only');

        setProfile(data as StaffProfile);

        let phoneValue = data.phone || '';
        if (!phoneValue) {
          try {
            phoneValue = await tenantSupportService.getForTenant(tenantId);
          } catch {
            phoneValue = '';
          }
        }
        setPhone(phoneValue);
      } catch (error) {
        console.error(error);
        toast(t('Failed to load profile'), 'error');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [t, toast, tenantId]);

  const handleSavePhone = async () => {
    if (!userId) return;
    setPhoneSaving(true);
    try {
      const trimmed = phone.trim();
      const { error } = await supabase
        .from('profiles')
        .update({ phone: trimmed || null })
        .eq('id', userId);
      if (error) throw error;

      await tenantSupportService.updateForTenant(
        tenantId,
        toSupportWhatsAppUrl(trimmed)
      );

      setProfile((prev) => (prev ? { ...prev, phone: trimmed || null } : prev));
      toast(t('Phone saved'), 'success');
    } catch (error) {
      console.error(error);
      toast(t('Failed to save phone'), 'error');
    } finally {
      setPhoneSaving(false);
    }
  };

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
    <>
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">
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

          <div className="flex items-start gap-3 p-4 rounded-xl bg-pits-surface-muted/50 border border-pits-edge sm:col-span-2">
            <Phone size={18} className="text-pits-ink-muted mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <dt className="text-[10px] font-black uppercase tracking-wider text-pits-ink-muted">
                {t('Phone')}
              </dt>
              <p className="text-[11px] text-pits-ink-muted mt-0.5">
                {t('Shown to athletes in the app as your box support contact')}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={phoneSaving}
                  placeholder="+58 412 000 0000"
                  className="flex-1 p-3 bg-pits-surface border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary transition-all outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => void handleSavePhone()}
                  disabled={phoneSaving}
                  className={`px-4 py-3 rounded-lg font-bold uppercase tracking-widest text-xs shrink-0 transition-all
                    ${phoneSaving ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-pits-primary text-pits-dark-text hover:brightness-95'}
                  `}
                >
                  {phoneSaving ? t('Updating...') : t('Save Changes')}
                </button>
              </div>
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
                  ? formatDate(profile.created_at, lang)
                  : '—'}
              </dd>
            </div>
          </div>
        </dl>
      </div>

      <div className="bg-pits-surface rounded-2xl border border-pits-edge shadow-sm p-6">
        {!emailConfirmed && (
          <p className="mb-4 text-sm font-bold text-orange-700">
            {t('Verify your email before sharing the join link.')}
          </p>
        )}
        <div className={`flex items-start gap-3 mb-6 ${emailConfirmed ? '' : 'opacity-40 pointer-events-none'}`}>
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

        <div className={`flex flex-col sm:flex-row items-center gap-6 ${emailConfirmed ? '' : 'opacity-40 pointer-events-none'}`}>
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
              {t('Check-in QR')}
            </h3>
            <p className="text-sm text-pits-ink-muted mt-1">
              {t(
                'Print this QR at the front desk. Athletes scan it in WODUS to mark attendance.'
              )}
            </p>
            <p className="text-sm font-bold text-pits-ink mt-2">{tenantName}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="p-4 bg-white rounded-2xl border border-pits-edge shadow-sm shrink-0 flex items-center justify-center w-[232px] h-[232px]">
            {checkinQrGenerating ? (
              <Loader2 className="animate-spin text-pits-primary" size={28} />
            ) : checkinQrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={checkinQrDataUrl}
                alt={t('Check-in QR')}
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
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void handleDownloadCheckinQr()}
                disabled={downloadingCheckinQr || !checkinQrDataUrl}
                className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold uppercase tracking-widest text-sm shadow-lg transition-all
                  ${
                    downloadingCheckinQr || !checkinQrDataUrl
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-pits-primary text-pits-dark-text hover:brightness-95 shadow-pits-primary/20'
                  }
                `}
              >
                {downloadingCheckinQr ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Download size={18} />
                )}
                {downloadingCheckinQr ? t('Downloading...') : t('Download QR code')}
              </button>

              <button
                type="button"
                onClick={() => {
                  window.open(`/${slug}/dashboard/profile/checkin-print`, '_blank');
                }}
                disabled={!checkinLink}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-pits-edge bg-pits-surface text-pits-ink text-sm font-bold uppercase tracking-widest hover:bg-pits-surface-muted transition-colors disabled:opacity-50"
              >
                <Printer size={16} />
                {t('Print / PDF')}
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setRotateConfirmOpen(true)}
                  disabled={rotatingCode || checkinQrGenerating}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-orange-300 bg-orange-50 text-orange-800 text-sm font-bold uppercase tracking-widest hover:bg-orange-100 transition-colors disabled:opacity-50"
                >
                  {rotatingCode ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  {t('Regenerate code')}
                </button>
              )}
            </div>

            {isAdmin && (
              <label className="flex items-start gap-3 rounded-xl border border-pits-edge bg-pits-surface-muted/50 p-4 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-pits-edge text-pits-primary focus:ring-pits-primary/40"
                  checked={acceptLegacyQr}
                  disabled={legacySaving || checkinQrGenerating}
                  onChange={(e) => void handleToggleLegacyQr(e.target.checked)}
                />
                <span>
                  <span className="block text-sm font-bold text-pits-ink">
                    {t('Accept previous QR')}
                  </span>
                  <span className="block text-xs text-pits-ink-muted mt-1">
                    {t(
                      'Allow the old lobby / join QR to check in members of this gym.'
                    )}
                  </span>
                </span>
              </label>
            )}
          </div>
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

    <ConfirmDialog
      isOpen={rotateConfirmOpen}
      title={t('Regenerate check-in QR?')}
      message={t('Printed check-in QRs will stop working immediately.')}
      confirmLabel={t('Regenerate')}
      cancelLabel={t('Cancel')}
      variant="warning"
      onConfirm={() => void handleRotateCheckinCode()}
      onCancel={() => setRotateConfirmOpen(false)}
    />
    </>
  );
}
