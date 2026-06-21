import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireStaffApi } from '@/lib/require-staff-api';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { Profile } from '@/lib/types/gym';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type SortKey = 'full_name' | 'is_solvent' | 'created_at' | 'plan' | 'last_payment_date';
type SortDir = 'asc' | 'desc';

const DB_SORT_COLUMNS: Record<Exclude<SortKey, 'last_payment_date'>, string> = {
  full_name: 'full_name',
  is_solvent: 'is_solvent',
  created_at: 'created_at',
  plan: 'plan',
};

function parseSortKey(value: string | null): SortKey {
  if (value === 'is_solvent' || value === 'created_at' || value === 'plan' || value === 'last_payment_date') {
    return value;
  }
  return 'full_name';
}

function parseSortDir(value: string | null): SortDir {
  return value === 'desc' ? 'desc' : 'asc';
}

async function getLastPaymentDates(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};

  const { data, error } = await supabase
    .from('payments')
    .select('user_id, created_at')
    .in('user_id', userIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const lastPayments: Record<string, string> = {};
  data?.forEach((p) => {
    if (!lastPayments[p.user_id]) {
      lastPayments[p.user_id] = p.created_at;
    }
  });
  return lastPayments;
}

async function enrichWithEmails(ids: string[]) {
  const emails: Record<string, string> = {};
  const invitePending: Record<string, boolean> = {};

  await Promise.all(
    ids.map(async (id) => {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
      if (error) {
        console.error(`Failed to load email for profile ${id}:`, error);
        return;
      }
      if (data.user?.email) {
        emails[id] = data.user.email;
      }
      invitePending[id] = !data.user?.email_confirmed_at;
    })
  );

  return { emails, invitePending };
}

/** Shallow filter surface — documents the methods this helper uses on Supabase builders. */
type ProfileFilterQuery = {
  eq(col: string, val: unknown): ProfileFilterQuery;
  ilike(col: string, val: string): ProfileFilterQuery;
};

function applyProfileFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  { tenantId, search, role }: { tenantId: string | null; search: string; role: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  let filtered: ProfileFilterQuery = query;

  if (tenantId) {
    filtered = filtered.eq('tenant_id', tenantId);
  }

  if (role !== 'all') {
    filtered = filtered.eq('role', role);
  }

  if (search) {
    filtered = filtered.ilike('full_name', `%${search}%`);
  }

  return filtered;
}

export async function GET(request: NextRequest) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
    );
    const search = (searchParams.get('search') ?? '').trim();
    const role = searchParams.get('role') ?? 'all';
    const sortKey = parseSortKey(searchParams.get('sortKey'));
    const sortDir = parseSortDir(searchParams.get('sortDir'));
    const tenantId = (staffAuth.profile.tenant_id as string | null) ?? null;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { count: unpaidCount, error: unpaidError } = await applyProfileFilters(
      staffAuth.supabase.from('profiles').select('id', { count: 'exact', head: true }),
      { tenantId, search: '', role: 'member' }
    ).eq('is_solvent', false);

    if (unpaidError) throw unpaidError;

    let profiles: Profile[] = [];
    let totalCount = 0;

    if (sortKey === 'last_payment_date') {
      const { data: idRows, error: idError, count } = await applyProfileFilters(
        staffAuth.supabase.from('profiles').select('id', { count: 'exact' }),
        { tenantId, search, role }
      );

      if (idError) throw idError;

      totalCount = count ?? 0;
      const allIds = (idRows ?? []).map((r: { id: string }) => r.id);
      const lastPaymentDates = await getLastPaymentDates(staffAuth.supabase, allIds);

      const sortedIds = [...allIds].sort((a, b) => {
        const aTime = new Date(lastPaymentDates[a] ?? 0).getTime();
        const bTime = new Date(lastPaymentDates[b] ?? 0).getTime();
        return sortDir === 'asc' ? aTime - bTime : bTime - aTime;
      });

      const pageIds = sortedIds.slice(from, to + 1);

      if (pageIds.length > 0) {
        const { data, error } = await staffAuth.supabase
          .from('profiles')
          .select('*, bookings!left(status, created_at)')
          .in('id', pageIds);

        if (error) throw error;

        const byId = new Map((data as Profile[]).map((p) => [p.id, p]));
        profiles = pageIds
          .map((id) => byId.get(id))
          .filter((p): p is Profile => Boolean(p))
          .map((p) => ({ ...p, last_payment_date: lastPaymentDates[p.id] }));
      }
    } else {
      const sortColumn = DB_SORT_COLUMNS[sortKey];
      const { data, error, count } = await applyProfileFilters(
        staffAuth.supabase
          .from('profiles')
          .select('*, bookings!left(status, created_at)', { count: 'exact' }),
        { tenantId, search, role }
      )
        .order(sortColumn, { ascending: sortDir === 'asc' })
        .range(from, to);

      if (error) throw error;

      totalCount = count ?? 0;
      const pageIds = (data ?? []).map((p: { id: string }) => p.id);
      const lastPaymentDates = await getLastPaymentDates(staffAuth.supabase, pageIds);

      profiles = (data as Profile[]).map((p) => ({
        ...p,
        last_payment_date: lastPaymentDates[p.id],
      }));
    }

    const { emails, invitePending } = await enrichWithEmails(profiles.map((p) => p.id));

    const enrichedProfiles = profiles.map((p) => ({
      ...p,
      email: emails[p.id] ?? '',
      invite_pending: invitePending[p.id] ?? false,
    }));

    return NextResponse.json({
      profiles: enrichedProfiles,
      totalCount,
      unpaidCount: unpaidCount ?? 0,
      page,
      pageSize,
    });
  } catch (error: unknown) {
    console.error('List profiles error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
