import type { Language } from '@/lib/translations';
import { getAuthFromEmail, isSmtpConfigured, sendEmail } from '@/lib/email/smtp';

function buildGymSignupVerifyEmailHtml(params: {
  ownerName: string;
  gymName: string;
  verifyLink: string;
  language: Language;
}): string {
  const firstName = params.ownerName.trim().split(/\s+/)[0] || params.ownerName;
  const isEs = params.language === 'es';
  const gymName = params.gymName;

  const title = isEs ? 'Activa tu cuenta' : 'Confirm your email';
  const greeting = isEs ? `Hola ${firstName},` : `Hi ${firstName},`;
  const body = isEs
    ? `Confirma tu correo para abrir el panel de ${gymName} y empezar la prueba de 30 días.`
    : `Confirm your email to open the ${gymName} dashboard and start your 30-day trial.`;
  const note = isEs
    ? 'Este enlace expira pronto por seguridad.'
    : 'This link expires soon for your security.';
  const button = isEs ? 'Confirmar correo' : 'Confirm email';
  const fallback = isEs ? '¿El botón no funciona?' : 'Button not working?';
  const ignore = isEs
    ? 'Si no creaste esta cuenta, puedes ignorar este correo.'
    : 'If you did not create this account, you can safely ignore this email.';

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
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
            <tr>
              <td align="center" bgcolor="#6B8E00" style="border-radius:8px;">
                <a href="${params.verifyLink}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:16px 32px;background-color:#6B8E00;color:#0D0D0D;text-decoration:none;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;border-radius:8px;">${button}</a>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5A6068;">${fallback}</p>
          <p style="margin:0 0 24px;font-size:12px;line-height:1.6;color:#5A6068;word-break:break-all;"><a href="${params.verifyLink}" target="_blank" rel="noopener noreferrer" style="color:#6B8E00;">${params.verifyLink}</a></p>
          <p style="margin:0;font-size:11px;line-height:1.5;color:#5A6068;opacity:0.85;">${ignore}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function isGymSignupEmailConfigured(): boolean {
  return isSmtpConfigured();
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
  const firstName = params.ownerName.trim().split(/\s+/)[0] || params.ownerName;
  const greeting = language === 'es' ? `Hola ${firstName},` : `Hi ${firstName},`;
  const subject =
    language === 'es'
      ? `Confirma tu gym en WODUS: ${params.gymName}`
      : `Confirm your WODUS gym: ${params.gymName}`;
  const text =
    language === 'es'
      ? `${greeting}\n\nConfirma tu correo para abrir el panel de ${params.gymName}:\n${params.verifyLink}\n\nSi no creaste esta cuenta, puedes ignorar este correo.`
      : `${greeting}\n\nConfirm your email to open the ${params.gymName} dashboard:\n${params.verifyLink}\n\nIf you did not create this account, you can safely ignore this email.`;

  await sendEmail({
    to: params.to,
    from: getAuthFromEmail(),
    subject,
    html: buildGymSignupVerifyEmailHtml({ ...params, language }),
    text,
  });
}
