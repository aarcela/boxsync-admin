import { NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/require-staff-api';
import { payrollService } from '@/lib/services/payrollService';
import { buildCoachPayrollReports } from '@/lib/payroll/payrollReport';
import { generateCoachPayrollPdf } from '@/lib/payroll/generatePayrollPdf';
import { sendCoachPayrollEmail } from '@/lib/email/payrollEmail';
import { attachCoachAuthEmails } from '@/lib/payroll/coachEmails';
import { parseTenantCurrencyConfig } from '@/lib/currency';
import { parseGymTimezone } from '@/lib/gym-timezone';

export async function POST(request: Request) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  if (staffAuth.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tenantId = staffAuth.profile.tenant_id as string | null;
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant context.' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { startUtc, endUtc, periodLabel } = body;

    if (!startUtc || !endUtc || !periodLabel) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [classes, { data: tenantRow }] = await Promise.all([
      payrollService.getPayrollClasses(tenantId, startUtc, endUtc),
      staffAuth.supabase.from('tenants').select('settings').eq('id', tenantId).maybeSingle(),
    ]);
    const currency = parseTenantCurrencyConfig(tenantRow?.settings).reference;
    const tz = parseGymTimezone(tenantRow?.settings);
    const reports = await attachCoachAuthEmails(
      buildCoachPayrollReports(classes, periodLabel, currency, tz)
    );

    if (reports.length === 0) {
      return NextResponse.json(
        { error: 'No confirmed classes with assigned coaches in this period.' },
        { status: 400 }
      );
    }

    const sent: string[] = [];
    const skipped: { name: string; reason: string }[] = [];
    const failed: { name: string; reason: string }[] = [];

    for (const report of reports) {
      if (!report.email) {
        skipped.push({ name: report.coachName, reason: 'No email on file' });
        continue;
      }

      try {
        const pdf = generateCoachPayrollPdf(report);
        await sendCoachPayrollEmail(report, pdf);
        sent.push(report.coachName);
      } catch (err) {
        failed.push({
          name: report.coachName,
          reason: err instanceof Error ? err.message : 'Send failed',
        });
      }
    }

    return NextResponse.json({ sent, skipped, failed });
  } catch (error: unknown) {
    console.error('Payroll email error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
