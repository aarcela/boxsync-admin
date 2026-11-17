import type { SupabaseClient } from '@supabase/supabase-js';
import { parseGymTimezone } from '@/lib/gym-timezone';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { addDaysToDateStr, getGymDate, getGymDateFromIso } from '@/lib/utils/date';
import { seededRandom } from './names';
import {
  DEMO_SCHEDULE_DAYS_AHEAD,
  type DemoSettings,
  type SeededClass,
  expandSessions,
  insertInBatches,
  seedBookings,
} from './seed';

export class DemoNotFoundError extends Error {
  constructor() {
    super('not_found');
  }
}

function readDemoSettings(settings: unknown): DemoSettings | null {
  const demo = (settings as { demo?: DemoSettings } | null)?.demo;
  return demo && Array.isArray(demo.sessions) ? demo : null;
}

/**
 * "Rehacer semana": deletes the demo's future classes (and their bookings/waitlist) and
 * regenerates them from now with the same sessions. Only for is_demo tenants.
 */
export async function rollWeek(
  tenantId: string,
  opts: { client?: SupabaseClient; now?: Date } = {}
): Promise<{ deleted: number; created: number; bookings: number }> {
  const client = opts.client ?? supabaseAdmin;
  const now = opts.now ?? new Date();

  const { data: tenant, error } = await client
    .from('tenants')
    .select('id, slug, settings, demo_expires_at')
    .eq('id', tenantId)
    .eq('is_demo', true)
    .maybeSingle();
  if (error) throw error;
  if (!tenant) throw new DemoNotFoundError();
  const demo = readDemoSettings(tenant.settings);
  if (!demo) throw new Error('This demo has no stored schedule.');

  const tz = parseGymTimezone(tenant.settings);
  const nowIso = now.toISOString();

  const { data: futureClasses, error: futureError } = await client
    .from('classes')
    .select('id')
    .eq('tenant_id', tenantId)
    .gt('start_time', nowIso);
  if (futureError) throw futureError;
  const futureIds = (futureClasses ?? []).map((c) => c.id as string);

  for (let i = 0; i < futureIds.length; i += 200) {
    const chunk = futureIds.slice(i, i + 200);
    for (const table of ['coach_feedback', 'class_waitlist', 'guest_bookings', 'bookings']) {
      const { error: delError } = await client.from(table).delete().eq('tenant_id', tenantId).in('class_id', chunk);
      if (delError) throw delError;
    }
    const { error: classError } = await client.from('classes').delete().eq('tenant_id', tenantId).in('id', chunk);
    if (classError) throw classError;
  }

  const { data: staff, error: staffError } = await client
    .from('profiles')
    .select('id, full_name, role, is_solvent, email')
    .eq('tenant_id', tenantId);
  if (staffError) throw staffError;
  const coachIds = new Map<string, string>();
  const pool: string[] = [];
  for (const p of staff ?? []) {
    if (p.role === 'coach' && p.full_name) coachIds.set(String(p.full_name).toLowerCase(), p.id);
    if (p.role === 'member' && p.is_solvent && !String(p.email ?? '').startsWith('socio@')) pool.push(p.id);
  }

  const today = getGymDate(now, tz);
  const expiresOn = tenant.demo_expires_at
    ? getGymDateFromIso(new Date(new Date(tenant.demo_expires_at).getTime() - 1000).toISOString(), tz)
    : addDaysToDateStr(today, DEMO_SCHEDULE_DAYS_AHEAD);
  const lastDay = [expiresOn, addDaysToDateStr(today, DEMO_SCHEDULE_DAYS_AHEAD)].sort()[0];

  const rows = expandSessions({
    tenantId,
    sessions: demo.sessions,
    tz,
    fromDate: today,
    toDate: lastDay,
    coachIds,
    notBefore: now,
  });
  const classes = (await insertInBatches(client, 'classes', rows, 'id, start_time, max_capacity')) as unknown as SeededClass[];
  const bookings = await seedBookings({
    client,
    tenantId,
    classes,
    memberIds: pool,
    rand: seededRandom(`${tenant.slug}:${nowIso}`),
    now,
  });

  return { deleted: futureIds.length, created: classes.length, bookings };
}
