import { NextResponse } from 'next/server';
import { deactivateExpiredDemos, purgeExpiredDemos } from '@/lib/demo-factory/cleanup';

export const maxDuration = 60;

function authorize(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return null;
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

/** Daily: deactivate expired demos, purge those expired 7+ days ago (tenant, users, proofs). */
export async function GET(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;
  try {
    const deactivated = await deactivateExpiredDemos();
    const purged = await purgeExpiredDemos();
    return NextResponse.json({ ok: true, deactivated, purged });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
