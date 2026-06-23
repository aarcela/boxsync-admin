import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { ADMIN_ROLE_ASSIGN_FORBIDDEN, canAssignProfileRole } from '@/lib/auth';
import { buildPlanChangeFields } from '@/lib/plan-period';
import { requireStaffApi } from '@/lib/require-staff-api';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveUnlimitedPlanId(tenantId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('membership_plans')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .or('limit_type.eq.none,limit_type.is.null')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data?.id) return data.id;

  const { data: legacy, error: legacyError } = await supabaseAdmin
    .from('membership_plans')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('weekly_limit', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (legacyError) throw legacyError;
  return legacy?.id ?? null;
}

async function validatePlanForTenant(tenantId: string, planId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('membership_plans')
    .select('id')
    .eq('id', planId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return !!data?.id;
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// GET - Fetch user data including email
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // 1. Get profile data
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (profileError) throw profileError;
    if (!profile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 2. Get email from auth.users using admin client
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(id);

    if (authError) throw authError;

    return NextResponse.json({
      id: profile.id,
      full_name: profile.full_name,
      email: authUser.user?.email || '',
      phone: profile.phone || '',
      role: profile.role,
      plan: profile.plan || 'unlimited',
      inscription_plan: profile.inscription_plan || 'standard',
      inscription_paid: profile.inscription_paid ?? false,
      is_solvent: profile.is_solvent ?? true,
      avatar_url: profile.avatar_url,
      discount: profile.discount ?? null,
      created_at: profile.created_at
    });

  } catch (error: unknown) {
    console.error('Get User Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// PUT - Update user
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { email, password, full_name, phone, role, plan, inscription_plan, inscription_paid, is_solvent, discount } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // 1. Validate required fields
    if (!email || !full_name) {
      return NextResponse.json(
        { error: 'Email and full name are required' },
        { status: 400 }
      );
    }

    const { data: existingProfile, error: existingError } = await supabaseAdmin
      .from('profiles')
      .select('role, plan, tenant_id')
      .eq('id', id)
      .single();

    if (existingError || !existingProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!canAssignProfileRole(staffAuth.profile.role, role, existingProfile.role)) {
      return NextResponse.json(
        { error: ADMIN_ROLE_ASSIGN_FORBIDDEN },
        { status: 403 }
      );
    }

    // 2. Update auth user (email and password if provided)
    interface UpdateAuthData {
      email: string;
      user_metadata: { full_name: string };
      password?: string;
    }
    
    const updateAuthData: UpdateAuthData = {
      email,
      user_metadata: { full_name }
    };

    // Only update password if provided
    if (password && password.trim() !== '') {
      updateAuthData.password = password;
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      updateAuthData
    );

    if (authError) throw authError;

    // 3. Update profile
    interface ProfileUpdateData {
      full_name: string;
      phone?: string;
      role: string;
      plan?: string;
      plan_period_start?: string;
      inscription_plan?: string;
      inscription_paid?: boolean;
      is_solvent?: boolean;
      discount?: number | null;
    }
    
    const profileUpdateData: ProfileUpdateData = {
      full_name,
      phone,
      role: role || 'member'
    };

    const tenantId = existingProfile.tenant_id as string | null;

    if (role === 'coach' || role === 'manager' || role === 'admin') {
      if (tenantId) {
        const unlimitedPlanId = await resolveUnlimitedPlanId(tenantId);
        if (unlimitedPlanId) {
          profileUpdateData.plan = unlimitedPlanId;
        }
      }
    } else if (plan) {
      if (tenantId && UUID_RE.test(plan)) {
        const valid = await validatePlanForTenant(tenantId, plan);
        if (!valid) {
          return NextResponse.json(
            { error: 'Invalid membership plan for this tenant.' },
            { status: 400 }
          );
        }
      }

      if (plan !== existingProfile?.plan) {
        const planFields = await buildPlanChangeFields(supabaseAdmin, plan, tenantId ?? undefined);
        profileUpdateData.plan = planFields.plan;
        if (planFields.plan_period_start) {
          profileUpdateData.plan_period_start = planFields.plan_period_start;
        }
      } else {
        profileUpdateData.plan = plan;
      }
    }

    if (inscription_plan) {
      profileUpdateData.inscription_plan = inscription_plan;
    }

    if (typeof inscription_paid === 'boolean') {
      profileUpdateData.inscription_paid = inscription_paid;
    }

    // Only update is_solvent if provided (boolean)
    if (typeof is_solvent === 'boolean') {
      profileUpdateData.is_solvent = is_solvent;
    }

    if (discount !== undefined) {
      profileUpdateData.discount = discount === '' ? null : parseFloat(discount);
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdateData)
      .eq('id', id);

    if (profileError) throw profileError;

    return NextResponse.json({ 
      success: true, 
      user: {
        id,
        full_name,
        email,
        phone,
        role,
        plan: profileUpdateData.plan,
        inscription_plan,
        inscription_paid,
        is_solvent,
        discount
      }
    });

  } catch (error: unknown) {
    console.error('Update User Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  if (staffAuth.profile.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only admins can delete athletes.' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (id === staffAuth.user.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account.' },
        { status: 400 }
      );
    }

    const tenantId = staffAuth.profile.tenant_id as string | null;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenant context.' },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, tenant_id')
      .eq('id', id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (profile.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete User Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

