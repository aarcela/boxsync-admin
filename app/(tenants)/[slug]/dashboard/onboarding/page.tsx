'use client';

import { useEffect, useState, useTransition } from 'react';
import { ClipboardList, Loader2, Lock } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { useToast } from '@/components/Toast';
import { useTenant } from '@/components/TenantContext';
import {
  DEFAULT_ONBOARDING_REQUIRED,
  isLockedOnboardingField,
  type OnboardingFieldId,
  type OnboardingRequired,
} from '@/lib/onboarding-required';
import { tenantOnboardingService } from '@/lib/services/tenantOnboardingService';
import type { TranslationKey } from '@/lib/translations';
import { saveOnboardingRequiredAction } from './actions';

const GROUPS: {
  title: TranslationKey;
  fields: { id: OnboardingFieldId; label: TranslationKey }[];
}[] = [
  {
    title: 'Onboarding group basic',
    fields: [
      { id: 'fullName', label: 'Full name' },
      { id: 'birthDate', label: 'Birth Date' },
      { id: 'sex', label: 'Sex' },
      { id: 'height', label: 'Height' },
      { id: 'weight', label: 'Onboarding field weight' },
    ],
  },
  {
    title: 'Onboarding group contact',
    fields: [
      { id: 'phone', label: 'Phone' },
      { id: 'instagram', label: 'Onboarding field instagram' },
    ],
  },
  {
    title: 'Onboarding group sports',
    fields: [
      { id: 'level', label: 'Onboarding field level' },
      { id: 'years', label: 'Onboarding field years' },
      { id: 'homeBox', label: 'Home Box' },
    ],
  },
  {
    title: 'Onboarding group health',
    fields: [
      { id: 'allergies', label: 'Allergies' },
      { id: 'medical', label: 'Medical Conditions' },
      { id: 'injury', label: 'Current Injuries' },
    ],
  },
  {
    title: 'Onboarding group emergency',
    fields: [
      { id: 'emergencyName', label: 'Contact Person' },
      { id: 'emergencyPhone', label: 'Contact Phone' },
    ],
  },
];

export default function OnboardingSettingsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [required, setRequired] = useState<OnboardingRequired>(DEFAULT_ONBOARDING_REQUIRED);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const next = await tenantOnboardingService.getForTenant(tenantId);
        if (!cancelled) setRequired(next);
      } catch {
        if (!cancelled) toast(t('Failed to load onboarding'), 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [tenantId, t, toast]);

  const handleToggle = (id: OnboardingFieldId, enabled: boolean) => {
    if (isLockedOnboardingField(id)) return;
    const previous = required;
    const next = { ...required, [id]: enabled };
    setRequired(next);
    startTransition(async () => {
      try {
        const saved = await saveOnboardingRequiredAction({ [id]: enabled });
        setRequired(saved);
        toast(t('Onboarding required saved'), 'success');
      } catch {
        setRequired(previous);
        toast(t('Failed to save onboarding'), 'error');
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-xl bg-pits-card p-2 border border-pits-edge">
          <ClipboardList size={20} className="text-pits-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-pits-ink">{t('Onboarding')}</h1>
          <p className="mt-1 text-sm font-bold text-pits-ink-muted">
            {t('Onboarding fields help')}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-pits-card border border-pits-edge p-5">
        <h2 className="text-sm font-black uppercase tracking-tight text-pits-ink">
          {t('Onboarding terms always')}
        </h2>
        <p className="mt-1 text-xs font-bold text-pits-ink-muted">
          {t('Onboarding terms always help')}
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-pits-card border border-pits-edge p-10 flex justify-center">
          <Loader2 size={20} className="animate-spin text-pits-primary" />
        </div>
      ) : (
        GROUPS.map((group) => (
          <div key={group.title} className="rounded-2xl bg-pits-card border border-pits-edge overflow-hidden">
            <div className="px-5 py-3 border-b border-pits-edge">
              <h2 className="text-xs font-black uppercase tracking-widest text-pits-ink-muted">
                {t(group.title)}
              </h2>
            </div>
            <div className="divide-y divide-pits-edge">
              {group.fields.map((field) => {
                const on = required[field.id];
                const locked = isLockedOnboardingField(field.id);
                return (
                  <div key={field.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="font-black text-pits-ink">{t(field.label)}</p>
                      {locked && (
                        <p className="mt-0.5 text-[11px] font-bold text-pits-ink-muted inline-flex items-center gap-1">
                          <Lock size={10} />
                          {t('Onboarding locked')}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      disabled={locked || isPending}
                      onClick={() => handleToggle(field.id, !on)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-60 ${
                        on ? 'bg-pits-primary' : 'bg-pits-edge'
                      }`}
                    >
                      <span
                        className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                          on ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
