import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

export type ProductEventName =
  | 'signup_viewed'
  | 'signup_submitted'
  | 'signup_failed'
  | 'signup_created'
  | 'email_verified'
  | 'setup_step_completed'
  | 'setup_step_skipped'
  | 'setup_completed'
  | 'help_whatsapp_clicked'
  | 'tenant_activated'
  | 'trial_banner_shown'
  | 'trial_expired'
  | 'trial_extended'
  | 'tenant_inactive_flagged';

export async function trackProductEvent(
  name: ProductEventName,
  props: Record<string, unknown> = {},
  opts?: { tenantId?: string | null; userId?: string | null; client?: SupabaseClient }
): Promise<void> {
  const client = opts?.client ?? supabaseAdmin;
  const { error } = await client.from('product_events').insert({
    name,
    props,
    tenant_id: opts?.tenantId ?? null,
    user_id: opts?.userId ?? null,
  });
  if (error) {
    console.error('trackProductEvent failed', name, error.message);
  }
}
