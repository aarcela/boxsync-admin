import type { Language } from '@/lib/translations';

const C = {
  bg: '#0D0D0D',
  card: '#1A1A1C',
  border: '#2D2D30',
  text: '#F5F5F5',
  sub: '#9BA1A6',
  lime: '#D7FF00',
  onLime: '#0D0D0D',
};

const FONT =
  "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function firstNameOf(fullName: string): string {
  const trimmed = fullName.trim();
  return trimmed.split(/\s+/)[0] || trimmed;
}

export type BrandedEmailParams = {
  language: Language;
  preheader: string;
  eyebrow?: string;
  title: string;
  greeting: string;
  paragraphs: string[];
  buttonLabel: string;
  buttonUrl: string;
  note?: string;
  footnote: string;
};

/**
 * Mobile-first, dark lime-on-black layout matching getwodus.com.
 * All text params are plain text and get escaped here.
 */
export function renderBrandedEmail(p: BrandedEmailParams): string {
  const isEs = p.language === 'es';
  const url = escapeHtml(p.buttonUrl);
  const fallback = isEs
    ? '¿El botón no funciona? Copia este enlace:'
    : 'Button not working? Copy this link:';
  const tagline = isEs ? 'Tu gym, en tu bolsillo.' : 'Your gym, in your pocket.';

  const paragraphs = p.paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${C.sub};">${escapeHtml(text)}</p>`
    )
    .join('');

  const eyebrow = p.eyebrow
    ? `<p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${C.lime};">${escapeHtml(p.eyebrow)}</p>`
    : '';

  const note = p.note
    ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:${C.sub};text-align:center;">${escapeHtml(p.note)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="${isEs ? 'es' : 'en'}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>${escapeHtml(p.title)}</title>
<style>
  :root { color-scheme: dark; supported-color-schemes: dark; }
  body { margin:0 !important; padding:0 !important; width:100% !important; }
  a { text-decoration:none; }
  @media only screen and (max-width:480px) {
    .wrap { padding:20px 12px !important; }
    .card-pad { padding:28px 22px !important; }
    .title { font-size:28px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${C.bg};font-family:${FONT};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(p.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${C.bg}" style="background-color:${C.bg};">
    <tr><td align="center" class="wrap" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;">
        <tr><td style="padding:0 4px 20px;">
          <span style="font-size:22px;font-weight:900;font-style:italic;letter-spacing:-0.02em;color:${C.text};">WOD<span style="color:${C.lime};">US</span></span>
        </td></tr>
        <tr><td bgcolor="${C.card}" style="background-color:${C.card};border:1px solid ${C.border};border-radius:20px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr><td height="4" bgcolor="${C.lime}" style="height:4px;line-height:4px;font-size:0;background-color:${C.lime};border-radius:20px 20px 0 0;">&nbsp;</td></tr>
            <tr><td class="card-pad" style="padding:36px 32px;">
              ${eyebrow}
              <h1 class="title" style="margin:0 0 20px;font-size:30px;line-height:1.15;font-weight:900;font-style:italic;text-transform:uppercase;letter-spacing:-0.02em;color:${C.text};">${escapeHtml(p.title)}</h1>
              <p style="margin:0 0 14px;font-size:16px;line-height:1.6;font-weight:600;color:${C.text};">${escapeHtml(p.greeting)}</p>
              ${paragraphs}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:12px;">
                <tr><td align="center" bgcolor="${C.lime}" style="border-radius:14px;background-color:${C.lime};">
                  <a href="${url}" target="_blank" rel="noopener noreferrer" style="display:block;padding:18px 20px;font-size:15px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${C.onLime};text-decoration:none;border-radius:14px;">${escapeHtml(p.buttonLabel)}</a>
                </td></tr>
              </table>
              ${note}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;border-top:1px solid ${C.border};">
                <tr><td style="padding-top:20px;">
                  <p style="margin:0 0 6px;font-size:12px;color:${C.sub};">${fallback}</p>
                  <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${url}" target="_blank" rel="noopener noreferrer" style="color:${C.lime};text-decoration:underline;">${url}</a></p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 8px 0;text-align:center;">
          <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:${C.sub};">${escapeHtml(p.footnote)}</p>
          <p style="margin:0;font-size:12px;color:#5A6068;">WODUS · ${tagline} · <a href="https://getwodus.com" style="color:#5A6068;text-decoration:underline;">getwodus.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
