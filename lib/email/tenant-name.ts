import { supabaseAdmin } from '@/lib/supabase-admin';

export async function getTenantDisplayName(tenantId: string | null | undefined): Promise<string | null> {
  if (!tenantId) return null;
  const { data } = await supabaseAdmin
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .maybeSingle();
  const name = typeof data?.name === 'string' ? data.name.trim() : '';
  return name || null;
}
