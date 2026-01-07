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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, full_name, role, plan } = body;

    // 1. Validation
    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 2. Create Auth User
    const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email so they can login immediately
      user_metadata: { full_name } // Trigger uses this to create profile
    });

    if (createError) throw createError;
    if (!user.user) throw new Error('Failed to create user object');

    // 3. Update Profile Role, Solvency & Plan
    // The trigger created the profile, but defaults to 'member' / 'insolvent'.
    // We update it immediately to match what the admin selected.
    const profileUpdate: {
      role: string;
      is_solvent: boolean;
      plan?: string;
    } = { 
      role: role || 'member',
      is_solvent: true // New users start active usually
    };

    // Set plan: 'unlimited' for coaches/managers/admins, or the provided plan for members
    if (role === 'coach' || role === 'manager' || role === 'admin') {
      profileUpdate.plan = 'unlimited';
    } else if (plan) {
      profileUpdate.plan = plan;
    } else {
      profileUpdate.plan = 'unlimited'; // Default for members
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', user.user.id);

    if (profileError) throw profileError;

    return NextResponse.json({ success: true, user: user.user });

  } catch (error: unknown) {
    console.error('Create User Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}