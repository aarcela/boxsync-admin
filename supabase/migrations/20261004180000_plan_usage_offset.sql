-- Manual plan usage offset so staff can mark sessions already used outside the system.
-- Effective used = bookings_in_window + offset (weekly offset only applies to its week).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_usage_offset integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_usage_offset_week_start date NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_usage_offset_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_usage_offset_check
  CHECK (plan_usage_offset >= -1000 AND plan_usage_offset <= 1000);

COMMENT ON COLUMN public.profiles.plan_usage_offset IS
  'Sessions already used outside tracked bookings; added to weekly/period usage counts.';
COMMENT ON COLUMN public.profiles.plan_usage_offset_week_start IS
  'Monday date (matching date_trunc week) for which plan_usage_offset applies on weekly plans.';

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
  IF member_record.is_solvent IS NOT TRUE THEN
    RETURN 'Membership inactive. Please pay to book.';
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
    IF now() > period_end OR class_record.start_time >= period_end THEN
      RETURN 'This class is outside your plan validity window.';
    END IF;
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

CREATE OR REPLACE FUNCTION private.initialize_plan_period(member_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  UPDATE public.profiles p
  SET plan_period_start = now(),
      plan_usage_offset = 0,
      plan_usage_offset_week_start = NULL
  FROM public.membership_plans m
  WHERE p.id = member_id
    AND p.plan = m.id
    AND m.limit_type = 'period'
    AND p.plan_period_start IS NULL
$function$;
