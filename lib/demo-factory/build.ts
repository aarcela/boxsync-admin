import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_TENANT_CURRENCIES } from '@/lib/currency';
import { provisionTenant } from '@/lib/provision-tenant';
import { DEMO_SLUG_PREFIX, slugifyName } from '@/lib/reserved-slugs';
import { renewDateToIso } from '@/lib/renew-date';
import { membershipPlanService } from '@/lib/services/membershipPlanService';
import { tenantService } from '@/lib/services/tenantService';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildTenantDashboardUrl } from '@/lib/tenant-host';
import { DEFAULT_TENANT_TERMS_ES, MEMBER_TERM_PRESETS, serializeTenantTerms } from '@/lib/tenant-terms';
import type { MembershipPlan } from '@/lib/types/gym';
import { addDaysToDateStr, getGymDate } from '@/lib/utils/date';
import { fictionalNames, randomInt, seededRandom, shuffle } from './names';
import type { DemoInput, DemoMsg, DemoPlanInput } from './parse';
import {
  DEMO_RECEIPT_FILE,
  DEMO_SCHEDULE_DAYS_AHEAD,
  type DemoSettings,
  type SeededClass,
  demoEmail,
  endOfGymDay,
  expandSessions,
  insertInBatches,
  mondayOf,
  randomPassword,
  removeMemberFiles,
  seedBookings,
  uploadReceipts,
} from './seed';

export const DEMO_MEMBER_COUNT = 24;
const DEMO_PENDING_COUNT = 3;
const DEMO_OVERDUE_COUNT = 2;
const DEMO_NO_PLAN_COUNT = 2;
/** Amount printed on the fictional receipt image (Bs.). */
const DEMO_RECEIPT_VES = 2920;
const DAY_MS = 24 * 60 * 60 * 1000;

const CLASS_TYPE_COLORS = [
  '#ef4444', '#2563eb', '#9333ea', '#f97316', '#16a34a', '#db2777', '#0891b2', '#ca8a04',
];

export type DemoCreateResult = {
  tenantId: string;
  slug: string;
  url: string;
  expiresAt: string;
  admin: { email: string; password: string };
  member: { email: string; password: string };
  counts: {
    classes: number;
    bookings: number;
    members: number;
    coaches: number;
    payments: { approved: number; pending: number };
  };
  warnings: DemoMsg[];
};

type MemberKind = 'ok' | 'pending' | 'overdue' | 'no_plan';

async function pickSlug(name: string, client: SupabaseClient): Promise<string> {
  const base = `${DEMO_SLUG_PREFIX}${slugifyName(name) || 'estudio'}`;
  for (let n = 1; n <= 30; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await tenantService.getTenantBySlug(slug, client))) return slug;
  }
  throw new Error('No free demo slug for this name.');
}

function demoTenantSettings(input: DemoInput, demo: DemoSettings) {
  return {
    paletteId: input.paletteId,
    // The video is booking → proof → approve → QR. Noisy or empty modules stay off.
    features: {
      wod: false,
      personalRecords: false,
      community: false,
      coachPayments: false,
      attendance: true,
    },
    terms: serializeTenantTerms({
      ...DEFAULT_TENANT_TERMS_ES,
      member: MEMBER_TERM_PRESETS.clients.es,
      venue: 'estudio',
      workout: 'rutina',
    }),
    timezone: input.tz,
    supportWhatsApp: process.env.DEMO_SUPPORT_WHATSAPP?.trim() ?? '',
    currencies: { ...DEFAULT_TENANT_CURRENCIES },
    // Reminders off: demo users have no push tokens and nothing should be sent.
    booking: { bookClosesMinutesBefore: 0, cancelClosesMinutesBefore: 0, reminderMinutesBefore: 0 },
    // No birthday / anniversary / class-count milestones or their pushes.
    milestones: { enabled: false },
    demo,
  };
}

function planRow(plan: DemoPlanInput) {
  return {
    name: plan.name,
    price_usd: plan.priceUsd,
    description: null,
    is_active: true,
    limit_type: plan.limitType,
    weekly_limit: plan.weeklyLimit,
    session_limit: plan.sessionLimit,
    validity_days: plan.validityDays,
  };
}

async function createDemoUser(
  client: SupabaseClient,
  params: { email: string; password: string; fullName: string; tenantId: string },
  createdIds: string[]
): Promise<string> {
  const { data, error } = await client.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: { full_name: params.fullName, tenant_id: params.tenantId, language: 'es' },
    app_metadata: { tenant_id: params.tenantId },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Failed to create demo user');
  createdIds.push(data.user.id);
  return data.user.id;
}

async function updateProfile(client: SupabaseClient, userId: string, fields: Record<string, unknown>) {
  const { error } = await client.from('profiles').update(fields).eq('id', userId);
  if (error) throw error;
}

/** Affidavit accepted so the test member lands on Home in the app (fictional person). */
function affidavitFields(nowIso: string) {
  return {
    onboarding_affidavit_truth: true,
    onboarding_affidavit_fit: true,
    onboarding_affidavit_release: true,
    onboarding_affidavit_accepted_at: nowIso,
  };
}

function membershipFields(
  kind: MemberKind,
  plan: MembershipPlan | null,
  ctx: { today: string; tz: string; now: Date; rand: () => number }
): { profile: Record<string, unknown>; currentPeriod: string | null; previousPeriod: string | null; paidDaysAgo: number } {
  const { today, tz, now, rand } = ctx;
  if (!plan || kind === 'no_plan') {
    return { profile: { plan: null, is_solvent: false }, currentPeriod: null, previousPeriod: null, paidDaysAgo: 0 };
  }
  if (plan.limit_type === 'period') {
    const validity = plan.validity_days && plan.validity_days > 0 ? plan.validity_days : 30;
    const daysAgo =
      kind === 'ok'
        ? randomInt(rand, 2, Math.max(3, validity - 5))
        : kind === 'pending'
          ? validity + 1
          : validity + randomInt(rand, 12, 20);
    const start = new Date(now.getTime() - daysAgo * DAY_MS).toISOString();
    return {
      profile: { plan: plan.id, is_solvent: kind !== 'overdue', plan_period_start: start },
      currentPeriod: start,
      previousPeriod: null,
      paidDaysAgo: daysAgo,
    };
  }
  // weekly / none: plan_period_start is the next renew date (gym-local day).
  const offset =
    kind === 'ok' ? randomInt(rand, 3, 27) : kind === 'pending' ? -randomInt(rand, 0, 2) : -randomInt(rand, 12, 25);
  const renew = addDaysToDateStr(today, offset);
  const previous = addDaysToDateStr(renew, -30);
  return {
    profile: {
      plan: plan.id,
      is_solvent: kind !== 'overdue',
      plan_period_start: renewDateToIso(renew, tz),
    },
    currentPeriod: renewDateToIso(renew, tz),
    previousPeriod: renewDateToIso(previous, tz),
    paidDaysAgo: Math.max(1, -offset + 30 + randomInt(rand, 0, 2)),
  };
}

async function rollback(client: SupabaseClient, tenantId: string | undefined, userIds: string[]) {
  if (userIds.length) await removeMemberFiles(client, userIds);
  if (tenantId) {
    const { data: tenant } = await client
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .eq('is_demo', true)
      .maybeSingle();
    if (tenant) {
      const { error } = await client.rpc('hq_delete_tenant', { p_tenant_id: tenantId });
      if (error) console.error('demo rollback tenant', error.message);
    }
  }
  // Users whose profile never got linked to the tenant are not removed by hq_delete_tenant.
  for (const id of userIds) {
    await client.auth.admin.deleteUser(id).catch(() => undefined);
  }
}

/**
 * Creates a full demo tenant from a parsed block. Any error rolls back everything
 * (tenant, users, storage). Passwords are returned once and never stored.
 */
export async function createDemoTenant(
  input: DemoInput,
  opts: { client?: SupabaseClient; now?: Date; label?: string } = {}
): Promise<DemoCreateResult> {
  const client = opts.client ?? supabaseAdmin;
  const now = opts.now ?? new Date();
  const warnings: DemoMsg[] = [];
  const createdUserIds: string[] = [];
  let tenantId: string | undefined;

  const today = getGymDate(now, input.tz);
  const expiresAt = endOfGymDay(input.expiresOn, input.tz).toISOString();
  const label = opts.label?.trim() || (input.source ? `${input.name} (${input.source})` : input.name);

  try {
    const slug = await pickSlug(input.name, client);
    const rand = seededRandom(slug);

    const demoSettings: DemoSettings = {
      sessions: input.sessions,
      plans: input.plans,
      defaultCapacity: input.defaultCapacity,
      plansInvented: input.plansInvented,
      createdAt: now.toISOString(),
    };

    const { tenant } = await provisionTenant(
      {
        slug,
        name: input.name,
        platform_plan: 'trial',
        signup_source: 'hq',
        allowReserved: true,
        demo: { expiresAt, label: label.slice(0, 200), source: input.source },
      },
      client
    );
    tenantId = tenant.id;

    const { error: settingsError } = await client
      .from('tenants')
      .update({ settings: demoTenantSettings(input, demoSettings) })
      .eq('id', tenant.id)
      .eq('is_demo', true);
    if (settingsError) throw settingsError;

    // Plans: replace the seeded "Unlimited $80".
    await client.from('membership_plans').delete().eq('tenant_id', tenant.id);
    const plans: MembershipPlan[] = [];
    for (const plan of input.plans) {
      plans.push(await membershipPlanService.createMembershipPlan(client, tenant.id, planRow(plan)));
    }

    // Class types: one per class name, replacing the CrossFit seeds.
    const { error: ctDeleteError } = await client.from('class_types').delete().eq('tenant_id', tenant.id);
    if (ctDeleteError) throw ctDeleteError;
    const classNames: { name: string; minutes: number }[] = [];
    for (const session of input.sessions) {
      if (!classNames.some((c) => c.name.toLowerCase() === session.className.toLowerCase())) {
        classNames.push({ name: session.className, minutes: session.minutes });
      }
    }
    const { error: ctError } = await client.from('class_types').insert(
      classNames.map((c, i) => ({
        tenant_id: tenant.id,
        name: c.name,
        color_hex: CLASS_TYPE_COLORS[i % CLASS_TYPE_COLORS.length],
        default_duration_min: c.minutes,
        is_open_box: false,
        sort_order: i,
        is_active: true,
      }))
    );
    if (ctError) throw ctError;

    // Payment methods with obviously fake data.
    const { data: methods, error: methodsError } = await client
      .from('payment_methods')
      .insert([
        {
          tenant_id: tenant.id,
          label: 'Pago Móvil',
          currency: DEFAULT_TENANT_CURRENCIES.local,
          method_type: 'pago_movil',
          fields: { banco: 'Banco de Venezuela', telefono: '0412-0000000', cedula: 'J-00000000-0' },
          details: null,
          is_active: true,
        },
        {
          tenant_id: tenant.id,
          label: 'Zelle',
          currency: DEFAULT_TENANT_CURRENCIES.reference,
          method_type: 'zelle',
          fields: { correo: 'pagos@demo.invalid', nombre_completo: input.name },
          details: null,
          is_active: true,
        },
      ])
      .select('id, method_type');
    if (methodsError) throw methodsError;
    const pagoMovilId = methods?.find((m) => m.method_type === 'pago_movil')?.id ?? null;
    const zelleId = methods?.find((m) => m.method_type === 'zelle')?.id ?? null;

    const nowIso = now.toISOString();

    // Staff users.
    const admin = { email: demoEmail('admin', slug), password: randomPassword() };
    const adminId = await createDemoUser(
      client,
      { ...admin, fullName: `Admin ${input.name}`, tenantId: tenant.id },
      createdUserIds
    );
    await updateProfile(client, adminId, { full_name: `Admin ${input.name}`, role: 'admin', is_solvent: true, tenant_id: tenant.id });
    await client.from('tenants').update({ owner_user_id: adminId }).eq('id', tenant.id);

    const coachIds = new Map<string, string>();
    const coachNames = [...new Set(input.sessions.map((s) => s.coach).filter(Boolean) as string[])];
    for (const [i, coachName] of coachNames.entries()) {
      const id = await createDemoUser(
        client,
        { email: demoEmail(`coach-${i + 1}`, slug), password: randomPassword(), fullName: coachName, tenantId: tenant.id },
        createdUserIds
      );
      await updateProfile(client, id, { full_name: coachName, role: 'coach', is_solvent: true, tenant_id: tenant.id });
      coachIds.set(coachName.toLowerCase(), id);
    }

    // Test member for recording the app: active, on the least restrictive plan.
    const mainPlan =
      plans.find((p) => p.limit_type === 'none') ?? plans.find((p) => p.limit_type === 'weekly') ?? plans[0] ?? null;
    const member = { email: demoEmail('socio', slug), password: randomPassword() };
    const testMemberName = 'Socio Demo';
    const testMemberId = await createDemoUser(
      client,
      { ...member, fullName: testMemberName, tenantId: tenant.id },
      createdUserIds
    );

    // Fictional members.
    const names = fictionalNames(slug, DEMO_MEMBER_COUNT);
    const kinds: MemberKind[] = shuffle(
      names.map((_, i): MemberKind =>
        i < DEMO_PENDING_COUNT
          ? 'pending'
          : i < DEMO_PENDING_COUNT + DEMO_OVERDUE_COUNT
            ? 'overdue'
            : i < DEMO_PENDING_COUNT + DEMO_OVERDUE_COUNT + DEMO_NO_PLAN_COUNT
              ? 'no_plan'
              : 'ok'
      ),
      rand
    );

    type SeededMember = { id: string; kind: MemberKind; plan: MembershipPlan | null } & ReturnType<typeof membershipFields>;
    const members: SeededMember[] = [];
    const ctx = { today, tz: input.tz, now, rand };

    const testFields = membershipFields('ok', mainPlan, ctx);
    await updateProfile(client, testMemberId, {
      full_name: testMemberName,
      role: 'member',
      tenant_id: tenant.id,
      inscription_plan: 'standard',
      inscription_paid: true,
      inscription_cost: 0,
      ...affidavitFields(nowIso),
      ...testFields.profile,
    });
    members.push({ id: testMemberId, kind: 'ok', plan: mainPlan, ...testFields });

    for (let i = 0; i < names.length; i += 6) {
      const batch = names.slice(i, i + 6);
      const created = await Promise.all(
        batch.map(async (fullName, j) => {
          const index = i + j;
          const kind = kinds[index];
          // Pending proofs use the main plan so the receipt amount matches one price.
          const plan = kind === 'no_plan' ? null : kind === 'pending' ? mainPlan : plans[index % plans.length] ?? null;
          const id = await createDemoUser(
            client,
            { email: demoEmail(`m${index + 1}`, slug), password: randomPassword(), fullName, tenantId: tenant.id },
            createdUserIds
          );
          const fields = membershipFields(kind, plan, ctx);
          await updateProfile(client, id, {
            full_name: fullName,
            role: 'member',
            tenant_id: tenant.id,
            inscription_plan: 'standard',
            inscription_paid: kind !== 'no_plan',
            inscription_cost: 0,
            ...affidavitFields(nowIso),
            ...fields.profile,
          });
          return { id, kind, plan, ...fields };
        })
      );
      members.push(...created);
    }

    // Classes: Monday of this week (gym-local) → min(expiry, today + 21 days).
    const lastDay = [input.expiresOn, addDaysToDateStr(today, DEMO_SCHEDULE_DAYS_AHEAD)].sort()[0];
    const classRows = expandSessions({
      tenantId: tenant.id,
      sessions: input.sessions,
      tz: input.tz,
      fromDate: mondayOf(today),
      toDate: lastDay,
      coachIds,
    });
    const classes = (await insertInBatches(
      client,
      'classes',
      classRows,
      'id, start_time, max_capacity'
    )) as unknown as SeededClass[];

    // Bookings: solvent members only (the test member keeps room to book on camera).
    const bookingPool = members
      .filter((m) => m.kind === 'ok' || m.kind === 'pending')
      .filter((m) => m.id !== testMemberId)
      .map((m) => m.id);
    const bookings = await seedBookings({ client, tenantId: tenant.id, classes, memberIds: bookingPool, rand, now });

    // Payments.
    const paymentRows: Record<string, unknown>[] = [];
    const receiptOwners: string[] = [];
    let approved = 0;
    let pending = 0;
    for (const m of members) {
      if (!m.plan) continue;
      const price = Number(m.plan.price_usd) || 0;
      paymentRows.push({
        tenant_id: tenant.id,
        user_id: m.id,
        amount: price,
        currency: DEFAULT_TENANT_CURRENCIES.reference,
        method: 'Zelle',
        payment_method_id: zelleId,
        status: 'approved',
        proof_image_url: `${m.id}/${DEMO_RECEIPT_FILE}`,
        reference_currency_amount: price,
        plan_period_start: m.plan.limit_type === 'period' ? null : m.previousPeriod,
        created_at: new Date(now.getTime() - m.paidDaysAgo * DAY_MS).toISOString(),
      });
      approved += 1;
      receiptOwners.push(m.id);
      if (m.kind === 'pending') {
        paymentRows.push({
          tenant_id: tenant.id,
          user_id: m.id,
          amount: DEMO_RECEIPT_VES,
          currency: DEFAULT_TENANT_CURRENCIES.local,
          method: 'Pago Móvil',
          payment_method_id: pagoMovilId,
          status: 'pending',
          proof_image_url: `${m.id}/${DEMO_RECEIPT_FILE}`,
          exchange_rate_at_time: price > 0 ? Math.round((DEMO_RECEIPT_VES / price) * 100) / 100 : null,
          exchange_rate_source: 'custom',
          reference_currency_amount: price,
          plan_period_start: m.currentPeriod,
          created_at: new Date(now.getTime() - randomInt(rand, 1, 30) * 60 * 60 * 1000).toISOString(),
        });
        pending += 1;
      }
    }
    await uploadReceipts(client, receiptOwners);
    await insertInBatches(client, 'payments', paymentRows);

    if (input.plansInvented) {
      warnings.push({ code: 'invented_plan', text: 'Precio inventado: no lo muestres en el video.' });
    }

    return {
      tenantId: tenant.id,
      slug,
      url: buildTenantDashboardUrl(slug),
      expiresAt,
      admin,
      member,
      counts: {
        classes: classes.length,
        bookings,
        members: members.length,
        coaches: coachIds.size,
        payments: { approved, pending },
      },
      warnings,
    };
  } catch (error) {
    await rollback(client, tenantId, createdUserIds);
    throw error;
  }
}
