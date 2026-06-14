import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';

export type EmailAttachment = {
  filename: string;
  content: Buffer | Uint8Array;
  contentType?: string;
};

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  attachments?: EmailAttachment[];
};

function smtpUser(): string | undefined {
  return process.env.SMTP_USER?.trim();
}

function smtpPassword(): string | undefined {
  return process.env.SMTP_PASSWORD?.trim();
}

export function isSmtpConfigured(): boolean {
  return Boolean(smtpUser() && smtpPassword());
}

function formatFromAddress(displayName: string | undefined, email: string): string {
  if (!displayName) return email;
  return `"${displayName.replace(/"/g, '')}" <${email}>`;
}

/** Handles dotenv values that lost the address when unquoted, e.g. "WODUS" only. */
function normalizeFromAddress(rawFrom: string | undefined): string | undefined {
  const from = rawFrom?.trim();
  if (!from) return undefined;

  if (from.includes('@')) {
    return from;
  }

  const user = smtpUser();
  if (!user) return from;

  return formatFromAddress(from, user);
}

export function getAuthFromEmail(): string {
  return resolveFromAddress(process.env.AUTH_FROM_EMAIL);
}

export function getPayrollFromEmail(): string {
  return resolveFromAddress(process.env.PAYROLL_FROM_EMAIL);
}

function resolveFromAddress(explicitFrom?: string): string {
  const from =
    normalizeFromAddress(explicitFrom) ||
    normalizeFromAddress(process.env.AUTH_FROM_EMAIL) ||
    normalizeFromAddress(process.env.PAYROLL_FROM_EMAIL) ||
    smtpUser();

  if (!from) {
    throw new Error(
      'Email sender is not configured. Set AUTH_FROM_EMAIL, PAYROLL_FROM_EMAIL, or SMTP_USER.'
    );
  }

  return from;
}

function createTransporter() {
  const host = process.env.SMTP_HOST?.trim() || 'smtp.zoho.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: smtpUser(),
      pass: smtpPassword(),
    },
  });
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error(
      'Email is not configured. Set SMTP_USER and SMTP_PASSWORD (Zoho app password).'
    );
  }

  const transporter = createTransporter();
  const from = resolveFromAddress(params.from);
  const to = Array.isArray(params.to) ? params.to.join(', ') : params.to;

  const mail: Mail.Options = {
    from,
    to,
    subject: params.subject,
    html: params.html,
  };

  if (params.attachments?.length) {
    mail.attachments = params.attachments.map((attachment) => ({
      filename: attachment.filename,
      content: Buffer.from(attachment.content),
      contentType: attachment.contentType,
    }));
  }

  try {
    await transporter.sendMail(mail);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown SMTP error';
    throw new Error(`Failed to send email via SMTP: ${message}`);
  }
}
