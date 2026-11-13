-- Let box staff (admin/manager) run the coach roster from the athlete app for ANY class
-- in their own tenant, not only classes where they are the assigned coach.
-- Coaches keep the existing rule (own classes only). Guest RPCs already allow staff.

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
      AND public.same_tenant(c.tenant_id)
      AND (
        (c.coach_id = auth.uid()
          AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
        OR public.is_tenant_staff()
      )
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
      AND public.same_tenant(c.tenant_id)
      AND (
        (c.coach_id = auth.uid()
          AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'coach'))
        OR public.is_tenant_staff()
      )
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

-- ---------------------------------------------------------------------------
-- Add an existing MEMBER to a class from the app roster (coach of the class or
-- tenant staff). Mirrors coach_add_guest_to_class: same tenant, capacity via
-- class_active_occupancy (members + guests), no duplicate booking.
-- Payment rules still apply later at check-in (coach_update_booking_status).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.coach_search_members(
  p_class_id uuid,
  p_query text DEFAULT '',
  p_limit integer DEFAULT 20
)
RETURNS TABLE(id uuid, full_name text, avatar_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_coach_id uuid;
  v_tenant_id uuid;
  v_query text := nullif(trim(COALESCE(p_query, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT c.coach_id, c.tenant_id INTO v_coach_id, v_tenant_id
  FROM public.classes c
  WHERE c.id = p_class_id;

  IF v_tenant_id IS NULL OR NOT public.same_tenant(v_tenant_id) THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  IF v_coach_id IS DISTINCT FROM auth.uid() AND NOT public.is_tenant_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.avatar_url
  FROM public.profiles p
  WHERE p.tenant_id = v_tenant_id
    AND p.role = 'member'
    AND (v_query IS NULL OR p.full_name ILIKE '%' || v_query || '%')
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.class_id = p_class_id AND b.user_id = p.id
    )
  ORDER BY p.full_name
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
END;
$$;
GRANT EXECUTE ON FUNCTION public.coach_search_members(uuid, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.coach_add_member_to_class(
  p_class_id uuid,
  p_member_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_coach_id uuid;
  v_tenant_id uuid;
  v_max_capacity integer;
  v_booking_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT c.coach_id, c.tenant_id, c.max_capacity
  INTO v_coach_id, v_tenant_id, v_max_capacity
  FROM public.classes c
  WHERE c.id = p_class_id;

  IF v_tenant_id IS NULL OR NOT public.same_tenant(v_tenant_id) THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  IF v_coach_id IS DISTINCT FROM auth.uid() AND NOT public.is_tenant_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_member_id AND p.tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Athlete not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.class_id = p_class_id AND b.user_id = p_member_id
  ) THEN
    RAISE EXCEPTION 'already_booked';
  END IF;

  IF public.class_active_occupancy(p_class_id) >= COALESCE(v_max_capacity, 0) THEN
    RAISE EXCEPTION 'class_full';
  END IF;

  INSERT INTO public.bookings (class_id, user_id, status, tenant_id)
  VALUES (p_class_id, p_member_id, 'booked', v_tenant_id)
  RETURNING id INTO v_booking_id;

  RETURN json_build_object('id', v_booking_id, 'status', 'booked');
END;
$$;
GRANT EXECUTE ON FUNCTION public.coach_add_member_to_class(uuid, uuid) TO authenticated;
