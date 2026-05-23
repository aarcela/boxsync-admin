import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getPasswordResetRedirectUrl, isStaffRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

const SUCCESS_MESSAGE =
  'If an account exists for this email, we sent reset instructions.';

async function findUserByEmail(email: string): Promise<User | null> {
  const admin = supabaseAdmin.auth.admin as {
    getUserByEmail?: (
      email: string
    ) => Promise<{ data: { user: User | null }; error: Error | null }>;
    listUsers: (params: {
      page: number;
      perPage: number;
    }) => Promise<{ data: { users: User[] } | null; error: Error | null }>;
  };

  if (typeof admin.getUserByEmail === 'function') {
    const { data, error } = await admin.getUserByEmail(email);
    if (error || !data.user) return null;
    return data.user;
  }

  let page = 1;
  for (;;) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) return null;

    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match;

    if (data.users.length < 1000) return null;
    page += 1;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawEmail = typeof body?.email === 'string' ? body.email : '';
    const email = rawEmail.trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ message: SUCCESS_MESSAGE });
    }

    const user = await findUserByEmail(email);

    if (user) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (isStaffRole(profile?.role)) {
        await supabaseAdmin.auth.resetPasswordForEmail(email, {
          redirectTo: getPasswordResetRedirectUrl(request),
        });
      }
    }

    return NextResponse.json({ message: SUCCESS_MESSAGE });
  } catch {
    return NextResponse.json({ message: SUCCESS_MESSAGE });
  }
}
