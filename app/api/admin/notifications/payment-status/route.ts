import { NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/require-staff-api';
import { sendPaymentApprovedPush, sendPaymentRejectedPush } from '@/lib/push';

/**
 * Sends a push notification after a payment is approved/rejected.
 * Kept as its own route (rather than inline in financialService, which runs
 * client-side under the anon key) since reading another user's push_tokens
 * requires the service-role client and must never run in the browser bundle.
 */
export async function POST(request: Request) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  try {
    const body = await request.json();
    const { userId, status, reason } = body as {
      userId?: string;
      status?: 'approved' | 'rejected';
      reason?: string | null;
    };

    if (!userId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (status === 'approved') {
      await sendPaymentApprovedPush(userId);
    } else {
      await sendPaymentRejectedPush(userId, reason);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    // Push failures should never block the payment approve/reject flow itself.
    console.error('Payment status push notification failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
