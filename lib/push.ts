import { supabaseAdmin } from './supabase-admin';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function getTokensForUser(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('push_tokens')
    .select('expo_push_token')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to load push tokens:', error);
    return [];
  }
  return (data || []).map((row) => row.expo_push_token).filter(Boolean);
}

export async function sendExpoPush(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const tokens = await getTokensForUser(userId);
  if (tokens.length === 0) {
    console.warn(`No push tokens for user ${userId}; skipping push "${title}"`);
    return;
  }

  const messages = tokens.map((to) => ({ to, title, body, data, sound: 'default' }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Expo push API error (${response.status}): ${errorBody}`);
  }
}

export async function sendPaymentApprovedPush(userId: string): Promise<void> {
  await sendExpoPush(
    userId,
    'Payment approved',
    'Your payment was approved. Your membership is up to date.',
    { type: 'payment_approved' }
  );
}

export async function sendPaymentRejectedPush(userId: string, reason?: string | null): Promise<void> {
  await sendExpoPush(
    userId,
    'Payment rejected',
    reason?.trim() || 'Your payment was rejected. Contact your box for details.',
    { type: 'payment_rejected' }
  );
}

export async function sendWaitlistPromotedPush(userId: string, classId: string): Promise<void> {
  await sendExpoPush(
    userId,
    'You\'re in!',
    'A spot opened up in your waitlisted class. Check the app for details.',
    { type: 'waitlist_promoted', classId }
  );
}

export async function sendExpiryReminderPush(userId: string, daysLeft: number): Promise<void> {
  await sendExpoPush(
    userId,
    'Membership renewal',
    daysLeft <= 0
      ? 'Your membership expires today. Renew to keep booking classes.'
      : `Your membership expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew to keep booking classes.`,
    { type: 'expiry_reminder', daysLeft }
  );
}
