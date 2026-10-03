-- Membership access is profiles.is_solvent, not payment history.
-- Auto-expiry flips solvent off when the renew / pack window elapses.
-- Approving a payment (or restoring access) starts a new window.

CREATE OR REPLACE FUNCTION public.expire_monthly_memberships() RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO public, pg_temp
AS $$
DECLARE
  today_caracas date := (timezone('America/Caracas', now()))::date;
  expired_ids uuid[] := ARRAY[]::uuid[];
  affected_rows int := 0;
BEGIN
  WITH due AS (
    SELECT p.id
    FROM public.profiles p
    LEFT JOIN public.membership_plans mp ON mp.id = p.plan
    WHERE p.role::text = 'member'
      AND p.is_solvent = true
      AND (
        (
          mp.limit_type = 'period'
          AND mp.validity_days IS NOT NULL
          AND mp.validity_days > 0
          AND (
            (COALESCE(p.plan_period_start, p.created_at) AT TIME ZONE 'America/Caracas')::date
            + mp.validity_days
          ) <= today_caracas
        )
        OR
        (
          (mp.limit_type IS DISTINCT FROM 'period')
          AND (
            CASE
              WHEN p.plan_period_start IS NOT NULL THEN
                (p.plan_period_start AT TIME ZONE 'America/Caracas')::date
              ELSE
                (p.created_at AT TIME ZONE 'America/Caracas')::date + 31
            END
          ) <= today_caracas
        )
      )
  ),
  updated AS (
    UPDATE public.profiles
    SET is_solvent = false
    WHERE id IN (SELECT id FROM due)
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]), COUNT(*)::int
  INTO expired_ids, affected_rows
  FROM updated;

  RETURN json_build_object(
    'status', 'success',
    'message', CASE
      WHEN affected_rows = 0 THEN 'No memberships to expire.'
      ELSE 'Processed expiry for ' || affected_rows || ' members.'
    END,
    'count', affected_rows,
    'user_ids', to_json(expired_ids),
    'timestamp', now()
  );
END;
$$;
