-- Pending proofs only unblock when they belong to this gym and are recent.
-- Older or other-gym pending rows are ignored (not auto-rejected).
-- Pack / session-limit expiry is unchanged from 20261027210000.

CREATE OR REPLACE FUNCTION private.member_payment_status(p_tenant uuid, p_member uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  pending_proof_max_days constant integer := 7;
  today_caracas date := (timezone('America/Caracas', now()))::date;
  member_row record;
  settings_row record;
  expires_at date;
  days_over integer := 0;
  status_text text := 'ok';
  reason_text text := 'ok';
  pending_proof boolean := false;
  checkin_blocked boolean := false;
  booking_blocked boolean := false;
  checkin_alert boolean := false;
  booking_alert boolean := false;
  flag_status boolean := false;
  remaining integer;
  usage_count integer := 0;
  usage_offset integer := 0;
  period_start timestamptz;
  period_end timestamptz;
BEGIN
  SELECT
    p.id,
    p.tenant_id,
    p.role::text AS role,
    p.plan,
    p.is_solvent,
    p.plan_period_start,
    p.created_at,
    p.plan_usage_offset,
    m.name AS plan_name,
    m.limit_type,
    m.validity_days,
    m.session_limit
  INTO member_row
  FROM public.profiles p
  LEFT JOIN public.membership_plans m ON m.id = p.plan
  WHERE p.id = p_member;

  IF member_row.id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
  IF member_row.tenant_id IS DISTINCT FROM p_tenant THEN
    RAISE EXCEPTION 'Tenant mismatch';
  END IF;

  SELECT * INTO settings_row FROM private.read_overdue_settings(p_tenant);

  SELECT EXISTS (
    SELECT 1
    FROM public.payments pay
    WHERE pay.user_id = p_member
      AND pay.tenant_id = p_tenant
      AND pay.status = 'pending'
      AND (timezone('America/Caracas', pay.created_at))::date
            >= today_caracas - pending_proof_max_days
  ) INTO pending_proof;

  IF member_row.role IS DISTINCT FROM 'member' AND member_row.plan IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'reason', 'ok',
      'days_overdue', 0,
      'expires_at', NULL,
      'has_pending_proof', pending_proof,
      'plan_name', member_row.plan_name,
      'checkin_mode', settings_row.checkin_mode,
      'booking_mode', settings_row.booking_mode,
      'checkin_blocked', false,
      'booking_blocked', false,
      'checkin_alert', false,
      'booking_alert', false
    );
  END IF;

  IF member_row.plan IS NULL THEN
    status_text := 'no_plan';
    reason_text := 'no_plan';
  ELSIF member_row.limit_type = 'period' THEN
    -- Packs: never use plan_period_start as the expiry date.
    IF member_row.validity_days IS NOT NULL AND member_row.validity_days > 0 THEN
      expires_at := (
        COALESCE(member_row.plan_period_start, member_row.created_at)
        AT TIME ZONE 'America/Caracas'
      )::date + member_row.validity_days;
    ELSE
      expires_at := NULL;
    END IF;

    IF member_row.session_limit IS NOT NULL AND member_row.session_limit > 0 THEN
      period_start := COALESCE(member_row.plan_period_start, member_row.created_at);
      IF member_row.validity_days IS NOT NULL AND member_row.validity_days > 0 THEN
        period_end := period_start + make_interval(days => member_row.validity_days);
        SELECT count(*) INTO usage_count
        FROM public.bookings b
        JOIN public.classes c ON c.id = b.class_id
        WHERE b.user_id = p_member
          AND b.status <> 'no_show'
          AND c.tenant_id = p_tenant
          AND c.start_time >= period_start
          AND c.start_time < period_end;
      ELSE
        SELECT count(*) INTO usage_count
        FROM public.bookings b
        JOIN public.classes c ON c.id = b.class_id
        WHERE b.user_id = p_member
          AND b.status <> 'no_show'
          AND c.tenant_id = p_tenant
          AND c.start_time >= period_start;
      END IF;
      usage_offset := COALESCE(member_row.plan_usage_offset, 0);
      remaining := member_row.session_limit - usage_count - usage_offset;
    END IF;

    IF remaining IS NOT NULL AND remaining <= 0 THEN
      status_text := 'overdue';
      reason_text := 'expired';
      days_over := GREATEST(
        0,
        CASE WHEN expires_at IS NOT NULL THEN today_caracas - expires_at ELSE 0 END
      );
    ELSIF expires_at IS NULL THEN
      days_over := 0;
      IF member_row.is_solvent IS NOT TRUE THEN
        status_text := 'overdue';
        reason_text := 'revoked';
      ELSE
        status_text := 'ok';
        reason_text := 'ok';
      END IF;
    ELSIF today_caracas < expires_at THEN
      days_over := 0;
      IF member_row.is_solvent IS NOT TRUE THEN
        status_text := 'overdue';
        reason_text := 'revoked';
      ELSE
        status_text := 'ok';
        reason_text := 'ok';
      END IF;
    ELSE
      days_over := GREATEST(0, today_caracas - expires_at);
      IF days_over <= settings_row.grace_days THEN
        status_text := 'in_grace';
        reason_text := 'expired';
      ELSE
        status_text := 'overdue';
        reason_text := CASE
          WHEN member_row.is_solvent IS NOT TRUE THEN 'unpaid'
          ELSE 'expired'
        END;
      END IF;
    END IF;
  ELSE
    -- weekly / none: same calendar end as expire_monthly_memberships.
    IF member_row.plan_period_start IS NOT NULL THEN
      expires_at := (member_row.plan_period_start AT TIME ZONE 'America/Caracas')::date;
    ELSE
      expires_at := (member_row.created_at AT TIME ZONE 'America/Caracas')::date + 31;
    END IF;

    days_over := GREATEST(0, today_caracas - expires_at);

    IF today_caracas < expires_at THEN
      IF member_row.is_solvent IS NOT TRUE THEN
        status_text := 'overdue';
        reason_text := 'revoked';
      ELSE
        status_text := 'ok';
        reason_text := 'ok';
      END IF;
    ELSIF days_over <= settings_row.grace_days THEN
      status_text := 'in_grace';
      reason_text := 'expired';
    ELSE
      status_text := 'overdue';
      reason_text := CASE
        WHEN member_row.is_solvent IS NOT TRUE THEN 'unpaid'
        ELSE 'expired'
      END;
    END IF;
  END IF;

  IF pending_proof THEN
    status_text := 'pending_review';
    reason_text := 'pending_review';
  END IF;

  flag_status := status_text IN ('pending_review', 'in_grace', 'overdue', 'no_plan');
  checkin_blocked :=
    settings_row.checkin_mode = 'block'
    AND status_text IN ('overdue', 'no_plan');
  booking_blocked :=
    settings_row.booking_mode = 'block'
    AND status_text IN ('overdue', 'no_plan');
  checkin_alert := settings_row.checkin_mode <> 'allow' AND flag_status;
  booking_alert := settings_row.booking_mode <> 'allow' AND flag_status;

  RETURN jsonb_build_object(
    'status', status_text,
    'reason', reason_text,
    'days_overdue', days_over,
    'expires_at', expires_at,
    'has_pending_proof', pending_proof,
    'plan_name', member_row.plan_name,
    'checkin_mode', settings_row.checkin_mode,
    'booking_mode', settings_row.booking_mode,
    'checkin_blocked', checkin_blocked,
    'booking_blocked', booking_blocked,
    'checkin_alert', checkin_alert,
    'booking_alert', booking_alert
  );
END;
$$;
