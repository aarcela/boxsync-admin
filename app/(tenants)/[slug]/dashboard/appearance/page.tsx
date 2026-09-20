'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Check, ClipboardCheck, Dumbbell, Loader2, MessagesSquare, Palette as PaletteIcon, Trophy } from 'lucide-react';
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
import type { TranslationKey } from '@/lib/translations';
import { saveTenantFeaturesAction, saveTenantPaletteAction } from './actions';

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
];

function AppPreview({
  colors,
  features,
}: {
  colors: PaletteColors;
  features: TenantFeatures;
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
          <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: colors.textSub }}>
            {t('App preview')}
          </p>
          <p className="text-lg font-black italic leading-tight">{showWod ? 'WOD' : t('Home')}</p>
        </div>
        <div className="px-3 pb-3 space-y-2 min-h-[148px]">
          {showWod ? (
            <div
              className="rounded-2xl p-3"
              style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}
            >
              <p className="text-[10px] font-bold" style={{ color: colors.textSub }}>
                {t("Today's WOD")}
              </p>
              <p className="mt-1 text-xs font-black">Fran — 21-15-9</p>
              <button
                type="button"
                className="mt-3 w-full rounded-xl py-2 text-[10px] font-black uppercase"
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
              <p className="text-[10px] font-bold" style={{ color: colors.textSub }}>
                {t('Schedule')}
              </p>
              <p className="mt-1 text-xs font-black">18:00 — WOD</p>
              <button
                type="button"
                className="mt-3 w-full rounded-xl py-2 text-[10px] font-black uppercase"
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
                className="text-[10px] font-black uppercase tracking-wider"
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
              <p className="text-[10px] font-bold" style={{ color: colors.textSub }}>
                {t('Weekly attendance')}
              </p>
              <p className="mt-1 text-sm font-black">4 / 4</p>
            </div>
          ) : null}
        </div>
        <div
          className="flex justify-around px-2 py-2 text-[8px] font-black uppercase"
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

export default function AppearancePage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { tenantId, features, setFeatures } = useTenant();
  const [isPending, startTransition] = useTransition();
  const [isFeaturePending, startFeatureTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [savedId, setSavedId] = useState<PaletteId>('default');
  const [selectedId, setSelectedId] = useState<PaletteId>('default');

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

  const selected = PALETTES[selectedId] ?? PALETTES[DEFAULT_PALETTE_ID];
  const dirty = selectedId !== savedId;

  const swatches = useMemo(
    () =>
      PALETTE_IDS.flatMap((id) => {
        const palette = PALETTES[id];
        return palette ? [{ id, palette }] : [];
      }),
    []
  );

  const handleSave = () => {
    startTransition(async () => {
      try {
        const saved = await saveTenantPaletteAction(selectedId);
        setSavedId(saved);
        setSelectedId(saved);
        toast(t('Palette saved'), 'success');
      } catch {
        toast(t('Failed to save palette'), 'error');
      }
    });
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-xl bg-pits-card p-2 border border-pits-edge">
          <PaletteIcon size={20} className="text-pits-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-pits-ink">{t('Appearance')}</h1>
          <p className="mt-1 text-sm font-bold text-pits-ink-muted">
            {t('App color palette help')}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="space-y-6">
          <div className="rounded-2xl bg-pits-card border border-pits-edge p-5 space-y-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-tight text-pits-ink">
                {t('App modules')}
              </h2>
              <p className="mt-1 text-xs font-bold text-pits-ink-muted">
                {t('App modules help')}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {MODULE_COPY.map((mod) => {
                const on = features[mod.id];
                const Icon = mod.icon;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    disabled={isFeaturePending}
                    onClick={() => handleFeatureToggle(mod.id, !on)}
                    className={`text-left rounded-2xl border-2 p-4 bg-pits-surface transition-colors disabled:opacity-60 ${
                      on ? 'border-pits-primary' : 'border-pits-edge'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5 rounded-lg bg-pits-card p-2 border border-pits-edge">
                          <Icon size={16} className={on ? 'text-pits-primary' : 'text-pits-ink-muted'} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-pits-ink">{t(mod.label)}</p>
                          <p className="mt-1 text-xs font-bold text-pits-ink-muted">
                            {t(mod.desc)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${
                          on ? 'bg-pits-primary' : 'bg-pits-edge'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            on ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {swatches.map(({ id, palette }) => {
              const active = selectedId === id;
              const isSaved = savedId === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={loading || isPending}
                  onClick={() => setSelectedId(id)}
                  className={`text-left rounded-2xl border-2 p-4 bg-pits-card transition-colors ${
                    active ? 'border-pits-primary' : 'border-pits-edge hover:border-pits-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black text-pits-ink">{t(paletteNameKey(id))}</p>
                    {isSaved && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-pits-primary">
                        <Check size={12} />
                        {t('Currently saved')}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs font-bold text-pits-ink-muted">
                    {t(paletteDescKey(id))}
                  </p>
                  <div className="mt-3 flex gap-1.5">
                    {[palette.colors.background, palette.colors.card, palette.colors.primary, palette.colors.textMain].map(
                      (hex, i) => (
                        <span
                          key={`${id}-${i}`}
                          className="h-7 w-7 rounded-full border border-pits-edge"
                          style={{ backgroundColor: hex }}
                        />
                      )
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:sticky lg:top-6 rounded-2xl bg-pits-card border border-pits-edge p-4">
          <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-pits-ink-muted">
            {t('App color palette')}
          </p>
          {loading ? (
            <div className="h-[360px] rounded-[2rem] bg-pits-surface animate-pulse" />
          ) : (
            <AppPreview colors={selected.colors} features={features} />
          )}
          <button
            type="button"
            disabled={loading || isPending || !dirty}
            onClick={handleSave}
            className="mt-4 w-full rounded-xl bg-pits-primary py-3 text-sm font-black uppercase tracking-wide text-pits-dark-text disabled:opacity-40 inline-flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('Processing...')}
              </>
            ) : (
              t('Save palette')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
