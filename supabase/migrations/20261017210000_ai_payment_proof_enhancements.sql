-- Add columns for AI payment proof enhancements
-- Store extracted bank name and reference for duplicate detection

BEGIN;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS ai_extracted_bank text,
  ADD COLUMN IF NOT EXISTS ai_extracted_reference text,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- Index for duplicate detection queries (reference within tenant)
CREATE INDEX IF NOT EXISTS payments_tenant_reference_idx
  ON public.payments (tenant_id, ai_extracted_reference)
  WHERE ai_extracted_reference IS NOT NULL;

-- Index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS payments_tenant_idx
  ON public.payments (tenant_id);

COMMIT;
