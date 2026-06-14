import type { Language } from '@/lib/translations';
import { getAuthFromEmail, isSmtpConfigured, sendEmail } from '@/lib/email/smtp';

function buildInviteEmailHtml(params: {
  fullName: string;
  inviteLink: string;
  language: Language;
}): string {
  const firstName = params.fullName.trim().split(/\s+/)[0] || params.fullName;
  const isEs = params.language === 'es';

  const title = isEs ? 'Configura tu cuenta' : 'Set up your account';
  const greeting = isEs ? `Hola ${firstName},` : `Hi ${firstName},`;
  const body = isEs
    ? 'Tu box creó una cuenta WODUS para ti. Haz clic abajo para establecer tu contraseña y empezar.'
    : 'Your box created a WODUS account for you. Click below to set your password and get started.';
  const note = isEs
    ? 'Este enlace expira pronto por seguridad.'
    : 'This link expires soon for your security.';
  const button = isEs ? 'Establecer contraseña' : 'Set your password';
  const fallback = isEs ? '¿El botón no funciona?' : 'Button not working?';
  const ignore = isEs
    ? 'Si no esperabas esta invitación, puedes ignorar este correo.'
    : 'If you were not expecting this invitation, you can safely ignore this email.';

  return `<!DOCTYPE html>
<html lang="${isEs ? 'es' : 'en'}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#EDEEF0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#EDEEF0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:448px;background-color:#FFFFFF;border:1px solid #D9DCE1;border-radius:16px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.08);">
        <tr><td style="padding:32px;text-align:center;">
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:900;font-style:italic;text-transform:uppercase;letter-spacing:-0.02em;color:#15171A;">${title}</h1>
          <p style="margin:0 0 24px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#5A6068;">WODUS</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#15171A;">${greeting}</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#5A6068;">${body}</p>
          <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#5A6068;">${note}</p>
          <a href="${params.inviteLink}" target="_blank" style="display:inline-block;width:100%;box-sizing:border-box;padding:16px 24px;background-color:#6B8E00;color:#0D0D0D;text-decoration:none;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;border-radius:8px;">${button}</a>
          <p style="margin:24px 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5A6068;">${fallback}</p>
          <p style="margin:0 0 24px;font-size:12px;line-height:1.6;color:#5A6068;word-break:break-all;"><a href="${params.inviteLink}" style="color:#6B8E00;">${params.inviteLink}</a></p>
          <p style="margin:0;font-size:11px;line-height:1.5;color:#5A6068;opacity:0.85;">${ignore}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function isMemberInviteEmailConfigured(): boolean {
  return isSmtpConfigured();
}

export async function sendMemberInviteEmail(params: {
  to: string;
  fullName: string;
  inviteLink: string;
  language: Language;
}): Promise<void> {
  const isEs = params.language === 'es';
  const subject = isEs ? 'Te invitamos a WODUS' : "You're invited to WODUS";

  await sendEmail({
    to: params.to,
    subject,
    html: buildInviteEmailHtml(params),
    from: getAuthFromEmail(),
  });
}
