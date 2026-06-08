import type { SupabaseClient } from '@supabase/supabase-js';

type TenantScopedTable = 'payment_methods' | 'membership_plans';

export async function ensureRowTenantId<T extends { id: string; tenant_id?: string | null }>(
  client: SupabaseClient,
  table: TenantScopedTable,
  row: T,
  tenantId: string
): Promise<T> {
  if (row.tenant_id) return row;

  const { data, error } = await client
    .from(table)
    .update({ tenant_id: tenantId })
    .eq('id', row.id)
    .select('*')
    .single();

  if (error) {
    throw new Error(
      `${table}.tenant_id could not be set: ${error.message}. Run FIX_TENANT_ID_COLUMNS.sql in Supabase.`
    );
  }

  if (!data?.tenant_id) {
    throw new Error(
      `${table}.tenant_id column is missing or not exposed by the API. Run FIX_TENANT_ID_COLUMNS.sql in Supabase.`
    );
  }

  return data as T;
}
