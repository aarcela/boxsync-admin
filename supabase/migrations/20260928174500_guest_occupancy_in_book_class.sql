-- Make member booking + waitlist promotion respect guest occupancy.

CREATE OR REPLACE FUNCTION private.book_class(class_row_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  target_class record;
  booking_error text;
  current_occupancy integer;
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

  PERFORM 1 FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  booking_error := private.capacity_booking_error(auth.uid(), class_row_id);
  IF booking_error IS NOT NULL THEN
    RETURN json_build_object('status', 'error', 'message', booking_error);
  END IF;

  current_occupancy := public.class_active_occupancy(class_row_id);
  IF current_occupancy >= target_class.max_capacity THEN
    RETURN json_build_object('status', 'error', 'message', 'Class is full.');
  END IF;

  PERFORM private.initialize_plan_period(auth.uid());
  INSERT INTO public.bookings (user_id, class_id, tenant_id)
  VALUES (auth.uid(), class_row_id, target_class.tenant_id);

  UPDATE public.class_waitlist
  SET status = 'promoted', promoted_at = now(), status_reason = NULL, updated_at = now()
  WHERE class_id = class_row_id AND user_id = auth.uid() AND status = 'active';

  RETURN json_build_object('status', 'success', 'message', 'Class booked successfully!');
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('status', 'error', 'message', 'Already booked.');
END;
$function$;

CREATE OR REPLACE FUNCTION private.promote_class_waitlist(target_class_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  class_record record;
  candidate record;
  booking_error text;
  current_occupancy integer;
  inserted_rows integer;
  promoted_count integer := 0;
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
