import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  digitsOnly,
  isPlausibleE164,
  normalizeToE164,
} from '@/lib/phone';

export type SyncAuthPhoneResult =
  | { ok: true; e164: string | null }
  | { ok: false; error: 'invalid' | 'taken' | 'auth_update_failed'; message?: string };

/**
 * Keep profiles.phone and auth.users.phone in sync (E.164).
 * Clears auth phone when empty. phone_confirm true so no SMS is required.
 */
export async function syncAuthPhone(
  userId: string,
  rawPhone: string | null | undefined
): Promise<SyncAuthPhoneResult> {
  const trimmed = typeof rawPhone === 'string' ? rawPhone.trim() : '';
  if (!trimmed) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      phone: '',
    });
    if (error) {
      console.warn('Clear auth phone failed:', error.message);
    }
    return { ok: true, e164: null };
  }

  const e164 = normalizeToE164(trimmed);
  if (!e164 || !isPlausibleE164(e164)) {
    return { ok: false, error: 'invalid' };
  }

  const taken = await findUserIdByPhone(e164, userId);
  if (taken) {
    return { ok: false, error: 'taken' };
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    phone: e164,
    phone_confirm: true,
  });

  if (error) {
    // Phone provider may be off — profile still stores E.164 for HQ login.
    console.warn('syncAuthPhone auth update:', error.message);
    return {
      ok: false,
      error: 'auth_update_failed',
      message: error.message,
    };
  }

  return { ok: true, e164 };
}

/** Find another auth/profile user already using this E.164. */
export async function findUserIdByPhone(
  e164: string,
  excludeUserId?: string
): Promise<string | null> {
  const digits = digitsOnly(e164);

  const { data: byProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, phone')
    .neq('id', excludeUserId ?? '00000000-0000-0000-0000-000000000000');

  if (profileError) throw profileError;

  for (const row of byProfile ?? []) {
    if (!row.phone) continue;
    const normalized = normalizeToE164(row.phone);
    if (normalized && digitsOnly(normalized) === digits) {
      return row.id as string;
    }
  }

  // Also scan auth.users.phone (small tenant count today).
  let page = 1;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const user of users) {
      if (excludeUserId && user.id === excludeUserId) continue;
      if (!user.phone) continue;
      if (digitsOnly(user.phone) === digits) return user.id;
    }
    if (users.length < 200) break;
    page += 1;
    if (page > 50) break;
  }

  return null;
}

/**
 * Resolve profile id for phone login. Exact E.164 on profiles first,
 * then digit match against normalized forms.
 */
export async function findProfileIdByLoginPhone(
  rawPhone: string
): Promise<string | null> {
  const e164 = normalizeToE164(rawPhone);
  if (!e164 || !isPlausibleE164(e164)) return null;
  const digits = digitsOnly(e164);

  const { data: exact } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('phone', e164)
    .limit(2);

  if (exact && exact.length === 1) return exact[0]!.id as string;
  if (exact && exact.length > 1) return null; // ambiguous

  const { data: rows, error } = await supabaseAdmin
    .from('profiles')
    .select('id, phone')
    .not('phone', 'is', null);

  if (error) throw error;

  const matches: string[] = [];
  for (const row of rows ?? []) {
    const normalized = normalizeToE164(String(row.phone));
    if (normalized && digitsOnly(normalized) === digits) {
      matches.push(row.id as string);
    }
  }

  if (matches.length === 1) return matches[0]!;
  return null;
}
