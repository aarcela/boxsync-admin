-- Guest / trial athletes: lightweight non-member records + per-class bookings.
-- Guests with status booked|attended count toward class max_capacity (with member bookings).
-- They do not enter waitlist and have no auth / solvency / plan.

BEGIN;

CREATE TABLE IF NOT EXISTS public.guest_athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  whatsapp text,
  instagram text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guest_athletes_name_nonempty CHECK (length(trim(full_name)) > 0)
);

CREATE INDEX IF NOT EXISTS guest_athletes_tenant_created_idx
  ON public.guest_athletes (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS guest_athletes_tenant_name_idx
  ON public.guest_athletes (tenant_id, lower(full_name));

CREATE TABLE IF NOT EXISTS public.guest_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  guest_athlete_id uuid NOT NULL REFERENCES public.guest_athletes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'booked'
    CHECK (status IN ('booked', 'attended', 'no_show')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guest_bookings_class_guest_unique UNIQUE (class_id, guest_athlete_id)
);

CREATE INDEX IF NOT EXISTS guest_bookings_class_status_idx
  ON public.guest_bookings (class_id, status);

CREATE INDEX IF NOT EXISTS guest_bookings_tenant_idx
  ON public.guest_bookings (tenant_id);

-- Keep tenant tables on the standard profile-derived tenant_id trigger set.
SELECT public.sync_tenant_id_triggers();

CREATE OR REPLACE FUNCTION public.class_active_occupancy(p_class_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT
    COALESCE((
      SELECT count(*)::integer
      FROM public.bookings b
      WHERE b.class_id = p_class_id
        AND b.status IN ('booked', 'attended')
    ), 0)
    +
    COALESCE((
      SELECT count(*)::integer
      FROM public.guest_bookings gb
      WHERE gb.class_id = p_class_id
        AND gb.status IN ('booked', 'attended')
    ), 0);
$$;

REVOKE ALL ON FUNCTION public.class_active_occupancy(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.class_active_occupancy(uuid) TO authenticated, service_role;

ALTER TABLE public.guest_athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guest_athletes_select_tenant ON public.guest_athletes;
CREATE POLICY guest_athletes_select_tenant ON public.guest_athletes
  FOR SELECT TO authenticated
  USING (public.same_tenant(tenant_id));

DROP POLICY IF EXISTS guest_athletes_insert_staff ON public.guest_athletes;
CREATE POLICY guest_athletes_insert_staff ON public.guest_athletes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_staff()
    AND public.insert_tenant_allowed(tenant_id)
  );

DROP POLICY IF EXISTS guest_athletes_update_staff ON public.guest_athletes;
CREATE POLICY guest_athletes_update_staff ON public.guest_athletes
  FOR UPDATE TO authenticated
  USING (public.same_tenant(tenant_id) AND public.is_tenant_staff())
  WITH CHECK (public.insert_tenant_allowed(tenant_id));

DROP POLICY IF EXISTS guest_athletes_delete_staff ON public.guest_athletes;
CREATE POLICY guest_athletes_delete_staff ON public.guest_athletes
  FOR DELETE TO authenticated
  USING (public.same_tenant(tenant_id) AND public.is_tenant_staff());

DROP POLICY IF EXISTS guest_bookings_select_tenant ON public.guest_bookings;
CREATE POLICY guest_bookings_select_tenant ON public.guest_bookings
  FOR SELECT TO authenticated
  USING (public.same_tenant(tenant_id));

DROP POLICY IF EXISTS guest_bookings_insert_staff ON public.guest_bookings;
CREATE POLICY guest_bookings_insert_staff ON public.guest_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_staff()
    AND public.insert_tenant_allowed(tenant_id)
  );

DROP POLICY IF EXISTS guest_bookings_update_staff ON public.guest_bookings;
CREATE POLICY guest_bookings_update_staff ON public.guest_bookings
  FOR UPDATE TO authenticated
  USING (public.same_tenant(tenant_id) AND public.is_tenant_staff())
  WITH CHECK (public.insert_tenant_allowed(tenant_id));

DROP POLICY IF EXISTS guest_bookings_delete_staff ON public.guest_bookings;
CREATE POLICY guest_bookings_delete_staff ON public.guest_bookings
  FOR DELETE TO authenticated
  USING (public.same_tenant(tenant_id) AND public.is_tenant_staff());

-- Coach / staff helpers for the athlete app (mirror coach_get_roster style).
CREATE OR REPLACE FUNCTION public.coach_list_class_guests(p_class_id uuid)
RETURNS TABLE (
  id uuid,
  status text,
  guest_athlete_id uuid,
  full_name text,
  whatsapp text,
  instagram text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_coach_id uuid;
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT c.coach_id, c.tenant_id INTO v_coach_id, v_tenant_id
  FROM public.classes c
  WHERE c.id = p_class_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  IF NOT public.same_tenant(v_tenant_id) THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  IF v_coach_id IS DISTINCT FROM auth.uid() AND NOT public.is_tenant_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  RETURN QUERY
  SELECT
    gb.id,
    gb.status,
    ga.id AS guest_athlete_id,
    ga.full_name,
    ga.whatsapp,
    ga.instagram
  FROM public.guest_bookings gb
  JOIN public.guest_athletes ga ON ga.id = gb.guest_athlete_id
  WHERE gb.class_id = p_class_id
  ORDER BY ga.full_name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.coach_add_guest_to_class(
  p_class_id uuid,
  p_full_name text,
  p_whatsapp text DEFAULT NULL,
  p_instagram text DEFAULT NULL,
  p_guest_athlete_id uuid DEFAULT NULL
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
  v_guest_id uuid;
  v_name text;
  v_whatsapp text;
  v_instagram text;
  v_booking public.guest_bookings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_name := nullif(trim(COALESCE(p_full_name, '')), '');
  v_whatsapp := nullif(trim(COALESCE(p_whatsapp, '')), '');
  v_instagram := nullif(trim(COALESCE(p_instagram, '')), '');

  IF p_guest_athlete_id IS NULL AND v_name IS NULL THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  SELECT c.coach_id, c.tenant_id, c.max_capacity
  INTO v_coach_id, v_tenant_id, v_max_capacity
  FROM public.classes c
  WHERE c.id = p_class_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  IF NOT public.same_tenant(v_tenant_id) THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  IF v_coach_id IS DISTINCT FROM auth.uid() AND NOT public.is_tenant_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF public.class_active_occupancy(p_class_id) >= COALESCE(v_max_capacity, 0) THEN
    RAISE EXCEPTION 'Class is at full capacity';
  END IF;

  IF p_guest_athlete_id IS NOT NULL THEN
    SELECT ga.id INTO v_guest_id
    FROM public.guest_athletes ga
    WHERE ga.id = p_guest_athlete_id
      AND ga.tenant_id = v_tenant_id;

    IF v_guest_id IS NULL THEN
      RAISE EXCEPTION 'Guest not found';
    END IF;
  ELSE
    INSERT INTO public.guest_athletes (
      tenant_id, full_name, whatsapp, instagram, created_by
    ) VALUES (
      v_tenant_id, v_name, v_whatsapp, v_instagram, auth.uid()
    )
    RETURNING id INTO v_guest_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.guest_bookings gb
    WHERE gb.class_id = p_class_id AND gb.guest_athlete_id = v_guest_id
  ) THEN
    RAISE EXCEPTION 'Guest is already on this class';
  END IF;

  INSERT INTO public.guest_bookings (
    tenant_id, class_id, guest_athlete_id, status
  ) VALUES (
    v_tenant_id, p_class_id, v_guest_id, 'booked'
  )
  RETURNING * INTO v_booking;

  RETURN json_build_object(
    'id', v_booking.id,
    'status', v_booking.status,
    'guest_athlete_id', v_guest_id,
    'full_name', (SELECT full_name FROM public.guest_athletes WHERE id = v_guest_id),
    'whatsapp', (SELECT whatsapp FROM public.guest_athletes WHERE id = v_guest_id),
    'instagram', (SELECT instagram FROM public.guest_athletes WHERE id = v_guest_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.coach_update_guest_booking_status(
  p_guest_booking_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_class_id uuid;
  v_coach_id uuid;
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('booked', 'attended', 'no_show') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT gb.class_id, c.coach_id, gb.tenant_id
  INTO v_class_id, v_coach_id, v_tenant_id
  FROM public.guest_bookings gb
  JOIN public.classes c ON c.id = gb.class_id
  WHERE gb.id = p_guest_booking_id;

  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'Guest booking not found';
  END IF;

  IF NOT public.same_tenant(v_tenant_id) THEN
    RAISE EXCEPTION 'Guest booking not found';
  END IF;

  IF v_coach_id IS DISTINCT FROM auth.uid() AND NOT public.is_tenant_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.guest_bookings
  SET status = p_status, updated_at = now()
  WHERE id = p_guest_booking_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.coach_remove_guest_from_class(p_guest_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_class_id uuid;
  v_coach_id uuid;
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT gb.class_id, c.coach_id, gb.tenant_id
  INTO v_class_id, v_coach_id, v_tenant_id
  FROM public.guest_bookings gb
  JOIN public.classes c ON c.id = gb.class_id
  WHERE gb.id = p_guest_booking_id;

  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'Guest booking not found';
  END IF;

  IF NOT public.same_tenant(v_tenant_id) THEN
    RAISE EXCEPTION 'Guest booking not found';
  END IF;

  IF v_coach_id IS DISTINCT FROM auth.uid() AND NOT public.is_tenant_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  DELETE FROM public.guest_bookings WHERE id = p_guest_booking_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.coach_list_recent_guests(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  full_name text,
  whatsapp text,
  instagram text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_tenant_staff()
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.role::text = 'coach'
     ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  RETURN QUERY
  SELECT ga.id, ga.full_name, ga.whatsapp, ga.instagram, ga.created_at
  FROM public.guest_athletes ga
  WHERE public.same_tenant(ga.tenant_id)
  ORDER BY ga.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));
END;
$$;

REVOKE ALL ON FUNCTION public.coach_list_class_guests(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coach_add_guest_to_class(uuid, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coach_update_guest_booking_status(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coach_remove_guest_from_class(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coach_list_recent_guests(integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.coach_list_class_guests(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coach_add_guest_to_class(uuid, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coach_update_guest_booking_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coach_remove_guest_from_class(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coach_list_recent_guests(integer) TO authenticated;

COMMIT;
