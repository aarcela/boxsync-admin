import type { Language } from '@/lib/translations';
import { getAuthFromEmail, isSmtpConfigured, sendEmail } from '@/lib/email/smtp';
import { firstNameOf, renderBrandedEmail } from '@/lib/email/layout';

type ResetParams = {
  fullName: string;
  resetLink: string;
  language: Language;
  audience?: 'app' | 'staff';
};

function resetCopy(params: ResetParams) {
  const isEs = params.language === 'es';
  const isStaff = params.audience === 'staff';
  const firstName = firstNameOf(params.fullName);

  const greeting = firstName
    ? isEs ? `Hola ${firstName},` : `Hi ${firstName},`
    : isEs ? 'Hola,' : 'Hi,';

  const body = isStaff
    ? isEs
      ? 'Recibimos una solicitud para restablecer la contraseña de tu panel WODUS. Toca el botón para elegir una nueva.'
      : 'We got a request to reset your WODUS dashboard password. Tap the button to choose a new one.'
    : isEs
      ? 'Recibimos una solicitud para restablecer tu contraseña. Toca el botón para abrir WODUS y elegir una nueva.'
      : 'We got a request to reset your password. Tap the button to open WODUS and choose a new one.';

  return {
    subject: isEs ? 'Restablece tu contraseña de WODUS' : 'Reset your WODUS password',
    preheader: isEs ? 'Elige una nueva contraseña para tu cuenta WODUS.' : 'Choose a new password for your WODUS account.',
    eyebrow: isEs ? 'Seguridad de la cuenta' : 'Account security',
    title: isEs ? 'Nueva contraseña' : 'Reset your password',
    greeting,
    body,
    button: isEs ? 'Elegir nueva contraseña' : 'Choose new password',
    note: isEs ? 'Por seguridad, este enlace expira pronto.' : 'For your security, this link expires soon.',
    ignore: isEs
      ? 'Si no solicitaste esto, puedes ignorar este correo. Tu contraseña no cambiará.'
      : "If you didn't request this, you can ignore this email. Your password won't change.",
  };
}

export function isPasswordResetEmailConfigured(): boolean {
  return isSmtpConfigured();
}

export function buildPasswordResetEmail(params: ResetParams) {
  const copy = resetCopy(params);
  const html = renderBrandedEmail({
    language: params.language,
    preheader: copy.preheader,
    eyebrow: copy.eyebrow,
    title: copy.title,
    greeting: copy.greeting,
    paragraphs: [copy.body],
    buttonLabel: copy.button,
    buttonUrl: params.resetLink,
    note: copy.note,
    footnote: copy.ignore,
  });
  const text = `${copy.greeting}\n\n${copy.body}\n${params.resetLink}\n\n${copy.note}\n\n${copy.ignore}`;
  return { subject: copy.subject, html, text };
}

export async function sendPasswordResetEmail(
  params: ResetParams & { to: string }
): Promise<void> {
  const { subject, html, text } = buildPasswordResetEmail(params);
  await sendEmail({
    to: params.to,
    subject,
    html,
    text,
    from: getAuthFromEmail(),
  });
}
