import type { Language } from '@/lib/translations';
import { getAuthFromEmail, isSmtpConfigured, sendEmail } from '@/lib/email/smtp';
import { firstNameOf, renderBrandedEmail } from '@/lib/email/layout';

type GymSignupParams = {
  ownerName: string;
  gymName: string;
  verifyLink: string;
  language: Language;
};

function gymSignupCopy(params: GymSignupParams) {
  const isEs = params.language === 'es';
  const firstName = firstNameOf(params.ownerName);
  const gym = params.gymName;

  const greeting = firstName
    ? isEs ? `Hola ${firstName},` : `Hi ${firstName},`
    : isEs ? 'Hola,' : 'Hi,';

  return {
    subject: isEs ? `Confirma tu gym en WODUS: ${gym}` : `Confirm your WODUS gym: ${gym}`,
    preheader: isEs
      ? `Confirma tu correo para abrir el panel de ${gym}.`
      : `Confirm your email to open the ${gym} dashboard.`,
    eyebrow: isEs ? 'Prueba gratis de 30 días' : '30-day free trial',
    title: isEs ? 'Activa tu cuenta' : 'Confirm your email',
    greeting,
    body: isEs
      ? `Confirma tu correo para abrir el panel de ${gym} y empezar tu prueba de 30 días.`
      : `Confirm your email to open the ${gym} dashboard and start your 30-day trial.`,
    button: isEs ? 'Confirmar correo' : 'Confirm email',
    note: isEs ? 'Por seguridad, este enlace expira pronto.' : 'For your security, this link expires soon.',
    ignore: isEs
      ? 'Si no creaste esta cuenta, puedes ignorar este correo.'
      : 'If you did not create this account, you can safely ignore this email.',
  };
}

export function isGymSignupEmailConfigured(): boolean {
  return isSmtpConfigured();
}

export function buildGymSignupVerifyEmail(params: GymSignupParams) {
  const copy = gymSignupCopy(params);
  const html = renderBrandedEmail({
    language: params.language,
    preheader: copy.preheader,
    eyebrow: copy.eyebrow,
    title: copy.title,
    greeting: copy.greeting,
    paragraphs: [copy.body],
    buttonLabel: copy.button,
    buttonUrl: params.verifyLink,
    note: copy.note,
    footnote: copy.ignore,
  });
  const text = `${copy.greeting}\n\n${copy.body}\n${params.verifyLink}\n\n${copy.note}\n\n${copy.ignore}`;
  return { subject: copy.subject, html, text };
}

export async function sendGymSignupVerifyEmail(params: {
  to: string;
  ownerName: string;
  gymName: string;
  verifyLink: string;
  language?: Language;
}): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error('Email is not configured.');
  }
  const language: Language = params.language === 'en' ? 'en' : 'es';
  const { subject, html, text } = buildGymSignupVerifyEmail({ ...params, language });

  await sendEmail({
    to: params.to,
    from: getAuthFromEmail(),
    subject,
    html,
    text,
  });
}
