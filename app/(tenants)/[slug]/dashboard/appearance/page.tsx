'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Check, ClipboardCheck, Dumbbell, Loader2, MessagesSquare, Trophy, Wallet } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useToast } from '@/components/Toast';
import { useTenant } from '@/components/TenantContext';
import {
  DEFAULT_PALETTE_ID,
  PALETTE_IDS,
  PALETTES,
  type PaletteColors,
  type PaletteId,
} from '@/lib/constants/appPalettes';
import { tenantPaletteService } from '@/lib/services/tenantPaletteService';
import type { TenantFeatureId, TenantFeatures } from '@/lib/tenant-features';
import {
  MEMBER_TERM_PRESETS,
  parseTenantTerms,
  patchTenantTermsSettings,
  type TenantMemberPresetId,
  type TenantTerms,
} from '@/lib/tenant-terms';
import type { TranslationKey } from '@/lib/translations';
import type { MilestoneSettings } from '@/lib/types/milestone';
import { DEFAULT_MILESTONE_SETTINGS } from '@/lib/types/milestone';
import { saveTenantFeaturesAction, saveTenantPaletteAction, saveMilestoneSettingsAction, getMilestoneSettingsAction, saveTenantTermsAction } from './actions';

function paletteNameKey(id: PaletteId): TranslationKey {
  return `Palette ${id}` as TranslationKey;
}

function paletteDescKey(id: PaletteId): TranslationKey {
  return `Palette ${id} desc` as TranslationKey;
}

const MODULE_COPY: {
  id: TenantFeatureId;
  icon: typeof Dumbbell;
  label: TranslationKey;
  desc: TranslationKey;
}[] = [
  {
    id: 'wod',
    icon: Dumbbell,
    label: 'Daily workouts',
    desc: 'Module daily workouts desc',
  },
  {
    id: 'personalRecords',
    icon: Trophy,
    label: 'Personal Records',
    desc: 'Module personal records desc',
  },
  {
    id: 'community',
    icon: MessagesSquare,
    label: 'Community',
    desc: 'Module community desc',
  },
  {
    id: 'attendance',
    icon: ClipboardCheck,
    label: 'Weekly attendance',
    desc: 'Module attendance desc',
  },
  {
    id: 'coachPayments',
    icon: Wallet,
    label: 'Coach payments',
    desc: 'Module coach payments desc',
  },
];

function AppPreview({
  colors,
  features,
  workoutTerm,
}: {
  colors: PaletteColors;
  features: TenantFeatures;
  workoutTerm: string;
}) {
  const { t } = useLanguage();
  const showWod = features.wod;
  const showPr = features.personalRecords;
  const showCommunity = features.community;
  const showAttendance = features.attendance;

  return (
    <div
      className="mx-auto w-[260px] rounded-[2rem] p-2 shadow-2xl"
      style={{ backgroundColor: colors.black, border: `2px solid ${colors.border}` }}
    >
      <div
        className="overflow-hidden rounded-[1.5rem]"
        style={{ backgroundColor: colors.background, color: colors.textMain }}
      >
        <div className="px-4 pt-3 pb-2">
          <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: colors.textSub }}>
            {t('App preview')}
          </p>
          <p className="text-lg font-black italic leading-tight">{showWod ? t("Today's WOD") : t('Home')}</p>
        </div>
        <div className="px-3 pb-3 space-y-2 min-h-[148px]">
          {showWod ? (
            <div
              className="rounded-2xl p-3"
              style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}
            >
              <p className="text-[11px] font-bold" style={{ color: colors.textSub }}>
                {t("Today's WOD")}
              </p>
              <p className="mt-1 text-xs font-black">Fran — 21-15-9</p>
              <button
                type="button"
                className="mt-3 w-full rounded-xl py-2 text-[11px] font-black uppercase"
                style={{ backgroundColor: colors.primary, color: colors.darkText }}
              >
                {t('Book')}
              </button>
            </div>
          ) : (
            <div
              className="rounded-2xl p-3"
              style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}
            >
              <p className="text-[11px] font-bold" style={{ color: colors.textSub }}>
                {t('Schedule')}
              </p>
              <p className="mt-1 text-xs font-black">18:00 — {workoutTerm}</p>
              <button
                type="button"
                className="mt-3 w-full rounded-xl py-2 text-[11px] font-black uppercase"
                style={{ backgroundColor: colors.primary, color: colors.darkText }}
              >
                {t('Book')}
              </button>
            </div>
          )}
          {showPr ? (
            <div
              className="rounded-2xl p-3"
              style={{
                backgroundColor: colors.card,
                border: `1px solid ${colors.primary}`,
              }}
            >
              <p
                className="text-[11px] font-black uppercase tracking-wider"
                style={{ color: colors.primary }}
              >
                {t('New PR!')}
              </p>
              <p className="mt-1 text-sm font-black">Back Squat — 140 kg</p>
            </div>
          ) : null}
          {showAttendance ? (
            <div
              className="rounded-2xl p-3"
              style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}
            >
              <p className="text-[11px] font-bold" style={{ color: colors.textSub }}>
                {t('Weekly attendance')}
              </p>
              <p className="mt-1 text-sm font-black">4 / 4</p>
            </div>
          ) : null}
        </div>
        <div
          className="flex justify-around px-2 py-2 text-[11px] font-black uppercase"
          style={{ backgroundColor: colors.card, borderTop: `1px solid ${colors.border}` }}
        >
          <span style={{ color: colors.primary }}>{t('Home')}</span>
          <span style={{ color: colors.gunmetal }}>
            {showCommunity ? t('Community') : t('Athletes')}
          </span>
          <span style={{ color: colors.gunmetal }}>{t('Schedule')}</span>
        </div>
      </div>
    </div>
  );
}

const PRESET_COPY: { id: TenantMemberPresetId; label: TranslationKey }[] = [
  { id: 'athletes', label: 'Term preset athletes' },
  { id: 'students', label: 'Term preset students' },
  { id: 'users', label: 'Term preset users' },
  { id: 'clients', label: 'Term preset clients' },
];

const TERM_FIELDS: { key: 'venue' | 'session' | 'coach' | 'workout'; label: TranslationKey }[] = [
  { key: 'venue', label: 'Term venue' },
  { key: 'session', label: 'Term session' },
  { key: 'coach', label: 'Term coach' },
  { key: 'workout', label: 'Term workout' },
];

export default function AppearancePage() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const { tenantId, features, setFeatures, settings, setSettings } = useTenant();
  const [isPending, startTransition] = useTransition();
  const [isFeaturePending, startFeatureTransition] = useTransition();
  const [isMilestonePending, startMilestoneTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [savedId, setSavedId] = useState<PaletteId>('default');
  const [selectedId, setSelectedId] = useState<PaletteId>('default');
  const [milestoneSettings, setMilestoneSettings] = useState<MilestoneSettings>(DEFAULT_MILESTONE_SETTINGS);
  const savedTerms = useMemo(() => parseTenantTerms(settings, lang), [settings, lang]);
  const [termsDraft, setTermsDraft] = useState<TenantTerms>(savedTerms);
  // Reset the draft when the saved words change (after a save or a language switch).
  const [draftBase, setDraftBase] = useState(savedTerms);
  if (draftBase !== savedTerms) {
    setDraftBase(savedTerms);
    setTermsDraft(savedTerms);
  }

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const id = await tenantPaletteService.getForTenant(tenantId);
        if (cancelled) return;
        setSavedId(id);
        setSelectedId(id);
      } catch {
        if (!cancelled) toast(t('Failed to load palette'), 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [tenantId, t, toast]);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const settings = await getMilestoneSettingsAction();
        if (cancelled) return;
        setMilestoneSettings(settings);
      } catch {
        if (!cancelled) console.error('Failed to load milestone settings');
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const selected = PALETTES[selectedId] ?? PALETTES[DEFAULT_PALETTE_ID];
  const paletteDirty = selectedId !== savedId;
  const termsDirty = JSON.stringify(termsDraft) !== JSON.stringify(savedTerms);
  const dirty = paletteDirty || termsDirty;
  const termValues = [termsDraft.member.singular, termsDraft.member.plural, ...TERM_FIELDS.map((f) => termsDraft[f.key])];
  const termsValid = termValues.every((v) => v.trim().length > 0);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const swatches = useMemo(
    () =>
      PALETTE_IDS.flatMap((id) => {
        const palette = PALETTES[id];
        return palette ? [{ id, palette }] : [];
      }),
    []
  );

  const handleSave = () => {
    if (termsDirty && !termsValid) {
      toast(t('Fill in every word before saving.'), 'error');
      return;
    }
    const trimmed: TenantTerms = {
      ...termsDraft,
      member: { singular: termsDraft.member.singular.trim(), plural: termsDraft.member.plural.trim() },
      venue: termsDraft.venue.trim(),
      session: termsDraft.session.trim(),
      coach: termsDraft.coach.trim(),
      workout: termsDraft.workout.trim(),
    };
    startTransition(async () => {
      const [paletteResult, termsResult] = await Promise.allSettled([
        paletteDirty ? saveTenantPaletteAction(selectedId) : Promise.resolve(null),
        termsDirty ? saveTenantTermsAction(trimmed) : Promise.resolve(null),
      ]);
      let failed = false;
      if (paletteResult.status === 'fulfilled') {
        if (paletteResult.value) {
          setSavedId(paletteResult.value);
          setSelectedId(paletteResult.value);
        }
      } else {
        failed = true;
        toast(t('Failed to save palette'), 'error');
      }
      if (termsResult.status === 'fulfilled') {
        if (termsDirty) setSettings(patchTenantTermsSettings(settings, trimmed));
      } else {
        failed = true;
        toast(t('Failed to save terminology'), 'error');
      }
      if (!failed) toast(t('Appearance saved'), 'success');
    });
  };

  const handleDiscard = () => {
    setSelectedId(savedId);
    setTermsDraft(savedTerms);
  };

  const handleFeatureToggle = (id: TenantFeatureId, enabled: boolean) => {
    const previous = features;
    const next = { ...features, [id]: enabled };
    setFeatures(next);
    startFeatureTransition(async () => {
      try {
        const saved = await saveTenantFeaturesAction({ [id]: enabled });
        setFeatures(saved);
        toast(t('Modules saved'), 'success');
      } catch {
        setFeatures(previous);
        toast(t('Failed to save modules'), 'error');
      }
    });
  };

  const presetLang = lang === 'en' ? 'en' : 'es';
  const handlePreset = (id: TenantMemberPresetId) => {
    setTermsDraft({ ...termsDraft, member: { ...MEMBER_TERM_PRESETS[id][presetLang] } });
  };

  const handleMilestoneToggle = (field: keyof MilestoneSettings, value: boolean) => {
    const previous = milestoneSettings;
    const next = { ...milestoneSettings, [field]: value };
    setMilestoneSettings(next);
    startMilestoneTransition(async () => {
      try {
        const saved = await saveMilestoneSettingsAction({ [field]: value });
        setMilestoneSettings(saved);
        toast(t('Milestones saved'), 'success');
      } catch {
        setMilestoneSettings(previous);
        toast(t('Failed to save milestones'), 'error');
      }
    });
  };

  const renderSwitch = (on: boolean) => (
    <span
      aria-hidden
      className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-pits-primary' : 'bg-pits-edge'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`}
      />
    </span>
  );

  const renderToggleRow = (opts: {
    on: boolean;
    disabled: boolean;
    onToggle: () => void;
    icon: typeof Dumbbell;
    label: string;
    desc: string;
    indent?: boolean;
  }) => {
    const Icon = opts.icon;
    return (
      <button
        type="button"
        role="switch"
        aria-checked={opts.on}
        disabled={opts.disabled}
        onClick={opts.onToggle}
        className={`w-full text-left rounded-xl border p-3 sm:p-4 bg-pits-surface transition-colors hover:border-pits-primary/50 disabled:opacity-60 disabled:hover:border-pits-edge ${
          opts.on ? 'border-pits-primary/60' : 'border-pits-edge'
        } ${opts.indent ? 'sm:ml-8 sm:w-[calc(100%-2rem)]' : ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Icon size={18} className={`mt-0.5 shrink-0 ${opts.on ? 'text-pits-primary' : 'text-pits-ink-muted'}`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-pits-ink">{opts.label}</p>
              <p className="mt-0.5 text-xs text-pits-ink-muted">{opts.desc}</p>
            </div>
          </div>
          {renderSwitch(opts.on)}
        </div>
      </button>
    );
  };

  const inputClass =
    'w-full h-11 rounded-lg border border-pits-edge bg-pits-surface px-3 text-sm text-pits-ink outline-none focus:border-pits-primary focus:ring-2 focus:ring-pits-primary/30 disabled:opacity-60';
  const fieldLabel = 'mb-1.5 block text-sm font-medium text-pits-ink';
  const cardClass = 'rounded-2xl bg-pits-card border border-pits-edge p-4 sm:p-5 space-y-4';
  const sectionTitle = 'text-base font-bold text-pits-ink';
  const sectionHelp = 'mt-0.5 text-sm text-pits-ink-muted';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">{t('Appearance')}</h1>
        <p className="mt-1 text-sm text-pits-ink-muted">{t('How the app looks and what it shows your {members}.')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="space-y-6">
          <section className={cardClass}>
            <div>
              <h2 className={sectionTitle}>{t('App color palette')}</h2>
              <p className={sectionHelp}>{t('App color palette help')}</p>
            </div>
            <div role="radiogroup" aria-label={t('App color palette')} className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {swatches.map(({ id, palette }) => {
                const active = selectedId === id;
                const isSaved = savedId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={loading || isPending}
                    onClick={() => setSelectedId(id)}
                    title={t(paletteDescKey(id))}
                    className={`relative text-left rounded-xl border-2 p-2.5 transition-colors disabled:opacity-60 ${
                      active ? 'border-pits-primary' : 'border-pits-edge hover:border-pits-primary/40'
                    }`}
                  >
                    <div
                      className="flex h-12 items-end gap-1 rounded-lg p-1.5"
                      style={{ backgroundColor: palette.colors.background, border: `1px solid ${palette.colors.border}` }}
                    >
                      <span className="h-full flex-1 rounded" style={{ backgroundColor: palette.colors.card }} />
                      <span className="h-3 flex-1 rounded" style={{ backgroundColor: palette.colors.primary }} />
                      <span className="h-1.5 w-4 rounded" style={{ backgroundColor: palette.colors.textMain }} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      <p className="truncate text-sm font-semibold text-pits-ink">{t(paletteNameKey(id))}</p>
                      {active ? <Check size={14} className="shrink-0 text-pits-primary" aria-hidden /> : null}
                    </div>
                    {isSaved ? <p className="text-[11px] text-pits-ink-muted">{t('In use')}</p> : null}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-pits-ink-muted">{t(paletteDescKey(selectedId))}</p>
            {!loading ? (
              <div className="lg:hidden pt-2">
                <AppPreview colors={selected.colors} features={features} workoutTerm={termsDraft.workout || savedTerms.workout} />
              </div>
            ) : null}
          </section>

          <section className={cardClass}>
            <div>
              <h2 className={sectionTitle}>{t('App modules')}</h2>
              <p className={sectionHelp}>{t('App modules help')}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODULE_COPY.map((mod) => (
                <div key={mod.id}>
                  {renderToggleRow({
                    on: features[mod.id],
                    disabled: isFeaturePending,
                    onToggle: () => handleFeatureToggle(mod.id, !features[mod.id]),
                    icon: mod.icon,
                    label: t(mod.label),
                    desc: t(mod.desc),
                  })}
                </div>
              ))}
            </div>
          </section>

          <section className={cardClass}>
            <div>
              <h2 className={sectionTitle}>{t('Terminology')}</h2>
              <p className={sectionHelp}>{t('Terminology help')}</p>
            </div>
            <div>
              <p className={fieldLabel}>{t('Quick pick')}</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_COPY.map((preset) => {
                  const words = MEMBER_TERM_PRESETS[preset.id][presetLang];
                  const on =
                    termsDraft.member.singular === words.singular && termsDraft.member.plural === words.plural;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={on}
                      disabled={isPending}
                      onClick={() => handlePreset(preset.id)}
                      className={`min-h-9 rounded-full border px-3.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                        on
                          ? 'border-pits-primary bg-pits-primary/15 text-pits-ink'
                          : 'border-pits-edge bg-pits-surface text-pits-ink-muted hover:text-pits-ink hover:border-pits-primary/50'
                      }`}
                    >
                      {t(preset.label)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={fieldLabel}>{t('Term member singular')}</span>
                <input
                  type="text"
                  value={termsDraft.member.singular}
                  disabled={isPending}
                  onChange={(e) =>
                    setTermsDraft({ ...termsDraft, member: { ...termsDraft.member, singular: e.target.value } })
                  }
                  aria-invalid={!termsDraft.member.singular.trim()}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>{t('Term member plural')}</span>
                <input
                  type="text"
                  value={termsDraft.member.plural}
                  disabled={isPending}
                  onChange={(e) =>
                    setTermsDraft({ ...termsDraft, member: { ...termsDraft.member, plural: e.target.value } })
                  }
                  aria-invalid={!termsDraft.member.plural.trim()}
                  className={inputClass}
                />
              </label>
              {TERM_FIELDS.map((field) => (
                <label key={field.key} className="block">
                  <span className={fieldLabel}>{t(field.label)}</span>
                  <input
                    type="text"
                    value={termsDraft[field.key]}
                    disabled={isPending}
                    onChange={(e) => setTermsDraft({ ...termsDraft, [field.key]: e.target.value })}
                    aria-invalid={!termsDraft[field.key].trim()}
                    className={inputClass}
                  />
                </label>
              ))}
            </div>
            {!termsValid ? <p className="text-xs text-pits-warning">{t('Fill in every word before saving.')}</p> : null}
          </section>

          <section className={cardClass}>
            <div>
              <h2 className={sectionTitle}>{t('Milestones')}</h2>
              <p className={sectionHelp}>{t('Milestone settings help')}</p>
            </div>
            <div className="space-y-2">
              {renderToggleRow({
                on: !!milestoneSettings.enabled,
                disabled: isMilestonePending,
                onToggle: () => handleMilestoneToggle('enabled', !milestoneSettings.enabled),
                icon: Trophy,
                label: t('Enable milestones'),
                desc: t('Milestone enabled desc'),
              })}
              {renderToggleRow({
                on: !!(milestoneSettings.pushEnabled && milestoneSettings.enabled),
                disabled: isMilestonePending || !milestoneSettings.enabled,
                onToggle: () => handleMilestoneToggle('pushEnabled', !milestoneSettings.pushEnabled),
                icon: ClipboardCheck,
                label: t('Milestone push notifications'),
                desc: t('Milestone push desc'),
                indent: true,
              })}
            </div>
          </section>
        </div>

        <aside className="hidden lg:block lg:sticky lg:top-6 rounded-2xl bg-pits-card border border-pits-edge p-4">
          <p className="mb-4 text-sm font-semibold text-pits-ink">{t('App preview')}</p>
          {loading ? (
            <div className="h-[360px] rounded-[2rem] bg-pits-surface animate-pulse" />
          ) : (
            <AppPreview colors={selected.colors} features={features} workoutTerm={termsDraft.workout || savedTerms.workout} />
          )}
          <p className="mt-3 text-center text-xs text-pits-ink-muted">{t('Updates as you change things.')}</p>
        </aside>
      </div>

      {dirty ? (
        <div className="sticky bottom-0 z-30 -mx-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-pits-edge bg-pits-card/95 p-3 shadow-xl backdrop-blur">
            <p className="text-sm font-semibold text-pits-ink">{t('Booking unsaved changes')}</p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={handleDiscard}
                disabled={isPending}
                className="min-h-11 sm:min-h-9 rounded-lg px-3 text-sm font-semibold text-pits-ink-muted hover:text-pits-ink hover:bg-pits-surface disabled:opacity-50"
              >
                {t('Discard changes')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending || (termsDirty && !termsValid)}
                className="min-h-11 sm:min-h-9 inline-flex items-center gap-2 rounded-lg bg-pits-primary px-4 text-sm font-bold text-pits-dark-text disabled:opacity-50"
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                {t('Save changes')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
