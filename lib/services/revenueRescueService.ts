import { supabase } from '../supabase';

export type RescueSignalType =
  | 'payment'
  | 'attendance'
  | 'onboarding'
  | 'no_show'
  | 'feedback'
  | 'registration';

export type RescuePriority = 'urgent' | 'high' | 'medium';
export type InterventionStatus =
  | 'open'
  | 'contacted'
  | 'snoozed'
  | 'resolved'
  | 'escalated';

export interface RescueIntervention {
  id: string;
  tenant_id: string;
  member_id: string;
  assigned_to: string | null;
  signal_key: string;
  signal_type: RescueSignalType;
  status: InterventionStatus;
  priority: RescuePriority;
  title: string;
  explanation: string;
  suggested_action: string;
  whatsapp_message: string;
  monthly_value: number;
  evidence: Record<string, unknown>;
  due_at: string | null;
  contacted_at: string | null;
  snoozed_until: string | null;
  snooze_reason: string | null;
  resolution_reason: string | null;
  outcome_type: string | null;
  outcome_detected_at: string | null;
  recovered_amount: number;
  created_at: string;
  updated_at: string;
  member?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    created_at: string;
  } | null;
  assignee?: {
    id: string;
    full_name: string | null;
  } | null;
}

export interface RescueSummary {
  openRevenueAtRisk: number;
  recoveredRevenue: number;
  openCount: number;
  contactedCount: number;
  returnedCount: number;
  completionRate: number;
}

export interface InterventionEvent {
  id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor: { full_name: string | null } | null;
}

type MemberRow = {
  id: string;
  tenant_id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  is_solvent: boolean | null;
  plan: string | null;
  inscription_paid: boolean | null;
  inscription_cost: number | null;
};

type BookingRow = {
  user_id: string;
  status: 'booked' | 'attended' | 'no_show';
  created_at: string;
  classes: { start_time: string } | { start_time: string }[] | null;
};

type Candidate = Omit<
  RescueIntervention,
  | 'id'
  | 'status'
  | 'assigned_to'
  | 'due_at'
  | 'contacted_at'
  | 'snoozed_until'
  | 'snooze_reason'
  | 'resolution_reason'
  | 'outcome_type'
  | 'outcome_detected_at'
  | 'recovered_amount'
  | 'created_at'
  | 'updated_at'
  | 'member'
  | 'assignee'
>;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(now: number, value: string): number {
  return Math.max(0, Math.floor((now - new Date(value).getTime()) / DAY_MS));
}

function classStart(booking: BookingRow): string {
  const related = Array.isArray(booking.classes) ? booking.classes[0] : booking.classes;
  return related?.start_time || booking.created_at;
}

function memberFirstName(member: MemberRow): string {
  return member.full_name?.trim().split(/\s+/)[0] || 'atleta';
}

function draftMessage(
  member: MemberRow,
  signalType: RescueSignalType,
  explanation: string
): string {
  const firstName = memberFirstName(member);
  if (signalType === 'payment' || signalType === 'registration') {
    return `Hola ${firstName}, ¿cómo estás? Vimos que hay un pendiente con tu membresía. Queremos ayudarte a resolverlo para que sigas entrenando sin interrupciones. ¿Te podemos apoyar?`;
  }
  if (signalType === 'onboarding') {
    return `Hola ${firstName}, queremos ayudarte a arrancar con fuerza. ¿Cómo te has sentido en estas primeras semanas? Podemos recomendarte una clase y acompañarte en tu próximo entrenamiento.`;
  }
  if (signalType === 'no_show') {
    return `Hola ${firstName}, notamos que se te complicó llegar a algunas clases. ¿Hay otro horario que te funcione mejor? Te ayudamos a encontrar una opción para retomar el ritmo.`;
  }
  if (signalType === 'feedback') {
    return `Hola ${firstName}, gracias por entrenar con nosotros. Queremos escuchar cómo ha sido tu experiencia y qué podemos mejorar. ¿Tienes unos minutos para conversar?`;
  }
  return `Hola ${firstName}, te extrañamos en el box. ${explanation} ¿Todo bien? Podemos ayudarte a elegir una clase para volver esta semana.`;
}

function makeCandidate(params: {
  member: MemberRow;
  signalKey: string;
  signalType: RescueSignalType;
  priority: RescuePriority;
  title: string;
  explanation: string;
  suggestedAction: string;
  monthlyValue: number;
  evidence: Record<string, unknown>;
}): Candidate {
  return {
    tenant_id: params.member.tenant_id,
    member_id: params.member.id,
    signal_key: params.signalKey,
    signal_type: params.signalType,
    priority: params.priority,
    title: params.title,
    explanation: params.explanation,
    suggested_action: params.suggestedAction,
    whatsapp_message: draftMessage(
      params.member,
      params.signalType,
      params.explanation
    ),
    monthly_value: params.monthlyValue,
    evidence: params.evidence,
  };
}

function buildCandidates(
  members: MemberRow[],
  bookings: BookingRow[],
  planPrices: Map<string, number>,
  feedbackByMember: Map<string, number>,
  progressByMember: Map<string, { prCount: number; wodResultCount: number }>
): Candidate[] {
  const now = Date.now();
  const candidates: Candidate[] = [];

  for (const member of members) {
    const value = member.plan ? planPrices.get(member.plan) || 0 : 0;
    const memberBookings = bookings
      .filter((booking) => booking.user_id === member.id)
      .sort(
        (a, b) =>
          new Date(classStart(b)).getTime() - new Date(classStart(a)).getTime()
      );
    const attended = memberBookings.filter((booking) => booking.status === 'attended');
    const recentAttendance = attended.filter(
      (booking) => daysBetween(now, classStart(booking)) < 14
    ).length;
    const baselineAttendance = attended.filter((booking) => {
      const days = daysBetween(now, classStart(booking));
      return days >= 14 && days < 70;
    }).length;
    const recentPerWeek = recentAttendance / 2;
    const baselinePerWeek = baselineAttendance / 8;
    const lastAttended = attended[0] ? classStart(attended[0]) : null;
    const inactiveDays = lastAttended ? daysBetween(now, lastAttended) : 999;
    const membershipAgeDays = daysBetween(now, member.created_at);
    const progress = progressByMember.get(member.id) || {
      prCount: 0,
      wodResultCount: 0,
    };
    const noShows30d = memberBookings.filter(
      (booking) =>
        booking.status === 'no_show' &&
        daysBetween(now, classStart(booking)) < 30
    ).length;

    if (!member.is_solvent) {
      candidates.push(
        makeCandidate({
          member,
          signalKey: 'payment-overdue',
          signalType: 'payment',
          priority: 'urgent',
          title: 'Membership revenue at risk',
          explanation: `Access is inactive and approximately $${value.toFixed(0)} in monthly revenue is at risk.`,
          suggestedAction: 'Offer payment help or a temporary plan alternative.',
          monthlyValue: value,
          evidence: { isSolvent: false, planValue: value },
        })
      );
    }

    if (!member.inscription_paid && Number(member.inscription_cost || 0) > 0) {
      candidates.push(
        makeCandidate({
          member,
          signalKey: 'registration-unpaid',
          signalType: 'registration',
          priority: 'medium',
          title: 'Registration fee pending',
          explanation: `$${Number(member.inscription_cost).toFixed(0)} registration fee remains unpaid.`,
          suggestedAction: 'Confirm the payment method and agree on a payment date.',
          monthlyValue: Number(member.inscription_cost),
          evidence: { registrationFee: Number(member.inscription_cost) },
        })
      );
    }

    const onboardingMilestones = {
      firstClass: attended.length > 0,
      coachedClasses: attended.length,
      firstProgress:
        progress.prCount > 0 || progress.wodResultCount > 0,
      consistentFirstMonth: attended.length >= 4,
    };
    const missedOnboardingMilestone =
      (membershipAgeDays >= 7 && !onboardingMilestones.firstClass) ||
      (membershipAgeDays >= 14 && attended.length < 2) ||
      (membershipAgeDays >= 30 &&
        (!onboardingMilestones.firstProgress ||
          !onboardingMilestones.consistentFirstMonth)) ||
      (membershipAgeDays >= 60 && recentPerWeek < 1);

    if (
      member.is_solvent &&
      membershipAgeDays <= 90 &&
      (missedOnboardingMilestone || inactiveDays >= 7)
    ) {
      candidates.push(
        makeCandidate({
          member,
          signalKey: 'first-90-days',
          signalType: 'onboarding',
          priority: membershipAgeDays <= 30 ? 'urgent' : 'high',
          title: 'First 90 days need attention',
          explanation: `Day ${membershipAgeDays} member is averaging ${recentPerWeek.toFixed(1)} visits/week.`,
          suggestedAction: 'Assign a coach check-in and book the next suitable class.',
          monthlyValue: value,
          evidence: {
            membershipAgeDays,
            recentPerWeek,
            inactiveDays,
            milestones: onboardingMilestones,
          },
        })
      );
    } else if (
      member.is_solvent &&
      (inactiveDays >= 10 ||
        (baselinePerWeek >= 1.5 && recentPerWeek <= baselinePerWeek * 0.5))
    ) {
      const decline = baselinePerWeek
        ? Math.round((1 - recentPerWeek / baselinePerWeek) * 100)
        : 100;
      candidates.push(
        makeCandidate({
          member,
          signalKey: 'attendance-decline',
          signalType: 'attendance',
          priority: inactiveDays >= 14 ? 'urgent' : 'high',
          title: 'Attendance momentum dropped',
          explanation:
            inactiveDays < 999
              ? `${inactiveDays} days since the last attended class; weekly frequency is down ${Math.max(0, decline)}%.`
              : 'No attended class has been recorded.',
          suggestedAction: 'Ask what changed and reserve a realistic comeback class.',
          monthlyValue: value,
          evidence: {
            inactiveDays,
            recentPerWeek,
            baselinePerWeek,
            declinePercent: Math.max(0, decline),
          },
        })
      );
    }

    if (member.is_solvent && noShows30d >= 2) {
      candidates.push(
        makeCandidate({
          member,
          signalKey: 'repeat-no-show',
          signalType: 'no_show',
          priority: 'high',
          title: 'Repeated no-shows',
          explanation: `${noShows30d} booked classes were missed in the last 30 days.`,
          suggestedAction: 'Discuss schedule friction and recommend a better time slot.',
          monthlyValue: value,
          evidence: { noShows30d },
        })
      );
    }

    const averageFeedback = feedbackByMember.get(member.id);
    if (member.is_solvent && averageFeedback != null && averageFeedback < 3) {
      candidates.push(
        makeCandidate({
          member,
          signalKey: 'low-feedback',
          signalType: 'feedback',
          priority: 'high',
          title: 'Member experience needs recovery',
          explanation: `Recent feedback average is ${averageFeedback.toFixed(1)} out of 5.`,
          suggestedAction: 'Manager should ask what went wrong and agree on one fix.',
          monthlyValue: value,
          evidence: { averageFeedback },
        })
      );
    }
  }

  return candidates;
}

async function appendEvent(
  interventionId: string,
  eventType: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase.from('intervention_events').insert({
    intervention_id: interventionId,
    event_type: eventType,
    metadata,
  });
  if (error) throw error;
}

export const revenueRescueService = {
  async syncAndList(tenantId: string): Promise<RescueIntervention[]> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * DAY_MS).toISOString();
    const sixtyDaysAgo = new Date(Date.now() - 60 * DAY_MS).toISOString();

    const [
      membersResult,
      bookingsResult,
      plansResult,
      feedbackResult,
      prsResult,
      wodResultsResult,
    ] =
      await Promise.all([
        supabase
          .from('profiles')
          .select(
            'id, tenant_id, full_name, phone, created_at, is_solvent, plan, inscription_paid, inscription_cost'
          )
          .eq('tenant_id', tenantId)
          .eq('role', 'member'),
        supabase
          .from('bookings')
          .select('user_id, status, created_at, classes(start_time)')
          .eq('tenant_id', tenantId)
          .gte('created_at', ninetyDaysAgo),
        supabase
          .from('membership_plans')
          .select('id, price_usd')
          .eq('tenant_id', tenantId),
        supabase
          .from('feedback')
          .select('user_id, rating')
          .eq('tenant_id', tenantId)
          .gte('created_at', sixtyDaysAgo),
        supabase
          .from('personal_records')
          .select('user_id')
          .eq('tenant_id', tenantId)
          .gte('created_at', ninetyDaysAgo),
        supabase
          .from('wod_results')
          .select('user_id')
          .eq('tenant_id', tenantId)
          .gte('created_at', ninetyDaysAgo),
      ]);

    const firstError =
      membersResult.error ||
      bookingsResult.error ||
      plansResult.error ||
      feedbackResult.error ||
      prsResult.error ||
      wodResultsResult.error;
    if (firstError) throw firstError;

    const members = (membersResult.data || []) as MemberRow[];
    const bookings = (bookingsResult.data || []) as unknown as BookingRow[];
    const planPrices = new Map(
      (plansResult.data || []).map((plan) => [
        plan.id as string,
        Number(plan.price_usd || 0),
      ])
    );
    const feedbackGroups = new Map<string, number[]>();
    for (const feedback of feedbackResult.data || []) {
      if (feedback.rating == null) continue;
      const ratings = feedbackGroups.get(feedback.user_id) || [];
      ratings.push(Number(feedback.rating));
      feedbackGroups.set(feedback.user_id, ratings);
    }
    const feedbackByMember = new Map(
      [...feedbackGroups.entries()].map(([memberId, ratings]) => [
        memberId,
        ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length,
      ])
    );
    const progressByMember = new Map<
      string,
      { prCount: number; wodResultCount: number }
    >();
    for (const record of prsResult.data || []) {
      if (!record.user_id) continue;
      const progress = progressByMember.get(record.user_id) || {
        prCount: 0,
        wodResultCount: 0,
      };
      progress.prCount += 1;
      progressByMember.set(record.user_id, progress);
    }
    for (const result of wodResultsResult.data || []) {
      if (!result.user_id) continue;
      const progress = progressByMember.get(result.user_id) || {
        prCount: 0,
        wodResultCount: 0,
      };
      progress.wodResultCount += 1;
      progressByMember.set(result.user_id, progress);
    }

    const candidates = buildCandidates(
      members,
      bookings,
      planPrices,
      feedbackByMember,
      progressByMember
    );
    const { data: existing, error: existingError } = await supabase
      .from('member_interventions')
      .select(
        'id, member_id, signal_key, status, snoozed_until, outcome_detected_at'
      )
      .eq('tenant_id', tenantId);
    if (existingError) throw existingError;

    const existingByKey = new Map(
      (existing || []).map((row) => [`${row.member_id}:${row.signal_key}`, row])
    );
    const now = new Date();
    const inserts: Candidate[] = [];
    const updates: Array<Candidate & { id: string; status?: InterventionStatus }> = [];

    for (const candidate of candidates) {
      const key = `${candidate.member_id}:${candidate.signal_key}`;
      const previous = existingByKey.get(key);
      if (!previous) {
        inserts.push(candidate);
        continue;
      }

      const snoozeExpired =
        previous.status === 'snoozed' &&
        previous.snoozed_until &&
        new Date(previous.snoozed_until) <= now;
      const resolvedCycleExpired =
        previous.status === 'resolved' &&
        previous.outcome_detected_at &&
        now.getTime() - new Date(previous.outcome_detected_at).getTime() >
          30 * DAY_MS;
      updates.push({
        ...candidate,
        id: previous.id,
        ...(snoozeExpired || resolvedCycleExpired
          ? { status: 'open' as const }
          : {}),
      });
    }

    if (inserts.length) {
      const { error } = await supabase.from('member_interventions').insert(inserts);
      if (error) throw error;
    }

    for (const update of updates) {
      const { id, status, ...fields } = update;
      const { error } = await supabase
        .from('member_interventions')
        .update({
          ...fields,
          ...(status
            ? {
                status,
                contacted_at: null,
                snoozed_until: null,
                snooze_reason: null,
                resolution_reason: null,
                outcome_type: null,
                outcome_detected_at: null,
                recovered_amount: 0,
              }
            : {}),
        })
        .eq('id', id);
      if (error) throw error;
    }

    await this.refreshOutcomes(tenantId);

    const { data, error } = await supabase
      .from('member_interventions')
      .select(
        '*, member:profiles!member_id(id, full_name, phone, created_at), assignee:profiles!assigned_to(id, full_name)'
      )
      .eq('tenant_id', tenantId)
      .order('monthly_value', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as RescueIntervention[];
  },

  async listStaff(tenantId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('tenant_id', tenantId)
      .in('role', ['coach', 'manager', 'admin'])
      .order('full_name');
    if (error) throw error;
    return data || [];
  },

  async listEvents(interventionId: string): Promise<InterventionEvent[]> {
    const { data, error } = await supabase
      .from('intervention_events')
      .select('id, event_type, metadata, created_at, actor:profiles!actor_id(full_name)')
      .eq('intervention_id', interventionId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((event) => ({
      ...event,
      actor: Array.isArray(event.actor) ? event.actor[0] || null : event.actor,
    })) as InterventionEvent[];
  },

  async assign(interventionId: string, assigneeId: string | null): Promise<void> {
    const dueAt = assigneeId
      ? new Date(Date.now() + DAY_MS).toISOString()
      : null;
    const { error } = await supabase
      .from('member_interventions')
      .update({ assigned_to: assigneeId, due_at: dueAt })
      .eq('id', interventionId);
    if (error) throw error;
    await appendEvent(interventionId, 'assigned', { assigneeId, dueAt });
  },

  async markContacted(interventionId: string, message: string): Promise<void> {
    const contactedAt = new Date().toISOString();
    const { error } = await supabase
      .from('member_interventions')
      .update({
        status: 'contacted',
        contacted_at: contactedAt,
        whatsapp_message: message,
      })
      .eq('id', interventionId);
    if (error) throw error;
    await appendEvent(interventionId, 'contacted', { message });
  },

  async snooze(
    interventionId: string,
    reason: string,
    days = 14
  ): Promise<void> {
    const snoozedUntil = new Date(Date.now() + days * DAY_MS).toISOString();
    const { error } = await supabase
      .from('member_interventions')
      .update({
        status: 'snoozed',
        snooze_reason: reason,
        snoozed_until: snoozedUntil,
      })
      .eq('id', interventionId);
    if (error) throw error;
    await appendEvent(interventionId, 'snoozed', { reason, snoozedUntil });
  },

  async escalate(interventionId: string): Promise<void> {
    const { error } = await supabase
      .from('member_interventions')
      .update({ status: 'escalated', due_at: new Date().toISOString() })
      .eq('id', interventionId);
    if (error) throw error;
    await appendEvent(interventionId, 'escalated');
  },

  async resolve(
    interventionId: string,
    reason: string,
    recoveredAmount = 0
  ): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('member_interventions')
      .update({
        status: 'resolved',
        resolution_reason: reason,
        outcome_type: reason,
        outcome_detected_at: now,
        recovered_amount: recoveredAmount,
      })
      .eq('id', interventionId);
    if (error) throw error;
    await appendEvent(interventionId, 'resolved', { reason, recoveredAmount });
  },

  async refreshOutcomes(tenantId: string): Promise<void> {
    const { data: contacted, error } = await supabase
      .from('member_interventions')
      .select('id, member_id, signal_type, contacted_at, monthly_value')
      .eq('tenant_id', tenantId)
      .in('status', ['contacted', 'escalated'])
      .not('contacted_at', 'is', null);
    if (error) throw error;

    for (const intervention of contacted || []) {
      const contactedAt = intervention.contacted_at as string;
      let outcomeType: string | null = null;

      if (intervention.signal_type === 'registration') {
        const { data: member } = await supabase
          .from('profiles')
          .select('inscription_paid')
          .eq('tenant_id', tenantId)
          .eq('id', intervention.member_id)
          .maybeSingle();
        if (member?.inscription_paid) outcomeType = 'registration_recovered';
      } else if (intervention.signal_type === 'payment') {
        const { data: payment } = await supabase
          .from('payments')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('user_id', intervention.member_id)
          .eq('status', 'approved')
          .gte('created_at', contactedAt)
          .limit(1)
          .maybeSingle();
        if (payment) {
          outcomeType = 'payment_recovered';
        } else {
          const { data: renewedMember } = await supabase
            .from('profiles')
            .select('is_solvent, plan_period_start')
            .eq('tenant_id', tenantId)
            .eq('id', intervention.member_id)
            .maybeSingle();
          if (
            renewedMember?.is_solvent &&
            renewedMember.plan_period_start &&
            new Date(renewedMember.plan_period_start) >= new Date(contactedAt)
          ) {
            outcomeType = 'membership_renewed';
          }
        }
      } else {
        const { data: returned } = await supabase
          .from('bookings')
          .select('id, classes!inner(start_time)')
          .eq('tenant_id', tenantId)
          .eq('user_id', intervention.member_id)
          .eq('status', 'attended')
          .gte('classes.start_time', contactedAt)
          .limit(1)
          .maybeSingle();
        if (returned) outcomeType = 'returned_to_class';
      }

      if (outcomeType) {
        await this.resolve(
          intervention.id,
          outcomeType,
          Number(intervention.monthly_value || 0)
        );
      }
    }
  },

  summarize(interventions: RescueIntervention[]): RescueSummary {
    const actionable = interventions.filter(
      (item) => item.status !== 'resolved' && item.status !== 'snoozed'
    );
    const contacted = interventions.filter(
      (item) =>
        item.status === 'contacted' ||
        item.status === 'escalated' ||
        item.status === 'resolved'
    );
    const completed = interventions.filter((item) => item.status === 'resolved');
    const riskByMember = new Map<string, number>();
    for (const item of actionable) {
      riskByMember.set(
        item.member_id,
        Math.max(
          riskByMember.get(item.member_id) || 0,
          Number(item.monthly_value || 0)
        )
      );
    }
    const recoveredByMember = new Map<string, number>();
    for (const item of completed) {
      recoveredByMember.set(
        item.member_id,
        Math.max(
          recoveredByMember.get(item.member_id) || 0,
          Number(item.recovered_amount || 0)
        )
      );
    }
    return {
      openRevenueAtRisk: [...riskByMember.values()].reduce(
        (sum, value) => sum + value,
        0
      ),
      recoveredRevenue: [...recoveredByMember.values()].reduce(
        (sum, value) => sum + value,
        0
      ),
      openCount: actionable.length,
      contactedCount: contacted.length,
      returnedCount: completed.filter(
        (item) => item.outcome_type === 'returned_to_class'
      ).length,
      completionRate: interventions.length
        ? Math.round((completed.length / interventions.length) * 100)
        : 0,
    };
  },
};
