export const SETUP_STEPS = ['profile', 'payments', 'classes', 'members', 'share'] as const;
export type SetupStepId = (typeof SETUP_STEPS)[number];
export type SetupStepStatus = 'done' | 'skipped' | null;

export type SetupSteps = Record<SetupStepId, SetupStepStatus>;

export const EMPTY_SETUP_STEPS: SetupSteps = {
  profile: null,
  payments: null,
  classes: null,
  members: null,
  share: null,
};

export function parseSetupSteps(value: unknown): SetupSteps {
  const bag = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const next = { ...EMPTY_SETUP_STEPS };
  for (const step of SETUP_STEPS) {
    if (bag[step] === 'done' || bag[step] === 'skipped') next[step] = bag[step];
  }
  return next;
}

export type SetupFacts = {
  paletteCustomized: boolean;
  termsCustomized: boolean;
  paymentMethodCount: number;
  classCount: number;
  memberCount: number;
};

export function detectSetupSteps(facts: SetupFacts, stored: SetupSteps): SetupSteps {
  return {
    profile:
      stored.profile === 'skipped' || facts.paletteCustomized || facts.termsCustomized
        ? stored.profile === 'skipped' && !facts.paletteCustomized && !facts.termsCustomized
          ? 'skipped'
          : 'done'
        : stored.profile,
    payments:
      facts.paymentMethodCount >= 1 ? 'done' : stored.payments === 'skipped' ? 'skipped' : stored.payments,
    classes: facts.classCount >= 1 ? 'done' : stored.classes === 'skipped' ? 'skipped' : stored.classes,
    members: facts.memberCount >= 1 ? 'done' : stored.members === 'skipped' ? 'skipped' : stored.members,
    share: stored.share === 'done' || stored.share === 'skipped' ? stored.share : null,
  };
}

export function setupIsComplete(steps: SetupSteps): boolean {
  return SETUP_STEPS.every((step) => steps[step] === 'done' || steps[step] === 'skipped');
}

export function setupPendingCount(steps: SetupSteps): number {
  return SETUP_STEPS.filter((step) => steps[step] == null).length;
}
