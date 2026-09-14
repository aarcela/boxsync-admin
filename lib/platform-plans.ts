/** SaaS plans advertised on www.getwodus.com. Distinct from box membership_plans. */

export const PLATFORM_PLAN_IDS = ['trial', 'starter', 'growth', 'pro'] as const;
export type PlatformPlanId = (typeof PLATFORM_PLAN_IDS)[number];

export type PlatformPlanDef = {
  id: PlatformPlanId;
  nameKey: 'Trial' | 'Starter' | 'Growth' | 'Pro';
  priceUsd: number;
  /** null = unlimited active members */
  maxActiveMembers: number | null;
  trialDays: number | null;
};

export const DEFAULT_PLATFORM_PLAN: PlatformPlanId = 'trial';
export const TRIAL_DAYS = 30;
export const TRIAL_ENDING_SOON_DAYS = 7;

export const PLATFORM_PLANS: Record<PlatformPlanId, PlatformPlanDef> = {
  trial: {
    id: 'trial',
    nameKey: 'Trial',
    priceUsd: 0,
    maxActiveMembers: null,
    trialDays: TRIAL_DAYS,
  },
  starter: {
    id: 'starter',
    nameKey: 'Starter',
    priceUsd: 59,
    maxActiveMembers: 60,
    trialDays: null,
  },
  growth: {
    id: 'growth',
    nameKey: 'Growth',
    priceUsd: 89,
    maxActiveMembers: 150,
    trialDays: null,
  },
  pro: {
    id: 'pro',
    nameKey: 'Pro',
    priceUsd: 129,
    maxActiveMembers: null,
    trialDays: null,
  },
};

export function isPlatformPlanId(value: unknown): value is PlatformPlanId {
  return (
    typeof value === 'string' &&
    (PLATFORM_PLAN_IDS as readonly string[]).includes(value)
  );
}

export function parsePlatformPlanId(value: unknown): PlatformPlanId {
  return isPlatformPlanId(value) ? value : DEFAULT_PLATFORM_PLAN;
}

export function getPlatformPlan(id: unknown): PlatformPlanDef {
  return PLATFORM_PLANS[parsePlatformPlanId(id)];
}

export function trialEndsAtIso(from = new Date(), days = TRIAL_DAYS): string {
  const next = new Date(from.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

export function isTrialExpired(
  plan: PlatformPlanId,
  trialEndsAt: string | null | undefined,
  now = new Date()
): boolean {
  if (plan !== 'trial' || !trialEndsAt) return false;
  return new Date(trialEndsAt).getTime() < now.getTime();
}

export function isTrialEndingSoon(
  plan: PlatformPlanId,
  trialEndsAt: string | null | undefined,
  now = new Date(),
  days = TRIAL_ENDING_SOON_DAYS
): boolean {
  if (plan !== 'trial' || !trialEndsAt) return false;
  const ends = new Date(trialEndsAt).getTime();
  const start = now.getTime();
  return ends >= start && ends <= start + days * 24 * 60 * 60 * 1000;
}

export function isOverMemberCap(plan: PlatformPlanId, activeMembers: number): boolean {
  const cap = PLATFORM_PLANS[plan].maxActiveMembers;
  return cap !== null && activeMembers > cap;
}
