/**
 * Setup assistant progress (table tenant_setup_progress.steps).
 * Steps are only marked by the person running the assistant; the API also returns
 * facts (methods, plans, classes, members) so each step can show what already exists.
 */
export const SETUP_STEPS = ['profile', 'payments', 'classes', 'members'] as const;
export type SetupStepId = (typeof SETUP_STEPS)[number];
export type SetupStepStatus = 'done' | 'skipped' | null;

export type SetupSteps = Record<SetupStepId, SetupStepStatus>;

export const EMPTY_SETUP_STEPS: SetupSteps = {
  profile: null,
  payments: null,
  classes: null,
  members: null,
};

/** Older rows may still carry a separate "share" step; it is folded into "members". */
export function parseSetupSteps(value: unknown): SetupSteps {
  const bag = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const next = { ...EMPTY_SETUP_STEPS };
  for (const step of SETUP_STEPS) {
    if (bag[step] === 'done' || bag[step] === 'skipped') next[step] = bag[step];
  }
  return next;
}

export type SetupFacts = {
  paymentMethodCount: number;
  planCount: number;
  classCount: number;
  memberCount: number;
};

export function setupIsComplete(steps: SetupSteps): boolean {
  return SETUP_STEPS.every((step) => steps[step] === 'done' || steps[step] === 'skipped');
}

export function setupPendingCount(steps: SetupSteps): number {
  return SETUP_STEPS.filter((step) => steps[step] == null).length;
}
