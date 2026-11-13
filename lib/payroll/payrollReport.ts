import type { PayrollClass } from '@/lib/types/gym';
import {
  getCaracasWeekRange,
  getGymDateFromIso,
  getGymTimeLabel,
} from '@/lib/utils/date';
import { DEFAULT_GYM_TIMEZONE } from '@/lib/gym-timezone';

export interface PayrollClassLine {
  date: string;
  time: string;
  classType: string;
  rateUsd: number;
}

export interface CoachPayrollReport {
  coachId: string;
  coachName: string;
  email: string | null;
  periodLabel: string;
  lines: PayrollClassLine[];
  totalUsd: number;
  /** Currency code the rates are set in (the gym's reference currency). */
  currency: string;
}

export function buildCoachPayrollReports(
  classes: PayrollClass[],
  periodLabel: string,
  currency = 'USD',
  tz: string = DEFAULT_GYM_TIMEZONE,
): CoachPayrollReport[] {
  const byCoach: Record<string, CoachPayrollReport> = {};

  classes
    .filter((c) => c.payrollStatus === 'confirmed' && c.coach?.id)
    .forEach((c) => {
      const coachId = c.coach!.id;
      if (!byCoach[coachId]) {
        byCoach[coachId] = {
          coachId,
          coachName: c.coach!.full_name,
          email: null,
          periodLabel,
          lines: [],
          totalUsd: 0,
          currency,
        };
      }

      const rate = c.payRateUsd ?? 0;
      byCoach[coachId].lines.push({
        date: getGymDateFromIso(c.start_time, tz),
        time: getGymTimeLabel(c.start_time, tz),
        classType: c.class_type,
        rateUsd: rate,
      });
      byCoach[coachId].totalUsd += rate;
    });

  return Object.values(byCoach)
    .map((report) => ({
      ...report,
      lines: report.lines.sort((a, b) =>
        `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
      ),
    }))
    .sort((a, b) => a.coachName.localeCompare(b.coachName));
}

export function getPayrollPeriodLabel(
  filterMode: 'day' | 'week' | 'month' | 'custom',
  anchorDate: string,
  monthValue: string,
  customStart: string,
  customEnd: string
): string {
  switch (filterMode) {
    case 'day':
      return anchorDate;
    case 'week': {
      const { startDate, endDate } = getCaracasWeekRange(anchorDate);
      return `${startDate} — ${endDate}`;
    }
    case 'month':
      return monthValue;
    case 'custom':
      return `${customStart} — ${customEnd}`;
  }
}
