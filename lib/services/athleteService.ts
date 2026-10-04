import { addWeeks, format, parseISO } from 'date-fns';
import { supabase } from '../supabase';
import { Profile, AthletePlan, PlanLimitType } from '../types/gym';
import { buildMembershipActivationFields, buildPlanChangeFields, getPlanLimitType } from '../plan-period';
import { financialService } from './financialService';
import { membershipPlanService } from './membershipPlanService';
import { renewDateToIso } from '../renew-date';

export type PlanSessionUsage = {
  limitType: PlanLimitType;
  used: number;
  limit: number;
  offset: number;
  bookingsUsed: number;
  remaining: number;
  weekStart: string | null;
};

/** Monday date matching Postgres `date_trunc('week', timestamptz)::date` (UTC session). */
function mondayDateString(reference = new Date()): string {
  const day = reference.getUTCDay(); // 0 Sun .. 6 Sat
  const daysFromMonday = (day + 6) % 7;
  const monday = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate() - daysFromMonday)
  );
  return format(monday, 'yyyy-MM-dd');
}

async function countActiveBookingsInRange(
  userId: string,
  tenantId: string | undefined,
  rangeStartIso: string,
  rangeEndIso: string
): Promise<number> {
  let query = supabase
    .from('bookings')
    .select('status, classes!inner(start_time, tenant_id)')
    .eq('user_id', userId)
    .neq('status', 'no_show')
    .gte('classes.start_time', rangeStartIso)
    .lt('classes.start_time', rangeEndIso);

  if (tenantId) {
    query = query.eq('classes.tenant_id', tenantId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).length;
}

export const athleteService = {
  /**
   * Fetches all user profiles, including limited booking history and payment info.
   */
  async getBookableMembers(): Promise<Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'is_solvent'>[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, is_solvent')
      .eq('role', 'member')
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data;
  },

  async getProfiles(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select(`*, bookings!left(status, created_at)`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    const profilesData = data as Profile[];
    
    // Fetch last payment dates for all athletes
    const userIds = profilesData.map(p => p.id);
    const lastPaymentDates = await financialService.getLastPaymentDates(userIds);
    
    return profilesData.map(p => ({
      ...p,
      last_payment_date: lastPaymentDates[p.id]
    }));
  },

  /**
   * Toggles the solvency (active access) status of an athlete.
   * Restoring access also rolls the renew date forward so auto-expiry
   * does not immediately flip them inactive again.
   */
  async updateSolvency(
    id: string,
    is_solvent: boolean
  ): Promise<{ is_solvent: boolean; plan_period_start?: string | null }> {
    const update = is_solvent
      ? await buildMembershipActivationFields(supabase, id)
      : { is_solvent: false };

    const { data, error } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', id)
      .select('is_solvent, plan_period_start')
      .single();

    if (error) throw error;
    if (data?.is_solvent !== is_solvent) {
      throw new Error('Solvency was not updated');
    }
    return data;
  },

  /**
   * Updates an athlete's membership plan.
   */
  async updatePlan(id: string, plan: AthletePlan | string): Promise<void> {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan, tenant_id')
      .eq('id', id)
      .single();

    if (profileError) throw profileError;
    if (profile?.plan === plan) return;

    const planFields = await buildPlanChangeFields(
      supabase,
      plan,
      profile?.tenant_id ?? undefined
    );

    const { error } = await supabase
      .from('profiles')
      .update(planFields)
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Updates the membership renew / period-start date.
   */
  async updatePlanPeriodStart(id: string, planPeriodStart: string | null): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({
        plan_period_start: planPeriodStart
          ? renewDateToIso(planPeriodStart)
          : null,
      })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Current weekly/period session usage including staff offset.
   * Returns null for unlimited plans or members without a limited plan.
   */
  async getPlanSessionUsage(id: string): Promise<PlanSessionUsage | null> {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(
        'plan, tenant_id, plan_period_start, plan_usage_offset, plan_usage_offset_week_start'
      )
      .eq('id', id)
      .single();

    if (profileError) throw profileError;
    if (!profile?.plan) return null;

    const { data: plan, error: planError } = await supabase
      .from('membership_plans')
      .select('limit_type, weekly_limit, session_limit, validity_days')
      .eq('id', profile.plan)
      .maybeSingle();

    if (planError) throw planError;
    if (!plan) return null;

    const limitType =
      (plan.limit_type as PlanLimitType | null) ??
      (await getPlanLimitType(supabase, profile.plan, profile.tenant_id ?? undefined)) ??
      'none';

    if (limitType === 'weekly' && plan.weekly_limit != null && plan.weekly_limit > 0) {
      const weekStart = mondayDateString();
      const weekStartDate = parseISO(`${weekStart}T00:00:00.000Z`);
      const nextWeekStart = addWeeks(weekStartDate, 1);
      const bookingsUsed = await countActiveBookingsInRange(
        id,
        profile.tenant_id ?? undefined,
        weekStartDate.toISOString(),
        nextWeekStart.toISOString()
      );
      const storedOffset = Number(profile.plan_usage_offset) || 0;
      const offset =
        profile.plan_usage_offset_week_start === weekStart ? storedOffset : 0;
      const used = Math.max(0, bookingsUsed + offset);
      const limit = plan.weekly_limit;
      return {
        limitType: 'weekly',
        used,
        limit,
        offset,
        bookingsUsed,
        remaining: Math.max(0, limit - used),
        weekStart,
      };
    }

    if (
      limitType === 'period' &&
      plan.session_limit != null &&
      plan.session_limit > 0 &&
      plan.validity_days != null &&
      plan.validity_days > 0
    ) {
      const periodStart = profile.plan_period_start
        ? parseISO(profile.plan_period_start)
        : new Date();
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + plan.validity_days);
      const bookingsUsed = await countActiveBookingsInRange(
        id,
        profile.tenant_id ?? undefined,
        periodStart.toISOString(),
        periodEnd.toISOString()
      );
      const offset = Number(profile.plan_usage_offset) || 0;
      const used = Math.max(0, bookingsUsed + offset);
      const limit = plan.session_limit;
      return {
        limitType: 'period',
        used,
        limit,
        offset,
        bookingsUsed,
        remaining: Math.max(0, limit - used),
        weekStart: null,
      };
    }

    return null;
  },

  /**
   * Sets displayed sessions used for the current weekly/period window.
   * Persists as plan_usage_offset = desiredUsed - bookingsInWindow.
   */
  async updatePlanSessionsUsed(id: string, desiredUsed: number): Promise<PlanSessionUsage> {
    const usage = await this.getPlanSessionUsage(id);
    if (!usage) {
      throw new Error('Athlete plan has no session limit');
    }

    const clamped = Math.max(0, Math.min(usage.limit, Math.round(desiredUsed)));
    const offset = clamped - usage.bookingsUsed;
    const weekStart = usage.limitType === 'weekly' ? mondayDateString() : null;

    const { error } = await supabase
      .from('profiles')
      .update({
        plan_usage_offset: offset,
        plan_usage_offset_week_start: weekStart,
      })
      .eq('id', id);

    if (error) throw error;

    const refreshed = await this.getPlanSessionUsage(id);
    if (!refreshed) throw new Error('Athlete plan has no session limit');
    return refreshed;
  },

  /**
   * Toggles whether an athlete's inscription (registration fee) has been paid.
   */
  async updateInscriptionStatus(id: string, inscription_paid: boolean): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ inscription_paid })
      .eq('id', id);

    if (error) throw error;
  },
  /**
   * Fetches a single profile by ID with extended information.
   */
  async getProfileById(id: string): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .select(`*, bookings!left(status, created_at, class_id, classes(class_type, start_time))`)
      .eq('id', id)
      .single();

    if (error) throw error;

    const profile = data as Profile & { tenant_id?: string };
    const plan_name = await membershipPlanService.resolvePlanDisplayName(
      profile.plan,
      profile.tenant_id
    );
    const lastPaymentDates = await financialService.getLastPaymentDates([id]);

    return {
      ...profile,
      plan_name,
      last_payment_date: lastPaymentDates[id],
    };
  },
};
