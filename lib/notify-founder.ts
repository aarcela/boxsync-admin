import { sendEmail, isSmtpConfigured } from '@/lib/email/smtp';
import { getSignupAlertEmail } from '@/lib/founder-contact';
import { buildHqUrl } from '@/lib/tenant-host';

export type FounderNotifyEvent = 'signup' | 'activated' | 'inactive';

export type FounderNotifyPayload = {
  gymName: string;
  slug: string;
  tenantId: string;
  ownerName?: string;
  email?: string;
  phoneE164?: string | null;
  instagram?: string | null;
  city?: string | null;
};

function formatVet(date = new Date()): string {
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function subjectFor(event: FounderNotifyEvent, payload: FounderNotifyPayload): string {
  if (event === 'signup') {
    return `Nuevo gym en WODUS: ${payload.gymName} (${payload.city ?? '—'})`;
  }
  if (event === 'activated') {
    return `Gym activado en WODUS: ${payload.gymName}`;
  }
  return `Gym inactivo 14d en WODUS: ${payload.gymName}`;
}

function bodyFor(event: FounderNotifyEvent, payload: FounderNotifyPayload): { html: string; text: string } {
  const hq = buildHqUrl(`/super-admin/tenants/${payload.tenantId}`);
  const wa = payload.phoneE164
    ? `https://wa.me/${payload.phoneE164.replace(/^\+/, '')}`
    : '—';
  const ig = payload.instagram
    ? `https://instagram.com/${payload.instagram.replace(/^@/, '')}`
    : '—';
  const when = formatVet();
  const lines = [
    `Evento: ${event}`,
    `Gym: ${payload.gymName}`,
    `Slug: ${payload.slug}`,
    `Dueño: ${payload.ownerName ?? '—'}`,
    `Email: ${payload.email ?? '—'}`,
    `WhatsApp: ${wa}`,
    `Instagram: ${ig}`,
    `Ciudad: ${payload.city ?? '—'}`,
    `Fecha/hora VET: ${when}`,
    `HQ: ${hq}`,
  ];
  const text = lines.join('\n');
  const html = `<pre style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.5">${escapeHtml(text)}</pre>`;
  return { html, text };
}

/**
 * Email Andres about gym lifecycle events.
 * TODO: add WhatsApp channel once a provider is chosen.
 */
export async function notifyFounder(
  event: FounderNotifyEvent,
  payload: FounderNotifyPayload
): Promise<void> {
  if (!isSmtpConfigured()) {
    console.warn('notifyFounder skipped: SMTP is not configured', event, payload.slug);
    return;
  }
  const { html, text } = bodyFor(event, payload);
  await sendEmail({
    to: getSignupAlertEmail(),
    subject: subjectFor(event, payload),
    html,
    text,
  });
}
