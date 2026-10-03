-- Coaches may read box income (admin ledger) only while the coachPayments module is on.

CREATE OR REPLACE FUNCTION public.tenant_feature_on(flag text, fallback boolean DEFAULT true)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT CASE jsonb_typeof(t.settings->'features'->flag)
        WHEN 'boolean' THEN (t.settings->'features'->>flag)::boolean
        ELSE NULL
      END
      FROM public.tenants t
      WHERE t.id = public.current_tenant_id()
    ),
    fallback
  );
$$;

REVOKE ALL ON FUNCTION public.tenant_feature_on(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_feature_on(text, boolean) TO authenticated;

DROP POLICY IF EXISTS incomes_select_coach ON public.incomes;
CREATE POLICY incomes_select_coach ON public.incomes
  FOR SELECT TO authenticated
  USING (
    public.same_tenant(tenant_id)
    AND COALESCE(
      (SELECT role = 'coach' FROM public.profiles WHERE id = auth.uid()),
      false
    )
    AND public.tenant_feature_on('coachPayments', true)
  );
