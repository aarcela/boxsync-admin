import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import {
  CoachSalaryTier,
  CoachSalaryTierRate,
  CoachWithSalaryTier,
} from '../types/gym';

export type TierRateInput = { class_type: string; rate_usd: number };

type TierInput = {
  name: string;
  description: string | null;
  is_active: boolean;
  rates: TierRateInput[];
};

const COACH_ROLES = ['coach', 'manager', 'admin'] as const;

export const coachSalaryService = {
  async getTiersWithRates(tenantId: string): Promise<CoachSalaryTier[]> {
    const { data: tiers, error: tiersError } = await supabase
      .from('coach_salary_tiers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (tiersError) throw tiersError;
    if (!tiers?.length) return [];

    const tierIds = tiers.map((t) => t.id);
    const { data: rates, error: ratesError } = await supabase
      .from('coach_salary_tier_rates')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('tier_id', tierIds);

    if (ratesError) throw ratesError;

    const ratesByTier = (rates as CoachSalaryTierRate[]).reduce<
      Record<string, CoachSalaryTierRate[]>
    >((acc, rate) => {
      if (!acc[rate.tier_id]) acc[rate.tier_id] = [];
      acc[rate.tier_id].push(rate);
      return acc;
    }, {});

    return (tiers as CoachSalaryTier[]).map((tier) => ({
      ...tier,
      rates: ratesByTier[tier.id] ?? [],
    }));
  },

  async createTier(
    client: SupabaseClient,
    tenantId: string,
    input: TierInput
  ): Promise<CoachSalaryTier> {
    const { data: tier, error: tierError } = await client
      .from('coach_salary_tiers')
      .insert([
        {
          tenant_id: tenantId,
          name: input.name,
          description: input.description,
          is_active: input.is_active,
        },
      ])
      .select()
      .single();

    if (tierError) throw tierError;

    if (input.rates.length > 0) {
      const { error: ratesError } = await client
        .from('coach_salary_tier_rates')
        .insert(
          input.rates.map((r) => ({
            tenant_id: tenantId,
            tier_id: tier.id,
            class_type: r.class_type,
            rate_usd: r.rate_usd,
          }))
        );

      if (ratesError) throw ratesError;
    }

    return tier as CoachSalaryTier;
  },

  async updateTier(
    client: SupabaseClient,
    tenantId: string,
    id: string,
    input: TierInput
  ): Promise<CoachSalaryTier> {
    const { data: tier, error: tierError } = await client
      .from('coach_salary_tiers')
      .update({
        name: input.name,
        description: input.description,
        is_active: input.is_active,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (tierError) throw tierError;

    const { error: deleteError } = await client
      .from('coach_salary_tier_rates')
      .delete()
      .eq('tier_id', id)
      .eq('tenant_id', tenantId);

    if (deleteError) throw deleteError;

    if (input.rates.length > 0) {
      const { error: ratesError } = await client
        .from('coach_salary_tier_rates')
        .insert(
          input.rates.map((r) => ({
            tenant_id: tenantId,
            tier_id: id,
            class_type: r.class_type,
            rate_usd: r.rate_usd,
          }))
        );

      if (ratesError) throw ratesError;
    }

    return tier as CoachSalaryTier;
  },

  async deleteTier(
    client: SupabaseClient,
    tenantId: string,
    id: string
  ): Promise<void> {
    const { count, error: countError } = await client
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('salary_tier_id', id);

    if (countError) throw countError;
    if (count && count > 0) {
      throw new Error('TIER_HAS_ASSIGNED_COACHES');
    }

    const { error } = await client
      .from('coach_salary_tiers')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  },

  async toggleTierStatus(
    client: SupabaseClient,
    tenantId: string,
    id: string,
    is_active: boolean
  ): Promise<void> {
    const { error } = await client
      .from('coach_salary_tiers')
      .update({ is_active })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  },

  async getCoachesWithTiers(tenantId: string): Promise<CoachWithSalaryTier[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        `
        id,
        full_name,
        role,
        salary_tier_id,
        salary_tier:coach_salary_tiers!salary_tier_id(id, name)
      `
      )
      .eq('tenant_id', tenantId)
      .in('role', [...COACH_ROLES])
      .order('full_name', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const tier = Array.isArray(row.salary_tier)
        ? row.salary_tier[0]
        : row.salary_tier;
      return {
        id: row.id,
        full_name: row.full_name,
        role: row.role,
        salary_tier_id: row.salary_tier_id,
        salary_tier: tier ?? null,
      };
    }) as CoachWithSalaryTier[];
  },

  async assignCoachTier(
    client: SupabaseClient,
    tenantId: string,
    coachId: string,
    tierId: string | null
  ): Promise<void> {
    const { data: coach, error: coachError } = await client
      .from('profiles')
      .select('id, role, tenant_id')
      .eq('id', coachId)
      .eq('tenant_id', tenantId)
      .single();

    if (coachError || !coach) {
      throw new Error('Coach not found');
    }

    if (!COACH_ROLES.includes(coach.role as (typeof COACH_ROLES)[number])) {
      throw new Error('Profile is not a coach');
    }

    if (tierId) {
      const { data: tier, error: tierError } = await client
        .from('coach_salary_tiers')
        .select('id')
        .eq('id', tierId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (tierError || !tier) {
        throw new Error('Tier not found');
      }
    }

    const { error } = await client
      .from('profiles')
      .update({ salary_tier_id: tierId })
      .eq('id', coachId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  },
};
