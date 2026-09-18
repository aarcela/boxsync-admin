import { supabaseAdmin } from './supabase-admin';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type PushLanguage = 'en' | 'es';

const COPY = {
  en: {
    paymentApprovedTitle: 'Payment approved',
    paymentApprovedBody: 'Your payment was approved. Your membership is up to date.',
    paymentRejectedTitle: 'Payment rejected',
    paymentRejectedBody: 'Your payment was rejected. Contact your box for details.',
    waitlistTitle: "You're in!",
    waitlistBody: 'A spot opened up in your waitlisted class. Check the app for details.',
    expiryTitle: 'Membership renewal',
    expiryToday: 'Your membership expires today. Renew to keep booking classes.',
    expirySoon: (daysLeft: number) =>
      `Your membership expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew to keep booking classes.`,
  },
  es: {
    paymentApprovedTitle: 'Pago aprobado',
    paymentApprovedBody: 'Tu pago fue aprobado. Tu membresía está al día.',
    paymentRejectedTitle: 'Pago rechazado',
    paymentRejectedBody: 'Tu pago fue rechazado. Contacta a tu box para más detalles.',
    waitlistTitle: '¡Entraste!',
    waitlistBody: 'Se liberó un cupo en la clase donde estabas en espera. Revisa la app.',
    expiryTitle: 'Renovación de membresía',
    expiryToday: 'Tu membresía vence hoy. Renueva para seguir reservando clases.',
    expirySoon: (daysLeft: number) =>
      `Tu membresía vence en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}. Renueva para seguir reservando clases.`,
  },
};

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

async function getUserPushLanguage(userId: string): Promise<PushLanguage> {
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    const lang = data.user?.user_metadata?.language;
    return lang === 'en' || lang === 'es' ? lang : 'es';
  } catch (error) {
    console.error('Failed to load push language:', error);
    return 'es';
  }
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
  const copy = COPY[await getUserPushLanguage(userId)];
  await sendExpoPush(
    userId,
    copy.paymentApprovedTitle,
    copy.paymentApprovedBody,
    { type: 'payment_approved' }
  );
}

export async function sendPaymentRejectedPush(userId: string, reason?: string | null): Promise<void> {
  const copy = COPY[await getUserPushLanguage(userId)];
  await sendExpoPush(
    userId,
    copy.paymentRejectedTitle,
    reason?.trim() || copy.paymentRejectedBody,
    { type: 'payment_rejected' }
  );
}

export async function sendWaitlistPromotedPush(userId: string, classId: string): Promise<void> {
  const copy = COPY[await getUserPushLanguage(userId)];
  await sendExpoPush(
    userId,
    copy.waitlistTitle,
    copy.waitlistBody,
    { type: 'waitlist_promoted', classId }
  );
}

export async function sendExpiryReminderPush(userId: string, daysLeft: number): Promise<void> {
  const copy = COPY[await getUserPushLanguage(userId)];
  await sendExpoPush(
    userId,
    copy.expiryTitle,
    daysLeft <= 0 ? copy.expiryToday : copy.expirySoon(daysLeft),
    { type: 'expiry_reminder', daysLeft }
  );
}
