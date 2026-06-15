import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isStaffRole, MIN_RESET_PASSWORD_LENGTH } from '@/lib/auth';
import { tenantService } from '@/lib/services/tenantService';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const password = typeof body.password === 'string' ? body.password : '';

    if (password.length < MIN_RESET_PASSWORD_LENGTH) {
      return NextResponse.json({ error: 'password_too_short' }, { status: 400 });
    }

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
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'session_missing' }, { status: 401 });
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      console.error('Password update failed:', updateError.message);
      return NextResponse.json(
        { error: 'update_failed', code: updateError.code ?? null },
        { status: 400 }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .maybeSingle();

    let tenantSlug: string | null = null;
    if (isStaffRole(profile?.role) && profile?.tenant_id) {
      tenantSlug = await tenantService.getTenantSlugById(profile.tenant_id, supabaseAdmin);
    }

    return NextResponse.json({
      success: true,
      isStaff: isStaffRole(profile?.role),
      tenantSlug,
    });
  } catch (error) {
    console.error('Update password API error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
