import type { Language } from './translations';
import { GOOGLE_PLAY_URL } from './constants/app-links';

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION ?? 'v21.0';

export function normalizeWhatsAppRecipient(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function buildWelcomeMessage(params: {
  fullName: string;
  email: string;
  language: Language;
}): string {
  const firstName = params.fullName.trim().split(/\s+/)[0] || params.fullName;

  if (params.language === 'es') {
    return [
      `¡Hola ${firstName}! 👋`,
      '',
      '¡Bienvenido/a a WODUS! Tu cuenta ya está lista.',
      '',
      'Descarga nuestra app en Google Play para reservar clases, ver el WOD y mantenerte conectado con el box:',
      `📱 ${GOOGLE_PLAY_URL}`,
      '',
      'App iOS próximamente.',
      '',
      `Inicia sesión con tu correo: ${params.email}`,
      '',
      '¡Nos vemos en el box! 💪',
    ].join('\n');
  }

  return [
    `Hi ${firstName}! 👋`,
    '',
    'Welcome to WODUS! Your account is ready.',
    '',
    'Download our app on Google Play to book classes, view the WOD, and stay connected with the box:',
    `📱 ${GOOGLE_PLAY_URL}`,
    '',
    'iOS app coming soon.',
    '',
    `Log in with your email: ${params.email}`,
    '',
    'See you at the box! 💪',
  ].join('\n');
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_NUMBER?.trim()
  );
}

export async function sendWhatsAppMessage(
  to: string,
  body: string
): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER?.trim();

  if (!token || !phoneNumberId) {
    console.warn(
      'WhatsApp not configured: set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER'
    );
    return;
  }

  const recipient = normalizeWhatsAppRecipient(to);
  if (!recipient) {
    throw new Error('Invalid phone number for WhatsApp');
  }

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: { preview_url: true, body },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `WhatsApp API error (${response.status}): ${errorBody}`
    );
  }
}

export async function sendWelcomeWhatsApp(params: {
  phone: string;
  fullName: string;
  email: string;
  language: Language;
}): Promise<void> {
  const body = buildWelcomeMessage({
    fullName: params.fullName,
    email: params.email,
    language: params.language,
  });
  await sendWhatsAppMessage(params.phone, body);
}
