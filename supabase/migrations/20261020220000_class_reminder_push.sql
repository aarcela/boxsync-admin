-- One Expo push per booked class, N minutes before start.
-- Lead time lives in tenants.settings.booking.reminderMinutesBefore (default 15, 0 = off).
-- pg_cron every 5 minutes enqueues due rows; the existing pg_net drain sends them.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

CREATE UNIQUE INDEX IF NOT EXISTS notification_outbox_class_reminder_booking_uidx
  ON public.notification_outbox ((payload->>'booking_id'))
  WHERE kind = 'class_reminder';

CREATE OR REPLACE FUNCTION private.enqueue_class_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, private, pg_temp
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  INSERT INTO public.notification_outbox (user_id, kind, payload)
  SELECT
    b.user_id,
    'class_reminder',
    jsonb_build_object(
      'booking_id', b.id,
      'class_id', c.id,
      'class_type', c.class_type,
      'start_time', c.start_time
    )
  FROM public.bookings AS b
  INNER JOIN public.classes AS c
    ON c.id = b.class_id
  INNER JOIN public.tenants AS t
    ON t.id = c.tenant_id
  CROSS JOIN LATERAL (
    SELECT GREATEST(
      0,
      LEAST(
        120,
        CASE
          WHEN (t.settings #>> '{booking,reminderMinutesBefore}') ~ '^[0-9]+$'
            THEN (t.settings #>> '{booking,reminderMinutesBefore}')::integer
          ELSE 15
        END
      )
    ) AS minutes
  ) AS cfg
  WHERE b.status = 'booked'
    AND COALESCE(c.is_cancelled, false) IS FALSE
    AND cfg.minutes > 0
    AND c.start_time > now()
    AND c.start_time <= now() + make_interval(mins => cfg.minutes)
    AND b.created_at <= c.start_time - make_interval(mins => cfg.minutes)
  ON CONFLICT ((payload->>'booking_id')) WHERE (kind = 'class_reminder')
  DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION private.enqueue_class_reminders() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.enqueue_class_reminders() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION private.enqueue_class_reminders() TO postgres;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not enable pg_cron: %', SQLERRM;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron is not installed; skipping class reminder schedule';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'enqueue-class-reminders'
  ) THEN
    PERFORM cron.unschedule('enqueue-class-reminders');
  END IF;

  PERFORM cron.schedule(
    'enqueue-class-reminders',
    '*/5 * * * *',
    $cmd$SELECT private.enqueue_class_reminders()$cmd$
  );
END
$$;

COMMIT;
