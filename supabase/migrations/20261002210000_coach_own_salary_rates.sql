-- Coaches may read their own salary tier and rates while the coach payroll module is on.

DROP POLICY IF EXISTS coach_salary_tiers_select_own ON public.coach_salary_tiers;
CREATE POLICY coach_salary_tiers_select_own ON public.coach_salary_tiers
  FOR SELECT TO authenticated
  USING (
    public.same_tenant(tenant_id)
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'coach'
        AND p.salary_tier_id = coach_salary_tiers.id
    )
    AND public.tenant_feature_on('coachPayments', true)
  );

DROP POLICY IF EXISTS coach_salary_tier_rates_select_own ON public.coach_salary_tier_rates;
CREATE POLICY coach_salary_tier_rates_select_own ON public.coach_salary_tier_rates
  FOR SELECT TO authenticated
  USING (
    public.same_tenant(tenant_id)
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'coach'
        AND p.salary_tier_id = coach_salary_tier_rates.tier_id
    )
    AND public.tenant_feature_on('coachPayments', true)
  );
