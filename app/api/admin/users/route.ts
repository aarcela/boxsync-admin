import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { ADMIN_ROLE_ASSIGN_FORBIDDEN, canAssignProfileRole } from '@/lib/auth';
import { requireStaffApi } from '@/lib/require-staff-api';
import { sendWelcomeWhatsApp } from '@/lib/whatsapp';
import type { Language } from '@/lib/translations';

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
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  try {
    const body = await request.json();
    const {
      email,
      password,
      full_name,
      phone,
      language,
      role,
      plan,
      inscription_plan,
      inscription_cost,
      inscription_paid,
      discount,
    } = body;

    const messageLanguage: Language =
      language === 'es' || language === 'en' ? language : 'en';

    // 1. Validation
    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!canAssignProfileRole(staffAuth.profile.role, role)) {
      return NextResponse.json(
        { error: ADMIN_ROLE_ASSIGN_FORBIDDEN },
        { status: 403 }
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
      inscription_plan: string;
      inscription_cost: number;
      inscription_paid: boolean;
      discount?: number | null;
      phone?: string;
    } = { 
      role: role || 'member',
      is_solvent: true,
      inscription_paid: inscription_paid || false,
      inscription_plan: inscription_plan || 'standard',
      inscription_cost: inscription_cost ? parseFloat(inscription_cost) : 0
    };

    if (discount !== undefined) {
      profileUpdate.discount = discount === '' ? null : parseFloat(discount);
    }

    if (phone?.trim()) {
      profileUpdate.phone = phone.trim();
    }

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

    let whatsappWarning: string | undefined;
    if (phone?.trim()) {
      try {
        await sendWelcomeWhatsApp({
          phone: phone.trim(),
          fullName: full_name,
          email,
          language: messageLanguage,
        });
      } catch (whatsappError) {
        console.error('Welcome WhatsApp failed:', whatsappError);
        whatsappWarning =
          'User created, but the welcome WhatsApp message could not be sent.';
      }
    }

    return NextResponse.json({
      success: true,
      user: user.user,
      ...(whatsappWarning ? { whatsappWarning } : {}),
    });

  } catch (error: unknown) {
    console.error('Create User Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}