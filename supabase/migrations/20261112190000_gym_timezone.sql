-- Per-gym timezone for billing, expiry and the overdue list.
--
-- Gyms keep their local timezone in tenants.settings.timezone (IANA name, set in the
-- staff dashboard under Settings → Booking). Missing values fall back to America/Caracas,
-- so every existing gym behaves exactly as before until someone picks another zone.
--
-- Function bodies below are the latest versions from:
--   private.member_payment_status     20261027223000_pending_proof_same_tenant_recent.sql
--   public.overdue_members_today       20261026220000_member_payment_status.sql
--   public.expire_monthly_memberships  20260919123000_expire_memberships_tenant_dry_run.sql
-- with only the hard-coded 'America/Caracas' replaced. Rollback: re-run those three files.
-- Not covered here: check_daily_milestones (dedupes, so at most a few hours off for
-- non-Caracas gyms) and the AI quota (intentionally a UTC month).

-- 1) Reject invalid timezone names when settings are written, so readers can trust the value.
CREATE OR REPLACE FUNCTION private.validate_tenant_timezone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $$
DECLARE
  tz text := NULLIF(btrim(NEW.settings ->> 'timezone'), '');
BEGIN
  IF tz IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = tz) THEN
    RAISE EXCEPTION 'Invalid timezone: %', tz USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_validate_timezone ON public.tenants;
CREATE TRIGGER tenants_validate_timezone
  BEFORE INSERT OR UPDATE OF settings ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION private.validate_tenant_timezone();

-- 2) The gym's timezone, defaulting to Caracas.
CREATE OR REPLACE FUNCTION private.gym_timezone(p_tenant uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(btrim(t.settings ->> 'timezone'), '') FROM public.tenants t WHERE t.id = p_tenant),
    'America/Caracas'
  );
$$;

REVOKE ALL ON FUNCTION private.gym_timezone(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.validate_tenant_timezone() FROM PUBLIC;

-- 3) Payment status (overdue, grace, booking/check-in blocks) on the gym's calendar.
CREATE OR REPLACE FUNCTION private.member_payment_status(p_tenant uuid, p_member uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  pending_proof_max_days constant integer := 7;
  gym_tz text := private.gym_timezone(p_tenant);
  today_local date := (timezone(private.gym_timezone(p_tenant), now()))::date;
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
      AND (timezone(gym_tz, pay.created_at))::date
            >= today_local - pending_proof_max_days
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
        AT TIME ZONE gym_tz
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
        CASE WHEN expires_at IS NOT NULL THEN today_local - expires_at ELSE 0 END
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
    ELSIF today_local < expires_at THEN
      days_over := 0;
      IF member_row.is_solvent IS NOT TRUE THEN
        status_text := 'overdue';
        reason_text := 'revoked';
      ELSE
        status_text := 'ok';
        reason_text := 'ok';
      END IF;
    ELSE
      days_over := GREATEST(0, today_local - expires_at);
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
      expires_at := (member_row.plan_period_start AT TIME ZONE gym_tz)::date;
    ELSE
      expires_at := (member_row.created_at AT TIME ZONE gym_tz)::date + 31;
    END IF;

    days_over := GREATEST(0, today_local - expires_at);

    IF today_local < expires_at THEN
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

-- 4) Home's overdue list on the gym's calendar.
CREATE OR REPLACE FUNCTION public.overdue_members_today(p_tenant uuid)
RETURNS TABLE(
  member_id uuid,
  full_name text,
  avatar_url text,
  plan_name text,
  days_overdue integer,
  expires_at date,
  has_booking_today boolean,
  payment_status text,
  has_pending_proof boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $$
DECLARE
  gym_tz text := private.gym_timezone(p_tenant);
  today_local date := (timezone(private.gym_timezone(p_tenant), now()))::date;
  caller_role text;
  caller_tenant uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    SELECT tenant_id, role::text INTO caller_tenant, caller_role
    FROM public.profiles
    WHERE id = auth.uid();
    IF caller_tenant IS DISTINCT FROM p_tenant OR caller_role NOT IN ('admin', 'manager') THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    pay.payment ->> 'plan_name',
    COALESCE((pay.payment ->> 'days_overdue')::integer, 0),
    (pay.payment ->> 'expires_at')::date,
    EXISTS (
      SELECT 1
      FROM public.bookings b
      JOIN public.classes c ON c.id = b.class_id
      WHERE b.user_id = p.id
        AND b.status IN ('booked', 'attended')
        AND (c.start_time AT TIME ZONE gym_tz)::date = today_local
    ),
    pay.payment ->> 'status',
    COALESCE((pay.payment ->> 'has_pending_proof')::boolean, false)
  FROM public.profiles p
  CROSS JOIN LATERAL (
    SELECT private.member_payment_status(p.tenant_id, p.id) AS payment
  ) pay
  WHERE p.tenant_id = p_tenant
    AND p.role::text = 'member'
    AND (pay.payment ->> 'status') IN ('overdue', 'no_plan')
  ORDER BY COALESCE((pay.payment ->> 'days_overdue')::integer, 0) DESC, p.full_name;
END;
$$;

-- 5) Expiry job: each member's "today" comes from their own gym.
CREATE OR REPLACE FUNCTION public.expire_monthly_memberships(
  p_tenant_id uuid DEFAULT NULL,
  p_dry_run boolean DEFAULT false
) RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO public, pg_temp
AS $$
DECLARE
  expired_ids uuid[] := ARRAY[]::uuid[];
  affected_rows int := 0;
BEGIN
  SELECT COALESCE(array_agg(p.id), ARRAY[]::uuid[]), COUNT(*)::int
  INTO expired_ids, affected_rows
  FROM public.profiles p
  LEFT JOIN public.membership_plans mp ON mp.id = p.plan
  CROSS JOIN LATERAL (
    SELECT private.gym_timezone(p.tenant_id) AS tz
  ) gym
  WHERE p.role::text = 'member'
    AND p.is_solvent = true
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    AND (
      (
        mp.limit_type = 'period'
        AND mp.validity_days IS NOT NULL
        AND mp.validity_days > 0
        AND (
          (COALESCE(p.plan_period_start, p.created_at) AT TIME ZONE gym.tz)::date
          + mp.validity_days
        ) <= (timezone(gym.tz, now()))::date
      )
      OR
      (
        (mp.limit_type IS DISTINCT FROM 'period')
        AND (
          CASE
            WHEN p.plan_period_start IS NOT NULL THEN
              (p.plan_period_start AT TIME ZONE gym.tz)::date
            ELSE
              (p.created_at AT TIME ZONE gym.tz)::date + 31
          END
        ) <= (timezone(gym.tz, now()))::date
      )
    );

  IF NOT p_dry_run AND cardinality(expired_ids) > 0 THEN
    UPDATE public.profiles
    SET is_solvent = false
    WHERE id = ANY(expired_ids)
      AND is_solvent = true;
  END IF;

  RETURN json_build_object(
    'status', 'success',
    'dry_run', p_dry_run,
    'message', CASE
      WHEN affected_rows = 0 THEN 'No memberships to expire.'
      WHEN p_dry_run THEN 'Due memberships: ' || affected_rows || '.'
      ELSE 'Processed expiry for ' || affected_rows || ' members.'
    END,
    'count', affected_rows,
    'user_ids', to_json(expired_ids),
    'timestamp', now()
  );
END;
$$;
