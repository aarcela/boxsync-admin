import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import {
  CoachSalaryTier,
  PayrollClass,
  PayrollClassStatus,
} from '../types/gym';
import { coachSalaryService } from './coachSalaryService';

export function resolvePayrollStatus(c: {
  is_cancelled: boolean;
  payroll_confirmed: boolean;
}): PayrollClassStatus {
  if (c.is_cancelled) return 'cancelled';
  if (c.payroll_confirmed) return 'confirmed';
  return 'pending';
}

export function resolvePayRate(
  classType: string,
  coachTierId: string | null | undefined,
  tiers: CoachSalaryTier[]
): number | null {
  if (!coachTierId) return null;
  const tier = tiers.find((t) => t.id === coachTierId);
  if (!tier?.rates) return null;
  const rate = tier.rates.find((r) => r.class_type === classType);
  return rate?.rate_usd ?? null;
}

function normalizeCoach(raw: unknown): PayrollClass['coach'] {
  if (!raw) return null;
  const coach = Array.isArray(raw) ? raw[0] : raw;
  if (!coach || typeof coach !== 'object') return null;
  const c = coach as {
    id: string;
    full_name: string;
    salary_tier_id: string | null;
  };
  return {
    id: c.id,
    full_name: c.full_name,
    salary_tier_id: c.salary_tier_id ?? null,
  };
}

function enrichPayrollClass(
  row: Record<string, unknown>,
  tiers: CoachSalaryTier[]
): PayrollClass {
  const coach = normalizeCoach(row.coach);
  const is_cancelled = Boolean(row.is_cancelled);
  const payroll_confirmed = Boolean(row.payroll_confirmed);
  const payrollStatus = resolvePayrollStatus({ is_cancelled, payroll_confirmed });
  const payRateUsd =
    payrollStatus === 'confirmed'
      ? resolvePayRate(String(row.class_type), coach?.salary_tier_id, tiers)
      : null;

  return {
    id: row.id as string,
    start_time: row.start_time as string,
    end_time: row.end_time as string,
    class_type: row.class_type as string,
    is_cancelled,
    payroll_confirmed,
    coach_id: (row.coach_id as string | null) ?? coach?.id ?? null,
    coach,
    bookings: (row.bookings as { count: number }[]) ?? [],
    payrollStatus,
    payRateUsd,
  };
}

function statusToDbFields(status: PayrollClassStatus): {
  is_cancelled: boolean;
  payroll_confirmed: boolean;
} {
  switch (status) {
    case 'confirmed':
      return { is_cancelled: false, payroll_confirmed: true };
    case 'cancelled':
      return { is_cancelled: true, payroll_confirmed: false };
    default:
      return { is_cancelled: false, payroll_confirmed: false };
  }
}

export const payrollService = {
  async getPayrollClasses(
    tenantId: string,
    startUtc: string,
    endUtc: string,
    coachId?: string | null
  ): Promise<PayrollClass[]> {
    const [tiers, classesResult] = await Promise.all([
      coachSalaryService.getTiersWithRates(tenantId),
      (async () => {
        let query = supabase
          .from('classes')
          .select(
            `
            id,
            start_time,
            end_time,
            class_type,
            is_cancelled,
            payroll_confirmed,
            coach_id,
            coach:profiles!coach_id(id, full_name, salary_tier_id),
            bookings:bookings(count)
          `
          )
          .gte('start_time', startUtc)
          .lte('start_time', endUtc)
          .order('start_time', { ascending: true });

        if (coachId) {
          query = query.eq('coach_id', coachId);
        }

        return query;
      })(),
    ]);

    const { data, error } = classesResult;
    if (error) throw error;

    return (data ?? []).map((row) =>
      enrichPayrollClass(row as Record<string, unknown>, tiers)
    );
  },

  async updatePayrollStatus(
    client: SupabaseClient,
    classId: string,
    status: PayrollClassStatus
  ): Promise<void> {
    const fields = statusToDbFields(status);
    const { error } = await client
      .from('classes')
      .update(fields)
      .eq('id', classId);

    if (error) throw error;
  },
};
