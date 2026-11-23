-- Racha: monthly streak + overall class milestones every 50. Run after 20261122120000_racha_streak.sql.
--
-- Monthly streak: a calendar month (gym timezone) counts when unique attended days
-- >= 4 x the member's weekly target. The current month never breaks the streak. No freeze.
-- Milestones: 'month_streak' 3_months, 6_months, 12_months, 24_months (push kind milestone_month_streak).
--
-- Overall: 'class_count' milestones at every multiple of 50 (50, 100, 150 …), on top of the
-- gym's classCountThresholds. Same type and unique key, so 50/100/200 are never doubled.

BEGIN;

-- 0) Weekly target follows the plan: a weekly-limited plan (e.g. 5 days) sets the target
--    to its limit; other plans use the athlete's weekly_goal, else the gym default (3).
CREATE OR REPLACE FUNCTION private.streak_target(p_user uuid, p_tenant uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $$
  SELECT LEAST(7, GREATEST(1,
    CASE
      WHEN mp.limit_type = 'weekly' AND COALESCE(mp.weekly_limit, 0) > 0 THEN mp.weekly_limit
      ELSE COALESCE(p.weekly_goal::int, private.milestone_int(p_tenant, 'defaultWeeklyTarget', 3, 1, 7))
    END
  ))
  FROM public.profiles p
  LEFT JOIN public.membership_plans mp ON mp.id = p.plan
  WHERE p.id = p_user;
$$;

-- 1) Monthly streak. Looks back 36 months.
CREATE OR REPLACE FUNCTION private.month_streak(p_user uuid, p_tenant uuid)
RETURNS TABLE(
  current_streak int,
  best_streak int,
  monthly_target int,
  attended_this_month int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $$
DECLARE
  lookback constant int := 36;
  tz text := private.gym_timezone(p_tenant);
  this_month date := date_trunc('month', (timezone(tz, now()))::date)::date;
  target int := 4 * COALESCE(private.streak_target(p_user, p_tenant), 1);
  counts int[];
  run int := 0;
  best int := 0;
  i int;
BEGIN
  SELECT array_agg(COALESCE(m.days, 0) ORDER BY g.months_ago)
  INTO counts
  FROM generate_series(0, lookback) AS g(months_ago)
  LEFT JOIN (
    SELECT ((EXTRACT(YEAR FROM this_month)::int * 12 + EXTRACT(MONTH FROM this_month)::int)
          - (EXTRACT(YEAR FROM d.local_day)::int * 12 + EXTRACT(MONTH FROM d.local_day)::int)) AS months_ago,
           count(*)::int AS days
    FROM (
      SELECT DISTINCT (c.start_time AT TIME ZONE tz)::date AS local_day
      FROM public.bookings b
      JOIN public.classes c ON c.id = b.class_id
      WHERE b.user_id = p_user
        AND c.tenant_id = p_tenant
        AND b.status = 'attended'
        AND c.start_time >= (((this_month - make_interval(months => lookback))::date)::timestamp AT TIME ZONE tz)
        AND c.start_time < ((((this_month + interval '1 month')::date)::timestamp) AT TIME ZONE tz)
    ) d
    GROUP BY 1
  ) m ON m.months_ago = g.months_ago;

  FOR i IN REVERSE lookback..1 LOOP
    IF counts[i + 1] >= target THEN
      run := run + 1;
    ELSE
      run := 0;
    END IF;
    best := GREATEST(best, run);
  END LOOP;

  IF counts[1] >= target THEN
    run := run + 1;
  END IF;
  best := GREATEST(best, run);

  current_streak := run;
  best_streak := best;
  monthly_target := target;
  attended_this_month := counts[1];
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION private.month_streak(uuid, uuid) FROM PUBLIC;

-- 2) get_my_streak gains the monthly streak and lifetime attended classes.
DROP FUNCTION IF EXISTS public.get_my_streak();
CREATE FUNCTION public.get_my_streak()
RETURNS TABLE(
  current_streak int,
  best_streak int,
  weekly_target int,
  attended_this_week int,
  freeze_used_recently boolean,
  streak_enabled boolean,
  monthly_streak int,
  best_monthly_streak int,
  monthly_target int,
  attended_this_month int,
  total_attended int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $$
DECLARE
  caller_tenant uuid;
BEGIN
  SELECT p.tenant_id INTO caller_tenant FROM public.profiles p WHERE p.id = auth.uid();
  IF caller_tenant IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT w.current_streak, w.best_streak, w.weekly_target, w.attended_this_week,
         w.freeze_used_recently,
         private.milestone_flag(caller_tenant, 'enabled', true)
           AND private.milestone_flag(caller_tenant, 'streakEnabled', true),
         m.current_streak, m.best_streak, m.monthly_target, m.attended_this_month,
         (SELECT count(*)::int
          FROM public.bookings b
          JOIN public.classes c ON c.id = b.class_id
          WHERE b.user_id = auth.uid() AND c.tenant_id = caller_tenant AND b.status = 'attended')
  FROM private.week_streak(auth.uid(), caller_tenant) w
  CROSS JOIN private.month_streak(auth.uid(), caller_tenant) m;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_streak() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_streak() TO authenticated;

-- 3) Milestone trigger: weekly + monthly streaks, every-50 classes, first month.
CREATE OR REPLACE FUNCTION private.check_streak_milestones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $$
DECLARE
  v_tenant uuid := NEW.tenant_id;
  v_push boolean;
  v_streak int;
  v_value int;
  v_new int;
  v_total int;
  v_first timestamptz;
  v_target int;
  v_count int;
  v_inserted int;
BEGIN
  IF NEW.status IS DISTINCT FROM 'attended'
     OR (TG_OP = 'UPDATE' AND OLD.status = 'attended')
     OR NOT private.milestone_flag(v_tenant, 'enabled', true) THEN
    RETURN NEW;
  END IF;

  v_push := private.milestone_flag(v_tenant, 'pushEnabled', true);

  IF private.milestone_flag(v_tenant, 'streakEnabled', true) THEN
    -- Weekly streak: insert every reached threshold; push only the highest new one.
    SELECT s.current_streak INTO v_streak FROM private.week_streak(NEW.user_id, v_tenant) s;
    v_new := NULL;
    FOREACH v_value IN ARRAY ARRAY[4, 8, 12, 26, 52] LOOP
      EXIT WHEN v_streak < v_value;
      INSERT INTO public.milestones_achieved (user_id, tenant_id, milestone_type, milestone_value)
      VALUES (NEW.user_id, v_tenant, 'streak', v_value || '_weeks')
      ON CONFLICT (user_id, tenant_id, milestone_type, milestone_value) DO NOTHING;
      GET DIAGNOSTICS v_inserted = ROW_COUNT;
      IF v_inserted > 0 THEN v_new := v_value; END IF;
    END LOOP;
    IF v_new IS NOT NULL AND v_push THEN
      INSERT INTO public.notification_outbox (user_id, kind, payload)
      VALUES (NEW.user_id, 'milestone_streak', jsonb_build_object('weeks', v_new));
    END IF;

    -- Monthly streak.
    SELECT s.current_streak INTO v_streak FROM private.month_streak(NEW.user_id, v_tenant) s;
    v_new := NULL;
    FOREACH v_value IN ARRAY ARRAY[3, 6, 12, 24] LOOP
      EXIT WHEN v_streak < v_value;
      INSERT INTO public.milestones_achieved (user_id, tenant_id, milestone_type, milestone_value)
      VALUES (NEW.user_id, v_tenant, 'month_streak', v_value || '_months')
      ON CONFLICT (user_id, tenant_id, milestone_type, milestone_value) DO NOTHING;
      GET DIAGNOSTICS v_inserted = ROW_COUNT;
      IF v_inserted > 0 THEN v_new := v_value; END IF;
    END LOOP;
    IF v_new IS NOT NULL AND v_push THEN
      INSERT INTO public.notification_outbox (user_id, kind, payload)
      VALUES (NEW.user_id, 'milestone_month_streak', jsonb_build_object('months', v_new));
    END IF;
  END IF;

  -- Overall: every 50 attended classes. Configured thresholds stay with check_class_count_milestone.
  SELECT count(*)::int INTO v_total
  FROM public.bookings b
  JOIN public.classes c ON c.id = b.class_id
  WHERE b.user_id = NEW.user_id AND c.tenant_id = v_tenant AND b.status = 'attended';

  v_new := NULL;
  FOR v_value IN SELECT generate_series(50, v_total, 50) LOOP
    CONTINUE WHEN v_value = ANY (get_milestone_thresholds(v_tenant));
    INSERT INTO public.milestones_achieved (user_id, tenant_id, milestone_type, milestone_value)
    VALUES (NEW.user_id, v_tenant, 'class_count', v_value::text)
    ON CONFLICT (user_id, tenant_id, milestone_type, milestone_value) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted > 0 THEN v_new := v_value; END IF;
  END LOOP;
  IF v_new IS NOT NULL AND v_push THEN
    INSERT INTO public.notification_outbox (user_id, kind, payload)
    VALUES (NEW.user_id, 'milestone_class_count', jsonb_build_object('count', v_new));
  END IF;

  -- First month: firstMonthTarget attended classes within 30 days of the first one.
  SELECT min(c.start_time) INTO v_first
  FROM public.bookings b
  JOIN public.classes c ON c.id = b.class_id
  WHERE b.user_id = NEW.user_id AND c.tenant_id = v_tenant AND b.status = 'attended';

  IF v_first IS NOT NULL AND now() < v_first + interval '31 days' THEN
    v_target := private.milestone_int(v_tenant, 'firstMonthTarget', 8, 1, 60);
    SELECT count(*) INTO v_count
    FROM public.bookings b
    JOIN public.classes c ON c.id = b.class_id
    WHERE b.user_id = NEW.user_id AND c.tenant_id = v_tenant AND b.status = 'attended'
      AND c.start_time < v_first + interval '30 days';

    IF v_count >= v_target THEN
      INSERT INTO public.milestones_achieved (user_id, tenant_id, milestone_type, milestone_value)
      VALUES (NEW.user_id, v_tenant, 'first_month', 'completed')
      ON CONFLICT (user_id, tenant_id, milestone_type, milestone_value) DO NOTHING;
      GET DIAGNOSTICS v_inserted = ROW_COUNT;
      IF v_inserted > 0 AND v_push THEN
        INSERT INTO public.notification_outbox (user_id, kind, payload)
        VALUES (NEW.user_id, 'milestone_first_month', jsonb_build_object('classes', v_target));
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Backfill without pushes.
INSERT INTO public.milestones_achieved (user_id, tenant_id, milestone_type, milestone_value, push_sent_at)
SELECT p.id, p.tenant_id, 'month_streak', m.months || '_months', now()
FROM public.profiles p
CROSS JOIN LATERAL private.month_streak(p.id, p.tenant_id) s
CROSS JOIN unnest(ARRAY[3, 6, 12, 24]) AS m(months)
WHERE p.tenant_id IS NOT NULL
  AND s.current_streak >= m.months
  AND private.milestone_flag(p.tenant_id, 'enabled', true)
  AND private.milestone_flag(p.tenant_id, 'streakEnabled', true)
ON CONFLICT (user_id, tenant_id, milestone_type, milestone_value) DO NOTHING;

INSERT INTO public.milestones_achieved (user_id, tenant_id, milestone_type, milestone_value, push_sent_at)
SELECT t.user_id, t.tenant_id, 'class_count', v.n::text, now()
FROM (
  SELECT b.user_id, c.tenant_id, count(*)::int AS total
  FROM public.bookings b
  JOIN public.classes c ON c.id = b.class_id
  WHERE b.status = 'attended'
  GROUP BY b.user_id, c.tenant_id
) t
CROSS JOIN LATERAL generate_series(50, t.total, 50) AS v(n)
WHERE private.milestone_flag(t.tenant_id, 'enabled', true)
ON CONFLICT (user_id, tenant_id, milestone_type, milestone_value) DO NOTHING;

COMMIT;
