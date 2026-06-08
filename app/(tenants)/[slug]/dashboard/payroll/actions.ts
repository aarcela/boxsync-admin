'use server';

import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { payrollService } from '@/lib/services/payrollService';
import { PayrollClassStatus } from '@/lib/types/gym';

const ADMIN_ONLY = 'Only admins can manage payroll.';

async function requireAdminTenant() {
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

  return { supabase, tenantId: profile.tenant_id as string };
}

const VALID_STATUSES: PayrollClassStatus[] = ['confirmed', 'pending', 'cancelled'];

export async function updateClassPayrollStatusAction(
  classId: string,
  status: PayrollClassStatus
) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error('Invalid payroll status');
  }

  const { supabase } = await requireAdminTenant();
  await payrollService.updatePayrollStatus(supabase, classId, status);
  revalidatePath('/dashboard/payroll');
}

export async function bulkUpdateClassPayrollStatusAction(
  classIds: string[],
  status: PayrollClassStatus
) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error('Invalid payroll status');
  }
  if (!classIds.length) {
    throw new Error('No classes selected');
  }

  const { supabase } = await requireAdminTenant();
  await Promise.all(
    classIds.map((id) => payrollService.updatePayrollStatus(supabase, id, status))
  );
  revalidatePath('/dashboard/payroll');
}
