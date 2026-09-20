import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlatformHqOverview, TenantWithHqStats } from '../types/gym';
import {
  getPlatformPlan,
  isOverMemberCap,
  isTrialEndingSoon,
  isTrialExpired,
  parsePlatformPlanId,
  type PlatformPlanId,
} from '../platform-plans';
import { tenantService } from './tenantService';
import { currentAiPeriodYm, resolveAiMonthlyQuestions } from '../ai/quota';

type ProfileRow = {
  tenant_id: string | null;
  role: string | null;
  is_solvent: boolean | null;
};

type PendingRow = {
  tenant_id: string | null;
};

type Counts = {
  users: number;
  members: number;
  active: number;
  staff: number;
  coaches: number;
  admins: number;
};

function emptyCounts(): Counts {
  return { users: 0, members: 0, active: 0, staff: 0, coaches: 0, admins: 0 };
}

export const hqStatsService = {
  async getOverview(client: SupabaseClient): Promise<{
    tenants: TenantWithHqStats[];
    overview: PlatformHqOverview;
  }> {
    const tenants = await tenantService.listTenants(client);

    const periodYm = currentAiPeriodYm();
    const [
      { data: profiles, error: profilesError },
      { data: pending, error: paymentsError },
      { data: aiUsage, error: aiUsageError },
    ] = await Promise.all([
      client.from('profiles').select('tenant_id, role, is_solvent'),
      client.from('payments').select('tenant_id').eq('status', 'pending'),
      client.from('tenant_ai_usage').select('tenant_id, questions_used').eq('period_ym', periodYm),
    ]);

    if (profilesError) throw profilesError;
    if (paymentsError) throw paymentsError;
    if (aiUsageError) throw aiUsageError;

    const byTenant = new Map<string, Counts>();
    for (const tenant of tenants) {
      byTenant.set(tenant.id, emptyCounts());
    }

    for (const profile of (profiles ?? []) as ProfileRow[]) {
      if (!profile.tenant_id) continue;
      const row = byTenant.get(profile.tenant_id);
      if (!row) continue;
      row.users += 1;
      const role = profile.role ?? 'member';
      if (role === 'member') {
        row.members += 1;
        if (profile.is_solvent) row.active += 1;
      } else {
        row.staff += 1;
        if (role === 'coach') row.coaches += 1;
        if (role === 'admin') row.admins += 1;
      }
    }

    const pendingByTenant = new Map<string, number>();
    for (const payment of (pending ?? []) as PendingRow[]) {
      if (!payment.tenant_id) continue;
      pendingByTenant.set(
        payment.tenant_id,
        (pendingByTenant.get(payment.tenant_id) ?? 0) + 1
      );
    }

    const aiUsedByTenant = new Map<string, number>();
    for (const row of (aiUsage ?? []) as { tenant_id: string; questions_used: number }[]) {
      aiUsedByTenant.set(row.tenant_id, row.questions_used ?? 0);
    }

    const planCounts: Record<PlatformPlanId, number> = {
      trial: 0,
      starter: 0,
      growth: 0,
      pro: 0,
    };

    let mrrUsd = 0;
    let overCapCount = 0;
    let expiredTrialCount = 0;
    let userCount = 0;
    let memberCount = 0;
    let activeMemberCount = 0;
    let staffCount = 0;
    let pendingPaymentCount = 0;

    const tenantsWithStats: TenantWithHqStats[] = tenants.map((tenant) => {
      const counts = byTenant.get(tenant.id) ?? emptyCounts();
      const platform_plan = parsePlatformPlanId(tenant.platform_plan);
      const overMemberCap = isOverMemberCap(platform_plan, counts.active);
      const trialExpired = isTrialExpired(platform_plan, tenant.trial_ends_at);
      const trialEndsSoon = isTrialEndingSoon(platform_plan, tenant.trial_ends_at);
      const pendingCount = pendingByTenant.get(tenant.id) ?? 0;

      planCounts[platform_plan] += 1;
      mrrUsd += getPlatformPlan(platform_plan).priceUsd;
      if (overMemberCap) overCapCount += 1;
      if (trialExpired) expiredTrialCount += 1;
      userCount += counts.users;
      memberCount += counts.members;
      activeMemberCount += counts.active;
      staffCount += counts.staff;
      pendingPaymentCount += pendingCount;

      return {
        ...tenant,
        platform_plan,
        stats: {
          userCount: counts.users,
          memberCount: counts.members,
          activeMemberCount: counts.active,
          staffCount: counts.staff,
          coachCount: counts.coaches,
          adminCount: counts.admins,
          pendingPaymentCount: pendingCount,
          overMemberCap,
          trialExpired,
          trialEndsSoon,
          isActive: tenant.is_active !== false,
          aiQuestionsUsed: aiUsedByTenant.get(tenant.id) ?? 0,
          aiQuestionLimit: resolveAiMonthlyQuestions(
            platform_plan,
            tenant.ai_monthly_question_limit
          ),
          aiCustomLimit: tenant.ai_monthly_question_limit != null,
        },
      };
    });

    return {
      tenants: tenantsWithStats,
      overview: {
        boxCount: tenants.length,
        userCount,
        memberCount,
        activeMemberCount,
        staffCount,
        mrrUsd,
        pendingPaymentCount,
        overCapCount,
        trialCount: planCounts.trial,
        expiredTrialCount,
        solvencyRate:
          memberCount === 0 ? 0 : Math.round((activeMemberCount / memberCount) * 100),
        planCounts,
      },
    };
  },
};
