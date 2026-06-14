import type { CoachPayrollReport } from '@/lib/payroll/payrollReport';
import { getPayrollFromEmail, isSmtpConfigured, sendEmail } from '@/lib/email/smtp';

function buildEmailHtml(report: CoachPayrollReport): string {
  const rows = report.lines
    .map(
      (line) =>
        `<tr>
          <td style="padding:8px;border:1px solid #eee;">${line.date}</td>
          <td style="padding:8px;border:1px solid #eee;">${line.time}</td>
          <td style="padding:8px;border:1px solid #eee;">${line.classType}</td>
          <td style="padding:8px;border:1px solid #eee;text-align:right;">$${line.rateUsd.toFixed(2)}</td>
        </tr>`
    )
    .join('');

  return `
    <div style="font-family:sans-serif;color:#111;max-width:640px;">
      <h2 style="margin:0 0 8px;">Payroll Summary</h2>
      <p style="margin:0 0 16px;color:#555;">Hello ${report.coachName},</p>
      <p style="margin:0 0 16px;">Period: <strong>${report.periodLabel}</strong></p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#fef2f2;">
            <th style="padding:8px;border:1px solid #eee;text-align:left;">Date</th>
            <th style="padding:8px;border:1px solid #eee;text-align:left;">Time</th>
            <th style="padding:8px;border:1px solid #eee;text-align:left;">Class</th>
            <th style="padding:8px;border:1px solid #eee;text-align:right;">Pay (USD)</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="4" style="padding:8px;">No confirmed classes</td></tr>'}</tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding:8px;border:1px solid #eee;font-weight:bold;">Total</td>
            <td style="padding:8px;border:1px solid #eee;text-align:right;font-weight:bold;">$${report.totalUsd.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <p style="margin:16px 0 0;color:#555;font-size:12px;">A detailed PDF is attached to this email.</p>
    </div>
  `;
}

export function isPayrollEmailConfigured(): boolean {
  return isSmtpConfigured();
}

export async function sendCoachPayrollEmail(
  report: CoachPayrollReport,
  pdfBytes: Uint8Array
): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error(
      'Payroll email is not configured. Set SMTP_USER, SMTP_PASSWORD, and PAYROLL_FROM_EMAIL.'
    );
  }

  if (!report.email) {
    throw new Error(`No email for ${report.coachName}`);
  }

  const filename = `payroll-${report.periodLabel.replace(/\s+/g, '_')}.pdf`;

  await sendEmail({
    to: report.email,
    subject: `Payroll summary — ${report.periodLabel}`,
    html: buildEmailHtml(report),
    from: getPayrollFromEmail(),
    attachments: [
      {
        filename,
        content: pdfBytes,
        contentType: 'application/pdf',
      },
    ],
  });
}
