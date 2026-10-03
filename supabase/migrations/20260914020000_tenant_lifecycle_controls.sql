-- Platform-controlled tenant lifecycle. A deactivated box is blocked at HQ
-- middleware while its tenant data remains intact for support and reactivation.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivation_reason text;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_deactivation_reason_length_check
  CHECK (deactivation_reason IS NULL OR char_length(deactivation_reason) <= 500);
