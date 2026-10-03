-- HQ-controlled Ask AI quota per tenant (monthly question count).

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS ai_monthly_question_limit integer;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_ai_monthly_question_limit_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_ai_monthly_question_limit_check
  CHECK (ai_monthly_question_limit IS NULL OR (ai_monthly_question_limit >= 0 AND ai_monthly_question_limit <= 10000));

CREATE TABLE IF NOT EXISTS public.tenant_ai_usage (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_ym text NOT NULL,
  questions_used integer NOT NULL DEFAULT 0,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, period_ym),
  CONSTRAINT tenant_ai_usage_period_ym_check CHECK (period_ym ~ '^\d{4}-\d{2}$'),
  CONSTRAINT tenant_ai_usage_questions_used_check CHECK (questions_used >= 0),
  CONSTRAINT tenant_ai_usage_prompt_tokens_check CHECK (prompt_tokens >= 0),
  CONSTRAINT tenant_ai_usage_completion_tokens_check CHECK (completion_tokens >= 0)
);

CREATE INDEX IF NOT EXISTS tenant_ai_usage_period_ym_idx
  ON public.tenant_ai_usage (period_ym);

ALTER TABLE public.tenant_ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_ai_usage_select_staff ON public.tenant_ai_usage;
CREATE POLICY tenant_ai_usage_select_staff ON public.tenant_ai_usage
  FOR SELECT TO authenticated
  USING (public.same_tenant(tenant_id) AND public.is_tenant_staff());

GRANT SELECT ON public.tenant_ai_usage TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.tenant_ai_usage FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_tenant_ai_question(p_tenant_id uuid, p_limit integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_period text := to_char((timezone('utc', now())), 'YYYY-MM');
  v_used integer;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id required';
  END IF;
  IF p_limit IS NULL OR p_limit <= 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'used', 0,
      'question_limit', COALESCE(p_limit, 0),
      'period_ym', v_period
    );
  END IF;

  INSERT INTO public.tenant_ai_usage (tenant_id, period_ym, questions_used)
  VALUES (p_tenant_id, v_period, 0)
  ON CONFLICT (tenant_id, period_ym) DO NOTHING;

  UPDATE public.tenant_ai_usage
  SET questions_used = questions_used + 1,
      updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND period_ym = v_period
    AND questions_used < p_limit
  RETURNING questions_used INTO v_used;

  IF v_used IS NULL THEN
    SELECT questions_used INTO v_used
    FROM public.tenant_ai_usage
    WHERE tenant_id = p_tenant_id AND period_ym = v_period;

    RETURN jsonb_build_object(
      'allowed', false,
      'used', COALESCE(v_used, 0),
      'question_limit', p_limit,
      'period_ym', v_period
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'used', v_used,
    'question_limit', p_limit,
    'period_ym', v_period
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_tenant_ai_question(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_period text := to_char((timezone('utc', now())), 'YYYY-MM');
BEGIN
  UPDATE public.tenant_ai_usage
  SET questions_used = GREATEST(questions_used - 1, 0),
      updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND period_ym = v_period
    AND questions_used > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_tenant_ai_question(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_tenant_ai_question(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_tenant_ai_question(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_tenant_ai_question(uuid) TO service_role;
