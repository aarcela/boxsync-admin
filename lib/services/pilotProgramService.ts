import { supabase } from '../supabase';

export interface PilotBaseline {
  id: string;
  tenant_id: string;
  start_date: string;
  target_end_date: string;
  starting_active_members: number;
  starting_mrr: number;
  starting_at_risk: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PilotMetrics {
  activeMembers: number;
  currentMrr: number;
  openAtRisk: number;
  interventionsCreated: number;
  interventionsContacted: number;
  interventionsResolved: number;
  membersReturned: number;
  paymentsRecovered: number;
  recoveredRevenue: number;
  completionRate: number;
  contactRate: number;
}

async function calculateCurrentMetrics(
  tenantId: string,
  since?: string
): Promise<PilotMetrics> {
  const [membersResult, plansResult, interventionsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, plan, is_solvent')
      .eq('tenant_id', tenantId)
      .eq('role', 'member'),
    supabase
      .from('membership_plans')
      .select('id, price_usd')
      .eq('tenant_id', tenantId),
    (() => {
      let query = supabase
        .from('member_interventions')
        .select(
          'id, member_id, status, outcome_type, recovered_amount, monthly_value, contacted_at, created_at'
        )
        .eq('tenant_id', tenantId);
      if (since) query = query.gte('created_at', `${since}T00:00:00.000Z`);
      return query;
    })(),
  ]);

  const firstError =
    membersResult.error || plansResult.error || interventionsResult.error;
  if (firstError) throw firstError;

  const prices = new Map(
    (plansResult.data || []).map((plan) => [
      plan.id as string,
      Number(plan.price_usd || 0),
    ])
  );
  const activeMembers = (membersResult.data || []).filter(
    (member) => member.is_solvent
  );
  const interventions = interventionsResult.data || [];
  const contacted = interventions.filter((item) => item.contacted_at);
  const resolved = interventions.filter((item) => item.status === 'resolved');
  const recoveredByMember = new Map<string, number>();
  for (const item of resolved) {
    recoveredByMember.set(
      item.member_id,
      Math.max(
        recoveredByMember.get(item.member_id) || 0,
        Number(item.recovered_amount || 0)
      )
    );
  }

  return {
    activeMembers: activeMembers.length,
    currentMrr: activeMembers.reduce(
      (sum, member) => sum + (member.plan ? prices.get(member.plan) || 0 : 0),
      0
    ),
    openAtRisk: interventions.filter(
      (item) => item.status === 'open' || item.status === 'escalated'
    ).length,
    interventionsCreated: interventions.length,
    interventionsContacted: contacted.length,
    interventionsResolved: resolved.length,
    membersReturned: resolved.filter(
      (item) => item.outcome_type === 'returned_to_class'
    ).length,
    paymentsRecovered: resolved.filter(
      (item) =>
        item.outcome_type === 'payment_recovered' ||
        item.outcome_type === 'membership_renewed' ||
        item.outcome_type === 'registration_recovered'
    ).length,
    recoveredRevenue: [...recoveredByMember.values()].reduce(
      (sum, value) => sum + value,
      0
    ),
    completionRate: interventions.length
      ? Math.round((resolved.length / interventions.length) * 100)
      : 0,
    contactRate: interventions.length
      ? Math.round((contacted.length / interventions.length) * 100)
      : 0,
  };
}

export const pilotProgramService = {
  async getBaseline(tenantId: string): Promise<PilotBaseline | null> {
    const { data, error } = await supabase
      .from('pilot_baselines')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw error;
    return data as PilotBaseline | null;
  },

  async createBaseline(
    tenantId: string,
    notes?: string
  ): Promise<PilotBaseline> {
    const metrics = await calculateCurrentMetrics(tenantId);
    const target = new Date();
    target.setDate(target.getDate() + 60);
    const { data, error } = await supabase
      .from('pilot_baselines')
      .insert({
        tenant_id: tenantId,
        start_date: new Date().toISOString().slice(0, 10),
        target_end_date: target.toISOString().slice(0, 10),
        starting_active_members: metrics.activeMembers,
        starting_mrr: metrics.currentMrr,
        starting_at_risk: metrics.openAtRisk,
        notes: notes?.trim() || null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as PilotBaseline;
  },

  async updateNotes(tenantId: string, notes: string): Promise<void> {
    const { error } = await supabase
      .from('pilot_baselines')
      .update({ notes: notes.trim() || null })
      .eq('tenant_id', tenantId);
    if (error) throw error;
  },

  async getMetrics(
    tenantId: string,
    baseline: PilotBaseline | null
  ): Promise<PilotMetrics> {
    return calculateCurrentMetrics(tenantId, baseline?.start_date);
  },

  buildCaseStudy(params: {
    gymName: string;
    baseline: PilotBaseline;
    metrics: PilotMetrics;
  }): string {
    const { gymName, baseline, metrics } = params;
    const memberDelta = metrics.activeMembers - baseline.starting_active_members;
    const mrrDelta = metrics.currentMrr - Number(baseline.starting_mrr);
    return [
      `${gymName} — 60-Day Revenue Rescue Pilot`,
      `Measurement window: ${baseline.start_date} to ${baseline.target_end_date}`,
      '',
      `Starting active members: ${baseline.starting_active_members}`,
      `Current active members: ${metrics.activeMembers} (${memberDelta >= 0 ? '+' : ''}${memberDelta})`,
      `Starting MRR: $${Number(baseline.starting_mrr).toFixed(0)}`,
      `Current MRR: $${metrics.currentMrr.toFixed(0)} (${mrrDelta >= 0 ? '+' : ''}$${mrrDelta.toFixed(0)})`,
      '',
      `Interventions created: ${metrics.interventionsCreated}`,
      `Coach conversations completed: ${metrics.interventionsContacted}`,
      `Members returned to class: ${metrics.membersReturned}`,
      `Payments recovered: ${metrics.paymentsRecovered}`,
      `Revenue attributed to resolved interventions: $${metrics.recoveredRevenue.toFixed(0)}`,
      '',
      'All figures are based on recorded WODUS attendance, payment, and intervention events.',
    ].join('\n');
  },
};
