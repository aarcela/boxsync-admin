-- Review follow-ups:
-- 1) Unconfigured gyms keep the old booking hard-stop (bookingMode default block).
-- 2) Check-in Block refuses before marking attended (no ±30 minute undo).
-- 3) service_role payment-status does not infer tenant from the first member id.

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

  book := lower(COALESCE(NULLIF(bag ->> 'bookingMode', ''), 'block'));
  IF book NOT IN ('allow', 'warn', 'block') THEN
    book := 'block';
  END IF;

  grace_days := grace;
  checkin_mode := cin;
  booking_mode := book;
  RETURN NEXT;
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
    caller_tenant := NULL;
  END IF;

  RETURN QUERY
  SELECT p.id, private.member_payment_status(p.tenant_id, p.id)
  FROM public.profiles p
  WHERE p.id = ANY (p_member_ids)
    AND (caller_tenant IS NULL OR p.tenant_id = caller_tenant);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_in_athlete(qr_payload text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $$
DECLARE
  result json;
  result_obj jsonb;
  v_uid uuid := auth.uid();
  v_tenant uuid;
  pay jsonb;
BEGIN
  IF v_uid IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = v_uid;
    IF v_tenant IS NOT NULL THEN
      pay := private.member_payment_status(v_tenant, v_uid);
      IF COALESCE((pay ->> 'checkin_blocked')::boolean, false) THEN
        RETURN json_build_object(
          'status', 'error',
          'code', 'blocked_overdue',
          'message', 'Membership overdue. Please pay to check in.',
          'payment_status', pay
        );
      END IF;
    END IF;
  END IF;

  IF to_regprocedure('public.check_in_athlete_core(text)') IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Check-in is unavailable.');
  END IF;

  result := public.check_in_athlete_core(qr_payload);
  result_obj := COALESCE(result::jsonb, '{}'::jsonb);
  IF pay IS NULL THEN
    RETURN result;
  END IF;
  RETURN (result_obj || jsonb_build_object('payment_status', pay))::json;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in_athlete(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.members_payment_status(uuid[]) TO authenticated, service_role;
