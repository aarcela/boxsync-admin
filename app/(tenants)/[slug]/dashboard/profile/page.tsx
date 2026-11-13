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
  Eye,
  EyeOff,
  X,
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

/** The support contact may be stored as a wa.me link; show it as a phone number. */
function supportToPhone(value: string): string {
  const match = value.trim().match(/^https?:\/\/wa\.me\/(\d+)/i);
  return match ? `+${match[1]}` : value;
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
  const [savedPhone, setSavedPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
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
      toast(t('Could not copy. Select the text and copy it by hand.'), 'error');
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
        setFullName(data.full_name || '');

        let phoneValue = data.phone || '';
        if (!phoneValue) {
          try {
            phoneValue = await tenantSupportService.getForTenant(tenantId);
          } catch {
            phoneValue = '';
          }
        }
        phoneValue = supportToPhone(phoneValue);
        setPhone(phoneValue);
        setSavedPhone(phoneValue);
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
    const name = fullName.trim();
    if (!name) {
      toast(t('Your name can’t be empty.'), 'error');
      return;
    }
    setPhoneSaving(true);
    try {
      const trimmed = phone.trim();
      const { error } = await supabase
        .from('profiles')
        .update({ phone: trimmed || null, full_name: name })
        .eq('id', userId);
      if (error) throw error;

      // The support contact is gym-wide; only touch it when the phone actually changed.
      if (trimmed !== savedPhone.trim()) {
        await tenantSupportService.updateForTenant(tenantId, toSupportWhatsAppUrl(trimmed));
      }

      setProfile((prev) => (prev ? { ...prev, phone: trimmed || null, full_name: name } : prev));
      setFullName(name);
      setPhone(trimmed);
      setSavedPhone(trimmed);
      toast(t('Profile saved'), 'success');
    } catch (error) {
      console.error(error);
      toast(t('Failed to save profile'), 'error');
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

  const profileDirty =
    !!profile && (fullName.trim() !== (profile.full_name || '') || phone.trim() !== savedPhone.trim());
  const pwLongEnough = newPassword.length >= MIN_RESET_PASSWORD_LENGTH;
  const pwMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const pwReady = currentPassword.length > 0 && pwLongEnough && pwMatch;

  const inputClass =
    'w-full h-11 px-3 bg-pits-surface border border-pits-edge rounded-lg text-sm text-pits-ink focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary transition-all outline-none disabled:opacity-60';

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
        <div className="p-4 sm:p-6 flex items-center gap-4 sm:gap-5 border-b border-pits-edge bg-pits-surface-muted/40">
          <div className="w-16 h-16 bg-pits-primary rounded-full flex items-center justify-center text-pits-dark-text font-black text-xl shrink-0">
            {getInitials(profile.full_name)}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-black text-pits-ink truncate">
              {profile.full_name || t('Admin')}
            </h2>
            <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-pits-primary/15 text-pits-primary text-xs font-semibold">
              <Shield size={12} />
              {roleLabel(profile.role, t)}
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-pits-ink">
                <User size={15} className="text-pits-ink-muted" /> {t('Full name')}
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={phoneSaving}
                autoComplete="name"
                className={inputClass}
              />
            </label>
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-pits-ink">
                <Mail size={15} className="text-pits-ink-muted" /> {t('Email')}
              </p>
              <p className="flex h-11 items-center truncate rounded-lg border border-pits-edge bg-pits-surface-muted/50 px-3 text-sm text-pits-ink-muted">
                {email || '—'}
              </p>
            </div>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-pits-ink">
                <Phone size={15} className="text-pits-ink-muted" /> {t('Phone')}
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={phoneSaving}
                autoComplete="tel"
                placeholder="+58 412 000 0000"
                className={inputClass}
              />
              <span className="mt-1.5 block text-xs text-pits-ink-muted">
                {t('Shown to athletes in the app as your box support contact')}
              </span>
            </label>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs text-pits-ink-muted">
              <Calendar size={13} />
              {t('Member since')} {profile.created_at ? formatDate(profile.created_at, lang) : '—'}
            </p>
            {profileDirty ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFullName(profile.full_name || '');
                    setPhone(savedPhone);
                  }}
                  disabled={phoneSaving}
                  className="min-h-11 sm:min-h-9 flex-1 sm:flex-none rounded-lg px-3 text-sm font-semibold text-pits-ink-muted hover:text-pits-ink hover:bg-pits-surface-muted disabled:opacity-50"
                >
                  {t('Discard changes')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSavePhone()}
                  disabled={phoneSaving || !fullName.trim()}
                  className="min-h-11 sm:min-h-9 flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg bg-pits-primary px-4 text-sm font-bold text-pits-dark-text hover:brightness-95 disabled:opacity-50"
                >
                  {phoneSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {t('Save changes')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="bg-pits-surface rounded-2xl border border-pits-edge shadow-sm p-4 sm:p-6">
        {!emailConfirmed && (
          <p className="mb-4 text-sm font-bold text-pits-warning">
            {t('Verify your email before sharing the join link.')}
          </p>
        )}
        <div className={`flex items-start gap-3 mb-6 ${emailConfirmed ? '' : 'opacity-40 pointer-events-none'}`}>
          <div className="p-2.5 rounded-xl bg-pits-primary/15 text-pits-primary shrink-0">
            <QrCode size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-pits-ink">
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
              <p className="text-xs font-semibold text-pits-ink-muted">
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
                className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg border border-pits-edge bg-pits-surface text-pits-ink text-sm font-semibold hover:bg-pits-surface-muted transition-colors"
              >
                {copiedField === 'slug' ? <Check size={16} /> : <Copy size={16} />}
                {t('Copy gym code')}
              </button>

              <button
                type="button"
                onClick={() => void copyText(joinLink, 'link')}
                className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg border border-pits-edge bg-pits-surface text-pits-ink text-sm font-semibold hover:bg-pits-surface-muted transition-colors"
              >
                {copiedField === 'link' ? <Check size={16} /> : <Copy size={16} />}
                {t('Copy join link')}
              </button>

              <button
                type="button"
                onClick={() => void handleDownloadJoinQr()}
                disabled={downloadingJoinQr || !joinQrDataUrl}
                className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold text-sm shadow-lg transition-all
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

      <div className="bg-pits-surface rounded-2xl border border-pits-edge shadow-sm p-4 sm:p-6">
        <div className="flex items-start gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-pits-primary/15 text-pits-primary shrink-0">
            <QrCode size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-pits-ink">
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
                className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold text-sm shadow-lg transition-all
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
                  window.open('/dashboard/profile/checkin-print', '_blank');
                }}
                disabled={!checkinLink}
                className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg border border-pits-edge bg-pits-surface text-pits-ink text-sm font-semibold hover:bg-pits-surface-muted transition-colors disabled:opacity-50"
              >
                <Printer size={16} />
                {t('Print / PDF')}
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setRotateConfirmOpen(true)}
                  disabled={rotatingCode || checkinQrGenerating}
                  className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-lg border border-pits-warning-edge bg-pits-warning-soft text-pits-warning text-sm font-semibold hover:bg-pits-warning-soft transition-colors disabled:opacity-50"
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

      <div className="bg-pits-surface rounded-2xl border border-pits-edge shadow-sm p-4 sm:p-6">
        <h3 className="text-lg font-bold text-pits-ink">
          {t('Change password')}
        </h3>
        <p className="text-sm text-pits-ink-muted mt-1 mb-6">
          {t('Enter your current password to set a new one.')}
        </p>

        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
          <button
            type="button"
            onClick={() => setShowPasswords((v) => !v)}
            aria-pressed={showPasswords}
            className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-pits-ink-muted hover:text-pits-ink"
          >
            {showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
            {showPasswords ? t('Hide passwords') : t('Show passwords')}
          </button>
          <div>
            <label className="block text-sm font-medium text-pits-ink mb-1.5">
              {t('Current password')}
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={passwordLoading}
              className="w-full h-11 px-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary transition-all outline-none disabled:opacity-60"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-pits-ink mb-1.5">
              {t('New password')}
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={MIN_RESET_PASSWORD_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={passwordLoading}
              className="w-full h-11 px-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary transition-all outline-none disabled:opacity-60"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-pits-ink mb-1.5">
              {t('Confirm password')}
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={MIN_RESET_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={passwordLoading}
              className="w-full h-11 px-3 bg-pits-surface-muted border border-pits-edge rounded-lg text-pits-ink font-medium focus:ring-2 focus:ring-pits-primary/40 focus:border-pits-primary transition-all outline-none disabled:opacity-60"
              placeholder="••••••••"
            />
          </div>

          {newPassword.length > 0 ? (
            <ul className="space-y-1 text-xs">
              <li className={`flex items-center gap-1.5 ${pwLongEnough ? 'text-pits-positive' : 'text-pits-ink-muted'}`}>
                {pwLongEnough ? <Check size={13} /> : <X size={13} />}
                {t('At least {{count}} characters', { count: MIN_RESET_PASSWORD_LENGTH })}
              </li>
              {confirmPassword.length > 0 ? (
                <li className={`flex items-center gap-1.5 ${pwMatch ? 'text-pits-positive' : 'text-pits-danger'}`}>
                  {pwMatch ? <Check size={13} /> : <X size={13} />}
                  {pwMatch ? t('Passwords match') : t('Passwords do not match.')}
                </li>
              ) : null}
            </ul>
          ) : null}

          {passwordError && (
            <div className="bg-pits-danger-soft text-pits-danger text-sm font-bold p-3 rounded-lg">
              {passwordError}
            </div>
          )}

          <button
            type="submit"
            disabled={passwordLoading || !pwReady}
            className="min-h-11 w-full sm:w-auto px-6 rounded-lg flex items-center justify-center font-bold text-sm bg-pits-primary text-pits-dark-text hover:brightness-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
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
