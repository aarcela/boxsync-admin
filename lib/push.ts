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

  const messages = tokens.map((to) => ({ to, title, body, data, sound: 'default' as const }));
  const { errors } = await postExpoMessages(messages);
  if (errors.length > 0) {
    console.error('Expo push errors:', errors.join(' | '));
  }
}

const EXPO_BATCH_SIZE = 100;
const MAX_CUSTOM_RECIPIENTS = 500;
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

type ExpoTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
};

async function postExpoMessages(
  messages: Array<{
    to: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    sound: 'default';
  }>
): Promise<{ delivered: number; errors: string[] }> {
  const ticketIds: string[] = [];
  const errors: string[] = [];
  let delivered = 0;

  for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
    const chunk = messages.slice(i, i + EXPO_BATCH_SIZE);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(chunk),
    });
    const payload = (await response.json()) as {
      data?: ExpoTicket | ExpoTicket[];
      errors?: Array<{ message?: string }>;
    };
    if (!response.ok) {
      throw new Error(
        payload.errors?.[0]?.message ||
          `Expo push API error (${response.status})`
      );
    }
    const tickets = Array.isArray(payload.data)
      ? payload.data
      : payload.data
        ? [payload.data]
        : [];
    for (const ticket of tickets) {
      if (ticket.status === 'error') {
        errors.push(
          ticket.message || ticket.details?.error || 'Expo push failed'
        );
      } else if (ticket.id) {
        ticketIds.push(ticket.id);
        delivered += 1;
      }
    }
  }

  if (ticketIds.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const receiptRes = await fetch(EXPO_RECEIPTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ids: ticketIds }),
    });
    const receiptPayload = (await receiptRes.json()) as {
      data?: Record<string, ExpoTicket>;
    };
    for (const receipt of Object.values(receiptPayload.data || {})) {
      if (receipt.status === 'error') {
        errors.push(
          receipt.message || receipt.details?.error || 'Expo push receipt failed'
        );
        delivered = Math.max(0, delivered - 1);
      }
    }
  }

  return { delivered, errors };
}

export async function sendCustomPushes(params: {
  tenantId: string;
  userIds: string[] | 'all';
  title: string;
  body: string;
}): Promise<{ sent: number; skipped: number; error?: string }> {
  const title = params.title.trim();
  const body = params.body.trim();

  let query = supabaseAdmin
    .from('push_tokens')
    .select('user_id, expo_push_token')
    .eq('tenant_id', params.tenantId);

  if (params.userIds !== 'all') {
    if (params.userIds.length === 0) return { sent: 0, skipped: 0 };
    if (params.userIds.length > MAX_CUSTOM_RECIPIENTS) {
      throw new Error(`Too many recipients (max ${MAX_CUSTOM_RECIPIENTS})`);
    }

    const { data: scoped, error: scopeError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('tenant_id', params.tenantId)
      .in('id', params.userIds);

    if (scopeError) throw scopeError;
    const allowed = new Set((scoped || []).map((row) => row.id));
    const inTenant = params.userIds.filter((id) => allowed.has(id));
    if (inTenant.length === 0) return { sent: 0, skipped: params.userIds.length };
    query = query.in('user_id', inTenant);
  }

  const { data: tokenRows, error } = await query;
  if (error) throw error;

  const tokensByUser = new Map<string, string[]>();
  for (const row of tokenRows || []) {
    if (!row.expo_push_token) continue;
    const list = tokensByUser.get(row.user_id) || [];
    list.push(row.expo_push_token);
    tokensByUser.set(row.user_id, list);
  }

  const targeted =
    params.userIds === 'all' ? [...tokensByUser.keys()] : params.userIds;
  const skipped =
    params.userIds === 'all' ? 0 : targeted.filter((id) => !tokensByUser.has(id)).length;

  const messages = [...tokensByUser.values()].flat().map((to) => ({
    to,
    title,
    body,
    data: { type: 'custom' },
    sound: 'default' as const,
  }));

  if (messages.length > 0) {
    const result = await postExpoMessages(messages);
    if (result.delivered === 0 && result.errors.length > 0) {
      throw new Error(result.errors[0]);
    }
    return {
      sent: result.delivered,
      skipped,
      error: result.errors[0],
    };
  }

  return { sent: tokensByUser.size, skipped };
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
