-- Demo tenants created from HQ (/super-admin/demos) for outreach videos.
-- Demos are excluded from HQ metrics, crons and product events, expire on
-- demo_expires_at and are purged 7 days later by /api/admin/cron/demo-cleanup.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS demo_label text,
  ADD COLUMN IF NOT EXISTS demo_source text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_demo_expiry_check'
  ) THEN
    ALTER TABLE public.tenants ADD CONSTRAINT tenants_demo_expiry_check
      CHECK (NOT is_demo OR demo_expires_at IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tenants_demo_idx
  ON public.tenants (demo_expires_at) WHERE is_demo;

COMMENT ON COLUMN public.tenants.is_demo IS
  'HQ demo tenant for sales outreach. Excluded from metrics; purge only rows with is_demo = true.';
COMMENT ON COLUMN public.tenants.demo_source IS
  'Public source of the schedule (e.g. Instagram URL). Never private data.';

-- Clean view for metrics (chief, Growth, reports). activated_at is still set
-- by trigger on demo tenants, so activation metrics must read this view.
CREATE OR REPLACE VIEW public.real_tenants WITH (security_invoker = true) AS
  SELECT * FROM public.tenants WHERE NOT is_demo;

REVOKE ALL ON public.real_tenants FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.real_tenants TO service_role;
