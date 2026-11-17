import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { removeMemberFiles } from './seed';

/** Demos are purged this many days after demo_expires_at. */
export const DEMO_PURGE_AFTER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Deactivates demos past their expiry (staff signed out, app blocked). */
export async function deactivateExpiredDemos(
  opts: { client?: SupabaseClient; now?: Date } = {}
): Promise<string[]> {
  const client = opts.client ?? supabaseAdmin;
  const nowIso = (opts.now ?? new Date()).toISOString();
  const { data, error } = await client
    .from('tenants')
    .update({ is_active: false, deactivated_at: nowIso, deactivation_reason: 'demo_expired' })
    .eq('is_demo', true)
    .eq('is_active', true)
    .lt('demo_expires_at', nowIso)
    .select('slug');
  if (error) throw error;
  return (data ?? []).map((row) => row.slug as string);
}

/**
 * Deletes a demo completely: payment-proof files, then tenant + users via hq_delete_tenant.
 * Refuses (returns null) unless the tenant has is_demo = true.
 */
export async function purgeDemo(
  tenantId: string,
  opts: { client?: SupabaseClient } = {}
): Promise<{ slug: string; files: number } | null> {
  const client = opts.client ?? supabaseAdmin;
  const { data: tenant, error } = await client
    .from('tenants')
    .select('id, slug')
    .eq('id', tenantId)
    .eq('is_demo', true)
    .maybeSingle();
  if (error) throw error;
  if (!tenant) return null;

  const { data: profiles, error: profilesError } = await client
    .from('profiles')
    .select('id')
    .eq('tenant_id', tenantId);
  if (profilesError) throw profilesError;
  const files = await removeMemberFiles(client, (profiles ?? []).map((p) => p.id as string));

  // Re-check right before the delete: never call hq_delete_tenant on a real tenant.
  const { data: still } = await client
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .eq('is_demo', true)
    .maybeSingle();
  if (!still) return null;

  const { error: deleteError } = await client.rpc('hq_delete_tenant', { p_tenant_id: tenantId });
  if (deleteError) throw deleteError;
  return { slug: tenant.slug as string, files };
}

/** Purges demos that expired at least DEMO_PURGE_AFTER_DAYS ago. */
export async function purgeExpiredDemos(
  opts: { client?: SupabaseClient; now?: Date } = {}
): Promise<string[]> {
  const client = opts.client ?? supabaseAdmin;
  const cutoff = new Date((opts.now ?? new Date()).getTime() - DEMO_PURGE_AFTER_DAYS * DAY_MS).toISOString();
  const { data, error } = await client
    .from('tenants')
    .select('id')
    .eq('is_demo', true)
    .lt('demo_expires_at', cutoff);
  if (error) throw error;
  const purged: string[] = [];
  for (const row of data ?? []) {
    try {
      const result = await purgeDemo(row.id as string, { client });
      if (result) purged.push(result.slug);
    } catch (err) {
      console.error('demo purge failed', row.id, err instanceof Error ? err.message : err);
    }
  }
  return purged;
}
