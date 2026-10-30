'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  Loader2,
  MessageCircle,
  QrCode,
  SkipForward,
} from 'lucide-react';
import AddAthleteModal from '@/components/AddAthleteModal';
import CreateClassModal from '@/components/CreateClassModal';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import { useToast } from '@/components/Toast';
import { buildPublicJoinUrl } from '@/lib/constants/app-links';
import {
  FOUNDER_WHATSAPP_URL,
  founderWhatsAppUrl,
  loadMembersWhatsAppText,
} from '@/lib/founder-contact';
import { SETUP_STEPS, type SetupStepId, type SetupSteps } from '@/lib/setup-progress';
import type { TranslationKey } from '@/lib/translations';
import { saveGymNameAction } from './actions';

type SetupPayload = {
  tenant: {
    slug: string;
    name: string;
    emailConfirmed: boolean;
    staffReadOnly: boolean;
  };
  steps: SetupSteps;
  facts: { paymentMethodCount: number; classCount: number; memberCount: number };
};

const STEP_META: Record<
  SetupStepId,
  { title: TranslationKey; hint: TranslationKey; href?: string }
> = {
  profile: {
    title: 'Gym profile',
    hint: 'Name, colors, and terminology',
    href: '/dashboard/appearance',
  },
  payments: {
    title: 'Payments',
    hint: 'Methods, currency, plans, and overdue mode',
    href: '/dashboard/payment_methods',
  },
  classes: {
    title: 'Classes and schedule',
    hint: 'Class types are ready — add at least one class',
  },
  members: {
    title: 'Members',
    hint: 'Add manually, share the join link, or ask us to import',
  },
  share: {
    title: 'Share the app',
    hint: 'Join link and QR for your members',
  },
};

export default function GymSetupPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { slug, name } = useTenant();
  const [loading, setLoading] = useState(true);
  const [gymName, setGymName] = useState(name);
  const [payload, setPayload] = useState<SetupPayload | null>(null);
  const [classOpen, setClassOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const joinUrl = useMemo(() => buildPublicJoinUrl(slug), [slug]);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/setup', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'load_failed');
    setPayload(data);
    setGymName(data.tenant.name);
  }, []);

  useEffect(() => {
    load()
      .catch(() => toast(t('Could not load setup.'), 'error'))
      .finally(() => setLoading(false));
  }, [load, t, toast]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(joinUrl, { width: 480, margin: 2, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  const patch = async (body: Record<string, string>) => {
    const res = await fetch('/api/admin/setup', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'save_failed');
    await load();
  };

  const saveName = async () => {
    try {
      await saveGymNameAction(gymName);
      toast(t('Gym name saved.'), 'success');
      await load();
    } catch {
      toast(t('Could not save gym name.'), 'error');
    }
  };

  const copyJoin = async () => {
    await navigator.clipboard.writeText(joinUrl);
    toast(t('Copied'), 'success');
    await patch({ action: 'complete', step: 'share' });
  };

  const downloadQr = () => {
    if (!qr) return;
    const link = document.createElement('a');
    link.href = qr;
    link.download = `wodus-join-${slug}.png`;
    link.click();
    void patch({ action: 'complete', step: 'share' });
  };

  if (loading || !payload) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-pits-ink-muted" />
      </div>
    );
  }

  const steps = payload.steps;
  const doneCount = SETUP_STEPS.filter(
    (step) => steps[step] === 'done' || steps[step] === 'skipped'
  ).length;
  const percent = Math.round((doneCount / SETUP_STEPS.length) * 100);
  const verified = payload.tenant.emailConfirmed;
  const readOnly = payload.tenant.staffReadOnly;
  const waShare = `${FOUNDER_WHATSAPP_URL}?text=${encodeURIComponent(
    t('Join us on WODUS: {{url}}', { url: joinUrl })
  )}`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-pits-ink-muted">
          {t('Setup assistant')}
        </p>
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-pits-ink">
          {t('Configure your gym')}
        </h1>
        <p className="text-sm text-pits-ink-muted mt-1">
          {t('{{done}} of {{total}} steps', {
            done: String(doneCount),
            total: String(SETUP_STEPS.length),
          })}
        </p>
        <div className="mt-3 h-2 rounded-full bg-pits-surface-muted overflow-hidden">
          <div className="h-full bg-pits-primary" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {!verified && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
          {t('Check your email to activate your account.')}{' '}
          <button
            type="button"
            className="font-bold underline"
            onClick={async () => {
              await fetch('/api/public/gym-signup/resend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: '' }),
              });
              toast(t('Verification email sent.'), 'success');
            }}
          >
            {t('Resend email')}
          </button>
        </div>
      )}

      {readOnly && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {t('Your trial has ended. The dashboard is read-only.')}
        </div>
      )}

      <ol className="space-y-4">
        {SETUP_STEPS.map((step, index) => {
          const meta = STEP_META[step];
          const status = steps[step];
          return (
            <li
              key={step}
              className="rounded-2xl border border-pits-edge bg-pits-surface-elevated p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-pits-ink-muted">
                    {index + 1}
                  </p>
                  <h2 className="font-black uppercase italic text-pits-ink">
                    {t(meta.title)}
                  </h2>
                  <p className="text-sm text-pits-ink-muted">{t(meta.hint)}</p>
                </div>
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${
                    status === 'done'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : status === 'skipped'
                        ? 'bg-gray-50 text-gray-600 border-gray-200'
                        : 'bg-orange-50 text-orange-700 border-orange-200'
                  }`}
                >
                  {status === 'done'
                    ? t('Done')
                    : status === 'skipped'
                      ? t('Skipped')
                      : t('To do')}
                </span>
              </div>

              {step === 'profile' && (
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <input
                    value={gymName}
                    onChange={(e) => setGymName(e.target.value)}
                    className="flex-1 rounded-lg border border-pits-edge px-3 py-2 text-sm"
                    disabled={readOnly}
                  />
                  <button
                    type="button"
                    onClick={() => void saveName()}
                    disabled={readOnly}
                    className="px-4 py-2 rounded-lg bg-pits-black text-white text-xs font-black uppercase tracking-wider disabled:opacity-50"
                  >
                    {t('Save name')}
                  </button>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {meta.href && (
                  <Link
                    href={meta.href}
                    className="px-3 py-2 rounded-lg bg-pits-primary text-pits-dark-text text-xs font-black uppercase tracking-wider"
                  >
                    {t('Open')}
                  </Link>
                )}
                {step === 'payments' && (
                  <>
                    <Link href="/dashboard/plans" className="px-3 py-2 rounded-lg border text-xs font-black uppercase tracking-wider">
                      {t('Plans')}
                    </Link>
                    <Link href="/dashboard/booking" className="px-3 py-2 rounded-lg border text-xs font-black uppercase tracking-wider">
                      {t('Booking')}
                    </Link>
                  </>
                )}
                {step === 'classes' && (
                  <>
                    <Link href="/dashboard/class_types" className="px-3 py-2 rounded-lg border text-xs font-black uppercase tracking-wider">
                      {t('Class types')}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setClassOpen(true)}
                      disabled={readOnly}
                      className="px-3 py-2 rounded-lg bg-pits-primary text-pits-dark-text text-xs font-black uppercase tracking-wider disabled:opacity-50"
                    >
                      {t('Add class')}
                    </button>
                  </>
                )}
                {step === 'members' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (!verified) {
                          toast(t('Check your email to activate your account.'), 'error');
                          return;
                        }
                        setMemberOpen(true);
                      }}
                      disabled={readOnly}
                      className="px-3 py-2 rounded-lg bg-pits-primary text-pits-dark-text text-xs font-black uppercase tracking-wider disabled:opacity-50"
                    >
                      {t('Add Athlete')}
                    </button>
                    <a
                      href={founderWhatsAppUrl(loadMembersWhatsAppText(gymName || name))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-lg border text-xs font-black uppercase tracking-wider inline-flex items-center gap-1"
                    >
                      <MessageCircle size={14} />
                      {t('We will load your members')}
                    </a>
                  </>
                )}
                {step === 'share' && verified && (
                  <>
                    <button
                      type="button"
                      onClick={() => void copyJoin()}
                      className="px-3 py-2 rounded-lg border text-xs font-black uppercase tracking-wider inline-flex items-center gap-1"
                    >
                      <Copy size={14} /> {t('Copy link')}
                    </button>
                    <button
                      type="button"
                      onClick={downloadQr}
                      className="px-3 py-2 rounded-lg border text-xs font-black uppercase tracking-wider inline-flex items-center gap-1"
                    >
                      <QrCode size={14} /> {t('Download QR')}
                    </button>
                    <a
                      href={waShare}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-lg border text-xs font-black uppercase tracking-wider"
                    >
                      WhatsApp
                    </a>
                  </>
                )}
                {status !== 'done' && (
                  <button
                    type="button"
                    onClick={() => void patch({ action: 'skip', step })}
                    disabled={readOnly}
                    className="px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider text-pits-ink-muted inline-flex items-center gap-1"
                  >
                    <SkipForward size={14} /> {t('Skip')}
                  </button>
                )}
                {status === 'done' && (
                  <span className="inline-flex items-center gap-1 text-green-700 text-xs font-bold uppercase">
                    <Check size={14} /> {t('Detected from your data')}
                  </span>
                )}
              </div>

              {step === 'share' && verified && qr && (
                <img src={qr} alt="" className="mt-4 w-40 h-40 rounded-xl border" />
              )}
              {step === 'share' && verified && (
                <p className="mt-2 text-xs font-mono text-pits-ink-muted break-all">{joinUrl}</p>
              )}
              {step === 'share' && !verified && (
                <p className="mt-3 text-sm text-orange-800">
                  {t('Verify your email before sharing the join link.')}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <CreateClassModal
        isOpen={classOpen}
        onClose={() => setClassOpen(false)}
        onSuccess={() => {
          setClassOpen(false);
          void load();
        }}
      />
      <AddAthleteModal
        isOpen={memberOpen}
        onClose={() => setMemberOpen(false)}
        onSuccess={() => {
          setMemberOpen(false);
          void load();
        }}
      />
    </div>
  );
}
