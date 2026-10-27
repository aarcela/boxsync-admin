export type MemberPaymentStatusKind = 'ok' | 'pending_review' | 'in_grace' | 'overdue' | 'no_plan';

export type MemberPaymentReason = 'ok' | 'pending_review' | 'expired' | 'unpaid' | 'revoked' | 'no_plan';

export type MemberPaymentStatus = {
  status: MemberPaymentStatusKind;
  reason: MemberPaymentReason;
  days_overdue: number;
  expires_at: string | null;
  has_pending_proof: boolean;
  plan_name: string | null;
  checkin_mode?: string;
  booking_mode?: string;
  checkin_blocked: boolean;
  booking_blocked: boolean;
  checkin_alert?: boolean;
  booking_alert?: boolean;
};

export type OverdueMemberToday = {
  member_id: string;
  full_name: string | null;
  avatar_url: string | null;
  plan_name: string | null;
  days_overdue: number;
  expires_at: string | null;
  has_booking_today: boolean;
  payment_status: MemberPaymentStatusKind;
  has_pending_proof: boolean;
};

function asBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 't';
}

export function parseMemberPaymentStatus(value: unknown): MemberPaymentStatus | null {
  if (typeof value === 'string') {
    try {
      return parseMemberPaymentStatus(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const bag = value as Record<string, unknown>;
  const status = bag.status;
  if (
    status !== 'ok' &&
    status !== 'pending_review' &&
    status !== 'in_grace' &&
    status !== 'overdue' &&
    status !== 'no_plan'
  ) {
    return null;
  }
  return {
    status,
    reason:
      bag.reason === 'pending_review' ||
      bag.reason === 'expired' ||
      bag.reason === 'unpaid' ||
      bag.reason === 'revoked' ||
      bag.reason === 'no_plan'
        ? bag.reason
        : 'ok',
    days_overdue: typeof bag.days_overdue === 'number' ? bag.days_overdue : Number(bag.days_overdue) || 0,
    expires_at: typeof bag.expires_at === 'string' ? bag.expires_at : null,
    has_pending_proof: asBool(bag.has_pending_proof),
    plan_name: typeof bag.plan_name === 'string' ? bag.plan_name : null,
    checkin_mode: typeof bag.checkin_mode === 'string' ? bag.checkin_mode : undefined,
    booking_mode: typeof bag.booking_mode === 'string' ? bag.booking_mode : undefined,
    checkin_blocked: asBool(bag.checkin_blocked),
    booking_blocked: asBool(bag.booking_blocked),
    checkin_alert: asBool(bag.checkin_alert),
    booking_alert: asBool(bag.booking_alert),
  };
}

export function isCheckinBlocked(status: MemberPaymentStatus | null | undefined): boolean {
  return Boolean(status?.checkin_blocked);
}
