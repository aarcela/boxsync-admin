'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  CalendarPlus,
  Check,
  Copy,
  CreditCard,
  Loader2,
  MessageCircle,
  Plus,
  QrCode,
  RotateCcw,
  Store,
  Users,
} from 'lucide-react';
import AddAthleteModal from '@/components/AddAthleteModal';
import CreateClassModal from '@/components/CreateClassModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import PaymentMethodFormModal from '@/components/PaymentMethodFormModal';
import { useLanguage } from '@/components/LanguageContext';
import { useTenant } from '@/components/TenantContext';
import { useToast } from '@/components/Toast';
import { buildPublicJoinUrl } from '@/lib/constants/app-links';
import { founderWhatsAppUrl, loadMembersWhatsAppText } from '@/lib/founder-contact';
import { GYM_TIMEZONE_OPTIONS } from '@/lib/gym-timezone';
import { currencySymbol } from '@/lib/currency';
import { membershipPlanService } from '@/lib/services/membershipPlanService';
import { paymentMethodService } from '@/lib/services/paymentMethodService';
import { financialService } from '@/lib/services/financialService';
import { SETUP_STEPS, type SetupFacts, type SetupStepId, type SetupSteps } from '@/lib/setup-progress';
import type { MembershipPlan, PaymentMethod } from '@/lib/types/gym';
import type { TranslationKey } from '@/lib/translations';
import { saveGymNameAction } from './actions';
import { saveGymTimezoneAction } from '../booking/actions';
import { createMembershipPlanAction } from '../plans/actions';

type SetupPayload = {
  tenant: { slug: string; name: string; emailConfirmed: boolean; staffReadOnly: boolean };
  steps: SetupSteps;
  facts: SetupFacts;
};

const STEP_META: Record<SetupStepId, { title: TranslationKey; hint: TranslationKey; icon: typeof Store }> = {
  profile: { title: 'Your gym', hint: 'Name and timezone', icon: Store },
  payments: { title: 'How you get paid', hint: 'Payment methods and plans', icon: CreditCard },
  classes: { title: 'Schedule', hint: 'Your first classes', icon: CalendarPlus },
  members: { title: 'Members', hint: 'Add members and share the app', icon: Users },
};

const FIELD =
  'w-full bg-pits-surface-muted border border-pits-edge rounded-xl px-4 py-3 text-sm font-semibold text-pits-text outline-none focus:ring-2 focus:ring-pits-primary/40';
const LABEL = 'text-xs font-semibold text-pits-dim';
const SECONDARY_BTN =
  'inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-pits-edge bg-pits-surface-elevated text-sm font-semibold text-pits-text hover:bg-pits-surface-muted disabled:opacity-50';
const PRIMARY_BTN =
  'inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-pits-primary text-pits-dark-text text-sm font-semibold hover:bg-pits-primary-dark disabled:opacity-50';

export default function GymSetupPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { slug, tenantId, timezone, currencies, setSettings, settings } = useTenant();
  const joinUrl = useMemo(() => buildPublicJoinUrl(slug), [slug]);

  const [payload, setPayload] = useState<SetupPayload | null>(null);
  const [version, setVersion] = useState(0);
  const [index, setIndex] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  // Step 1
  const [gymName, setGymName] = useState('');
  const [tz, setTz] = useState(timezone);
  // Step 2
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[] | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [methodModal, setMethodModal] = useState<{ method: PaymentMethod | null } | null>(null);
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [listsVersion, setListsVersion] = useState(0);
  // Steps 3–4
  const [classOpen, setClassOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/setup', { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'load_failed');
        if (cancelled) return;
        setPayload(data);
        setGymName((prev) => prev || data.tenant.name);
      })
      .catch(() => {
        if (!cancelled) toast(t('Could not load setup.'), 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [version, t, toast]);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    Promise.all([
      paymentMethodService.getPaymentMethods(tenantId),
      membershipPlanService.getMembershipPlans(tenantId),
      financialService.getEffectiveExchangeRate(tenantId, currencies.reference).catch(() => null),
    ])
      .then(([m, p, r]) => {
        if (cancelled) return;
        setMethods(m);
        setPlans(p);
        setRate(r);
      })
      .catch(() => {
        if (!cancelled) {
          setMethods([]);
          setPlans([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, currencies.reference, listsVersion]);

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

  if (!payload) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-pits-ink-muted" />
      </div>
    );
  }

  const steps = payload.steps;
  const facts = payload.facts;
  const readOnly = payload.tenant.staffReadOnly;
  const verified = payload.tenant.emailConfirmed;
  const firstOpen = SETUP_STEPS.findIndex((s) => steps[s] == null);
  const current = index ?? (firstOpen === -1 ? 0 : firstOpen);
  const step = SETUP_STEPS[current];
  const isLast = current === SETUP_STEPS.length - 1;
  const doneCount = SETUP_STEPS.filter((s) => steps[s] != null).length;
  const reload = () => setVersion((v) => v + 1);

  const patch = async (body: Record<string, string>) => {
    const res = await fetch('/api/admin/setup', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('save_failed');
    const data = await res.json();
    setPayload((prev) => (prev ? { ...prev, steps: data.steps ?? prev.steps } : prev));
  };

  const goNext = () => {
    if (isLast) setFinished(true);
    else setIndex(current + 1);
  };

  /** Saves this step's own fields (step 1), marks it done, moves on. */
  const completeStep = async () => {
    setBusy(true);
    try {
      if (step === 'profile') {
        if (gymName.trim() && gymName.trim() !== payload.tenant.name) {
          await saveGymNameAction(gymName);
        }
        if (tz !== timezone) {
          setSettings(await saveGymTimezoneAction(tz));
        }
      }
      await patch({ action: 'complete', step });
      goNext();
    } catch {
      toast(t('Action failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const skipStep = async () => {
    setBusy(true);
    try {
      await patch({ action: 'skip', step });
      goNext();
    } catch {
      toast(t('Action failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const restart = async () => {
    setConfirmRestart(false);
    setBusy(true);
    try {
      await patch({ action: 'restart' });
      setIndex(0);
      setFinished(false);
      reload();
    } catch {
      toast(t('Action failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const addPlan = async () => {
    const price = Number(planPrice);
    if (!planName.trim() || !(price >= 0) || planPrice === '') return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('name', planName.trim());
      form.append('price_usd', String(price));
      form.append('description', '');
      form.append('limit_type', 'none');
      form.append('is_active', 'true');
      await createMembershipPlanAction(form);
      toast(t('Membership plan created'), 'success');
      setPlanName('');
      setPlanPrice('');
      setListsVersion((v) => v + 1);
      reload();
    } catch {
      toast(t('Action failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const copyJoin = async () => {
    await navigator.clipboard.writeText(joinUrl);
    toast(t('Copied'), 'success');
  };

  const downloadQr = () => {
    if (!qr) return;
    const link = document.createElement('a');
    link.href = qr;
    link.download = `wodus-join-${slug}.png`;
    link.click();
  };

  const shareWhatsApp = `https://wa.me/?text=${encodeURIComponent(t('Join us on WODUS: {{url}}', { url: joinUrl }))}`;
  const paletteId =
    settings && typeof settings === 'object' ? (settings as Record<string, unknown>).paletteId : undefined;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{t('Configure your gym')}</h1>
          <p className="page-subtitle">{t('Four short steps. You can come back and change anything later.')}</p>
        </div>
        <button type="button" onClick={() => setConfirmRestart(true)} disabled={busy || readOnly} className={SECONDARY_BTN}>
          <RotateCcw size={16} />
          {t('Start over')}
        </button>
      </div>

      {!verified ? (
        <div className="rounded-2xl border border-pits-warning-edge bg-pits-warning-soft p-4 text-sm text-pits-warning">
          {t('Check your email to activate your account.')}
        </div>
      ) : null}
      {readOnly ? (
        <div className="rounded-2xl border border-pits-danger-edge bg-pits-danger-soft p-4 text-sm text-pits-danger">
          {t('Your trial has ended. The dashboard is read-only.')}
        </div>
      ) : null}

      {/* Stepper */}
      <ol className="grid grid-cols-4 gap-2">
        {SETUP_STEPS.map((s, i) => {
          const meta = STEP_META[s];
          const status = steps[s];
          const active = !finished && i === current;
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => {
                  setFinished(false);
                  setIndex(i);
                }}
                aria-current={active ? 'step' : undefined}
                className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                  active
                    ? 'border-pits-primary bg-pits-primary-soft'
                    : 'border-pits-edge bg-pits-surface-elevated hover:bg-pits-surface-muted'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-pits-dim">
                  {status === 'done' ? (
                    <Check size={14} className="text-pits-positive" />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                  {status === 'skipped' ? t('Skipped') : null}
                </span>
                <span className="block text-sm font-bold text-pits-text truncate">{t(meta.title)}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="h-1.5 rounded-full bg-pits-surface-muted overflow-hidden">
        <div className="h-full bg-pits-primary transition-all" style={{ width: `${(doneCount / SETUP_STEPS.length) * 100}%` }} />
      </div>

      {finished ? (
        <section className="rounded-2xl border border-pits-edge bg-pits-surface-elevated p-6 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-pits-positive-soft text-pits-positive flex items-center justify-center">
            <Check size={24} />
          </div>
          <h2 className="text-xl font-bold text-pits-text">{t('Your gym is ready')}</h2>
          <p className="text-sm text-pits-dim">{t('You can open this assistant again any time from Settings.')}</p>
          <div className="flex justify-center gap-2 pt-2">
            <Link href="/dashboard" className={PRIMARY_BTN}>
              {t('Go to Home')}
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-pits-edge bg-pits-surface-elevated">
          <div className="p-5 border-b border-pits-edge">
            <p className="text-xs font-semibold text-pits-dim">
              {t('Step {{current}} of {{total}}', { current: current + 1, total: SETUP_STEPS.length })}
            </p>
            <h2 className="text-xl font-bold text-pits-text">{t(STEP_META[step].title)}</h2>
            <p className="text-sm text-pits-dim">{t(STEP_META[step].hint)}</p>
          </div>

          <div className="p-5 space-y-5">
            {step === 'profile' ? (
              <>
                <div className="space-y-1.5">
                  <label className={LABEL} htmlFor="setup-name">{t('Gym name')}</label>
                  <input id="setup-name" value={gymName} onChange={(e) => setGymName(e.target.value)} disabled={readOnly} className={FIELD} maxLength={80} />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL} htmlFor="setup-tz">{t('Gym timezone')}</label>
                  <select id="setup-tz" value={tz} onChange={(e) => setTz(e.target.value)} disabled={readOnly} className={FIELD}>
                    {(GYM_TIMEZONE_OPTIONS.some((o) => o.value === tz) ? GYM_TIMEZONE_OPTIONS : [{ value: tz, label: tz }, ...GYM_TIMEZONE_OPTIONS]).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <p className="text-sm text-pits-dim">
                  {typeof paletteId === 'string' && paletteId !== 'default' ? t('App colors are customized.') : t('The app uses the default colors.')}{' '}
                  <Link href="/dashboard/appearance" className="font-semibold text-pits-info hover:underline">{t('Change colors and names')}</Link>
                </p>
              </>
            ) : null}

            {step === 'payments' ? (
              <>
                <div className="rounded-xl bg-pits-surface-muted/60 px-4 py-3 text-sm text-pits-text flex flex-wrap items-center gap-x-2">
                  <span>
                    {currencies.local !== currencies.reference
                      ? t('Plans are priced in {{ref}}; members can also pay in {{local}}.', { ref: currencies.reference, local: currencies.local })
                      : t('Plans are priced in {{ref}}.', { ref: currencies.reference, local: currencies.local })}
                    {rate && currencies.local !== currencies.reference
                      ? ` ${currencySymbol(currencies.reference)}1 = ${rate.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currencies.local}.`
                      : ''}
                  </span>
                  <Link href="/dashboard/payment_methods" className="font-semibold text-pits-info hover:underline">{t('Change')}</Link>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-pits-text">{t('Payment methods')}</h3>
                    <button type="button" onClick={() => setMethodModal({ method: null })} disabled={readOnly} className={SECONDARY_BTN}>
                      <Plus size={16} /> {t('Add Method')}
                    </button>
                  </div>
                  {methods === null ? (
                    <p className="text-sm text-pits-dim">{t('Loading...')}</p>
                  ) : methods.length === 0 ? (
                    <p className="text-sm text-pits-dim">{t('No payment methods yet. Add how members pay you (Pago Móvil, Zelle, cash…).')}</p>
                  ) : (
                    <ul className="divide-y divide-pits-edge rounded-xl border border-pits-edge">
                      {methods.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                          <span className="text-sm font-semibold text-pits-text truncate">
                            {m.label} <span className="font-normal text-pits-dim">· {m.currency}{m.is_active ? '' : ` · ${t('Inactive')}`}</span>
                          </span>
                          <button type="button" onClick={() => setMethodModal({ method: m })} disabled={readOnly} className="text-sm font-semibold text-pits-info hover:underline">
                            {t('Edit')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-pits-text">{t('Membership Plans')}</h3>
                    <Link href="/dashboard/plans" className="text-sm font-semibold text-pits-info hover:underline">{t('More plan options')}</Link>
                  </div>
                  {plans && plans.length > 0 ? (
                    <ul className="divide-y divide-pits-edge rounded-xl border border-pits-edge">
                      {plans.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                          <span className="font-semibold text-pits-text truncate">{p.name}</span>
                          <span className="tabular-nums text-pits-text">{currencySymbol(currencies.reference)}{Number(p.price_usd).toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  ) : plans ? (
                    <p className="text-sm text-pits-dim">{t('No plans yet. Add your main membership below.')}</p>
                  ) : null}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder={t('Plan name, e.g. Unlimited')} disabled={readOnly} className={`${FIELD} sm:flex-1`} />
                    <input type="number" min="0" step="0.01" value={planPrice} onChange={(e) => setPlanPrice(e.target.value)} placeholder={`${t('Monthly price')} (${currencies.reference})`} disabled={readOnly} className={`${FIELD} sm:w-48`} />
                    <button type="button" onClick={() => void addPlan()} disabled={busy || readOnly || !planName.trim() || planPrice === ''} className={SECONDARY_BTN}>
                      <Plus size={16} /> {t('Add plan')}
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {step === 'classes' ? (
              <>
                <p className="text-sm text-pits-text">
                  {facts.classCount > 0
                    ? t('You have {{count}} classes scheduled.', { count: facts.classCount })
                    : t('No classes yet. Add your weekly schedule: a recurring class takes one form.')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setClassOpen(true)} disabled={readOnly} className={PRIMARY_BTN}>
                    <CalendarPlus size={16} /> {t('Add class')}
                  </button>
                  <Link href="/dashboard/schedule" className={SECONDARY_BTN}>{t('Open schedule')}</Link>
                  <Link href="/dashboard/class_types" className={SECONDARY_BTN}>{t('Class types')}</Link>
                </div>
              </>
            ) : null}

            {step === 'members' ? (
              <>
                <p className="text-sm text-pits-text">
                  {facts.memberCount > 0
                    ? t('You have {{count}} members.', { count: facts.memberCount })
                    : t('No members yet.')}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => (verified ? setMemberOpen(true) : toast(t('Check your email to activate your account.'), 'error'))}
                    disabled={readOnly}
                    className={PRIMARY_BTN}
                  >
                    <Plus size={16} /> {t('Add Athlete')}
                  </button>
                  <a href={founderWhatsAppUrl(loadMembersWhatsAppText(gymName || payload.tenant.name))} target="_blank" rel="noopener noreferrer" className={SECONDARY_BTN}>
                    <MessageCircle size={16} /> {t('We will load your members')}
                  </a>
                </div>

                <div className="rounded-xl border border-pits-edge p-4 space-y-3">
                  <h3 className="text-base font-bold text-pits-text">{t('Let members join on their own')}</h3>
                  {verified ? (
                    <div className="flex flex-col sm:flex-row gap-4">
                      {qr ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={qr} alt={t('Join QR code')} className="w-32 h-32 rounded-lg border border-pits-edge shrink-0" />
                      ) : null}
                      <div className="space-y-2 min-w-0">
                        <p className="text-xs font-mono text-pits-dim break-all">{joinUrl}</p>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => void copyJoin()} className={SECONDARY_BTN}><Copy size={16} /> {t('Copy link')}</button>
                          <button type="button" onClick={downloadQr} disabled={!qr} className={SECONDARY_BTN}><QrCode size={16} /> {t('Download QR')}</button>
                          <a href={shareWhatsApp} target="_blank" rel="noopener noreferrer" className={SECONDARY_BTN}><MessageCircle size={16} /> WhatsApp</a>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-pits-warning">{t('Verify your email before sharing the join link.')}</p>
                  )}
                </div>
              </>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 p-4 border-t border-pits-edge">
            <button type="button" onClick={() => setIndex(Math.max(0, current - 1))} disabled={current === 0 || busy} className="h-10 px-4 rounded-xl text-sm font-semibold text-pits-dim hover:text-pits-text disabled:opacity-40">
              {t('Back')}
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => void skipStep()} disabled={busy || readOnly} className="h-10 px-4 rounded-xl text-sm font-semibold text-pits-dim hover:text-pits-text disabled:opacity-40">
                {t('Skip')}
              </button>
              <button type="button" onClick={() => void completeStep()} disabled={busy || readOnly} className={PRIMARY_BTN}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                {isLast ? t('Finish') : t('Save and continue')}
              </button>
            </div>
          </div>
        </section>
      )}

      {methodModal ? (
        <PaymentMethodFormModal
          method={methodModal.method}
          effectiveRate={rate}
          onClose={() => setMethodModal(null)}
          onSaved={() => {
            setListsVersion((v) => v + 1);
            reload();
          }}
        />
      ) : null}
      <CreateClassModal
        isOpen={classOpen}
        onClose={() => setClassOpen(false)}
        onSuccess={() => {
          setClassOpen(false);
          reload();
        }}
      />
      <AddAthleteModal
        isOpen={memberOpen}
        onClose={() => setMemberOpen(false)}
        onSuccess={() => {
          setMemberOpen(false);
          reload();
        }}
      />
      <ConfirmDialog
        isOpen={confirmRestart}
        title={t('Start the assistant over?')}
        message={t('Your gym data stays as it is. The assistant just walks you through every step again.')}
        confirmLabel={t('Start over')}
        onConfirm={() => void restart()}
        onCancel={() => setConfirmRestart(false)}
      />
    </div>
  );
}
