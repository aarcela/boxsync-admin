import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Admin Client to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST() {
  try {
    // Optional: Add a secret token check here if using an external cron service
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return new Response('Unauthorized', { status: 401 });

    const { data, error } = await supabaseAdmin.rpc('expire_monthly_memberships');

    if (error) throw error;

    return NextResponse.json(data);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}