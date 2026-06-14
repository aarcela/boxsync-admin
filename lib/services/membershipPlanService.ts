import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureRowTenantId } from '../ensure-row-tenant-id';
import { supabase } from '../supabase';
import { MembershipPlan, type MembershipPlanInput } from '../types/gym';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const membershipPlanService = {
  async getMembershipPlans(tenantId: string): Promise<MembershipPlan[]> {
    const { data, error } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) throw error;
    return data as MembershipPlan[];
  },

  async getActiveMembershipPlans(tenantId: string): Promise<MembershipPlan[]> {
    const { data, error } = await supabase
      .from('membership_plans')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return data as MembershipPlan[];
  },

  async getMembershipPlanName(tenantId: string, planId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('membership_plans')
      .select('name')
      .eq('id', planId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) throw error;
    return data?.name ?? null;
  },

  async resolvePlanDisplayName(
    plan: string | undefined,
    tenantId?: string
  ): Promise<string | undefined> {
    if (!plan) return undefined;
    if (UUID_RE.test(plan)) {
      if (!tenantId) return undefined;
      const name = await this.getMembershipPlanName(tenantId, plan);
      return name ?? undefined;
    }
    return plan.replace(/_/g, ' ');
  },

  async createMembershipPlan(
    client: SupabaseClient,
    tenantId: string,
    plan: MembershipPlanInput
  ): Promise<MembershipPlan> {
    const { data, error } = await client
      .from('membership_plans')
      .insert([{ ...plan, tenant_id: tenantId }])
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('Insert returned no row');

    const saved = await ensureRowTenantId(client, 'membership_plans', data, tenantId);
    return saved as MembershipPlan;
  },

  async updateMembershipPlan(
    client: SupabaseClient,
    tenantId: string,
    id: string,
    updates: Partial<MembershipPlanInput>
  ): Promise<MembershipPlan> {
    const { data, error } = await client
      .from('membership_plans')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data as MembershipPlan;
  },

  async deleteMembershipPlan(
    client: SupabaseClient,
    tenantId: string,
    id: string
  ): Promise<void> {
    const { error } = await client
      .from('membership_plans')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  },
};
