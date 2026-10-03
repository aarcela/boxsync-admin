-- Tenant-scoped expiry + dry-run count for the staff dashboard badge.
-- Cron still calls this with defaults (all tenants, write).
-- Revoke anon/authenticated: SECURITY DEFINER must not be callable from the browser.

DROP FUNCTION IF EXISTS public.expire_monthly_memberships();

CREATE OR REPLACE FUNCTION public.expire_monthly_memberships(
  p_tenant_id uuid DEFAULT NULL,
  p_dry_run boolean DEFAULT false
) RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO public, pg_temp
AS $$
DECLARE
  today_caracas date := (timezone('America/Caracas', now()))::date;
  expired_ids uuid[] := ARRAY[]::uuid[];
  affected_rows int := 0;
BEGIN
  SELECT COALESCE(array_agg(p.id), ARRAY[]::uuid[]), COUNT(*)::int
  INTO expired_ids, affected_rows
  FROM public.profiles p
  LEFT JOIN public.membership_plans mp ON mp.id = p.plan
  WHERE p.role::text = 'member'
    AND p.is_solvent = true
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
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
    );

  IF NOT p_dry_run AND cardinality(expired_ids) > 0 THEN
    UPDATE public.profiles
    SET is_solvent = false
    WHERE id = ANY(expired_ids)
      AND is_solvent = true;
  END IF;

  RETURN json_build_object(
    'status', 'success',
    'dry_run', p_dry_run,
    'message', CASE
      WHEN affected_rows = 0 THEN 'No memberships to expire.'
      WHEN p_dry_run THEN 'Due memberships: ' || affected_rows || '.'
      ELSE 'Processed expiry for ' || affected_rows || ' members.'
    END,
    'count', affected_rows,
    'user_ids', to_json(expired_ids),
    'timestamp', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.expire_monthly_memberships(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_monthly_memberships(uuid, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_monthly_memberships(uuid, boolean) TO service_role;
