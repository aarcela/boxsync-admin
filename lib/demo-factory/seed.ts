import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addDaysToDateStr, gymDateTimeToUtc } from '@/lib/utils/date';
import { randomInt, shuffle } from './names';
import type { DemoPlanInput, DemoSession } from './parse';
import { DEMO_RECEIPT_JPEG_BASE64 } from './receipt-image';

export const PAYMENT_PROOFS_BUCKET = 'payment-proofs';
export const DEMO_RECEIPT_FILE = 'demo-receipt.jpg';
/** Classes are generated at most this many days ahead of today. */
export const DEMO_SCHEDULE_DAYS_AHEAD = 21;

/** Stored in tenants.settings.demo so "Rehacer semana" can regenerate the schedule. */
export type DemoSettings = {
  sessions: DemoSession[];
  plans: DemoPlanInput[];
  defaultCapacity: number;
  plansInvented: boolean;
  createdAt: string;
};

export type SeededClass = { id: string; start_time: string; max_capacity: number };

/** Email domain for demo users; nothing is ever sent (email_confirm: true). */
export function demoEmail(local: string, slug: string): string {
  const domain = process.env.DEMO_EMAIL_DOMAIN?.trim() || 'demo.getwodus.com';
  return `${local}@${slug}.${domain}`;
}

const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomPassword(length = 12): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  return out;
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a YYYY-MM-DD string. */
export function isoWeekday(dateStr: string): number {
  const day = new Date(`${dateStr.slice(0, 10)}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function mondayOf(dateStr: string): string {
  return addDaysToDateStr(dateStr, -(isoWeekday(dateStr) - 1));
}

/** Gym-local end of `dateStr` (= start of the next day) as an instant. */
export function endOfGymDay(dateStr: string, tz: string): Date {
  return gymDateTimeToUtc(addDaysToDateStr(dateStr, 1), '00:00', tz);
}

/** Expands weekly sessions into class rows for every day in [fromDate, toDate]. */
export function expandSessions(params: {
  tenantId: string;
  sessions: DemoSession[];
  tz: string;
  fromDate: string;
  toDate: string;
  coachIds: Map<string, string>;
  notBefore?: Date;
}) {
  const rows: {
    tenant_id: string;
    start_time: string;
    end_time: string;
    coach_id: string | null;
    class_type: string;
    max_capacity: number;
  }[] = [];
  for (let date = params.fromDate; date <= params.toDate; date = addDaysToDateStr(date, 1)) {
    const weekday = isoWeekday(date);
    for (const session of params.sessions) {
      if (!session.days.includes(weekday)) continue;
      const start = gymDateTimeToUtc(date, session.time, params.tz);
      if (params.notBefore && start <= params.notBefore) continue;
      rows.push({
        tenant_id: params.tenantId,
        start_time: start.toISOString(),
        end_time: new Date(start.getTime() + session.minutes * 60000).toISOString(),
        coach_id: session.coach ? params.coachIds.get(session.coach.toLowerCase()) ?? null : null,
        class_type: session.className,
        max_capacity: session.capacity,
      });
    }
  }
  return rows;
}

export async function insertInBatches<T extends object>(
  client: SupabaseClient,
  table: string,
  rows: T[],
  select?: string,
  batchSize = 200
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    if (select) {
      const { data, error } = await client.from(table).insert(chunk).select(select);
      if (error) throw error;
      out.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    } else {
      const { error } = await client.from(table).insert(chunk);
      if (error) throw error;
    }
  }
  return out;
}

/**
 * Past classes: 50–80 % attended (some no-shows). Future classes: 40–85 % booked, about
 * one in eight full. One booking per member per class. Direct service-role insert: the
 * capacity / booking-window checks live in the book_class RPC, not in triggers.
 */
export async function seedBookings(params: {
  client: SupabaseClient;
  tenantId: string;
  classes: SeededClass[];
  memberIds: string[];
  rand: () => number;
  now: Date;
}): Promise<number> {
  const { client, tenantId, classes, memberIds, rand, now } = params;
  if (!memberIds.length) return 0;
  const rows: { tenant_id: string; class_id: string; user_id: string; status: string }[] = [];
  for (const cls of classes) {
    const past = new Date(cls.start_time) <= now;
    const cap = Math.min(cls.max_capacity, memberIds.length);
    let ratio: number;
    if (past) ratio = 0.5 + rand() * 0.3;
    else ratio = rand() < 0.125 ? 1 : 0.4 + rand() * 0.45;
    const count = Math.max(1, Math.min(cap, Math.round(cls.max_capacity * ratio)));
    for (const userId of shuffle(memberIds, rand).slice(0, count)) {
      rows.push({
        tenant_id: tenantId,
        class_id: cls.id,
        user_id: userId,
        status: past ? (rand() < 0.1 ? 'no_show' : 'attended') : 'booked',
      });
    }
  }
  await insertInBatches(client, 'bookings', rows, undefined, 500);
  return rows.length;
}

function receiptBytes(): Uint8Array {
  return Uint8Array.from(Buffer.from(DEMO_RECEIPT_JPEG_BASE64, 'base64'));
}

/** Storage policy needs the first folder to be the member id, so each member gets a copy. */
export async function uploadReceipts(client: SupabaseClient, userIds: string[]): Promise<void> {
  const bytes = receiptBytes();
  for (let i = 0; i < userIds.length; i += 5) {
    await Promise.all(
      userIds.slice(i, i + 5).map(async (userId) => {
        const { error } = await client.storage
          .from(PAYMENT_PROOFS_BUCKET)
          .upload(`${userId}/${DEMO_RECEIPT_FILE}`, bytes, {
            contentType: 'image/jpeg',
            upsert: true,
          });
        if (error) throw error;
      })
    );
  }
}

/** Removes every file under payment-proofs/<user id>/ (seeded receipts and any uploaded while recording). */
export async function removeMemberFiles(client: SupabaseClient, userIds: string[]): Promise<number> {
  let removed = 0;
  for (const userId of userIds) {
    const { data, error } = await client.storage
      .from(PAYMENT_PROOFS_BUCKET)
      .list(userId, { limit: 1000 });
    if (error) {
      console.error('demo removeMemberFiles list', userId, error.message);
      continue;
    }
    const paths = (data ?? []).map((file) => `${userId}/${file.name}`);
    if (!paths.length) continue;
    const { error: removeError } = await client.storage.from(PAYMENT_PROOFS_BUCKET).remove(paths);
    if (removeError) console.error('demo removeMemberFiles remove', userId, removeError.message);
    else removed += paths.length;
  }
  return removed;
}

export function pickWeighted<T>(items: T[], rand: () => number): T {
  return items[randomInt(rand, 0, items.length - 1)];
}
