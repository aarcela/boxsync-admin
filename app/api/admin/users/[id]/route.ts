import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize the Admin Client (Bypasses RLS)
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

    // Set plan: 'unlimited' for coaches/managers/admins, or the provided plan for members
    if (role === 'coach' || role === 'manager' || role === 'admin') {
      profileUpdateData.plan = 'unlimited';
    } else if (plan) {
      profileUpdateData.plan = plan;
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

