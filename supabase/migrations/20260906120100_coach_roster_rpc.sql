-- Coach mode (mobile-only): lets a profile with role='coach' view and mark
-- attendance only for classes they are assigned to teach. Mobile uses the
-- anon/authenticated Supabase key (never service-role), so these RPCs run
-- SECURITY DEFINER and verify ownership internally rather than relying on a
-- broad table-level RLS policy.

BEGIN;

CREATE OR REPLACE FUNCTION public.coach_get_roster(p_class_id uuid)
RETURNS TABLE(id uuid, status text, user_id uuid, full_name text, avatar_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
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
    SELECT b.id, b.status::text, b.user_id, pr.full_name, pr.avatar_url
    FROM public.bookings b
    JOIN public.profiles pr ON pr.id = b.user_id
    WHERE b.class_id = p_class_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.coach_update_booking_status(p_booking_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_class_id uuid;
BEGIN
  IF p_status NOT IN ('booked', 'attended', 'no_show') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT class_id INTO v_class_id FROM public.bookings WHERE id = p_booking_id;
  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = v_class_id
      AND c.coach_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'coach')
  ) THEN
    RAISE EXCEPTION 'Not authorized for this booking';
  END IF;

  UPDATE public.bookings SET status = p_status::attendance_status WHERE id = p_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.coach_get_roster(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coach_update_booking_status(uuid, text) TO authenticated;

COMMIT;
