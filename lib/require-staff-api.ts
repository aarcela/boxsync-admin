import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isStaffRole } from './auth';
import { isTrialExpired, parsePlatformPlanId } from './platform-plans';

export async function requireStaffApi(opts?: { write?: boolean }) {
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

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();

  if (profileError || !isStaffRole(profile?.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  if (opts?.write && profile.tenant_id) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('platform_plan, trial_ends_at')
      .eq('id', profile.tenant_id)
      .maybeSingle();
    if (
      tenant &&
      isTrialExpired(parsePlatformPlanId(tenant.platform_plan), tenant.trial_ends_at)
    ) {
      return {
        error: NextResponse.json({ error: 'trial_readonly' }, { status: 403 }),
      };
    }
  }

  return { supabase, user, profile };
}
