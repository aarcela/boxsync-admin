-- SaaS plans from www.getwodus.com (Starter / Growth / Pro + founding trial).
-- Distinct from membership_plans, which are per-box athlete products.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS platform_plan text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS platform_plan_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivation_reason text;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_platform_plan_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_platform_plan_check
  CHECK (platform_plan IN ('trial', 'starter', 'growth', 'pro'));

UPDATE public.tenants
SET trial_ends_at = created_at + interval '30 days'
WHERE platform_plan = 'trial'
  AND trial_ends_at IS NULL;
