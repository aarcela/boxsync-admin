import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Cookie-based client so middleware and API routes can read the session. */
export const supabase = createBrowserClient(supabaseUrl, supabaseKey);