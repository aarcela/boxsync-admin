import { supabaseAdmin } from '@/lib/supabase-admin';
import type { CoachPayrollReport } from '@/lib/payroll/payrollReport';

export async function attachCoachAuthEmails(
  reports: CoachPayrollReport[]
): Promise<CoachPayrollReport[]> {
  return Promise.all(
    reports.map(async (report) => {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(report.coachId);
      if (error) {
        console.error(`Failed to load email for coach ${report.coachId}:`, error);
        return { ...report, email: null };
      }
      return { ...report, email: data.user?.email ?? null };
    })
  );
}
