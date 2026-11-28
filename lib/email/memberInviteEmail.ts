import type { Language } from '@/lib/translations';
import { getAuthFromEmail, isSmtpConfigured, sendEmail } from '@/lib/email/smtp';
import { firstNameOf, renderBrandedEmail } from '@/lib/email/layout';

type InviteParams = {
  fullName: string;
  inviteLink: string;
  language: Language;
  tenantName?: string | null;
};

function inviteCopy(params: InviteParams) {
  const isEs = params.language === 'es';
  const firstName = firstNameOf(params.fullName);
  const gym = params.tenantName?.trim() || null;

  const greeting = firstName
    ? isEs ? `Hola ${firstName},` : `Hi ${firstName},`
    : isEs ? 'Hola,' : 'Hi,';

  const subject = gym
    ? isEs ? `${gym} te dio acceso a WODUS` : `${gym} set up your WODUS account`
    : isEs ? 'Tu cuenta WODUS está lista' : 'Your WODUS account is ready';

  const title = isEs ? 'Crea tu contraseña' : 'Create your password';

  const intro = gym
    ? isEs
      ? `${gym} creó tu cuenta en WODUS, la app donde reservas clases, ves el WOD del día y sigues tus PRs.`
      : `${gym} created your account on WODUS, the app where you book classes, see the WOD of the day and track your PRs.`
    : isEs
      ? 'Tu gym creó tu cuenta en WODUS, la app donde reservas clases, ves el WOD del día y sigues tus PRs.'
      : 'Your gym created your account on WODUS, the app where you book classes, see the WOD of the day and track your PRs.';

  const step = isEs
    ? 'Solo falta un paso: crea tu contraseña para empezar.'
    : 'One step left: create your password to get started.';

  return {
    subject,
    greeting,
    title,
    intro,
    step,
    preheader: gym
      ? isEs ? `${gym} te espera en WODUS. Crea tu contraseña.` : `${gym} is waiting for you on WODUS. Create your password.`
      : isEs ? 'Crea tu contraseña para empezar en WODUS.' : 'Create your password to get started on WODUS.',
    eyebrow: gym ? (isEs ? `Bienvenido a ${gym}` : `Welcome to ${gym}`) : isEs ? 'Bienvenido' : 'Welcome',
    button: isEs ? 'Crear contraseña' : 'Create password',
    note: isEs ? 'Por seguridad, este enlace expira pronto.' : 'For your security, this link expires soon.',
    ignore: isEs
      ? 'Si no esperabas esta invitación, puedes ignorar este correo.'
      : 'If you were not expecting this invitation, you can safely ignore this email.',
  };
}

export function isMemberInviteEmailConfigured(): boolean {
  return isSmtpConfigured();
}

export function buildMemberInviteEmail(params: InviteParams) {
  const copy = inviteCopy(params);
  const html = renderBrandedEmail({
    language: params.language,
    preheader: copy.preheader,
    eyebrow: copy.eyebrow,
    title: copy.title,
    greeting: copy.greeting,
    paragraphs: [copy.intro, copy.step],
    buttonLabel: copy.button,
    buttonUrl: params.inviteLink,
    note: copy.note,
    footnote: copy.ignore,
  });
  const text = `${copy.greeting}\n\n${copy.intro}\n\n${copy.step}\n${params.inviteLink}\n\n${copy.note}\n\n${copy.ignore}`;
  return { subject: copy.subject, html, text };
}

export async function sendMemberInviteEmail(
  params: InviteParams & { to: string }
): Promise<void> {
  const { subject, html, text } = buildMemberInviteEmail(params);
  await sendEmail({
    to: params.to,
    subject,
    html,
    text,
    from: getAuthFromEmail(),
  });
}
