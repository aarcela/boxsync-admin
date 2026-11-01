import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { isTrialExpired, parsePlatformPlanId } from '@/lib/platform-plans';

const ADMIN_ONLY = 'Only admins can manage this resource.';
const TRIAL_READONLY = 'trial_readonly';

/** Validates cookie session: caller is admin with tenant_id. */
export async function requireAdminTenantId(): Promise<string> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Route handlers may run without mutable cookies
          }
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    throw new Error(ADMIN_ONLY);
  }

  if (!profile.tenant_id) {
    throw new Error('Missing tenant context.');
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('platform_plan, trial_ends_at')
    .eq('id', profile.tenant_id)
    .maybeSingle();
  if (
    tenant &&
    isTrialExpired(parsePlatformPlanId(tenant.platform_plan), tenant.trial_ends_at)
  ) {
    throw new Error(TRIAL_READONLY);
  }

  return profile.tenant_id as string;
}
