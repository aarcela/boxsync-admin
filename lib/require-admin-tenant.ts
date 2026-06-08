import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const ADMIN_ONLY = 'Only admins can manage this resource.';

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

  return profile.tenant_id as string;
}
