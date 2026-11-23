-- Racha (weekly streak) on the server. Plan: gamification-spec.md, PR 1A.
--
-- Rule (same as app lib/attendanceStreak.ts, so old builds stay close):
--   * Week = Monday–Sunday in the gym's timezone (private.gym_timezone).
--   * Attended day = the class's start_time date in that timezone; unique days count.
--   * A week counts when attended days >= target. The current week never breaks the streak.
--   * Target = profiles.weekly_goal, else settings.milestones.defaultWeeklyTarget (3),
--     capped at the plan's weekly_limit when the plan is weekly-limited.
--   * Freeze: one missed week is forgiven if no other week was forgiven in the previous 6.
--     A forgiven week neither adds to nor breaks the streak. Computed from history.
--
-- New settings in tenants.settings.milestones (all optional):
--   streakEnabled (true), streakNudgeEnabled (true), defaultWeeklyTarget (3), firstMonthTarget (8).
--
-- New milestone types: 'streak' (values 4_weeks … 52_weeks) and 'first_month' ('completed').
-- New outbox kinds: milestone_streak, milestone_first_month, streak_at_risk.
-- Existing achievers are backfilled with push_sent_at = now() so deploy sends no pushes.

BEGIN;

-- 1) The athlete's own weekly target.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_goal smallint;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_weekly_goal_range;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_weekly_goal_range CHECK (weekly_goal IS NULL OR weekly_goal BETWEEN 1 AND 7);

-- 2) Settings readers.
CREATE OR REPLACE FUNCTION private.milestone_flag(p_tenant uuid, p_key text, p_default boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT CASE WHEN jsonb_typeof(t.settings -> 'milestones' -> p_key) = 'boolean'
                 THEN (t.settings -> 'milestones' ->> p_key)::boolean END
     FROM public.tenants t WHERE t.id = p_tenant),
    p_default
  );
$$;

CREATE OR REPLACE FUNCTION private.milestone_int(p_tenant uuid, p_key text, p_default int, p_min int, p_max int)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT LEAST(p_max, GREATEST(p_min, COALESCE(
    (SELECT CASE WHEN jsonb_typeof(t.settings -> 'milestones' -> p_key) = 'number'
                 THEN floor((t.settings -> 'milestones' ->> p_key)::numeric)::int END
     FROM public.tenants t WHERE t.id = p_tenant),
    p_default
  )));
$$;

-- 3) Weekly target for one member.
CREATE OR REPLACE FUNCTION private.streak_target(p_user uuid, p_tenant uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $$
  SELECT LEAST(7, GREATEST(1,
    CASE
      WHEN mp.limit_type = 'weekly' AND COALESCE(mp.weekly_limit, 0) > 0
        THEN LEAST(COALESCE(p.weekly_goal::int, private.milestone_int(p_tenant, 'defaultWeeklyTarget', 3, 1, 7)), mp.weekly_limit)
      ELSE COALESCE(p.weekly_goal::int, private.milestone_int(p_tenant, 'defaultWeeklyTarget', 3, 1, 7))
    END
  ))
  FROM public.profiles p
  LEFT JOIN public.membership_plans mp ON mp.id = p.plan
  WHERE p.id = p_user;
$$;

-- 4) Single source of truth for the streak. Looks back 104 weeks.
CREATE OR REPLACE FUNCTION private.week_streak(p_user uuid, p_tenant uuid)
RETURNS TABLE(
  current_streak int,
  best_streak int,
  weekly_target int,
  attended_this_week int,
  freeze_used_recently boolean,
  broke_last_week boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $$
DECLARE
  lookback constant int := 104;
  tz text := private.gym_timezone(p_tenant);
  today_local date := (timezone(tz, now()))::date;
  this_monday date := date_trunc('week', today_local)::date;
  target int := COALESCE(private.streak_target(p_user, p_tenant), 1);
  counts int[];
  run int := 0;
  best int := 0;
  last_forgiven int;  -- weeks ago of the most recent forgiven week
  broke boolean := false;
  i int;
BEGIN
  -- counts[i + 1] = attended days i weeks ago (i = 0 is the current week).
  SELECT array_agg(COALESCE(w.days, 0) ORDER BY g.weeks_ago)
  INTO counts
  FROM generate_series(0, lookback) AS g(weeks_ago)
  LEFT JOIN (
    SELECT ((this_monday - date_trunc('week', d.local_day)::date) / 7) AS weeks_ago,
           count(*)::int AS days
    FROM (
      SELECT DISTINCT (c.start_time AT TIME ZONE tz)::date AS local_day
      FROM public.bookings b
      JOIN public.classes c ON c.id = b.class_id
      WHERE b.user_id = p_user
        AND c.tenant_id = p_tenant
        AND b.status = 'attended'
        AND c.start_time >= ((this_monday - lookback * 7)::timestamp AT TIME ZONE tz)
        AND c.start_time < (((this_monday + 7)::timestamp) AT TIME ZONE tz)
    ) d
    GROUP BY 1
  ) w ON w.weeks_ago = g.weeks_ago;

  -- Completed weeks, oldest first.
  FOR i IN REVERSE lookback..1 LOOP
    IF counts[i + 1] >= target THEN
      run := run + 1;
    ELSIF run > 0 AND (last_forgiven IS NULL OR last_forgiven - i > 6) THEN
      last_forgiven := i;
    ELSE
      IF i = 1 AND run >= 4 THEN
        broke := true;
      END IF;
      run := 0;
    END IF;
    best := GREATEST(best, run);
  END LOOP;

  -- The current week only ever adds.
  IF counts[1] >= target THEN
    run := run + 1;
  END IF;
  best := GREATEST(best, run);

  current_streak := run;
  best_streak := best;
  weekly_target := target;
  attended_this_week := counts[1];
  freeze_used_recently := run > 0 AND last_forgiven IS NOT NULL AND last_forgiven <= 6;
  broke_last_week := broke;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION private.milestone_flag(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.milestone_int(uuid, text, int, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.streak_target(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.week_streak(uuid, uuid) FROM PUBLIC;

-- 5) Athlete: own streak.
CREATE OR REPLACE FUNCTION public.get_my_streak()
RETURNS TABLE(
  current_streak int,
  best_streak int,
  weekly_target int,
  attended_this_week int,
  freeze_used_recently boolean,
  streak_enabled boolean
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
  SELECT s.current_streak, s.best_streak, s.weekly_target, s.attended_this_week,
         s.freeze_used_recently,
         private.milestone_flag(caller_tenant, 'enabled', true)
           AND private.milestone_flag(caller_tenant, 'streakEnabled', true)
  FROM private.week_streak(auth.uid(), caller_tenant) s;
END;
$$;

-- 6) Staff: one row per active member of the caller's gym.
CREATE OR REPLACE FUNCTION public.staff_streak_overview()
RETURNS TABLE(
  member_id uuid,
  full_name text,
  avatar_url text,
  current_streak int,
  best_streak int,
  weekly_target int,
  attended_this_week int,
  needs_this_week int,
  broke_last_week boolean,
  freeze_used_recently boolean
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
  SELECT p.tenant_id, p.role::text INTO caller_tenant, caller_role
  FROM public.profiles p WHERE p.id = auth.uid();
  IF caller_tenant IS NULL OR caller_role NOT IN ('admin', 'manager', 'coach') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.avatar_url,
         s.current_streak, s.best_streak, s.weekly_target, s.attended_this_week,
         GREATEST(0, s.weekly_target - s.attended_this_week),
         s.broke_last_week, s.freeze_used_recently
  FROM public.profiles p
  CROSS JOIN LATERAL private.week_streak(p.id, caller_tenant) s
  WHERE p.tenant_id = caller_tenant
    AND p.role::text = 'member'
    AND p.is_solvent IS TRUE
  ORDER BY s.current_streak DESC, p.full_name;
END;
$$;

-- 7) Athlete: set own weekly goal (NULL = gym default).
CREATE OR REPLACE FUNCTION public.set_my_weekly_goal(p_goal smallint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_goal IS NOT NULL AND (p_goal < 1 OR p_goal > 7) THEN
    RAISE EXCEPTION 'Weekly goal must be between 1 and 7' USING ERRCODE = '22023';
  END IF;
  UPDATE public.profiles SET weekly_goal = p_goal WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_streak() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_streak_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_my_weekly_goal(smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_streak() TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_streak_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_weekly_goal(smallint) TO authenticated;

-- 8) Streak + first-month milestones. Separate trigger so the live
--    check_class_count_milestone stays untouched; name sorts after it, so it runs after.
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
  v_weeks int;
  v_new_weeks int;
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
    SELECT s.current_streak INTO v_streak FROM private.week_streak(NEW.user_id, v_tenant) s;

    -- Insert every reached threshold; push only the highest new one.
    v_new_weeks := NULL;
    FOREACH v_weeks IN ARRAY ARRAY[4, 8, 12, 26, 52] LOOP
      EXIT WHEN v_streak < v_weeks;
      INSERT INTO public.milestones_achieved (user_id, tenant_id, milestone_type, milestone_value)
      VALUES (NEW.user_id, v_tenant, 'streak', v_weeks || '_weeks')
      ON CONFLICT (user_id, tenant_id, milestone_type, milestone_value) DO NOTHING;
      GET DIAGNOSTICS v_inserted = ROW_COUNT;
      IF v_inserted > 0 THEN
        v_new_weeks := v_weeks;
      END IF;
    END LOOP;

    IF v_new_weeks IS NOT NULL AND v_push THEN
      INSERT INTO public.notification_outbox (user_id, kind, payload)
      VALUES (NEW.user_id, 'milestone_streak', jsonb_build_object('weeks', v_new_weeks));
    END IF;
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

REVOKE ALL ON FUNCTION private.check_streak_milestones() FROM PUBLIC;

DROP TRIGGER IF EXISTS tr_check_streak_milestones ON public.bookings;
CREATE TRIGGER tr_check_streak_milestones
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION private.check_streak_milestones();

DROP TRIGGER IF EXISTS tr_check_streak_milestones_insert ON public.bookings;
CREATE TRIGGER tr_check_streak_milestones_insert
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  WHEN (NEW.status = 'attended')
  EXECUTE FUNCTION private.check_streak_milestones();

-- 9) Thursday nudge: members on a streak of 2+ who still need classes this week,
--    can still make it, and have not booked enough. One per member per week.
CREATE UNIQUE INDEX IF NOT EXISTS notification_outbox_streak_at_risk_week
  ON public.notification_outbox (user_id, (payload ->> 'week'))
  WHERE kind = 'streak_at_risk';

CREATE OR REPLACE FUNCTION public.enqueue_streak_nudges()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $$
DECLARE
  v_enqueued int := 0;
  v_rows int;
  t record;
  tz text;
  today_local date;
  this_monday date;
  days_left int;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR t IN
    SELECT id FROM public.tenants
    WHERE COALESCE(is_active, true)
      AND private.milestone_flag(id, 'enabled', true)
      AND private.milestone_flag(id, 'streakEnabled', true)
      AND private.milestone_flag(id, 'streakNudgeEnabled', true)
  LOOP
    tz := private.gym_timezone(t.id);
    today_local := (timezone(tz, now()))::date;
    this_monday := date_trunc('week', today_local)::date;
    days_left := 7 - EXTRACT(ISODOW FROM today_local)::int;  -- full days after today

    INSERT INTO public.notification_outbox (user_id, kind, payload)
    SELECT p.id, 'streak_at_risk',
           jsonb_build_object(
             'week', this_monday,
             'streak', s.current_streak,
             'needs', s.weekly_target - s.attended_this_week
           )
    FROM public.profiles p
    CROSS JOIN LATERAL private.week_streak(p.id, t.id) s
    CROSS JOIN LATERAL (
      SELECT count(DISTINCT (c.start_time AT TIME ZONE tz)::date)::int AS days
      FROM public.bookings b
      JOIN public.classes c ON c.id = b.class_id
      WHERE b.user_id = p.id
        AND c.tenant_id = t.id
        AND b.status = 'booked'
        AND c.start_time > now()
        AND (c.start_time AT TIME ZONE tz)::date <= this_monday + 6
    ) booked
    WHERE p.tenant_id = t.id
      AND p.role::text = 'member'
      AND p.is_solvent IS TRUE
      AND s.current_streak >= 2
      AND s.weekly_target - s.attended_this_week >= 1
      AND s.weekly_target - s.attended_this_week <= days_left
      AND s.attended_this_week + booked.days < s.weekly_target
    ON CONFLICT (user_id, (payload ->> 'week')) WHERE kind = 'streak_at_risk' DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_enqueued := v_enqueued + v_rows;
  END LOOP;

  RETURN v_enqueued;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_streak_nudges() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_streak_nudges() TO service_role;

-- 10) Backfill: record milestones already reached, marked as sent (no deploy-day pushes).
INSERT INTO public.milestones_achieved (user_id, tenant_id, milestone_type, milestone_value, push_sent_at)
SELECT p.id, p.tenant_id, 'streak', w.weeks || '_weeks', now()
FROM public.profiles p
CROSS JOIN LATERAL private.week_streak(p.id, p.tenant_id) s
CROSS JOIN unnest(ARRAY[4, 8, 12, 26, 52]) AS w(weeks)
WHERE p.tenant_id IS NOT NULL
  AND s.current_streak >= w.weeks
  AND private.milestone_flag(p.tenant_id, 'enabled', true)
  AND private.milestone_flag(p.tenant_id, 'streakEnabled', true)
ON CONFLICT (user_id, tenant_id, milestone_type, milestone_value) DO NOTHING;

INSERT INTO public.milestones_achieved (user_id, tenant_id, milestone_type, milestone_value, push_sent_at)
SELECT f.user_id, f.tenant_id, 'first_month', 'completed', now()
FROM (
  SELECT b.user_id, c.tenant_id, min(c.start_time) AS first_at
  FROM public.bookings b
  JOIN public.classes c ON c.id = b.class_id
  WHERE b.status = 'attended'
  GROUP BY b.user_id, c.tenant_id
) f
WHERE private.milestone_flag(f.tenant_id, 'enabled', true)
  AND (
    SELECT count(*)
    FROM public.bookings b
    JOIN public.classes c ON c.id = b.class_id
    WHERE b.user_id = f.user_id AND c.tenant_id = f.tenant_id AND b.status = 'attended'
      AND c.start_time < f.first_at + interval '30 days'
  ) >= private.milestone_int(f.tenant_id, 'firstMonthTarget', 8, 1, 60)
ON CONFLICT (user_id, tenant_id, milestone_type, milestone_value) DO NOTHING;

COMMIT;
