import { PLATFORM_PLANS, parsePlatformPlanId, type PlatformPlanId } from '../platform-plans';

export function currentAiPeriodYm(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function nextAiPeriodResetIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

export function resolveAiMonthlyQuestions(
  plan: unknown,
  override: number | null | undefined
): number {
  const platformPlan = parsePlatformPlanId(plan);
  if (override === null || override === undefined) {
    return defaultAiMonthlyQuestions(platformPlan);
  }
  if (!Number.isFinite(override)) return defaultAiMonthlyQuestions(platformPlan);
  return Math.max(0, Math.min(10000, Math.floor(override)));
}

export function defaultAiMonthlyQuestions(plan: PlatformPlanId): number {
  return PLATFORM_PLANS[plan].aiMonthlyQuestions;
}

export type AskAiQuota = {
  used: number;
  limit: number;
  remaining: number;
  periodYm: string;
  resetsAt: string;
  disabled: boolean;
  customLimit: boolean;
};
