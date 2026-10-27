-- Calendar-based member payment status, owner overdue settings, and
-- allow/warn/block gates on book_class / check-in. Grace uses America/Caracas
-- and the same expire math as expire_monthly_memberships.

CREATE OR REPLACE FUNCTION private.read_overdue_settings(p_tenant uuid)
RETURNS TABLE(grace_days integer, checkin_mode text, booking_mode text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  bag jsonb;
  grace integer;
  cin text;
  book text;
BEGIN
  SELECT COALESCE(t.settings -> 'overdue', '{}'::jsonb)
  INTO bag
  FROM public.tenants t
  WHERE t.id = p_tenant;

  IF bag IS NULL THEN
    bag := '{}'::jsonb;
  END IF;

  BEGIN
    grace := (bag ->> 'graceDays')::integer;
  EXCEPTION WHEN others THEN
    grace := NULL;
  END;
  IF grace IS NULL THEN
    grace := 3;
  END IF;
  grace := GREATEST(0, LEAST(15, grace));

  cin := lower(COALESCE(NULLIF(bag ->> 'checkinMode', ''), 'warn'));
  IF cin NOT IN ('allow', 'warn', 'block') THEN
    cin := 'warn';
  END IF;

  book := lower(COALESCE(NULLIF(bag ->> 'bookingMode', ''), 'warn'));
  IF book NOT IN ('allow', 'warn', 'block') THEN
    book := 'warn';
  END IF;

  grace_days := grace;
  checkin_mode := cin;
  booking_mode := book;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION private.member_payment_status(p_tenant uuid, p_member uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
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
BEGIN
  SELECT
    p.id,
    p.tenant_id,
    p.role::text AS role,
    p.plan,
    p.is_solvent,
    p.plan_period_start,
    p.created_at,
    m.name AS plan_name,
    m.limit_type,
    m.validity_days
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
      AND pay.status = 'pending'
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
  ELSE
    IF member_row.limit_type = 'period'
       AND member_row.validity_days IS NOT NULL
       AND member_row.validity_days > 0 THEN
      expires_at := (
        COALESCE(member_row.plan_period_start, member_row.created_at)
        AT TIME ZONE 'America/Caracas'
      )::date + member_row.validity_days;
    ELSE
      IF member_row.plan_period_start IS NOT NULL THEN
        expires_at := (member_row.plan_period_start AT TIME ZONE 'America/Caracas')::date;
      ELSE
        expires_at := (member_row.created_at AT TIME ZONE 'America/Caracas')::date + 31;
      END IF;
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

  flag_status := status_text IN ('in_grace', 'overdue', 'no_plan') OR pending_proof;
  checkin_blocked :=
    settings_row.checkin_mode = 'block'
    AND status_text IN ('overdue', 'no_plan')
    AND NOT pending_proof;
  booking_blocked :=
    settings_row.booking_mode = 'block'
    AND status_text IN ('in_grace', 'overdue', 'no_plan')
    AND NOT pending_proof;
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

CREATE OR REPLACE FUNCTION private.caller_can_read_payment_status(p_tenant uuid, p_member uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  caller_row record;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF auth.uid() = p_member THEN
    RETURN true;
  END IF;

  SELECT tenant_id, role::text AS role
  INTO caller_row
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_row.tenant_id IS DISTINCT FROM p_tenant THEN
    RETURN false;
  END IF;
  RETURN caller_row.role IN ('admin', 'manager', 'coach');
END;
$$;

CREATE OR REPLACE FUNCTION public.member_payment_status(p_tenant uuid, p_member uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $$
BEGIN
  IF NOT private.caller_can_read_payment_status(p_tenant, p_member) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN private.member_payment_status(p_tenant, p_member);
END;
$$;

CREATE OR REPLACE FUNCTION public.members_payment_status(p_member_ids uuid[])
RETURNS TABLE(
  member_id uuid,
  payment jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $$
DECLARE
  caller_tenant uuid;
  caller_role text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    SELECT tenant_id, role::text INTO caller_tenant, caller_role
    FROM public.profiles
    WHERE id = auth.uid();
    IF caller_tenant IS NULL OR caller_role NOT IN ('admin', 'manager', 'coach') THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  ELSE
    SELECT p.tenant_id INTO caller_tenant
    FROM public.profiles p
    WHERE p.id = p_member_ids[1]
    LIMIT 1;
  END IF;

  RETURN QUERY
  SELECT p.id, private.member_payment_status(p.tenant_id, p.id)
  FROM public.profiles p
  WHERE p.id = ANY (p_member_ids)
    AND (caller_tenant IS NULL OR p.tenant_id = caller_tenant);
END;
$$;

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
  today_caracas date := (timezone('America/Caracas', now()))::date;
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
        AND (c.start_time AT TIME ZONE 'America/Caracas')::date = today_caracas
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

REVOKE ALL ON FUNCTION public.member_payment_status(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.members_payment_status(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.overdue_members_today(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.member_payment_status(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.members_payment_status(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.overdue_members_today(uuid) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.checkin_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkin_overrides_tenant_created_idx
  ON public.checkin_overrides (tenant_id, created_at DESC);

ALTER TABLE public.checkin_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkin_overrides_select_staff ON public.checkin_overrides;
CREATE POLICY checkin_overrides_select_staff ON public.checkin_overrides
  FOR SELECT TO authenticated
  USING (public.same_tenant(tenant_id) AND public.is_tenant_staff());

DROP POLICY IF EXISTS checkin_overrides_insert_staff ON public.checkin_overrides;
CREATE POLICY checkin_overrides_insert_staff ON public.checkin_overrides
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_staff()
    AND public.insert_tenant_allowed(tenant_id)
  );

GRANT SELECT, INSERT ON TABLE public.checkin_overrides TO authenticated, service_role;

-- Relax solvency/time-expiry hard-block so warn/allow/grace can book.
-- Pack session limits stay. Calendar expiry is gated by member_payment_status.
CREATE OR REPLACE FUNCTION private.capacity_booking_error(member_id uuid, target_class_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  member_record record;
  class_record record;
  class_is_open_box boolean;
  effective_limit_type public.plan_limit_type;
  period_start timestamptz;
  period_end timestamptz;
  range_start timestamptz;
  range_end timestamptz;
  usage_count integer;
  usage_offset integer;
BEGIN
  SELECT p.tenant_id, p.is_solvent, p.plan, p.plan_period_start,
         p.plan_usage_offset, p.plan_usage_offset_week_start,
         m.name AS plan_name, m.limit_type, m.weekly_limit,
         m.session_limit, m.validity_days
  INTO member_record
  FROM public.profiles p
  LEFT JOIN public.membership_plans m ON m.id = p.plan
  WHERE p.id = member_id;

  SELECT tenant_id, class_type, start_time, is_cancelled
  INTO class_record
  FROM public.classes
  WHERE id = target_class_id;

  IF member_record IS NULL OR class_record IS NULL THEN
    RETURN 'Class or membership was not found.';
  END IF;
  IF member_record.tenant_id IS DISTINCT FROM class_record.tenant_id THEN
    RETURN 'Class is not available for your box.';
  END IF;
  IF class_record.is_cancelled IS TRUE THEN
    RETURN 'This class has been cancelled.';
  END IF;
  IF class_record.start_time <= now() THEN
    RETURN 'This class has already started.';
  END IF;

  SELECT COALESCE(
    (
      SELECT ct.is_open_box
      FROM public.class_types ct
      WHERE ct.tenant_id = class_record.tenant_id
        AND ct.name = class_record.class_type
      LIMIT 1
    ),
    class_record.class_type = 'Open Box'
  ) INTO class_is_open_box;

  IF member_record.plan_name IS NOT NULL
     AND (lower(trim(member_record.plan_name)) LIKE '%open box%'
          OR lower(trim(member_record.plan_name)) = 'open_box')
     AND class_is_open_box IS NOT TRUE THEN
    RETURN 'Your plan is restricted to Open Box hours only.';
  END IF;

  effective_limit_type := COALESCE(
    member_record.limit_type,
    CASE WHEN member_record.weekly_limit IS NOT NULL
              AND member_record.weekly_limit > 0
         THEN 'weekly'::public.plan_limit_type
         ELSE 'none'::public.plan_limit_type END
  );

  IF effective_limit_type = 'weekly'
     AND member_record.weekly_limit IS NOT NULL
     AND member_record.weekly_limit > 0 THEN
    range_start := date_trunc('week', class_record.start_time);
    range_end := range_start + interval '1 week';
    SELECT count(*) INTO usage_count
    FROM public.bookings b
    JOIN public.classes c ON c.id = b.class_id
    WHERE b.user_id = member_id
      AND b.status <> 'no_show'
      AND c.tenant_id = member_record.tenant_id
      AND c.start_time >= range_start
      AND c.start_time < range_end;
    usage_offset := CASE
      WHEN member_record.plan_usage_offset_week_start IS NOT NULL
           AND member_record.plan_usage_offset_week_start = (range_start)::date
      THEN COALESCE(member_record.plan_usage_offset, 0)
      ELSE 0
    END;
    IF usage_count + usage_offset >= member_record.weekly_limit THEN
      RETURN 'Weekly limit reached (' || member_record.weekly_limit || ' sessions).';
    END IF;
  ELSIF effective_limit_type = 'period'
     AND member_record.session_limit IS NOT NULL
     AND member_record.session_limit > 0
     AND member_record.validity_days IS NOT NULL
     AND member_record.validity_days > 0 THEN
    period_start := COALESCE(member_record.plan_period_start, now());
    period_end := period_start + make_interval(days => member_record.validity_days);
    SELECT count(*) INTO usage_count
    FROM public.bookings b
    JOIN public.classes c ON c.id = b.class_id
    WHERE b.user_id = member_id
      AND b.status <> 'no_show'
      AND c.tenant_id = member_record.tenant_id
      AND c.start_time >= period_start
      AND c.start_time < period_end;
    usage_offset := COALESCE(member_record.plan_usage_offset, 0);
    IF usage_count + usage_offset >= member_record.session_limit THEN
      RETURN 'Session pack limit reached (' || member_record.session_limit || ' sessions).';
    END IF;
  END IF;

  RETURN NULL;
END;
$function$;

ALTER FUNCTION private.capacity_booking_error(uuid, uuid) VOLATILE;

CREATE OR REPLACE FUNCTION private.book_class(class_row_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  target_class record;
  booking_error text;
  window_error text;
  current_occupancy integer;
  pay jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Authentication required.');
  END IF;

  SELECT id, tenant_id, max_capacity
  INTO target_class
  FROM public.classes
  WHERE id = class_row_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('status', 'error', 'message', 'Class not found.');
  END IF;

  window_error := private.class_booking_window_error(class_row_id, 'book');
  IF window_error IS NOT NULL THEN
    RETURN json_build_object('status', 'error', 'message', window_error);
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  pay := private.member_payment_status(target_class.tenant_id, auth.uid());
  IF COALESCE((pay ->> 'booking_blocked')::boolean, false) THEN
    RETURN json_build_object(
      'status', 'error',
      'code', 'blocked_overdue',
      'message', 'Membership overdue. Please pay to book.',
      'payment_status', pay
    );
  END IF;

  booking_error := private.capacity_booking_error(auth.uid(), class_row_id);
  IF booking_error IS NOT NULL THEN
    RETURN json_build_object('status', 'error', 'message', booking_error, 'payment_status', pay);
  END IF;

  current_occupancy := public.class_active_occupancy(class_row_id);
  IF current_occupancy >= target_class.max_capacity THEN
    RETURN json_build_object('status', 'error', 'message', 'Class is full.', 'payment_status', pay);
  END IF;

  PERFORM private.initialize_plan_period(auth.uid());
  INSERT INTO public.bookings (user_id, class_id, tenant_id)
  VALUES (auth.uid(), class_row_id, target_class.tenant_id);

  UPDATE public.class_waitlist
  SET status = 'promoted', promoted_at = now(), status_reason = NULL, updated_at = now()
  WHERE class_id = class_row_id AND user_id = auth.uid() AND status = 'active';

  RETURN json_build_object(
    'status', 'success',
    'message', 'Class booked successfully!',
    'payment_status', pay
  );
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('status', 'error', 'message', 'Already booked.', 'payment_status', pay);
END;
$function$;

CREATE OR REPLACE FUNCTION public.book_class(class_row_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $$
  SELECT private.book_class(class_row_id);
$$;

GRANT EXECUTE ON FUNCTION public.book_class(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.join_class_waitlist(class_row_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  target_class record;
  existing_entry record;
  booking_error text;
  window_error text;
  current_occupancy integer;
  new_entry_id uuid;
  queue_position integer;
  pay jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Authentication required.');
  END IF;

  SELECT id, tenant_id, max_capacity
  INTO target_class
  FROM public.classes
  WHERE id = class_row_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('status', 'error', 'message', 'Class not found.');
  END IF;

  window_error := private.class_booking_window_error(class_row_id, 'book');
  IF window_error IS NOT NULL THEN
    RETURN json_build_object('status', 'error', 'message', window_error);
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  pay := private.member_payment_status(target_class.tenant_id, auth.uid());
  IF COALESCE((pay ->> 'booking_blocked')::boolean, false) THEN
    RETURN json_build_object(
      'status', 'error',
      'code', 'blocked_overdue',
      'message', 'Membership overdue. Please pay to book.',
      'payment_status', pay
    );
  END IF;

  booking_error := private.capacity_booking_error(auth.uid(), class_row_id);
  IF booking_error IS NOT NULL THEN
    RETURN json_build_object('status', 'error', 'message', booking_error, 'payment_status', pay);
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE class_id = class_row_id AND user_id = auth.uid()
  ) THEN
    RETURN json_build_object('status', 'error', 'message', 'Already booked.', 'payment_status', pay);
  END IF;

  SELECT id, joined_at INTO existing_entry
  FROM public.class_waitlist
  WHERE class_id = class_row_id AND user_id = auth.uid() AND status = 'active';
  IF FOUND THEN
    SELECT count(*) INTO queue_position
    FROM public.class_waitlist w
    WHERE w.class_id = class_row_id AND w.status = 'active'
      AND (w.joined_at, w.id) <= (existing_entry.joined_at, existing_entry.id);
    RETURN json_build_object(
      'status', 'success', 'action', 'waitlisted',
      'message', 'You are already on the waitlist.', 'position', queue_position,
      'payment_status', pay
    );
  END IF;

  SELECT count(*) INTO current_occupancy
  FROM public.bookings WHERE class_id = class_row_id;
  IF current_occupancy < target_class.max_capacity THEN
    PERFORM private.initialize_plan_period(auth.uid());
    INSERT INTO public.bookings (user_id, class_id, tenant_id)
    VALUES (auth.uid(), class_row_id, target_class.tenant_id);
    RETURN json_build_object(
      'status', 'success', 'action', 'booked',
      'message', 'A spot opened and you were booked.',
      'payment_status', pay
    );
  END IF;

  INSERT INTO public.class_waitlist (tenant_id, class_id, user_id)
  VALUES (target_class.tenant_id, class_row_id, auth.uid())
  RETURNING id INTO new_entry_id;

  SELECT count(*) INTO queue_position
  FROM public.class_waitlist w
  WHERE w.class_id = class_row_id AND w.status = 'active'
    AND (w.joined_at, w.id) <= (
      SELECT joined_at, id FROM public.class_waitlist WHERE id = new_entry_id
    );

  RETURN json_build_object(
    'status', 'success', 'action', 'waitlisted',
    'message', 'Added to the waitlist.', 'position', queue_position,
    'payment_status', pay
  );
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('status', 'error', 'message', 'You are already on the waitlist.', 'payment_status', pay);
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_class_waitlist(class_row_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $$
  SELECT private.join_class_waitlist(class_row_id);
$$;

GRANT EXECUTE ON FUNCTION public.join_class_waitlist(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.promote_class_waitlist(target_class_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  class_record record;
  candidate record;
  booking_error text;
  window_error text;
  current_occupancy integer;
  inserted_rows integer;
  promoted_count integer := 0;
  pay jsonb;
BEGIN
  SELECT id, tenant_id, max_capacity, start_time, is_cancelled
  INTO class_record
  FROM public.classes
  WHERE id = target_class_id
  FOR UPDATE;

  IF NOT FOUND OR class_record.is_cancelled IS TRUE
     OR class_record.start_time <= now() THEN
    RETURN 0;
  END IF;

  window_error := private.class_booking_window_error(target_class_id, 'book');
  IF window_error IS NOT NULL THEN
    RETURN 0;
  END IF;

  LOOP
    current_occupancy := public.class_active_occupancy(target_class_id);
    EXIT WHEN current_occupancy >= class_record.max_capacity;

    SELECT w.id, w.user_id
    INTO candidate
    FROM public.class_waitlist w
    WHERE w.class_id = target_class_id
      AND w.tenant_id = class_record.tenant_id
      AND w.status = 'active'
    ORDER BY w.joined_at, w.id
    FOR UPDATE SKIP LOCKED
    LIMIT 1;
    EXIT WHEN NOT FOUND;

    PERFORM 1 FROM public.profiles
    WHERE id = candidate.user_id
    FOR UPDATE;

    pay := private.member_payment_status(class_record.tenant_id, candidate.user_id);
    IF COALESCE((pay ->> 'booking_blocked')::boolean, false) THEN
      UPDATE public.class_waitlist
      SET status = 'ineligible', status_reason = 'blocked_overdue', updated_at = now()
      WHERE id = candidate.id;
      CONTINUE;
    END IF;

    booking_error := private.capacity_booking_error(candidate.user_id, target_class_id);
    IF booking_error IS NOT NULL THEN
      UPDATE public.class_waitlist
      SET status = 'ineligible', status_reason = booking_error, updated_at = now()
      WHERE id = candidate.id;
      CONTINUE;
    END IF;

    PERFORM private.initialize_plan_period(candidate.user_id);
    INSERT INTO public.bookings (user_id, class_id, tenant_id)
    VALUES (candidate.user_id, target_class_id, class_record.tenant_id)
    ON CONFLICT (user_id, class_id) DO NOTHING;
    GET DIAGNOSTICS inserted_rows = ROW_COUNT;

    UPDATE public.class_waitlist
    SET status = 'promoted', promoted_at = now(), status_reason = NULL, updated_at = now()
    WHERE id = candidate.id;

    IF inserted_rows > 0 THEN
      promoted_count := promoted_count + 1;
    END IF;
  END LOOP;

  RETURN promoted_count;
END;
$function$;

DROP FUNCTION IF EXISTS public.coach_get_roster(uuid);
CREATE OR REPLACE FUNCTION public.coach_get_roster(p_class_id uuid)
RETURNS TABLE(
  id uuid,
  status text,
  user_id uuid,
  full_name text,
  avatar_url text,
  payment_status text,
  days_overdue integer,
  has_pending_proof boolean,
  checkin_blocked boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $$
DECLARE
  pay jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = p_class_id
      AND c.coach_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'coach')
  ) THEN
    RAISE EXCEPTION 'Not authorized for this class';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.status::text,
    b.user_id,
    pr.full_name,
    pr.avatar_url,
    pay.payment ->> 'status',
    COALESCE((pay.payment ->> 'days_overdue')::integer, 0),
    COALESCE((pay.payment ->> 'has_pending_proof')::boolean, false),
    COALESCE((pay.payment ->> 'checkin_blocked')::boolean, false)
  FROM public.bookings b
  JOIN public.profiles pr ON pr.id = b.user_id
  CROSS JOIN LATERAL (
    SELECT private.member_payment_status(pr.tenant_id, pr.id) AS payment
  ) pay
  WHERE b.class_id = p_class_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.coach_get_roster(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.coach_update_booking_status(uuid, text);
DROP FUNCTION IF EXISTS public.coach_update_booking_status(uuid, text, boolean);
CREATE OR REPLACE FUNCTION public.coach_update_booking_status(
  p_booking_id uuid,
  p_status text,
  p_override boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $$
DECLARE
  v_booking record;
  pay jsonb;
BEGIN
  IF p_status NOT IN ('booked', 'attended', 'no_show') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT b.id, b.class_id, b.user_id, b.tenant_id, b.status::text AS status
  INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id;
  IF v_booking.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = v_booking.class_id
      AND c.coach_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'coach')
  ) THEN
    RAISE EXCEPTION 'Not authorized for this booking';
  END IF;

  IF p_status = 'attended' AND v_booking.status IS DISTINCT FROM 'attended' THEN
    pay := private.member_payment_status(v_booking.tenant_id, v_booking.user_id);
    IF COALESCE((pay ->> 'checkin_blocked')::boolean, false) AND NOT COALESCE(p_override, false) THEN
      RAISE EXCEPTION 'blocked_overdue';
    END IF;
    IF COALESCE((pay ->> 'checkin_blocked')::boolean, false) AND COALESCE(p_override, false) THEN
      INSERT INTO public.checkin_overrides (tenant_id, booking_id, member_id, staff_id)
      VALUES (v_booking.tenant_id, v_booking.id, v_booking.user_id, auth.uid());
    END IF;
  END IF;

  UPDATE public.bookings SET status = p_status::attendance_status WHERE id = p_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.coach_update_booking_status(uuid, text, boolean) TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'check_in_athlete'
      AND pg_get_function_identity_arguments(p.oid) = 'text'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'check_in_athlete_core'
  ) THEN
    ALTER FUNCTION public.check_in_athlete(text) RENAME TO check_in_athlete_core;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'check_in_athlete_core'
      AND pg_get_function_identity_arguments(p.oid) = 'text'
  ) THEN
    EXECUTE $wrap$
CREATE OR REPLACE FUNCTION public.check_in_athlete(qr_payload text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $fn$
DECLARE
  result json;
  result_obj jsonb;
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_booking uuid;
  pay jsonb;
BEGIN
  result := public.check_in_athlete_core(qr_payload);
  result_obj := COALESCE(result::jsonb, '{}'::jsonb);

  IF v_uid IS NULL THEN
    RETURN result;
  END IF;

  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = v_uid;
  IF v_tenant IS NULL THEN
    RETURN result;
  END IF;

  pay := private.member_payment_status(v_tenant, v_uid);

  IF (result_obj ->> 'status') IS DISTINCT FROM 'success' THEN
    RETURN (result_obj || jsonb_build_object('payment_status', pay))::json;
  END IF;

  IF COALESCE((pay ->> 'checkin_blocked')::boolean, false) THEN
    SELECT b.id INTO v_booking
    FROM public.bookings b
    JOIN public.classes c ON c.id = b.class_id
    WHERE b.user_id = v_uid
      AND b.status = 'attended'
      AND c.start_time BETWEEN now() - interval '30 minutes' AND now() + interval '30 minutes'
    ORDER BY abs(extract(epoch FROM (c.start_time - now())))
    LIMIT 1;

    IF v_booking IS NOT NULL THEN
      UPDATE public.bookings SET status = 'booked' WHERE id = v_booking AND status = 'attended';
    END IF;

    RETURN json_build_object(
      'status', 'error',
      'code', 'blocked_overdue',
      'message', 'Membership overdue. Please pay to check in.',
      'payment_status', pay
    );
  END IF;

  RETURN (result_obj || jsonb_build_object('payment_status', pay))::json;
END;
$fn$;
    $wrap$;
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.check_in_athlete(text) TO authenticated, service_role';
    EXECUTE 'REVOKE ALL ON FUNCTION public.check_in_athlete_core(text) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.check_in_athlete_core(text) FROM anon, authenticated';
  END IF;
END $$;
