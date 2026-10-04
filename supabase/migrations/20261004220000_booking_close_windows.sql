-- Tenant-configurable book/cancel close windows via tenants.settings.booking.
-- Defaults: book until start (0), cancel until 60 minutes before (matches prior hardcode).

CREATE OR REPLACE FUNCTION private.class_booking_window_error(
  class_row_id uuid,
  kind text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  class_start timestamptz;
  tenant_uuid uuid;
  settings_bag jsonb;
  minutes_before integer;
  booking_bag jsonb;
BEGIN
  SELECT c.start_time, c.tenant_id
  INTO class_start, tenant_uuid
  FROM public.classes c
  WHERE c.id = class_row_id;

  IF NOT FOUND THEN
    RETURN 'Class not found.';
  END IF;

  SELECT t.settings INTO settings_bag
  FROM public.tenants t
  WHERE t.id = tenant_uuid;

  booking_bag := CASE
    WHEN settings_bag IS NULL THEN '{}'::jsonb
    ELSE COALESCE(settings_bag -> 'booking', '{}'::jsonb)
  END;

  IF kind = 'cancel' THEN
    minutes_before := COALESCE(
      NULLIF(booking_bag ->> 'cancelClosesMinutesBefore', '')::integer,
      60
    );
  ELSE
    minutes_before := COALESCE(
      NULLIF(booking_bag ->> 'bookClosesMinutesBefore', '')::integer,
      0
    );
  END IF;

  IF minutes_before < 0 THEN
    minutes_before := 0;
  END IF;

  IF class_start <= now() + make_interval(mins => minutes_before) THEN
    IF kind = 'cancel' THEN
      IF minutes_before <= 0 THEN
        RETURN 'You cannot cancel a class that has already started.';
      END IF;
      RETURN format(
        'Cancellations are only allowed up to %s minutes before class.',
        minutes_before
      );
    END IF;

    IF minutes_before <= 0 THEN
      RETURN 'You cannot book a class that has already started.';
    END IF;
    RETURN format(
      'Booking closes %s minutes before class starts.',
      minutes_before
    );
  END IF;

  RETURN NULL;
END;
$function$;

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

CREATE OR REPLACE FUNCTION private.cancel_booking(class_row_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  affected_rows integer;
  window_error text;
BEGIN
  PERFORM 1
  FROM public.classes
  WHERE id = class_row_id AND tenant_id = public.current_tenant_id()
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('status', 'error', 'message', 'Class not found.');
  END IF;

  window_error := private.class_booking_window_error(class_row_id, 'cancel');
  IF window_error IS NOT NULL THEN
    RETURN json_build_object('status', 'error', 'message', window_error);
  END IF;

  DELETE FROM public.bookings
  WHERE class_id = class_row_id AND user_id = auth.uid();
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows = 0 THEN
    RETURN json_build_object('status', 'error', 'message', 'Booking not found or could not be cancelled.');
  END IF;

  PERFORM private.promote_class_waitlist(class_row_id);
  RETURN json_build_object('status', 'success', 'message', 'Booking cancelled successfully.');
END;
$function$;

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
  booking_error := private.capacity_booking_error(auth.uid(), class_row_id);
  IF booking_error IS NOT NULL THEN
    RETURN json_build_object('status', 'error', 'message', booking_error);
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE class_id = class_row_id AND user_id = auth.uid()
  ) THEN
    RETURN json_build_object('status', 'error', 'message', 'Already booked.');
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
      'message', 'You are already on the waitlist.', 'position', queue_position
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
      'message', 'A spot opened and you were booked.'
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
    'message', 'Added to the waitlist.', 'position', queue_position
  );
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('status', 'error', 'message', 'You are already on the waitlist.');
END;
$function$;

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
